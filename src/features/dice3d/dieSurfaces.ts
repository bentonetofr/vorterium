import type { DiceSkin } from './skins'

// ────────────────────────────────────────────────────────
// Pintores de superfície dos conjuntos detalhados: cada um pinta uma face do
// dado (cor, relevo e brilho) e os números do jeito do material. Madeira
// velha com números riscados a faca, granito com entalhe de cinzel e plástico
// marmorizado com tinta nos números. Tudo sai de canvas e de um sorteio com
// semente (o mesmo dado sai igual em qualquer aparelho). dieMesh.ts chama.
// ────────────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D
export type V2 = [number, number]

export interface FacePaint {
  /** Cor, relevo (cinza 128 = plano; claro sobe, escuro afunda) e rugosidade/metal. */
  cx: Ctx; bx: Ctx; rx: Ctx
  poly: V2[]
  center: V2
  radius: number
  rnd: () => number
  /** Escala em relação a um atlas de 1024 px (as espessuras acompanham a resolução). */
  k: number
  skin: DiceSkin
}

export interface Surface {
  face(f: FacePaint): void
  number(f: FacePaint, text: string, x: number, y: number, angle: number, px: number, underline: boolean): void
}

// ── Utilitários ─────────────────────────────────────────

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** Sorteio com semente: o mesmo texto sempre dá a mesma sequência. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

const rgba = (hex: string, a: number) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})` }

/** Clareia (amt > 0) ou escurece (amt < 0) uma cor. */
function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))))
  return `#${[f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

const gray = (v: number, a = 1) => `rgba(${v}, ${v}, ${v}, ${a})`
const between = (rnd: () => number, a: number, b: number) => a + rnd() * (b - a)

function polyPath(ctx: Ctx, poly: V2[], center: V2, inset: number): void {
  ctx.beginPath()
  poly.forEach(([x, y], i) => {
    const px = center[0] + (x - center[0]) * (1 - inset), py = center[1] + (y - center[1]) * (1 - inset)
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
  })
  ctx.closePath()
}

function lineTo(ctx: Ctx, pts: V2[]): void {
  ctx.beginPath()
  pts.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
}

/** Caminho torto de `a` até `b`: rachadura, veio de pedra, fio de lasca. */
function jagged(a: V2, b: V2, rnd: () => number, amp: number, step: number): V2[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const n = Math.max(2, Math.round(len / step))
  const nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1)
  const pts: V2[] = [a]
  for (let i = 1; i < n; i++) {
    const t = i / n, j = (rnd() - 0.5) * 2 * amp
    pts.push([a[0] + (b[0] - a[0]) * t + nx * j, a[1] + (b[1] - a[1]) * t + ny * j])
  }
  pts.push(b)
  return pts
}

const lerp2 = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

function clipFace(f: FacePaint, ...ctxs: Ctx[]): void {
  for (const c of ctxs) { c.save(); polyPath(c, f.poly, f.center, -0.06); c.clip() }
}
const unclip = (...ctxs: Ctx[]) => { for (const c of ctxs) c.restore() }

/** Marca uma rachadura: a partir de uma aresta, para dentro da face. */
function crackPath(f: FacePaint, rnd: () => number): V2[] {
  const { poly, center, radius, k } = f
  const i = Math.floor(rnd() * poly.length)
  const start = lerp2(poly[i], poly[(i + 1) % poly.length], between(rnd, 0.2, 0.8))
  const toCenter = Math.atan2(center[1] - start[1], center[0] - start[0]) + (rnd() - 0.5) * 1.3
  const len = radius * between(rnd, 0.55, 1.15)
  const pts: V2[] = [start]
  let ang = toCenter, [x, y] = start
  const step = 14 * k
  for (let d = 0; d < len; d += step) {
    ang += (rnd() - 0.5) * 0.9
    const s = step * between(rnd, 0.6, 1.3)
    x += Math.cos(ang) * s; y += Math.sin(ang) * s
    pts.push([x, y])
  }
  return pts
}

/** Quebra em um canto: a região entre o vértice e dois pontos das arestas vizinhas, com a borda interna torta. */
function chipShape(f: FacePaint, rnd: () => number, size = 1): { shape: V2[]; edge: V2[] } {
  const { poly, k } = f
  const n = poly.length, i = Math.floor(rnd() * n)
  const v = poly[i], a = poly[(i + n - 1) % n], b = poly[(i + 1) % n]
  const p1 = lerp2(v, a, between(rnd, 0.16, 0.34) * size), p2 = lerp2(v, b, between(rnd, 0.16, 0.34) * size)
  const edge = jagged(p1, p2, rnd, 9 * k, 8 * k)
  return { shape: [v, ...edge], edge }
}

