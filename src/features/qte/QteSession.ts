import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../shared/lib/supabase'
import { getMyAltheriumSheet } from '../sheets/altherium/services/altheriumSheetService'
import {
  QTE_COUNTDOWN_MS, QTE_IMPULSO_MAX, QTE_LIVES, QTE_MAX_RUN_MS, QTE_TOTAL,
  buildSequence, gapMs, judge, promptMs,
  type QtePrompt, type QteResult,
} from './qteEngine'

// ────────────────────────────────────────────────────────
// Cena a dois (quick time event) ao vivo. Tudo passa pelo canal privado
// "mesa:<campanha>:qte" (a policy da Mesa já vale: só olha o prefixo e o id
// da campanha, então só membros entram). Ninguém é "servidor": cada jogador
// roda a SUA partida no próprio navegador e manda o que acontece; quem
// assiste (e o outro jogador) só desenha. Quem abriu o painel organiza.
//
//   organizador → lobby   {game}              abriu o painel: todos são convidados a assistir
//   organizador → invite  {game}              escolheu o(s) parceiro(s): quem foi convidado aceita ou recusa
//   convidado   → accept  {g, u, name, impulso} / decline {g, u}
//   organizador → start   {g, players}        todos aceitaram: contagem regressiva
//   jogador     → p       {g, u, k, ...}      prompt / hit / miss: o que se vê na arena dele
//   jogador     → end     {g, u, result, ...} perdeu ou terminou
//   organizador → cancel  {g, note}
//   quem chega  → sync?                       organizador responde "state", jogadores "snap"
// ────────────────────────────────────────────────────────

export type QtePhase = 'lobby' | 'inviting' | 'countdown' | 'playing' | 'done' | 'cancelled'

export interface QteBoard {
  /** Letras já resolvidas (acertadas ou perdidas). */
  index:  number
  hits:   number
  lives:  number
  /** Letra na arena agora (`at` = quando apareceu, no relógio local). */
  prompt: { i: number; key: string; x: number; y: number; ms: number; at: number } | null
  /** O último acerto/falha, para o brilho (n muda a cada um, para reiniciar a animação). */
  flash:  { kind: 'hit' | 'miss'; why?: 'tempo' | 'tecla'; n: number } | null
  result: QteResult | null
}

export interface QtePlayer {
  uid:      string
  name:     string
  /** null = ainda não respondeu; false = recusou. */
  accepted: boolean | null
  impulso:  number
  board:    QteBoard
}

export interface QteGame {
  id:        string
  seed:      number
  organizer: { uid: string; name: string; master: boolean }
  phase:     QtePhase
  players:   QtePlayer[]
  /** Fim da contagem regressiva (relógio local). */
  countdownEnd: number | null
  /** Aviso de por que a cena acabou/cancelou. */
  note:      string | null
  winner:    string | null
  tie:       boolean
}

export interface QteSnapshot {
  game:         QteGame | null
  channelError: string | null
}

export const EMPTY_QTE: QteSnapshot = { game: null, channelError: null }

interface SessionOptions {
  campaignId: string
  userId:     string
  name:       string
  isMaster:   boolean
  onChange:   (snapshot: QteSnapshot) => void
}

type Payload = Record<string, unknown>

const freshBoard = (): QteBoard => ({ index: 0, hits: 0, lives: QTE_LIVES, prompt: null, flash: null, result: null })

const newGameId = () => crypto.randomUUID().slice(0, 8)
function newSeed(): number {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0] >>> 1
}

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const str = (v: unknown, max = 80) => (typeof v === 'string' ? v.slice(0, max) : '')
const clampImpulso = (v: number) => Math.min(QTE_IMPULSO_MAX, Math.max(0, Math.round(v)))

/** Tem uma cena em andamento (ainda não terminou nem foi cancelada)? */
export function isActive(game: QteGame | null): game is QteGame {
  return !!game && game.phase !== 'done' && game.phase !== 'cancelled'
}

export class QteSession {
  private readonly opts: SessionOptions
  private channel: RealtimeChannel | null = null
  private disposed = false
  private snap: QteSnapshot = EMPTY_QTE

