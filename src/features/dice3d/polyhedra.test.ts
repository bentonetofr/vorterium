import { describe, expect, it } from 'vitest'
import {
  DIE_KINDS, alignment, centroid, labelForValue, labelText, mulMV, polyhedron, quatFromM3, rotate, upIndex,
  type DieKind, type M3, type Quat, type V3,
} from './polyhedra'

const SHAPE: Record<DieKind, { faces: number; vertices: number; symmetries: number }> = {
  d4:   { faces: 4,  vertices: 4,  symmetries: 12 },
  d6:   { faces: 6,  vertices: 8,  symmetries: 24 },
  d8:   { faces: 8,  vertices: 6,  symmetries: 24 },
  d10:  { faces: 10, vertices: 12, symmetries: 10 },
  d100: { faces: 100, vertices: 196, symmetries: 1 },
  d12:  { faces: 12, vertices: 20, symmetries: 60 },
  d20:  { faces: 20, vertices: 12, symmetries: 60 },
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const mulQ = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
function randomQuat(seed: number): Quat {
  let s = seed
  const r = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
  const u1 = r(), u2 = r(), u3 = r()
  return [Math.sqrt(1 - u1) * Math.sin(2 * Math.PI * u2), Math.sqrt(1 - u1) * Math.cos(2 * Math.PI * u2), Math.sqrt(u1) * Math.sin(2 * Math.PI * u3), Math.sqrt(u1) * Math.cos(2 * Math.PI * u3)]
}

describe('sólidos dos dados', () => {
  it.each(DIE_KINDS)('%s tem as faces, vértices e simetrias certos', (kind) => {
    const p = polyhedron(kind)
    expect(p.faces).toHaveLength(SHAPE[kind].faces)
    expect(p.vertices).toHaveLength(SHAPE[kind].vertices)
    expect(p.symmetries).toHaveLength(SHAPE[kind].symmetries)
  })

  it.each(DIE_KINDS)('%s: faces planas, viradas para fora e em sentido anti-horário', (kind) => {
    const p = polyhedron(kind)
    p.faces.forEach((f, i) => {
      const n = p.normals[i]
      const c = centroid(f.map((v) => p.vertices[v]))
      expect(dot(n, c)).toBeGreaterThan(0)
      const d = dot(n, p.vertices[f[0]])
      for (const v of f) expect(Math.abs(dot(n, p.vertices[v]) - d)).toBeLessThan(1e-6)
    })
  })

  it('numeração como num dado de verdade: tudo diferente e faces opostas somando certo', () => {
    for (const kind of DIE_KINDS) {
      const p = polyhedron(kind)
      const n = p.labels.length
      expect(new Set(p.labels).size, kind).toBe(n)
      if (kind === 'd4') { expect([...p.labels].sort()).toEqual([1, 2, 3, 4]); continue }
      // o bolão tem os números de 1 a 100 espalhados, sem faces opostas certinhas
      if (kind === 'd100') { expect([...p.labels].sort((a, b) => a - b)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1)); continue }
      const zero = kind === 'd10'
      expect(Math.min(...p.labels), kind).toBe(zero ? 0 : 1)
      p.normals.forEach((nm, i) => {
        const opp = p.normals.findIndex((m) => dot(m, nm) < -0.999)
        expect(opp, kind).toBeGreaterThanOrEqual(0)
        expect(p.labels[i] + p.labels[opp], kind).toBe(zero ? n - 1 : n + 1)
      })
    }
  })

  it('valor sorteado vira o número da face', () => {
    expect(labelForValue('d20', 17)).toBe(17)
    expect(labelForValue('d10', 10)).toBe(0)
    expect(labelForValue('d10', 7)).toBe(7)
    expect(labelForValue('d100', 1)).toBe(1)
    expect(labelForValue('d100', 73)).toBe(73)
    expect(labelForValue('d100', 100)).toBe(100)
    expect(labelText('d100', 100)).toBe('100')
    expect(labelText('d10', 0)).toBe('0')
  })

  it('as simetrias são rotações que levam o sólido nele mesmo', () => {
    for (const kind of DIE_KINDS) {
      const p = polyhedron(kind)
      for (const s of p.symmetries) {
        const q = quatFromM3(s)
        expect(Math.hypot(...q), kind).toBeCloseTo(1, 6)
        for (const v of p.vertices) {
          const w = rotate(q, v)
          const m = mulMV(s, v)
          expect(Math.hypot(w[0] - m[0], w[1] - m[1], w[2] - m[2]), kind).toBeLessThan(1e-6)
          expect(p.vertices.some((u) => Math.hypot(u[0] - w[0], u[1] - w[1], u[2] - w[2]) < 1e-4), kind).toBe(true)
        }
      }
    }
  })

  it('para qualquer face de cima e qualquer número, o giro de simetria mostra o número em cima', () => {
    // (o bolão não gira: ele troca os números de lugar no desenho, ver dieMesh.test)
    for (const kind of DIE_KINDS.filter((k) => k !== 'd100')) {
      const p = polyhedron(kind)
      for (let seed = 1; seed <= 12; seed++) {
        const body = randomQuat(seed * 7919 + kind.length)
        const up = upIndex(p, body)
        for (const label of p.labels) {
          const s: M3 = alignment(p, up, label)
          const shown = mulQ(body, quatFromM3(s))
          expect(p.labels[upIndex(p, shown)], `${kind} semente ${seed} número ${label}`).toBe(label)
        }
      }
    }
  })

  it('bolão: o número sorteado aparece na face de frente trocando só duas células', async () => {
    const { ballCells } = await import('./dieMesh')
    const p = polyhedron('d100')
    for (const [face, label] of [[0, 1], [37, 100], [99, 55], [12, p.labels[12]]] as const) {
      const { cellOf, labels } = ballCells(face, label)
      expect(labels[face], `face ${face}`).toBe(label)
      expect(new Set(labels).size).toBe(100)
      expect(cellOf.filter((c, i) => c !== i).length).toBeLessThanOrEqual(2)
      expect(new Set(cellOf).size).toBe(100)
    }
  })
})
