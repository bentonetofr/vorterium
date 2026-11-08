import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sent: Record<string, unknown>[] = []
const saved: { npcs: { id: string; x: number; y: number; dir: string }[] }[] = []
const zone = {
  id: 'z1', width: 40, height: 30,
  npcs: [
    { id: 'pess-a', name: 'Ana', role: '', appearance: { version: 2, slots: {} }, x: 100, y: 200, dir: 'down' },
    { id: 'anim-cavalo-preto-b', name: 'Cavalo', role: '', appearance: { version: 2, slots: {} }, x: 140, y: 200, dir: 'down' },
    { id: 'inim-corredor-c', name: 'Corredor', role: '', appearance: { version: 2, slots: {} }, x: 180, y: 200, dir: 'down' },
  ],
}

vi.mock('../enemies/enemies', () => ({
  broadcast: (_net: unknown, msg: Record<string, unknown>) => { sent.push(msg) },
  zoneStorage: async () => ({
    load: async () => structuredClone(zone),
    save: async (z: (typeof saved)[number]) => { saved.push(z) },
  }),
}))

import { ARRIVE_AT, FollowCrew, FOLLOW_WALK, npcKind, slotOffset, stepWalker, type Walker } from './follow'

const bounds = { w: 1280, h: 960 }
const walker = (over: Partial<Walker> = {}): Walker => ({ x: 100, y: 100, dir: 'down', moving: false, anim: 'idle', ...over })

describe('seguir um jogador: contas', () => {
  it('o tipo do NPC vem do id', () => {
    expect(npcKind('inim-corredor-x')).toBe('inimigo')
    expect(npcKind('anim-cavalo-preto-x')).toBe('animal')
    expect(npcKind('pess-x')).toBe('pessoa')
    expect(npcKind('npc-do-editor')).toBe('pessoa')
  })

  it('cada seguidor tem um lugar diferente em volta do jogador', () => {
    const spots = Array.from({ length: 30 }, (_, i) => slotOffset(i))
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        expect(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y)).toBeGreaterThan(8)
      }
    }
  })

  it('anda até o ponto, com a direção do movimento, e para ao chegar', () => {
    let w = walker()
    w = stepWalker(w, { x: 200, y: 100 }, null, 0.1, 50, bounds)
    expect(w).toMatchObject({ moving: true, anim: 'walk', dir: 'right' })
    expect(w.x).toBeCloseTo(100 + FOLLOW_WALK * 0.1, 5)
    for (let i = 0; i < 40; i++) w = stepWalker(w, { x: 200, y: 100 }, { x: 300, y: 100 }, 0.1, 50, bounds)
    expect(w).toMatchObject({ y: 100, moving: false, anim: 'idle', dir: 'right' })
    expect(Math.abs(200 - w.x)).toBeLessThanOrEqual(ARRIVE_AT)   // para a pouco antes do ponto
  })

  it('só volta a andar quando o jogador se afasta um pouco (sem tremer)', () => {
    const parked = walker({ x: 200, y: 100 })
    expect(stepWalker(parked, { x: 215, y: 100 }, null, 0.1, 40, bounds).moving).toBe(false)
    expect(stepWalker(parked, { x: 260, y: 100 }, null, 0.1, 40, bounds).moving).toBe(true)
  })

  it('corre quando o jogador está longe', () => {
    expect(stepWalker(walker(), { x: 600, y: 100 }, null, 0.1, 500, bounds).anim).toBe('run')
  })

  it('não sai dos limites da zona', () => {
    const w = stepWalker(walker({ x: 20, y: 40 }), { x: -500, y: -500 }, null, 1, 800, bounds)
    expect(w.x).toBeGreaterThanOrEqual(16)
    expect(w.y).toBeGreaterThanOrEqual(32)
  })

  it('sem jogador na zona, fica parado', () => {
    expect(stepWalker(walker({ moving: true, anim: 'walk' }), null, null, 0.1, 0, bounds)).toMatchObject({ moving: false, anim: 'idle' })
  })
})

