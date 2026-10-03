import { RoomGame, type GameOptions, type Placed, type Scene } from '../../livro/game/engine'
import { H, makeCanvas, px, W, type Ctx } from '../../livro/game/art'
import type { Interactable, Rect } from '../../livro/game/room'
import type { Dir, Floor, TorrePanel } from '../torreNet'
import type { TorreGame } from '../torreService'
import { LENS, SKY_SLOTS, STAR_COLORS, swingX } from './sky'
import {
  BEAM_SLIT, BRIGHT_STARS, DOME_SLIT, drawBob, drawLowerBackground, drawRod, drawUpperBackground, GRATE, MIRRORS, onBar,
  spriteAstrario, spriteEspelhos, spriteManivela, spriteMapa, spritePenduloBaixo, spritePenduloCima, spriteTelescopio,
} from './art'

// ────────────────────────────────────────────────────────
// A torre: onde fica cada coisa nos dois andares (em pixels nativos,
// 384×216 — a mesma planta, um andar em cima do outro), o que bloqueia o
// caminho, de onde dá pra usar cada objeto e como é a luz.
//
//   CIMA (o Observatório)            BAIXO (a Casa das Máquinas)
//   Norte → fresta da cúpula         Norte → fresta do feixe e lampiões
//   Oeste → Mapa estelar             Oeste → os 4 Espelhos
//   Leste → Telescópio               Leste → Manivela e engrenagens
//   Centro → grade com o pêndulo     Centro → o peso do pêndulo
//   Sul → Astrário (face de cima)    Sul → Astrário (face de baixo)
//
// Quem está no outro andar aparece só como sombra, e só quando passa
// pela grade.
// ────────────────────────────────────────────────────────

/** Onde cada jogador aparece (Observador em cima, Mecânico embaixo). */
export const SPAWNS: { x: number; y: number; d: Dir }[] = [
  { x: 110, y: 184, d: 'right' },
  { x: 276, y: 184, d: 'left' },
]

const FLOOR = { x0: 22, y0: 64, x1: 362, y1: 203 }

/** O andar de cada slot: 0 em cima, 1 embaixo. */
const slotFloor = (slot: number): Floor => (slot === 0 ? 'cima' : 'baixo')

/** O jogo como a sala recebe: a visão e a diferença pro relógio do banco. */
export type FloorGame = TorreGame & { off: number }

/** Balanço do pêndulo agora (−1 a 1; parado = 0), pela hora do banco. */
const swing = (g: FloorGame | null) => (g ? swingX(g.pend, Date.now() + g.off) : 0)

/** O céu de olhos (a revelação), dentro da fresta da cúpula. */
function drawEyes(n: Ctx, time: number) {
  const s = DOME_SLIT
  for (let i = 0; i < 26; i++) {
    const x = s.x + 4 + ((i * 37) % (s.w - 8))
    const y = s.y + 6 + ((i * 23) % (s.h - 12))
    const blink = Math.sin(time * 1.3 + i * 2.1) > 0.96
    px(n, '#d9dff0', x - 1, y, 3, 1)
    if (!blink) px(n, '#120c16', x, y, 1, 1)
  }
  // o olho do Rei, no meio
  const cx = s.x + s.w / 2
  const cy = s.y + s.h / 2
  for (let x = -9; x <= 9; x++) {
    const h = Math.round(Math.sqrt(Math.max(0, 1 - (x * x) / 81)) * 5)
    px(n, '#efe6d2', cx + x, cy - h, 1, h * 2 + 1)
  }
  px(n, '#a8323a', cx - 3, cy - 3, 7, 7)
  px(n, '#120c16', cx - 1, cy - 2, 3, 5)
}

function astrario(floor: Floor): Interactable<TorrePanel> {
  return {
    id: 'astrario',
    name: 'Astrário',
    at: { x: 175, y: 152 },
    sprite: spriteAstrario(floor),
    base: 190,
    zone: { x: 166, y: 190, w: 52, h: 13 },
    approach: { x: 192, y: 199, face: 'up' },
  }
}

