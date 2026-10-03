import { useEffect, useState } from 'react'
import { px, type Ctx } from '../../livro/game/art'
import { SYMS } from '../../livro/puzzles/glyphs'
import type { Node, Sym } from '../torreService'
import type { Floor } from '../torreNet'
import { fifthXY } from '../game/sky'
import { drawStar, Hint, PixelScene, SymbolIcon, useTick, type Pt, type TorrePuzzleProps } from './kit'

// ────────────────────────────────────────────────────────
// O Astrário: o disco de bronze que atravessa a grade, uma face em cada
// andar. No meio, a "máquina": um ponto pra cada objeto, que se acende em
// etapas, e as ligações que aparecem quando uma dependência é descoberta.
// Embaixo do diagrama, a metade de quem abriu:
//   • em cima: as 4 casas (a sequência) e a 5ª estrela (1 de 8 pontos);
//   • embaixo: o número e a chave.
// Os dois giram a sua metade — juntos, até 3 s um do outro.
// ────────────────────────────────────────────────────────

const NODES: { id: Node; name: string; x: number; y: number }[] = [
  { id: 'telescopio', name: 'Telescópio', x: 60, y: 10 },
  { id: 'mapa', name: 'Mapa', x: 18, y: 32 },
  { id: 'pendulo', name: 'Pêndulo', x: 102, y: 32 },
  { id: 'espelhos', name: 'Espelhos', x: 30, y: 66 },
  { id: 'manivela', name: 'Manivela', x: 90, y: 66 },
]
const DW = 120
const DH = 80
const SYM_NEXT = (s: Sym | null): Sym | null => (s === null ? SYMS[0] : SYMS.indexOf(s) === 3 ? null : SYMS[SYMS.indexOf(s) + 1])

function Diagram({ g }: Pick<TorrePuzzleProps, 'g'>) {
  const draw = (ctx: Ctx, t: number) => {
    px(ctx, '#3a2810', 0, 0, DW, DH)
    for (let y = -36; y <= 36; y++) for (let x = -58; x <= 58; x++) {
      const e = (x * x) / 3364 + (y * y) / 1296
      if (e <= 1) px(ctx, e > 0.92 ? '#d29a48' : '#2a1d0c', 60 + x, 40 + y)
    }
    // ligações descobertas
    for (const [a, b] of g.links) {
      const A = NODES.find((n) => n.id === a)!
      const B = NODES.find((n) => n.id === b)!
      const n = Math.max(Math.abs(B.x - A.x), Math.abs(B.y - A.y))
      for (let i = 2; i < n - 1; i += 2) px(ctx, '#ecc66a', Math.round(A.x + ((B.x - A.x) * i) / n), Math.round(A.y + ((B.y - A.y) * i) / n))
    }
    // linhas apagadas pro centro
    for (const n of NODES) {
      const steps = Math.max(Math.abs(60 - n.x), Math.abs(40 - n.y))
      for (let i = 3; i < steps - 3; i += 3) px(ctx, '#5e3d16', Math.round(n.x + ((60 - n.x) * i) / steps), Math.round(n.y + ((40 - n.y) * i) / steps))
    }
    // os pontos: 3 etapas cada
    for (const n of NODES) {
      const p = g.progress[n.id] ?? 0
      px(ctx, '#0d0a06', n.x - 4, n.y - 4, 9, 9)
      px(ctx, p > 0 ? '#9a6a2c' : '#3a2810', n.x - 3, n.y - 3, 7, 7)
      for (let k = 0; k < 3; k++) px(ctx, k < p ? '#ffe7a3' : '#1a1208', n.x - 3 + k * 3, n.y + 5, 2, 2)
      if (p === 3) { ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 2 + n.x); px(ctx, '#ffe7a3', n.x - 6, n.y - 6, 13, 13); ctx.globalAlpha = 1 }
    }
    // o centro
    const all = NODES.every((n) => (g.progress[n.id] ?? 0) === 3)
    px(ctx, '#0d0a06', 55, 35, 11, 11)
    px(ctx, g.opened ? '#ffe7a3' : all ? '#d29a48' : '#5e3d16', 56, 36, 9, 9)
  }
  return <PixelScene w={DW} h={DH} maxH={220} draw={draw} label="O diagrama do Astrário" />
}

