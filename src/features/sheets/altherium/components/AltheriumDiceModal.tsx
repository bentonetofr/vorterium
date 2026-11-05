import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import type { DiceRoll } from '../../../../shared/types'
import { parseDiceFormula, recordRoll, rollParsedFormula } from '../../../dice/services/diceService'
import type { StageDie } from '../../../dice3d/DiceStage'
import { useRollSkin } from '../../../dice3d/useRollSkin'
import { stageDiceFor } from '../../dnd/rolls/diceKinds'
import { useDiceStage } from '../../dnd/rolls/useDiceStage'
import { playRollSound } from '../../terraDevastadaAdaptada/components/TdaTestModal'
import type { Roller } from '../utils/altheriumRest'
import { cryptoRng } from '../utils/altheriumExplore'

// ────────────────────────────────────────────────────────
// Rolagem com dados 3D fora dos testes de domínio: a de coma (1d4), a dos Ritos
// e do Equilíbrio zerado, a de recuperar cartas do Pilar, a do Descanso... Abre
// uma janelinha com o palco, joga os dados na skin escolhida pela pessoa (lida
// na hora de rolar) e só então entrega o resultado — quem chamou aplica na ficha
// quando `onDone` dispara, depois que os dados pararam.
// ────────────────────────────────────────────────────────

export interface DiceOutcome<T> {
  /** O que vai pro palco. */
  dice:  StageDie[]
  /** O que sai da rolagem (o total, a lista de dados...) — volta em `onDone`. */
  value: T
}

interface Props<T> {
  title:    string
  /** Faz a rolagem (e grava, se for o caso) com a skin dada. Chamada uma vez, quando o palco está pronto. */
  perform:  (skin: string) => Promise<DiceOutcome<T>>
  /** Os dados pararam: aplica o resultado. */
  onDone:   (value: T) => void
  onClose:  () => void
  /** Texto de resultado embaixo do palco (opcional). */
  result?:  (value: T) => ReactNode
}

export function AltheriumDiceModal<T>({ title, perform, onDone, onClose, result }: Props<T>) {
  const [phase, setPhase] = useState<'rolling' | 'done' | 'error'>('rolling')
  const [error, setError] = useState<string | null>(null)
  const [value, setValue] = useState<{ v: T } | null>(null)
  const [dice, setDice] = useState<StageDie[]>([])
  const stageRef = useRef<HTMLDivElement>(null)
  const { stage, simple } = useDiceStage(stageRef, 'wide')
  const rollSkin = useRollSkin()
  const started = useRef(false)
  // quem chama pode passar funções novas a cada tela; a rolagem usa as do momento em que começou
  const live = useRef({ perform, onDone })
  live.current = { perform, onDone }

  async function run() {
    setPhase('rolling')
    setError(null)
    try {
      const skin = await rollSkin()
      const outcome = await live.current.perform(skin)
      setDice(outcome.dice)
      playRollSound()
      if (stage) await stage.roll(outcome.dice.map((d) => ({ ...d, skin })), { skin })
      setValue({ v: outcome.value })
      setPhase('done')
      live.current.onDone(outcome.value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível rolar.')
      setPhase('error')
    }
  }

  // rola sozinho quando o palco 3D está pronto (ou quando não há palco)
  useEffect(() => {
    if (started.current || !(stage || simple)) return
    started.current = true
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, simple])

  const busy = phase === 'rolling'
  return (
    <ModalOverlay onClose={onClose} closeDisabled={busy}>
      <div className="alth-modal__window alth-test" role="dialog" aria-modal="true" aria-label={title}>
        <header className="alth-modal__header">
          <h4 className="alth-modal__title">{title}</h4>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Fechar">×</button>
        </header>
        <div className="alth-test__body">
          <div className="alth-test__stage">
            <div ref={stageRef} className="alth-test__canvas" aria-hidden="true" />
          </div>

          {phase === 'rolling' && <p className="alth-test__note">Rolando…</p>}

          {phase === 'error' && (
            <>
              <p className="alth-test__note alth-test__note--warn" role="alert">{error}</p>
              <div className="alth-test__actions">
                <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
                <button type="button" className="btn btn-primary" onClick={() => void run()}>Tentar de novo</button>
              </div>
            </>
          )}

          {phase === 'done' && value && (
            <>
              <ul className="alth-test__dice" aria-label="Dados rolados">
                {dice.map((d, i) => <li key={i} className="alth-test__die" title={d.kind}>{d.value}</li>)}
              </ul>
              {result?.(value.v)}
              <div className="alth-test__actions">
                <button type="button" className="btn btn-primary" onClick={onClose}>Continuar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Montagem do que vai pro palco ──────────────────────────────────

/** Rola uma fórmula (1d4, 1d20+3...), grava no histórico com a skin dada e devolve a rolagem. */
export function formulaOutcome(
  campaignId: string, formula: string, label: string, ctx: { sheetId?: string; character?: string }, skin: string,
): Promise<DiceOutcome<DiceRoll>> {
  return recordRoll(campaignId, rollParsedFormula(parseDiceFormula(formula)), false, {
    label, skin, context: { system: 'altherium', kind: 'custom', sheet_id: ctx.sheetId, character: ctx.character },
  }).then((saved) => ({ dice: stageDiceFor(saved.roll_breakdown ?? [], skin), value: saved }))
}

/** Um sorteador que anota cada dado que sai (lados e valor), pra funções puras que pedem `roll(lados)` (o Descanso, os Ritos). */
export function recordingRoller(): { roller: Roller; rolled: { sides: number; value: number }[] } {
  const rolled: { sides: number; value: number }[] = []
  const roller: Roller = (sides) => {
    const value = 1 + Math.floor(cryptoRng() * sides)
    rolled.push({ sides, value })
    return value
  }
  return { roller, rolled }
}

const KIND: Record<number, StageDie['kind']> = { 4: 'd4', 6: 'd6', 8: 'd8', 10: 'd10', 12: 'd12', 20: 'd20' }

/** Os dados anotados por `recordingRoller`, prontos pro palco. */
export function stageDiceOf(rolled: readonly { sides: number; value: number }[], skin: string): StageDie[] {
  return rolled.flatMap((r) => (KIND[r.sides] ? [{ kind: KIND[r.sides], value: r.value, skin }] : []))
}
