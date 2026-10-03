import type { Dir } from '../livroNet'

// ────────────────────────────────────────────────────────
// A arte do Livro Bloqueado, desenhada pixel a pixel em código (nada de
// imagem): a biblioteca de Caatedrum à noite, os 5 objetos, os bonecos.
// Tudo é desenhado na resolução nativa (384×216) e ampliado sem
// suavizar — pixel art de verdade.
// ────────────────────────────────────────────────────────

export const W = 384
export const H = 216

export type Ctx = CanvasRenderingContext2D

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  return [c, ctx]
}

/** Um retângulo de pixels. */
export function px(ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

/** Aleatório com semente (a sala sai sempre igual). */
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Paleta ──────────────────────────────────────────────

export const P = {
  void:      '#0b0910',
  ceil:      '#0d0a12',
  ceilEdge:  '#2c2436',
  side:      '#14101a',
  sideEdge:  '#251e2e',
  brick:     '#2a2232',
  brickHi:   '#31283b',
  mortar:    '#1f1926',
  panel:     '#2b1f1a',
  panelDark: '#1f1611',
  panelHi:   '#3a2a22',
  base:      '#16100d',
  plankA:    '#3a2a22',
  plankB:    '#3e2d24',
  plankHi:   '#47352b',
  plankGap:  '#261b15',
  grain:     '#33251e',
  glassA:    '#1b2745',
  glassB:    '#2b3d68',
  moon:      '#d9dff0',
  rug:       '#3d1520',
  rugDark:   '#2c0f17',
  rugBorder: '#7a5a26',
  rugPat:    '#53202e',
  iron:      '#3a3642',
  ironHi:    '#5c5767',
  ironDark:  '#24212b',
  wax:       '#e6dcc2',
  waxHi:     '#f6efdc',
  waxLo:     '#b9ab8c',
  wick:      '#2a2020',
  rune:      '#a08040',
  wood:      '#5a3b27',
  woodHi:    '#73502f',
  woodDark:  '#3e281a',
  woodTop:   '#6e4a31',
  gold:      '#c99a3b',
  goldHi:    '#ecc66a',
  goldLo:    '#7a5a1e',
  canvas:    '#231c1a',
  canvasHi:  '#2f2622',
  crack:     '#15100e',
  stone:     '#625c6c',
  stoneHi:   '#7d778a',
  stoneLo:   '#46414f',
  leather:   '#6b2f22',
  leatherHi: '#8c4130',
  pages:     '#dacfae',
  chain:     '#8a8594',
  chainLo:   '#55505f',
  paper:     '#c9bd9a',
  ink:       '#1a1220',
}

// ── A sala (fundo fixo) ─────────────────────────────────

/** Chão, paredes, janelas, tapete e enfeites — desenhado uma vez só. */
export function drawRoomBackground(ctx: Ctx) {
  const rnd = seeded(7)
  px(ctx, P.void, 0, 0, W, H)

  // Chão de tábuas (o assoalho vai de y 60 a 204).
  ctx.save()
  ctx.beginPath()
  ctx.rect(16, 60, 352, 144)
  ctx.clip()
  for (let y = 60; y < 204; y += 8) {
    let x = 16 - Math.floor(rnd() * 34)
    while (x < 368) {
      const len = 24 + Math.floor(rnd() * 34)
      px(ctx, rnd() < 0.5 ? P.plankA : P.plankB, x, y, len, 8)
      px(ctx, P.plankHi, x + 1, y, len - 2, 1)
      px(ctx, P.plankGap, x + len - 1, y, 1, 8)
      if (rnd() < 0.7) px(ctx, P.grain, x + 3 + Math.floor(rnd() * (len - 12)), y + 2 + Math.floor(rnd() * 4), 4 + Math.floor(rnd() * 8), 1)
      if (rnd() < 0.18) px(ctx, P.plankGap, x + 4 + Math.floor(rnd() * (len - 8)), y + 3, 2, 2)
      x += len
    }
    px(ctx, P.plankGap, 16, y + 7, 352, 1)
  }
  // Sombra da parede no chão.
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(16, 60, 352, 3)
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(16, 63, 352, 3)
  ctx.restore()

  // Teto e parede norte (tijolos em cima, lambri embaixo).
  px(ctx, P.ceil, 0, 0, W, 12)
  px(ctx, P.ceilEdge, 16, 11, 352, 1)
  px(ctx, P.brick, 16, 12, 352, 32)
  for (let row = 0; row < 4; row++) {
    const y = 12 + row * 8
    const off = row % 2 ? 8 : 0
    px(ctx, P.mortar, 16, y + 7, 352, 1)
    for (let x = 16 - off; x < 368; x += 16) {
      if (x + 15 >= 16) px(ctx, P.mortar, Math.max(16, x + 15), y, 1, 7)
      px(ctx, P.brickHi, Math.max(16, x), y, Math.min(15, 368 - Math.max(16, x)), 1)
      if (rnd() < 0.25) px(ctx, P.mortar, Math.max(17, x + 3 + Math.floor(rnd() * 8)), y + 2 + Math.floor(rnd() * 3), 2, 1)
    }
  }
  px(ctx, P.panelHi, 16, 44, 352, 2)
  px(ctx, P.panel, 16, 46, 352, 12)
  for (let x = 16; x < 368; x += 22) {
    px(ctx, P.panelDark, x, 46, 1, 12)
    px(ctx, P.panelDark, x + 3, 49, 16, 1)
    px(ctx, P.panelDark, x + 3, 49, 1, 7)
    px(ctx, '#33251f', x + 4, 55, 15, 1)
    px(ctx, '#33251f', x + 18, 50, 1, 6)
  }
  px(ctx, P.base, 16, 58, 352, 2)

  // Paredes dos lados e a de baixo.
  px(ctx, P.side, 0, 0, 16, H)
  px(ctx, P.side, 368, 0, 16, H)
  px(ctx, P.sideEdge, 15, 12, 1, 192)
  px(ctx, P.sideEdge, 368, 12, 1, 192)
  px(ctx, P.ceil, 0, 204, W, 12)
  px(ctx, P.ceilEdge, 16, 204, 352, 1)

  // Janelas em arco com a lua.
  for (const wx of [60, 296]) drawWindow(ctx, wx, 15, wx === 60)

  // Teias nos cantos.
  for (const [cx, dir] of [[16, 1], [367, -1]] as const) {
    for (let i = 0; i < 9; i++) px(ctx, 'rgba(150,140,170,0.35)', cx + dir * i, 12 + i, 1, 1)
    for (let i = 0; i < 12; i++) px(ctx, 'rgba(150,140,170,0.25)', cx + dir * i, 12, 1, 1)
    for (let i = 0; i < 10; i++) px(ctx, 'rgba(150,140,170,0.25)', cx, 12 + i, 1, 1)
    for (let i = 2; i < 7; i++) px(ctx, 'rgba(150,140,170,0.25)', cx + dir * i, 12 + Math.round(i * 0.5) + 3, 1, 1)
  }

  // Tapete sob o pedestal.
  drawRug(ctx, 126, 78, 132, 60)

  // Papéis e um livro caído.
  drawPaper(ctx, 100, 152, 7, 5)
  drawPaper(ctx, 108, 156, 6, 4)
  drawPaper(ctx, 284, 90, 7, 5)
  px(ctx, '#3e1c2a', 262, 168, 9, 6)
  px(ctx, '#5a2a3a', 262, 168, 9, 1)
  px(ctx, P.pages, 263, 173, 7, 1)
  // Cera derretida perto do pedestal.
  px(ctx, P.waxLo, 150, 140, 3, 1)
  px(ctx, P.waxLo, 232, 74, 2, 1)
}

function drawWindow(ctx: Ctx, x: number, y: number, moon: boolean) {
  const w = 28
  // moldura em arco
  px(ctx, '#120e17', x - 2, y + 4, w + 4, 27)
  px(ctx, '#120e17', x, y + 1, w, 4)
  px(ctx, '#120e17', x + 4, y - 1, w - 8, 2)
  // vidro
  px(ctx, P.glassA, x, y + 5, w, 24)
  px(ctx, P.glassB, x, y + 5, w, 9)
  px(ctx, P.glassA, x + 2, y + 2, w - 4, 3)
  px(ctx, P.glassB, x + 2, y + 2, w - 4, 2)
  px(ctx, P.glassB, x + 5, y, w - 10, 2)
  if (moon) {
    px(ctx, P.moon, x + 6, y + 6, 4, 4)
    px(ctx, P.moon, x + 5, y + 7, 6, 2)
    px(ctx, P.glassB, x + 8, y + 6, 2, 2)
  } else {
    px(ctx, '#cfd6ea', x + 20, y + 8, 1, 1)
    px(ctx, '#cfd6ea', x + 7, y + 17, 1, 1)
  }
  px(ctx, '#cfd6ea', x + 22, y + 20, 1, 1)
  // caixilho em cruz
  px(ctx, '#120e17', x + 13, y, 2, 29)
  px(ctx, '#120e17', x, y + 15, w, 2)
  // peitoril
  px(ctx, P.panelHi, x - 3, y + 29, w + 6, 2)
  px(ctx, P.panelDark, x - 3, y + 31, w + 6, 1)
}

function drawRug(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const cut = 4
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x + cut, y)
  ctx.lineTo(x + w - cut, y)
  ctx.lineTo(x + w, y + cut)
  ctx.lineTo(x + w, y + h - cut)
  ctx.lineTo(x + w - cut, y + h)
  ctx.lineTo(x + cut, y + h)
  ctx.lineTo(x, y + h - cut)
  ctx.lineTo(x, y + cut)
  ctx.closePath()
  ctx.clip()
  px(ctx, P.rugBorder, x, y, w, h)
  px(ctx, P.rugDark, x + 2, y + 2, w - 4, h - 4)
  px(ctx, P.rug, x + 4, y + 4, w - 8, h - 8)
  px(ctx, P.rugBorder, x + 6, y + 6, w - 12, 1)
  px(ctx, P.rugBorder, x + 6, y + h - 7, w - 12, 1)
  px(ctx, P.rugBorder, x + 6, y + 6, 1, h - 12)
  px(ctx, P.rugBorder, x + w - 7, y + 6, 1, h - 12)
  // losangos
  for (let i = 0; i < 6; i++) {
    const cx = x + 18 + i * 19
    for (const cy of [y + 14, y + h - 15]) {
      px(ctx, P.rugPat, cx - 1, cy, 3, 1)
      px(ctx, P.rugPat, cx, cy - 1, 1, 3)
    }
  }
  // franja
  ctx.restore()
  for (let fx = x + 3; fx < x + w - 3; fx += 3) {
    px(ctx, '#8a7240', fx, y - 2, 1, 2)
    px(ctx, '#8a7240', fx, y + h, 1, 2)
  }
}

