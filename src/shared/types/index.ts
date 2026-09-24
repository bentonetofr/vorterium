// ────────────────────────────────────────────────────────
// Tipos do modelo de dados — Vorterium
// ────────────────────────────────────────────────────────

import type { CampaignSystem } from '../constants/systems'
export type { CampaignSystem }

export interface Profile {
  id: string
  display_name: string
  email: string
  avatar_url: string | null
  main_provider: string | null
  theme_preference: 'dark' | 'light'
  activity_seen_at: string
  created_at: string
  updated_at: string
}

/** Subconjunto público de profile — exibido em listagens de membros */
export interface ProfilePublic {
  id: string
  display_name: string
  email: string
  avatar_url: string | null
}

export interface Campaign {
  id: string
  name: string
  system: CampaignSystem
  master_id: string
  description: string | null
  cover_url: string | null
  status: 'active' | 'paused' | 'archived'
  created_at: string
  updated_at: string
}

export interface CampaignMember {
  id: string
  campaign_id: string
  user_id: string
  role: 'master' | 'player'
  created_at: string
}

/** Membro enriquecido com dados públicos do perfil */
export interface CampaignMemberWithProfile {
  id: string
  campaign_id: string
  user_id: string
  role: 'master' | 'player'
  created_at: string
  profile: ProfilePublic
}

/** Campanha enriquecida com o papel do usuário autenticado */
export interface CampaignWithRole extends Campaign {
  role: 'master' | 'player'
}

export interface CharacterSheet {
  id: string
  campaign_id: string
  user_id: string
  character_name: string | null
  archetype: string | null
  level: number
  hp_current: number
  hp_max: number
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  notes: string | null
  created_at: string
  updated_at: string
}

/** Ficha enriquecida com dados do dono — para listagem pelo mestre.
 *  `profile` é null quando o dono não é mais membro da campanha (a RLS de
 *  profiles exige co-membro atual — a ficha em si continua existindo). */
export interface SheetWithProfile extends CharacterSheet {
  profile: ProfilePublic | null
}

export type DieType  = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'
export type RollMode = 'sum' | 'keep_highest' | 'keep_lowest'

export type RollBreakdownItem =
  | {
      type: 'sum'
      notation: string
      quantity: number
      sides: number
      results: number[]
      subtotal: number
    }
  | {
      type: 'keep_highest'
      notation: string
      quantity: number
      sides: number
      results: number[]
      kept: number
      subtotal: number
    }
  | {
      type: 'keep_lowest'
      notation: string
      quantity: number
      sides: number
      results: number[]
      kept: number
      subtotal: number
    }
  | {
      type: 'modifier'
      value: number
    }

export interface DiceRoll {
  id: string
  campaign_id: string
  user_id: string
  die_type: DieType
  result: number
  quantity: number
  modifier: number
  individual_results: number[] | null
  total_result: number | null
  roll_mode: RollMode
  kept_result: number | null
  formula: string | null
  roll_breakdown: RollBreakdownItem[] | null
  is_private: boolean
  created_at: string
}

// ── Utilitário genérico para estado assíncrono ──────────
export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string }

/** Rolagem enriquecida com dados públicos do autor — para exibição no histórico.
 *  `profile` é null quando o autor não é mais membro da campanha. */
export interface DiceRollWithProfile extends DiceRoll {
  profile: Pick<ProfilePublic, 'id' | 'display_name'> | null
}

/** Uma sessão (encontro) da campanha — criada e editada apenas pelo mestre. */
export interface CampaignSession {
  id:           string
  campaign_id:  string
  title:        string
  session_date: string | null  // formato 'YYYY-MM-DD' ou null
  summary:      string | null
  status:       'planned' | 'completed' | 'canceled'
  created_by:   string
  created_at:   string
  updated_at:   string
}

/** Evento de atividade registrado em uma campanha. */
export interface CampaignActivity {
  id:          string
  campaign_id: string
  actor_id:    string | null
  type:        string
  message:     string
  metadata:    Record<string, unknown> | null
  created_at:  string
}

/** Ficha do sistema Altherium — base (identidade, atributos, recursos, dinheiro, DB). */
export interface AltheriumSheet {
  id:                 string
  campaign_id:        string
  user_id:            string
  character_name:     string | null
  portrait_url:       string | null
  level:              number
  raiz:               'berserker' | 'runaskin' | 'pilar' | null
  genesis:            string | null
  attr_furia:         number
  attr_destino:       number
  attr_espirito:      number
  attr_impulso:       number
  attr_estrategia:    number
  attr_runico:        number
  vitality_roll:      number | null
  vitality_current:   number
  vitality_max:       number
  equilibrio_roll:    number | null
  equilibrio_current: number
  equilibrio_max:     number
  fv_roll:            number | null
  fv_current:         number
  pr_roll:            number | null
  pr_current:         number
  cards_current:      number
  hacksilvers:        number
  db_pernas:          number
  db_bracos:          number
  db_tronco:          number
  db_cabeca:          number
  dano_pernas:        number
  dano_bracos:        number
  dano_tronco:        number
  dano_cabeca:        number
  /** Ids dos triunfos escolhidos (só Berserker — catálogo em altheriumTriumphs.ts). */
  berserker_triumphs: string[]
  notes:              string | null
  created_at:         string
  updated_at:         string
}

