import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiceRoll } from '../../../../shared/types'
import { DEFAULT_SKIN } from '../../../dice3d/skins'
import { stageDiceFor } from './diceKinds'
import { freeLabel, isFreeRoll, readFree, resultsText } from './freeRoll'
import { useDiceStage } from './useDiceStage'
import '../components/DndSheet.css'
import '../components/DndMotion.css'
import './DndRolls.css'

// ────────────────────────────────────────────────────────
// O cartão de uma rolagem que não é teste (dano, dado de vida, rolagem livre):
// a mesma moldura do painel de teste, com o palco 3D, os dados rolando, os
// tiles e o total. Toda rolagem do D&D acontece num cartão destes ou no painel
// de teste; nenhuma cai solta pela tela.
//  - Vista por quem não rolou: moldura azul, etiqueta de quem está rolando, e
//    some sozinho depois do resultado.
//  - Da própria pessoa (`mine`): moldura dourada, fica até fechar no × ou Esc.
// ────────────────────────────────────────────────────────

interface Props {
  roll:   DiceRoll
  player: string
  /** Tem outra rolagem esperando: não demora no resultado. */
  hurry:  boolean
  onDone: () => void
  /** A rolagem é de quem está vendo (fica na tela até fechar). */
  mine?:  boolean
}

const HOLD_MS = 3600
const HOLD_FAST_MS = 1600
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export function DndWatchFreePanel({ roll, player, hurry, onDone, mine = false }: Props) {
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
  // a rolagem livre leva esse nome; dano, dado de vida e as outras levam o rótulo da ficha
  const title = isFreeRoll(roll) ? 'Rolagem livre' : roll.roll_label || 'Rolagem'

  useEffect(() => {
    if (!mine) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDoneRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mine])

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
      if (mine) return   // a da própria pessoa fica até ela fechar
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
      <div className={`dsh-sheet dcp dcp--free${mine ? ' dcp--mine' : ' dcp--watch'}${leaving ? ' is-leaving' : ''}`} role="status" aria-live="polite"
        aria-label={mine ? `${title}: rolando` : `${player} está rolando: ${title}`}>
        <button type="button" className="modal-close dcp__close" onClick={() => onDoneRef.current()} aria-label="Fechar">×</button>
        {!mine && (
          <div className="dcp__watchtag" title={roll.roll_context?.character ? `${player} rolando com ${roll.roll_context.character}` : undefined}>
            <span aria-hidden="true">◉</span> {player} {done ? 'rolou' : 'está rolando'}{roll.is_private && <span title="Rolagem privada"> 🔒</span>}
          </div>
        )}

        <div className="dcp__frame">
          <h3 className="dcp__title">{title}<span>{formula}{!mine && who !== player ? ` · ${who}` : ''}</span></h3>

          <div className="dcp__stage">
            <div ref={stageRef} className="dcp__canvas" data-insets="68,64" aria-hidden="true" />
            {simple && <span className="dcp__simple" aria-hidden="true">{spin ?? formula.split(' ')[0]}</span>}
            {!done && <span className="dcp__hint">{mine ? 'Rolando…' : `${who} está rolando…`}</span>}
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
