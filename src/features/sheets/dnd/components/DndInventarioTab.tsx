import { useState } from 'react'
import { Select } from '../../../../shared/components/Select'
import type { DndCharacterInventoryItem } from '../../../../shared/types'
import { ARMORS, GEAR, SHIELD, TOOLS, WEAPONS, getArmor } from '../catalog'
import { coinsInGold, formatKg, inventoryWeightKg } from '../model/format'
import { itemTitle } from '../model/sheetModel'
import { createDndInventoryItem, deleteDndInventoryItem, updateDndInventoryItem } from '../services/dndSheetService'
import { DerivedField, NumberField } from './DndControls'
import { StatusPill } from './DndVisuals'
import type { SheetCtx } from './sheetContext'

// ────────────────────────────────────────────────────────
// Aba Inventário: itens do catálogo e próprios (quantidade, peso, equipado),
// moedas e carga. Armadura e escudo equipados mudam a CA sozinhos (uma
// armadura por vez). Pesos em kg, como no livro brasileiro.
// ────────────────────────────────────────────────────────

type Kind = 'weapon' | 'armor' | 'gear' | 'tool'
const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: 'weapon', label: 'Armas' }, { value: 'armor', label: 'Armaduras e escudo' },
  { value: 'gear', label: 'Equipamento de aventura' }, { value: 'tool', label: 'Ferramentas' },
]

function entriesOf(kind: Kind): { key: string; name: string; weight: number; note: string }[] {
  switch (kind) {
    case 'weapon': return WEAPONS.map((w) => ({ key: w.key, name: w.name, weight: w.weight, note: [w.cost, w.damage && `${w.damage} ${w.damageType ?? ''}`.trim(), ...w.properties].filter(Boolean).join(' · ') }))
    case 'armor':  return [...ARMORS.map((a) => ({ key: a.key, name: a.name, weight: a.weight, note: `CA ${a.baseAc}${a.category === 'medium' ? ' + Des (máx. 2)' : a.category === 'light' ? ' + Des' : ''} · ${a.cost}` })),
                           { key: SHIELD.key, name: SHIELD.name, weight: SHIELD.weight, note: `+${SHIELD.acBonus} de CA · ${SHIELD.cost}` }]
    case 'gear':   return GEAR.map((g) => ({ key: g.key, name: g.name, weight: g.weight, note: g.cost }))
    case 'tool':   return TOOLS.map((t) => ({ key: t.key, name: t.name, weight: t.weight, note: t.cost }))
  }
}

