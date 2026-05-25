import { supabase } from '../../../shared/lib/supabase'
import { ensureProfile } from '../../users/services/profileService'
import type { CampaignInvite } from '../../../shared/types'

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

  return acceptCampaignInvite(token)
}

/**
 * Desativa um convite. Apenas o mestre pode chamar.
 */
export async function deactivateCampaignInvite(token: string): Promise<void> {
  const { error } = await supabase.rpc('deactivate_campaign_invite', {
    invite_token: token,
  })

  if (error) throw new Error('Não foi possível desativar o convite.')
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
