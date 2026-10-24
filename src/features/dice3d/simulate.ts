import * as CANNON from 'cannon-es'
import { polyhedron, rotate, upIndex, type DieKind, type Quat, type V3 } from './polyhedra'

// ────────────────────────────────────────────────────────
// Física dos dados (cannon-es), rodada inteira ANTES de mostrar: o lançamento
// é simulado até todos pararem, cada passo fica gravado e a tela só toca a
// gravação. Assim dá para saber, antes do primeiro quadro, qual face cai para
// cima e girar o desenho para mostrar o número sorteado (ver polyhedra.ts).
// Sem DOM: roda nos testes.
// ────────────────────────────────────────────────────────

export const STEP_HZ = 60
const MAX_SECONDS = 6
/** Tempo a mais, só para os empurrões nos dados que pararam tortos. */
const NUDGE_SECONDS = 3
const MAX_NUDGES = 8
const GROUP_WORLD = 1, GROUP_DIE = 2, GROUP_BALL = 4
/** Quanto do giro e do deslize o bolão (d100) mantém a cada passo enquanto toca o chão. */
const ROLL_SPIN_KEEP = 0.978
const ROLL_SLIDE_KEEP = 0.993
/** Giro (rad/s por unidade de seno do desvio) com que o bolão tomba para a faceta de baixo. */
const SETTLE_PULL = 9

/** Tamanho de cada dado (raio do vértice mais distante), em unidades do mundo. */
export const DIE_RADIUS: Record<DieKind, number> = { d4: 1.2, d6: 1.0, d8: 1.08, d10: 1.05, d100: 1.35, d12: 1.1, d20: 1.15 }

/** 'tray': bandeja de baixo da tela; 'stage': o palco do painel de teste; 'wide': o palco largo da rolagem livre (câmera mais longe, mais chão). */
export type ThrowStyle = 'tray' | 'stage' | 'wide'

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

/** Altura do centro de um dado deitado numa face (a distância do centro ao plano da face). */
export function restHeight(kind: DieKind): number {
  const p = polyhedron(kind)
  const h = p.faces.map((f, i) => { const v = p.vertices[f[0]], n = p.normals[i]; return v[0] * n[0] + v[1] * n[1] + v[2] * n[2] })
  return (h.reduce((a, b) => a + b, 0) / h.length) * DIE_RADIUS[kind]
}

/** Cada dado precisa terminar deitado numa face (nada torto, apoiado em parede ou em outro dado). */
const MAX_TILT_COS = Math.cos((3.5 * Math.PI) / 180)

/**
 * O quanto o dado está deitado: cosseno do desvio da face de apoio (de cima, nos dados com face oposta paralela).
 * O bolão não tem face oposta paralela, então ali vale a face de baixo, a que toca a mesa.
 */
function restTilt(kind: DieKind, q: Quat, up: number): number {
  const poly = polyhedron(kind)
  if (kind === 'd100') {
    const n = poly.normals[upIndex(poly, q, [0, -1, 0])]
    return -rotate(q, n)[1]
  }
  const item = (poly.readsVertex ? poly.vertices : poly.normals)[up]
  return rotate(q, item)[1] / Math.hypot(item[0], item[1], item[2])
}

/**
 * Quantos dados terminaram errados: tortos (a face de cima não está na vertical),
 * em cima de outro dado (centro acima da altura de repouso) ou atravessando outro
 * (a esfera inscrita de um entra na do outro, o que um sólido não faz).
 */
export function badDice(kinds: readonly DieKind[], sim: SimResult): number {
  const o = (sim.steps - 1) * 7
  const bad = new Set<number>()
  const end = sim.frames.map((f) => ({ p: [f[o], f[o + 1], f[o + 2]] as V3, q: [f[o + 3], f[o + 4], f[o + 5], f[o + 6]] as Quat }))
  kinds.forEach((kind, i) => {
    if (restTilt(kind, end[i].q, sim.up[i]) < MAX_TILT_COS) bad.add(i)
    if (end[i].p[1] > restHeight(kind) * 1.18) bad.add(i)
  })
  for (let a = 0; a < kinds.length; a++) for (let b = a + 1; b < kinds.length; b++) {
    const need = (restHeight(kinds[a]) + restHeight(kinds[b])) * 0.98
    if (Math.hypot(end[a].p[0] - end[b].p[0], end[a].p[1] - end[b].p[1], end[a].p[2] - end[b].p[2]) < need) { bad.add(a); bad.add(b) }
  }
  return bad.size
}