/** Um bonequinho de sombra (pra quem está do outro lado da grade). */
function silhouette(x: number, y: number, each: (px: number, py: number) => void) {
  const cx = Math.round(x)
  const top = Math.round(y) - 17
  for (let r = 0; r < 18; r++) {
    // capuz (r 0..6) mais estreito, capa alargando
    const half = r < 2 ? 2 : r < 7 ? 4 : Math.min(6, 4 + Math.floor((r - 6) / 3))
    for (let i = -half; i < half; i++) each(cx + i, top + r)
  }
}

/** Uma das duas plantas da torre. */
export function floorScene(floor: Floor): Scene<TorrePanel, FloorGame> {
  return floor === 'cima' ? upperScene() : lowerScene()
}

// ── Cima: o Observatório ────────────────────────────────

function upperScene(): Scene<TorrePanel, FloorGame> {
  const [bg, bctx] = makeCanvas(W, H)
  drawUpperBackground(bctx)

  const objects: Interactable<TorrePanel>[] = [
    {
      id: 'telescopio',
      name: 'Telescópio',
      at: { x: 288, y: 26 },
      sprite: spriteTelescopio(),
      base: 90,
      zone: { x: 286, y: 90, w: 52, h: 18 },
      approach: { x: 310, y: 100, face: 'up' },
    },
    {
      id: 'mapa',
      name: 'Mapa estelar',
      at: { x: 22, y: 48 },
      sprite: spriteMapa(),
      base: 114,
      zone: { x: 20, y: 114, w: 50, h: 18 },
      approach: { x: 44, y: 124, face: 'up' },
    },
    {
      id: 'pendulo',
      name: 'Pêndulo',
      at: { x: 178, y: 0 },
      sprite: spritePenduloCima(),
      base: 128,
      tag: { x: 14, y: 110 },
      zone: { x: 166, y: 130, w: 52, h: 14 },
      approach: { x: 192, y: 138, face: 'up' },
    },
    astrario('cima'),
  ]

  const obstacles: Rect[] = [
    { x: 292, y: 80, w: 36, h: 10 },   // tripé do telescópio
    { x: 26, y: 104, w: 36, h: 10 },   // cavalete do mapa
    { x: 182, y: 120, w: 20, h: 8 },   // colar do pêndulo
    { x: 178, y: 182, w: 28, h: 8 },   // coluna do Astrário
  ]

  const drawObject = (n: Ctx, o: Interactable<TorrePanel>, _time: number, g: FloorGame | null) => {
    if (o.id === 'pendulo') drawRod(n, o.at.x + 14, o.at.y, swing(g) * 3)
  }

  const drawLight = (l: Ctx, n: Ctx, light: HTMLCanvasElement, time: number, placed: Placed[], g: FloorGame | null) => {
    l.fillStyle = g?.opened ? 'rgba(6,4,14,0.4)' : 'rgba(6,4,14,0.62)'
    l.fillRect(0, 0, W, H)
    l.globalCompositeOperation = 'destination-out'
    const hole = (x: number, y: number, r: number, a: number) => {
      const g = l.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(0,0,0,${a})`)
      g.addColorStop(0.55, `rgba(0,0,0,${a * 0.55})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      l.fillStyle = g
      l.fillRect(x - r, y - r, r * 2, r * 2)
    }
    // o luar descendo da fresta até o chão
    l.fillStyle = 'rgba(0,0,0,0.55)'
    l.beginPath()
    l.moveTo(DOME_SLIT.x, 4)
    l.lineTo(DOME_SLIT.x + DOME_SLIT.w, 4)
    l.lineTo(244, 160)
    l.lineTo(140, 160)
    l.closePath()
    l.fill()
    hole(192, 28, 46, 0.9)
    hole(310, 64, 30, 0.35)         // brilho da lente
    for (const { x, y } of placed) hole(x, y - 8, 28, 0.55)
    n.drawImage(light, 0, 0)

    n.globalCompositeOperation = 'lighter'
    n.fillStyle = 'rgba(120,150,255,0.06)'
    n.beginPath()
    n.moveTo(DOME_SLIT.x, 4)
    n.lineTo(DOME_SLIT.x + DOME_SLIT.w, 4)
    n.lineTo(244, 160)
    n.lineTo(140, 160)
    n.closePath()
    n.fill()
    // a revelação: o céu está cheio de olhos
    if (g?.opened) {
      n.globalCompositeOperation = 'source-over'
      drawEyes(n, time)
      n.globalCompositeOperation = 'lighter'
    }
    // as estrelas escondidas que já acenderam também aparecem na fresta
    for (const st of g && !g.opened ? g.tele?.stars ?? [] : []) {
      if (st.state !== 'lit') continue
      const [lx, ly] = SKY_SLOTS[st.slot]
      const sx = Math.round(DOME_SLIT.x + (lx / LENS.w) * DOME_SLIT.w)
      const sy = Math.round(DOME_SLIT.y + 2 + (ly / LENS.h) * (DOME_SLIT.h - 4))
      n.fillStyle = STAR_COLORS[st.k]
      n.fillRect(sx, sy, 1, 1)
      n.globalAlpha = 0.4
      n.fillRect(sx - 1, sy, 3, 1)
      n.fillRect(sx, sy - 1, 1, 3)
      n.globalAlpha = 1
    }
    // as 3 estrelas que brilham, piscando
    for (let i = 0; i < (g?.opened ? 0 : BRIGHT_STARS.length); i++) {
      const [sx, sy] = BRIGHT_STARS[i]
      const a = 0.75 + 0.25 * Math.sin(time * 2.3 + i * 2)
      n.fillStyle = `rgba(255,240,200,${a.toFixed(2)})`
      n.fillRect(sx, sy, 1, 1)
      n.fillStyle = `rgba(255,231,163,${(a * 0.45).toFixed(2)})`
      n.fillRect(sx - 1, sy, 3, 1)
      n.fillRect(sx, sy - 1, 1, 3)
    }
    // o calor da casa das máquinas subindo pela grade
    const wg = n.createRadialGradient(GRATE.x + GRATE.w / 2, GRATE.y + GRATE.h / 2, 0, GRATE.x + GRATE.w / 2, GRATE.y + GRATE.h / 2, 40)
    wg.addColorStop(0, 'rgba(255,140,60,0.07)')
    wg.addColorStop(1, 'rgba(255,140,60,0)')
    n.fillStyle = wg
    n.fillRect(GRATE.x, GRATE.y, GRATE.w, GRATE.h)
    n.globalCompositeOperation = 'source-over'
  }

  /** O Mecânico lá embaixo: uma forma apagada entre as barras. */
  const drawGhost = (n: Ctx, x: number, y: number) => {
    silhouette(x, y, (gx, gy) => {
      if (gx <= GRATE.x || gy <= GRATE.y || gx >= GRATE.x + GRATE.w || gy >= GRATE.y + GRATE.h || onBar(gx, gy)) return
      px(n, gy < Math.round(y) - 12 ? '#4a2c22' : '#2e1b16', gx, gy, 1, 1)
    })
  }

  return {
    objects, obstacles, floor: FLOOR, spawns: SPAWNS, background: bg,
    drawObject, drawLight, drawGhost,
    actorMode: (slot) => (slotFloor(slot) === 'cima' ? 'full' : 'ghost'),
  }
}

