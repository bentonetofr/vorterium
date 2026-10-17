import { iceServers } from '../../mesa/mesaRtc'
import { vtError, vtResolve } from '../errors/vtErrors'

// ────────────────────────────────────────────────────────
// Rede do Vortable. O navegador do MESTRE é o centro: cada jogador tem uma
// ligação com ele, e ele repassa o que cada um manda aos outros.
//
// A ligação é DIRETA (WebRTC, de navegador pra navegador, grátis) ou, quando a
// rede do jogador não deixa (4G com CGNAT, rede de empresa), pela RESERVA: um
// canal do Supabase Realtime só dele (`mesa:<campanha>:vt:<jogador>`).
//
// Conversa de conexão, pelo canal da Mesa (`rtc`; todos ouvem, cada um filtra):
//   jogador → join {from, sid, at, v, via, nid?, name}  "quero entrar" (repetido até abrir)
//   mestre  → offer {to, sid, nid, msid, sdp}           só a aba `sid` do jogador aceita
//   jogador → answer {from, sid, nid, sdp}
//   ambos   → ice {to|from, sid, nid, candidate}        de outra tentativa (nid) é ignorado
//   mestre  → version {to, sid, v}                      versões diferentes: recarregar
//   mestre  → replaced {to, sid}                        outra aba/aparelho da conta assumiu
//   mestre  → master {msid, at}                         sinal do mestre (duas abas de mestre: a mais nova manda)
//   jogador → leave {from, sid}                         saí (reserva do aviso que vai pela ligação)
//
// Pela ligação, cada mensagem é um JSON: as do jogo (NetMsg do motor) ou as de
// sistema {sys}: ping/pong (a cada 2 s: queda em ~10 s e a latência), roster (quem
// está no mapa: apaga fantasmas), zones (zonas salvas na sessão: quem estava fora
// recarrega), role, cmd, kick, replaced, door/door-ack/door-cancel, sfx, leave,
// open/opened (abertura da reserva). Posições ("state") vão num canal rápido que
// pode perder pacotes (uma perda não trava as outras), o resto no confiável.
// ────────────────────────────────────────────────────────

/** Versão da conversa da rede: jogador e mestre precisam estar na mesma. */
export const NET_PROTO = 2

export interface Signal {
  kind: 'join' | 'offer' | 'answer' | 'ice' | 'version' | 'replaced' | 'master' | 'leave'
  from?: string
  to?: string
  /** Aba do jogador (cada aba/aparelho tem a sua). */
  sid?: string
  /** Tentativa de conexão (oferta/resposta/ICE de outra tentativa são ignorados). */
  nid?: string
  /** Aba do mestre. */
  msid?: string
  /** Quando a aba entrou (a mais nova vale). */
  at?: number
  v?: number
  via?: 'rtc' | 'relay'
  name?: string
  sdp?: string
  candidate?: RTCIceCandidateInit
}

export interface Signaling {
  send(payload: Signal): void
  subscribe(handler: (payload: Signal) => void): () => void
}

/** Pacote da reserva: de quem ('M' = mestre, senão a aba do jogador), pra quem e as mensagens. */
export interface RelayPayload { from: string; to: string; b: string[] }
export interface RelayHandle {
  /** false = o canal ainda não está pronto (nada foi mandado). */
  send(payload: RelayPayload): boolean
  close(): void
}
/** Abre o canal reserva `mesa:<campanha>:<sufixo>`. */
export type RelayFactory = (suffix: string, on: { message(p: RelayPayload): void; status(ok: boolean, detail?: string): void }) => RelayHandle

/** Quem está conectado: jogando (com boneco no mundo) ou só assistindo. */
export type NetRole = 'player' | 'spectator'
export type NetCommand = 'spectate' | 'play'
export type NetTransport = 'direto' | 'reserva'

export interface NetPeerInfo {
  id: string
  name: string
  connected: boolean
  role: NetRole
  via: NetTransport
  /** Ida e volta das mensagens (ms); null = ainda sem medida. */
  rtt: number | null
}

export type NetStatus = 'off' | 'connecting' | 'online'
/** Por que o jogador parou de tentar entrar. */
export type NetIssue = 'kicked' | 'replaced' | 'version' | 'dormant' | null
export type DoorAnswer = 'ok' | 'no' | 'timeout' | 'lost'

/** Um jogador quer atravessar uma saída: o mestre decide. */
export interface DoorInfo {
  from: string
  fromName: string
  to: string
  toName: string
  /** Nome da saída (o que está escrito no portal). */
  via: string
}

/** O pedido como o mestre recebe: de quem é e o id da pergunta. */
export interface DoorRequest extends DoorInfo {
  peerId: string
  id: string
  name: string
}

interface Options {
  /** Id do jogador na rede (o id do usuário). */
  selfId: string
  name: string
  isMaster: boolean
  signaling: Signaling
  /** Canal reserva (sem ele, só a ligação direta). */
  relay?: RelayFactory
  /** Jogador: a zona em que o boneco está agora (pra recarregar se ela mudou durante uma queda). */
  currentZone?: () => string | null
  /** Mestre: guarda a hora/tempo/vento ao vivo (pra continuarem depois de recarregar a página). */
  envStore?: { load(): unknown[]; save(list: unknown[]): void }
}

/** Uma ligação: do mestre com um jogador, ou do jogador com o mestre. */
interface Link {
  uid: string
  sid: string
  nid: string
  at: number
  via: NetTransport
  name: string
  role: NetRole
  pc: RTCPeerConnection | null
  dc: RTCDataChannel | null
  fast: RTCDataChannel | null
  relay: RelayHandle | null
  relayReady: boolean
  outQ: string[]
  outFast: Map<string, string>
  flushTimer: number
  flushQueued: boolean
  pending: RTCIceCandidateInit[]
  createdAt: number
  open: boolean
  closed: boolean
  lastRx: number
  lastPing: number
  rtt: number | null
  slow: number
  lastReplay: number
  iceChecked: boolean
  dropTimer: number
}

