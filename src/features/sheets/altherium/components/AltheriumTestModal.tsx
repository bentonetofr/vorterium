import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  type TestOutcome,
  type TestReading,
} from '../utils/altheriumTest'

// ────────────────────────────────────────────────────────
// Janela de teste de Altherium: escolhe os dados de situação (±2) e o alvo
// (DT, Defesa ou o Ataque recebido, opcional), rola com os dados 3D e
// mostra a conta inteira — cada dado, qual valeu, o atributo e os bônus
// somados, o total, o crítico e o resultado contra o alvo. Serve pros
// testes de domínio e pro combate (ataque, defesa, aparar): o combate
// manda os bônus prontos (Mirar, Cercar, Derrubado...) e põe as próprias
// ações depois do resultado (rolar dano, local atingido...) em `after`.
// A rolagem vai pro histórico de dados e, se não for privada, pro chat.
// ────────────────────────────────────────────────────────

export interface Modifier { label: string; value: number }

export interface AltheriumTestSpec {
  domainId:       string
  domainLabel:    string
  attributeLabel: string
  attribute:      number
  /** Dados do domínio sem a desvantagem: 1 + pontos + gênesis + "+". */
  baseDice:       number
  /** Por que está em desvantagem (null = sem desvantagem). */
  disadvantage:   string | null
  /** Título da janela e do histórico (padrão: "Teste de <domínio>"). */
  title?:         string
  /** Bônus fixos somados ao total (Mirar +2, Cercar, Defender Total...). */
  flat?:          Modifier[]
  /** Dados a mais ou a menos que já vêm do combate (faixas de alcance...). Somam com os de situação, no máximo ±2. */
  diceMods?:      Modifier[]
  /** Dado somado ao total (o +1d4 do Gênesis Caçador/Guerreiro). */
  extraDie?:      { label: string; sides: number }
  /** Nome do alvo (padrão "DT"). */
  targetLabel?:   string
  /** Empate passa? (padrão sim; no Ataque contra a Defesa, não). */
  tieWins?:       boolean
  initialTarget?: number | null
  /** Palavras do resultado (padrão "sucesso"/"falha"). */
  words?:         [string, string]
  /** Crítico passa direto (o acerto crítico é instantâneo). */
  critSucceeds?:  boolean
  /** Avisos mostrados antes de rolar. */
  notes?:         string[]
  /** Sem dados de situação (o Teste de Morte é sempre 1d10). */
  noSituation?:   boolean
  /** Ajuste manual da conta (o jogador ou o mestre mudou os dados, o maior/menor ou o bônus). */
  manual?:        ManualRoll
}

/** O que foi mudado na mão: vale no lugar do cálculo automático. */
export interface ManualRoll {
  dice?:  number
  keep?:  'highest' | 'lowest'
  bonus?: number
}

export const MANUAL_DICE_MAX = 12

export interface TestDone {
  reading:   TestReading
  outcome:   TestOutcome | null
  target:    number | null
  isPrivate: boolean
}

export interface AfterCtx extends TestDone {
  /** Rola mais uma fórmula no mesmo palco (dano, local...) e grava no histórico. */
  rollExtra: (formula: string, label: string) => Promise<DiceRoll | null>
  busy:      boolean
}

interface Props {
  campaignId: string
  sheetId:    string
  character:  string
  spec:       AltheriumTestSpec
  onClose:    () => void
  /** Chamado uma vez quando o resultado sai (gastar Mirar, Reação...). */
  onRolled?:  (done: TestDone) => void
  /** Ações depois do resultado. */
  after?:     (ctx: AfterCtx) => ReactNode
  /** Rola assim que a janela abre (a escolha já foi feita numa janela antes): sem a tela de dados de situação. */
  autoRoll?:  boolean
  /** Campos a mais no contexto da rolagem (o id do pedido do mestre, por exemplo). */
  contextExtra?: Record<string, unknown>
  /** Sem o botão "Rolar de novo" (Explorar, por exemplo, gasta uma Ficha por tentativa). */
  noAgain?:   boolean
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)
const sum = (list?: Modifier[]) => (list ?? []).reduce((s, m) => s + m.value, 0)

