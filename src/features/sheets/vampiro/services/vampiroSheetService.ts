import { supabase, uniqueChannel } from '../../../../shared/lib/supabase'
import { pcOnly } from '../../services/npcService'
import { logActivity } from '../../../activity/services/activityService'
import type { ProfilePublic, VtmSheet, VtmSheetWithProfile } from '../../../../shared/types'
import { VTM_PORTRAIT_MAX_BYTES, VTM_PORTRAIT_TYPES } from '../constants/vampiro'

// ────────────────────────────────────────────────────────
// Ficha de Vampiro: A Máscara — tabela vtm_character_sheets (migration
// 20240187000000). Mesmo jeito da ficha de Altherium: o formulário salva
// sozinho, o mestre vê os cards da mesa ao vivo, o retrato vai pro bucket
// vtm-portraits ("<id da ficha>/portrait").
// ────────────────────────────────────────────────────────

export type VtmSheetUpdate = Partial<Omit<VtmSheet, 'id' | 'campaign_id' | 'user_id' | 'created_at' | 'updated_at'>>

interface RawSheetWithProfile extends VtmSheet {
  profiles: Pick<ProfilePublic, 'id' | 'display_name' | 'avatar_url'> | null
}

const TABLE = 'vtm_character_sheets'
const BUCKET = 'vtm-portraits'

/** Ficha do usuário autenticado na campanha — null se ainda não existir. */
export async function getMyVtmSheet(campaignId: string): Promise<VtmSheet | null> {
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
  return data as VtmSheet | null
}

export async function getOrCreateMyVtmSheet(campaignId: string): Promise<VtmSheet> {
  const existing = await getMyVtmSheet(campaignId)
  if (existing) return existing

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ campaign_id: campaignId, user_id: user.id })
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível criar a ficha. Confira se a migration de Vampiro já rodou.')
  return data as VtmSheet
}

/** Atualiza a ficha — a RLS decide quem pode (dono ou mestre da campanha). */
export async function updateVtmSheet(sheetId: string, data: VtmSheetUpdate): Promise<VtmSheet> {
  const { data: updated, error } = await supabase
    .from(TABLE)
    .update(data)
    .eq('id', sheetId)
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível salvar a ficha.')

  const sheet = updated as VtmSheet
  const charName = sheet.character_name?.trim()
  // NPC não vai pro histórico: o nome escondido não pode vazar pros jogadores.
  if (!sheet.is_npc) logActivity(
    sheet.campaign_id,
    'sheet_updated',
    charName ? `Ficha de "${charName}" atualizada.` : 'Ficha atualizada.',
  )
  return sheet
}

/** Envia (ou troca) o retrato e grava a URL na ficha. */
export async function uploadVtmPortrait(sheetId: string, file: File): Promise<VtmSheet> {
  if (!VTM_PORTRAIT_TYPES.includes(file.type as (typeof VTM_PORTRAIT_TYPES)[number])) {
    throw new Error('Escolha uma imagem JPG, PNG ou WebP.')
  }
  if (file.size > VTM_PORTRAIT_MAX_BYTES) throw new Error('O retrato deve ter no máximo 2 MB.')

  const path = `${sheetId}/portrait`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type })
  if (error) throw new Error(`Não foi possível enviar o retrato: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return updateVtmSheet(sheetId, { portrait_url: `${data.publicUrl}?v=${Date.now()}` })
}

/** Remove o retrato e limpa a URL da ficha. */
export async function removeVtmPortrait(sheetId: string): Promise<VtmSheet> {
  const { error } = await supabase.storage.from(BUCKET).remove([`${sheetId}/portrait`])
  if (error) throw new Error(`Não foi possível remover o retrato: ${error.message}`)
  return updateVtmSheet(sheetId, { portrait_url: null })
}

/** Fichas de Vampiro do usuário em todas as campanhas ("Minhas fichas"). */
export async function getMyVtmSheetsEverywhere(): Promise<(VtmSheet & { campaign_name: string })[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from(TABLE)
    .select('*, campaigns(id, name)')
    .match(await pcOnly())
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  // Sem a migration: nenhuma ficha (a página não quebra por isso).
  if (error) return []
  return ((data ?? []) as unknown as (VtmSheet & { campaigns: { id: string; name: string } | null })[])
    .filter((row) => row.campaigns != null)
    .map(({ campaigns, ...sheet }) => ({ ...sheet, campaign_name: campaigns!.name }))
}

/** Todas as fichas da campanha com o perfil do dono (visão do mestre). */
export async function getCampaignVtmSheets(campaignId: string): Promise<VtmSheetWithProfile[]> {
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
export function subscribeToCampaignVtmSheets(
  campaignId: string,
  onSheetUpdate: (sheet: VtmSheet) => void,
  onListChange: () => void,
): () => void {
  const channel = supabase
    .channel(uniqueChannel(`vtm_sheets:${campaignId}`))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE, filter: `campaign_id=eq.${campaignId}` },
      (payload) => onSheetUpdate(payload.new as VtmSheet))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE, filter: `campaign_id=eq.${campaignId}` },
      () => onListChange())
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: TABLE, filter: `campaign_id=eq.${campaignId}` },
      () => onListChange())
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}