/** Segundos em que algum dado ainda se mexe de verdade (mais de 1,2 por segundo): o tempo de rolagem que se vê. */
export function rollSeconds(sim: SimResult): number {
  let last = 0
  for (let s = 1; s < sim.steps; s++) {
    for (const f of sim.frames) {
      const o = s * 7, p = o - 7
      if (Math.hypot(f[o] - f[p], f[o + 1] - f[p + 1], f[o + 2] - f[p + 2]) * STEP_HZ > 1.2) { last = s; break }
    }
  }
  return last / STEP_HZ
}

/** O dado precisa rolar pelo menos isto antes de mostrar o resultado (um lançamento mais curto é sorteado de novo). */
export const MIN_ROLL_SECONDS = 2.6

/** Quantas tentativas valem a pena: a conta cresce com o quadrado dos dados. */
function attemptsFor(count: number): number {
  return count <= 6 ? 14 : count <= 16 ? 18 : count <= 40 ? 8 : count <= 70 ? 3 : 2
}

/**
 * Lança os dados e confere o resultado: se algum terminar torto ou em cima/dentro de outro,
 * lança de novo com outra semente (a mesma semente dá sempre a mesma sequência de tentativas).
 * Fica com a primeira boa ou, se nenhuma for, com a que teve menos dados errados.
 */
export function simulateThrow(kinds: readonly DieKind[], opts: SimOptions): SimResult {
  let best: SimResult | null = null
  let bestBad = Infinity
  const tries = attemptsFor(kinds.length)
  for (let k = 0; k < tries; k++) {
    const sim = simulateOnce(kinds, { ...opts, seed: (opts.seed + Math.imul(k, 0x9e3779b1)) >>> 0 })
    // dado torto pesa muito mais que rolagem curta; entre os sem defeito, vale o que rolou o tempo pedido
    const score = badDice(kinds, sim) * 10 + Math.max(0, MIN_ROLL_SECONDS - rollSeconds(sim))
    if (score < bestBad) { best = sim; bestBad = score }
    if (score === 0) break
  }
  return best as SimResult
}