// ── Letras riscadas (números em traços retos, como cortados a faca) ──

/** Cada dígito em traços retos dentro de uma caixa de 0,6 de largura por 1 de altura (v para cima). */
export const DIGIT_STROKES: Record<string, V2[][]> = {
  '0': [[[0, 0.15], [0, 0.88], [0.12, 1], [0.48, 1], [0.6, 0.88], [0.6, 0.12], [0.48, 0], [0.12, 0], [0, 0.15]]],
  '1': [[[0.08, 0.74], [0.32, 1], [0.32, 0]]],
  '2': [[[0, 0.8], [0.14, 1], [0.46, 1], [0.6, 0.84], [0.6, 0.64], [0, 0], [0.62, 0]]],
  '3': [[[0, 0.9], [0.14, 1], [0.46, 1], [0.6, 0.9], [0.6, 0.62], [0.42, 0.5], [0.2, 0.5]], [[0.42, 0.5], [0.6, 0.38], [0.6, 0.1], [0.46, 0], [0.14, 0], [0, 0.1]]],
  '4': [[[0.46, 0], [0.46, 1], [0, 0.3], [0.64, 0.3]]],
  '5': [[[0.56, 1], [0.06, 1], [0, 0.55], [0.4, 0.6], [0.58, 0.45], [0.6, 0.15], [0.46, 0], [0.1, 0], [0, 0.1]]],
  '6': [[[0.5, 1], [0.2, 0.9], [0, 0.6], [0, 0.15], [0.14, 0], [0.46, 0], [0.6, 0.15], [0.6, 0.4], [0.46, 0.55], [0.14, 0.55], [0, 0.4]]],
  '7': [[[0, 1], [0.6, 1], [0.2, 0]]],
  '8': [[[0.3, 0.5], [0.05, 0.6], [0.05, 0.9], [0.2, 1], [0.4, 1], [0.55, 0.9], [0.55, 0.6], [0.3, 0.5], [0.05, 0.35], [0, 0.1], [0.14, 0], [0.46, 0], [0.6, 0.1], [0.55, 0.35], [0.3, 0.5]]],
  '9': [[[0.1, 0], [0.4, 0.1], [0.6, 0.4], [0.6, 0.85], [0.46, 1], [0.14, 1], [0, 0.85], [0, 0.6], [0.14, 0.45], [0.46, 0.45], [0.6, 0.6]]],
}

// ── Madeira velha ───────────────────────────────────────

