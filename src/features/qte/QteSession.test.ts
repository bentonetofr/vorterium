import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Uma rede de mentira: todo canal "mesa:<campanha>:qte" entrega o broadcast aos
// OUTROS canais do mesmo nome (self: false), como o Realtime do Supabase.
type Handler = (msg: { payload: unknown }) => void
interface FakeChannel {
  on: (type: string, filter: { event: string }, cb: Handler) => FakeChannel
  subscribe: (cb: (status: string) => void) => FakeChannel
  send: (msg: { event: string; payload: unknown }) => Promise<void>
}
const bus = new Set<{ ch: FakeChannel; handlers: Map<string, Handler> }>()

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    realtime: { setAuth: async () => {} },
    channel: () => {
      const handlers = new Map<string, Handler>()
      const ch: FakeChannel = {
        on: (_t, filter, cb) => { handlers.set(filter.event, cb); return ch },
        subscribe: (cb) => { bus.add(entry); queueMicrotask(() => cb('SUBSCRIBED')); return ch },
        send: async (msg) => {
          for (const other of bus) if (other !== entry) other.handlers.get(msg.event)?.({ payload: structuredClone(msg.payload) })
        },
      }
      const entry = { ch, handlers }
      return ch
    },
    removeChannel: async () => {},
  },
}))

const impulsos: Record<string, number> = { ana: 10, bia: 0 }
vi.mock('../sheets/altherium/services/altheriumSheetService', () => ({
  getMyAltheriumSheet: async () => ({ character_name: null, attr_impulso: impulsos[currentUser] ?? 0 }),
}))
let currentUser = ''

import { QteSession, type QteSnapshot } from './QteSession'
import { QTE_COUNTDOWN_MS, QTE_LIVES, buildSequence, promptMs } from './qteEngine'

function make(userId: string, name: string, isMaster = false) {
  let snap: QteSnapshot = { game: null, channelError: null }
  // o Impulso é lido na hora do aceite, em nome de quem está agindo
  const session = new QteSession({ campaignId: 'c1', userId, name, isMaster, onChange: (s) => { snap = s } })
  return { session, get: () => snap, act: async <T>(fn: () => Promise<T> | T) => { currentUser = userId; return fn() } }
}

