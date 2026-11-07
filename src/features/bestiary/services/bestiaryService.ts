import { supabase } from '../../../shared/lib/supabase'
import { getCampaignAltheriumSheets } from '../../sheets/altherium/services/altheriumSheetService'
import { bestWeapon, type WeaponPick } from '../utils/bestiaryCalculations'
import type { AltheriumCreature, AltheriumInventoryItem } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Bestiário do mestre — tabela altherium_bestiary (RLS: só o mestre).
// ────────────────────────────────────────────────────────

export type CreatureInput = Pick<
  AltheriumCreature,
  'name' | 'hp' | 'damage_dice' | 'rounds' | 'danger_pct' | 'party_damage' | 'party_avg_hp' | 'notes'
>

function normalize(row: AltheriumCreature): AltheriumCreature {
  // numeric chega do PostgREST como número ou texto, conforme a versão.
  return {
    ...row,
    party_damage: row.party_damage == null ? null : Number(row.party_damage),
    party_avg_hp: row.party_avg_hp == null ? null : Number(row.party_avg_hp),
  }
}

export async function getBestiary(campaignId: string): Promise<AltheriumCreature[]> {
  const { data, error } = await supabase
    .from('altherium_bestiary')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })

  if (error) throw new Error('Não foi possível carregar o bestiário.')
  return ((data ?? []) as AltheriumCreature[]).map(normalize)
}

export async function createCreature(campaignId: string, input: CreatureInput): Promise<AltheriumCreature> {
  const { data, error } = await supabase
    .from('altherium_bestiary')
    .insert({ ...input, campaign_id: campaignId })
    .select('*')
    .single()

  if (error || !data) throw new Error('Não foi possível salvar a criatura.')
  return normalize(data as AltheriumCreature)
}

export async function updateCreature(id: string, input: CreatureInput): Promise<AltheriumCreature> {
  const { data, error } = await supabase
    .from('altherium_bestiary')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) throw new Error('Não foi possível salvar a criatura.')
  return normalize(data as AltheriumCreature)
}

export async function deleteCreature(id: string): Promise<void> {
  const { error } = await supabase.from('altherium_bestiary').delete().eq('id', id)
  if (error) throw new Error('Não foi possível excluir a criatura.')
}

// ── Grupo (base das contas) ──────────────────────────────

export interface PartyMember {
  sheetId:    string
  userId:     string
  character:  string
  player:     string | null
  /** Vitalidade máxima da ficha — o "HP" da regra. */
  hp:         number
  weapon:     WeaponPick | null
}

/** Fichas Altherium da campanha com a vida máxima e a melhor arma de cada uma. */
export async function getPartyMembers(campaignId: string): Promise<PartyMember[]> {
  const sheets = await getCampaignAltheriumSheets(campaignId)
  if (sheets.length === 0) return []

  const { data, error } = await supabase
    .from('altherium_character_inventory')
    .select('*')
    .in('sheet_id', sheets.map((s) => s.id))
    .eq('item_type', 'arma')

  if (error) throw new Error('Não foi possível carregar as armas do grupo.')

  const weaponsBySheet = new Map<string, AltheriumInventoryItem[]>()
  for (const item of (data ?? []) as AltheriumInventoryItem[]) {
    const list = weaponsBySheet.get(item.sheet_id) ?? []
    list.push(item)
    weaponsBySheet.set(item.sheet_id, list)
  }

  return sheets.map((sheet) => ({
    sheetId:   sheet.id,
    userId:    sheet.user_id,
    character: sheet.character_name?.trim() || 'Sem nome',
    player:    sheet.profile?.display_name ?? null,
    hp:        sheet.vitality_max,
    weapon:    bestWeapon(weaponsBySheet.get(sheet.id) ?? []),
  }))
}
