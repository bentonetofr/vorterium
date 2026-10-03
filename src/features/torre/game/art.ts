import { H, makeCanvas, P, px, seeded, W, type Ctx } from '../../livro/game/art'

// ────────────────────────────────────────────────────────
// A arte da Torre do Observatório, desenhada pixel a pixel em código (nada
// de imagem), no mesmo traço do Livro Bloqueado (paleta, px, bonecos e
// contorno vêm de lá). São dois andares com a MESMA planta, um em cima do
// outro — por isso a grade fica no mesmo lugar nos dois:
//   • Cima  (o Observatório): a fresta da cúpula com o céu, o telescópio,
//     o mapa estelar, a haste do pêndulo e a face de cima do Astrário;
//   • Baixo (a Casa das Máquinas): a fresta do feixe, os 4 espelhos, a
//     manivela com as engrenagens, o peso do pêndulo e a face de baixo.
// ────────────────────────────────────────────────────────

/** A grade de ferro entre os andares (mesmo lugar nos dois). */
export const GRATE = { x: 148, y: 100, w: 88, h: 48 }
/** Passo das barras da grade. */
export const BAR = 6

/** Onde o pêndulo cruza a grade (o centro dela). */
export const PENDULUM = { x: 192, y: 124 }

/** A fresta da cúpula (cima) e a fresta do feixe (baixo). */
export const DOME_SLIT = { x: 164, y: 2, w: 56, h: 52 }
export const BEAM_SLIT = { x: 38, y: 20, w: 6, h: 22 }

/** As 3 estrelas que brilham desde o começo (dentro da fresta). */
export const BRIGHT_STARS: [number, number][] = [[176, 14], [204, 24], [186, 38]]

const T = {
  stoneA:  '#38323f',
  stoneB:  '#3d3745',
  stoneHi: '#48414f',
  stoneGap:'#26212c',
  slab:    '#2e2933',
  slabHi:  '#3a3440',
  sky:     '#0c1430',
  sky2:    '#16214a',
  bronze:  '#9a6a2c',
  bronzeHi:'#d29a48',
  bronzeLo:'#5e3d16',
  glass:   '#aeb9d0',
  glassHi: '#e6ecf8',
  glassLo: '#6c7896',
  mapSea:  '#1a2446',
  mapLine: '#5b6fa8',
}

// ── Pedaços comuns ──────────────────────────────────────

function sideWalls(ctx: Ctx) {
  px(ctx, P.side, 0, 0, 16, H)
  px(ctx, P.side, 368, 0, 16, H)
  px(ctx, P.sideEdge, 15, 12, 1, 192)
  px(ctx, P.sideEdge, 368, 12, 1, 192)
  px(ctx, P.ceil, 0, 204, W, 12)
  px(ctx, P.ceilEdge, 16, 204, 352, 1)
}

/** Lajes de pedra (o chão). */
function stoneFloor(ctx: Ctx, rnd: () => number, a: string, b: string, hi: string, gap: string) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(16, 60, 352, 144)
  ctx.clip()
  for (let y = 60, row = 0; y < 204; y += 12, row++) {
    let x = 16 - (row % 2 ? 10 : 0)
    while (x < 368) {
      const len = 18 + Math.floor(rnd() * 14)
      px(ctx, rnd() < 0.5 ? a : b, x, y, len, 12)
      px(ctx, hi, x + 1, y, len - 2, 1)
      px(ctx, gap, x + len - 1, y, 1, 12)
      if (rnd() < 0.3) px(ctx, gap, x + 4 + Math.floor(rnd() * (len - 8)), y + 4 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 3), 1)
      x += len
    }
    px(ctx, gap, 16, y + 11, 352, 1)
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(16, 60, 352, 3)
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(16, 63, 352, 3)
  ctx.restore()
}

/** Blocos de pedra grandes (parede norte de cima). */
function stoneWall(ctx: Ctx, rnd: () => number, y0: number, h: number) {
  px(ctx, '#29232f', 16, y0, 352, h)
  for (let row = 0, y = y0; y < y0 + h; y += 10, row++) {
    px(ctx, '#1b1720', 16, y + 9, 352, 1)
    for (let x = 16 - (row % 2 ? 12 : 0); x < 368; x += 24) {
      if (x + 23 >= 16) px(ctx, '#1b1720', Math.max(16, x + 23), y, 1, 9)
      px(ctx, '#332c3a', Math.max(16, x), y, Math.min(23, 368 - Math.max(16, x)), 1)
      if (rnd() < 0.3) px(ctx, '#1b1720', Math.max(17, x + 4 + Math.floor(rnd() * 12)), y + 3 + Math.floor(rnd() * 4), 3, 1)
    }
  }
}

