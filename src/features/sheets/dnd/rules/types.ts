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
export type OverridableField = 'proficiency_bonus' | 'initiative_bonus' | 'armor_class' | 'hp_max'

export type ArmorCategory = 'light' | 'medium' | 'heavy'

/** Armadura vestida (os números vêm do catálogo de equipamento). */
export interface ArmorInput {
  category: ArmorCategory
  baseAc:   number
}

/** Um nível ganho, na ordem da subida: dado de vida da classe e, se rolado, o valor tirado. */
export interface HpLevel {
  hitDie: number
  roll?:  number
}

/** Dados de combate da ficha (todos opcionais: sem eles CA = 10 + Des e PV = null). */
export interface CombatInput {
  armor?:         ArmorInput | null
  shield?:        boolean
  /** Bônus fixos de CA (anel de proteção, estilo de luta Defesa). */
  acBonus?:       number
  /** Limite de Des da armadura média (3 com Mestre em Armadura Média). */
  mediumDexCap?:  number
  /** Níveis ganhos, em ordem; o primeiro usa o dado cheio. */
  hpLevels?:      HpLevel[]
  /** PV extra por nível (Anão da Colina +1, Robusto +2). */
  hpBonusPerLevel?: number
}

/** Como a classe conjura (dados vêm do catálogo; ver rules/spellcasting.ts). */
export interface SpellcastingProfile {
  ability: AbilityKey
  /** full: tabela própria de conjurador; half: Paladino e Patrulheiro; pact: Bruxo. */
  kind:    'full' | 'half' | 'pact'
  /**
   * known: aprende magias e só troca ao subir de nível (Bardo, Patrulheiro, Feiticeiro, Bruxo);
   * prepared: prepara nível + modificador (Clérigo, Druida);
   * prepared-half: prepara metade do nível + modificador (Paladino);
   * spellbook: como prepared, mas escolhe do grimório (Mago).
   */
  learning: 'known' | 'prepared' | 'prepared-half' | 'spellbook'
  /** Truques conhecidos por nível de classe (20 entradas, nível 1 a 20). */
  cantripsKnown: readonly number[]
  /** Magias conhecidas por nível de classe (só learning = known). */
  spellsKnown?:  readonly number[]
}

export interface ClassLevel {
  classKey: string
  level:    number
  spellcasting?: SpellcastingProfile
}

export interface DerivedInput {
  abilities:         Record<AbilityKey, number>
  /** Uma linha por classe; o nível total é a soma (multiclasse). */
  classes:           ClassLevel[]
  skillProficiency?: Partial<Record<SkillKey, ProficiencyLevel>>
  saveProficiency?:  Partial<Record<AbilityKey, boolean>>
  combat?:           CombatInput
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

export interface ClassSpellcasting {
  classKey:      string
  ability:       AbilityKey
  saveDc:        number
  attackBonus:   number
  cantripsKnown: number
  /** Magias conhecidas (learning = known) ou preparadas (demais). */
  spellsKnownOrPrepared: number
  /** Só Mago: tamanho do grimório (6 no nível 1, +2 por nível). */
  spellbookSize: number | null
}

export interface SpellcastingDerived {
  /** Espaços de magia 1º ao 9º (índice 0 = 1º nível). Não inclui a Magia de Pacto. */
  slots:   number[]
  /** Magia de Pacto do Bruxo: espaços e o nível deles (separados dos demais). */
  pact:    { slots: number; level: number } | null
  classes: ClassSpellcasting[]
}

export interface Derived {
  totalLevel:        number
  proficiencyBonus:  number
  abilityMods:       Record<AbilityKey, number>
  saves:             Record<AbilityKey, SaveDerived>
  skills:            Record<SkillKey, SkillDerived>
  initiative:        number
  passivePerception: number
  armorClass:        number
  /** null enquanto a ficha não tem níveis com dado de vida. */
  hpMax:             number | null
  /** Dados de vida por tipo (d6, d8, d10, d12). */
  hitDice:           Record<number, number>
  /** null se nenhuma classe da ficha conjura. */
  spellcasting:      SpellcastingDerived | null
  /** Quais campos estão com valor manual (a tela mostra o selo MANUAL). */
  overridden:        OverridableField[]
}
