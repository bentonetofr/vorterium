import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../shared/lib/supabase'
import { captureScreen, iceServers, tuneVideoSender, withStereoOpus, withVideoStartBitrate } from './mesaRtc'

// ────────────────────────────────────────────────────────
// Mesa: o mestre transmite a tela (com som) direto pra cada jogador por
// WebRTC — uma conexão por jogador — e/ou mostra uma imagem da galeria.
// O Supabase Realtime (canal privado "mesa:<campanha>", só membros) leva
// a negociação e o estado:
//
//   jogador → viewer-join {viewerId, name}   "estou aqui"
//   mestre  → state {stage}                  o que está na mesa (tela? pausada? imagem?)
//   mestre  → offer  {to, sdp}               uma por jogador, se tem tela
//   jogador → answer {from, sdp}
//   ambos   → ice    {to | from, candidate}
//   mestre  → ping   {id, x, y}              ponteiro (x/y de 0 a 1 na imagem)
//   jogador → viewer-leave {viewerId}
//
// E no canal "mesa-aviso:<campanha>" (que os jogadores escutam de todas
// as campanhas deles, em qualquer página), o mestre manda:
//   live {liveId, masterName} / ended {liveId} — e responde "status?".
//
// viewerId = usuário + sufixo aleatório, pra mesma pessoa em duas abas
// não derrubar uma a outra.
// ────────────────────────────────────────────────────────

export type ViewerStatus = 'offline' | 'waiting' | 'connecting' | 'live' | 'reconnecting' | 'lost'

export type LinkQuality = 'good' | 'fair' | 'poor'

export interface ViewerStats {
  /** Quadros por segundo saindo pra esse jogador (cai sozinho com a tela parada). */
  fps:     number | null
  height:  number | null
  rttMs:   number | null
  /** Fração de pacotes perdidos (0–1). */
  loss:    number | null
  quality: LinkQuality
}

export interface MesaViewer {
  id:    string
  name:  string
  state: RTCPeerConnectionState
  stats: ViewerStats | null
}

export interface MesaImage {
  /** Id na galeria do mestre (pra marcar qual está na mesa). */
  id:   string
  url:  string
  name: string
}

/** O que está na mesa agora — o mestre define e manda pra todos. */
export interface MesaStage {
  /** Id da "sessão ao vivo" (tela ou imagem); null = nada na mesa. */
  liveId:   string | null
  /** Id da transmissão de tela atual — muda a cada "Transmitir tela". */
  screenId: string | null
  paused:   boolean
  audio:    boolean
  image:    MesaImage | null
}

export interface MesaPing {
  id: string
  x:  number
  y:  number
}

export interface MesaSnapshot {
  channelError: string | null
  stage:        MesaStage
  /** Tem algo na mesa (tela ou imagem). */
  live:         boolean
  pings:        MesaPing[]
  // Mestre
  localStream:  MediaStream | null
  viewers:      MesaViewer[]
  // Jogador
  status:       ViewerStatus
  remoteStream: MediaStream | null
}

export const EMPTY_STAGE: MesaStage = { liveId: null, screenId: null, paused: false, audio: false, image: null }

export const EMPTY_SNAPSHOT: MesaSnapshot = {
  channelError: null,
  stage:        EMPTY_STAGE,
  live:         false,
  pings:        [],
  localStream:  null,
  viewers:      [],
  status:       'offline',
  remoteStream: null,
}

interface Peer {
  pc:          RTCPeerConnection
  name:        string
  pending:     RTCIceCandidateInit[]
  videoSender: RTCRtpSender | null
  audioSender: RTCRtpSender | null
  stats:       ViewerStats | null
  dropTimer?:  number
}

interface SessionOptions {
  campaignId: string
  userId:     string
  name:       string
  isMaster:   boolean
  onChange:   (snapshot: MesaSnapshot) => void
}

type Payload = Record<string, unknown>

/**
 * Conexão "instável" por mais que isso = a outra ponta foi embora (fechou
 * a aba, caiu a internet). O WebRTC sozinho leva ~30 s pra desistir.
 */
const DISCONNECT_GRACE_MS = 6000
/** Jogador pediu pra entrar e a oferta não veio: pede de novo. */
const OFFER_TIMEOUT_MS    = 8000
/** Reconexão automática do jogador: esperas crescentes, até desistir. */
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 6000, 10000, 10000, 15000, 15000]
const STATS_INTERVAL_MS   = 2000
const PING_LIFETIME_MS    = 2400
const PING_MIN_GAP_MS     = 200

