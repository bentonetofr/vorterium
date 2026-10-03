import { useRef, useState } from 'react'
import { BOOK_COLORS, px, type Ctx } from '../game/art'
import { DIGIT_BITS, drawBits, GLYPH_BITS } from './glyphs'
import { PixelScene, type Pt, type PuzzleProps } from './kit'

// ────────────────────────────────────────────────────────
// A Estante. 12 livros; as posições estão gravadas na prateleira.
// Arrastar troca os livros de lugar (não muda nada... de propósito).
// Clicar puxa um livro; no 4º a ordem é conferida (o número das sombras):
// certa, as lombadas mostram glifos; errada, todos voltam. A palavra traduzida
// (+ o medalhão) abre a gaveta secreta.
// ────────────────────────────────────────────────────────

const W = 216
const H = 118
const SHELF = 80
const slotX = (pos: number) => 12 + pos * 16
const bookH = (id: number) => 40 + ((id * 7) % 17)
const DRAWER = { x: 80, y: 98, w: 56, h: 16 }

function posAt(p: Pt): number | null {
  if (p.y < SHELF - 60 || p.y > SHELF + 2) return null
  const pos = Math.floor((p.x - 11) / 16)
  return pos >= 0 && pos < 12 ? pos : null
}
const inDrawer = (p: Pt) => p.x >= DRAWER.x && p.x <= DRAWER.x + DRAWER.w && p.y >= DRAWER.y - 4 && p.y <= DRAWER.y + DRAWER.h