describe('seguir um jogador: os NPCs na rede', () => {
  beforeEach(() => {
    sent.length = 0
    saved.length = 0
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date', 'performance'] })
    vi.stubGlobal('window', globalThis)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const options = (kinds = { pessoa: true, animal: true, inimigo: true }, target = { x: 500, y: 200, zone: 'z1' }) => ({
    campaignId: 'c', worldId: 'w', worldName: 'W', zoneId: 'z1', net: null, kinds, skip: [] as string[],
    target: { id: 'user-1', name: 'Gutris' },
    peers: () => [{ id: 'user-1', name: 'Gutris', zone: target.zone, x: target.x, y: target.y }],
  })

  it('anuncia cada NPC como um jogador, anda atrás do alvo e, ao parar, larga e grava onde ficaram', async () => {
    const crew = await FollowCrew.create(options())
    expect(crew.count).toBe(3)
    expect(sent.filter((m) => m.t === 'hello').map((m) => m.id)).toEqual(['npc:pess-a', 'npc:anim-cavalo-preto-b', 'npc:inim-corredor-c'])

    await vi.advanceTimersByTimeAsync(3000)
    const states = sent.filter((m) => m.t === 'state' && m.id === 'npc:pess-a')
    expect(states.length).toBeGreaterThan(5)
    const lastState = states[states.length - 1] as { x: number; zone: string }
    expect(lastState.zone).toBe('z1')
    expect(lastState.x).toBeGreaterThan(300)   // saiu de 100 em direção ao jogador, em 500

    await crew.stop()
    const moves = sent.filter((m) => m.t === 'npcmove')
    expect(moves).toHaveLength(3)
    expect(sent.filter((m) => m.t === 'bye').map((m) => m.id)).toEqual(['npc:pess-a', 'npc:anim-cavalo-preto-b', 'npc:inim-corredor-c'])
    // o npcmove sai antes do bye de cada um (o NPC parado já está no lugar quando aparece de novo)
    expect(sent.findIndex((m) => m.t === 'npcmove')).toBeLessThan(sent.findIndex((m) => m.t === 'bye'))
    const savedNpc = saved[saved.length - 1].npcs.find((n) => n.id === 'pess-a')!
    expect(savedNpc.x).toBeGreaterThan(300)
    expect(crew.running).toBe(false)
  })

  it('NPC montado segue montado: o hello leva o animal, e ao parar o npcmove devolve o animal pro NPC', async () => {
    const steed = { id: 'anim-lobo-artico-z', name: 'Gelo', role: 'Lobo', appearance: { version: 2, slots: {} } }
    zone.npcs.push({ id: 'pess-montado', name: 'Cavaleiro', role: '', appearance: { version: 2, slots: {} }, x: 220, y: 200, dir: 'down', steed } as never)
    try {
      const crew = await FollowCrew.create(options({ pessoa: true, animal: false, inimigo: false }))
      const hello = sent.find((m) => m.t === 'hello' && m.id === 'npc:pess-montado') as { mount?: { npc: string } } | undefined
      expect(hello?.mount?.npc).toBe('anim-lobo-artico-z')
      expect((sent.find((m) => m.t === 'hello' && m.id === 'npc:pess-a') as { mount?: unknown }).mount).toBeUndefined()
      await crew.stop()
      const move = sent.find((m) => m.t === 'npcmove' && m.id === 'pess-montado') as { steed?: { id: string }; saved?: boolean }
      expect(move.steed?.id).toBe('anim-lobo-artico-z')
      expect(move.saved).toBe(true)
      expect(saved[saved.length - 1].npcs.find((n) => n.id === 'pess-montado')).toMatchObject({ steed: { id: 'anim-lobo-artico-z' } })
    } finally {
      zone.npcs.pop()
    }
  })

  it('só os tipos marcados seguem', async () => {
    const crew = await FollowCrew.create(options({ pessoa: true, animal: false, inimigo: false }))
    expect(crew.count).toBe(1)
    expect(crew.has('pess-a')).toBe(true)
    expect(crew.has('inim-corredor-c')).toBe(false)
    await crew.stop()
  })

  it('jogador em outra zona: os NPCs esperam parados', async () => {
    const crew = await FollowCrew.create(options(undefined, { x: 500, y: 200, zone: 'z2' }))
    await vi.advanceTimersByTimeAsync(1000)
    expect(crew.info().state).toBe('away')
    expect(sent.filter((m) => m.t === 'state').every((m) => m.anim === 'idle')).toBe(true)
    await crew.stop()
  })

  it('soltar um NPC o deixa parado onde está e os outros continuam', async () => {
    const crew = await FollowCrew.create(options())
    await vi.advanceTimersByTimeAsync(500)
    await crew.release('pess-a')
    expect(crew.count).toBe(2)
    expect(crew.running).toBe(true)
    expect(sent.some((m) => m.t === 'bye' && m.id === 'npc:pess-a')).toBe(true)
    await crew.stop()
  })
})
