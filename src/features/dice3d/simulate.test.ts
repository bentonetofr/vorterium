import { describe, expect, it } from 'vitest'
import { DIE_KINDS, polyhedron, upIndex, type Quat } from './polyhedra'
import { DIE_RADIUS, seededRandom, simulateThrow } from './simulate'

const arena = { halfW: 7, halfD: 4.5 }

function last(frames: Float32Array, steps: number) {
  const o = (steps - 1) * 7
  return { pos: [frames[o], frames[o + 1], frames[o + 2]], q: [frames[o + 3], frames[o + 4], frames[o + 5], frames[o + 6]] as Quat }
}

describe('física do lançamento', () => {
  it('semente igual, lançamento igual', () => {
    const a = seededRandom(42), b = seededRandom(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    const s1 = simulateThrow(['d20', 'd6'], { arena, style: 'tray', seed: 7 })
    const s2 = simulateThrow(['d20', 'd6'], { arena, style: 'tray', seed: 7 })
    expect(s1.up).toEqual(s2.up)
    expect(s1.steps).toBe(s2.steps)
  })

  it.each(DIE_KINDS)('%s cai, para dentro da bandeja e deita numa face', (kind) => {
    for (const seed of [1, 2, 3]) {
      const sim = simulateThrow([kind], { arena, style: 'tray', seed })
      const end = last(sim.frames[0], sim.steps)
      const r = DIE_RADIUS[kind]
      expect(Math.abs(end.pos[0]), `${kind} x`).toBeLessThan(arena.halfW)
      expect(Math.abs(end.pos[2]), `${kind} z`).toBeLessThan(arena.halfD)
      expect(end.pos[1], `${kind} altura`).toBeLessThan(r * 1.05)
      expect(end.pos[1], `${kind} altura`).toBeGreaterThan(0)
      expect(sim.up[0]).toBe(upIndex(polyhedron(kind), end.q))
    }
  })

  it('vários dados juntos param, batem e fazem barulho', () => {
    const kinds = ['d6', 'd6', 'd6', 'd6', 'd6', 'd6', 'd6', 'd6'] as const
    const sim = simulateThrow(kinds, { arena, style: 'tray', seed: 99 })
    expect(sim.frames).toHaveLength(8)
    expect(sim.up).toHaveLength(8)
    expect(sim.steps).toBeGreaterThan(30)
    expect(sim.impacts.length).toBeGreaterThan(4)
    expect(sim.impacts.some((i) => i.withDie)).toBe(true)
  })

  it('o d20 do painel (palco) também para dentro da moldura', () => {
    for (const seed of [5, 6, 7, 8]) {
      const sim = simulateThrow(['d20'], { arena: { halfW: 3, halfD: 2.4 }, style: 'stage', seed })
      const end = last(sim.frames[0], sim.steps)
      expect(Math.abs(end.pos[0])).toBeLessThan(3)
      expect(Math.abs(end.pos[2])).toBeLessThan(2.4)
    }
  })
})
