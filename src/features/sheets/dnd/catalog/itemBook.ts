import { ARMORS, GEAR, SHIELD, TOOLS, WEAPONS } from './equipment.data'
import type { ArmorEntry, WeaponEntry } from './types'

// ────────────────────────────────────────────────────────
// Livro de itens: armas, armaduras, escudo, equipamento de aventura e
// ferramentas do catálogo numa lista só, com o que o card e a janela de
// detalhes precisam (etiquetas, fatos, nota gravada na ficha) e a busca com
// filtros. Peças puras, sem React.
// ────────────────────────────────────────────────────────

export type ItemKind = 'weapon' | 'armor' | 'gear' | 'tool'

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  weapon: 'Armas', armor: 'Armaduras e escudo', gear: 'Equipamento', tool: 'Ferramentas',
}
export const ITEM_KINDS: readonly ItemKind[] = ['weapon', 'armor', 'gear', 'tool']

export interface BookItem {
  key:    string
  name:   string
  kind:   ItemKind
  /** Categoria do filtro: Simples, Marcial, Leve, Média, Pesada, Escudo ou o grupo do equipamento. */
  group:  string
  cost:   string
  /** Preço em peças de ouro, para ordenar. */
  costGold: number
  weight: number
  /** Etiquetas curtas do card (dano, CA, propriedades). */
  tags:   string[]
  /** Texto que vai para as notas do item na ficha. */
  note:   string
  facts:  { label: string; value: string }[]
  description?: string
  weapon?: WeaponEntry
  armor?:  ArmorEntry
  shield?: boolean
}

const GOLD_PER_COIN: Record<string, number> = { pc: 0.01, pp: 0.1, pe: 0.5, po: 1, pl: 10 }

/** "50 po" → 50; "5 pp" → 0,5. Sem preço entendível, 0. */
export function costInGold(cost: string): number {
  const m = cost.trim().match(/^([\d.,]+)\s*(pc|pp|pe|po|pl)$/i)
  if (!m) return 0
  return Number(m[1].replace(/\./g, '').replace(',', '.')) * GOLD_PER_COIN[m[2].toLowerCase()]
}