function drawPaper(ctx: Ctx, x: number, y: number, w: number, h: number) {
  px(ctx, P.paper, x, y, w, h)
  px(ctx, '#e0d6b6', x, y, w, 1)
  px(ctx, '#8f8466', x + 1, y + 2, w - 3, 1)
  if (h > 4) px(ctx, '#8f8466', x + 1, y + 3, w - 4, 1)
}

// ── Os objetos (cada um no seu canvas, pro contorno de destaque) ──

/** Runas dos 7 ganchos (3×3). */
export const RUNES: number[][] = [
  [0, 1, 0, 1, 1, 1, 0, 1, 0],
  [1, 0, 1, 0, 1, 0, 1, 0, 1],
  [1, 1, 1, 0, 1, 0, 0, 1, 0],
  [1, 0, 0, 1, 1, 0, 1, 1, 1],
  [0, 1, 1, 0, 1, 0, 1, 1, 0],
  [1, 1, 1, 1, 0, 1, 1, 1, 1],
  [0, 1, 0, 1, 0, 1, 1, 0, 1],
]

/** Alturas das 7 velas do castiçal (em pixels). */
export const CANDLE_HEIGHTS = [10, 6, 13, 8, 15, 7, 11]
/** Onde fica a ponta de cada vela, no canvas do castiçal (pra desenhar a chama por cima). */
export function candleTip(i: number): [number, number] {
  return [7 + i * 7, 24 - CANDLE_HEIGHTS[i] - 1]
}

