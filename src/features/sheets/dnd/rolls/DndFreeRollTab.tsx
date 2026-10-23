import { useRef, useState } from 'react'
import { parseDiceFormula } from '../../../dice/services/diceService'
import '../../../dice/components/DiceRollerPanel.css'
import { FREE_EXAMPLES, FREE_QUICK } from './freeRoll'

// ────────────────────────────────────────────────────────
// A aba "Rolagem livre" da janela de dados, no estilo do rolador dos outros
// sistemas do site: rolagem rápida de um dado, rolagem personalizada por
// fórmula (1d20+5, 2#d20+5 para o maior de dois, 2@d20+5 para o menor) e a
// rolagem privada. Rolar abre o mesmo painel dos testes, e a mesa vê.
// ────────────────────────────────────────────────────────

interface Props {
  formula:   string
  onFormula: (next: string) => void
  isPrivate: boolean
  onPrivate: (next: boolean) => void
  /** Abre o painel de rolagem com esta fórmula. */
  onRoll:    (formula: string) => void
  canRoll:   boolean
}

export function DndFreeRollTab({ formula, onFormula, isPrivate, onPrivate, onRoll, canRoll }: Props) {
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function submit() {
    const trimmed = formula.trim()
    if (!trimmed) { setError('Insira uma fórmula.'); return }
    try { parseDiceFormula(trimmed) } catch (err) { setError(err instanceof Error ? err.message : 'Fórmula inválida.'); return }
    setError(null)
    onRoll(trimmed)
  }

  return (
    <div className="dice-panel__body ddw-free">
      <label className="dice-private-toggle">
        <input type="checkbox" checked={isPrivate} onChange={(e) => onPrivate(e.target.checked)} />
        <svg className="dice-private-toggle__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        Rolagem privada
      </label>

      <div className="dice-section">
        <h4 className="dice-section__title">Rolagem rápida</h4>
        <div className="quick-roll-btns" role="group" aria-label="Rolagem rápida">
          {FREE_QUICK.map((f) => (
            <button key={f} type="button" className="quick-roll-btn" onClick={() => onRoll(f)} disabled={!canRoll} aria-label={`Rolar ${f}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="dice-section">
        <h4 className="dice-section__title">Rolagem personalizada</h4>
        <div className="dice-custom">
          <div className="dice-custom__input-row">
            <input
              ref={inputRef} type="text" className={`input dice-custom__text-input${error ? ' dice-custom__text-input--error' : ''}`}
              placeholder="Digite uma fórmula" value={formula} maxLength={80} autoComplete="off" autoCorrect="off" spellCheck={false}
              aria-label="Fórmula personalizada" disabled={!canRoll}
              onChange={(e) => { onFormula(e.target.value); setError(null) }} onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            />
            <button type="button" className="btn btn-primary dice-custom__roll-btn" onClick={submit} disabled={!canRoll}>Rolar</button>
          </div>
          <div className="dice-custom__examples">
            <span className="dice-custom__examples-label">Exemplos:</span>
            {FREE_EXAMPLES.map((f) => (
              <button key={f} type="button" className="dice-custom__example-chip" disabled={!canRoll}
                onClick={() => { onFormula(f); setError(null); inputRef.current?.focus() }}>{f}</button>
            ))}
          </div>
          <p className="dice-custom__examples-label"><b>2#d20</b> = o maior de dois · <b>2@d20</b> = o menor de dois</p>
          {error && <div className="dice-feedback dice-feedback--error" role="alert">{error}</div>}
          {!canRoll && <div className="dice-feedback dice-feedback--error" role="alert">Abra uma campanha para rolar.</div>}
        </div>
      </div>
    </div>
  )
}
