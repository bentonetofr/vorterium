import {
  DIGIT_STROKES, between, chipShape, clipFace, crackPath, gray, jagged, lerp2, lineTo, polyPath, rgba, shade, unclip,
  type FacePaint, type Surface, type V2,
} from './dieSurfaces'

// ────────────────────────────────────────────────────────
// Os 20 conjuntos da coleção (conquistas): cada um com a sua superfície pintada em canvas (cor, relevo, brilho,
// opacidade na resina e luz própria), os seus números (entalhados, em relevo, pintados, de ouro, de carvão, em brasa...)
// e as suas marcas de uso. Tudo sai de sorteio com semente (o mesmo dado sai igual em qualquer aparelho).
// Ferramentas comuns no começo; um pintor por conjunto depois; PACK_SURFACES no fim.
// ────────────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D

export const ctxsOf = (f: FacePaint): Ctx[] => [f.cx, f.bx, f.rx, ...(f.gx ? [f.gx] : []), ...(f.tx ? [f.tx] : [])]
export const boxOf = (f: FacePaint) => [f.center[0] - f.radius * 1.6, f.center[1] - f.radius * 1.6, f.radius * 3.2, f.radius * 3.2] as const
export const rm = (rough: number, metal: number) => `rgb(0, ${Math.round(rough * 255)}, ${Math.round(metal * 255)})`
export const glowOf = (f: FacePaint, hex: string, a = 1) => rgba(hex, Math.min(1, a * f.skin.glowPower))
export const pick = <T,>(rnd: () => number, list: readonly T[]): T => list[Math.floor(rnd() * list.length)]
export const at = (f: FacePaint, spread = 1): V2 => [f.center[0] + between(f.rnd, -f.radius, f.radius) * spread, f.center[1] + between(f.rnd, -f.radius, f.radius) * spread]

export interface Base { top: string; bottom: string; rough: number; metal: number; lit?: number; /** Resina: opacidade no meio e nas bordas (cinza; mais claro = mais opaco). */ alpha?: [string, string] }

/** Abre a face: recorta, pinta o fundo (degradê), a rugosidade/metal base e, na resina, a opacidade (clara no meio, densa nas bordas). */
export function begin(f: FacePaint, o: Base): void {
  clipFace(f, ...ctxsOf(f))
  const { cx, rx, tx, center, radius: R } = f
  const g = cx.createRadialGradient(center[0], center[1] - R * (o.lit ?? 0.2), R * 0.1, center[0], center[1], R * 1.15)
  g.addColorStop(0, o.top); g.addColorStop(1, o.bottom)
  cx.fillStyle = g; cx.fillRect(...boxOf(f))
  rx.fillStyle = rm(o.rough, o.metal); rx.fillRect(...boxOf(f))
  if (tx) {
    const e = tx.createRadialGradient(center[0], center[1], R * 0.35, center[0], center[1], R * 1.05)
    e.addColorStop(0, o.alpha?.[0] ?? '#383838'); e.addColorStop(1, o.alpha?.[1] ?? '#8c8c8c')
    tx.fillStyle = e; tx.fillRect(...boxOf(f))
  }
}

/** Fecha a face: solta o recorte e escurece a borda de fora (a junta entre as faces). */
export function end(f: FacePaint): void {
  unclip(...ctxsOf(f))
  f.cx.strokeStyle = 'rgba(0, 0, 0, 0.5)'; f.cx.lineWidth = 7 * f.k; polyPath(f.cx, f.poly, f.center, -0.06); f.cx.stroke()
}

/** Manchas macias de cor. */
export function blobs(f: FacePaint, cols: string[], n: number, r0: number, r1: number, a0: number, a1: number): void {
  const { cx, rnd, radius: R } = f
  for (let i = 0; i < n; i++) {
    const c = at(f), r = R * between(rnd, r0, r1), col = pick(rnd, cols)
    const g = cx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r)
    g.addColorStop(0, rgba(col, between(rnd, a0, a1))); g.addColorStop(1, rgba(col, 0))
    cx.fillStyle = g; cx.fillRect(c[0] - r, c[1] - r, r * 2, r * 2)
  }
}

/** Grão: pontinhos e manchinhas (palette = cor e opacidade). `bump`: opacidade do relevo (grão áspero). */
export function grains(f: FacePaint, palette: [string, number][], dens: number, s0: number, s1: number, bump = 0): void {
  const { cx, bx, rnd, radius: R, k } = f
  const n = Math.round((R * R) / dens)
  for (let i = 0; i < n; i++) {
    const [col, a] = pick(rnd, palette), s = between(rnd, s0, s1) * k, p = at(f, 1.2)
    cx.fillStyle = rgba(col, a)
    if (s > 1.1 * k) { cx.beginPath(); cx.ellipse(p[0], p[1], s, s * between(rnd, 0.55, 1), rnd() * 3, 0, Math.PI * 2); cx.fill() } else cx.fillRect(p[0], p[1], s, s)
    if (bump > 0) { bx.fillStyle = gray(rnd() < 0.5 ? 100 : 160, bump); bx.fillRect(p[0], p[1], s, s) }
  }
}

/** Fibras e riscos numa direção (veio, fibra, escova). `bump` deixa um sulco leve no relevo. */
export function fibers(f: FacePaint, color: string, n: number, angle: number, l0: number, l1: number, w0: number, w1: number, a0: number, a1: number, bump = 0): void {
  const { cx, bx, rnd, k } = f
  cx.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    const p = at(f, 1.25), a = angle + (rnd() - 0.5) * 0.35, l = between(rnd, l0, l1) * k
    const q: V2 = [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l]
    cx.strokeStyle = rgba(color, between(rnd, a0, a1)); cx.lineWidth = between(rnd, w0, w1) * k
    cx.beginPath(); cx.moveTo(...p); cx.lineTo(...q); cx.stroke()
    if (bump > 0) { bx.strokeStyle = gray(rnd() < 0.5 ? 70 : 190, bump); bx.lineWidth = cx.lineWidth * 0.8; bx.beginPath(); bx.moveTo(...p); bx.lineTo(...q); bx.stroke() }
  }
}

/** Riscos finos de uso, em qualquer direção. */
export function scratches(f: FacePaint, n: number, color = '#ffffff', a = 0.3): void {
  fibers(f, color, n, f.rnd() * Math.PI, 12, 46, 0.5, 1.1, a * 0.6, a, 0.15)
  for (let i = 0; i < n * 0.4; i++) fibers(f, color, 1, f.rnd() * Math.PI * 2, 16, 70, 0.5, 0.9, a * 0.5, a, 0.12)
}

/** Caminho de veio cruzando a face. */
export function veinPath(f: FacePaint, amp = 12, step = 14): V2[] {
  const { poly, center, rnd, k } = f
  const a = lerp2(poly[Math.floor(rnd() * poly.length)], center, between(rnd, 0, 0.25)), b = lerp2(poly[Math.floor(rnd() * poly.length)], center, between(rnd, 0, 0.25))
  return jagged(a, b, rnd, amp * k, step * k)
}

/** Um veio (com sombra) e, se pedido, relevo. */
export function vein(f: FacePaint, path: V2[], main: string, shadow: string, w: number, bump?: number): void {
  const { cx, bx, k } = f
  cx.lineJoin = 'round'; cx.lineCap = 'round'
  cx.strokeStyle = shadow; cx.lineWidth = w * 2.4 * k; lineTo(cx, path.map(([x, y]): V2 => [x + 1.6 * k, y + 1.6 * k])); cx.stroke()
  cx.strokeStyle = main; cx.lineWidth = w * k; lineTo(cx, path); cx.stroke()
  if (bump !== undefined) { bx.strokeStyle = gray(bump, 0.65); bx.lineWidth = w * k * 1.2; lineTo(bx, path); bx.stroke() }
}

/** Veio com ramificações. */
export function veinTree(f: FacePaint, main: string, shadow: string, w: number, branches: number, bump?: number): V2[] {
  const { rnd, k } = f
  const trunk = veinPath(f)
  vein(f, trunk, main, shadow, w, bump)
  for (let i = 0; i < branches; i++) {
    const j = 1 + Math.floor(rnd() * (trunk.length - 2)), p = trunk[j], nx = trunk[j + 1]
    const ang = Math.atan2(nx[1] - p[1], nx[0] - p[0]) + (rnd() < 0.5 ? 1 : -1) * between(rnd, 0.5, 1.1), len = f.radius * between(rnd, 0.15, 0.4)
    vein(f, jagged(p, [p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len], rnd, 5 * k, 9 * k), main, shadow, w * 0.55, bump)
  }
  return trunk
}

/** Bolhas de ar presas. */
export function bubbles(f: FacePaint, n: number, r0: number, r1: number, tint = '255, 255, 255'): void {
  const { cx, rnd, radius: R, k } = f
  for (let i = 0; i < n; i++) {
    const p = at(f, 0.9), r = between(rnd, r0, r1) * k
    cx.fillStyle = `rgba(${tint}, 0.14)`; cx.beginPath(); cx.arc(p[0], p[1], r, 0, Math.PI * 2); cx.fill()
    cx.strokeStyle = `rgba(${tint}, 0.8)`; cx.lineWidth = Math.max(0.8, r * 0.18); cx.beginPath(); cx.arc(p[0], p[1], r, 3.4, 5.3); cx.stroke()
    cx.strokeStyle = 'rgba(0, 0, 0, 0.35)'; cx.beginPath(); cx.arc(p[0], p[1], r, 0.3, 2.2); cx.stroke()
  }
  void R
}

/** Covinhas de martelo ou de impacto. */
export function dents(f: FacePaint, n: number, r0: number, r1: number, light: string, dark: string): void {
  const { cx, bx, rnd, k } = f
  for (let i = 0; i < n; i++) {
    const p = at(f, 1.1), r = between(rnd, r0, r1) * k, rot = rnd() * 3
    const g = cx.createRadialGradient(p[0] + r * 0.25, p[1] + r * 0.25, 0, p[0], p[1], r)
    g.addColorStop(0, rgba(dark, 0.4)); g.addColorStop(0.75, rgba(dark, 0.12)); g.addColorStop(1, rgba(light, 0.28))
    cx.fillStyle = g; cx.beginPath(); cx.ellipse(p[0], p[1], r, r * 0.8, rot, 0, Math.PI * 2); cx.fill()
    const b = bx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r)
    b.addColorStop(0, gray(70, 0.85)); b.addColorStop(0.8, gray(110, 0.3)); b.addColorStop(1, gray(200, 0.45))
    bx.fillStyle = b; bx.beginPath(); bx.ellipse(p[0], p[1], r, r * 0.8, rot, 0, Math.PI * 2); bx.fill()
  }
}

