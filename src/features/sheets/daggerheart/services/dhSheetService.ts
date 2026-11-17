import { supabase, uniqueChannel } from '../../../../shared/lib/supabase'
import type { ProfilePublic } from '../../../../shared/types'
import { emptySheet, normalizeSheet } from '../model/defaults'
import type { DhSheetData, DhSheetRow } from '../model/types'

// ────────────────────────────────────────────────────────
// Ficha de DaggerHeart: a tabela dh_sheets (migration 20240238) guarda a ficha inteira numa coluna jsonb, uma linha por
// jogador e campanha. A leitura sempre passa por `normalizeSheet`, então fichas incompletas ou antigas não quebram a tela.
// ────────────────────────────────────────────────────────

const TABLE = 'dh_sheets'

export interface DhSheet {
  id: string
  campaign_id: string
  user_id: string
  data: DhSheetData
  created_at: string
  updated_at: string
}

export interface DhSheetWithProfile extends DhSheet {
  profile: Pick<ProfilePublic, 'id' | 'display_name' | 'avatar_url'> | null
}

function fromRow(row: DhSheetRow): DhSheet {
  return { ...row, data: normalizeSheet(row.data) }
}

export async function getMyDhSheet(campaignId: string): Promise<DhSheet | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')
  const { data, error } = await supabase.from(TABLE).select('*').eq('campaign_id', campaignId).eq('user_id', user.id).maybeSingle()
  if (error) throw new Error('Não foi possível carregar a ficha. Confira se a migration de DaggerHeart já rodou.')
  return data ? fromRow(data as DhSheetRow) : null
}

export async function getOrCreateMyDhSheet(campaignId: string): Promise<DhSheet> {
  const existing = await getMyDhSheet(campaignId)
  if (existing) return existing
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')
  const { data, error } = await supabase.from(TABLE).insert({ campaign_id: campaignId, user_id: user.id, data: emptySheet() }).select('*').single()
  if (error) throw new Error('Não foi possível criar a ficha. Confira se a migration de DaggerHeart já rodou.')
  return fromRow(data as DhSheetRow)
}

/** Grava a ficha inteira (a RLS deixa o dono e o mestre da campanha). */
export async function saveDhSheet(sheetId: string, data: DhSheetData): Promise<DhSheet> {
  const { data: row, error } = await supabase.from(TABLE).update({ data }).eq('id', sheetId).select('*').single()
  if (error) throw new Error('Não foi possível salvar a ficha.')
  return fromRow(row as DhSheetRow)
}

interface RawWithProfile extends DhSheetRow {
  profiles: Pick<ProfilePublic, 'id' | 'display_name' | 'avatar_url'> | null
}

/** Todas as fichas da campanha, com o perfil de quem joga (visão do mestre). */
export async function getCampaignDhSheets(campaignId: string): Promise<DhSheetWithProfile[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, profiles!user_id(id, display_name, avatar_url)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (error) throw new Error('Não foi possível carregar as fichas da campanha.')
  return ((data ?? []) as unknown as RawWithProfile[]).map(({ profiles, ...row }) => ({ ...fromRow(row), profile: profiles }))
}

export async function deleteDhSheet(sheetId: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', sheetId)
  if (error) throw new Error('Não foi possível apagar a ficha.')
}

/** Mudanças em uma ficha (tempo real, respeita a RLS): quem edita de outro lugar (o mestre, outra aba) aparece aqui. */
export function subscribeToDhSheet(sheetId: string, onChange: (sheet: DhSheet) => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`dh_sheet:${sheetId}`))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE, filter: `id=eq.${sheetId}` },
      (payload) => onChange(fromRow(payload.new as DhSheetRow)))
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

/** Mudanças na lista de fichas da campanha (mestre). */
export function subscribeToCampaignDhSheets(campaignId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`dh_sheets:${campaignId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `campaign_id=eq.${campaignId}` }, () => onChange())
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}
