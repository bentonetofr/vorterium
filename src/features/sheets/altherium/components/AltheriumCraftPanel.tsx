import { useEffect, useMemo, useState } from 'react'
import type { AltheriumInventoryItem } from '../../../../shared/types'
import { Select } from '../../../../shared/components/Select'
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
// Aba Ofício (livro 2.0): recursos em frações (até 4 unidades de cada),
// reparo (Campo até 75%, Forja até 100%, custa a mesma % em material),
// receitas modulares (Base + Núcleo + Catalisador), arma Improvisada,
// Reforços (espaços por arma e por parte de armadura), Sagas do grupo e
// desmontar (metade dos materiais).
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

const RESOURCE_OPTIONS = RESOURCES.map((r) => ({ value: r.id, label: r.label }))
const QUALITY_OPTIONS = QUALITIES.map((q) => ({ value: q.id, label: q.label }))
const BASE_OPTIONS = BASES.map((b) => ({ value: b.id, label: `${b.label} (${costText(b.cost)})` }))
const CORE_OPTIONS = CORES.map((c) => ({ value: c.id, label: `${c.label} (${costText(c.cost)})` }))
const CATALYST_OPTIONS = [{ value: '', label: 'Sem catalisador' }, ...CATALYSTS.map((c) => ({ value: c.id, label: `${c.label} (${costText(c.cost)})` }))]

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
  const [resId, setResId] = useState<ResourceId>('ferro_velho')
  const [resQuality, setResQuality] = useState<Quality>('comum')
  const resDef = RESOURCES.find((r) => r.id === resId)!
  const [resPct, setResPct] = useState(25)

  function addRes(sign: 1 | -1) {
    const q: Quality = resDef.noQuality ? 'comum' : resQuality
    if (sign > 0) {
      const r = addResource(stock, resId, q, resPct)
      onStock(r.stock)
      setMessage(r.overflow > 0 ? `Limite de ${RESOURCE_LIMIT_UNITS} unidades de ${resDef.label}: ${r.overflow}% ficaram para trás.` : null)
    } else {
      onStock(removeResource(stock, resId, q, resPct))
      setMessage(null)
    }
  }

  // ── Reparo ──
  const [repairId, setRepairId] = useState('')
  const repairGear = gear.find((g) => g.inv.id === repairId) ?? gear.find((g) => g.integrity < 100) ?? gear[0] ?? null
  const [place, setPlace] = useState<RepairPlace>('campo')
  const [hammer, setHammer] = useState(false)
  const plan = repairGear ? repairPlan(repairGear.integrity, 100, place, hammer && repairGear.heavy) : null

  async function doRepair() {
    if (!repairGear || !plan || plan.amount <= 0) return
    const next = pay({ [repairGear.repair]: plan.amount })
    if (!next) return
    await run(async () => { await onPatch(repairGear.inv.id, { integrity: plan.to }); onStock(next) },
      `${repairGear.name} reparada para ${plan.to}% (−${plan.amount}% ${resourceLabel(repairGear.repair)}).`)
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
  const [reinfId, setReinfId] = useState('')
  const reinf = reinfOptions.find((r) => r.id === reinfId) ?? reinfOptions[0] ?? null
  const slotsLeft = reinfGear ? reinfGear.slots - reinfGear.reinforcements.length : 0

  async function doReinforce() {
    if (!reinfGear || !reinf) return
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

  return (
    <div className="alth-combat alth-craft">
      {!known && <p className="alth-hint">O banco ainda não guarda Ofício (migration 20240217): recursos e Integridade não ficam salvos.</p>}
      {message && <p className="alth-craft__message" role="status">{message}</p>}

      {/* Recursos */}
      <section className="alth-section">
        <div className="alth-section__header">
          <h4 className="alth-section__title">Recursos</h4>
          <span className="alth-hint">100% = 1 unidade · até {RESOURCE_LIMIT_UNITS} de cada</span>
        </div>
        <ul className="alth-craft__stock">
          {RESOURCES.map((r) => {
            const total = resourceTotal(stock, r.id)
            const row = stock[r.id] ?? {}
            return (
              <li key={r.id} className={total ? 'alth-craft__stock--has' : ''} title={r.what}>
                <span className="alth-craft__res">{r.label}</span>
                <span className="alth-craft__amount">{total ? formatAmount(total) : '—'}</span>
                {!r.noQuality && (row.raro || row.lendario) ? (
                  <span className="alth-hint">{row.raro ? `raro ${row.raro}%` : ''}{row.raro && row.lendario ? ' · ' : ''}{row.lendario ? `lendário ${row.lendario}%` : ''}</span>
                ) : null}
              </li>
            )
          })}
        </ul>
        <div className="alth-combat__row">
          <div className="alth-combat__select"><Select value={resId} options={RESOURCE_OPTIONS} onChange={(v) => setResId(v as ResourceId)} aria-label="Recurso" /></div>
          {!resDef.noQuality && <div className="alth-combat__select"><Select value={resQuality} options={QUALITY_OPTIONS} onChange={(v) => setResQuality(v as Quality)} aria-label="Qualidade" /></div>}
          {resDef.fractions.map((f) => (
            <button key={f} type="button" className={`alth-combat__chip${resPct === f ? ' alth-combat__chip--on' : ''}`} onClick={() => setResPct(f)}>{f}%</button>
          ))}
          <span className="alth-combat__spacer" />
          <button type="button" className="btn btn-ghost alth-combat__btn" onClick={() => addRes(-1)}>Tirar</button>
          <button type="button" className="btn btn-primary alth-combat__btn" onClick={() => addRes(1)}>Adicionar</button>
        </div>
      </section>

      {/* Reparo */}
      <section className="alth-section">
        <div className="alth-section__header"><h4 className="alth-section__title">Integridade e reparo</h4></div>
        {gear.length === 0 && <p className="alth-hint">Nenhuma arma, armadura ou escudo no inventário.</p>}
        {gear.length > 0 && (
          <>
            <ul className="alth-craft__gear">
              {gear.map((g) => (
                <li key={g.inv.id}>
                  <span>{g.name}</span>
                  <span className={`alth-integrity alth-integrity--${integrityBand(g.integrity)}`}>{g.integrity}% · {BAND_LABELS[integrityBand(g.integrity)]}</span>
                </li>
              ))}
            </ul>
            {repairGear && plan && (
              <div className="alth-combat__row">
                <div className="alth-combat__select alth-combat__select--wide">
                  <Select value={repairGear.inv.id} options={gear.map((g) => ({ value: g.inv.id, label: `${g.name} (${g.integrity}%)` }))} onChange={setRepairId} aria-label="Item para reparar" />
                </div>
                {(['campo', 'forja'] as const).map((p) => (
                  <button key={p} type="button" className={`alth-combat__chip${place === p ? ' alth-combat__chip--on' : ''}`} onClick={() => setPlace(p)}>
                    {p === 'campo' ? 'Campo (até 75%)' : 'Forja (até 100%)'}
                  </button>
                ))}
                {repairGear.heavy && place === 'campo' && (
                  <label className="alth-test__check" title="Triunfo do Berserker: num Descanso Curto, repara uma arma pesada em Campo até 100%.">
                    <input type="checkbox" checked={hammer} onChange={(e) => setHammer(e.target.checked)} /> Martelo do Ferreiro
                  </label>
                )}
                <span className="alth-combat__spacer" />
                <span className="alth-hint">{plan.amount > 0 ? `${repairGear.integrity}% → ${plan.to}% · custa ${plan.amount}% ${resourceLabel(repairGear.repair)}` : 'Nada a reparar aqui.'}</span>
                <button type="button" className="btn btn-primary alth-combat__btn" disabled={busy || plan.amount <= 0} onClick={() => void doRepair()}>Reparar</button>
              </div>
            )}
            <p className="alth-hint">Reparos em Campo podem ser feitos num Descanso Curto; a Forja, num Descanso Longo. O desgaste do combate entra sozinho.</p>
          </>
        )}
      </section>

      {/* Receitas */}
      <section className="alth-section">
        <div className="alth-section__header"><h4 className="alth-section__title">Receitas</h4></div>
        <div className="alth-combat__row">
          <div className="alth-combat__select"><Select value={base} options={BASE_OPTIONS} onChange={(v) => setBase(v as BaseId)} aria-label="Base" /></div>
          <div className="alth-combat__select"><Select value={core} options={CORE_OPTIONS} onChange={(v) => setCore(v as CoreId)} aria-label="Núcleo" /></div>
          <div className="alth-combat__select"><Select value={catalyst} options={CATALYST_OPTIONS} onChange={(v) => setCatalyst(v as CatalystId | '')} aria-label="Catalisador" /></div>
          <div className="alth-combat__select"><Select value={quality} options={QUALITY_OPTIONS} onChange={(v) => setQuality(v as Quality)} aria-label="Qualidade do material do Núcleo" /></div>
        </div>
        <div className="alth-craft__recipe">
          <strong>{recipe.name}</strong>
          <span className="alth-hint">Custo: {costText(recipe.cost)}{quality !== 'comum' ? ` (o ${resourceLabel(recipe.pinned.id)} do Núcleo ${quality === 'raro' ? 'raro' : 'lendário'})` : ''}</span>
          <p>{recipe.effect}</p>
          {recipe.error && <p className="alth-test__note alth-test__note--warn">{recipe.error}</p>}
          {!recipe.error && recipeMissing.length > 0 && <p className="alth-hint">Falta: {recipeMissing.join(', ')}.</p>}
        </div>
        <div className="alth-combat__row">
          {improvised.map((w) => (
            <button key={w.id} type="button" className="btn btn-ghost alth-combat__btn" disabled={busy} onClick={() => void craftImprovised(w.id)}
              title="Improvisada: pode ser craftada em Campo usando 100% do seu material de reparo.">
              Fazer {w.name} (100% {resourceLabel(w.repair)})
            </button>
          ))}
          <span className="alth-combat__spacer" />
          <button type="button" className="btn btn-primary alth-combat__btn" disabled={busy || !!recipe.error || recipeMissing.length > 0} onClick={() => void doCraft()}>Fazer</button>
        </div>
      </section>

      {/* Reforços */}
      <section className="alth-section">
        <div className="alth-section__header"><h4 className="alth-section__title">Reforços</h4></div>
        {reinfGear ? (
          <>
            <div className="alth-combat__row">
              <div className="alth-combat__select alth-combat__select--wide">
                <Select value={reinfGear.inv.id} options={gear.map((g) => ({ value: g.inv.id, label: g.name }))} onChange={(v) => { setReinfItem(v); setReinfId('') }} aria-label="Item" />
              </div>
              <span className="alth-hint">
                Espaços: {reinfGear.reinforcements.length} de {reinfGear.slots}
                {reinfGear.reinforcements.length > 0 && ` · ${reinfGear.reinforcements.map((id) => reinforcementDef(id)?.label).join(', ')}`}
              </span>
            </div>
            {reinf && (
              <div className="alth-combat__row">
                <div className="alth-combat__select alth-combat__select--wide">
                  <Select value={reinf.id} onChange={setReinfId} aria-label="Reforço"
                    options={reinfOptions.map((r) => ({ value: r.id, label: `${r.label}${reinforcementUnlocked(r, sagas) ? '' : ' (precisa de Saga)'}` }))} />
                </div>
                <span className="alth-hint">{reinf.effect} · {reinf.place} · {costText(reinf.cost)}</span>
                <span className="alth-combat__spacer" />
                <button type="button" className="btn btn-primary alth-combat__btn" disabled={busy || slotsLeft <= 0} onClick={() => void doReinforce()}>Aplicar</button>
              </div>
            )}
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
          </>
        ) : <p className="alth-hint">Nenhuma arma, armadura ou escudo no inventário.</p>}
      </section>

      {/* Sagas */}
      <section className="alth-section">
        <div className="alth-section__header"><h4 className="alth-section__title">Sagas de Ofício do grupo</h4></div>
        <div className="alth-combat__row">
          {SAGAS.map((s) => (
            <label key={s.id} className="alth-test__check" title={`${s.tier}: destrava ${s.unlocks}`}>
              <input type="checkbox" checked={sagas.includes(s.id)} disabled={busy} onChange={() => void toggleSaga(s.id)} />
              {s.label} <span className="alth-hint">({s.unlocks})</span>
            </label>
          ))}
        </div>
      </section>

      {/* Desmontar */}
      <section className="alth-section">
        <div className="alth-section__header"><h4 className="alth-section__title">Desmontar</h4></div>
        {disItem ? (
          <div className="alth-combat__row">
            <div className="alth-combat__select alth-combat__select--wide">
              <Select value={disItem.id} options={dismantlable.map((i) => ({ value: i.id, label: itemName(i) }))} onChange={setDisId} aria-label="Item para desmontar" />
            </div>
            {disMaterials ? (
              <span className="alth-hint">Devolve metade: {costText(disReturn) || 'nada'}</span>
            ) : (
              <>
                <span className="alth-hint">O mestre diz o que rende:</span>
                <div className="alth-combat__select"><Select value={manualRes} options={RESOURCE_OPTIONS} onChange={(v) => setManualRes(v as ResourceId)} aria-label="Material" /></div>
                <label className="alth-combat__num">%<input type="number" className="input" min={0} max={400} value={manualPct} onChange={(e) => setManualPct(Math.max(0, Math.min(400, Number(e.target.value) || 0)))} /></label>
              </>
            )}
            <span className="alth-combat__spacer" />
            <button type="button" className="btn btn-ghost alth-combat__btn" disabled={busy} onClick={() => void doDismantle()}>Desmontar</button>
          </div>
        ) : <p className="alth-hint">Nada para desmontar.</p>}
        <p className="alth-hint">Desmontar se faz durante um Descanso Curto e devolve metade dos materiais usados.</p>
      </section>
    </div>
  )
}
