import { between, crackPath, gray, jagged, lerp2, lineTo, polyPath, rgba, shade, type FacePaint, type Surface, type V2 } from './dieSurfaces'
import {
  at, begin, blobs, boxOf, bubbles, chip, dents, end, fibers, glowOf, grains, handNum, num, pick, rim, rm, scratches, sheen, vein, veinPath, veinTree, vignette,
} from './dieSurfacesPack'

// ────────────────────────────────────────────────────────
// A segunda leva da coleção: 14 conjuntos, do comum ao mítico. Mesmas regras da primeira (dieSurfacesPack.ts): cada um pinta
// a face em canvas (cor, relevo, rugosidade/metal, luz própria e opacidade na resina) e os seus números, tudo de sorteio com
// semente. Estes também têm som próprio (o campo `sound` em skins.ts, as vozes de sound.ts).
// ────────────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D
type NumberPainter = Surface['number']

const TAU = Math.PI * 2
const dir = (c: V2, a: number, r: number): V2 => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]

/** Teia: raios saindo de `hub` (ângulos tortos) e anéis de raio irregular. O último anel passa da borda da face. */
function web(f: FacePaint, spokes: number, rings: number[]): { ang: number[]; rad: number[][] } {
  const { rnd, radius: R } = f
  const a0 = rnd() * TAU
  const ang = Array.from({ length: spokes }, (_, i) => a0 + ((i + (rnd() - 0.5) * 0.5) / spokes) * TAU)
  const rad = rings.map((r) => ang.map(() => R * r * between(rnd, 0.82, 1.18)))
  rad.push(ang.map(() => R * 2.4))
  return { ang, rad }
}

/** O caco entre os raios i e i+1 e os anéis j-1 e j (j = 0: do centro até o primeiro anel). */
function cellPath(c: Ctx, hub: V2, w: { ang: number[]; rad: number[][] }, i: number, j: number): void {
  const n = w.ang.length, k = (i + 1) % n
  const inner = (s: number) => (j === 0 ? 0 : w.rad[j - 1][s])
  c.beginPath()
  c.moveTo(...dir(hub, w.ang[i], inner(i)))
  c.lineTo(...dir(hub, w.ang[i], w.rad[j][i]))
  c.lineTo(...dir(hub, w.ang[k], w.rad[j][k]))
  c.lineTo(...dir(hub, w.ang[k], inner(k)))
  c.closePath()
}

/** As linhas da teia (os raios e os anéis), como caminhos soltos. */
function webLines(hub: V2, w: { ang: number[]; rad: number[][] }): V2[][] {
  const n = w.ang.length, lines: V2[][] = []
  for (let i = 0; i < n; i++) lines.push([hub, dir(hub, w.ang[i], w.rad[w.rad.length - 1][i])])
  for (let j = 0; j < w.rad.length - 1; j++) for (let i = 0; i < n; i++) lines.push([dir(hub, w.ang[i], w.rad[j][i]), dir(hub, w.ang[(i + 1) % n], w.rad[j][(i + 1) % n])])
  return lines
}

/** Estrelinha de quatro pontas. */
function sparkle(c: Ctx, p: V2, r: number, style: string): void {
  c.fillStyle = style
  c.beginPath()
  for (let i = 0; i < 8; i++) { const q = dir(p, (i * Math.PI) / 4, i % 2 ? r * 0.2 : r); if (i === 0) c.moveTo(...q); else c.lineTo(...q) }
  c.closePath(); c.fill()
}

// ── 21. Rolha de Taverna ────────────────────────────────

function corkFace(f: FacePaint): void {
  const { cx, bx, rnd, radius: R, k } = f
  begin(f, { top: '#d0a66e', bottom: '#8a5e2e', rough: 0.95, metal: 0 })
  blobs(f, ['#e4c08c', '#7a4e22', '#b98850'], 22, 0.08, 0.3, 0.12, 0.3)
  grains(f, [['#5a3614', 0.55], ['#ecd0a0', 0.5], ['#3a2008', 0.5]], 26, 0.8, 3.2, 0.35)
  // poros da cortiça: fendas escuras curtas, mais ou menos no mesmo sentido
  const ang = rnd() * Math.PI
  cx.lineCap = 'round'; bx.lineCap = 'round'
  for (let i = 0; i < Math.round((R * R) / 420); i++) {
    const p = at(f, 1.1), q = dir(p, ang + (rnd() - 0.5) * 0.6, between(rnd, 3, 13) * k), w = between(rnd, 1.2, 3.4) * k
    cx.strokeStyle = 'rgba(52, 28, 8, 0.75)'; cx.lineWidth = w; lineTo(cx, [p, q]); cx.stroke()
    bx.strokeStyle = gray(40, 0.9); bx.lineWidth = w; lineTo(bx, [p, q]); bx.stroke()
  }
  // marca de vinho: o arco que o fundo da taça deixou
  if (rnd() < 0.7) {
    const c = at(f, 0.6), r = R * between(rnd, 0.35, 0.6), a0 = rnd() * TAU, sweep = between(rnd, 2.2, 4.6)
    for (let pass = 0; pass < 4; pass++) { cx.strokeStyle = rgba('#6a1030', 0.1 + pass * 0.05); cx.lineWidth = (10 - pass * 2.2) * k; cx.beginPath(); cx.arc(c[0], c[1], r, a0, a0 + sweep); cx.stroke() }
  }
  vignette(f, '#4a2c0c', 0.45)
  chip(f, '#e2c290', 0.6)
  rim(f, 'rgba(240, 214, 160, 0.35)', 'rgba(60, 34, 10, 0.5)')
  end(f)
}
// marcado a ferro quente
const corkNumber: NumberPainter = (f, t, x, y, a, px, u) =>
  num(f, t, x, y, a, px, u, { mode: 'cut', fill: ['#2a1206', '#4a1c10'], hi: 'rgba(255, 220, 160, 0.3)', lo: 'rgba(20, 6, 0, 0.7)', rough: 1, metal: 0 })

// ── 22. Cera de Vela (vermelha; os números são a luz da chama) ──

function waxFace(f: FacePaint): void {
  const { cx, bx, gx, rnd, radius: R, k, center } = f
  begin(f, { top: '#c8303a', bottom: '#5a0c14', rough: 0.38, metal: 0, lit: 0.3 })
  blobs(f, ['#e8585c', '#7a1018', '#a01c26'], 14, 0.2, 0.6, 0.1, 0.25)
  // o calor da chama por dentro da cera
  const warm = cx.createRadialGradient(center[0], center[1], 0, center[0], center[1], R * 0.9)
  warm.addColorStop(0, 'rgba(255, 150, 60, 0.42)'); warm.addColorStop(1, 'rgba(255, 150, 60, 0)')
  cx.fillStyle = warm; cx.fillRect(...boxOf(f))
  if (gx) {
    const g = gx.createRadialGradient(center[0], center[1], 0, center[0], center[1], R * 0.8)
    g.addColorStop(0, glowOf(f, '#ff8a3a', 0.4)); g.addColorStop(1, glowOf(f, '#ff8a3a', 0))
    gx.fillStyle = g; gx.fillRect(...boxOf(f))
  }
  // pingos escorridos: descem do alto da face e engrossam na ponta
  cx.lineCap = 'round'; bx.lineCap = 'round'
  for (let i = 0; i < 3 + Math.floor(rnd() * 3); i++) {
    const x = center[0] + between(rnd, -R * 0.85, R * 0.85), y0 = center[1] - R * 1.15, y1 = y0 + R * between(rnd, 0.45, 1.3), w = R * between(rnd, 0.07, 0.13)
    cx.strokeStyle = 'rgba(40, 0, 6, 0.45)'; cx.lineWidth = w * 1.25; lineTo(cx, [[x + 2 * k, y0], [x + 2 * k, y1 + 2 * k]]); cx.stroke()
    cx.strokeStyle = '#d83c44'; cx.lineWidth = w; lineTo(cx, [[x, y0], [x, y1]]); cx.stroke()
    cx.fillStyle = '#d83c44'; cx.beginPath(); cx.arc(x, y1, w * 0.72, 0, TAU); cx.fill()
    cx.strokeStyle = 'rgba(255, 200, 200, 0.8)'; cx.lineWidth = w * 0.18; lineTo(cx, [[x - w * 0.22, y0], [x - w * 0.22, y1 - w * 0.2]]); cx.stroke()
    bx.strokeStyle = gray(205, 0.9); bx.lineWidth = w; lineTo(bx, [[x, y0], [x, y1]]); bx.stroke()
    bx.fillStyle = gray(225, 0.9); bx.beginPath(); bx.arc(x, y1, w * 0.72, 0, TAU); bx.fill()
  }
  // fuligem do pavio
  blobs(f, ['#1a0606'], 3, 0.12, 0.3, 0.12, 0.26)
  grains(f, [['#1a0606', 0.5], ['#ffb0b0', 0.5]], 420, 0.6, 1.6, 0.1)
  scratches(f, Math.round(R / 14), '#ffc0c0', 0.22)
  sheen(f, 0.2)
  rim(f, 'rgba(255, 170, 170, 0.45)', 'rgba(50, 0, 6, 0.5)')
  end(f)
}
const waxNumber: NumberPainter = (f, t, x, y, a, px, u) =>
  num(f, t, x, y, a, px, u, { mode: 'cut', fill: ['#fff0c0', '#e8a23a'], hi: 'rgba(255, 210, 190, 0.5)', lo: 'rgba(40, 0, 4, 0.75)', rough: 0.5, metal: 0, glow: '#ffb84a', glowAlpha: 0.9 })

