import { useMemo, useState } from 'react'
import {
  ARMORS,
  CONSUMABLES,
  UTILITIES,
  WEAPONS,
  DAMAGE_TYPE_LABELS,
  WEAPON_ATTRIBUTE_LABELS,
  WEAPON_RANGE_LABELS,
  WEAPON_CATEGORY_LABELS,
  findArmor,
  findWeapon,
  findItem,
  type ArmorDef,
  type WeaponCategory,
} from '../constants/altheriumItems'
import { BODY_PARTS } from '../constants/altherium'
import type { AltheriumInventoryItem } from '../../../../shared/types'
import type { BodyZone } from './AltheriumBodyDiagram'

interface AltheriumInventoryCardProps {
  inventory:        AltheriumInventoryItem[]
  onAdd:            (itemType: AltheriumInventoryItem['item_type'], itemId: string) => Promise<void>
  onUpdateQuantity: (id: string, quantity: number) => Promise<void>
  onRemove:         (id: string) => Promise<void>
  onToggleEquip:    (item: AltheriumInventoryItem, action: 'equip' | 'unequip', zone?: BodyZone) => void
  disabled?:        boolean
}

const WEAPON_CATEGORIES: WeaponCategory[] = ['pesada', 'leve', 'arremesso', 'alcance']

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

interface ItemInfo { name: string; detail: string; price: number }

function describeInventoryItem(inv: AltheriumInventoryItem): ItemInfo | null {
  if (inv.item_type === 'arma') {
    const w = findWeapon(inv.item_id)
    if (!w) return null
    return { name: w.name, detail: `${w.damageDice} ${DAMAGE_TYPE_LABELS[w.damageType]} · ${WEAPON_RANGE_LABELS[w.range]}`, price: w.price }
  }
  if (inv.item_type === 'armadura' || inv.item_type === 'escudo') {
    const a = findArmor(inv.item_id)
    if (!a) return null
    return { name: a.name, detail: `${a.db} DB`, price: a.price }
  }
  const i = findItem(inv.item_id)
  if (!i) return null
  return { name: i.name, detail: i.effect, price: i.price }
}

