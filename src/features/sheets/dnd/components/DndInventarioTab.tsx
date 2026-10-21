import { useState } from 'react'
import { Select } from '../../../../shared/components/Select'
import type { DndCharacterInventoryItem } from '../../../../shared/types'
import { ARMORS, GEAR, SHIELD, TOOLS, WEAPONS, getArmor } from '../catalog'
import { carryCapacityKg, coinsInGold, formatKg, inventoryWeightKg } from '../model/format'
import { itemTitle } from '../model/sheetModel'
import { createDndInventoryItem, deleteDndInventoryItem, updateDndInventoryItem } from '../services/dndSheetService'
import { NumberField, Toggle } from './DndControls'
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
  const { form, set, data, sheet, readOnly, report } = ctx
  const [kind, setKind] = useState<Kind>('weapon')
  const [pickKey, setPickKey] = useState('')
  const [customName, setCustomName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const items = data.details.inventory
  const capacity = carryCapacityKg(form.strength)
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
    <div className="dsh-tab dsh-cols anim-tab-panel">
      <section className="dsh-card">
        <div className="dsh-card__header">
          <h4 className="dsh-card__title">Moedas</h4>
          <span className="dsh-badge" title="Tudo convertido em peças de ouro">≈ {coinsInGold({ cp: form.coin_cp, sp: form.coin_sp, ep: form.coin_ep, gp: form.coin_gp, pp: form.coin_pp }).toLocaleString('pt-BR')} po</span>
        </div>
        <div className="dsh-coins">
          {([['coin_cp', 'Cobre', 'pc'], ['coin_sp', 'Prata', 'pp'], ['coin_ep', 'Electro', 'pe'], ['coin_gp', 'Ouro', 'po'], ['coin_pp', 'Platina', 'pl']] as const).map(([k, label, abbr]) => (
            <label key={k} className="dsh-field" title={`${label} (${abbr})`}><span className="dsh-label">{label}</span>
              <NumberField value={form[k]} onChange={(n) => set(k, n)} min={0} max={99999999} label={`${label} (${abbr})`} disabled={readOnly} /></label>
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
        <p className="dsh-note">Capacidade de carga = Força × 7,5 kg. Passou disso, o personagem fica sobrecarregado (a mesa decide a penalidade).</p>
      </section>

      <section className="dsh-card dsh-wide">
        <div className="dsh-card__header"><h4 className="dsh-card__title">Itens</h4><span className="dsh-badge">{items.length}</span></div>
        {items.length === 0 && <p className="dsh-faint">Nenhum item ainda.</p>}
        <ul className="dsh-list">
          {items.map((i) => {
            const armor = i.catalog_entry_key ? getArmor(i.catalog_entry_key) : undefined
            return (
              <li key={i.id} className={`dsh-item${i.equipped ? ' is-equipped' : ''}`}>
                <div className="dsh-item__main">
                  <strong className="dsh-item__name">{itemTitle(i.name, i.catalog_entry_key)}</strong>
                  {armor && <span className="dsh-tag">CA {armor.baseAc}</span>}
                  {i.catalog_entry_key === SHIELD.key && <span className="dsh-tag">+{SHIELD.acBonus}</span>}
                  {equippable(i) && <Toggle checked={i.equipped} onChange={readOnly || busy === i.id ? undefined : (v) => void setEquipped(i, v)} label="Equipado" />}
                  <label className="dsh-item__qty"><span className="dsh-faint">Qtd.</span>
                    <NumberField value={i.quantity} min={1} max={9999} label={`Quantidade de ${i.name}`} disabled={readOnly || busy === i.id} onChange={(n) => void setQuantity(i, n)} /></label>
                  <label className="dsh-item__qty"><span className="dsh-faint">kg</span>
                    <NumberField value={i.weight} min={0} max={99999} step={0.1} label={`Peso de ${i.name}`} disabled={readOnly || busy === i.id} onChange={(n) => void setWeight(i, n)} /></label>
                  {!readOnly && <button type="button" className="dsh-x" onClick={() => void removeItem(i)} disabled={busy === i.id} aria-label={`Remover ${i.name}`}>×</button>}
                </div>
                {i.notes && <p className="dsh-note">{i.notes}</p>}
              </li>
            )
          })}
        </ul>
        {!readOnly && (
          <div className="dsh-add-row">
            <Select options={KIND_OPTIONS} value={kind} onChange={(v) => { setKind(v as Kind); setPickKey('') }} aria-label="Tipo de item" />
            <Select options={options} value={pickKey} onChange={setPickKey} aria-label="Item do catálogo" />
            <input type="text" className="dsh-input" value={customName} maxLength={160} placeholder="ou o nome de um item próprio"
              onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addItem() } }} />
            <button type="button" className="dsh-chip dsh-chip--primary" onClick={() => void addItem()} disabled={busy === 'new'}>Adicionar</button>
          </div>
        )}
      </section>
    </div>
  )
}
