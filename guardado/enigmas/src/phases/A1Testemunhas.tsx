import { useEffect, useState } from 'react'
import type { PhaseView } from '../enigmaService'
import { SceneShell } from '../stage/SceneShell'
import { useStage } from '../stage/Stage'
import type { Act, Proposal } from './common'
import { AlaIcon, BookIcon, DoorIcon, Drop, EyeIcon, QuillIcon, registerCast, Token } from './visual'

// ────────────────────────────────────────────────────────
// A1 · Testemunhas de Papel — a cena do Arquivo (quadro 1920×1080).
// No alto, a estante com os 5 livros (toca pra abrir) e o tinteiro. No
// meio, o corredor: a porta e as 5 alas. Embaixo, as fichas dos
// suspeitos: arrasta (ou toca e toca) uma ficha pra dentro da ala onde
// ela estava; o ✕ embaixo de cada ala marca "não estava".
//
// O Interrogador gasta tinta pra ler (vê o depoimento, nunca a tinta); o
// Cruzador vê a tinta de todos (fresca ou antiga), nunca o depoimento. O
// corredor é dos dois, ao vivo. Espectador e mestre veem tudo — o mestre,
// a verdade de cada depoimento só depois de "revelar".
// ────────────────────────────────────────────────────────

type DepTipo = 'is' | 'not' | 'left' | 'adj'
interface Item { id: string; n: number; read: boolean; texto?: string; tipo?: DepTipo; args?: [string, string]; tinta?: 'fresca' | 'antiga'; verdade?: boolean }
interface Book { id: string; titulo: string; sealed: boolean; items: Item[] }

interface A1View extends PhaseView {
  books: Book[]
  suspects: string[]
  alas: string[]
  alas_curtas: string[]
  marks: Record<string, 'x' | 'o'>
  inks: number
  inks_max: number
  wrong: number
  proposal: Proposal | null
  solucao?: Record<string, string>
}

/** A ala do ladrão (a Proibida; sem ela, a última). */
function forbiddenIndex(v: A1View) {
  const i = v.alas_curtas.indexOf('Proibida')
  return i >= 0 ? i : v.alas_curtas.length - 1
}

const shortTitle = (t: string) => t.replace(/^Livro (de|das|dos|do|da) /i, '')
const ROMAN = ['I', 'II', 'III', 'IV', 'V']
const SPINES = ['#7a2335', '#24456e', '#3f5a2a', '#5a3570', '#6b4a1f']

export function A1Testemunhas({ v: raw, act, readOnly }: { v: PhaseView; act: Act; readOnly: boolean }) {
  const v = raw as A1View
  registerCast(v.suspects)
  return (
    <SceneShell v={v} act={act} readOnly={readOnly} accuse={{ names: v.suspects, proposal: v.proposal, label: 'Quem roubou o Registro?' }}>
      <A1Scene v={v} act={act} readOnly={readOnly} />
    </SceneShell>
  )
}

