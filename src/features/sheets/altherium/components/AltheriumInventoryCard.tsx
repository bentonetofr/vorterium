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
  WEAPON_PROPERTIES,
  REPAIR_MATERIAL_LABELS,
  weaponPropertyLabel,
  weaponReinforcementSlots,
  categoryReinforcementSlots,
  readWeaponProperties,
  REPAIR_MATERIAL_IDS,
  WEAPON_PROPERTY_IDS,
  RECARGA_ACTIONS,
  findArmor,
  findWeapon,
  findItem,
  type ArmorCoverage,
  type DamageType,
  type WeaponAttribute,
  type RepairMaterial,
  type WeaponCategory,
  type WeaponDef,
  type WeaponProperty,
  type WeaponPropertyId,
  type WeaponRange,
} from '../constants/altheriumItems'
import { BODY_PARTS } from '../constants/altherium'
import type { AltheriumInventoryItem } from '../../../../shared/types'
import { DAMAGE_DICE_PATTERN, type AltheriumCustomItemInput } from '../services/altheriumSheetService'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { Presence } from '../../../../shared/components/Presence'
import { Select } from '../../../../shared/components/Select'
import type { BodyZone } from './AltheriumBodyDiagram'
import { gearInfo } from './AltheriumCraftPanel'
import { BAND_LABELS, integrityBand, reinforcementDef } from '../utils/altheriumCraft'

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

interface ItemTraits { properties: WeaponProperty[]; repair: RepairMaterial; slots: number }
interface ItemInfo { name: string; detail: string; note?: string; traits?: ItemTraits; price?: number }

/** Propriedades da arma do catálogo — ver ItemTraitsView. */
function WeaponTraits({ weapon }: { weapon: WeaponDef }) {
  return <ItemTraitsView properties={weapon.properties} repair={weapon.repair} slots={weaponReinforcementSlots(weapon)} />
}

/** Propriedades da arma (passar o mouse mostra a regra), material de reparo e espaços de Reforço. */
function ItemTraitsView({ properties, repair, slots }: ItemTraits) {
  return (
    <span className="alth-inventory__traits">
      {properties.map((p) => (
        <span key={p.id} className="alth-inventory__prop" title={WEAPON_PROPERTIES[p.id].description}>
          {weaponPropertyLabel(p)}
        </span>
      ))}
      <span className="alth-inventory__repair">
        Reparo: {REPAIR_MATERIAL_LABELS[repair]} · {slots} {slots === 1 ? 'espaço' : 'espaços'} de Reforço
      </span>
    </span>
  )
}

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
    const parts = [...weapon, armor ? `${armor.db} DB` : null]
    const traits = inv.item_type === 'arma'
      ? { properties: readWeaponProperties(inv.custom_properties), repair: inv.custom_repair ?? 'ferro_velho', slots: categoryReinforcementSlots(inv.custom_category) }
      : undefined
    return {
      name: inv.custom_name!, detail: parts.filter(Boolean).join(' · '), note: inv.custom_detail ?? undefined,
      traits, price: inv.custom_price ?? undefined,
    }
  }
  if (inv.item_type === 'arma') {
    const w = findWeapon(inv.item_id)
    if (!w) return null
    return {
      name: w.name, detail: `${w.damageDice} ${DAMAGE_TYPE_LABELS[w.damageType]} · ${WEAPON_RANGE_LABELS[w.range]}`,
      traits: { properties: w.properties, repair: w.repair, slots: weaponReinforcementSlots(w) },
    }
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

type OwnedFilter = 'todos' | 'arma' | 'armadura' | 'escudo' | 'outros'
const OWNED_FILTERS: { id: OwnedFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'arma', label: 'Armas' },
  { id: 'armadura', label: 'Armaduras' },
  { id: 'escudo', label: 'Escudos' },
  { id: 'outros', label: 'Outros' },
]
function ownedFilterOf(inv: AltheriumInventoryItem): OwnedFilter {
  return inv.item_type === 'arma' || inv.item_type === 'armadura' || inv.item_type === 'escudo' ? inv.item_type : 'outros'
}

