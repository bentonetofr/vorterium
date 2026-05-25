// ────────────────────────────────────────────────────────
// Tipos do modelo de dados — Campaign Lab MVP
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

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'

export interface DiceRoll {
  id: string
  campaign_id: string
  user_id: string
  die_type: DieType
  result: number
  created_at: string
}

// ── Utilitário genérico para estado assíncrono ──────────
export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string }

/** Rolagem enriquecida com dados públicos do autor — para exibição no histórico */
export interface DiceRollWithProfile {
  id: string
  campaign_id: string
  user_id: string
  die_type: DieType
  result: number
  created_at: string
  profile: Pick<ProfilePublic, 'id' | 'display_name'>
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