/** Rachaduras (com uma ramificação), na cor dada. `glow`: luz saindo da fenda. */
export function cracks(f: FacePaint, count: number, dark: string, light: string, w = 3.2, glow?: string): void {
  const { cx, bx, gx, rnd, k } = f
  for (let c = 0; c < count; c++) {
    const pts = crackPath(f, rnd)
    const bi = Math.floor(pts.length * between(rnd, 0.3, 0.7)), bp = pts[bi], nx = pts[Math.min(bi + 1, pts.length - 1)]
    const bd = Math.atan2(nx[1] - bp[1], nx[0] - bp[0]) + (rnd() < 0.5 ? 0.9 : -0.9), bl = f.radius * between(rnd, 0.15, 0.35)
    const branch = jagged(bp, [bp[0] + Math.cos(bd) * bl, bp[1] + Math.sin(bd) * bl], rnd, 4 * k, 9 * k)
    for (const path of [pts, branch]) {
      const t = path === pts ? 1 : 0.55
      cx.lineJoin = 'round'
      bx.strokeStyle = gray(22, 0.95); bx.lineWidth = 7 * k * t; lineTo(bx, path); bx.stroke()
      if (glow && gx) {
        gx.strokeStyle = glowOf(f, glow, 0.45); gx.lineWidth = w * 3.4 * k * t; lineTo(gx, path); gx.stroke()
        gx.strokeStyle = glowOf(f, glow, 1); gx.lineWidth = w * 1.4 * k * t; lineTo(gx, path); gx.stroke()
        cx.strokeStyle = rgba(glow, 0.85); cx.lineWidth = w * 1.1 * k * t; lineTo(cx, path); cx.stroke()
      } else {
        cx.strokeStyle = dark; cx.lineWidth = between(rnd, w * 0.8, w * 1.3) * k * t; lineTo(cx, path); cx.stroke()
        cx.strokeStyle = light; cx.lineWidth = 1.2 * k; lineTo(cx, path.map(([x, y]): V2 => [x + 1.8 * k, y + 1.8 * k])); cx.stroke()
      }
    }
  }
}

/** Quina: fio claro na borda e sombra por dentro (e relevo clareado). */
export function rim(f: FacePaint, light: string, dark: string, widthLight = 7, widthDark = 6): void {
  const { cx, bx, poly, center, k } = f
  cx.lineJoin = 'round'
  cx.strokeStyle = light; cx.lineWidth = widthLight * k; polyPath(cx, poly, center, 0.012); cx.stroke()
  cx.strokeStyle = dark; cx.lineWidth = widthDark * k; polyPath(cx, poly, center, 0.05); cx.stroke()
  bx.strokeStyle = gray(200, 0.6); bx.lineWidth = 8 * k; polyPath(bx, poly, center, 0.012); bx.stroke()
}

/** Lasca num canto: o material de dentro, claro e áspero. */
export function chip(f: FacePaint, inner: string, size = 0.8): void {
  const { cx, bx, rnd, k } = f
  const { shape, edge } = chipShape(f, rnd, size)
  cx.fillStyle = inner; lineTo(cx, shape); cx.closePath(); cx.fill()
  cx.strokeStyle = 'rgba(0, 0, 0, 0.7)'; cx.lineWidth = 2.4 * k; lineTo(cx, edge); cx.stroke()
  bx.fillStyle = gray(60); lineTo(bx, shape); bx.closePath(); bx.fill()
  bx.strokeStyle = gray(210, 0.8); bx.lineWidth = 2.4 * k; lineTo(bx, edge); bx.stroke()
}

/** Brilho de janela, macio, no alto da face (vidro, resina, pedra polida). */
export function sheen(f: FacePaint, a = 0.2): void {
  const { cx, center, radius: R } = f
  const g = cx.createLinearGradient(center[0] - R, center[1] - R, center[0] + R * 0.2, center[1] + R * 0.5)
  g.addColorStop(0, `rgba(255, 255, 255, ${a})`); g.addColorStop(0.5, `rgba(255, 255, 255, ${a * 0.2})`); g.addColorStop(1, 'rgba(255, 255, 255, 0)')
  cx.fillStyle = g; cx.fillRect(...boxOf(f))
}

/** Escurece para as bordas (uso e sombra). */
export function vignette(f: FacePaint, color: string, edge = 0.6): void {
  const { cx, center, radius: R } = f
  const g = cx.createRadialGradient(center[0], center[1], R * 0.3, center[0], center[1], R * 1.12)
  g.addColorStop(0, rgba(color, 0)); g.addColorStop(1, rgba(color, edge))
  cx.fillStyle = g; cx.fillRect(...boxOf(f))
}

// ── Números ─────────────────────────────────────────────

export interface NumStyle {
  mode: 'cut' | 'raise' | 'paint'
  fill: string | [string, string]
  family?: string
  weight?: number
  hi?: string
  lo?: string
  stroke?: string
  rough?: number
  metal?: number
  glow?: string
  glowAlpha?: number
}

export const SERIF = '"EB Garamond", "Cormorant Garamond", Georgia, serif'

/** Um número no estilo do material: entalhado (cut), em relevo (raise) ou pintado (paint), com brilho próprio e opacidade (resina). */
export function num(f: FacePaint, text: string, x: number, y: number, angle: number, px: number, underline: boolean, s: NumStyle): void {
  const { cx, bx, rx, gx, tx, k } = f
  const font = `${s.weight ?? 700} ${Math.round(px * 1.02)}px ${s.family ?? SERIF}`
  const list = ctxsOf(f)
  for (const c of list) { c.save(); c.translate(x, y); c.rotate(angle); c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round' }
  const d = Math.max(1.6, px * 0.03)
  let fill: string | CanvasGradient
  if (typeof s.fill === 'string') fill = s.fill
  else { const g = cx.createLinearGradient(0, -px * 0.5, 0, px * 0.5); g.addColorStop(0, s.fill[0]); g.addColorStop(1, s.fill[1]); fill = g }

  if (s.mode === 'cut') {
    bx.strokeStyle = gray(182, 0.7); bx.lineWidth = px * 0.1; bx.strokeText(text, 0, 0)
    bx.strokeStyle = gray(30); bx.lineWidth = Math.max(2 * k, px * 0.035); bx.fillStyle = gray(30); bx.strokeText(text, 0, 0); bx.fillText(text, 0, 0)
    cx.fillStyle = s.hi ?? 'rgba(255, 255, 255, 0.3)'; cx.fillText(text, d, d)
    cx.fillStyle = fill; cx.fillText(text, 0, 0)
    cx.fillStyle = s.lo ?? 'rgba(0, 0, 0, 0.5)'; cx.fillText(text, -d * 0.6, -d * 0.6)
    cx.fillStyle = fill; cx.globalAlpha = 0.7; cx.fillText(text, d * 0.3, d * 0.3); cx.globalAlpha = 1
  } else if (s.mode === 'raise') {
    bx.strokeStyle = gray(66, 0.75); bx.lineWidth = px * 0.11; bx.strokeText(text, 0, 0)
    bx.strokeStyle = gray(228); bx.fillStyle = gray(228); bx.lineWidth = Math.max(2 * k, px * 0.03); bx.strokeText(text, 0, 0); bx.fillText(text, 0, 0)
    cx.strokeStyle = s.lo ?? 'rgba(0, 0, 0, 0.55)'; cx.lineWidth = px * 0.08; cx.strokeText(text, d, d)
    cx.fillStyle = fill; cx.fillText(text, 0, 0)
    cx.globalAlpha = 0.55; cx.strokeStyle = s.hi ?? 'rgba(255, 255, 255, 0.5)'; cx.lineWidth = d * 0.9; cx.strokeText(text, -d * 0.45, -d * 0.45); cx.globalAlpha = 1
  } else {
    bx.fillStyle = gray(150); bx.fillText(text, 0, 0)
    cx.strokeStyle = s.stroke ?? 'rgba(0, 0, 0, 0.5)'; cx.lineWidth = px * 0.08; cx.strokeText(text, 0, 0)
    cx.fillStyle = fill; cx.fillText(text, 0, 0)
    cx.globalAlpha = 0.35; cx.fillStyle = s.hi ?? 'rgba(255, 255, 255, 0.6)'; cx.fillText(text, -d * 0.4, -d * 0.4); cx.globalAlpha = 1
  }
  rx.fillStyle = rm(s.rough ?? Math.min(1, f.skin.roughness + 0.05), s.metal ?? f.skin.metalness); rx.fillText(text, 0, 0)
  if (gx && s.glow) {
    gx.shadowColor = s.glow; gx.shadowBlur = px * 0.2
    gx.fillStyle = glowOf(f, s.glow, s.glowAlpha ?? 1); gx.fillText(text, 0, 0); gx.fillText(text, 0, 0)
  }
  if (tx) { tx.fillStyle = '#fff'; tx.strokeStyle = '#fff'; tx.lineWidth = px * 0.15; tx.strokeText(text, 0, 0); tx.fillText(text, 0, 0) }
  if (underline) {
    const w = px * 0.56, h = Math.max(2 * k, px * 0.07), yy = px * 0.45
    cx.fillStyle = fill; cx.fillRect(-w / 2, yy, w, h)
    bx.fillStyle = gray(s.mode === 'raise' ? 228 : 40); bx.fillRect(-w / 2, yy, w, h)
    if (gx && s.glow) { gx.fillStyle = glowOf(f, s.glow); gx.fillRect(-w / 2, yy, w, h) }
    if (tx) { tx.fillStyle = '#fff'; tx.fillRect(-w / 2, yy, w, h) }
  }
  for (const c of list) c.restore()
}

/** Número à mão, em traços retos (giz, carvão, argila): cada traço com a cor, uma sombra e um sulco leve. */
export function handNum(f: FacePaint, text: string, x: number, y: number, angle: number, px: number, underline: boolean, color: string, shadow: string, widthK = 0.1, deep = false): void {
  const { cx, bx, rx, rnd, k } = f
  const H = px * 0.82, gw = H * 0.6, gap = H * 0.3
  const total = text.length * gw + (text.length - 1) * gap
  const stroke = (pts: V2[]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const w = Math.max(2.4 * k, H * widthK * between(rnd, 0.85, 1.2)), seg = [pts[i], pts[i + 1]]
      cx.lineCap = 'round'
      cx.strokeStyle = shadow; cx.lineWidth = w * 1.9; lineTo(cx, seg); cx.stroke()
      cx.strokeStyle = color; cx.lineWidth = w; lineTo(cx, seg); cx.stroke()
      bx.lineCap = 'round'
      bx.strokeStyle = deep ? gray(36) : gray(150); bx.lineWidth = w; lineTo(bx, seg); bx.stroke()
    }
  }
  for (const c of [cx, bx, rx]) { c.save(); c.translate(x, y); c.rotate(angle + (rnd() - 0.5) * 0.25) }
  ;[...text].forEach((ch, i) => {
    const strokes = DIGIT_STROKES[ch]
    if (!strokes) return
    const sc = between(rnd, 0.9, 1.1), dx = -total / 2 + i * (gw + gap) + (rnd() - 0.5) * gap * 0.5, dy = (rnd() - 0.5) * H * 0.14
    const rot = (rnd() - 0.5) * 0.24, cs = Math.cos(rot), sn = Math.sin(rot)
    const place = ([u, v]: V2): V2 => {
      const lx = (u / 0.6 - 0.5) * gw * sc + (rnd() - 0.5) * H * 0.05, ly = -(v - 0.5) * H * sc + (rnd() - 0.5) * H * 0.05
      return [dx + gw / 2 + lx * cs - ly * sn, dy + lx * sn + ly * cs]
    }
    for (const s of strokes) stroke(s.map(place))
  })
  if (underline) stroke([[-gw * 0.6, H * 0.68], [gw * 0.6, H * 0.68 + (rnd() - 0.5) * H * 0.1]])
  for (const c of [cx, bx, rx]) c.restore()
}