export function spriteCastical(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(56, 42)
  // suportes na parede
  for (const bx of [6, 48]) {
    px(ctx, P.ironDark, bx, 17, 3, 9)
    px(ctx, P.ironHi, bx, 17, 1, 9)
    px(ctx, P.iron, bx - 1, 16, 5, 2)
  }
  // barra de ferro
  px(ctx, P.ironDark, 3, 25, 50, 3)
  px(ctx, P.iron, 3, 24, 50, 2)
  px(ctx, P.ironHi, 3, 24, 50, 1)
  px(ctx, P.iron, 1, 23, 3, 4)
  px(ctx, P.iron, 52, 23, 3, 4)
  // velas
  for (let i = 0; i < 7; i++) {
    const cx = 7 + i * 7
    px(ctx, P.ironDark, cx - 3, 23, 6, 2)
    px(ctx, P.ironHi, cx - 3, 22, 6, 1)
    const h = CANDLE_HEIGHTS[i]
    px(ctx, P.wax, cx - 1, 22 - h, 3, h)
    px(ctx, P.waxHi, cx - 1, 22 - h, 1, h)
    px(ctx, P.waxLo, cx + 1, 22 - h, 1, h)
    px(ctx, P.waxHi, cx - 1, 22 - h, 3, 1)
    px(ctx, P.wick, cx, 22 - h - 1, 1, 1)
    // cera escorrida
    if (i % 2 === 0) px(ctx, P.waxHi, cx - 2, 22 - h + 2, 1, 2)
  }
  // ganchos com runas
  for (let i = 0; i < 7; i++) {
    const cx = 7 + i * 7
    px(ctx, '#2e2936', cx - 3, 31, 6, 6)
    px(ctx, '#3c3646', cx - 3, 31, 6, 1)
    const r = RUNES[i]
    for (let k = 0; k < 9; k++) if (r[k]) px(ctx, P.rune, cx - 1 + (k % 3), 32 + Math.floor(k / 3), 1, 1)
    px(ctx, P.ironHi, cx, 37, 1, 2)
    px(ctx, P.ironHi, cx + 1, 39, 1, 1)
    px(ctx, P.iron, cx, 40, 1, 1)
  }
  return c
}

