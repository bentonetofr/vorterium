import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../shared/lib/supabase'
import { captureScreen, capVideoBitrate, iceServers, withStereoOpus } from './mesaRtc'

// ────────────────────────────────────────────────────────
// Transmissão de tela da Mesa: o mestre manda a tela (com som) direto pra
// cada jogador por WebRTC — uma conexão por jogador. O Supabase Realtime
// (canal privado "mesa:<campanha>", só membros) só leva a negociação:
//
//   jogador → viewer-join {viewerId, name}   "estou aqui, quero ver"
//   mestre  → live                           "comecei" (jogadores respondem viewer-join)
//   mestre  → offer  {to, sdp}               uma por jogador
//   jogador → answer {from, sdp}
//   ambos   → ice    {to | from, candidate}
//   mestre  → ended                          "parei"
//   jogador → viewer-leave {viewerId}
//
// viewerId = usuário + sufixo aleatório, pra mesma pessoa em duas abas
// não derrubar uma a outra.
// ────────────────────────────────────────────────────────

export type ViewerStatus = 'offline' | 'waiting' | 'connecting' | 'live' | 'lost'

export interface MesaViewer {
  id:    string
  name:  string
  state: RTCPeerConnectionState
}

export interface MesaSnapshot {
  channelError: string | null
  /** Tem transmissão rolando nesta campanha (mestre: a dele; jogador: a do mestre). */
  live:         boolean
  // Mestre
  localStream:  MediaStream | null
  viewers:      MesaViewer[]
  // Jogador
  status:       ViewerStatus
  remoteStream: MediaStream | null
}

export const EMPTY_SNAPSHOT: MesaSnapshot = {
  channelError: null,
  live:         false,
  localStream:  null,
  viewers:      [],
  status:       'offline',
  remoteStream: null,
}

interface Peer {
  pc:      RTCPeerConnection
  name:    string
  pending: RTCIceCandidateInit[]
  dropTimer?: number
}

/**
 * Conexão "instável" por mais que isso = a outra ponta foi embora (fechou
 * a aba, caiu a internet). O WebRTC sozinho leva ~30 s pra desistir.
 */
const DISCONNECT_GRACE_MS = 6000

interface SessionOptions {
  campaignId: string
  userId:     string
  name:       string
  isMaster:   boolean
  onChange:   (snapshot: MesaSnapshot) => void
}

type Payload = Record<string, unknown>

export class MesaSession {
  private readonly opts: SessionOptions
  private readonly myId: string
  private channel: RealtimeChannel | null = null
  private disposed = false
  private snap: MesaSnapshot = { ...EMPTY_SNAPSHOT }

  // Mestre
  private localStream: MediaStream | null = null
  private readonly peers = new Map<string, Peer>()

  // Jogador
  private viewerPc: RTCPeerConnection | null = null
  private viewerPending: RTCIceCandidateInit[] = []
  private viewerDropTimer: number | undefined

  constructor(opts: SessionOptions) {
    this.opts = opts
    this.myId = `${opts.userId}:${crypto.randomUUID().slice(0, 8)}`
  }

  get snapshot(): MesaSnapshot {
    return this.snap
  }

  private update(patch: Partial<MesaSnapshot>) {
    if (this.disposed) return
    this.snap = { ...this.snap, ...patch }
    this.opts.onChange(this.snap)
  }

  private send(event: string, payload: Payload = {}) {
    if (!this.channel) return
    void this.channel.send({ type: 'broadcast', event, payload })
  }

  // ── Ciclo de vida ──────────────────────────────────────

  async connect(): Promise<void> {
    // Canal privado: o Realtime confere a policy com o token do usuário.
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
      on('viewer-join',  (p) => { void this.offerTo(String(p.viewerId ?? ''), String(p.name ?? 'Jogador')) })
      on('answer',       (p) => { void this.handleAnswer(String(p.from ?? ''), String(p.sdp ?? '')) })
      on('ice',          (p) => { if (p.from) void this.handleMasterIce(String(p.from), p.candidate as RTCIceCandidateInit) })
      on('viewer-leave', (p) => this.closePeer(String(p.viewerId ?? '')))
    } else {
      on('live',  () => this.handleLive())
      on('ended', () => this.handleEnded())
      on('offer', (p) => { if (p.to === this.myId) void this.handleOffer(String(p.sdp ?? '')) })
      on('ice',   (p) => { if (p.to === this.myId) void this.handleViewerIce(p.candidate as RTCIceCandidateInit) })
    }

    channel.subscribe((status) => {
      if (this.disposed) return
      if (status === 'SUBSCRIBED') {
        this.update({ channelError: null })
        if (this.opts.isMaster) {
          // Reconectou no meio da transmissão: avisa de novo.
          if (this.localStream) this.send('live')
        } else if (!this.viewerPc) {
          this.update({ status: 'waiting' })
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
      if (this.localStream) this.send('ended')
      this.stopTracks()
      for (const id of [...this.peers.keys()]) this.closePeer(id, false)
    } else {
      this.send('viewer-leave', { viewerId: this.myId })
      this.closeViewerPc()
    }
    this.disposed = true
    if (this.channel) void supabase.removeChannel(this.channel)
    this.channel = null
  }

  // ── Mestre ─────────────────────────────────────────────

  /** Abre a janela de escolher tela e começa a transmitir. Erros sobem pra quem chamou. */
  async startShare(): Promise<void> {
    if (!this.opts.isMaster || this.disposed) return
    const stream = await captureScreen()
    if (this.disposed) { stream.getTracks().forEach((t) => t.stop()); return }

    this.stopShare(false)
    this.localStream = stream
    // "Parar compartilhamento" da barra do navegador também encerra aqui.
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (this.localStream === stream) this.stopShare()
    })
    this.update({ localStream: stream, live: true })
    this.send('live')
  }

