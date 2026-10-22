import * as CANNON from 'cannon-es'
import { polyhedron, upIndex, type DieKind, type Quat } from './polyhedra'

// ────────────────────────────────────────────────────────
// Física dos dados (cannon-es), rodada inteira ANTES de mostrar: o lançamento
// é simulado até todos pararem, cada passo fica gravado e a tela só toca a
// gravação. Assim dá para saber, antes do primeiro quadro, qual face cai para
// cima e girar o desenho para mostrar o número sorteado (ver polyhedra.ts).
// Sem DOM: roda nos testes.
// ────────────────────────────────────────────────────────

export const STEP_HZ = 60
const MAX_SECONDS = 6

/** Tamanho de cada dado (raio do vértice mais distante), em unidades do mundo. */
export const DIE_RADIUS: Record<DieKind, number> = { d4: 1.2, d6: 1.0, d8: 1.08, d10: 1.05, d100: 1.05, d12: 1.1, d20: 1.15 }

export type ThrowStyle = 'tray' | 'stage'

export interface SimOptions {
  /** Metade da largura (x) e da profundidade (z) do chão onde os dados podem ficar. */
  arena: { halfW: number; halfD: number }
  style: ThrowStyle
  seed:  number
}

export interface Impact { step: number; die: number; strength: number; withDie: boolean }

export interface SimResult {
  steps:   number
  /** Por dado: 7 números por passo (x, y, z, qx, qy, qz, qw). */
  frames:  Float32Array[]
  /** Face (ou vértice, no d4) de cima de cada dado no fim. */
  up:      number[]
  /** Batidas fortes o bastante para soar. */
  impacts: Impact[]
  settled: boolean
}

/** Gerador de números com semente (mulberry32): o mesmo lançamento sai igual com a mesma semente. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dieShape(kind: DieKind): CANNON.ConvexPolyhedron {
  const p = polyhedron(kind)
  const r = DIE_RADIUS[kind]
  return new CANNON.ConvexPolyhedron({
    vertices: p.vertices.map(([x, y, z]) => new CANNON.Vec3(x * r, y * r, z * r)),
    faces: p.faces.map((f) => [...f]),
  })
}

export function simulateThrow(kinds: readonly DieKind[], opts: SimOptions): SimResult {
  const rnd = seededRandom(opts.seed)
  const { halfW, halfD } = opts.arena

  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82 * 3.2, 0) })
  world.allowSleep = true
  world.broadphase = new CANNON.NaiveBroadphase()
  ;(world.solver as CANNON.GSSolver).iterations = 14

  const floorMat = new CANNON.Material('chao')
  const wallMat = new CANNON.Material('parede')
  const dieMat = new CANNON.Material('dado')
  world.addContactMaterial(new CANNON.ContactMaterial(floorMat, dieMat, { friction: 0.32, restitution: 0.42 }))
  world.addContactMaterial(new CANNON.ContactMaterial(wallMat, dieMat, { friction: 0.05, restitution: 0.6 }))
  world.addContactMaterial(new CANNON.ContactMaterial(dieMat, dieMat, { friction: 0.12, restitution: 0.45 }))

  const plane = (mat: CANNON.Material, pos: CANNON.Vec3, axis: CANNON.Vec3, angle: number) => {
    const b = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Plane() })
    b.position.copy(pos)
    b.quaternion.setFromAxisAngle(axis, angle)
    world.addBody(b)
    return b
  }
  const floor = plane(floorMat, new CANNON.Vec3(0, 0, 0), new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
  plane(wallMat, new CANNON.Vec3(-halfW, 0, 0), new CANNON.Vec3(0, 1, 0), Math.PI / 2)
  plane(wallMat, new CANNON.Vec3(halfW, 0, 0), new CANNON.Vec3(0, 1, 0), -Math.PI / 2)
  plane(wallMat, new CANNON.Vec3(0, 0, -halfD), new CANNON.Vec3(0, 1, 0), 0)
  plane(wallMat, new CANNON.Vec3(0, 0, halfD), new CANNON.Vec3(0, 1, 0), Math.PI)

  const impacts: Impact[] = []
  const lastSound: number[] = kinds.map(() => -99)
  let step = 0

  const bodies = kinds.map((kind, i) => {
    const body = new CANNON.Body({ mass: 1, material: dieMat, shape: dieShape(kind), allowSleep: true, sleepSpeedLimit: 0.22, sleepTimeLimit: 0.22 })
    body.linearDamping = 0.14
    body.angularDamping = 0.22
    const r = DIE_RADIUS[kind]
    if (opts.style === 'stage') {
      // um dado jogado de perto, de baixo para o fundo, batendo nas paredes da moldura
      body.position.set((rnd() - 0.5) * halfW * 0.6, 2.2 + rnd() * 1.2, halfD * 0.55)
      body.velocity.set((rnd() - 0.5) * 9, 2 + rnd() * 2, -(9 + rnd() * 5))
    } else {
      // vários dados jogados de um lado da bandeja, como uma mão soltando
      const row = Math.floor(i / 4), col = i % 4
      body.position.set(halfW - r * 1.6 - row * r * 1.3, 2 + rnd() * 1.6 + col * 0.25, (col - 1.5) * r * 1.4 + (rnd() - 0.5) * 0.4)
      body.velocity.set(-(11 + rnd() * 6), 1 + rnd() * 2, (rnd() - 0.5) * 7)
    }
    body.quaternion.setFromEuler(rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2)
    body.angularVelocity.set((rnd() - 0.5) * 40, (rnd() - 0.5) * 40, (rnd() - 0.5) * 40)
    body.addEventListener('collide', (e: { body: CANNON.Body; contact: CANNON.ContactEquation }) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal())
      if (v < 1.2 || step - lastSound[i] < 4) return
      lastSound[i] = step
      impacts.push({ step, die: i, strength: Math.min(1, v / 14), withDie: e.body !== floor && e.body.mass > 0 })
    })
    world.addBody(body)
    return body
  })

  const maxSteps = STEP_HZ * MAX_SECONDS
  const frames = bodies.map(() => new Float32Array(maxSteps * 7))
  const record = () => bodies.forEach((b, i) => {
    const o = step * 7, f = frames[i]
    f[o] = b.position.x; f[o + 1] = b.position.y; f[o + 2] = b.position.z
    f[o + 3] = b.quaternion.x; f[o + 4] = b.quaternion.y; f[o + 5] = b.quaternion.z; f[o + 6] = b.quaternion.w
  })

  let settled = false
  while (step < maxSteps) {
    record()
    step++
    world.step(1 / STEP_HZ)
    if (step > STEP_HZ * 0.6 && bodies.every((b) => b.sleepState === CANNON.Body.SLEEPING)) { settled = true; break }
  }
  if (step < maxSteps) record()
  const steps = Math.min(step + 1, maxSteps)

  const up = bodies.map((b, i) => upIndex(polyhedron(kinds[i]), [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w] as Quat))
  return { steps, frames: frames.map((f) => f.subarray(0, steps * 7)), up, impacts, settled }
}
