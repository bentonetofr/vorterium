import { useEffect, useMemo, useState } from 'react'
import type { AltheriumInventoryItem } from '../../../../shared/types'
import { Select } from '../../../../shared/components/Select'
import './AltheriumPlay.css'
import { WEAPONS, findArmor, findWeapon, weaponReinforcementSlots, type RepairMaterial } from '../constants/altheriumItems'
import type { AltheriumCustomItemInput } from '../services/altheriumSheetService'
import { getAltheriumCampaignSagas, setAltheriumCampaignSagas } from '../services/altheriumSheetService'
import {
  BAND_LABELS,
  BASES,
  CATALYSTS,
  CORES,
  QUALITIES,
  REINFORCEMENTS,
  RESOURCES,
  RESOURCE_LIMIT_UNITS,
  SAGAS,
  addResource,
  buildRecipe,
  costText,
  dismantleReturn,
  formatAmount,
  integrityBand,
  missing,
  readCost,
  readReinforcements,
  readSagas,
  reinforcementDef,
  reinforcementUnlocked,
  removeResource,
  repairPlan,
  resourceLabel,
  resourceTotal,
  spend,
  type BaseId,
  type CatalystId,
  type CoreId,
  type Cost,
  type Quality,
  type RepairPlace,
  type ResourceId,
  type ResourceStock,
  type SagaId,
} from '../utils/altheriumCraft'

// ────────────────────────────────────────────────────────
// Aba Ofício (livro 2.0), no jeito da aba Suprimentos da Terra Devastada:
// duas colunas de cartões. À esquerda os Materiais em frações (com o "Achei
// +25%"), as Rações e a Integridade com reparo; à direita Fabricar (Base +
// Núcleo + Catalisador), Reforços, Sagas do grupo e Desmontar. Campo repara
// até 75% e só a Forja chega a 100%; tudo custa a mesma % em material.
// ────────────────────────────────────────────────────────

/** Arma, armadura ou escudo do inventário, com o que o Ofício precisa. */
export interface GearInfo {
  inv:      AltheriumInventoryItem
  name:     string
  kind:     'arma' | 'armadura' | 'escudo'
  repair:   RepairMaterial
  slots:    number
  heavy:    boolean
  robusta:  boolean
  fragil:   boolean
  integrity: number
  reinforcements: string[]
}

export function gearInfo(inv: AltheriumInventoryItem): GearInfo | null {
  if (inv.item_type !== 'arma' && inv.item_type !== 'armadura' && inv.item_type !== 'escudo') return null
  const base = {
    inv, kind: inv.item_type, integrity: inv.integrity ?? 100,
    reinforcements: readReinforcements(inv.reinforcements),
  } as const
  if (inv.custom_name !== null) {
    return { ...base, name: inv.custom_name, repair: 'ferro_velho', slots: 1, heavy: false, robusta: false, fragil: false }
  }
  if (inv.item_type === 'arma') {
    const w = findWeapon(inv.item_id)
    if (!w) return null
    const has = (id: string) => w.properties.some((p) => p.id === id)
    return { ...base, name: w.name, repair: w.repair, slots: weaponReinforcementSlots(w), heavy: w.category === 'pesada', robusta: has('robusta'), fragil: has('fragil') }
  }
  const a = findArmor(inv.item_id)
  if (!a) return null
  return { ...base, name: a.name, repair: a.repair, slots: 1, heavy: false, robusta: false, fragil: false }
}

interface Props {
  campaignId:     string
  inventory:      AltheriumInventoryItem[]
  stock:          ResourceStock
  onStock:        (next: ResourceStock) => void
  /** O banco já guarda recursos e Integridade (migration 20240217)? */
  known:          boolean
  onPatch:        (id: string, patch: { integrity?: number; reinforcements?: string[] }) => Promise<void>
  onCraft:        (input: AltheriumCustomItemInput, materials: Record<string, number>) => Promise<void>
  onAddCatalog:   (itemType: AltheriumInventoryItem['item_type'], itemId: string) => Promise<void>
  onUpdateQuantity: (id: string, quantity: number) => Promise<void>
  onRemove:       (id: string) => Promise<void>
}

