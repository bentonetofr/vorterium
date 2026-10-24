// ────────────────────────────────────────────────────────
// Geometria dos dados (d4, d6, d8, d10, d12, d20 e o d100 "bolão" de 100 faces), sem desenho e sem
// física: vértices, faces (em sentido anti-horário vistas de fora), número
// de cada face (no d4, de cada vértice), leitura da face de cima e o grupo
// de rotações que levam o sólido nele mesmo.
//
// O truque do resultado: o dado cai pela física de verdade e, no fim, o
// desenho gira por uma dessas simetrias. Como a simetria leva o sólido nele
// mesmo, a silhueta não muda, só os números trocam de lugar, e a face de
// cima passa a mostrar o número sorteado.
// ────────────────────────────────────────────────────────

export type V3 = [number, number, number]
/** Matriz 3×3 em linhas. */
export type M3 = [number, number, number, number, number, number, number, number, number]
export type Quat = [number, number, number, number] // x, y, z, w

export type DieKind = 'd4' | 'd6' | 'd8' | 'd10' | 'd100' | 'd12' | 'd20'
export const DIE_KINDS: readonly DieKind[] = ['d4', 'd6', 'd8', 'd10', 'd100', 'd12', 'd20']

export interface Polyhedron {
  kind:        DieKind
  /** Vértices, com o mais distante do centro no raio 1. */
  vertices:    V3[]
  /** Faces, cada uma uma lista de vértices em sentido anti-horário vista de fora. */
  faces:       number[][]
  normals:     V3[]
  /** Número de cada face (d4: de cada vértice). d10: 0 a 9; d100: 1 a 100, embaralhados. */
  labels:      number[]
  /** d4: o resultado é o número do vértice de cima. */
  readsVertex: boolean
  /** Rotações que levam o sólido nele mesmo (inclui a identidade). */
  symmetries:  M3[]
}

// ── Vetores ─────────────────────────────────────────────

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s]

export function centroid(points: readonly V3[]): V3 {
  const c: V3 = [0, 0, 0]
  for (const p of points) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2] }
  return scale(c, 1 / points.length)
}

export function mulMV(m: M3, v: V3): V3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]
}

/** Gira v pelo quatérnio q. */
export function rotate(q: Quat, v: V3): V3 {
  const [x, y, z, w] = q
  const u: V3 = [x, y, z]
  const t = scale(cross(u, v), 2)
  const r = cross(u, t)
  return [v[0] + w * t[0] + r[0], v[1] + w * t[1] + r[1], v[2] + w * t[2] + r[2]]
}

/** Quatérnio de uma matriz de rotação. */
export function quatFromM3(m: M3): Quat {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = m
  const tr = m00 + m11 + m22
  let x: number, y: number, z: number, w: number
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2
    w = 0.25 * s; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2
    w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2
    w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2
    w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s
  }
  return [x, y, z, w]
}

// ── Vértices de cada sólido ─────────────────────────────

const PHI = (1 + Math.sqrt(5)) / 2

function d10Vertices(): V3[] {
  // Trapezoedro pentagonal com faces planas: anel de 10 vértices alternando
  // acima e abaixo do equador (altura c) e dois polos na altura h que deixa
  // cada pipa plana: h = c + 2c·cos36° / (1 − cos36°).
  const c = 0.11
  const cos36 = Math.cos(Math.PI / 5)
  const h = c + (2 * c * cos36) / (1 - cos36)
  const ring: V3[] = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5
    return [Math.cos(a), i % 2 === 0 ? c : -c, Math.sin(a)]
  })
  return [[0, h, 0], [0, -h, 0], ...ring]
}

// ── O d100 "bolão": 100 faces quase esféricas ───────────

/** Quantas faces tem o d100. */
export const BALL_FACES = 100

/**
 * Esfera de 100 faces: 100 pontos bem espalhados (espiral de Fibonacci) viram os pontos de apoio das faces,
 * e cada face é o plano que encosta na esfera num deles. Os vértices do sólido são os cruzamentos de três
 * planos vizinhos (o fecho convexo dos pontos diz quais são os vizinhos).
 */