// ── 23. Vitral de Catedral ──────────────────────────────

const GLASS = ['#d8263a', '#2a5ad8', '#f2b01e', '#1e9a5a', '#8a3ad0', '#e86a1e', '#1eb0c8'] as const

function stainedFace(f: FacePaint): void {
  const { cx, bx, rx, gx, rnd, radius: R, k, center, poly } = f
  begin(f, { top: '#2a3a6a', bottom: '#14161c', rough: 0.08, metal: 0 })
  const hub = lerp2(center, poly[Math.floor(rnd() * poly.length)], between(rnd, 0, 0.22))
  const w = web(f, 6 + Math.floor(rnd() * 3), [between(rnd, 0.36, 0.48)])
  // os vidros: cada caco numa cor, mais claro perto do meio (a luz atravessando)
  const hue = Math.floor(rnd() * GLASS.length)
  for (let j = 0; j < w.rad.length; j++) for (let i = 0; i < w.ang.length; i++) {
    const col = GLASS[(hue + i * (j ? 2 : 3) + j * 4) % GLASS.length]
    const g = cx.createRadialGradient(hub[0], hub[1], 0, hub[0], hub[1], R * 1.5)
    g.addColorStop(0, shade(col, 0.4)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, -0.45))
    cx.fillStyle = g; cellPath(cx, hub, w, i, j); cx.fill()
    if (gx) { gx.fillStyle = glowOf(f, shade(col, 0.2), 0.55); cellPath(gx, hub, w, i, j); gx.fill() }
  }
  // o vidro soprado: ondas, bolhas e riscos
  fibers(f, '#ffffff', Math.round((R * R) / 520), rnd() * Math.PI, 30, 120, 0.8, 2.4, 0.04, 0.14)
  bubbles(f, 5 + Math.floor(rnd() * 6), 1.2, 3.6)
  // o chumbo que segura os cacos: escuro, em relevo, com um fio de luz
  const lines = webLines(hub, w)
  cx.lineCap = 'round'; bx.lineCap = 'round'
  for (const l of lines) {
    cx.strokeStyle = '#17181d'; cx.lineWidth = 8 * k; lineTo(cx, l); cx.stroke()
    cx.strokeStyle = 'rgba(190, 196, 212, 0.45)'; cx.lineWidth = 1.5 * k; lineTo(cx, l.map(([x, y]): V2 => [x - 1.6 * k, y - 1.6 * k])); cx.stroke()
    bx.strokeStyle = gray(222); bx.lineWidth = 8 * k; lineTo(bx, l); bx.stroke()
    rx.strokeStyle = rm(0.5, 0.85); rx.lineWidth = 8 * k; lineTo(rx, l); rx.stroke()
    if (gx) { gx.strokeStyle = '#000'; gx.lineWidth = 8 * k; lineTo(gx, l); gx.stroke() }
  }
  // soldas nos encontros
  for (let i = 0; i < w.ang.length; i++) {
    const p = dir(hub, w.ang[i], w.rad[0][i])
    cx.fillStyle = '#23252c'; cx.beginPath(); cx.arc(p[0], p[1], 6 * k, 0, TAU); cx.fill()
    bx.fillStyle = gray(240); bx.beginPath(); bx.arc(p[0], p[1], 6 * k, 0, TAU); bx.fill()
  }
  sheen(f, 0.2)
  // a moldura de chumbo
  cx.strokeStyle = '#17181d'; cx.lineWidth = 12 * k; polyPath(cx, poly, center, 0.03); cx.stroke()
  bx.strokeStyle = gray(215); bx.lineWidth = 12 * k; polyPath(bx, poly, center, 0.03); bx.stroke()
  rx.strokeStyle = rm(0.5, 0.85); rx.lineWidth = 12 * k; polyPath(rx, poly, center, 0.03); rx.stroke()
  if (gx) { gx.strokeStyle = '#000'; gx.lineWidth = 12 * k; polyPath(gx, poly, center, 0.03); gx.stroke() }
  end(f)
}
const stainedNumber: NumberPainter = (f, t, x, y, a, px, u) =>
  num(f, t, x, y, a, px, u, { mode: 'paint', fill: ['#fffdf0', '#ffe9a8'], stroke: 'rgba(12, 12, 18, 0.95)', hi: 'rgba(255, 255, 255, 0.6)', rough: 0.3, metal: 0, glow: '#ffe6a0', glowAlpha: 1 })

// ── 24. Pergaminho Antigo ───────────────────────────────

