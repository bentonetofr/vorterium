import { useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { rollEvensTest } from '../../../dice/services/diceService'
import type { RollBreakdownItem, TdCondition, TdInventoryItem, TdTrait } from '../../../../shared/types'
import { CONVICTION_MAX, DIFFICULTIES, POOL_MAX } from '../constants/terraDevastada'
import {
  OUTCOME_LABELS,
  convictionCost,
  outcomeAgainst,
  plural,
  poolSize,
  redemptionAmount,
} from '../utils/tdRules'
import { DiceTray, PoolPicker, picksNet, picksSummary, type Picks } from './TdDice'

// ────────────────────────────────────────────────────────
// Janela de teste. Três usos:
//   teste     — ação contra meta (ou contra quem reage): marca o que ajuda
//               e o que atrapalha, rola, compara com a meta se tiver.
//   redencao  — Redenção do horror: cada 3 pontos tiram 1 de Horror.
//   conviccao — Recuperar Convicção: cada ponto devolve 1 de Convicção.
// A Convicção compra pontos de desempenho antes ou depois de rolar; cada
// ponto custa o Horror atual (mín. 1).
// ────────────────────────────────────────────────────────

export type TdTestPurpose = 'teste' | 'redencao' | 'conviccao'

const PURPOSES: { id: TdTestPurpose; label: string; hint: string }[] = [
  { id: 'teste',     label: 'Teste',              hint: 'Marque o que ajuda (+) e o que atrapalha (−). Toque de novo pra trocar.' },
  { id: 'redencao',  label: 'Redenção do horror', hint: 'Com o aval do Narrador, marque o que reafirma sua fé, vontade e motivações. Cada 3 pontos tiram 1 de Horror.' },
  { id: 'conviccao', label: 'Recuperar Convicção', hint: 'Com o aval do Narrador, depois de interpretar bem seu conceito ou um ato virtuoso. Cada ponto devolve 1 de Convicção.' },
]

interface TdTestModalProps {
  campaignId:  string
  who:         string
  traits:      TdTrait[]
  conditions:  TdCondition[]
  inventory:   TdInventoryItem[]
  horror:      number
  conviction:  number
  initialPurpose?: TdTestPurpose
  onConviction: (delta: number) => void
  onHorror:     (delta: number) => void
  onAnnounce:   (message: string) => void
  onClose:      () => void
}

interface Rolled {
  results:   number[]
  bonus:     number[]
  evens:     number
  dice:      number
  preBoost:  number
  isPrivate: boolean
}

export function TdTestModal({
  campaignId, who, traits, conditions, inventory, horror, conviction,
  initialPurpose = 'teste', onConviction, onHorror, onAnnounce, onClose,
}: TdTestModalProps) {
  const [purpose, setPurpose]     = useState<TdTestPurpose>(initialPurpose)
  const [objective, setObjective] = useState('')
  const [picks, setPicks]         = useState<Picks>({})
  const [situation, setSituation] = useState(0)
  const [meta, setMeta]           = useState<number | null>(null)
  const [boost, setBoost]         = useState(0)
  const [isPrivate, setIsPrivate] = useState(false)
  const [rolling, setRolling]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [rolled, setRolled]       = useState<Rolled | null>(null)
  const [postBoost, setPostBoost] = useState(0)
  const [applied, setApplied]     = useState(false)

  const cost = convictionCost(horror)
  const canBoost = purpose !== 'conviccao'
  const pool = poolSize(picksNet(picks, situation))
  const info = PURPOSES.find((p) => p.id === purpose)!

  const performance = rolled ? rolled.evens + rolled.preBoost + postBoost : 0
  const outcome = rolled && purpose === 'teste' && meta != null ? outcomeAgainst(performance, meta) : null
  const redemption = redemptionAmount(performance)
  const recovered = Math.min(performance, CONVICTION_MAX - conviction)

  async function roll() {
    setError(null)
    if (boost * cost > conviction) { setError('Convicção insuficiente.'); return }
    setRolling(true)
    try {
      const roll = await rollEvensTest(campaignId, pool.dice, { conviction: boost, isPrivate })
      const evens = roll.roll_breakdown?.find(
        (b): b is Extract<RollBreakdownItem, { type: 'evens' }> => b.type === 'evens',
      )
      if (!evens) throw new Error('Não foi possível ler a rolagem.')
      if (boost > 0) onConviction(-boost * cost)
      setRolled({
        results: evens.results, bonus: evens.bonus, evens: evens.subtotal,
        dice: evens.quantity, preBoost: boost, isPrivate,
      })
      playRollSound()
      if (!isPrivate) onAnnounce(rollMessage(evens.quantity, evens.subtotal + boost, boost))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível rolar.')
    } finally {
      setRolling(false)
    }
  }

  function rollMessage(dice: number, total: number, pre: number): string {
    const { plus, minus } = picksSummary(picks, traits, conditions, inventory)
    const goal = objective.trim()
    const what = purpose === 'redencao' ? 'tentou a redenção do horror'
      : purpose === 'conviccao' ? 'tentou recuperar Convicção'
      : goal ? `testou "${goal}"` : 'fez um teste'
    const parts = [
      ...(plus.length ? [`+ ${plus.join(', ')}`] : []),
      ...(minus.length ? [`− ${minus.join(', ')}`] : []),
      ...(situation ? [`situação ${situation > 0 ? '+' : ''}${situation}`] : []),
    ]
    const used = parts.length ? ` (${parts.join('; ')})` : ''
    const conv = pre > 0 ? ` (${pre} com Convicção)` : ''
    const vsMeta = purpose === 'teste' && meta != null ? `; meta ${meta}, ${outcomeWord(outcomeAgainst(total, meta))}` : ''
    return truncate(`${who} ${what} com ${dice}d${used}: desempenho ${total}${conv}${vsMeta}.`, 500)
  }

  function spendAfter() {
    if (!rolled || conviction < cost) return
    onConviction(-cost)
    const next = postBoost + 1
    setPostBoost(next)
    if (!rolled.isPrivate) {
      const total = rolled.evens + rolled.preBoost + next
      onAnnounce(`${who} usou Convicção (−${cost}): desempenho agora ${total}${purpose === 'teste' && meta != null ? `, ${outcomeWord(outcomeAgainst(total, meta))}` : ''}.`)
    }
  }

  function apply() {
    if (!rolled || applied) return
    if (purpose === 'redencao' && redemption > 0) {
      const amount = Math.min(redemption, horror)
      onHorror(-amount)
      if (!rolled.isPrivate) onAnnounce(`${who} se reafirmou: −${amount} de Horror (agora ${horror - amount}).`)
    }
    if (purpose === 'conviccao' && recovered > 0) {
      onConviction(recovered)
      if (!rolled.isPrivate) onAnnounce(`${who} recuperou ${recovered} de Convicção (agora ${conviction + recovered}).`)
    }
    setApplied(true)
  }

  function reset() {
    setRolled(null)
    setPostBoost(0)
    setApplied(false)
    setBoost(0)
    setError(null)
  }

  return (
    <ModalOverlay onClose={onClose} closeDisabled={rolling}>
      <div className="alth-modal__window td-modal td-test" role="dialog" aria-modal="true" aria-labelledby="td-test-title">
        <header className="alth-modal__header">
          <h4 id="td-test-title" className="alth-modal__title td-modal__title">{info.label}</h4>
          <button type="button" className="modal-close" onClick={onClose} disabled={rolling} aria-label="Fechar">×</button>
        </header>

        <div className="td-modal__body">
          {!rolled && (
            <>
              <div className="td-segmented" role="radiogroup" aria-label="Tipo de teste">
                {PURPOSES.map((p) => (
                  <button
                    key={p.id} type="button" role="radio" aria-checked={purpose === p.id}
                    className={`td-segmented__btn${purpose === p.id ? ' td-segmented__btn--active' : ''}`}
                    onClick={() => { setPurpose(p.id); if (p.id === 'conviccao') setBoost(0) }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {purpose === 'teste' && (
                <label className="td-field">
                  <span className="td-label">Objetivo (opcional)</span>
                  <input
                    type="text" className="input" maxLength={120} placeholder="Ex.: acertar a cabeça do zumbi"
                    value={objective} onChange={(e) => setObjective(e.target.value)}
                  />
                </label>
              )}

              <PoolPicker
                traits={traits} conditions={conditions} inventory={inventory}
                picks={picks} onPicks={setPicks}
                situation={situation} onSituation={setSituation}
                hint={info.hint}
              />

              {purpose === 'teste' && (
                <div className="td-field">
                  <span className="td-label">Meta do Narrador (opcional)</span>
                  <div className="td-meta" role="radiogroup" aria-label="Meta">
                    <button
                      type="button" role="radio" aria-checked={meta == null}
                      className={`td-meta__btn${meta == null ? ' td-meta__btn--active' : ''}`}
                      onClick={() => setMeta(null)}
                    >
                      Sem meta
                    </button>
                    {Array.from({ length: POOL_MAX }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n} type="button" role="radio" aria-checked={meta === n}
                        className={`td-meta__btn${meta === n ? ' td-meta__btn--active' : ''}`}
                        onClick={() => setMeta(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <span className="td-hint">
                    {DIFFICULTIES.map((d) => `${d.label} ${d.range}`).join(' · ')}. Contra outro personagem, compare com o desempenho dele.
                  </span>
                </div>
              )}

              {canBoost && (
                <div className="td-field">
                  <span className="td-label">Convicção antes de rolar</span>
                  <div className="td-boost">
                    <div className="td-stepper">
                      <button
                        type="button" className="td-stepper__btn" aria-label="Menos um ponto de Convicção"
                        onClick={() => setBoost(Math.max(0, boost - 1))} disabled={boost <= 0}
                      >
                        −
                      </button>
                      <span className="td-stepper__value">+{boost}</span>
                      <button
                        type="button" className="td-stepper__btn" aria-label="Mais um ponto de Convicção"
                        onClick={() => setBoost(boost + 1)}
                        disabled={(boost + 1) * cost > conviction || boost >= 10}
                      >
                        +
                      </button>
                    </div>
                    <span className="td-hint">
                      Cada ponto garantido custa {cost} de Convicção (o seu Horror). Você tem {conviction}.
                      {boost > 0 && ` Vai gastar ${boost * cost}.`}
                    </span>
                  </div>
                </div>
              )}

              <label className="td-check">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                Rolagem privada (só você e o Narrador veem, sem aviso no chat)
              </label>

              {error && <p className="td-warn" role="alert">{error}</p>}

              <div className="td-actions">
                <button type="button" className="td-btn" onClick={onClose} disabled={rolling}>Cancelar</button>
                <button type="button" className="td-btn td-btn--primary" onClick={() => void roll()} disabled={rolling}>
                  {rolling ? 'Rolando…' : `Rolar ${pool.dice}d`}
                </button>
              </div>
            </>
          )}

          {rolled && (
            <>
              <DiceTray results={rolled.results} bonus={rolled.bonus} />
              {rolled.bonus.length > 0 && (
                <p className="td-hint td-hint--center">
                  Golpe de sorte! {plural(rolled.bonus.length, 'dado extra', 'dados extras')} por causa dos 6.
                </p>
              )}

              <div className={`td-result${outcome ? ` td-result--${outcome}` : performance === 0 ? ' td-result--falha' : ''}`} role="status">
                <span className="td-result__number">{performance}</span>
                <span className="td-result__label">
                  {performance === 1 ? 'ponto de desempenho' : 'pontos de desempenho'}
                  {(rolled.preBoost + postBoost) > 0 && ` (${plural(rolled.evens, 'par', 'pares')} + ${rolled.preBoost + postBoost} de Convicção)`}
                </span>
                {outcome && <strong className="td-result__outcome">{OUTCOME_LABELS[outcome]}</strong>}
                {!outcome && performance === 0 && purpose === 'teste' && (
                  <strong className="td-result__outcome">Nenhum par: falha automática.</strong>
                )}
              </div>

              {canBoost && !applied && (
                <div className="td-actions td-actions--center">
                  <button type="button" className="td-btn" onClick={spendAfter} disabled={conviction < cost}>
                    +1 com Convicção (−{cost})
                  </button>
                </div>
              )}
              {canBoost && !applied && conviction < cost && (
                <p className="td-hint td-hint--center">Convicção insuficiente para mais um ponto (você tem {conviction}, precisa de {cost}).</p>
              )}

              {purpose === 'redencao' && (
                <p className="td-hint td-hint--center">
                  {redemption > 0
                    ? `Dá pra tirar ${plural(Math.min(redemption, horror), 'ponto', 'pontos')} de Horror.`
                    : 'Menos de 3 pontos: o Horror fica como está.'}
                </p>
              )}
              {purpose === 'conviccao' && (
                <p className="td-hint td-hint--center">
                  {recovered > 0
                    ? `Recupera ${recovered} de Convicção${recovered < performance ? ' (a trilha vai até 24)' : ''}.`
                    : performance > 0 ? 'A Convicção já está no máximo.' : 'Nenhum ponto: a Convicção fica como está.'}
                </p>
              )}

              <div className="td-actions">
                <button type="button" className="td-btn" onClick={reset}>Novo teste</button>
                {purpose === 'redencao' && redemption > 0 && horror > 0 && !applied && (
                  <button type="button" className="td-btn td-btn--primary" onClick={apply}>
                    Tirar {Math.min(redemption, horror)} de Horror
                  </button>
                )}
                {purpose === 'conviccao' && recovered > 0 && !applied && (
                  <button type="button" className="td-btn td-btn--primary" onClick={apply}>
                    Recuperar {recovered} de Convicção
                  </button>
                )}
                <button
                  type="button"
                  className={`td-btn${(purpose === 'teste' || applied) ? ' td-btn--primary' : ''}`}
                  onClick={onClose}
                >
                  Fechar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  )
}

function outcomeWord(o: ReturnType<typeof outcomeAgainst>): string {
  return o === 'sucesso' ? 'sucesso' : o === 'parcial' ? 'sucesso parcial' : 'falha'
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

export function playRollSound() {
  try {
    const audio = new Audio('/dice-roll.mp3')
    audio.volume = 0.6
    void audio.play().catch(() => { /* autoplay bloqueado — o som é só um extra */ })
  } catch {
    /* sem Audio API */
  }
}
