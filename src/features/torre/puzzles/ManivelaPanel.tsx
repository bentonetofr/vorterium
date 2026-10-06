import { px, type Ctx } from '../../livro/game/art'
import { GlyphIcon, Hint, PixelScene, type TorrePuzzleProps } from './kit'

// ────────────────────────────────────────────────────────
// A Manivela (embaixo). Gira a cúpula lá em cima (16 posições) — só com a
// trava de vidro acesa (os espelhos 1 e 2 no lugar). Daqui não se vê o
// céu: quem diz "para!" é quem está no telescópio.
// No eixo, o trinco: duas argolas de runas. Nas runas certas (a seta do
// mapa, lá em cima) ele cede e solta a chave de bronze. Errou: as argolas
// voltam ao começo.
// ────────────────────────────────────────────────────────

const W = 120
const H = 84
const G = { x: 44, y: 42, r: 30 }

export function ManivelaPanel({ g, act, ro }: TorrePuzzleProps) {
  const cr = g.crank!

  const draw = (ctx: Ctx, t: number) => {
    px(ctx, '#2a2232', 0, 0, W, H)
    for (let y = 6; y < H; y += 8) px(ctx, '#1f1926', 0, y, W, 1)
    // a engrenagem grande (16 dentes = 16 posições da cúpula)
    for (let y = -G.r - 3; y <= G.r + 3; y++) {
      for (let x = -G.r - 3; x <= G.r + 3; x++) {
        const d = Math.hypot(x, y)
        const a = Math.atan2(y, x) - (cr.dome / 16) * Math.PI * 2
        const tooth = Math.cos(a * 16) > 0.3
        if (d > G.r + (tooth ? 3 : 0)) continue
        px(ctx, d < 4 ? '#24212b' : d < 10 ? '#5e3d16' : d > G.r - 2 ? (y < 0 ? '#d29a48' : '#5e3d16') : '#9a6a2c', G.x + x, G.y + y)
      }
    }
    // marcas e ponteiro fixo no alto
    px(ctx, '#ffe7a3', G.x, G.y - G.r - 8, 1, 4)
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 - Math.PI / 2 + (cr.dome / 16) * Math.PI * 2
      px(ctx, k === 0 ? '#ffe7a3' : '#3a2810', Math.round(G.x + Math.cos(a) * (G.r - 6)), Math.round(G.y + Math.sin(a) * (G.r - 6)))
    }
    // o cabo da manivela
    const ha = (cr.dome / 16) * Math.PI * 2
    for (let i = 0; i < 22; i++) px(ctx, '#24212b', Math.round(G.x + Math.cos(ha) * i), Math.round(G.y + Math.sin(ha) * i), 2, 2)
    px(ctx, '#73502f', Math.round(G.x + Math.cos(ha) * 22) - 2, Math.round(G.y + Math.sin(ha) * 22) - 2, 5, 5)
    // a trava de vidro
    const lx = 98
    const ly = 18
    px(ctx, '#24212b', lx - 6, ly - 6, 13, 13)
    px(ctx, cr.gear ? '#ffe7a3' : '#3a4060', lx - 4, ly - 4, 9, 9)
    px(ctx, cr.gear ? '#fff6d8' : '#4c5478', lx - 3, ly - 3, 3, 3)
    if (cr.gear) {
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 3)
      px(ctx, '#ffe7a3', lx - 9, ly - 9, 19, 19)
      ctx.globalAlpha = 1
    }
    // o eixo do trinco
    px(ctx, '#24212b', 92, 34, 13, 40)
    px(ctx, '#3a3642', 93, 35, 11, 38)
    for (const yy of [44, 58]) { px(ctx, '#9a6a2c', 90, yy, 17, 6); px(ctx, '#d29a48', 90, yy, 17, 1) }
    if (cr.key) { px(ctx, '#07060a', 95, 66, 7, 5) }
  }

  return (
    <>
      <PixelScene w={W} h={H} maxH={300} draw={draw} label="A manivela, a engrenagem e o trinco" />
      <div className="lb-lock__btns">
        <button type="button" className="lb-btn" disabled={ro} onClick={() => void act({ a: 'dome', d: -1 })}>◀ Girar</button>
        <button type="button" className="lb-btn" disabled={ro} onClick={() => void act({ a: 'dome', d: 1 })}>Girar ▶</button>
      </div>
      <Hint>{cr.gear ? 'A trava de vidro brilha: a engrenagem está solta.' : 'Na engrenagem, uma trava de vidro apagada.'}</Hint>

      <div className="lb-lock">
        <p className="lb-lock__title">O trinco <span>{cr.key ? '· aberto, vazio' : '· duas argolas de runas'}</span></p>
        {!cr.key && (
          <>
            <div className="tor-rings">
              {[0, 1].map((i) => (
                <div key={i} className="tor-ring">
                  <button type="button" className="lb-dial__arrow" disabled={ro} onClick={() => void act({ a: 'latch', ring: i, d: -1 })} aria-label={`Argola ${i + 1}: anterior`}>◀</button>
                  <span className="tor-ring__face"><GlyphIcon g={cr.latch[i]} k={4} /></span>
                  <button type="button" className="lb-dial__arrow" disabled={ro} onClick={() => void act({ a: 'latch', ring: i, d: 1 })} aria-label={`Argola ${i + 1}: próxima`}>▶</button>
                </div>
              ))}
            </div>
            <button type="button" className="lb-btn lb-btn--gold" disabled={ro} onClick={() => void act({ a: 'pull' })}>Puxar o trinco</button>
          </>
        )}
      </div>
    </>
  )
}
