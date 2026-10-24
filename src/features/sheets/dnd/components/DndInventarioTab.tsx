import { useState } from 'react'
import { Presence } from '../../../../shared/components/Presence'
import type { DndCharacterInventoryItem } from '../../../../shared/types'
import { SHIELD, WEAPONS, getArmor } from '../catalog'
import { BOOK_ITEMS, type BookItem } from '../catalog/itemBook'
import { coinsInGold, formatKg, inventoryWeightKg } from '../model/format'
import { itemTitle } from '../model/sheetModel'
import { createDndInventoryItem, deleteDndInventoryItem, updateDndInventoryItem } from '../services/dndSheetService'
import { DerivedField, NumberField } from './DndControls'
import { DndItemBrowser } from './DndItemBrowser'
import { Bump, ChipRow, StatChip, StatusPill } from './DndVisuals'
import type { SheetCtx } from './sheetContext'
import { leaveThen, useFreshKeys } from './motion'
import { CardTools, EditBox, EditField } from './DndCardTools'

// ────────────────────────────────────────────────────────
// Aba Inventário: itens do catálogo e próprios (quantidade, peso, equipado),
// moedas e carga. Armadura e escudo equipados mudam a CA sozinhos (uma
// armadura por vez). Pesos em kg, como no livro brasileiro.
// ────────────────────────────────────────────────────────

/** Tamanho máximo da descrição de um item. */
const NOTES_MAX = 4000