describe('Cena a dois: rede', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    bus.clear()
    ;(globalThis as unknown as { window: unknown }).window = globalThis
  })
  afterEach(() => { vi.useRealTimers() })

  it('o mestre chama dois jogadores, eles aceitam, jogam e o outro assiste', async () => {
    const master = make('mestre', 'Mestre', true)
    const ana = make('ana', 'Ana')
    const bia = make('bia', 'Bia')
    const dan = make('dan', 'Dan') // só assiste
    for (const p of [master, ana, bia, dan]) await p.session.connect()
    await vi.advanceTimersByTimeAsync(5)

    // abrir o painel chama todo mundo
    expect(master.session.openLobby()).toBeNull()
    for (const p of [ana, bia, dan]) expect(p.get().game?.phase).toBe('lobby')

    // o mestre inicia com Ana e Bia
    expect(await master.act(() => master.session.begin([{ uid: 'ana', name: 'Ana' }, { uid: 'bia', name: 'Bia' }], false))).toBeNull()
    expect(dan.get().game?.phase).toBe('inviting')
    expect(ana.get().game?.players.find((x) => x.uid === 'ana')?.accepted).toBeNull()

    await ana.act(() => ana.session.accept())
    expect(master.get().game?.phase).toBe('inviting') // falta a Bia
    await bia.act(() => bia.session.accept())
    await vi.advanceTimersByTimeAsync(1)
    for (const p of [master, ana, bia, dan]) expect(p.get().game?.phase).toBe('countdown')
    expect(master.get().game?.players.map((x) => x.impulso)).toEqual([10, 0])

    await vi.advanceTimersByTimeAsync(QTE_COUNTDOWN_MS + 5)
    for (const p of [master, ana, bia, dan]) expect(p.get().game?.phase).toBe('playing')

    // a primeira letra aparece nas duas arenas, igual para todos (o tempo muda com o Impulso)
    const first = buildSequence(ana.get().game!.seed)[0]
    for (const p of [master, ana, bia, dan]) {
      const boards = p.get().game!.players
      expect(boards[0].board.prompt?.key).toBe(first.key)
      expect(boards[1].board.prompt?.key).toBe(first.key)
      expect(boards[0].board.prompt?.ms).toBe(promptMs(0, 10))
      expect(boards[1].board.prompt?.ms).toBe(promptMs(0, 0))
    }

    // Ana acerta; o espectador vê o acerto
    ana.session.press(first.key)
    expect(dan.get().game!.players[0].board.hits).toBe(1)
    expect(dan.get().game!.players[0].board.prompt).toBeNull()

    // Bia erra a tecla três vezes e cai; Ana segue
    for (let n = 0; n < QTE_LIVES; n++) {
      bia.session.press('Ç') // tecla que nunca é a pedida
      await vi.advanceTimersByTimeAsync(600)
    }
    expect(dan.get().game!.players[1].board.result).toBe('lost')
    expect(dan.get().game!.players[1].board.lives).toBe(0)
    expect(dan.get().game?.phase).toBe('playing') // Ana ainda joga

    // Ana desiste: termina para todos, Bia (que fez 0 acertos) perde para ela? Ana também perdeu, com mais acertos
    ana.session.forfeit()
    for (const p of [master, ana, bia, dan]) {
      expect(p.get().game?.phase).toBe('done')
      expect(p.get().game?.winner).toBe('ana')
    }
  })

  it('o mestre joga contra um jogador, com o Impulso que escolheu', async () => {
    const master = make('mestre', 'Mestre', true)
    const ana = make('ana', 'Ana')
    const dan = make('dan', 'Dan')
    for (const p of [master, ana, dan]) await p.session.connect()
    await vi.advanceTimersByTimeAsync(5)

    master.session.openLobby()
    expect(await master.act(() => master.session.begin([{ uid: 'ana', name: 'Ana' }], true, { impulso: 7 }))).toBeNull()
    expect(master.get().game?.players.find((p) => p.uid === 'mestre')?.accepted).toBe(true)
    await ana.act(() => ana.session.accept())
    await vi.advanceTimersByTimeAsync(QTE_COUNTDOWN_MS + 5)

    for (const p of [master, ana, dan]) expect(p.get().game?.phase).toBe('playing')
    const players = dan.get().game!.players
    expect(players.map((p) => p.impulso)).toEqual([7, 10])
    expect(players[0].board.prompt?.ms).toBe(promptMs(0, 7))

    // o mestre acerta e o espectador vê
    master.session.press(buildSequence(master.get().game!.seed)[0].key)
    expect(dan.get().game!.players[0].board.hits).toBe(1)
    expect(ana.get().game!.players[0].board.hits).toBe(1)
  })

  it('o mestre pode jogar sozinho', async () => {
    const master = make('mestre', 'Mestre', true)
    const dan = make('dan', 'Dan')
    for (const p of [master, dan]) await p.session.connect()
    await vi.advanceTimersByTimeAsync(5)
    master.session.openLobby()
    await master.act(() => master.session.begin([], true, { impulso: 3 }))
    await vi.advanceTimersByTimeAsync(QTE_COUNTDOWN_MS + 5)
    expect(master.get().game?.phase).toBe('playing')
    expect(master.get().game?.players).toHaveLength(1)
    expect(dan.get().game?.players[0].impulso).toBe(3)
  })

  it('quem recusa cancela a cena para todos', async () => {
    const ana = make('ana', 'Ana')
    const bia = make('bia', 'Bia')
    const dan = make('dan', 'Dan')
    for (const p of [ana, bia, dan]) await p.session.connect()
    await vi.advanceTimersByTimeAsync(5)
    ana.session.openLobby()
    await ana.act(() => ana.session.begin([{ uid: 'bia', name: 'Bia' }], true))
    expect(ana.get().game?.players.find((x) => x.uid === 'ana')?.accepted).toBe(true)
    bia.session.decline()
    for (const p of [ana, bia, dan]) expect(p.get().game?.phase).toBe('cancelled')
    expect(dan.get().game?.note).toContain('Bia recusou')
  })

  it('sozinho começa na hora e fechar o painel antes some o convite', async () => {
    const ana = make('ana', 'Ana')
    const dan = make('dan', 'Dan')
    for (const p of [ana, dan]) await p.session.connect()
    await vi.advanceTimersByTimeAsync(5)
    ana.session.openLobby()
    expect(dan.get().game?.phase).toBe('lobby')
    ana.session.closeLobby()
    expect(dan.get().game).toBeNull()

    ana.session.openLobby()
    await ana.act(() => ana.session.begin([], true))
    await vi.advanceTimersByTimeAsync(1)
    expect(dan.get().game?.phase).toBe('countdown')
    expect(ana.get().game?.players).toHaveLength(1)
  })

  it('só uma cena por vez e quem chega no meio recebe o estado', async () => {
    const ana = make('ana', 'Ana')
    const bia = make('bia', 'Bia')
    await ana.session.connect()
    await bia.session.connect()
    await vi.advanceTimersByTimeAsync(5)
    ana.session.openLobby()
    expect(bia.session.openLobby()).toContain('andamento')

    const late = make('dan', 'Dan')
    await late.session.connect()
    await vi.advanceTimersByTimeAsync(5)
    expect(late.get().game?.phase).toBe('lobby')
    expect(late.get().game?.organizer.name).toBe('Ana')
  })
})
