import type { BoardData, BoardItem, BoardKind, Endpoint, ShapeType } from './services/boardService'

// ────────────────────────────────────────────────────────
// Geometria e padrões do Quadro — tudo em coordenadas do "mundo" (o quadro
// infinito); a tela é mundo × zoom + deslocamento.
// ────────────────────────────────────────────────────────

export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }
export interface View { tx: number; ty: number; zoom: number }

export const MIN_ZOOM = 0.15
export const MAX_ZOOM = 3

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function rectOf(i: Pick<BoardItem, 'x' | 'y' | 'w' | 'h'>): Rect {
  return { x: i.x, y: i.y, w: i.w, h: i.h }
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function contains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h
}

export function unionRect(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  for (const r of rects) {
    x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y)
    x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h)
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

export function normRect(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
}

export const center = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

/** Ponto onde a reta do centro de `r` até `toward` cruza a borda de `r`. */
function clipToBorder(r: Rect, toward: Point, round: boolean): Point {
  const c = center(r)
  const dx = toward.x - c.x, dy = toward.y - c.y
  if (dx === 0 && dy === 0) return c
  const hw = r.w / 2, hh = r.h / 2
  let t: number
  if (round) {
    // Elipse: (dx·t/hw)² + (dy·t/hh)² = 1
    t = 1 / Math.sqrt((dx * dx) / (hw * hw || 1) + (dy * dy) / (hh * hh || 1))
  } else {
    t = Math.min(dx !== 0 ? hw / Math.abs(dx) : Infinity, dy !== 0 ? hh / Math.abs(dy) : Infinity)
  }
  t = Math.min(t, 1)
  return { x: c.x + dx * t, y: c.y + dy * t }
}

function endpointAnchor(e: Endpoint | undefined, items: Record<string, BoardItem>): { p: Point; item: BoardItem | null } {
  const item = e?.id ? items[e.id] : undefined
  if (item && item.kind !== 'connector') return { p: center(rectOf(item)), item }
  return { p: { x: e?.x ?? 0, y: e?.y ?? 0 }, item: null }
}

const isRound = (i: BoardItem | null) => i?.kind === 'shape' && i.data.shape === 'ellipse'

/**
 * Centros (ou pontas soltas) da seta, a direção de um ao outro e a
 * perpendicular. Os pontos da curva são guardados relativos a isto, então
 * a curva acompanha quando os itens mudam de lugar.
 */
export function connectorAnchors(c: BoardItem, items: Record<string, BoardItem>) {
  const from = endpointAnchor(c.data.from, items)
  const to = endpointAnchor(c.data.to, items)
  const dir = { x: to.p.x - from.p.x, y: to.p.y - from.p.y }
  const len = Math.hypot(dir.x, dir.y) || 1
  return {
    from, to, dir, len,
    mid:    { x: (from.p.x + to.p.x) / 2, y: (from.p.y + to.p.y) / 2 },
    normal: { x: -dir.y / len, y: dir.x / len },
  }
}
type Anchors = ReturnType<typeof connectorAnchors>

/** Ponto da curva: [u, v] — u ao longo da reta (0 = começo, 1 = fim), v pro lado, em unidades do quadro. */
export type CurvePoint = [number, number]
export const MAX_CURVE_POINTS = 40

export function curvePointToWorld(an: Anchors, [u, v]: CurvePoint): Point {
  return { x: an.from.p.x + an.dir.x * u + an.normal.x * v, y: an.from.p.y + an.dir.y * u + an.normal.y * v }
}

export function worldToCurvePoint(an: Anchors, p: Point): CurvePoint {
  const rx = p.x - an.from.p.x, ry = p.y - an.from.p.y
  const u = (rx * an.dir.x + ry * an.dir.y) / (an.len * an.len)
  const v = rx * an.normal.x + ry * an.normal.y
  return [Math.round(u * 10000) / 10000, Math.round(v)]
}

/** Pontos da curva da seta (a curva antiga, de um ponto só — `bend` — vira um ponto no meio). */
export function curvePoints(c: BoardItem): CurvePoint[] {
  const pts = c.data.pts
  if (Array.isArray(pts) && pts.length) {
    return pts.filter((q): q is CurvePoint => Array.isArray(q) && Number.isFinite(q[0]) && Number.isFinite(q[1])).slice(0, MAX_CURVE_POINTS)
  }
  return c.data.bend ? [[0.5, c.data.bend]] : []
}

type Cubic = [Point, Point, Point, Point]

function cubicAt([p0, p1, p2, p3]: Cubic, t: number): Point {
  const u = 1 - t
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y }
}

