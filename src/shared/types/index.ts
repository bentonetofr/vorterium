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
  /** Ficha de NPC do mestre (migration 20240189000000). */
  is_npc?: boolean
  /** O mestre mostrou o NPC pros jogadores (eles só leem). */
  npc_visible?: boolean
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
export type RollMode = 'sum' | 'keep_highest' | 'keep_lowest' | 'evens'

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
      /** Teste de pares (Terra Devastada): conta os pares; todo 6 rola de novo. */
      type: 'evens'
      notation: string
      quantity: number
      sides: 6
      results: number[]
      /** Rolagens extras do Golpe de Sorte, em ordem. */
      bonus: number[]
      /** Quantidade de pares (desempenho). */
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
  /** d10 da criação — não usado mais pela interface (máximo virou fv_max). */
  fv_roll:            number | null
  fv_current:         number
  fv_max:             number
  /** d10 da criação — não usado mais pela interface (máximo virou pr_max). */
  pr_roll:            number | null
  pr_current:         number
  pr_max:             number
  cards_current:      number
  hacksilvers:        number
  /** Movimento por turno escolhido pelo jogador, em metros (null = automático, pelo Impulso). */
  movement_override?: number | null
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
  /** Trilha do Runaskin — define os 3 triunfos iniciais. */
  runaskin_trail:     'regente' | 'sentinela' | 'carniceiro' | null
  /** Triunfos usados na cena atual (limitado pelo NR, zera em "Nova cena"). */
  runaskin_scene_uses: number
  /** Runaskin: ajustes da ficha nos 3 triunfos iniciais da trilha, por id do triunfo. */
  runaskin_trail_overrides: Record<string, RunaskinTriumphOverride>
  /** Pilar: vira cartas na tela ('virtual') ou usa baralho de verdade ('fisico'). */
  pilar_card_mode:    'virtual' | 'fisico'
  /** Pilar: o que resta do baralho virtual embaralhado (null = baralho novo). */
  pilar_deck:         string[] | null
  /** Ids dos últimos triunfos usados (mais recente primeiro) — seção "Recentes" das três raízes. */
  recent_triumphs:    string[]
  /** Habilidades de gênesis que o mestre deu (texto livre). */
  genesis_abilities:  AltheriumGenesisAbility[]
  /** Inspirações Skald ganhas na história (não há no livro; o jogador cria). */
  skald_inspirations: AltheriumSkaldInspiration[]
  notes:              string | null
  /** Ficha de NPC do mestre (migration 20240189000000). */
  is_npc?: boolean
  /** O mestre mostrou o NPC pros jogadores (eles só leem). */
  npc_visible?: boolean
  created_at:         string
  updated_at:         string
}

/** Habilidade de gênesis dada pelo mestre (ex.: "Sem passado"). */
export interface AltheriumGenesisAbility {
  id:          string
  name:        string
  description: string
}

/** Inspiração Skald — criada pelo jogador, no formato de um triunfo. */
export interface AltheriumSkaldInspiration {
  id:          string
  name:        string
  description: string
  /** Custo em texto livre ("1 FV", "uma vez por sessão"…); vazio = sem custo. */
  cost:        string
  /** Mesmos ids de TriumphAction (altheriumTriumphs.ts). */
  action:      'padrao' | 'bonus' | 'livre' | 'reacao' | null
  range:       string | null
  test:        string | null
}

/** Versão editada na ficha de um triunfo inicial de trilha do Runaskin. */
export interface RunaskinTriumphOverride {
  name:        string
  description: string
  /** Custo em PR. */
  cost:        number
  test:        string | null
  /** Mesmos ids de TriumphAction (altheriumTriumphs.ts). */
  action:      'padrao' | 'bonus' | 'livre' | 'reacao' | null
  range:       string | null
  /** Foto escolhida na ficha (no lugar da runa da trilha). Ausente = sem foto. */
  image_url?:  string | null
}

/** Pontos de um domínio numa ficha Altherium (-1 a 2; -1 = desvantagem). */
export interface AltheriumDomainPoints {
  id:        string
  sheet_id:  string
  domain:    string
  points:    number
  /** Caixinha "+": um dado a mais no teste do domínio. */
  bonus_die?: boolean
  /** O jogador escolheu um número/"+": sem a desvantagem automática do atributo em 0. */
  no_auto_disadvantage?: boolean
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
  /** Só nos itens personalizados (item_id "custom:..."); null nos do catálogo. */
  custom_name:   string | null
  custom_detail: string | null
  /** DB da peça personalizada (armadura/escudo) — somado ao equipar. */
  custom_db:     number | null
  /** Arma personalizada — mesmos valores de altheriumItems.ts (DamageType etc.). */
  custom_damage_dice: string | null
  custom_damage_type: 'corte' | 'impacto' | 'perfurante' | null
  custom_attribute:   'furia' | 'impulso' | 'furia_impulso' | null
  custom_range:       'toque' | 'toque_curto' | 'curto' | 'curto_medio' | 'medio' | 'longo' | null
  created_at:    string
}

