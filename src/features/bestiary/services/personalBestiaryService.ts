import { supabase } from '../../../shared/lib/supabase'
import { createCreature } from './bestiaryService'
import type { AltheriumCreature, PersonalCreature } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Meu bestiário — tabela user_bestiary (RLS: só o dono). Criaturas
// guardadas fora das campanhas, pra levar pro bestiário de qualquer uma.
// ────────────────────────────────────────────────────────

export type PersonalCreatureInput = Pick<PersonalCreature, 'name' | 'hp' | 'damage_dice' | 'notes'>

/** Padrões do bestiário da campanha pra criatura escrita à mão. */
const DEFAULT_ROUNDS = 4
const DEFAULT_DANGER = 25

function normalize(row: PersonalCreature): PersonalCreature {
  return {
    ...row,
    party_damage: row.party_damage == null ? null : Number(row.party_damage),
    party_avg_hp: row.party_avg_hp == null ? null : Number(row.party_avg_hp),
  }
}

export async function getMyCreatures(): Promise<PersonalCreature[]> {
  const { data, error } = await supabase
    .from('user_bestiary')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw new Error('Não foi possível carregar seu bestiário.')
  return ((data ?? []) as PersonalCreature[]).map(normalize)
}

export async function createMyCreature(input: PersonalCreatureInput): Promise<PersonalCreature> {
  const { data, error } = await supabase
    .from('user_bestiary')
    .insert(input)
    .select('*')
    .single()

  if (error || !data) throw new Error('Não foi possível salvar a criatura.')
  return normalize(data as PersonalCreature)
}

export async function updateMyCreature(id: string, input: PersonalCreatureInput): Promise<PersonalCreature> {
  const { data, error } = await supabase
    .from('user_bestiary')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) throw new Error('Não foi possível salvar a criatura.')
  return normalize(data as PersonalCreature)
}

export async function deleteMyCreature(id: string): Promise<void> {
  const { error } = await supabase.from('user_bestiary').delete().eq('id', id)
  if (error) throw new Error('Não foi possível excluir a criatura.')
}

/** "Guardar" no bestiário de uma campanha: leva uma cópia pro Meu bestiário. */
export async function saveCampaignCreatureToMine(creature: AltheriumCreature): Promise<PersonalCreature> {
  const { data, error } = await supabase
    .from('user_bestiary')
    .insert({
      name:         creature.name,
      hp:           creature.hp,
      damage_dice:  creature.damage_dice,
      rounds:       creature.rounds,
      danger_pct:   creature.danger_pct,
      party_damage: creature.party_damage,
      party_avg_hp: creature.party_avg_hp,
      notes:        creature.notes,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error('Não foi possível guardar a criatura.')
  return normalize(data as PersonalCreature)
}

/** Copia uma criatura do Meu bestiário pro bestiário de uma campanha. */
export async function copyMyCreatureToCampaign(creature: PersonalCreature, campaignId: string): Promise<AltheriumCreature> {
  return createCreature(campaignId, {
    name:         creature.name,
    hp:           creature.hp,
    damage_dice:  creature.damage_dice,
    rounds:       creature.rounds ?? DEFAULT_ROUNDS,
    danger_pct:   creature.danger_pct ?? DEFAULT_DANGER,
    party_damage: creature.party_damage,
    party_avg_hp: creature.party_avg_hp,
    notes:        creature.notes,
  })
}