// ── 1. Osso Entalhado ───────────────────────────────────

function boneFace(f: FacePaint): void {
  const { cx, bx, rnd, radius: R, k } = f
  begin(f, { top: '#f1e8d3', bottom: '#a58f66', rough: 0.72, metal: 0 })
  const ang = rnd() * Math.PI
  fibers(f, '#a98d5c', Math.round(R * R / 210), ang, 30, 120, 0.8, 2.1, 0.1, 0.28, 0.1)
  fibers(f, '#fff7e4', Math.round(R * R / 380), ang, 28, 100, 0.8, 1.7, 0.2, 0.42)
  blobs(f, ['#c8aa72', '#7a5a34', '#f8f1df'], 14, 0.2, 0.55, 0.06, 0.17)
  // canais da medula: tracinhos escuros com fio claro, no sentido do osso
  for (let i = 0; i < Math.round(R * R / 280); i++) {
    const p = at(f, 1.1), l = between(rnd, 3, 12) * k
    cx.strokeStyle = 'rgba(70, 44, 20, 0.5)'; cx.lineWidth = between(rnd, 0.8, 2.1) * k
    cx.beginPath(); cx.moveTo(...p); cx.lineTo(p[0] + Math.cos(ang) * l, p[1] + Math.sin(ang) * l); cx.stroke()
    bx.fillStyle = gray(70, 0.7); bx.fillRect(p[0], p[1], 2 * k, 2 * k)
  }
  for (let v = 0; v < 2; v++) vein(f, veinPath(f, 14), 'rgba(132, 96, 52, 0.55)', 'rgba(60, 38, 18, 0.25)', 2.4, 96)
  vignette(f, '#4a3418', 0.55)
  // marcas de dente nas quinas
  for (let c = 0; c < 2; c++) chip(f, '#d8c08f', 0.55)
  cracks(f, 1 + (rnd() < 0.5 ? 1 : 0), 'rgba(48, 28, 12, 0.95)', 'rgba(255, 244, 220, 0.3)', 2.8)
  rim(f, 'rgba(255, 248, 228, 0.42)', 'rgba(70, 45, 20, 0.45)')
  end(f)
}
const boneNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'cut', fill: '#3a2518', hi: 'rgba(255, 246, 225, 0.45)', lo: 'rgba(30, 14, 4, 0.6)', rough: 0.85, metal: 0 })

// ── 2. Ferro Enferrujado ────────────────────────────────

function ironFace(f: FacePaint): void {
  const { cx, bx, rx, rnd, radius: R, k, poly, center } = f
  begin(f, { top: '#4a4e55', bottom: '#1f2125', rough: 0.5, metal: 0.9 })
  fibers(f, '#8e939c', Math.round(R * R / 300), rnd() * Math.PI, 40, 160, 0.6, 1.4, 0.05, 0.16, 0.08)   // escova da lima
  dents(f, Math.round(R * R / 5200), 9, 26, '#9aa0aa', '#0c0d10')
  blobs(f, ['#0e0f12', '#6a6f78'], 9, 0.2, 0.5, 0.07, 0.18)
  // ferrugem: manchas laranja que crescem das quinas, e pontilhado
  const rust = ['#9a4a1c', '#b8631f', '#7a3512', '#cf7a2a']
  for (let i = 0; i < 6; i++) {
    const v = poly[Math.floor(rnd() * poly.length)], p = lerp2(v, center, between(rnd, 0, 0.4)), r = R * between(rnd, 0.25, 0.6)
    const g = cx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r)
    const col = pick(rnd, rust)
    g.addColorStop(0, rgba(col, between(rnd, 0.45, 0.8))); g.addColorStop(0.7, rgba(col, 0.2)); g.addColorStop(1, rgba(col, 0))
    cx.fillStyle = g; cx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2)
    rx.fillStyle = 'rgba(0, 235, 40, 0.5)'; rx.beginPath(); rx.arc(p[0], p[1], r * 0.8, 0, Math.PI * 2); rx.fill()   // a ferrugem é fosca
  }
  grains(f, [['#b8631f', 0.55], ['#7a3512', 0.6], ['#e0a05a', 0.3]], 90, 0.8, 2.4, 0.2)
  scratches(f, Math.round(R / 7), '#c9ced6', 0.3)
  // rebites nas pontas
  for (const v of poly) {
    const p = lerp2(v, center, 0.2), r = R * 0.075
    const g = cx.createRadialGradient(p[0] - r * 0.3, p[1] - r * 0.3, 0, p[0], p[1], r)
    g.addColorStop(0, '#d5d9e0'); g.addColorStop(1, '#2a2c31')
    cx.fillStyle = g; cx.beginPath(); cx.arc(p[0], p[1], r, 0, Math.PI * 2); cx.fill()
    cx.strokeStyle = 'rgba(0, 0, 0, 0.7)'; cx.lineWidth = 1.4 * k; cx.stroke()
    bx.fillStyle = gray(225); bx.beginPath(); bx.arc(p[0], p[1], r * 0.85, 0, Math.PI * 2); bx.fill()
  }
  chip(f, '#8a8f98', 0.6)
  rim(f, 'rgba(200, 206, 216, 0.4)', 'rgba(0, 0, 0, 0.55)')
  end(f)
}
const ironNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'raise', fill: ['#c7ccd4', '#7f858f'], hi: 'rgba(255, 255, 255, 0.55)', lo: 'rgba(120, 52, 14, 0.7)', rough: 0.35, metal: 1 })

// ── 3. Argila Cozida ────────────────────────────────────

function clayFace(f: FacePaint): void {
  const { cx, bx, rx, rnd, radius: R, k, center } = f
  begin(f, { top: '#c8774a', bottom: '#7c3b1f', rough: 0.82, metal: 0 })
  blobs(f, ['#e39a62', '#6e3018', '#a85a30', '#f0b27a'], 16, 0.2, 0.6, 0.08, 0.22)
  // digitais do oleiro: arcos concêntricos fracos
  const fc = at(f, 0.5)
  for (let i = 0; i < 9; i++) {
    cx.strokeStyle = 'rgba(70, 28, 10, 0.16)'; cx.lineWidth = 1.5 * k
    cx.beginPath(); cx.ellipse(fc[0], fc[1], (14 + i * 7) * k, (10 + i * 5.5) * k, 0.5, 0.4, 5.2); cx.stroke()
    bx.strokeStyle = gray(110, 0.35); bx.lineWidth = 1.5 * k; bx.beginPath(); bx.ellipse(fc[0], fc[1], (14 + i * 7) * k, (10 + i * 5.5) * k, 0.5, 0.4, 5.2); bx.stroke()
  }
  // chamote: grãos escuros e claros
  grains(f, [['#2a1208', 0.6], ['#f0c79a', 0.45], ['#5a2a14', 0.5]], 60, 0.8, 2.6, 0.25)
  // esmalte falhado: veias finas claras
  const glaze = '#e8c9a0'
  for (let i = 0; i < 5; i++) {
    const p = veinPath(f, 16, 12)
    cx.strokeStyle = rgba(glaze, 0.4); cx.lineWidth = 1.4 * k; lineTo(cx, p); cx.stroke()
    bx.strokeStyle = gray(70, 0.6); bx.lineWidth = 1.8 * k; lineTo(bx, p); bx.stroke()
  }
  // queimado: manchas escuras nas bordas
  vignette(f, '#1a0804', 0.6)
  for (let i = 0; i < 3; i++) {
    const p = at(f), r = R * between(rnd, 0.1, 0.25)
    cx.fillStyle = 'rgba(20, 8, 4, 0.4)'; cx.beginPath(); cx.ellipse(p[0], p[1], r, r * 0.6, rnd() * 3, 0, Math.PI * 2); cx.fill()
  }
  rx.fillStyle = 'rgba(0, 200, 0, 0.35)'; rx.beginPath(); rx.ellipse(center[0], center[1], R * 0.4, R * 0.3, 0.4, 0, Math.PI * 2); rx.fill()   // um trecho esmaltado, mais liso
  chip(f, '#b4693b', 0.7); chip(f, '#b4693b', 0.5)
  cracks(f, 1, 'rgba(36, 14, 6, 0.9)', 'rgba(255, 220, 180, 0.22)', 2.2)
  rim(f, 'rgba(240, 190, 140, 0.32)', 'rgba(40, 14, 4, 0.45)')
  end(f)
}
const clayNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  handNum(f, t, x, y, a, px, u, '#f5e4c4', 'rgba(60, 24, 8, 0.55)', 0.12)

