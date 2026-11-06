import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import type { DiceRoll } from '../../../../shared/types'
import { parseDiceFormula, recordRoll, rollParsedFormula } from '../../../dice/services/diceService'
import { sendMessage } from '../../../chat/services/chatService'
import { useRollSkin } from '../../../dice3d/useRollSkin'
import { markRollBusy } from '../../dnd/rolls/rollActivity'
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

/** O que o jogador (ou a janela que chamou) decidiu antes de rolar. */
interface RollSettings {
  pool:         { count: number; keep: 'highest' | 'lowest' }
  modifier:     number
  manualBonus:  number | undefined
  targetValue:  number | null
  /** Dados de situação somados aos que o combate já pôs. */
  totalDice:    number
  isPrivate:    boolean
}

/** Os campos da tela de preparo. */
interface SetupInput {
  situational: number
  target:      string
  isPrivate:   boolean
  manDice:     string
  manKeep:     'auto' | 'highest' | 'lowest'
  manBonus:    string
}

function initialInput(spec: AltheriumTestSpec): SetupInput {
  return {
    situational: 0,
    target:      spec.initialTarget != null ? String(spec.initialTarget) : '',
    isPrivate:   false,
    manDice:     spec.manual?.dice != null ? String(spec.manual.dice) : '',
    manKeep:     spec.manual?.keep ?? 'auto',
    manBonus:    spec.manual?.bonus != null ? String(spec.manual.bonus) : '',
  }
}

/** A conta do teste: dados, qual fica, bônus e alvo — a mesma na tela de preparo (ao vivo) e na rolagem. */
function settingsFrom(spec: AltheriumTestSpec, input: SetupInput, useSpecManual: boolean): RollSettings & { autoDice: number; autoPool: { count: number; keep: 'highest' | 'lowest' }; autoModifier: number } {
  const autoDice = sum(spec.diceMods)
  const totalDice = clampSituation(autoDice + input.situational)
  const autoPool = testPool({ baseDice: spec.baseDice, disadvantage: !!spec.disadvantage, situational: totalDice })
  const autoModifier = spec.attribute + sum(spec.flat)
  // Ajuste manual: vem pronto da janela (rola direto) ou dos campos da tela de preparo.
  const fieldInt = (v: string, min: number, max: number) => (v.trim() === '' ? undefined : Math.max(min, Math.min(max, Math.trunc(Number(v)) || 0)))
  const manual: ManualRoll | undefined = useSpecManual
    ? spec.manual
    : { dice: fieldInt(input.manDice, 1, MANUAL_DICE_MAX), keep: input.manKeep === 'auto' ? undefined : input.manKeep, bonus: fieldInt(input.manBonus, -99, 99) }
  const pool = { count: manual?.dice ?? autoPool.count, keep: manual?.keep ?? autoPool.keep }
  const manualBonus = manual?.bonus
  const targetValue = input.target.trim() === '' ? null : Math.max(0, Math.min(99, Math.trunc(Number(input.target)) || 0))
  return { pool, modifier: manualBonus ?? autoModifier, manualBonus, targetValue, totalDice, isPrivate: input.isPrivate, autoDice, autoPool, autoModifier }
}

export function AltheriumTestModal(props: Props) {
  const { spec, autoRoll = false } = props
  // Sem a tela de preparo (a janela que chamou já escolheu tudo): rola direto, no painel dos dados.
  const [settings, setSettings] = useState<RollSettings | null>(() => (autoRoll ? settingsFrom(spec, initialInput(spec), true) : null))
  if (!settings) return <TestSetup {...props} onRoll={setSettings} />
  return <TestRoll {...props} settings={settings} onBack={() => setSettings(null)} />
}

// ── Painel 1: a conta do teste, como um recibo ──────────────────────

