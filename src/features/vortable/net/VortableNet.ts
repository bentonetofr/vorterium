import { iceServers } from '../../mesa/mesaRtc'

// ────────────────────────────────────────────────────────
// Rede do Vortable: WebRTC de navegador pra navegador (grátis, sem servidor
// de jogo). O navegador do MESTRE é o centro: cada jogador abre uma conexão
// (DataChannel) com ele, e ele repassa o que cada um manda aos outros.
// O Supabase Realtime só leva a conversa de conexão (o canal "mesa:<campanha>"
// da Mesa), nada de movimento passa por ele.
//
//   jogador → join {from, name}        "estou aqui" (enquanto o mestre está ao vivo)
//   mestre  → offer {to, sdp}
//   jogador → answer {from, sdp}
//   ambos   → ice {to | from, candidate}
//
// No DataChannel, cada mensagem é um JSON: ou uma mensagem do jogo (NetMsg do
// motor: hello, who, state, bye, teleport, react) ou uma de sistema ({sys: 'kick'};
// {sys: 'role', role} do jogador pro mestre: "estou jogando" ou "estou assistindo";
// {sys: 'cmd', cmd: 'spectate' | 'play'} do mestre pro jogador: mandar assistir / pôr em jogo).
// ────────────────────────────────────────────────────────

export interface Signal {
  kind: 'join' | 'offer' | 'answer' | 'ice'
  from?: string
  to?: string
  name?: string
  sdp?: string
  candidate?: RTCIceCandidateInit
}

export interface Signaling {
  send(payload: Signal): void
  subscribe(handler: (payload: Signal) => void): () => void
}

/** Quem está conectado: jogando (com boneco no mundo) ou só assistindo. */
export type NetRole = 'player' | 'spectator'

export type NetCommand = 'spectate' | 'play'

export interface NetPeerInfo {
  id: string
  name: string
  connected: boolean
  role: NetRole
}

export type NetStatus = 'off' | 'connecting' | 'online'

interface Options {
  /** Id do jogador na rede (o id do usuário). */
  selfId: string
  name: string
  isMaster: boolean
  signaling: Signaling
}

interface Peer {
  pc: RTCPeerConnection
  dc: RTCDataChannel | null
  name: string
  role: NetRole
  pending: RTCIceCandidateInit[]
  dropTimer?: number
  createdAt: number
}

/** Conexão "instável" por mais que isso = a outra ponta foi embora. */
const DROP_GRACE_MS = 6000
/** Mestre: um "join" novo enquanto a conexão anterior ainda está abrindo (e é recente) é ignorado. */
const NEGOTIATE_MS = 12_000
/** Jogador pede de novo a cada tanto, enquanto o mestre está ao vivo e a conexão não abre. */
const JOIN_RETRY_MS = 4000

export class VortableNet {
  /** Pra onde vão as mensagens do jogo que chegam (o jogo montado agora). */
  sink: ((msg: unknown) => void) | null = null
  /** A conexão abriu: o jogo reanuncia o boneco. */
  onOpen: (() => void) | null = null
  /** Mestre: a lista de conectados mudou. Jogador: o estado da ligação mudou. */
  onChange: (() => void) | null = null
  /** O mestre me tirou da sessão. */
  onKicked: (() => void) | null = null
  /** O mestre mandou eu assistir ou voltar a jogar. */
  onCommand: ((cmd: NetCommand) => void) | null = null

  /** Nome mostrado sobre o boneco (o do personagem na ficha); pode mudar com o jogo aberto. */
  name: string
  status: NetStatus = 'off'
  /** Mestre: hora/tempo/vento ao vivo por zona ('*' = todas), entregues a quem entra. */
  private readonly envs = new Map<string, unknown>()
  private readonly peers = new Map<string, Peer>()   // mestre: um por jogador
  private link: Peer | null = null                    // jogador: a ligação com o mestre
  private live = false
  private kicked = false
  private role: NetRole = 'player'
  private disposed = false
  private joinTimer: number | undefined
  private readonly off: () => void

