import { supabase } from '../../../shared/lib/supabase'
import type { CampaignActivity, CampaignPresenceRecord } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Tipos exportados
// ────────────────────────────────────────────────────────

export interface ActivityWithCampaign extends CampaignActivity {
  campaign_name: string
}

// ────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────

/** Threshold em ms que define um usuário como "online". */
export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutos

export type ActivityType =
  | 'campaign_created'   | 'campaign_updated'
  | 'member_joined'      | 'member_left'        | 'member_removed'
  | 'invite_created'     | 'invite_deactivated'
  | 'session_created'    | 'session_updated'    | 'session_deleted'
  | 'sheet_updated'      | 'dice_rolled'

/** Ícone para cada tipo de evento. */
export const ACTIVITY_ICONS: Record<string, string> = {
  campaign_created:   '◈',
  campaign_updated:   '◈',
  member_joined:      '⚔',
  member_left:        '⚔',
  member_removed:     '⚔',
  invite_created:     '✉',
  invite_deactivated: '✉',
  session_created:    '✦',
  session_updated:    '✦',
  session_deleted:    '✦',
  sheet_updated:      '📜',
  dice_rolled:        '⬡',
}

// ────────────────────────────────────────────────────────
// Activity
// ────────────────────────────────────────────────────────

/**
 * Busca as últimas 20 atividades da campanha, ordenadas por created_at desc.
 */
export async function getCampaignActivity(
  campaignId: string
): Promise<CampaignActivity[]> {
  const { data, error } = await supabase
    .from('campaign_activity')
    .select('id, campaign_id, actor_id, type, message, metadata, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw new Error('Não foi possível carregar as atividades.')
  return (data ?? []) as CampaignActivity[]
}

/**
 * Registra uma atividade na campanha via RPC. Lança exceção em falha.
 */
export async function createCampaignActivity(
  campaignId: string,
  type:       ActivityType,
  message:    string,
  metadata?:  Record<string, unknown> | null
): Promise<void> {
  const { error } = await supabase.rpc('create_campaign_activity', {
    campaign_id_input:  campaignId,
    activity_type:      type,
    activity_message:   message,
    activity_metadata:  metadata ?? null,
  })
  if (error) throw new Error(error.message)
}

/**
 * Registra atividade de forma fire-and-forget.
 * Falhas são silenciosas — nunca interrompem a operação principal.
 */
export function logActivity(
  campaignId: string,
  type:       ActivityType,
  message:    string,
  metadata?:  Record<string, unknown> | null
): void {
  void createCampaignActivity(campaignId, type, message, metadata).catch(() => {
    // silently ignore
  })
}

// ────────────────────────────────────────────────────────
// Presence
// ────────────────────────────────────────────────────────

/**
 * Busca os registros de presença de todos os membros da campanha.
 */
export async function getCampaignPresence(
  campaignId: string
): Promise<CampaignPresenceRecord[]> {
  const { data, error } = await supabase
    .from('campaign_presence')
    .select('campaign_id, user_id, last_seen_at')
    .eq('campaign_id', campaignId)

  if (error) throw new Error('Não foi possível carregar a presença.')
  return (data ?? []) as CampaignPresenceRecord[]
}

/**
 * Atualiza a presença do usuário autenticado na campanha.
 * Usado como heartbeat periódico. Lança exceção em falha.
 */
export async function touchCampaignPresence(campaignId: string): Promise<void> {
  const { error } = await supabase.rpc('touch_campaign_presence', {
    campaign_id_input: campaignId,
  })
  if (error) throw new Error(error.message)
}

// ────────────────────────────────────────────────────────
// Utilitários de presença
// ────────────────────────────────────────────────────────

/** Retorna true se last_seen_at indica usuário online (< 2 min atrás). */
export function isUserOnline(lastSeenAt: string | undefined): boolean {
  if (!lastSeenAt) return false
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS
}

/** Formata o timestamp de presença para exibição humanizada. */
export function formatPresenceTime(lastSeenAt: string | undefined): string {
  if (!lastSeenAt) return 'Nunca'
  const diff    = Date.now() - new Date(lastSeenAt).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 45)  return 'agora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)  return `há ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)    return `há ${hours}h`
  return new Date(lastSeenAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/**
 * Busca as 50 atividades mais recentes de todas as campanhas
 * em que o usuário autenticado participa.
 * A filtragem por campaign_id garante que apenas atividades das campanhas
 * do usuário sejam retornadas, independente da RLS.
 */
export async function getMyRecentActivity(): Promise<ActivityWithCampaign[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data: memberRows, error: memberError } = await supabase
    .from('campaign_members')
    .select('campaign_id')
    .eq('user_id', user.id)

  if (memberError) throw new Error('Não foi possível carregar as atividades.')
  const campaignIds = (memberRows ?? []).map((r: { campaign_id: string }) => r.campaign_id)
  if (campaignIds.length === 0) return []

  const { data, error } = await supabase
    .from('campaign_activity')
    .select('*, campaigns(id, name)')
    .in('campaign_id', campaignIds)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error('Não foi possível carregar as atividades.')
  if (!data || data.length === 0) return []

  type RawRow = CampaignActivity & { campaigns: { id: string; name: string } | null }
  return (data as unknown as RawRow[])
    .filter((row) => row.campaigns != null)
    .map(({ campaigns, ...activity }) => ({
      ...activity,
      campaign_name: campaigns!.name,
    }))
}

/** Formata o timestamp de atividade de forma relativa. */
export function formatActivityTime(iso: string): string {
  const diff    = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5)   return 'agora'
  if (seconds < 60)  return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)  return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)    return `${hours}h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