function A1Scene({ v, act, readOnly }: { v: A1View; act: Act; readOnly: boolean }) {
  const { beginDrag } = useStage()
  const fi = forbiddenIndex(v)
  const reader = !readOnly && v.role === 'interrogador'
  const [openBook, setOpenBook] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // A marca aparece na hora; a do servidor manda quando chega.
  const [pending, setPending] = useState<Record<string, string>>({})
  useEffect(() => { setPending({}) }, [v.marks])

  const mark = (cell: string) => (cell in pending ? pending[cell] : v.marks[cell] ?? '')
  const inAla = (i: number) => v.suspects.filter((s) => mark(`${s}|${i}`) === 'o')
  const placed = (s: string) => v.alas_curtas.some((_, i) => mark(`${s}|${i}`) === 'o')

  function send(changes: Record<string, string>) {
    setPending((p) => ({ ...p, ...changes }))
    for (const [cell, value] of Object.entries(changes)) void act({ a: 'mark', cell, value })
  }
  /** Põe a ficha numa ala (tira das outras) — ou devolve pro banco (null). */
  function place(s: string, i: number | null) {
    const ch: Record<string, string> = {}
    v.alas_curtas.forEach((_, j) => { if (j !== i && mark(`${s}|${j}`) === 'o') ch[`${s}|${j}`] = '' })
    if (i !== null && mark(`${s}|${i}`) !== 'o') ch[`${s}|${i}`] = 'o'
    if (Object.keys(ch).length) send(ch)
    setSel(null)
  }
  function toggleX(s: string, i: number) {
    const c = `${s}|${i}`
    send({ [c]: mark(c) === 'x' ? '' : 'x' })
  }
  function grab(e: React.PointerEvent, s: string) {
    if (readOnly) return
    beginDrag(e, <Token name={s} size={104} />, (t) => {
      if (t === 'bench') place(s, null)
      else if (t?.startsWith('ala-')) place(s, Number(t.slice(4)))
    }, () => setSel((cur) => (cur === s ? null : s)))
  }
  async function read(id: string) {
    setBusy(id)
    try { await act({ a: 'read', item: id }) } finally { setBusy(null) }
  }

  const book = v.books.find((b) => b.id === openBook) ?? null
  const bi = book ? v.books.indexOf(book) : -1

  return (
    <>
      <svg className="es-bg" viewBox="0 0 1920 1080" aria-hidden="true">
        <defs>
          <linearGradient id="a1-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#211829" /><stop offset="1" stopColor="#120d19" />
          </linearGradient>
          <pattern id="a1-bricks" width="140" height="64" patternUnits="userSpaceOnUse">
            <path d="M0 1H140M0 33H140M70 1V33M1 33V64M139 33V64" stroke="rgba(255,255,255,0.04)" strokeWidth="2" fill="none" />
          </pattern>
          <radialGradient id="a1-glow"><stop offset="0" stopColor="rgba(255,190,100,0.28)" /><stop offset="1" stopColor="rgba(255,190,100,0)" /></radialGradient>
          <linearGradient id="a1-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5a3a20" /><stop offset="1" stopColor="#2e1c0f" /></linearGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#a1-wall)" />
        <rect width="1920" height="880" fill="url(#a1-bricks)" />
        <circle cx="530" cy="70" r="260" fill="url(#a1-glow)" />
        <circle cx="1430" cy="70" r="260" fill="url(#a1-glow)" />
        <rect y="880" width="1920" height="200" fill="#0d0a12" />
        {[0, 1, 2, 3].map((k) => <line key={k} x1="0" x2="1920" y1={900 + k * 46} y2={900 + k * 46} stroke="rgba(255,255,255,0.03)" strokeWidth="2" />)}
        {/* estante */}
        <rect x="540" y="28" width="880" height="22" rx="4" fill="url(#a1-wood)" />
        <rect x="540" y="306" width="880" height="30" rx="4" fill="url(#a1-wood)" />
        <rect x="540" y="28" width="18" height="308" fill="#3b2616" />
        <rect x="1402" y="28" width="18" height="308" fill="#3b2616" />
        {/* velas */}
        {[530, 1430].map((x) => (
          <g key={x} transform={`translate(${x} 20)`}>
            <rect x="-9" y="40" width="18" height="60" rx="3" fill="#e8dcc0" />
            <path d="M0 8c7 10 7 20 0 28c-7-8-7-18 0-28z" fill="#ffcf6a" />
          </g>
        ))}
      </svg>

      {/* Placa: objetivo e regras em figura */}
      <div className="es-plaque" title={(v.regras ?? []).join(' ')}>
        <div className="es-goal">
          <Token name="?" size={64} />
          <span className="es-goal__op">→</span>
          <span className="es-alachip is-forbidden"><AlaIcon name={v.alas_curtas[fi]} i={fi} size={44} /></span>
          <span className="es-goal__op">=</span>
          <span className="es-goal__word">ladrão</span>
        </div>
        <ul className="es-laws">
          <li><BookIcon size={40} /><b className="es-gold">1</b><b className="is-no">✕</b> por livro</li>
          <li><Drop kind="fresca" size={40} /> pode mentir</li>
          <li><Drop kind="antiga" size={40} /> <span className="en-ok">verdade</span></li>
        </ul>
      </div>

      {/* Estante */}
      {v.books.map((b, k) => (
        <button
          key={b.id}
          type="button"
          className={`es-spine${b.sealed ? ' is-sealed' : ''}`}
          style={{ left: 572 + k * 168, top: 66, background: `linear-gradient(90deg, ${SPINES[k % SPINES.length]}, #1a1020 140%)` }}
          onClick={() => setOpenBook(b.id)}
          aria-label={`Abrir ${b.titulo}${b.sealed ? ' (lacrado)' : ''}`}
        >
          <span className="es-spine__band" />
          <span className="es-spine__title">{shortTitle(b.titulo)}</span>
          <span className="es-spine__dots">
            {b.items.map((it) => (
              <span key={it.id} className={`es-spine__dot${it.read ? ' is-read' : ''}`}>
                {it.tinta ? <Drop kind={it.tinta} size={30} /> : it.read ? '✓' : ''}
              </span>
            ))}
          </span>
          {b.sealed && <span className="es-seal" aria-hidden="true">✦</span>}
        </button>
      ))}

      {/* Tinteiro */}
      <div className={`es-inkwell${v.inks === 0 ? ' is-empty' : ''}`} aria-label={`Tintas: ${v.inks} de ${v.inks_max}`}>
        <svg viewBox="0 0 200 220" width="170" height="187" aria-hidden="true">
          <defs><clipPath id="a1-bottle"><path d="M70 30h60v40c40 10 60 40 60 80 0 40-30 60-90 60S10 190 10 150c0-40 20-70 60-80z" /></clipPath></defs>
          <path d="M70 30h60v40c40 10 60 40 60 80 0 40-30 60-90 60S10 190 10 150c0-40 20-70 60-80z" fill="rgba(255,255,255,0.06)" stroke="rgba(214,196,255,0.4)" strokeWidth="4" />
          <rect x="0" y={210 - 140 * Math.min(1, v.inks / Math.max(1, v.inks_max))} width="200" height="220" fill="#28307a" clipPath="url(#a1-bottle)" />
          <rect x="62" y="14" width="76" height="22" rx="6" fill="#3b2616" />
          <path d="M150 4c-30 20-40 60-40 120" stroke="#e8dcc0" strokeWidth="5" fill="none" />
        </svg>
        <span className="es-inkwell__n">{v.inks}<small>/{v.inks_max}</small></span>
        {v.inks === 0 && <span className="es-inkwell__warn">secou — peça ao mestre</span>}
      </div>

      {/* Corredor: a porta e as alas */}
      <div className="es-door" aria-hidden="true">
        <DoorIcon size={150} />
        <span>entrada</span>
      </div>
      {v.alas_curtas.map((a, i) => {
        const here = inAla(i)
        const sol = v.solucao ? Object.entries(v.solucao).find(([, ala]) => ala === a)?.[0] : null
        return (
          <section
            key={a}
            className={`es-arch${i === fi ? ' is-forbidden' : ''}${sel ? ' is-target' : ''}`}
            style={{ left: 250 + i * 330 }}
            aria-label={v.alas[i]}
            data-drop={`ala-${i}`}
            onClick={() => { if (sel && !readOnly) place(sel, i) }}
          >
            <header className="es-arch__head" title={v.alas[i]}>
              <AlaIcon name={a} i={i} size={52} />
              <span className="es-arch__name"><b>{i}</b> {a}</span>
              {sol && <span className="es-arch__sol" title="Solução"><Token name={sol} size={44} /></span>}
            </header>
            <div className="es-arch__inside">
              {here.map((s) => (
                <span key={s} className={`es-piece${sel === s ? ' is-sel' : ''}`} onPointerDown={(e) => { e.stopPropagation(); grab(e, s) }} onClick={(e) => e.stopPropagation()}>
                  <Token name={s} size={96} />
                </span>
              ))}
            </div>
            <div className="es-arch__nots" aria-label="Não estava aqui">
              {v.suspects.map((s) => {
                const x = mark(`${s}|${i}`) === 'x'
                return (
                  <button key={s} type="button" className={`es-not${x ? ' is-x' : ''}`} disabled={readOnly} onClick={(e) => { e.stopPropagation(); toggleX(s, i) }} aria-label={`${s} ${x ? 'não estava' : 'sem marca'} na ${v.alas[i]}`} title={s}>
                    {s.charAt(0)}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* Banco das fichas */}
      <div className="es-bench" data-drop="bench" aria-label="Fichas dos suspeitos">
        {v.suspects.map((s) => (
          <span
            key={s}
            className={`es-piece es-piece--bench${placed(s) ? ' is-placed' : ''}${sel === s ? ' is-sel' : ''}`}
            onPointerDown={(e) => grab(e, s)}
            role={readOnly ? undefined : 'button'}
            aria-pressed={readOnly ? undefined : sel === s}
          >
            <Token name={s} size={92} />
            <span className="es-piece__name">{s}</span>
          </span>
        ))}
      </div>

      {/* Livro aberto */}
      {book && (
        <div className="es-overlay" onClick={() => setOpenBook(null)}>
          <div className="es-openbook" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={book.titulo}>
            <div className="es-openbook__page es-openbook__left">
              <BookIcon size={64} />
              <h3 className="es-openbook__title">{book.titulo}</h3>
              {book.sealed && <p className="es-openbook__sealed"><span className="es-seal es-seal--inline">✦</span> lacrado</p>}
              {reader && !book.sealed && <p className="es-openbook__hint"><QuillIcon size={44} /> ler = <span className="en-well is-full es-well-big" /> 1 tinta</p>}
              <div className="es-openbook__nav">
                <button type="button" className="es-navbtn" disabled={bi <= 0} onClick={() => setOpenBook(v.books[bi - 1]?.id ?? null)} aria-label="Livro anterior">‹</button>
                <button type="button" className="es-navbtn" disabled={bi >= v.books.length - 1} onClick={() => setOpenBook(v.books[bi + 1]?.id ?? null)} aria-label="Próximo livro">›</button>
              </div>
            </div>
            <ol className="es-openbook__page es-openbook__right">
              {book.items.map((it) => (
                <li key={it.id} className={`es-entry${it.verdade === false ? ' is-lie' : ''}`}>
                  <span className="es-entry__n">{ROMAN[it.n - 1] ?? it.n}</span>
                  {it.tinta && <Drop kind={it.tinta} size={52} />}
                  <div className="es-entry__body">
                    {it.tipo && it.args
                      ? <Testimony v={v} fi={fi} tipo={it.tipo} args={it.args} texto={it.texto} />
                      : it.texto
                        ? <p className="es-entry__text">{it.texto}</p>
                        : it.read
                          ? <span className="es-entry__seen"><EyeIcon size={40} /> lido</span>
                          : reader
                            ? (
                              <button type="button" className="es-readbtn" disabled={book.sealed || v.inks <= 0 || busy === it.id} onClick={() => void read(it.id)} aria-label={`Ler o depoimento ${it.n} (gasta 1 tinta)`}>
                                <QuillIcon size={40} /> Ler
                              </button>
                            )
                            : <span className="es-entry__blank" aria-label="Não lido" />}
                  </div>
                  {it.verdade !== undefined && <span className={`es-entry__truth${it.verdade ? '' : ' is-lie'}`} title={it.verdade ? 'verdade' : 'mentira'}>{it.verdade ? '✓' : '✕'}</span>}
                </li>
              ))}
            </ol>
            <button type="button" className="es-close" onClick={() => setOpenBook(null)} aria-label="Fechar o livro">✕</button>
          </div>
        </div>
      )}
    </>
  )
}

/** Um depoimento lido, em figura (o texto completo vai no title e pro leitor de tela). */
function Testimony({ v, fi, tipo, args, texto }: { v: A1View; fi: number; tipo: DepTipo; args: [string, string]; texto?: string }) {
  const [s, t] = args
  const ai = v.alas_curtas.indexOf(t)
  return (
    <div className="es-testimony" title={texto}>
      {(tipo === 'is' || tipo === 'not') && (
        <>
          <Token name={s} size={88} showName />
          <span className="es-testimony__op">{tipo === 'is' ? 'estava na' : 'não estava na'}</span>
          <span className={`es-alachip${ai === fi ? ' is-forbidden' : ''}`}><AlaIcon name={t} i={ai} size={56} /><b>{ai}</b></span>
          <span className={`es-testimony__mark ${tipo === 'is' ? 'is-yes' : 'is-no'}`} aria-hidden="true">{tipo === 'is' ? '●' : '✕'}</span>
        </>
      )}
      {tipo === 'left' && (
        <>
          <span className="es-testimony__door"><DoorIcon size={70} /></span>
          <Token name={s} size={88} showName />
          <span className="es-testimony__big" aria-hidden="true">‹</span>
          <Token name={t} size={88} showName />
          <span className="es-testimony__op">mais perto da porta</span>
        </>
      )}
      {tipo === 'adj' && (
        <>
          <Token name={s} size={88} showName />
          <span className="es-testimony__big" aria-hidden="true">⟷</span>
          <Token name={t} size={88} showName />
          <span className="es-testimony__op">alas vizinhas</span>
        </>
      )}
      {texto && <span className="en-sr">{texto}</span>}
    </div>
  )
}
