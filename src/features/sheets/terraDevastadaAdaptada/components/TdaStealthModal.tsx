import { useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { rollEvensTest } from '../../../dice/services/diceService'
import type { RollBreakdownItem, TdaCondition, TdaTrait } from '../../../../shared/types'
import { POOL_MAX, SITUATION_LIMIT } from '../constants/terraDevastadaAdaptada'
import { STEALTH_MODS, alertLevel } from '../constants/tdaStealth'
import {
  convictionCost,
  outcomeAgainst,
  plural,
  poolSize,
  type TestOutcome,
} from '../utils/tdaRules'
import { DiceTray, PoolPicker, picksNet, picksSummary, type Picks } from './TdaDice'
import { playRollSound } from './TdaTestModal'

// ────────────────────────────────────────────────────────
// Janela de furtividade. Três usos:
//   furtividade — passar despercebido: teste de pares contra a Atenção do
//                 lugar (a meta que o mestre definiu na cena).
//   escutar     — modo escuta: cada ponto de desempenho revela uma
//                 informação (posição, quantidade, rota de patrulha...).
//   distrair    — jogar um tijolo ou garrafa pra atrair a atenção: teste
//                 contra a Atenção do lugar.
// O Alerta da cena é do mestre: aqui só se mostra o que o resultado pede.
// ────────────────────────────────────────────────────────

export type TdaStealthMode = 'furtividade' | 'escutar' | 'distrair'

const MODES: { id: TdaStealthMode; label: string; hint: string }[] = [
  { id: 'furtividade', label: 'Furtividade', hint: 'Marque o que ajuda (+) e o que atrapalha (−). Contra um Estalador (cego), o Narrador usa o seu barulho como meta e a luz não conta.' },
  { id: 'escutar',     label: 'Escutar',     hint: 'Cada ponto de desempenho revela uma informação: posição, quantidade, rota de patrulha...' },
  { id: 'distrair',    label: 'Distrair',    hint: 'Jogue um tijolo ou uma garrafa pra atrair a atenção pra outro lado.' },
]

interface TdaStealthModalProps {
  campaignId:  string
  who:         string
  traits:      TdaTrait[]
  conditions:  TdaCondition[]
  horror:      number
  conviction:  number
  /** Atenção do lugar (1 a 6), definida pelo mestre na cena. */
  attention:   number
  alert:       number
  initialMode?: TdaStealthMode
  onConviction: (delta: number) => void
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

export function TdaStealthModal({
  campaignId, who, traits, conditions, horror, conviction, attention, alert,
  initialMode = 'furtividade', onConviction, onAnnounce, onClose,
}: TdaStealthModalProps) {
  const [mode, setMode]           = useState<TdaStealthMode>(initialMode)
  const [meta, setMeta]           = useState(attention)
  const [picks, setPicks]         = useState<Picks>({})
  const [situation, setSituation] = useState(0)
  const [mods, setMods]           = useState<Set<string>>(new Set())
  const [boost, setBoost]         = useState(0)
  const [isPrivate, setIsPrivate] = useState(false)
  const [rolling, setRolling]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [rolled, setRolled]       = useState<Rolled | null>(null)
  const [postBoost, setPostBoost] = useState(0)

  const cost = convictionCost(horror)
  const pool = poolSize(picksNet(picks, situation))
  const info = MODES.find((m) => m.id === mode)!
  const hasMeta = mode !== 'escutar'

  const performance = rolled ? rolled.evens + rolled.preBoost + postBoost : 0
  const outcome: TestOutcome | null = rolled && hasMeta ? outcomeAgainst(performance, meta) : null

  function toggleMod(id: string, delta: number) {
    const on = mods.has(id)
    const next = new Set(mods)
    if (on) next.delete(id); else next.add(id)
    setMods(next)
    setSituation((s) => Math.max(-SITUATION_LIMIT, Math.min(SITUATION_LIMIT, s + (on ? -delta : delta))))
  }

  async function roll() {
    setError(null)
    if (boost * cost > conviction) { setError('Convicção insuficiente.'); return }
    setRolling(true)
    try {
      const result = await rollEvensTest(campaignId, pool.dice, { conviction: boost, isPrivate })
      const evens = result.roll_breakdown?.find(
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

  function resultText(total: number): string {
    if (mode === 'escutar') {
      return total > 0 ? `ouviu ${plural(total, 'informação', 'informações')}` : 'não ouviu nada além de barulho'
    }
    const o = outcomeAgainst(total, meta)
    if (mode === 'furtividade') {
      return o === 'sucesso' ? 'passa despercebido' : o === 'parcial' ? 'faz barulho (o Alerta pode subir)' : 'é notado (o Alerta sobe)'
    }
    return o === 'sucesso' ? 'o barulho atrai quem estava perto'
      : o === 'parcial' ? 'atrai, mas alguém desconfia' : 'faz barulho no lugar errado (o Alerta sobe)'
  }

  function rollMessage(dice: number, total: number, pre: number): string {
    const { plus, minus } = picksSummary(picks, traits, conditions, [])
    const mod = STEALTH_MODS.filter((m) => mods.has(m.id)).map((m) => m.label.toLowerCase())
    const parts = [
      ...(plus.length ? [`+ ${plus.join(', ')}`] : []),
      ...(minus.length ? [`− ${minus.join(', ')}`] : []),
      ...(mod.length ? [mod.join(', ')] : []),
    ]
    const used = parts.length ? ` (${parts.join('; ')})` : ''
    const conv = pre > 0 ? ` (${pre} com Convicção)` : ''
    const what = mode === 'furtividade' ? 'tentou passar despercebido' : mode === 'escutar' ? 'ficou à escuta' : 'tentou distrair'
    const vs = hasMeta ? ` contra atenção ${meta}` : ''
    return truncate(`${who} ${what} com ${dice}d${used}: desempenho ${total}${conv}${vs}; ${resultText(total)}.`, 500)
  }

  function spendAfter() {
    if (!rolled || conviction < cost) return
    onConviction(-cost)
    const next = postBoost + 1
    setPostBoost(next)
    if (!rolled.isPrivate) {
      onAnnounce(`${who} usou Convicção (−${cost}): desempenho agora ${rolled.evens + rolled.preBoost + next}; ${resultText(rolled.evens + rolled.preBoost + next)}.`)
    }
  }

  function reset() {
    setRolled(null)
    setPostBoost(0)
    setBoost(0)
    setError(null)
  }

  const level = alertLevel(alert)

  return (
    <ModalOverlay onClose={onClose} closeDisabled={rolling}>
      <div className="alth-modal__window tda-modal tda-stealth" role="dialog" aria-modal="true" aria-labelledby="tda-stealth-title">
        <header className="alth-modal__header">
          <h4 id="tda-stealth-title" className="alth-modal__title tda-modal__title">{info.label}</h4>
          <button type="button" className="modal-close" onClick={onClose} disabled={rolling} aria-label="Fechar">×</button>
        </header>

        <div className="tda-modal__body">
          {!rolled && (
            <>
              <div className="tda-segmented" role="radiogroup" aria-label="Tipo de ação furtiva">
                {MODES.map((m) => (
                  <button
                    key={m.id} type="button" role="radio" aria-checked={mode === m.id}
                    className={`tda-segmented__btn${mode === m.id ? ' tda-segmented__btn--active' : ''}`}
                    onClick={() => setMode(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <p className="tda-hint">
                Alerta da cena: <strong className={`tda-alert-word tda-alert-word--${alert}`}>{level.label}</strong>. {level.effect}
              </p>

              {hasMeta && (
                <div className="tda-field">
                  <span className="tda-label">Atenção do lugar (meta)</span>
                  <div className="tda-meta" role="radiogroup" aria-label="Atenção">
                    {Array.from({ length: POOL_MAX }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n} type="button" role="radio" aria-checked={meta === n}
                        className={`tda-meta__btn${meta === n ? ' tda-meta__btn--active' : ''}`}
                        onClick={() => setMeta(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <span className="tda-hint">Já vem a que o Narrador marcou na cena ({attention}); ajuste se ele mandar.</span>
                </div>
              )}

              {mode !== 'escutar' && (
                <div className="tda-field">
                  <span className="tda-label">Na cena</span>
                  <div className="tda-picker__chips">
                    {STEALTH_MODS.map((m) => {
                      const on = mods.has(m.id)
                      return (
                        <button
                          key={m.id} type="button"
                          className={`tda-chip tda-chip--${on ? (m.delta > 0 ? 'plus' : 'minus') : 'off'}`}
                          aria-pressed={on}
                          onClick={() => toggleMod(m.id, m.delta)}
                        >
                          <span className="tda-chip__sign" aria-hidden="true">{on ? (m.delta > 0 ? '+1' : '−1') : '·'}</span>
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <PoolPicker
                traits={traits} conditions={conditions} inventory={[]}
                picks={picks} onPicks={setPicks}
                situation={situation} onSituation={setSituation}
                hint={info.hint}
              />

              <div className="tda-field">
                <span className="tda-label">Convicção antes de rolar</span>
                <div className="tda-boost">
                  <div className="tda-stepper">
                    <button
                      type="button" className="tda-stepper__btn" aria-label="Menos um ponto de Convicção"
                      onClick={() => setBoost(Math.max(0, boost - 1))} disabled={boost <= 0}
                    >
                      −
                    </button>
                    <span className="tda-stepper__value">+{boost}</span>
                    <button
                      type="button" className="tda-stepper__btn" aria-label="Mais um ponto de Convicção"
                      onClick={() => setBoost(boost + 1)}
                      disabled={(boost + 1) * cost > conviction || boost >= 10}
                    >
                      +
                    </button>
                  </div>
                  <span className="tda-hint">
                    Cada ponto garantido custa {cost} de Convicção (o seu Horror). Você tem {conviction}.
                    {boost > 0 && ` Vai gastar ${boost * cost}.`}
                  </span>
                </div>
              </div>

              <label className="tda-check">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                Rolagem privada (só você e o Narrador veem, sem aviso no chat)
              </label>

              {error && <p className="tda-warn" role="alert">{error}</p>}

              <div className="tda-actions">
                <button type="button" className="tda-btn" onClick={onClose} disabled={rolling}>Cancelar</button>
                <button type="button" className="tda-btn tda-btn--primary" onClick={() => void roll()} disabled={rolling}>
                  {rolling ? 'Rolando…' : `Rolar ${pool.dice}d`}
                </button>
              </div>
            </>
          )}

          {rolled && (
            <>
              <DiceTray results={rolled.results} bonus={rolled.bonus} />
              {rolled.bonus.length > 0 && (
                <p className="tda-hint tda-hint--center">
                  Golpe de sorte! {plural(rolled.bonus.length, 'dado extra', 'dados extras')} por causa dos 6.
                </p>
              )}

              <div className={`tda-result${outcome ? ` tda-result--${outcome}` : performance === 0 ? ' tda-result--falha' : ' tda-result--sucesso'}`} role="status">
                <span className="tda-result__number">{performance}</span>
                <span className="tda-result__label">
                  {performance === 1 ? 'ponto' : 'pontos'}{hasMeta ? ` contra atenção ${meta}` : ''}
                  {(rolled.preBoost + postBoost) > 0 && ` (${plural(rolled.evens, 'par', 'pares')} + ${rolled.preBoost + postBoost} de Convicção)`}
                </span>
                <strong className="tda-result__outcome">
                  {capitalize(resultText(performance))}.
                </strong>
              </div>

              <div className="tda-actions tda-actions--center">
                <button type="button" className="tda-btn" onClick={spendAfter} disabled={conviction < cost}>
                  +1 com Convicção (−{cost})
                </button>
              </div>
              {conviction < cost && (
                <p className="tda-hint tda-hint--center">Convicção insuficiente para mais um ponto (você tem {conviction}, precisa de {cost}).</p>
              )}

              <div className="tda-actions">
                <button type="button" className="tda-btn" onClick={reset}>Nova ação</button>
                <button type="button" className="tda-btn tda-btn--primary" onClick={onClose}>Fechar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}
