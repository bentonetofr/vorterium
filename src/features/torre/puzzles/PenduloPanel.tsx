import { px, type Ctx } from '../../livro/game/art'
import { DIGIT_BITS, drawBits, SYMBOL_BITS } from '../../livro/puzzles/glyphs'
import { swinging, swingX } from '../game/sky'
import { Hint, PixelScene, useTick, type TorrePuzzleProps } from './kit'
import type { Floor } from '../torreNet'

// ────────────────────────────────────────────────────────
// O Pêndulo atravessa os dois andares.
//   • Embaixo: o peso sobre um mostrador de bronze. Quem empurra é daqui.
//     Com o feixe dos 4 espelhos, a sombra dele corre pelo chão — e por
//     um instante vira um símbolo, ou um número. Daqui não dá pra ver
//     em que casa do mapa aquilo cai: quem vê é quem está em cima.
//   • Em cima: só a haste, atravessando a grade. Quando balança, passa
//     na frente da fresta (e da estrela mais brilhante).
// ────────────────────────────────────────────────────────

const W = 140
const H = 92
const SHADOW = 'rgba(6,3,10,0.85)'

export function PenduloPanel({ g, act, ro, clock, floor }: TorrePuzzleProps & { floor: Floor }) {
  useTick(300)
  const now = clock()
  const moving = swinging(g.pend, now)
  const full = !!g.mir?.full

  const drawDown = (ctx: Ctx) => {
    const t = clock()
    const sx = swingX(g.pend, t)
    px(ctx, '#2e2933', 0, 0, W, H)
    for (let y = 8; y < H; y += 12) px(ctx, '#201b25', 0, y, W, 1)
    // luz da grade lá em cima e do feixe
    if (full) {
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = 'rgba(255,220,140,0.10)'
      ctx.fillRect(14, 40, W - 28, 46)
      ctx.globalCompositeOperation = 'source-over'
    }
    // o mostrador no chão
    for (let y = -12; y <= 12; y++) {
      for (let x = -56; x <= 56; x++) {
        const e = (x * x) / 3136 + (y * y) / 144
        if (e > 1) continue
        px(ctx, e > 0.86 ? (y < 0 ? '#d29a48' : '#5e3d16') : '#1d1714', W / 2 + x, 66 + y)
      }
    }
    for (let k = -5; k <= 5; k++) px(ctx, '#9a6a2c', W / 2 + k * 10, 66, 1, 2)
    // a sombra
    const sh = g.shadow && t < g.shadow.until ? g.shadow : null
    if (sh?.sym) drawBits(ctx, SYMBOL_BITS[sh.sym], W / 2 - 13, 53, SHADOW, 3)
    else if (sh?.num !== undefined) {
      const ds = String(sh.num).split('').map(Number)
      ds.forEach((d, i) => drawBits(ctx, DIGIT_BITS[d] ?? DIGIT_BITS[0], W / 2 - 25 + i * 18, 55, SHADOW, 3))
    } else if (moving && full) {
      ctx.fillStyle = 'rgba(6,3,10,0.5)'
      ctx.fillRect(Math.round(W / 2 + sx * 40) - 6, 62, 12, 6)
    }
    // fio e peso
    const bx = Math.round(W / 2 + sx * 40)
    for (let y = 0; y < 34; y++) px(ctx, '#8a8594', Math.round(W / 2 + (sx * 40 * y) / 34), y)
    px(ctx, '#5e3d16', bx - 6, 34, 13, 13)
    px(ctx, '#9a6a2c', bx - 6, 34, 12, 12)
    px(ctx, '#d29a48', bx - 4, 36, 4, 3)
  }

  const drawUp = (ctx: Ctx, time: number) => {
    const t = clock()
    const sx = swingX(g.pend, t)
    px(ctx, '#38323f', 0, 0, W, H)
    // a grade
    px(ctx, '#0a080d', 20, 30, W - 40, 56)
    for (let x = 20; x <= W - 20; x += 8) px(ctx, '#3a3642', x, 30, 2, 56)
    for (let y = 30; y <= 86; y += 8) px(ctx, '#5c5767', 20, y, W - 39, 1)
    // a fresta no alto, com a estrela mais brilhante
    px(ctx, '#0c1430', W / 2 - 22, 0, 44, 18)
    px(ctx, '#fff0c8', W / 2, 8, 1, 1)
    px(ctx, 'rgba(255,240,200,0.5)', W / 2 - 1, 8, 3, 1)
    // a haste
    const top = 0
    for (let y = top; y < 60; y++) {
      const k = y / 60
      px(ctx, '#8a8594', Math.round(W / 2 + sx * 12 * k), y)
      px(ctx, '#55505f', Math.round(W / 2 + sx * 12 * k) + 1, y)
    }
    // colar de bronze
    for (let y = -4; y <= 4; y++) for (let x = -12; x <= 12; x++) {
      const e = (x * x) / 144 + (y * y) / 16
      if (e <= 1) px(ctx, e > 0.5 ? '#d29a48' : '#07060a', W / 2 + x, 60 + y)
    }
    if (moving && Math.abs(sx) < 0.15) { ctx.globalAlpha = 0.6 + 0.2 * Math.sin(time * 9); px(ctx, '#07060a', W / 2 - 2, 4, 5, 10); ctx.globalAlpha = 1 }
  }

  if (floor === 'cima') {
    return (
      <>
        <PixelScene w={W} h={H} maxH={300} draw={drawUp} label="A haste do pêndulo atravessando a grade" />
        <Hint>{moving ? 'A haste balança. A cada ida, passa na frente da fresta — e da estrela mais brilhante.' : 'A haste desce do teto e some pela grade. Está parada.'}</Hint>
      </>
    )
  }
  return (
    <>
      <PixelScene w={W} h={H} maxH={300} draw={drawDown} label="O peso do pêndulo e a sombra no chão" />
      <button type="button" className="lb-btn lb-btn--gold" disabled={ro} onClick={() => void act({ a: 'push' })}>
        {moving ? 'Empurrar de novo' : 'Empurrar o pêndulo'}
      </button>
      <Hint>
        {!moving && 'O peso está parado sobre o mostrador.'}
        {moving && !full && 'Balança no escuro. Sem luz, não faz sombra.'}
        {moving && full && 'A sombra corre pelo chão. De vez em quando, vira uma forma.'}
      </Hint>
    </>
  )
}
