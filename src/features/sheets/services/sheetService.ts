import { supabase } from '../../../shared/lib/supabase'
import type { CharacterSheet, ProfilePublic, SheetWithProfile } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────

export type SheetUpdateData = {
  character_name?: string | null
  archetype?: string | null
  level?: number
  hp_current?: number
  hp_max?: number
  strength?: number
  dexterity?: number
  constitution?: number
  intelligence?: number
  wisdom?: number
  charisma?: number
  notes?: string | null
}

interface RawSheetWithProfile extends CharacterSheet {
  profiles: ProfilePublic
}

// ────────────────────────────────────────────────────────
// Sheet Service
// ────────────────────────────────────────────────────────

/**
 * Busca a ficha do usuário autenticado na campanha.
 * Retorna null se ainda não existir.
 */
export async function getMySheet(campaignId: string): Promise<CharacterSheet | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('character_sheets')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // ficha não existe
    throw new Error('Não foi possível carregar a ficha.')
  }

  return data as CharacterSheet
}

/**
 * Cria a ficha do usuário autenticado na campanha com valores padrão.
 * A RLS impede criar ficha para outro usuário.
 */
export async function createMySheet(campaignId: string): Promise<CharacterSheet> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('character_sheets')
    .insert({ campaign_id: campaignId, user_id: user.id })
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível criar a ficha.')
  return data as CharacterSheet
}

/**
 * Retorna a ficha do usuário na campanha, criando-a se não existir.
 */
export async function getOrCreateMySheet(campaignId: string): Promise<CharacterSheet> {
  const existing = await getMySheet(campaignId)
  if (existing) return existing
  return createMySheet(campaignId)
}

/**
 * Atualiza uma ficha pelo id.
 * A RLS permite: dono atualiza a própria; mestre atualiza qualquer ficha da campanha.
 */
export async function updateSheet(
  sheetId: string,
  data: SheetUpdateData
): Promise<CharacterSheet> {
  const { data: updated, error } = await supabase
    .from('character_sheets')
    .update(data)
    .eq('id', sheetId)
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível salvar a ficha.')
  return updated as CharacterSheet
}

/**
 * Lista todas as fichas de uma campanha com perfil do dono.
 * Disponível apenas para o mestre (a RLS de select garante isso).
 */
export async function getCampaignSheets(campaignId: string): Promise<SheetWithProfile[]> {
  const { data, error } = await supabase
    .from('character_sheets')
    .select('*, profiles(id, display_name, email, avatar_url)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })

  if (error) throw new Error('Não foi possível carregar as fichas da campanha.')
  if (!data || data.length === 0) return []

  return (data as unknown as RawSheetWithProfile[]).map((row) => ({
    id:             row.id,
    campaign_id:    row.campaign_id,
    user_id:        row.user_id,
    character_name: row.character_name,
    archetype:      row.archetype,
    level:          row.level,
    hp_current:     row.hp_current,
    hp_max:         row.hp_max,
    strength:       row.strength,
    dexterity:      row.dexterity,
    constitution:   row.constitution,
    intelligence:   row.intelligence,
    wisdom:         row.wisdom,
    charisma:       row.charisma,
    notes:          row.notes,
    created_at:     row.created_at,
    updated_at:     row.updated_at,
    profile:        row.profiles,
  }))
}
