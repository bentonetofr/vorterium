import { useEffect, useRef, useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import type { DiceRoll } from '../../../../shared/types'
import { parseDiceFormula, recordRoll, rollParsedFormula } from '../../../dice/services/diceService'
import { sendMessage } from '../../../chat/services/chatService'
import { getMyDiceSkin } from '../../../dice3d/diceSkinService'
import { DEFAULT_SKIN } from '../../../dice3d/skins'
import { stageDiceFor } from '../../dnd/rolls/diceKinds'
import { useDiceStage } from '../../dnd/rolls/useDiceStage'
import { playRollSound } from '../../terraDevastadaAdaptada/components/TdaTestModal'
import {
  SITUATION_LIMIT,
  clampSituation,
  readTest,
  testFormula,
  testOutcome,
  testPool,
  type TestReading,
} from '../utils/altheriumTest'

// ────────────────────────────────────────────────────────
// Janela de teste de domínio: escolhe os dados de situação (±2) e a DT
// (opcional), rola com os dados 3D e mostra a conta inteira — cada dado,
// qual valeu, o atributo somado, o total, o crítico e o resultado contra a
// DT. A rolagem vai pro histórico de dados e, se não for privada, pro chat.
// ────────────────────────────────────────────────────────

export interface AltheriumTestSpec {
  domainId:       string
  domainLabel:    string
  attributeLabel: string
  attribute:      number
  /** Dados do domínio sem a desvantagem: 1 + pontos + gênesis + "+". */
  baseDice:       number
  /** Por que está em desvantagem (null = sem desvantagem). */
  disadvantage:   string | null
}

interface Props {
  campaignId: string
  sheetId:    string
  character:  string
  spec:       AltheriumTestSpec
  onClose:    () => void
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)

export function AltheriumTestModal({ campaignId, sheetId, character, spec, onClose }: Props) {
  const [situational, setSituational] = useState(0)
  const [dt, setDt] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roll, setRoll] = useState<DiceRoll | null>(null)
  const [done, setDone] = useState(false)
  const [skin, setSkin] = useState(DEFAULT_SKIN)
  const stageRef = useRef<HTMLDivElement>(null)
  const { stage, simple } = useDiceStage(stageRef, 'wide')

  useEffect(() => {
    void getMyDiceSkin().then(setSkin).catch(() => { /* fica o padrão */ })
  }, [])

  const pool = testPool({ baseDice: spec.baseDice, disadvantage: !!spec.disadvantage, situational })
  const dtValue = dt.trim() === '' ? null : Math.max(1, Math.min(99, Math.trunc(Number(dt)) || 0)) || null
  const reading = roll ? readTest(roll.roll_breakdown ?? []) : null
  const outcome = reading && dtValue != null ? testOutcome(reading.total, dtValue) : null

  async function doRoll() {
    setError(null)
    setRolling(true)
    setDone(false)
    try {
      const rolled = rollParsedFormula(parseDiceFormula(testFormula(pool, spec.attribute)))
      const read = readTest(rolled.breakdown)
      if (!read) throw new Error('Não foi possível ler a rolagem.')
      const result = dtValue != null ? testOutcome(read.total, dtValue) : null
      const saved = await recordRoll(campaignId, rolled, isPrivate, {
        label: `Teste de ${spec.domainLabel}`,
        skin,
        context: {
          system: 'altherium', kind: 'skill', key: spec.domainId, sheet_id: sheetId, character,
          dc: dtValue, situational, natural: read.kept,
          advantage: pool.keep === 'lowest' ? 'disadvantage' : 'normal',
          outcome: result ? (result.success ? 'success' : 'failure') : null,
          crit: read.crit ? 'crit' : null,
        },
      })
      setRoll(saved)
      playRollSound()
      if (stage) await stage.roll(stageDiceFor(saved.roll_breakdown ?? [], skin), { skin })
      setDone(true)
      if (!isPrivate) {
        void sendMessage(campaignId, testMessage(character, spec, read, dtValue)).catch(() => { /* só não aparece no chat */ })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível rolar.')
    } finally {
      setRolling(false)
    }
  }

  function again() {
    setRoll(null)
    setDone(false)
    setError(null)
  }

  const showResult = roll && reading && (done || simple)

  return (
    <ModalOverlay onClose={onClose} closeDisabled={rolling}>
      <div className="alth-modal__window alth-test" role="dialog" aria-modal="true" aria-labelledby="alth-test-title">
        <header className="alth-modal__header">
          <h4 id="alth-test-title" className="alth-modal__title">Teste de {spec.domainLabel}</h4>
          <button type="button" className="modal-close" onClick={onClose} disabled={rolling} aria-label="Fechar">×</button>
        </header>

        <div className="alth-test__body">
          <div className="alth-test__stage">
            <div ref={stageRef} className="alth-test__canvas" aria-hidden="true" />
            {!roll && (
              <span className="alth-test__pool">
                {pool.count}d10 · fica o {pool.keep === 'highest' ? 'maior' : 'menor'} · {signed(spec.attribute)} {spec.attributeLabel}
              </span>
            )}
          </div>

          {!roll && (
            <>
              {spec.disadvantage && <p className="alth-test__note alth-test__note--warn">Desvantagem: {spec.disadvantage}.</p>}

              <div className="alth-test__field">
                <span className="alth-test__label">Dados de situação</span>
                <div className="alth-test__stepper">
                  <button type="button" onClick={() => setSituational(clampSituation(situational - 1))}
                    disabled={situational <= -SITUATION_LIMIT} aria-label="Tirar um dado">−</button>
                  <span className="alth-test__stepper-value">{situational === 0 ? '0' : signed(situational)}</span>
                  <button type="button" onClick={() => setSituational(clampSituation(situational + 1))}
                    disabled={situational >= SITUATION_LIMIT} aria-label="Pôr um dado">+</button>
                </div>
                <span className="alth-test__hint">Itens, condições e o que o mestre conceder. No máximo 2 dados a mais ou a menos.</span>
              </div>

              <label className="alth-test__field">
                <span className="alth-test__label">DT (opcional)</span>
                <input type="number" className="input alth-test__dt" min={1} max={99} inputMode="numeric"
                  value={dt} onChange={(e) => setDt(e.target.value)} placeholder="Sem DT" />
              </label>

              <label className="alth-test__check">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                Rolagem privada (só você e o mestre veem, sem aviso no chat)
              </label>

              {error && <p className="alth-test__note alth-test__note--warn" role="alert">{error}</p>}

              <div className="alth-test__actions">
                <button type="button" className="btn btn-ghost" onClick={onClose} disabled={rolling}>Cancelar</button>
                <button type="button" className="btn btn-primary" onClick={() => void doRoll()} disabled={rolling}>
                  {rolling ? 'Rolando…' : `Rolar ${pool.count}d10`}
                </button>
              </div>
            </>
          )}

          {roll && !showResult && <p className="alth-test__note">Rolando…</p>}

          {showResult && reading && (
            <>
              <ul className="alth-test__dice" aria-label="Dados rolados">
                {reading.results.map((value, i) => {
                  const kept = i === reading.results.indexOf(reading.kept)
                  return (
                    <li key={i} className={`alth-test__die${kept ? ' alth-test__die--kept' : ''}${value === 10 ? ' alth-test__die--ten' : ''}`}
                      title={kept ? 'Este dado valeu' : undefined}>
                      {value}
                    </li>
                  )
                })}
              </ul>

              <p className="alth-test__sum">
                {reading.keep === 'highest' ? 'Maior' : 'Menor'} dado <strong>{reading.kept}</strong>
                {' '}{reading.attribute >= 0 ? '+' : '−'} {spec.attributeLabel} <strong>{Math.abs(reading.attribute)}</strong>
                {' '}= <strong className="alth-test__total">{reading.total}</strong>
              </p>

              {reading.crit && <p className="alth-test__crit">Crítico! 10 natural.</p>}

              {outcome && dtValue != null && (
                <p className={`alth-test__outcome alth-test__outcome--${outcome.success ? 'ok' : 'fail'}`} role="status">
                  DT {dtValue}: {outcome.success ? 'sucesso' : 'falha'}{outcome.margin > 0 ? ` por ${outcome.margin}` : ''}
                </p>
              )}

              <div className="alth-test__actions">
                <button type="button" className="btn btn-ghost" onClick={again}>Novo teste</button>
                <button type="button" className="btn btn-primary" onClick={onClose}>Fechar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  )
}

function testMessage(character: string, spec: AltheriumTestSpec, r: TestReading, dt: number | null): string {
  const dice = `[${r.results.join(', ')}] → ${r.kept}`
  const attr = `${r.attribute >= 0 ? '+' : '−'} ${spec.attributeLabel} ${Math.abs(r.attribute)}`
  const vs = dt != null ? (() => {
    const o = testOutcome(r.total, dt)
    return ` contra DT ${dt}: ${o.success ? 'sucesso' : 'falha'}${o.margin > 0 ? ` por ${o.margin}` : ''}`
  })() : ''
  return `🎲 ${character} testou ${spec.domainLabel}: ${dice} ${attr} = ${r.total}${vs}${r.crit ? ' · crítico!' : ''}`
}