  /** Eu aceitei participar da cena atual (esta aba). */
  private joined = false
  private sequence: QtePrompt[] = []
  private countdownTimer: number | undefined
  private promptTimer: number | undefined
  private gapTimer: number | undefined
  private safetyTimer: number | undefined
  private flashN = 0

  constructor(opts: SessionOptions) {
    this.opts = opts
  }

  get snapshot(): QteSnapshot {
    return this.snap
  }

  get me(): string {
    return this.opts.userId
  }

  private update(patch: Partial<QteSnapshot>) {
    if (this.disposed) return
    this.snap = { ...this.snap, ...patch }
    this.opts.onChange(this.snap)
  }

  private setGame(game: QteGame | null) {
    this.update({ game })
  }

  private patchGame(patch: Partial<QteGame>) {
    if (this.snap.game) this.setGame({ ...this.snap.game, ...patch })
  }

  private patchPlayer(uid: string, fn: (p: QtePlayer) => QtePlayer) {
    const game = this.snap.game
    if (!game) return
    this.setGame({ ...game, players: game.players.map((p) => (p.uid === uid ? fn(p) : p)) })
  }

  private send(event: string, payload: Payload = {}) {
    if (!this.channel) return
    void this.channel.send({ type: 'broadcast', event, payload })
  }

  // ── Ciclo de vida ──────────────────────────────────────

  async connect(): Promise<void> {
    await supabase.realtime.setAuth()
    if (this.disposed) return

    const channel = supabase.channel(`mesa:${this.opts.campaignId}:qte`, {
      config: { private: true, broadcast: { self: false } },
    })
    this.channel = channel
    const on = (event: string, handler: (p: Payload) => void) => {
      channel.on('broadcast', { event }, ({ payload }) => handler((payload ?? {}) as Payload))
    }
    on('lobby',   (p) => this.onLobby(p))
    on('invite',  (p) => this.onInvite(p))
    on('accept',  (p) => this.onAccept(p))
    on('decline', (p) => this.onDecline(p))
    on('start',   (p) => this.onStart(p))
    on('p',       (p) => this.onPlay(p))
    on('end',     (p) => this.onEnd(p))
    on('cancel',  (p) => this.onCancel(p))
    on('sync?',   () => this.onSyncRequest())
    on('state',   (p) => this.onState(p))
    on('snap',    (p) => this.onSnap(p))

    channel.subscribe((status) => {
      if (this.disposed) return
      if (status === 'SUBSCRIBED') {
        this.update({ channelError: null })
        // quem chega no meio de uma cena pergunta o que está rolando
        if (!this.snap.game) this.send('sync?')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.update({ channelError: 'Não foi possível conectar à cena. Recarregue a página e tente de novo.' })
      }
    })
  }

  dispose(): void {
    if (this.disposed) return
    const game = this.snap.game
    if (isActive(game)) {
      if (game.organizer.uid === this.me) this.send('cancel', { g: game.id, note: `${game.organizer.name} saiu da cena.` })
      else if (this.joined && game.phase === 'playing') this.finish('lost')
    }
    this.clearTimers()
    this.disposed = true
    if (this.channel) void supabase.removeChannel(this.channel)
    this.channel = null
  }

  private clearTimers() {
    window.clearTimeout(this.countdownTimer)
    window.clearTimeout(this.promptTimer)
    window.clearTimeout(this.gapTimer)
    window.clearTimeout(this.safetyTimer)
  }

  // ── Organizador ────────────────────────────────────────

  /** Abriu o painel: avisa todo mundo (que pode ir assistir). Devolve um motivo se não deu. */
  openLobby(): string | null {
    const cur = this.snap.game
    if (isActive(cur)) {
      // painel reaberto: segue o mesmo convite
      if (cur.phase === 'lobby' && cur.organizer.uid === this.me) { this.send('lobby', { game: this.meta(cur) }); return null }
      return 'Já tem uma cena em andamento nesta campanha.'
    }
    const game: QteGame = {
      id: newGameId(), seed: newSeed(),
      organizer: { uid: this.me, name: this.opts.name, master: this.opts.isMaster },
      phase: 'lobby', players: [], countdownEnd: null, note: null, winner: null, tie: false,
    }
    this.joined = false
    this.setGame(game)
    this.send('lobby', { game: this.meta(game) })
    return null
  }