// ── 4. Giz de Taverna ───────────────────────────────────

function chalkFace(f: FacePaint): void {
  const { cx, bx, rnd, radius: R, k, center } = f
  begin(f, { top: '#e7e4da', bottom: '#aaa699', rough: 0.96, metal: 0 })
  // camadas de sedimento: linhas levemente curvas
  const tilt = (rnd() - 0.5) * 0.5
  for (let i = -14; i <= 14; i++) {
    const y = center[1] + i * R * 0.09 + (rnd() - 0.5) * R * 0.04
    cx.strokeStyle = rgba(rnd() < 0.5 ? '#8f8a7a' : '#fffdf5', between(rnd, 0.1, 0.3)); cx.lineWidth = between(rnd, 0.8, 2.6) * k
    cx.beginPath(); cx.moveTo(center[0] - R * 1.3, y - tilt * R); cx.quadraticCurveTo(center[0], y + (rnd() - 0.5) * R * 0.1, center[0] + R * 1.3, y + tilt * R); cx.stroke()
    bx.strokeStyle = gray(rnd() < 0.5 ? 100 : 160, 0.22); bx.lineWidth = 1.6 * k
    bx.beginPath(); bx.moveTo(center[0] - R * 1.3, y - tilt * R); bx.quadraticCurveTo(center[0], y, center[0] + R * 1.3, y + tilt * R); bx.stroke()
  }
  blobs(f, ['#fffdf5', '#847f70', '#c9c5b6'], 12, 0.2, 0.6, 0.06, 0.16)
  grains(f, [['#ffffff', 0.5], ['#6e6a5c', 0.4], ['#bdb8a8', 0.5]], 38, 0.7, 2.2, 0.22)
  // um fóssil pequeno em espiral (em algumas faces)
  if (rnd() < 0.45) {
    const p = at(f, 0.6), r0 = R * between(rnd, 0.1, 0.17)
    cx.lineCap = 'round'
    for (let t = 0; t < 4.2 * Math.PI; t += 0.14) {
      const r = r0 * (t / (4.2 * Math.PI)), x = p[0] + Math.cos(t) * r, y = p[1] + Math.sin(t) * r * 0.9
      cx.fillStyle = 'rgba(110, 104, 88, 0.45)'; cx.beginPath(); cx.arc(x, y, Math.max(1, r0 * 0.06), 0, Math.PI * 2); cx.fill()
    }
  }
  scratches(f, Math.round(R / 5), '#ffffff', 0.4)
  vignette(f, '#4b4738', 0.4)
  chip(f, '#f4f2ea', 0.8); chip(f, '#f4f2ea', 0.55)
  cracks(f, 1, 'rgba(60, 56, 44, 0.8)', 'rgba(255, 255, 255, 0.35)', 2)
  rim(f, 'rgba(255, 253, 244, 0.35)', 'rgba(60, 56, 44, 0.35)')
  end(f)
}
const chalkNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  handNum(f, t, x, y, a, px, u, '#1c1b1d', 'rgba(50, 48, 44, 0.45)', 0.13)

// ── 5. Cobre Oxidado ────────────────────────────────────

function copperFace(f: FacePaint): void {
  const { cx, rx, rnd, radius: R, k, poly, center } = f
  begin(f, { top: '#d58450', bottom: '#6e3418', rough: 0.4, metal: 0.88 })
  fibers(f, '#f0b080', Math.round(R * R / 260), rnd() * Math.PI, 40, 150, 0.6, 1.5, 0.06, 0.2, 0.06)
  dents(f, Math.round(R * R / 1100), 5, 15, '#f0a070', '#3a1608')    // martelado
  blobs(f, ['#3a1608', '#e89a60', '#8a4020'], 10, 0.2, 0.5, 0.07, 0.2)
  // verdete: azul-esverdeado crescendo das quinas
  const pat = ['#2f9c8a', '#4cc0a8', '#1f7a6c', '#7fd8c0']
  for (let i = 0; i < 6; i++) {
    const v = poly[Math.floor(rnd() * poly.length)], p = lerp2(v, center, between(rnd, 0, 0.35)), r = R * between(rnd, 0.22, 0.55)
    const g = cx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r)
    const col = pick(rnd, pat)
    g.addColorStop(0, rgba(col, between(rnd, 0.6, 0.9))); g.addColorStop(0.7, rgba(col, 0.28)); g.addColorStop(1, rgba(col, 0))
    cx.fillStyle = g; cx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2)
    rx.fillStyle = 'rgba(0, 225, 30, 0.55)'; rx.beginPath(); rx.arc(p[0], p[1], r * 0.8, 0, Math.PI * 2); rx.fill()
  }
  grains(f, [['#4cc0a8', 0.6], ['#1f7a6c', 0.6], ['#f0b080', 0.4]], 80, 0.8, 2.4, 0.2)
  scratches(f, Math.round(R / 6), '#ffd0a8', 0.35)
  chip(f, '#e0a070', 0.55)
  rim(f, 'rgba(255, 200, 150, 0.45)', 'rgba(50, 20, 8, 0.5)')
  end(f)
  void k
}
const copperNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'cut', fill: '#3a1c0e', hi: 'rgba(255, 190, 140, 0.65)', lo: 'rgba(20, 8, 2, 0.6)', rough: 0.5, metal: 0.8 })

// ── 6. Marfim Antigo ────────────────────────────────────

function ivoryFace(f: FacePaint): void {
  const { cx, bx, radius: R, k, center } = f
  begin(f, { top: '#f1e6c8', bottom: '#c3a56a', rough: 0.45, metal: 0, lit: 0.3 })
  // grão cruzado do marfim (linhas em arco que se cruzam)
  for (let s = 0; s < 2; s++) {
    for (let i = -10; i <= 10; i++) {
      cx.strokeStyle = 'rgba(150, 112, 56, 0.16)'; cx.lineWidth = 1.2 * k
      cx.beginPath(); cx.ellipse(center[0] + (s ? -1 : 1) * R * 1.4, center[1], R * (1.2 + i * 0.07), R * (1.7 + i * 0.1), 0, 0, Math.PI * 2); cx.stroke()
    }
  }
  blobs(f, ['#b48a44', '#fff8e4', '#8a6430'], 14, 0.2, 0.55, 0.05, 0.16)
  // craquelê fino
  for (let i = 0; i < 9; i++) {
    const p = veinPath(f, 10, 10)
    cx.strokeStyle = 'rgba(86, 58, 26, 0.45)'; cx.lineWidth = 1 * k; lineTo(cx, p); cx.stroke()
    bx.strokeStyle = gray(80, 0.55); bx.lineWidth = 1.4 * k; lineTo(bx, p); bx.stroke()
  }
  grains(f, [['#7a5428', 0.4], ['#fff8e4', 0.4]], 120, 0.7, 1.8, 0.1)
  vignette(f, '#7a5a22', 0.6)      // o tom de nicotina nas quinas
  sheen(f, 0.2)
  cracks(f, 1, 'rgba(56, 34, 14, 0.85)', 'rgba(255, 246, 220, 0.3)', 2)
  chip(f, '#f7edd2', 0.5)
  rim(f, 'rgba(255, 248, 228, 0.5)', 'rgba(110, 76, 30, 0.4)')
  end(f)
}
function ivoryNumber(f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean): void {
  num(f, t, x, y, a, px, u, { mode: 'paint', fill: '#16110d', stroke: 'rgba(110, 76, 30, 0.35)', hi: 'rgba(255, 255, 255, 0.25)', rough: 0.35 })
  // pontilhado em volta, como tinta de nanquim
  const { cx, rnd, k } = f
  cx.save(); cx.translate(x, y); cx.rotate(a)
  for (let i = 0; i < 26; i++) {
    const ang = rnd() * Math.PI * 2, r = px * between(rnd, 0.55, 0.8)
    cx.fillStyle = 'rgba(22, 17, 13, 0.55)'; cx.beginPath(); cx.arc(Math.cos(ang) * r * 0.9, Math.sin(ang) * r * 0.7, between(rnd, 0.8, 1.7) * k, 0, Math.PI * 2); cx.fill()
  }
  cx.restore()
}

// ── 7. Ônix Polido ──────────────────────────────────────

function onyxFace(f: FacePaint): void {
  const { cx, bx, rx, rnd, radius: R, k } = f
  begin(f, { top: '#1b1b21', bottom: '#050507', rough: 0.1, metal: 0.18, lit: 0.35 })
  blobs(f, ['#3a3a46', '#000000', '#2a2a34'], 8, 0.3, 0.7, 0.1, 0.26)
  // veios brancos finos, com ramos
  const veins = 1 + Math.floor(rnd() * 2)
  for (let v = 0; v < veins; v++) {
    const trunk = veinTree(f, 'rgba(236, 236, 244, 0.85)', 'rgba(120, 120, 150, 0.3)', 1.9, 4, 150)
    rx.strokeStyle = 'rgb(0, 18, 60)'; rx.lineWidth = 4 * k; lineTo(rx, trunk); rx.stroke()
  }
  grains(f, [['#ffffff', 0.5], ['#7c7c8a', 0.35]], 520, 0.6, 1.4, 0)
  // reflexo de espelho: dois fachos diagonais
  const g = cx.createLinearGradient(f.center[0] - R, f.center[1] - R, f.center[0] + R, f.center[1] + R)
  g.addColorStop(0.3, 'rgba(255, 255, 255, 0)'); g.addColorStop(0.42, 'rgba(255, 255, 255, 0.14)'); g.addColorStop(0.5, 'rgba(255, 255, 255, 0)'); g.addColorStop(0.62, 'rgba(255, 255, 255, 0.07)'); g.addColorStop(0.7, 'rgba(255, 255, 255, 0)')
  cx.fillStyle = g; cx.fillRect(...boxOf(f))
  rim(f, 'rgba(235, 235, 245, 0.35)', 'rgba(0, 0, 0, 0.6)', 5, 6)
  bx.strokeStyle = gray(150, 0.3); bx.lineWidth = 4 * k; polyPath(bx, f.poly, f.center, 0.02); bx.stroke()
  end(f)
}
const onyxNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'raise', fill: ['#fff3c4', '#c9952f'], hi: 'rgba(255, 255, 240, 0.7)', lo: 'rgba(0, 0, 0, 0.7)', rough: 0.22, metal: 1 })

// ── 8. Ametista ─────────────────────────────────────────