function woodFace(f: FacePaint): void {
  const { cx, bx, rx, poly, center, radius: R, rnd, k, skin } = f
  clipFace(f, cx, bx, rx)
  const base = shade(skin.body, (rnd() - 0.5) * 0.3)
  const grain = rnd() * Math.PI
  const dir: V2 = [Math.cos(grain), Math.sin(grain)], nrm: V2 = [-dir[1], dir[0]]
  const at = (along: number, across: number): V2 => [center[0] + dir[0] * along + nrm[0] * across, center[1] + dir[1] * along + nrm[1] * across]

  // fundo: tábua com um lado mais escuro
  const g = cx.createLinearGradient(...at(0, -R), ...at(0, R))
  g.addColorStop(0, shade(base, -0.16)); g.addColorStop(0.45, shade(base, 0.06)); g.addColorStop(1, shade(base, -0.22))
  cx.fillStyle = g
  cx.fillRect(center[0] - R * 1.6, center[1] - R * 1.6, R * 3.2, R * 3.2)
  rx.fillStyle = 'rgb(0, 232, 0)'
  rx.fillRect(center[0] - R * 1.6, center[1] - R * 1.6, R * 3.2, R * 3.2)

  // veios: linhas longas e onduladas, mais apertadas e mais soltas ao longo da tábua
  const phase = rnd() * 6.28
  let off = -R * 1.3
  while (off < R * 1.3) {
    off += R * (0.01 + rnd() * 0.035) * Math.max(0.35, 1.25 + Math.sin(off / R * 4 + phase) * 0.9)
    const wave = (rnd() - 0.5) * R * 0.16
    const a = at(-R * 1.4, off), m = at(0, off + wave), b = at(R * 1.4, off + (rnd() - 0.5) * R * 0.05)
    const dark = rnd() < 0.72
    const w = between(rnd, 0.6, 2.4) * k
    for (const [ctx, style] of [[cx, dark ? rgba(skin.bodyEdge, between(rnd, 0.1, 0.34)) : rgba('#e0b378', between(rnd, 0.05, 0.16))], [bx, dark ? gray(0, 0.14) : gray(255, 0.07)]] as const) {
      ctx.strokeStyle = style; ctx.lineWidth = w
      ctx.beginPath(); ctx.moveTo(...a); ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]); ctx.stroke()
    }
  }
  // poros: tracinhos escuros na direção do veio
  const pores = Math.round((R * R) / 55)
  cx.strokeStyle = rgba(skin.bodyEdge, 0.4)
  for (let i = 0; i < pores; i++) {
    const p = at(between(rnd, -R * 1.3, R * 1.3), between(rnd, -R * 1.3, R * 1.3)), l = between(rnd, 3, 10) * k
    cx.lineWidth = between(rnd, 0.7, 1.7) * k
    cx.beginPath(); cx.moveTo(...p); cx.lineTo(p[0] + dir[0] * l, p[1] + dir[1] * l); cx.stroke()
  }

  // nó da madeira
  if (rnd() < 0.45) {
    const c = at(between(rnd, -R * 0.6, R * 0.6), between(rnd, -R * 0.6, R * 0.6)), r0 = R * between(rnd, 0.06, 0.1)
    for (let i = 9; i >= 0; i--) {
      const r = r0 + i * R * 0.022
      cx.strokeStyle = rgba(skin.bodyEdge, 0.1 + (9 - i) * 0.035); cx.lineWidth = 1.6 * k
      cx.beginPath(); cx.ellipse(c[0], c[1], r, r * 0.62, grain, 0, Math.PI * 2); cx.stroke()
    }
    const kg = cx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r0)
    kg.addColorStop(0, 'rgba(18, 8, 2, 0.9)'); kg.addColorStop(1, 'rgba(18, 8, 2, 0)')
    cx.fillStyle = kg; cx.beginPath(); cx.ellipse(c[0], c[1], r0 * 1.3, r0 * 0.9, grain, 0, Math.PI * 2); cx.fill()
    const bg = bx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r0 * 1.6)
    bg.addColorStop(0, gray(60, 0.9)); bg.addColorStop(1, gray(128, 0))
    bx.fillStyle = bg; bx.beginPath(); bx.arc(c[0], c[1], r0 * 1.6, 0, Math.PI * 2); bx.fill()
  }

  // sujeira e uso: escurece para as bordas e algumas manchas
  const dirt = cx.createRadialGradient(center[0], center[1], R * 0.3, center[0], center[1], R * 1.12)
  dirt.addColorStop(0, rgba(skin.bodyEdge, 0.12)); dirt.addColorStop(0.6, rgba(skin.bodyEdge, 0.3)); dirt.addColorStop(1, rgba(skin.bodyEdge, 0.82))
  cx.fillStyle = dirt
  cx.fillRect(center[0] - R * 1.6, center[1] - R * 1.6, R * 3.2, R * 3.2)
  for (let i = 0; i < 11; i++) {
    const c: V2 = [center[0] + between(rnd, -R, R), center[1] + between(rnd, -R, R)], r = R * between(rnd, 0.15, 0.45)
    const sg = cx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r)
    sg.addColorStop(0, rgba('#1c0f06', between(rnd, 0.14, 0.3))); sg.addColorStop(1, rgba('#1c0f06', 0))
    cx.fillStyle = sg; cx.fillRect(c[0] - r, c[1] - r, r * 2, r * 2)
  }

  // lascas: cantos quebrados mostrando a madeira crua por baixo
  const chips = 1 + (rnd() < 0.5 ? 1 : 0)
  for (let c = 0; c < chips; c++) {
    const { shape, edge } = chipShape(f, rnd)
    const cg = cx.createLinearGradient(...shape[0], ...edge[Math.floor(edge.length / 2)])
    cg.addColorStop(0, '#a98350'); cg.addColorStop(1, '#6d4827')
    cx.fillStyle = cg; lineTo(cx, shape); cx.closePath(); cx.fill()
    for (let s = 0; s < 14; s++) {         // fibras soltas da lasca
      const a = lerp2(shape[0], edge[Math.floor(rnd() * edge.length)], rnd())
      cx.strokeStyle = rgba(rnd() < 0.5 ? '#5a3a1a' : '#e9c791', 0.35); cx.lineWidth = between(rnd, 0.8, 1.8) * k
      cx.beginPath(); cx.moveTo(...a); cx.lineTo(a[0] + dir[0] * between(rnd, 6, 20) * k, a[1] + dir[1] * between(rnd, 6, 20) * k); cx.stroke()
    }
    cx.strokeStyle = 'rgba(20, 9, 3, 0.9)'; cx.lineWidth = 2.6 * k; lineTo(cx, edge); cx.stroke()
    cx.strokeStyle = 'rgba(236, 200, 140, 0.45)'; cx.lineWidth = 1.4 * k
    lineTo(cx, edge.map(([x, y]): V2 => [x + 1.8 * k, y + 1.8 * k])); cx.stroke()
    bx.fillStyle = gray(52); lineTo(bx, shape); bx.closePath(); bx.fill()
    bx.strokeStyle = gray(215, 0.8); bx.lineWidth = 2.4 * k; lineTo(bx, edge); bx.stroke()
    rx.fillStyle = 'rgb(0, 255, 0)'; lineTo(rx, shape); rx.closePath(); rx.fill()
  }

  // rachaduras, com uma ramificação
  const cracks = 1 + Math.floor(rnd() * 2)
  for (let c = 0; c < cracks; c++) {
    const pts = crackPath(f, rnd)
    const branchAt = Math.floor(pts.length * between(rnd, 0.3, 0.7))
    const bAng = rnd() < 0.5 ? 0.9 : -0.9
    const bp = pts[branchAt], next = pts[Math.min(branchAt + 1, pts.length - 1)]
    const bd = Math.atan2(next[1] - bp[1], next[0] - bp[0]) + bAng
    const bl = R * between(rnd, 0.15, 0.35)
    const branch: V2[] = jagged(bp, [bp[0] + Math.cos(bd) * bl, bp[1] + Math.sin(bd) * bl], rnd, 4 * k, 9 * k)
    for (const path of [pts, branch]) {
      const thick = path === pts ? 1 : 0.55
      bx.strokeStyle = gray(20, 0.95); bx.lineWidth = 7 * k * thick; bx.lineJoin = 'round'; lineTo(bx, path); bx.stroke()
      cx.strokeStyle = 'rgba(14, 6, 2, 0.95)'; cx.lineWidth = between(rnd, 2.6, 4.2) * k * thick; cx.lineJoin = 'miter'; lineTo(cx, path); cx.stroke()
      cx.strokeStyle = 'rgba(228, 186, 124, 0.32)'; cx.lineWidth = 1.3 * k; lineTo(cx, path.map(([x, y]): V2 => [x + 2 * k, y + 2 * k])); cx.stroke()
    }
  }

  // quina gasta: a borda arredondada de tanto uso, mais clara, com uma sombra do lado de dentro
  cx.lineJoin = 'round'
  cx.strokeStyle = rgba('#d2a56c', 0.42); cx.lineWidth = 8 * k; polyPath(cx, poly, center, 0.012); cx.stroke()
  cx.strokeStyle = rgba('#1a0c04', 0.45); cx.lineWidth = 5 * k; polyPath(cx, poly, center, 0.05); cx.stroke()
  bx.strokeStyle = gray(190, 0.6); bx.lineWidth = 8 * k; polyPath(bx, poly, center, 0.012); bx.stroke()
  unclip(cx, bx, rx)
  cx.strokeStyle = 'rgba(0, 0, 0, 0.5)'; cx.lineWidth = 7 * k; polyPath(cx, poly, center, -0.06); cx.stroke()
}