/** Triunfo que o Runaskin descobriu por uma runa — criado pelo jogador ou
 *  pelo mestre (os 3 iniciais da trilha vêm do catálogo fixo). */
export interface AltheriumRune {
  id:          string
  sheet_id:    string
  name:        string
  description: string
  pr_cost:     number
  test:        string | null
  /** Tipo de ação — mesmos ids de TriumphAction (altheriumTriumphs.ts). */
  action:      'padrao' | 'bonus' | 'livre' | 'reacao' | null
  /** Distância/alcance (Toque, Curto, ...). */
  range:       string | null
  image_url:   string | null
  created_at:  string
}

/** Ficha Altherium enriquecida com o perfil do dono — usada na visão do mestre.
 *  `profile` é null quando o dono não é mais membro da campanha. */
export interface AltheriumSheetWithProfile extends AltheriumSheet {
  profile: Pick<ProfilePublic, 'id' | 'display_name' | 'avatar_url'> | null
}

// ── Terra Devastada ─────────────────────────────────────

/** Característica fixa. `tag` marca as que mexem no Horror inicial. */
export interface TdTrait {
  id:   string
  name: string
  tag:  'motiva' | 'desmotiva' | null
}

export type TdConditionDuration = 'curta' | 'media' | 'longa' | 'indeterminada'

export interface TdCondition {
  id:       string
  name:     string
  duration: TdConditionDuration
}

export interface TdTrunfo {
  id:          string
  name:        string
  description: string
}

export interface TdInventoryItem {
  id:    string
  name:  string
  qty:   number
  /** Arma (letalidade) ou proteção; `level` é o bônus em dados (0 a 3). */
  kind:  'item' | 'arma' | 'protecao'
  level: number
}

export interface TdSheet {
  id:             string
  campaign_id:    string
  user_id:        string
  character_name: string | null
  concept:        string | null
  description:    string | null
  background:     string | null
  traits:         TdTrait[]
  conditions:     TdCondition[]
  trunfos:        TdTrunfo[]
  inventory:      TdInventoryItem[]
  horror:         number
  conviction:     number
  notes:          string | null
  /** Ficha de NPC do mestre (migration 20240189000000). */
  is_npc?: boolean
  /** O mestre mostrou o NPC pros jogadores (eles só leem). */
  npc_visible?: boolean
  created_at:     string
  updated_at:     string
}

/** Ficha Terra Devastada com o perfil do dono — visão do mestre. */
export interface TdSheetWithProfile extends TdSheet {
  profile: Pick<ProfilePublic, 'id' | 'display_name' | 'avatar_url'> | null
}

// ── Terra Devastada Adaptada (inspirada em The Last of Us) ─────────────────────────────────────

/** Característica fixa. `tag` marca as que mexem no Horror inicial. */
export interface TdaTrait {
  id:   string
  name: string
  tag:  'motiva' | 'desmotiva' | null
}

export type TdaConditionDuration = 'curta' | 'media' | 'longa' | 'indeterminada'

export interface TdaCondition {
  id:       string
  name:     string
  duration: TdaConditionDuration
}

export interface TdaTrunfo {
  id:          string
  name:        string
  description: string
}

export interface TdaInventoryItem {
  id:    string
  name:  string
  qty:   number
  /** Arma (letalidade) ou proteção; `level` é o bônus em dados (0 a 3). */
  kind:  'item' | 'arma' | 'protecao'
  level: number
}

export interface TdaSheet {
  id:             string
  campaign_id:    string
  user_id:        string
  character_name: string | null
  concept:        string | null
  description:    string | null
  background:     string | null
  traits:         TdaTrait[]
  conditions:     TdaCondition[]
  trunfos:        TdaTrunfo[]
  inventory:      TdaInventoryItem[]
  /** Vida: 0 (caído) a 6. */
  health:         number
  horror:         number
  conviction:     number
  notes:          string | null
  /** Ficha de NPC do mestre. */
  is_npc?: boolean
  /** O mestre mostrou o NPC pros jogadores (eles só leem). */
  npc_visible?: boolean
  created_at:     string
  updated_at:     string
}

/** Criatura do bestiário da campanha (Terra Devastada Adaptada, tabela tda_creatures). */
export interface TdaCreature {
  id:          string
  campaign_id: string
  name:        string
  kind:        'infectado' | 'humano' | 'animal' | 'outro'
  /** Dano por golpe (1 a 6). */
  damage:      number
  /** Resistência: dano que aguenta (1 a 12). */
  toughness:   number
  /** Meta pra acertá-la (1 a 6). */
  defense:     number
  /** Meta pra esquivar dela (1 a 6). */
  ferocity:    number
  notes:       string | null
  created_at:  string
  updated_at:  string
}