function amethystFace(f: FacePaint): void {
  const { cx, bx, gx, rnd, radius: R, k, poly, center } = f
  begin(f, { top: '#8a62e0', bottom: '#2e1670', rough: 0.1, metal: 0, lit: 0.1 })
  // bandas de ágata: contornos concêntricos da face
  for (let i = 0; i < 9; i++) {
    const inset = 0.08 + i * 0.09
    cx.strokeStyle = rgba(i % 2 ? '#e8dcff' : '#5a34b0', i % 2 ? 0.2 : 0.3); cx.lineWidth = between(rnd, 2, 6) * k
    polyPath(cx, poly, center, inset); cx.stroke()
  }
  blobs(f, ['#c9b0ff', '#3a1a80', '#ffffff'], 10, 0.2, 0.5, 0.08, 0.25)
  // geodo: cristais saindo de um canto
  const corner = poly[Math.floor(rnd() * poly.length)]
  for (let i = 0; i < 24; i++) {
    const to = lerp2(corner, center, between(rnd, 0.1, 0.8)), ang = Math.atan2(center[1] - corner[1], center[0] - corner[0]) + (rnd() - 0.5) * 1.6
    const len = R * between(rnd, 0.1, 0.34), w = R * between(rnd, 0.02, 0.05)
    const tip: V2 = [to[0] + Math.cos(ang) * len, to[1] + Math.sin(ang) * len], nx = -Math.sin(ang), ny = Math.cos(ang)
    cx.fillStyle = rgba(rnd() < 0.5 ? '#e4d4ff' : '#b08aff', between(rnd, 0.4, 0.8))
    cx.beginPath(); cx.moveTo(to[0] + nx * w, to[1] + ny * w); cx.lineTo(tip[0], tip[1]); cx.lineTo(to[0] - nx * w, to[1] - ny * w); cx.closePath(); cx.fill()
    cx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; cx.lineWidth = 0.9 * k; cx.beginPath(); cx.moveTo(to[0], to[1]); cx.lineTo(tip[0], tip[1]); cx.stroke()
    bx.fillStyle = gray(190, 0.6); bx.beginPath(); bx.moveTo(to[0] + nx * w, to[1] + ny * w); bx.lineTo(tip[0], tip[1]); bx.lineTo(to[0] - nx * w, to[1] - ny * w); bx.closePath(); bx.fill()
  }
  // druza: pontinhos que cintilam
  grains(f, [['#ffffff', 0.9], ['#e4d4ff', 0.7], ['#c9b0ff', 0.6]], 160, 0.7, 1.9, 0)
  if (gx) {
    for (let i = 0; i < Math.round(R * R / 900); i++) { const p = at(f, 0.9), s = between(rnd, 1, 2.4) * k; gx.fillStyle = glowOf(f, '#d8c6ff', 0.9); gx.fillRect(p[0], p[1], s, s) }
  }
  sheen(f, 0.22)
  rim(f, 'rgba(240, 230, 255, 0.55)', 'rgba(20, 8, 60, 0.5)')
  end(f)
}
const amethystNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'cut', fill: '#fff4d6', hi: 'rgba(255, 255, 255, 0.5)', lo: 'rgba(30, 10, 80, 0.7)', rough: 0.2, metal: 0.6, glow: '#d8c6ff', glowAlpha: 0.8 })

// ── 9. Granada ──────────────────────────────────────────

function garnetFace(f: FacePaint): void {
  const { cx, rx, rnd, radius: R, k, center } = f
  begin(f, { top: '#b0203a', bottom: '#3a0610', rough: 0.08, metal: 0, lit: 0.1 })
  // chamas de dentro: fitas claras e escuras que se enrolam
  cx.lineCap = 'round'
  for (let i = 0; i < 8; i++) {
    const p = (): V2 => [center[0] + between(rnd, -R * 1.1, R * 1.1), center[1] + between(rnd, -R * 1.1, R * 1.1)]
    const a = p(), c1 = p(), c2 = p(), b = p(), col = pick(rnd, ['#ff6a4a', '#5a0814', '#ff3a52', '#240206']), w = R * between(rnd, 0.1, 0.32)
    for (let pass = 0; pass < 7; pass++) {
      cx.strokeStyle = rgba(col, 0.05 + pass * 0.01); cx.lineWidth = w * (1 - pass * 0.13)
      cx.beginPath(); cx.moveTo(...a); cx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], b[0], b[1]); cx.stroke()
    }
  }
  blobs(f, ['#ff8a6a', '#2a0308'], 8, 0.2, 0.5, 0.08, 0.2)
  bubbles(f, 4 + Math.floor(rnd() * 5), 1.6, 4.6, '255, 190, 180')
  grains(f, [['#ffd0c0', 0.8]], 300, 0.6, 1.5, 0)
  sheen(f, 0.24)
  // fio de ouro por dentro da borda
  cx.strokeStyle = 'rgba(244, 208, 120, 0.9)'; cx.lineWidth = 3.4 * k; polyPath(cx, f.poly, center, 0.13); cx.stroke()
  cx.strokeStyle = 'rgba(255, 244, 200, 0.6)'; cx.lineWidth = 1.2 * k; polyPath(cx, f.poly, center, 0.135); cx.stroke()
  rx.strokeStyle = 'rgb(0, 60, 255)'; rx.lineWidth = 4 * k; polyPath(rx, f.poly, center, 0.13); rx.stroke()
  rim(f, 'rgba(255, 210, 200, 0.5)', 'rgba(40, 0, 8, 0.55)')
  end(f)
}
const garnetNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'raise', fill: ['#fff0b8', '#d4a23a'], hi: 'rgba(255, 255, 230, 0.7)', lo: 'rgba(40, 0, 8, 0.75)', rough: 0.25, metal: 1 })

// ── 10. Jade Imperial ───────────────────────────────────

function jadeFace(f: FacePaint): void {
  const { bx, rx, rnd, radius: R, k } = f
  begin(f, { top: '#58a883', bottom: '#1b5640', rough: 0.3, metal: 0.04, lit: 0.25 })
  // nuvens leitosas
  blobs(f, ['#d6f0e2', '#9fd8bc', '#0f3a2a', '#e8f8ee'], 18, 0.25, 0.7, 0.07, 0.2)
  fibers(f, '#e0f5ea', Math.round(R * R / 480), rnd() * Math.PI, 40, 140, 1, 3.2, 0.05, 0.16)
  // inclusões escuras e fios de cor mais clara
  for (let v = 0; v < 2; v++) vein(f, veinPath(f, 18, 16), 'rgba(230, 250, 238, 0.4)', 'rgba(8, 40, 28, 0.25)', 3.2, 150)
  grains(f, [['#0c3626', 0.5], ['#e8f8ee', 0.4]], 140, 0.7, 2.2, 0.08)
  sheen(f, 0.2)
  rx.fillStyle = 'rgba(0, 120, 20, 0.35)'; rx.beginPath(); rx.ellipse(f.center[0], f.center[1], R * 0.5, R * 0.35, 0.6, 0, Math.PI * 2); rx.fill()
  chip(f, '#8ccaa8', 0.5)
  // pátina nas quinas (um verde mais claro e fosco)
  vignette(f, '#0b3a28', 0.55)
  rim(f, 'rgba(220, 250, 235, 0.45)', 'rgba(4, 36, 24, 0.5)')
  bx.strokeStyle = gray(190, 0.3); bx.lineWidth = 6 * k; polyPath(bx, f.poly, f.center, 0.03); bx.stroke()
  end(f)
}
const jadeNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'raise', fill: ['#f6e4a4', '#c4952e'], hi: 'rgba(255, 252, 220, 0.7)', lo: 'rgba(4, 36, 24, 0.7)', rough: 0.28, metal: 1 })

// ── 11. Vidro Fumê ──────────────────────────────────────

function smokeFace(f: FacePaint): void {
  const { cx, gx, rnd, radius: R, k, center } = f
  begin(f, { top: '#2c2c3a', bottom: '#07070c', rough: 0.07, metal: 0, lit: 0.2 })
  // fumaça: fitas macias que sobem, claras e escuras
  cx.lineCap = 'round'
  for (let i = 0; i < 9; i++) {
    const x0 = center[0] + between(rnd, -R, R), a: V2 = [x0, center[1] + R * 1.1], c1: V2 = [x0 + between(rnd, -R, R), center[1] + R * 0.4], c2: V2 = [x0 + between(rnd, -R, R), center[1] - R * 0.3], b: V2 = [x0 + between(rnd, -R, R), center[1] - R * 1.1]
    const w = R * between(rnd, 0.08, 0.26), col = rnd() < 0.6 ? '#9ea6c8' : '#000000'
    for (let pass = 0; pass < 8; pass++) {
      cx.strokeStyle = rgba(col, 0.035 + pass * 0.007); cx.lineWidth = w * (1 - pass * 0.115)
      cx.beginPath(); cx.moveTo(...a); cx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], b[0], b[1]); cx.stroke()
    }
  }
  blobs(f, ['#c9d0f0', '#000000'], 7, 0.2, 0.5, 0.05, 0.14)
  bubbles(f, 3 + Math.floor(rnd() * 5), 1.4, 4.2, '200, 210, 255')
  grains(f, [['#ffffff', 0.6]], 400, 0.6, 1.3, 0)
  if (gx) for (let i = 0; i < 6; i++) { const p = at(f, 0.8), r = R * between(rnd, 0.1, 0.25); const g = gx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r); g.addColorStop(0, glowOf(f, '#8a96ff', 0.35)); g.addColorStop(1, glowOf(f, '#8a96ff', 0)); gx.fillStyle = g; gx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2) }
  sheen(f, 0.26)
  rim(f, 'rgba(210, 218, 255, 0.45)', 'rgba(0, 0, 0, 0.6)')
  void k
  end(f)
}
const smokeNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'cut', fill: ['#f4f6ff', '#aeb6d8'], hi: 'rgba(255, 255, 255, 0.5)', lo: 'rgba(0, 0, 10, 0.7)', rough: 0.15, metal: 0.7, glow: '#aab4ff', glowAlpha: 0.7 })

// ── 12. Gelo Eterno ─────────────────────────────────────