function paper(ctx: Ctx, x: number, y: number, w: number, h: number) {
  px(ctx, P.paper, x, y, w, h)
  px(ctx, '#e0d6b6', x, y, w, 1)
  px(ctx, '#8f8466', x + 1, y + 2, w - 3, 1)
}

// ── Andar de cima: o Observatório ───────────────────────

export function drawUpperBackground(ctx: Ctx) {
  const rnd = seeded(31)
  px(ctx, P.void, 0, 0, W, H)
  stoneFloor(ctx, rnd, T.stoneA, T.stoneB, T.stoneHi, T.stoneGap)

  // Teto da cúpula com nervuras de bronze.
  px(ctx, P.ceil, 0, 0, W, 12)
  for (let x = 30; x < 368; x += 40) px(ctx, '#1d1824', x, 0, 2, 12)
  px(ctx, T.bronzeLo, 16, 11, 352, 1)
  stoneWall(ctx, rnd, 12, 34)
  // trilho de bronze por onde a cúpula gira
  px(ctx, T.bronzeLo, 16, 44, 352, 3)
  px(ctx, T.bronze, 16, 44, 352, 1)
  for (let x = 20; x < 368; x += 12) px(ctx, '#3a2810', x, 46, 2, 1)
  px(ctx, '#211b27', 16, 47, 352, 11)
  for (let x = 16; x < 368; x += 22) px(ctx, '#18141d', x, 47, 1, 11)
  px(ctx, P.base, 16, 58, 352, 2)

  // A fresta da cúpula: o céu.
  const s = DOME_SLIT
  px(ctx, '#0d0b12', s.x - 3, s.y + 2, s.w + 6, s.h + 2)
  px(ctx, '#0d0b12', s.x, s.y - 1, s.w, 3)
  px(ctx, T.sky, s.x, s.y + 2, s.w, s.h - 2)
  px(ctx, T.sky2, s.x, s.y + 2, s.w, 14)
  px(ctx, T.sky, s.x + 3, s.y, s.w - 6, 2)
  for (let i = 0; i < 70; i++) {
    const x = s.x + 1 + Math.floor(rnd() * (s.w - 2))
    const y = s.y + 2 + Math.floor(rnd() * (s.h - 4))
    px(ctx, rnd() < 0.25 ? '#3a4672' : '#26305a', x, y, 1, 1)   // estrelas apagadas
  }
  // batentes de bronze da fresta
  for (const bx of [s.x - 3, s.x + s.w]) {
    px(ctx, T.bronzeLo, bx, s.y + 2, 3, s.h)
    px(ctx, T.bronze, bx + 1, s.y + 2, 1, s.h)
  }
  px(ctx, T.bronzeLo, s.x - 3, s.y + s.h, s.w + 6, 2)

  sideWalls(ctx)

  // A grade (o chão de ferro entre os andares) — embaixo é escuro.
  const g = GRATE
  px(ctx, '#07060a', g.x, g.y, g.w, g.h)
  px(ctx, '#140d0a', g.x + 4, g.y + 4, g.w - 8, g.h - 8)
  for (let i = 0; i < 9; i++) px(ctx, 'rgba(120,70,30,0.10)', g.x + 8 + Math.floor(rnd() * (g.w - 20)), g.y + 8 + Math.floor(rnd() * (g.h - 16)), 6, 3)
  drawBars(ctx, g.x, g.y, g.w, g.h)

  // Papéis com cartas do céu espalhados.
  paper(ctx, 92, 150, 8, 5)
  paper(ctx, 102, 154, 7, 5)
  paper(ctx, 262, 166, 8, 5)
  px(ctx, '#5b6fa8', 94, 151, 1, 1)
  px(ctx, '#5b6fa8', 97, 152, 1, 1)
}