function newId(): string {
  return crypto.randomUUID().slice(0, 8)
}

/** Nota da conexão de um jogador — sem olhar fps (tela parada manda poucos quadros). */
export function rateLink(height: number | null, rttMs: number | null, loss: number | null): LinkQuality {
  if ((loss ?? 0) > 0.08 || (rttMs ?? 0) > 600 || (height != null && height < 360)) return 'poor'
  if ((loss ?? 0) > 0.02 || (rttMs ?? 0) > 250 || (height != null && height < 720)) return 'fair'
  return 'good'
}

function isStage(value: unknown): value is MesaStage {
  return typeof value === 'object' && value !== null && 'liveId' in value && 'screenId' in value
}

export class MesaSession {
  private readonly opts: SessionOptions
  private readonly myId: string
  private channel: RealtimeChannel | null = null
  private aviso:   RealtimeChannel | null = null
  private disposed = false
  private snap: MesaSnapshot = { ...EMPTY_SNAPSHOT }

  // Mestre
  private localStream: MediaStream | null = null
  private readonly peers = new Map<string, Peer>()
  private statsTimer: number | undefined
  private lastPingAt = 0
  private senderSync: Promise<void> = Promise.resolve()

  // Jogador
  private viewerPc: RTCPeerConnection | null = null
  private viewerPending: RTCIceCandidateInit[] = []
  private viewerDropTimer: number | undefined
  private offerTimer: number | undefined
  private reconnectTimer: number | undefined
  private reconnectAttempts = 0
  private lastJoinAt = 0

  constructor(opts: SessionOptions) {
    this.opts = opts
    this.myId = `${opts.userId}:${newId()}`
  }

  get snapshot(): MesaSnapshot {
    return this.snap
  }

  private update(patch: Partial<MesaSnapshot>) {
    if (this.disposed) return
    const next = { ...this.snap, ...patch }
    next.live = Boolean(next.stage.screenId || next.stage.image)
    this.snap = next
    this.opts.onChange(next)
  }

  private send(event: string, payload: Payload = {}) {
    if (!this.channel) return
    void this.channel.send({ type: 'broadcast', event, payload })
  }

  // ── Ciclo de vida ──────────────────────────────────────

