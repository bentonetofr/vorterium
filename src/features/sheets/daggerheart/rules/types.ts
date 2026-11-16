// ────────────────────────────────────────────────────────
// Tipos do motor de regras DaggerHeart (SRD 2.0).
// Sem React e sem Supabase: o motor só recebe dados e devolve números.
// ────────────────────────────────────────────────────────

export type DhTraitKey =
  | 'agility' | 'strength' | 'finesse'
  | 'instinct' | 'presence' | 'knowledge'

export type DhDomainKey =
  | 'arcana' | 'blade' | 'bone' | 'codex' | 'grace'
  | 'midnight' | 'sage' | 'splendor' | 'valor' | 'wanderer'

export type DhClassKey =
  | 'assassin' | 'bard' | 'brawler' | 'druid' | 'guardian'
  | 'ranger' | 'rogue' | 'seraph' | 'sorcerer' | 'warlock'
  | 'warrior' | 'witch' | 'wizard'

/** Resultado de uma rolagem de Duality Dice (2d12). */
export type DhRollOutcome =
  | 'crit'
  | 'success_hope'
  | 'success_fear'
  | 'fail_hope'
  | 'fail_fear'

// ── Entrada do motor de derivação ─────────────────────────

export interface DhDeriveInput {
  level:       number
  traits:      Record<DhTraitKey, number>
  proficiency: number
  armor: {
    base_major:  number
    base_severe: number
    score:       number
  }
  weapon?: {
    damage_die: number
    damage_mod: number
  }
}

// ── Saída do motor ────────────────────────────────────────

export interface DhThresholds {
  major:  number
  severe: number
}

export interface DhDamageRoll {
  dice_count: number
  die_type:   number
  modifier:   number
  /** Representação textual, ex: "2d8+1" */
  notation:   string
}

export interface DhDerived {
  thresholds:  DhThresholds
  damage_roll: DhDamageRoll | null
}

// ── Resultado de rolagem de dualidade ─────────────────────

export interface DhRollResult {
  hope_die:  number
  fear_die:  number
  trait_mod: number
  advantage: number  // +d6 adicionados (pode ser negativo para desvantagem)
  total:     number
  outcome:   DhRollOutcome
  /** true se o dado de Esperança foi maior (ou crítico). */
  with_hope: boolean
}

// ── Tipos de banco (espelham colunas do Supabase) ─────────

export interface DhCharacterSheet {
  id:          string
  campaign_id: string
  user_id:     string

  character_name:  string | null
  pronouns:        string | null
  class_key:       DhClassKey
  subclass_key:    string | null
  level:           number

  ancestry:    string | null
  community:   string | null

  trait_agility:   number
  trait_strength:  number
  trait_finesse:   number
  trait_instinct:  number
  trait_presence:  number
  trait_knowledge: number

  proficiency:    number
  spellcast_trait: DhTraitKey | null

  evasion:        number
  hp_current:     number
  hp_max:         number
  stress_current: number
  stress_max:     number
  hope:           number

  armor_name:          string | null
  armor_score:         number
  armor_score_current: number
  armor_base_major:    number
  armor_base_severe:   number

  gold_handfuls: number
  gold_bags:     number
  gold_chests:   number

  background_notes:  string | null
  connections_notes: string | null
  notes:             string | null

  created_at: string
  updated_at: string
}

export interface DhExperience {
  id:         string
  sheet_id:   string
  label:      string
  modifier:   number
  sort_order: number
}

export interface DhDomainCard {
  id:          string
  sheet_id:    string
  domain:      DhDomainKey
  card_name:   string
  card_level:  number
  is_equipped: boolean
  notes:       string | null
}

export interface DhWeapon {
  id:          string
  sheet_id:    string
  weapon_name: string
  trait_key:   DhTraitKey
  damage_die:  number
  damage_mod:  number
  is_primary:  boolean
  is_equipped: boolean
  notes:       string | null
}

export interface DhInventoryItem {
  id:         string
  sheet_id:   string
  item_name:  string
  quantity:   number
  notes:      string | null
  sort_order: number
}

// ── Tipos de input para escrita ────────────────────────────

export type DhSheetUpdateInput = Partial<Omit<
  DhCharacterSheet,
  'id' | 'campaign_id' | 'user_id' | 'created_at' | 'updated_at'
>>

export interface DhExperienceInput {
  label:      string
  modifier?:  number
  sort_order?: number
}

export interface DhDomainCardInput {
  domain:     DhDomainKey
  card_name:  string
  card_level?: number
  is_equipped?: boolean
  notes?:     string
}

export interface DhWeaponInput {
  weapon_name: string
  trait_key:   DhTraitKey
  damage_die:  number
  damage_mod?: number
  is_primary?: boolean
  is_equipped?: boolean
  notes?:      string
}

export interface DhInventoryItemInput {
  item_name:  string
  quantity?:  number
  notes?:     string
  sort_order?: number
}

// ── Ficha completa (sheet + filhas) ───────────────────────

export interface DhFullSheet {
  sheet:       DhCharacterSheet
  experiences: DhExperience[]
  cards:       DhDomainCard[]
  weapons:     DhWeapon[]
  inventory:   DhInventoryItem[]
}
