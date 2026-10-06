import { px, type Ctx } from '../../livro/game/art'
import { BAND, BRIGHT, fifthXY, LENS, PERIOD, SKY_SLOTS, STAR_COLORS, WINDOWS, swinging } from '../game/sky'
import { drawBright, drawLensSky, drawPattern, drawStar, Hint, PixelScene, useTick, type TorrePuzzleProps } from './kit'

// ────────────────────────────────────────────────────────
// O Telescópio (em cima). Mostra o céu pela fresta: as 3 estrelas que
// brilham, as escondidas que os espelhos de baixo acendem (a uma posição
// de distância, só tremeluzem) e, embaixo da lente, a constelação que
// está na frente da cúpula agora — muda quando a manivela gira.
// Quando o pêndulo passa na frente, a mais brilhante some por um instante
// e a 5ª estrela, escondida atrás dela, aparece.
// ────────────────────────────────────────────────────────

export function TelescopioPanel({ g, clock }: TorrePuzzleProps) {
  useTick(500)
  const tele = g.tele!
  const lit = tele.stars.filter((s) => s.state === 'lit').length
  const glim = tele.stars.some((s) => s.state === 'glimmer')

  const draw = (ctx: Ctx, t: number) => {
    const now = clock()
    px(ctx, '#07060a', 0, 0, LENS.w, LENS.h)
    drawLensSky(ctx)
    // a constelação na frente da cúpula agora
    drawPattern(ctx, tele.pattern, BAND.x, BAND.y, '#cfd6f2', '#3a4880')
    // o pêndulo passando na frente da mais brilhante
    let hide: number | null = null
    if (swinging(g.pend, now)) {
      const ph = (now - g.pend.t0!) % PERIOD
      const [a, b] = WINDOWS[5]
      const span = 1400
      if (ph >= a - span / 2 && ph < b + span / 2) {
        const k = (ph - (a - span / 2)) / (b - a + span)
        const rx = Math.round(BRIGHT[1][0] - 26 + k * 52)
        ctx.fillStyle = 'rgba(8,6,12,0.92)'
        ctx.fillRect(rx - 2, 0, 5, LENS.h)
        if (Math.abs(rx - BRIGHT[1][0]) <= 3) hide = 1
      }
    }
    drawBright(ctx, t, hide)
    if (tele.fifth && now < tele.fifth.until) {
      const [x, y] = fifthXY(tele.fifth.s)
      drawStar(ctx, x, y, '#d8e4ff', false, 0.9)
    }
    // as escondidas
    for (const s of tele.stars) {
      const [x, y] = SKY_SLOTS[s.slot]
      if (s.state === 'lit') drawStar(ctx, x, y, STAR_COLORS[s.k], false, 0.95)
      else {
        ctx.globalAlpha = 0.25 + 0.35 * Math.max(0, Math.sin(t * 9 + s.k * 1.7))
        px(ctx, STAR_COLORS[s.k], x, y)
        ctx.globalAlpha = 1
      }
    }
    // aro de bronze da lente
    for (let a = 0; a < 360; a += 1) {
      const r = (a * Math.PI) / 180
      px(ctx, a > 200 && a < 340 ? '#d29a48' : '#5e3d16', Math.round(LENS.cx + Math.cos(r) * (LENS.r + 1)), Math.round(LENS.cy + Math.sin(r) * (LENS.r + 1)))
    }
  }

  return (
    <>
      <PixelScene w={LENS.w} h={LENS.h} maxH={380} draw={draw} label="O céu pelo telescópio" />
      <Hint>
        {lit === 0 && !glim && 'Três estrelas brilham. Todas as outras estão apagadas.'}
        {lit === 0 && glim && 'Uma estrela tremeluz, quase acesa…'}
        {lit > 0 && lit < 4 && `${lit} ${lit === 1 ? 'estrela nova acesa' : 'estrelas novas acesas'}.${glim ? ' Outra tremeluz.' : ''}`}
        {lit === 4 && 'Quatro estrelas novas, cada uma de uma cor.'}
      </Hint>
      <Hint>Embaixo da lente, a constelação que está na frente da cúpula agora.</Hint>
    </>
  )
}