export function spriteRetrato(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(44, 68)
  // cavalete
  for (let y = 10; y < 68; y++) {
    const t = (y - 10) / 58
    px(ctx, P.wood, 8 - Math.round(t * 6), y, 2, 1)
    px(ctx, P.wood, 34 + Math.round(t * 6), y, 2, 1)
  }
  for (let y = 4; y < 66; y++) px(ctx, P.woodDark, 21, y, 2, 1)
  px(ctx, P.woodHi, 3, 50, 38, 2)
  px(ctx, P.woodDark, 3, 52, 38, 1)
  // moldura dourada
  px(ctx, P.goldLo, 3, 1, 38, 47)
  px(ctx, P.gold, 4, 2, 36, 45)
  px(ctx, P.goldHi, 4, 2, 36, 1)
  px(ctx, P.goldHi, 4, 2, 1, 45)
  px(ctx, P.goldLo, 39, 2, 1, 45)
  px(ctx, P.goldLo, 4, 46, 36, 1)
  px(ctx, P.goldLo, 7, 5, 30, 39)
  for (const [x, y] of [[4, 2], [37, 2], [4, 44], [37, 44]]) { px(ctx, P.goldHi, x, y, 3, 3); px(ctx, P.goldLo, x + 1, y + 1, 1, 1) }
  // tela escura
  px(ctx, P.canvas, 8, 6, 28, 37)
  // o bibliotecário, quase sumido
  px(ctx, P.canvasHi, 18, 11, 8, 9)
  px(ctx, P.canvasHi, 17, 13, 10, 5)
  px(ctx, P.canvasHi, 13, 22, 18, 21)
  px(ctx, P.canvasHi, 15, 20, 14, 3)
  px(ctx, '#3a2f29', 19, 14, 2, 1)
  px(ctx, '#3a2f29', 23, 14, 2, 1)
  // rachaduras
  const cracks: [number, number][] = [[10, 8], [11, 9], [12, 10], [12, 11], [13, 12], [33, 30], [32, 31], [32, 32], [31, 33], [30, 34], [30, 35], [24, 38], [25, 39], [26, 40], [27, 40]]
  for (const [x, y] of cracks) px(ctx, P.crack, x, y, 1, 1)
  // verniz brilhando
  px(ctx, 'rgba(255,255,255,0.06)', 9, 7, 8, 1)
  return c
}

