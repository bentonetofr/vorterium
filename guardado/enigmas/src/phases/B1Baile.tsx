import { useEffect, useRef, useState } from 'react'
import type { PhaseView } from '../enigmaService'
import { fmtClock } from '../useEnigmaRoom'
import { SceneShell } from '../stage/SceneShell'
import { useStage } from '../stage/Stage'
import type { Act, Proposal } from './common'
import { Mask, OpDiagram, opLabel, registerCast, seatXY, Token } from './visual'

// ────────────────────────────────────────────────────────
// B1 · O Baile em 3 Valsas — a cena do Salão (quadro 1920×1080).
// No alto, o relógio da torre e a porta; no meio, as 8 cadeiras em
// círculo (0 na porta, sentido horário). À esquerda, as valsas (Início,
// 1ª, 2ª, 3ª) com o desenho da dança; à direita, a bandeja com as peças
// do papel: Máscaras arrasta as máscaras pras cadeiras, Nomes arrasta as
// pessoas (ou toca e toca). O parceiro vê ao vivo. Juntos acham onde a
// Raposa termina e quem está lá. O relógio zerar é só um aviso pro mestre.
// ────────────────────────────────────────────────────────

interface Rule { n: number; texto: string; op: string; k?: number | null }
interface B1View extends PhaseView {
  seats: number
  scratch: string
  board: Record<string, string>
  wrong: number
  deadline: number
  guests: string[]
  proposal: Proposal | null
  masks?: string[]
  mask_rules?: Rule[]
  people?: string[]
  people_rules?: Rule[]
  motivos?: { nome: string; texto: string }[]
  operacoes: Record<string, string>
  solucao?: { assento: number; culpado: string; esperado: { mascaras: string[]; pessoas: string[] } }
}

const CX = 960
const CY = 622
const R = 318

export function B1Baile({ v: raw, act, readOnly, now }: { v: PhaseView; act: Act; readOnly: boolean; now: number }) {
  const v = raw as B1View
  registerCast(v.guests)
  const tools = [
    ...(v.motivos ? [{ id: 'guests', icon: '🎭', label: 'Motivos', title: 'Os convidados', panel: <Guests v={v} /> }] : []),
    { id: 'notes', icon: '✒️', label: 'Anotações', badge: !!v.scratch, panel: <Notes value={v.scratch} act={act} readOnly={readOnly} /> },
  ]
  return (
    <SceneShell v={v} act={act} readOnly={readOnly} accuse={{ names: v.guests, proposal: v.proposal, label: 'Quem usava a Raposa?' }} tools={tools} bannerStyle={{ left: 1040, top: 24, bottom: 'auto', width: 390 }}>
      <B1Scene v={v} act={act} readOnly={readOnly} now={now} />
    </SceneShell>
  )
}