/** As barras de ferro da grade. */
export function drawBars(ctx: Ctx, x: number, y: number, w: number, h: number) {
  for (let bx = x; bx <= x + w; bx += BAR) {
    px(ctx, P.ironDark, bx, y, 2, h)
    px(ctx, P.iron, bx, y, 1, h)
  }
  for (let by = y; by <= y + h; by += BAR) {
    px(ctx, P.ironDark, x, by, w + 1, 2)
    px(ctx, P.ironHi, x, by, w + 1, 1)
  }
  // moldura
  px(ctx, P.ironDark, x - 3, y - 3, w + 7, 3)
  px(ctx, P.ironHi, x - 3, y - 3, w + 7, 1)
  px(ctx, P.ironDark, x - 3, y + h + 1, w + 7, 3)
  px(ctx, P.ironDark, x - 3, y - 3, 3, h + 7)
  px(ctx, P.ironDark, x + w + 1, y - 3, 3, h + 7)
  for (const [rx, ry] of [[x - 2, y - 2], [x + w + 2, y - 2], [x - 2, y + h + 2], [x + w + 2, y + h + 2]]) px(ctx, P.ironHi, rx, ry, 1, 1)
}

/** O pixel (x, y) é barra da grade? */
export function onBar(x: number, y: number) {
  return (x - GRATE.x) % BAR < 2 || (y - GRATE.y) % BAR < 2
}

export function spriteTelescopio(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(46, 64)
  // tripé de madeira
  for (const [x0, x1] of [[8, 16], [38, 28], [23, 23]] as const) {
    for (let y = 36; y < 62; y++) {
      const t = (y - 36) / 26
      const x = Math.round(x1 + (x0 - x1) * t)
      px(ctx, P.woodDark, x - 1, y, 3, 1)
      px(ctx, P.woodHi, x, y, 1, 1)
    }
  }
  px(ctx, P.ironDark, 19, 32, 9, 6)
  px(ctx, P.iron, 19, 32, 9, 2)
  // o tubo de bronze, apontado pra cima e pra esquerda (pra fresta)
  for (let i = 0; i < 34; i++) {
    const x = 36 - i
    const y = 34 - Math.round(i * 0.95)
    const r = i < 6 ? 3 : i > 28 ? 4 : 3
    px(ctx, T.bronzeLo, x - r + 1, y - 1, r * 2, 3)
    px(ctx, T.bronze, x - r + 1, y - 1, r * 2, 2)
    px(ctx, T.bronzeHi, x - r + 2, y - 1, r * 2 - 3, 1)
  }
  // anéis (foco e lente)
  for (const i of [8, 20, 31]) {
    const x = 36 - i
    const y = 34 - Math.round(i * 0.95)
    px(ctx, T.bronzeLo, x - 4, y - 2, 9, 1)
    px(ctx, T.bronzeHi, x - 4, y - 3, 9, 1)
  }
  // a lente na boca do tubo
  px(ctx, T.glassLo, 2, 1, 5, 3)
  px(ctx, T.glassHi, 3, 1, 2, 1)
  // ocular
  px(ctx, P.ironDark, 38, 34, 5, 4)
  px(ctx, P.ironHi, 38, 34, 4, 1)
  return c
}

export function spriteMapa(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(44, 66)
  // cavalete
  px(ctx, P.woodDark, 6, 30, 3, 36)
  px(ctx, P.woodDark, 35, 30, 3, 36)
  px(ctx, P.wood, 6, 30, 1, 36)
  px(ctx, P.wood, 35, 30, 1, 36)
  px(ctx, P.woodDark, 4, 52, 36, 3)
  px(ctx, P.woodHi, 4, 52, 36, 1)
  // o disco do mapa (moldura de bronze)
  const cx = 22
  const cy = 24
  for (let y = -21; y <= 21; y++) {
    for (let x = -21; x <= 21; x++) {
      const d = Math.hypot(x, y)
      if (d > 21) continue
      const col = d > 19 ? T.bronzeLo : d > 17.5 ? (y < 0 ? T.bronzeHi : T.bronze) : T.mapSea
      px(ctx, col, cx + x, cy + y, 1, 1)
    }
  }
  // constelações desenhadas (linhas finas)
  const rnd = seeded(5)
  const pts: [number, number][] = []
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2
    const r = 4 + rnd() * 11
    pts.push([Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)])
  }
  ctx.strokeStyle = T.mapLine
  ctx.lineWidth = 1
  for (let i = 0; i < pts.length - 1; i += 2) {
    const [a, b] = [pts[i], pts[i + 1]]
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
    for (let k = 0; k <= n; k++) px(ctx, '#33427a', Math.round(a[0] + ((b[0] - a[0]) * k) / n), Math.round(a[1] + ((b[1] - a[1]) * k) / n), 1, 1)
  }
  for (const [x, y] of pts) px(ctx, '#c9d2ee', x, y, 1, 1)
  // os 4 buracos vazios
  for (const [hx, hy] of MAP_HOLES) {
    px(ctx, '#05050a', cx + hx - 1, cy + hy - 1, 3, 3)
    px(ctx, T.bronzeLo, cx + hx - 1, cy + hy + 2, 3, 1)
  }
  // marcas na borda
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2
    px(ctx, '#3a2810', Math.round(cx + Math.cos(a) * 19.5), Math.round(cy + Math.sin(a) * 19.5), 1, 1)
  }
  return c
}