export interface ConnectorCurve {
  /** Pontas, já na borda dos itens. */
  a:      Point
  b:      Point
  /** Caminho SVG (reta, ou curva suave passando por todos os pontos). */
  d:      string
  /** Pontos da curva, no quadro. */
  points: Point[]
  /** Meio de cada trecho (ponta → ponto → … → ponta): onde nasce um ponto novo. */
  gaps:   Point[]
  /** Meio da seta (lugar da legenda). */
  mid:    Point
  /** Direção da seta em cada ponta (pras pontas de flecha). */
  dirA:   Point
  dirB:   Point
}

/**
 * Linha em degrau (árvore genealógica): sai do lado do item virado pro outro,
 * anda até o meio do caminho, vira, e entra no outro item — tudo em ângulo
 * reto, com os cantos levemente arredondados. Refaz sozinha quando os itens
 * mudam de lugar.
 */
function elbowCurve(an: ReturnType<typeof connectorAnchors>): ConnectorCurve {
  const A = an.from.p, B = an.to.p
  const fi = an.from.item, ti = an.to.item
  const vertical = Math.abs(B.y - A.y) >= Math.abs(B.x - A.x)
  let P: Point[]
  if (vertical) {
    const down = B.y >= A.y
    const s = fi ? { x: A.x, y: down ? fi.y + fi.h : fi.y } : A
    const e = ti ? { x: B.x, y: down ? ti.y : ti.y + ti.h } : B
    // Quase alinhados: desce reto (sem um degrau minúsculo), se ainda cai no item.
    if (ti && Math.abs(e.x - s.x) < 16 && s.x >= ti.x && s.x <= ti.x + ti.w) e.x = s.x
    const my = (s.y + e.y) / 2
    P = [s, { x: s.x, y: my }, { x: e.x, y: my }, e]
  } else {
    const right = B.x >= A.x
    const s = fi ? { x: right ? fi.x + fi.w : fi.x, y: A.y } : A
    const e = ti ? { x: right ? ti.x : ti.x + ti.w, y: B.y } : B
    if (ti && Math.abs(e.y - s.y) < 16 && s.y >= ti.y && s.y <= ti.y + ti.h) e.y = s.y
    const mx = (s.x + e.x) / 2
    P = [s, { x: mx, y: s.y }, { x: mx, y: e.y }, e]
  }
  // Tira os cantos que não viram (pontos repetidos / em linha).
  P = P.filter((q, i) => i === 0 || Math.hypot(q.x - P[i - 1].x, q.y - P[i - 1].y) > 0.5)
  const a = P[0], b = P[P.length - 1]
  // Cantos arredondados (raio até 14, menor se o trecho for curto).
  let d = `M ${a.x} ${a.y}`
  for (let i = 1; i < P.length - 1; i++) {
    const c = P[i], prev = P[i - 1], next = P[i + 1]
    const lin = Math.hypot(c.x - prev.x, c.y - prev.y), lout = Math.hypot(next.x - c.x, next.y - c.y)
    const r = Math.min(14, lin / 2, lout / 2)
    const p1 = { x: c.x - ((c.x - prev.x) / (lin || 1)) * r, y: c.y - ((c.y - prev.y) / (lin || 1)) * r }
    const p2 = { x: c.x + ((next.x - c.x) / (lout || 1)) * r, y: c.y + ((next.y - c.y) / (lout || 1)) * r }
    d += ` L ${p1.x} ${p1.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`
  }
  d += ` L ${b.x} ${b.y}`
  const n = P.length - 1
  const mid = n % 2 ? { x: (P[(n - 1) / 2].x + P[(n + 1) / 2].x) / 2, y: (P[(n - 1) / 2].y + P[(n + 1) / 2].y) / 2 } : P[n / 2]
  return {
    a, b, d, mid, points: [], gaps: [],
    dirA: { x: P[1].x - a.x, y: P[1].y - a.y },
    dirB: { x: b.x - P[n - 1].x, y: b.y - P[n - 1].y },
  }
}

