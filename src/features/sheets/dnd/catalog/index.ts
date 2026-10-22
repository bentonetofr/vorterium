import type { ClassLevel } from '../rules/types'
import { CLASSES } from './classes'
import { CONDITIONS, EXHAUSTION } from './conditions.data'
import { ARMORS, GEAR, SHIELD, TOOLS, WEAPONS } from './equipment.data'
import { BACKGROUNDS, FIGHTING_STYLES, GLOSSARY } from './misc.data'
import { DRAGONBORN_ANCESTRIES, RACES } from './races.data'
import type {
  ArmorEntry, BackgroundDef, ClassDef, ConditionDef, FightingStyleDef, GearEntry, RaceDef, SubclassDef, SubraceDef,
  ToolEntry, WeaponEntry,
} from './types'

// ────────────────────────────────────────────────────────
// Catálogo de D&D 5e 2014 (SRD 5.1): ponto único de consulta. Sem React e
// sem Supabase. Homebrew das campanhas entra depois, por cima destas
// consultas (Marco 7).
// ────────────────────────────────────────────────────────

export {
  ARMORS, BACKGROUNDS, CLASSES, CONDITIONS, DRAGONBORN_ANCESTRIES, EXHAUSTION, FIGHTING_STYLES, GEAR, GLOSSARY, RACES, SHIELD,
  TOOLS, WEAPONS,
}
export type * from './types'

const byKey = <T extends { key: string }>(list: readonly T[]) => new Map(list.map((e) => [e.key, e]))

const classMap      = byKey(CLASSES)
const raceMap       = byKey(RACES)
const backgroundMap = byKey(BACKGROUNDS)
const weaponMap     = byKey(WEAPONS)
const armorMap      = byKey(ARMORS)
const toolMap       = byKey(TOOLS)
const gearMap       = byKey(GEAR)
const conditionMap  = byKey(CONDITIONS)
const styleMap      = byKey(FIGHTING_STYLES)

export const getClass       = (key: string): ClassDef | undefined => classMap.get(key)
export const getRace        = (key: string): RaceDef | undefined => raceMap.get(key)
export const getBackground  = (key: string): BackgroundDef | undefined => backgroundMap.get(key)
export const getWeapon      = (key: string): WeaponEntry | undefined => weaponMap.get(key)
export const getArmor       = (key: string): ArmorEntry | undefined => armorMap.get(key)
export const getTool        = (key: string): ToolEntry | undefined => toolMap.get(key)
export const getGear        = (key: string): GearEntry | undefined => gearMap.get(key)
export const getCondition   = (key: string): ConditionDef | undefined => conditionMap.get(key)
export const getFightingStyle = (key: string): FightingStyleDef | undefined => styleMap.get(key)

export function getSubclass(classKey: string, subclassKey: string): SubclassDef | undefined {
  return getClass(classKey)?.subclasses.find((s) => s.key === subclassKey)
}

export function getSubrace(raceKey: string, subraceKey: string): SubraceDef | undefined {
  return getRace(raceKey)?.subraces.find((s) => s.key === subraceKey)
}

/**
 * Liga as classes da ficha ao motor de regras: devolve cada nível de classe com o
 * perfil de conjuração do catálogo. Classe desconhecida (homebrew) passa sem perfil.
 */
export function toClassLevels(rows: { classKey: string; level: number; subclassKey?: string | null }[]): ClassLevel[] {
  return rows.map(({ classKey, level, subclassKey }) => {
    const def = classMap.get(classKey)
    const spellcasting = def?.spellcasting ?? def?.subclasses.find((s) => s.key === subclassKey)?.spellcasting
    return spellcasting ? { classKey, level, spellcasting } : { classKey, level }
  })
}

/** Classe cuja lista de magias vale para a classe da ficha (o Cavaleiro Místico e o Trapaceiro Arcano usam a do Mago). */
export function spellListClass(classKey: string, subclassKey?: string | null): string {
  const def = classMap.get(classKey)
  if (def?.spellcasting) return classKey
  return def?.subclasses.find((s) => s.key === subclassKey)?.spellList ?? classKey
}

/** Dado de vida de uma classe (d6, d8, d10 ou d12), ou null se a classe não é do catálogo. */
export function hitDieOf(classKey: string): number | null {
  return classMap.get(classKey)?.hitDie ?? null
}

/** Bônus de PV por nível que a raça e a sub-raça dão (Anão da Colina: +1). */
export function raceHpBonusPerLevel(raceKey: string, subraceKey?: string | null): number {
  return (subraceKey ? getSubrace(raceKey, subraceKey)?.hpBonusPerLevel : 0) ?? 0
}

/** Busca simples por nome (português ou original) em todo o catálogo, sem acento e sem diferenciar maiúsculas. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export interface SearchHit { category: 'class' | 'race' | 'background' | 'weapon' | 'armor' | 'tool' | 'gear' | 'condition'; key: string; name: string }

export function searchCatalog(query: string, limit = 20): SearchHit[] {
  const q = fold(query.trim())
  if (!q) return []
  const hits: SearchHit[] = []
  const add = (category: SearchHit['category'], list: readonly { key: string; name: string; original?: string }[]) => {
    for (const e of list) {
      if (hits.length >= limit) return
      if (fold(e.name).includes(q) || (e.original && fold(e.original).includes(q))) hits.push({ category, key: e.key, name: e.name })
    }
  }
  add('class', CLASSES)
  add('race', RACES)
  add('background', BACKGROUNDS)
  add('weapon', WEAPONS)
  add('armor', ARMORS)
  add('tool', TOOLS)
  add('gear', GEAR)
  add('condition', CONDITIONS)
  return hits
}