function iceFace(f: FacePaint): void {
  const { cx, bx, gx, rnd, radius: R, k, poly, center } = f
  begin(f, { top: '#d6f0fc', bottom: '#5b9fcf', rough: 0.1, metal: 0, lit: 0.25 })
  blobs(f, ['#ffffff', '#4a8ec2', '#a6dcf6'], 14, 0.2, 0.6, 0.08, 0.24)
  // rachaduras por dentro: brancas, com halo azul, ramificando
  for (let c = 0; c < 3; c++) {
    const trunk = veinTree(f, 'rgba(255, 255, 255, 0.85)', 'rgba(70, 140, 200, 0.5)', 1.8, 5, 70)
    void trunk
  }
  // cristais de geada nas quinas
  for (const v of poly) {
    for (let i = 0; i < 5; i++) {
      const a = Math.atan2(center[1] - v[1], center[0] - v[0]) + (rnd() - 0.5) * 1.5, len = R * between(rnd, 0.1, 0.3), p = lerp2(v, center, between(rnd, 0.02, 0.12))
      cx.strokeStyle = 'rgba(255, 255, 255, 0.75)'; cx.lineWidth = between(rnd, 1, 2.2) * k
      cx.beginPath(); cx.moveTo(...p); cx.lineTo(p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len); cx.stroke()
      for (const side of [-1, 1]) {
        const m: V2 = [p[0] + Math.cos(a) * len * 0.55, p[1] + Math.sin(a) * len * 0.55]
        cx.beginPath(); cx.moveTo(...m); cx.lineTo(m[0] + Math.cos(a + side * 0.9) * len * 0.35, m[1] + Math.sin(a + side * 0.9) * len * 0.35); cx.stroke()
      }
      bx.strokeStyle = gray(200, 0.6); bx.lineWidth = 1.6 * k; bx.beginPath(); bx.moveTo(...p); bx.lineTo(p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len); bx.stroke()
    }
  }
  // fiada de bolhas presas
  const bp = at(f, 0.6), ba = rnd() * Math.PI
  for (let i = 0; i < 7; i++) {
    const r = (2.4 - i * 0.2) * k, p: V2 = [bp[0] + Math.cos(ba) * i * R * 0.1, bp[1] + Math.sin(ba) * i * R * 0.1]
    cx.fillStyle = 'rgba(255, 255, 255, 0.55)'; cx.beginPath(); cx.arc(p[0], p[1], r, 0, Math.PI * 2); cx.fill()
  }
  grains(f, [['#ffffff', 0.9], ['#bfe6fa', 0.6]], 220, 0.6, 1.7, 0)
  if (gx) { for (let i = 0; i < Math.round(R * R / 1200); i++) { const p = at(f, 0.9); gx.fillStyle = glowOf(f, '#9fe4ff', 0.8); gx.fillRect(p[0], p[1], 2 * k, 2 * k) } }
  sheen(f, 0.3)
  rim(f, 'rgba(255, 255, 255, 0.7)', 'rgba(30, 90, 150, 0.45)')
  end(f)
}
const iceNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'cut', fill: '#1b5fae', hi: 'rgba(255, 255, 255, 0.7)', lo: 'rgba(10, 40, 90, 0.6)', rough: 0.2, metal: 0.1, glow: '#7fdcff', glowAlpha: 0.75 })

// ── 13. Magma ───────────────────────────────────────────

function magmaFace(f: FacePaint): void {
  const { cx, bx, gx, rnd, radius: R, k, center } = f
  begin(f, { top: '#4a3d4a', bottom: '#14101a', rough: 0.9, metal: 0.05 })
  blobs(f, ['#6a5a68', '#0a080c', '#8a7a86'], 16, 0.2, 0.55, 0.12, 0.3)
  fibers(f, '#9a8a96', Math.round(R * R / 400), rnd() * Math.PI, 20, 90, 0.8, 2, 0.1, 0.25, 0.15)
  grains(f, [['#8a7a86', 0.45], ['#0a080c', 0.6], ['#b8a8b4', 0.3]], 44, 0.8, 2.6, 0.3)
  // crosta: placas com fendas de lava
  cracks(f, 2 + Math.floor(rnd() * 2), '', '', 2.2, '#ff8a1c')
  cracks(f, 1, '', '', 1.4, '#ffd23a')
  // calor subindo para o meio
  if (gx) {
    const g = gx.createRadialGradient(center[0], center[1], 0, center[0], center[1], R)
    g.addColorStop(0, glowOf(f, '#ff5a10', 0.22)); g.addColorStop(1, glowOf(f, '#ff5a10', 0))
    gx.fillStyle = g; gx.fillRect(...boxOf(f))
    for (let i = 0; i < Math.round(R * R / 700); i++) { const p = at(f, 0.95), s = between(rnd, 1, 3) * k; gx.fillStyle = glowOf(f, '#ffb347', 0.9); gx.fillRect(p[0], p[1], s, s) }
  }
  const ember = cx.createRadialGradient(center[0], center[1], 0, center[0], center[1], R)
  ember.addColorStop(0, 'rgba(255, 90, 16, 0.14)'); ember.addColorStop(1, 'rgba(255, 90, 16, 0)')
  cx.fillStyle = ember; cx.fillRect(...boxOf(f))
  chip(f, '#4a3c40', 0.7)
  rim(f, 'rgba(255, 150, 70, 0.35)', 'rgba(0, 0, 0, 0.7)')
  bx.strokeStyle = gray(120, 0.4); bx.lineWidth = 5 * k; polyPath(bx, f.poly, f.center, 0.03); bx.stroke()
  end(f)
}
const magmaNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'cut', fill: ['#fff0a0', '#ff7a18'], hi: 'rgba(255, 220, 140, 0.6)', lo: 'rgba(0, 0, 0, 0.7)', rough: 0.6, metal: 0, glow: '#ff7a18', glowAlpha: 1 })

// ── 14. Meteorito ───────────────────────────────────────

function meteorFace(f: FacePaint): void {
  const { cx, bx, rx, rnd, radius: R, k, center, poly } = f
  begin(f, { top: '#8b8d95', bottom: '#2f3036', rough: 0.45, metal: 0.85 })
  blobs(f, ['#b0b3bc', '#2a2b30', '#6a6c75'], 10, 0.2, 0.55, 0.08, 0.2)
  // padrão de Widmanstätten: famílias de linhas paralelas cruzadas, em losangos
  const base = rnd() * Math.PI
  for (const off of [0, 1.05, 2.1]) {
    const ang = base + off, dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx
    for (let o = -R * 1.4; o < R * 1.4; o += R * between(rnd, 0.05, 0.1)) {
      const light = rnd() < 0.6
      cx.strokeStyle = light ? rgba('#d8dbe2', between(rnd, 0.1, 0.3)) : rgba('#16171b', between(rnd, 0.14, 0.34)); cx.lineWidth = between(rnd, 0.8, 2.6) * k
      cx.beginPath(); cx.moveTo(center[0] + nx * o - dx * R * 1.5, center[1] + ny * o - dy * R * 1.5); cx.lineTo(center[0] + nx * o + dx * R * 1.5, center[1] + ny * o + dy * R * 1.5); cx.stroke()
      bx.strokeStyle = gray(light ? 150 : 108, 0.2); bx.lineWidth = 1.4 * k
      bx.beginPath(); bx.moveTo(center[0] + nx * o - dx * R * 1.5, center[1] + ny * o - dy * R * 1.5); bx.lineTo(center[0] + nx * o + dx * R * 1.5, center[1] + ny * o + dy * R * 1.5); bx.stroke()
    }
  }
  // crosta de fusão: manchas pretas queimadas com bordas
  for (let i = 0; i < 3; i++) {
    const v = poly[Math.floor(rnd() * poly.length)], p = lerp2(v, center, between(rnd, 0.05, 0.45)), r = R * between(rnd, 0.18, 0.4)
    const g = cx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r)
    g.addColorStop(0, 'rgba(14, 12, 16, 0.85)'); g.addColorStop(0.8, 'rgba(14, 12, 16, 0.55)'); g.addColorStop(1, 'rgba(14, 12, 16, 0)')
    cx.fillStyle = g; cx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2)
    rx.fillStyle = 'rgba(0, 225, 20, 0.6)'; rx.beginPath(); rx.arc(p[0], p[1], r * 0.7, 0, Math.PI * 2); rx.fill()
  }
  // regmaglyptos: marcas de dedo na superfície
  dents(f, Math.round(R * R / 2600), 12, 30, '#c0c3cc', '#0c0d10')
  grains(f, [['#c7a050', 0.5], ['#ffffff', 0.3]], 520, 0.6, 1.5, 0.1)   // troilita dourada
  scratches(f, Math.round(R / 8), '#dfe2ea', 0.25)
  chip(f, '#b4b7bf', 0.5)
  rim(f, 'rgba(210, 213, 222, 0.38)', 'rgba(0, 0, 0, 0.6)')
  end(f)
}
const meteorNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'cut', fill: ['#f4f6fb', '#aeb2bd'], hi: 'rgba(255, 255, 255, 0.6)', lo: 'rgba(0, 0, 0, 0.65)', rough: 0.3, metal: 1 })

// ── 15. Fungo Brilhante ─────────────────────────────────

