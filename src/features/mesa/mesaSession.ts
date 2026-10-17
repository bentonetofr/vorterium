import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../shared/lib/supabase'
import { peekHandoff } from '../vortable/pip/pipStore'
import { vtError, vtResolve } from '../vortable/errors/vtErrors'
import type { VtCode } from '../vortable/errors/catalog'

// ────────────────────────────────────────────────────────
// Mesa: a "cena" que os jogadores veem no Vortable, estilo OBS. O mestre
// escolhe (jogo ao vivo, tela preta, pausa, uma imagem/mapa, um título) e
// todos veem na hora. O Supabase Realtime (canal privado "mesa:<campanha>",
// só membros) leva o estado do mestre pros jogadores:
//
//   jogador → viewer-join {viewerId, name}   "estou aqui"
//   mestre  → state {stage}                  a cena atual (e a resposta ao "estou aqui");
//                                            liveId só existe depois que o mestre LIBERA o Vortable;
//                                            ao vivo, repetido a cada 15 s (sinal de vida do mestre);
//                                            stage.away = o mestre recarregou a página: espera até 90 s
//
// Outras abas do mestre (o site aberto junto com o Vortable) só espelham a sessão
// ao vivo: não respondem aos jogadores nem encerram nada.
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
  /** O mestre saiu da página sem encerrar (recarregando): a sessão espera ele voltar. */
  away?:    boolean
}

export interface MesaSnapshot {
  channelError: string | null
  stage:        MesaStage
  /** O mestre está com o Vortable aberto. */
  live:         boolean
  /** Jogador: o mestre sumiu (recarregando a página, ou sem notícias dele há um tempo). */
  masterAway:   boolean
}

export const GAME_SCENE: MesaScene = { kind: 'game' }
export const EMPTY_STAGE: MesaStage = { liveId: null, worldId: null, scene: GAME_SCENE, document: null, spectate: DEFAULT_SPECTATE }

export const EMPTY_SNAPSHOT: MesaSnapshot = { channelError: null, stage: EMPTY_STAGE, live: false, masterAway: false }

/** Mestre: o estado é reenviado a cada tanto (os jogadores sabem que ele continua lá). */
const HEARTBEAT_MS = 15_000
/** Jogador: sem notícia do mestre por isso = ele sumiu (aviso; a sessão continua). */
const SILENT_MS = 40_000
/** Jogador: o mestre saiu da página e não voltou nisso = a sessão acabou. */
export const AWAY_END_MS = 90_000

const resumeKey = (campaignId: string) => `vt:mesa-live:${campaignId}`

/** Mestre: a sessão ao vivo guardada nesta aba (pra continuar depois de recarregar a página). */
function loadResume(campaignId: string): MesaStage | null {
  try {
    const raw = sessionStorage.getItem(resumeKey(campaignId))
    if (!raw) return null
    const saved = JSON.parse(raw) as { stage?: unknown; at?: number }
    if (typeof saved.at !== 'number' || Date.now() - saved.at > AWAY_END_MS) return null
    const stage = parseStage(saved.stage)
    return stage?.liveId ? { ...stage, away: false } : null
  } catch {
    return null
  }
}

function saveResume(campaignId: string, stage: MesaStage | null) {
  try {
    if (stage?.liveId) sessionStorage.setItem(resumeKey(campaignId), JSON.stringify({ stage: { ...stage, away: false }, at: Date.now() }))
    else sessionStorage.removeItem(resumeKey(campaignId))
  } catch { /* sem storage: recarregar encerra a sessão, como antes */ }
}