/** Um número riscado a faca: traços retos e tortos, fundos no meio e lascados nas bordas. */
function woodNumber(f: FacePaint, text: string, x: number, y: number, angle: number, px: number, underline: boolean): void {
  const { cx, bx, rnd, k } = f
  const H = px * 0.82, gw = H * 0.6, gap = H * 0.28
  const total = text.length * gw + (text.length - 1) * gap
  const cut = (pts: V2[]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const w = Math.max(2.2 * k, H * between(rnd, 0.06, 0.11))
      const seg = [pts[i], pts[i + 1]]
      cx.lineCap = 'round'
      cx.strokeStyle = 'rgba(54, 29, 10, 0.55)'; cx.lineWidth = w * 2; lineTo(cx, seg); cx.stroke()          // fibras lascadas ao redor do corte
      cx.strokeStyle = 'rgba(12, 5, 1, 0.96)'; cx.lineWidth = w; lineTo(cx, seg); cx.stroke()               // o fundo do corte
      cx.strokeStyle = 'rgba(232, 190, 130, 0.38)'; cx.lineWidth = w * 0.3
      lineTo(cx, seg.map(([sx, sy]): V2 => [sx + w * 0.55, sy + w * 0.55])); cx.stroke()                     // o gume claro da madeira
      bx.lineCap = 'round'
      bx.strokeStyle = gray(190, 0.55); bx.lineWidth = w * 2.4; lineTo(bx, seg); bx.stroke()
      bx.strokeStyle = gray(12); bx.lineWidth = w * 1.1; lineTo(bx, seg); bx.stroke()
    }
  }
  for (const c of [cx, bx]) { c.save(); c.translate(x, y); c.rotate(angle + (rnd() - 0.5) * 0.3) }
  ;[...text].forEach((ch, i) => {
    const strokes = DIGIT_STROKES[ch]
    if (!strokes) return
    const sc = between(rnd, 0.88, 1.12), dx = -total / 2 + i * (gw + gap) + (rnd() - 0.5) * gap * 0.7, dy = (rnd() - 0.5) * H * 0.16
    const rot = (rnd() - 0.5) * 0.3, cs = Math.cos(rot), sn = Math.sin(rot)
    const place = ([u, v]: V2): V2 => {
      const lx = (u / 0.6 - 0.5) * gw * sc + (rnd() - 0.5) * H * 0.06, ly = -(v - 0.5) * H * sc + (rnd() - 0.5) * H * 0.06
      return [dx + gw / 2 + lx * cs - ly * sn, dy + lx * sn + ly * cs]
    }
    for (const s of strokes) {
      const pts = s.map(place)
      if (rnd() < 0.3) {       // a faca passou do ponto
        const a = pts[pts.length - 2], b = pts[pts.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
        pts.push([b[0] + ((b[0] - a[0]) / l) * H * 0.14, b[1] + ((b[1] - a[1]) / l) * H * 0.14])
      }
      cut(pts)
    }
  })
  if (underline) cut([[-gw * 0.6, H * 0.68], [gw * 0.6, H * 0.68 + (rnd() - 0.5) * H * 0.1]])
  for (const c of [cx, bx]) c.restore()
}

