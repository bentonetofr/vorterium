import { useRef, useState } from 'react'
import { px, type Ctx } from '../game/art'
import type { Quadrant, Sym } from '../livroService'
import { PixelScene, Dial, SymbolIcon, type Pt, type PuzzleProps } from './kit'

// ────────────────────────────────────────────────────────
// O Pedestal: o livro acorrentado. Na capa, o diagrama da "máquina": um
// quadrante por objeto, que se preenche sozinho conforme a dupla avança,
// e linhas entre eles quando uma dependência aparece. Quatro fechaduras:
// I castiçal (número) · II retrato (os 4 símbolos dos cantos) · III
// astrolábio (a marca) · IV estante (a palavra) — abertas na ordem certa,
// que está na tampa do astrolábio (antes disso, as fechaduras nem giram).
// ────────────────────────────────────────────────────────

const W = 176
const H = 140
const D = { x: 88, y: 66 }
const QUAD: Record<Quadrant, [number, number]> = { castical: [74, 52], retrato: [102, 52], astrolabio: [102, 80], estante: [74, 80] }
const LOCKS: [number, number][] = [[30, 18], [146, 18], [146, 114], [30, 114]]  // I, II, III, IV
const ROMAN = ['I', 'II', 'III', 'IV']
const LOCK_LABEL = ['O número das sombras', 'Os símbolos dos cantos', 'A marca do astrolábio', 'A palavra da estante']
const STAGE = ['#4a3020', '#8a6a30', '#c99a3b', '#ffe7a3']

function lockAt(p: Pt): number | null {
  for (let k = 0; k < 4; k++) if (Math.abs(p.x - LOCKS[k][0]) <= 8 && Math.abs(p.y - LOCKS[k][1]) <= 9) return k + 1
  return null
}

function drawIcon(ctx: Ctx, q: Quadrant, x: number, y: number, col: string) {
  if (q === 'castical') { for (const dx of [-4, 0, 4]) { px(ctx, col, x + dx - 1, y - 3 + Math.abs(dx) / 4, 2, 7 - Math.abs(dx) / 4); px(ctx, col, x + dx - 1, y - 5, 1, 1) } px(ctx, col, x - 6, y + 4, 12, 1) }
  if (q === 'retrato') { px(ctx, col, x - 5, y - 6, 10, 1); px(ctx, col, x - 5, y + 5, 10, 1); px(ctx, col, x - 5, y - 6, 1, 12); px(ctx, col, x + 4, y - 6, 1, 12); px(ctx, col, x - 1, y - 3, 3, 3); px(ctx, col, x - 2, y + 1, 5, 3) }
  if (q === 'astrolabio') { ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, 5, 0, Math.PI * 2); ctx.stroke(); px(ctx, col, x, y - 4, 1, 5) }
  if (q === 'estante') { for (const dx of [-5, -2, 1, 4]) px(ctx, col, x + dx, y - 5 + (dx === 1 ? 2 : 0), 2, 10 - (dx === 1 ? 2 : 0)); px(ctx, col, x - 6, y + 5, 12, 1) }
}