export const BOOK_COLORS = ['#8e2f3a', '#3f6b4a', '#354f86', '#a9792e', '#5c3b72', '#2f5f62', '#7a3d22', '#6b6a2a', '#8a4a6e', '#3a3a78', '#9a5a2a', '#4a6a3a']

export function spriteEstante(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(46, 76)
  // corpo
  px(ctx, P.woodDark, 0, 3, 46, 73)
  px(ctx, P.wood, 1, 4, 44, 71)
  px(ctx, '#1d140c', 4, 7, 38, 61)
  // coroa
  px(ctx, P.woodHi, 0, 0, 46, 3)
  px(ctx, '#8a6240', 0, 0, 46, 1)
  px(ctx, P.woodDark, 2, 3, 42, 1)
  // prateleiras e livros (3 × 4)
  const shelves = [27, 47, 67]
  const rnd = seeded(12)
  let b = 0
  for (const sy of shelves) {
    px(ctx, P.woodHi, 3, sy, 40, 2)
    px(ctx, P.woodDark, 3, sy + 2, 40, 1)
    let x = 6
    for (let k = 0; k < 4; k++) {
      const bw = 7 + Math.floor(rnd() * 3)
      const bh = 12 + Math.floor(rnd() * 6)
      const col = BOOK_COLORS[b % BOOK_COLORS.length]
      px(ctx, col, x, sy - bh, bw, bh)
      px(ctx, 'rgba(255,255,255,0.14)', x, sy - bh, 1, bh)
      px(ctx, 'rgba(0,0,0,0.3)', x + bw - 1, sy - bh, 1, bh)
      px(ctx, P.goldHi, x + 1, sy - bh + 2, bw - 2, 1)
      px(ctx, P.goldLo, x + 1, sy - 4, bw - 2, 1)
      px(ctx, P.gold, x + Math.floor(bw / 2), sy - bh + 5, 1, 2)
      x += bw + 1
      b++
    }
  }
  // base
  px(ctx, P.woodHi, 0, 68, 46, 2)
  px(ctx, P.woodDark, 0, 74, 46, 2)
  return c
}

export function spriteMesa(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(68, 42)
  // mesa
  px(ctx, P.woodDark, 2, 16, 64, 22)
  px(ctx, P.woodTop, 2, 14, 64, 8)
  px(ctx, '#82593b', 2, 14, 64, 1)
  px(ctx, P.wood, 2, 22, 64, 14)
  px(ctx, P.woodDark, 6, 25, 24, 8)
  px(ctx, P.woodDark, 38, 25, 24, 8)
  px(ctx, P.wood, 7, 26, 22, 6)
  px(ctx, P.wood, 39, 26, 22, 6)
  px(ctx, P.goldHi, 17, 28, 2, 2)
  px(ctx, P.goldHi, 49, 28, 2, 2)
  px(ctx, P.woodDark, 2, 36, 4, 6)
  px(ctx, P.woodDark, 62, 36, 4, 6)
  // papéis e pena
  px(ctx, P.paper, 6, 16, 10, 5)
  px(ctx, '#8f8466', 7, 18, 7, 1)
  px(ctx, '#ece4cc', 52, 17, 2, 1)
  px(ctx, '#ece4cc', 54, 16, 2, 1)
  px(ctx, '#ece4cc', 56, 15, 3, 1)
  px(ctx, P.ink, 50, 18, 3, 2)
  // astrolábio: suporte, aro de bronze, ponteiro, 4 encaixes
  px(ctx, P.goldLo, 31, 12, 6, 4)
  px(ctx, P.gold, 32, 11, 4, 2)
  const cx = 34
  const cy = 6
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2
    const x = Math.round(cx + Math.cos(t) * 6)
    const y = Math.round(cy + Math.sin(t) * 5)
    px(ctx, t > Math.PI * 1.1 && t < Math.PI * 1.9 ? P.goldHi : P.gold, x, y, 1, 1)
  }
  px(ctx, '#2a2012', cx - 4, cy - 3, 9, 7)
  px(ctx, '#2a2012', cx - 5, cy - 2, 11, 5)
  px(ctx, P.goldLo, cx - 3, cy - 2, 7, 5)
  px(ctx, '#3a2c14', cx - 2, cy - 1, 5, 3)
  px(ctx, P.goldHi, cx, cy - 4, 1, 4)
  for (const [dx, dy] of [[0, -6], [7, 0], [0, 5], [-7, 0]]) px(ctx, '#1a1208', cx + dx, cy + dy, 1, 1)
  return c
}

