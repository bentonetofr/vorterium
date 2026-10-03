import { useRef } from 'react'
import { CANDLE_HEIGHTS, drawFlame, px, RUNES, seeded, type Ctx } from '../game/art'
import { DIGIT_BITS, drawBits, SYMBOL_BITS } from './glyphs'
import { Dial, PixelScene, useUiShare, type Pt, type PuzzleProps } from './kit'

// ────────────────────────────────────────────────────────
// O Castiçal. Clicar numa vela acende/apaga; nas seladas, trinca a cera
// do pavio — no último, a ordem é conferida (a certa está na silhueta do
// retrato). Cada vela acesa joga uma sombra na parede, logo acima do seu
// gancho — algumas têm forma de símbolo; as manchas comuns mudam com o
// mostrador. Com as 7 acesas, o astrolábio calibrado e olhando do ângulo
// certo, as sombras viram números.
// ────────────────────────────────────────────────────────

const W = 176
const H = 112
const BAR = 76
const cx = (i: number) => 22 + i * 22
const heightOf = (i: number) => CANDLE_HEIGHTS[i] * 2
const SHADOW = 'rgba(6,3,10,0.82)'

function candleAt(p: Pt): number | null {
  for (let i = 0; i < 7; i++) {
    const top = BAR - heightOf(i) - 10
    if (p.x >= cx(i) - 6 && p.x <= cx(i) + 6 && p.y >= top && p.y <= BAR + 4) return i
  }
  return null
}

export function CastPanel({ g, act, ro, ui }: PuzzleProps) {
  const { put, remote } = useUiShare(ui, ro)
  const live = !ro || !!remote
  const c = g.cast
  const tried = c.tried ?? []
  const hover = useRef<number | null>(null)

  const draw = (ctx: Ctx, t: number, mouse: Pt | null) => {
    hover.current = mouse && live ? candleAt(mouse) : null
    // parede
    const rnd = seeded(3)
    px(ctx, '#1f1828', 0, 0, W, H)
    for (let row = 0; row < 12; row++) {
      const y = row * 8
      px(ctx, '#18121f', 0, y + 7, W, 1)
      for (let x = (row % 2) * 10 - 10; x < W; x += 20) {
        px(ctx, '#18121f', x + 19, y, 1, 7)
        px(ctx, '#271f31', x + 1, y, 18, 1)
        if (rnd() < 0.2) px(ctx, '#18121f', x + 5, y + 3, 3, 1)
      }
    }
    // brilho quente das velas acesas
    const lit = c.lit.filter(Boolean).length
    if (lit) {
      ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 7; i++) {
        if (!c.lit[i]) continue
        const gr = ctx.createRadialGradient(cx(i), BAR - heightOf(i) - 4, 0, cx(i), BAR - heightOf(i) - 4, 34)
        gr.addColorStop(0, 'rgba(255,150,60,0.20)')
        gr.addColorStop(1, 'rgba(255,150,60,0)')
        ctx.fillStyle = gr
        ctx.fillRect(cx(i) - 34, BAR - heightOf(i) - 38, 68, 68)
      }
      ctx.globalCompositeOperation = 'source-over'
    }
    // sombras na parede
    if (c.digits) {
      const total = 4 * 15 + 3 * 7
      c.digits.forEach((d, k) => drawBits(ctx, DIGIT_BITS[d] ?? DIGIT_BITS[1], (W - total) / 2 + k * 22, 8, SHADOW, 3))
    } else {
      const spread = c.view - 4.5
      for (let i = 0; i < 7; i++) {
        if (!c.lit[i]) continue
        const sym = c.shadows[i]
        // o símbolo fica sempre em cima do próprio gancho; só as manchas se movem
        if (sym) drawBits(ctx, SYMBOL_BITS[sym], cx(i) - 9, 12, SHADOW, 2)
        else {
          const sx = cx(i) + spread * (i - 3) * 1.6
          px(ctx, SHADOW, sx - 4, 18, 8, 14)
          px(ctx, SHADOW, sx - 3, 16, 6, 2)
          px(ctx, SHADOW, sx - 2, 32, 4, 2)
        }
      }
      // com as 7 acesas, fora do ângulo: pedaços que quase formam algo
      if (lit === 7) {
        const r2 = seeded(100 + c.view * 7)
        for (let k = 0; k < 14; k++) px(ctx, 'rgba(6,3,10,0.55)', 30 + r2() * 116, 6 + r2() * 40, 2 + Math.floor(r2() * 6), 2)
      }
    }
    // barra e velas
    px(ctx, '#24212b', 6, BAR + 1, W - 12, 3)
    px(ctx, '#3a3642', 6, BAR, W - 12, 2)
    px(ctx, '#5c5767', 6, BAR, W - 12, 1)
    for (let i = 0; i < 7; i++) {
      const x = cx(i)
      const h = heightOf(i)
      const top = BAR - h
      const hot = hover.current === i
      px(ctx, '#24212b', x - 5, BAR - 2, 11, 3)
      px(ctx, '#5c5767', x - 5, BAR - 3, 11, 1)
      px(ctx, hot ? '#fff8e6' : '#e6dcc2', x - 3, top, 6, h - 2)
      px(ctx, hot ? '#ffffff' : '#f6efdc', x - 3, top, 2, h - 2)
      px(ctx, '#b9ab8c', x + 2, top, 1, h - 2)
      if (hot) { px(ctx, '#ffe7a3', x - 4, top, 1, h - 2); px(ctx, '#ffe7a3', x + 3, top, 1, h - 2) }
      px(ctx, '#2a2020', x, top - 2, 1, 2)
      if (c.sealed[i]) {
        px(ctx, '#7a1d1d', x - 3, top - 3, 6, 4)
        px(ctx, '#b83a3a', x - 2, top - 3, 4, 2)
        px(ctx, '#e06060', x - 1, top - 3, 1, 1)
        px(ctx, '#7a1d1d', x - 2, top + 1, 1, 3)
        if (tried.includes(i)) {
          // cera trincada, esperando os outros
          px(ctx, '#2a0e0e', x - 1, top - 3, 1, 2)
          px(ctx, '#2a0e0e', x, top - 2, 1, 2)
          px(ctx, '#2a0e0e', x + 1, top - 1, 1, 1)
        }
      } else if (c.lit[i]) {
        drawFlame(ctx, x, top - 2, t, i * 3)
        px(ctx, '#ffb347', x, top - 6, 1, 1)
      }
      // gancho e runa
      px(ctx, '#2e2936', x - 5, BAR + 8, 11, 11)
      px(ctx, '#3c3646', x - 5, BAR + 8, 11, 1)
      const rune = RUNES[i]
      for (let k = 0; k < 9; k++) if (rune[k]) px(ctx, '#c99a3b', x - 4 + (k % 3) * 3, BAR + 10 + Math.floor(k / 3) * 3, 3, 3)
      px(ctx, '#5c5767', x, BAR + 19, 1, 4)
      px(ctx, '#5c5767', x + 1, BAR + 23, 2, 1)
    }
  }

  return (
    <>
      <PixelScene
        w={W}
        h={H}
        label="As sete velas e os ganchos com runas"
        draw={draw}
        hot={(p) => !ro && candleAt(p) !== null}
        remoteMouse={remote ? (remote.m as Pt | null) ?? null : undefined}
        onMouse={(m) => put({ m })}
        onDown={(p) => { if (ro) return; const i = candleAt(p); if (i !== null) void act({ a: 'light', i }) }}
      />
      <Dial label="Olhar de" value={c.view} disabled={ro} onChange={(v) => void act({ a: 'cast_view', v })} />
    </>
  )
}
