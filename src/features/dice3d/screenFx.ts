import { THEME_COLORS, type FxTheme } from './fxThemes'

// ────────────────────────────────────────────────────────
// As animações de tela cheia do 20 natural e do 1 natural. Um canvas fixo
// por cima de TUDO (inclusive dos painéis de rolagem), sem pegar clique, que
// parte do ponto onde o dado parou e toma a tela inteira: fogo subindo,
// relâmpagos, água, gelo, círculo arcano, folhas... e, nas falhas, chamas
// sombrias, sangue escorrendo, rachaduras, vazio engolindo a tela...
// Cada animação é uma função que recebe o contexto e devolve o desenho de um
// quadro (`draw(t, dt)`); o resto (canvas, laço, fade final) é comum.
// ────────────────────────────────────────────────────────

export interface FxOrigin { x: number; y: number }

interface Env {
  c: CanvasRenderingContext2D
  w: number
  h: number
  ox: number
  oy: number
  /** [núcleo claro, principal, escuro] */
  col: readonly [string, string, string]
}
type Draw = (t: number, dt: number) => void
interface Scene { dur: number; draw: Draw }

const R = Math.random
const TAU = Math.PI * 2
const rr = (a: number, b: number) => a + R() * (b - a)
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n))
const easeOut = (k: number) => 1 - Math.pow(1 - clamp(k), 3)
const easeInOut = (k: number) => { const x = clamp(k); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2 }
/** Sobe até `a`, segura até `b`, desce até `c` (em segundos): 0 a 1. */
const envelope = (t: number, a: number, b: number, c: number) => (t < a ? t / a : t < b ? 1 : clamp(1 - (t - b) / (c - b)))