function parchmentFace(f: FacePaint): void {
  const { cx, bx, rx, rnd, radius: R, k, center, poly } = f
  begin(f, { top: '#ead9ac', bottom: '#a8854c', rough: 0.9, metal: 0 })
  const grain = rnd() * Math.PI
  fibers(f, '#fff4d0', Math.round((R * R) / 260), grain, 20, 90, 0.6, 1.6, 0.1, 0.28, 0.06)
  fibers(f, '#7a5a2a', Math.round((R * R) / 340), grain + 1.4, 16, 70, 0.6, 1.4, 0.06, 0.2, 0.06)
  blobs(f, ['#8a5a22', '#c9a868', '#6a4014'], 12, 0.15, 0.5, 0.06, 0.2)
  // letra miúda de escriba: linhas de rabiscos, palavra por palavra
  const tilt = (rnd() - 0.5) * 0.3, cs = Math.cos(tilt), sn = Math.sin(tilt)
  cx.lineCap = 'round'; cx.lineJoin = 'round'
  for (let row = -4; row <= 4; row++) {
    let u = -R * 1.05
    while (u < R * 1.05) {
      const len = R * between(rnd, 0.08, 0.26), pts: V2[] = []
      for (let s = 0; s <= len; s += 3.2 * k) {
        const v = row * R * 0.2 + (rnd() - 0.5) * 6 * k
        pts.push([center[0] + (u + s) * cs - v * sn, center[1] + (u + s) * sn + v * cs])
      }
      cx.strokeStyle = `rgba(52, 28, 10, ${between(rnd, 0.16, 0.32)})`; cx.lineWidth = between(rnd, 0.8, 1.5) * k; lineTo(cx, pts); cx.stroke()
      u += len + R * between(rnd, 0.04, 0.09)
    }
  }
  // dobra antiga
  const fold = veinPath(f, 3, 22)
  cx.strokeStyle = 'rgba(90, 58, 22, 0.4)'; cx.lineWidth = 2 * k; lineTo(cx, fold); cx.stroke()
  cx.strokeStyle = 'rgba(255, 246, 214, 0.45)'; cx.lineWidth = 1.2 * k; lineTo(cx, fold.map(([x, y]): V2 => [x + 2 * k, y + 2 * k])); cx.stroke()
  bx.strokeStyle = gray(88, 0.7); bx.lineWidth = 2.4 * k; lineTo(bx, fold); bx.stroke()
  // manchas de umidade (pintinhas) e a borda queimada
  grains(f, [['#7a4a1a', 0.55], ['#5a3410', 0.45]], 300, 0.8, 2.8, 0.08)
  vignette(f, '#3a1e06', 0.7)
  for (const v of poly) {
    const p = lerp2(v, center, between(rnd, 0, 0.12)), r = R * between(rnd, 0.14, 0.3)
    const g = cx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r)
    g.addColorStop(0, 'rgba(24, 12, 4, 0.8)'); g.addColorStop(1, 'rgba(24, 12, 4, 0)')
    cx.fillStyle = g; cx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2)
  }
  // lacre de cera vermelha num canto (nem toda face tem)
  if (rnd() < 0.55) {
    const p = lerp2(poly[Math.floor(rnd() * poly.length)], center, between(rnd, 0.3, 0.42)), r = R * between(rnd, 0.11, 0.15)
    const g = cx.createRadialGradient(p[0] - r * 0.3, p[1] - r * 0.3, 0, p[0], p[1], r)
    g.addColorStop(0, '#d8402e'); g.addColorStop(0.7, '#8a1a12'); g.addColorStop(1, '#4a0a06')
    cx.fillStyle = g; cx.beginPath()
    for (let i = 0; i <= 14; i++) { const q = dir(p, (i / 14) * TAU, r * between(rnd, 0.9, 1.1)); if (i === 0) cx.moveTo(...q); else cx.lineTo(...q) }
    cx.closePath(); cx.fill()
    cx.strokeStyle = 'rgba(60, 6, 4, 0.8)'; cx.lineWidth = 1.6 * k; cx.beginPath(); cx.arc(p[0], p[1], r * 0.62, 0, TAU); cx.stroke()
    sparkle(cx, p, r * 0.42, 'rgba(60, 6, 4, 0.7)')
    bx.fillStyle = gray(225); bx.beginPath(); bx.arc(p[0], p[1], r, 0, TAU); bx.fill()
    bx.fillStyle = gray(170); bx.beginPath(); bx.arc(p[0], p[1], r * 0.62, 0, TAU); bx.fill()
    rx.fillStyle = rm(0.25, 0); rx.beginPath(); rx.arc(p[0], p[1], r, 0, TAU); rx.fill()
  }
  chip(f, '#f0e2bc', 0.5)
  rim(f, 'rgba(255, 244, 210, 0.3)', 'rgba(40, 20, 4, 0.55)')
  end(f)
}
// tinta de pena
const parchmentNumber: NumberPainter = (f, t, x, y, a, px, u) => handNum(f, t, x, y, a, px, u, '#24120a', 'rgba(110, 60, 20, 0.28)', 0.095)

// ── 25. Bronze de Sino ──────────────────────────────────

function bellFace(f: FacePaint): void {
  const { cx, bx, rx, rnd, radius: R, k, center, poly } = f
  begin(f, { top: '#c0914a', bottom: '#4a3210', rough: 0.34, metal: 0.92, lit: 0.3 })
  blobs(f, ['#e8c070', '#3a2408', '#8a6424'], 12, 0.2, 0.55, 0.08, 0.2)
  grains(f, [['#f0d088', 0.35], ['#2a1a06', 0.45]], 60, 0.7, 2.2, 0.3)      // a pele áspera da fundição
  dents(f, Math.round((R * R) / 4200), 6, 16, '#f0d088', '#2a1a06')
  // frisos do sino: filetes em relevo acompanhando a borda
  for (const [inset, w] of [[0.16, 5], [0.21, 2.4], [0.58, 3.4]] as const) {
    cx.lineJoin = 'round'
    cx.strokeStyle = 'rgba(40, 24, 4, 0.7)'; cx.lineWidth = (w + 3) * k; polyPath(cx, poly, center, inset - 0.006); cx.stroke()
    cx.strokeStyle = 'rgba(248, 220, 150, 0.8)'; cx.lineWidth = w * k; polyPath(cx, poly, center, inset); cx.stroke()
    bx.strokeStyle = gray(225, 0.9); bx.lineWidth = w * 1.3 * k; polyPath(bx, poly, center, inset); bx.stroke()
    rx.strokeStyle = rm(0.18, 1); rx.lineWidth = w * k; polyPath(rx, poly, center, inset); rx.stroke()
  }
  // azinhavre nas quinas: verde fosco que cobre o metal
  for (const v of poly) {
    if (rnd() < 0.3) continue
    const p = lerp2(v, center, between(rnd, 0.02, 0.2)), r = R * between(rnd, 0.14, 0.32)
    for (let i = 0; i < 26; i++) {
      const q = dir(p, rnd() * TAU, r * Math.sqrt(rnd())), s = between(rnd, 2, 7) * k
      cx.fillStyle = rgba(pick(rnd, ['#3aa08a', '#58b89c', '#2a7a6a', '#8ad0b8']), between(rnd, 0.3, 0.7)); cx.beginPath(); cx.arc(q[0], q[1], s, 0, TAU); cx.fill()
      rx.fillStyle = 'rgba(0, 235, 30, 0.7)'; rx.beginPath(); rx.arc(q[0], q[1], s, 0, TAU); rx.fill()
    }
  }
  scratches(f, Math.round(R / 9), '#fff0c0', 0.25)
  vignette(f, '#2a1804', 0.5)
  rim(f, 'rgba(250, 226, 160, 0.45)', 'rgba(30, 16, 2, 0.55)')
  end(f)
}
const bellNumber: NumberPainter = (f, t, x, y, a, px, u) =>
  num(f, t, x, y, a, px, u, { mode: 'raise', fill: ['#f6dc96', '#a87424'], hi: 'rgba(255, 250, 220, 0.75)', lo: 'rgba(30, 16, 2, 0.8)', rough: 0.2, metal: 1 })

// ── 26. Engrenagens de Relógio ──────────────────────────

function gearPath(c: Ctx, p: V2, r: number, teeth: number, rot: number): void {
  const step = TAU / teeth
  c.beginPath()
  for (let i = 0; i < teeth; i++) {
    const a = rot + i * step
    const pts: V2[] = [dir(p, a, r * 0.84), dir(p, a + step * 0.16, r), dir(p, a + step * 0.42, r), dir(p, a + step * 0.58, r * 0.84)]
    pts.forEach((q, j) => { if (i === 0 && j === 0) c.moveTo(...q); else c.lineTo(...q) })
  }
  c.closePath()
}

const GEAR_METALS: [string, string][] = [['#e8c66a', '#7a5618'], ['#c2c8d0', '#4a5058'], ['#d88a56', '#6a3214']]