export function AltheriumTestModal({ campaignId, sheetId, character, spec, onClose, onRolled, after, autoRoll = false, noAgain = false, contextExtra }: Props) {
  const [situational, setSituational] = useState(0)
  const [target, setTarget] = useState(spec.initialTarget != null ? String(spec.initialTarget) : '')
  const [isPrivate, setIsPrivate] = useState(false)
  const [manDice, setManDice] = useState(spec.manual?.dice != null ? String(spec.manual.dice) : '')
  const [manKeep, setManKeep] = useState<'auto' | 'highest' | 'lowest'>(spec.manual?.keep ?? 'auto')
  const [manBonus, setManBonus] = useState(spec.manual?.bonus != null ? String(spec.manual.bonus) : '')
  const [rolling, setRolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roll, setRoll] = useState<DiceRoll | null>(null)
  const [done, setDone] = useState(false)
  const [skin, setSkin] = useState(DEFAULT_SKIN)
  const stageRef = useRef<HTMLDivElement>(null)
  const { stage, simple } = useDiceStage(stageRef, 'wide')
  const title = spec.title ?? `Teste de ${spec.domainLabel}`
  const targetLabel = spec.targetLabel ?? 'DT'
  const words = spec.words ?? ['sucesso', 'falha']

  useEffect(() => {
    void getMyDiceSkin().then(setSkin).catch(() => { /* fica o padrão */ })
  }, [])

  const autoDice = sum(spec.diceMods)
  const totalDice = clampSituation(autoDice + situational)
  const autoPool = testPool({ baseDice: spec.baseDice, disadvantage: !!spec.disadvantage, situational: totalDice })
  const autoModifier = spec.attribute + sum(spec.flat)
  // Ajuste manual: vem pronto da janela (rola direto) ou dos campos desta tela.
  const fieldInt = (v: string, min: number, max: number) => (v.trim() === '' ? undefined : Math.max(min, Math.min(max, Math.trunc(Number(v)) || 0)))
  const manual: ManualRoll | undefined = autoRoll
    ? spec.manual
    : { dice: fieldInt(manDice, 1, MANUAL_DICE_MAX), keep: manKeep === 'auto' ? undefined : manKeep, bonus: fieldInt(manBonus, -99, 99) }
  const pool = { count: manual?.dice ?? autoPool.count, keep: manual?.keep ?? autoPool.keep }
  const manualBonus = manual?.bonus
  const modifier = manualBonus ?? autoModifier
  const targetValue = target.trim() === '' ? null : Math.max(0, Math.min(99, Math.trunc(Number(target)) || 0))
  const reading = roll ? readTest(roll.roll_breakdown ?? []) : null

  function judge(r: TestReading, t: number | null): TestOutcome | null {
    if (t == null) return null
    const o = testOutcome(r.total, t, spec.tieWins ?? true)
    return spec.critSucceeds && r.crit ? { ...o, success: true } : o
  }
  const outcome = reading ? judge(reading, targetValue) : null

  async function animate(saved: DiceRoll) {
    if (stage) await stage.roll(stageDiceFor(saved.roll_breakdown ?? [], skin), { skin })
  }

  async function doRoll() {
    setError(null)
    setRolling(true)
    setDone(false)
    try {
      const rolled = rollParsedFormula(parseDiceFormula(testFormula(pool, modifier, spec.extraDie?.sides)))
      const read = readTest(rolled.breakdown)
      if (!read) throw new Error('Não foi possível ler a rolagem.')
      const result = judge(read, targetValue)
      const saved = await recordRoll(campaignId, rolled, isPrivate, {
        label: title,
        skin,
        context: {
          system: 'altherium', kind: 'skill', key: spec.domainId, sheet_id: sheetId, character,
          dc: targetValue, situational: totalDice, natural: read.kept,
          advantage: pool.keep === 'lowest' ? 'disadvantage' : 'normal',
          outcome: result ? (result.success ? 'success' : 'failure') : null,
          crit: read.crit ? 'crit' : null,
          ...(contextExtra ?? {}),
        },
      })
      setRoll(saved)
      playRollSound()
      await animate(saved)
      setDone(true)
      onRolled?.({ reading: read, outcome: result, target: targetValue, isPrivate })
      if (!isPrivate) {
        void sendMessage(campaignId, testMessage(character, title, spec, read, targetValue, targetLabel, result, words)).catch(() => { /* só não aparece no chat */ })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível rolar.')
    } finally {
      setRolling(false)
    }
  }

  async function rollExtra(formula: string, label: string): Promise<DiceRoll | null> {
    setError(null)
    setRolling(true)
    try {
      const saved = await recordRoll(campaignId, rollParsedFormula(parseDiceFormula(formula)), isPrivate, {
        label, skin, context: { system: 'altherium', kind: 'custom', sheet_id: sheetId, character },
      })
      playRollSound()
      await animate(saved)
      return saved
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível rolar.')
      return null
    } finally {
      setRolling(false)
    }
  }

  function again() {
    setRoll(null)
    setDone(false)
    setError(null)
    if (autoRoll) void doRoll()
  }

  // Rola sozinho quando o palco 3D está pronto (ou quando não há palco).
  const autoStarted = useRef(false)
  useEffect(() => {
    if (!autoRoll || autoStarted.current || !(stage || simple)) return
    autoStarted.current = true
    void doRoll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRoll, stage, simple])

  const showResult = roll && reading && (done || simple)
  const keptIndex = reading ? reading.results.indexOf(reading.kept) : -1

  return (
    <ModalOverlay onClose={onClose} closeDisabled={rolling}>
      <div className={`alth-modal__window alth-test${showResult ? ' alth-test--shown' : ''}`} role="dialog" aria-modal="true" aria-labelledby="alth-test-title">
        <header className="alth-modal__header">
          <h4 id="alth-test-title" className="alth-modal__title">{title}</h4>
          <button type="button" className="modal-close" onClick={onClose} disabled={rolling} aria-label="Fechar">×</button>
        </header>

        <div className="alth-test__body">
          <div className="alth-test__stage">
            <div ref={stageRef} className="alth-test__canvas" aria-hidden="true" />
            {!roll && (
              <span className="alth-test__pool">
                {spec.domainLabel}: {pool.count}d10 · fica o {pool.keep === 'highest' ? 'maior' : 'menor'}
                {spec.extraDie ? ` · +1d${spec.extraDie.sides}` : ''} · {signed(modifier)}
              </span>
            )}
          </div>

          {!roll && autoRoll && (
            <>
              {error && <p className="alth-test__note alth-test__note--warn" role="alert">{error}</p>}
              {error && (
                <div className="alth-test__actions">
                  <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
                  <button type="button" className="btn btn-primary" onClick={() => void doRoll()}>Tentar de novo</button>
                </div>
              )}
            </>
          )}

          {!roll && !autoRoll && (
            <>
              {spec.disadvantage && <p className="alth-test__note alth-test__note--warn">Desvantagem: {spec.disadvantage}.</p>}

              <ul className="alth-test__mods" aria-label="O que entra no teste">
                <li>{spec.attributeLabel} <strong>{signed(spec.attribute)}</strong></li>
                {(spec.flat ?? []).filter((m) => m.value !== 0).map((m) => <li key={m.label}>{m.label} <strong>{signed(m.value)}</strong></li>)}
                {spec.extraDie && <li>{spec.extraDie.label} <strong>+1d{spec.extraDie.sides}</strong></li>}
                {(spec.diceMods ?? []).filter((m) => m.value !== 0).map((m) => <li key={m.label}>{m.label} <strong>{signed(m.value)} {Math.abs(m.value) === 1 ? 'dado' : 'dados'}</strong></li>)}
              </ul>

              {(spec.notes ?? []).map((n) => <p key={n} className="alth-test__note">{n}</p>)}

              {!spec.noSituation && <div className="alth-test__field">
                <span className="alth-test__label">Dados de situação</span>
                <div className="alth-test__stepper">
                  <button type="button" onClick={() => setSituational(situational - 1)}
                    disabled={autoDice + situational <= -SITUATION_LIMIT} aria-label="Tirar um dado">−</button>
                  <span className="alth-test__stepper-value">{situational === 0 ? '0' : signed(situational)}</span>
                  <button type="button" onClick={() => setSituational(situational + 1)}
                    disabled={autoDice + situational >= SITUATION_LIMIT} aria-label="Pôr um dado">+</button>
                </div>
                <span className="alth-test__hint">
                  Itens, condições e o que o mestre conceder. Somando tudo, no máximo 2 dados a mais ou a menos
                  {autoDice !== 0 ? ` (o combate já pôs ${signed(autoDice)})` : ''}.
                </span>
              </div>}

              <details className="alth-win__details" open={manual?.dice != null || manual?.keep != null || manualBonus != null}>
                <summary>Ajuste manual: dados, maior ou menor e bônus</summary>
                <div className="alth-test__manual">
                  <label className="alth-test__field">
                    <span className="alth-test__label">Dados d10</span>
                    <input type="number" className="input" min={1} max={MANUAL_DICE_MAX} inputMode="numeric" value={manDice}
                      onChange={(e) => setManDice(e.target.value)} placeholder={`${autoPool.count} (auto)`} />
                  </label>
                  <label className="alth-test__field">
                    <span className="alth-test__label">Fica o</span>
                    <select className="input" value={manKeep} onChange={(e) => setManKeep(e.target.value as 'auto' | 'highest' | 'lowest')}>
                      <option value="auto">{autoPool.keep === 'highest' ? 'Maior (auto)' : 'Menor (auto)'}</option>
                      <option value="highest">Maior</option>
                      <option value="lowest">Menor</option>
                    </select>
                  </label>
                  <label className="alth-test__field">
                    <span className="alth-test__label">Bônus total</span>
                    <input type="number" className="input" min={-99} max={99} inputMode="numeric" value={manBonus}
                      onChange={(e) => setManBonus(e.target.value)} placeholder={`${signed(autoModifier)} (auto)`} />
                  </label>
                </div>
              </details>

              <label className="alth-test__field">
                <span className="alth-test__label">{targetLabel} (opcional)</span>
                <input type="number" className="input alth-test__dt" min={0} max={99} inputMode="numeric"
                  value={target} onChange={(e) => setTarget(e.target.value)} placeholder={`Sem ${targetLabel}`} />
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
                {reading.results.map((value, i) => (
                  <li key={i} className={`alth-test__die${i === keptIndex ? ' alth-test__die--kept' : ''}${value === 10 ? ' alth-test__die--ten' : ''}`}
                    title={i === keptIndex ? 'Este dado valeu' : undefined}>
                    {value}
                  </li>
                ))}
              </ul>

              <p className="alth-test__sum">
                {reading.keep === 'highest' ? 'Maior' : 'Menor'} dado <strong>{reading.kept}</strong>
                {manualBonus != null ? (
                  <span> {plusMinus(manualBonus)} bônus manual <strong>{Math.abs(manualBonus)}</strong></span>
                ) : (
                  <>
                    {' '}{plusMinus(spec.attribute)} {spec.attributeLabel} <strong>{Math.abs(spec.attribute)}</strong>
                    {(spec.flat ?? []).filter((m) => m.value !== 0).map((m) => (
                      <span key={m.label}> {plusMinus(m.value)} {m.label} <strong>{Math.abs(m.value)}</strong></span>
                    ))}
                  </>
                )}
                {spec.extraDie && <span> + {spec.extraDie.label} <strong>{reading.extra}</strong></span>}
                {' '}= <strong className="alth-test__total">{reading.total}</strong>
              </p>

              {reading.crit && <p className="alth-test__crit">Crítico! 10 natural.</p>}

              {outcome && targetValue != null && (
                <p className={`alth-test__outcome alth-test__outcome--${outcome.success ? 'ok' : 'fail'}`} role="status">
                  {targetLabel} {targetValue}: {outcome.success ? words[0] : words[1]}
                  {outcome.margin > 0 && !(spec.critSucceeds && reading.crit && reading.total <= targetValue) ? ` por ${outcome.margin}` : ''}
                </p>
              )}

              {after?.({ reading, outcome, target: targetValue, isPrivate, rollExtra, busy: rolling })}

              {error && <p className="alth-test__note alth-test__note--warn" role="alert">{error}</p>}

              <div className="alth-test__actions">
                {!noAgain && <button type="button" className="btn btn-ghost" onClick={again} disabled={rolling}>Rolar de novo</button>}
                <button type="button" className="btn btn-primary" onClick={onClose} disabled={rolling}>Fechar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  )
}

function plusMinus(n: number): string {
  return n >= 0 ? '+' : '−'
}

function testMessage(
  character: string, title: string, spec: AltheriumTestSpec, r: TestReading,
  target: number | null, targetLabel: string, o: TestOutcome | null, words: [string, string],
): string {
  const dice = `[${r.results.join(', ')}] → ${r.kept}`
  const bonus = r.modifier + r.extra
  const vs = target != null && o ? ` contra ${targetLabel} ${target}: ${o.success ? words[0] : words[1]}` : ''
  return `${character} — ${title} (${spec.domainLabel}): ${dice} ${plusMinus(bonus)} ${Math.abs(bonus)} = ${r.total}${vs}${r.crit ? ' · crítico!' : ''}`
}