  /** Fechou o painel sem iniciar. */
  closeLobby(): void {
    const game = this.snap.game
    if (!game || game.phase !== 'lobby' || game.organizer.uid !== this.me) return
    this.send('cancel', { g: game.id, note: '' })
    this.setGame(null)
  }

  /**
   * Iniciar: o organizador (se for jogador) entra na cena e convida os
   * parceiros. Sem parceiro, começa na hora. Os convidados precisam aceitar.
   */
  async begin(partners: { uid: string; name: string }[], asPlayer: boolean): Promise<string | null> {
    const game = this.snap.game
    if (!game || game.phase !== 'lobby' || game.organizer.uid !== this.me) return 'Abra o painel de novo.'
    const max = asPlayer ? 1 : 2
    const list = partners.filter((p) => p.uid !== this.me).slice(0, max)
    if (!asPlayer && list.length === 0) return 'Escolha pelo menos um jogador.'

    const players: QtePlayer[] = []
    if (asPlayer) {
      const mine = await this.myProfile()
      players.push({ uid: this.me, name: mine.name, accepted: true, impulso: mine.impulso, board: freshBoard() })
      this.joined = true
    }
    for (const p of list) players.push({ uid: p.uid, name: p.name, accepted: null, impulso: 0, board: freshBoard() })

    const next: QteGame = { ...game, phase: 'inviting', players }
    this.setGame(next)
    this.send('invite', { game: this.meta(next) })
    if (players.every((p) => p.accepted)) this.startGame()
    return null
  }

  /** Organizador cancela (antes de acabar). */
  cancel(note = ''): void {
    const game = this.snap.game
    if (!isActive(game) || game.organizer.uid !== this.me) return
    this.send('cancel', { g: game.id, note })
    this.applyCancel(note)
  }

  private startGame() {
    const game = this.snap.game
    if (!game) return
    const players = game.players.map((p) => ({ uid: p.uid, name: p.name, impulso: p.impulso }))
    this.send('start', { g: game.id, players })
    this.applyStart(players)
  }

  // ── Convidado ──────────────────────────────────────────

  async accept(): Promise<void> {
    const game = this.snap.game
    if (!game || game.phase !== 'inviting') return
    const mine = game.players.find((p) => p.uid === this.me)
    if (!mine || mine.accepted !== null) return
    const profile = await this.myProfile()
    this.joined = true
    this.patchPlayer(this.me, (p) => ({ ...p, accepted: true, impulso: profile.impulso, name: profile.name }))
    this.send('accept', { g: game.id, u: this.me, name: profile.name, impulso: profile.impulso })
  }

  decline(): void {
    const game = this.snap.game
    if (!game || game.phase !== 'inviting') return
    this.patchPlayer(this.me, (p) => ({ ...p, accepted: false }))
    this.send('decline', { g: game.id, u: this.me })
  }

  /** Nome do personagem e Impulso da ficha de Altherium (sem ficha: nome da conta e Impulso 0). */
  private async myProfile(): Promise<{ name: string; impulso: number }> {
    try {
      const sheet = await getMyAltheriumSheet(this.opts.campaignId)
      if (sheet) {
        return {
          name:    sheet.character_name?.trim() || this.opts.name,
          impulso: clampImpulso(sheet.attr_impulso ?? 0),
        }
      }
    } catch { /* sem ficha lida: joga com o Impulso 0 */ }
    return { name: this.opts.name, impulso: 0 }
  }

  // ── Eventos que chegam ─────────────────────────────────

  private meta(game: QteGame): Payload {
    return {
      id: game.id, seed: game.seed, organizer: game.organizer, phase: game.phase,
      players: game.players.map((p) => ({ uid: p.uid, name: p.name, accepted: p.accepted, impulso: p.impulso })),
    }
  }