/** Observação longa de item personalizado fica em 2 linhas, com “Ver mais”. */
const NOTE_LIMIT = 90

interface OwnedCardProps {
  inv:              AltheriumInventoryItem
  info:             ItemInfo
  disabled:         boolean
  onUpdateQuantity: (id: string, quantity: number) => Promise<void>
  onRemove:         (id: string) => Promise<void>
  onToggleEquip:    AltheriumInventoryCardProps['onToggleEquip']
  onEdit:           () => void
  /** Só mostra o cartão (janela do item personalizado): sem remover, quantidade nem equipar. */
  preview?:         boolean
}

function OwnedCard({ inv, info, disabled, onUpdateQuantity, onRemove, onToggleEquip, onEdit, preview = false }: OwnedCardProps) {
  const [choosingZone, setChoosingZone] = useState(false)
  const [open, setOpen] = useState(false)
  const armor = inventoryArmor(inv)
  const custom = isCustom(inv)
  const gear = gearInfo(inv)
  const band = gear ? integrityBand(gear.integrity) : null
  const zoneLabel = inv.equipped && inv.equipped_zone ? BODY_PARTS.find((p) => p.id === inv.equipped_zone)?.label : null
  const note = info.note ?? ''
  const longNote = note.length > NOTE_LIMIT

  return (
    <article className={`alth-icard${inv.equipped ? ' is-equipped' : ''}`}>
      <header className="alth-icard__head">
        <h5 className="alth-icard__name">{info.name}</h5>
        {!preview && (
          <button type="button" className="alth-inventory__remove" disabled={disabled}
            onClick={() => void onRemove(inv.id)} aria-label={`Remover ${info.name}`} title="Remover">×</button>
        )}
      </header>

      <div className="alth-icard__badges">
        <span className="alth-icard__kind">{ITEM_TYPE_LABELS[inv.item_type]}</span>
        {inv.equipped && <span className="alth-icard__badge alth-icard__badge--on">Equipada{zoneLabel ? ` · ${zoneLabel}` : ''}</span>}
        {custom && <span className="alth-icard__badge">Personalizado</span>}
        {info.price != null && <span className="alth-icard__kind">¤{info.price}</span>}
      </div>

      <p className="alth-icard__detail">{info.detail}</p>
      {note && (
        <p className={`alth-icard__note${open ? ' is-open' : ''}`}>{note}</p>
      )}
      {longNote && (
        <button type="button" className="alth-icard__more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Ver menos' : 'Ver mais'}
        </button>
      )}

      {info.traits && <ItemTraitsView {...info.traits} />}

      {gear && band && (
        <div className="alth-icard__integrity" title="Integridade (repare na aba Ofício)">
          <span className="alth-icard__bar"><i className={`alth-icard__fill alth-icard__fill--${band}`} style={{ width: `${Math.max(0, Math.min(100, gear.integrity))}%` }} /></span>
          <span className={`alth-integrity alth-integrity--${band}`}>
            {gear.integrity}%{band !== 'normal' ? ` · ${BAND_LABELS[band]}` : ''}
          </span>
        </div>
      )}
      {gear && gear.reinforcements.length > 0 && (
        <span className="alth-inventory__traits">
          {gear.reinforcements.map((id) => (
            <span key={id} className="alth-inventory__prop" title={reinforcementDef(id)?.effect}>{reinforcementDef(id)?.label}</span>
          ))}
        </span>
      )}

      {preview ? null : choosingZone && armor ? (
        <div className="alth-inventory__zone-picker">
          <span className="alth-inventory__zone-hint">Onde?</span>
          {BODY_PARTS.map((part) => (
            <button key={part.id} type="button" className="alth-inventory__zone-btn"
              onClick={() => { onToggleEquip(inv, 'equip', part.id as BodyZone); setChoosingZone(false) }}>
              {part.label}
            </button>
          ))}
          <button type="button" className="alth-inventory__zone-cancel" onClick={() => setChoosingZone(false)}>Cancelar</button>
        </div>
      ) : (
        <footer className="alth-icard__foot">
          <div className="alth-inventory__qty">
            <button type="button" className="alth-inventory__qty-btn" disabled={disabled}
              onClick={() => void (inv.quantity > 1 ? onUpdateQuantity(inv.id, inv.quantity - 1) : onRemove(inv.id))}
              aria-label={`Diminuir quantidade de ${info.name}`}>−</button>
            <span key={inv.quantity} className="alth-inventory__qty-value anim-bump">{inv.quantity}</span>
            <button type="button" className="alth-inventory__qty-btn" disabled={disabled}
              onClick={() => void onUpdateQuantity(inv.id, inv.quantity + 1)}
              aria-label={`Aumentar quantidade de ${info.name}`}>+</button>
          </div>
          <span className="alth-icard__spacer" />
          {armor && (
            <button type="button" className={`alth-icard__act${inv.equipped ? ' is-on' : ''}`} disabled={disabled} aria-pressed={inv.equipped}
              onClick={() => {
                if (inv.equipped) { onToggleEquip(inv, 'unequip'); return }
                if (armor.coverage === 'todas') onToggleEquip(inv, 'equip')
                else setChoosingZone(true)
              }}>
              {inv.equipped ? 'Desequipar' : 'Equipar'}
            </button>
          )}
          {custom && (
            <button type="button" className="alth-icard__act" disabled={disabled} onClick={onEdit} aria-label={`Editar ${info.name}`}>Editar</button>
          )}
        </footer>
      )}
    </article>
  )
}