  async connect(): Promise<void> {
    // Canais privados: o Realtime confere a policy com o token do usuário.
    await supabase.realtime.setAuth()
    if (this.disposed) return

    const channel = supabase.channel(`mesa:${this.opts.campaignId}`, {
      config: { private: true, broadcast: { self: false } },
    })
    this.channel = channel

    const on = (event: string, handler: (payload: Payload) => void) => {
      channel.on('broadcast', { event }, ({ payload }) => handler((payload ?? {}) as Payload))
    }

    if (this.opts.isMaster) {
      on('viewer-join', (p) => {
        this.sendState()
        void this.offerTo(String(p.viewerId ?? ''), String(p.name ?? 'Jogador'))
      })
      on('answer',       (p) => { void this.handleAnswer(String(p.from ?? ''), String(p.sdp ?? '')) })
      on('ice',          (p) => { if (p.from) void this.handleMasterIce(String(p.from), p.candidate as RTCIceCandidateInit) })
      on('viewer-leave', (p) => this.closePeer(String(p.viewerId ?? '')))
      this.connectAviso()
    } else {
      on('state', (p) => { if (isStage(p.stage)) this.handleState(p.stage) })
      on('ping',  (p) => this.addPing(p))
      on('offer', (p) => { if (p.to === this.myId) void this.handleOffer(String(p.sdp ?? '')) })
      on('ice',   (p) => { if (p.to === this.myId) void this.handleViewerIce(p.candidate as RTCIceCandidateInit) })
    }

    channel.subscribe((status) => {
      if (this.disposed) return
      if (status === 'SUBSCRIBED') {
        this.update({ channelError: null })
        if (this.opts.isMaster) {
          // Reconectou no meio: manda o estado de novo.
          if (this.snap.live) this.sendState()
        } else if (!this.viewerPc) {
          if (this.snap.status === 'offline') this.update({ status: 'waiting' })
          this.join()
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.update({ channelError: 'Não foi possível conectar à Mesa. Recarregue a página e tente de novo.' })
      }
    })
  }

  dispose(): void {
    if (this.disposed) return
    if (this.opts.isMaster) {
      if (this.snap.live) {
        this.snap = { ...this.snap, stage: EMPTY_STAGE }
        this.sendState()
        this.sendAviso('ended', { liveId: null })
      }
      this.stopTracks()
      for (const id of [...this.peers.keys()]) this.closePeer(id, false)
      window.clearInterval(this.statsTimer)
    } else {
      this.send('viewer-leave', { viewerId: this.myId })
      this.closeViewerPc()
      window.clearTimeout(this.reconnectTimer)
    }
    this.disposed = true
    if (this.channel) void supabase.removeChannel(this.channel)
    if (this.aviso) void supabase.removeChannel(this.aviso)
    this.channel = null
    this.aviso = null
  }

  // ── Ponteiro (mestre manda, todos veem) ────────────────

  ping(x: number, y: number): void {
    if (!this.opts.isMaster || !this.snap.live) return
    const now = performance.now()
    if (now - this.lastPingAt < PING_MIN_GAP_MS) return
    this.lastPingAt = now
    const payload = { id: newId(), x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }
    this.send('ping', payload)
    this.addPing(payload)
  }

  private addPing(p: Payload) {
    const x = Number(p.x), y = Number(p.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    const ping: MesaPing = { id: String(p.id ?? newId()), x, y }
    this.update({ pings: [...this.snap.pings, ping].slice(-8) })
    window.setTimeout(() => {
      this.update({ pings: this.snap.pings.filter((q) => q.id !== ping.id) })
    }, PING_LIFETIME_MS)
  }

  // ── Mestre: estado e aviso ─────────────────────────────

  private setStage(patch: Partial<MesaStage>) {
    const prev = this.snap.stage
    const next: MesaStage = { ...prev, ...patch }
    const wasLive = Boolean(prev.screenId || prev.image)
    const isLive  = Boolean(next.screenId || next.image)
    if (!wasLive && isLive) next.liveId = newId()
    if (!isLive) next.liveId = null
    this.update({ stage: next })
    this.sendState()
    if (!wasLive && isLive) this.sendAviso('live', { liveId: next.liveId, masterName: this.opts.name })
    if (wasLive && !isLive) this.sendAviso('ended', { liveId: prev.liveId })
  }

  private sendState() {
    this.send('state', { stage: this.snap.stage })
  }

  private connectAviso() {
    const aviso = supabase.channel(`mesa-aviso:${this.opts.campaignId}`, {
      config: { private: true, broadcast: { self: false } },
    })
    this.aviso = aviso
    // Jogador que abriu o site agora pergunta se tem algo rolando.
    aviso.on('broadcast', { event: 'status?' }, () => {
      if (this.snap.live) this.sendAviso('live', { liveId: this.snap.stage.liveId, masterName: this.opts.name })
    })
    aviso.subscribe()
  }

  private sendAviso(event: 'live' | 'ended', payload: Payload) {
    if (!this.aviso) return
    void this.aviso.send({ type: 'broadcast', event, payload: { ...payload, campaignId: this.opts.campaignId } })
  }

  // ── Mestre: tela ───────────────────────────────────────

  /** Abre a janela de escolher tela e começa a transmitir. Erros sobem pra quem chamou. */
  async startShare(): Promise<void> {
    if (!this.opts.isMaster || this.disposed) return
    const stream = await captureScreen()
    if (this.disposed) { stream.getTracks().forEach((t) => t.stop()); return }

    this.stopShare()
    this.adoptStream(stream)
    this.update({ localStream: stream })
    this.setStage({ screenId: newId(), paused: false, audio: stream.getAudioTracks().length > 0 })
    this.startStats()
  }

  /** Troca a tela/janela/aba sem derrubar ninguém (troca as faixas nas conexões). */
  async switchScreen(): Promise<void> {
    if (!this.opts.isMaster || this.disposed || !this.localStream) return
    const stream = await captureScreen()
    if (this.disposed || !this.localStream) { stream.getTracks().forEach((t) => t.stop()); return }

    const old = this.localStream
    this.adoptStream(stream)
    this.update({ localStream: stream })
    this.setStage({ audio: stream.getAudioTracks().length > 0 })
    await this.syncSenders()
    old.getTracks().forEach((t) => t.stop())
  }

  /**
   * Põe em cada conexão a faixa certa pro estado ATUAL (tela atual; vídeo
   * nulo se pausado). Em fila: pausar/retomar/trocar em sequência rápida
   * não deixa uma troca antiga (e já parada) chegar por último.
   */
  private syncSenders(): Promise<void> {
    this.senderSync = this.senderSync.then(async () => {
      const stream = this.localStream
      const video = stream && !this.snap.stage.paused ? stream.getVideoTracks()[0] ?? null : null
      const audio = stream?.getAudioTracks()[0] ?? null
      await Promise.all([...this.peers.values()].map(async (peer) => {
        try {
          if (peer.videoSender && peer.videoSender.track !== video) await peer.videoSender.replaceTrack(video)
          if (peer.audioSender && peer.audioSender.track !== audio) await peer.audioSender.replaceTrack(audio)
        } catch (err) {
          console.error('[Mesa] Falha ao trocar a faixa de um jogador:', err)
        }
      }))
    })
    return this.senderSync
  }

  private adoptStream(stream: MediaStream) {
    this.localStream = stream
    // "Parar compartilhamento" da barra do navegador também encerra aqui.
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (this.localStream === stream) this.stopShare()
    })
  }

