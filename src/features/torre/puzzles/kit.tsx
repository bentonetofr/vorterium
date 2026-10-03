import { useEffect, useState } from 'react'
import type { TorreGame, TorreView } from '../torreService'
import { px, seeded, type Ctx } from '../../livro/game/art'
import { BRIGHT, LENS, STAR_COLORS } from '../game/sky'

// ────────────────────────────────────────────────────────
// Peças comuns das janelas da torre. O que é genérico vem do Livro
// (PixelScene, Dial, ícones de símbolos e glifos — livro/puzzles/kit);
// aqui ficam só os pedaços do céu e o relógio do banco.
// ────────────────────────────────────────────────────────

export { Dial, GlyphIcon, Hint, PixelScene, SymbolIcon, type Pt } from '../../livro/puzzles/kit'

export type Act = (action: Record<string, unknown>) => Promise<void>

export interface TorrePuzzleProps {
  g:     TorreGame
  act:   Act
  /** Só olhando (quem assiste, ou o mestre). */
  ro:    boolean
  view:  TorreView
  /** Hora do banco agora (ms). */
  clock: () => number
}

/** Re-renderiza a cada `ms` (pra textos que dependem da hora). */
export function useTick(ms = 250) {
  const [, set] = useState(0)
  useEffect(() => { const t = window.setInterval(() => set((n) => n + 1), ms); return () => window.clearInterval(t) }, [ms])
}

/** O fundo do céu dentro da lente (com estrelinhas apagadas fixas). */
export function drawLensSky(ctx: Ctx, cx = LENS.cx, cy = LENS.cy, r = LENS.r) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y)
      if (d > r) continue
      px(ctx, d > r - 2 ? '#0a0f22' : y < -r * 0.4 ? '#121b3c' : '#0c1430', cx + x, cy + y)
    }
  }
  const rnd = seeded(77)
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2
    const d = Math.sqrt(rnd()) * (r - 3)
    px(ctx, rnd() < 0.3 ? '#3a4672' : '#222c55', Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d))
  }
}

/** Uma estrela acesa: miolo, cruz e brilho. */
export function drawStar(ctx: Ctx, x: number, y: number, color: string, big = false, a = 1) {
  ctx.globalAlpha = a
  px(ctx, color, x - 1, y, 3, 1)
  px(ctx, color, x, y - 1, 1, 3)
  if (big) { px(ctx, color, x - 2, y, 5, 1); px(ctx, color, x, y - 2, 1, 5) }
  px(ctx, '#ffffff', x, y)
  ctx.globalAlpha = a * 0.25
  px(ctx, color, x - 2, y - 2, 5, 5)
  ctx.globalAlpha = 1
}

/** As 3 estrelas que brilham desde o começo (hide = a que o pêndulo tapa). */
export function drawBright(ctx: Ctx, t: number, hide: number | null = null) {
  BRIGHT.forEach(([x, y], i) => {
    if (i === hide) return
    drawStar(ctx, x, y, '#fff0c8', i === 1, 0.85 + 0.15 * Math.sin(t * 2.3 + i * 2))
  })
}

/** Uma constelação (5 pontos numa faixa de 40×18), com as linhas. */
export function drawPattern(ctx: Ctx, pts: [number, number][], ox: number, oy: number, color: string, line: string, k = 1) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]
    const [bx, by] = pts[i + 1]
    const n = Math.max(1, Math.round(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * k))
    for (let j = 1; j < n; j += 2) px(ctx, line, Math.round(ox + (ax + ((bx - ax) * j) / n) * k), Math.round(oy + (ay + ((by - ay) * j) / n) * k))
  }
  for (const [x, y] of pts) { px(ctx, color, Math.round(ox + x * k), Math.round(oy + y * k)); px(ctx, color, Math.round(ox + x * k) + 1, Math.round(oy + y * k)) }
}

export { STAR_COLORS }