export function AltheriumInventoryCard({
  inventory, onAdd, onUpdateQuantity, onRemove, onToggleEquip, onAddCustom, onUpdateCustom, disabled = false,
}: AltheriumInventoryCardProps) {
  const [filter, setFilter] = useState<OwnedFilter>('todos')
  const [catalogOpen, setCatalogOpen] = useState(false)
  // Janela de item personalizado: novo (com nome sugerido pela busca) ou editando um existente.
  const [editor, setEditor] = useState<{ item?: AltheriumInventoryItem; name?: string } | null>(null)

  const entries = useMemo(
    () => inventory.map((inv) => ({ inv, info: describeInventoryItem(inv) })).filter((e): e is { inv: AltheriumInventoryItem; info: ItemInfo } => e.info !== null),
    [inventory],
  )
  const counts = useMemo(() => {
    const c: Record<OwnedFilter, number> = { todos: entries.length, arma: 0, armadura: 0, escudo: 0, outros: 0 }
    for (const e of entries) c[ownedFilterOf(e.inv)] += 1
    return c
  }, [entries])
  const activeFilter = filter !== 'todos' && counts[filter] === 0 ? 'todos' : filter
  const shown = activeFilter === 'todos' ? entries : entries.filter((e) => ownedFilterOf(e.inv) === activeFilter)

  return (
    <section className="alth-card alth-inventory">
      <div className="alth-card__header">
        <h4 className="alth-card__title">Meus itens</h4>
        <button type="button" className="alth-triumph__btn alth-triumph__btn--add" disabled={disabled} onClick={() => setCatalogOpen(true)}>
          + Adicionar item
        </button>
      </div>

      {entries.length > 0 && (
        <div className="alth-inv-tabs" role="tablist" aria-label="Filtrar itens">
          {OWNED_FILTERS.filter((f) => f.id === 'todos' || counts[f.id] > 0).map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={activeFilter === f.id}
              className={`alth-inv-tab${activeFilter === f.id ? ' is-on' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label} <b>{counts[f.id]}</b>
            </button>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="alth-inventory__empty">
          <p>Nenhum item no inventário ainda.</p>
          <button type="button" className="alth-inventory__custom-btn" disabled={disabled} onClick={() => setCatalogOpen(true)}>
            + Abrir o catálogo
          </button>
        </div>
      ) : (
        <div key={activeFilter} className="alth-icards">
          {shown.map(({ inv, info }) => (
            <OwnedCard
              key={inv.id} inv={inv} info={info} disabled={disabled}
              onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} onToggleEquip={onToggleEquip}
              onEdit={() => setEditor({ item: inv })}
            />
          ))}
        </div>
      )}

      <p className="alth-hint">
        Equipar soma o DB da peça à zona escolhida (escudo cobre as 4 zonas de uma vez). Desequipar
        só desmarca: os campos de DB continuam manuais, ajuste-os se remover a peça.
      </p>

      <Presence show={catalogOpen} exitMs={220}>
        {() => (
          <CatalogModal
            inventory={inventory} disabled={disabled} onAdd={onAdd}
            onClose={() => setCatalogOpen(false)}
            onCustom={(name) => { setCatalogOpen(false); setEditor({ name }) }}
          />
        )}
      </Presence>

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
// Catálogo em janela — busca + categorias; o + soma o item e a janela
// continua aberta para pegar vários.
// ────────────────────────────────────────────────────────

type CatKey = WeaponCategory | 'armadura' | 'escudo' | 'consumivel' | 'utilitario'

interface CatalogEntry {
  key:    string
  type:   AltheriumInventoryItem['item_type']
  id:     string
  cat:    CatKey
  name:   string
  stats:  string
  price:  number
  weapon?: WeaponDef
  berserker?: boolean
}

const CATALOG: CatalogEntry[] = [
  ...WEAPONS.map((w): CatalogEntry => ({
    key: `arma:${w.id}`, type: 'arma', id: w.id, cat: w.category, name: w.name, price: w.price, weapon: w, berserker: w.berserkerOnly,
    stats: `${w.damageDice} ${DAMAGE_TYPE_LABELS[w.damageType]} · ${WEAPON_ATTRIBUTE_LABELS[w.attribute]} · ${WEAPON_RANGE_LABELS[w.range]}`,
  })),
  ...ARMORS.map((a): CatalogEntry => ({
    key: `${a.kind}:${a.id}`, type: a.kind, id: a.id, cat: a.kind === 'escudo' ? 'escudo' : 'armadura', name: a.name, price: a.price,
    stats: `${a.description} · ${a.db} DB`,
  })),
  ...CONSUMABLES.map((i): CatalogEntry => ({ key: `consumivel:${i.id}`, type: 'consumivel', id: i.id, cat: 'consumivel', name: i.name, price: i.price, stats: i.effect })),
  ...UTILITIES.map((i): CatalogEntry => ({ key: `utilitario:${i.id}`, type: 'utilitario', id: i.id, cat: 'utilitario', name: i.name, price: i.price, stats: i.effect })),
]

const CAT_CHIPS: { id: CatKey | 'todos'; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  ...WEAPON_CATEGORIES.map((c) => ({ id: c as CatKey, label: WEAPON_CATEGORY_LABELS[c] })),
  { id: 'armadura', label: 'Armaduras' },
  { id: 'escudo', label: 'Escudos' },
  { id: 'consumivel', label: 'Consumíveis' },
  { id: 'utilitario', label: 'Utilitários' },
]

interface CatalogModalProps {
  inventory: AltheriumInventoryItem[]
  disabled:  boolean
  onAdd:     AltheriumInventoryCardProps['onAdd']
  onClose:   () => void
  onCustom:  (suggestedName: string) => void
}

function CatalogModal({ inventory, disabled, onAdd, onClose, onCustom }: CatalogModalProps) {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<CatKey | 'todos'>('todos')
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => { searchRef.current?.focus() }, [])

  const owned = useMemo(() => {
    const m = new Map<string, number>()
    for (const inv of inventory) {
      if (isCustom(inv)) continue
      const k = `${inv.item_type}:${inv.item_id}`
      m.set(k, (m.get(k) ?? 0) + inv.quantity)
    }
    return m
  }, [inventory])

  const q = normalize(query.trim())
  const rows = useMemo(
    () => CATALOG.filter((e) => (cat === 'todos' || e.cat === cat) && (!q || normalize(e.name).includes(q))),
    [cat, q],
  )

  return (
    <ModalOverlay onClose={onClose}>
      <div className="alth-modal__window alth-catalog" role="dialog" aria-modal="true" aria-labelledby="alth-catalog-title">
        <header className="alth-modal__header">
          <h4 id="alth-catalog-title" className="alth-modal__title">Adicionar item</h4>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="alth-catalog__top">
          <input
            ref={searchRef} type="text" className="input" placeholder="Buscar no catálogo..."
            value={query} onChange={(e) => setQuery(e.target.value)}
          />
          <div className="alth-catalog__chips" role="tablist" aria-label="Categoria">
            {CAT_CHIPS.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={cat === c.id}
                className={`alth-inv-tab${cat === c.id ? ' is-on' : ''}`} onClick={() => setCat(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="alth-catalog__list">
          {rows.map((e) => {
            const have = owned.get(e.key) ?? 0
            return (
              <div key={e.key} className="alth-inventory__row">
                <div className="alth-inventory__row-main">
                  <span className="alth-inventory__name">
                    {e.name}
                    {e.berserker && <span className="alth-inventory__tag">Berserker</span>}
                    {have > 0 && <span className="alth-catalog__have">×{have} no inventário</span>}
                  </span>
                  <span className="alth-inventory__detail">{e.stats}</span>
                  {e.weapon && <WeaponTraits weapon={e.weapon} />}
                </div>
                <span className="alth-inventory__price">¤{e.price}</span>
                <button type="button" className="alth-inventory__add" disabled={disabled}
                  onClick={() => void onAdd(e.type, e.id)} aria-label={`Adicionar ${e.name}`}>+</button>
              </div>
            )
          })}
          {rows.length === 0 && (
            <div className="alth-inventory__empty">
              <p>Nenhum item encontrado no catálogo.</p>
            </div>
          )}
        </div>

        <footer className="alth-catalog__foot">
          <button type="button" className="alth-inventory__custom-btn" disabled={disabled} onClick={() => onCustom(query.trim())}>
            {query.trim() ? `+ Criar “${query.trim()}” como item personalizado` : '+ Item personalizado'}
          </button>
          <button type="button" className="alth-triumph__btn" onClick={onClose}>Fechar</button>
        </footer>
      </div>
    </ModalOverlay>
  )
}

// ────────────────────────────────────────────────────────
// Janela de item personalizado — formulário à esquerda e, à direita, o
// cartão como vai ficar em "Meus itens" (atualiza enquanto você preenche).
// ModalOverlay: fundo embaçado, Esc/clique fora fecham, menos salvando.
// ────────────────────────────────────────────────────────

interface CustomItemModalProps {
  initial?:       AltheriumInventoryItem
  suggestedName?: string
  onSubmit:       (input: AltheriumCustomItemInput) => Promise<void>
  onCancel:       () => void
}

const CATEGORY_OPTIONS = WEAPON_CATEGORIES.map((c) => ({ value: c, label: WEAPON_CATEGORY_LABELS[c] }))
const REPAIR_OPTIONS = REPAIR_MATERIAL_IDS.map((r) => ({ value: r, label: REPAIR_MATERIAL_LABELS[r] }))
const RECARGA_OPTIONS = RECARGA_ACTIONS.map((a) => ({ value: a, label: a }))
/** Propriedades que não combinam entre si: ligar uma desliga a outra. */
const EXCLUSIVE: Partial<Record<WeaponPropertyId, WeaponPropertyId>> = {
  duas_maos: 'uma_mao', uma_mao: 'duas_maos', robusta: 'fragil', fragil: 'robusta',
}
const TYPE_TILES: AltheriumInventoryItem['item_type'][] = ['arma', 'armadura', 'escudo', 'consumivel', 'utilitario']

function CustomItemModal({ initial, suggestedName, onSubmit, onCancel }: CustomItemModalProps) {
  const [name, setName]         = useState(initial?.custom_name ?? suggestedName ?? '')
  const [itemType, setItemType] = useState<AltheriumInventoryItem['item_type']>(initial?.item_type ?? 'arma')
  const [detail, setDetail]     = useState(initial?.custom_detail ?? '')
  const [db, setDb]             = useState(initial?.custom_db ?? 1)
  const [damageDice, setDamageDice] = useState(initial?.custom_damage_dice ?? '')
  const [damageType, setDamageType] = useState<DamageType>(initial?.custom_damage_type ?? 'corte')
  const [attribute, setAttribute]   = useState<WeaponAttribute>(initial?.custom_attribute ?? 'furia')
  const [range, setRange]           = useState<WeaponRange>(initial?.custom_range ?? 'toque')
  const [category, setCategory]     = useState<WeaponCategory>(initial?.custom_category ?? 'leve')
  const [repair, setRepair]         = useState<RepairMaterial>(initial?.custom_repair ?? 'ferro_velho')
  const [properties, setProperties] = useState<WeaponProperty[]>(() => readWeaponProperties(initial?.custom_properties))
  const [price, setPrice]           = useState(initial?.custom_price != null ? String(initial.custom_price) : '')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const isArmor  = itemType === 'armadura' || itemType === 'escudo'
  const isWeapon = itemType === 'arma'

  useEffect(() => { nameRef.current?.focus() }, [])

  const prop = (id: WeaponPropertyId) => properties.find((p) => p.id === id)
  function toggleProp(id: WeaponPropertyId) {
    setProperties((list) => {
      if (list.some((p) => p.id === id)) return list.filter((p) => p.id !== id)
      const without = list.filter((p) => p.id !== EXCLUSIVE[id])
      const added: WeaponProperty = id === 'perfurante' ? { id, value: 1 } : id === 'recarga' ? { id, action: RECARGA_ACTIONS[0] } : { id }
      return [...without, added]
    })
  }
  const patchProp = (id: WeaponPropertyId, patch: Partial<WeaponProperty>) =>
    setProperties((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  async function handleSave() {
    if (!name.trim()) { setError('Dê um nome ao item.'); return }
    const dice = damageDice.replace(/\s+/g, '').toLowerCase()
    if (isWeapon && !DAMAGE_DICE_PATTERN.test(dice)) {
      setError('Dado de dano inválido. Use o formato 1d8 ou 2d6+1.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        item_type: itemType, name, detail, db, damageDice: dice, damageType, attribute, range,
        details: {
          price: price.trim() === '' ? null : Number(price),
          category: isWeapon ? category : null,
          repair: isWeapon || isArmor ? repair : null,
          properties: isWeapon ? properties : [],
        },
      })
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

  // O cartão de prévia é o mesmo de "Meus itens", montado com o que está no formulário.
  const draft: AltheriumInventoryItem = {
    id: 'preview', sheet_id: '', item_type: itemType, item_id: 'custom:preview', quantity: 1,
    equipped: false, equipped_zone: null,
    custom_name: name.trim() || 'Sem nome', custom_detail: detail.trim() || null,
    custom_db: isArmor ? db : null,
    custom_damage_dice: isWeapon ? (damageDice.trim() || null) : null,
    custom_damage_type: isWeapon ? damageType : null,
    custom_attribute: isWeapon ? attribute : null,
    custom_range: isWeapon ? range : null,
    custom_category: isWeapon ? category : null,
    custom_repair: isWeapon || isArmor ? repair : null,
    custom_properties: isWeapon ? properties : null,
    custom_price: price.trim() === '' ? null : Number(price),
    integrity: 100, reinforcements: [], crafted: null, created_at: '',
  }
  const draftInfo = describeInventoryItem(draft)
  const slots = categoryReinforcementSlots(category)

  return (
    <ModalOverlay onClose={onCancel} closeDisabled={busy}>
      <div
        className="alth-modal__window alth-custom-item alth-custom-item--wide"
        role="dialog" aria-modal="true" aria-labelledby="alth-custom-item-title"
        onKeyDown={handleKeyDown}
      >
        <header className="alth-modal__header">
          <h4 id="alth-custom-item-title" className="alth-modal__title">
            {initial ? 'Editar item' : `Novo item personalizado`}
          </h4>
          <button type="button" className="modal-close" onClick={onCancel} disabled={busy} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="alth-custom-item__cols">
          <div className="alth-custom-item__body">
            <div className="alth-type-tiles" role="radiogroup" aria-label="Tipo do item">
              {TYPE_TILES.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={itemType === t} disabled={busy}
                  className={`alth-type-tile${itemType === t ? ' is-on' : ''}`} onClick={() => setItemType(t)}>
                  {ITEM_TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            <label className="alth-custom-item__field">
              <span className="label">Nome</span>
              <input
                ref={nameRef} type="text" className="input" maxLength={80}
                value={name} onChange={(e) => setName(e.target.value)} disabled={busy}
              />
            </label>

            {isWeapon && (
              <>
                <div className="alth-rune__editor-row">
                  <label className="alth-custom-item__field alth-custom-item__dice">
                    <span className="label">Dado de dano</span>
                    <input
                      type="text" className="input" maxLength={12} placeholder="1d10"
                      value={damageDice} onChange={(e) => setDamageDice(e.target.value)} disabled={busy}
                    />
                  </label>
                  <label className="alth-custom-item__field alth-rune__editor-half">
                    <span className="label">Categoria</span>
                    <Select value={category} onChange={(v) => setCategory(v as WeaponCategory)}
                      disabled={busy} aria-label="Categoria da arma" options={CATEGORY_OPTIONS} />
                  </label>
                </div>
                <div className="alth-rune__editor-row">
                  <label className="alth-custom-item__field alth-rune__editor-half">
                    <span className="label">Tipo de dano</span>
                    <Select value={damageType} onChange={(v) => setDamageType(v as DamageType)}
                      disabled={busy} aria-label="Tipo de dano" options={DAMAGE_TYPE_OPTIONS} />
                  </label>
                  <label className="alth-custom-item__field alth-rune__editor-half">
                    <span className="label">Atributo de acerto</span>
                    <Select value={attribute} onChange={(v) => setAttribute(v as WeaponAttribute)}
                      disabled={busy} aria-label="Atributo do teste de acerto" options={WEAPON_ATTRIBUTE_OPTIONS} />
                  </label>
                </div>
                <div className="alth-rune__editor-row">
                  <label className="alth-custom-item__field alth-rune__editor-half">
                    <span className="label">Alcance</span>
                    <Select value={range} onChange={(v) => setRange(v as WeaponRange)}
                      disabled={busy} aria-label="Alcance" options={WEAPON_RANGE_OPTIONS} />
                  </label>
                  <label className="alth-custom-item__field alth-rune__editor-half">
                    <span className="label">Material de reparo</span>
                    <Select value={repair} onChange={(v) => setRepair(v as RepairMaterial)}
                      disabled={busy} aria-label="Material de reparo" options={REPAIR_OPTIONS} />
                  </label>
                </div>

                <div className="alth-custom-item__field">
                  <span className="label">Propriedades</span>
                  <div className="alth-props" role="group" aria-label="Propriedades da arma">
                    {WEAPON_PROPERTY_IDS.map((id) => {
                      const on = !!prop(id)
                      return (
                        <button key={id} type="button" aria-pressed={on} disabled={busy}
                          className={`alth-prop-chip${on ? ' is-on' : ''}`} title={WEAPON_PROPERTIES[id].description}
                          onClick={() => toggleProp(id)}>
                          {WEAPON_PROPERTIES[id].label}
                        </button>
                      )
                    })}
                  </div>
                  {prop('perfurante') && (
                    <div className="alth-prop-param">
                      <span>Perfurante ignora</span>
                      <span className="alth-stepper" role="group" aria-label="Perfurante X">
                        <button type="button" disabled={busy || (prop('perfurante')?.value ?? 1) <= 1}
                          onClick={() => patchProp('perfurante', { value: (prop('perfurante')?.value ?? 1) - 1 })} aria-label="Diminuir">−</button>
                        <output>{prop('perfurante')?.value ?? 1}</output>
                        <button type="button" disabled={busy || (prop('perfurante')?.value ?? 1) >= 9}
                          onClick={() => patchProp('perfurante', { value: (prop('perfurante')?.value ?? 1) + 1 })} aria-label="Aumentar">+</button>
                      </span>
                      <span>pontos de DB</span>
                    </div>
                  )}
                  {prop('recarga') && (
                    <div className="alth-prop-param">
                      <span>Recarga com</span>
                      <Select value={prop('recarga')?.action ?? RECARGA_ACTIONS[0]} onChange={(v) => patchProp('recarga', { action: v })}
                        disabled={busy} aria-label="Ação da recarga" options={RECARGA_OPTIONS} />
                    </div>
                  )}
                </div>
              </>
            )}

            {isArmor && (
              <div className="alth-rune__editor-row">
                <label className="alth-custom-item__field alth-rune__editor-cost">
                  <span className="label">DB</span>
                  <input
                    type="number" className="input" min={0} max={99}
                    value={db}
                    onChange={(e) => setDb(Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0)))}
                    disabled={busy}
                  />
                </label>
                <label className="alth-custom-item__field alth-rune__editor-half">
                  <span className="label">Material de reparo</span>
                  <Select value={repair} onChange={(v) => setRepair(v as RepairMaterial)}
                    disabled={busy} aria-label="Material de reparo" options={REPAIR_OPTIONS} />
                </label>
              </div>
            )}

            <label className="alth-custom-item__field alth-custom-item__price">
              <span className="label">Preço (¤)</span>
              <input
                type="number" className="input" min={0} max={99999999} placeholder="Opcional"
                value={price} onChange={(e) => setPrice(e.target.value)} disabled={busy}
              />
            </label>

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
          </div>

          <aside className="alth-custom-item__side" aria-label="Prévia do item">
            <span className="label">Prévia</span>
            {draftInfo && (
              <OwnedCard
                inv={draft} info={draftInfo} disabled preview
                onUpdateQuantity={async () => {}} onRemove={async () => {}} onToggleEquip={() => {}} onEdit={() => {}}
              />
            )}
            {isWeapon && (
              <p className="alth-hint">
                {WEAPON_CATEGORY_LABELS[category]}: {slots} {slots === 1 ? 'espaço' : 'espaços'} de Reforço.
              </p>
            )}
          </aside>
        </div>

        <footer className="alth-custom-item__foot">
          {error ? <p className="alth-triumphs__warn" role="alert">{error}</p> : <span />}
          <div className="alth-triumph__actions">
            <button type="button" className="alth-triumph__btn" onClick={onCancel} disabled={busy}>
              Cancelar
            </button>
            <button type="button" className="alth-triumph__btn alth-triumph__btn--add" onClick={() => void handleSave()} disabled={busy}>
              {busy ? 'Salvando...' : initial ? 'Salvar item' : 'Adicionar item'}
            </button>
          </div>
        </footer>
      </div>
    </ModalOverlay>
  )
}
