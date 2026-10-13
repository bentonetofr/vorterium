import { getAbilityModifier, getProficiencyBonus } from '../utils/dndCalculations'
import type { AbilityKey, ProficiencyLevel, SkillKey } from './types'

// ────────────────────────────────────────────────────────
// Atributos e perícias (5e 2014)
// ────────────────────────────────────────────────────────

export const MAX_CHARACTER_LEVEL = 20

export const ABILITIES: { key: AbilityKey; label: string; short: string }[] = [
  { key: 'strength',     label: 'Força',        short: 'FOR' },
  { key: 'dexterity',    label: 'Destreza',     short: 'DES' },
  { key: 'constitution', label: 'Constituição', short: 'CON' },
  { key: 'intelligence', label: 'Inteligência', short: 'INT' },
  { key: 'wisdom',       label: 'Sabedoria',    short: 'SAB' },
  { key: 'charisma',     label: 'Carisma',      short: 'CAR' },
]

export const SKILLS: { key: SkillKey; label: string; ability: AbilityKey }[] = [
  { key: 'acrobatics',      label: 'Acrobacia',        ability: 'dexterity' },
  { key: 'animal_handling', label: 'Adestrar Animais', ability: 'wisdom' },
  { key: 'arcana',          label: 'Arcanismo',        ability: 'intelligence' },
  { key: 'athletics',       label: 'Atletismo',        ability: 'strength' },
  { key: 'performance',     label: 'Atuação',          ability: 'charisma' },
  { key: 'deception',       label: 'Enganação',        ability: 'charisma' },
  { key: 'stealth',         label: 'Furtividade',      ability: 'dexterity' },
  { key: 'history',         label: 'História',         ability: 'intelligence' },
  { key: 'intimidation',    label: 'Intimidação',      ability: 'charisma' },
  { key: 'insight',         label: 'Intuição',         ability: 'wisdom' },
  { key: 'investigation',   label: 'Investigação',     ability: 'intelligence' },
  { key: 'medicine',        label: 'Medicina',         ability: 'wisdom' },
  { key: 'nature',          label: 'Natureza',         ability: 'intelligence' },
  { key: 'perception',      label: 'Percepção',        ability: 'wisdom' },
  { key: 'persuasion',      label: 'Persuasão',        ability: 'charisma' },
  { key: 'sleight_of_hand', label: 'Prestidigitação',  ability: 'dexterity' },
  { key: 'religion',        label: 'Religião',         ability: 'intelligence' },
  { key: 'survival',        label: 'Sobrevivência',    ability: 'wisdom' },
]

export { getAbilityModifier, getProficiencyBonus }

/** Nível total (soma das classes) preso entre 1 e 20. */
export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1
  return Math.max(1, Math.min(MAX_CHARACTER_LEVEL, Math.floor(level)))
}

/** Bônus da perícia: modificador + proficiência conforme o nível (meia = para baixo; especialização = dobro). */
export function skillBonus(abilityMod: number, level: ProficiencyLevel, proficiencyBonus: number): number {
  switch (level) {
    case 'expertise':  return abilityMod + proficiencyBonus * 2
    case 'proficient': return abilityMod + proficiencyBonus
    case 'half':       return abilityMod + Math.floor(proficiencyBonus / 2)
    default:           return abilityMod
  }
}