function clockFace(f: FacePaint): void {
  const { cx, bx, rx, rnd, radius: R, k, center, poly } = f
  begin(f, { top: '#6a5222', bottom: '#241808', rough: 0.4, metal: 0.85 })
  // a platina do fundo, escovada em círculos
  cx.lineCap = 'round'
  for (let i = 0; i < Math.round(R / 3); i++) {
    const r = R * between(rnd, 0.05, 1.3), a0 = rnd() * TAU
    cx.strokeStyle = rgba(rnd() < 0.5 ? '#d8b45a' : '#000000', between(rnd, 0.05, 0.16)); cx.lineWidth = between(rnd, 0.6, 1.6) * k
    cx.beginPath(); cx.arc(center[0], center[1], r, a0, a0 + between(rnd, 0.4, 2.2)); cx.stroke()
  }
  // engrenagens: três ou quatro, cada uma num metal, umas por cima das outras
  const count = 3 + Math.floor(rnd() * 2), start = Math.floor(rnd() * poly.length)
  for (let g = 0; g < count; g++) {
    const p = lerp2(poly[(start + g * 2) % poly.length], center, between(rnd, 0.1, 0.5)), r = R * between(rnd, 0.36, 0.62), teeth = Math.round(r / (9 * k)) + 6, rot = rnd() * TAU
    const [light, dark] = GEAR_METALS[g % GEAR_METALS.length]
    cx.fillStyle = 'rgba(0, 0, 0, 0.5)'; gearPath(cx, [p[0] + 4 * k, p[1] + 5 * k], r, teeth, rot); cx.fill()
    const body = cx.createRadialGradient(p[0] - r * 0.3, p[1] - r * 0.3, r * 0.1, p[0], p[1], r)
    body.addColorStop(0, light); body.addColorStop(1, dark)
    cx.fillStyle = body; gearPath(cx, p, r, teeth, rot); cx.fill()
    cx.strokeStyle = 'rgba(0, 0, 0, 0.6)'; cx.lineWidth = 1.4 * k; cx.stroke()
    bx.fillStyle = gray(150 + g * 24); gearPath(bx, p, r, teeth, rot); bx.fill()
    rx.fillStyle = rm(0.24, 1); gearPath(rx, p, r, teeth, rot); rx.fill()
    // os vãos entre os raios da roda
    const arms = 4 + Math.floor(rnd() * 3)
    for (let s = 0; s < arms; s++) {
      const a0 = rot + (s / arms) * TAU + 0.16, a1 = rot + ((s + 1) / arms) * TAU - 0.16
      for (const c of [cx, bx]) {
        c.fillStyle = c === cx ? 'rgba(14, 9, 3, 0.92)' : gray(70)
        c.beginPath(); c.arc(p[0], p[1], r * 0.68, a0, a1); c.arc(p[0], p[1], r * 0.3, a1, a0, true); c.closePath(); c.fill()
      }
    }
    cx.strokeStyle = rgba(light, 0.55); cx.lineWidth = 1.2 * k; cx.beginPath(); cx.arc(p[0], p[1], r * 0.74, 0, TAU); cx.stroke()
    // eixo e rubi
    cx.fillStyle = dark; cx.beginPath(); cx.arc(p[0], p[1], r * 0.2, 0, TAU); cx.fill()
    const jewel = cx.createRadialGradient(p[0] - r * 0.03, p[1] - r * 0.03, 0, p[0], p[1], r * 0.11)
    jewel.addColorStop(0, '#ff9aa8'); jewel.addColorStop(0.5, '#d01838'); jewel.addColorStop(1, '#5a0414')
    cx.fillStyle = jewel; cx.beginPath(); cx.arc(p[0], p[1], r * 0.11, 0, TAU); cx.fill()
    bx.fillStyle = gray(235); bx.beginPath(); bx.arc(p[0], p[1], r * 0.2, 0, TAU); bx.fill()
    rx.fillStyle = rm(0.05, 0); rx.beginPath(); rx.arc(p[0], p[1], r * 0.11, 0, TAU); rx.fill()
  }
  // parafusos azulados
  for (let i = 0; i < 2; i++) {
    const p = at(f, 0.75), r = R * 0.05, a = rnd() * Math.PI
    cx.fillStyle = '#2a4a8a'; cx.beginPath(); cx.arc(p[0], p[1], r, 0, TAU); cx.fill()
    cx.strokeStyle = '#0a1430'; cx.lineWidth = 1.6 * k; lineTo(cx, [dir(p, a, r * 0.8), dir(p, a + Math.PI, r * 0.8)]); cx.stroke()
    bx.fillStyle = gray(215); bx.beginPath(); bx.arc(p[0], p[1], r, 0, TAU); bx.fill()
  }
  // a minuteria: tracinhos por dentro da borda
  cx.strokeStyle = 'rgba(248, 224, 150, 0.8)'
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU, long = i % 5 === 0
    cx.lineWidth = (long ? 2 : 1) * k; lineTo(cx, [dir(center, a, R * 0.8), dir(center, a, R * (long ? 0.72 : 0.76))]); cx.stroke()
  }
  vignette(f, '#000000', 0.45)
  rim(f, 'rgba(248, 224, 150, 0.5)', 'rgba(0, 0, 0, 0.6)')
  end(f)
}
// algarismos de mostrador: placa clara atrás, número preto esmaltado
const clockNumber: NumberPainter = (f, t, x, y, a, px, u) => {
  const { cx, bx, rx } = f, r = px * (t.length > 1 ? 0.62 : 0.48)
  const plate = cx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
  plate.addColorStop(0, '#fffaf0'); plate.addColorStop(1, '#d8c8a0')
  cx.fillStyle = plate; cx.beginPath(); cx.arc(x, y, r, 0, TAU); cx.fill()
  cx.strokeStyle = '#8a5e14'; cx.lineWidth = px * 0.07; cx.stroke()
  cx.strokeStyle = '#f0d890'; cx.lineWidth = px * 0.025; cx.stroke()
  bx.fillStyle = gray(205); bx.beginPath(); bx.arc(x, y, r, 0, TAU); bx.fill()
  rx.fillStyle = rm(0.3, 0); rx.beginPath(); rx.arc(x, y, r, 0, TAU); rx.fill()
  num(f, t, x, y, a, px * 0.74, u, { mode: 'paint', fill: '#14100a', stroke: 'rgba(255, 250, 235, 0.5)', hi: 'rgba(120, 110, 90, 0.5)', rough: 0.25, metal: 0 })
}

// ── 27. Madrepérola ─────────────────────────────────────

function nacreFace(f: FacePaint): void {
  const { cx, bx, rnd, radius: R, k, center } = f
  begin(f, { top: '#f8f3fa', bottom: '#b8acd0', rough: 0.16, metal: 0.1, lit: 0.3 })
  // furta-cor: fitas largas de rosa, água, lilás e ouro claro que se enrolam
  cx.lineCap = 'round'
  for (let i = 0; i < 11; i++) {
    const p = (): V2 => [center[0] + between(rnd, -R * 1.1, R * 1.1), center[1] + between(rnd, -R * 1.1, R * 1.1)]
    const a = p(), c1 = p(), c2 = p(), b = p(), col = pick(rnd, ['#ff9ad0', '#8af0e0', '#c0a8ff', '#ffe89a', '#9ac8ff']), w = R * between(rnd, 0.12, 0.36)
    for (let pass = 0; pass < 7; pass++) {
      cx.strokeStyle = rgba(col, 0.045 + pass * 0.012); cx.lineWidth = w * (1 - pass * 0.13)
      cx.beginPath(); cx.moveTo(...a); cx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], b[0], b[1]); cx.stroke()
    }
  }
  // linhas de crescimento da concha: muitas, finas, quase paralelas e onduladas
  const ang = rnd() * Math.PI, nx = -Math.sin(ang), ny = Math.cos(ang), ph = rnd() * 6
  for (let o = -R * 1.3; o < R * 1.3; o += R * between(rnd, 0.025, 0.06)) {
    const pts: V2[] = []
    for (let s = -R * 1.4; s <= R * 1.4; s += R * 0.1) {
      const wob = Math.sin(s / (R * 0.32) + ph) * R * 0.035
      pts.push([center[0] + Math.cos(ang) * s + nx * (o + wob), center[1] + Math.sin(ang) * s + ny * (o + wob)])
    }
    const light = rnd() < 0.55
    cx.strokeStyle = light ? `rgba(255, 255, 255, ${between(rnd, 0.2, 0.5)})` : rgba('#7a68a8', between(rnd, 0.08, 0.2)); cx.lineWidth = between(rnd, 0.6, 1.6) * k; lineTo(cx, pts); cx.stroke()
    bx.strokeStyle = gray(light ? 150 : 108, 0.35); bx.lineWidth = 1.4 * k; lineTo(bx, pts); bx.stroke()
  }
  grains(f, [['#ffffff', 0.85]], 520, 0.6, 1.5, 0)
  sheen(f, 0.3)
  vignette(f, '#6a5a98', 0.3)
  rim(f, 'rgba(255, 255, 255, 0.75)', 'rgba(90, 76, 140, 0.4)')
  end(f)
}
const nacreNumber: NumberPainter = (f, t, x, y, a, px, u) =>
  num(f, t, x, y, a, px, u, { mode: 'cut', fill: ['#5a4a88', '#2e2250'], hi: 'rgba(255, 255, 255, 0.85)', lo: 'rgba(40, 28, 80, 0.6)', rough: 0.3, metal: 0.4 })

