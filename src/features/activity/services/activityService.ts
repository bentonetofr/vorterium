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
  | 'note_created'       | 'note_updated'       | 'note_deleted'
  | 'triumph_used'

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
  note_created:       '◇',
  note_updated:       '◇',
  note_deleted:       '◇',
  triumph_used:       '⚜',
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

// ────────────────────────────────────────────────────────
// Notificações
// ────────────────────────────────────────────────────────

/** Tipos de atividade que contam para o selo de notificação — o resto
 *  (convites, campanha criada/atualizada, ficha atualizada) continua só
 *  na aba Atividade, sem notificar. */
const NOTIFICATION_ACTIVITY_TYPES: ActivityType[] = [
  'member_joined', 'member_left', 'member_removed',
  'session_created', 'session_updated', 'session_deleted',
  'note_created',
]

/** Busca quando o usuário autenticado viu notificações pela última vez. */
export async function getActivitySeenAt(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('profiles')
    .select('activity_seen_at')
    .eq('id', user.id)
    .single()

  if (error) throw new Error('Não foi possível carregar notificações.')
  return (data as { activity_seen_at: string }).activity_seen_at
}

/** Marca as notificações como vistas agora, para o usuário autenticado. */
export async function markActivitySeen(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { error } = await supabase
    .from('profiles')
    .update({ activity_seen_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) throw new Error('Não foi possível atualizar notificações.')
}

/**
 * Conta eventos novos desde `seenAt`, em todas as campanhas do usuário.
 * Rolagens de dados são contadas à parte (não via campaign_activity) —
 * rolagens ocultas já não geram atividade (Etapa 2), e o RLS de dice_rolls
 * decide sozinho quem enxerga uma rolagem de outra pessoa.
 */
export async function getUnreadNotificationCount(seenAt: string): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const [activityRes, diceRes] = await Promise.all([
    supabase
      .from('campaign_activity')
      .select('id', { count: 'exact', head: true })
      .in('type', NOTIFICATION_ACTIVITY_TYPES)
      .neq('actor_id', user.id)
      .gt('created_at', seenAt),
    supabase
      .from('dice_rolls')
      .select('id', { count: 'exact', head: true })
      .neq('user_id', user.id)
      .gt('created_at', seenAt),
  ])

  if (activityRes.error || diceRes.error) return 0
  return (activityRes.count ?? 0) + (diceRes.count ?? 0)
}

/** Um evento pronto para virar pop-up — já formatado, sem o consumidor
 *  precisar saber de onde veio (campaign_activity, dice_rolls ou
 *  campaign_members). */
export interface LiveNotification {
  id: string
  message: string
  campaignName: string
  createdAt: string
}

const POPUP_ACTIVITY_TYPES: ActivityType[] = ['note_created', 'session_created']

type ActivityRow = { id: string; message: string; created_at: string; campaigns: { name: string } | null }
type DiceRow = { id: string; formula: string | null; die_type: string; result: number; created_at: string; campaigns: { name: string } | null; profiles: { display_name: string } | null }
type MemberRow = { id: string; created_at: string; campaigns: { name: string } | null }
type MessageRow = { id: string; content: string; recipient_id: string | null; created_at: string; campaigns: { name: string } | null; profiles: { display_name: string } | null }

const MESSAGE_PREVIEW_LENGTH = 80

function mapActivityRow(row: ActivityRow): LiveNotification {
  return {
    id:           `activity-${row.id}`,
    message:      row.message,
    campaignName: row.campaigns?.name ?? 'Campanha',
    createdAt:    row.created_at,
  }
}

function mapDiceRow(row: DiceRow): LiveNotification {
  return {
    id:           `dice-${row.id}`,
    message:      `${row.profiles?.display_name ?? 'Alguém'} rolou ${row.formula ?? row.die_type}: ${row.result}`,
    campaignName: row.campaigns?.name ?? 'Campanha',
    createdAt:    row.created_at,
  }
}

function mapMemberRow(row: MemberRow): LiveNotification {
  return {
    id:           `member-${row.id}`,
    message:      'Você foi adicionado à campanha.',
    campaignName: row.campaigns?.name ?? 'Campanha',
    createdAt:    row.created_at,
  }
}

function mapMessageRow(row: MessageRow): LiveNotification {
  const name = row.profiles?.display_name ?? 'Alguém'
  if (row.recipient_id) {
    return {
      id:           `message-${row.id}`,
      message:      `Mensagem privada de ${name}`,
      campaignName: row.campaigns?.name ?? 'Campanha',
      createdAt:    row.created_at,
    }
  }
  const preview = row.content.length > MESSAGE_PREVIEW_LENGTH
    ? row.content.slice(0, MESSAGE_PREVIEW_LENGTH) + '…'
    : row.content
  return {
    id:           `message-${row.id}`,
    message:      `${name}: ${preview}`,
    campaignName: row.campaigns?.name ?? 'Campanha',
    createdAt:    row.created_at,
  }
}

/**
 * Busca os últimos `limit` eventos de cada fonte pro mecanismo de pop-up.
 * Não filtra por data — quem chama decide o que já foi mostrado (por id),
 * evitando qualquer comparação de timestamp/fuso do lado da consulta.
 * "Fui adicionado a uma campanha" não dá pra pegar de forma confiável
 * pelo actor_id de campaign_activity (varia se foi convite por e-mail ou
 * link), então lê direto de campaign_members.
 *
 * Mensagem de chat e rolagem de dado NÃO entram aqui — ao contrário das
 * outras fontes, cada uma é pega via Realtime de verdade
 * (`subscribeToNewMessagesGlobally`/`getMessageNotification` e
 * `subscribeToNewRollsGlobally`/`getDiceRollNotification`, logo abaixo),
 * pra não ficar até 20s atrasada em relação ao evento que já aconteceu
 * na hora.
 */