/** Onde ficam os 4 buracos do mapa (em relação ao centro do disco). */
export const MAP_HOLES: [number, number][] = [[-9, -7], [8, -10], [-6, 9], [10, 6]]

/** A haste do pêndulo no andar de cima: o suporte no teto e o colar na grade. */
export function spritePenduloCima(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(28, 132)
  // suporte no teto
  px(ctx, T.bronzeLo, 6, 0, 16, 5)
  px(ctx, T.bronze, 6, 0, 16, 3)
  px(ctx, T.bronzeHi, 7, 0, 14, 1)
  px(ctx, P.ironDark, 12, 5, 4, 3)
  // colar de bronze na grade
  for (let y = -5; y <= 5; y++) {
    for (let x = -13; x <= 13; x++) {
      const e = (x * x) / 169 + (y * y) / 25
      if (e > 1) continue
      px(ctx, e > 0.55 ? (y < 0 ? T.bronzeHi : T.bronze) : e > 0.3 ? T.bronzeLo : '#07060a', 14 + x, 124 + y, 1, 1)
    }
  }
  return c
}

/** O Astrário: uma coluna que atravessa a grade, com um disco em cada andar. */
export function spriteAstrario(floor: 'cima' | 'baixo'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(34, 38)
  // coluna
  px(ctx, P.stoneLo, 3, 31, 28, 7)
  px(ctx, P.stone, 3, 30, 28, 5)
  px(ctx, P.stoneHi, 3, 30, 28, 1)
  px(ctx, P.stone, 10, 18, 14, 13)
  px(ctx, P.stoneHi, 10, 18, 2, 13)
  px(ctx, P.stoneLo, 22, 18, 2, 13)
  // o disco
  const cx = 17
  const cy = 10
  for (let y = -9; y <= 9; y++) {
    for (let x = -15; x <= 15; x++) {
      const e = (x * x) / 225 + (y * y) / 81
      if (e > 1) continue
      px(ctx, e > 0.78 ? (y < 0 ? T.bronzeHi : T.bronzeLo) : e > 0.62 ? T.bronze : '#3a2810', cx + x, cy + y, 1, 1)
    }
  }
  // o diagrama: 6 pontos em roda (os objetos) e o centro
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 - Math.PI / 2
    px(ctx, T.bronze, Math.round(cx + Math.cos(a) * 8) - 1, Math.round(cy + Math.sin(a) * 4.6), 2, 1)
  }
  if (floor === 'cima') {
    px(ctx, T.bronzeHi, cx, cy - 2, 1, 5)       // estrela no centro
    px(ctx, T.bronzeHi, cx - 2, cy, 5, 1)
  } else {
    px(ctx, T.bronzeHi, cx - 2, cy - 1, 5, 3)   // engrenagem no centro
    px(ctx, '#3a2810', cx, cy, 1, 1)
    for (const [dx, dy] of [[0, -2], [0, 2], [-3, 0], [3, 0]]) px(ctx, T.bronze, cx + dx, cy + dy, 1, 1)
  }
  return c
}

// ── Andar de baixo: a Casa das Máquinas ─────────────────