// ── 28. Nuvem de Tempestade ─────────────────────────────

function stormFace(f: FacePaint): void {
  const { cx, bx, gx, rnd, radius: R, k, center } = f
  begin(f, { top: '#4a5262', bottom: '#0c0f16', rough: 0.8, metal: 0, lit: 0.1 })
  // nuvens carregadas: massas grandes e macias, claras em cima e pretas embaixo
  blobs(f, ['#1a1e28', '#05070c'], 10, 0.3, 0.7, 0.2, 0.45)
  blobs(f, ['#7a8698', '#98a4b8', '#5a6678'], 26, 0.12, 0.42, 0.08, 0.26)
  blobs(f, ['#b8c4d8'], 8, 0.06, 0.2, 0.08, 0.2)
  for (let i = 0; i < 16; i++) {
    const p = at(f, 1), r = R * between(rnd, 0.1, 0.3)
    const g = bx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r)
    g.addColorStop(0, gray(175, 0.5)); g.addColorStop(1, gray(128, 0))
    bx.fillStyle = g; bx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2)
  }
  // chuva: riscos finos, todos inclinados para o mesmo lado
  fibers(f, '#b8d4f0', Math.round((R * R) / 260), 1.15, 14, 44, 0.5, 1.1, 0.08, 0.24)
  // raios: um tronco torto e os galhos, branco por dentro e azul por fora
  const bolts = 1 + (rnd() < 0.45 ? 1 : 0)
  cx.lineJoin = 'round'; cx.lineCap = 'round'
  for (let b = 0; b < bolts; b++) {
    const trunk = crackPath(f, rnd), paths: [V2[], number][] = [[trunk, 1]]
    for (let i = 0; i < 2 + Math.floor(rnd() * 3); i++) {
      const j = 1 + Math.floor(rnd() * Math.max(1, trunk.length - 2)), p = trunk[j], nx = trunk[Math.min(j + 1, trunk.length - 1)]
      const a = Math.atan2(nx[1] - p[1], nx[0] - p[0]) + (rnd() < 0.5 ? 1 : -1) * between(rnd, 0.4, 1), len = R * between(rnd, 0.18, 0.5)
      paths.push([jagged(p, dir(p, a, len), rnd, 7 * k, 10 * k), 0.5])
    }
    for (const [path, t] of paths) {
      for (const [w, al] of [[20, 0.07], [12, 0.12], [6, 0.24]] as const) { cx.strokeStyle = rgba('#6ab0ff', al); cx.lineWidth = w * k * t; lineTo(cx, path); cx.stroke() }
      cx.strokeStyle = '#f4faff'; cx.lineWidth = 2.4 * k * t; lineTo(cx, path); cx.stroke()
      if (gx) {
        gx.lineJoin = 'round'; gx.lineCap = 'round'
        gx.strokeStyle = glowOf(f, '#6ab0ff', 0.3); gx.lineWidth = 16 * k * t; lineTo(gx, path); gx.stroke()
        gx.strokeStyle = glowOf(f, '#ffffff', 1); gx.lineWidth = 3 * k * t; lineTo(gx, path); gx.stroke()
      }
    }
  }
  // o clarão por dentro da nuvem
  if (gx) {
    const p = at(f, 0.5), r = R * 0.7, g = gx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r)
    g.addColorStop(0, glowOf(f, '#9ad0ff', 0.22)); g.addColorStop(1, glowOf(f, '#9ad0ff', 0))
    gx.fillStyle = g; gx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2)
  }
  vignette(f, '#000000', 0.5)
  rim(f, 'rgba(170, 200, 235, 0.3)', 'rgba(0, 0, 0, 0.65)')
  void center
  end(f)
}
const stormNumber: NumberPainter = (f, t, x, y, a, px, u) =>
  num(f, t, x, y, a, px, u, { mode: 'paint', fill: ['#ffffff', '#bfe4ff'], stroke: 'rgba(6, 12, 28, 0.9)', hi: 'rgba(255, 255, 255, 0.7)', rough: 0.4, metal: 0, glow: '#bfe4ff', glowAlpha: 0.9 })

// ── 29. Olho do Abismo (resina com um olho dentro) ──────

function eyeFace(f: FacePaint): void {
  const { cx, gx, rnd, radius: R, k } = f
  begin(f, { top: '#5a1228', bottom: '#12030a', rough: 0.05, metal: 0, lit: 0.25, alpha: ['#2c2c2c', '#a8a8a8'] })
  blobs(f, ['#8a1a3a', '#050104', '#b02a4a'], 8, 0.2, 0.5, 0.06, 0.16)
  // vasos: saem das bordas e se ramificam para o meio
  for (let i = 0; i < 3; i++) {
    const trunk = veinTree(f, 'rgba(255, 96, 128, 0.7)', 'rgba(40, 0, 10, 0.35)', 1.7, 5)
    if (gx) { gx.strokeStyle = glowOf(f, '#ff3a6a', 0.5); gx.lineWidth = 2.6 * k; lineTo(gx, trunk); gx.stroke() }
  }
  for (let i = 0; i < 2; i++) vein(f, veinPath(f, 9, 11), 'rgba(255, 150, 170, 0.35)', 'rgba(40, 0, 10, 0.2)', 0.9)
  bubbles(f, 4 + Math.floor(rnd() * 5), 1.4, 4.4, '255, 190, 200')
  grains(f, [['#ffc0cc', 0.6]], 520, 0.6, 1.4, 0)
  sheen(f, 0.26)
  // fio de luz por dentro da borda
  cx.strokeStyle = 'rgba(255, 90, 122, 0.85)'; cx.lineWidth = 2.4 * k; polyPath(cx, f.poly, f.center, 0.11); cx.stroke()
  if (gx) { gx.strokeStyle = glowOf(f, '#ff3a6a', 0.9); gx.lineWidth = 3 * k; polyPath(gx, f.poly, f.center, 0.11); gx.stroke() }
  if (f.tx) { f.tx.strokeStyle = '#fff'; f.tx.lineWidth = 2.6 * k; polyPath(f.tx, f.poly, f.center, 0.11); f.tx.stroke() }
  rim(f, 'rgba(255, 190, 204, 0.5)', 'rgba(20, 0, 6, 0.55)')
  void R
  end(f)
}
const eyeNumber: NumberPainter = (f, t, x, y, a, px, u) =>
  num(f, t, x, y, a, px, u, { mode: 'paint', fill: '#ffe9d0', stroke: 'rgba(30, 0, 10, 0.92)', hi: 'rgba(255, 255, 240, 0.5)', rough: 0.2, metal: 0, glow: '#ff3a6a', glowAlpha: 0.55 })

// ── 30. Poeira de Galáxia (resina com um planeta dentro) ─