// ── Baixo: a Casa das Máquinas ──────────────────────────

function lowerScene(): Scene<TorrePanel, FloorGame> {
  const [bg, bctx] = makeCanvas(W, H)
  drawLowerBackground(bctx)
  const MIRRORS_AT = { x: 56, y: 82 }
  const RING_AT = { x: 164, y: 128 }

  const objects: Interactable<TorrePanel>[] = [
    {
      id: 'espelhos',
      name: 'Espelhos',
      at: MIRRORS_AT,
      sprite: spriteEspelhos(),
      base: 128,
      zone: { x: 58, y: 128, w: 86, h: 16 },
      approach: { x: 100, y: 136, face: 'up' },
    },
    {
      id: 'manivela',
      name: 'Manivela',
      at: { x: 296, y: 12 },
      sprite: spriteManivela(),
      base: 124,
      zone: { x: 300, y: 124, w: 60, h: 18 },
      approach: { x: 328, y: 134, face: 'up' },
    },
    {
      id: 'pendulo',
      name: 'Pêndulo',
      at: RING_AT,
      sprite: spritePenduloBaixo(),
      base: 146,
      zone: { x: 160, y: 146, w: 64, h: 12 },
      approach: { x: 192, y: 153, face: 'up' },
    },
    astrario('baixo'),
  ]

  const obstacles: Rect[] = [
    { x: 58, y: 120, w: 84, h: 8 },    // base dos espelhos
    { x: 306, y: 112, w: 44, h: 12 },  // base da manivela
    { x: 176, y: 131, w: 32, h: 10 },  // mostrador do pêndulo
    { x: 178, y: 182, w: 28, h: 8 },   // coluna do Astrário
  ]

  // O feixe: entra pela fresta e bate no 1º espelho.
  const beamTo = { x: MIRRORS_AT.x + MIRRORS[0][0] + 1, y: MIRRORS_AT.y + MIRRORS[0][1] + 5 }
  const beamFrom = { x: BEAM_SLIT.x + BEAM_SLIT.w / 2, y: BEAM_SLIT.y + BEAM_SLIT.h / 2 }

  const MANIVELA_GLASS = { x: 296 + 32, y: 12 + 82 }   // a trava de vidro, na engrenagem de baixo

  const drawObject = (n: Ctx, o: Interactable<TorrePanel>, _time: number, g: FloorGame | null) => {
    if (o.id === 'pendulo') drawBob(n, swing(g) * 16, 12, 110)
  }

  const drawLight = (l: Ctx, n: Ctx, light: HTMLCanvasElement, time: number, placed: Placed[], g: FloorGame | null) => {
    l.fillStyle = 'rgba(6,4,14,0.6)'
    l.fillRect(0, 0, W, H)
    l.globalCompositeOperation = 'destination-out'
    const hole = (x: number, y: number, r: number, a: number) => {
      const g = l.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(0,0,0,${a})`)
      g.addColorStop(0.55, `rgba(0,0,0,${a * 0.55})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      l.fillStyle = g
      l.fillRect(x - r, y - r, r * 2, r * 2)
    }
    const flick = (seed: number) => 1 + 0.05 * Math.sin(time * 11 + seed) + 0.03 * Math.sin(time * 23 + seed * 3)
    for (const lx of [132, 256]) hole(lx, 30, 56 * flick(lx), 0.9)
    hole(beamFrom.x, beamFrom.y, 26, 0.8)
    hole(beamTo.x, beamTo.y, 22, 0.7)
    hole(GRATE.x + GRATE.w / 2, GRATE.y + GRATE.h / 2, 44, 0.45)
    for (const { x, y } of placed) hole(x, y - 8, 26, 0.5)
    const full = !!g?.mir?.full
    const bob = { x: Math.round(192 + swing(g) * 16), y: 114 }
    if (full) hole(bob.x, bob.y, 30, 0.7)
    if (g?.crank?.gear) hole(MANIVELA_GLASS.x, MANIVELA_GLASS.y, 14, 0.6)
    n.drawImage(light, 0, 0)

    n.globalCompositeOperation = 'lighter'
    // os 4 feixes fechados: de cada espelho até o peso do pêndulo
    if (full) {
      n.strokeStyle = 'rgba(255,231,163,0.35)'
      n.lineWidth = 1
      for (const [mx, my] of MIRRORS) {
        n.beginPath()
        n.moveTo(MIRRORS_AT.x + mx + 1, MIRRORS_AT.y + my + 5)
        n.lineTo(bob.x, bob.y)
        n.stroke()
      }
      const bg2 = n.createRadialGradient(bob.x, bob.y, 0, bob.x, bob.y, 18)
      bg2.addColorStop(0, `rgba(255,231,163,${(0.3 + 0.08 * Math.sin(time * 4)).toFixed(2)})`)
      bg2.addColorStop(1, 'rgba(255,231,163,0)')
      n.fillStyle = bg2
      n.fillRect(bob.x - 18, bob.y - 18, 36, 36)
    }
    // a trava de vidro acesa
    if (g?.crank?.gear) {
      n.fillStyle = `rgba(255,231,163,${(0.35 + 0.1 * Math.sin(time * 3)).toFixed(2)})`
      n.fillRect(MANIVELA_GLASS.x - 2, MANIVELA_GLASS.y - 2, 5, 5)
    }
    // o feixe de luz
    const dx = beamTo.x - beamFrom.x
    const dy = beamTo.y - beamFrom.y
    const len = Math.hypot(dx, dy)
    const nx = (-dy / len) * 2
    const ny = (dx / len) * 2
    n.fillStyle = 'rgba(255,220,140,0.22)'
    n.beginPath()
    n.moveTo(beamFrom.x - nx, beamFrom.y - ny - 6)
    n.lineTo(beamFrom.x + nx, beamFrom.y + ny + 6)
    n.lineTo(beamTo.x + nx, beamTo.y + ny)
    n.lineTo(beamTo.x - nx, beamTo.y - ny)
    n.closePath()
    n.fill()
    n.fillStyle = 'rgba(255,240,200,0.35)'
    n.fillRect(beamTo.x - 1, beamTo.y - 1, 3, 3)
    // os lampiões
    for (const lx of [132, 256]) {
      const cg = n.createRadialGradient(lx, 30, 0, lx, 30, 34 * flick(lx))
      cg.addColorStop(0, 'rgba(255,150,60,0.20)')
      cg.addColorStop(1, 'rgba(255,150,60,0)')
      n.fillStyle = cg
      n.fillRect(lx - 36, 0, 72, 70)
    }
    // o luar de cima caindo pela grade: quadradinhos de luz no chão
    n.fillStyle = g?.opened ? 'rgba(255,231,163,0.22)' : 'rgba(150,170,255,0.16)'
    for (let gy = GRATE.y + 2; gy < GRATE.y + GRATE.h; gy += 6) {
      for (let gx = GRATE.x + 2; gx < GRATE.x + GRATE.w; gx += 6) n.fillRect(gx, gy, 4, 4)
    }
    n.globalCompositeOperation = 'source-over'
  }

  /** O Observador lá em cima: a sombra dele tapa a luz que cai pela grade. */
  const drawGhost = (n: Ctx, x: number, y: number) => {
    silhouette(x, y, (gx, gy) => {
      if (gx <= GRATE.x || gy <= GRATE.y || gx >= GRATE.x + GRATE.w || gy >= GRATE.y + GRATE.h || onBar(gx, gy)) return
      px(n, 'rgba(4,3,8,0.78)', gx, gy, 1, 1)
    })
  }

  return {
    objects, obstacles, floor: FLOOR, spawns: SPAWNS, background: bg,
    drawObject, drawLight, drawGhost,
    actorMode: (slot) => (slotFloor(slot) === 'baixo' ? 'full' : 'ghost'),
  }
}

/** O motor com um dos andares. */
export class TorreFloor extends RoomGame<TorrePanel, FloorGame> {
  constructor(canvas: HTMLCanvasElement, opts: GameOptions<TorrePanel>, floor: Floor) {
    super(canvas, opts, floorScene(floor))
  }
}