export function drawLowerBackground(ctx: Ctx) {
  const rnd = seeded(53)
  px(ctx, P.void, 0, 0, W, H)
  stoneFloor(ctx, rnd, T.slab, '#322c37', T.slabHi, '#201b25')

  // Teto baixo com vigas e parede de tijolos.
  px(ctx, P.ceil, 0, 0, W, 12)
  px(ctx, P.ceilEdge, 16, 11, 352, 1)
  px(ctx, P.brick, 16, 12, 352, 40)
  for (let row = 0; row < 5; row++) {
    const y = 12 + row * 8
    const off = row % 2 ? 8 : 0
    px(ctx, P.mortar, 16, y + 7, 352, 1)
    for (let x = 16 - off; x < 368; x += 16) {
      if (x + 15 >= 16) px(ctx, P.mortar, Math.max(16, x + 15), y, 1, 7)
      px(ctx, P.brickHi, Math.max(16, x), y, Math.min(15, 368 - Math.max(16, x)), 1)
      if (rnd() < 0.25) px(ctx, P.mortar, Math.max(17, x + 3 + Math.floor(rnd() * 8)), y + 2 + Math.floor(rnd() * 3), 2, 1)
    }
  }
  // cano de ferro correndo pela parede
  px(ctx, P.ironDark, 56, 48, 240, 4)
  px(ctx, P.iron, 56, 48, 240, 2)
  px(ctx, P.ironHi, 56, 48, 240, 1)
  for (const x of [80, 150, 230]) { px(ctx, P.ironDark, x, 46, 4, 8); px(ctx, P.ironHi, x, 46, 4, 1) }
  px(ctx, '#1d1610', 16, 52, 352, 6)
  px(ctx, P.base, 16, 58, 352, 2)

  // A fresta do feixe (de onde entra a luz).
  const b = BEAM_SLIT
  px(ctx, '#0d0b12', b.x - 2, b.y - 2, b.w + 4, b.h + 4)
  px(ctx, '#ffe7a3', b.x, b.y, b.w, b.h)
  px(ctx, '#fff6d8', b.x + 2, b.y + 2, 2, b.h - 4)

  // Lampiões na parede.
  for (const lx of [128, 252]) {
    px(ctx, P.ironDark, lx - 1, 22, 9, 2)
    px(ctx, P.ironDark, lx, 24, 7, 10)
    px(ctx, '#ffb347', lx + 1, 25, 5, 8)
    px(ctx, '#ffe7a3', lx + 2, 27, 3, 4)
    px(ctx, P.ironDark, lx + 3, 24, 1, 10)
    px(ctx, P.ironDark, lx, 29, 7, 1)
  }

  sideWalls(ctx)

  // Debaixo da grade (o teto): no chão, a marca de onde cai a luz de cima.
  const g = GRATE
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(g.x - 2, g.y - 2, g.w + 4, g.h + 4)

  // Óleo e ferramentas.
  px(ctx, '#15110d', 250, 170, 10, 3)
  px(ctx, '#15110d', 252, 169, 6, 1)
  px(ctx, P.ironHi, 108, 176, 9, 1)
  px(ctx, P.iron, 108, 177, 3, 2)
}

/** Os 4 espelhos em hastes de ferro. */
export function spriteEspelhos(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(88, 46)
  px(ctx, P.ironDark, 2, 40, 84, 5)
  px(ctx, P.iron, 2, 40, 84, 2)
  px(ctx, P.ironHi, 2, 40, 84, 1)
  for (let i = 0; i < 4; i++) {
    const [mx, my] = MIRRORS[i]
    // haste
    px(ctx, P.ironDark, mx, my + 10, 2, 40 - (my + 10))
    px(ctx, P.ironHi, mx, my + 10, 1, 40 - (my + 10))
    // moldura e vidro
    px(ctx, P.ironDark, mx - 5, my - 1, 12, 12)
    px(ctx, T.glassLo, mx - 4, my, 10, 10)
    px(ctx, T.glass, mx - 3, my + 1, 8, 8)
    px(ctx, T.glassHi, mx - 3, my + 1, 3, 1)
    px(ctx, T.glassHi, mx - 3, my + 2, 1, 2)
    // parafuso do eixo
    px(ctx, T.bronzeHi, mx, my + 10, 2, 2)
  }
  return c
}

/** Onde fica cada espelho, no canvas dos espelhos (topo esquerdo do vidro + 4). */
export const MIRRORS: [number, number][] = [[12, 6], [32, 16], [54, 4], [74, 14]]