  stopShare(): void {
    if (!this.localStream) return
    this.stopTracks()
    for (const id of [...this.peers.keys()]) this.closePeer(id, false)
    window.clearInterval(this.statsTimer)
    this.publishViewers()
    this.update({ localStream: null })
    this.setStage({ screenId: null, paused: false, audio: false })
  }

  /** Congela a imagem pros jogadores (o som continua). */
  async setPaused(paused: boolean): Promise<void> {
    if (!this.localStream || this.snap.stage.paused === paused) return
    this.setStage({ paused })
    await this.syncSenders()
  }

  // ── Mestre: imagem ─────────────────────────────────────

  showImage(image: MesaImage): void {
    if (!this.opts.isMaster) return
    this.setStage({ image })
  }

  hideImage(): void {
    if (!this.opts.isMaster) return
    this.setStage({ image: null })
  }

  // ── Mestre: conexões ───────────────────────────────────

  private stopTracks() {
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
  }

  private publishViewers() {
    this.update({
      viewers: [...this.peers.entries()].map(([id, peer]) => ({
        id,
        name:  peer.name,
        state: peer.pc.connectionState,
        stats: peer.stats,
      })),
    })
  }

  private closePeer(id: string, publish = true) {
    const peer = this.peers.get(id)
    if (!peer) return
    this.peers.delete(id)
    window.clearTimeout(peer.dropTimer)
    peer.pc.onicecandidate = null
    peer.pc.onconnectionstatechange = null
    peer.pc.close()
    if (publish) this.publishViewers()
  }

