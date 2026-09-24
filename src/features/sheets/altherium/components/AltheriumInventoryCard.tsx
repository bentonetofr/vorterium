import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
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
  type ArmorCoverage,
  type DamageType,
  type WeaponAttribute,
  type WeaponCategory,
  type WeaponRange,
} from '../constants/altheriumItems'
import { BODY_PARTS } from '../constants/altherium'
import type { AltheriumInventoryItem } from '../../../../shared/types'
import { DAMAGE_DICE_PATTERN, type AltheriumCustomItemInput } from '../services/altheriumSheetService'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { Presence } from '../../../../shared/components/Presence'
import { Select } from '../../../../shared/components/Select'
import type { BodyZone } from './AltheriumBodyDiagram'

interface AltheriumInventoryCardProps {
  inventory:        AltheriumInventoryItem[]
  onAdd:            (itemType: AltheriumInventoryItem['item_type'], itemId: string) => Promise<void>
  onUpdateQuantity: (id: string, quantity: number) => Promise<void>
  onRemove:         (id: string) => Promise<void>
  onToggleEquip:    (item: AltheriumInventoryItem, action: 'equip' | 'unequip', zone?: BodyZone) => void
  /** Criar/editar item personalizado — devem lançar erro se falhar (a janela mostra). */
  onAddCustom:      (input: AltheriumCustomItemInput) => Promise<void>
  onUpdateCustom:   (item: AltheriumInventoryItem, input: AltheriumCustomItemInput) => Promise<void>
  disabled?:        boolean
}

const WEAPON_CATEGORIES: WeaponCategory[] = ['pesada', 'leve', 'arremesso', 'alcance']

const ITEM_TYPE_LABELS: Record<AltheriumInventoryItem['item_type'], string> = {
  arma:       'Arma',
  armadura:   'Armadura',
  escudo:     'Escudo',
  consumivel: 'Consumível',
  utilitario: 'Utilitário',
}
const ITEM_TYPE_OPTIONS = (Object.keys(ITEM_TYPE_LABELS) as AltheriumInventoryItem['item_type'][])
  .map((t) => ({ value: t, label: ITEM_TYPE_LABELS[t] }))

const optionsOf = <K extends string>(labels: Record<K, string>) =>
  (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }))
const DAMAGE_TYPE_OPTIONS      = optionsOf(DAMAGE_TYPE_LABELS)
const WEAPON_ATTRIBUTE_OPTIONS = optionsOf(WEAPON_ATTRIBUTE_LABELS)
const WEAPON_RANGE_OPTIONS     = optionsOf(WEAPON_RANGE_LABELS)

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function isCustom(inv: AltheriumInventoryItem): boolean {
  return inv.custom_name !== null
}

/**
 * Proteção do item (DB e cobertura), do catálogo ou personalizada —
 * undefined se não for armadura/escudo. Escudo cobre as 4 zonas;
 * armadura, a zona escolhida ao equipar.
 */
export function inventoryArmor(inv: AltheriumInventoryItem): { db: number; coverage: ArmorCoverage } | undefined {
  if (inv.item_type !== 'armadura' && inv.item_type !== 'escudo') return undefined
  if (isCustom(inv)) return { db: inv.custom_db ?? 0, coverage: inv.item_type === 'escudo' ? 'todas' : 'escolhida' }
  const a = findArmor(inv.item_id)
  return a ? { db: a.db, coverage: a.coverage } : undefined
}

interface ItemInfo { name: string; detail: string }

function describeInventoryItem(inv: AltheriumInventoryItem): ItemInfo | null {
  if (isCustom(inv)) {
    const armor = inventoryArmor(inv)
    // Arma: mesmo resumo das armas do catálogo — dano, atributo de acerto, alcance.
    const weapon = inv.item_type === 'arma' && inv.custom_damage_dice
      ? [
          `${inv.custom_damage_dice}${inv.custom_damage_type ? ` ${DAMAGE_TYPE_LABELS[inv.custom_damage_type]}` : ''}`,
          inv.custom_attribute ? WEAPON_ATTRIBUTE_LABELS[inv.custom_attribute] : null,
          inv.custom_range ? WEAPON_RANGE_LABELS[inv.custom_range] : null,
        ]
      : [ITEM_TYPE_LABELS[inv.item_type]]
    const parts = [...weapon, armor ? `${armor.db} DB` : null, inv.custom_detail]
    return { name: inv.custom_name!, detail: parts.filter(Boolean).join(' · ') }
  }
  if (inv.item_type === 'arma') {
    const w = findWeapon(inv.item_id)
    if (!w) return null
    return { name: w.name, detail: `${w.damageDice} ${DAMAGE_TYPE_LABELS[w.damageType]} · ${WEAPON_RANGE_LABELS[w.range]}` }
  }
  if (inv.item_type === 'armadura' || inv.item_type === 'escudo') {
    const a = findArmor(inv.item_id)
    if (!a) return null
    return { name: a.name, detail: `${a.db} DB` }
  }
  const i = findItem(inv.item_id)
  if (!i) return null
  return { name: i.name, detail: i.effect }
}