export function PedPanel({ g, act, ro }: PuzzleProps) {
  const p = g.ped
  const [sel, setSel] = useState<number | null>(null)
  const hover = useRef<number | null>(null)

  const draw = (ctx: Ctx, t: number, mouse: Pt | null) => {
    hover.current = mouse && !ro && !p.opened ? lockAt(mouse) : null
    px(ctx, '#2a2232', 0, 0, W, H)
    if (p.opened) {
      // o livro aberto, com luz
      const gr = ctx.createRadialGradient(D.x, D.y, 0, D.x, D.y, 90)
      gr.addColorStop(0, `rgba(255,231,163,${(0.35 + 0.1 * Math.sin(t * 2)).toFixed(2)})`)
      gr.addColorStop(1, 'rgba(255,231,163,0)')
      ctx.fillStyle = gr
      ctx.fillRect(0, 0, W, H)
      px(ctx, '#4a1e16', 24, 24, 128, 90)
      px(ctx, '#e8dcbc', 28, 26, 59, 84)
      px(ctx, '#f2e8cc', 89, 26, 59, 84)
      px(ctx, '#b8ad8c', 87, 26, 2, 84)
      for (let y = 34; y < 104; y += 6) { px(ctx, '#9a8e6e', 34, y, 46, 1); px(ctx, '#9a8e6e', 95, y, 46, 1) }
      return
    }
    // capa de couro
    px(ctx, '#3a160f', 36, 10, 104, 114)
    px(ctx, '#6b2f22', 38, 12, 100, 110)
    px(ctx, '#8c4130', 38, 12, 100, 1)
    px(ctx, '#c99a3b', 42, 16, 92, 1)
    px(ctx, '#c99a3b', 42, 117, 92, 1)
    px(ctx, '#c99a3b', 42, 16, 1, 102)
    px(ctx, '#c99a3b', 133, 16, 1, 102)
    // o diagrama
    ctx.strokeStyle = '#a07e36'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(D.x + 0.5, D.y + 0.5, 34, 0, Math.PI * 2); ctx.stroke()
    px(ctx, 'rgba(160,126,54,0.5)', D.x, D.y - 34, 1, 68)
    px(ctx, 'rgba(160,126,54,0.5)', D.x - 34, D.y, 68, 1)
    // ligações descobertas
    ctx.strokeStyle = '#ecc66a'
    for (const [a, b] of p.links) {
      const [x1, y1] = QUAD[a]
      const [x2, y2] = QUAD[b]
      const mx = (x1 + x2) / 2 + (y2 - y1) * 0.18
      const my = (y1 + y2) / 2 - (x2 - x1) * 0.18
      ctx.beginPath(); ctx.moveTo(x1 + 0.5, y1 + 0.5); ctx.quadraticCurveTo(mx, my, x2 + 0.5, y2 + 0.5); ctx.stroke()
    }
    // quadrantes, mais dourados conforme avançam
    for (const q of Object.keys(QUAD) as Quadrant[]) {
      const [x, y] = QUAD[q]
      const stage = p.progress[q] ?? 0
      if (stage === 3) { ctx.fillStyle = `rgba(255,231,163,${(0.18 + 0.1 * Math.sin(t * 3)).toFixed(2)})`; ctx.fillRect(x - 9, y - 9, 18, 18) }
      drawIcon(ctx, q, x, y, STAGE[stage])
    }
    // correntes e fechaduras
    for (let k = 0; k < 4; k++) {
      const n = k + 1
      const [lx, ly] = LOCKS[k]
      if (p.chains.includes(n)) {
        // caída: um montinho de elos embaixo
        for (let i = 0; i < 6; i++) px(ctx, i % 2 ? '#55505f' : '#8a8594', lx - 6 + i * 2, (ly < 60 ? 128 : 132) - (i % 2), 2, 1)
        continue
      }
      const steps = 22
      for (let i = 0; i < steps; i++) {
        const x = lx + ((D.x - lx) * i) / steps * 0.62
        const y = ly + ((D.y - ly) * i) / steps * 0.62
        px(ctx, i % 2 ? '#55505f' : '#8a8594', x, y, 2, 2)
      }
      const hot = hover.current === n || sel === n
      px(ctx, hot ? '#ffe7a3' : '#7a5a1e', lx - 6, ly - 4, 13, 12)
      px(ctx, hot ? '#fff4c4' : '#c99a3b', lx - 5, ly - 3, 11, 10)
      px(ctx, '#7a5a1e', lx - 3, ly - 8, 7, 4)
      px(ctx, '#2a2232', lx - 1, ly - 6, 3, 2)
      // numeral romano (pauzinhos)
      const r = ROMAN[k]
      let cx = lx - (r.length * 3) / 2 + 1
      for (const ch of r) {
        if (ch === 'I') { px(ctx, '#3a2812', cx, ly - 1, 1, 5); cx += 2 }
        else { px(ctx, '#3a2812', cx, ly - 1, 1, 3); px(ctx, '#3a2812', cx + 1, ly + 2, 1, 2); px(ctx, '#3a2812', cx + 2, ly - 1, 1, 3); cx += 4 }
      }
    }
  }

  return (
    <>
      <PixelScene
        w={W}
        h={H}
        maxH={400}
        label="O livro acorrentado"
        draw={draw}
        hot={(pt) => !ro && !p.opened && lockAt(pt) !== null && !p.chains.includes(lockAt(pt)!)}
        onDown={(pt) => { if (ro || p.opened) return; const n = lockAt(pt); if (n && !p.chains.includes(n)) setSel(sel === n ? null : n) }}
      />
      {p.opened ? (
        <p className="lb-carved">As correntes estão no chão. O livro está aberto.</p>
      ) : sel && !ro && !g.astro.lid ? (
        <p className="lb-hint-line">A fechadura nem gira. Falta saber em que ordem abrir as correntes.</p>
      ) : sel && !ro ? (
        <LockForm n={sel} known={g.astro.known} act={act} onDone={() => setSel(null)} />
      ) : (
        <p className="lb-hint-line">{p.chains.length ? `${p.chains.length} de 4 correntes no chão.` : ro ? 'Quatro correntes, quatro fechaduras.' : 'Toque numa fechadura.'}</p>
      )}
    </>
  )
}