  private parseMeta(value: unknown): QteGame | null {
    if (typeof value !== 'object' || value === null) return null
    const m = value as Payload
    const org = (m.organizer ?? {}) as Payload
    const id = str(m.id, 20)
    const orgUid = str(org.uid, 60)
    if (!id || !orgUid) return null
    const players = (Array.isArray(m.players) ? m.players : []).slice(0, 2).map((raw): QtePlayer => {
      const p = (raw ?? {}) as Payload
      return {
        uid: str(p.uid, 60), name: str(p.name, 60) || 'Jogador',
        accepted: typeof p.accepted === 'boolean' ? p.accepted : null,
        impulso: clampImpulso(num(p.impulso)), board: freshBoard(),
      }
    }).filter((p) => p.uid)
    return {
      id, seed: num(m.seed), organizer: { uid: orgUid, name: str(org.name, 60) || 'Alguém', master: org.master === true },
      phase: m.phase === 'inviting' ? 'inviting' : 'lobby', players, countdownEnd: null, note: null, winner: null, tie: false,
    }
  }

  private onLobby(p: Payload) {
    const game = this.parseMeta(p.game)
    if (!game || isActive(this.snap.game)) return
    this.joined = false
    this.setGame({ ...game, phase: 'lobby' })
  }

  private onInvite(p: Payload) {
    const game = this.parseMeta(p.game)
    if (!game) return
    const cur = this.snap.game
    if (isActive(cur) && cur.id !== game.id) return
    this.joined = false
    this.setGame({ ...game, phase: 'inviting' })
  }

  private onAccept(p: Payload) {
    const game = this.snap.game
    if (!game || str(p.g, 20) !== game.id) return
    const uid = str(p.u, 60)
    this.patchPlayer(uid, (pl) => ({ ...pl, accepted: true, name: str(p.name, 60) || pl.name, impulso: clampImpulso(num(p.impulso)) }))
    const now = this.snap.game
    if (now && now.organizer.uid === this.me && now.phase === 'inviting' && now.players.every((pl) => pl.accepted === true)) this.startGame()
  }

  private onDecline(p: Payload) {
    const game = this.snap.game
    if (!game || str(p.g, 20) !== game.id) return
    const who = game.players.find((pl) => pl.uid === str(p.u, 60))
    this.patchPlayer(str(p.u, 60), (pl) => ({ ...pl, accepted: false }))
    if (game.organizer.uid === this.me) this.cancel(`${who?.name ?? 'O convidado'} recusou o convite.`)
  }

  private onStart(p: Payload) {
    const game = this.snap.game
    if (!game || str(p.g, 20) !== game.id) return
    const list = (Array.isArray(p.players) ? p.players : []).map((raw) => {
      const r = (raw ?? {}) as Payload
      return { uid: str(r.uid, 60), name: str(r.name, 60) || 'Jogador', impulso: clampImpulso(num(r.impulso)) }
    }).filter((r) => r.uid).slice(0, 2)
    this.applyStart(list)
  }

  private applyStart(list: { uid: string; name: string; impulso: number }[]) {
    const game = this.snap.game
    if (!game || list.length === 0) return
    this.clearTimers()
    this.sequence = buildSequence(game.seed)
    const end = performance.now() + QTE_COUNTDOWN_MS
    this.setGame({
      ...game, phase: 'countdown', countdownEnd: end,
      players: list.map((l) => ({ uid: l.uid, name: l.name, impulso: l.impulso, accepted: true, board: freshBoard() })),
    })
    this.countdownTimer = window.setTimeout(() => this.beginPlaying(), QTE_COUNTDOWN_MS)
  }

  private beginPlaying() {
    const game = this.snap.game
    if (!game || game.phase !== 'countdown') return
    this.patchGame({ phase: 'playing' })
    // alguém que sumiu sem avisar não prende a cena: passado o tempo máximo de uma partida, quem não terminou perdeu
    this.safetyTimer = window.setTimeout(() => {
      const g = this.snap.game
      if (!g || g.phase !== 'playing') return
      this.setGame({ ...g, players: g.players.map((p) => (p.board.result ? p : { ...p, board: { ...p.board, prompt: null, result: 'lost' as const } })) })
      this.checkDone()
    }, QTE_MAX_RUN_MS)
    if (this.joined && game.players.some((p) => p.uid === this.me)) this.nextPrompt()
  }

