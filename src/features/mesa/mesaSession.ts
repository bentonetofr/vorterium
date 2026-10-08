import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../shared/lib/supabase'
import { peekHandoff } from '../vortable/pip/pipStore'

// ────────────────────────────────────────────────────────
// Mesa: a "cena" que os jogadores veem no Vortable, estilo OBS. O mestre
// escolhe (jogo ao vivo, tela preta, pausa, uma imagem/mapa, um título) e
// todos veem na hora. O Supabase Realtime (canal privado "mesa:<campanha>",
// só membros) leva o estado do mestre pros jogadores:
//
//   jogador → viewer-join {viewerId, name}   "estou aqui"
//   mestre  → state {stage}                  a cena atual (e a resposta ao "estou aqui");
//                                            liveId só existe depois que o mestre LIBERA o Vortable
//
// E no canal "mesa-aviso:<campanha>" (que os jogadores escutam de todas
// as campanhas deles, em qualquer página), o mestre manda, enquanto o
// Vortable está liberado:
//   live {liveId, masterName} / ended {liveId} — e responde "status?".
//
// Sem o Vortable liberado pelo mestre, `liveId` é null (o botão de entrar dos
// jogadores fica travado) e a cena volta pro jogo.
// ────────────────────────────────────────────────────────

/** O que os jogadores veem agora. */
export type MesaScene =
  | { kind: 'game' }
  | { kind: 'black' }
  | { kind: 'pause' }
  | { kind: 'image'; id: string; url: string; name: string }
  | { kind: 'title'; title: string; subtitle: string }

export type SceneKind = MesaScene['kind']

/** Documento (carta ou livro) na mesa — e a página aberta, num livro. (Guardado pra entrar no Vortable.) */
export interface MesaDocRef {
  id:    string
  title: string
  /** Página aberta do livro (0 = capa, n = página n — igual em qualquer tela); numa folha, sempre 0. */
  page:  number
}

/**
 * Espectadores (jogadores que não estão em jogo e só assistem): o mestre liga/desliga,
 * libera ou não a câmera livre e escolhe o "foco" que a câmera do mestre mostra.
 */
export interface SpectateRules {
  allow: boolean
  /** Câmera livre liberada (ligada por padrão). */
  free:  boolean
  /** Id do jogador que os espectadores em "câmera do mestre" acompanham (null = nenhum). */
  focus: string | null
}

export const DEFAULT_SPECTATE: SpectateRules = { allow: true, free: true, focus: null }

export interface MesaStage {
  /** Id da sessão do mestre (Vortable aberto); null = ninguém ao vivo. */
  liveId:   string | null
  /** Mundo que o mestre abriu por último (muda: os jogadores relêem os mundos na hora). */
  worldId:  string | null
  scene:    MesaScene
  document: MesaDocRef | null
  spectate: SpectateRules
}

export interface MesaSnapshot {
  channelError: string | null
  stage:        MesaStage
  /** O mestre está com o Vortable aberto. */
  live:         boolean
}

export const GAME_SCENE: MesaScene = { kind: 'game' }
export const EMPTY_STAGE: MesaStage = { liveId: null, worldId: null, scene: GAME_SCENE, document: null, spectate: DEFAULT_SPECTATE }

export const EMPTY_SNAPSHOT: MesaSnapshot = { channelError: null, stage: EMPTY_STAGE, live: false }

interface SessionOptions {
  campaignId: string
  userId:     string
  name:       string
  isMaster:   boolean
  /** Mestre: avisa os jogadores que a Mesa está aberta (só a página do Vortable faz isso). */
  announce:   boolean
  /** Mestre: continua de uma sessão que já estava no ar (a telinha e a página do Vortable se passam a sessão). */
  resume?:    MesaStage
  onChange:   (snapshot: MesaSnapshot) => void
}

type Payload = Record<string, unknown>

const MAX_TITLE = 120
const MAX_SUBTITLE = 240