function B1Scene({ v, act, readOnly, now }: { v: B1View; act: Act; readOnly: boolean; now: number }) {
  const { beginDrag } = useStage()
  const n = v.seats || 8
  const [step, setStep] = useState(1)
  const [sel, setSel] = useState<string | null>(null)
  // A peça aparece na hora; a do servidor manda quando chega.
  const [pending, setPending] = useState<Record<string, string>>({})
  useEffect(() => { setPending({}) }, [v.board])
  useEffect(() => { setSel(null) }, [step])

  const kind: 'm' | 'p' | null = readOnly ? null : v.role === 'mascaras' ? 'm' : v.role === 'nomes' ? 'p' : null
  const pieces = kind === 'm' ? v.masks ?? [] : kind === 'p' ? v.people ?? [] : []
  const editable = step > 0 && !!kind
  const get = (cell: string) => (cell in pending ? pending[cell] : v.board?.[cell] ?? '')
  const at = (i: number) => step === 0
    ? { m: v.masks?.[i] ?? '', p: v.people?.[i] ?? '' }
    : { m: get(`${step}|${i}|m`), p: get(`${step}|${i}|p`) }
  const seatOf = (piece: string) => Array.from({ length: n }, (_, i) => i).find((i) => kind && get(`${step}|${i}|${kind}`) === piece) ?? null

  function send(changes: Record<string, string>) {
    setPending((p) => ({ ...p, ...changes }))
    for (const [cell, value] of Object.entries(changes)) void act({ a: 'board', cell, value })
  }
  /** Põe a peça na cadeira (cada peça fica numa cadeira só; quem estava lá troca de lugar). */
  function put(piece: string, seat: number | null) {
    if (!kind || step === 0) return
    const from = seatOf(piece)
    const ch: Record<string, string> = {}
    if (seat === null) { if (from !== null) ch[`${step}|${from}|${kind}`] = '' }
    else if (from !== seat) {
      const there = get(`${step}|${seat}|${kind}`)
      if (from !== null) ch[`${step}|${from}|${kind}`] = there
      ch[`${step}|${seat}|${kind}`] = piece
    }
    if (Object.keys(ch).length) send(ch)
    setSel(null)
  }
  function grab(e: React.PointerEvent, piece: string) {
    if (!editable) return
    const ghost = kind === 'm' ? <Mask name={piece} size={80} /> : <Token name={piece} size={90} />
    beginDrag(e, ghost, (t) => {
      if (t === 'tray') put(piece, null)
      else if (t?.startsWith('seat-')) put(piece, Number(t.slice(5)))
    }, () => setSel((cur) => (cur === piece ? null : piece)))
  }

  const rules = [
    ...(v.mask_rules ?? []).filter((r) => r.n === step).map((r) => ({ ...r, who: 'm' as const })),
    ...(v.people_rules ?? []).filter((r) => r.n === step).map((r) => ({ ...r, who: 'p' as const })),
  ]
  const left = v.deadline - now
  const mins = Math.max(0, left) / 60000
  const handDeg = -(mins / 60) * 360

  return (
    <>
      <svg className="es-bg" viewBox="0 0 1920 1080" aria-hidden="true">
        <defs>
          <radialGradient id="b1-hall" cx="50%" cy="20%" r="80%">
            <stop offset="0" stopColor="#1f2142" /><stop offset="1" stopColor="#0b0a16" />
          </radialGradient>
          <radialGradient id="b1-chand"><stop offset="0" stopColor="rgba(255,214,140,0.35)" /><stop offset="1" stopColor="rgba(255,214,140,0)" /></radialGradient>
          <pattern id="b1-floor" width="90" height="90" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="45" height="45" fill="rgba(255,255,255,0.035)" /><rect x="45" y="45" width="45" height="45" fill="rgba(255,255,255,0.035)" />
          </pattern>
          <clipPath id="b1-floor-clip"><ellipse cx={CX} cy={CY} rx="430" ry="420" /></clipPath>
        </defs>
        <rect width="1920" height="1080" fill="url(#b1-hall)" />
        {/* colunas */}
        {[470, 1450].map((x) => <rect key={x} x={x} y="0" width="34" height="1080" fill="rgba(255,255,255,0.03)" />)}
        <circle cx={CX} cy="40" r="380" fill="url(#b1-chand)" />
        <ellipse cx={CX} cy={CY} rx="430" ry="420" fill="#141530" />
        <rect width="1920" height="1080" fill="url(#b1-floor)" clipPath="url(#b1-floor-clip)" />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(214,196,255,0.22)" strokeWidth="3" strokeDasharray="10 14" />
        {/* porta */}
        <g transform={`translate(${CX} 34)`}>
          <path d="M-56 120V40a56 56 0 0 1 112 0v80z" fill="#2a1a12" stroke="#e2b65a" strokeWidth="4" />
          <line x1="0" y1="-16" x2="0" y2="120" stroke="#e2b65a" strokeWidth="3" opacity="0.6" />
        </g>
      </svg>
      <span className="es-door-label" style={{ left: CX, top: 150 }}>porta</span>

      {/* Relógio da torre */}
      <div className={`es-clock${left <= 0 ? ' is-over' : left < 60000 ? ' is-low' : ''}`} aria-label="Relógio da torre">
        <svg viewBox="-100 -100 200 200" width="170" height="170" aria-hidden="true">
          <circle r="92" fill="#e9dfc6" stroke="#5a3d12" strokeWidth="8" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2
            return <line key={i} x1={Math.sin(a) * 70} y1={-Math.cos(a) * 70} x2={Math.sin(a) * 82} y2={-Math.cos(a) * 82} stroke="#2a2230" strokeWidth={i === 0 ? 7 : 3} />
          })}
          <line x1="0" y1="0" x2="0" y2="-46" stroke="#2a2230" strokeWidth="8" strokeLinecap="round" />
          <line x1="0" y1="0" x2="0" y2="-74" stroke="#8a2f45" strokeWidth="5" strokeLinecap="round" transform={`rotate(${handDeg})`} />
          <circle r="7" fill="#2a2230" />
        </svg>
        <span className="es-clock__time">{left <= 0 ? 'Meia-noite' : fmtClock(left)}</span>
      </div>

      {/* Objetivo */}
      <div className="es-plaque es-plaque--b1">
        <div className="es-goal">
          <Mask name="Raposa" size={64} />
          <span className="es-goal__op">=</span>
          <span className="es-goal__word">assassino</span>
        </div>
        {v.solucao && (
          <div className="es-goal es-goal--sol" title="Solução (só você vê)">
            <Mask name="Raposa" size={40} /><span className="es-goal__op">→</span><b>{v.solucao.assento}</b><span className="es-goal__op">→</span><Token name={v.solucao.culpado} size={52} showName />
          </div>
        )}
      </div>

      {/* Valsas */}
      <div className="es-steps" role="tablist" aria-label="Momento do baile">
        {['Início', '1ª valsa', '2ª valsa', '3ª valsa'].map((t, i) => (
          <button key={t} type="button" role="tab" aria-selected={step === i} className={`es-step${step === i ? ' is-on' : ''}`} onClick={() => setStep(i)}>
            {i === 0 ? '♫ ' : <span className="es-step__n">{i}</span>}{i === 0 ? t : t.slice(1)}
          </button>
        ))}
      </div>
      <div className="es-dances">
        {step === 0
          ? <p className="es-dances__note">Onde cada um começou.</p>
          : rules.map((r) => (
            <figure key={r.who} className={`es-dance es-dance--${r.who}`} title={`${r.texto} ${v.operacoes[r.op] ?? ''}`}>
              <OpDiagram op={r.op} k={r.k} n={n} size={rules.length > 1 ? 170 : 250} tone={r.who === 'm' ? 'gold' : 'blue'} />
              <figcaption>{r.who === 'm' ? '🎭' : '👤'} {opLabel(r.op, r.k)}</figcaption>
              <span className="en-sr">{r.texto} {v.operacoes[r.op]}</span>
            </figure>
          ))}
      </div>

      {/* Cadeiras */}
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = seatXY(i, n, R)
        const s = at(i)
        const mine = kind === 'm' ? s.m : kind === 'p' ? s.p : ''
        return (
          <div
            key={i}
            className={`es-seat${s.m === 'Raposa' ? ' is-fox' : ''}${sel && editable ? ' is-target' : ''}${v.solucao && step === 3 && i === v.solucao.assento ? ' is-sol' : ''}`}
            style={{ left: CX + x, top: CY + y }}
            data-drop={editable ? `seat-${i}` : undefined}
            onClick={() => { if (sel && editable) put(sel, i) }}
            aria-label={`Cadeira ${i}: ${s.m || 'máscara ?'}, ${s.p || 'pessoa ?'}`}
          >
            <span className="es-seat__n">{i}</span>
            <span
              className={`es-seat__m${kind === 'm' && editable && s.m ? ' is-mine' : ''}`}
              onPointerDown={kind === 'm' && editable && s.m ? (e) => { e.stopPropagation(); grab(e, mine) } : undefined}
            >
              {s.m ? <Mask name={s.m} size={62} /> : <span className="es-q">?</span>}
            </span>
            <span
              className={`es-seat__p${kind === 'p' && editable && s.p ? ' is-mine' : ''}`}
              onPointerDown={kind === 'p' && editable && s.p ? (e) => { e.stopPropagation(); grab(e, mine) } : undefined}
            >
              {s.p ? <Token name={s.p} size={58} /> : <span className="es-q">?</span>}
            </span>
          </div>
        )
      })}

      {/* Bandeja */}
      <div className={`es-tray${editable ? '' : ' is-off'}`} data-drop="tray" aria-label={kind === 'm' ? 'Máscaras' : kind === 'p' ? 'Pessoas' : 'Peças'}>
        {kind ? (
          <>
            <p className="es-tray__title">{kind === 'm' ? '🎭 Máscaras' : '👤 Pessoas'}</p>
            <div className="es-tray__grid">
              {pieces.map((pc) => (
                <span
                  key={pc}
                  className={`es-tile${seatOf(pc) !== null ? ' is-used' : ''}${sel === pc ? ' is-sel' : ''}`}
                  onPointerDown={(e) => grab(e, pc)}
                  role={editable ? 'button' : undefined}
                  aria-pressed={editable ? sel === pc : undefined}
                  title={pc}
                >
                  {kind === 'm' ? <Mask name={pc} size={60} /> : <Token name={pc} size={64} />}
                  <span className="es-tile__name">{pc}</span>
                </span>
              ))}
            </div>
            {step === 0 && <p className="es-tray__note">Escolha uma valsa ←</p>}
          </>
        ) : (
          <p className="es-tray__note">{v.role === 'mestre' ? 'Visão do mestre' : 'Assistindo'}</p>
        )}
      </div>
    </>
  )
}

function Guests({ v }: { v: B1View }) {
  return (
    <ul className="en-guests">
      {(v.motivos ?? []).map((m) => (
        <li key={m.nome} className="en-guest">
          <Token name={m.nome} size={40} />
          <span><strong>{m.nome}.</strong> {m.texto}</span>
        </li>
      ))}
    </ul>
  )
}

/** Anotações da dupla (salvam sozinhas, ½ s depois de parar de digitar). */
function Notes({ value, act, readOnly }: { value: string; act: Act; readOnly: boolean }) {
  const [text, setText] = useState(value)
  const typing = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  // Texto novo do parceiro: entra, se não estou digitando agora.
  useEffect(() => { if (!typing.current) setText(value) }, [value])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <textarea
      className="en-scratch"
      value={text}
      readOnly={readOnly}
      maxLength={4000}
      aria-label="Anotações da dupla"
      placeholder="Os dois escrevem aqui."
      onChange={(e) => {
        const t = e.target.value
        setText(t)
        typing.current = true
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => {
          void Promise.resolve(act({ a: 'scratch', text: t })).finally(() => { typing.current = false })
        }, 500)
      }}
    />
  )
}
