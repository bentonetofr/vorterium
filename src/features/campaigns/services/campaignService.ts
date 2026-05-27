import { supabase } from '../../../shared/lib/supabase'
import { ensureProfile } from '../../users/services/profileService'
import { logActivity, createCampaignActivity } from '../../activity/services/activityService'
import type { Campaign, CampaignMember, CampaignWithRole } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Tipos de formulário
// ────────────────────────────────────────────────────────

export interface CampaignDetailsData {
  name:        string
  description: string | null
  status:      Campaign['status']
}

// ────────────────────────────────────────────────────────
// Tipos internos para resultado das queries com join
// ────────────────────────────────────────────────────────

interface MemberWithCampaign {
  role: string
  campaigns: Campaign
}

// ────────────────────────────────────────────────────────
// Campaign Service
// ────────────────────────────────────────────────────────

/**
 * Lista todas as campanhas do usuário autenticado,
 * incluindo o papel (mestre ou jogador) em cada uma.
 *
 * Filtra explicitamente por user_id para garantir que:
 * - cada campanha aparece exatamente uma vez;
 * - o papel exibido é sempre o do usuário logado, nunca de outro membro.
 */
export async function getMyCampaigns(): Promise<CampaignWithRole[]> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('campaign_members')
    .select('role, campaigns(*)')
    .eq('user_id', user.id)

  if (error) throw new Error('Não foi possível carregar suas campanhas.')
  if (!data || data.length === 0) return []

  const rows = data as unknown as MemberWithCampaign[]

  return rows
    .filter((row) => row.campaigns != null)
    .map((row) => ({
      ...row.campaigns,
      role: row.role as CampaignMember['role'],
    }))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
}

/**
 * Cria uma campanha via RPC `create_campaign`.
 *
 * Antes de chamar a RPC, garante que o usuário possui um registro em
 * `profiles`. Isso protege usuários criados antes da migration, que não
 * passaram pelo trigger `handle_new_user` e portanto não têm perfil —
 * o que causaria falha na FK campaigns.master_id.
 */
export async function createCampaign(
  name: string,
  description?: string | null
): Promise<Campaign> {
  // Garante perfil antes de tentar criar campanha (FK constraint)
  await ensureProfile()

  const { data, error } = await supabase.rpc('create_campaign', {
    campaign_name:        name.trim(),
    campaign_system:      'generic',
    campaign_description: description ?? null,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('não pode ser vazio'))  throw new Error('O nome da campanha não pode ser vazio.')
    if (msg.includes('1000 caracteres'))     throw new Error('A descrição deve ter no máximo 1000 caracteres.')
    throw new Error('Não foi possível criar a campanha. Tente novamente.')
  }

  return data as Campaign
}

/**
 * Atualiza nome, descrição e status de uma campanha.
 * Apenas o mestre pode chamar. Retorna a campanha atualizada.
 */
export async function updateCampaignDetails(
  campaignId: string,
  data: CampaignDetailsData
): Promise<Campaign> {
  const { data: result, error } = await supabase.rpc('update_campaign_details', {
    campaign_id_input: campaignId,
    new_name:          data.name.trim(),
    new_description:   data.description,
    new_status:        data.status,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('não pode ser vazio'))  throw new Error('O nome da campanha não pode ser vazio.')
    if (msg.includes('Apenas o mestre'))     throw new Error('Apenas o mestre pode editar a campanha.')
    if (msg.includes('1000 caracteres'))     throw new Error('A descrição deve ter no máximo 1000 caracteres.')
    if (msg.includes('Status inválido'))     throw new Error('Selecione um status válido.')
    throw new Error('Não foi possível atualizar a campanha.')
  }

  logActivity(campaignId, 'campaign_updated', 'Campanha atualizada')
  return result as Campaign
}

/**
 * Atualiza o nome de uma campanha. Apenas o mestre pode chamar.
 * Retorna a campanha com o nome atualizado.
 * @deprecated Use updateCampaignDetails para editar nome, descrição e status.
 */
export async function updateCampaignName(
  campaignId: string,
  name: string
): Promise<Campaign> {
  const { data, error } = await supabase.rpc('update_campaign_name', {
    campaign_id_input: campaignId,
    new_name:          name.trim(),
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('não pode ser vazio'))  throw new Error('O nome da campanha não pode ser vazio.')
    if (msg.includes('Apenas o mestre'))     throw new Error('Apenas o mestre pode editar a campanha.')
    throw new Error('Não foi possível atualizar a campanha.')
  }

  return data as Campaign
}

/**
 * Exclui uma campanha e todos os dados relacionados (cascade).
 * Apenas o mestre pode chamar.
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_campaign', {
    campaign_id_input: campaignId,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('Apenas o mestre')) throw new Error('Apenas o mestre pode excluir a campanha.')
    throw new Error('Não foi possível excluir a campanha.')
  }
}

/**
 * Remove o usuário autenticado da campanha como jogador.
 * Mestre não pode usar este fluxo.
 */
export async function leaveCampaign(campaignId: string): Promise<void> {
  // Registrar antes de sair — após a remoção o usuário perde acesso à RPC
  try { await createCampaignActivity(campaignId, 'member_left', 'Saiu da campanha') } catch { /* silently ignore */ }

  const { error } = await supabase.rpc('leave_campaign', {
    campaign_id_input: campaignId,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('mestre não pode sair')) throw new Error('O mestre não pode sair da campanha por este fluxo.')
    if (msg.includes('não é membro'))         throw new Error('Você não é membro desta campanha.')
    throw new Error('Não foi possível sair da campanha.')
  }
}

/**
 * Busca uma campanha por ID junto com o papel do usuário.
 * Retorna null se a campanha não existir ou o usuário não tiver acesso.
 *
 * Usa join de campaign_members → campaigns com filtros explícitos por
 * campaign_id e user_id para garantir que o papel retornado é sempre
 * o do usuário autenticado.
 */
export async function getCampaignWithRole(
  campaignId: string,
  userId: string
): Promise<CampaignWithRole | null> {
  const { data, error } = await supabase
    .from('campaign_members')
    .select('role, campaigns(*)')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // sem acesso ou não existe
    throw new Error('Não foi possível carregar a campanha.')
  }

  const row = data as unknown as MemberWithCampaign
  if (!row.campaigns) return null

  return {
    ...row.campaigns,
    role: row.role as CampaignMember['role'],
  }
}

