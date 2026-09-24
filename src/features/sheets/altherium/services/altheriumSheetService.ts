import { supabase } from '../../../../shared/lib/supabase'
import { logActivity } from '../../../activity/services/activityService'
import type {
  AltheriumSheet,
  AltheriumDomainPoints,
  AltheriumSheetWithProfile,
  ProfilePublic,
} from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────

export type AltheriumSheetUpdate = Partial<Omit<
  AltheriumSheet,
  'id' | 'campaign_id' | 'user_id' | 'created_at' | 'updated_at'
>>

interface RawSheetWithProfile extends AltheriumSheet {
  profiles: Pick<ProfilePublic, 'id' | 'display_name' | 'avatar_url'> | null
}

const SHEET_COLUMNS = '*'

export const ALTHERIUM_PORTRAIT_MAX_BYTES = 2 * 1024 * 1024
export const ALTHERIUM_PORTRAIT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

// ────────────────────────────────────────────────────────
// Ficha
// ────────────────────────────────────────────────────────

/** Ficha Altherium do usuário autenticado na campanha — null se ainda não existir. */
export async function getMyAltheriumSheet(campaignId: string): Promise<AltheriumSheet | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('altherium_character_sheets')
    .select(SHEET_COLUMNS)
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw new Error('Não foi possível carregar a ficha.')
  return data as AltheriumSheet | null
}

/** Cria a ficha do usuário autenticado com os valores padrão do sistema. */
export async function createMyAltheriumSheet(campaignId: string): Promise<AltheriumSheet> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('altherium_character_sheets')
    .insert({ campaign_id: campaignId, user_id: user.id })
    .select(SHEET_COLUMNS)
    .single()

  if (error) throw new Error('Não foi possível criar a ficha.')
  return data as AltheriumSheet
}

export async function getOrCreateMyAltheriumSheet(campaignId: string): Promise<AltheriumSheet> {
  const existing = await getMyAltheriumSheet(campaignId)
  if (existing) return existing
  return createMyAltheriumSheet(campaignId)
}

/** Atualiza a ficha — a RLS decide quem pode (dono ou mestre da campanha). */
export async function updateAltheriumSheet(
  sheetId: string,
  data: AltheriumSheetUpdate,
): Promise<AltheriumSheet> {
  const { data: updated, error } = await supabase
    .from('altherium_character_sheets')
    .update(data)
    .eq('id', sheetId)
    .select(SHEET_COLUMNS)
    .single()

  if (error) throw new Error('Não foi possível salvar a ficha.')

  const sheet = updated as AltheriumSheet
  const charName = sheet.character_name?.trim()
  logActivity(
    sheet.campaign_id,
    'sheet_updated',
    charName ? `Ficha de "${charName}" atualizada.` : 'Ficha atualizada.',
  )
  return sheet
}

/** Envia o retrato do personagem e atualiza a URL pública da ficha. */
export async function uploadAltheriumPortrait(sheetId: string, file: File): Promise<AltheriumSheet> {
  if (!ALTHERIUM_PORTRAIT_TYPES.includes(file.type as (typeof ALTHERIUM_PORTRAIT_TYPES)[number])) {
    throw new Error('Escolha uma imagem JPG, PNG ou WebP.')
  }
  if (file.size > ALTHERIUM_PORTRAIT_MAX_BYTES) {
    throw new Error('O retrato deve ter no máximo 2 MB.')
  }

  const path = `${sheetId}/portrait`
  const { error: uploadError } = await supabase.storage
    .from('altherium-portraits')
    .upload(path, file, {
      upsert: true,
      cacheControl: '3600',
      contentType: file.type,
    })

  if (uploadError) {
    console.error('Erro do Storage ao enviar retrato:', uploadError)
    throw new Error(`Não foi possível enviar o retrato: ${uploadError.message}`)
  }

  const { data: publicData } = supabase.storage.from('altherium-portraits').getPublicUrl(path)
  const portraitUrl = `${publicData.publicUrl}?v=${Date.now()}`
  return updateAltheriumSheet(sheetId, { portrait_url: portraitUrl })
}

/** Remove o retrato armazenado e limpa a URL da ficha. */
export async function removeAltheriumPortrait(sheetId: string): Promise<AltheriumSheet> {
  const { error: removeError } = await supabase.storage
    .from('altherium-portraits')
    .remove([`${sheetId}/portrait`])
  if (removeError) {
    console.error('Erro do Storage ao remover retrato:', removeError)
    throw new Error(`Não foi possível remover o retrato: ${removeError.message}`)
  }

  return updateAltheriumSheet(sheetId, { portrait_url: null })
}

/** Todas as fichas Altherium da campanha com o perfil do dono (visão do mestre). */
export async function getCampaignAltheriumSheets(campaignId: string): Promise<AltheriumSheetWithProfile[]> {
  const { data, error } = await supabase
    .from('altherium_character_sheets')
    .select('*, profiles!user_id(id, display_name, avatar_url)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })

  if (error) throw new Error('Não foi possível carregar as fichas da campanha.')
  if (!data || data.length === 0) return []

  return (data as unknown as RawSheetWithProfile[]).map(({ profiles, ...sheet }) => ({
    ...sheet,
    profile: profiles,
  }))
}

// ────────────────────────────────────────────────────────
// Domínios
// ────────────────────────────────────────────────────────

/** Pontos de domínio da ficha — só existem linhas para domínios já tocados. */
export async function getAltheriumDomains(sheetId: string): Promise<AltheriumDomainPoints[]> {
  const { data, error } = await supabase
    .from('altherium_character_domains')
    .select('id, sheet_id, domain, points')
    .eq('sheet_id', sheetId)

  if (error) throw new Error('Não foi possível carregar os domínios.')
  return (data ?? []) as AltheriumDomainPoints[]
}

/**
 * Define os pontos de um domínio. Cria a linha na primeira vez e atualiza
 * depois — `unique (sheet_id, domain)` garante uma linha por domínio.
 */
export async function setAltheriumDomainPoints(
  sheetId: string,
  domain: string,
  points: number,
): Promise<void> {
  const { error } = await supabase
    .from('altherium_character_domains')
    .upsert({ sheet_id: sheetId, domain, points }, { onConflict: 'sheet_id,domain' })

  if (error) throw new Error('Não foi possível salvar o domínio.')
}
