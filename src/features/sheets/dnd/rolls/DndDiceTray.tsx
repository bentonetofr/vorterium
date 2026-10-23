import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DiceRoll } from '../../../../shared/types'
import { partsText, stageDiceFor } from './diceKinds'
import { useDiceStage } from './useDiceStage'
import './DndRolls.css'

// ────────────────────────────────────────────────────────
// Bandeja: dano e dados em quantidade rolam pela parte de baixo da tela,
// por cima do site (fundo transparente), e um cartão mostra o rótulo e o
// total quando o último dado para. Some sozinho depois de uns segundos (ou
// ao clicar no cartão).
// ────────────────────────────────────────────────────────

export interface TrayJob { id: number; label: string; roll: DiceRoll; skin: string }

const HOLD_MS = 4200

export function DndDiceTray({ job, onDone }: { job: TrayJob | null; onDone: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const { stage, simple } = useDiceStage(hostRef, 'tray', !!job)
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'shown' | 'leaving'>('idle')
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const jobId = job?.id

  useEffect(() => {
    if (!job) { setPhase('idle'); return }
    if (!stage && !simple) { setPhase('rolling'); return } // espera o motor 3D carregar
    let alive = true
    const timers: number[] = []
    setPhase('rolling')
    const dice = stageDiceFor(job.roll.roll_breakdown ?? [], job.skin)
    const play = stage && dice.length ? stage.roll(dice, { skin: job.skin }) : new Promise<void>((r) => timers.push(window.setTimeout(r, 500)))
    void play.then(() => {
      if (!alive) return
      setPhase('shown')
      timers.push(window.setTimeout(() => { if (alive) setPhase('leaving') }, HOLD_MS))
      timers.push(window.setTimeout(() => { if (alive) { stage?.clear(); onDoneRef.current() } }, HOLD_MS + 400))
    })
    return () => { alive = false; timers.forEach((t) => window.clearTimeout(t)) }
    // só uma rolagem nova (ou o motor ficar pronto) reinicia
  }, [jobId, stage, simple])

  const dismiss = () => { setPhase('leaving'); window.setTimeout(() => { stage?.clear(); onDoneRef.current() }, 380) }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="dsh-sheet dtray" aria-live="polite">
      <div ref={hostRef} className="dtray__canvas" aria-hidden="true" />
      {job && phase !== 'idle' && (
        <button type="button" className={`dtray__card${phase === 'rolling' ? ' is-rolling' : ''}${phase === 'leaving' ? ' is-leaving' : ''}`} onClick={dismiss} title="Fechar">
          <span className="dtray__label">{job.label}</span>
          <span className="dtray__total">{phase === 'rolling' ? '…' : job.roll.result}</span>
          {phase !== 'rolling' && <span className="dtray__parts">{partsText(job.roll)}</span>}
        </button>
      )}
    </div>,
    document.body,
  )
}