/** Pontos de um domínio numa ficha Altherium (0 a 2). */
export interface AltheriumDomainPoints {
  id:       string
  sheet_id: string
  domain:   string
  points:   number
}

/** Item do inventário de uma ficha Altherium — referencia o catálogo fixo
 *  (altheriumItems.ts) pelo item_id. equipped_zone só é usado por
 *  armadura ('escolhida'); escudo cobre as 4 zonas de uma vez e usa null. */
export interface AltheriumInventoryItem {
  id:            string
  sheet_id:      string
  item_type:     'arma' | 'armadura' | 'escudo' | 'consumivel' | 'utilitario'
  item_id:       string
  quantity:      number
  equipped:      boolean
  equipped_zone: 'db_cabeca' | 'db_bracos' | 'db_tronco' | 'db_pernas' | null
  created_at:    string
}

/** Ficha Altherium enriquecida com o perfil do dono — usada na visão do mestre.
 *  `profile` é null quando o dono não é mais membro da campanha. */
export interface AltheriumSheetWithProfile extends AltheriumSheet {
  profile: Pick<ProfilePublic, 'id' | 'display_name' | 'avatar_url'> | null
}

/** Participante do combate atual — membro (user_id preenchido) ou NPC/monstro (user_id nulo). */
export interface InitiativeParticipant {
  id:               string
  campaign_id:      string
  user_id:          string | null
  name:             string
  initiative_value: number | null
  created_at:       string
}

/** Rodada atual e de quem é a vez, uma linha por campanha. */
export interface InitiativeState {
  campaign_id:                 string
  round_number:                number
  current_turn_participant_id: string | null
}

/** Registro de presença de um membro na campanha (atualizado via heartbeat). */
export interface CampaignPresenceRecord {
  campaign_id:  string
  user_id:      string
  last_seen_at: string
}

/** Nota compartilhada de uma campanha. */
export interface CampaignNote {
  id:          string
  campaign_id: string
  author_id:   string
  title:       string
  content:     string
  created_at:  string
  updated_at:  string
  author?: {
    id:           string
    display_name: string
    email:        string
  }
}

export interface CampaignInvite {
  id: string
  campaign_id: string
  token: string
  created_by: string
  is_active: boolean
  expires_at: string | null
  created_at: string
}

// ── Ficha D&D 5e ────────────────────────────────────────

export interface DndCharacterSheet {
  // Estruturais
  id:          string
  campaign_id: string
  user_id:     string
  // Personagem
  character_name:     string | null
  player_name:        string | null
  class_name:         string | null
  subclass:           string | null
  background:         string | null
  race:               string | null
  alignment:          string | null
  // Progressão
  level:              number
  experience:         number
  inspiration:        boolean
  // Combate
  armor_class:        number
  initiative_bonus:   number
  speed:              number
  proficiency_bonus:  number
  // Pontos de vida
  hp_current:         number
  hp_max:             number
  hp_temp:            number
  // Atributos (1–30)
  strength:           number
  dexterity:          number
  constitution:       number
  intelligence:       number
  wisdom:             number
  charisma:           number
  // Proficiências em salvaguardas
  strength_save_proficient:     boolean
  dexterity_save_proficient:    boolean
  constitution_save_proficient: boolean
  intelligence_save_proficient: boolean
  wisdom_save_proficient:       boolean
  charisma_save_proficient:     boolean
  // Salvaguardas mortais
  death_save_successes: number
  death_save_failures:  number
  // Conjuração
  spellcasting_ability: string | null
  spell_save_dc:        number | null
  spell_attack_bonus:   number | null
  // Narrativa
  notes:              string | null
  backstory:          string | null
  personality_traits: string | null
  ideals:             string | null
  bonds:              string | null
  flaws:              string | null
  // Regras selecionadas
  ruleset:            'dnd5e_2014'
  race_key:           string | null
  subrace_key:        string | null
  class_key:          string | null
  subclass_key:       string | null
  background_key:     string | null
  // Timestamps
  created_at: string
  updated_at: string
}