/** A manivela e as engrenagens que sobem pela parede até a cúpula. */
export function spriteManivela(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 112)
  // eixo vertical
  px(ctx, P.ironDark, 30, 0, 5, 90)
  px(ctx, P.iron, 30, 0, 3, 90)
  px(ctx, P.ironHi, 30, 0, 1, 90)
  // engrenagens
  for (const [gx, gy, r] of [[32, 14, 11], [18, 38, 8], [44, 56, 9], [32, 82, 7]] as const) gear(ctx, gx, gy, r)
  // base e a roda da manivela
  px(ctx, P.ironDark, 12, 100, 40, 12)
  px(ctx, P.iron, 12, 100, 40, 3)
  px(ctx, P.ironHi, 12, 100, 40, 1)
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2
    px(ctx, a % 2 ? P.iron : P.ironHi, Math.round(32 + Math.cos(t) * 12), Math.round(96 + Math.sin(t) * 6), 1, 1)
  }
  for (let k = 0; k < 4; k++) {
    const t = (k / 4) * Math.PI * 2 + 0.4
    for (let r = 2; r < 12; r++) px(ctx, P.ironDark, Math.round(32 + Math.cos(t) * r), Math.round(96 + Math.sin(t) * r * 0.5), 1, 1)
  }
  // pegador
  px(ctx, P.woodDark, 43, 88, 4, 9)
  px(ctx, P.woodHi, 43, 88, 1, 9)
  return c
}

function gear(ctx: Ctx, cx: number, cy: number, r: number) {
  for (let y = -r - 2; y <= r + 2; y++) {
    for (let x = -r - 2; x <= r + 2; x++) {
      const d = Math.hypot(x, y)
      const a = Math.atan2(y, x)
      const tooth = Math.cos(a * 8) > 0.35
      if (d > r + (tooth ? 2 : 0)) continue
      const col = d < 2 ? P.ironDark : d < r * 0.45 ? T.bronzeLo : d > r - 1 ? (y < 0 ? T.bronzeHi : T.bronzeLo) : T.bronze
      px(ctx, col, cx + x, cy + y, 1, 1)
    }
  }
}

/** O mostrador de bronze no chão, por onde o peso do pêndulo passa. */
export function spritePenduloBaixo(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(56, 18)
  for (let y = -8; y <= 8; y++) {
    for (let x = -27; x <= 27; x++) {
      const e = (x * x) / 729 + (y * y) / 64
      if (e > 1) continue
      px(ctx, e > 0.8 ? (y < 0 ? T.bronzeHi : T.bronzeLo) : e > 0.68 ? T.bronze : '#1d1714', 28 + x, 9 + y, 1, 1)
    }
  }
  for (let k = -4; k <= 4; k++) px(ctx, T.bronze, 28 + k * 5, 9, 1, k % 2 ? 1 : 2)
  return c
}

/** O peso do pêndulo, com o fio subindo até a grade (x = deslocamento do balanço). */
export function drawBob(ctx: Ctx, x: number, top: number, bottom: number) {
  const cx = Math.round(PENDULUM.x + x)
  // fio: do teto (centro da grade) até o peso
  const n = bottom - top
  for (let k = 0; k <= n; k++) px(ctx, '#8a8594', Math.round(PENDULUM.x + (x * k) / n), top + k, 1, 1)
  px(ctx, T.bronzeLo, cx - 4, bottom, 9, 9)
  px(ctx, T.bronze, cx - 4, bottom, 8, 8)
  px(ctx, T.bronzeHi, cx - 3, bottom + 1, 3, 2)
  px(ctx, T.bronzeLo, cx - 1, bottom + 8, 3, 2)
}

/** A haste vista de cima, cruzando o colar (x = deslocamento do balanço). */
export function drawRod(ctx: Ctx, x0: number, y0: number, x: number) {
  const top = y0 + 8
  const bottom = PENDULUM.y
  for (let y = top; y <= bottom; y++) {
    const k = (y - top) / (bottom - top)
    px(ctx, '#8a8594', Math.round(x0 + x * k), y, 1, 1)
    px(ctx, '#55505f', Math.round(x0 + x * k) + 1, y, 1, 1)
  }
}

export { T as TORRE_COLORS }