export function EstPanel({ g, act, ro }: PuzzleProps) {
  const e = g.est
  const [word, setWord] = useState('')
  const drag = useRef<{ from: number; sx: number; x: number; moved: boolean } | null>(null)
  const hoverPos = useRef<number | null>(null)

  const drawBook = (ctx: Ctx, id: number, x: number, lift: number, pulledK: number | null, hot: boolean) => {
    const h = bookH(id)
    const top = SHELF - h + lift
    const col = BOOK_COLORS[id % BOOK_COLORS.length]
    const w = pulledK !== null ? 14 : 13
    px(ctx, col, x, top, w, h)
    px(ctx, 'rgba(255,255,255,0.16)', x, top, 1, h)
    px(ctx, 'rgba(0,0,0,0.32)', x + w - 1, top, 1, h)
    px(ctx, '#ecc66a', x + 1, top + 3, w - 2, 1)
    px(ctx, '#7a5a1e', x + 1, top + h - 5, w - 2, 1)
    if (pulledK !== null) {
      // a ordem em que foi puxado (é a ordem de ler a palavra)
      drawBits(ctx, DIGIT_BITS[pulledK + 1], x + Math.floor((w - 5) / 2), top - 10, '#ecc66a')
      const glyph = GLYPH_BITS[e.glyphs[pulledK]]
      if (glyph) {
        px(ctx, 'rgba(0,0,0,0.35)', x + 2, top + 12, w - 4, 9)
        drawBits(ctx, glyph, x + Math.floor((w - 5) / 2), top + 14, '#ffe7a3')
      }
    } else {
      px(ctx, '#c99a3b', x + 6, top + 9, 1, 2)
    }
    if (hot) { px(ctx, '#ffe7a3', x - 1, top, 1, h); px(ctx, '#ffe7a3', x + w, top, 1, h); px(ctx, '#ffe7a3', x, top - 1, w, 1) }
  }

  const draw = (ctx: Ctx, _t: number, mouse: Pt | null) => {
    hoverPos.current = mouse && !ro && !e.word_ok ? posAt(mouse) : null
    // móvel
    px(ctx, '#3e281a', 0, 0, W, H)
    px(ctx, '#1d140c', 6, 6, W - 12, SHELF - 4)
    px(ctx, '#5a3b27', 0, 0, W, 5)
    px(ctx, '#73502f', 0, 0, W, 1)
    // frase gravada atrás (aparece com os 4 puxados)
    if (e.pulled.length === 4) for (let x = 20; x < W - 20; x += 6) px(ctx, '#3a2a18', x, 30 + ((x / 6) % 2), 4, 1)
    // livros
    const d = drag.current
    e.books.forEach((id, pos) => {
      if (d && d.moved && d.from === pos) return
      const k = e.pulled.indexOf(pos + 1)
      drawBook(ctx, id, slotX(pos), k >= 0 ? 5 : 0, k >= 0 ? k : null, hoverPos.current === pos && !(d && d.moved))
    })
    // prateleira com as posições
    px(ctx, '#73502f', 4, SHELF, W - 8, 4)
    px(ctx, '#8a6240', 4, SHELF, W - 8, 1)
    px(ctx, '#3e281a', 4, SHELF + 4, W - 8, 1)
    for (let pos = 0; pos < 12; pos++) {
      const n = pos + 1
      const x = slotX(pos) + (n >= 10 ? 1 : 4)
      if (n >= 10) { drawBits(ctx, DIGIT_BITS[1], x, SHELF + 7, '#a07e36'); drawBits(ctx, DIGIT_BITS[n - 10], x + 6, SHELF + 7, '#a07e36') }
      else drawBits(ctx, DIGIT_BITS[n], x, SHELF + 7, '#a07e36')
    }
    // o livro sendo arrastado
    if (d && d.moved) {
      const id = e.books[d.from]
      const k = e.pulled.indexOf(d.from + 1)
      drawBook(ctx, id, Math.round(d.x - 6), -6, k >= 0 ? k : null, true)
    }
    // gaveta
    const open = e.drawer ? 7 : e.word_ok ? 3 : 0
    if (open) px(ctx, '#0e0905', DRAWER.x, DRAWER.y, DRAWER.w, open)
    px(ctx, '#5a3b27', DRAWER.x, DRAWER.y + open, DRAWER.w, DRAWER.h - 2)
    px(ctx, '#73502f', DRAWER.x, DRAWER.y + open, DRAWER.w, 1)
    px(ctx, '#ecc66a', DRAWER.x + DRAWER.w / 2 - 2, DRAWER.y + open + 6, 4, 2)
    if (e.word_ok && !e.drawer) {
      // encaixe redondo, vazio
      px(ctx, '#2a1c10', DRAWER.x + 22, DRAWER.y + open + 3, 8, 8)
      px(ctx, '#1a1208', DRAWER.x + 24, DRAWER.y + open + 5, 4, 4)
    }
  }

  const onDown = (p: Pt) => {
    if (ro) return
    if (inDrawer(p)) { if (e.word_ok && !e.drawer) void act({ a: 'drawer' }); return }
    const pos = posAt(p)
    if (pos === null) return
    drag.current = { from: pos, sx: p.x, x: p.x, moved: false }
  }
  const onMove = (p: Pt) => {
    const d = drag.current
    if (!d) return
    d.x = p.x
    if (Math.abs(p.x - d.sx) > 4) d.moved = true
  }
  const onUp = (p: Pt) => {
    const d = drag.current
    drag.current = null
    if (!d || ro) return
    if (!d.moved) { if (!e.word_ok) void act({ a: 'pull', pos: d.from + 1 }); return }
    const to = Math.max(0, Math.min(11, Math.round((p.x - 18) / 16)))
    if (to === d.from) return
    const order = [...e.books]
    const [b] = order.splice(d.from, 1)
    order.splice(to, 0, b)
    void act({ a: 'books', order })
  }

  return (
    <>
      <PixelScene
        w={W}
        h={H}
        maxH={360}
        label="A estante com doze livros"
        draw={draw}
        hot={(p) => !ro && ((!e.word_ok && posAt(p) !== null) || (inDrawer(p) && e.word_ok && !e.drawer))}
        onDown={onDown}
        onMove={onMove}
        onUp={onUp}
      />
      {e.pulled.length === 4 && <p className="lb-carved">“Quem lê o que ninguém lê, um dia é lido.”</p>}
      {e.pulled.length === 4 && !e.word_ok && !ro && (
        <form className="lb-word" onSubmit={(ev) => { ev.preventDefault(); if (word.trim().length === 4) void act({ a: 'word', text: word }) }}>
          <input
            className="lb-input lb-input--word"
            value={word}
            maxLength={4}
            onChange={(ev) => setWord(ev.target.value.toUpperCase().replace(/[^A-ZÇ]/g, ''))}
            placeholder="····"
            aria-label="A palavra das lombadas, em letras"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="lb-btn lb-btn--gold" disabled={word.trim().length !== 4}>Dizer</button>
        </form>
      )}
      {e.word_ok && !e.drawer && g.inv.medalhao && !ro && (
        <button type="button" className="lb-btn lb-btn--gold" onClick={() => void act({ a: 'drawer' })}>Encaixar o medalhão</button>
      )}
    </>
  )
}