/** Os 8 pontos em volta da estrela mais brilhante (pra marcar a 5ª). */
function StarPicker({ value, onPick, ro }: { value: number | null; onPick: (s: number) => void; ro: boolean }) {
  const S = 36
  const at = (p: Pt) => {
    for (let s = 0; s < 8; s++) {
      const [x, y] = fifthXY(s, 18, 18, 12)
      if (Math.abs(p.x - x) <= 3 && Math.abs(p.y - y) <= 3) return s
    }
    return null
  }
  const draw = (ctx: Ctx, t: number) => {
    px(ctx, '#0c1430', 0, 0, S, S)
    drawStar(ctx, 18, 18, '#fff0c8', true, 0.9 + 0.1 * Math.sin(t * 2))
    for (let s = 0; s < 8; s++) {
      const [x, y] = fifthXY(s, 18, 18, 12)
      if (s === value) drawStar(ctx, x, y, '#d8e4ff')
      else px(ctx, '#3a4672', x, y)
    }
  }
  return <PixelScene w={S} h={S} maxH={150} draw={draw} onDown={(p) => { const s = at(p); if (!ro && s !== null) onPick(s) }} hot={(p) => !ro && at(p) !== null} label="Onde está a 5ª estrela" />
}

function TopHalf({ g, act, ro }: TorrePuzzleProps) {
  const a = g.ast_cima!
  return (
    <div className="lb-lock">
      <p className="lb-lock__title">Face de cima <span>· as quatro casas e a 5ª estrela</span></p>
      <div className="tor-casas">
        {a.seq.map((s, i) => (
          <button key={i} type="button" className="lb-sym" disabled={ro} onClick={() => void act({ a: 'ast_seq', i, sym: SYM_NEXT(s) })} aria-label={`Casa ${i + 1}: ${s ?? 'vazia'}`}>
            {s ? <SymbolIcon sym={s} k={4} /> : <span className="lb-sym__q">{i + 1}</span>}
          </button>
        ))}
      </div>
      <StarPicker value={a.star} ro={ro} onPick={(s) => void act({ a: 'ast_star', s })} />
    </div>
  )
}

function BottomHalf({ g, act, ro }: TorrePuzzleProps) {
  const a = g.ast_baixo!
  const [num, setNum] = useState(a.num)
  useEffect(() => { setNum(a.num) }, [a.num])
  return (
    <div className="lb-lock">
      <p className="lb-lock__title">Face de baixo <span>· o número e a chave</span></p>
      <div className="lb-word">
        <input className="lb-input tor-input--num" inputMode="numeric" maxLength={3} value={num} disabled={ro} aria-label="O número"
          onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 3); setNum(v); void act({ a: 'ast_num', text: v }) }} />
        <button type="button" className="lb-btn" disabled={ro || a.key || !g.inv.chave} onClick={() => void act({ a: 'ast_key' })}>
          {a.key ? 'Chave posta' : g.inv.chave ? 'Pôr a chave' : 'Fechadura vazia'}
        </button>
      </div>
    </div>
  )
}

export function AstrarioPanel(props: TorrePuzzleProps & { floor: Floor }) {
  useTick(300)
  const { g, act, ro, clock, floor } = props
  const now = clock()
  const mine = g.side === 'todos' ? null : g.side
  const other = floor === 'cima' ? 'baixo' : 'cima'
  const otherGo = g.other[`${other}_go`]
  const otherReady = g.other[`${other}_ready`]
  const myGo = g.other[`${floor}_go`]

  return (
    <>
      <Diagram g={g} />
      {(mine === 'cima' || (mine === null && floor === 'cima')) && g.ast_cima && <TopHalf {...props} ro={ro || mine === null} />}
      {(mine === 'baixo' || (mine === null && floor === 'baixo')) && g.ast_baixo && <BottomHalf {...props} ro={ro || mine === null} />}
      {mine === null && floor === 'cima' && g.ast_baixo && <BottomHalf {...props} ro />}
      {mine === null && floor === 'baixo' && g.ast_cima && <TopHalf {...props} ro />}
      {!ro && mine && (
        <button type="button" className={`lb-btn lb-btn--gold${myGo && now - myGo < 3000 ? ' tor-go--on' : ''}`} onClick={() => void act({ a: 'go' })}>
          Girar a minha metade
        </button>
      )}
      <Hint>
        {otherGo && now - otherGo < 3000
          ? `O outro lado está girando agora!`
          : `Do outro lado: ${otherReady ? 'tudo posto.' : 'ainda falta.'} Os dois giram juntos.`}
      </Hint>
    </>
  )
}
