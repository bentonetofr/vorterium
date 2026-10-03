import { useRef } from 'react'
import { CANDLE_HEIGHTS, CLOAKS, makeCanvas, px, type Ctx } from '../game/art'
import { drawBits, SYMBOL_BITS } from './glyphs'
import { Dial, GlyphIcon, PixelScene, type Pt, type PuzzleProps } from './kit'

// ────────────────────────────────────────────────────────
// O Retrato do bibliotecário. Uma lupa segue o cursor. No escuro, 2
// símbolos nos vincos da moldura; com as 3 velas acesas, os 4 e a
// silhueta segurando 4 velas (a ordem dos pavios selados); com as 7 e
// olhando do ângulo certo, o rosto aparece — e o medalhão e a tradução.
// ────────────────────────────────────────────────────────

const W = 128
const H = 150
const MEDAL = { x: 64, y: 70, r: 5 }
const CORNERS: [number, number][] = [[12, 12], [107, 12], [12, 129], [107, 129]]

export function RetPanel({ g, act, ro }: PuzzleProps) {
  const r = g.ret
  const light = g.light
  const scene = useRef<{ c: HTMLCanvasElement; ctx: Ctx } | null>(null)
  const taken = r.taken ?? g.inv.medalhao
  const canTake = r.face !== null && !taken && !ro
  const overMedal = (p: Pt) => canTake && Math.hypot(p.x - MEDAL.x, p.y - MEDAL.y) <= MEDAL.r + 2

  const drawScene = (ctx: Ctx, t: number) => {
    const bg = light === 'total' ? '#3a2c22' : light === 'parcial' ? '#2a211c' : '#1a1513'
    const fig = light === 'total' ? '#4a3a2e' : light === 'parcial' ? '#33281f' : '#211a17'
    // moldura
    px(ctx, '#7a5a1e', 0, 0, W, H)
    px(ctx, '#c99a3b', 2, 2, W - 4, H - 4)
    px(ctx, '#ecc66a', 2, 2, W - 4, 1)
    px(ctx, '#ecc66a', 2, 2, 1, H - 4)
    px(ctx, '#5a4012', 6, 6, W - 12, H - 12)
    px(ctx, bg, 8, 8, W - 16, H - 16)
    // luz da esquerda (o castiçal)
    if (light !== 'escuro') {
      const gr = ctx.createRadialGradient(20, 40, 0, 20, 40, light === 'total' ? 130 : 80)
      gr.addColorStop(0, light === 'total' ? 'rgba(255,190,110,0.22)' : 'rgba(255,170,90,0.14)')
      gr.addColorStop(1, 'rgba(255,170,90,0)')
      ctx.fillStyle = gr
      ctx.fillRect(8, 8, W - 16, H - 16)
    }
    // o bibliotecário
    px(ctx, fig, 52, 30, 24, 26)
    px(ctx, fig, 49, 34, 30, 18)
    px(ctx, fig, 30, 60, 68, 82)
    px(ctx, fig, 38, 54, 52, 8)
    if (r.face !== null) {
      const k = CLOAKS[r.face]
      px(ctx, k.C, 49, 28, 30, 30)
      px(ctx, k.c, 51, 27, 26, 26)
      px(ctx, k.h, 54, 27, 20, 2)
      px(ctx, '#120c16', 55, 33, 18, 18)
      px(ctx, '#e8c4a0', 57, 36, 14, 14)
      px(ctx, '#c49a78', 57, 46, 14, 4)
      px(ctx, '#160f1c', 59, 41, 2, 2)
      px(ctx, '#160f1c', 67, 41, 2, 2)
      px(ctx, k.C, 30, 58, 68, 84)
      px(ctx, k.c, 34, 58, 60, 84)
    }
    // o medalhão (o 5º símbolo) no peito
    if (r.face !== null) {
      if (taken) {
        px(ctx, '#1a1208', MEDAL.x - 4, MEDAL.y - 4, 9, 9)
      } else {
        const pulse = 0.5 + 0.5 * Math.sin(t * 4)
        px(ctx, '#7a5a1e', MEDAL.x - 5, MEDAL.y - 4, 11, 9)
        px(ctx, '#7a5a1e', MEDAL.x - 4, MEDAL.y - 5, 9, 11)
        px(ctx, '#ecc66a', MEDAL.x - 4, MEDAL.y - 3, 9, 7)
        px(ctx, '#ecc66a', MEDAL.x - 3, MEDAL.y - 4, 7, 9)
        px(ctx, '#fff4c4', MEDAL.x - 1, MEDAL.y - 1, 3, 3)
        ctx.fillStyle = `rgba(255,231,163,${(0.15 + pulse * 0.2).toFixed(2)})`
        ctx.fillRect(MEDAL.x - 8, MEDAL.y - 8, 17, 17)
      }
    }
    // a silhueta: braços com 4 velas acesas, na ordem certa
    if (r.silhouette) {
      px(ctx, light === 'total' ? '#5a4636' : '#41332a', 28, 92, 72, 4)
      r.silhouette.forEach((idx, k) => {
        const x = 36 + k * 18
        const h = Math.round(CANDLE_HEIGHTS[idx] * 1.6)
        px(ctx, '#d8ccae', x - 2, 92 - h, 5, h)
        px(ctx, '#f0e8d0', x - 2, 92 - h, 1, h)
        px(ctx, '#2a2020', x, 92 - h - 2, 1, 2)
        px(ctx, '#ff9a3c', x - 1, 92 - h - 5, 3, 3)
        px(ctx, '#ffe08a', x, 92 - h - 6, 1, 3)
      })
    }
    // o livro que ele segura, com uma chave desenhada (não serve pra nada)
    if (light !== 'escuro') {
      px(ctx, '#4a1e16', 50, 104, 28, 20)
      px(ctx, '#6b2f22', 51, 104, 26, 18)
      px(ctx, '#dacfae', 51, 121, 26, 2)
      px(ctx, '#c99a3b', 58, 110, 4, 4)
      px(ctx, '#c99a3b', 62, 111, 8, 2)
      px(ctx, '#c99a3b', 67, 113, 1, 2)
      px(ctx, '#c99a3b', 69, 113, 1, 2)
    }
    // rachaduras (com luz total, brilham)
    const crack = light === 'total' ? '#b8892f' : '#110c0a'
    const cracks: [number, number][] = [[14, 20], [15, 21], [16, 22], [16, 23], [17, 24], [18, 26], [104, 60], [103, 61], [103, 62], [102, 63], [101, 64], [92, 132], [93, 133], [94, 134], [96, 135]]
    for (const [x, y] of cracks) px(ctx, crack, x, y, 1, 1)
    // símbolos dos cantos
    r.corners.forEach((s, k) => {
      if (!s) return
      const [x, y] = CORNERS[k]
      drawBits(ctx, SYMBOL_BITS[s], x, y, light === 'escuro' ? '#6a5530' : '#ecc66a')
    })
  }

  const draw = (ctx: Ctx, t: number, mouse: Pt | null) => {
    if (!scene.current) { const [c, sctx] = makeCanvas(W, H); scene.current = { c, ctx: sctx } }
    const s = scene.current
    s.ctx.clearRect(0, 0, W, H)
    drawScene(s.ctx, t)
    ctx.drawImage(s.c, 0, 0)
    // a lupa
    if (mouse && mouse.x > 0 && mouse.y > 0 && mouse.x < W && mouse.y < H) {
      const R = 17
      const z = 2
      ctx.save()
      ctx.beginPath()
      ctx.arc(mouse.x, mouse.y, R, 0, Math.PI * 2)
      ctx.clip()
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(s.c, mouse.x - R / z, mouse.y - R / z, (R * 2) / z, (R * 2) / z, mouse.x - R, mouse.y - R, R * 2, R * 2)
      ctx.fillStyle = 'rgba(255,240,200,0.06)'
      ctx.fillRect(mouse.x - R, mouse.y - R, R * 2, R * 2)
      ctx.restore()
      ctx.strokeStyle = '#c99a3b'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(mouse.x, mouse.y, R, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = '#5a4012'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(mouse.x, mouse.y, R + 1.5, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  return (
    <>
      <PixelScene
        w={W}
        h={H}
        maxH={470}
        label="O retrato do bibliotecário"
        draw={draw}
        hot={overMedal}
        onDown={(p) => { if (overMedal(p)) void act({ a: 'medal' }) }}
      />
      <Dial label="Olhar de" value={r.view} disabled={ro} onChange={(v) => void act({ a: 'ret_view', v })} />
      {r.table && (
        <div className="lb-table" aria-label="Tradução">
          {r.table.map((e) => (
            <span key={e.l} className="lb-table__cell"><GlyphIcon g={e.g} k={3} /><b>{e.l}</b></span>
          ))}
        </div>
      )}
    </>
  )
}