/** "arremesso 6/18" → "arremesso"; "versátil 1d10" → "versátil". */
export function propertyName(prop: string): string {
  return prop.replace(/\s+\d.*$/, '').trim()
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const RANGE_LABEL = { melee: 'Corpo a corpo', ranged: 'À distância', both: 'Corpo a corpo e à distância' } as const
const WEAPON_GROUP = { simple: 'Simples', martial: 'Marcial' } as const
const ARMOR_GROUP = { light: 'Leve', medium: 'Média', heavy: 'Pesada' } as const

function weaponItem(w: WeaponEntry): BookItem {
  const damage = w.damage ? `${w.damage} ${w.damageType ?? ''}`.trim() : ''
  return {
    key: w.key, name: w.name, kind: 'weapon', group: WEAPON_GROUP[w.category], cost: w.cost, costGold: costInGold(w.cost), weight: w.weight,
    tags: [damage || 'sem dano', ...w.properties],
    note: [w.cost, damage, ...w.properties].filter(Boolean).join(' · '),
    facts: [
      { label: 'Categoria', value: `${WEAPON_GROUP[w.category]}` },
      { label: 'Alcance', value: RANGE_LABEL[w.range] },
      { label: 'Dano', value: damage || 'não causa dano' },
    ],
    weapon: w,
  }
}

function armorItem(a: ArmorEntry): BookItem {
  const dex = a.category === 'medium' ? ' + Des (máx. 2)' : a.category === 'light' ? ' + Des' : ''
  return {
    key: a.key, name: a.name, kind: 'armor', group: ARMOR_GROUP[a.category], cost: a.cost, costGold: costInGold(a.cost), weight: a.weight,
    tags: [`CA ${a.baseAc}${dex}`, ...(a.stealthDisadvantage ? ['desvantagem em Furtividade'] : []), ...(a.strengthRequirement ? [`Força ${a.strengthRequirement}`] : [])],
    note: `CA ${a.baseAc}${dex} · ${a.cost}`,
    facts: [
      { label: 'Categoria', value: `Armadura ${ARMOR_GROUP[a.category].toLowerCase()}` },
      { label: 'Classe de Armadura', value: `${a.baseAc}${dex}` },
      { label: 'Força exigida', value: a.strengthRequirement ? `${a.strengthRequirement}` : 'nenhuma' },
      { label: 'Furtividade', value: a.stealthDisadvantage ? 'desvantagem' : 'sem efeito' },
    ],
    armor: a,
  }
}

const shieldItem = (): BookItem => ({
  key: SHIELD.key, name: SHIELD.name, kind: 'armor', group: 'Escudo', cost: SHIELD.cost, costGold: costInGold(SHIELD.cost), weight: SHIELD.weight,
  tags: [`+${SHIELD.acBonus} de CA`],
  note: `+${SHIELD.acBonus} de CA · ${SHIELD.cost}`,
  facts: [{ label: 'Categoria', value: 'Escudo' }, { label: 'Bônus de CA', value: `+${SHIELD.acBonus}` }],
  shield: true,
})

function plainItem(kind: 'gear' | 'tool', e: { key: string; name: string; description: string; group: string; cost: string; weight: number }): BookItem {
  return {
    key: e.key, name: e.name, kind, group: capitalize(e.group), cost: e.cost, costGold: costInGold(e.cost), weight: e.weight,
    tags: [capitalize(e.group)],
    note: e.cost,
    facts: [{ label: 'Grupo', value: capitalize(e.group) }],
    description: e.description,
  }
}

export const BOOK_ITEMS: readonly BookItem[] = [
  ...WEAPONS.map(weaponItem),
  ...ARMORS.map(armorItem),
  shieldItem(),
  ...GEAR.map((g) => plainItem('gear', g)),
  ...TOOLS.map((t) => plainItem('tool', t)),
]

export function getBookItem(key: string): BookItem | undefined {
  return BOOK_ITEMS.find((i) => i.key === key)
}

/** As categorias (filtro) de um tipo de item, na ordem em que aparecem no catálogo. */
export function groupsOf(kind: ItemKind): string[] {
  return [...new Set(BOOK_ITEMS.filter((i) => i.kind === kind).map((i) => i.group))]
}

/** Propriedades de arma que existem no catálogo (sem números), em ordem alfabética. */
export function weaponProperties(): string[] {
  const all = WEAPONS.flatMap((w) => w.properties.map(propertyName))
  return [...new Set(all)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Tipos de dano que as armas do catálogo causam. */
export function weaponDamageTypes(): string[] {
  return [...new Set(WEAPONS.flatMap((w) => (w.damageType ? [w.damageType] : [])))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export type ItemSort = 'name' | 'weight' | 'cost'

export interface ItemFilter {
  text?:       string
  kind?:       ItemKind
  group?:      string
  /** Só armas: corpo a corpo ou à distância (armas "both" entram nos dois). */
  range?:      'melee' | 'ranged'
  damageType?: string
  property?:   string
  /** Só o que o personagem sabe usar: armas e armaduras sem proficiência saem; os outros itens ficam. */
  usable?:     { weapons: readonly string[]; armor: readonly string[] }
  sort?:       ItemSort
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function searchItems(filter: ItemFilter, source: readonly BookItem[] = BOOK_ITEMS): BookItem[] {
  const q = filter.text ? fold(filter.text.trim()) : ''
  const out = source.filter((i) => {
    if (filter.kind && i.kind !== filter.kind) return false
    if (filter.group && i.group !== filter.group) return false
    if (filter.range && !(i.weapon && (i.weapon.range === filter.range || i.weapon.range === 'both'))) return false
    if (filter.damageType && i.weapon?.damageType !== filter.damageType) return false
    if (filter.property && !i.weapon?.properties.some((p) => propertyName(p) === filter.property)) return false
    if (filter.usable) {
      if (i.weapon && !(filter.usable.weapons.includes(i.weapon.category) || filter.usable.weapons.includes(i.weapon.key))) return false
      if (i.armor && !filter.usable.armor.includes(i.armor.category)) return false
      if (i.shield && !filter.usable.armor.includes('shield')) return false
    }
    return !q || fold(i.name).includes(q) || fold(i.group).includes(q)
  })
  const byName = (a: BookItem, b: BookItem) => a.name.localeCompare(b.name, 'pt-BR')
  if (filter.sort === 'weight') return out.sort((a, b) => a.weight - b.weight || byName(a, b))
  if (filter.sort === 'cost') return out.sort((a, b) => a.costGold - b.costGold || byName(a, b))
  return out.sort(byName)
}
