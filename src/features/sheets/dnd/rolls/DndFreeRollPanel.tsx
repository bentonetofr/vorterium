import { useEffect, useRef, useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import type { DiceRoll } from '../../../../shared/types'
import type { RollExtras, RollResult } from '../../../dice/services/diceService'
import { stageDiceFor } from './diceKinds'
import { freeContext, freeLabel, idleKindOf, readFree, resultsText, type FreeGroup, type FreeReading } from './freeRoll'
import { markRollBusy } from './rollActivity'
import { useDiceStage } from './useDiceStage'
import './DndRolls.css'

// ────────────────────────────────────────────────────────
// O painel da rolagem livre: o mesmo painel dos testes (moldura, dados no
// meio, "clique nos dados para rolar", tiles embaixo e o total), mas com a
// fórmula que a pessoa escreveu na janela de dados e sem CD. Quem está na mesa
// vê a rolagem do mesmo jeito que vê um teste.
// ────────────────────────────────────────────────────────

interface Props {
  /** A fórmula já conferida (1d20+5, 2#d20+5...). */
  formula:   string
  character: string
  skin:      string
  /** Sorteia a fórmula, monta os extras com a rolagem sorteada e grava. */
  perform:   (formula: string, build: (rolled: RollResult) => RollExtras) => Promise<DiceRoll>
  /** Volta para a janela de dados (escolher outros dados). */
  onBack:    () => void
  onClose:   () => void
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const tileLabel = (g: FreeGroup) => (g.keep ? `${g.notation}: ${resultsText(g)} → ${g.subtotal}` : `${g.notation}: ${resultsText(g)}`)

/** O que a fórmula pede, antes de rolar (para os tiles): grupos de dados e o bônus. */
function plan(formula: string): FreeReading {
  const groups: FreeGroup[] = []
  let modifier = 0
  for (const tok of formula.toLowerCase().replace(/\s+/g, '').split(/(?=[+-])/)) {
    const body = tok.replace(/^[+-]/, '')
    const sign = tok.startsWith('-') ? -1 : 1
    const m = /^(\d+)([#@])?(\d*)d(\d+)$/.exec(body)
    if (m) {
      const q = Number(m[1])
      groups.push({ sides: Number(m[4]), results: Array.from({ length: q }, () => 0), subtotal: 0, notation: body, keep: m[2] === '#' ? 'highest' : m[2] === '@' ? 'lowest' : undefined })
    } else if (/^d\d+$/.test(body)) groups.push({ sides: Number(body.slice(1)), results: [0], subtotal: 0, notation: `1${body}` })
    else if (/^\d+$/.test(body)) modifier += sign * Number(body)
  }
  return { groups, modifier, total: 0 }
}

export function DndFreeRollPanel({ formula, character, skin, perform, onBack, onClose }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const { stage, simple } = useDiceStage(stageRef, 'stage')
  const [phase, setPhase] = useState<'ready' | 'rolling' | 'done'>('ready')
  const [done, setDone] = useState<{ roll: DiceRoll; reading: FreeReading } | null>(null)
  const [spin, setSpin] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const idleKind = idleKindOf(formula)

  useEffect(() => markRollBusy(), [])   // os testes dos outros esperam este painel fechar
  useEffect(() => { if (stage && phase === 'ready') void stage.idle(idleKind, skin) }, [stage, phase, skin, idleKind])

  async function roll() {
    if (phase === 'rolling') return
    setPhase('rolling')
    setError(null)
    try {
      const saved = await perform(formula, () => ({ label: 'Rolagem livre', skin, noFloor: true, context: freeContext(character) }))
      const reading = readFree(saved.roll_breakdown ?? [], saved.result)
      const dice = stageDiceFor(saved.roll_breakdown ?? [], skin)
      if (stage) await stage.roll(dice, { skin })
      else await new Promise<void>((resolve) => {
        const end = performance.now() + 900
        const tick = () => { if (performance.now() < end) { setSpin(1 + Math.floor(Math.random() * 20)); requestAnimationFrame(tick) } else { setSpin(reading.total); resolve() } }
        tick()
      })
      setDone({ roll: saved, reading })
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível rolar.')
      setPhase('ready')
    }
  }

  const reading = done?.reading
  const planned = plan(formula)
  return (
    <ModalOverlay onClose={onClose} closeDisabled={phase === 'rolling'}>
      <div className="dsh-sheet dcp" role="dialog" aria-modal="true" aria-labelledby="dcp-title">
        <button type="button" className="modal-close dcp__close" onClick={onClose} disabled={phase === 'rolling'} aria-label="Fechar">×</button>

        <div className="dcp__frame">
          <div className="dcp__dc"><small className="dcp__nodc">Sem CD</small></div>
          <h3 id="dcp-title" className="dcp__title">Rolagem livre<span>{freeLabel(formula)}</span></h3>

          <button type="button" className="dcp__stage" onClick={() => { if (phase === 'ready') void roll() }} disabled={phase !== 'ready'}
            aria-label={phase === 'ready' ? `Rolar ${freeLabel(formula)}` : 'Rolagem'}>
            <div ref={stageRef} className="dcp__canvas" aria-hidden="true" />
            {simple && <span className="dcp__simple" aria-hidden="true">{spin ?? formula.split('+')[0]}</span>}
            {phase === 'ready' && <span className="dcp__hint">Clique nos dados para rolar</span>}
          </button>

          {reading && (
            <div className="dcp__result" role="status">
              <span className="dcp__total">Total <strong>{reading.total}</strong></span>
            </div>
          )}
        </div>

        <ul className="dcp__tiles" aria-label="Dados">
          {reading
            ? reading.groups.map((g, i) => (
              <li key={`${g.notation}${i}`} className="dcp__tile dcp__tile--reaction" title={resultsText(g)}>
                <span className="dcp__tile-value">{g.subtotal}</span>
                <span className="dcp__tile-badge">d{g.sides}</span>
                <span className="dcp__tile-label">{tileLabel(g)}</span>
              </li>
            ))
            : planned.groups.map((g, i) => (
              <li key={`${g.notation}${i}`} className="dcp__tile dcp__tile--reaction">
                <span className="dcp__tile-value">{g.notation}</span>
                <span className="dcp__tile-badge">d{g.sides}</span>
                <span className="dcp__tile-label">{g.keep ? (g.keep === 'highest' ? 'O maior' : 'O menor') : `${g.results.length} ${g.results.length === 1 ? 'dado' : 'dados'}`}</span>
              </li>
            ))}
          {(reading ?? planned).modifier !== 0 && (
            <li className="dcp__tile">
              <span className="dcp__tile-value">{signed((reading ?? planned).modifier)}</span>
              <span className="dcp__tile-badge">+</span>
              <span className="dcp__tile-label">Bônus</span>
            </li>
          )}
        </ul>

        {error && <p className="dsh-warn dcp__error">{error}</p>}

        <div className="dcp__actions">
          {phase === 'done' && <button type="button" className="dsh-chip dsh-chip--primary" onClick={() => { setDone(null); setSpin(null); setPhase('ready') }}>Rolar outra vez</button>}
          <button type="button" className="dsh-chip" onClick={onBack} disabled={phase === 'rolling'}>Mudar a fórmula</button>
          <button type="button" className="dsh-chip" onClick={onClose} disabled={phase === 'rolling'}>{phase === 'done' ? 'Fechar' : 'Cancelar'}</button>
        </div>
      </div>
    </ModalOverlay>
  )
}