function LockForm({ n, known, act, onDone }: { n: number; known: Sym[]; act: PuzzleProps['act']; onDone: () => void }) {
  const [digits, setDigits] = useState('')
  const [word, setWord] = useState('')
  const [mark, setMark] = useState(1)
  const [syms, setSyms] = useState<(Sym | null)[]>([null, null, null, null])
  const cycle = (i: number) => setSyms((prev) => {
    const cur = prev[i]
    const next = cur === null ? known[0] ?? null : known[(known.indexOf(cur) + 1) % (known.length + 1)] ?? null
    const out = [...prev]
    out[i] = next
    return out
  })
  const value = n === 1 ? digits : n === 2 ? syms : n === 3 ? mark : word
  const ready = n === 1 ? digits.length === 4 : n === 2 ? syms.every(Boolean) : n === 3 ? true : word.length === 4

  return (
    <form className="lb-lock" onSubmit={(e) => { e.preventDefault(); if (ready) { void act({ a: 'chain', n, value }); onDone() } }}>
      <p className="lb-lock__title">Fechadura {ROMAN[n - 1]} <span>· {LOCK_LABEL[n - 1]}</span></p>
      {n === 1 && <input className="lb-input lb-input--word" value={digits} maxLength={4} inputMode="numeric" placeholder="····" onChange={(e) => setDigits(e.target.value.replace(/\D/g, ''))} aria-label="Número de 4 algarismos" autoFocus />}
      {n === 4 && <input className="lb-input lb-input--word" value={word} maxLength={4} placeholder="····" onChange={(e) => setWord(e.target.value.toUpperCase().replace(/[^A-ZÇ]/g, ''))} aria-label="Palavra de 4 letras" autoFocus autoComplete="off" spellCheck={false} />}
      {n === 3 && <Dial label="Marca" value={mark} onChange={setMark} />}
      {n === 2 && (
        <div className="lb-corners" role="group" aria-label="Os quatro cantos do retrato">
          {syms.map((s, i) => (
            <button key={i} type="button" className="lb-sym" onClick={() => cycle(i)} aria-label={`Canto ${i + 1}: ${s ?? 'vazio'}`}>
              {s ? <SymbolIcon sym={s} k={3} /> : <span className="lb-sym__q">?</span>}
            </button>
          ))}
        </div>
      )}
      <div className="lb-lock__btns">
        <button type="button" className="lb-btn" onClick={onDone}>Voltar</button>
        <button type="submit" className="lb-btn lb-btn--gold" disabled={!ready}>Abrir</button>
      </div>
    </form>
  )
}
