import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiceRoll } from '../../../../shared/types'
import { DEFAULT_SKIN } from '../../../dice3d/skins'
import { stageDiceFor } from './diceKinds'
import { freeLabel, readFree, resultsText } from './freeRoll'
import { useDiceStage } from './useDiceStage'
import './DndRolls.css'

// ────────────────────────────────────────────────────────
// A rolagem livre de outra pessoa, vista por quem não rolou: o mesmo painel
// de quem rola (moldura azul, etiqueta de quem está rolando, dados rolando
// sozinhos, tiles e total). Some sozinho depois do resultado, como o painel de
// teste dos outros.
// ────────────────────────────────────────────────────────

interface Props {
  roll:   DiceRoll
  player: string
  /** Tem outra rolagem esperando: não demora no resultado. */
  hurry:  boolean
  onDone: () => void
}

const HOLD_MS = 3600
const HOLD_FAST_MS = 1600
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export function DndWatchFreePanel({ roll, player, hurry, onDone }: Props) {
  const reading = useMemo(() => readFree(roll.roll_breakdown ?? [], roll.result), [roll])
  const skin = roll.dice_skin ?? DEFAULT_SKIN
  const stageRef = useRef<HTMLDivElement>(null)
  const { stage, simple } = useDiceStage(stageRef, 'wide')
  const [phase, setPhase] = useState<'rolling' | 'done'>('rolling')
  const [spin, setSpin] = useState<number | null>(null)
  const [leaving, setLeaving] = useState(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const hurryRef = useRef(hurry)
  hurryRef.current = hurry
  const who = roll.roll_context?.character || player
  const formula = roll.formula ? freeLabel(roll.formula) : ''

  useEffect(() => {
    if (!stage && !simple) return   // espera o motor 3D ligar
    let alive = true
    const timers: number[] = []
    const dice = stageDiceFor(roll.roll_breakdown ?? [], skin)
    const play = stage ? stage.roll(dice, { skin }) : new Promise<void>((resolve) => {
      const end = performance.now() + 900
      const tick = () => { if (!alive) return resolve(); if (performance.now() < end) { setSpin(1 + Math.floor(Math.random() * 20)); requestAnimationFrame(tick) } else { setSpin(reading.total); resolve() } }
      tick()
    })
    void play.then(() => {
      if (!alive) return
      setPhase('done')
      const hold = hurryRef.current ? HOLD_FAST_MS : HOLD_MS
      timers.push(window.setTimeout(() => { if (alive) setLeaving(true) }, hold))
      timers.push(window.setTimeout(() => { if (alive) onDoneRef.current() }, hold + 360))
    })
    return () => { alive = false; timers.forEach((t) => window.clearTimeout(t)) }
    // só uma rolagem nova (ou o motor ficar pronto) reinicia
  }, [roll.id, stage, simple])

  const done = phase === 'done'
  return (
    <div className="dwatch">
      <div className={`dsh-sheet dcp dcp--free dcp--watch${leaving ? ' is-leaving' : ''}`} role="status" aria-live="polite" aria-label={`${player} está fazendo uma rolagem livre`}>
        <button type="button" className="modal-close dcp__close" onClick={() => onDoneRef.current()} aria-label="Fechar">×</button>
        <div className="dcp__watchtag" title={roll.roll_context?.character ? `${player} rolando com ${roll.roll_context.character}` : undefined}>
          <span aria-hidden="true">◉</span> {player} {done ? 'rolou' : 'está rolando'}{roll.is_private && <span title="Rolagem privada"> 🔒</span>}
        </div>

        <div className="dcp__frame">
          <h3 className="dcp__title">Rolagem livre<span>{formula}{who !== player ? ` · ${who}` : ''}</span></h3>

          <div className="dcp__stage">
            <div ref={stageRef} className="dcp__canvas" data-insets="68,64" aria-hidden="true" />
            {simple && <span className="dcp__simple" aria-hidden="true">{spin ?? formula.split(' ')[0]}</span>}
            {!done && <span className="dcp__hint">{who} está rolando…</span>}
          </div>

          {done && (
            <div className="dcp__result">
              <span className="dcp__total">Total <strong>{reading.total}</strong></span>
            </div>
          )}
        </div>

        <ul className="dcp__tiles" aria-label="Dados">
          {reading.groups.map((g, i) => (
            <li key={`${g.sides}${i}`} className="dcp__tile dcp__tile--reaction" title={done ? resultsText(g) : undefined}>
              <span className="dcp__tile-value">{done ? g.subtotal : `${g.results.length}d${g.sides}`}</span>
              <span className="dcp__tile-badge">d{g.sides}</span>
              <span className="dcp__tile-label">{done ? `${g.results.length}d${g.sides}: ${resultsText(g)}` : `${g.results.length} ${g.results.length === 1 ? 'dado' : 'dados'}`}</span>
            </li>
          ))}
          {reading.modifier !== 0 && (
            <li className="dcp__tile">
              <span className="dcp__tile-value">{signed(reading.modifier)}</span>
              <span className="dcp__tile-badge">+</span>
              <span className="dcp__tile-label">Bônus</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
