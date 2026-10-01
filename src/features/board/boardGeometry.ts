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

/** O ponto está dentro do item (retângulo ou elipse)? */
function inside(i: BoardItem, p: Point): boolean {
  if (isRound(i)) {
    const hw = i.w / 2 || 1, hh = i.h / 2 || 1
    const dx = (p.x - i.x - hw) / hw, dy = (p.y - i.y - hh) / hh
    return dx * dx + dy * dy <= 1
  }
  return p.x >= i.x && p.x <= i.x + i.w && p.y >= i.y && p.y <= i.y + i.h
}

/** Curva da seta (Bézier quadrática): ponto em t. */
function bezier(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }
}

/** Onde a curva sai de dentro do item (busca binária entre um t dentro e um fora). */
function exitT(a: Point, c: Point, b: Point, item: BoardItem, tIn: number, tOut: number): number {
  if (inside(item, bezier(a, c, b, tOut))) return tIn
  for (let k = 0; k < 24; k++) {
    const m = (tIn + tOut) / 2
    if (inside(item, bezier(a, c, b, m))) tIn = m
    else tOut = m
  }
  return tOut
}

/**
 * Centros (ou pontas soltas) da seta e a perpendicular — a curva é medida a
 * partir daqui: `bend` é quanto o meio da seta sai da reta, pro lado da
 * perpendicular (negativo = pro outro lado).
 */
export function connectorAnchors(c: BoardItem, items: Record<string, BoardItem>) {
  const from = endpointAnchor(c.data.from, items)
  const to = endpointAnchor(c.data.to, items)
  const dx = to.p.x - from.p.x, dy = to.p.y - from.p.y
  const len = Math.hypot(dx, dy) || 1
  return {
    from, to,
    mid:    { x: (from.p.x + to.p.x) / 2, y: (from.p.y + to.p.y) / 2 },
    normal: { x: -dy / len, y: dx / len },
  }
}

export interface ConnectorCurve {
  /** Pontas, já na borda dos itens. */
  a:   Point
  b:   Point
  /** Ponto de controle do trecho desenhado (reta: o meio). */
  c:   Point
  /** Meio da curva (alça pra curvar e lugar da legenda). */
  mid: Point
  /** Direção da seta em cada ponta (pras pontas de flecha). */
  dirA: Point
  dirB: Point
}

/** Desenho da seta: reta, ou curva quando `data.bend` não é zero. */
export function connectorCurve(conn: BoardItem, items: Record<string, BoardItem>): ConnectorCurve {
  const { from, to, mid, normal } = connectorAnchors(conn, items)
  const bend = conn.data.bend ?? 0
  if (Math.abs(bend) < 0.5) {
    const a = from.item ? clipToBorder(rectOf(from.item), to.p, isRound(from.item)) : from.p
    const b = to.item ? clipToBorder(rectOf(to.item), from.p, isRound(to.item)) : to.p
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const dir = { x: b.x - a.x, y: b.y - a.y }
    return { a, b, c: m, mid: m, dirA: dir, dirB: dir }
  }
  // A curva passa pelo meio deslocado (mid + normal·bend) em t = ½.
  const A = from.p, B = to.p
  const C = { x: mid.x + normal.x * bend * 2, y: mid.y + normal.y * bend * 2 }
  const t0 = from.item ? exitT(A, C, B, from.item, 0, 0.5) : 0
  const t1 = to.item ? exitT(A, C, B, to.item, 1, 0.5) : 1
  // Trecho [t0, t1] da curva: o controle é o "blossom" B(t0, t1).
  const k = (1 - t0) * (1 - t1), l = (1 - t0) * t1 + t0 * (1 - t1), m2 = t0 * t1
  const c = { x: k * A.x + l * C.x + m2 * B.x, y: k * A.y + l * C.y + m2 * B.y }
  const a = bezier(A, C, B, t0), b = bezier(A, C, B, t1)
  return { a, b, c, mid: bezier(A, C, B, 0.5), dirA: { x: c.x - a.x, y: c.y - a.y }, dirB: { x: b.x - c.x, y: b.y - c.y } }
}

/** Pontas da seta, já na borda dos itens em que ela está presa. */
export function connectorEnds(c: BoardItem, items: Record<string, BoardItem>): { a: Point; b: Point } {
  const { a, b } = connectorCurve(c, items)
  return { a, b }
}

/** Retângulo que cobre a seta (pra seleção por área e "ajustar à tela"). */
export function connectorRect(c: BoardItem, items: Record<string, BoardItem>): Rect {
  const { a, b, mid } = connectorCurve(c, items)
  return unionRect([normRect(a, b), { x: mid.x, y: mid.y, w: 0, h: 0 }])!
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