export function DndInventarioTab({ ctx }: { ctx: SheetCtx }) {
  const { form, set, derived, data, sheet, readOnly, report } = ctx
  const [kind, setKind] = useState<Kind>('weapon')
  const [pickKey, setPickKey] = useState('')
  const [customName, setCustomName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const items = data.details.inventory
  const capacity = derived.carryCapacity
  const carried = inventoryWeightKg(items)
  const pct = Math.min(100, (carried / Math.max(1, capacity)) * 100)
  const options = [{ value: '', label: 'Escolher do catálogo' }, ...entriesOf(kind).map((e) => ({ value: e.key, label: e.name }))]

  async function run(key: string, job: () => Promise<void>) {
    setBusy(key)
    report(null)
    try { await job() } catch (err) { report(err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.') } finally { setBusy(null) }
  }

  const replace = (saved: DndCharacterInventoryItem) => data.setDetails((d) => ({ ...d, inventory: d.inventory.map((i) => (i.id === saved.id ? saved : i)) }))

  const addItem = () => run('new', async () => {
    const entry = pickKey ? entriesOf(kind).find((e) => e.key === pickKey) : undefined
    const name = (entry?.name ?? customName).trim()
    if (!name) { report('Escolha um item do catálogo ou escreva o nome do item.'); return }
    const saved = await createDndInventoryItem(sheet.id, {
      name, quantity: 1, weight: entry?.weight ?? 0, equipped: false, notes: entry?.note ?? '',
      catalog_entry_key: entry?.key ?? null, sort_order: items.length,
    })
    data.setDetails((d) => ({ ...d, inventory: [...d.inventory, saved] }))
    setPickKey(''); setCustomName('')
  })

  const setEquipped = (item: DndCharacterInventoryItem, equipped: boolean) => run(item.id, async () => {
    // uma armadura (e um escudo) por vez: ao vestir uma, as outras do mesmo tipo saem
    if (equipped && item.catalog_entry_key) {
      const isShield = item.catalog_entry_key === SHIELD.key
      const isArmor = !!getArmor(item.catalog_entry_key)
      if (isShield || isArmor) {
        const others = items.filter((i) => i.id !== item.id && i.equipped && i.catalog_entry_key
          && (isShield ? i.catalog_entry_key === SHIELD.key : !!getArmor(i.catalog_entry_key)))
        for (const o of others) replace(await updateDndInventoryItem(o.id, { equipped: false }))
      }
    }
    replace(await updateDndInventoryItem(item.id, { equipped }))
  })

  const setQuantity = (item: DndCharacterInventoryItem, quantity: number) => run(item.id, async () => { replace(await updateDndInventoryItem(item.id, { quantity })) })

  const setWeight = (item: DndCharacterInventoryItem, weight: number) => run(item.id, async () => { replace(await updateDndInventoryItem(item.id, { weight })) })

  const removeItem = (item: DndCharacterInventoryItem) => run(item.id, async () => {
    await deleteDndInventoryItem(item.id)
    data.setDetails((d) => ({ ...d, inventory: d.inventory.filter((i) => i.id !== item.id) }))
  })

  const equippable = (i: DndCharacterInventoryItem) => !!i.catalog_entry_key && (!!getArmor(i.catalog_entry_key) || i.catalog_entry_key === SHIELD.key || WEAPONS.some((w) => w.key === i.catalog_entry_key))

  return (
    <div className="dsh-tab dsh-cols dsh-cols--even anim-tab-panel">
      <section className="dsh-card">
        <div className="dsh-card__header">
          <h4 className="dsh-card__title">Moedas</h4>
          <span className="dsh-badge" title="Tudo convertido em peças de ouro">≈ {coinsInGold({ cp: form.coin_cp, sp: form.coin_sp, ep: form.coin_ep, gp: form.coin_gp, pp: form.coin_pp }).toLocaleString('pt-BR')} po</span>
        </div>
        <div className="dsh-coins">
          {([['coin_cp', 'Cobre', 'pc', 'cp'], ['coin_sp', 'Prata', 'pp', 'sp'], ['coin_ep', 'Electro', 'pe', 'ep'], ['coin_gp', 'Ouro', 'po', 'gp'], ['coin_pp', 'Platina', 'pl', 'pt']] as const).map(([k, label, abbr, metal]) => (
            <label key={k} className={`dsh-coin dsh-coin--${metal}`} title={`${label} (${abbr})`}>
              <span className="dsh-coin__disc" aria-hidden="true">{abbr}</span>
              <span className="dsh-coin__label">{label}</span>
              <NumberField value={form[k]} onChange={(n) => set(k, n)} min={0} max={99999999} label={`${label} (${abbr})`} disabled={readOnly} className="dsh-coin__num" />
            </label>
          ))}
        </div>
      </section>

      <section className="dsh-card">
        <div className="dsh-card__header">
          <h4 className="dsh-card__title">Carga</h4>
          <span className={`dsh-badge${carried > capacity ? ' dsh-badge--bad' : ''}`}>{formatKg(carried)} / {formatKg(capacity)}</span>
        </div>
        <div className="dsh-load" role="progressbar" aria-label="Carga" aria-valuemin={0} aria-valuemax={Math.round(capacity)} aria-valuenow={Math.round(carried)}>
          <div className={`dsh-load__fill${carried > capacity ? ' is-over' : ''}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="dsh-loadtiles">
          <div className={`dsh-loadtile${carried > capacity ? ' is-over' : ''}`}>
            <span className="dsh-loadtile__label">Carregando</span>
            <span className="dsh-loadtile__value">{formatKg(carried)}</span>
          </div>
          <div className="dsh-loadtile" title="Força × 7,5 kg">
            <span className="dsh-loadtile__label">Capacidade</span>
            <span className="dsh-loadtile__value">
              <DerivedField ctx={ctx} field="carry_capacity" value={capacity} label="Capacidade de carga em kg" suffix=" kg" min={0} max={9999} step={0.5} className="dsh-derived--inline" />
            </span>
          </div>
          <div className="dsh-loadtile">
            <span className="dsh-loadtile__label">{carried > capacity ? 'Excesso' : 'Livre'}</span>
            <span className="dsh-loadtile__value">{formatKg(Math.abs(capacity - carried))}</span>
          </div>
        </div>
        {carried > capacity && <StatusPill tone="bad" title="A mesa decide a penalidade">Sobrecarregado</StatusPill>}
      </section>

      <section className="dsh-card dsh-wide">
        <div className="dsh-card__header"><h4 className="dsh-card__title">Itens</h4><span className="dsh-badge">{items.length}</span></div>
        {items.length === 0 && (
          <div className="dsh-noattack">
            <strong>Nenhum item ainda</strong>
            <span>Escolha um item do catálogo abaixo, ou escreva o nome de um item próprio.</span>
          </div>
        )}
        <ul className="dsh-list">
          {items.map((i) => {
            const armor = i.catalog_entry_key ? getArmor(i.catalog_entry_key) : undefined
            return (
              <li key={i.id} className={`dsh-item${i.equipped ? ' is-equipped' : ''}`}>
                <div className="dsh-item__main">
                  <strong className="dsh-item__name">{itemTitle(i.name, i.catalog_entry_key)}</strong>
                  {armor && <span className="dsh-tag">CA {armor.baseAc}</span>}
                  {i.catalog_entry_key === SHIELD.key && <span className="dsh-tag">+{SHIELD.acBonus}</span>}
                  {equippable(i) && (
                    <button type="button" className={`dsh-flag${i.equipped ? ' is-on' : ''}`} aria-pressed={i.equipped} disabled={readOnly || busy === i.id}
                      title="Armaduras e escudos equipados mudam a CA" onClick={() => void setEquipped(i, !i.equipped)}>{i.equipped ? '✓ Equipado' : 'Equipar'}</button>
                  )}
                  <label className="dsh-itemnum"><small>Qtd.</small>
                    <NumberField value={i.quantity} min={1} max={9999} label={`Quantidade de ${i.name}`} disabled={readOnly || busy === i.id} onChange={(n) => void setQuantity(i, n)} className="dsh-itemnum__input" /></label>
                  <label className="dsh-itemnum"><small>Kg</small>
                    <NumberField value={i.weight} min={0} max={99999} step={0.1} label={`Peso de ${i.name}`} disabled={readOnly || busy === i.id} onChange={(n) => void setWeight(i, n)} className="dsh-itemnum__input" /></label>
                  {!readOnly && <button type="button" className="dsh-x" onClick={() => void removeItem(i)} disabled={busy === i.id} aria-label={`Remover ${i.name}`}>×</button>}
                </div>
                {i.notes && (i.notes.length <= 90
                  ? <div className="dsh-spellchips">{i.notes.split(' · ').map((n) => <span key={n} className="dsh-cardchip">{n}</span>)}</div>
                  : <p className="dsh-note">{i.notes}</p>)}
              </li>
            )
          })}
        </ul>
        {!readOnly && (
          <div className="dsh-newattack">
            <div className="dsh-field dsh-field--tile"><span className="dsh-label">Tipo de item</span>
              <Select options={KIND_OPTIONS} value={kind} onChange={(v) => { setKind(v as Kind); setPickKey('') }} aria-label="Tipo de item" /></div>
            <div className="dsh-field dsh-field--tile"><span className="dsh-label">Item do catálogo</span>
              <Select options={options} value={pickKey} onChange={setPickKey} aria-label="Item do catálogo" /></div>
            <label className="dsh-field dsh-field--tile dsh-newattack__wide"><span className="dsh-label">Ou um item próprio</span>
              <input type="text" className="dsh-focus__input" value={customName} maxLength={160} placeholder="Nome do item"
                onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addItem() } }} /></label>
            <button type="button" className="dsh-newattack__add" onClick={() => void addItem()} disabled={busy === 'new'}>+ Adicionar item</button>
          </div>
        )}
      </section>
    </div>
  )
}