export function spritePedestal(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(36, 44)
  // coluna de pedra
  px(ctx, P.stoneLo, 3, 36, 30, 8)
  px(ctx, P.stone, 3, 35, 30, 6)
  px(ctx, P.stoneHi, 3, 35, 30, 1)
  px(ctx, P.stone, 9, 21, 18, 15)
  px(ctx, P.stoneHi, 9, 21, 3, 15)
  px(ctx, P.stoneLo, 24, 21, 3, 15)
  px(ctx, P.stoneLo, 14, 24, 1, 9)
  px(ctx, P.stoneLo, 5, 18, 26, 4)
  px(ctx, P.stone, 5, 17, 26, 3)
  px(ctx, P.stoneHi, 5, 17, 26, 1)
  // o livro
  px(ctx, '#4a1e16', 2, 5, 32, 12)
  px(ctx, P.leather, 3, 4, 30, 10)
  px(ctx, P.leatherHi, 3, 4, 30, 1)
  px(ctx, P.pages, 4, 13, 28, 3)
  px(ctx, '#b8ad8c', 4, 15, 28, 1)
  // diagrama na capa
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2
    px(ctx, '#a07e36', Math.round(18 + Math.cos(t) * 4), Math.round(8.5 + Math.sin(t) * 3), 1, 1)
  }
  px(ctx, '#a07e36', 18, 6, 1, 6)
  px(ctx, '#a07e36', 14, 8, 9, 1)
  // correntes em X e pendendo
  for (let i = 0; i < 12; i++) {
    px(ctx, i % 2 ? P.chainLo : P.chain, 4 + i * 2, 4 + Math.round(i * 0.9), 2, 1)
    px(ctx, i % 2 ? P.chainLo : P.chain, 31 - i * 2, 4 + Math.round(i * 0.9), 2, 1)
  }
  for (const x of [3, 32]) for (let y = 15; y < 30; y++) px(ctx, y % 2 ? P.chainLo : P.chain, x, y, 1, 1)
  for (const x of [9, 26]) for (let y = 16; y < 24; y++) px(ctx, y % 2 ? P.chainLo : P.chain, x, y, 1, 1)
  // cadeados
  for (const [x, y] of [[2, 29], [31, 29], [8, 23], [25, 23]]) {
    px(ctx, P.goldLo, x, y, 3, 3)
    px(ctx, P.goldHi, x, y, 2, 1)
    px(ctx, P.goldLo, x + 1, y - 1, 1, 1)
  }
  return c
}

/** Castiçal de chão (decoração com luz). */
export function spriteFloorCandle(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(9, 16)
  px(ctx, P.ironDark, 1, 14, 7, 2)
  px(ctx, P.iron, 4, 7, 1, 8)
  px(ctx, P.ironHi, 2, 6, 5, 1)
  px(ctx, P.wax, 3, 1, 3, 5)
  px(ctx, P.waxHi, 3, 1, 1, 5)
  px(ctx, P.waxLo, 5, 1, 1, 5)
  px(ctx, P.wick, 4, 0, 1, 1)
  return c
}

/** Contorno de destaque (só o anel de fora), do tamanho do sprite + 1px de cada lado. */
export function outlineOf(sprite: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const w = sprite.width
  const h = sprite.height
  const src = sprite.getContext('2d')!.getImageData(0, 0, w, h).data
  const [c, ctx] = makeCanvas(w + 2, h + 2)
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 40
  ctx.fillStyle = color
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (solid(x, y)) continue
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) ctx.fillRect(x + 1, y + 1, 1, 1)
    }
  }
  return c
}

