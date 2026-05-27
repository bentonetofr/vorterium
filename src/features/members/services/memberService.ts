import { supabase } from '../../../shared/lib/supabase'
import { getCampaignSheets, isSheetFilled } from '../../sheets/services/sheetService'
import { logActivity } from '../../activity/services/activityService'
import type {
  CampaignMember,
  CampaignMemberWithProfile,
  ProfilePublic,
} from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Tipos exportados
// ────────────────────────────────────────────────────────

/** Status da ficha de um membro — 'no_sheet' quando não há ficha criada. */
export type SheetStatus = 'filled' | 'not_filled' | 'no_sheet'

/** Membro enriquecido com status de ficha (apenas disponível para o mestre via RLS). */
export interface CampaignMemberWithSheetStatus extends CampaignMemberWithProfile {
  sheetStatus: SheetStatus
}

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

  logActivity(campaignId, 'member_joined', 'Jogador adicionado à campanha')
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

  logActivity(campaignId, 'member_removed', 'Jogador removido da campanha')
}

/**
 * Lista membros com status de ficha calculado a partir das fichas da campanha.
 * Requer papel de mestre — a RLS de `character_sheets` bloqueia jogadores.
 * Faz as duas consultas em paralelo.
 */
export async function getCampaignMembersWithSheetStatus(
  campaignId: string
): Promise<CampaignMemberWithSheetStatus[]> {
  const [members, sheets] = await Promise.all([
    getCampaignMembers(campaignId),
    getCampaignSheets(campaignId),
  ])

  const sheetMap = new Map(sheets.map((s) => [s.user_id, s]))

  return members.map((m) => {
    const sheet = sheetMap.get(m.user_id)
    let sheetStatus: SheetStatus
    if (!sheet)                  sheetStatus = 'no_sheet'
    else if (isSheetFilled(sheet)) sheetStatus = 'filled'
    else                         sheetStatus = 'not_filled'
    return { ...m, sheetStatus }
  })
}