/** Ficha Terra Devastada Adaptada com o perfil do dono — visão do mestre. */
export interface TdaSheetWithProfile extends TdaSheet {
  profile: Pick<ProfilePublic, 'id' | 'display_name' | 'avatar_url'> | null
}

/** Especialização de uma perícia (Vampiro). */
export interface VtmSpecialty {
  id:    string
  skill: string
  name:  string
}

/** Ficha de Vampiro: A Máscara (5ª edição) — tabela vtm_character_sheets. */
export interface VtmSheet {
  id:              string
  campaign_id:     string
  user_id:         string
  character_name:  string | null
  concept:         string | null
  chronicle:       string | null
  sire:            string | null
  ambition:        string | null
  desire:          string | null
  clan:            string | null
  predator_type:   string | null
  generation:      number
  portrait_url:    string | null
  attr_strength:     number
  attr_dexterity:    number
  attr_stamina:      number
  attr_charisma:     number
  attr_manipulation: number
  attr_composure:    number
  attr_intelligence: number
  attr_wits:         number
  attr_resolve:      number
  /** Pontos de cada perícia (chave → 0..5; ausente = 0). */
  skills:          Record<string, number>
  specialties:     VtmSpecialty[]
  health_superficial:    number
  health_aggravated:     number
  health_bonus:          number
  willpower_superficial: number
  willpower_aggravated:  number
  willpower_bonus:       number
  hunger:          number
  humanity:        number
  stains:          number
  blood_potency:   number
  history:         string | null
  notes:           string | null
  /** Ficha de NPC do mestre (migration 20240189000000). */
  is_npc?: boolean
  /** O mestre mostrou o NPC pros jogadores (eles só leem). */
  npc_visible?: boolean
  // ── Marco 2 (migration 20240190000000) ──
  /** Pontos em cada disciplina (chave → 0..5; ausente = 0). */
  disciplines:     Record<string, number>
  /** Poderes escolhidos ("disciplina.poder"). */
  powers:          string[]
  /** Rituais, cerimônias e fórmulas aprendidos ("ritual.x", "cerimonia.x", "formula.x"). */
  rituals:         string[]
  advantages:      VtmAdvantage[]
  convictions:     VtmConviction[]
  xp_log:          VtmXpEntry[]
  predator_grants: VtmPredatorGrants | null
  creation_tier:   'neonato' | 'ancilla'
  created_at:      string
  updated_at:      string
}

/** Antecedente, Mérito ou Defeito na ficha de Vampiro. */
export interface VtmAdvantage {
  id:     string
  /** Chave do catálogo (vtmAdvantages.ts); "custom" = criado à mão. */
  key:    string
  kind:   'background' | 'merit' | 'flaw'
  name:   string
  dots:   number
  note:   string
  /** De onde veio: escolhido na criação, dado pelo predador ou comprado com XP. */
  source: 'criacao' | 'predador' | 'xp'
}

/** Convicção e o Pilar de Toque ligado a ela. */
export interface VtmConviction {
  id:         string
  conviction: string
  touchstone: string
  note:       string
  /** vivo: protege; ferido: já custou mancha; perdido: o Pilar se foi e a Convicção com ele. */
  status:     'vivo' | 'ferido' | 'perdido'
}

/** Linha do histórico de experiência. */
export interface VtmXpEntry {
  id:     string
  at:     string
  kind:   'ganho' | 'gasto'
  amount: number
  label:  string
  note?:  string
  /** Só nos gastos: o que subiu, pra poder desfazer. */
  target?: { type: string; key: string; from: number; to: number; extra?: string }
}

/** O que o tipo de predador pôs na ficha (pra desfazer ao trocar). */
export interface VtmPredatorGrants {
  predator:      string
  discipline:    string | null
  specialtyId:   string | null
  advantageIds:  string[]
  humanity:      number
  bloodPotency:  number
}

export interface VtmSheetWithProfile extends VtmSheet {
  profile: Pick<ProfilePublic, 'id' | 'display_name' | 'avatar_url'> | null
}

/** Inimigo do bestiário do mestre (campanhas Altherium). HP e dano são o
 *  valor final; rounds/danger_pct/party_* guardam como ele foi calculado. */
export interface AltheriumCreature {
  id:           string
  campaign_id:  string
  name:         string
  hp:           number
  damage_dice:  string
  rounds:       number
  danger_pct:   number
  party_damage: number | null
  party_avg_hp: number | null
  notes:        string | null
  created_at:   string
  updated_at:   string
}

/** Criatura do "Meu bestiário" — da pessoa, fora de qualquer campanha. Rodadas
 *  e perigo só existem quando ela veio calculada do bestiário de uma campanha. */
export interface PersonalCreature {
  id:           string
  owner_id:     string
  name:         string
  hp:           number
  damage_dice:  string
  rounds:       number | null
  danger_pct:   number | null
  party_damage: number | null
  party_avg_hp: number | null
  notes:        string | null
  created_at:   string
  updated_at:   string
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