/** Uma chama tremendo (desenhada a cada quadro). */
export function drawFlame(ctx: Ctx, x: number, y: number, t: number, seed: number) {
  const f = Math.sin(t * 13 + seed * 2.1) + Math.sin(t * 7.3 + seed)
  const lean = f > 0.9 ? 1 : f < -0.9 ? -1 : 0
  px(ctx, '#ff8a2a', x - 1, y - 2, 3, 2)
  px(ctx, '#ffd36b', x, y - 3, 1, 3)
  px(ctx, '#fff4c4', x, y - 1, 1, 1)
  px(ctx, '#ffb347', x + lean, y - 4, 1, 1)
}

// ── Os bonecos ──────────────────────────────────────────
//
// 12×17, de capuz. Metade esquerda espelhada (frente e costas); o perfil
// é desenhado inteiro e espelhado pra esquerda. Letras:
//   o contorno · c capa · C sombra da capa · h brilho · k dentro do capuz
//   s pele · S pele sombra · e olho · g fecho dourado · b bota

const FRONT_HALF = ['....oo', '...ohc', '..ohcc', '.ohckk', '.ockss', '.ockes', '.ocCsS', 'occCCc', 'occcgc', 'occccc', 'oCcccc', 'oCcccc', '.oCccc', '.oCCcc', '..oooo']
const BACK_HALF = ['....oo', '...ohc', '..ohcc', '.ohccc', '.occcc', '.occcc', '.ocCcc', 'occCCc', 'occccc', 'occccc', 'oCcccc', 'oCcccc', '.oCccc', '.oCCcc', '..oooo']
const SIDE = [
  '...oooo.....',
  '..ohccco....',
  '.ohccccco...',
  '.ohcccckko..',
  '.occcckssso.',
  '.occcckseso.',
  '.oCccckSSo..',
  'oCcccccCco..',
  'oCcccccgco..',
  'oCccccccco..',
  'oCccccccCo..',
  '.oCcccccCo..',
  '.oCcccccCo..',
  '.oCCcccCCo..',
  '..oooooooo..',
]
const LEGS_FRONT = [['...bb..bb...', '...oo..oo...'], ['...bb..bb...', '...oo.......'], ['...bb..bb...', '.......oo...']]
const LEGS_SIDE = [['...bb.bb....', '...oo.oo....'], ['..bb...bb...', '..oo...oo...'], ['....bbb.....', '....ooo.....']]

const mirror = (half: string) => half + [...half].reverse().join('')
const FRONT = FRONT_HALF.map(mirror)
const BACK = BACK_HALF.map(mirror)

export interface Cloak { c: string; C: string; h: string; g: string }
export const CLOAKS: Cloak[] = [
  { c: '#3b5aa8', C: '#28407e', h: '#6585d6', g: '#e2bd62' },
  { c: '#a8323a', C: '#781f27', h: '#d55a62', g: '#e2bd62' },
]

function colorOf(ch: string, k: Cloak): string | null {
  switch (ch) {
    case 'o': return '#160f1c'
    case 'c': return k.c
    case 'C': return k.C
    case 'h': return k.h
    case 'k': return '#120c16'
    case 's': return '#e8c4a0'
    case 'S': return '#c49a78'
    case 'e': return '#160f1c'
    case 'g': return k.g
    case 'b': return '#2a1e18'
    default: return null
  }
}

/** Desenha um boneco com os pés em (x, y). frame: 0 parado, 1 e 2 andando. */
export function drawActor(ctx: Ctx, x: number, y: number, dir: Dir, frame: number, cloak: Cloak) {
  const body = dir === 'down' ? FRONT : dir === 'up' ? BACK : SIDE
  const legs = (dir === 'down' || dir === 'up' ? LEGS_FRONT : LEGS_SIDE)[frame]
  const flip = dir === 'left'
  const left = Math.round(x) - 6
  const top = Math.round(y) - 17 - (frame ? 1 : 0)
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.38)'
  ctx.fillRect(Math.round(x) - 5, Math.round(y) - 1, 10, 2)
  ctx.fillRect(Math.round(x) - 4, Math.round(y) - 2, 8, 4)
  const rows = [...body, ...legs]
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    const legRow = r >= body.length
    for (let i = 0; i < 12; i++) {
      const ch = row[flip ? 11 - i : i]
      const col = colorOf(ch, cloak)
      if (!col) continue
      ctx.fillStyle = col
      ctx.fillRect(left + i, top + r + (legRow && frame ? 1 : 0), 1, 1)
    }
  }
}