function fungusFace(f: FacePaint): void {
  const { cx, bx, gx, rnd, radius: R, k, center } = f
  begin(f, { top: '#4a3622', bottom: '#150e08', rough: 0.88, metal: 0 })
  // madeira velha por baixo: veios escuros
  const grain = rnd() * Math.PI
  fibers(f, '#1a0f06', Math.round(R * R / 150), grain, 40, 150, 0.8, 2.4, 0.15, 0.4, 0.12)
  fibers(f, '#8a6a42', Math.round(R * R / 400), grain, 30, 110, 0.7, 1.6, 0.08, 0.2)
  blobs(f, ['#2a1a0c', '#6a4e30'], 8, 0.2, 0.5, 0.1, 0.25)
  // musgo: tufos verdes fofos
  const moss = ['#4f7d2e', '#6a9a3a', '#34561e', '#86b84a']
  for (let i = 0; i < 4; i++) {
    const v = f.poly[Math.floor(rnd() * f.poly.length)], p = lerp2(v, center, between(rnd, 0.05, 0.5)), r = R * between(rnd, 0.2, 0.45)
    for (let j = 0; j < 60; j++) {
      const a = rnd() * Math.PI * 2, d = r * Math.sqrt(rnd()), q: V2 = [p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d * 0.8], s = between(rnd, 1.2, 3.6) * k
      cx.fillStyle = rgba(pick(rnd, moss), between(rnd, 0.5, 0.9)); cx.beginPath(); cx.arc(q[0], q[1], s, 0, Math.PI * 2); cx.fill()
      bx.fillStyle = gray(180, 0.5); bx.beginPath(); bx.arc(q[0], q[1], s, 0, Math.PI * 2); bx.fill()
    }
  }
  // cogumelos pequenos que brilham
  for (let i = 0; i < 2 + Math.floor(rnd() * 3); i++) {
    const v = f.poly[Math.floor(rnd() * f.poly.length)], p = lerp2(v, center, between(rnd, 0.12, 0.5)), s = R * between(rnd, 0.06, 0.1)
    cx.fillStyle = '#d8f2e0'; cx.fillRect(p[0] - s * 0.18, p[1], s * 0.36, s * 0.9)
    const cap = cx.createRadialGradient(p[0], p[1] - s * 0.2, 0, p[0], p[1], s)
    cap.addColorStop(0, '#9fffd8'); cap.addColorStop(1, '#2a9a78')
    cx.fillStyle = cap; cx.beginPath(); cx.ellipse(p[0], p[1], s, s * 0.62, 0, Math.PI, 0); cx.fill()
    cx.strokeStyle = 'rgba(10, 60, 44, 0.6)'; cx.lineWidth = 1.2 * k; cx.stroke()
    bx.fillStyle = gray(210); bx.beginPath(); bx.ellipse(p[0], p[1], s, s * 0.62, 0, Math.PI, 0); bx.fill()
    if (gx) {
      const g = gx.createRadialGradient(p[0], p[1], 0, p[0], p[1], s * 2.6)
      g.addColorStop(0, glowOf(f, '#6dffc4', 0.9)); g.addColorStop(1, glowOf(f, '#6dffc4', 0))
      gx.fillStyle = g; gx.fillRect(p[0] - s * 2.6, p[1] - s * 2.6, s * 5.2, s * 5.2)
    }
  }
  // esporos no ar
  if (gx) for (let i = 0; i < Math.round(R * R / 600); i++) { const p = at(f, 0.95), s = between(rnd, 1, 2.4) * k; gx.fillStyle = glowOf(f, '#b8ffe0', 0.9); gx.fillRect(p[0], p[1], s, s) }
  grains(f, [['#b8ffe0', 0.5]], 600, 0.6, 1.4, 0)
  cracks(f, 1, 'rgba(10, 6, 2, 0.95)', 'rgba(150, 120, 80, 0.25)', 2.6)
  vignette(f, '#080402', 0.5)
  rim(f, 'rgba(160, 130, 90, 0.3)', 'rgba(0, 0, 0, 0.55)')
  end(f)
}
const fungusNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'cut', fill: ['#d8ffe8', '#5ad8a4'], hi: 'rgba(200, 255, 230, 0.4)', lo: 'rgba(0, 20, 10, 0.7)', rough: 0.5, metal: 0, glow: '#6dffc4', glowAlpha: 1 })

// ── 16. Âmbar (resina com um inseto preso) ──────────────

function amberFace(f: FacePaint): void {
  const { cx, bx, rnd, radius: R, k, center } = f
  begin(f, { top: '#ffc640', bottom: '#b8620c', rough: 0.06, metal: 0, lit: 0.3, alpha: ['#8a8a8a', '#d0d0d0'] })
  // correntes da resina: fitas de tons dourados
  cx.lineCap = 'round'
  for (let i = 0; i < 8; i++) {
    const p = (): V2 => [center[0] + between(rnd, -R * 1.1, R * 1.1), center[1] + between(rnd, -R * 1.1, R * 1.1)]
    const a = p(), c1 = p(), c2 = p(), b = p(), col = pick(rnd, ['#ffd86a', '#8a4208', '#ffb43a', '#6a3004']), w = R * between(rnd, 0.1, 0.34)
    for (let pass = 0; pass < 7; pass++) {
      cx.strokeStyle = rgba(col, 0.05 + pass * 0.009); cx.lineWidth = w * (1 - pass * 0.13)
      cx.beginPath(); cx.moveTo(...a); cx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], b[0], b[1]); cx.stroke()
    }
  }
  bubbles(f, 7 + Math.floor(rnd() * 8), 1.4, 5.4, '255, 232, 170')
  // detritos minúsculos e fiapos presos
  for (let i = 0; i < Math.round(R * R / 900); i++) {
    const p = at(f, 0.95), l = between(rnd, 2, 7) * k, a = rnd() * 3
    cx.strokeStyle = 'rgba(60, 28, 6, 0.7)'; cx.lineWidth = between(rnd, 0.6, 1.3) * k
    cx.beginPath(); cx.moveTo(...p); cx.lineTo(p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l); cx.stroke()
  }
  // fratura interna: um brilho de lasca
  const crack = veinPath(f, 8, 10)
  cx.strokeStyle = 'rgba(255, 244, 200, 0.4)'; cx.lineWidth = 1.4 * k; lineTo(cx, crack); cx.stroke()
  bx.strokeStyle = gray(60, 0.5); bx.lineWidth = 2 * k; lineTo(bx, crack); bx.stroke()
  sheen(f, 0.26)
  rim(f, 'rgba(255, 244, 200, 0.55)', 'rgba(90, 40, 4, 0.5)')
  end(f)
}
const amberNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'paint', fill: '#4a2204', stroke: 'rgba(255, 224, 150, 0.85)', hi: 'rgba(255, 230, 160, 0.4)', rough: 0.2, metal: 0 })

// ── 17. Dado da Morte ───────────────────────────────────

function deathFace(f: FacePaint): void {
  const { cx, bx, gx, rnd, radius: R, k, center } = f
  begin(f, { top: '#2a2124', bottom: '#0a0708', rough: 0.55, metal: 0.05 })
  const ang = rnd() * Math.PI
  fibers(f, '#4a3a3e', Math.round(R * R / 260), ang, 30, 120, 0.8, 2, 0.1, 0.3, 0.1)
  blobs(f, ['#3a2a2e', '#000000', '#5a1018'], 12, 0.2, 0.55, 0.1, 0.26)
  // uma caveira rasa, entalhada atrás do número
  const hc: V2 = [center[0], center[1] - R * 0.08], hr = R * 0.5
  const skull = (c: Ctx, fill: string) => {
    c.fillStyle = fill
    c.beginPath(); c.ellipse(hc[0], hc[1] - hr * 0.1, hr * 0.78, hr * 0.7, 0, 0, Math.PI * 2); c.fill()
    c.fillRect(hc[0] - hr * 0.42, hc[1] + hr * 0.4, hr * 0.84, hr * 0.5)
  }
  bx.save(); skull(bx, gray(100, 0.5)); bx.restore()
  cx.save(); skull(cx, 'rgba(184, 164, 156, 0.2)'); cx.restore()
  if (gx) { gx.strokeStyle = glowOf(f, '#ff2030', 0.45); gx.lineWidth = 2.4 * k; gx.beginPath(); gx.ellipse(hc[0], hc[1] - hr * 0.1, hr * 0.78, hr * 0.7, 0, 0, Math.PI * 2); gx.stroke() }
  // órbitas, nariz e dentes
  cx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  for (const s of [-1, 1]) { cx.beginPath(); cx.ellipse(hc[0] + s * hr * 0.32, hc[1] - hr * 0.05, hr * 0.2, hr * 0.24, 0, 0, Math.PI * 2); cx.fill() }
  cx.beginPath(); cx.moveTo(hc[0], hc[1] + hr * 0.18); cx.lineTo(hc[0] - hr * 0.08, hc[1] + hr * 0.38); cx.lineTo(hc[0] + hr * 0.08, hc[1] + hr * 0.38); cx.closePath(); cx.fill()
  for (let i = -2; i <= 2; i++) { cx.fillRect(hc[0] + i * hr * 0.15 - 1.5 * k, hc[1] + hr * 0.5, 3 * k, hr * 0.34) }
  if (gx) for (const s of [-1, 1]) { const g = gx.createRadialGradient(hc[0] + s * hr * 0.32, hc[1] - hr * 0.05, 0, hc[0] + s * hr * 0.32, hc[1] - hr * 0.05, hr * 0.3); g.addColorStop(0, glowOf(f, '#ff2030', 0.55)); g.addColorStop(1, glowOf(f, '#ff2030', 0)); gx.fillStyle = g; gx.fillRect(hc[0] + s * hr * 0.32 - hr * 0.3, hc[1] - hr * 0.35, hr * 0.6, hr * 0.6) }
  // rachaduras com brasa vermelha
  cracks(f, 2, '', '', 2.6, '#e01828')
  grains(f, [['#6a5258', 0.4], ['#000000', 0.5]], 160, 0.7, 1.9, 0.2)
  vignette(f, '#000000', 0.55)
  rim(f, 'rgba(180, 150, 156, 0.28)', 'rgba(0, 0, 0, 0.65)')
  end(f)
}
const deathNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'cut', fill: ['#ff4a58', '#9a0c1a'], hi: 'rgba(255, 150, 160, 0.4)', lo: 'rgba(0, 0, 0, 0.8)', rough: 0.4, metal: 0.1, glow: '#ff2030', glowAlpha: 1 })

// ── 18. Resina de Vaga-lumes ────────────────────────────