function galaxyFace(f: FacePaint): void {
  const { cx, gx, rnd, radius: R, k, center } = f
  begin(f, { top: '#241a5a', bottom: '#04030e', rough: 0.05, metal: 0, lit: 0.15, alpha: ['#444444', '#a8a8a8'] })
  // nebulosa: nuvens de roxo, rosa, azul e água
  blobs(f, ['#7a3ad0', '#d04a9a', '#2a6ad8', '#1ab0c0'], 16, 0.2, 0.6, 0.08, 0.26)
  blobs(f, ['#000000'], 6, 0.2, 0.5, 0.15, 0.35)
  // um braço de poeira em espiral
  const rot = rnd() * TAU, turn = between(rnd, 0.5, 0.8), c = lerp2(center, at(f, 0.5), 0.5)
  cx.lineCap = 'round'
  for (let arm = 0; arm < 2; arm++) {
    const path: V2[] = []
    for (let t = 0.04; t <= 1; t += 0.03) path.push(dir(c, rot + arm * Math.PI + t * turn * TAU, R * 1.1 * t))
    for (let pass = 0; pass < 6; pass++) { cx.strokeStyle = rgba(arm ? '#ff9ad8' : '#a8c0ff', 0.03 + pass * 0.014); cx.lineWidth = R * 0.2 * (1 - pass * 0.15); lineTo(cx, path); cx.stroke() }
    if (gx) { gx.lineCap = 'round'; gx.strokeStyle = glowOf(f, '#b8a6ff', 0.14); gx.lineWidth = R * 0.12; lineTo(gx, path); gx.stroke() }
  }
  // estrelas: poeira fina e algumas grandes, com brilho em cruz
  for (let i = 0; i < Math.round((R * R) / 260); i++) {
    const p = at(f, 1), s = between(rnd, 0.7, 2) * k, col = pick(rnd, ['#ffffff', '#ffe8c0', '#c0d8ff'])
    cx.fillStyle = rgba(col, between(rnd, 0.5, 1)); cx.fillRect(p[0], p[1], s, s)
    if (gx) { gx.fillStyle = glowOf(f, col, 0.9); gx.fillRect(p[0], p[1], s, s) }
  }
  for (let i = 0; i < 3 + Math.floor(rnd() * 3); i++) {
    const p = at(f, 0.85), r = R * between(rnd, 0.05, 0.1)
    const g = cx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 1.6)
    g.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); g.addColorStop(1, 'rgba(180, 170, 255, 0)')
    cx.fillStyle = g; cx.fillRect(p[0] - r * 1.6, p[1] - r * 1.6, r * 3.2, r * 3.2)
    sparkle(cx, p, r * 1.5, 'rgba(255, 255, 255, 0.95)')
    if (gx) sparkle(gx, p, r * 1.7, glowOf(f, '#ffffff', 1))
  }
  bubbles(f, 2 + Math.floor(rnd() * 3), 1.2, 3.2, '210, 200, 255')
  sheen(f, 0.2)
  rim(f, 'rgba(210, 200, 255, 0.5)', 'rgba(4, 2, 20, 0.55)')
  end(f)
}
const galaxyNumber: NumberPainter = (f, t, x, y, a, px, u) =>
  num(f, t, x, y, a, px, u, { mode: 'paint', fill: ['#ffffff', '#d8ccff'], stroke: 'rgba(10, 6, 40, 0.92)', hi: 'rgba(255, 255, 255, 0.6)', rough: 0.2, metal: 0, glow: '#c8b8ff', glowAlpha: 0.9 })

// ── 31. Escama de Dragão ────────────────────────────────

function dragonFace(f: FacePaint): void {
  const { cx, bx, rx, gx, rnd, radius: R, k, center, poly } = f
  begin(f, { top: '#3a0806', bottom: '#120202', rough: 0.4, metal: 0.35 })
  // escamas: fileiras de discos, cada fileira cobrindo a de baixo (sobra a ponta em U de cada uma)
  const th = rnd() * TAU, cs = Math.cos(th), sn = Math.sin(th), s = R * 0.25, rows = Math.ceil((R * 1.35) / (s * 0.6))
  const down = th + Math.PI / 2
  for (let row = rows; row >= -rows; row--) {
    for (let col = -6; col <= 6; col++) {
      const u = (col + (row & 1 ? 0.5 : 0)) * s, v = row * s * 0.6
      const p: V2 = [center[0] + u * cs - v * sn, center[1] + u * sn + v * cs], r = s * 0.6
      if (Math.hypot(p[0] - center[0], p[1] - center[1]) > R * 1.45) continue
      const tip = dir(p, down, r), top = dir(p, down + Math.PI, r)
      const gold = rnd() < 0.07, hot = rnd() < 0.16
      const g = cx.createLinearGradient(top[0], top[1], tip[0], tip[1])
      g.addColorStop(0, '#2a0504'); g.addColorStop(0.55, gold ? '#b8741a' : hot ? '#a81e12' : '#7a1410'); g.addColorStop(1, gold ? '#ffd870' : hot ? '#e8482a' : '#b82a1a')
      cx.fillStyle = g; cx.beginPath(); cx.arc(p[0], p[1], r, 0, TAU); cx.fill()
      cx.strokeStyle = 'rgba(10, 0, 0, 0.85)'; cx.lineWidth = 2 * k; cx.stroke()
      // o fio de luz na ponta e a quilha no meio
      cx.strokeStyle = 'rgba(255, 190, 110, 0.4)'; cx.lineWidth = 1.3 * k; cx.beginPath(); cx.arc(p[0], p[1], r * 0.86, down - 0.9, down + 0.9); cx.stroke()
      cx.strokeStyle = 'rgba(20, 0, 0, 0.35)'; cx.lineWidth = 1.2 * k; lineTo(cx, [p, dir(p, down, r * 0.8)]); cx.stroke()
      const b = bx.createLinearGradient(top[0], top[1], tip[0], tip[1])
      b.addColorStop(0, gray(70)); b.addColorStop(1, gray(215))
      bx.fillStyle = b; bx.beginPath(); bx.arc(p[0], p[1], r, 0, TAU); bx.fill()
      bx.strokeStyle = gray(30); bx.lineWidth = 2 * k; bx.stroke()
      rx.fillStyle = gold ? rm(0.22, 1) : rm(between(rnd, 0.3, 0.5), 0.35); rx.beginPath(); rx.arc(p[0], p[1], r, 0, TAU); rx.fill()
      // brasa nas frestas: a borda de cada escama acende; a escama de cima apaga o que cobre
      if (gx) {
        gx.fillStyle = '#000'; gx.beginPath(); gx.arc(p[0], p[1], r, 0, TAU); gx.fill()
        gx.strokeStyle = glowOf(f, '#ff7a1a', hot ? 0.75 : 0.32); gx.lineWidth = (hot ? 3 : 2) * k; gx.stroke()
      }
    }
  }
  // calor subindo do meio
  const heat = cx.createRadialGradient(center[0], center[1], 0, center[0], center[1], R * 0.9)
  heat.addColorStop(0, 'rgba(255, 120, 30, 0.2)'); heat.addColorStop(1, 'rgba(255, 120, 30, 0)')
  cx.fillStyle = heat; cx.fillRect(...boxOf(f))
  vignette(f, '#000000', 0.5)
  // filete de ouro derretido por dentro da borda
  cx.strokeStyle = 'rgba(255, 170, 60, 0.95)'; cx.lineWidth = 3.2 * k; polyPath(cx, poly, center, 0.1); cx.stroke()
  bx.strokeStyle = gray(225); bx.lineWidth = 3.4 * k; polyPath(bx, poly, center, 0.1); bx.stroke()
  rx.strokeStyle = rm(0.2, 1); rx.lineWidth = 3.4 * k; polyPath(rx, poly, center, 0.1); rx.stroke()
  if (gx) { gx.strokeStyle = glowOf(f, '#ff9a2a', 0.9); gx.lineWidth = 3.4 * k; polyPath(gx, poly, center, 0.1); gx.stroke() }
  rim(f, 'rgba(255, 170, 110, 0.3)', 'rgba(0, 0, 0, 0.7)')
  end(f)
}
// ouro em relevo sobre uma sombra, para o número não se perder nas escamas
const dragonNumber: NumberPainter = (f, t, x, y, a, px, u) => {
  const { cx, gx } = f, r = px * (t.length > 1 ? 0.9 : 0.72)
  const g = cx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, 'rgba(8, 0, 0, 0.78)'); g.addColorStop(0.6, 'rgba(8, 0, 0, 0.5)'); g.addColorStop(1, 'rgba(8, 0, 0, 0)')
  cx.fillStyle = g; cx.fillRect(x - r, y - r, r * 2, r * 2)
  if (gx) { const q = gx.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, 'rgba(0, 0, 0, 0.9)'); q.addColorStop(1, 'rgba(0, 0, 0, 0)'); gx.fillStyle = q; gx.fillRect(x - r, y - r, r * 2, r * 2) }
  num(f, t, x, y, a, px, u, { mode: 'raise', fill: ['#fff0b0', '#e08a1a'], hi: 'rgba(255, 252, 220, 0.8)', lo: 'rgba(20, 0, 0, 0.9)', rough: 0.2, metal: 1, glow: '#ff9a2a', glowAlpha: 0.7 })
}

// ── 32. Espelho Partido ─────────────────────────────────

