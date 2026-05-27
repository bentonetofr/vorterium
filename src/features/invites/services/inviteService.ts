import { supabase } from '../../../shared/lib/supabase'
import { ensureProfile } from '../../users/services/profileService'
import { logActivity } from '../../activity/services/activityService'
import type { CampaignInvite, CampaignInvitePublic } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────

export const PENDING_INVITE_KEY = 'campaign-lab-pending-invite'

// ────────────────────────────────────────────────────────
// Invite Service
// ────────────────────────────────────────────────────────

/**
 * Monta a URL completa de convite usando a origem atual do navegador.
 */
export function buildInviteUrl(token: string): string {
  return `${window.location.origin}/convite/${token}`
}

/**
 * Cria (ou reutiliza) um convite ativo para a campanha.
 * Apenas o mestre pode chamar.
 */
export async function createCampaignInvite(
  campaignId: string
): Promise<CampaignInvite> {
  const { data, error } = await supabase.rpc('create_campaign_invite', {
    campaign_id_input: campaignId,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('Apenas o mestre')) throw new Error('Apenas o mestre pode gerar convites.')
    throw new Error('Não foi possível gerar o convite.')
  }

  logActivity(campaignId, 'invite_created', 'Convite gerado')
  return data as CampaignInvite
}

/**
 * Aceita um convite e adiciona o usuário autenticado como jogador.
 * Retorna o campaign_id para redirecionamento.
 * Requer que o perfil do usuário já exista em public.profiles.
 */
export async function acceptCampaignInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_campaign_invite', {
    invite_token: token,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('inválido') || msg.includes('expirado')) {
      throw new Error('Convite inválido ou expirado.')
    }
    if (msg.includes('não autenticado')) throw new Error('Faça login para aceitar o convite.')
    throw new Error('Não foi possível aceitar o convite.')
  }

  return data as string
}

/**
 * Garante o perfil do usuário e aceita o convite.
 *
 * campaign_members.user_id referencia public.profiles(id), portanto o perfil
 * deve existir antes de aceitar. Usuários criados antes da migration ou via
 * OAuth podem não ter perfil criado automaticamente.
 */
export async function acceptCampaignInviteWithProfile(
  token: string
): Promise<string> {
  try {
    await ensureProfile()
  } catch {
    throw new Error('Não foi possível sincronizar seu perfil para aceitar o convite.')
  }

  const campaignId = await acceptCampaignInvite(token)
  logActivity(campaignId, 'member_joined', 'Entrou na campanha via convite')
  return campaignId
}

/**
 * Desativa um convite. Apenas o mestre pode chamar.
 * Passa campaignId opcionalmente para registrar atividade.
 */
export async function deactivateCampaignInvite(token: string, campaignId?: string): Promise<void> {
  const { error } = await supabase.rpc('deactivate_campaign_invite', {
    invite_token: token,
  })

  if (error) throw new Error('Não foi possível desativar o convite.')
  if (campaignId) logActivity(campaignId, 'invite_deactivated', 'Convite desativado')
}

/**
 * Busca dados públicos de um convite (funciona sem autenticação).
 * Retorna campaign_id, campaign_name, campaign_system, is_active, expires_at.
 */
export async function getCampaignInvitePublic(token: string): Promise<CampaignInvitePublic> {
  const { data, error } = await supabase.rpc('get_campaign_invite_public', {
    invite_token: token,
  })

  if (error) {
    if (error.message?.includes('não encontrado')) throw new Error('Convite não encontrado.')
    throw new Error('Não foi possível carregar os dados do convite.')
  }

  return data as CampaignInvitePublic
}

/**
 * Busca o convite ativo mais recente da campanha (apenas para o mestre).
 * Retorna null se não houver convite ativo.
 */
export async function getActiveCampaignInvite(
  campaignId: string
): Promise<CampaignInvite | null> {
  const { data, error } = await supabase
    .from('campaign_invites')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error('Não foi possível carregar o convite.')
  return data
}

// ────────────────────────────────────────────────────────
// Convite pendente (sessionStorage)
// ────────────────────────────────────────────────────────

/**
 * Salva token de convite pendente para processar após login.
 */
export function savePendingInvite(token: string): void {
  sessionStorage.setItem(PENDING_INVITE_KEY, token)
}

/**
 * Verifica, aceita e limpa convite pendente do sessionStorage.
 * Garante o perfil do usuário antes de aceitar.
 * Retorna campaign_id se havia convite pendente, null caso contrário.
 * Não lança exceção — falha silenciosamente para não bloquear o login.
 */
export async function processPendingInvite(): Promise<string | null> {
  const token = sessionStorage.getItem(PENDING_INVITE_KEY)
  if (!token) return null

  // Remove antes de processar para evitar loops em caso de erro
  sessionStorage.removeItem(PENDING_INVITE_KEY)

  try {
    const campaignId = await acceptCampaignInviteWithProfile(token)
    return campaignId
  } catch {
    // Convite inválido, expirado ou perfil indisponível: descarta silenciosamente
    return null
  }
}
