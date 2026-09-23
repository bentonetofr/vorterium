import { supabase } from '../../../shared/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────

export interface ChatMessage {
  id:           string
  campaign_id:  string
  user_id:      string
  recipient_id: string | null
  content:      string
  created_at:   string
  // null quando o autor não é mais membro da campanha — a RLS de profiles
  // exige co-membro ATUAL pra revelar o perfil, então mensagens antigas de
  // alguém removido perdem o join (a linha em si continua existindo).
  profile:      { id: string; display_name: string; avatar_url: string | null } | null
}

const MAX_MESSAGE_LENGTH = 2000

interface RawMessageRow {
  id: string
  campaign_id: string
  user_id: string
  recipient_id: string | null
  content: string
  created_at: string
  profiles: { id: string; display_name: string; avatar_url: string | null } | null
}

function mapRow(row: RawMessageRow): ChatMessage {
  return {
    id:           row.id,
    campaign_id:  row.campaign_id,
    user_id:      row.user_id,
    recipient_id: row.recipient_id,
    content:      row.content,
    created_at:   row.created_at,
    profile:      row.profiles,
  }
}

// ────────────────────────────────────────────────────────
// Mensagens
// ────────────────────────────────────────────────────────

/**
 * Busca uma página de mensagens, mais recentes primeiro internamente,
 * retornada em ordem cronológica (mais antiga primeiro) para exibição.
 * Passe `before` (created_at da mensagem mais antiga já carregada) para
 * paginar mensagens anteriores.
 *
 * `threadWith` ausente = mesa (mensagens públicas). `threadWith` = id do
 * outro usuário busca a conversa privada entre ele e o usuário autenticado.
 */
export async function getCampaignMessages(
  campaignId: string,
  before?: string,
  limit = 30,
  threadWith?: string,
): Promise<ChatMessage[]> {
  let query = supabase
    .from('campaign_messages')
    .select('id, campaign_id, user_id, recipient_id, content, created_at, profiles!user_id(id, display_name, avatar_url)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (threadWith) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado.')
    query = query.or(
      `and(user_id.eq.${user.id},recipient_id.eq.${threadWith}),and(user_id.eq.${threadWith},recipient_id.eq.${user.id})`,
    )
  } else {
    query = query.is('recipient_id', null)
  }

  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) throw new Error('Não foi possível carregar as mensagens.')
  if (!data || data.length === 0) return []

  return (data as unknown as RawMessageRow[]).map(mapRow).reverse()
}

/**
 * Envia uma mensagem. Lança exceção em falha (formulário trata o erro).
 * Sem `recipientId`, é uma mensagem pública da mesa. Com `recipientId`, é
 * privada — a RLS decide se o par remetente/destinatário é permitido
 * (mestre com qualquer jogador, jogador só com o mestre).
 */
export async function sendMessage(campaignId: string, content: string, recipientId?: string): Promise<void> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Escreva uma mensagem.')
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Mensagem muito longa (máximo ${MAX_MESSAGE_LENGTH} caracteres).`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { error } = await supabase
    .from('campaign_messages')
    .insert({ campaign_id: campaignId, user_id: user.id, recipient_id: recipientId ?? null, content: trimmed })

  if (error) throw new Error('Não foi possível enviar a mensagem.')
}

/** Apaga uma mensagem — RLS decide se o usuário autenticado pode (autor ou mestre). */
export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase.from('campaign_messages').delete().eq('id', messageId)
  if (error) throw new Error('Não foi possível apagar a mensagem.')
}

// ────────────────────────────────────────────────────────
// Realtime
// ────────────────────────────────────────────────────────

export interface TypingPayload {
  user_id:        string
  display_name:   string
  thread_user_id?: string
}

/**
 * Assina INSERT/DELETE de mensagens (postgres_changes) e "digitando..."
 * (broadcast efêmero, nunca grava no banco — não faz sentido persistir
 * isso) da campanha, no mesmo canal. O payload de `postgres_changes` só
 * traz as colunas cruas da tabela (sem join de perfil) — quem chama
 * resolve o autor por fora (ex: mapa local de membros já carregado)
 * usando `userId` e completando o `ChatMessage`.
 *
 * Retorna `sendTyping` (pra avisar que o próprio usuário está digitando)
 * e `unsubscribe` (cancela tudo — postgres_changes e broadcast).
 */
export function subscribeToMessages(
  campaignId: string,
  onInsert: (row: { id: string; campaign_id: string; user_id: string; recipient_id: string | null; content: string; created_at: string }) => void,
  onDelete: (id: string) => void,
  onTyping: (payload: TypingPayload) => void,
): { sendTyping: (payload: TypingPayload) => void; unsubscribe: () => void } {
  const channel: RealtimeChannel = supabase
    .channel(`campaign_messages:${campaignId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'campaign_messages', filter: `campaign_id=eq.${campaignId}` },
      (payload) => onInsert(payload.new as never),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'campaign_messages', filter: `campaign_id=eq.${campaignId}` },
      (payload) => onDelete((payload.old as { id: string }).id),
    )
    .on(
      'broadcast',
      { event: 'typing' },
      ({ payload }) => onTyping(payload as TypingPayload),
    )
    .subscribe()

  return {
    sendTyping: (payload) => {
      void channel.send({ type: 'broadcast', event: 'typing', payload })
    },
    unsubscribe: () => { supabase.removeChannel(channel) },
  }
}

// ────────────────────────────────────────────────────────
// Não lidas
// ────────────────────────────────────────────────────────

/** Conta mensagens da mesa (públicas) de outras pessoas desde a última leitura. */
export async function getChatUnreadCount(campaignId: string): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { data: readRow } = await supabase
    .from('campaign_chat_reads')
    .select('last_read_at')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .maybeSingle()

  const since = (readRow as { last_read_at: string } | null)?.last_read_at ?? '1970-01-01T00:00:00.000Z'

  const { count, error } = await supabase
    .from('campaign_messages')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .is('recipient_id', null)
    .neq('user_id', user.id)
    .gt('created_at', since)

  if (error) return 0
  return count ?? 0
}

/** Marca o chat da campanha (mesa) como lido agora, para o usuário autenticado. */
export async function markChatRead(campaignId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_campaign_chat_read', { campaign_id_input: campaignId })
  if (error) throw new Error(error.message)
}

// ────────────────────────────────────────────────────────
// Mensagens privadas — não lidas
// ────────────────────────────────────────────────────────

/**
 * Não lidas por conversa privada, indexado pelo id do outro usuário.
 * Jogador só pode ter uma entrada (a do mestre); mestre pode ter uma por
 * jogador que já mandou mensagem. Quem nunca mandou nada não aparece.
 */
export async function getPrivateUnreadCounts(campaignId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('get_private_message_unread_counts', {
    campaign_id_input: campaignId,
  })
  if (error || !data) return new Map()

  return new Map(
    (data as { other_user_id: string; unread_count: number }[]).map((row) => [row.other_user_id, row.unread_count]),
  )
}

/** Marca a conversa privada com `otherUserId` como lida agora. */
export async function markPrivateThreadRead(campaignId: string, otherUserId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_private_thread_read', {
    campaign_id_input: campaignId,
    other_user_id_input: otherUserId,
  })
  if (error) throw new Error(error.message)
}