function mirrorFace(f: FacePaint): void {
  const { cx, bx, rx, gx, rnd, radius: R, k, center, poly } = f
  begin(f, { top: '#f2f5fa', bottom: '#8a94a4', rough: 0.03, metal: 1, lit: 0.3 })
  // o reflexo: faixas claras e escuras, como um céu e um quarto virados no vidro
  const g = cx.createLinearGradient(center[0] - R, center[1] - R, center[0] + R, center[1] + R)
  g.addColorStop(0, 'rgba(255, 255, 255, 0.5)'); g.addColorStop(0.3, 'rgba(120, 140, 170, 0.28)'); g.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)'); g.addColorStop(0.72, 'rgba(60, 74, 100, 0.34)'); g.addColorStop(1, 'rgba(220, 230, 245, 0.3)')
  cx.fillStyle = g; cx.fillRect(...boxOf(f))
  // a pancada: os cacos em volta dela refletem cada um para um lado (uns claros, outros escuros)
  const hub = lerp2(center, poly[Math.floor(rnd() * poly.length)], between(rnd, 0.25, 0.6))
  const w = web(f, 7 + Math.floor(rnd() * 4), [between(rnd, 0.16, 0.24), between(rnd, 0.42, 0.56), between(rnd, 0.8, 0.95)])
  for (let j = 0; j < w.rad.length; j++) for (let i = 0; i < w.ang.length; i++) {
    const tone = rnd()
    cx.fillStyle = tone < 0.4 ? `rgba(20, 30, 52, ${between(rnd, 0.1, 0.42)})` : tone < 0.8 ? `rgba(255, 255, 255, ${between(rnd, 0.1, 0.4)})` : rgba(pick(rnd, ['#8ab4ff', '#ffd8a0', '#c8a8ff']), between(rnd, 0.1, 0.22))
    cellPath(cx, hub, w, i, j); cx.fill()
    // cada caco fica um fio mais alto ou mais baixo que o vizinho
    bx.fillStyle = gray(Math.round(between(rnd, 96, 164)), 0.7); cellPath(bx, hub, w, i, j); bx.fill()
    if (rnd() < 0.18) { rx.fillStyle = rm(between(rnd, 0.15, 0.3), 1); cellPath(rx, hub, w, i, j); rx.fill() }
  }
  // as rachaduras: fio escuro, fio de luz ao lado e um brilho na quina do vidro
  cx.lineCap = 'round'; bx.lineCap = 'round'
  for (const l of webLines(hub, w)) {
    const path = jagged(l[0], l[1], rnd, 2.4 * k, 26 * k)
    cx.strokeStyle = 'rgba(10, 14, 24, 0.9)'; cx.lineWidth = 1.8 * k; lineTo(cx, path); cx.stroke()
    cx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; cx.lineWidth = 1.1 * k; lineTo(cx, path.map(([x, y]): V2 => [x + 1.7 * k, y + 1.7 * k])); cx.stroke()
    bx.strokeStyle = gray(24); bx.lineWidth = 2.6 * k; lineTo(bx, path); bx.stroke()
    rx.strokeStyle = rm(0.6, 0.2); rx.lineWidth = 2 * k; lineTo(rx, path); rx.stroke()
    if (gx) { gx.strokeStyle = glowOf(f, '#cfe4ff', 0.7); gx.lineWidth = 1.4 * k; lineTo(gx, path); gx.stroke() }
  }
  // pó de vidro no ponto da pancada, e lascas que saltaram
  for (let i = 0; i < 70; i++) {
    const p = dir(hub, rnd() * TAU, R * 0.2 * Math.sqrt(rnd())), s = between(rnd, 0.8, 2.6) * k
    cx.fillStyle = `rgba(255, 255, 255, ${between(rnd, 0.5, 1)})`; cx.fillRect(p[0], p[1], s, s)
    bx.fillStyle = gray(60, 0.6); bx.fillRect(p[0], p[1], s, s)
  }
  rx.fillStyle = rm(0.7, 0.3); rx.beginPath(); rx.arc(hub[0], hub[1], R * 0.1, 0, TAU); rx.fill()
  for (let i = 0; i < 3; i++) sparkle(cx, at(f, 0.85), R * between(rnd, 0.04, 0.08), 'rgba(255, 255, 255, 0.9)')
  scratches(f, Math.round(R / 16), '#ffffff', 0.2)
  rim(f, 'rgba(255, 255, 255, 0.8)', 'rgba(40, 50, 70, 0.5)')
  end(f)
}
// jateado no vidro: fosco e escuro, com o fio de luz do corte
const mirrorNumber: NumberPainter = (f, t, x, y, a, px, u) =>
  num(f, t, x, y, a, px, u, { mode: 'cut', fill: ['#141a26', '#2c3648'], hi: 'rgba(255, 255, 255, 0.9)', lo: 'rgba(0, 0, 0, 0.7)', rough: 0.65, metal: 0.1 })

// ── 33. Fragmento do Vazio ──────────────────────────────

function voidFace(f: FacePaint): void {
  const { cx, bx, rx, gx, rnd, radius: R, k, center, poly } = f
  begin(f, { top: '#07050c', bottom: '#000000', rough: 0.98, metal: 0 })
  // estrelas muito longe, quase apagadas
  for (let i = 0; i < Math.round((R * R) / 700); i++) {
    const p = at(f, 1.05), s = between(rnd, 0.7, 1.7) * k
    cx.fillStyle = `rgba(200, 180, 255, ${between(rnd, 0.25, 0.7)})`; cx.fillRect(p[0], p[1], s, s)
    if (gx) { gx.fillStyle = glowOf(f, '#c8b4ff', 0.5); gx.fillRect(p[0], p[1], s, s) }
  }
  // a luz sendo puxada: arcos finos que se curvam em volta do buraco
  const tilt = rnd() * TAU, hr = R * 0.56
  for (let i = 0; i < 9; i++) {
    const r = hr * between(rnd, 1.12, 1.75), a0 = rnd() * TAU, sw = between(rnd, 0.5, 1.9)
    cx.strokeStyle = `rgba(170, 130, 255, ${between(rnd, 0.1, 0.34)})`; cx.lineWidth = between(rnd, 0.7, 1.8) * k
    cx.beginPath(); cx.arc(center[0], center[1], r, a0, a0 + sw); cx.stroke()
    if (gx) { gx.strokeStyle = glowOf(f, '#a070ff', 0.22); gx.lineWidth = 1.6 * k; gx.beginPath(); gx.arc(center[0], center[1], r, a0, a0 + sw); gx.stroke() }
  }
  // o horizonte: um anel de luz, mais forte de um lado (o disco que gira)
  const halo = cx.createRadialGradient(center[0], center[1], hr * 0.9, center[0], center[1], hr * 1.5)
  halo.addColorStop(0, 'rgba(150, 100, 255, 0.4)'); halo.addColorStop(1, 'rgba(150, 100, 255, 0)')
  cx.fillStyle = halo; cx.fillRect(...boxOf(f))
  if (gx) {
    const q = gx.createRadialGradient(center[0], center[1], hr * 0.9, center[0], center[1], hr * 1.5)
    q.addColorStop(0, glowOf(f, '#9060ff', 0.5)); q.addColorStop(1, glowOf(f, '#9060ff', 0))
    gx.fillStyle = q; gx.fillRect(...boxOf(f))
  }
  // o buraco: preto de verdade, fosco, um pouco afundado (apaga as estrelas e a luz de dentro)
  for (const c of [cx, ...(gx ? [gx] : [])]) { c.fillStyle = '#000'; c.beginPath(); c.arc(center[0], center[1], hr, 0, TAU); c.fill() }
  const pit = bx.createRadialGradient(center[0], center[1], hr * 0.2, center[0], center[1], hr * 1.08)
  pit.addColorStop(0, gray(70)); pit.addColorStop(0.85, gray(96)); pit.addColorStop(1, gray(128, 0))
  bx.fillStyle = pit; bx.beginPath(); bx.arc(center[0], center[1], hr * 1.08, 0, TAU); bx.fill()
  rx.fillStyle = rm(1, 0); rx.beginPath(); rx.arc(center[0], center[1], hr, 0, TAU); rx.fill()
  for (let s = 0; s < 40; s++) {
    const a0 = tilt + (s / 40) * TAU, bright = 0.5 + 0.5 * Math.cos(a0 - tilt), a1 = a0 + TAU / 40 + 0.01
    cx.strokeStyle = `rgba(${Math.round(200 + 55 * bright)}, ${Math.round(170 + 80 * bright)}, 255, ${0.3 + 0.7 * bright})`; cx.lineWidth = (1.4 + 3.4 * bright) * k
    cx.beginPath(); cx.arc(center[0], center[1], hr, a0, a1); cx.stroke()
    if (gx) {
      gx.strokeStyle = glowOf(f, '#b48cff', 0.3 + 0.4 * bright); gx.lineWidth = (4 + 8 * bright) * k; gx.beginPath(); gx.arc(center[0], center[1], hr, a0, a1); gx.stroke()
      gx.strokeStyle = glowOf(f, '#ffffff', 0.35 + 0.65 * bright); gx.lineWidth = (1.2 + 2.6 * bright) * k; gx.beginPath(); gx.arc(center[0], center[1], hr, a0, a1); gx.stroke()
    }
  }
  // a borda da face: um fio de luz violeta, como a quina de um caco
  cx.strokeStyle = 'rgba(170, 120, 255, 0.9)'; cx.lineWidth = 2 * k; polyPath(cx, poly, center, 0.045); cx.stroke()
  if (gx) { gx.strokeStyle = glowOf(f, '#a070ff', 0.85); gx.lineWidth = 2.6 * k; polyPath(gx, poly, center, 0.045); gx.stroke() }
  end(f)
}
const voidNumber: NumberPainter = (f, t, x, y, a, px, u) =>
  num(f, t, x, y, a, px, u, { mode: 'paint', fill: ['#ffffff', '#d8c4ff'], stroke: 'rgba(0, 0, 0, 1)', hi: 'rgba(255, 255, 255, 0.7)', rough: 0.5, metal: 0, glow: '#c8a8ff', glowAlpha: 1 })

