import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { MAX_CAMERA_SCALE, fitCamera } from './camera'
import { DIE_KINDS, polyhedron, upIndex, type Quat } from './polyhedra'
import { DIE_RADIUS, badDice, restHeight, seededRandom, simulateThrow } from './simulate'

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

  it('nenhum dado termina torto, em cima de outro ou atravessando outro', () => {
    const wide = { halfW: 5.2, halfD: 3.2 }
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      const kinds = ['d20', 'd6', 'd6', 'd8', 'd12'] as const
      const sim = simulateThrow(kinds, { arena: wide, style: 'wide', seed })
      expect(badDice(kinds, sim), `5 dados, semente ${seed}`).toBe(0)
    }
    for (const seed of [21, 22, 23, 24]) {
      const kinds = ['d6', 'd6', 'd6', 'd6', 'd6', 'd6', 'd6', 'd6'] as const
      const sim = simulateThrow(kinds, { arena, style: 'tray', seed })
      expect(badDice(kinds, sim), `8 d6, semente ${seed}`).toBe(0)
    }
  })

  it.each(DIE_KINDS)('o %s sozinho sempre termina deitado numa face', (kind) => {
    for (const seed of [31, 32, 33, 34, 35, 36, 37, 38]) {
      const sim = simulateThrow([kind], { arena: { halfW: 3, halfD: 2.4 }, style: 'stage', seed })
      expect(badDice([kind], sim), `${kind} semente ${seed}`).toBe(0)
      expect(restHeight(kind)).toBeGreaterThan(0)
    }
  })

  it('a conferência pega dado torto e dado em cima de outro', () => {
    const steps = 2
    const frames = (x: number, y: number, z: number, q: number[]) => new Float32Array([x, y, z, ...q, x, y, z, ...q])
    const flat = [0, 0, 0, 1]
    const h = restHeight('d6')
    const ok = { steps, frames: [frames(0, h, 0, flat), frames(5, h, 0, flat)], up: [0, 0], impacts: [], settled: true }
    const poly = polyhedron('d6')
    const upIdx = (q: Quat) => upIndex(poly, q)
    ok.up = [upIdx([0, 0, 0, 1]), upIdx([0, 0, 0, 1])]
    expect(badDice(['d6', 'd6'], ok)).toBe(0)
    const stacked = { ...ok, frames: [frames(0, h, 0, flat), frames(0.2, h * 3, 0, flat)] }
    expect(badDice(['d6', 'd6'], stacked)).toBe(1)
    const tilt = Math.sin((20 * Math.PI) / 180 / 2)
    const tilted = { ...ok, frames: [frames(0, h, 0, [tilt, 0, 0, Math.cos((20 * Math.PI) / 180 / 2)]), frames(5, h, 0, flat)] }
    expect(badDice(['d6', 'd6'], { ...tilted, up: [upIdx([tilt, 0, 0, Math.cos((20 * Math.PI) / 180 / 2)]), ok.up[1]] })).toBe(1)
  })

  it('com muitos dados a câmera se afasta e todos terminam planos e separados', () => {
    const cam = new THREE.PerspectiveCamera(30, 704 / 480, 0.1, 200)
    const sizes: number[] = []
    for (const n of [1, 10, 50, 100]) {
      const { scale, arena } = fitCamera(cam, n, 1.7)
      sizes.push(scale)
      if (n === 1) expect(scale).toBe(1)
      if (n > 50) continue
      const kinds = Array.from({ length: n }, (_, i) => (['d20', 'd6', 'd8', 'd12', 'd10', 'd4'] as const)[i % 6])
      let ok = 0
      for (const seed of [41, 42, 43]) ok += badDice(kinds, simulateThrow(kinds, { arena, style: 'wide', seed })) === 0 ? 1 : 0
      expect(ok, `${n} dados`).toBeGreaterThanOrEqual(2)
    }
    expect(sizes[0]).toBeLessThan(sizes[1])
    expect(sizes[1]).toBeLessThan(sizes[2])
    expect(sizes[2]).toBeLessThan(sizes[3])
    expect(sizes[3]).toBeLessThanOrEqual(MAX_CAMERA_SCALE)
  }, 60000)
})
