// ────────────────────────────────────────────────────────
// Tipos do modelo de dados — Vorterium
// ────────────────────────────────────────────────────────

export interface Profile {
  id: string
  display_name: string
  email: string
  avatar_url: string | null
  main_provider: string | null
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
  system: string
  master_id: string
  description: string | null
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

/** Ficha enriquecida com dados do dono — para listagem pelo mestre */
export interface SheetWithProfile extends CharacterSheet {
  profile: ProfilePublic
}

export type DieType  = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'
export type RollMode = 'sum' | 'keep_highest'

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
  created_at: string
}

// ── Utilitário genérico para estado assíncrono ──────────
export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string }

/** Rolagem enriquecida com dados públicos do autor — para exibição no histórico */
export interface DiceRollWithProfile extends DiceRoll {
  profile: Pick<ProfilePublic, 'id' | 'display_name'>
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

/** Registro de presença de um membro na campanha (atualizado via heartbeat). */
export interface CampaignPresenceRecord {
  campaign_id:  string
  user_id:      string
  last_seen_at: string
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

/** Dados públicos de um convite — retornados sem autenticação pela RPC get_campaign_invite_public */
export interface CampaignInvitePublic {
  campaign_id: string
  campaign_name: string
  campaign_system: string
  is_active: boolean
  expires_at: string | null
}
