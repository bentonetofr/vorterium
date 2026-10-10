import { useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { Select } from '../../../../shared/components/Select'
import { rollEvensTest } from '../../../dice/services/diceService'
import type { RollBreakdownItem, TdaCondition, TdaInventoryItem, TdaTrait } from '../../../../shared/types'
import { DIFFICULTIES, POOL_MAX } from '../constants/terraDevastadaAdaptada'
import {
  RICHNESS,
  findCount,
  lootLabel,
  rollLoot,
  type LootFind,
  type Richness,
} from '../utils/tdaLoot'
import { OUTCOME_LABELS, convictionCost, outcomeAgainst, plural, poolSize, type TestOutcome } from '../utils/tdaRules'
import { ammoCap, weaponType } from '../utils/tdaSupplies'
import { DiceTray, PoolPicker, picksNet, picksSummary, type Picks } from './TdaDice'
import { playRollSound } from './TdaTestModal'

// ────────────────────────────────────────────────────────
// Janela de Revistar. O teste de pares é contra a meta do Narrador (quão
// escondido está o que há), e o resultado diz quantos achados saem:
// falha 0, parcial 1, sucesso 2 (mais 1 a cada 2 pares além da meta + 1,
// até 4). Cada achado é um sorteio na tabela de d6; a riqueza do lugar
// (Escasso, Comum, Rico) empurra a tabela pra baixo ou pra cima. Só o que
// você guarda entra na ficha, e só cabe o que a Mochila e o teto de 3
// permitem. Revistar faz barulho: falha ou parcial pedem atenção ao Alerta.
// ────────────────────────────────────────────────────────

interface Stored { ok: boolean; text: string }

interface TdaSearchModalProps {
  campaignId:  string
  who:         string
  traits:      TdaTrait[]
  conditions:  TdaCondition[]
  inventory:   TdaInventoryItem[]
  backpack:    number
  horror:      number
  conviction:  number
  onConviction: (delta: number) => void
  /** Guarda os achados na ficha (em ordem) e diz como foi com cada um. */
  onLoot:       (entries: { find: LootFind; weaponId?: string }[]) => Stored[]
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

interface FindRow {
  find:     LootFind
  weaponId: string
  state:    'pendente' | 'guardado' | 'deixado' | 'erro'
  note:     string
}

export function TdaSearchModal({
  campaignId, who, traits, conditions, inventory, backpack, horror, conviction,
  onConviction, onLoot, onAnnounce, onClose,
}: TdaSearchModalProps) {
  const [meta, setMeta]           = useState(1)
  const [richness, setRichness]   = useState<Richness>('comum')
  const [picks, setPicks]         = useState<Picks>({})
  const [situation, setSituation] = useState(0)
  const [boost, setBoost]         = useState(0)
  const [isPrivate, setIsPrivate] = useState(false)
  const [rolling, setRolling]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [rolled, setRolled]       = useState<Rolled | null>(null)
  const [postBoost, setPostBoost] = useState(0)
  const [finds, setFinds]         = useState<FindRow[] | null>(null)

  const cost = convictionCost(horror)
  const pool = poolSize(picksNet(picks, situation))
  const shift = RICHNESS.find((r) => r.id === richness)?.shift ?? 0

  const guns = inventory.filter((i) => i.kind === 'arma' && i.name.trim() && weaponType(i) === 'fogo')
  const gunOptions = guns.map((g) => ({
    value: g.id, label: `${g.name.trim()} (${g.ammo ?? 0}/${ammoCap(g, backpack)})`,
  }))
  const fullestRoom = guns.slice().sort((a, b) =>
    (ammoCap(b, backpack) - (b.ammo ?? 0)) - (ammoCap(a, backpack) - (a.ammo ?? 0)))[0]?.id ?? ''

  const performance = rolled ? rolled.evens + rolled.preBoost + postBoost : 0
  const outcome: TestOutcome | null = rolled ? outcomeAgainst(performance, meta) : null
  const count = outcome ? findCount(outcome, performance, meta) : 0

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

  function rollMessage(dice: number, total: number, pre: number): string {
    const { plus, minus } = picksSummary(picks, traits, conditions, [])
    const parts = [
      ...(plus.length ? [`+ ${plus.join(', ')}`] : []),
      ...(minus.length ? [`− ${minus.join(', ')}`] : []),
      ...(situation ? [`situação ${situation > 0 ? '+' : ''}${situation}`] : []),
    ]
    const used = parts.length ? ` (${parts.join('; ')})` : ''
    const conv = pre > 0 ? ` (${pre} com Convicção)` : ''
    const o = outcomeAgainst(total, meta)
    return truncate(`${who} revistou o lugar (${dice}d${used}): desempenho ${total}${conv} contra meta ${meta}, ${o === 'sucesso' ? 'sucesso' : o === 'parcial' ? 'sucesso parcial' : 'falha'}.`, 500)
  }

  function spendAfter() {
    if (!rolled || conviction < cost || finds) return
    onConviction(-cost)
    const next = postBoost + 1
    setPostBoost(next)
    if (!rolled.isPrivate) {
      const total = rolled.evens + rolled.preBoost + next
      onAnnounce(`${who} usou Convicção (−${cost}): desempenho agora ${total}.`)
    }
  }

  /** Sorteia os achados com o resultado final do teste (depois disso não muda mais). */
  function reveal() {
    if (!rolled || finds) return
    const rows: FindRow[] = Array.from({ length: count }, () => {
      const find = rollLoot(shift)
      return { find, weaponId: fullestRoom, state: find.kind === 'nada' ? 'deixado' : 'pendente', note: '' } as FindRow
    })
    setFinds(rows)
    if (!rolled.isPrivate) {
      const list = rows.length === 0 ? 'não achou nada' : `achou ${rows.map((r) => lootLabel(r.find).toLowerCase()).join(', ')}`
      onAnnounce(truncate(`${who} ${list}${richness === 'comum' ? '' : ` (lugar ${richness})`}.`, 500))
    }
  }

  function store(indexes: number[]) {
    if (!finds) return
    const entries = indexes.map((i) => ({ find: finds[i].find, weaponId: finds[i].weaponId || undefined }))
    const results = onLoot(entries)
    setFinds(finds.map((row, i) => {
      const at = indexes.indexOf(i)
      if (at < 0) return row
      const r = results[at]
      return { ...row, state: r.ok ? 'guardado' : 'erro', note: r.text }
    }))
  }

  function leave(i: number) {
    setFinds((prev) => prev && prev.map((row, idx) => (idx === i ? { ...row, state: 'deixado', note: 'Deixou pra trás' } : row)))
  }

  function reset() {
    setRolled(null)
    setFinds(null)
    setPostBoost(0)
    setBoost(0)
    setError(null)
  }

  const pending = finds ? finds.map((r, i) => (r.state === 'pendente' ? i : -1)).filter((i) => i >= 0) : []
  const noise = outcome === 'falha' || outcome === 'parcial'

  return (
    <ModalOverlay onClose={onClose} closeDisabled={rolling}>
      <div className="alth-modal__window tda-modal tda-search" role="dialog" aria-modal="true" aria-labelledby="tda-search-title">
        <header className="alth-modal__header">
          <h4 id="tda-search-title" className="alth-modal__title tda-modal__title">Revistar</h4>
          <button type="button" className="modal-close" onClick={onClose} disabled={rolling} aria-label="Fechar">×</button>
        </header>

        <div className="tda-modal__body">
          {!rolled && (
            <>
              <div className="tda-field">
                <span className="tda-label">Meta do Narrador (quão escondido está)</span>
                <div className="tda-meta" role="radiogroup" aria-label="Meta">
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
                <span className="tda-hint">{DIFFICULTIES.map((d) => `${d.label} ${d.range}`).join(' · ')}.</span>
              </div>

              <div className="tda-field">
                <span className="tda-label">Riqueza do lugar</span>
                <div className="tda-segmented" role="radiogroup" aria-label="Riqueza do lugar">
                  {RICHNESS.map((r) => (
                    <button
                      key={r.id} type="button" role="radio" aria-checked={richness === r.id}
                      className={`tda-segmented__btn${richness === r.id ? ' tda-segmented__btn--active' : ''}`}
                      onClick={() => setRichness(r.id)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <span className="tda-hint">{RICHNESS.find((r) => r.id === richness)?.hint}</span>
              </div>

              <PoolPicker
                traits={traits} conditions={conditions} inventory={[]}
                picks={picks} onPicks={setPicks}
                situation={situation} onSituation={setSituation}
                hint="Marque o que ajuda (+) e o que atrapalha (−). Revistar faz barulho."
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

          {rolled && outcome && (
            <>
              <DiceTray results={rolled.results} bonus={rolled.bonus} />
              {rolled.bonus.length > 0 && (
                <p className="tda-hint tda-hint--center">
                  Golpe de sorte! {plural(rolled.bonus.length, 'dado extra', 'dados extras')} por causa dos 6.
                </p>
              )}

              <div className={`tda-result tda-result--${outcome}`} role="status">
                <span className="tda-result__number">{performance}</span>
                <span className="tda-result__label">
                  {performance === 1 ? 'ponto' : 'pontos'} contra meta {meta}
                  {(rolled.preBoost + postBoost) > 0 && ` (${plural(rolled.evens, 'par', 'pares')} + ${rolled.preBoost + postBoost} de Convicção)`}
                </span>
                <strong className="tda-result__outcome">
                  {OUTCOME_LABELS[outcome]} {count === 0 ? 'Nenhum achado.' : `${plural(count, 'achado', 'achados')}.`}
                </strong>
              </div>

              {!finds && (
                <>
                  <div className="tda-actions tda-actions--center">
                    <button type="button" className="tda-btn" onClick={spendAfter} disabled={conviction < cost}>
                      +1 com Convicção (−{cost})
                    </button>
                  </div>
                  {conviction < cost && (
                    <p className="tda-hint tda-hint--center">Convicção insuficiente para mais um ponto (você tem {conviction}, precisa de {cost}).</p>
                  )}
                  <div className="tda-actions tda-actions--center">
                    <button type="button" className="tda-btn tda-btn--primary" onClick={reveal}>
                      {count === 0 ? 'Encerrar a busca' : 'Ver o que achou'}
                    </button>
                  </div>
                </>
              )}

              {finds && finds.length > 0 && (
                <ul className="tda-loot">
                  {finds.map((row, i) => (
                    <li key={i} className={`tda-loot__row tda-loot__row--${row.state}`}>
                      <div className="tda-loot__info">
                        <strong>{lootLabel(row.find)}</strong>
                        {row.find.kind === 'ammo' && row.state === 'pendente' && (
                          guns.length > 0 ? (
                            <Select
                              listClassName="tda-select-list" className="tda-loot__gun"
                              value={row.weaponId} options={gunOptions} aria-label="Arma que recebe a munição"
                              onChange={(v) => setFinds((prev) => prev && prev.map((r, idx) => (idx === i ? { ...r, weaponId: v } : r)))}
                            />
                          ) : <span className="tda-hint">Sem arma de fogo no inventário.</span>
                        )}
                        {row.note && <span className={row.state === 'erro' ? 'tda-warn' : 'tda-hint'}>{row.note}</span>}
                      </div>
                      {row.state === 'pendente' && (
                        <div className="tda-loot__actions">
                          <button type="button" className="tda-btn tda-btn--primary" onClick={() => store([i])}>Guardar</button>
                          <button type="button" className="tda-btn" onClick={() => leave(i)}>Deixar</button>
                        </div>
                      )}
                      {row.state === 'erro' && (
                        <button type="button" className="tda-btn" onClick={() => leave(i)}>Deixar</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {finds && pending.length > 1 && (
                <div className="tda-actions tda-actions--center">
                  <button type="button" className="tda-btn tda-btn--primary" onClick={() => store(pending)}>
                    Guardar tudo que couber
                  </button>
                </div>
              )}

              {noise && (
                <p className="tda-hint tda-hint--center">
                  Revistar faz barulho: o Narrador pode subir o Alerta da cena.
                </p>
              )}

              <div className="tda-actions">
                <button type="button" className="tda-btn" onClick={reset}>Nova busca</button>
                <button type="button" className="tda-btn tda-btn--primary" onClick={onClose}>Fechar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  )
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}