  private async offerTo(viewerId: string, name: string) {
    const stream = this.localStream
    if (!stream || !viewerId) return
    this.closePeer(viewerId, false)

    const pc = new RTCPeerConnection({ iceServers: iceServers() })
    const video = stream.getVideoTracks()[0]
    const audio = stream.getAudioTracks()[0]
    const videoSender = video ? pc.addTrack(video, stream) : null
    // Sempre um canal de áudio, mesmo sem som agora: "Trocar tela" pode
    // passar a ter som, e aí só troca a faixa, sem renegociar.
    const audioSender = audio
      ? pc.addTrack(audio, stream)
      : pc.addTransceiver('audio', { direction: 'sendonly', streams: [stream] }).sender
    const peer: Peer = { pc, name: name.slice(0, 60), pending: [], videoSender, audioSender, stats: null }
    this.peers.set(viewerId, peer)
    if (this.snap.stage.paused) await videoSender?.replaceTrack(null)
    await tuneVideoSender(pc)
    if (this.peers.get(viewerId) !== peer) return

    pc.onicecandidate = (e) => {
      if (e.candidate) this.send('ice', { to: viewerId, candidate: e.candidate.toJSON() })
    }
    pc.onconnectionstatechange = () => {
      if (this.peers.get(viewerId) !== peer) return
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(viewerId)
        return
      }
      window.clearTimeout(peer.dropTimer)
      if (pc.connectionState === 'disconnected') {
        peer.dropTimer = window.setTimeout(() => {
          if (this.peers.get(viewerId) === peer && pc.connectionState === 'disconnected') this.closePeer(viewerId)
        }, DISCONNECT_GRACE_MS)
      }
      if (pc.connectionState === 'connected') void tuneVideoSender(pc)
      this.publishViewers()
    }

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription({ type: 'offer', sdp: withStereoOpus(offer.sdp ?? '') })
      if (this.peers.get(viewerId) !== peer) return
      this.send('offer', { to: viewerId, sdp: pc.localDescription?.sdp ?? '' })
      this.publishViewers()
    } catch (err) {
      console.error('[Mesa] Falha ao criar a oferta:', err)
      if (this.peers.get(viewerId) === peer) this.closePeer(viewerId)
    }
  }

  private async handleAnswer(from: string, sdp: string) {
    const peer = this.peers.get(from)
    if (!peer || !sdp) return
    try {
      await peer.pc.setRemoteDescription({ type: 'answer', sdp: withVideoStartBitrate(sdp) })
      const pending = peer.pending.splice(0)
      for (const c of pending) await peer.pc.addIceCandidate(c).catch(() => {})
    } catch (err) {
      console.error('[Mesa] Resposta inválida do jogador:', err)
      if (this.peers.get(from) === peer) this.closePeer(from)
    }
  }

  private async handleMasterIce(from: string, candidate: RTCIceCandidateInit | undefined) {
    const peer = this.peers.get(from)
    if (!peer || !candidate) return
    if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(candidate).catch(() => {})
    else peer.pending.push(candidate)
  }

  // ── Mestre: qualidade de cada jogador ──────────────────

  private startStats() {
    window.clearInterval(this.statsTimer)
    this.statsTimer = window.setInterval(() => { void this.collectStats() }, STATS_INTERVAL_MS)
  }

  private async collectStats() {
    if (this.peers.size === 0) return
    await Promise.all([...this.peers.values()].map(async (peer) => {
      if (peer.pc.connectionState !== 'connected') return
      try {
        const report = await peer.pc.getStats()
        let fps: number | null = null, height: number | null = null, rttMs: number | null = null, loss: number | null = null
        report.forEach((s) => {
          if (s.type === 'outbound-rtp' && s.kind === 'video') {
            fps    = typeof s.framesPerSecond === 'number' ? Math.round(s.framesPerSecond) : fps
            height = typeof s.frameHeight === 'number' ? s.frameHeight : height
          } else if (s.type === 'remote-inbound-rtp' && s.kind === 'video') {
            if (typeof s.roundTripTime === 'number') rttMs = Math.round(s.roundTripTime * 1000)
            if (typeof s.fractionLost === 'number') loss = s.fractionLost
          } else if (s.type === 'candidate-pair' && s.nominated && rttMs == null && typeof s.currentRoundTripTime === 'number') {
            rttMs = Math.round(s.currentRoundTripTime * 1000)
          }
        })
        // Pausado não sai vídeo — a altura do último quadro não diz nada da rede.
        const effHeight = this.snap.stage.paused ? null : height
        peer.stats = { fps: this.snap.stage.paused ? 0 : fps, height, rttMs, loss, quality: rateLink(effHeight, rttMs, loss) }
      } catch {
        // conexão fechando — ignora
      }
    }))
    this.publishViewers()
  }

  // ── Jogador ────────────────────────────────────────────

  private join() {
    this.lastJoinAt = performance.now()
    this.send('viewer-join', { viewerId: this.myId, name: this.opts.name })
  }

  /** "Tentar de novo" depois de desistir da reconexão automática. */
  retry(): void {
    if (this.opts.isMaster) return
    this.reconnectAttempts = 0
    window.clearTimeout(this.reconnectTimer)
    this.closeViewerPc()
    this.update({ status: this.snap.stage.screenId ? 'connecting' : 'waiting', remoteStream: null })
    this.join()
    this.armOfferTimeout()
  }

  private armOfferTimeout() {
    window.clearTimeout(this.offerTimer)
    if (!this.snap.stage.screenId) return
    this.offerTimer = window.setTimeout(() => {
      if (!this.viewerPc && this.snap.stage.screenId) this.scheduleReconnect()
    }, OFFER_TIMEOUT_MS)
  }

  private scheduleReconnect() {
    window.clearTimeout(this.reconnectTimer)
    this.closeViewerPc()
    if (!this.snap.stage.screenId) {
      this.update({ status: 'waiting', remoteStream: null })
      return
    }
    if (this.reconnectAttempts >= RECONNECT_DELAYS_MS.length) {
      this.update({ status: 'lost', remoteStream: null })
      return
    }
    const delay = RECONNECT_DELAYS_MS[this.reconnectAttempts]
    this.reconnectAttempts += 1
    this.update({ status: 'reconnecting', remoteStream: null })
    this.reconnectTimer = window.setTimeout(() => {
      if (this.disposed || this.viewerPc) return
      this.join()
      this.armOfferTimeout()
    }, delay)
  }

  private closeViewerPc() {
    const pc = this.viewerPc
    this.viewerPc = null
    this.viewerPending = []
    window.clearTimeout(this.viewerDropTimer)
    window.clearTimeout(this.offerTimer)
    if (!pc) return
    pc.ontrack = null
    pc.onicecandidate = null
    pc.onconnectionstatechange = null
    pc.close()
  }

  private handleState(stage: MesaStage) {
    const prev = this.snap.stage
    this.update({ stage })
    if (stage.screenId && stage.screenId !== prev.screenId) {
      // Nova transmissão (ou a resposta ao "estou aqui" de quem acabou de chegar).
      this.reconnectAttempts = 0
      window.clearTimeout(this.reconnectTimer)
      if (prev.screenId) this.closeViewerPc()
      if (!this.viewerPc) {
        this.update({ status: 'connecting', remoteStream: null })
        // Acabou de pedir? A oferta já está a caminho — não pede de novo.
        if (performance.now() - this.lastJoinAt > 3000) this.join()
        this.armOfferTimeout()
      }
    } else if (!stage.screenId && prev.screenId) {
      window.clearTimeout(this.reconnectTimer)
      this.closeViewerPc()
      this.update({ status: 'waiting', remoteStream: null })
    }
  }

  private async handleOffer(sdp: string) {
    if (!sdp) return
    this.closeViewerPc()
    window.clearTimeout(this.reconnectTimer)
    const pc = new RTCPeerConnection({ iceServers: iceServers() })
    this.viewerPc = pc
    if (this.snap.status !== 'reconnecting') this.update({ status: 'connecting' })

    pc.ontrack = (e) => {
      if (this.viewerPc !== pc) return
      const stream = e.streams[0] ?? new MediaStream([e.track])
      // Vídeo e áudio chegam em dois eventos, no mesmo stream — publica
      // uma cópia nova pra quem desenha perceber a faixa que entrou.
      this.update({ remoteStream: new MediaStream(stream.getTracks()) })
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) this.send('ice', { from: this.myId, candidate: e.candidate.toJSON() })
    }
    pc.onconnectionstatechange = () => {
      if (this.viewerPc !== pc) return
      window.clearTimeout(this.viewerDropTimer)
      if (pc.connectionState === 'connected') {
        this.reconnectAttempts = 0
        this.update({ status: 'live' })
      } else if (pc.connectionState === 'failed') {
        this.scheduleReconnect()
      } else if (pc.connectionState === 'disconnected') {
        this.viewerDropTimer = window.setTimeout(() => {
          if (this.viewerPc === pc && pc.connectionState === 'disconnected') this.scheduleReconnect()
        }, DISCONNECT_GRACE_MS)
      }
    }

    try {
      await pc.setRemoteDescription({ type: 'offer', sdp })
      const pending = this.viewerPending.splice(0)
      for (const c of pending) await pc.addIceCandidate(c).catch(() => {})
      const answer = await pc.createAnswer()
      await pc.setLocalDescription({ type: 'answer', sdp: withStereoOpus(answer.sdp ?? '') })
      if (this.viewerPc !== pc) return
      this.send('answer', { from: this.myId, sdp: pc.localDescription?.sdp ?? '' })
    } catch (err) {
      console.error('[Mesa] Falha ao aceitar a transmissão:', err)
      if (this.viewerPc === pc) this.scheduleReconnect()
    }
  }

  private async handleViewerIce(candidate: RTCIceCandidateInit | undefined) {
    if (!candidate) return
    const pc = this.viewerPc
    if (pc?.remoteDescription) await pc.addIceCandidate(candidate).catch(() => {})
    else this.viewerPending.push(candidate)
  }
}