/** Desenho da seta: reta, curva suave (Catmull-Rom) pelos pontos, cantos retos ou degrau. */
export function connectorCurve(conn: BoardItem, items: Record<string, BoardItem>): ConnectorCurve {
  const an = connectorAnchors(conn, items)
  if (conn.data.elbow && curvePoints(conn).length === 0) return elbowCurve(an)
  const points = curvePoints(conn).map((q) => curvePointToWorld(an, q))
  // A ponta sai da borda do item na direção do primeiro (ou último) ponto.
  const a = an.from.item ? clipToBorder(rectOf(an.from.item), points[0] ?? an.to.p, isRound(an.from.item)) : an.from.p
  const b = an.to.item ? clipToBorder(rectOf(an.to.item), points[points.length - 1] ?? an.from.p, isRound(an.to.item)) : an.to.p
  if (points.length === 0) {
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const dir = { x: b.x - a.x, y: b.y - a.y }
    return { a, b, d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, points, gaps: [m], mid: m, dirA: dir, dirB: dir }
  }
  const P = [a, ...points, b]
  if (conn.data.sharp) {
    // Cantos retos: segmentos de reta ponto a ponto.
    const n = P.length - 1
    const half = (i: number) => ({ x: (P[i].x + P[i + 1].x) / 2, y: (P[i].y + P[i + 1].y) / 2 })
    return {
      a, b, points,
      d: `M ${P.map((q) => `${q.x} ${q.y}`).join(' L ')}`,
      gaps: P.slice(0, -1).map((_, i) => half(i)),
      mid: n % 2 ? half((n - 1) / 2) : P[n / 2],
      dirA: { x: P[1].x - a.x, y: P[1].y - a.y },
      dirB: { x: b.x - P[n - 1].x, y: b.y - P[n - 1].y },
    }
  }
  const segs: Cubic[] = []
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] ?? P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] ?? P[i + 1]
    segs.push([
      p1,
      { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p2,
    ])
  }
  const d = `M ${a.x} ${a.y} ` + segs.map(([, c1, c2, e]) => `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${e.x} ${e.y}`).join(' ')
  const n = segs.length
  const mid = n % 2 ? cubicAt(segs[(n - 1) / 2], 0.5) : P[n / 2]
  const first = segs[0], last = segs[n - 1]
  const dirA = { x: first[1].x - a.x, y: first[1].y - a.y }
  const dirB = { x: b.x - last[2].x, y: b.y - last[2].y }
  return {
    a, b, d, points, mid,
    gaps: segs.map((sg) => cubicAt(sg, 0.5)),
    dirA: dirA.x || dirA.y ? dirA : { x: P[1].x - a.x, y: P[1].y - a.y },
    dirB: dirB.x || dirB.y ? dirB : { x: b.x - P[n - 1].x, y: b.y - P[n - 1].y },
  }
}

/** Pontas da seta, já na borda dos itens em que ela está presa. */
export function connectorEnds(c: BoardItem, items: Record<string, BoardItem>): { a: Point; b: Point } {
  const { a, b } = connectorCurve(c, items)
  return { a, b }
}

/** Retângulo que cobre a seta (pra seleção por área e "ajustar à tela"). */
export function connectorRect(c: BoardItem, items: Record<string, BoardItem>): Rect {
  const { a, b, points, gaps } = connectorCurve(c, items)
  return unionRect([a, b, ...points, ...gaps].map((q) => ({ x: q.x, y: q.y, w: 0, h: 0 })))!
}

export function itemBounds(i: BoardItem, items: Record<string, BoardItem>): Rect {
  return i.kind === 'connector' ? connectorRect(i, items) : rectOf(i)
}

/** Simplificação de traço (Ramer–Douglas–Peucker) — desenho mais leve de salvar. */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points
  const sq = tolerance * tolerance
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()!
    const a = points[s], b = points[e]
    const dx = b.x - a.x, dy = b.y - a.y
    const len = dx * dx + dy * dy
    let max = 0, idx = -1
    for (let i = s + 1; i < e; i++) {
      const p = points[i]
      let t = len ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len : 0
      t = clamp(t, 0, 1)
      const ex = a.x + t * dx - p.x, ey = a.y + t * dy - p.y
      const d = ex * ex + ey * ey
      if (d > max) { max = d; idx = i }
    }
    if (max > sq && idx > 0) {
      keep[idx] = 1
      stack.push([s, idx], [idx, e])
    }
  }
  return points.filter((_, i) => keep[i])
}

// ── Caneta: suavização do traço ─────────────────────────

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/** Pontos a cada `step` ao longo do traço (o mouse manda pontos com espaçamento torto). */
function resample(points: Point[], step: number): Point[] {
  const out = [points[0]]
  let prev = points[0], carry = 0
  for (let i = 1; i < points.length; i++) {
    const cur = points[i]
    let seg = dist(prev, cur)
    let from = prev
    while (carry + seg >= step) {
      const t = (step - carry) / seg
      const q = { x: from.x + (cur.x - from.x) * t, y: from.y + (cur.y - from.y) * t }
      out.push(q)
      seg -= step - carry
      from = q
      carry = 0
    }
    carry += seg
    prev = cur
  }
  const last = points[points.length - 1]
  if (dist(out[out.length - 1], last) > step * 0.3) out.push(last)
  return out
}

