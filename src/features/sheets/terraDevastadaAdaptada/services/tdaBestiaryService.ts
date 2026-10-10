import { supabase } from '../../../../shared/lib/supabase'
import type { TdaCreature } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Bestiário da campanha — tabela tda_creatures (RLS: só o mestre da
// campanha lê e mexe).
// ────────────────────────────────────────────────────────

export type TdaCreatureInput = Pick<TdaCreature, 'name' | 'kind' | 'damage' | 'toughness' | 'defense' | 'ferocity' | 'notes'>

const TABLE = 'tda_creatures'

export async function getTdaCreatures(campaignId: string): Promise<TdaCreature[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('campaign_id', campaignId)
    .order('name', { ascending: true })

  if (error) throw new Error('Não foi possível carregar o bestiário.')
  return (data ?? []) as TdaCreature[]
}

export async function createTdaCreature(campaignId: string, input: TdaCreatureInput): Promise<TdaCreature> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ campaign_id: campaignId, ...input })
    .select('*')
    .single()

  if (error || !data) throw new Error('Não foi possível salvar a criatura.')
  return data as TdaCreature
}

export async function updateTdaCreature(id: string, input: TdaCreatureInput): Promise<TdaCreature> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(input)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) throw new Error('Não foi possível salvar a criatura.')
  return data as TdaCreature
}

export async function deleteTdaCreature(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error('Não foi possível excluir a criatura.')
}