/** Campos atualizáveis da ficha D&D 5e (sem estruturais). */
export type DndCharacterSheetUpdateInput = Partial<
  Omit<DndCharacterSheet, 'id' | 'campaign_id' | 'user_id' | 'created_at' | 'updated_at'>
>

export const DND_SKILLS = [
  { key: 'acrobatics', label: 'Acrobacia', ability: 'dexterity' },
  { key: 'animal_handling', label: 'Adestrar Animais', ability: 'wisdom' },
  { key: 'arcana', label: 'Arcanismo', ability: 'intelligence' },
  { key: 'athletics', label: 'Atletismo', ability: 'strength' },
  { key: 'deception', label: 'Enganação', ability: 'charisma' },
  { key: 'history', label: 'História', ability: 'intelligence' },
  { key: 'insight', label: 'Intuição', ability: 'wisdom' },
  { key: 'intimidation', label: 'Intimidação', ability: 'charisma' },
  { key: 'investigation', label: 'Investigação', ability: 'intelligence' },
  { key: 'medicine', label: 'Medicina', ability: 'wisdom' },
  { key: 'nature', label: 'Natureza', ability: 'intelligence' },
  { key: 'perception', label: 'Percepção', ability: 'wisdom' },
  { key: 'performance', label: 'Atuação', ability: 'charisma' },
  { key: 'persuasion', label: 'Persuasão', ability: 'charisma' },
  { key: 'religion', label: 'Religião', ability: 'intelligence' },
  { key: 'sleight_of_hand', label: 'Prestidigitação', ability: 'dexterity' },
  { key: 'stealth', label: 'Furtividade', ability: 'dexterity' },
  { key: 'survival', label: 'Sobrevivência', ability: 'wisdom' },
] as const

export type DndSkillKey = typeof DND_SKILLS[number]['key']

export interface DndCharacterSkill {
  id: string
  sheet_id: string
  skill_key: DndSkillKey
  proficient: boolean
  expertise: boolean
}

export interface DndCharacterAttack {
  id: string
  sheet_id: string
  name: string
  attack_bonus: string
  damage: string
  damage_type: string
  notes: string
  catalog_entry_key: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type DndCharacterAttackInput = Omit<
  DndCharacterAttack,
  'id' | 'sheet_id' | 'created_at' | 'updated_at'
>

export interface DndCharacterInventoryItem {
  id: string
  sheet_id: string
  name: string
  quantity: number
  weight: number
  equipped: boolean
  notes: string
  catalog_entry_key: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type DndCharacterInventoryInput = Omit<
  DndCharacterInventoryItem,
  'id' | 'sheet_id' | 'created_at' | 'updated_at'
>

export interface DndCharacterSpell {
  id: string
  sheet_id: string
  name: string
  spell_level: number
  school: string
  casting_time: string
  spell_range: string
  duration: string
  concentration: boolean
  ritual: boolean
  prepared: boolean
  description: string
  sort_order: number
  created_at: string
  updated_at: string
}

export type DndCharacterSpellInput = Omit<
  DndCharacterSpell,
  'id' | 'sheet_id' | 'created_at' | 'updated_at'
>

export interface DndSheetDetails {
  skills: DndCharacterSkill[]
  attacks: DndCharacterAttack[]
  inventory: DndCharacterInventoryItem[]
  spells: DndCharacterSpell[]
  overrides: DndCharacterOverride[]
}

export type DndDerivedField =
  | 'proficiency_bonus'
  | 'initiative_bonus'
  | 'armor_class'
  | 'speed'
  | 'hp_max'
  | 'spell_save_dc'
  | 'spell_attack_bonus'

export interface DndCharacterOverride {
  id: string
  sheet_id: string
  field_key: DndDerivedField
  manual_value: string
  reason: string
  updated_at: string
}

export interface DndRuleCatalogEntry {
  id: string
  ruleset: 'dnd5e_2014'
  category: 'race' | 'subrace' | 'class' | 'subclass' | 'background' | 'feat' | 'weapon' | 'armor' | 'item' | 'tool' | 'spell'
  entry_key: string
  name: string
  description: string
  level: number | null
  school: string | null
  ability: string | null
  sort_order: number
  metadata: Record<string, unknown>
  is_active: boolean
}

export interface DndCharacterProficiency {
  id: string
  sheet_id: string
  category: 'armor' | 'weapon' | 'tool' | 'language'
  entry_key: string
  label: string
  source: string
  created_at: string
}

/** Dados públicos de um convite — retornados sem autenticação pela RPC get_campaign_invite_public */
export interface CampaignInvitePublic {
  campaign_id: string
  campaign_name: string
  campaign_system: CampaignSystem
  is_active: boolean
  expires_at: string | null
}