const TICK_MS = 1000
const PING_MS = 2000
/** Jogador: nada do mestre por isso = a ligação caiu. */
const MASTER_SILENCE_MS = 12_000
/** Mestre: nada do jogador por isso = ele caiu (sai do mapa de todos). */
const PEER_SILENCE_MS = 10_000
/** Jogador: oferta recebida e a ligação não abriu nisso = desiste e pede de novo. */
const NEGOTIATE_MS = 15_000
const MASTER_NEGOTIATE_MS = 25_000
/** Mestre: um join da mesma aba logo depois da oferta = a oferta ainda está chegando. */
const OFFER_FRESH_MS = 4000
/** Conexão "instável" por mais que isso = a outra ponta foi embora. */
const DROP_GRACE_MS = 6000
/** Jogador: sem resposta do mestre depois disso, a saída é negada. */
const DOOR_TIMEOUT_MS = 90_000
/** Jogador: pede de novo a cada tanto (mais um sorteio, pra ninguém pedir junto). */
const JOIN_EVERY_MS = 3000
/** Ligações diretas que falharam seguidas até passar pra reserva. */
const RELAY_AFTER_FAILS = 2
const ROSTER_MS = 6000
const BEACON_MS = 20_000
const SLOW_RTT_MS = 800
const SLOW_WARN_EVERY_MS = 5 * 60_000
const RELIABLE_MAX_BUFFER = 4_000_000
const FAST_MAX_BUFFER = 64_000
const RELAY_FAST_MS = 150
const RELAY_MAX_QUEUE = 500
const REPLAY_MIN_MS = 1500
const WHO_FORWARD_MS = 5000

const newId = (n = 12): string => {
  const raw = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  return raw.slice(0, n)
}
const errText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 200)
const rtcAvailable = () => typeof RTCPeerConnection !== 'undefined'

/**
 * Relógio da rede. Numa aba em segundo plano o navegador atrasa os timers da página (até 1 por minuto),
 * e sem o ping o outro lado achava que a pessoa tinha caído; o relógio de um Web Worker não é atrasado.
 */
