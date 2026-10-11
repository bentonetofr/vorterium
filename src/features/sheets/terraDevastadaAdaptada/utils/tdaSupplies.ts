import type { TdaInventoryItem, TdaSupplies } from '../../../../shared/types'
import { INVENTORY_MAX } from '../constants/terraDevastadaAdaptada'
import { newId } from './tdaRules'

// ────────────────────────────────────────────────────────
// Suprimentos da Terra Devastada Adaptada: materiais, kits, munição,
// desgaste das armas e fabricação. Tudo em funções puras (a ficha só
// aplica o resultado).
//
// Materiais são achados em pedaços: Trapos, Álcool, Lâminas, Explosivos e
// Sucata guardados em PORCENTAGEM (100% = 1 inteiro, até 3 de cada = 300%);
// só serve pra fabricar com 100% de cada ingrediente. Peças são sempre
// inteiras (valem no mínimo 1) e não têm teto: no jogo se acham aos montes.
// Kits médicos e suplementos são unidades. A Mochila (0 a 3) aumenta as balas de cada arma de fogo
// (6, +3 por nível), os kits (2 + nível) e os arremessos (3 + nível).
// Melhorar uma arma na bancada (1 Peça + 1 Sucata) dá +2 balas ou +2
// usos, e nunca mexe no dano.
// ────────────────────────────────────────────────────────

export type SupplyKey = keyof TdaSupplies

/** 100% = 1 material inteiro. */
export const UNIT = 100
/** Cabem até 3 inteiros de cada material (300%), com ou sem Mochila. */
export const MATERIAL_CAP = 3 * UNIT
/** Peças não têm teto de verdade; este é só um limite prático (999 peças). */
export const PARTS_MAX = 999 * UNIT

export const SUPPLY_LIST: { key: SupplyKey; label: string; hint: string; whole: boolean }[] = [
  { key: 'trapos',      label: 'Trapos',      hint: 'Curativos e pavios',            whole: false },
  { key: 'alcool',      label: 'Álcool',      hint: 'Limpa feridas ou vira fogo',    whole: false },
  { key: 'laminas',     label: 'Lâminas',     hint: 'Facas e cacos afiados',         whole: false },
  { key: 'explosivos',  label: 'Explosivos',  hint: 'Pólvora e pavio',               whole: false },
  { key: 'sucata',      label: 'Sucata',      hint: 'Metal, fita, parafusos',        whole: false },
  { key: 'pecas',       label: 'Peças',       hint: 'Pra melhorar armas (sempre inteira, sem limite)', whole: true },
]

/** Chaves guardadas em unidades (o resto dos materiais é em porcentagem). */
const COUNTED: SupplyKey[] = ['kits', 'suplementos']

/** "60%", "1" ou "1 e 60%" (100% = 1). */
export function amountLabel(percent: number): string {
  const whole = Math.floor(percent / UNIT)
  const rest = percent % UNIT
  if (rest === 0) return String(whole)
  return whole === 0 ? `${rest}%` : `${whole} e ${rest}%`
}

export const MAX_BACKPACK = 3
export const KIT_HEAL = 3
export const SUPPLEMENT_MAX = 9
export const UPGRADE_MAX = 3

export function emptySupplies(): TdaSupplies {
  return { trapos: 0, alcool: 0, sucata: 0, laminas: 0, explosivos: 0, pecas: 0, suplementos: 0, kits: 0 }
}

/** Completa o que faltar e arruma o que vier torto do banco. */
export function normalizeSupplies(raw: Partial<TdaSupplies> | null | undefined): TdaSupplies {
  const base = emptySupplies()
  for (const key of Object.keys(base) as SupplyKey[]) {
    const v = Number(raw?.[key])
    const max = COUNTED.includes(key) ? 99 : key === 'pecas' ? PARTS_MAX : MATERIAL_CAP
    base[key] = Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0
  }
  return base
}

export function capacity(backpack: number): number { return 6 + 3 * clampBackpack(backpack) }
export function kitCap(backpack: number): number { return 2 + clampBackpack(backpack) }
export function throwableCap(backpack: number): number { return 3 + clampBackpack(backpack) }

export function clampBackpack(n: number): number {
  return Math.max(0, Math.min(MAX_BACKPACK, Math.round(n) || 0))
}

export function supplyCap(key: SupplyKey, backpack: number): number {
  if (key === 'kits') return kitCap(backpack)
  if (key === 'suplementos') return SUPPLEMENT_MAX
  if (key === 'pecas') return PARTS_MAX
  return MATERIAL_CAP
}