type Resource = (typeof RESOURCES)[number]

const RESOURCE_OPTIONS = RESOURCES.map((r) => ({ value: r.id, label: r.label }))

export function AltheriumCraftPanel({
  campaignId, inventory, stock, onStock, known, onPatch, onCraft, onAddCatalog, onUpdateQuantity, onRemove,
}: Props) {
  const gear = useMemo(() => inventory.map(gearInfo).filter((g): g is GearInfo => g !== null), [inventory])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sagas, setSagas] = useState<SagaId[]>([])

  useEffect(() => {
    let alive = true
    void getAltheriumCampaignSagas(campaignId).then((s) => { if (alive) setSagas(readSagas(s)) })
    return () => { alive = false }
  }, [campaignId])

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true)
    setMessage(null)
    try { await fn(); setMessage(ok) } catch (err) { setMessage(err instanceof Error ? err.message : 'Não deu certo.') } finally { setBusy(false) }
  }

  /** Paga o custo do estoque (ou avisa o que falta). */
  function pay(cost: Cost, pinned?: { id: ResourceId; quality: Quality }): ResourceStock | null {
    const next = spend(stock, cost, pinned)
    if (!next) setMessage(`Falta material: ${missing(stock, cost, pinned).join(', ')}.`)
    return next
  }

  // ── Recursos ──
  const [found, setFound] = useState<Quality>('comum')

  /** "Achei" soma na qualidade escolhida; o "−" tira uma fração dela. */
  function change(r: Resource, pct: number) {
    const q: Quality = r.noQuality ? 'comum' : found
    if (pct > 0) {
      const res = addResource(stock, r.id, q, pct)
      onStock(res.stock)
      setMessage(res.overflow > 0 ? `Limite de ${RESOURCE_LIMIT_UNITS} unidades de ${r.label}: ${res.overflow}% ficaram para trás.` : null)
    } else {
      onStock(removeResource(stock, r.id, q, -pct))
      setMessage(null)
    }
  }

  // ── Reparo ──
  const [place, setPlace] = useState<RepairPlace>('campo')
  const [hammer, setHammer] = useState(false)
  const planFor = (g: GearInfo) => repairPlan(g.integrity, 100, place, hammer && g.heavy)

  async function doRepair(g: GearInfo) {
    const plan = planFor(g)
    if (plan.amount <= 0) return
    const next = pay({ [g.repair]: plan.amount })
    if (!next) return
    await run(async () => { await onPatch(g.inv.id, { integrity: plan.to }); onStock(next) },
      `${g.name} reparada para ${plan.to}% (−${plan.amount}% ${resourceLabel(g.repair)}).`)
  }

  // ── Receitas ──
  const [base, setBase] = useState<BaseId>('garrafa')
  const [core, setCore] = useState<CoreId>('fogo')
  const [catalyst, setCatalyst] = useState<CatalystId | ''>('')
  const [quality, setQuality] = useState<Quality>('comum')
  const recipe = buildRecipe(base, core, catalyst || null, quality, sagas)
  const recipeMissing = missing(stock, recipe.cost, recipe.pinned)

  async function doCraft() {
    if (recipe.error) return
    const next = pay(recipe.cost, recipe.pinned)
    if (!next) return
    await run(async () => {
      await onCraft({
        item_type: 'consumivel', name: recipe.name.slice(0, 80), detail: recipe.effect.slice(0, 500),
        db: 0, damageDice: '', damageType: 'corte', attribute: 'furia', range: 'toque',
      }, recipe.cost as Record<string, number>)
      onStock(next)
    }, `${recipe.name} pronta no inventário.`)
  }

  const improvised = WEAPONS.filter((w) => w.properties.some((p) => p.id === 'improvisada'))
  async function craftImprovised(id: string) {
    const w = findWeapon(id)!
    const next = pay({ [w.repair]: 100 })
    if (!next) return
    await run(async () => { await onAddCatalog('arma', w.id); onStock(next) }, `${w.name} feita em Campo (−100% ${resourceLabel(w.repair)}).`)
  }

  // ── Reforços ──
  const [reinfItem, setReinfItem] = useState('')
  const reinfGear = gear.find((g) => g.inv.id === reinfItem) ?? gear[0] ?? null
  const reinfOptions = reinfGear
    ? REINFORCEMENTS.filter((r) => (r.target === 'arma') === (reinfGear.kind === 'arma'))
    : []
  const slotsLeft = reinfGear ? reinfGear.slots - reinfGear.reinforcements.length : 0

  async function doReinforce(reinf: (typeof REINFORCEMENTS)[number]) {
    if (!reinfGear) return
    if (!reinforcementUnlocked(reinf, sagas)) { setMessage(`${reinf.label} precisa da ${SAGAS.find((s) => s.id === reinf.saga)!.label}.`); return }
    if (slotsLeft <= 0) { setMessage(`${reinfGear.name} não tem espaço de Reforço livre.`); return }
    if (reinfGear.reinforcements.includes(reinf.id)) { setMessage(`${reinfGear.name} já tem ${reinf.label}.`); return }
    const next = pay(reinf.cost)
    if (!next) return
    await run(async () => {
      await onPatch(reinfGear.inv.id, { reinforcements: [...reinfGear.reinforcements, reinf.id] })
      onStock(next)
    }, `${reinf.label} aplicado em ${reinfGear.name}.`)
  }

  // ── Sagas ──
  async function toggleSaga(id: SagaId) {
    const next = sagas.includes(id) ? sagas.filter((s) => s !== id) : [...sagas, id]
    await run(async () => { await setAltheriumCampaignSagas(campaignId, next); setSagas(next) }, 'Sagas do grupo salvas.')
  }

  // ── Desmontar ──
  const dismantlable = inventory
  const [disId, setDisId] = useState('')
  const disItem = dismantlable.find((i) => i.id === disId) ?? dismantlable[0] ?? null
  const disMaterials = disItem?.crafted ? readCost(disItem.crafted) : null
  const [manualRes, setManualRes] = useState<ResourceId>('ferro_velho')
  const [manualPct, setManualPct] = useState(50)
  const disReturn: Cost = disMaterials ? dismantleReturn(disMaterials) : { [manualRes]: manualPct }

  async function doDismantle() {
    if (!disItem) return
    let next = stock
    for (const [k, v] of Object.entries(disReturn)) next = addResource(next, k as ResourceId, 'comum', v ?? 0).stock
    await run(async () => {
      if (disItem.quantity > 1) await onUpdateQuantity(disItem.id, disItem.quantity - 1)
      else await onRemove(disItem.id)
      onStock(next)
    }, `Desmontado: +${costText(disReturn)}.`)
  }

  const itemName = (i: AltheriumInventoryItem) => gearInfo(i)?.name ?? i.custom_name ?? findWeapon(i.item_id)?.name ?? i.item_id

  const materials = RESOURCES.filter((r) => r.id !== 'racao')
  const rations = RESOURCES.find((r) => r.id === 'racao')!

  /** Segmentos de escolha única (Base, Núcleo, Catalisador, qualidade). */
  function pick<T extends string>(label: string, value: T, options: { id: T; label: string }[], onChange: (v: T) => void) {
    return (
      <div className="alth-segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id}
            className={`alth-segmented__btn${value === o.id ? ' alth-segmented__btn--on' : ''}`} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    )
  }

  function material(r: Resource) {
    const total = resourceTotal(stock, r.id)
    const row = stock[r.id] ?? {}
    return (
      <li key={r.id} className="alth-material">
        <div className="alth-material__head">
          <span className="alth-supply__name">
            {r.label}
            <span className="alth-supply__hint">{r.what}</span>
          </span>
          <span className="alth-material__amount">{total ? `${total}%` : '—'}</span>
        </div>
        <div className="alth-gauge" role="img" aria-label={`${r.label}: ${formatAmount(total)} de ${RESOURCE_LIMIT_UNITS}`}>
          {Array.from({ length: RESOURCE_LIMIT_UNITS }, (_, i) => {
            const fill = Math.max(0, Math.min(1, (total - i * 100) / 100))
            return (
              <span key={i} className={`alth-gauge__cell${fill >= 1 ? ' alth-gauge__cell--full' : ''}`}>
                <span className="alth-gauge__fill" style={{ width: `${fill * 100}%` }} />
              </span>
            )
          })}
        </div>
        <div className="alth-material__foot">
          <span className="alth-hint">
            {total ? formatAmount(total) : 'Nenhum'}
            {!r.noQuality && row.raro ? ` · raro ${row.raro}%` : ''}{!r.noQuality && row.lendario ? ` · lendário ${row.lendario}%` : ''}
          </span>
          <span className="alth-material__find">
            <span className="alth-supply__label">Achei</span>
            {r.fractions.map((f) => (
              <button key={f} type="button" className="alth-minibtn" onClick={() => change(r, f)} disabled={total >= RESOURCE_LIMIT_UNITS * 100}>+{f}%</button>
            ))}
            <button type="button" className="alth-minibtn alth-minibtn--out" onClick={() => change(r, -r.fractions[0])} disabled={!total}
              title={`Tirar ${r.fractions[0]}% (perdi ou gastei fora da ficha)`}>−</button>
          </span>
        </div>
      </li>
    )
  }

  return (
    <div className="alth-supply">
      {!known && <p className="alth-hint alth-supply__wide">O banco ainda não guarda Ofício (migration 20240217): recursos e Integridade não ficam salvos.</p>}
      {message && <p className="alth-craft__message alth-supply__wide" role="status">{message}</p>}

      <div className="alth-stack">
        <section className="alth-card">
          <div className="alth-card__header">
            <h4 className="alth-card__title">Materiais <span className="alth-card__subtitle">em frações</span></h4>
            <span className="alth-counter">até {RESOURCE_LIMIT_UNITS} de cada</span>
          </div>
          <p className="alth-hint">
            Os recursos se acham em frações de 10, 20, 25, 50 ou 100%. Só servem para fabricar e reparar quando somam
            <strong> 100%</strong>, então as frações vão se juntando pelo caminho. Item feito com material raro ganha +1 no efeito; com lendário, +2 e dano Rúnico.
          </p>
          <div className="alth-field-block">
            <span className="alth-supply__label">O que achei é</span>
            {pick('Qualidade do que achou', found, QUALITIES, setFound)}
          </div>
          <ul className="alth-list">{materials.map(material)}</ul>
        </section>

        <section className="alth-card">
          <div className="alth-card__header">
            <h4 className="alth-card__title">Rações <span className="alth-card__subtitle">1 por Descanso Longo</span></h4>
            <span className="alth-counter">até {RESOURCE_LIMIT_UNITS}</span>
          </div>
          <ul className="alth-list">{material(rations)}</ul>
          <p className="alth-hint">Comer 1 Ração fora de combate tira 1 nível de Fome (botão na faixa de estado). Tavernas e salões vendem por cerca de ¤50.</p>
        </section>

        <section className="alth-card">
          <div className="alth-card__header">
            <h4 className="alth-card__title">Integridade <span className="alth-card__subtitle">e reparo</span></h4>
          </div>
          {pick<RepairPlace>('Onde repara', place, [{ id: 'campo', label: 'Campo · até 75%' }, { id: 'forja', label: 'Forja · até 100%' }], setPlace)}
          {gear.length === 0 && <p className="alth-hint">Nenhuma arma, armadura ou escudo no inventário.</p>}
          <ul className="alth-list">
            {gear.map((g) => {
              const band = integrityBand(g.integrity)
              const plan = planFor(g)
              return (
                <li key={g.inv.id} className="alth-recipe">
                  <div className="alth-recipe__info">
                    <strong>{g.name}</strong>
                    <span className={`alth-integrity alth-integrity--${band}`}>{g.integrity}% · {BAND_LABELS[band]}</span>
                    <div className="alth-bar" aria-hidden="true"><span className={`alth-bar__fill alth-bar__fill--${band}`} style={{ width: `${g.integrity}%` }} /></div>
                    <span className="alth-hint">
                      {plan.amount > 0 ? `${g.integrity}% → ${plan.to}% · custa ${plan.amount}% de ${resourceLabel(g.repair).toLowerCase()}` : 'Nada a reparar aqui.'}
                    </span>
                    {g.heavy && place === 'campo' && (
                      <label className="alth-test__check" title="Triunfo do Berserker: num Descanso Curto, repara uma arma pesada em Campo até 100%.">
                        <input type="checkbox" checked={hammer} onChange={(e) => setHammer(e.target.checked)} /> Martelo do Ferreiro
                      </label>
                    )}
                  </div>
                  <button type="button" className="btn btn-ghost" disabled={busy || plan.amount <= 0} onClick={() => void doRepair(g)}>Reparar</button>
                </li>
              )
            })}
          </ul>
          <p className="alth-hint">O desgaste do combate entra sozinho. Campo serve num Descanso Curto; a Forja, num Longo.</p>
        </section>
      </div>

      <div className="alth-stack">
        <section className="alth-card">
          <div className="alth-card__header">
            <h4 className="alth-card__title">Fabricar <span className="alth-card__subtitle">Base + Núcleo + Catalisador</span></h4>
          </div>
          <div className="alth-field-block">
            <span className="alth-supply__label">Base</span>
            {pick('Base', base, BASES.map((b) => ({ id: b.id, label: b.label })), setBase)}
            <span className="alth-supply__label">Núcleo</span>
            {pick('Núcleo', core, CORES.map((c) => ({ id: c.id, label: c.label })), setCore)}
            <span className="alth-supply__label">Catalisador <small>(opcional)</small></span>
            {pick<CatalystId | ''>('Catalisador', catalyst, [{ id: '', label: 'Nenhum' }, ...CATALYSTS.map((c) => ({ id: c.id, label: c.label }))], setCatalyst)}
            <span className="alth-supply__label">Material do Núcleo</span>
            {pick('Qualidade do material do Núcleo', quality, QUALITIES, setQuality)}
          </div>
          <div className="alth-recipe">
            <div className="alth-recipe__info">
              <strong>{recipe.name}</strong>
              <span className="alth-recipe__cost">{costText(recipe.cost)}{quality !== 'comum' ? ` (${quality === 'raro' ? 'raro' : 'lendário'})` : ''}</span>
              <span className="alth-hint">{recipe.effect}</span>
              {recipe.error && <span className="alth-test__note alth-test__note--warn">{recipe.error}</span>}
              {!recipe.error && recipeMissing.length > 0 && <span className="alth-hint">Falta: {recipeMissing.join(', ')}.</span>}
            </div>
            <button type="button" className="btn btn-primary" disabled={busy || !!recipe.error || recipeMissing.length > 0} onClick={() => void doCraft()}>Fabricar</button>
          </div>
          <span className="alth-supply__label">Armas Improvisadas <small>feitas em Campo</small></span>
          <ul className="alth-list">
            {improvised.map((w) => (
              <li key={w.id} className="alth-recipe">
                <div className="alth-recipe__info">
                  <strong>{w.name}</strong>
                  <span className="alth-recipe__cost">100% {resourceLabel(w.repair)}</span>
                  <span className="alth-hint">{w.damageDice} · simples de fazer, em qualquer acampamento.</span>
                </div>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void craftImprovised(w.id)}>Fabricar</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="alth-card">
          <div className="alth-card__header">
            <h4 className="alth-card__title">Reforços <span className="alth-card__subtitle">melhorias permanentes</span></h4>
            {reinfGear && <span className="alth-counter">{reinfGear.reinforcements.length}/{reinfGear.slots} espaços</span>}
          </div>
          {reinfGear ? (
            <>
              <Select value={reinfGear.inv.id} options={gear.map((g) => ({ value: g.inv.id, label: g.name }))} onChange={setReinfItem} aria-label="Item" />
              {reinfGear.reinforcements.length > 0 && (
                <div className="alth-combat__row">
                  {reinfGear.reinforcements.map((id) => (
                    <span key={id} className="alth-combat__cond alth-craft__reinf" title={reinforcementDef(id)?.effect}>
                      {reinforcementDef(id)?.label}
                      <button type="button" aria-label="Tirar reforço" disabled={busy}
                        onClick={() => void run(() => onPatch(reinfGear.inv.id, { reinforcements: reinfGear.reinforcements.filter((x) => x !== id) }), 'Reforço tirado.')}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <ul className="alth-list">
                {reinfOptions.map((r) => {
                  const open = reinforcementUnlocked(r, sagas)
                  return (
                    <li key={r.id} className={`alth-recipe${open ? '' : ' alth-recipe--locked'}`}>
                      <div className="alth-recipe__info">
                        <strong>{r.label}</strong>
                        <span className="alth-recipe__cost">{costText(r.cost)} · {r.place}</span>
                        <span className="alth-hint">{r.effect}{open ? '' : ' · precisa de Saga'}</span>
                      </div>
                      <button type="button" className="btn btn-ghost" disabled={busy || !open || slotsLeft <= 0 || reinfGear.reinforcements.includes(r.id)} onClick={() => void doReinforce(r)}>Aplicar</button>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : <p className="alth-hint">Nenhuma arma, armadura ou escudo no inventário.</p>}
        </section>

        <section className="alth-card">
          <div className="alth-card__header">
            <h4 className="alth-card__title">Sagas de Ofício <span className="alth-card__subtitle">valem para o grupo</span></h4>
          </div>
          <ul className="alth-list">
            {SAGAS.map((s) => (
              <li key={s.id} className="alth-recipe">
                <div className="alth-recipe__info">
                  <strong>{s.label}</strong>
                  <span className="alth-hint">{s.tier}: destrava {s.unlocks}</span>
                </div>
                <button type="button" className={`btn ${sagas.includes(s.id) ? 'btn-primary' : 'btn-ghost'}`} disabled={busy} aria-pressed={sagas.includes(s.id)} onClick={() => void toggleSaga(s.id)}>
                  {sagas.includes(s.id) ? 'Encontrada' : 'Marcar'}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="alth-card">
          <div className="alth-card__header">
            <h4 className="alth-card__title">Desmontar <span className="alth-card__subtitle">devolve metade</span></h4>
          </div>
          {disItem ? (
            <>
              <Select value={disItem.id} options={dismantlable.map((i) => ({ value: i.id, label: itemName(i) }))} onChange={setDisId} aria-label="Item para desmontar" />
              <div className="alth-recipe">
                <div className="alth-recipe__info">
                  <strong>{itemName(disItem)}</strong>
                  {disMaterials
                    ? <span className="alth-recipe__cost">{costText(disReturn) || 'nada'}</span>
                    : (
                      <div className="alth-combat__row">
                        <span className="alth-hint">O mestre diz o que rende:</span>
                        <div className="alth-combat__select"><Select value={manualRes} options={RESOURCE_OPTIONS} onChange={(v) => setManualRes(v as ResourceId)} aria-label="Material" /></div>
                        <label className="alth-combat__num">%<input type="number" className="input" min={0} max={400} value={manualPct} onChange={(e) => setManualPct(Math.max(0, Math.min(400, Number(e.target.value) || 0)))} /></label>
                      </div>
                    )}
                </div>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void doDismantle()}>Desmontar</button>
              </div>
            </>
          ) : <p className="alth-hint">Nada para desmontar.</p>}
          <p className="alth-hint">Desmontar se faz durante um Descanso Curto.</p>
        </section>
      </div>
    </div>
  )
}
