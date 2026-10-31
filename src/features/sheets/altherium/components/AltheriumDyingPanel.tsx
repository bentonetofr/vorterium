import { useState } from 'react'
import { parseDiceFormula, recordRoll, rollParsedFormula } from '../../../dice/services/diceService'
import { addCondition, type CombatState } from '../utils/altheriumCombat'
import { NEW_DYING, bonusOnTurn, comaSessions, deathConsequence, medicineBonus, type DyingState } from '../utils/altheriumDeath'

// ────────────────────────────────────────────────────────
// Estado Caído (aba Combate): os turnos que faltam, o bônus de cada um, a
// ajuda de Medicina, o botão do Teste de Morte e a consequência quando o
// personagem estabiliza (incapacitado, coma ou morte).
// ────────────────────────────────────────────────────────

interface Props {
  state:      CombatState
  turns:      number
  baseBonus:  number
  espirito:   number
  onState:    (next: CombatState) => void
  onRoll:     () => void
  campaignId: string
  sheetId:    string
  character:  string
}

export function AltheriumDyingPanel({ state, turns, baseBonus, espirito, onState, onRoll, campaignId, sheetId, character }: Props) {
  const dying = state.dying ?? NEW_DYING
  const [medResult, setMedResult] = useState('')
  const [medCrit, setMedCrit] = useState(false)
  const [coma, setComa] = useState<number | null>(null)
  const [rollingComa, setRollingComa] = useState(false)
  const setDying = (next: Partial<DyingState>) => onState({ ...state, dying: { ...dying, ...next } })
  const consequence = dying.result === 'stable' ? deathConsequence(dying.failures, espirito) : null
  const left = turns - dying.rolls
  const title = dying.result === 'dead' || consequence?.dead ? 'Morte' : dying.result === 'stable' ? 'Estabilizado' : 'Estado Caído'

  async function rollComa() {
    setRollingComa(true)
    try {
      const r = await recordRoll(campaignId, rollParsedFormula(parseDiceFormula('1d4')), false, {
        label: 'Coma: 1d4 − 2 sessões', context: { system: 'altherium', kind: 'custom', sheet_id: sheetId, character },
      })
      setComa(comaSessions(r.result))
    } catch {
      setComa(null)
    } finally {
      setRollingComa(false)
    }
  }

  return (
    <section className={`alth-section alth-dying${dying.result ? ` alth-dying--${consequence?.dead ? 'dead' : dying.result}` : ''}`}>
      <div className="alth-section__header">
        <h4 className="alth-section__title">{title}</h4>
      </div>

      {!state.dying && (
        <div className="alth-combat__row">
          <span className="alth-hint">Os PV estão em 0.</span>
          <span className="alth-combat__spacer" />
          <button type="button" className="btn btn-primary alth-combat__btn" onClick={() => onState({ ...state, dying: { ...NEW_DYING } })}>
            Cair (Estado Caído)
          </button>
        </div>
      )}

      {state.dying && dying.result === null && (
        <>
          <ul className="alth-dying__turns" aria-label="Turnos para sobreviver">
            {Array.from({ length: turns }, (_, i) => (
              <li key={i} className={i < dying.rolls ? 'alth-dying__turn--fail' : i === dying.rolls ? 'alth-dying__turn--now' : ''}
                title={`Bônus de Determinação no ${i + 1}º turno`}>
                {i + 1}º · +{bonusOnTurn(baseBonus, i)}
              </li>
            ))}
          </ul>
          <p className="alth-hint">
            Faltam {left} de {turns} turnos para sobreviver (2 + 1 a cada 2 de Espírito, até 5). Falhas: {dying.failures}.
            O bônus de Determinação cai 1 a cada novo turno caído.
          </p>
          <div className="alth-combat__row">
            <label className="alth-combat__num">
              Medicina de um aliado (resultado)
              <input type="number" className="input" min={0} max={99} value={medResult} onChange={(e) => setMedResult(e.target.value)} />
            </label>
            <label className="alth-test__check">
              <input type="checkbox" checked={medCrit} onChange={(e) => setMedCrit(e.target.checked)} /> Critou
            </label>
            <button type="button" className="btn btn-ghost alth-combat__btn" disabled={medResult.trim() === '' && !medCrit}
              onClick={() => { setDying({ medicine: medicineBonus(Math.trunc(Number(medResult) || 0), medCrit) }); setMedResult(''); setMedCrit(false) }}>
              Usar Medicina
            </button>
            {dying.medicine > 0 && <span className="alth-hint">+{dying.medicine} no próximo teste</span>}
          </div>
          <div className="alth-combat__row">
            <label className="alth-test__check" title="Triunfo do Pilar: +1 em todos os Testes de Morte, fora do limite da Medicina.">
              <input type="checkbox" checked={dying.nornas} onChange={(e) => setDying({ nornas: e.target.checked })} /> Corda das Nornas (+1)
            </label>
            <span className="alth-combat__spacer" />
            <button type="button" className="btn btn-primary alth-combat__btn" onClick={onRoll}>Teste de Morte</button>
          </div>
        </>
      )}

      {consequence && (
        <>
          <p className={`alth-test__note${consequence.dead ? ' alth-test__note--warn' : ''}`}>
            <strong>{consequence.label}.</strong> {consequence.detail}{!consequence.dead && ' Inconsciente até ser curado.'}
          </p>
          <div className="alth-combat__row">
            {consequence.label === 'Incapacitado' && (
              <button type="button" className="btn btn-ghost alth-combat__btn" onClick={() => onState(addCondition(state, 'incapacitado', null))}>
                Marcar Incapacitado
              </button>
            )}
            {consequence.coma && coma === null && (
              <button type="button" className="btn btn-ghost alth-combat__btn" disabled={rollingComa} onClick={() => void rollComa()}>
                Rolar sessões de coma (1d4 − 2)
              </button>
            )}
            {consequence.coma && coma !== null && (
              coma > 0
                ? (
                  <button type="button" className="btn btn-ghost alth-combat__btn" onClick={() => onState(addCondition(state, 'coma', coma))}>
                    Marcar Coma ({coma} {coma === 1 ? 'sessão' : 'sessões'})
                  </button>
                )
                : <span className="alth-hint">1d4 − 2 deu 0: não entra em coma.</span>
            )}
            <span className="alth-combat__spacer" />
            {!consequence.dead && (
              <button type="button" className="btn btn-primary alth-combat__btn" onClick={() => onState({ ...state, dying: null })}>
                Acordou / foi curado
              </button>
            )}
          </div>
        </>
      )}

      {dying.result === 'dead' && (
        <p className="alth-test__note alth-test__note--warn">
          {dying.failures >= 3 ? '3 falhas acumuladas' : 'Falhou em todos os turnos'}: morte permanente.
        </p>
      )}

      {state.dying && (
        <div className="alth-combat__row">
          <span className="alth-combat__spacer" />
          <button type="button" className="btn btn-ghost alth-combat__btn" title="Para o mestre corrigir: tira o Estado Caído sem rolar."
            onClick={() => onState({ ...state, dying: null })}>
            Tirar do Estado Caído
          </button>
        </div>
      )}
    </section>
  )
}