/**
 * Arredonda o traço da caneta: refaz com pontos a cada ~3 px da tela,
 * alisa com média em janela (3 passadas — quanto maior o traço, mais forte)
 * e tira os pontos que sobraram em linha. As pontas ficam onde a pessoa
 * começou e terminou; traço que termina perto do começo vira fechado.
 */
export function smoothStroke(raw: Point[], zoom: number): Point[] {
  if (raw.length < 3) return raw
  let pts = resample(raw, 3 / zoom)
  const n = pts.length
  if (n < 5) return simplify(pts, 0.6 / zoom)
  let total = 0
  for (let i = 1; i < n; i++) total += dist(pts[i - 1], pts[i])
  const closed = dist(pts[0], pts[n - 1]) < 16 / zoom && total > 120 / zoom
  if (closed) pts = pts.slice(0, -1)
  const m = pts.length
  // Janela de até ±7 pontos (~21 px na tela); traço curtinho (letra) alisa menos.
  const r = clamp(Math.round(m / 8), 1, 7)
  for (let pass = 0; pass < 3; pass++) {
    pts = pts.map((p, i) => {
      // Aberto: a janela encolhe perto das pontas (elas não saem do lugar).
      const k = closed ? r : Math.min(r, i, m - 1 - i)
      if (k === 0) return p
      let sx = 0, sy = 0, sw = 0
      for (let j = -k; j <= k; j++) {
        const q = pts[closed ? (i + j + m) % m : i + j]
        const w = k + 1 - Math.abs(j)
        sx += q.x * w; sy += q.y * w; sw += w
      }
      return { x: sx / sw, y: sy / sw }
    })
  }
  if (closed) pts.push({ ...pts[0] })
  return simplify(pts, 0.5 / zoom)
}

// ── Cores ───────────────────────────────────────────────

/** "ink" = cor do texto do tema (clara no escuro, escura no claro). */
export const INK = 'ink'

export const NOTE_COLORS = ['#f7d774', '#f5a962', '#f29bb7', '#c3a6f0', '#8ec5f5', '#9bd8a4', '#e9dcb8', '#c8ccd6']
export const INK_COLORS = [INK, '#ffc174', '#f87171', '#4ade80', '#60a5fa', '#c084fc', '#f472b6', '#94a3b8']
/** Formas: as cores de post-it + "só contorno". */
export const OUTLINE = 'outline'
export const SHAPE_COLORS = [...NOTE_COLORS.slice(0, 6), OUTLINE]
export const TEXT_SIZES = [14, 18, 24, 32, 48, 64, 96]

export function inkColor(color: string | undefined): string {
  return !color || color === INK ? 'var(--text-primary)' : color
}

export const SHAPE_LABEL: Record<ShapeType, string> = {
  rect: 'Retângulo', ellipse: 'Elipse', diamond: 'Losango', triangle: 'Triângulo',
}

// ── Itens novos ─────────────────────────────────────────

export const DEFAULT_SIZE: Partial<Record<BoardKind, { w: number; h: number }>> = {
  note:     { w: 220, h: 220 },
  text:     { w: 320, h: 40 },
  shape:    { w: 220, h: 140 },
  frame:    { w: 960, h: 600 },
  timeline: { w: 960, h: 240 },
  file:     { w: 280, h: 96 },
}

export function newId(): string {
  return crypto.randomUUID()
}

export function defaultData(kind: BoardKind, opts: { shape?: ShapeType; color?: string } = {}): BoardData {
  switch (kind) {
    case 'note':     return { text: '', color: opts.color ?? NOTE_COLORS[0] }
    case 'text':     return { text: '', color: opts.color ?? INK, size: 24 }
    case 'shape':    return { text: '', color: opts.color ?? NOTE_COLORS[4], shape: opts.shape ?? 'rect' }
    case 'frame':    return { title: 'Moldura', color: opts.color ?? '#ffc174' }
    case 'timeline': return {
      color: opts.color ?? '#ffc174',
      events: [
        { id: newId(), when: '', title: 'Começo' },
        { id: newId(), when: '', title: 'Virada' },
        { id: newId(), when: '', title: 'Hoje' },
      ],
    }
    case 'connector': return { color: opts.color ?? INK, arrow: 'end' }
    default:          return {}
  }
}

/** Tipos que dá pra editar o texto com duplo clique. */
export function editableText(kind: BoardKind): boolean {
  return kind === 'note' || kind === 'text' || kind === 'shape' || kind === 'frame' || kind === 'connector'
}
