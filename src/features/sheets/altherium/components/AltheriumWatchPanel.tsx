import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiceRoll } from '../../../../shared/types'
import { DEFAULT_SKIN } from '../../../dice3d/skins'
import { stageDiceFor } from '../../dnd/rolls/diceKinds'
import { miniRoll } from '../../dnd/rolls/miniRoll'
import { readFree } from '../../dnd/rolls/freeRoll'
import { useDiceStage } from '../../dnd/rolls/useDiceStage'
import './AltheriumDiceCard.css'
import './AltheriumMotion.css'

// ────────────────────────────────────────────────────────
// A rolagem de outra pessoa (jogador ou mestre), vista por quem não rolou, no
// modo "Normal" de Configurações > Aparência > Dados na tela: o mesmo painel
// do rolador, só com o telão. Os dados rolam na skin de quem rolou, o total e a
// conta aparecem embaixo, e o painel some sozinho depois. Não escurece o fundo.
// ────────────────────────────────────────────────────────

interface Props {
  roll:   DiceRoll
  player: string
  /** Tem outra rolagem esperando: não demora no resultado. */
  hurry:  boolean
  onDone: () => void
}

const HOLD_MS = 3800
const HOLD_FAST_MS = 1700

export function AltheriumWatchPanel({ roll, player, hurry, onDone }: Props) {
  const m = useMemo(() => miniRoll(roll, player), [roll, player])
  const total = useMemo(() => readFree(roll.roll_breakdown ?? [], roll.result).total, [roll])
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

  useEffect(() => {
    if (!stage && !simple) return   // espera o motor 3D ligar
    let alive = true
    const timers: number[] = []
    const dice = stageDiceFor(roll.roll_breakdown ?? [], skin)
    const play = stage ? stage.roll(dice, { skin }) : new Promise<void>((resolve) => {
      const end = performance.now() + 900
      const tick = () => { if (!alive) return resolve(); if (performance.now() < end) { setSpin(1 + Math.floor(Math.random() * 20)); requestAnimationFrame(tick) } else { setSpin(total); resolve() } }
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
    <div className="alth-dicehub">
      <div className={`alth-dice alth-dice--watch${leaving ? ' is-leaving' : ''}`} role="status" aria-live="polite"
        aria-label={`${m.who} ${done ? 'rolou' : 'está rolando'}: ${m.title}`}>
        <header className="alth-dice__header">
          <h4 className="alth-dice__title">{m.title}<small><span aria-hidden="true">◉</span> {m.who} {done ? 'rolou' : 'está rolando'}{m.isPrivate ? ' · privada' : ''}</small></h4>
          <button type="button" className="alth-dice__close" onClick={() => onDoneRef.current()} aria-label="Fechar">×</button>
        </header>

        <div className="alth-dice__telao alth-dice__telao--watch">
          <div ref={stageRef} className="alth-dice__canvas" data-insets="10,52" data-margin="2" data-xbox="0.99" data-fit="0.4" aria-hidden="true" />
          {simple && <span className="alth-dice__simple" aria-hidden="true">{spin ?? ''}</span>}
          {!done && <span className="alth-dice__hint">{m.who} está rolando…</span>}
          {done && (
            <div className="alth-dice__result" role="status">
              <span className="alth-dice__total">{m.total}</span>
              <span className="alth-dice__sum">{m.detail}</span>
              {m.crit === 'crit' && <span className="alth-dice__tag alth-dice__tag--ok">Crítico</span>}
              {m.crit === 'fumble' && <span className="alth-dice__tag alth-dice__tag--bad">Falha crítica</span>}
              {m.outcome === 'success' && <span className="alth-dice__tag alth-dice__tag--ok">Sucesso</span>}
              {m.outcome === 'failure' && <span className="alth-dice__tag alth-dice__tag--bad">Falha</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