// ── 34. Prisma de Todas as Cores ────────────────────────

/** O arco-íris inteiro em volta de um ponto. */
function rainbow(c: Ctx, p: V2, start: number, alpha: number, light = 68): CanvasGradient {
  const g = c.createConicGradient(start, p[0], p[1])
  for (let i = 0; i <= 12; i++) g.addColorStop(i / 12, `hsla(${(i * 30) % 360}, 100%, ${light}%, ${alpha})`)
  return g
}

function prismFace(f: FacePaint): void {
  const { cx, bx, rx, gx, rnd, radius: R, k, center, poly } = f
  begin(f, { top: '#ffffff', bottom: '#c4ccf4', rough: 0.04, metal: 0, lit: 0.3 })
  // a luz aberta em todas as cores, girando em volta de um ponto fora do meio
  const hub = lerp2(center, poly[Math.floor(rnd() * poly.length)], between(rnd, 0.1, 0.4)), start = rnd() * TAU
  cx.fillStyle = rainbow(cx, hub, start, 0.9, 60); cx.fillRect(...boxOf(f))
  const soft = cx.createRadialGradient(hub[0], hub[1], 0, hub[0], hub[1], R * 0.5)
  soft.addColorStop(0, 'rgba(255, 255, 255, 0.8)'); soft.addColorStop(1, 'rgba(255, 255, 255, 0)')
  cx.fillStyle = soft; cx.fillRect(...boxOf(f))
  if (gx) { gx.fillStyle = rainbow(gx, hub, start, 0.3 * f.skin.glowPower, 55); gx.fillRect(...boxOf(f)) }
  // lapidação: facetas em leque, umas pegando a luz e outras na sombra
  const w = web(f, 9 + Math.floor(rnd() * 4), [between(rnd, 0.3, 0.42), between(rnd, 0.68, 0.84)])
  for (let j = 0; j < w.rad.length; j++) for (let i = 0; i < w.ang.length; i++) {
    const lit = rnd() < 0.5, a = between(rnd, 0.05, 0.24)
    cx.fillStyle = lit ? `rgba(255, 255, 255, ${a})` : `rgba(40, 30, 110, ${a})`; cellPath(cx, hub, w, i, j); cx.fill()
    bx.fillStyle = gray(lit ? 150 : 106, 0.7); cellPath(bx, hub, w, i, j); bx.fill()
  }
  for (const l of webLines(hub, w)) {
    cx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; cx.lineWidth = 1.3 * k; lineTo(cx, l); cx.stroke()
    cx.strokeStyle = 'rgba(60, 40, 140, 0.22)'; cx.lineWidth = 1 * k; lineTo(cx, l.map(([x, y]): V2 => [x + 1.5 * k, y + 1.5 * k])); cx.stroke()
    bx.strokeStyle = gray(190, 0.6); bx.lineWidth = 2 * k; lineTo(bx, l); bx.stroke()
    if (gx) { gx.strokeStyle = glowOf(f, '#ffffff', 0.4); gx.lineWidth = 1.2 * k; lineTo(gx, l); gx.stroke() }
  }
  // cintilações
  for (let i = 0; i < 4 + Math.floor(rnd() * 4); i++) {
    const p = at(f, 0.9), r = R * between(rnd, 0.04, 0.11)
    sparkle(cx, p, r, 'rgba(255, 255, 255, 0.95)')
    if (gx) sparkle(gx, p, r * 1.2, glowOf(f, '#ffffff', 1))
  }
  grains(f, [['#ffffff', 0.9]], 420, 0.6, 1.6, 0)
  sheen(f, 0.3)
  // friso de arco-íris por dentro da borda
  cx.strokeStyle = rainbow(cx, center, start + 1, 1, 60); cx.lineWidth = 3.4 * k; polyPath(cx, poly, center, 0.1); cx.stroke()
  if (gx) { gx.strokeStyle = rainbow(gx, center, start + 1, f.skin.glowPower, 60); gx.lineWidth = 3.6 * k; polyPath(gx, poly, center, 0.1); gx.stroke() }
  rx.strokeStyle = rm(0.1, 0.6); rx.lineWidth = 3.4 * k; polyPath(rx, poly, center, 0.1); rx.stroke()
  rim(f, 'rgba(255, 255, 255, 0.9)', 'rgba(70, 60, 150, 0.35)')
  end(f)
}
// índigo escuro com um halo branco: lê-se em cima de qualquer cor
const prismNumber: NumberPainter = (f, t, x, y, a, px, u) => {
  const { cx } = f
  cx.save(); cx.translate(x, y); cx.rotate(a)
  cx.font = `700 ${Math.round(px * 1.02)}px "EB Garamond", "Cormorant Garamond", Georgia, serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.lineJoin = 'round'
  cx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; cx.lineWidth = px * 0.2; cx.strokeText(t, 0, 0)
  cx.restore()
  num(f, t, x, y, a, px, u, { mode: 'raise', fill: ['#2c1c78', '#0c0630'], hi: 'rgba(255, 255, 255, 0.9)', lo: 'rgba(255, 255, 255, 0.6)', rough: 0.2, metal: 0.5 })
}

// ── Tabela ──────────────────────────────────────────────

export const PACK2_SURFACES: Record<string, Surface> = {
  cortica:    { face: corkFace, number: corkNumber },
  vela:       { face: waxFace, number: waxNumber },
  vitral:     { face: stainedFace, number: stainedNumber },
  pergaminho: { face: parchmentFace, number: parchmentNumber },
  sino:       { face: bellFace, number: bellNumber },
  relogio:    { face: clockFace, number: clockNumber },
  perola:     { face: nacreFace, number: nacreNumber },
  tempestade: { face: stormFace, number: stormNumber },
  olho:       { face: eyeFace, number: eyeNumber },
  galaxia:    { face: galaxyFace, number: galaxyNumber },
  dragao:     { face: dragonFace, number: dragonNumber },
  espelho:    { face: mirrorFace, number: mirrorNumber },
  vazio:      { face: voidFace, number: voidNumber },
  prisma:     { face: prismFace, number: prismNumber },
}