export function AltheriumInventoryCard({
  inventory, onAdd, onUpdateQuantity, onRemove, onToggleEquip, disabled = false,
}: AltheriumInventoryCardProps) {
  const [filter, setFilter] = useState('')
  const [pendingZoneFor, setPendingZoneFor] = useState<string | null>(null)

  const q = normalize(filter.trim())
  const filteredWeapons     = useMemo(() => (q ? WEAPONS.filter((w) => normalize(w.name).includes(q)) : WEAPONS), [q])
  const filteredArmors      = useMemo(() => (q ? ARMORS.filter((a) => normalize(a.name).includes(q)) : ARMORS), [q])
  const filteredConsumables = useMemo(() => (q ? CONSUMABLES.filter((i) => normalize(i.name).includes(q)) : CONSUMABLES), [q])
  const filteredUtilities   = useMemo(() => (q ? UTILITIES.filter((i) => normalize(i.name).includes(q)) : UTILITIES), [q])
  const noResults = filteredWeapons.length === 0 && filteredArmors.length === 0
    && filteredConsumables.length === 0 && filteredUtilities.length === 0

  function armorFor(inv: AltheriumInventoryItem): ArmorDef | undefined {
    return (inv.item_type === 'armadura' || inv.item_type === 'escudo') ? findArmor(inv.item_id) : undefined
  }

  return (
    <section className="alth-card alth-inventory">
      <div className="alth-card__header">
        <h4 className="alth-card__title">Inventário</h4>
      </div>

      <input
        type="text"
        className="input alth-inventory__search"
        placeholder="Buscar no catálogo..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="alth-inventory__grid">
        <div className="alth-inventory__catalog">
          {WEAPON_CATEGORIES.map((cat) => {
            const items = filteredWeapons.filter((w) => w.category === cat)
            if (items.length === 0) return null
            return (
              <div key={cat} className="alth-inventory__group">
                <h5 className="alth-inventory__group-title">{WEAPON_CATEGORY_LABELS[cat]}</h5>
                {items.map((w) => (
                  <div key={w.id} className="alth-inventory__row">
                    <div className="alth-inventory__row-main">
                      <span className="alth-inventory__name">
                        {w.name}
                        {w.berserkerOnly && <span className="alth-inventory__tag">Berserker</span>}
                      </span>
                      <span className="alth-inventory__detail">
                        {w.damageDice} {DAMAGE_TYPE_LABELS[w.damageType]} · {WEAPON_ATTRIBUTE_LABELS[w.attribute]} · {WEAPON_RANGE_LABELS[w.range]}
                      </span>
                    </div>
                    <span className="alth-inventory__price">₴{w.price}</span>
                    <button type="button" className="alth-inventory__add" disabled={disabled}
                      onClick={() => void onAdd('arma', w.id)} aria-label={`Adicionar ${w.name}`}>+</button>
                  </div>
                ))}
              </div>
            )
          })}

          {filteredArmors.length > 0 && (
            <div className="alth-inventory__group">
              <h5 className="alth-inventory__group-title">Proteções</h5>
              {filteredArmors.map((a) => (
                <div key={a.id} className="alth-inventory__row">
                  <div className="alth-inventory__row-main">
                    <span className="alth-inventory__name">{a.name}</span>
                    <span className="alth-inventory__detail">{a.description} · {a.db} DB</span>
                  </div>
                  <span className="alth-inventory__price">₴{a.price}</span>
                  <button type="button" className="alth-inventory__add" disabled={disabled}
                    onClick={() => void onAdd(a.kind, a.id)} aria-label={`Adicionar ${a.name}`}>+</button>
                </div>
              ))}
            </div>
          )}

          {filteredConsumables.length > 0 && (
            <div className="alth-inventory__group">
              <h5 className="alth-inventory__group-title">Consumíveis</h5>
              {filteredConsumables.map((i) => (
                <div key={i.id} className="alth-inventory__row">
                  <div className="alth-inventory__row-main">
                    <span className="alth-inventory__name">{i.name}</span>
                    <span className="alth-inventory__detail">{i.effect}</span>
                  </div>
                  <span className="alth-inventory__price">₴{i.price}</span>
                  <button type="button" className="alth-inventory__add" disabled={disabled}
                    onClick={() => void onAdd('consumivel', i.id)} aria-label={`Adicionar ${i.name}`}>+</button>
                </div>
              ))}
            </div>
          )}

          {filteredUtilities.length > 0 && (
            <div className="alth-inventory__group">
              <h5 className="alth-inventory__group-title">Utilitários</h5>
              {filteredUtilities.map((i) => (
                <div key={i.id} className="alth-inventory__row">
                  <div className="alth-inventory__row-main">
                    <span className="alth-inventory__name">{i.name}</span>
                    <span className="alth-inventory__detail">{i.effect}</span>
                  </div>
                  <span className="alth-inventory__price">₴{i.price}</span>
                  <button type="button" className="alth-inventory__add" disabled={disabled}
                    onClick={() => void onAdd('utilitario', i.id)} aria-label={`Adicionar ${i.name}`}>+</button>
                </div>
              ))}
            </div>
          )}

          {noResults && <p className="alth-inventory__empty">Nenhum item encontrado.</p>}
        </div>

        <div className="alth-inventory__owned">
          <h5 className="alth-inventory__group-title">Meus itens</h5>
          {inventory.length === 0 && <p className="alth-inventory__empty">Nenhum item no inventário ainda.</p>}
          {inventory.map((inv) => {
            const info = describeInventoryItem(inv)
            if (!info) return null
            const armor = armorFor(inv)
            const isChoosingZone = pendingZoneFor === inv.id
            const equippedZoneLabel = inv.equipped && inv.equipped_zone
              ? BODY_PARTS.find((p) => p.id === inv.equipped_zone)?.label
              : null

            return (
              <div key={inv.id} className="alth-inventory__row alth-inventory__row--owned">
                <div className="alth-inventory__row-main">
                  <span className="alth-inventory__name">{info.name}</span>
                  <span className="alth-inventory__detail">{info.detail}</span>
                </div>

                <div className="alth-inventory__qty">
                  <button type="button" className="alth-inventory__qty-btn" disabled={disabled}
                    onClick={() => void (inv.quantity > 1 ? onUpdateQuantity(inv.id, inv.quantity - 1) : onRemove(inv.id))}
                    aria-label={`Diminuir quantidade de ${info.name}`}>−</button>
                  <span className="alth-inventory__qty-value">{inv.quantity}</span>
                  <button type="button" className="alth-inventory__qty-btn" disabled={disabled}
                    onClick={() => void onUpdateQuantity(inv.id, inv.quantity + 1)}
                    aria-label={`Aumentar quantidade de ${info.name}`}>+</button>
                </div>

                {armor && !isChoosingZone && (
                  <label className="alth-inventory__equip">
                    <input
                      type="checkbox"
                      checked={inv.equipped}
                      disabled={disabled}
                      onChange={(e) => {
                        if (!e.target.checked) { onToggleEquip(inv, 'unequip'); return }
                        if (armor.coverage === 'todas') onToggleEquip(inv, 'equip')
                        else setPendingZoneFor(inv.id)
                      }}
                    />
                    Equipada{equippedZoneLabel ? ` (${equippedZoneLabel})` : ''}
                  </label>
                )}

                {armor && isChoosingZone && (
                  <div className="alth-inventory__zone-picker">
                    <span className="alth-inventory__zone-hint">Onde?</span>
                    {BODY_PARTS.map((part) => (
                      <button
                        key={part.id} type="button" className="alth-inventory__zone-btn"
                        onClick={() => { onToggleEquip(inv, 'equip', part.id as BodyZone); setPendingZoneFor(null) }}
                      >
                        {part.label}
                      </button>
                    ))}
                    <button type="button" className="alth-inventory__zone-cancel" onClick={() => setPendingZoneFor(null)}>
                      Cancelar
                    </button>
                  </div>
                )}

                <button type="button" className="alth-inventory__remove" disabled={disabled}
                  onClick={() => void onRemove(inv.id)} aria-label={`Remover ${info.name}`}>×</button>
              </div>
            )
          })}
        </div>
      </div>

      <p className="alth-hint">
        Equipar soma o DB da peça à zona escolhida (escudo cobre as 4 zonas de uma vez). Desequipar
        só desmarca — os campos de DB continuam manuais, ajuste-os se remover a peça.
      </p>
    </section>
  )
}