  constructor(private readonly opts: Options) {
    this.name = opts.name
    this.off = opts.signaling.subscribe((p) => void this.onSignal(p))
  }

  // ── API usada pelo jogo e pela interface ───────────────

  /** Manda uma mensagem do jogo (mestre: pra todos; jogador: pro mestre, que repassa). */
  send(msg: unknown) {
    if (this.opts.isMaster && typeof msg === 'object' && msg !== null && (msg as { t?: unknown }).t === 'env') {
      this.envs.set(String((msg as { zone?: unknown }).zone ?? '*'), msg)
    }
    const data = JSON.stringify(msg)
    if (this.opts.isMaster) {
      for (const p of this.peers.values()) if (p.dc?.readyState === 'open') p.dc.send(data)
    } else if (this.link?.dc?.readyState === 'open') {
      this.link.dc.send(data)
    }
  }

  /** Mestre: manda pra um jogador só. */
  sendTo(id: string, msg: unknown) {
    const dc = this.peers.get(id)?.dc
    if (dc?.readyState === 'open') dc.send(JSON.stringify(msg))
  }

  /** Mestre: os ajustes ao vivo que já valem (pra a câmera do mestre mostrar de novo ao remontar). */
  envList(): unknown[] {
    return [...this.envs.values()]
  }

  private sendEnvs(id: string) {
    for (const env of this.envs.values()) this.sendTo(id, env)
  }

  /** Mestre: manda um jogador assistir (ou voltar a jogar). */
  command(id: string, cmd: NetCommand) {
    this.sendTo(id, { sys: 'cmd', cmd })
  }

  /** Jogador: conta ao mestre se está jogando ou só assistindo (reenviado ao reconectar). */
  setRole(role: NetRole) {
    this.role = role
    if (!this.opts.isMaster && this.link?.dc?.readyState === 'open') this.link.dc.send(JSON.stringify({ sys: 'role', role }))
  }

  /** Mestre: tira o jogador da sessão. */
  kick(id: string) {
    this.sendTo(id, { sys: 'kick' })
    window.setTimeout(() => this.closePeer(id), 300)
  }

  /** Jogador: depois de ser removido, tenta entrar de novo. */
  retry() {
    if (this.opts.isMaster) return
    this.kicked = false
    if (this.live) this.startJoining()
  }

  /** Mestre: quem está conectado agora. */
  get connected(): NetPeerInfo[] {
    return [...this.peers.entries()].map(([id, p]) => ({ id, name: p.name, connected: p.dc?.readyState === 'open', role: p.role }))
  }

  /** O mestre está ao vivo? (jogador: liga/desliga a procura pela conexão) */
  setLive(live: boolean) {
    if (this.opts.isMaster || this.live === live) return
    this.live = live
    if (live && !this.kicked) this.startJoining()
    else this.stopLink()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.off()
    window.clearInterval(this.joinTimer)
    for (const id of [...this.peers.keys()]) this.closePeer(id, false)
    this.stopLink()
  }

  private setStatus(status: NetStatus) {
    if (this.status === status) return
    this.status = status
    this.onChange?.()
  }

  // ── Sinalização ────────────────────────────────────────

  private async onSignal(p: Signal) {
    if (this.disposed) return
    if (this.opts.isMaster) {
      if (p.kind === 'join' && p.from) {
        const ex = this.peers.get(p.from)
        const opening = ex && ex.dc?.readyState !== 'open' && Date.now() - ex.createdAt < NEGOTIATE_MS
        if (!opening) void this.offerTo(p.from, p.name ?? 'Jogador')
      }
      else if (p.kind === 'answer' && p.from) void this.handleAnswer(p.from, p.sdp ?? '')
      else if (p.kind === 'ice' && p.from) void this.addIce(this.peers.get(p.from), p.candidate)
    } else if (p.to === this.opts.selfId) {
      if (p.kind === 'offer') void this.handleOffer(p.sdp ?? '')
      else if (p.kind === 'ice') void this.addIce(this.link, p.candidate)
    }
  }