// ── Armas ───────────────────────────────────────────────

export type WeaponType = 'corpo' | 'fogo' | 'consumivel'

export const WEAPON_TYPES: { id: WeaponType; label: string; hint: string }[] = [
  { id: 'corpo',      label: 'Corpo a corpo', hint: 'Gasta 1 uso por ataque e quebra quando acabam' },
  { id: 'fogo',       label: 'Arma de fogo',  hint: 'Gasta 1 bala por ataque' },
  { id: 'consumivel', label: 'Arremesso',     hint: 'Cada unidade some depois de usada (molotov, granada...)' },
]

/** Tipo da arma: o escolhido, ou o que o dano sugere (1 corpo a corpo, 2 a 4 fogo, 5+ arremesso). */
export function weaponType(item: Pick<TdaInventoryItem, 'level' | 'wtype'>): WeaponType {
  if (item.wtype) return item.wtype
  return item.level >= 5 ? 'consumivel' : item.level >= 2 ? 'fogo' : 'corpo'
}

export function ammoCap(item: Pick<TdaInventoryItem, 'up'>, backpack: number): number {
  return capacity(backpack) + 2 * (item.up ?? 0)
}

export function durabilityMax(item: Pick<TdaInventoryItem, 'up'>): number {
  return 4 + 2 * (item.up ?? 0)
}

/** Preenche munição/usos que faltam, pra a ficha e o combate lerem sempre o mesmo. */
export function normalizeWeapon(item: TdaInventoryItem, backpack: number): TdaInventoryItem {
  if (item.kind !== 'arma') return item
  const wtype = weaponType(item)
  const up = Math.max(0, Math.min(UPGRADE_MAX, item.up ?? 0))
  const withUp = { ...item, wtype, up }
  return {
    ...withUp,
    ammo: wtype === 'fogo' ? Math.max(0, item.ammo ?? Math.min(6, ammoCap(withUp, backpack))) : 0,
    dur:  wtype === 'corpo' ? Math.max(0, item.dur ?? durabilityMax(withUp)) : 0,
  }
}

/** A arma pode atacar agora? (fogo precisa de bala; corpo a corpo, de uso.) */
export function weaponReady(item: TdaInventoryItem): { ok: boolean; reason: string | null } {
  const type = weaponType(item)
  if (type === 'fogo' && (item.ammo ?? 0) < 1) return { ok: false, reason: 'Sem munição.' }
  if (type === 'corpo' && (item.dur ?? 1) < 1) return { ok: false, reason: 'A arma quebrou.' }
  if (type === 'consumivel' && item.qty < 1) return { ok: false, reason: 'Acabou.' }
  return { ok: true, reason: null }
}

/**
 * Um ataque com a arma: gasta 1 bala, 1 uso ou 1 unidade. Arremesso que
 * chega a zero sai do inventário.
 */
export function spendWeaponUse(inventory: TdaInventoryItem[], id: string): TdaInventoryItem[] {
  return inventory.flatMap((it) => {
    if (it.id !== id) return [it]
    const type = weaponType(it)
    if (type === 'fogo')  return [{ ...it, ammo: Math.max(0, (it.ammo ?? 0) - 1) }]
    if (type === 'corpo') return [{ ...it, dur: Math.max(0, (it.dur ?? 0) - 1) }]
    return it.qty > 1 ? [{ ...it, qty: it.qty - 1 }] : []
  })
}

/** Melhoria na bancada: 1 Peça + 1 Sucata, até 3 vezes por arma. */
export function upgradeWeapon(
  inventory: TdaInventoryItem[], id: string, supplies: TdaSupplies,
): { inventory: TdaInventoryItem[]; supplies: TdaSupplies } | { error: string } {
  const item = inventory.find((i) => i.id === id)
  if (!item || item.kind !== 'arma') return { error: 'Arma não encontrada.' }
  if ((item.up ?? 0) >= UPGRADE_MAX) return { error: 'Essa arma já está no máximo de melhorias.' }
  if (supplies.pecas < UNIT || supplies.sucata < UNIT) return { error: 'Faltam materiais (1 Peça e 1 Sucata inteiras).' }
  return {
    supplies: { ...supplies, pecas: supplies.pecas - UNIT, sucata: supplies.sucata - UNIT },
    inventory: inventory.map((i) => (i.id === id ? { ...i, up: (i.up ?? 0) + 1 } : i)),
  }
}

