import type { BoardData, BoardItem, BoardKind, Endpoint, ShapeType } from './services/boardService'

// ────────────────────────────────────────────────────────
// Geometria e padrões do Quadro — tudo em coordenadas do "mundo" (o quadro
// infinito); a tela é mundo × zoom + deslocamento.
// ────────────────────────────────────────────────────────

export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }
export interface View { tx: number; ty: number; zoom: number }

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4

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

/** Pontas da seta, já na borda dos itens em que ela está presa. */
export function connectorEnds(c: BoardItem, items: Record<string, BoardItem>): { a: Point; b: Point } {
  const from = endpointAnchor(c.data.from, items)
  const to = endpointAnchor(c.data.to, items)
  const round = (i: BoardItem | null) => i?.kind === 'shape' && i.data.shape === 'ellipse'
  const a = from.item ? clipToBorder(rectOf(from.item), to.p, round(from.item)) : from.p
  const b = to.item ? clipToBorder(rectOf(to.item), from.p, round(to.item)) : to.p
  return { a, b }
}

/** Retângulo que cobre a seta (pra seleção por área e "ajustar à tela"). */
export function connectorRect(c: BoardItem, items: Record<string, BoardItem>): Rect {
  const { a, b } = connectorEnds(c, items)
  return normRect(a, b)
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