interface SessionOptions {
  campaignId: string
  userId:     string
  name:       string
  isMaster:   boolean
  /** Mestre: avisa os jogadores que a Mesa está aberta (só a página do Vortable faz isso). */
  announce:   boolean
  /** Mestre: continua de uma sessão que já estava no ar (a telinha e a página do Vortable se passam a sessão). */
  resume?:    MesaStage
  /** Falhas do canal vão pra central de erros do Vortable (página do Vortable e telinha do mestre). */
  report?:    boolean
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
    ...(s.away === true ? { away: true } : {}),
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

export class MesaSession {
  private readonly opts: SessionOptions
  private readonly myId: string
  private channel: RealtimeChannel | null = null
  private aviso:   RealtimeChannel | null = null
  private disposed = false
  /** O canal da Mesa está assinado agora (a conversa do multiplayer só sai com ele). */
  private joined = false
  private everJoined = false
  private attempt = 0
  private retryTimer = 0
  private readonly timer: number
  private snap: MesaSnapshot = { ...EMPTY_SNAPSHOT }
  private readonly signalHandlers = new Set<(payload: Payload) => void>()
  /** Jogador: última notícia do mestre, e desde quando ele saiu da página. */
  private lastStateAt = Date.now()
  private awaySince = 0
  /** Mestre: saiu da página sem encerrar (recarregando): não avisa que acabou. */
  private suspended = false
  /** Mestre sem o Vortable nesta aba: última vez que a aba com o Vortable ao vivo mandou o estado. */
  private otherLiveAt = 0
  private lastHeartbeat = 0

  constructor(opts: SessionOptions) {
    this.opts = opts
    this.myId = `${opts.userId}:${newId()}`
    if (opts.isMaster) {
      // a telinha passou a sessão pra cá, ou esta aba recarregou no meio de uma sessão ao vivo
      const resume = opts.resume ?? (opts.announce ? loadResume(opts.campaignId) : null)
      if (resume) this.snap = { ...EMPTY_SNAPSHOT, stage: { ...resume, away: false }, live: Boolean(resume.liveId) }
    }
    this.timer = window.setInterval(() => this.onTick(), 5_000)
  }

  get snapshot(): MesaSnapshot {
    return this.snap
  }

  private update(patch: Partial<MesaSnapshot>) {
    if (this.disposed) return
    const next = { ...this.snap, ...patch }
    next.live = Boolean(next.stage.liveId)
    // o mestre reenvia o estado a cada jogador que entra: se nada mudou, ninguém precisa redesenhar
    if (
      !this.opts.isMaster && next.channelError === this.snap.channelError && next.masterAway === this.snap.masterAway
      && JSON.stringify(next.stage) === JSON.stringify(this.snap.stage)
    ) return
    this.snap = next
    if (this.opts.isMaster && this.opts.announce) saveResume(this.opts.campaignId, next.stage)
    this.opts.onChange(next)
  }

  private send(event: string, payload: Payload = {}) {
    if (!this.channel || !this.joined) return
    void this.channel.send({ type: 'broadcast', event, payload })
  }

  private report(code: VtCode, opts: Parameters<typeof vtError>[1] = {}) {
    if (this.opts.report) vtError(code, { campaignId: this.opts.campaignId, ...opts })
  }

  // ── Ciclo de vida ──────────────────────────────────────