function startTicker(fn: () => void, ms: number): () => void {
  if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    try {
      const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${ms})`], { type: 'text/javascript' }))
      const worker = new Worker(url)
      worker.onmessage = () => fn()
      return () => { worker.terminate(); URL.revokeObjectURL(url) }
    } catch { /* sem Worker: timer comum */ }
  }
  const timer = window.setInterval(fn, ms)
  return () => window.clearInterval(timer)
}

export class VortableNet {
  /** Pra onde vão as mensagens do jogo que chegam (o jogo montado agora). */
  sink: ((msg: unknown) => void) | null = null
  /** Jogador: a ligação abriu (again = reabriu depois de cair): o jogo reanuncia o boneco. */
  onOpen: ((again: boolean) => void) | null = null
  /** Mestre: a lista de conectados mudou. Jogador: o estado da ligação mudou. */
  onChange: (() => void) | null = null
  /** O mestre me tirou da sessão. */
  onKicked: (() => void) | null = null
  /** A conta abriu o Vortable em outra aba/aparelho e esta saiu. */
  onReplaced: (() => void) | null = null
  /** O mestre mandou eu assistir ou voltar a jogar. */
  onCommand: ((cmd: NetCommand) => void) | null = null
  /** Mestre: um jogador pediu licença pra sair da zona. */
  onDoor: ((req: DoorRequest) => void) | null = null
  /** Mestre: o jogador desistiu do pedido (ou caiu da sessão). id vazio = todos os pedidos dele. */
  onDoorGone: ((peerId: string, id: string) => void) | null = null
  /** O mestre mandou tocar o som de uma criatura (s = id do som, v = volume 0 a 1, d = distância 0 a 2, zone = só quem está nela). */
  onSfx: ((msg: { s: string; v: number; d: number; zone: string | null }) => void) | null = null

  /** Nome mostrado sobre o boneco (o do personagem na ficha); pode mudar com o jogo aberto. */
  name: string
  status: NetStatus = 'off'
  issue: NetIssue = null
  /** Esta aba (jogador). */
  readonly sid = newId()
  /** Esta aba (mestre). */
  readonly msid = newId()
  private readonly startedAt = Date.now()
  /** Jogador: quando esta aba pediu a vez (a mais nova vale; "Usar aqui" renova). */
  private claimAt = Date.now()

  /** Mestre: hora/tempo/vento ao vivo por zona ('*' = todas), entregues a quem entra. */
  private readonly envs = new Map<string, unknown>()
  /** Mestre: uma ligação por jogador. */
  private readonly links = new Map<string, Link>()
  /** Mestre: o último "hello" de cada boneco (jogadores, o do mestre, NPCs que ele controla), pra quem entra ver todo mundo. */
  private readonly known = new Map<string, string>()
  /** Mestre: zonas salvas (ou com NPC movido) nesta sessão → número da mudança. */
  private readonly zoneSeq = new Map<string, number>()
  private seqN = 0
  private dormant = false
  private lastWhoLocal = 0
  private lastRoster = 0
  private lastBeacon = 0
  private lastBeaconReply = 0
  private readonly versionWarned = new Map<string, number>()

  /** Jogador: a ligação com o mestre. */
  private link: Link | null = null
  private live = false
  private role: NetRole = 'player'
  private everOnline = false
  private lostAt = 0
  private rtcFails = 0
  private forceRelay = false
  private relayWarned = false
  private nextJoinAt = 0
  private lastWhoForward = 0
  private lastSlowWarn = 0
  /** Jogador: os bonecos que o mestre anunciou (id → hello) e o ambiente, pra responder "quem está aí?" do jogo na hora. */
  private readonly cache = new Map<string, string>()
  private readonly envCache = new Map<string, string>()
  private zoneEpoch: string | null = null
  private readonly zoneSeen = new Map<string, number>()
  private readonly earlyIce = new Map<string, RTCIceCandidateInit[]>()
  private readonly doorWaits = new Map<string, (a: DoorAnswer) => void>()

  private disposed = false
  private readonly stopTicker: () => void
  private readonly off: () => void

  constructor(private readonly opts: Options) {
    this.name = opts.name
    this.off = opts.signaling.subscribe((p) => this.onSignal(p))
    if (opts.isMaster) {
      for (const env of opts.envStore?.load() ?? []) {
        if (typeof env === 'object' && env !== null) this.envs.set(String((env as { zone?: unknown }).zone ?? '*'), env)
      }
    } else if (!rtcAvailable()) {
      this.forceRelay = true
    }
    this.stopTicker = startTicker(() => this.onTick(), TICK_MS)
  }

  // ── API usada pelo jogo e pela interface ───────────────

  /** Manda uma mensagem do jogo (mestre: pra todos; jogador: pro mestre, que repassa). */
  send(msg: unknown) {
    if (this.disposed || typeof msg !== 'object' || msg === null) return
    const m = msg as { t?: unknown; id?: unknown; zone?: unknown; from?: unknown }
    if (this.opts.isMaster) {
      if (this.dormant) return
      if (m.t === 'env') {
        this.envs.set(String(m.zone ?? '*'), msg)
        try { this.opts.envStore?.save([...this.envs.values()]) } catch { /* guardar é extra */ }
      }
      // "quem está aí?" do próprio mestre: respondido aqui com o que já se sabe
      if (m.t === 'who') {
        const now = Date.now()
        if (now - this.lastWhoLocal < 1000) return
        this.lastWhoLocal = now
        for (const hello of this.known.values()) this.safeSink(JSON.parse(hello))
        return
      }
      let out: unknown = msg
      if (m.t === 'zone' || m.t === 'npcmove') {
        const zs = ++this.seqN
        for (const z of [m.t === 'zone' ? m.id : m.zone, m.t === 'npcmove' ? m.from : undefined]) {
          if (typeof z === 'string' && z) this.zoneSeq.set(z, zs)
        }
        out = { ...msg, zs }
      }
      const data = JSON.stringify(out)
      this.remember(msg, data)
      const fastKey = m.t === 'state' && typeof m.id === 'string' ? m.id : null
      for (const l of this.links.values()) {
        if (!l.open) continue
        if (fastKey) this.pipeSendFast(l, data, fastKey)
        else this.pipeSend(l, data)
      }
      return
    }
    // jogador: "quem está aí?" do jogo recém-montado é respondido aqui (o mestre já mandou todo mundo)
    if (m.t === 'who') {
      for (const env of this.envCache.values()) this.safeSink(JSON.parse(env))
      for (const hello of this.cache.values()) this.safeSink(JSON.parse(hello))
      const now = Date.now()
      if (now - this.lastWhoForward < WHO_FORWARD_MS) return
      this.lastWhoForward = now
    }
    const l = this.link
    if (!l?.open) return
    const data = JSON.stringify(msg)
    if (m.t === 'state' && typeof m.id === 'string') this.pipeSendFast(l, data, m.id)
    else this.pipeSend(l, data)
  }

  private remember(msg: unknown, data: string) {
    const m = msg as { t?: unknown; id?: unknown }
    if (typeof m.id !== 'string') return
    if (m.t === 'hello') this.known.set(m.id, data)
    else if (m.t === 'bye') this.known.delete(m.id)
  }

  /** Mestre: manda pra um jogador só. false = ele não está conectado (nada foi entregue). */
  sendTo(id: string, msg: unknown): boolean {
    const l = this.links.get(id)
    if (!l?.open) return false
    return this.pipeSend(l, JSON.stringify(msg))
  }

  /** Mestre: os ajustes ao vivo que já valem (pra a câmera do mestre mostrar de novo ao remontar). */
  envList(): unknown[] {
    return [...this.envs.values()]
  }

  /** Mestre: toca o som de uma criatura em todos os jogadores. */
  sfx(s: string, v: number, d: number, zone: string | null) {
    if (!this.opts.isMaster) return
    const data = JSON.stringify({ sys: 'sfx', s, v, d, zone })
    for (const l of this.links.values()) if (l.open) this.pipeSend(l, data)
  }

  /** Mestre: manda um jogador assistir (ou voltar a jogar). */
  command(id: string, cmd: NetCommand): boolean {
    return this.sendTo(id, { sys: 'cmd', cmd })
  }

  /** Mestre: responde ao pedido de saída de um jogador (sim = o boneco atravessa). */
  answerDoor(peerId: string, id: string, ok: boolean): boolean {
    return this.sendTo(peerId, { sys: 'door-ack', id, ok })
  }

  /**
   * Jogador: pede licença ao mestre pra atravessar uma saída. 'ok' = pode; 'no' = o mestre negou;
   * 'timeout' = ele não respondeu; 'lost' = sem ligação com o mestre (caiu, ou caiu enquanto esperava).
   */
  askDoor(info: DoorInfo): Promise<DoorAnswer> {
    if (this.opts.isMaster) return Promise.resolve('ok')
    const l = this.link
    if (!l?.open) return Promise.resolve('lost')
    const id = newId(8)
    return new Promise<DoorAnswer>((resolve) => {
      const timer = window.setTimeout(() => {
        if (!this.doorWaits.delete(id)) return
        if (this.link?.open) this.pipeSend(this.link, JSON.stringify({ sys: 'door-cancel', id }))
        resolve('timeout')
      }, DOOR_TIMEOUT_MS)
      this.doorWaits.set(id, (a) => { window.clearTimeout(timer); resolve(a) })
      this.pipeSend(l, JSON.stringify({ sys: 'door', id, ...info }))
    })
  }

  private dropDoorWaits(answer: DoorAnswer) {
    for (const done of [...this.doorWaits.values()]) done(answer)
    this.doorWaits.clear()
  }

  /** Jogador: conta ao mestre se está jogando ou só assistindo (reenviado ao reconectar). */
  setRole(role: NetRole) {
    this.role = role
    if (!this.opts.isMaster && this.link?.open) this.pipeSend(this.link, JSON.stringify({ sys: 'role', role }))
  }

  /** Mestre: tira o jogador da sessão. false = ele não está conectado. */
  kick(id: string): boolean {
    const l = this.links.get(id)
    if (!l?.open) return false
    this.pipeSend(l, JSON.stringify({ sys: 'kick' }))
    if (l.via === 'reserva') this.relayFlush(l)
    window.setTimeout(() => { if (this.links.get(id) === l) this.closePeer(id, true) }, 300)
    return true
  }

  /** Jogador: depois de ser removido (ou de outra aba assumir), tenta entrar de novo. */
  retry() {
    if (this.opts.isMaster) return
    this.issue = null
    // "Usar aqui": esta aba passa a ser a mais nova
    this.claimAt = Date.now()
    this.onChange?.()
    if (this.live) this.startJoining()
  }

  /** Mestre: quem está conectado agora. */
  get connected(): NetPeerInfo[] {
    return [...this.links.values()].map((l) => ({ id: l.uid, name: l.name, connected: l.open, role: l.role, via: l.via, rtt: l.rtt }))
  }

  /** Jogador: por onde está ligado agora (null = não está). */
  get transport(): NetTransport | null {
    return this.link?.open ? this.link.via : null
  }

  /** Jogador: ida e volta até o mestre (ms). */
  get rtt(): number | null {
    return this.link?.open ? this.link.rtt : null
  }

  /** O mestre está ao vivo? (jogador: liga/desliga a procura pela conexão) */
  setLive(live: boolean) {
    if (this.opts.isMaster || this.live === live) return
    this.live = live
    if (live) this.startJoining()
    else {
      this.dropDoorWaits('lost')
      this.stopLink()
      vtResolve('link')
    }
  }

  dispose() {
    if (this.disposed) return
    if (!this.opts.isMaster) {
      // saída limpa: o mestre tira o boneco na hora, sem esperar a queda
      const l = this.link
      if (l?.open) {
        this.pipeSend(l, JSON.stringify({ sys: 'leave' }))
        if (l.via === 'reserva') this.relayFlush(l)
      }
      if (this.live) this.signal({ kind: 'leave', from: this.opts.selfId, sid: this.sid })
    }
    this.disposed = true
    this.off()
    this.stopTicker()
    this.dropDoorWaits('lost')
    for (const l of this.links.values()) this.closeLink(l)
    this.links.clear()
    this.known.clear()
    this.stopLink()
    vtResolve('link')
  }

  private setStatus(status: NetStatus) {
    if (this.status === status) return
    this.status = status
    this.onChange?.()
  }

  private signal(p: Signal) {
    this.opts.signaling.send(p)
  }

  private safeSink(msg: unknown) {
    try {
      this.sink?.(msg)
    } catch (err) {
      vtError('VT-MOTOR-008', { detail: `${String((msg as { t?: unknown }).t)}: ${errText(err)}` })
    }
  }

  // ── Envio por uma ligação ──────────────────────────────

  private newLink(uid: string, sid: string, nid: string, via: NetTransport, name = 'Jogador'): Link {
    return {
      uid, sid, nid, at: 0, via, name, role: 'player', pc: null, dc: null, fast: null, relay: null, relayReady: false,
      outQ: [], outFast: new Map(), flushTimer: 0, flushQueued: false, pending: [], createdAt: Date.now(), open: false, closed: false,
      lastRx: Date.now(), lastPing: 0, rtt: null, slow: 0, lastReplay: 0, iceChecked: false, dropTimer: 0,
    }
  }

  /** Mensagem confiável (tudo menos posição). */
  private pipeSend(l: Link, data: string): boolean {
    if (l.closed) return false
    if (l.via === 'reserva') return this.relayPush(l, data)
    const dc = l.dc
    if (dc?.readyState !== 'open') return false
    if (dc.bufferedAmount > RELIABLE_MAX_BUFFER) {
      vtError('VT-NET-006', { detail: `fila cheia (${Math.round(dc.bufferedAmount / 1000)} KB) com ${l.name}` })
      return false
    }
    try {
      dc.send(data)
      return true
    } catch (err) {
      vtError('VT-NET-006', { detail: `${l.name}: ${errText(err)}` })
      return false
    }
  }

  /** Posição: pode perder (a próxima chega logo); quem está com a fila cheia fica sem essa. */
  private pipeSendFast(l: Link, data: string, key: string): boolean {
    if (l.closed) return false
    if (l.via === 'reserva') return this.relayPush(l, data, key)
    const fast = l.fast
    if (fast?.readyState === 'open') {
      if (fast.bufferedAmount > FAST_MAX_BUFFER) return false
      try { fast.send(data); return true } catch { /* tenta pelo confiável */ }
    }
    const dc = l.dc
    if (dc?.readyState === 'open' && dc.bufferedAmount < FAST_MAX_BUFFER) {
      try { dc.send(data); return true } catch { return false }
    }
    return false
  }

  /** Reserva: junta as mensagens e manda em pacotes (posições: só a última de cada boneco). */
  private relayPush(l: Link, data: string, key?: string): boolean {
    if (!l.relay) return false
    if (key) l.outFast.set(key, data)
    else {
      l.outQ.push(data)
      if (l.outQ.length > RELAY_MAX_QUEUE) {
        l.outQ.splice(0, l.outQ.length - RELAY_MAX_QUEUE)
        vtError('VT-NET-006', { detail: `fila da reserva cheia com ${l.name}` })
      }
    }
    if (key) {
      // posições: junta as de ~150 ms num pacote só (cada pacote conta na cota do Supabase)
      if (!l.flushTimer) l.flushTimer = window.setTimeout(() => this.relayFlush(l), RELAY_FAST_MS)
    } else if (!l.flushQueued) {
      // o resto sai já (no fim desta rodada): timer de aba em segundo plano atrasa até 1 minuto, e o ping/pong não pode esperar
      l.flushQueued = true
      queueMicrotask(() => { l.flushQueued = false; this.relayFlush(l) })
    }
    return true
  }

  private relayFlush(l: Link) {
    window.clearTimeout(l.flushTimer)
    l.flushTimer = 0
    if (!l.relay || !l.relayReady) {
      // canal ainda abrindo: tenta de novo logo (as posições velhas não fazem falta)
      if (!l.closed && l.outQ.length) l.flushTimer = window.setTimeout(() => this.relayFlush(l), 300)
      l.outFast.clear()
      return
    }
    const b = [...l.outQ, ...l.outFast.values()]
    if (b.length === 0) return
    const payload: RelayPayload = this.opts.isMaster ? { from: 'M', to: l.sid, b } : { from: this.sid, to: 'M', b }
    if (l.relay.send(payload)) {
      l.outQ = []
      l.outFast.clear()
    } else if (!l.closed) {
      l.outFast.clear()
      l.flushTimer = window.setTimeout(() => this.relayFlush(l), 300)
    }
  }

  private closeLink(l: Link) {
    if (l.closed) return
    l.closed = true
    l.open = false
    window.clearTimeout(l.dropTimer)
    window.clearTimeout(l.flushTimer)
    const pc = l.pc
    if (pc) {
      pc.onicecandidate = null
      pc.onconnectionstatechange = null
      pc.oniceconnectionstatechange = null
      pc.ondatachannel = null
    }
    for (const dc of [l.dc, l.fast]) {
      if (!dc) continue
      dc.onopen = null
      dc.onclose = null
      dc.onmessage = null
    }
    try { pc?.close() } catch { /* já fechada */ }
    l.relay?.close()
    l.relay = null
  }

  // ── Tique (ping, quedas, tentativas) ───────────────────

  private onTick() {
    if (this.disposed) return
    const now = Date.now()
    if (this.opts.isMaster) {
      if (this.dormant) return
      for (const l of [...this.links.values()]) {
        if (l.open) {
          if (now - l.lastRx > PEER_SILENCE_MS) {
            vtError('VT-NET-007', { vars: { quem: l.name }, detail: `${Math.round((now - l.lastRx) / 1000)} s sem resposta (${l.via})`, data: { rtt: l.rtt } })
            this.closePeer(l.uid, true)
            continue
          }
          if (now - l.lastPing >= PING_MS) {
            l.lastPing = now
            this.pipeSend(l, JSON.stringify({ sys: 'ping', t: now }))
          }
        } else {
          // reserva aberta e o jogador ainda não respondeu: chama de novo
          if (l.via === 'reserva' && l.relayReady && now - l.lastPing >= 1500) {
            l.lastPing = now
            l.relay?.send({ from: 'M', to: l.sid, b: [JSON.stringify({ sys: 'open', nid: l.nid })] })
          }
          if (now - l.createdAt > MASTER_NEGOTIATE_MS) {
            vtError('VT-NET-005', { vars: { quem: l.name }, detail: `mestre esperando ${l.name} (${l.via})` })
            this.closePeer(l.uid, false)
          }
        }
      }
      if (now - this.lastRoster >= ROSTER_MS) {
        this.lastRoster = now
        const roster = JSON.stringify({ sys: 'roster', ids: [...this.known.keys()] })
        for (const l of this.links.values()) if (l.open) this.pipeSend(l, roster)
      }
      if (now - this.lastBeacon >= BEACON_MS) this.beacon()
      return
    }

    const l = this.link
    if (l) {
      if (l.open) {
        if (now - l.lastRx > MASTER_SILENCE_MS) { this.lost(`${Math.round((now - l.lastRx) / 1000)} s sem nada do mestre`); return }
        if (now - l.lastPing >= PING_MS) {
          l.lastPing = now
          this.pipeSend(l, JSON.stringify({ sys: 'ping', t: now }))
        }
      } else if (now - l.createdAt > NEGOTIATE_MS) {
        this.failNegotiation('tempo esgotado')
        return
      } else if (l.via === 'reserva' && now >= this.nextJoinAt) {
        // reserva abrindo: o mestre pode não ter ouvido o pedido
        this.sendJoin()
      }
    }
    if (!this.link && this.canJoin() && now >= this.nextJoinAt) this.sendJoin()
  }

  private beacon() {
    this.lastBeacon = Date.now()
    this.signal({ kind: 'master', msid: this.msid, at: this.startedAt })
  }

  // ── Sinalização ────────────────────────────────────────

  private onSignal(p: Signal) {
    if (this.disposed || !p || typeof p !== 'object') return
    if (this.opts.isMaster) {
      if (p.kind === 'master') { this.onBeacon(p); return }
      if (this.dormant || !p.from) return
      if (p.kind === 'join') this.onJoin(p)
      else if (p.kind === 'answer') void this.onAnswer(p)
      else if (p.kind === 'ice') {
        const l = this.links.get(p.from)
        if (l && l.sid === p.sid && l.nid === p.nid) void this.addIce(l, p.candidate)
      } else if (p.kind === 'leave') {
        const l = this.links.get(p.from)
        if (l && l.sid === p.sid) this.closePeer(p.from, true)
      }
      return
    }
    if (p.to !== this.opts.selfId) return
    if (p.kind === 'offer') {
      // mestre de uma versão velha (sem aba nas mensagens)
      if (!p.sid || !p.nid) { this.versionMismatch('O mestre'); return }
      if (p.sid === this.sid) void this.onOffer(p)
    } else if (p.kind === 'ice') {
      if (p.sid !== this.sid || !p.nid || !p.candidate) return
      if (this.link && this.link.nid === p.nid) void this.addIce(this.link, p.candidate)
      else {
        const early = this.earlyIce.get(p.nid) ?? []
        if (early.length < 40) early.push(p.candidate)
        this.earlyIce.set(p.nid, early)
        if (this.earlyIce.size > 4) this.earlyIce.delete(this.earlyIce.keys().next().value as string)
      }
    } else if (p.kind === 'version') {
      if (!p.sid || p.sid === this.sid) this.versionMismatch('O mestre')
    } else if (p.kind === 'replaced') {
      if (p.sid === this.sid) this.setReplaced()
    }
  }

  private async addIce(l: Link, candidate: RTCIceCandidateInit | undefined) {
    if (!candidate || !l.pc || l.closed) return
    if (l.pc.remoteDescription) await l.pc.addIceCandidate(candidate).catch(() => {})
    else l.pending.push(candidate)
  }

  private async flushIce(l: Link) {
    for (const c of l.pending.splice(0)) await l.pc?.addIceCandidate(c).catch(() => {})
  }

  // ── Mestre ─────────────────────────────────────────────

  /** Outra aba de mestre desta campanha: a mais nova comanda; esta para. */
  private onBeacon(p: Signal) {
    if (!p.msid || p.msid === this.msid || this.dormant) return
    const theirs = p.at ?? 0
    const newer = theirs > this.startedAt || (theirs === this.startedAt && p.msid > this.msid)
    if (newer) {
      this.dormant = true
      for (const l of this.links.values()) this.closeLink(l)
      this.links.clear()
      this.issue = 'dormant'
      vtError('VT-SALA-008', { detail: `outra aba de mestre: ${p.msid}` })
      this.onChange?.()
    } else if (Date.now() - this.lastBeaconReply > 5000) {
      // a outra é a mais velha: conto que eu existo, pra ela parar
      this.lastBeaconReply = Date.now()
      this.beacon()
    }
  }

  private warnVersion(uid: string, name: string) {
    const now = Date.now()
    if (now - (this.versionWarned.get(uid) ?? 0) < 5 * 60_000) return
    this.versionWarned.set(uid, now)
    vtError('VT-SYNC-004', { vars: { quem: name }, detail: `jogador ${uid}` })
  }

  private onJoin(p: Signal) {
    const uid = p.from!
    const name = (p.name ?? 'Jogador').slice(0, 60)
    if (p.v !== NET_PROTO || !p.sid) {
      this.warnVersion(uid, name)
      this.signal({ kind: 'version', to: uid, sid: p.sid, v: NET_PROTO })
      return
    }
    const sid = p.sid
    const at = p.at ?? 0
    const relay = p.via === 'relay'
    const ex = this.links.get(uid)
    if (ex) {
      if (ex.sid !== sid) {
        if (at < ex.at) {
          // aba mais velha da mesma conta tentando voltar: a nova continua
          this.signal({ kind: 'replaced', to: uid, sid })
          return
        }
        // outra aba/aparelho da mesma conta: a nova assume, a antiga sai (sem boneco duplicado)
        vtError('VT-SYNC-006', { vars: { quem: name } })
        if (ex.open) {
          this.pipeSend(ex, JSON.stringify({ sys: 'replaced' }))
          if (ex.via === 'reserva') this.relayFlush(ex)
        } else {
          this.signal({ kind: 'replaced', to: uid, sid: ex.sid })
        }
        this.links.delete(uid)
        this.onDoorGone?.(uid, '')
        if (this.known.has(uid)) {
          this.known.delete(uid)
          const bye = { t: 'bye', id: uid }
          this.safeSink(bye)
          this.send(bye)
        }
        window.setTimeout(() => this.closeLink(ex), 500)
      } else if (relay && ex.via === 'reserva' && ex.nid === p.nid) {
        return // a reserva já está abrindo (o "open" é repetido no tique)
      } else if (!relay && ex.via === 'direto' && !ex.open && Date.now() - ex.createdAt < OFFER_FRESH_MS) {
        return // a oferta acabou de sair: espera a resposta
      } else {
        // a mesma aba perdeu a ligação (ou trocou pra reserva): recomeça sem tirar o boneco do mapa
        this.closePeer(uid, false)
      }
    }
    if (relay) this.openRelay(uid, sid, p.nid || newId(), at, name)
    else void this.offerTo(uid, sid, at, name)
  }

  private async offerTo(uid: string, sid: string, at: number, name: string) {
    if (!rtcAvailable()) return
    const l = this.newLink(uid, sid, newId(), 'direto', name)
    l.at = at
    let pc: RTCPeerConnection
    try {
      pc = new RTCPeerConnection({ iceServers: iceServers() })
    } catch (err) {
      vtError('VT-NET-010', { vars: { quem: name, detalhe: errText(err) } })
      return
    }
    l.pc = pc
    this.links.set(uid, l)
    const mine = () => this.links.get(uid) === l
    const dc = pc.createDataChannel('vortable')
    const fast = pc.createDataChannel('vortable-fast', { ordered: false, maxRetransmits: 0 })
    l.dc = dc
    l.fast = fast
    dc.onopen = () => { if (mine()) this.peerOpened(l) }
    dc.onmessage = (e) => { if (mine()) this.fromPeer(l, String(e.data)) }
    fast.onmessage = (e) => { if (mine()) this.fromPeer(l, String(e.data)) }
    dc.onclose = () => { if (mine()) this.closePeer(uid, true) }
    pc.onicecandidate = (e) => {
      if (e.candidate && mine()) this.signal({ kind: 'ice', to: uid, sid, nid: l.nid, candidate: e.candidate.toJSON() })
    }
    pc.onconnectionstatechange = () => {
      if (!mine()) return
      window.clearTimeout(l.dropTimer)
      const state = pc.connectionState
      if (state === 'failed' || state === 'closed') this.closePeer(uid, true)
      else if (state === 'disconnected') {
        l.dropTimer = window.setTimeout(() => {
          if (mine() && pc.connectionState === 'disconnected') this.closePeer(uid, true)
        }, DROP_GRACE_MS)
      }
      this.onChange?.()
    }
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      if (!mine()) return
      this.signal({ kind: 'offer', to: uid, sid, nid: l.nid, msid: this.msid, sdp: pc.localDescription?.sdp ?? '' })
      this.onChange?.()
    } catch (err) {
      vtError('VT-NET-010', { vars: { quem: name, detalhe: errText(err) } })
      if (mine()) this.closePeer(uid, false)
    }
  }

  private async onAnswer(p: Signal) {
    const l = this.links.get(p.from!)
    if (!l || !l.pc || l.sid !== p.sid || l.nid !== p.nid || !p.sdp) return
    if (l.pc.signalingState !== 'have-local-offer') return
    try {
      await l.pc.setRemoteDescription({ type: 'answer', sdp: p.sdp })
      await this.flushIce(l)
    } catch (err) {
      vtError('VT-NET-010', { vars: { quem: l.name, detalhe: `resposta: ${errText(err)}` } })
      if (this.links.get(p.from!) === l) this.closePeer(l.uid, false)
    }
  }

  /** Mestre: abre a reserva com um jogador (o canal dele no Supabase). */
  private openRelay(uid: string, sid: string, nid: string, at: number, name: string) {
    const factory = this.opts.relay
    if (!factory) return
    const l = this.newLink(uid, sid, nid, 'reserva', name)
    l.at = at
    this.links.set(uid, l)
    const mine = () => this.links.get(uid) === l
    l.relay = factory(`vt:${uid}`, {
      message: (pl) => {
        if (!mine() || !pl || pl.from !== sid || pl.to !== 'M' || !Array.isArray(pl.b)) return
        for (const d of pl.b) {
          if (typeof d !== 'string') continue
          if (!l.open) {
            // até abrir, só vale o "abri" do jogador
            try {
              const m = JSON.parse(d) as { sys?: unknown; nid?: unknown }
              if (m.sys === 'opened' && m.nid === nid) this.peerOpened(l)
            } catch { /* ignora */ }
            continue
          }
          this.fromPeer(l, d)
        }
      },
      status: (ok) => {
        if (!mine()) return
        l.relayReady = ok
        if (ok) l.lastPing = 0
      },
    })
    this.onChange?.()
  }

  /** A ligação com um jogador abriu: ele recebe as zonas mudadas, o ambiente, todos os bonecos e a lista de quem está no mapa. */
  private peerOpened(l: Link) {
    if (l.open || l.closed) return
    l.open = true
    l.lastRx = Date.now()
    this.pipeSend(l, JSON.stringify({ sys: 'zones', epoch: this.msid, list: [...this.zoneSeq] }))
    this.replayTo(l)
    this.onChange?.()
  }

  private replayTo(l: Link) {
    l.lastReplay = Date.now()
    for (const env of this.envs.values()) this.pipeSend(l, JSON.stringify(env))
    for (const [kid, data] of this.known) if (kid !== l.uid) this.pipeSend(l, data)
    this.pipeSend(l, JSON.stringify({ sys: 'roster', ids: [...this.known.keys()] }))
  }

  /** Chegou uma mensagem de um jogador: o jogo do mestre vê, e os outros jogadores recebem. */
  private fromPeer(l: Link, data: string) {
    l.lastRx = Date.now()
    let msg: unknown
    try { msg = JSON.parse(data) } catch {
      vtError('VT-SYNC-003', { detail: `de ${l.name}: ${data.slice(0, 80)}` })
      return
    }
    if (typeof msg !== 'object' || msg === null) return
    if ('sys' in msg) { this.peerSys(l, msg as Record<string, unknown>); return }
    const m = msg as { t?: unknown; id?: unknown }
    // jogo recém-montado perguntando quem está aí: recebe o que o mestre já sabe, só ele
    if (m.t === 'who') {
      if (Date.now() - l.lastReplay >= REPLAY_MIN_MS) this.replayTo(l)
      return
    }
    if (m.t === 'state') {
      // posição de quem ainda não se anunciou: espera o "hello" (que vem pelo canal confiável)
      if (typeof m.id !== 'string' || !this.known.has(m.id)) return
      this.safeSink(msg)
      for (const o of this.links.values()) if (o !== l && o.open) this.pipeSendFast(o, data, m.id)
      return
    }
    this.remember(msg, data)
    this.safeSink(msg)
    for (const o of this.links.values()) if (o !== l && o.open) this.pipeSend(o, data)
  }

  private peerSys(l: Link, sys: Record<string, unknown>) {
    const t = (v: unknown) => (typeof v === 'string' ? v.slice(0, 80) : '')
    switch (sys.sys) {
      case 'ping':
        this.pipeSend(l, JSON.stringify({ sys: 'pong', t: sys.t }))
        break
      case 'pong':
        if (typeof sys.t === 'number') l.rtt = Math.max(0, Date.now() - sys.t)
        break
      case 'door':
        if (typeof sys.id === 'string' && typeof sys.to === 'string') {
          this.onDoor?.({ peerId: l.uid, id: sys.id.slice(0, 20), name: l.name, from: t(sys.from), fromName: t(sys.fromName), to: t(sys.to), toName: t(sys.toName), via: t(sys.via) })
        }
        break
      case 'door-cancel':
        if (typeof sys.id === 'string') this.onDoorGone?.(l.uid, sys.id)
        break
      case 'role':
        if ((sys.role === 'player' || sys.role === 'spectator') && l.role !== sys.role) {
          l.role = sys.role
          this.onChange?.()
        }
        break
      case 'leave':
        this.closePeer(l.uid, true)
        break
    }
  }

  private closePeer(uid: string, announce: boolean) {
    const l = this.links.get(uid)
    if (!l) return
    this.links.delete(uid)
    this.closeLink(l)
    this.onDoorGone?.(uid, '')
    if (announce && this.known.has(uid)) {
      // quem saiu some do mundo de todo mundo
      this.known.delete(uid)
      const bye = { t: 'bye', id: uid }
      this.safeSink(bye)
      this.send(bye)
    }
    this.onChange?.()
  }

  // ── Jogador ────────────────────────────────────────────

  private canJoin() {
    return !this.opts.isMaster && !this.disposed && this.live && this.issue === null
  }

  private startJoining() {
    if (!this.canJoin()) return
    this.setStatus('connecting')
    if (!this.link) this.sendJoin()
  }

  private sendJoin() {
    this.nextJoinAt = Date.now() + JOIN_EVERY_MS + Math.random() * 1500
    const relay = !!this.opts.relay && (this.forceRelay || this.rtcFails >= RELAY_AFTER_FAILS)
    if (relay && !this.link) this.link = this.playerRelay()
    this.signal({
      kind: 'join', from: this.opts.selfId, sid: this.sid, at: this.claimAt, v: NET_PROTO,
      via: relay ? 'relay' : 'rtc', ...(relay && this.link ? { nid: this.link.nid } : {}), name: this.name,
    })
    this.setStatus('connecting')
  }

  /** Jogador: abre o canal reserva e espera o mestre chamar ("open"). */
  private playerRelay(): Link {
    const l = this.newLink('mestre', this.sid, newId(), 'reserva', 'mestre')
    const mine = () => this.link === l
    l.relay = this.opts.relay!(`vt:${this.opts.selfId}`, {
      message: (pl) => {
        if (!mine() || !pl || pl.from !== 'M' || pl.to !== this.sid || !Array.isArray(pl.b)) return
        for (const d of pl.b) if (typeof d === 'string' && mine()) this.fromMaster(l, d)
      },
      status: (ok, detail) => {
        if (!mine()) return
        l.relayReady = ok
        if (!ok && l.open && detail === 'CLOSED') this.lost('a reserva fechou')
      },
    })
    return l
  }

  private async onOffer(p: Signal) {
    if (!this.canJoin()) return
    if (this.link?.nid === p.nid) return // repetida
    if (this.link?.via === 'reserva') return // já estamos pela reserva
    if (this.link) this.stopLink(false)
    if (!rtcAvailable()) { this.forceRelay = true; return }
    const l = this.newLink('mestre', this.sid, p.nid!, 'direto', 'mestre')
    l.pending = this.earlyIce.get(p.nid!) ?? []
    this.earlyIce.clear()
    let pc: RTCPeerConnection
    try {
      pc = new RTCPeerConnection({ iceServers: iceServers() })
    } catch (err) {
      this.forceRelay = true
      vtError('VT-NET-008', { detail: errText(err) })
      return
    }
    l.pc = pc
    this.link = l
    const mine = () => this.link === l
    pc.ondatachannel = (e) => {
      const dc = e.channel
      if (dc.label === 'vortable-fast') {
        l.fast = dc
        dc.onmessage = (ev) => { if (mine()) this.fromMaster(l, String(ev.data)) }
        return
      }
      l.dc = dc
      dc.onopen = () => { if (mine()) this.linkOpened(l) }
      dc.onmessage = (ev) => { if (mine()) this.fromMaster(l, String(ev.data)) }
      dc.onclose = () => { if (mine()) this.lost('o canal fechou') }
      if (dc.readyState === 'open' && mine()) this.linkOpened(l)
    }
    pc.onicecandidate = (e) => {
      if (e.candidate && mine()) this.signal({ kind: 'ice', from: this.opts.selfId, sid: this.sid, nid: l.nid, candidate: e.candidate.toJSON() })
    }
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'checking') l.iceChecked = true
    }
    pc.onconnectionstatechange = () => {
      if (!mine()) return
      window.clearTimeout(l.dropTimer)
      const state = pc.connectionState
      if (state === 'failed') {
        if (l.open) this.lost('a ligação direta falhou')
        else this.failNegotiation('a rede bloqueou a ligação direta', true)
      } else if (state === 'disconnected') {
        l.dropTimer = window.setTimeout(() => {
          if (mine() && pc.connectionState === 'disconnected') this.lost('ligação instável por 6 s')
        }, DROP_GRACE_MS)
      }
    }
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp: p.sdp ?? '' })
      await this.flushIce(l)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      if (!mine()) return
      this.signal({ kind: 'answer', from: this.opts.selfId, sid: this.sid, nid: l.nid, sdp: pc.localDescription?.sdp ?? '' })
    } catch (err) {
      vtError('VT-NET-010', { vars: { quem: 'o mestre', detalhe: errText(err) } })
      if (mine()) this.failNegotiation('erro ao aceitar a oferta')
    }
  }

  private linkOpened(l: Link) {
    if (l.open || l.closed) return
    l.open = true
    l.lastRx = Date.now()
    const again = this.everOnline
    this.everOnline = true
    if (l.via === 'direto') this.rtcFails = 0
    this.pipeSend(l, JSON.stringify({ sys: 'role', role: this.role }))
    this.setStatus('online')
    vtResolve('link')
    if (again && this.lostAt && Date.now() - this.lostAt > 3000) vtError('VT-SYNC-001')
    this.lostAt = 0
    if (l.via === 'reserva' && !this.relayWarned) {
      this.relayWarned = true
      vtError(this.forceRelay ? 'VT-NET-008' : 'VT-NET-003', { detail: `${this.rtcFails} falha(s) da ligação direta` })
    }
    this.onOpen?.(again)
    this.onChange?.()
  }

  /** A ligação não abriu: conta a falha (duas da direta = reserva) e pede de novo. */
  private failNegotiation(reason: string, iceFailed = false) {
    const l = this.link
    if (!l) return
    if (l.via === 'direto' && (iceFailed || l.iceChecked)) this.rtcFails++
    vtError('VT-NET-005', { detail: `${reason} (${l.via}; falhas da direta: ${this.rtcFails})` })
    this.stopLink(false)
    this.nextJoinAt = Date.now() + 500 + Math.random() * 1000
    if (this.canJoin()) this.setStatus('connecting')
  }

  /** A ligação com o mestre caiu: avisa e tenta voltar (os bonecos ficam; a lista do mestre corrige quem saiu). */
  private lost(reason: string) {
    const l = this.link
    const wasOpen = !!l?.open
    const via = l?.via
    this.stopLink(false)
    this.dropDoorWaits('lost')
    if (!this.canJoin()) { this.setStatus('off'); return }
    if (wasOpen) {
      this.lostAt = Date.now()
      vtError(!navigator.onLine ? 'VT-NET-001' : via === 'reserva' ? 'VT-NET-009' : 'VT-NET-002', { key: 'link', detail: reason, data: { rtt: l?.rtt ?? null } })
    }
    this.setStatus('connecting')
    this.nextJoinAt = Date.now() + 300 + Math.random() * 900
  }

  private stopLink(setOff = true) {
    const l = this.link
    this.link = null
    if (l) this.closeLink(l)
    if (setOff) this.setStatus('off')
    else this.onChange?.()
  }

  private versionMismatch(who: string) {
    if (this.issue === 'version') return
    this.issue = 'version'
    this.stopLink()
    vtError('VT-SYNC-004', { vars: { quem: who } })
    this.onChange?.()
  }

  private setReplaced() {
    if (this.issue === 'replaced') return
    this.issue = 'replaced'
    this.dropDoorWaits('lost')
    this.stopLink()
    vtResolve('link')
    vtError('VT-SALA-007')
    this.onReplaced?.()
    this.onChange?.()
  }

  private fromMaster(l: Link, data: string) {
    l.lastRx = Date.now()
    let msg: unknown
    try { msg = JSON.parse(data) } catch {
      vtError('VT-SYNC-003', { detail: `do mestre: ${data.slice(0, 80)}` })
      return
    }
    if (typeof msg !== 'object' || msg === null) return
    if ('sys' in msg) { this.masterSys(l, msg as Record<string, unknown>); return }
    if (!l.open) return
    const m = msg as { t?: unknown; id?: unknown; zone?: unknown; from?: unknown; zs?: unknown }
    if (m.t === 'hello' && typeof m.id === 'string') this.cache.set(m.id, data)
    else if (m.t === 'bye' && typeof m.id === 'string') this.cache.delete(m.id)
    else if (m.t === 'env') this.envCache.set(String(m.zone ?? '*'), data)
    else if (m.t === 'state' && (typeof m.id !== 'string' || !this.cache.has(m.id))) return // sem "hello" ainda (ou já saiu)
    if ((m.t === 'zone' || m.t === 'npcmove') && typeof m.zs === 'number') {
      for (const z of [m.t === 'zone' ? m.id : m.zone, m.from]) if (typeof z === 'string' && z) this.zoneSeen.set(z, m.zs)
    }
    this.safeSink(msg)
  }

  private masterSys(l: Link, sys: Record<string, unknown>) {
    switch (sys.sys) {
      case 'open':
        if (l.via === 'reserva' && sys.nid === l.nid) {
          // o "abri" vai na frente: o mestre só aceita o resto (o boneco, a função) depois dele
          this.pipeSend(l, JSON.stringify({ sys: 'opened', nid: l.nid }))
          this.linkOpened(l)
        }
        return
    }
    if (!l.open) return
    switch (sys.sys) {
      case 'ping':
        this.pipeSend(l, JSON.stringify({ sys: 'pong', t: sys.t }))
        break
      case 'pong':
        if (typeof sys.t === 'number') this.measure(l, Math.max(0, Date.now() - sys.t))
        break
      case 'kick':
        this.issue = 'kicked'
        this.dropDoorWaits('lost')
        this.stopLink()
        vtResolve('link')
        vtError('VT-SALA-006')
        this.onKicked?.()
        this.onChange?.()
        break
      case 'replaced':
        this.setReplaced()
        break
      case 'cmd':
        if (sys.cmd === 'spectate' || sys.cmd === 'play') this.onCommand?.(sys.cmd)
        break
      case 'door-ack':
        if (typeof sys.id === 'string') {
          const done = this.doorWaits.get(sys.id)
          this.doorWaits.delete(sys.id)
          done?.(sys.ok === true ? 'ok' : 'no')
        }
        break
      case 'sfx':
        if (typeof sys.s === 'string') {
          this.onSfx?.({
            s: sys.s,
            v: typeof sys.v === 'number' ? Math.max(0, Math.min(1, sys.v)) : 0.8,
            d: sys.d === 1 || sys.d === 2 ? sys.d : 0,
            zone: typeof sys.zone === 'string' ? sys.zone : null,
          })
        }
        break
      case 'roster':
        if (Array.isArray(sys.ids)) this.prune(new Set(sys.ids.filter((x): x is string => typeof x === 'string')))
        break
      case 'zones':
        if (typeof sys.epoch === 'string' && Array.isArray(sys.list)) this.syncZones(sys.epoch, sys.list)
        break
    }
  }

  private measure(l: Link, rtt: number) {
    l.rtt = rtt
    l.slow = rtt > SLOW_RTT_MS ? l.slow + 1 : 0
    if (l.slow >= 3 && Date.now() - this.lastSlowWarn > SLOW_WARN_EVERY_MS) {
      this.lastSlowWarn = Date.now()
      vtError('VT-NET-004', { vars: { ms: rtt }, detail: `${rtt} ms (${l.via})` })
    }
  }

  /** O mestre mandou quem está no mapa: quem não está mais (saiu enquanto eu estava fora) sai daqui também. */
  private prune(ids: Set<string>) {
    let n = 0
    for (const id of [...this.cache.keys()]) {
      if (ids.has(id) || id === this.opts.selfId) continue
      this.cache.delete(id)
      this.safeSink({ t: 'bye', id })
      n++
    }
    if (n > 0) vtError('VT-SYNC-002', { vars: { n }, detail: `${n} fantasma(s)` })
  }

  /** Zonas salvas (ou com NPC movido) enquanto eu estava fora: o jogo recarrega a que está aberta. */
  private syncZones(epoch: string, list: unknown[]) {
    const first = this.zoneEpoch === null
    const newMaster = !first && epoch !== this.zoneEpoch
    if (epoch !== this.zoneEpoch) { this.zoneSeen.clear(); this.zoneEpoch = epoch }
    const changed = new Set<string>()
    for (const item of list) {
      if (!Array.isArray(item) || typeof item[0] !== 'string' || typeof item[1] !== 'number') continue
      const [id, seq] = item as [string, number]
      if (seq > (this.zoneSeen.get(id) ?? 0)) {
        this.zoneSeen.set(id, seq)
        if (!first) changed.add(id)
      }
    }
    // o mestre recarregou a página: não dá pra saber o que mudou antes, então a zona aberta recarrega
    const here = this.opts.currentZone?.() ?? null
    if (newMaster && here) changed.add(here)
    for (const id of changed) this.safeSink({ t: 'zone', id })
    if (here && changed.has(here)) vtError('VT-SYNC-005', { detail: here })
  }
}
