import { supabase } from '../../../shared/lib/supabase'
import type {
  CampaignMember,
  CampaignMemberWithProfile,
  ProfilePublic,
} from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Tipos internos para join campaign_members → profiles
// ────────────────────────────────────────────────────────

interface MemberRow {
  id: string
  campaign_id: string
  user_id: string
  role: string
  created_at: string
  profiles: ProfilePublic
}

// ────────────────────────────────────────────────────────
// Member Service
// ────────────────────────────────────────────────────────

/**
 * Lista todos os membros de uma campanha com seus perfis públicos.
 * A RLS garante que apenas membros da campanha consigam ver a lista.
 * A policy de profiles do Incremento 4 permite ver perfis de co-membros.
 */
export async function getCampaignMembers(
  campaignId: string
): Promise<CampaignMemberWithProfile[]> {
  const { data, error } = await supabase
    .from('campaign_members')
    .select('id, campaign_id, user_id, role, created_at, profiles(id, display_name, email, avatar_url)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })

  if (error) throw new Error('Não foi possível carregar os membros da campanha.')
  if (!data || data.length === 0) return []

  const rows = data as unknown as MemberRow[]

  return rows
    .filter((row) => row.profiles != null)
    .map((row) => ({
      id:          row.id,
      campaign_id: row.campaign_id,
      user_id:     row.user_id,
      role:        row.role as CampaignMember['role'],
      created_at:  row.created_at,
      profile:     row.profiles,
    }))
}

/**
 * Busca perfil por e-mail via RPC `find_profile_by_email`.
 * Não expõe a tabela de usuários diretamente.
 * Retorna null se nenhum perfil for encontrado.
 */
export async function findProfileByEmail(
  email: string
): Promise<ProfilePublic | null> {
  const { data, error } = await supabase.rpc('find_profile_by_email', {
    profile_email: email.trim().toLowerCase(),
  })

  if (error) throw new Error('Não foi possível buscar o usuário.')
  if (!data || (Array.isArray(data) && data.length === 0)) return null

  const row = Array.isArray(data) ? data[0] : data
  return row as ProfilePublic
}

/**
 * Adiciona um jogador à campanha via RPC `add_campaign_player`.
 * O mestre é validado no banco — esta função apenas chama a RPC.
 */
export async function addCampaignMember(
  campaignId: string,
  playerId: string
): Promise<CampaignMember> {
  const { data, error } = await supabase.rpc('add_campaign_player', {
    campaign_id_input: campaignId,
    player_id_input:   playerId,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('já faz parte'))     throw new Error('Este usuário já faz parte da campanha.')
    if (msg.includes('não encontrado'))   throw new Error('Usuário não encontrado.')
    if (msg.includes('Apenas o mestre')) throw new Error('Apenas o mestre pode adicionar jogadores.')
    throw new Error('Não foi possível adicionar o jogador.')
  }

  return data as CampaignMember
}

/**
 * Remove um jogador da campanha via RPC `remove_campaign_player`.
 * O mestre e as permissões são validados no banco.
 */
export async function removeCampaignMember(
  campaignId: string,
  playerId: string
): Promise<void> {
  const { error } = await supabase.rpc('remove_campaign_player', {
    campaign_id_input: campaignId,
    player_id_input:   playerId,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('a si mesmo'))       throw new Error('O mestre não pode remover a si mesmo.')
    if (msg.includes('Apenas o mestre')) throw new Error('Apenas o mestre pode remover jogadores.')
    if (msg.includes('não encontrado'))   throw new Error('Jogador não encontrado na campanha.')
    throw new Error('Não foi possível remover o jogador.')
  }
}