  stopShare(announce = true): void {
    if (!this.localStream) return
    this.stopTracks()
    for (const id of [...this.peers.keys()]) this.closePeer(id, false)
    this.publishViewers()
    this.update({ localStream: null, live: false })
    if (announce) this.send('ended')
  }

  private stopTracks() {
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
  }

  private publishViewers() {
    this.update({
      viewers: [...this.peers.entries()].map(([id, peer]) => ({ id, name: peer.name, state: peer.pc.connectionState })),
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
    this.peers.set(viewerId, { pc, name: name.slice(0, 60), pending: [] })
    for (const track of stream.getTracks()) pc.addTrack(track, stream)

    pc.onicecandidate = (e) => {
      if (e.candidate) this.send('ice', { to: viewerId, candidate: e.candidate.toJSON() })
    }
    pc.onconnectionstatechange = () => {
      const peer = this.peers.get(viewerId)
      if (peer?.pc !== pc) return
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(viewerId)
        return
      }
      window.clearTimeout(peer.dropTimer)
      if (pc.connectionState === 'disconnected') {
        peer.dropTimer = window.setTimeout(() => {
          if (this.peers.get(viewerId)?.pc === pc && pc.connectionState === 'disconnected') this.closePeer(viewerId)
        }, DISCONNECT_GRACE_MS)
      }
      if (pc.connectionState === 'connected') void capVideoBitrate(pc)
      this.publishViewers()
    }

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription({ type: 'offer', sdp: withStereoOpus(offer.sdp ?? '') })
      if (this.peers.get(viewerId)?.pc !== pc) return
      this.send('offer', { to: viewerId, sdp: pc.localDescription?.sdp ?? '' })
      this.publishViewers()
    } catch (err) {
      console.error('[Mesa] Falha ao criar a oferta:', err)
      this.closePeer(viewerId)
    }
  }

  private async handleAnswer(from: string, sdp: string) {
    const peer = this.peers.get(from)
    if (!peer || !sdp) return
    try {
      await peer.pc.setRemoteDescription({ type: 'answer', sdp })
      const pending = peer.pending.splice(0)
      for (const c of pending) await peer.pc.addIceCandidate(c).catch(() => {})
    } catch (err) {
      console.error('[Mesa] Resposta inválida do jogador:', err)
      this.closePeer(from)
    }
  }

  private async handleMasterIce(from: string, candidate: RTCIceCandidateInit | undefined) {
    const peer = this.peers.get(from)
    if (!peer || !candidate) return
    if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(candidate).catch(() => {})
    else peer.pending.push(candidate)
  }

  // ── Jogador ────────────────────────────────────────────

  private join() {
    this.send('viewer-join', { viewerId: this.myId, name: this.opts.name })
  }

  /** "Tentar de novo" depois de perder a conexão. */
  retry(): void {
    if (this.opts.isMaster) return
    this.closeViewerPc()
    this.update({ status: this.snap.live ? 'connecting' : 'waiting', remoteStream: null })
    this.join()
  }

  private closeViewerPc() {
    const pc = this.viewerPc
    this.viewerPc = null
    this.viewerPending = []
    window.clearTimeout(this.viewerDropTimer)
    if (!pc) return
    pc.ontrack = null
    pc.onicecandidate = null
    pc.onconnectionstatechange = null
    pc.close()
  }

  private handleLive() {
    this.closeViewerPc()
    this.update({ live: true, status: 'connecting', remoteStream: null })
    this.join()
  }

  private handleEnded() {
    this.closeViewerPc()
    this.update({ live: false, status: 'waiting', remoteStream: null })
  }

  private async handleOffer(sdp: string) {
    if (!sdp) return
    this.closeViewerPc()
    const pc = new RTCPeerConnection({ iceServers: iceServers() })
    this.viewerPc = pc
    this.update({ live: true, status: 'connecting' })

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
    const lose = () => {
      this.closeViewerPc()
      this.update({ status: 'lost', remoteStream: null })
    }
    pc.onconnectionstatechange = () => {
      if (this.viewerPc !== pc) return
      window.clearTimeout(this.viewerDropTimer)
      if (pc.connectionState === 'connected') this.update({ status: 'live' })
      else if (pc.connectionState === 'failed') lose()
      else if (pc.connectionState === 'disconnected') {
        this.viewerDropTimer = window.setTimeout(() => {
          if (this.viewerPc === pc && pc.connectionState === 'disconnected') lose()
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
      if (this.viewerPc === pc) {
        this.closeViewerPc()
        this.update({ status: 'lost', remoteStream: null })
      }
    }
  }

  private async handleViewerIce(candidate: RTCIceCandidateInit | undefined) {
    if (!candidate) return
    const pc = this.viewerPc
    if (pc?.remoteDescription) await pc.addIceCandidate(candidate).catch(() => {})
    else this.viewerPending.push(candidate)
  }
}