// ── Fabricação ──────────────────────────────────────────

export type RecipeResult =
  | { kind: 'kit' }
  | { kind: 'weapon'; name: string; level: number }
  | { kind: 'item'; name: string }

export interface Recipe {
  id:     string
  name:   string
  cost:   Partial<Record<SupplyKey, number>>
  result: RecipeResult
  hint:   string
}

/**
 * O dilema do jogo: curar e atacar gastam os mesmos materiais (Trapos +
 * Álcool). Efeitos de fumaça e faca ficam a cargo do Narrador.
 */
export const RECIPES: Recipe[] = [
  { id: 'kit', name: 'Kit médico', cost: { trapos: UNIT, alcool: UNIT }, result: { kind: 'kit' },
    hint: `Cura ${KIT_HEAL} de Vida quando usado.` },
  { id: 'molotov', name: 'Coquetel molotov', cost: { trapos: UNIT, alcool: UNIT }, result: { kind: 'weapon', name: 'Coquetel molotov', level: 5 },
    hint: 'Arremesso de dano 5. Gasta o mesmo que um kit.' },
  { id: 'pregos', name: 'Bomba de pregos', cost: { explosivos: UNIT, laminas: UNIT }, result: { kind: 'weapon', name: 'Bomba de pregos', level: 5 },
    hint: 'Arremesso de dano 5.' },
  { id: 'fumaca', name: 'Bomba de fumaça', cost: { explosivos: UNIT, sucata: UNIT }, result: { kind: 'item', name: 'Bomba de fumaça' },
    hint: 'Cobre uma fuga ou um golpe furtivo. O efeito é do Narrador.' },
  { id: 'faca', name: 'Faca improvisada', cost: { laminas: UNIT, trapos: UNIT }, result: { kind: 'item', name: 'Faca improvisada' },
    hint: 'Uso único contra Estalador e portas trancadas. O efeito é do Narrador.' },
  { id: 'silenciador', name: 'Silenciador', cost: { sucata: 2 * UNIT }, result: { kind: 'item', name: 'Silenciador' },
    hint: 'Abafa o tiro de uma arma de fogo. O efeito é do Narrador.' },
]

export function canAfford(cost: Recipe['cost'], supplies: TdaSupplies): boolean {
  return (Object.entries(cost) as [SupplyKey, number][]).every(([k, n]) => supplies[k] >= n)
}

export function costLabel(cost: Recipe['cost']): string {
  return (Object.entries(cost) as [SupplyKey, number][])
    .map(([k, n]) => `${n / UNIT} ${SUPPLY_LIST.find((s) => s.key === k)?.label ?? k}`).join(' + ')
}

export function craft(
  recipe: Recipe, supplies: TdaSupplies, inventory: TdaInventoryItem[], backpack: number,
): { supplies: TdaSupplies; inventory: TdaInventoryItem[] } | { error: string } {
  if (!canAfford(recipe.cost, supplies)) return { error: `Faltam materiais inteiros: ${costLabel(recipe.cost)}. Pedaços de material não bastam.` }

  const spent = { ...supplies }
  for (const [k, n] of Object.entries(recipe.cost) as [SupplyKey, number][]) spent[k] -= n

  const r = recipe.result
  if (r.kind === 'kit') {
    if (spent.kits >= kitCap(backpack)) return { error: `Só cabem ${kitCap(backpack)} kits na mochila.` }
    return { supplies: { ...spent, kits: spent.kits + 1 }, inventory }
  }

  const same = inventory.find((i) => i.name.trim().toLowerCase() === r.name.toLowerCase()
    && (r.kind === 'weapon' ? i.kind === 'arma' : i.kind === 'item'))
  if (same) {
    const cap = r.kind === 'weapon' ? throwableCap(backpack) : 99
    if (same.qty >= cap) return { error: `Só cabem ${cap} de ${r.name} na mochila.` }
    return { supplies: spent, inventory: inventory.map((i) => (i.id === same.id ? { ...i, qty: i.qty + 1 } : i)) }
  }
  if (inventory.length >= INVENTORY_MAX) return { error: 'O inventário está cheio.' }
  const made: TdaInventoryItem = r.kind === 'weapon'
    ? { id: newId(), name: r.name, qty: 1, kind: 'arma', level: r.level, wtype: 'consumivel', ammo: 0, dur: 0, up: 0 }
    : { id: newId(), name: r.name, qty: 1, kind: 'item', level: 0 }
  return { supplies: spent, inventory: [...inventory, made] }
}
