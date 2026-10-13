// ────────────────────────────────────────────────────────
// Tipos do motor de regras de D&D 5e (2014). Sem React e sem Supabase:
// o motor só recebe dados e devolve números.
// ────────────────────────────────────────────────────────

export type AbilityKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'

export type SkillKey =
  | 'acrobatics' | 'animal_handling' | 'arcana' | 'athletics' | 'deception' | 'history'
  | 'insight' | 'intimidation' | 'investigation' | 'medicine' | 'nature' | 'perception'
  | 'performance' | 'persuasion' | 'religion' | 'sleight_of_hand' | 'stealth' | 'survival'

/**
 * Nível de proficiência numa perícia. `half` é a Versatilidade do Bardo
 * (metade do bônus, arredondada para baixo); `expertise` dobra o bônus.
 */
export type ProficiencyLevel = 'none' | 'half' | 'proficient' | 'expertise'

/** Campos que a ficha pode sobrescrever à mão (AUTO/MANUAL). */
export type OverridableField = 'proficiency_bonus' | 'initiative_bonus'

export interface ClassLevel {
  classKey: string
  level:    number
}

export interface DerivedInput {
  abilities:         Record<AbilityKey, number>
  /** Uma linha por classe; o nível total é a soma (multiclasse). */
  classes:           ClassLevel[]
  skillProficiency?: Partial<Record<SkillKey, ProficiencyLevel>>
  saveProficiency?:  Partial<Record<AbilityKey, boolean>>
  /** Valores manuais que vencem o cálculo oficial. */
  overrides?:        Partial<Record<OverridableField, number>>
}

export interface SaveDerived {
  ability:    AbilityKey
  proficient: boolean
  bonus:      number
}

export interface SkillDerived {
  ability: AbilityKey
  level:   ProficiencyLevel
  bonus:   number
}

export interface Derived {
  totalLevel:        number
  proficiencyBonus:  number
  abilityMods:       Record<AbilityKey, number>
  saves:             Record<AbilityKey, SaveDerived>
  skills:            Record<SkillKey, SkillDerived>
  initiative:        number
  passivePerception: number
  /** Quais campos estão com valor manual (a tela mostra o selo MANUAL). */
  overridden:        OverridableField[]
}