  private onCancel(p: Payload) {
    const game = this.snap.game
    if (!game || str(p.g, 20) !== game.id) return
    const note = str(p.note, 160)
    // o lobby que ninguém iniciou some sem barulho
    if (game.phase === 'lobby' && !note) { this.clearTimers(); this.joined = false; this.setGame(null); return }
    this.applyCancel(note)
  }

  private applyCancel(note: string) {
    this.clearTimers()
    this.joined = false
    this.patchGame({ phase: 'cancelled', note: note || 'A cena foi cancelada.' })
  }

  // ── A minha partida ────────────────────────────────────

  private nextPrompt() {
    const game = this.snap.game
    if (!game || game.phase !== 'playing') return
    const mine = game.players.find((p) => p.uid === this.me)
    if (!mine || mine.board.result) return
    const i = mine.board.index
    if (i >= QTE_TOTAL) { this.finish('cleared'); return }
    const seq = this.sequence[i]
    const ms = promptMs(i, mine.impulso)
    const prompt = { i, key: seq.key, x: seq.x, y: seq.y, ms, at: performance.now() }
    this.patchPlayer(this.me, (p) => ({ ...p, board: { ...p.board, prompt } }))
    this.send('p', { g: game.id, u: this.me, k: 'prompt', i, key: seq.key, x: seq.x, y: seq.y, ms })
    window.clearTimeout(this.promptTimer)
    this.promptTimer = window.setTimeout(() => this.resolve(false, 'tempo'), ms)
  }

  /** Tecla apertada (ou letra tocada). */
  press(key: string): void {
    const game = this.snap.game
    if (!game || game.phase !== 'playing' || !this.joined) return
    const mine = game.players.find((p) => p.uid === this.me)
    const prompt = mine?.board.prompt
    if (!mine || !prompt || mine.board.result) return
    this.resolve(key.toUpperCase() === prompt.key, 'tecla')
  }

  private resolve(ok: boolean, why: 'tempo' | 'tecla') {
    const game = this.snap.game
    if (!game) return
    const mine = game.players.find((p) => p.uid === this.me)
    if (!mine || !mine.board.prompt || mine.board.result) return
    window.clearTimeout(this.promptTimer)
    const i = mine.board.prompt.i
    const hits = mine.board.hits + (ok ? 1 : 0)
    const lives = mine.board.lives - (ok ? 0 : 1)
    this.flashN += 1
    const flash = { kind: ok ? 'hit' as const : 'miss' as const, why: ok ? undefined : why, n: this.flashN }
    this.patchPlayer(this.me, (p) => ({ ...p, board: { ...p.board, hits, lives, index: i + 1, prompt: null, flash } }))
    this.send('p', { g: game.id, u: this.me, k: ok ? 'hit' : 'miss', i, hits, lives, why })
    if (lives <= 0) { this.finish('lost'); return }
    if (i + 1 >= QTE_TOTAL) { this.finish('cleared'); return }
    window.clearTimeout(this.gapTimer)
    this.gapTimer = window.setTimeout(() => this.nextPrompt(), gapMs(i))
  }

  /** Desistir no meio (fechar a arena jogando). */
  forfeit(): void {
    const game = this.snap.game
    if (game?.phase === 'playing' && this.joined) this.finish('lost')
  }

  private finish(result: QteResult) {
    const game = this.snap.game
    if (!game) return
    const mine = game.players.find((p) => p.uid === this.me)
    if (!mine || mine.board.result) return
    window.clearTimeout(this.promptTimer)
    window.clearTimeout(this.gapTimer)
    this.patchPlayer(this.me, (p) => ({ ...p, board: { ...p.board, prompt: null, result } }))
    this.send('end', { g: game.id, u: this.me, result, hits: mine.board.hits, lives: mine.board.lives })
    this.checkDone()
  }

  // ── A partida dos outros ───────────────────────────────