function newId(): string {
  return crypto.randomUUID().slice(0, 8)
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

/** Confere uma cena vinda da rede (o canal é só de membros, mas a forma não é garantida). */
function parseScene(raw: unknown): MesaScene {
  const s = (raw ?? {}) as Payload
  switch (s.kind) {
    case 'black': return { kind: 'black' }
    case 'pause': return { kind: 'pause' }
    case 'image':
      return typeof s.url === 'string' && s.url
        ? { kind: 'image', id: text(s.id, 80), url: s.url, name: text(s.name, 200) }
        : GAME_SCENE
    case 'title': return { kind: 'title', title: text(s.title, MAX_TITLE), subtitle: text(s.subtitle, MAX_SUBTITLE) }
    default: return GAME_SCENE
  }
}

function parseStage(raw: unknown): MesaStage | null {
  if (typeof raw !== 'object' || raw === null || !('liveId' in raw)) return null
  const s = raw as Payload
  return {
    liveId:   typeof s.liveId === 'string' ? s.liveId : null,
    worldId:  typeof s.worldId === 'string' ? s.worldId : null,
    scene:    parseScene(s.scene),
    document: (s.document as MesaDocRef | null | undefined) ?? null,
    spectate: parseSpectate(s.spectate),
  }
}

function parseSpectate(raw: unknown): SpectateRules {
  const s = (raw ?? {}) as Payload
  return {
    allow: s.allow !== false,
    free:  s.free !== false,
    focus: typeof s.focus === 'string' && s.focus ? s.focus.slice(0, 80) : null,
  }
}

/**
 * Sessões do mestre na mesma campanha (a do layout e a da página do Vortable): dividem o palco,
 * senão cada uma mandaria aos jogadores o seu (ex.: um documento posto pelo botão do livro
 * apagaria o "ao vivo" da página do Vortable).
 */
const MASTER_SESSIONS = new Map<string, Set<MesaSession>>()

export class MesaSession {
  private readonly opts: SessionOptions
  private readonly myId: string
  private channel: RealtimeChannel | null = null
  private aviso:   RealtimeChannel | null = null
  private disposed = false
  private snap: MesaSnapshot = { ...EMPTY_SNAPSHOT }
  private readonly signalHandlers = new Set<(payload: Payload) => void>()

  constructor(opts: SessionOptions) {
    this.opts = opts
    this.myId = `${opts.userId}:${newId()}`
    if (opts.resume && opts.isMaster) this.snap = { ...EMPTY_SNAPSHOT, stage: opts.resume, live: Boolean(opts.resume.liveId) }
    if (opts.isMaster) {
      let set = MASTER_SESSIONS.get(opts.campaignId)
      if (!set) MASTER_SESSIONS.set(opts.campaignId, (set = new Set()))
      if (opts.resume) for (const s of set) s.adopt(opts.resume)
      else { const other = [...set][0]; if (other) this.snap = { ...EMPTY_SNAPSHOT, stage: other.snap.stage, live: other.snap.live } }
      set.add(this)
    }
  }

  /** Outra sessão do mesmo mestre mudou o palco: acompanha (sem mandar nada aos jogadores). */
  private adopt(stage: MesaStage) {
    this.update({ stage })
  }

  private mirror() {
    for (const s of MASTER_SESSIONS.get(this.opts.campaignId) ?? []) if (s !== this) s.adopt(this.snap.stage)
  }

  get snapshot(): MesaSnapshot {
    return this.snap
  }

  private update(patch: Partial<MesaSnapshot>) {
    if (this.disposed) return
    const next = { ...this.snap, ...patch }
    next.live = Boolean(next.stage.liveId)
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

    // conversa de conexão do multiplayer do Vortable (ver VortableNet)
    channel.on('broadcast', { event: 'rtc' }, ({ payload }) => {
      for (const handler of this.signalHandlers) handler((payload ?? {}) as Payload)
    })

    if (this.opts.isMaster) {
      channel.on('broadcast', { event: 'viewer-join' }, () => this.sendState())
      this.connectAviso()
    } else {
      channel.on('broadcast', { event: 'state' }, ({ payload }) => {
        const stage = parseStage((payload as Payload | null)?.stage)
        if (stage) this.update({ stage })
      })
    }

    channel.subscribe((status) => {
      if (this.disposed) return
      if (status === 'SUBSCRIBED') {
        this.update({ channelError: null })
        if (this.opts.isMaster) {
          // reconectou no meio de uma sessão liberada: manda o estado de novo
          if (this.snap.stage.liveId) this.sendState()
        } else {
          this.send('viewer-join', { viewerId: this.myId, name: this.opts.name })
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.update({ channelError: 'Não foi possível conectar à Mesa. Recarregue a página e tente de novo.' })
      }
    })
  }

  dispose(): void {
    if (this.disposed) return
    // numa passagem (telinha ↔ página do Vortable) a sessão continua no ar: não avisa que acabou
    if (this.opts.isMaster && this.opts.announce && this.snap.stage.liveId && !peekHandoff(this.opts.campaignId)) {
      const ended = this.snap.stage.liveId
      this.snap = { ...this.snap, stage: EMPTY_STAGE, live: false }
      this.mirror()
      this.sendState()
      this.sendAviso('ended', { liveId: ended })
    }
    this.disposed = true
    MASTER_SESSIONS.get(this.opts.campaignId)?.delete(this)
    if (this.channel) void supabase.removeChannel(this.channel)
    if (this.aviso) void supabase.removeChannel(this.aviso)
    this.channel = null
    this.aviso = null
  }

  // ── Sinalização do multiplayer (WebRTC) ────────────────

  signal(payload: Payload) {
    this.send('rtc', payload)
  }

  onSignal(handler: (payload: Payload) => void): () => void {
    this.signalHandlers.add(handler)
    return () => { this.signalHandlers.delete(handler) }
  }

  // ── Mestre: sessão e cena ──────────────────────────────

  /**
   * Mestre: libera (ou encerra) o Vortable pros jogadores. Liberado, o botão
   * de entrar deles destrava e eles recebem o aviso "Ao vivo".
   */
  setLive(on: boolean): void {
    if (!this.opts.isMaster || !this.opts.announce) return
    const liveId = this.snap.stage.liveId
    if (on === Boolean(liveId)) return
    if (on) {
      const stage = { ...this.snap.stage, liveId: newId() }
      this.update({ stage })
      this.mirror()
      this.sendState()
      this.sendAviso('live', { liveId: stage.liveId, masterName: this.opts.name })
    } else {
      this.update({ stage: { ...this.snap.stage, liveId: null, scene: GAME_SCENE } })
      this.mirror()
      this.sendState()
      this.sendAviso('ended', { liveId })
    }
  }

  private setStage(patch: Partial<MesaStage>) {
    if (!this.opts.isMaster) return
    this.update({ stage: { ...this.snap.stage, ...patch } })
    this.mirror()
    this.sendState()
  }

  /** Troca o que os jogadores veem (vale na hora pra todos). */
  setScene(scene: MesaScene): void {
    this.setStage({ scene })
  }

  /** Mestre: abriu este mundo (avisa os jogadores além do banco). */
  setWorldId(worldId: string | null): void {
    this.setStage({ worldId })
  }

  /** Mestre: regras dos espectadores (liga/desliga, câmera livre, foco). */
  setSpectate(patch: Partial<SpectateRules>): void {
    this.setStage({ spectate: { ...this.snap.stage.spectate, ...patch } })
  }

  showDocument(doc: MesaDocRef): void {
    this.setStage({ document: doc })
  }

  hideDocument(): void {
    this.setStage({ document: null })
  }

  /** Virou a página do livro na mesa: vira pra todos. */
  setDocumentPage(page: number): void {
    const doc = this.snap.stage.document
    if (!doc || doc.page === page) return
    this.setStage({ document: { ...doc, page } })
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
      if (this.snap.stage.liveId) this.sendAviso('live', { liveId: this.snap.stage.liveId, masterName: this.opts.name })
    })
    aviso.subscribe()
  }

  private sendAviso(event: 'live' | 'ended', payload: Payload) {
    if (!this.aviso) return
    void this.aviso.send({ type: 'broadcast', event, payload: { ...payload, campaignId: this.opts.campaignId } })
  }
}