export function AltheriumInventoryCard({
  inventory, onAdd, onUpdateQuantity, onRemove, onToggleEquip, onAddCustom, onUpdateCustom, disabled = false,
}: AltheriumInventoryCardProps) {
  const [filter, setFilter] = useState('')
  const [pendingZoneFor, setPendingZoneFor] = useState<string | null>(null)
  // Janela de item personalizado: novo (com nome sugerido pela busca) ou editando um existente.
  const [editor, setEditor] = useState<{ item?: AltheriumInventoryItem; name?: string } | null>(null)

  const q = normalize(filter.trim())
  const filteredWeapons     = useMemo(() => (q ? WEAPONS.filter((w) => normalize(w.name).includes(q)) : WEAPONS), [q])
  const filteredArmors      = useMemo(() => (q ? ARMORS.filter((a) => normalize(a.name).includes(q)) : ARMORS), [q])
  const filteredConsumables = useMemo(() => (q ? CONSUMABLES.filter((i) => normalize(i.name).includes(q)) : CONSUMABLES), [q])
  const filteredUtilities   = useMemo(() => (q ? UTILITIES.filter((i) => normalize(i.name).includes(q)) : UTILITIES), [q])
  const noResults = filteredWeapons.length === 0 && filteredArmors.length === 0
    && filteredConsumables.length === 0 && filteredUtilities.length === 0

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

          {noResults && (
            <div className="alth-inventory__empty">
              <p>Nenhum item encontrado no catálogo.</p>
              <button
                type="button" className="alth-inventory__custom-btn" disabled={disabled}
                onClick={() => setEditor({ name: filter.trim() })}
              >
                + Criar “{filter.trim()}” como item personalizado
              </button>
            </div>
          )}
        </div>

        <div className="alth-inventory__owned">
          <div className="alth-inventory__owned-head">
            <h5 className="alth-inventory__group-title">Meus itens</h5>
            <button
              type="button" className="alth-inventory__custom-btn" disabled={disabled}
              onClick={() => setEditor({})}
            >
              + Personalizado
            </button>
          </div>
          {inventory.length === 0 && <p className="alth-inventory__empty">Nenhum item no inventário ainda.</p>}
          {inventory.map((inv) => {
            const info = describeInventoryItem(inv)
            if (!info) return null
            const armor = inventoryArmor(inv)
            const custom = isCustom(inv)
            const isChoosingZone = pendingZoneFor === inv.id
            const equippedZoneLabel = inv.equipped && inv.equipped_zone
              ? BODY_PARTS.find((p) => p.id === inv.equipped_zone)?.label
              : null

            return (
              <div key={inv.id} className="alth-inventory__row alth-inventory__row--owned">
                <div className="alth-inventory__row-main">
                  <span className="alth-inventory__name">{info.name}</span>
                  <span className="alth-inventory__detail">
                    {custom && <span className="alth-inventory__tag alth-inventory__tag--custom">Personalizado</span>}
                    {info.detail}
                  </span>
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

                {custom && (
                  <button type="button" className="alth-inventory__edit" disabled={disabled}
                    onClick={() => setEditor({ item: inv })} aria-label={`Editar ${info.name}`} title="Editar">✎</button>
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

      <Presence show={editor !== null} exitMs={220}>
        {() => editor && (
          <CustomItemModal
            initial={editor.item}
            suggestedName={editor.name}
            onCancel={() => setEditor(null)}
            onSubmit={async (input) => {
              if (editor.item) await onUpdateCustom(editor.item, input)
              else await onAddCustom(input)
              setEditor(null)
            }}
          />
        )}
      </Presence>
    </section>
  )
}

// ────────────────────────────────────────────────────────
// Janela de item personalizado — mesmo visual do editor de runa
// (ModalOverlay: fundo embaçado, Esc/clique fora fecham, menos salvando).
// ────────────────────────────────────────────────────────

interface CustomItemModalProps {
  initial?:       AltheriumInventoryItem
  suggestedName?: string
  onSubmit:       (input: AltheriumCustomItemInput) => Promise<void>
  onCancel:       () => void
}

function CustomItemModal({ initial, suggestedName, onSubmit, onCancel }: CustomItemModalProps) {
  const [name, setName]         = useState(initial?.custom_name ?? suggestedName ?? '')
  const [itemType, setItemType] = useState<AltheriumInventoryItem['item_type']>(initial?.item_type ?? 'utilitario')
  const [detail, setDetail]     = useState(initial?.custom_detail ?? '')
  const [db, setDb]             = useState(initial?.custom_db ?? 1)
  const [damageDice, setDamageDice] = useState(initial?.custom_damage_dice ?? '')
  const [damageType, setDamageType] = useState<DamageType>(initial?.custom_damage_type ?? 'corte')
  const [attribute, setAttribute]   = useState<WeaponAttribute>(initial?.custom_attribute ?? 'furia')
  const [range, setRange]           = useState<WeaponRange>(initial?.custom_range ?? 'toque')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const isArmor  = itemType === 'armadura' || itemType === 'escudo'
  const isWeapon = itemType === 'arma'

  useEffect(() => { nameRef.current?.focus() }, [])

  async function handleSave() {
    if (!name.trim()) { setError('Dê um nome ao item.'); return }
    const dice = damageDice.replace(/\s+/g, '').toLowerCase()
    if (isWeapon && !DAMAGE_DICE_PATTERN.test(dice)) {
      setError('Dado de dano inválido — use o formato 1d8 ou 2d6+1.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ item_type: itemType, name, detail, db, damageDice: dice, damageType, attribute, range })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o item.')
      setBusy(false)
    }
  }

  // Enter num campo de uma linha salva o item (em vez de enviar o <form> da ficha).
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault()
      void handleSave()
    }
  }

  return (
    <ModalOverlay onClose={onCancel} closeDisabled={busy}>
      <div
        className="alth-modal__window alth-custom-item"
        role="dialog" aria-modal="true" aria-labelledby="alth-custom-item-title"
        onKeyDown={handleKeyDown}
      >
        <header className="alth-modal__header">
          <h4 id="alth-custom-item-title" className="alth-modal__title">
            {initial ? 'Editar item' : 'Novo item personalizado'}
          </h4>
          <button type="button" className="modal-close" onClick={onCancel} disabled={busy} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="alth-custom-item__body">
          <label className="alth-custom-item__field">
            <span className="label">Nome</span>
            <input
              ref={nameRef} type="text" className="input" maxLength={80}
              value={name} onChange={(e) => setName(e.target.value)} disabled={busy}
            />
          </label>

          <div className="alth-rune__editor-row">
            <label className="alth-custom-item__field alth-rune__editor-half">
              <span className="label">Tipo</span>
              <Select
                value={itemType} onChange={(v) => setItemType(v as AltheriumInventoryItem['item_type'])}
                disabled={busy} aria-label="Tipo do item" options={ITEM_TYPE_OPTIONS}
              />
            </label>
            {isArmor && (
              <label className="alth-custom-item__field alth-rune__editor-cost">
                <span className="label">DB</span>
                <input
                  type="number" className="input" min={0} max={99}
                  value={db}
                  onChange={(e) => setDb(Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0)))}
                  disabled={busy}
                />
              </label>
            )}
          </div>

          {isWeapon && (
            <>
              <div className="alth-rune__editor-row">
                <label className="alth-custom-item__field alth-custom-item__dice">
                  <span className="label">Dado de dano</span>
                  <input
                    type="text" className="input" maxLength={12}
                    value={damageDice} onChange={(e) => setDamageDice(e.target.value)} disabled={busy}
                  />
                </label>
                <label className="alth-custom-item__field alth-rune__editor-half">
                  <span className="label">Tipo de dano</span>
                  <Select
                    value={damageType} onChange={(v) => setDamageType(v as DamageType)}
                    disabled={busy} aria-label="Tipo de dano" options={DAMAGE_TYPE_OPTIONS}
                  />
                </label>
              </div>
              <div className="alth-rune__editor-row">
                <label className="alth-custom-item__field alth-rune__editor-half">
                  <span className="label">Atributo de acerto</span>
                  <Select
                    value={attribute} onChange={(v) => setAttribute(v as WeaponAttribute)}
                    disabled={busy} aria-label="Atributo do teste de acerto" options={WEAPON_ATTRIBUTE_OPTIONS}
                  />
                </label>
                <label className="alth-custom-item__field alth-rune__editor-half">
                  <span className="label">Alcance</span>
                  <Select
                    value={range} onChange={(v) => setRange(v as WeaponRange)}
                    disabled={busy} aria-label="Alcance" options={WEAPON_RANGE_OPTIONS}
                  />
                </label>
              </div>
            </>
          )}

          <label className="alth-custom-item__field">
            <span className="label">Descrição / efeito</span>
            <textarea
              className="input" rows={3} maxLength={300}
              value={detail} onChange={(e) => setDetail(e.target.value)} disabled={busy}
            />
          </label>

          {isArmor && (
            <p className="alth-hint">
              {itemType === 'escudo'
                ? 'Ao equipar, o DB é somado às 4 zonas do corpo.'
                : 'Ao equipar, você escolhe a zona do corpo que recebe o DB.'}
            </p>
          )}

          {error && <p className="alth-triumphs__warn" role="alert">{error}</p>}

          <div className="alth-triumph__actions">
            <button type="button" className="alth-triumph__btn" onClick={onCancel} disabled={busy}>
              Cancelar
            </button>
            <button type="button" className="alth-triumph__btn alth-triumph__btn--add" onClick={() => void handleSave()} disabled={busy}>
              {busy ? 'Salvando...' : initial ? 'Salvar item' : 'Adicionar item'}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}