export async function getLiveNotifications(limit = 8): Promise<LiveNotification[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const [activityRes, memberRes] = await Promise.all([
    supabase
      .from('campaign_activity')
      .select('id, message, created_at, campaigns(name)')
      .in('type', POPUP_ACTIVITY_TYPES)
      .neq('actor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('campaign_members')
      .select('id, created_at, campaigns(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  if (activityRes.error) console.error('[getLiveNotifications] erro em campaign_activity:', activityRes.error)
  if (memberRes.error)   console.error('[getLiveNotifications] erro em campaign_members:', memberRes.error)

  const events: LiveNotification[] = [
    ...((activityRes.data ?? []) as unknown as ActivityRow[]).map(mapActivityRow),
    ...((memberRes.data ?? []) as unknown as MemberRow[]).map(mapMemberRow),
  ]

  // mais antigo primeiro, pra fila do pop-up mostrar em ordem cronológica
  events.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return events
}

/**
 * Assina INSERT em `dice_rolls` de todas as campanhas do usuário — mesmo
 * raciocínio de `subscribeToNewMessagesGlobally`: Realtime respeita RLS,
 * então só chegam linhas que o usuário teria permissão de ver de qualquer
 * forma. Ignora a própria rolagem e qualquer rolagem privada — o pop-up de
 * dado nunca mostra rolagem oculta, nem pro mestre (mesma regra de quando
 * isso era feito via polling). O payload de INSERT do Realtime traz todas
 * as colunas (diferente do payload reduzido de DELETE), então dá pra
 * filtrar por `is_private` sem consulta extra.
 */
export function subscribeToNewRollsGlobally(
  currentUserId: string,
  onRoll: (rollId: string) => void,
): () => void {
  const channel = supabase
    .channel('global-dice-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'dice_rolls' },
      (payload) => {
        const row = payload.new as { id: string; user_id: string; is_private: boolean }
        if (row.user_id === currentUserId) return
        if (row.is_private) return
        onRoll(row.id)
      },
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

/**
 * Busca uma rolagem específica já formatada como notificação. O evento de
 * Realtime só traz as colunas cruas (sem nome do autor/campanha) — essa
 * busca completa com uma consulta pelo id.
 */
export async function getDiceRollNotification(rollId: string): Promise<LiveNotification | null> {
  const { data, error } = await supabase
    .from('dice_rolls')
    .select('id, formula, die_type, result, created_at, campaigns(name), profiles(display_name)')
    .eq('id', rollId)
    .maybeSingle()

  if (error || !data) return null
  return mapDiceRow(data as unknown as DiceRow)
}

/**
 * Assina INSERT em `campaign_messages` de TODAS as campanhas do usuário —
 * sem filtro de campaign_id. Funciona porque o Realtime do Supabase
 * respeita RLS: só chegam eventos de linhas que o usuário autenticado
 * teria permissão de SELECT de qualquer forma (ou seja, campanhas onde
 * ele é membro). Usado só pra notificar mensagem nova na hora — a
 * conversa em si (`CampaignChatPanel`) assina o canal por campanha, à
 * parte. Ignora a própria mensagem do usuário (`currentUserId`). Passa o
 * `campaignId` junto pro chamador decidir se suprime (ex: usuário já
 * está vendo aquele chat).
 */
export function subscribeToNewMessagesGlobally(
  currentUserId: string,
  onMessage: (messageId: string, campaignId: string) => void,
): () => void {
  const channel = supabase
    .channel('global-chat-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'campaign_messages' },
      (payload) => {
        const row = payload.new as { id: string; user_id: string; campaign_id: string }
        if (row.user_id === currentUserId) return
        onMessage(row.id, row.campaign_id)
      },
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

/**
 * Busca uma mensagem específica já formatada como notificação. O evento
 * de Realtime só traz as colunas cruas (sem nome do autor/campanha) —
 * essa busca completa com uma consulta pelo id.
 */
export async function getMessageNotification(messageId: string): Promise<LiveNotification | null> {
  const { data, error } = await supabase
    .from('campaign_messages')
    .select('id, content, recipient_id, created_at, campaigns(name), profiles!user_id(display_name)')
    .eq('id', messageId)
    .maybeSingle()

  if (error || !data) return null
  return mapMessageRow(data as unknown as MessageRow)
}

/**
 * Busca as últimas notificações (independente de "visto"), pro painel do
 * sino. Usa o mesmo conjunto de tipos que conta pro selo — mais amplo que
 * o do pop-up ao vivo (inclui membro saiu/removido, sessão editada/cancelada)
 * — mais mensagens de chat, que aparecem aqui só como histórico (não
 * contam pro selo/contagem — esse continua vivendo só na aba de chat).
 */
export async function getRecentNotifications(limit = 3): Promise<LiveNotification[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const [activityRes, diceRes, messageRes] = await Promise.all([
    supabase
      .from('campaign_activity')
      .select('id, message, created_at, campaigns(name)')
      .in('type', NOTIFICATION_ACTIVITY_TYPES)
      .neq('actor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('dice_rolls')
      .select('id, formula, die_type, result, created_at, campaigns(name), profiles(display_name)')
      .neq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('campaign_messages')
      .select('id, content, recipient_id, created_at, campaigns(name), profiles!user_id(display_name)')
      .neq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  const events: LiveNotification[] = [
    ...((activityRes.data ?? []) as unknown as ActivityRow[]).map(mapActivityRow),
    ...((diceRes.data ?? []) as unknown as DiceRow[]).map(mapDiceRow),
    ...((messageRes.data ?? []) as unknown as MessageRow[]).map(mapMessageRow),
  ]

  events.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return events.slice(0, limit)
}