  private onPlay(p: Payload) {
    const game = this.snap.game
    if (!game || str(p.g, 20) !== game.id) return
    const uid = str(p.u, 60)
    if (uid === this.me) return
    const k = str(p.k, 10)
    if (k === 'prompt') {
      const prompt = { i: num(p.i), key: str(p.key, 2).toUpperCase(), x: num(p.x, 0.5), y: num(p.y, 0.5), ms: Math.max(100, num(p.ms, 1000)), at: performance.now() }
      this.patchPlayer(uid, (pl) => ({ ...pl, board: { ...pl.board, prompt } }))
    } else if (k === 'hit' || k === 'miss') {
      this.flashN += 1
      const flash = { kind: k as 'hit' | 'miss', why: p.why === 'tempo' ? 'tempo' as const : p.why === 'tecla' ? 'tecla' as const : undefined, n: this.flashN }
      this.patchPlayer(uid, (pl) => ({
        ...pl, board: { ...pl.board, prompt: null, flash, index: num(p.i) + 1, hits: num(p.hits, pl.board.hits), lives: num(p.lives, pl.board.lives) },
      }))
    }
  }

  private onEnd(p: Payload) {
    const game = this.snap.game
    if (!game || str(p.g, 20) !== game.id) return
    const uid = str(p.u, 60)
    if (uid === this.me) return
    const result: QteResult = p.result === 'cleared' ? 'cleared' : 'lost'
    this.patchPlayer(uid, (pl) => ({
      ...pl, board: { ...pl.board, prompt: null, result, hits: num(p.hits, pl.board.hits), lives: num(p.lives, pl.board.lives) },
    }))
    this.checkDone()
  }

  private checkDone() {
    const game = this.snap.game
    if (!game || (game.phase !== 'playing' && game.phase !== 'countdown')) return
    if (!game.players.every((p) => p.board.result)) return
    const verdict = judge(game.players.map((p) => ({ uid: p.uid, result: p.board.result!, hits: p.board.hits, lives: p.board.lives })))
    this.clearTimers()
    this.patchGame({ phase: 'done', winner: verdict.winner, tie: verdict.tie })
  }

  // ── Quem chega no meio ─────────────────────────────────

  private onSyncRequest() {
    const game = this.snap.game
    if (!isActive(game)) return
    if (game.organizer.uid === this.me) {
      this.send('state', { game: this.meta(game), phase: game.phase, boards: game.players.map((p) => ({ uid: p.uid, ...this.boardWire(p.board) })) })
    } else if (this.joined && game.phase === 'playing') {
      const mine = game.players.find((p) => p.uid === this.me)
      if (mine) this.send('snap', { g: game.id, u: this.me, ...this.boardWire(mine.board) })
    }
  }

  private boardWire(b: QteBoard): Payload {
    return { index: b.index, hits: b.hits, lives: b.lives, result: b.result }
  }

  private onState(p: Payload) {
    if (this.snap.game) return
    const game = this.parseMeta(p.game)
    if (!game) return
    const phase = str(p.phase, 12)
    const boards = Array.isArray(p.boards) ? p.boards : []
    const players = game.players.map((pl) => {
      const b = (boards.find((x) => (x as Payload)?.uid === pl.uid) ?? {}) as Payload
      return { ...pl, board: { ...pl.board, index: num(b.index), hits: num(b.hits), lives: num(b.lives, QTE_LIVES), result: b.result === 'cleared' ? 'cleared' as const : b.result === 'lost' ? 'lost' as const : null } }
    })
    this.joined = false
    this.setGame({ ...game, players, phase: phase === 'playing' || phase === 'countdown' || phase === 'inviting' ? phase : 'lobby' })
  }

  private onSnap(p: Payload) {
    const game = this.snap.game
    if (!game || str(p.g, 20) !== game.id) return
    const uid = str(p.u, 60)
    if (uid === this.me) return
    this.patchPlayer(uid, (pl) => ({
      ...pl, board: { ...pl.board, index: num(p.index), hits: num(p.hits), lives: num(p.lives, QTE_LIVES), result: p.result === 'cleared' ? 'cleared' : p.result === 'lost' ? 'lost' : null },
    }))
  }

  // ── Fechar o resultado ─────────────────────────────────

  /** Depois de ver o fim (ou o cancelamento), limpa para uma cena nova. */
  clear(): void {
    const game = this.snap.game
    if (game && !isActive(game)) { this.joined = false; this.setGame(null) }
  }
}