// ── Granito ─────────────────────────────────────────────

function stoneFace(f: FacePaint): void {
  const { cx, bx, rx, poly, center, radius: R, rnd, k, skin } = f
  clipFace(f, cx, bx, rx)
  const box = [center[0] - R * 1.6, center[1] - R * 1.6, R * 3.2, R * 3.2] as const
  const bg = cx.createRadialGradient(center[0], center[1] - R * 0.2, R * 0.1, center[0], center[1], R * 1.15)
  bg.addColorStop(0, shade(skin.body, 0.04)); bg.addColorStop(1, skin.bodyEdge)
  cx.fillStyle = bg; cx.fillRect(...box)
  rx.fillStyle = 'rgb(0, 214, 8)'; rx.fillRect(...box)

  // manchas grandes de mineral, mais claras e mais escuras
  for (let i = 0; i < 24; i++) {
    const c: V2 = [center[0] + between(rnd, -R, R), center[1] + between(rnd, -R, R)], r = R * between(rnd, 0.18, 0.62)
    const g = cx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r)
    const col = rnd() < 0.5 ? '#d9d6cf' : '#1d1f24'
    g.addColorStop(0, rgba(col, between(rnd, 0.07, 0.17))); g.addColorStop(1, rgba(col, 0))
    cx.fillStyle = g; cx.fillRect(c[0] - r, c[1] - r, r * 2, r * 2)
  }
  // grão: quartzo, biotita, feldspato e cinza
  const grains = Math.round((R * R) / 13)
  const palette: [string, number][] = [['#e6e2d8', 0.34], ['#101116', 0.55], ['#a98474', 0.4], ['#5a5d64', 0.5], ['#2a2c32', 0.45], ['#e6e2d8', 0.22]]
  for (let i = 0; i < grains; i++) {
    const [col, a] = palette[Math.floor(rnd() * palette.length)]
    const s = (0.6 + rnd() * rnd() * 2.2) * k
    const x = center[0] + between(rnd, -R * 1.2, R * 1.2), y = center[1] + between(rnd, -R * 1.2, R * 1.2)
    cx.fillStyle = rgba(col, a)
    if (s > 0.9 * k) { cx.beginPath(); cx.ellipse(x, y, s, s * between(rnd, 0.55, 1), rnd() * 3, 0, Math.PI * 2); cx.fill() } else cx.fillRect(x, y, s, s)
  }
  // grão no relevo (a pedra tem textura áspera ao toque)
  const rough = Math.round((R * R) / 14)
  for (let i = 0; i < rough; i++) {
    bx.fillStyle = gray(Math.round(between(rnd, 104, 152)), 0.32)
    const s = between(rnd, 1.6, 3.2) * k
    bx.fillRect(center[0] + between(rnd, -R * 1.2, R * 1.2), center[1] + between(rnd, -R * 1.2, R * 1.2), s, s)
  }
  // brilho de mica: pontinhos que cintilam (liso e metálico no mapa de brilho)
  const mica = Math.round((R * R) / 170)
  for (let i = 0; i < mica; i++) {
    const x = center[0] + between(rnd, -R, R), y = center[1] + between(rnd, -R, R), s = between(rnd, 1, 2.4) * k
    cx.fillStyle = 'rgba(255, 255, 255, 0.92)'; cx.fillRect(x, y, s, s)
    rx.fillStyle = 'rgb(0, 30, 255)'; rx.fillRect(x - k, y - k, s + 2 * k, s + 2 * k)
  }
  // veios de quartzo cruzando a face
  const veins = 1 + (rnd() < 0.55 ? 1 : 0)
  for (let v = 0; v < veins; v++) {
    const a = lerp2(poly[Math.floor(rnd() * poly.length)], center, between(rnd, 0, 0.2)), b = lerp2(poly[Math.floor(rnd() * poly.length)], center, between(rnd, 0, 0.2))
    const path = jagged(a, b, rnd, 12 * k, 14 * k)
    cx.lineJoin = 'round'
    cx.strokeStyle = 'rgba(10, 10, 14, 0.35)'; cx.lineWidth = 6 * k; lineTo(cx, path.map(([x, y]): V2 => [x + 2 * k, y + 2 * k])); cx.stroke()
    cx.strokeStyle = rgba('#efe9da', between(rnd, 0.38, 0.55)); cx.lineWidth = between(rnd, 2.4, 5) * k; lineTo(cx, path); cx.stroke()
    bx.strokeStyle = gray(178, 0.6); bx.lineWidth = 5 * k; lineTo(bx, path); bx.stroke()
  }
  // furos e cavidades
  const pits = Math.round((R * R) / 2400)
  for (let i = 0; i < pits; i++) {
    const x = center[0] + between(rnd, -R, R), y = center[1] + between(rnd, -R, R), r = between(rnd, 1.6, 5) * k, rot = rnd() * 3
    cx.fillStyle = 'rgba(8, 9, 12, 0.62)'; cx.beginPath(); cx.ellipse(x, y, r, r * 0.7, rot, 0, Math.PI * 2); cx.fill()
    cx.strokeStyle = 'rgba(255, 255, 255, 0.22)'; cx.lineWidth = k; cx.beginPath(); cx.ellipse(x + k, y + k, r, r * 0.7, rot, 0.2, 2.4); cx.stroke()
    bx.fillStyle = gray(48); bx.beginPath(); bx.ellipse(x, y, r * 1.2, r * 0.85, rot, 0, Math.PI * 2); bx.fill()
  }
  // quinas lascadas: pedra fresca, mais clara e áspera
  const chips = rnd() < 0.6 ? 2 : 1
  for (let c = 0; c < chips; c++) {
    const { shape, edge } = chipShape(f, rnd, 0.75)
    cx.fillStyle = rgba(shade(skin.body, 0.22), 0.9); lineTo(cx, shape); cx.closePath(); cx.fill()
    for (let s = 0; s < 260; s++) {
      const p = lerp2(shape[0], edge[Math.floor(rnd() * edge.length)], rnd())
      cx.fillStyle = rgba(rnd() < 0.5 ? '#ffffff' : '#2a2c32', 0.28); cx.fillRect(p[0], p[1], between(rnd, 0.8, 2) * k, between(rnd, 0.8, 2) * k)
    }
    cx.strokeStyle = 'rgba(8, 9, 12, 0.7)'; cx.lineWidth = 2.4 * k; lineTo(cx, edge); cx.stroke()
    bx.fillStyle = gray(58); lineTo(bx, shape); bx.closePath(); bx.fill()
    bx.strokeStyle = gray(210, 0.8); bx.lineWidth = 2.4 * k; lineTo(bx, edge); bx.stroke()
  }
  // quina lapidada: fio claro na borda e sombra por dentro
  cx.lineJoin = 'round'
  cx.strokeStyle = 'rgba(214, 216, 220, 0.34)'; cx.lineWidth = 7 * k; polyPath(cx, poly, center, 0.012); cx.stroke()
  cx.strokeStyle = 'rgba(6, 7, 9, 0.42)'; cx.lineWidth = 6 * k; polyPath(cx, poly, center, 0.05); cx.stroke()
  bx.strokeStyle = gray(200, 0.6); bx.lineWidth = 8 * k; polyPath(bx, poly, center, 0.012); bx.stroke()
  unclip(cx, bx, rx)
  cx.strokeStyle = 'rgba(0, 0, 0, 0.55)'; cx.lineWidth = 7 * k; polyPath(cx, poly, center, -0.06); cx.stroke()
}