function ballSolid(): { vertices: V3[]; faces: number[][] } {
  const n = BALL_FACES
  const golden = Math.PI * (3 - Math.sqrt(5))
  const pts: V3[] = Array.from({ length: n }, (_, i) => {
    const z = 1 - (2 * i + 1) / n
    const r = Math.sqrt(1 - z * z)
    return [r * Math.cos(i * golden), z, r * Math.sin(i * golden)]
  })
  // triângulos do fecho convexo: o plano de três pontos que deixa todos os outros do mesmo lado
  const tris: { ids: [number, number, number]; v: V3 }[] = []
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) {
    let nm = cross(sub(pts[b], pts[a]), sub(pts[c], pts[a]))
    const l = len(nm)
    if (l < 1e-9) continue
    nm = scale(nm, 1 / l)
    let d = dot(nm, pts[a])
    if (d < 0) { nm = scale(nm, -1); d = -d }
    let ok = true
    for (let k = 0; k < n && ok; k++) if (k !== a && k !== b && k !== c && dot(nm, pts[k]) > d - 1e-9) ok = false
    if (ok) tris.push({ ids: [a, b, c], v: scale(nm, 1 / d) })
  }
  const faces = pts.map((p, i) => {
    const mine = tris.map((t, idx) => (t.ids.includes(i) ? idx : -1)).filter((idx) => idx >= 0)
    const c = centroid(mine.map((idx) => tris[idx].v))
    // uma direção qualquer no plano da face como referência; ordena em sentido anti-horário visto de fora
    const ref = Math.abs(p[1]) < 0.9 ? [0, 1, 0] as V3 : [1, 0, 0] as V3
    const u = norm(sub(ref, scale(p, dot(ref, p))))
    const w = cross(p, u)
    return mine.sort((x, y) => {
      const px = sub(tris[x].v, c), py = sub(tris[y].v, c)
      return Math.atan2(dot(px, w), dot(px, u)) - Math.atan2(dot(py, w), dot(py, u))
    })
  })
  return { vertices: tris.map((t) => t.v), faces }
}

/** Números 1 a 100 espalhados pelas faces (sempre na mesma ordem: sorteio com semente fixa), como na bola de verdade. */
function ballLabels(): number[] {
  const labels = Array.from({ length: BALL_FACES }, (_, i) => i + 1)
  let a = 0x1d100
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  for (let i = labels.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [labels[i], labels[j]] = [labels[j], labels[i]] }
  return labels
}

function rawVertices(kind: DieKind): V3[] {
  switch (kind) {
    case 'd4':  return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]
    case 'd6':  return [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z): V3 => [x, y, z])))
    case 'd8':  return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
    case 'd12': {
      const a = 1 / PHI
      return [
        ...[-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z): V3 => [x, y, z]))),
        ...[-1, 1].flatMap((s) => [-1, 1].flatMap((t): V3[] => [[0, s * a, t * PHI], [s * a, t * PHI, 0], [s * PHI, 0, t * a]])),
      ]
    }
    case 'd20':
      return [-1, 1].flatMap((s) => [-1, 1].flatMap((t): V3[] => [[0, s, t * PHI], [s, t * PHI, 0], [t * PHI, 0, s]]))
    case 'd10':
      return d10Vertices()
    case 'd100':
      return ballSolid().vertices
  }
}

// ── Faces pelo fecho convexo ────────────────────────────

/** Faces de um poliedro convexo pequeno: planos que deixam todos os vértices de um lado. */
export function hullFaces(vs: readonly V3[]): number[][] {
  const eps = 1e-6
  const faces: number[][] = []
  const seen = new Set<string>()
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) for (let k = j + 1; k < vs.length; k++) {
    let n = cross(sub(vs[j], vs[i]), sub(vs[k], vs[i]))
    if (len(n) < eps) continue
    n = norm(n)
    let d = dot(n, vs[i])
    let above = 0, below = 0
    for (const v of vs) { const s = dot(n, v) - d; if (s > eps) above++; else if (s < -eps) below++ }
    if (above && below) continue
    if (above) { n = scale(n, -1); d = -d }
    const on = vs.map((v, idx) => (Math.abs(dot(n, v) - d) < 1e-5 ? idx : -1)).filter((idx) => idx >= 0)
    const key = [...on].sort((a, b) => a - b).join(',')
    if (seen.has(key)) continue
    seen.add(key)
    const c = centroid(on.map((idx) => vs[idx]))
    const u = norm(sub(vs[on[0]], c))
    const w = cross(n, u)
    on.sort((a, b) => {
      const pa = sub(vs[a], c), pb = sub(vs[b], c)
      return Math.atan2(dot(pa, w), dot(pa, u)) - Math.atan2(dot(pb, w), dot(pb, u))
    })
    faces.push(on)
  }
  return faces
}

