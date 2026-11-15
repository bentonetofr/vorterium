import type { DndCharacterFeature, DndCharacterInventoryItem, DndFeatureSource } from '../../../../shared/types'
import { BOOK_ITEMS } from '../catalog/itemBook'

// ────────────────────────────────────────────────────────
// Organização da ficha: as características agrupadas por origem (raça,
// classe, antecedente...) e o inventário com ordem própria, busca e grupos.
// Só lógica pura, sem tela nem banco.
// ────────────────────────────────────────────────────────

export const FEATURE_SOURCE_LABEL: Record<DndFeatureSource, string> = {
  class: 'Classe', subclass: 'Subclasse', race: 'Raça', subrace: 'Sub-raça', background: 'Antecedente', feat: 'Talento', item: 'Item', manual: 'Própria',
}

/** Ordem dos grupos na aba Características. */
export const FEATURE_SOURCE_ORDER: DndFeatureSource[] = ['race', 'subrace', 'background', 'class', 'subclass', 'feat', 'item', 'manual']

/**
 * Origens que o jogador pode dar a uma característica que ele mesmo escreveu.
 * "Própria" é a padrão; as outras fazem a habilidade aparecer junto das do livro.
 */
export const OWN_FEATURE_SOURCES: DndFeatureSource[] = ['manual', 'race', 'subrace', 'background', 'class', 'subclass', 'feat', 'item']

type FeatureLike = Pick<DndCharacterFeature, 'source' | 'level' | 'name'>

/** Por origem, depois por nível e nome. */
export function sortFeatures<T extends FeatureLike>(features: readonly T[]): T[] {
  return [...features].sort((a, b) =>
    FEATURE_SOURCE_ORDER.indexOf(a.source) - FEATURE_SOURCE_ORDER.indexOf(b.source)
    || (a.level ?? 0) - (b.level ?? 0)
    || a.name.localeCompare(b.name, 'pt-BR'))
}

/** As características em grupos por origem, na ordem de exibição; grupo vazio não aparece. */
export function groupFeatures<T extends FeatureLike>(features: readonly T[]): { source: DndFeatureSource; items: T[] }[] {
  return FEATURE_SOURCE_ORDER
    .map((source) => ({ source, items: sortFeatures(features.filter((f) => f.source === source)) }))
    .filter((g) => g.items.length > 0)
}

// ── Inventário ──

export type InventoryGroup = 'weapon' | 'armor' | 'gear' | 'tool' | 'custom'

export const INVENTORY_GROUP_LABEL: Record<InventoryGroup, string> = {
  weapon: 'Armas', armor: 'Armaduras', gear: 'Equipamento', tool: 'Ferramentas', custom: 'Próprios',
}
export const INVENTORY_GROUP_ORDER: InventoryGroup[] = ['weapon', 'armor', 'gear', 'tool', 'custom']

const BOOK_KIND = new Map(BOOK_ITEMS.map((b) => [b.key, b.kind]))

/** Do livro: o tipo dele. Item escrito pelo jogador (sem chave do catálogo) é "Próprio". */
export function inventoryGroup(item: Pick<DndCharacterInventoryItem, 'catalog_entry_key'>): InventoryGroup {
  const kind = item.catalog_entry_key ? BOOK_KIND.get(item.catalog_entry_key) : undefined
  return kind ?? 'custom'
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Busca pelo nome ou pela descrição (sem diferenciar acento nem maiúscula) e, se pedido, por grupo. */
export function filterInventory<T extends Pick<DndCharacterInventoryItem, 'name' | 'notes' | 'catalog_entry_key'>>(
  items: readonly T[], query: string, group: InventoryGroup | '',
): T[] {
  const q = fold(query)
  return items.filter((i) => (!group || inventoryGroup(i) === group) && (!q || fold(i.name).includes(q) || fold(i.notes).includes(q)))
}

/** Move o item uma posição para cima (-1) ou para baixo (+1). Nas pontas, devolve a lista igual. */
export function moveItemBy<T extends { id: string }>(list: readonly T[], id: string, delta: -1 | 1): T[] {
  const from = list.findIndex((i) => i.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= list.length) return [...list]
  return moveItemTo(list, id, to)
}

/** Tira o item de onde está e o põe na posição `to` (0 = primeiro). */
export function moveItemTo<T extends { id: string }>(list: readonly T[], id: string, to: number): T[] {
  const from = list.findIndex((i) => i.id === id)
  if (from < 0) return [...list]
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item)
  return next
}

/** Ordem alfabética (pt-BR), para o botão "Ordenar A–Z". */
export function sortByName<T extends { name: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
}

/** Por grupo (armas, armaduras...) e, dentro dele, por nome. */
export function sortByGroup<T extends Pick<DndCharacterInventoryItem, 'name' | 'catalog_entry_key'>>(list: readonly T[]): T[] {
  return [...list].sort((a, b) =>
    INVENTORY_GROUP_ORDER.indexOf(inventoryGroup(a)) - INVENTORY_GROUP_ORDER.indexOf(inventoryGroup(b))
    || a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
}

/** O que gravar no banco: só os itens cuja posição mudou, com o número novo (a posição na lista). */
export function orderChanges<T extends { id: string; sort_order: number }>(list: readonly T[]): { id: string; sort_order: number }[] {
  const out: { id: string; sort_order: number }[] = []
  list.forEach((item, index) => { if (item.sort_order !== index) out.push({ id: item.id, sort_order: index }) })
  return out
}

/** A lista já com os números novos de ordem. */
export function withOrder<T extends { sort_order: number }>(list: readonly T[]): T[] {
  return list.map((item, index) => (item.sort_order === index ? item : { ...item, sort_order: index }))
}

// ── Descrição ──

/** Descrição curta o bastante para aparecer inteira (sem "ver mais"). */
export const DESC_SHORT_CHARS = 280
export const DESC_SHORT_LINES = 4

export function isLongDescription(notes: string): boolean {
  const lines = notes.split('\n').filter((l) => l.trim()).length
  return notes.length > DESC_SHORT_CHARS || lines > DESC_SHORT_LINES
}