/** Número entalhado com cinzel: fundo e escuro, com o fio de baixo iluminado. */
function stoneNumber(f: FacePaint, text: string, x: number, y: number, angle: number, px: number, underline: boolean): void {
  const { cx, bx, k } = f
  const font = `700 ${Math.round(px * 1.02)}px "EB Garamond", "Cormorant Garamond", Georgia, serif`
  const d = Math.max(1.6, px * 0.028)
  for (const c of [cx, bx]) {
    c.save(); c.translate(x, y); c.rotate(angle); c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'
  }
  // relevo: borda levantada em volta, vala funda no meio
  bx.strokeStyle = gray(182, 0.7); bx.lineWidth = px * 0.1; bx.strokeText(text, 0, 0)
  bx.strokeStyle = gray(30); bx.lineWidth = Math.max(2 * k, px * 0.035); bx.fillStyle = gray(30); bx.strokeText(text, 0, 0); bx.fillText(text, 0, 0)
  // cor: fio de luz embaixo à direita, o fundo escuro e a sombra do lado de cima
  cx.fillStyle = 'rgba(255, 255, 255, 0.3)'; cx.fillText(text, d, d)
  cx.fillStyle = skinInk(f); cx.fillText(text, 0, 0)
  cx.fillStyle = 'rgba(0, 0, 0, 0.5)'; cx.fillText(text, -d * 0.6, -d * 0.6)
  cx.fillStyle = skinInk(f); cx.globalAlpha = 0.7; cx.fillText(text, d * 0.3, d * 0.3); cx.globalAlpha = 1
  if (underline) {
    const w = px * 0.56, h = Math.max(2 * k, px * 0.07), yy = px * 0.45
    cx.fillStyle = skinInk(f); cx.fillRect(-w / 2, yy, w, h); bx.fillStyle = gray(30); bx.fillRect(-w / 2, yy, w, h)
  }
  for (const c of [cx, bx]) c.restore()
}
const skinInk = (f: FacePaint) => f.skin.ink