export function faceNormal(vs: readonly V3[], face: readonly number[]): V3 {
  return norm(cross(sub(vs[face[1]], vs[face[0]]), sub(vs[face[2]], vs[face[0]])))
}

// ── Números ─────────────────────────────────────────────

/**
 * Numeração como num dado de verdade: faces opostas somam n + 1 (d10 e d%: 9).
 * As faces seguem uma ordem fixa (de cima para baixo, girando), para o
 * resultado ser sempre o mesmo.
 */
function assignLabels(kind: DieKind, normals: readonly V3[]): number[] {
  const n = normals.length
  const order = normals.map((nm, i) => ({ i, key: -nm[1] * 1000 + Math.atan2(nm[2], nm[0]) })).sort((a, b) => a.key - b.key).map((x) => x.i)
  const zeroBased = kind === 'd10' || kind === 'd100'
  const labels = new Array<number>(n).fill(-1)
  let next = zeroBased ? 0 : 1
  const top = zeroBased ? n - 1 : n + 1
  for (const i of order) {
    if (labels[i] !== -1) continue
    const opp = normals.findIndex((m, j) => j !== i && dot(m, normals[i]) < -0.999)
    labels[i] = next
    if (opp >= 0 && labels[opp] === -1) labels[opp] = top - next
    next++
  }
  return labels
}

// ── Simetrias ───────────────────────────────────────────

/** Matriz de colunas (a, b, n) para a face com o vértice `start` como referência. */
function faceFrame(vs: readonly V3[], face: readonly number[], start: number): { a: V3; b: V3; n: V3 } {
  const c = centroid(face.map((i) => vs[i]))
  const n = faceNormal(vs, face)
  const a = norm(sub(vs[face[start]], c))
  return { a, b: cross(n, a), n }
}

function frameToFrame(from: { a: V3; b: V3; n: V3 }, to: { a: V3; b: V3; n: V3 }): M3 {
  // R = T · Fᵀ, com T e F de colunas (a, b, n)
  const m: number[] = []
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    m.push(to.a[r] * from.a[c] + to.b[r] * from.b[c] + to.n[r] * from.n[c])
  }
  return m as M3
}

function findSymmetries(vs: readonly V3[], faces: readonly number[][]): M3[] {
  const out: M3[] = []
  const f0 = faces[0]
  const from = faceFrame(vs, f0, 0)
  for (const g of faces) {
    if (g.length !== f0.length) continue
    for (let s = 0; s < g.length; s++) {
      const r = frameToFrame(from, faceFrame(vs, g, s))
      const ok = vs.every((v) => { const w = mulMV(r, v); return vs.some((u) => Math.hypot(u[0] - w[0], u[1] - w[1], u[2] - w[2]) < 1e-4) })
      if (!ok) continue
      if (out.some((m) => m.every((x, i) => Math.abs(x - r[i]) < 1e-6))) continue
      out.push(r)
    }
  }
  return out
}

// ── Montagem e cache ────────────────────────────────────

const cache = new Map<DieKind, Polyhedron>()

export function polyhedron(kind: DieKind): Polyhedron {
  const hit = cache.get(kind)
  if (hit) return hit
  // escala única (o maior raio vira 1): normalizar vértice a vértice entortaria as pipas do d10
  const raw = rawVertices(kind)
  const r = Math.max(...raw.map(len))
  const vertices = raw.map((v) => scale(v, 1 / r))
  const ball = kind === 'd100'
  const faces = ball ? ballSolid().faces : hullFaces(vertices)
  const normals = faces.map((f) => faceNormal(vertices, f))
  const readsVertex = kind === 'd4'
  // o bolão não tem simetria que troque os números: quem mostra o resultado é o desenho (dieMesh.ts), face por face
  const labels = readsVertex ? [1, 2, 3, 4] : ball ? ballLabels() : assignLabels(kind, normals)
  const symmetries: M3[] = ball ? [[1, 0, 0, 0, 1, 0, 0, 0, 1]] : findSymmetries(vertices, faces)
  const p: Polyhedron = { kind, vertices, faces, normals, labels, readsVertex, symmetries }
  cache.set(kind, p)
  return p
}

