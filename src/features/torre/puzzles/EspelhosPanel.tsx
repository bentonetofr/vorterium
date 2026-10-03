import { px, type Ctx } from '../../livro/game/art'
import { Dial, Hint, PixelScene, type TorrePuzzleProps } from './kit'

// ────────────────────────────────────────────────────────
// Os Espelhos (embaixo). O feixe entra pela fresta e passa de espelho em
// espelho; cada um joga um raio pro teto. Daqui não dá pra ver o céu:
// quem sabe se acertou é quem está em cima. Os espelhos 3 e 4 só chegam
// na abertura com a cúpula no lugar certo — fora dele, a luz bate no
// ferro (isso dá pra ver daqui). Com os 4 certos, os raios se cruzam no
// peso do pêndulo.
// ────────────────────────────────────────────────────────

const W = 168
const H = 92
const MX = [30, 66, 102, 138]
const MY = 70
const CEIL = 10

export function EspelhosPanel({ g, act, ro }: TorrePuzzleProps) {
  const mir = g.mir!

  const draw = (ctx: Ctx, t: number) => {
    // parede, teto e chão
    px(ctx, '#2a2232', 0, 0, W, H)
    for (let y = 14; y < H; y += 8) px(ctx, '#1f1926', 0, y, W, 1)
    px(ctx, '#0d0b12', 0, 0, W, CEIL)
    px(ctx, '#3a3642', 0, CEIL, W, 2)
    px(ctx, '#2e2933', 0, MY + 12, W, H - MY - 12)
    // a fresta e o feixe de entrada
    px(ctx, '#ffe7a3', 2, 22, 4, 14)
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = 'rgba(255,220,140,0.55)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(6, 29); ctx.lineTo(MX[0], MY - 4); ctx.stroke()
    ctx.lineWidth = 1
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(MX[k], MY - 4); ctx.lineTo(MX[k + 1], MY - 4); ctx.stroke() }
    // raios pro teto
    for (let k = 0; k < 4; k++) {
      const p = mir.pos[k]
      const tx = mir.full ? W / 2 : MX[k] + (p - 3.5) * 7
      const ty = mir.full ? 40 : CEIL + 2
      ctx.strokeStyle = mir.full ? 'rgba(255,231,163,0.75)' : 'rgba(255,220,140,0.45)'
      ctx.beginPath(); ctx.moveTo(MX[k], MY - 4); ctx.lineTo(tx, ty); ctx.stroke()
      if (!mir.full) {
        if (mir.reach[k]) px(ctx, 'rgba(255,240,200,0.8)', Math.round(tx) - 1, CEIL, 3, 2)   // some na abertura
        else { px(ctx, '#8a8594', Math.round(tx) - 2, CEIL, 5, 2); px(ctx, '#ffb347', Math.round(tx), CEIL + 2) } // bate no ferro
      }
    }
    if (mir.full) {
      const gr = ctx.createRadialGradient(W / 2, 40, 0, W / 2, 40, 14 + Math.sin(t * 4))
      gr.addColorStop(0, 'rgba(255,231,163,0.6)')
      gr.addColorStop(1, 'rgba(255,231,163,0)')
      ctx.fillStyle = gr
      ctx.fillRect(W / 2 - 16, 24, 32, 32)
    }
    ctx.globalCompositeOperation = 'source-over'
    // o peso do pêndulo no meio
    px(ctx, '#8a8594', W / 2, CEIL + 2, 1, 26)
    px(ctx, '#5e3d16', W / 2 - 3, 38, 7, 7)
    px(ctx, '#9a6a2c', W / 2 - 3, 38, 6, 6)
    // os espelhos (inclinados conforme a posição)
    for (let k = 0; k < 4; k++) {
      const p = mir.pos[k]
      const tilt = Math.round((p - 3.5) * 0.8)
      px(ctx, '#24212b', MX[k], MY - 2, 2, 14)
      for (let i = -5; i <= 5; i++) px(ctx, Math.abs(i) < 4 ? '#c9d2ee' : '#6c7896', MX[k] + i, MY - 5 + Math.round((i * tilt) / 5))
      px(ctx, '#d29a48', MX[k], MY - 4, 1, 1)
      px(ctx, '#ecc66a', MX[k] - 1, MY + 13, 3, 1)
    }
  }

  return (
    <>
      <PixelScene w={W} h={H} maxH={300} draw={draw} label="Os espelhos e o feixe" />
      <div className="tor-dials">
        {mir.pos.map((p, k) => (
          <Dial key={k} value={p + 1} disabled={ro} label={`Espelho ${k + 1}`} onChange={(v) => void act({ a: 'mirror', k, p: v - 1 })} />
        ))}
      </div>
      <Hint>
        {mir.full
          ? 'Os quatro raios se cruzam no peso do pêndulo.'
          : !mir.reach[2]
            ? 'Os raios 3 e 4 batem no ferro da cúpula. Os outros somem no escuro lá em cima.'
            : 'Os raios somem no escuro lá em cima. Daqui não dá pra saber onde caem.'}
      </Hint>
    </>
  )
}