export function DndInventarioTab({ ctx }: { ctx: SheetCtx }) {
  const { form, set, derived, data, sheet, readOnly, report, prof } = ctx
  const [customName, setCustomName] = useState('')
  const [customNotes, setCustomNotes] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [bookOpen, setBookOpen] = useState(false)

  const items = data.details.inventory
  const capacity = derived.carryCapacity
  // peso carregado: a soma dos itens, ou o digitado (Automatizar > Peso carregado em manual)
  const manualCarried = form.carried_kg !== null
  const carried = form.carried_kg ?? inventoryWeightKg(items)
  const pct = Math.min(100, (carried / Math.max(1, capacity)) * 100)
  const owned = new Map<string, number>()
  for (const i of items) if (i.catalog_entry_key) owned.set(i.catalog_entry_key, (owned.get(i.catalog_entry_key) ?? 0) + i.quantity)

  async function run(key: string, job: () => Promise<void>) {
    setBusy(key)
    report(null)
    try { await job() } catch (err) { report(err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.') } finally { setBusy(null) }
  }

  const replace = (saved: DndCharacterInventoryItem) => data.setDetails((d) => ({ ...d, inventory: d.inventory.map((i) => (i.id === saved.id ? saved : i)) }))

  const addItem = () => run('new', async () => {
    const name = customName.trim()
    if (!name) { report('Escreva o nome do item, ou abra o livro de itens para escolher um do catálogo.'); return }
    const saved = await createDndInventoryItem(sheet.id, {
      name, quantity: 1, weight: 0, equipped: false, notes: customNotes.trim().slice(0, NOTES_MAX), catalog_entry_key: null, sort_order: items.length,
    })
    data.setDetails((d) => ({ ...d, inventory: [...d.inventory, saved] }))
    setCustomName('')
    setCustomNotes('')
  })

  /** Do livro: item novo entra com 1; se já tem, soma 1 na quantidade. */
  const addFromBook = (it: BookItem) => run(it.key, async () => {
    const existing = items.find((i) => i.catalog_entry_key === it.key)
    if (existing) { replace(await updateDndInventoryItem(existing.id, { quantity: Math.min(9999, existing.quantity + 1) })); return }
    const saved = await createDndInventoryItem(sheet.id, {
      name: it.name, quantity: 1, weight: it.weight, equipped: false, notes: it.note, catalog_entry_key: it.key, sort_order: items.length,
    })
    data.setDetails((d) => ({ ...d, inventory: [...d.inventory, saved] }))
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

  const setNotes = (item: DndCharacterInventoryItem, notes: string) => run(item.id, async () => { replace(await updateDndInventoryItem(item.id, { notes: notes.trim().slice(0, NOTES_MAX) })) })

  const [editing, setEditing] = useState<string | null>(null)
  const renameItem = (item: DndCharacterInventoryItem, name: string) => run(item.id, async () => { replace(await updateDndInventoryItem(item.id, { name })) })

  const setWeight = (item: DndCharacterInventoryItem, weight: number) => run(item.id, async () => { replace(await updateDndInventoryItem(item.id, { weight })) })

  const removeItem = (item: DndCharacterInventoryItem, from: Element) => run(item.id, () => leaveThen(from, () => deleteDndInventoryItem(item.id),
    () => data.setDetails((d) => ({ ...d, inventory: d.inventory.filter((i) => i.id !== item.id) }))))
  const isNew = useFreshKeys(items.map((i) => i.id))

  const equippable = (i: DndCharacterInventoryItem) => !!i.catalog_entry_key && (!!getArmor(i.catalog_entry_key) || i.catalog_entry_key === SHIELD.key || WEAPONS.some((w) => w.key === i.catalog_entry_key))

  return (
    <div className="dsh-tab dsh-cols dsh-cols--even anim-tab-panel">
      <section className="dsh-card">
        <div className="dsh-card__header">
          <h4 className="dsh-card__title">Moedas</h4>
          <span className="dsh-badge" title="Tudo convertido em peças de ouro">≈ <Bump value={coinsInGold({ cp: form.coin_cp, sp: form.coin_sp, ep: form.coin_ep, gp: form.coin_gp, pp: form.coin_pp }).toLocaleString('pt-BR')} /> po</span>
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
            <span className="dsh-loadtile__value">{manualCarried && !readOnly
              ? <NumberField value={carried} min={0} max={99999} step={0.1} label="Peso carregado em kg" onChange={(n) => set('carried_kg', n)} className="dsh-loadtile__input" />
              : <Bump value={formatKg(carried)} />}</span>
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
        <div className="dsh-card__header"><h4 className="dsh-card__title">Itens</h4><span className="dsh-badge"><Bump value={items.length} /></span></div>
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
              <li key={i.id} className={`dsh-item${i.equipped ? ' is-equipped' : ''}${isNew(i.id) ? ' is-new' : ''}${readOnly ? '' : ' has-tools'}`}>
                <div className="dsh-item__main">
                  {/* o nome que a pessoa deu (editável no lápis); sem nome, o do livro */}
                  <strong className="dsh-item__name">{i.name.trim() || itemTitle(i.name, i.catalog_entry_key)}</strong>
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
                </div>
                {!readOnly && (
                  <CardTools name={i.name} editing={editing === i.id} onEdit={() => setEditing(editing === i.id ? null : i.id)}
                    onDelete={(from) => void removeItem(i, from)} busy={busy === i.id} />
                )}
                {i.notes && editing !== i.id && (i.notes.length <= 90 && !i.notes.includes('\n')
                  ? <div className="dsh-spellchips">{i.notes.split(' · ').map((n) => <span key={n} className="dsh-cardchip">{n}</span>)}</div>
                  : <div className="dsh-itemdesc">{i.notes.split('\n').filter((l) => l.trim()).map((l, n) => <p key={n} className="dsh-note">{l}</p>)}</div>)}
                {editing === i.id && !readOnly && (
                  <EditBox onDone={() => setEditing(null)}>
                    <EditField label="Nome" value={i.name} required max={160} wide onSave={(name) => void renameItem(i, name)} />
                    <label className="dsh-field dsh-field--tile"><span className="dsh-label">Quantidade</span>
                      <NumberField value={i.quantity} min={1} max={9999} label={`Quantidade de ${i.name}`} disabled={busy === i.id} onChange={(n) => void setQuantity(i, n)} className="dsh-num--field" /></label>
                    <label className="dsh-field dsh-field--tile"><span className="dsh-label">Peso (kg, cada)</span>
                      <NumberField value={i.weight} min={0} max={99999} step={0.1} label={`Peso de ${i.name}`} disabled={busy === i.id} onChange={(n) => void setWeight(i, n)} className="dsh-num--field" /></label>
                    <EditField label="Descrição" value={i.notes} multiline rows={3} max={NOTES_MAX}
                      placeholder="O que faz, propriedades, dano, raridade... Use ' · ' para separar em etiquetas curtas." onSave={(notes) => void setNotes(i, notes)} />
                  </EditBox>
                )}
              </li>
            )
          })}
        </ul>
        {!readOnly && (
          <div className="dsh-newattack">
            <label className="dsh-field dsh-field--tile dsh-newattack__wide"><span className="dsh-label">Item próprio</span>
              <input type="text" className="dsh-focus__input" value={customName} maxLength={160} placeholder="Nome do item"
                onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addItem() } }} /></label>
            <label className="dsh-field dsh-field--tile dsh-newattack__wide"><span className="dsh-label">Descrição (opcional)</span>
              <textarea className="dsh-input dsh-textarea dsh-textarea--sm" rows={2} value={customNotes} maxLength={NOTES_MAX} placeholder="O que o item faz, propriedades, dano, raridade..."
                onChange={(e) => setCustomNotes(e.target.value)} /></label>
            <button type="button" className="dsh-newattack__add" onClick={() => void addItem()} disabled={busy === 'new'}>+ Adicionar item</button>
          </div>
        )}
      </section>

      {!readOnly && (
        <section className="dsh-card dsh-wide dsh-bookcta">
          <div className="dsh-bookcta__text">
            <h4 className="dsh-card__title">Livro de itens</h4>
            <p className="dsh-note">Armas, armaduras, equipamento e ferramentas do SRD em cards, com busca e filtros. Clique em um para levá-lo à ficha na hora, ou em "Ver mais" para ver tudo sobre ele.</p>
            <ChipRow><StatChip label="No livro">{BOOK_ITEMS.length} itens</StatChip><StatChip label="Fonte">SRD 5.1</StatChip><StatChip label="Filtros">tipo · categoria · alcance · dano · propriedade</StatChip></ChipRow>
          </div>
          <button type="button" className="dsh-bookcta__open" aria-haspopup="dialog" onClick={() => setBookOpen(true)}>Abrir o livro</button>
        </section>
      )}
      {!readOnly && (
        <Presence show={bookOpen}>{() => (
          <DndItemBrowser owned={owned} prof={{ weapons: prof.weapons, armor: prof.armor }} readOnly={readOnly} busy={busy}
            onAdd={(it) => void addFromBook(it)} onClose={() => setBookOpen(false)} />
        )}</Presence>
      )}
    </div>
  )
}
