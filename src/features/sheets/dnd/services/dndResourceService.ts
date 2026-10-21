import { supabase } from '../../../../shared/lib/supabase'
import type { DndCharacterFeature, DndCharacterResource } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Recursos (espaços de magia, Fúria, Ki...) e características da ficha
// (dnd_character_resources e dnd_character_features, migration 20240204000000).
// ────────────────────────────────────────────────────────

const RESOURCES = 'dnd_character_resources'
const FEATURES  = 'dnd_character_features'

export type DndResourceInput = Pick<DndCharacterResource, 'key' | 'label'>
  & Partial<Pick<DndCharacterResource, 'current_value' | 'max_value' | 'recharge' | 'source' | 'sort_order'>>

export async function listDndResources(sheetId: string): Promise<DndCharacterResource[]> {
  const { data, error } = await supabase
    .from(RESOURCES).select('*').eq('sheet_id', sheetId).order('sort_order', { ascending: true })
  if (error) throw new Error('Não foi possível carregar os recursos da ficha.')
  return (data ?? []) as DndCharacterResource[]
}

/** Cria o recurso ou atualiza o que já existe com essa chave. */
export async function saveDndResource(sheetId: string, input: DndResourceInput): Promise<DndCharacterResource> {
  const { data, error } = await supabase
    .from(RESOURCES)
    .upsert({ sheet_id: sheetId, ...input }, { onConflict: 'sheet_id,key' })
    .select('*')
    .single()
  if (error) throw new Error('Não foi possível salvar o recurso.')
  return data as DndCharacterResource
}

/** Gasta ou recupera: só muda o valor atual (preso entre 0 e o máximo). */
export async function setDndResourceCurrent(resource: Pick<DndCharacterResource, 'id' | 'max_value'>, value: number): Promise<DndCharacterResource> {
  const clamped = Math.max(0, Math.min(resource.max_value, Math.floor(value)))
  const { data, error } = await supabase
    .from(RESOURCES).update({ current_value: clamped }).eq('id', resource.id).select('*').single()
  if (error) throw new Error('Não foi possível atualizar o recurso.')
  return data as DndCharacterResource
}

export async function removeDndResource(id: string): Promise<void> {
  const { error } = await supabase.from(RESOURCES).delete().eq('id', id)
  if (error) throw new Error('Não foi possível remover o recurso.')
}

export type DndFeatureInput = Pick<DndCharacterFeature, 'source' | 'name'>
  & Partial<Pick<DndCharacterFeature, 'feature_key' | 'level' | 'notes' | 'uses_current' | 'uses_max' | 'recharge' | 'sort_order'>>

export async function listDndFeatures(sheetId: string): Promise<DndCharacterFeature[]> {
  const { data, error } = await supabase
    .from(FEATURES).select('*').eq('sheet_id', sheetId).order('sort_order', { ascending: true }).order('level', { ascending: true })
  if (error) throw new Error('Não foi possível carregar as características da ficha.')
  return (data ?? []) as DndCharacterFeature[]
}

export async function createDndFeature(sheetId: string, input: DndFeatureInput): Promise<DndCharacterFeature> {
  const { data, error } = await supabase
    .from(FEATURES).insert({ sheet_id: sheetId, ...input }).select('*').single()
  if (error) throw new Error('Não foi possível adicionar a característica.')
  return data as DndCharacterFeature
}

export async function updateDndFeature(id: string, input: Partial<DndFeatureInput>): Promise<DndCharacterFeature> {
  const { data, error } = await supabase
    .from(FEATURES).update(input).eq('id', id).select('*').single()
  if (error) throw new Error('Não foi possível atualizar a característica.')
  return data as DndCharacterFeature
}

export async function removeDndFeature(id: string): Promise<void> {
  const { error } = await supabase.from(FEATURES).delete().eq('id', id)
  if (error) throw new Error('Não foi possível remover a característica.')
}