export function simulateOnce(kinds: readonly DieKind[], opts: SimOptions): SimResult {
  const rnd = seededRandom(opts.seed)
  const { halfW, halfD } = opts.arena

  // poucos dados rolam soltos e por mais tempo (gravidade mais leve, quicam e giram mais); com muitos, a
  // mesa lota, então o lançamento é mais seco para todos pararem planos sem ficarem uns sobre os outros
  const loose = Math.min(1, Math.max(0, (8 - kinds.length) / 6))
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82 * (3.2 - 0.9 * loose), 0) })
  world.allowSleep = true
  // com muitos dados, a varredura por eixo evita testar todos contra todos
  world.broadphase = kinds.length > 24 ? new CANNON.SAPBroadphase(world) : new CANNON.NaiveBroadphase()
  ;(world.solver as CANNON.GSSolver).iterations = kinds.length > 40 ? 8 : 14

  const floorMat = new CANNON.Material('chao')
  const wallMat = new CANNON.Material('parede')
  const dieMat = new CANNON.Material('dado')
  world.addContactMaterial(new CANNON.ContactMaterial(floorMat, dieMat, { friction: 0.22 + 0.1 * (1 - loose), restitution: 0.42 + 0.18 * loose }))
  world.addContactMaterial(new CANNON.ContactMaterial(wallMat, dieMat, { friction: 0.05, restitution: 0.72 }))
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
    const ball = kind === 'd100'
    const body = new CANNON.Body({
      mass: 1, material: dieMat, shape: dieShape(kind), allowSleep: true, sleepSpeedLimit: 0.16, sleepTimeLimit: 0.22 + 0.1 * loose,
      // o choque entre dois sólidos de muitas faces é caro demais (o bolão tem ~300 arestas): o bolão só bate no chão e nas
      // paredes e passa pelos outros dados; a conferência do fim (badDice) refaz o lançamento se algum terminar por cima de outro
      collisionFilterGroup: ball ? GROUP_BALL : GROUP_DIE, collisionFilterMask: ball ? GROUP_WORLD : GROUP_WORLD | GROUP_DIE,
    })
    body.linearDamping = 0.14 - 0.09 * loose
    body.angularDamping = 0.22 - 0.14 * loose
    // a bola de 100 faces rola como uma esfera: sem um pouco mais de "atrito de rolar" ela passaria o tempo todo rolando
    if (kind === 'd100') { body.linearDamping += 0.06; body.angularDamping += 0.15 }
    const r = DIE_RADIUS[kind]
    if (opts.style !== 'tray') {
      // um dado jogado de perto, de baixo para o fundo, batendo nas paredes da moldura
      if (kinds.length <= 3) {
        body.position.set((rnd() - 0.5) * halfW * 0.6, 2.8 + rnd() * 1.2, halfD * 0.55)
        body.velocity.set((rnd() - 0.5) * 16, 6 + rnd() * 4, -(13 + rnd() * 6))
      } else {
        // muitos dados: saem espalhados em grade, do fundo para a frente, para não nascerem uns dentro dos outros
        const cols = Math.ceil(Math.sqrt((kinds.length * halfW) / halfD))
        const rows = Math.ceil(kinds.length / cols)
        const col = i % cols, row = Math.floor(i / cols)
        body.position.set(((col + 0.5) / cols - 0.5) * halfW * 1.7 + (rnd() - 0.5) * 0.3, 2.2 + rnd() * 1.2 + row * 0.5, halfD * (rows > 1 ? 0.85 - (0.6 * row) / (rows - 1) : 0.55))
        body.velocity.set((rnd() - 0.5) * 9, 2 + rnd() * 3, -(5 + rnd() * 5))
      }
    } else {
      // vários dados jogados de um lado da bandeja, como uma mão soltando
      const row = Math.floor(i / 4), col = i % 4
      body.position.set(halfW - r * 1.6 - row * r * 1.3, 2 + rnd() * 1.6 + col * 0.25, (col - 1.5) * r * 1.4 + (rnd() - 0.5) * 0.4)
      body.velocity.set(-(11 + rnd() * 6), 1 + rnd() * 2, (rnd() - 0.5) * 7)
    }
    body.quaternion.setFromEuler(rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2)
    body.angularVelocity.set((rnd() - 0.5) * 70, (rnd() - 0.5) * 70, (rnd() - 0.5) * 70)
    // a bola de 100 faces perde força rápido no chão: sai da mão com mais empurrão e mais giro para rolar o tempo de um dado
    if (ball) { body.velocity.scale(1.35, body.velocity); body.angularVelocity.scale(1.4, body.angularVelocity) }
    body.addEventListener('collide', (e: { body: CANNON.Body; contact: CANNON.ContactEquation }) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal())
      if (v < 1.2 || step - lastSound[i] < 4) return
      lastSound[i] = step
      impacts.push({ step, die: i, strength: Math.min(1, v / 14), withDie: e.body !== floor && e.body.mass > 0 })
    })
    world.addBody(body)
    return body
  })

  // muitos dados levam mais tempo para parar planos
  const lastStep = STEP_HZ * (MAX_SECONDS + (kinds.length > 40 ? NUDGE_SECONDS * 2.5 : NUDGE_SECONDS))
  const maxSteps = Math.round(lastStep)
  const frames = bodies.map(() => new Float32Array(maxSteps * 7))
  const record = () => bodies.forEach((b, i) => {
    const o = step * 7, f = frames[i]
    f[o] = b.position.x; f[o + 1] = b.position.y; f[o + 2] = b.position.z
    f[o + 3] = b.quaternion.x; f[o + 4] = b.quaternion.y; f[o + 5] = b.quaternion.z; f[o + 6] = b.quaternion.w
  })

  /** O dado parou torto (apoiado em outro dado ou na parede, ou sobre outro)? */
  const crooked = (b: CANNON.Body, i: number): boolean => {
    const q = [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w] as Quat
    const cos = restTilt(kinds[i], q, upIndex(polyhedron(kinds[i]), q))
    return cos < MAX_TILT_COS || b.position.y > restHeight(kinds[i]) * 1.18
  }

  /**
   * Dado quase parado: o quique que sobra (a restituição do contato, que nunca zera) vira pulinhos miúdos
   * e o dado tremendo antes de dormir. Aqui o resto de movimento é amortecido e nada sobe mais.
   */
  const calmDown = () => {
    if (kinds.length > 24) return // numa multidão o aperto já segura os dados, e o amortecimento só atrapalha a acomodação
    for (const b of bodies) {
      if (b.sleepState === CANNON.Body.SLEEPING) continue
      if (b.velocity.length() > 2.2 || b.angularVelocity.length() > 6) continue
      if (b.velocity.y > 0) b.velocity.y *= 0.2
      b.velocity.scale(0.9, b.velocity)
      b.angularVelocity.scale(0.9, b.angularVelocity)
    }
  }

  /**
   * Resistência ao rolar do bolão: uma esfera quase perfeita, apoiada no chão, rolaria quase para sempre. A
   * bola de 100 faces de verdade perde força a cada faceta que bate no chão; aqui, enquanto ela toca o chão,
   * giro e deslize perdem um pouco a cada passo.
   */
  /**
   * O bolão não colide de verdade com os outros dados (ver os filtros acima); no lugar, os dois se tratam como
   * esferas que não se atravessam: se chegam perto demais, são afastados e a parte que se aproximava é cortada.
   */
  const pairs: [number, number][] = []
  kinds.forEach((a, i) => { for (let j = i + 1; j < kinds.length; j++) if (a === 'd100' || kinds[j] === 'd100') pairs.push([i, j]) })
  const repelBalls = () => {
    for (const [i, j] of pairs) {
      const a = bodies[i], b = bodies[j]
      const dx = a.position.x - b.position.x, dy = a.position.y - b.position.y, dz = a.position.z - b.position.z
      const d = Math.hypot(dx, dy, dz) || 1e-6
      const min = (restHeight(kinds[i]) + restHeight(kinds[j])) * 1.04
      if (d >= min) continue
      const nx = dx / d, ny = dy / d, nz = dz / d, push = (min - d) / 2
      a.position.x += nx * push; a.position.y += ny * push; a.position.z += nz * push
      b.position.x -= nx * push; b.position.y -= ny * push; b.position.z -= nz * push
      const approach = (a.velocity.x - b.velocity.x) * nx + (a.velocity.y - b.velocity.y) * ny + (a.velocity.z - b.velocity.z) * nz
      if (approach < 0) {
        const k = approach * 0.65 // tira a velocidade que se aproximava e devolve um pouco (quique)
        a.velocity.x -= nx * k; a.velocity.y -= ny * k; a.velocity.z -= nz * k
        b.velocity.x += nx * k; b.velocity.y += ny * k; b.velocity.z += nz * k
        a.wakeUp(); b.wakeUp()
      }
    }
  }

  const ballPoly = kinds.includes('d100') ? polyhedron('d100') : null
  const rollResist = () => {
    bodies.forEach((b, i) => {
      if (!ballPoly || kinds[i] !== 'd100' || b.sleepState === CANNON.Body.SLEEPING || b.position.y > DIE_RADIUS.d100 * 1.04) return
      b.angularVelocity.scale(ROLL_SPIN_KEEP, b.angularVelocity)
      b.velocity.x *= ROLL_SLIDE_KEEP
      b.velocity.z *= ROLL_SLIDE_KEEP
      // quase parada, apoiada numa quina entre duas facetas: tomba devagar para a faceta mais próxima (uma
      // esfera facetada de verdade faria isso sozinha; a conta do motor trava no equilíbrio instável)
      if (b.velocity.length() < 2.5 && b.angularVelocity.length() < 5) {
        const q: Quat = [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]
        const f = rotate(q, ballPoly.normals[upIndex(ballPoly, q, [0, -1, 0])]) // faceta mais baixa, no mundo
        // eixo que leva essa faceta para baixo: f × (0, −1, 0)
        const axis: V3 = [f[2], 0, -f[0]]
        const sin = Math.hypot(axis[0], axis[1], axis[2])
        if (sin > 0.015) {
          b.wakeUp()
          b.angularVelocity.set(axis[0] * SETTLE_PULL, axis[1] * SETTLE_PULL, axis[2] * SETTLE_PULL)
        }
      }
    })
  }

  let settled = false
  let nudges = 0
  while (step < maxSteps) {
    record()
    step++
    repelBalls()
    world.step(1 / STEP_HZ)
    rollResist()
    calmDown()
    if (step > STEP_HZ * 1.2 && bodies.every((b) => b.sleepState === CANNON.Body.SLEEPING)) {
      const wrong = bodies.flatMap((b, i) => (crooked(b, i) ? [b] : []))
      // quem parou torto leva um empurrãozinho para tombar numa face (os vizinhos acordam se for preciso)
      if (wrong.length === 0 || nudges >= MAX_NUDGES || step > lastStep - 40) { settled = true; break }
      nudges++
      // sem pulo: um dado quase parado que sobe de repente é o que se vê como "pulinho"; ele só escorrega e
      // tomba (o resto é com as novas tentativas de simulateThrow). Só numa multidão de dados, onde um pulo
      // se perde no meio dos outros e escorregar não basta, o empurrão ainda salta.
      const hop = kinds.length > 24
      for (const b of wrong) {
        b.wakeUp()
        b.velocity.set((rnd() - 0.5) * (hop ? 5 : 3), hop ? 3 + rnd() * 2 : 0, (rnd() - 0.5) * (hop ? 5 : 3))
        b.angularVelocity.set((rnd() - 0.5) * (hop ? 18 : 12), (rnd() - 0.5) * (hop ? 18 : 12), (rnd() - 0.5) * (hop ? 18 : 12))
      }
    }
  }
  if (step < maxSteps) record()
  const steps = Math.min(step + 1, maxSteps)

  const up = bodies.map((b, i) => upIndex(polyhedron(kinds[i]), [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w] as Quat))
  return { steps, frames: frames.map((f) => f.subarray(0, steps * 7)), up, impacts, settled }
}
