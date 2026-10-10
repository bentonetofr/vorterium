import { supabase, uniqueChannel } from '../../../../shared/lib/supabase'
import { pcOnly } from '../../services/npcService'
import { logActivity } from '../../../activity/services/activityService'
import { sendMessage } from '../../../chat/services/chatService'
import type { ProfilePublic, TdaSheet, TdaSheetWithProfile } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Ficha Terra Devastada Adaptada — tabela tda_character_sheets. As listas
// (características, condições, trunfos, inventário) vão inteiras no
// salvamento automático, como o resto da ficha.
// ────────────────────────────────────────────────────────

export type TdaSheetUpdate = Partial<Omit<TdaSheet, 'id' | 'campaign_id' | 'user_id' | 'created_at' | 'updated_at'>>

interface RawSheetWithProfile extends TdaSheet {
  profiles: Pick<ProfilePublic, 'id' | 'display_name' | 'avatar_url'> | null
}

const TABLE = 'tda_character_sheets'

/** Ficha do usuário autenticado na campanha — null se ainda não existir. */
export async function getMyTdaSheet(campaignId: string): Promise<TdaSheet | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .match(await pcOnly())
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw new Error('Não foi possível carregar a ficha.')
  return data as TdaSheet | null
}

export async function getOrCreateMyTdaSheet(campaignId: string): Promise<TdaSheet> {
  const existing = await getMyTdaSheet(campaignId)
  if (existing) return existing

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ campaign_id: campaignId, user_id: user.id })
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível criar a ficha.')
  return data as TdaSheet
}

/** Atualiza a ficha — a RLS decide quem pode (dono ou mestre da campanha). */
export async function updateTdaSheet(sheetId: string, data: TdaSheetUpdate): Promise<TdaSheet> {
  const { data: updated, error } = await supabase
    .from(TABLE)
    .update(data)
    .eq('id', sheetId)
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível salvar a ficha.')

  const sheet = updated as TdaSheet
  const charName = sheet.character_name?.trim()
  // NPC não vai pro histórico: o nome escondido não pode vazar pros jogadores.
  if (!sheet.is_npc) logActivity(
    sheet.campaign_id,
    'sheet_updated',
    charName ? `Ficha de "${charName}" atualizada.` : 'Ficha atualizada.',
  )
  return sheet
}

/**
 * Conta pra mesa, no chat, o que aconteceu com o personagem (teste, cena
 * de horror, Convicção). Fire-and-forget: falhar aqui nunca desfaz nada
 * na ficha.
 */
export function announceTda(campaignId: string, message: string): void {
  void sendMessage(campaignId, `☣ ${message}`).catch(() => { /* só não aparece no chat */ })
}

/** Fichas Terra Devastada do usuário em todas as campanhas ("Minhas fichas"). */
export async function getMyTdaSheetsEverywhere(): Promise<(TdaSheet & { campaign_name: string })[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from(TABLE)
    .select('*, campaigns(id, name)')
    .match(await pcOnly())
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) throw new Error('Não foi possível carregar suas fichas.')
  return ((data ?? []) as unknown as (TdaSheet & { campaigns: { id: string; name: string } | null })[])
    .filter((row) => row.campaigns != null)
    .map(({ campaigns, ...sheet }) => ({ ...sheet, campaign_name: campaigns!.name }))
}

/** Todas as fichas da campanha com o perfil do dono (visão do mestre). */
export async function getCampaignTdaSheets(campaignId: string): Promise<TdaSheetWithProfile[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, profiles!user_id(id, display_name, avatar_url)')
    .match(await pcOnly())
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })

  if (error) throw new Error('Não foi possível carregar as fichas da campanha.')
  return ((data ?? []) as unknown as RawSheetWithProfile[]).map(({ profiles, ...sheet }) => ({
    ...sheet,
    profile: profiles,
  }))
}

/**
 * Mudanças nas fichas da campanha (Realtime, respeita a RLS). UPDATE traz
 * a linha inteira sem o perfil — quem chama mescla. INSERT/DELETE pedem
 * recarregar a lista.
 */
export function subscribeToCampaignTdaSheets(
  campaignId: string,
  onSheetUpdate: (sheet: TdaSheet) => void,
  onListChange: () => void,
): () => void {
  const channel = supabase
    .channel(uniqueChannel(`tda_sheets:${campaignId}`))
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLE, filter: `campaign_id=eq.${campaignId}` },
      (payload) => onSheetUpdate(payload.new as TdaSheet),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLE, filter: `campaign_id=eq.${campaignId}` },
      () => onListChange(),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: TABLE, filter: `campaign_id=eq.${campaignId}` },
      () => onListChange(),
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