/** A mesma cor, transparente (gradientes que somem sem passar pelo cinza). */
function fade0(color: string): string {
  if (color.startsWith('#')) {
    const n = parseInt(color.length === 4 ? color.replace(/./g, (ch, i) => (i ? ch + ch : ch)).slice(1) : color.slice(1), 16)
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0)`
  }
  return color.replace(/rgba\(([^)]*),[^,)]*\)$/, 'rgba($1,0)')
}

// ── Pincéis em cache ────────────────────────────────────

const blobs = new Map<string, HTMLCanvasElement>()
/** Um borrão redondo e macio da cor (para desenhar com `lighter`). */
function blob(color: string): HTMLCanvasElement {
  let b = blobs.get(color)
  if (!b) {
    b = document.createElement('canvas')
    b.width = b.height = 96
    const g = b.getContext('2d')!
    g.fillStyle = color
    g.fillRect(0, 0, 96, 96)
    // a cor sólida, recortada por um gradiente de transparência (sem franja escura)
    g.globalCompositeOperation = 'destination-in'
    const r = g.createRadialGradient(48, 48, 0, 48, 48, 48)
    r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.35, 'rgba(0,0,0,0.8)'); r.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 96, 96)
    blobs.set(color, b)
  }
  return b
}

const stars = new Map<string, HTMLCanvasElement>()
/** Estrela de quatro pontas. */
function star(color: string): HTMLCanvasElement {
  let s = stars.get(color)
  if (!s) {
    s = document.createElement('canvas')
    s.width = s.height = 96
    const g = s.getContext('2d')!
    const r = g.createRadialGradient(48, 48, 0, 48, 48, 48)
    r.addColorStop(0, '#fff'); r.addColorStop(0.2, color); r.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = r
    g.beginPath()
    g.moveTo(48, 0); g.quadraticCurveTo(48, 48, 96, 48); g.quadraticCurveTo(48, 48, 48, 96); g.quadraticCurveTo(48, 48, 0, 48); g.quadraticCurveTo(48, 48, 48, 0)
    g.fill()
    stars.set(color, s)
  }
  return s
}

function drawImg(c: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, size: number, alpha: number, rot = 0, stretch = 1): void {
  if (alpha <= 0.003 || size <= 0.5) return
  c.globalAlpha = Math.min(1, alpha)
  if (rot) {
    c.save(); c.translate(x, y); c.rotate(rot)
    c.drawImage(img, -size / 2, (-size * stretch) / 2, size, size * stretch)
    c.restore()
  } else c.drawImage(img, x - size / 2, y - (size * stretch) / 2, size, size * stretch)
  c.globalAlpha = 1
}

const add = (c: CanvasRenderingContext2D) => { c.globalCompositeOperation = 'lighter' }
const normal = (c: CanvasRenderingContext2D) => { c.globalCompositeOperation = 'source-over' }

/** Clarão redondo que parte do ponto do dado. */
function flash(e: Env, color: string, radius: number, alpha: number): void {
  if (alpha <= 0.003) return
  const { c, ox, oy } = e
  const g = c.createRadialGradient(ox, oy, 0, ox, oy, radius)
  g.addColorStop(0, color); g.addColorStop(1, fade0(color))
  c.globalAlpha = Math.min(1, alpha)
  c.fillStyle = g
  c.fillRect(0, 0, e.w, e.h)
  c.globalAlpha = 1
}

/** Escurece as bordas (cor, até onde vai o miolo livre e a força nas bordas). */
function vignette(e: Env, color: string, inner: number, alpha: number): void {
  if (alpha <= 0.003) return
  const { c, w, h } = e
  const far = Math.hypot(w, h) / 2
  const g = c.createRadialGradient(w / 2, h / 2, far * clamp(inner, 0, 0.98), w / 2, h / 2, far)
  g.addColorStop(0, fade0(color)); g.addColorStop(1, color)
  c.globalAlpha = Math.min(1, alpha)
  c.fillStyle = g
  c.fillRect(0, 0, w, h)
  c.globalAlpha = 1
}

const farthest = (e: Env) => Math.hypot(Math.max(e.ox, e.w - e.ox), Math.max(e.oy, e.h - e.oy))

/** Linha quebrada de A até B (deslocamento do ponto do meio, recursivo): raios e rachaduras. */
function jagged(x1: number, y1: number, x2: number, y2: number, spread: number, depth: number): [number, number][] {
  let pts: [number, number][] = [[x1, y1], [x2, y2]]
  let s = spread
  for (let d = 0; d < depth; d++) {
    const next: [number, number][] = []
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1]
      const mx = (ax + bx) / 2, my = (ay + by) / 2
      const nx = -(by - ay), ny = bx - ax
      const len = Math.hypot(nx, ny) || 1
      const off = (R() - 0.5) * s
      next.push([ax, ay], [mx + (nx / len) * off, my + (ny / len) * off])
    }
    next.push(pts[pts.length - 1])
    pts = next
    s *= 0.55
  }
  return pts
}

function strokePath(c: CanvasRenderingContext2D, pts: [number, number][], upTo = 1): void {
  const n = Math.max(2, Math.floor(pts.length * clamp(upTo)))
  c.beginPath()
  c.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < n; i++) c.lineTo(pts[i][0], pts[i][1])
  c.stroke()
}

// ── Fogo (e chamas sombrias) ────────────────────────────

interface Flame { x: number; y: number; vx: number; vy: number; life: number; age: number; size: number; seed: number }

function fire(e: Env, dark: boolean): Scene {
  const { c, w, h, ox, oy, col } = e
  const parts: Flame[] = []
  const embers: Flame[] = []
  const [core, main, deep] = col.map(blob) as [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement]
  const smoke = blob('rgba(24,8,20,0.9)')
  let carry = 0
  for (let i = 0; i < 70; i++) {
    const a = R() * TAU, sp = rr(120, 760)
    embers.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 180, life: rr(0.9, 2), age: 0, size: rr(10, 30), seed: R() * 9 })
  }
  return {
    dur: 3.2,
    draw: (t, dt) => {
      normal(c)
      if (dark) vignette(e, 'rgba(30,0,20,0.75)', 0.25, 0.9 * envelope(t, 0.4, 2.4, 3.2))
      add(c)
      flash(e, col[0], Math.max(w, h) * 0.7, 0.8 * clamp(1 - t / 0.55))
      // chamas nascem em toda a largura da tela, embaixo, e sobem
      if (t < 2.1) {
        carry += dt * Math.min(300, w * 0.32) * (t < 0.3 ? 0.5 : 1)
        for (; carry >= 1; carry--) parts.push({ x: R() * w, y: h + 30, vx: rr(-40, 40), vy: -rr(320, 980), life: rr(1, 1.9), age: 0, size: rr(60, 150), seed: R() * 9 })
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.age += dt
        if (p.age >= p.life) { parts.splice(i, 1); continue }
        p.x += (p.vx + Math.sin(p.age * 7 + p.seed) * 60) * dt
        p.y += p.vy * dt
        p.vy *= Math.pow(0.55, dt)
        const k = p.age / p.life
        const img = k < 0.18 ? core : k < 0.6 ? main : deep
        const s = p.size * (0.75 + 0.25 * Math.sin(p.age * 18 + p.seed)) * (1 - k * 0.6)
        drawImg(c, img, p.x, p.y, s * 1.1, (k < 0.18 ? 0.26 : 0.38) * (1 - k), 0, 2.1)
      }
      if (dark) {
        normal(c)
        for (let i = 0; i < parts.length; i += 3) {
          const p = parts[i], k = p.age / p.life
          drawImg(c, smoke, p.x, p.y - 90 * k, p.size * 2.4, 0.22 * k * (1 - k) * 4)
        }
        add(c)
      }
      // brasas que saem do dado
      for (const p of embers) {
        p.age += dt
        if (p.age >= p.life) continue
        p.x += p.vx * dt + Math.sin(p.age * 9 + p.seed) * 30 * dt
        p.y += p.vy * dt
        p.vx *= Math.pow(0.4, dt); p.vy = p.vy * Math.pow(0.5, dt) - 90 * dt
        const k = p.age / p.life
        drawImg(c, core, p.x, p.y, p.size * (1 - k * 0.7), 1 - k)
      }
      // calor no pé da tela
      const g = c.createLinearGradient(0, h, 0, h * 0.35)
      g.addColorStop(0, col[1]); g.addColorStop(1, 'rgba(0,0,0,0)')
      c.globalAlpha = 0.22 * envelope(t, 0.4, 1.9, 3)
      c.fillStyle = g; c.fillRect(0, 0, w, h)
      c.globalAlpha = 1
    },
  }
}

// ── Brilho ──────────────────────────────────────────────

function glow(e: Env): Scene {
  const { c, w, h, ox, oy, col } = e
  const far = farthest(e)
  const dust = Array.from({ length: 90 }, () => ({
    x: R() * w, y: R() * h, size: rr(14, 46), born: rr(0, 1.7), life: rr(0.9, 1.5), drift: rr(-30, 30), rise: rr(20, 90), rot: R() * TAU,
  }))
  return {
    dur: 3,
    draw: (t) => {
      add(c)
      flash(e, col[0], far, 0.9 * clamp(1 - t / 0.6))
      flash(e, col[1], far * 0.8, 0.35 * envelope(t, 0.2, 1.2, 2.6))
      // raios girando a partir do dado
      const ra = 0.7 * envelope(t, 0.25, 1.1, 2.7)
      if (ra > 0.01) {
        const n = 18, len = far * (0.5 + easeOut(t / 0.9) * 0.6)
        const g = c.createRadialGradient(ox, oy, 0, ox, oy, len)
        g.addColorStop(0, col[0]); g.addColorStop(0.6, col[1]); g.addColorStop(1, fade0(col[1]))
        c.fillStyle = g
        c.globalAlpha = ra * 0.5
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + t * 0.5, half = (TAU / n) * 0.2
          c.beginPath(); c.moveTo(ox, oy); c.arc(ox, oy, len, a - half, a + half); c.closePath(); c.fill()
        }
        c.globalAlpha = 1
      }
      // ondas douradas
      c.lineWidth = 7
      for (let i = 0; i < 3; i++) {
        const k = (t - i * 0.22) / 1.3
        if (k <= 0 || k >= 1) continue
        c.globalAlpha = (1 - k) * 0.85
        c.strokeStyle = i === 1 ? col[0] : col[1]
        c.beginPath(); c.arc(ox, oy, easeOut(k) * far * 0.9, 0, TAU); c.stroke()
      }
      c.globalAlpha = 1
      // estrelinhas pela tela toda
      for (const s of dust) {
        const age = t - s.born
        if (age < 0 || age > s.life) continue
        const k = age / s.life
        const tw = Math.sin(k * Math.PI) * (0.7 + 0.3 * Math.sin(age * 22))
        drawImg(c, star(col[1]), s.x + s.drift * age, s.y - s.rise * age, s.size * (0.6 + tw * 0.7), tw, s.rot + age * 2)
      }
    },
  }
}

// ── Relâmpago (e relâmpago rubro) ───────────────────────

interface Bolt { at: number; pts: [number, number][]; branches: [number, number][][]; life: number }

function bolt(e: Env, at: number, tx: number, ty: number): Bolt {
  const sx = tx + rr(-e.w * 0.25, e.w * 0.25)
  const pts = jagged(sx, -20, tx, ty, e.h * 0.35, 7)
  const branches: [number, number][][] = []
  const nb = 3 + Math.floor(R() * 3)
  for (let i = 0; i < nb; i++) {
    const [bx, by] = pts[Math.floor(rr(pts.length * 0.15, pts.length * 0.8))]
    const a = rr(Math.PI * 0.2, Math.PI * 0.8) * (R() < 0.5 ? 1 : -1) + Math.PI / 2
    const len = rr(e.h * 0.12, e.h * 0.32)
    branches.push(jagged(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, len * 0.5, 5))
  }
  return { at, pts, branches, life: rr(0.28, 0.4) }
}

function lightning(e: Env): Scene {
  const { c, w, h, ox, oy, col } = e
  const bolts: Bolt[] = [
    bolt(e, 0.04, ox, oy),
    bolt(e, 0.3, rr(w * 0.15, w * 0.4), rr(h * 0.5, h * 0.9)),
    bolt(e, 0.52, rr(w * 0.6, w * 0.85), rr(h * 0.5, h * 0.9)),
    bolt(e, 0.85, ox, oy),
    bolt(e, 1.15, rr(w * 0.3, w * 0.7), rr(h * 0.55, h * 0.95)),
    bolt(e, 1.4, ox, oy),
  ]
  const sparks = Array.from({ length: 70 }, () => ({ x: ox, y: oy, vx: 0, vy: 0, born: 0, life: 0, size: 0 }))
  const sparkAt = (i: number, b: Bolt) => {
    const s = sparks[i]; const a = R() * TAU, sp = rr(120, 700)
    const [x, y] = b.pts[b.pts.length - 1]
    s.x = x; s.y = y; s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp - 200; s.born = b.at; s.life = rr(0.4, 0.9); s.size = rr(8, 22)
  }
  bolts.forEach((b, bi) => { for (let k = 0; k < 11; k++) sparkAt((bi * 11 + k) % sparks.length, b) })
  const [core, main] = [blob(col[0]), blob(col[1])]
  return {
    dur: 2.4,
    draw: (t, dt) => {
      add(c)
      // céu tomado pela luz entre as quedas
      let fl = 0
      for (const b of bolts) { const age = t - b.at; if (age >= 0 && age < 0.22) fl = Math.max(fl, (1 - age / 0.22) * (age < 0.04 ? 1 : 0.6)) }
      flash(e, col[1], Math.hypot(w, h), 0.55 * fl)
      c.globalAlpha = 0.5 * fl; c.fillStyle = col[0]; c.fillRect(0, 0, w, h); c.globalAlpha = 1
      c.lineCap = 'round'; c.lineJoin = 'round'
      for (const b of bolts) {
        const age = t - b.at
        if (age < 0 || age > b.life) continue
        const k = age / b.life
        const flick = k < 0.5 ? (Math.sin(age * 90) > -0.4 ? 1 : 0.35) : 1 - (k - 0.5) * 2
        const grow = clamp(age / 0.06)
        for (const line of [b.pts, ...b.branches]) {
          c.strokeStyle = col[1]; c.globalAlpha = 0.22 * flick; c.lineWidth = 22; strokePath(c, line, grow)
          c.globalAlpha = 0.55 * flick; c.lineWidth = 9; strokePath(c, line, grow)
          c.strokeStyle = col[0]; c.globalAlpha = flick; c.lineWidth = line === b.pts ? 3.5 : 2; strokePath(c, line, grow)
        }
        c.globalAlpha = 1
        const [ix, iy] = b.pts[b.pts.length - 1]
        drawImg(c, core, ix, iy, 260 * (1 - k * 0.5), flick * 0.9)
      }
      for (const s of sparks) {
        const age = t - s.born
        if (age < 0 || age > s.life) continue
        s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 900 * dt; s.vx *= Math.pow(0.4, dt)
        drawImg(c, main, s.x, s.y, s.size * (1 - age / s.life), 1 - age / s.life)
      }
    },
  }
}

// ── Água ────────────────────────────────────────────────

function water(e: Env): Scene {
  const { c, w, h, ox, oy, col } = e
  const far = farthest(e)
  const bubbles = Array.from({ length: 80 }, () => ({ x: R() * w, y: h + rr(10, 300), r: rr(6, 28), vy: rr(130, 380), ph: R() * TAU, pop: rr(1.8, 2.8) }))
  const drops = Array.from({ length: 46 }, () => { const a = rr(-Math.PI * 0.95, -Math.PI * 0.05), sp = rr(300, 900); return { x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: rr(8, 24) } })
  const spot = blob(col[0]), body = blob(col[1])
  return {
    dur: 3.2,
    draw: (t, dt) => {
      add(c)
      flash(e, col[0], far * 0.6, 0.55 * clamp(1 - t / 0.5))
      // ondas que correm do dado até a borda da tela
      c.lineWidth = 6
      for (let i = 0; i < 5; i++) {
        const k = (t - i * 0.2) / 1.5
        if (k <= 0 || k >= 1) continue
        c.strokeStyle = i % 2 ? col[0] : col[1]
        c.globalAlpha = (1 - k) * 0.7
        c.beginPath(); c.ellipse(ox, oy, easeOut(k) * far, easeOut(k) * far * 0.62, 0, 0, TAU); c.stroke()
        c.globalAlpha = (1 - k) * 0.3; c.lineWidth = 16
        c.beginPath(); c.ellipse(ox, oy, easeOut(k) * far * 0.97, easeOut(k) * far * 0.6, 0, 0, TAU); c.stroke()
        c.lineWidth = 6
      }
      c.globalAlpha = 1
      // a maré: a água sobe pela tela e baixa
      const level = h * 0.62 * easeInOut(t < 1.5 ? t / 1.5 : 1 - (t - 1.5) / 1.6)
      if (level > 2) {
        normal(c)
        const top = (x: number) => h - level + Math.sin(x * 0.011 + t * 4.4) * 16 + Math.sin(x * 0.023 - t * 2.8) * 9
        const g = c.createLinearGradient(0, h - level, 0, h)
        g.addColorStop(0, col[1]); g.addColorStop(1, col[2])
        c.fillStyle = g; c.globalAlpha = 0.46
        c.beginPath(); c.moveTo(0, h)
        for (let x = 0; x <= w; x += 12) c.lineTo(x, top(x))
        c.lineTo(w, h); c.closePath(); c.fill()
        add(c)
        c.globalAlpha = 0.7; c.strokeStyle = col[0]; c.lineWidth = 3
        c.beginPath(); for (let x = 0; x <= w; x += 12) (x ? c.lineTo(x, top(x)) : c.moveTo(x, top(x))); c.stroke()
        c.globalAlpha = 1
      }
      // gotas que saltam do dado
      for (const d of drops) {
        d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 1500 * dt; d.vx *= Math.pow(0.5, dt)
        drawImg(c, spot, d.x, d.y, d.size, clamp(1.4 - t / 1.4))
      }
      // bolhas
      for (const b of bubbles) {
        if (t > b.pop) continue
        b.y -= b.vy * dt
        const x = b.x + Math.sin(t * 3 + b.ph) * 14
        const a = clamp((b.pop - t) / 0.5)
        c.globalAlpha = 0.65 * a; c.strokeStyle = col[0]; c.lineWidth = 2
        c.beginPath(); c.arc(x, b.y, b.r, 0, TAU); c.stroke()
        drawImg(c, body, x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.9, 0.7 * a)
      }
      c.globalAlpha = 1
    },
  }
}

// ── Gelo ────────────────────────────────────────────────

function snowflake(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  c.save(); c.translate(x, y); c.rotate(rot)
  for (let i = 0; i < 6; i++) {
    c.rotate(TAU / 6)
    c.beginPath(); c.moveTo(0, 0); c.lineTo(r, 0); c.stroke()
    for (const f of [0.45, 0.7]) {
      c.beginPath(); c.moveTo(r * f, 0); c.lineTo(r * (f + 0.18), r * 0.16); c.moveTo(r * f, 0); c.lineTo(r * (f + 0.18), -r * 0.16); c.stroke()
    }
  }
  c.restore()
}

function ice(e: Env): Scene {
  const { c, w, h, ox, oy, col } = e
  const far = farthest(e)
  const shards = Array.from({ length: 46 }, () => { const a = R() * TAU, sp = rr(400, 1500); return { x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: R() * TAU, spin: rr(-6, 6), size: rr(18, 60), } })
  const snow = Array.from({ length: 110 }, () => ({ x: R() * w, y: -rr(0, h), vy: rr(60, 220), sw: R() * TAU, size: rr(6, 20), born: rr(0, 1.5) }))
  const sparkle = blob(col[0])
  return {
    dur: 3.1,
    draw: (t, dt) => {
      add(c)
      flash(e, col[0], far * 0.8, 0.8 * clamp(1 - t / 0.5))
      // geada fechando pelas bordas
      normal(c)
      vignette(e, 'rgba(190,235,255,0.85)', 0.9 - 0.62 * easeOut(t / 1), 0.8 * envelope(t, 0.1, 2.2, 3.1))
      add(c)
      // o floco de neve gigante no ponto do dado
      const fa = envelope(t, 0.2, 1, 2.2)
      if (fa > 0.01) {
        c.strokeStyle = col[0]; c.lineWidth = 4; c.globalAlpha = fa * 0.9
        snowflake(c, ox, oy, 70 + easeOut(t / 1.1) * Math.min(w, h) * 0.34, t * 0.35)
        c.strokeStyle = col[1]; c.lineWidth = 12; c.globalAlpha = fa * 0.25
        snowflake(c, ox, oy, 70 + easeOut(t / 1.1) * Math.min(w, h) * 0.34, t * 0.35)
        c.globalAlpha = 1
      }
      // cacos de gelo
      for (const s of shards) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= Math.pow(0.18, dt); s.vy = s.vy * Math.pow(0.18, dt) + 380 * dt; s.rot += s.spin * dt
        const a = clamp(1.25 - t / 1.8)
        if (a <= 0) continue
        c.save(); c.translate(s.x, s.y); c.rotate(s.rot)
        c.globalAlpha = a * 0.75; c.fillStyle = col[1]
        c.beginPath(); c.moveTo(0, -s.size); c.lineTo(s.size * 0.32, s.size * 0.5); c.lineTo(-s.size * 0.32, s.size * 0.5); c.closePath(); c.fill()
        c.globalAlpha = a; c.strokeStyle = col[0]; c.lineWidth = 2; c.stroke()
        c.restore()
      }
      c.globalAlpha = 1
      // neve e brilho de cristal
      for (const s of snow) {
        if (t < s.born) continue
        s.y += s.vy * dt
        const x = s.x + Math.sin(t * 1.8 + s.sw) * 24
        drawImg(c, sparkle, x, s.y, s.size, 0.85 * envelope(t, 0.3, 2.2, 3.1))
      }
    },
  }
}

// ── Arcano ──────────────────────────────────────────────

function arcane(e: Env): Scene {
  const { c, w, h, ox, oy, col } = e
  const far = farthest(e)
  const orbit = Array.from({ length: 150 }, () => ({ a: R() * TAU, r: rr(20, 140), vr: rr(120, 520), va: rr(1.4, 3.6) * (R() < 0.5 ? 1 : -1), size: rr(10, 34), born: rr(0, 1.2), life: rr(0.9, 1.7), hue: R() < 0.4 ? 0 : 1 }))
  const [soft, hard] = [blob(col[1]), blob(col[0])]
  const circle = (t: number, scale: number, alpha: number, wide: boolean) => {
    const base = Math.min(w, h) * 0.34 * scale
    c.lineWidth = wide ? 10 : 2.5
    c.globalAlpha = alpha * (wide ? 0.25 : 1)
    c.strokeStyle = wide ? col[1] : col[0]
    for (const k of [1, 0.86, 0.5]) { c.beginPath(); c.arc(ox, oy, base * k, 0, TAU); c.stroke() }
    // símbolos no anel
    const n = 24
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + t * 0.4, r1 = base * 0.88, r2 = base * (i % 3 === 0 ? 0.98 : 0.93)
      c.beginPath(); c.moveTo(ox + Math.cos(a) * r1, oy + Math.sin(a) * r1); c.lineTo(ox + Math.cos(a) * r2, oy + Math.sin(a) * r2); c.stroke()
    }
    // estrela de seis pontas girando ao contrário
    for (const off of [0, Math.PI / 3]) {
      c.beginPath()
      for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + off - t * 0.6; c.lineTo(ox + Math.cos(a) * base * 0.5, oy + Math.sin(a) * base * 0.5) }
      c.closePath(); c.stroke()
    }
    c.globalAlpha = 1
  }
  return {
    dur: 3.1,
    draw: (t, dt) => {
      add(c)
      flash(e, col[1], far * 0.9, 0.55 * envelope(t, 0.15, 0.5, 1.6))
      const s = 0.25 + easeOut(t / 0.9) * 0.9
      const a = envelope(t, 0.3, 2.1, 3)
      if (a > 0.01) { circle(t, s, a, true); circle(t, s, a, false) }
      // faíscas arcanas em espiral, abrindo até as bordas
      for (const p of orbit) {
        const age = t - p.born
        if (age < 0 || age > p.life) continue
        p.a += p.va * dt; p.r += p.vr * dt
        const k = age / p.life
        drawImg(c, p.hue ? soft : hard, ox + Math.cos(p.a) * p.r, oy + Math.sin(p.a) * p.r * 0.8, p.size * (1 - k * 0.5), Math.sin(k * Math.PI))
      }
      // pulso final
      const k = (t - 0.2) / 1.2
      if (k > 0 && k < 1) { c.lineWidth = 10; c.strokeStyle = col[1]; c.globalAlpha = (1 - k) * 0.7; c.beginPath(); c.arc(ox, oy, easeOut(k) * far, 0, TAU); c.stroke(); c.globalAlpha = 1 }
    },
  }
}

// ── Natureza ────────────────────────────────────────────

function leafPath(c: CanvasRenderingContext2D, s: number): void {
  c.beginPath(); c.moveTo(0, -s)
  c.bezierCurveTo(s * 0.8, -s * 0.5, s * 0.7, s * 0.5, 0, s)
  c.bezierCurveTo(-s * 0.7, s * 0.5, -s * 0.8, -s * 0.5, 0, -s)
  c.closePath()
}

function nature(e: Env): Scene {
  const { c, w, h, col } = e
  const leaves = Array.from({ length: 70 }, () => {
    const left = R() < 0.5
    return { x: left ? -40 : w + 40, y: rr(-40, h * 0.9), vx: (left ? 1 : -1) * rr(260, 760), vy: rr(-60, 200), rot: R() * TAU, spin: rr(-5, 5), size: rr(16, 38), ph: R() * TAU, born: rr(0, 1.2), tone: Math.floor(R() * 3) }
  })
  const flies = Array.from({ length: 100 }, () => ({ x: R() * w, y: h * rr(0.3, 1.1), vy: rr(18, 70), ph: R() * TAU, size: rr(12, 34), born: rr(0, 1.4) }))
  const [soft, hard] = [blob(col[1]), blob(col[0])]
  const tones = [col[1], col[2], '#d9f26a']
  return {
    dur: 3.2,
    draw: (t, dt) => {
      add(c)
      flash(e, col[0], farthest(e) * 0.7, 0.6 * clamp(1 - t / 0.6))
      normal(c)
      vignette(e, 'rgba(10,70,30,0.7)', 0.35, 0.6 * envelope(t, 0.4, 2.2, 3.2))
      // folhas varrendo a tela
      for (const l of leaves) {
        if (t < l.born) continue
        l.x += l.vx * dt; l.y += (l.vy + Math.sin(t * 4 + l.ph) * 120) * dt; l.rot += l.spin * dt
        c.save(); c.translate(l.x, l.y); c.rotate(l.rot); c.scale(1, 0.55 + 0.45 * Math.cos(t * 3 + l.ph))
        c.globalAlpha = envelope(t, 0.1, 2.4, 3.2)
        c.fillStyle = tones[l.tone]
        leafPath(c, l.size); c.fill()
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5
        c.beginPath(); c.moveTo(0, -l.size); c.lineTo(0, l.size); c.stroke()
        c.restore()
      }
      c.globalAlpha = 1
      // vaga-lumes e pólen luminoso subindo
      add(c)
      for (const f of flies) {
        if (t < f.born) continue
        f.y -= f.vy * dt
        const x = f.x + Math.sin(t * 1.6 + f.ph) * 30
        const tw = 0.5 + 0.5 * Math.sin(t * 5 + f.ph)
        drawImg(c, soft, x, f.y, f.size * 2.4, 0.5 * tw * envelope(t, 0.3, 2.3, 3.2))
        drawImg(c, hard, x, f.y, f.size * 0.7, tw * envelope(t, 0.3, 2.3, 3.2))
      }
    },
  }
}

// ── Cosmos ──────────────────────────────────────────────

function cosmos(e: Env): Scene {
  const { c, w, h, ox, oy, col } = e
  const field = Array.from({ length: 130 }, () => ({ x: R() * w, y: R() * h, size: rr(8, 30), ph: R() * TAU, born: rr(0, 1.2), life: rr(1, 2), rot: R() * 2 }))
  const meteors = Array.from({ length: 12 }, (_, i) => ({ x: rr(w * 0.2, w * 1.1), y: -rr(40, h * 0.5), vx: -rr(900, 1700), vy: rr(700, 1300), born: 0.1 + i * 0.16 + R() * 0.1, tail: rr(180, 420) }))
  const neb = [[ox, oy, col[1]], [w * 0.2, h * 0.3, col[2]], [w * 0.82, h * 0.7, col[1]], [w * 0.7, h * 0.18, col[2]]] as const
  const star1 = star(col[0])
  return {
    dur: 3.1,
    draw: (t) => {
      add(c)
      flash(e, col[0], farthest(e) * 0.6, 0.7 * clamp(1 - t / 0.5))
      // nebulosa pulsando
      neb.forEach(([x, y, color], i) => drawImg(c, blob(color), x, y, Math.max(w, h) * (0.7 + 0.1 * Math.sin(t * 2 + i)), 0.32 * envelope(t, 0.4 + i * 0.1, 2.2, 3.1)))
      // céu de estrelas
      for (const s of field) {
        const age = t - s.born
        if (age < 0 || age > s.life) continue
        const k = Math.sin((age / s.life) * Math.PI) * (0.65 + 0.35 * Math.sin(age * 14 + s.ph))
        drawImg(c, star1, s.x, s.y, s.size * (0.5 + k), k, s.rot)
      }
      // estrelas cadentes
      c.lineCap = 'round'
      for (const m of meteors) {
        const age = t - m.born
        if (age < 0 || age > 1.5) continue
        const x = m.x + m.vx * age, y = m.y + m.vy * age
        const len = m.tail, sp = Math.hypot(m.vx, m.vy)
        const tx = x - (m.vx / sp) * len, ty = y - (m.vy / sp) * len
        const g = c.createLinearGradient(x, y, tx, ty)
        g.addColorStop(0, col[0]); g.addColorStop(0.3, col[1]); g.addColorStop(1, 'rgba(0,0,0,0)')
        c.strokeStyle = g; c.lineWidth = 5; c.globalAlpha = 0.95
        c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty); c.stroke()
        c.globalAlpha = 1
        drawImg(c, star1, x, y, 46, 1)
      }
    },
  }
}

// ── Escorrer (sangue e veneno) ──────────────────────────

function drips(e: Env, count: number, tones: readonly [string, string], gloss: string): Draw {
  const { c, w, h } = e
  const list = Array.from({ length: count }, () => ({ x: R() * w, born: rr(0, 1), speed: rr(160, 480), max: rr(h * 0.25, h * 0.95), width: rr(8, 26), tone: R() < 0.5 ? 0 : 1 }))
  return (t) => {
    normal(c)
    c.lineCap = 'round'
    for (const d of list) {
      const age = t - d.born
      if (age < 0) continue
      const len = Math.min(d.max, d.speed * age * (1 - Math.min(0.6, age * 0.12)))
      c.strokeStyle = tones[d.tone]; c.fillStyle = tones[d.tone]
      c.globalAlpha = 0.92 * envelope(t, 0.01, 2.4, 3.2)
      c.lineWidth = d.width
      c.beginPath(); c.moveTo(d.x, -10); c.lineTo(d.x, len); c.stroke()
      c.beginPath(); c.arc(d.x, len, d.width * 0.78, 0, TAU); c.fill()
      c.strokeStyle = gloss; c.globalAlpha *= 0.22; c.lineWidth = Math.max(2, d.width * 0.18)
      c.beginPath(); c.moveTo(d.x - d.width * 0.22, 0); c.lineTo(d.x - d.width * 0.22, len); c.stroke()
    }
    c.globalAlpha = 1
  }
}

function blood(e: Env): Scene {
  const { c, w, h, ox, oy, col } = e
  const drip = drips(e, Math.round(Math.max(14, w / 55)), [col[1], col[2]], col[0])
  const splat = Array.from({ length: 42 }, () => { const a = R() * TAU, d = rr(20, Math.min(w, h) * 0.45); return { x: ox + Math.cos(a) * d, y: oy + Math.sin(a) * d * 0.8, r: rr(6, 38) * (1 - d / (Math.min(w, h) * 0.6)) + 6, born: rr(0, 0.25) } })
  return {
    dur: 3.4,
    draw: (t) => {
      normal(c)
      vignette(e, 'rgba(120,0,10,0.85)', 0.2, 0.9 * envelope(t, 0.25, 2.4, 3.4))
      // espirro no ponto do dado
      c.fillStyle = col[1]
      for (const s of splat) {
        if (t < s.born) continue
        c.globalAlpha = 0.9 * envelope(t, 0.01, 2.4, 3.4)
        c.beginPath(); c.arc(s.x, s.y, s.r * easeOut((t - s.born) / 0.18), 0, TAU); c.fill()
      }
      c.globalAlpha = 1
      drip(t, 0)
    },
  }
}

function poison(e: Env): Scene {
  const { c, w, h, col } = e
  const drip = drips(e, Math.round(Math.max(10, w / 80)), [col[1], col[2]], col[0])
  const bubbles = Array.from({ length: 70 }, () => ({ x: R() * w, y: h + rr(10, 300), r: rr(8, 36), vy: rr(70, 220), ph: R() * TAU, pop: rr(1.2, 2.8) }))
  const mist = Array.from({ length: 12 }, () => ({ x: R() * w, y: rr(h * 0.3, h), size: rr(380, 760), ph: R() * TAU }))
  const soft = blob(col[1])
  return {
    dur: 3.3,
    draw: (t, dt) => {
      add(c)
      for (const m of mist) drawImg(c, soft, m.x + Math.sin(t + m.ph) * 80, m.y - t * 40, m.size, 0.22 * envelope(t, 0.5, 2.3, 3.3))
      normal(c)
      vignette(e, 'rgba(20,70,10,0.8)', 0.3, 0.75 * envelope(t, 0.3, 2.3, 3.3))
      drip(t, dt)
      for (const b of bubbles) {
        if (t > b.pop + 0.2) continue
        b.y -= b.vy * dt
        const x = b.x + Math.sin(t * 2.4 + b.ph) * 18
        if (t > b.pop) {   // estoura: um anel que abre e some
          const k = (t - b.pop) / 0.2
          c.globalAlpha = 1 - k; c.strokeStyle = col[0]; c.lineWidth = 3
          c.beginPath(); c.arc(x, b.y, b.r * (1 + k), 0, TAU); c.stroke()
          continue
        }
        c.globalAlpha = 0.5 * envelope(t, 0.2, 99, 100); c.fillStyle = col[1]
        c.beginPath(); c.arc(x, b.y, b.r, 0, TAU); c.fill()
        c.globalAlpha = 0.8; c.strokeStyle = col[0]; c.lineWidth = 2; c.stroke()
        c.globalAlpha = 0.7; c.fillStyle = col[0]
        c.beginPath(); c.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.22, 0, TAU); c.fill()
      }
      c.globalAlpha = 1
    },
  }
}

// ── Trevas ──────────────────────────────────────────────

function shadow(e: Env): Scene {
  const { c, w, h, ox, oy, col } = e
  const wisps = Array.from({ length: 46 }, () => {
    const a = R() * TAU, d = Math.hypot(w, h) * 0.6
    return { x: w / 2 + Math.cos(a) * d, y: h / 2 + Math.sin(a) * d, size: rr(260, 620), speed: rr(0.35, 0.8), ph: R() * TAU, born: rr(0, 0.8) }
  })
  const smoke = blob('rgba(18,6,34,1)'), violet = blob(col[1])
  return {
    dur: 3.4,
    draw: (t) => {
      normal(c)
      // a escuridão fecha pelas bordas até quase cobrir tudo
      vignette(e, 'rgba(6,0,14,0.95)', 0.8 - 0.5 * easeInOut(t / 1.6), 0.9 * envelope(t, 0.2, 2.5, 3.4))
      for (const s of wisps) {
        const age = t - s.born
        if (age < 0) continue
        const k = clamp(age * s.speed * 0.9)
        drawImg(c, smoke, s.x + (ox - s.x) * k * 0.7 + Math.sin(t * 2 + s.ph) * 40, s.y + (oy - s.y) * k * 0.7 + Math.cos(t * 1.7 + s.ph) * 40, s.size, 0.34 * envelope(t, 0.2, 2.5, 3.4))
      }
      add(c)
      // um fiapo roxo pulsando onde o dado caiu
      drawImg(c, violet, ox, oy, 340 + Math.sin(t * 6) * 40, 0.45 * envelope(t, 0.15, 1.6, 3))
    },
  }
}

// ── Rachaduras ──────────────────────────────────────────

function cracks(e: Env): Scene {
  const { c, w, ox, oy, col } = e
  const far = farthest(e)
  const lines: { pts: [number, number][]; delay: number; branches: { pts: [number, number][]; at: number }[] }[] = []
  const n = 16
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rr(-0.2, 0.2), len = far * rr(0.55, 1.15)
    const pts = jagged(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len, len * 0.22, 6)
    const branches = Array.from({ length: 3 }, () => {
      const at = rr(0.2, 0.75), [bx, by] = pts[Math.floor(pts.length * at)]
      const ba = a + rr(0.5, 1.1) * (R() < 0.5 ? 1 : -1), bl = len * rr(0.12, 0.3)
      return { pts: jagged(bx, by, bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl, bl * 0.3, 4), at }
    })
    lines.push({ pts, delay: rr(0, 0.12), branches })
  }
  const debris = Array.from({ length: 36 }, () => ({ x: R() * w, y: -rr(20, 300), vy: rr(200, 700), rot: R() * TAU, spin: rr(-6, 6), size: rr(8, 26), born: rr(0.3, 1.6) }))
  return {
    dur: 3.2,
    draw: (t, dt) => {
      normal(c)
      vignette(e, 'rgba(90,0,0,0.8)', 0.25, 0.8 * envelope(t, 0.15, 2.2, 3.2))
      add(c)
      flash(e, col[0], far * 0.6, 0.85 * clamp(1 - t / 0.35))
      c.lineCap = 'round'; c.lineJoin = 'round'
      const fade = envelope(t, 0.01, 2.3, 3.2)
      for (const l of lines) {
        const k = easeOut((t - l.delay) / 0.55)
        if (k <= 0) continue
        normal(c)
        c.strokeStyle = 'rgba(10,0,4,0.9)'; c.globalAlpha = fade; c.lineWidth = 7; strokePath(c, l.pts, k)
        add(c)
        c.strokeStyle = col[1]; c.globalAlpha = fade * 0.9; c.lineWidth = 2.5; strokePath(c, l.pts, k)
        for (const b of l.branches) {
          if (k < b.at) continue
          const bk = clamp((k - b.at) / (1 - b.at))
          normal(c); c.strokeStyle = 'rgba(10,0,4,0.85)'; c.lineWidth = 4; strokePath(c, b.pts, bk)
          add(c); c.strokeStyle = col[1]; c.lineWidth = 1.6; strokePath(c, b.pts, bk)
        }
      }
      c.globalAlpha = 1
      normal(c)
      c.fillStyle = '#2a1414'
      for (const d of debris) {
        if (t < d.born) continue
        d.y += d.vy * dt; d.rot += d.spin * dt
        c.save(); c.translate(d.x, d.y); c.rotate(d.rot); c.globalAlpha = fade
        c.beginPath(); c.moveTo(-d.size, -d.size * 0.5); c.lineTo(d.size, -d.size * 0.2); c.lineTo(d.size * 0.4, d.size); c.closePath(); c.fill()
        c.restore()
      }
      c.globalAlpha = 1
    },
  }
}

// ── Vazio ───────────────────────────────────────────────

function voidFx(e: Env): Scene {
  const { c, w, h, ox, oy, col } = e
  const far = farthest(e)
  const motes = Array.from({ length: 220 }, () => ({ a: R() * TAU, r: far * rr(0.25, 1.15), va: rr(1.6, 3.4), pull: rr(0.55, 1.1), size: rr(5, 15), born: rr(0, 0.9), px: 0, py: 0 }))
  const glow = blob(col[1])
  return {
    dur: 3.4,
    draw: (t, dt) => {
      normal(c)
      vignette(e, 'rgba(8,0,22,0.92)', 0.3, 0.85 * envelope(t, 0.3, 2.5, 3.4))
      add(c)
      // partículas sugadas em espiral
      c.lineCap = 'round'
      for (const m of motes) {
        if (t < m.born) continue
        const prevX = ox + Math.cos(m.a) * m.r, prevY = oy + Math.sin(m.a) * m.r * 0.78
        m.a += m.va * dt * (1 + (1 - m.r / far) * 2.6)
        m.r = Math.max(0, m.r - m.r * m.pull * dt * 1.5 - 70 * dt)
        const x = ox + Math.cos(m.a) * m.r, y = oy + Math.sin(m.a) * m.r * 0.78
        const a = clamp(m.r / 90) * envelope(t, 0.1, 2.5, 3.4)
        c.strokeStyle = col[1]; c.globalAlpha = a * 0.55; c.lineWidth = m.size * 0.5
        c.beginPath(); c.moveTo(prevX, prevY); c.lineTo(x, y); c.stroke()
        drawImg(c, glow, x, y, m.size * 2, a)
      }
      c.globalAlpha = 1
      // o buraco: aro roxo e miolo negro
      const k = envelope(t, 0.4, 2.3, 3.2)
      const r = 36 + easeOut(t / 1.2) * Math.min(w, h) * 0.12
      drawImg(c, glow, ox, oy, r * 5, 0.7 * k)
      normal(c)
      c.globalAlpha = k; c.fillStyle = '#05000d'
      c.beginPath(); c.ellipse(ox, oy, r, r * 0.8, 0, 0, TAU); c.fill()
      c.globalAlpha = 1
      add(c)
      c.strokeStyle = col[0]; c.lineWidth = 3; c.globalAlpha = 0.8 * k
      c.beginPath(); c.ellipse(ox, oy, r, r * 0.8, 0, 0, TAU); c.stroke()
      c.globalAlpha = 1
    },
  }
}

// ── Cinzas ──────────────────────────────────────────────

function ash(e: Env): Scene {
  const { c, w, h, ox, oy, col } = e
  const flakes = Array.from({ length: 230 }, () => ({ x: R() * w, y: -rr(0, h * 0.8), vy: rr(70, 260), sw: R() * TAU, size: rr(3, 11), rot: R() * TAU, spin: rr(-4, 4), tone: Math.floor(R() * 3), born: rr(0, 1.4) }))
  const embers = Array.from({ length: 40 }, () => ({ x: R() * w, y: h + rr(0, 200), vy: rr(60, 190), ph: R() * TAU, size: rr(8, 22) }))
  const ember = blob('#ff7a3a')
  const tones = [col[0], col[1], col[2]]
  return {
    dur: 3.3,
    draw: (t, dt) => {
      normal(c)
      c.fillStyle = 'rgba(28,24,22,1)'
      c.globalAlpha = 0.42 * envelope(t, 0.3, 2.3, 3.3)
      c.fillRect(0, 0, w, h)
      c.globalAlpha = 1
      vignette(e, 'rgba(10,8,8,0.9)', 0.3, 0.8 * envelope(t, 0.3, 2.3, 3.3))
      // nuvem de pó no ponto do dado
      const dust = blob('rgba(120,112,104,1)')
      drawImg(c, dust, ox, oy, 240 + easeOut(t / 1.2) * 520, 0.55 * clamp(1 - t / 1.8))
      for (const f of flakes) {
        if (t < f.born) continue
        f.y += f.vy * dt; f.rot += f.spin * dt
        const x = f.x + Math.sin(t * 1.4 + f.sw) * 40
        c.save(); c.translate(x, f.y); c.rotate(f.rot); c.fillStyle = tones[f.tone]; c.globalAlpha = 0.85 * envelope(t, 0.1, 2.5, 3.3)
        c.beginPath(); c.moveTo(-f.size, -f.size * 0.4); c.lineTo(f.size * 0.8, -f.size * 0.6); c.lineTo(f.size, f.size * 0.5); c.lineTo(-f.size * 0.4, f.size * 0.7); c.closePath(); c.fill()
        c.restore()
      }
      c.globalAlpha = 1
      add(c)
      for (const m of embers) {
        m.y -= m.vy * dt
        drawImg(c, ember, m.x + Math.sin(t * 2 + m.ph) * 26, m.y, m.size, (0.5 + 0.5 * Math.sin(t * 7 + m.ph)) * 0.7 * envelope(t, 0.3, 2.3, 3.3))
      }
    },
  }
}

// ── Mesa de animações ───────────────────────────────────

const SCENES: Record<FxTheme, (e: Env) => Scene> = {
  fire: (e) => fire(e, false),
  glow,
  lightning,
  water,
  ice,
  arcane,
  nature,
  cosmos,
  darkfire: (e) => fire(e, true),
  redlightning: lightning,
  blood,
  shadow,
  cracks,
  poison,
  void: voidFx,
  ash,
}

// ── Canvas e laço ───────────────────────────────────────

let active: { canvas: HTMLCanvasElement; raf: number; stop: () => void } | null = null

/** Toca a animação de tela cheia a partir do ponto `origin` (em px da janela). Uma por vez: a nova troca a anterior. */
export function playScreenFx(theme: FxTheme, origin: FxOrigin): void {
  if (typeof document === 'undefined') return
  active?.stop()
  const canvas = document.createElement('canvas')
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  const w = window.innerWidth, h = window.innerHeight
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: '9500', pointerEvents: 'none' })
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.fx = theme
  const c = canvas.getContext('2d')
  if (!c) return
  c.scale(dpr, dpr)
  document.body.append(canvas)

  const env: Env = { c, w, h, ox: clamp(origin.x, 0, w), oy: clamp(origin.y, 0, h), col: THEME_COLORS[theme] }
  const scene = SCENES[theme](env)
  const start = performance.now()
  let last = start
  const run: NonNullable<typeof active> = {
    canvas, raf: 0,
    stop: () => { cancelAnimationFrame(run.raf); canvas.remove(); if (active === run) active = null },
  }
  const frame = (now: number) => {
    const t = (now - start) / 1000
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (t >= scene.dur) { run.stop(); return }
    c.clearRect(0, 0, w, h)
    c.globalCompositeOperation = 'source-over'
    c.globalAlpha = 1
    scene.draw(t, dt)
    c.globalCompositeOperation = 'source-over'
    c.globalAlpha = 1
    // some suave no fim, para nada cortar de repente
    const left = scene.dur - t
    canvas.style.opacity = left < 0.5 ? String(left / 0.5) : '1'
    run.raf = requestAnimationFrame(frame)
  }
  run.raf = requestAnimationFrame(frame)
  active = run
}

/** Para a animação em andamento (se houver). */
export function stopScreenFx(): void { active?.stop() }
