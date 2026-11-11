import { supabase } from '../../../shared/lib/supabase'
import { logActivity } from '../../activity/services/activityService'
import type { CampaignSession } from '../../../shared/types'
import { localToday } from '../utils/sessionCountdown'

// ────────────────────────────────────────────────────────
// Tipos e helpers de status
// ────────────────────────────────────────────────────────

export type SessionStatus = 'planned' | 'completed' | 'canceled'

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  planned:   'Planejada',
  completed: 'Concluída',
  canceled:  'Cancelada',
}

export function getSessionStatusLabel(status: SessionStatus): string {
  return SESSION_STATUS_LABELS[status] ?? status
}

// ────────────────────────────────────────────────────────
// Ordem da lista de episódios (a mesma na lista e nas Anotações da Bruna)
// ────────────────────────────────────────────────────────

export type SessionSortOrder = 'recent' | 'oldest' | 'az' | 'za'

export const SESSION_SORT_OPTIONS: { value: SessionSortOrder; label: string }[] = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'az',     label: 'Ordem alfabética (A–Z)' },
  { value: 'za',     label: 'Ordem alfabética (Z–A)' },
]

/** Data que vale pra ordenar: a marcada na sessão; sem data, o dia em que ela foi criada. */
function sortDay(s: CampaignSession): string {
  return s.session_date ?? s.created_at.slice(0, 10)
}

export function sortSessions(list: CampaignSession[], order: SessionSortOrder): CampaignSession[] {
  const byTitle = (a: CampaignSession, b: CampaignSession) =>
    a.title.localeCompare(b.title, 'pt-BR', { numeric: true, sensitivity: 'base' })
  const byTime = (a: CampaignSession, b: CampaignSession) =>
    sortDay(a).localeCompare(sortDay(b)) || a.created_at.localeCompare(b.created_at)
  return [...list].sort((a, b) => {
    if (order === 'az') return byTitle(a, b)
    if (order === 'za') return byTitle(b, a)
    return order === 'recent' ? byTime(b, a) : byTime(a, b)
  })
}

export interface SessionFormData {
  title:        string
  session_date: string | null  // 'YYYY-MM-DD' ou null
  summary:      string | null
  status:       SessionStatus
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
 * Próximas sessões marcadas (status "planejada", com data de hoje em diante)
 * de várias campanhas de uma vez, da mais próxima pra mais distante.
 * RLS garante que só entram as campanhas em que a pessoa participa.
 */
export async function getUpcomingSessions(campaignIds: string[], limit = 8): Promise<CampaignSession[]> {
  if (campaignIds.length === 0) return []
  const { data, error } = await supabase
    .from('campaign_sessions')
    .select('*')
    .in('campaign_id', campaignIds)
    .eq('status', 'planned')
    .gte('session_date', localToday())
    .order('session_date', { ascending: true })
    .limit(limit)

  if (error) throw new Error('Não foi possível carregar as próximas sessões.')
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
      status:       formData.status,
      created_by:   user.id,
    })
    .select('*')
    .single()

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('title_length'))   throw new Error('O título deve ter no máximo 120 caracteres.')
    if (msg.includes('summary_length')) throw new Error('O resumo deve ter no máximo 5000 caracteres.')
    if (msg.includes('status_check'))   throw new Error('Selecione um status válido.')
    throw new Error('Não foi possível criar a sessão.')
  }

  const session = data as CampaignSession
  logActivity(
    session.campaign_id,
    'session_created',
    `Sessão "${session.title}" criada como ${getSessionStatusLabel(session.status)}.`
  )
  return session
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
      status:       formData.status,
    })
    .eq('id', sessionId)
    .select('*')
    .single()

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('title_length'))   throw new Error('O título deve ter no máximo 120 caracteres.')
    if (msg.includes('summary_length')) throw new Error('O resumo deve ter no máximo 5000 caracteres.')
    if (msg.includes('status_check'))   throw new Error('Selecione um status válido.')
    throw new Error('Não foi possível atualizar a sessão.')
  }

  const session = data as CampaignSession
  logActivity(
    session.campaign_id,
    'session_updated',
    `Sessão "${session.title}" marcada como ${getSessionStatusLabel(session.status)}.`
  )
  return session
}

/**
 * Remove uma sessão pelo id.
 * RLS garante que apenas o mestre pode excluir.
 * Passa campaignId opcionalmente para registrar atividade.
 */
export async function deleteCampaignSession(sessionId: string, campaignId?: string, title?: string): Promise<void> {
  const { error } = await supabase
    .from('campaign_sessions')
    .delete()
    .eq('id', sessionId)

  if (error) throw new Error('Não foi possível excluir a sessão.')
  if (campaignId) {
    const msg = title ? `Sessão "${title}" excluída.` : 'Sessão excluída.'
    logActivity(campaignId, 'session_deleted', msg)
  }
}
