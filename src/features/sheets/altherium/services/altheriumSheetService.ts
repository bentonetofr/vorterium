import { supabase } from '../../../../shared/lib/supabase'
import { logActivity } from '../../../activity/services/activityService'
import type {
  AltheriumSheet,
  AltheriumDomainPoints,
  AltheriumInventoryItem,
  AltheriumRune,
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

// ────────────────────────────────────────────────────────
// Inventário
// ────────────────────────────────────────────────────────

/** Itens do inventário da ficha — arma, armadura, escudo, consumível ou utilitário. */
export async function getAltheriumInventory(sheetId: string): Promise<AltheriumInventoryItem[]> {
  const { data, error } = await supabase
    .from('altherium_character_inventory')
    .select('*')
    .eq('sheet_id', sheetId)
    .order('created_at', { ascending: true })

  if (error) throw new Error('Não foi possível carregar o inventário.')
  return (data ?? []) as AltheriumInventoryItem[]
}

/**
 * Adiciona um item do catálogo ao inventário. Se o personagem já tiver
 * esse item (mesmo item_type + item_id), soma 1 à quantidade existente
 * em vez de criar uma linha duplicada — `unique (sheet_id, item_type, item_id)`.
 */
export async function addAltheriumInventoryItem(
  sheetId: string,
  itemType: AltheriumInventoryItem['item_type'],
  itemId: string,
): Promise<AltheriumInventoryItem> {
  const { data: existing, error: findError } = await supabase
    .from('altherium_character_inventory')
    .select('*')
    .eq('sheet_id', sheetId)
    .eq('item_type', itemType)
    .eq('item_id', itemId)
    .maybeSingle()

  if (findError) throw new Error('Não foi possível verificar o inventário.')

  if (existing) {
    return updateAltheriumInventoryItem(existing.id, { quantity: existing.quantity + 1 })
  }

  const { data, error } = await supabase
    .from('altherium_character_inventory')
    .insert({ sheet_id: sheetId, item_type: itemType, item_id: itemId })
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível adicionar o item.')
  return data as AltheriumInventoryItem
}

/** Atualiza quantidade e/ou estado de equipado de um item do inventário. */
export async function updateAltheriumInventoryItem(
  id: string,
  data: Partial<Pick<AltheriumInventoryItem, 'quantity' | 'equipped' | 'equipped_zone'>>,
): Promise<AltheriumInventoryItem> {
  const { data: updated, error } = await supabase
    .from('altherium_character_inventory')
    .update(data)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível atualizar o item.')
  return updated as AltheriumInventoryItem
}

/** Remove um item do inventário. */
export async function removeAltheriumInventoryItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('altherium_character_inventory')
    .delete()
    .eq('id', id)

  if (error) throw new Error('Não foi possível remover o item.')
}

// ────────────────────────────────────────────────────────
// Runas descobertas (Runaskin)
// ────────────────────────────────────────────────────────

export type AltheriumRuneInput = Pick<AltheriumRune, 'name' | 'description' | 'pr_cost' | 'test'>

const RUNES_BUCKET = 'altherium-runes'

/** Runas descobertas da ficha, na ordem em que foram criadas. */
export async function getAltheriumRunes(sheetId: string): Promise<AltheriumRune[]> {
  const { data, error } = await supabase
    .from('altherium_runaskin_runes')
    .select('*')
    .eq('sheet_id', sheetId)
    .order('created_at', { ascending: true })

  if (error) throw new Error('Não foi possível carregar as runas.')
  return (data ?? []) as AltheriumRune[]
}

/** Envia a foto da runa (caminho <sheet_id>/<rune_id>) e devolve a URL pública. */
async function uploadRuneImage(sheetId: string, runeId: string, file: File): Promise<string> {
  if (!ALTHERIUM_PORTRAIT_TYPES.includes(file.type as (typeof ALTHERIUM_PORTRAIT_TYPES)[number])) {
    throw new Error('Escolha uma imagem JPG, PNG ou WebP.')
  }
  if (file.size > ALTHERIUM_PORTRAIT_MAX_BYTES) {
    throw new Error('A imagem deve ter no máximo 2 MB.')
  }

  const path = `${sheetId}/${runeId}`
  const { error } = await supabase.storage
    .from(RUNES_BUCKET)
    .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type })

  if (error) {
    console.error('Erro do Storage ao enviar imagem da runa:', error)
    throw new Error(`Não foi possível enviar a imagem: ${error.message}`)
  }

  const { data } = supabase.storage.from(RUNES_BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

async function removeRuneImage(sheetId: string, runeId: string): Promise<void> {
  const { error } = await supabase.storage.from(RUNES_BUCKET).remove([`${sheetId}/${runeId}`])
  if (error) console.error('Erro do Storage ao remover imagem da runa:', error)
}

/** Cria uma runa descoberta — a foto (opcional) é enviada depois de a linha existir. */
export async function createAltheriumRune(
  sheetId: string,
  input: AltheriumRuneInput,
  image: File | null,
): Promise<AltheriumRune> {
  const { data, error } = await supabase
    .from('altherium_runaskin_runes')
    .insert({ sheet_id: sheetId, ...input })
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível criar a runa.')
  const rune = data as AltheriumRune
  if (!image) return rune

  const imageUrl = await uploadRuneImage(sheetId, rune.id, image)
  return updateRuneRow(rune.id, { image_url: imageUrl })
}

/**
 * Atualiza uma runa. `image`: File troca a foto, null remove, undefined
 * mantém a atual.
 */
export async function updateAltheriumRune(
  rune: AltheriumRune,
  input: AltheriumRuneInput,
  image: File | null | undefined,
): Promise<AltheriumRune> {
  let imageUrl = rune.image_url
  if (image) {
    imageUrl = await uploadRuneImage(rune.sheet_id, rune.id, image)
  } else if (image === null && rune.image_url) {
    await removeRuneImage(rune.sheet_id, rune.id)
    imageUrl = null
  }
  return updateRuneRow(rune.id, { ...input, image_url: imageUrl })
}

async function updateRuneRow(id: string, data: Partial<AltheriumRune>): Promise<AltheriumRune> {
  const { data: updated, error } = await supabase
    .from('altherium_runaskin_runes')
    .update(data)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível salvar a runa.')
  return updated as AltheriumRune
}

/** Exclui a runa e a foto dela, se houver. */
export async function deleteAltheriumRune(rune: AltheriumRune): Promise<void> {
  if (rune.image_url) await removeRuneImage(rune.sheet_id, rune.id)

  const { error } = await supabase
    .from('altherium_runaskin_runes')
    .delete()
    .eq('id', rune.id)

  if (error) throw new Error('Não foi possível excluir a runa.')
}