/** Quantos lados o dado tem para o sorteio (d% conta como 10 dezenas). */
export function facesCount(kind: DieKind): number {
  return polyhedron(kind).labels.length
}

/** O número que vai na face para um valor sorteado. d10: 10 vira 0. d100: 1 a 100, como saiu. */
export function labelForValue(kind: DieKind, value: number): number {
  if (kind === 'd10') return ((value % 10) + 10) % 10
  if (kind === 'd100') return Math.min(BALL_FACES, Math.max(1, Math.round(value)))
  return value
}

/** Como o número aparece escrito na face. */
export function labelText(_kind: DieKind, label: number): string {
  return String(label)
}

/**
 * Índice da face (ou do vértice, no d4) que está para cima com o dado girado
 * por q. `toward` troca o "para cima" por outra direção (ex.: a da câmera,
 * para a face lida ser a que está de frente para quem olha).
 */
export function upIndex(p: Polyhedron, q: Quat, toward: V3 = [0, 1, 0]): number {
  const items = p.readsVertex ? p.vertices : p.normals
  const t = norm(toward)
  let best = 0, bestY = -Infinity
  items.forEach((v, i) => { const y = dot(rotate(q, v), t); if (y > bestY) { bestY = y; best = i } })
  return best
}

/**
 * Para onde aponta o "em pé" do número da face, no dado parado (sem girar):
 * para o vértice mais longe do centro (ponta do triângulo, bico da pipa do
 * d10) ou, nas faces quadradas e pentagonais, para o meio da primeira aresta.
 * A textura (dieMesh.ts) desenha o número nessa direção.
 */
export function numberUp(p: Polyhedron, face: number): V3 {
  if (p.kind === 'd100') {
    // no bolão todo número fica de pé em direção ao polo de cima (como na foto); nas faces dos polos, para o fundo
    const n = p.normals[face]
    for (const ref of [[0, 1, 0], [0, 0, -1]] as V3[]) {
      const along = sub(ref, scale(n, dot(ref, n)))
      if (len(along) > 0.2) return norm(along)
    }
  }
  const f = p.faces[face]
  const pts = f.map((v) => p.vertices[v])
  const c = centroid(pts)
  const pointy = f.length === 3 || (f.length === 4 && p.kind !== 'd6')
  const ref = pointy
    ? pts.reduce((best, q) => (len(sub(q, c)) > len(sub(best, c)) ? q : best), pts[0])
    : scale([pts[0][0] + pts[1][0], pts[0][1] + pts[1][1], pts[0][2] + pts[1][2]], 0.5)
  return norm(sub(ref, c))
}

/** Todas as simetrias que levam a face (ou vértice) de número `label` para a posição `up`. */
export function alignments(p: Polyhedron, up: number, label: number): M3[] {
  const target = p.labels.indexOf(label)
  if (target < 0) throw new Error(`O ${p.kind} não tem o número ${label}.`)
  const items = p.readsVertex ? p.vertices : p.normals
  const want = items[up], from = items[target]
  return p.symmetries.filter((m) => { const w = mulMV(m, from); return Math.hypot(w[0] - want[0], w[1] - want[1], w[2] - want[2]) < 1e-4 })
}

/**
 * A simetria S que faz a face (ou vértice) com o número `label` ficar onde
 * está a face de cima `up`. Desenhar o dado com orientação (física · S)
 * mostra `label` em cima sem mudar a silhueta.
 */
export function alignment(p: Polyhedron, up: number, label: number): M3 {
  const target = p.labels.indexOf(label)
  if (target < 0) throw new Error(`O ${p.kind} não tem o número ${label}.`)
  const items = p.readsVertex ? p.vertices : p.normals
  const want = items[up], from = items[target]
  const s = p.symmetries.find((m) => { const w = mulMV(m, from); return Math.hypot(w[0] - want[0], w[1] - want[1], w[2] - want[2]) < 1e-4 })
  if (!s) throw new Error(`Sem simetria do ${p.kind} da face ${target} para a ${up}.`)
  return s
}