  async connect(): Promise<void> {
    if (this.disposed) return
    try {
      // Canais privados: o Realtime confere a policy com o token do usuário.
      await supabase.realtime.setAuth()
    } catch (err) {
      this.failed('VT-SALA-001', err instanceof Error ? err.message : String(err))
      return
    }
    if (this.disposed) return

    const topic = `mesa:${this.opts.campaignId}`
    // o supabase-js devolve o MESMO canal pra um nome igual: o da página anterior (ainda fechando) sai antes,
    // senão o subscribe nele não faz nada e a sala nunca abre
    const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`)
    if (stale) await supabase.removeChannel(stale).catch(() => 'error')
    if (this.disposed) return

    const channel = supabase.channel(topic, {
      config: { private: true, broadcast: { self: false } },
    })
    this.channel = channel

    // conversa de conexão do multiplayer do Vortable (ver VortableNet)
    channel.on('broadcast', { event: 'rtc' }, ({ payload }) => {
      for (const handler of this.signalHandlers) handler((payload ?? {}) as Payload)
    })

    if (this.opts.isMaster) {
      channel.on('broadcast', { event: 'viewer-join' }, () => {
        if (this.opts.announce) { this.sendState(); return }
        // outra aba do mestre está com o Vortable ao vivo: ela responde (esta responderia "nada ao vivo" e derrubaria os jogadores)
        window.setTimeout(() => { if (!this.disposed && Date.now() - this.otherLiveAt > SILENT_MS) this.sendState() }, 1500)
      })
      if (this.opts.announce) void this.connectAviso()
    }
    channel.on('broadcast', { event: 'state' }, ({ payload }) => {
      const stage = parseStage((payload as Payload | null)?.stage)
      if (!stage) return
      if (!this.opts.isMaster) {
        this.lastStateAt = Date.now()
        this.awaySince = stage.away ? (this.awaySince || Date.now()) : 0
        this.update({ stage, masterAway: !!stage.away && Boolean(stage.liveId) })
        return
      }
      // estado mandado por OUTRA aba do mestre
      if (this.opts.announce) {
        // a outra aba (o site) pôs ou tirou um documento da mesa desta sessão
        if (stage.liveId && stage.liveId === this.snap.stage.liveId && JSON.stringify(stage.document) !== JSON.stringify(this.snap.stage.document)) {
          this.update({ stage: { ...this.snap.stage, document: stage.document } })
        }
        return
      }
      // esta aba só espelha a sessão ao vivo da outra
      if (stage.liveId) { this.otherLiveAt = Date.now(); this.update({ stage: { ...stage, away: false } }) }
      else if (this.otherLiveAt) { this.otherLiveAt = 0; this.update({ stage }) }
    })

    channel.subscribe((status, err) => {
      if (this.disposed || this.channel !== channel) return
      if (status === 'SUBSCRIBED') {
        this.joined = true
        this.everJoined = true
        this.attempt = 0
        vtResolve('sala')
        this.update({ channelError: null })
        if (this.opts.isMaster && this.opts.announce) {
          // reconectou (ou recarregou) no meio de uma sessão liberada: manda o estado de novo
          if (this.snap.stage.liveId) this.sendState()
        } else {
          // jogador (ou outra aba do mestre): pede o estado atual
          this.send('viewer-join', { viewerId: this.myId, name: this.opts.name })
        }
        return
      }
      this.joined = false
      const detail = `${status}${err ? `: ${err.message}` : ''}`
      if (status === 'CHANNEL_ERROR') {
        // o próprio supabase-js tenta de novo; aqui só avisa
        const denied = /unauthori[sz]ed|permission|not allowed|denied|rls/i.test(err?.message ?? '')
        this.report(denied ? 'VT-PERM-001' : this.everJoined ? 'VT-SALA-002' : 'VT-SALA-001', { key: 'sala', detail })
        this.update({ channelError: 'Sem conexão com a sessão. Tentando de novo…' })
      } else if (status === 'TIMED_OUT') {
        this.report('VT-SALA-003', { key: 'sala', detail })
        this.update({ channelError: 'A sessão demorou a responder. Tentando de novo…' })
      } else if (status === 'CLOSED') {
        // fechou sem a gente pedir (o servidor encerrou o canal): abre outro
        this.failed('VT-SALA-002', detail)
      }
    })
  }

  /** O canal não abriu ou fechou: avisa e tenta de novo, cada vez esperando mais (até 30 s). */
  private failed(code: VtCode, detail: string) {
    if (this.disposed) return
    this.joined = false
    this.report(code, { key: 'sala', detail })
    this.update({ channelError: 'Sem conexão com a sessão. Tentando de novo…' })
    const old = this.channel
    this.channel = null
    if (old) void supabase.removeChannel(old).catch(() => 'error')
    window.clearTimeout(this.retryTimer)
    const wait = Math.min(30_000, 1000 * 2 ** this.attempt) + Math.random() * 1000
    this.attempt++
    this.retryTimer = window.setTimeout(() => { void this.connect() }, wait)
  }

  private onTick() {
    if (this.disposed) return
    const now = Date.now()
    if (this.opts.isMaster) {
      // sinal de vida pros jogadores (e a sessão guardada fica fresca, pra continuar se a aba recarregar)
      if (this.opts.announce && this.snap.stage.liveId && !this.suspended && now - this.lastHeartbeat >= HEARTBEAT_MS) {
        this.lastHeartbeat = now
        this.sendState()
        saveResume(this.opts.campaignId, this.snap.stage)
      }
      return
    }
    if (!this.snap.live) return
    // o mestre saiu da página e não voltou: a sessão acaba pra este jogador
    if (this.awaySince && now - this.awaySince > AWAY_END_MS) {
      this.awaySince = 0
      this.report('VT-SALA-005', { vars: { s: Math.round(AWAY_END_MS / 1000) } })
      this.update({ stage: { ...this.snap.stage, liveId: null, away: false, scene: GAME_SCENE }, masterAway: false })
      return
    }
    // sem notícia do mestre há um tempo (caiu, ficou sem internet): avisa, mas a sessão continua
    const silent = now - this.lastStateAt > SILENT_MS
    if (silent !== this.snap.masterAway && !this.awaySince) this.update({ masterAway: silent })
  }

  /** Mestre saindo da página sem encerrar (recarregar, fechar a aba): os jogadores esperam ele voltar. */
  suspend(): void {
    if (this.disposed) return
    if (this.opts.isMaster && this.opts.announce && this.snap.stage.liveId) {
      this.suspended = true
      saveResume(this.opts.campaignId, this.snap.stage)
      this.send('state', { stage: { ...this.snap.stage, away: true } })
    }
    this.dispose()
  }

  dispose(): void {
    if (this.disposed) return
    // numa passagem (telinha ↔ página do Vortable) ou recarregando, a sessão continua no ar: não avisa que acabou
    if (this.opts.isMaster && !this.suspended && !peekHandoff(this.opts.campaignId)) {
      // (uma aba que só espelha a sessão de outra não encerra nada)
      if (this.snap.stage.liveId && this.opts.announce) {
        const ended = this.snap.stage.liveId
        this.snap = { ...this.snap, stage: EMPTY_STAGE, live: false }
        this.sendState()
        this.sendAviso('ended', { liveId: ended })
        if (this.opts.announce) saveResume(this.opts.campaignId, null)
      } else if (!this.snap.stage.liveId && this.snap.stage.document) {
        // o mestre saiu com um documento na mesa: ele some da tela de todos (senão ficaria preso lá)
        this.snap = { ...this.snap, stage: { ...this.snap.stage, document: null } }
        this.sendState()
      }
    }
    this.disposed = true
    window.clearInterval(this.timer)
    window.clearTimeout(this.retryTimer)
    if (this.channel) void supabase.removeChannel(this.channel).catch(() => 'error')
    if (this.aviso) void supabase.removeChannel(this.aviso).catch(() => 'error')
    this.channel = null
    this.aviso = null
    this.joined = false
    if (this.opts.report) vtResolve('sala')
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
      this.sendState()
      this.sendAviso('live', { liveId: stage.liveId, masterName: this.opts.name })
    } else {
      this.update({ stage: { ...this.snap.stage, liveId: null, scene: GAME_SCENE } })
      this.sendState()
      this.sendAviso('ended', { liveId })
    }
  }

  private setStage(patch: Partial<MesaStage>) {
    if (!this.opts.isMaster) return
    this.update({ stage: { ...this.snap.stage, ...patch } })
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

  private async connectAviso() {
    const topic = `mesa-aviso:${this.opts.campaignId}`
    const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`)
    if (stale) await supabase.removeChannel(stale).catch(() => 'error')
    if (this.disposed) return
    const aviso = supabase.channel(topic, {
      config: { private: true, broadcast: { self: false } },
    })
    this.aviso = aviso
    // Jogador que abriu o site agora pergunta se tem algo rolando.
    aviso.on('broadcast', { event: 'status?' }, () => {
      if (this.snap.stage.liveId) this.sendAviso('live', { liveId: this.snap.stage.liveId, masterName: this.opts.name })
    })
    aviso.subscribe((status) => {
      // voltou depois de cair no meio de uma sessão: avisa de novo quem está pelo site
      if (status === 'SUBSCRIBED' && this.snap.stage.liveId && !this.disposed) this.sendAviso('live', { liveId: this.snap.stage.liveId, masterName: this.opts.name })
    })
  }

  private sendAviso(event: 'live' | 'ended', payload: Payload) {
    if (!this.aviso) return
    void this.aviso.send({ type: 'broadcast', event, payload: { ...payload, campaignId: this.opts.campaignId } })
  }
}