// ── Plástico marmorizado ────────────────────────────────

function plasticFace(f: FacePaint): void {
  const { cx, bx, rx, poly, center, radius: R, rnd, k, skin } = f
  clipFace(f, cx, bx, rx)
  const box = [center[0] - R * 1.6, center[1] - R * 1.6, R * 3.2, R * 3.2] as const
  const bg = cx.createRadialGradient(center[0], center[1] - R * 0.25, R * 0.1, center[0], center[1], R * 1.15)
  bg.addColorStop(0, shade(skin.body, 0.12)); bg.addColorStop(1, skin.bodyEdge)
  cx.fillStyle = bg; cx.fillRect(...box)
  rx.fillStyle = 'rgb(0, 30, 0)'; rx.fillRect(...box)

  // marmorizado: manchas grandes e macias, e fitas de cores que se misturam
  const colors = ['#ffffff', '#8fdcff', '#27c9c2', '#0a2a8c', '#6d8cff', '#ffffff']
  for (let i = 0; i < 9; i++) {
    const c: V2 = [center[0] + between(rnd, -R, R), center[1] + between(rnd, -R, R)], r = R * between(rnd, 0.3, 0.8)
    const g = cx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r)
    const col = colors[Math.floor(rnd() * colors.length)]
    g.addColorStop(0, rgba(col, between(rnd, 0.14, 0.3))); g.addColorStop(1, rgba(col, 0))
    cx.fillStyle = g; cx.fillRect(c[0] - r, c[1] - r, r * 2, r * 2)
  }
  cx.lineCap = 'round'
  for (let i = 0; i < 7; i++) {
    const p = (): V2 => [center[0] + between(rnd, -R * 1.1, R * 1.1), center[1] + between(rnd, -R * 1.1, R * 1.1)]
    const a = p(), c1 = p(), c2 = p(), b = p()
    const col = colors[Math.floor(rnd() * colors.length)], w = R * between(rnd, 0.16, 0.42)
    for (let pass = 0; pass < 8; pass++) {          // várias passadas, cada uma mais fina, para a borda da fita ficar macia
      cx.strokeStyle = rgba(col, 0.045 + pass * 0.008); cx.lineWidth = w * (1 - pass * 0.115)
      cx.beginPath(); cx.moveTo(...a); cx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], b[0], b[1]); cx.stroke()
    }
  }
  // brilho de dentro da resina e purpurina
  const glitter = Math.round((R * R) / 130)
  for (let i = 0; i < glitter; i++) {
    const s = between(rnd, 0.6, 1.5) * k
    cx.fillStyle = `rgba(255, 255, 255, ${between(rnd, 0.3, 0.9)})`
    cx.fillRect(center[0] + between(rnd, -R * 1.2, R * 1.2), center[1] + between(rnd, -R * 1.2, R * 1.2), s, s)
  }
  // bolhas de ar presas
  const bubbles = 3 + Math.floor(rnd() * 6)
  for (let i = 0; i < bubbles; i++) {
    const x = center[0] + between(rnd, -R * 0.9, R * 0.9), y = center[1] + between(rnd, -R * 0.9, R * 0.9), r = between(rnd, 1.6, 4.6) * k
    cx.fillStyle = 'rgba(255, 255, 255, 0.16)'; cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill()
    cx.strokeStyle = 'rgba(255, 255, 255, 0.75)'; cx.lineWidth = 0.9 * k; cx.beginPath(); cx.arc(x, y, r, 3.4, 5.3); cx.stroke()
    cx.strokeStyle = 'rgba(0, 10, 60, 0.5)'; cx.beginPath(); cx.arc(x, y, r, 0.3, 2.2); cx.stroke()
  }
  // reflexo da janela, macio, no alto da face
  const sheen = cx.createLinearGradient(center[0] - R, center[1] - R, center[0] + R * 0.2, center[1] + R * 0.5)
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.2)'); sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.04)'); sheen.addColorStop(1, 'rgba(255, 255, 255, 0)')
  cx.fillStyle = sheen; cx.fillRect(...box)
  // quina chanfrada: fio claro, faixa macia e sombra do lado de fora
  cx.lineJoin = 'round'
  cx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; cx.lineWidth = 16 * k; polyPath(cx, poly, center, 0.05); cx.stroke()
  cx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; cx.lineWidth = 5 * k; polyPath(cx, poly, center, 0.018); cx.stroke()
  cx.strokeStyle = 'rgba(0, 8, 50, 0.4)'; cx.lineWidth = 6 * k; polyPath(cx, poly, center, 0.06); cx.stroke()
  bx.strokeStyle = gray(200, 0.55); bx.lineWidth = 10 * k; polyPath(bx, poly, center, 0.02); bx.stroke()
  unclip(cx, bx, rx)
  cx.strokeStyle = 'rgba(0, 6, 40, 0.6)'; cx.lineWidth = 7 * k; polyPath(cx, poly, center, -0.06); cx.stroke()
}