function TestSetup({ spec, onClose, onRoll }: Props & { onRoll: (s: RollSettings) => void }) {
  const [input, setInput] = useState<SetupInput>(() => initialInput(spec))
  const set = (patch: Partial<SetupInput>) => setInput((prev) => ({ ...prev, ...patch }))
  const title = spec.title ?? `Teste de ${spec.domainLabel}`
  const targetLabel = spec.targetLabel ?? 'DT'
  const s = settingsFrom(spec, input, false)
  const { pool, manualBonus } = s
  const manual = manualBonus != null || input.manDice.trim() !== '' || input.manKeep !== 'auto'

  return (
    <ModalOverlay onClose={onClose}>
      <div className="alth-modal__window alth-test alth-test--setup" role="dialog" aria-modal="true" aria-labelledby="alth-test-title">
        <header className="alth-modal__header">
          <h4 id="alth-test-title" className="alth-modal__title">{title}</h4>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="alth-test__body">
          {spec.disadvantage && <p className="alth-test__note alth-test__note--warn">Desvantagem: {spec.disadvantage}.</p>}

          <div className="alth-bill" aria-label="A conta do teste">
            <div className="alth-bill__row"><span>Dados</span><strong>{pool.count}d10</strong></div>
            {manualBonus != null ? (
              <div className="alth-bill__row"><span>Bônus manual</span><strong>{signed(manualBonus)}</strong></div>
            ) : (
              <>
                <div className="alth-bill__row"><span>{spec.attributeLabel}</span><strong>{signed(spec.attribute)}</strong></div>
                {(spec.flat ?? []).filter((m) => m.value !== 0).map((m) => <div key={m.label} className="alth-bill__row"><span>{m.label}</span><strong>{signed(m.value)}</strong></div>)}
              </>
            )}
            {spec.extraDie && <div className="alth-bill__row"><span>{spec.extraDie.label}</span><strong>+1d{spec.extraDie.sides}</strong></div>}
            {(spec.diceMods ?? []).filter((m) => m.value !== 0).map((m) => (
              <div key={m.label} className="alth-bill__row"><span>{m.label}</span><strong>{signed(m.value)} {Math.abs(m.value) === 1 ? 'dado' : 'dados'}</strong></div>
            ))}
            {!spec.noSituation && (
              <div className="alth-bill__row">
                <span title={`Itens, condições e o que o mestre conceder. Somando tudo, no máximo ${SITUATION_LIMIT} dados a mais ou a menos.`}>Situação</span>
                <span className="alth-bill__stepper">
                  <button type="button" onClick={() => set({ situational: input.situational - 1 })}
                    disabled={s.autoDice + input.situational <= -SITUATION_LIMIT} aria-label="Tirar um dado">−</button>
                  <output aria-label="Dados de situação">{input.situational === 0 ? '0' : signed(input.situational)}</output>
                  <button type="button" onClick={() => set({ situational: input.situational + 1 })}
                    disabled={s.autoDice + input.situational >= SITUATION_LIMIT} aria-label="Pôr um dado">+</button>
                </span>
              </div>
            )}
            <div className="alth-bill__row alth-bill__row--total">
              <span>Fica o {pool.keep === 'highest' ? 'maior' : 'menor'}</span>
              <strong>{pool.count}d10 {signed(s.modifier)}{spec.extraDie ? ` +1d${spec.extraDie.sides}` : ''}</strong>
            </div>
          </div>

          {(spec.notes ?? []).map((n) => <p key={n} className="alth-test__note">{n}</p>)}

          <label className="alth-bill__line">
            <span>Contra {targetLabel}</span>
            <input type="number" className="input alth-test__dt" min={0} max={99} inputMode="numeric"
              value={input.target} onChange={(e) => set({ target: e.target.value })} placeholder="Sem DT" aria-label={`${targetLabel} (opcional)`} />
          </label>

          <label className="alth-bill__line alth-switch">
            <span title="Só você e o mestre veem a rolagem, sem aviso no chat.">Rolagem privada</span>
            <input type="checkbox" className="alth-switch__input" checked={input.isPrivate} onChange={(e) => set({ isPrivate: e.target.checked })} />
            <span className="alth-switch__track" aria-hidden="true" />
          </label>

          <button type="button" className="btn btn-primary alth-test__go" onClick={() => onRoll({ ...s })}>
            Rolar {pool.count}d10
          </button>

          <div className="alth-test__aux">
            <button type="button" className="alth-test__link" onClick={onClose}>Cancelar</button>
          </div>

          <details className="alth-win__details" open={manual}>
            <summary>Ajuste manual: dados, maior ou menor e bônus</summary>
            <div className="alth-test__manual">
              <label className="alth-test__field">
                <span className="alth-test__label">Dados d10</span>
                <input type="number" className="input" min={1} max={MANUAL_DICE_MAX} inputMode="numeric" value={input.manDice}
                  onChange={(e) => set({ manDice: e.target.value })} placeholder={`${s.autoPool.count} (auto)`} />
              </label>
              <label className="alth-test__field">
                <span className="alth-test__label">Fica o</span>
                <select className="input" value={input.manKeep} onChange={(e) => set({ manKeep: e.target.value as 'auto' | 'highest' | 'lowest' })}>
                  <option value="auto">{s.autoPool.keep === 'highest' ? 'Maior (auto)' : 'Menor (auto)'}</option>
                  <option value="highest">Maior</option>
                  <option value="lowest">Menor</option>
                </select>
              </label>
              <label className="alth-test__field">
                <span className="alth-test__label">Bônus total</span>
                <input type="number" className="input" min={-99} max={99} inputMode="numeric" value={input.manBonus}
                  onChange={(e) => set({ manBonus: e.target.value })} placeholder={`${signed(s.autoModifier)} (auto)`} />
              </label>
            </div>
          </details>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Painel 2: os dados 3D rolando e o resultado ─────────────────────

function TestRoll({ campaignId, sheetId, character, spec, onClose, onRolled, after, autoRoll = false, noAgain = false, contextExtra, settings, onBack }: Props & { settings: RollSettings; onBack: () => void }) {
  const { pool, modifier, manualBonus, targetValue, totalDice, isPrivate } = settings
  const [rolling, setRolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roll, setRoll] = useState<DiceRoll | null>(null)
  const [done, setDone] = useState(false)
  const rollSkin = useRollSkin()
  const stageRef = useRef<HTMLDivElement>(null)
  const { stage, simple } = useDiceStage(stageRef, 'wide')
  const title = spec.title ?? `Teste de ${spec.domainLabel}`
  const targetLabel = spec.targetLabel ?? 'DT'
  const words = spec.words ?? ['sucesso', 'falha']
  const reading = roll ? readTest(roll.roll_breakdown ?? []) : null

  function judge(r: TestReading, t: number | null): TestOutcome | null {
    if (t == null) return null
    const o = testOutcome(r.total, t, spec.tieWins ?? true)
    return spec.critSucceeds && r.crit ? { ...o, success: true } : o
  }
  const outcome = reading ? judge(reading, targetValue) : null

  async function animate(saved: DiceRoll, skin: string) {
    if (stage) await stage.roll(stageDiceFor(saved.roll_breakdown ?? [], skin), { skin })
  }

  async function doRoll() {
    setError(null)
    setRolling(true)
    setDone(false)
    const release = markRollBusy()   // o lobo do crítico espera os dados pararem
    try {
      // o conjunto escolhido agora (lido na hora: rolar logo ao abrir não pode sair com o padrão)
      const skin = await rollSkin()
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
      await animate(saved, skin)
      setDone(true)
      onRolled?.({ reading: read, outcome: result, target: targetValue, isPrivate })
      if (!isPrivate) {
        void sendMessage(campaignId, testMessage(character, title, spec, read, targetValue, targetLabel, result, words)).catch(() => { /* só não aparece no chat */ })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível rolar.')
    } finally {
      release()
      setRolling(false)
    }
  }

  async function rollExtra(formula: string, label: string): Promise<DiceRoll | null> {
    setError(null)
    setRolling(true)
    const release = markRollBusy()
    try {
      const skin = await rollSkin()
      const saved = await recordRoll(campaignId, rollParsedFormula(parseDiceFormula(formula)), isPrivate, {
        label, skin, context: { system: 'altherium', kind: 'custom', sheet_id: sheetId, character },
      })
      playRollSound()
      await animate(saved, skin)
      return saved
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível rolar.')
      return null
    } finally {
      release()
      setRolling(false)
    }
  }

  /** "Rolar de novo": nas janelas que já escolheram tudo, rola na hora; nas outras, volta à conta pra ajustar. */
  function again() {
    setRoll(null)
    setDone(false)
    setError(null)
    if (autoRoll) void doRoll()
    else onBack()
  }

  // Rola assim que o palco 3D está pronto (ou quando não há palco): o jogador já clicou em Rolar.
  const started = useRef(false)
  useEffect(() => {
    if (started.current || !(stage || simple)) return
    started.current = true
    void doRoll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, simple])

  const showResult = roll && reading && (done || simple)
  const keptIndex = reading ? reading.results.indexOf(reading.kept) : -1

  return (
    <ModalOverlay onClose={onClose} closeDisabled={rolling}>
      <div className={`alth-modal__window alth-test alth-test--roll${showResult ? ' alth-test--shown' : ''}`} role="dialog" aria-modal="true" aria-labelledby="alth-test-title">
        <header className="alth-modal__header">
          <h4 id="alth-test-title" className="alth-modal__title">{title}</h4>
          <button type="button" className="modal-close" onClick={onClose} disabled={rolling} aria-label="Fechar">×</button>
        </header>

        <div className="alth-test__body">
          <div className="alth-test__stage">
            <div ref={stageRef} className="alth-test__canvas" aria-hidden="true" />
            {!roll && !error && (
              <span className="alth-test__pool">
                {pool.count}d10 · fica o {pool.keep === 'highest' ? 'maior' : 'menor'}
                {spec.extraDie ? ` · +1d${spec.extraDie.sides}` : ''} · {signed(modifier)}
              </span>
            )}
          </div>

          {!roll && error && (
            <>
              <p className="alth-test__note alth-test__note--warn" role="alert">{error}</p>
              <div className="alth-test__actions">
                <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
                <button type="button" className="btn btn-primary" onClick={() => void doRoll()}>Tentar de novo</button>
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
                {!noAgain && <button type="button" className="btn btn-ghost" onClick={again} disabled={rolling}>{autoRoll ? 'Rolar de novo' : 'Ajustar e rolar de novo'}</button>}
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