  private async addIce(peer: Peer | null | undefined, candidate: RTCIceCandidateInit | undefined) {
    if (!peer || !candidate) return
    if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(candidate).catch(() => {})
    else peer.pending.push(candidate)
  }

  private async flushIce(peer: Peer) {
    for (const c of peer.pending.splice(0)) await peer.pc.addIceCandidate(c).catch(() => {})
  }

  // ── Mestre ─────────────────────────────────────────────

  private async offerTo(id: string, name: string) {
    this.closePeer(id, false)
    const pc = new RTCPeerConnection({ iceServers: iceServers() })
    const peer: Peer = { pc, dc: null, name: name.slice(0, 60), role: 'player', pending: [], createdAt: Date.now() }
    this.peers.set(id, peer)

    const dc = pc.createDataChannel('vortable')
    peer.dc = dc
    dc.onopen = () => { this.sendEnvs(id); this.onChange?.(); this.onOpen?.() }
    dc.onmessage = (e) => this.fromPeer(id, String(e.data))
    dc.onclose = () => { if (this.peers.get(id) === peer) this.closePeer(id) }

    pc.onicecandidate = (e) => {
      if (e.candidate) this.opts.signaling.send({ kind: 'ice', to: id, candidate: e.candidate.toJSON() })
    }
    pc.onconnectionstatechange = () => {
      if (this.peers.get(id) !== peer) return
      window.clearTimeout(peer.dropTimer)
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.closePeer(id)
      else if (pc.connectionState === 'disconnected') {
        peer.dropTimer = window.setTimeout(() => {
          if (this.peers.get(id) === peer && pc.connectionState === 'disconnected') this.closePeer(id)
        }, DROP_GRACE_MS)
      }
      this.onChange?.()
    }

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      if (this.peers.get(id) !== peer) return
      this.opts.signaling.send({ kind: 'offer', to: id, sdp: pc.localDescription?.sdp ?? '' })
      this.onChange?.()
    } catch (err) {
      console.error('[Vortable] falha ao criar a oferta:', err)
      if (this.peers.get(id) === peer) this.closePeer(id)
    }
  }

  private async handleAnswer(from: string, sdp: string) {
    const peer = this.peers.get(from)
    if (!peer || !sdp) return
    try {
      await peer.pc.setRemoteDescription({ type: 'answer', sdp })
      await this.flushIce(peer)
    } catch (err) {
      console.error('[Vortable] resposta inválida do jogador:', err)
      if (this.peers.get(from) === peer) this.closePeer(from)
    }
  }

  /** Chegou uma mensagem de um jogador: o jogo do mestre vê, e os outros jogadores recebem. */
  private fromPeer(id: string, data: string) {
    let msg: unknown
    try { msg = JSON.parse(data) } catch { return }
    if (typeof msg !== 'object' || msg === null) return
    if ('sys' in msg) {
      const sys = msg as { sys?: unknown; role?: unknown }
      const peer = this.peers.get(id)
      if (peer && sys.sys === 'role' && (sys.role === 'player' || sys.role === 'spectator') && peer.role !== sys.role) {
        peer.role = sys.role
        this.onChange?.()
      }
      return
    }
    // jogo recém-montado perguntando quem está aí: ele também precisa da hora/tempo do mestre
    if ((msg as { t?: unknown }).t === 'who') this.sendEnvs(id)
    this.sink?.(msg)
    for (const [other, p] of this.peers) if (other !== id && p.dc?.readyState === 'open') p.dc.send(data)
  }

  private closePeer(id: string, announce = true) {
    const peer = this.peers.get(id)
    if (!peer) return
    this.peers.delete(id)
    window.clearTimeout(peer.dropTimer)
    peer.pc.onicecandidate = null
    peer.pc.onconnectionstatechange = null
    if (peer.dc) { peer.dc.onclose = null; peer.dc.onmessage = null }
    peer.pc.close()
    if (announce) {
      // quem saiu some do mundo de todo mundo
      const bye = { t: 'bye', id }
      this.sink?.(bye)
      this.send(bye)
      this.onChange?.()
    }
  }

  // ── Jogador ────────────────────────────────────────────

  private startJoining() {
    window.clearInterval(this.joinTimer)
    this.setStatus('connecting')
    const ask = () => {
      if (this.disposed || !this.live || this.kicked) return
      if (this.link?.dc?.readyState === 'open') return
      this.opts.signaling.send({ kind: 'join', from: this.opts.selfId, name: this.name })
    }
    ask()
    this.joinTimer = window.setInterval(ask, JOIN_RETRY_MS)
  }

  private stopLink() {
    window.clearInterval(this.joinTimer)
    const link = this.link
    this.link = null
    if (link) {
      window.clearTimeout(link.dropTimer)
      link.pc.onicecandidate = null
      link.pc.onconnectionstatechange = null
      if (link.dc) { link.dc.onclose = null; link.dc.onmessage = null }
      link.pc.close()
    }
    this.setStatus('off')
  }

  private async handleOffer(sdp: string) {
    if (!sdp || this.kicked) return
    // a oferta nova vale mais que a ligação antiga
    const early = this.link?.pending.splice(0) ?? []
    const old = this.link
    this.link = null
    if (old) { old.pc.onconnectionstatechange = null; old.pc.close() }

    const pc = new RTCPeerConnection({ iceServers: iceServers() })
    const peer: Peer = { pc, dc: null, name: 'mestre', role: 'player', pending: early, createdAt: Date.now() }
    this.link = peer

    pc.ondatachannel = (e) => {
      const dc = e.channel
      peer.dc = dc
      dc.onopen = () => {
        if (this.link !== peer) return
        window.clearInterval(this.joinTimer)
        dc.send(JSON.stringify({ sys: 'role', role: this.role }))
        this.setStatus('online')
        this.onOpen?.()
      }
      dc.onmessage = (ev) => this.fromMaster(String(ev.data))
      dc.onclose = () => { if (this.link === peer) this.lost() }
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) this.opts.signaling.send({ kind: 'ice', from: this.opts.selfId, candidate: e.candidate.toJSON() })
    }
    pc.onconnectionstatechange = () => {
      if (this.link !== peer) return
      window.clearTimeout(peer.dropTimer)
      if (pc.connectionState === 'failed') this.lost()
      else if (pc.connectionState === 'disconnected') {
        peer.dropTimer = window.setTimeout(() => {
          if (this.link === peer && pc.connectionState === 'disconnected') this.lost()
        }, DROP_GRACE_MS)
      }
    }

    try {
      await pc.setRemoteDescription({ type: 'offer', sdp })
      await this.flushIce(peer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      if (this.link !== peer) return
      this.opts.signaling.send({ kind: 'answer', from: this.opts.selfId, sdp: pc.localDescription?.sdp ?? '' })
    } catch (err) {
      console.error('[Vortable] falha ao aceitar a conexão:', err)
      if (this.link === peer) this.lost()
    }
  }

  private fromMaster(data: string) {
    let msg: unknown
    try { msg = JSON.parse(data) } catch { return }
    if (typeof msg !== 'object' || msg === null) return
    if ('sys' in msg) {
      if ((msg as { sys: unknown }).sys === 'kick') {
        this.kicked = true
        this.stopLink()
        this.onKicked?.()
      } else if ((msg as { sys: unknown }).sys === 'cmd') {
        const cmd = (msg as { cmd?: unknown }).cmd
        if (cmd === 'spectate' || cmd === 'play') this.onCommand?.(cmd)
      }
      return
    }
    this.sink?.(msg)
  }

  /** A ligação com o mestre caiu: some todo mundo do mundo e tenta voltar. */
  private lost() {
    this.stopLink()
    if (!this.live || this.kicked || this.disposed) return
    this.startJoining()
  }
}