/** Número pintado: tinta branca grossa num sulco raso, com a sombra do sulco e brilho de verniz. */
function plasticNumber(f: FacePaint, text: string, x: number, y: number, angle: number, px: number, underline: boolean): void {
  const { cx, bx, rx, k } = f
  const font = `800 ${Math.round(px * 1.04)}px "Arial Black", "Helvetica Neue", Arial, sans-serif`
  const d = Math.max(1.4, px * 0.03)
  for (const c of [cx, bx, rx]) {
    c.save(); c.translate(x, y); c.rotate(angle); c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'
  }
  bx.strokeStyle = gray(70); bx.lineWidth = px * 0.05; bx.fillStyle = gray(70); bx.strokeText(text, 0, 0); bx.fillText(text, 0, 0)
  cx.strokeStyle = 'rgba(0, 10, 70, 0.6)'; cx.lineWidth = px * 0.07; cx.strokeText(text, 0, 0)
  cx.fillStyle = 'rgba(0, 10, 70, 0.5)'; cx.fillText(text, -d, -d)
  cx.fillStyle = f.skin.ink; cx.fillText(text, 0, 0)
  const sheen = cx.createLinearGradient(0, -px * 0.5, 0, px * 0.5)
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.0)'); sheen.addColorStop(1, 'rgba(150, 175, 255, 0.35)')
  cx.fillStyle = sheen; cx.fillText(text, 0, 0)
  rx.fillStyle = 'rgb(0, 80, 0)'; rx.fillText(text, 0, 0)     // a tinta é um pouco mais fosca que a resina
  if (underline) {
    const w = px * 0.56, h = Math.max(2 * k, px * 0.075), yy = px * 0.45
    cx.fillStyle = f.skin.ink; cx.fillRect(-w / 2, yy, w, h); bx.fillStyle = gray(70); bx.fillRect(-w / 2, yy, w, h)
  }
  for (const c of [cx, bx, rx]) c.restore()
}

export const SURFACES: Record<NonNullable<DiceSkin['surface']>, Surface> = {
  wood:    { face: woodFace, number: woodNumber },
  stone:   { face: stoneFace, number: stoneNumber },
  plastic: { face: plasticFace, number: plasticNumber },
}