function fireflyFace(f: FacePaint): void {
  const { cx, gx, rnd, radius: R, k } = f
  begin(f, { top: '#2a6a70', bottom: '#082026', rough: 0.05, metal: 0, lit: 0.25, alpha: ['#5a5a5a', '#a4a4a4'] })
  blobs(f, ['#2e7a7a', '#02080c', '#4a9a88'], 12, 0.25, 0.65, 0.08, 0.22)
  // fitas de resina escura, finas
  cx.lineCap = 'round'
  for (let i = 0; i < 5; i++) {
    const p = (): V2 => [f.center[0] + between(rnd, -R, R), f.center[1] + between(rnd, -R, R)]
    const a = p(), c1 = p(), c2 = p(), b = p(), w = R * between(rnd, 0.1, 0.26)
    for (let pass = 0; pass < 6; pass++) { cx.strokeStyle = rgba('#7affd0', 0.02 + pass * 0.006); cx.lineWidth = w * (1 - pass * 0.14); cx.beginPath(); cx.moveTo(...a); cx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], b[0], b[1]); cx.stroke() }
  }
  bubbles(f, 4 + Math.floor(rnd() * 5), 1.4, 4, '190, 255, 230')
  // vaga-lumes pintados na face: pontos de luz com halo
  for (let i = 0; i < 5 + Math.floor(rnd() * 5); i++) {
    const p = at(f, 0.9), r = R * between(rnd, 0.035, 0.07)
    const g = cx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 4)
    g.addColorStop(0, 'rgba(240, 255, 150, 0.95)'); g.addColorStop(0.25, 'rgba(180, 255, 110, 0.5)'); g.addColorStop(1, 'rgba(120, 255, 90, 0)')
    cx.fillStyle = g; cx.fillRect(p[0] - r * 4, p[1] - r * 4, r * 8, r * 8)
    if (gx) { const q = gx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 4.5); q.addColorStop(0, glowOf(f, '#e8ff80', 1)); q.addColorStop(1, glowOf(f, '#9aff70', 0)); gx.fillStyle = q; gx.fillRect(p[0] - r * 4.5, p[1] - r * 4.5, r * 9, r * 9) }
  }
  grains(f, [['#c8ffd8', 0.6]], 380, 0.6, 1.4, 0)
  sheen(f, 0.2)
  rim(f, 'rgba(200, 255, 230, 0.45)', 'rgba(0, 18, 24, 0.55)')
  void k
  end(f)
}
const fireflyNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'paint', fill: '#fff0a8', stroke: 'rgba(0, 30, 24, 0.9)', hi: 'rgba(255, 255, 220, 0.5)', rough: 0.2, metal: 0, glow: '#e8ff80', glowAlpha: 0.9 })

// ── 19. Ouro Rúnico ─────────────────────────────────────

/** Runas angulares (traços retos) em fileira, seguindo a borda de dentro da face. */
function runeRing(f: FacePaint): void {
  const { cx, bx, gx, poly, center, rnd, radius: R, k } = f
  const pts = poly.map(([x, y]): V2 => [center[0] + (x - center[0]) * 0.8, center[1] + (y - center[1]) * 0.8])
  const glyph = (p: V2, ang: number, size: number) => {
    const n = 2 + Math.floor(rnd() * 3), strokes: V2[][] = []
    const u: V2 = [Math.cos(ang), Math.sin(ang)], v: V2 = [-u[1], u[0]]
    const loc = (a: number, b: number): V2 => [p[0] + u[0] * a * size + v[0] * b * size, p[1] + u[1] * a * size + v[1] * b * size]
    strokes.push([loc(0, -1), loc(0, 1)])
    for (let i = 0; i < n; i++) { const y0 = between(rnd, -1, 0.6), dir = rnd() < 0.5 ? 1 : -1; strokes.push([loc(0, y0), loc(dir * between(rnd, 0.4, 0.9), y0 + between(rnd, 0.3, 0.8))]) }
    for (const s of strokes) {
      cx.strokeStyle = 'rgba(40, 20, 4, 0.85)'; cx.lineWidth = 3.2 * k; lineTo(cx, s); cx.stroke()
      bx.strokeStyle = gray(30); bx.lineWidth = 3.2 * k; lineTo(bx, s); bx.stroke()
      if (gx) { gx.strokeStyle = glowOf(f, '#ffb44a', 0.9); gx.lineWidth = 2.6 * k; lineTo(gx, s); gx.stroke() }
    }
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), count = Math.max(2, Math.round(len / (R * 0.26)))
    for (let j = 0; j < count; j++) {
      const t = (j + 0.5) / count, p = lerp2(a, b, t), ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2
      glyph(p, ang, R * 0.045)
    }
  }
}

function runicFace(f: FacePaint): void {
  const { cx, bx, rx, rnd, radius: R, k } = f
  begin(f, { top: '#e0ac3c', bottom: '#7a5210', rough: 0.26, metal: 0.95, lit: 0.3 })
  fibers(f, '#fff0b0', Math.round(R * R / 300), rnd() * Math.PI, 40, 160, 0.6, 1.5, 0.06, 0.2, 0.05)
  dents(f, Math.round(R * R / 1600), 6, 18, '#ffe08a', '#4a2e04')      // martelado
  blobs(f, ['#4a2e04', '#fff0b0', '#b07a18'], 9, 0.2, 0.5, 0.08, 0.2)
  vignette(f, '#3a2204', 0.5)
  scratches(f, Math.round(R / 8), '#fff6cc', 0.3)
  runeRing(f)
  // um filete duplo em volta das runas
  cx.strokeStyle = 'rgba(255, 236, 160, 0.7)'; cx.lineWidth = 2 * k; polyPath(cx, f.poly, f.center, 0.1); cx.stroke()
  bx.strokeStyle = gray(200, 0.6); bx.lineWidth = 3 * k; polyPath(bx, f.poly, f.center, 0.1); bx.stroke()
  rx.strokeStyle = 'rgb(0, 40, 255)'; rx.lineWidth = 3 * k; polyPath(rx, f.poly, f.center, 0.1); rx.stroke()
  rim(f, 'rgba(255, 240, 180, 0.5)', 'rgba(50, 28, 2, 0.5)')
  end(f)
}
const runicNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'cut', fill: ['#5a3604', '#2a1802'], hi: 'rgba(255, 244, 190, 0.7)', lo: 'rgba(20, 10, 0, 0.6)', rough: 0.3, metal: 0.9, glow: '#ffb44a', glowAlpha: 0.7 })

// ── 20. Pedra do Vórtice ────────────────────────────────

function vortexFace(f: FacePaint): void {
  const { cx, bx, gx, rnd, radius: R, k, center } = f
  begin(f, { top: '#2a2030', bottom: '#08060c', rough: 0.5, metal: 0.2 })
  blobs(f, ['#3a2a42', '#000000', '#5a1a28'], 10, 0.25, 0.6, 0.1, 0.26)
  grains(f, [['#6a5a74', 0.4], ['#000000', 0.5]], 90, 0.7, 2, 0.2)
  // redemoinho: braços em espiral saindo do meio, vermelho e laranja
  const arms = 3 + Math.floor(rnd() * 2), turn = 0.55 + rnd() * 0.25, rot = rnd() * Math.PI * 2
  cx.lineCap = 'round'
  for (let a = 0; a < arms; a++) {
    const path: V2[] = []
    for (let t = 0; t <= 1; t += 0.03) { const ang = rot + (a / arms) * Math.PI * 2 + t * turn * 6.28, r = R * 1.05 * t; path.push([center[0] + Math.cos(ang) * r, center[1] + Math.sin(ang) * r]) }
    for (let pass = 0; pass < 6; pass++) { cx.strokeStyle = rgba('#d9363e', 0.07 + pass * 0.03); cx.lineWidth = R * 0.12 * (1 - pass * 0.16); lineTo(cx, path); cx.stroke() }
    cx.strokeStyle = 'rgba(255, 150, 90, 0.7)'; cx.lineWidth = 1.8 * k; lineTo(cx, path); cx.stroke()
    bx.strokeStyle = gray(80, 0.55); bx.lineWidth = 4 * k; lineTo(bx, path); bx.stroke()
    if (gx) { gx.strokeStyle = glowOf(f, '#ff3b45', 0.6); gx.lineWidth = R * 0.07; lineTo(gx, path); gx.stroke(); gx.strokeStyle = glowOf(f, '#ff9a60', 0.9); gx.lineWidth = 2 * k; lineTo(gx, path); gx.stroke() }
  }
  const core = cx.createRadialGradient(center[0], center[1], 0, center[0], center[1], R * 0.4)
  core.addColorStop(0, 'rgba(255, 90, 80, 0.4)'); core.addColorStop(1, 'rgba(255, 90, 80, 0)')
  cx.fillStyle = core; cx.fillRect(...boxOf(f))
  // fagulhas
  if (gx) for (let i = 0; i < Math.round(R * R / 800); i++) { const p = at(f, 0.95), s = between(rnd, 1, 2.6) * k; gx.fillStyle = glowOf(f, '#ffb090', 0.9); gx.fillRect(p[0], p[1], s, s) }
  cracks(f, 1, 'rgba(0, 0, 0, 0.9)', 'rgba(255, 120, 100, 0.2)', 2.4)
  // friso vermelho que brilha por dentro da borda
  cx.strokeStyle = 'rgba(217, 54, 62, 0.95)'; cx.lineWidth = 3.4 * k; polyPath(cx, f.poly, center, 0.12); cx.stroke()
  if (gx) { gx.strokeStyle = glowOf(f, '#ff3b45', 1); gx.lineWidth = 4 * k; polyPath(gx, f.poly, center, 0.12); gx.stroke() }
  rim(f, 'rgba(200, 160, 190, 0.28)', 'rgba(0, 0, 0, 0.65)')
  end(f)
}
const vortexNumber = (f: FacePaint, t: string, x: number, y: number, a: number, px: number, u: boolean) =>
  num(f, t, x, y, a, px, u, { mode: 'raise', fill: ['#ffe9a8', '#d0963a'], hi: 'rgba(255, 250, 220, 0.7)', lo: 'rgba(60, 0, 8, 0.8)', rough: 0.25, metal: 1, glow: '#ff3b45', glowAlpha: 0.6 })

// ── Tabela ──────────────────────────────────────────────

export const PACK_SURFACES: Record<string, Surface> = {
  osso:       { face: boneFace, number: boneNumber },
  ferro:      { face: ironFace, number: ironNumber },
  argila:     { face: clayFace, number: clayNumber },
  giz:        { face: chalkFace, number: chalkNumber },
  cobre:      { face: copperFace, number: copperNumber },
  marfim:     { face: ivoryFace, number: ivoryNumber },
  onix:       { face: onyxFace, number: onyxNumber },
  ametista:   { face: amethystFace, number: amethystNumber },
  granada:    { face: garnetFace, number: garnetNumber },
  jade:       { face: jadeFace, number: jadeNumber },
  fume:       { face: smokeFace, number: smokeNumber },
  gelo:       { face: iceFace, number: iceNumber },
  magma:      { face: magmaFace, number: magmaNumber },
  meteorito:  { face: meteorFace, number: meteorNumber },
  fungo:      { face: fungusFace, number: fungusNumber },
  ambar:      { face: amberFace, number: amberNumber },
  morte:      { face: deathFace, number: deathNumber },
  vagalumes:  { face: fireflyFace, number: fireflyNumber },
  runico:     { face: runicFace, number: runicNumber },
  vortice:    { face: vortexFace, number: vortexNumber },
}

void shade
