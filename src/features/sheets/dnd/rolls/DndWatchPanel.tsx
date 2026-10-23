import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiceRoll } from '../../../../shared/types'
import { DEFAULT_SKIN } from '../../../dice3d/skins'
import { playDiceFlourish } from '../../../dice3d/sound'
import { revealCheckDc } from '../services/dndCheckService'
import { judge, type CheckKind } from './checkModel'
import { stageDiceFor } from './diceKinds'
import { useDiceStage } from './useDiceStage'
import { watchedCheck } from './watchModel'
import './DndRolls.css'

// ────────────────────────────────────────────────────────
// O painel de teste visto por quem não rolou: o mesmo painel de quem rola
// (CD no topo, d20, bônus, Sucesso ou Falha, efeito no 20 e no 1), mas com o
// dado rolando sozinho, sem controles, na moldura azul e com a etiqueta de
// quem está rolando. Não bloqueia o site: some sozinho depois do resultado
// (mais rápido quando há outro teste esperando) ou no ×. Com a CD oculta, quem
// tem direito a ela (o mestre, ou quem já respondeu ao pedido) vê a CD e o
// resultado no fim; os outros só veem o dado e o total.
// ────────────────────────────────────────────────────────

interface Props {
  roll:   DiceRoll
  /** Nome da pessoa que rolou. */
  player: string
  /** Tem outro teste esperando: não demora no resultado. */
  hurry:  boolean
  onDone: () => void
}

