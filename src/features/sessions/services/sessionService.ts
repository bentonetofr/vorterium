import { supabase } from '../../../shared/lib/supabase'
import type { CampaignSession } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────

export interface SessionFormData {
  title:        string
  session_date: string | null  // 'YYYY-MM-DD' ou null
  summary:      string | null
}

// ────────────────────────────────────────────────────────
// Session Service
// ────────────────────────────────────────────────────────

/**
 * Lista todas as sessões de uma campanha.
 * Ordenação: session_date desc (nulls por último) → created_at desc.
 * RLS garante que apenas membros da campanha vejam.
 */
export async function getCampaignSessions(
  campaignId: string
): Promise<CampaignSession[]> {
  const { data, error } = await supabase
    .from('campaign_sessions')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('session_date', { ascending: false, nullsFirst: false })
    .order('created_at',   { ascending: false })

  if (error) throw new Error('Não foi possível carregar as sessões.')
  return (data ?? []) as CampaignSession[]
}

/**
 * Cria uma sessão para a campanha.
 * RLS garante que apenas o mestre pode criar.
 */
export async function createCampaignSession(
  campaignId: string,
  formData: SessionFormData
): Promise<CampaignSession> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('campaign_sessions')
    .insert({
      campaign_id:  campaignId,
      title:        formData.title.trim(),
      session_date: formData.session_date || null,
      summary:      formData.summary?.trim() || null,
      created_by:   user.id,
    })
    .select('*')
    .single()

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('title_length'))   throw new Error('O título deve ter no máximo 120 caracteres.')
    if (msg.includes('summary_length')) throw new Error('O resumo deve ter no máximo 5000 caracteres.')
    throw new Error('Não foi possível criar a sessão.')
  }

  return data as CampaignSession
}

/**
 * Atualiza título, data e resumo de uma sessão.
 * RLS garante que apenas o mestre pode editar.
 */
export async function updateCampaignSession(
  sessionId: string,
  formData: SessionFormData
): Promise<CampaignSession> {
  const { data, error } = await supabase
    .from('campaign_sessions')
    .update({
      title:        formData.title.trim(),
      session_date: formData.session_date || null,
      summary:      formData.summary?.trim() || null,
    })
    .eq('id', sessionId)
    .select('*')
    .single()

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('title_length'))   throw new Error('O título deve ter no máximo 120 caracteres.')
    if (msg.includes('summary_length')) throw new Error('O resumo deve ter no máximo 5000 caracteres.')
    throw new Error('Não foi possível atualizar a sessão.')
  }

  return data as CampaignSession
}

/**
 * Remove uma sessão pelo id.
 * RLS garante que apenas o mestre pode excluir.
 */
export async function deleteCampaignSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('campaign_sessions')
    .delete()
    .eq('id', sessionId)

  if (error) throw new Error('Não foi possível excluir a sessão.')
}