const HOLD_MS = 3600
const HOLD_FAST_MS = 1600
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export function DndWatchPanel({ roll, player, hurry, onDone }: Props) {
  const w = useMemo(() => watchedCheck(roll), [roll])
  const skin = roll.dice_skin ?? DEFAULT_SKIN
  const stageRef = useRef<HTMLDivElement>(null)
  const { stage, simple } = useDiceStage(stageRef, 'stage')
  const [phase, setPhase] = useState<'rolling' | 'done'>('rolling')
  const [spin, setSpin] = useState<number | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [revealed, setRevealed] = useState<number | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const hurryRef = useRef(hurry)
  hurryRef.current = hurry

  useEffect(() => {
    if (!stage && !simple) return   // espera o motor 3D ligar
    let alive = true
    const timers: number[] = []
    const natural = w.reading.natural
    // todos os dados da rolagem (os d20 e os das reações)
    const dice = stageDiceFor(roll.roll_breakdown ?? [], skin)
    const play = stage ? stage.roll(dice, { skin }) : new Promise<void>((resolve) => {
      const end = performance.now() + 900
      const tick = () => { if (!alive) return resolve(); if (performance.now() < end) { setSpin(1 + Math.floor(Math.random() * 20)); requestAnimationFrame(tick) } else { setSpin(natural); resolve() } }
      tick()
    })
    void play.then(() => {
      if (!alive) return
      if (w.crit) playDiceFlourish(w.crit)
      setPhase('done')
      const requestId = roll.roll_context?.request_id
      if (w.dcHidden && requestId) void revealCheckDc(requestId).then((dc) => { if (alive && dc != null) setRevealed(dc) })
      const hold = hurryRef.current ? HOLD_FAST_MS : HOLD_MS
      timers.push(window.setTimeout(() => { if (alive) setLeaving(true) }, hold))
      timers.push(window.setTimeout(() => { if (alive) onDoneRef.current() }, hold + 360))
    })
    return () => { alive = false; timers.forEach((t) => window.clearTimeout(t)) }
    // só uma rolagem nova (ou o motor ficar pronto) reinicia
  }, [roll.id, stage, simple])

  const done = phase === 'done'
  const dcText = w.dcHidden ? (revealed != null ? String(revealed) : '?') : w.dc != null ? String(w.dc) : null
  const outcome = w.dcHidden
    ? (revealed != null && roll.roll_context?.kind ? judge(roll.roll_context.kind as CheckKind, w.reading.natural, w.reading.total, revealed).outcome : null)
    : w.outcome
  const resultClass = done ? `${outcome ? ` is-${outcome}` : ''}${w.crit ? ` is-${w.crit}` : ''}` : ''
  const who = w.character || player

  return (
    <div className="dwatch">
      <div className={`dsh-sheet dcp dcp--watch${resultClass}${leaving ? ' is-leaving' : ''}`} role="status" aria-live="polite" aria-label={`${player} está rolando ${w.label}`}>
        <button type="button" className="modal-close dcp__close" onClick={() => onDoneRef.current()} aria-label="Fechar">×</button>
        <div className="dcp__watchtag" title={w.character ? `${player} rolando com ${w.character}` : undefined}>
          <span aria-hidden="true">◉</span> {player} {done ? 'rolou' : 'está rolando'}{roll.is_private && <span title="Rolagem privada"> 🔒</span>}
        </div>

        <div className="dcp__frame">
          <div className="dcp__dc">
            {dcText ? <><small>Classe de dificuldade</small><strong className={w.dcHidden && revealed == null ? 'is-hidden' : ''}>{dcText}</strong></> : <small className="dcp__nodc">Sem CD</small>}
          </div>
          <h3 className="dcp__title">{w.label}{who !== player && <span>{who}</span>}</h3>

          <div className="dcp__stage">
            <div ref={stageRef} className="dcp__canvas" aria-hidden="true" />
            {simple && <span className="dcp__simple" aria-hidden="true">{spin ?? 'd20'}</span>}
            {!done && <span className="dcp__hint">{who} está rolando…</span>}
            {w.crit && done && <span className={`dcp__fx dcp__fx--${w.crit}`} aria-hidden="true" />}
          </div>

          {done && (
            <div className="dcp__result">
              <span className="dcp__natural">{w.reading.d20s.length > 1 ? `${w.reading.d20s.join(' e ')} → ` : ''}<strong>{w.reading.natural}</strong> no d20</span>
              <span className="dcp__total">Total <strong>{w.reading.total}</strong></span>
              {outcome && <span className={`dcp__outcome dcp__outcome--${outcome}`}>{outcome === 'success' ? 'Sucesso' : 'Falha'}</span>}
              {w.crit === 'crit' && <span className="dcp__critlabel">20 natural!</span>}
              {w.crit === 'fumble' && <span className="dcp__critlabel dcp__critlabel--bad">1 natural</span>}
              {w.dcHidden && revealed == null && <span className="dcp__nodcnote">A CD não foi revelada.</span>}
            </div>
          )}
        </div>

        <ul className="dcp__tiles" aria-label="Bônus">
          {w.bonus - w.situational !== 0 && (
            <li className="dcp__tile">
              <span className="dcp__tile-value">{signed(w.bonus - w.situational)}</span>
              <span className="dcp__tile-badge">+</span>
              <span className="dcp__tile-label">Bônus</span>
            </li>
          )}
          {w.situational !== 0 && (
            <li className="dcp__tile">
              <span className="dcp__tile-value">{signed(w.situational)}</span>
              <span className="dcp__tile-badge">±</span>
              <span className="dcp__tile-label">Situação</span>
            </li>
          )}
          {w.reactions.map((r, i) => (
            <li key={`${r.label}${i}`} className="dcp__tile dcp__tile--reaction">
              <span className="dcp__tile-value">{done ? `+${r.value}` : `d${r.die}`}</span>
              <span className="dcp__tile-badge">d{r.die}</span>
              <span className="dcp__tile-label">{r.label}</span>
            </li>
          ))}
          {w.bonus === 0 && w.reactions.length === 0 && <li className="dcp__tile dcp__tile--empty"><span className="dcp__tile-label">Sem bônus</span></li>}
        </ul>
        <div className="dcp__bonus">Bônus total <strong>{signed(w.bonus)}</strong>{w.reactions.length > 0 && <span> + {w.reactions.map((r) => `d${r.die}`).join(' + ')}</span>}</div>
      </div>
    </div>
  )
}
