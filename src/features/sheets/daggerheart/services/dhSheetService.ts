// ────────────────────────────────────────────────────────
// Serviço — Ficha DaggerHeart
// CRUD completo para dh_character_sheets e tabelas filhas.
// ────────────────────────────────────────────────────────

import { supabase } from '../../../../shared/lib/supabase'
import { getDhClass } from '../catalog/classes'
import type {
  DhCharacterSheet,
  DhDomainCard,
  DhDomainCardInput,
  DhExperience,
  DhExperienceInput,
  DhFullSheet,
  DhInventoryItem,
  DhInventoryItemInput,
  DhSheetUpdateInput,
  DhWeapon,
  DhWeaponInput,
  DhClassKey,
} from '../rules/types'
import { DH_HOPE_START, DH_STRESS_START } from '../constants/daggerheart'

// ── Leitura ───────────────────────────────────────────────

export async function getMyDhSheet(
  campaignId: string,
): Promise<DhCharacterSheet | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('dh_character_sheets')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw new Error('Não foi possível carregar a ficha.')
  return data as DhCharacterSheet | null
}

export async function getDhSheetsByCampaign(
  campaignId: string,
): Promise<DhCharacterSheet[]> {
  const { data, error } = await supabase
    .from('dh_character_sheets')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at')

  if (error) throw new Error('Não foi possível carregar as fichas.')
  return (data ?? []) as DhCharacterSheet[]
}

/** Carrega a ficha completa com todas as tabelas filhas. */
export async function getMyFullDhSheet(
  campaignId: string,
): Promise<DhFullSheet | null> {
  const sheet = await getMyDhSheet(campaignId)
  if (!sheet) return null

  const [expRes, cardsRes, weaponsRes, invRes] = await Promise.all([
    supabase.from('dh_experiences').select('*').eq('sheet_id', sheet.id).order('sort_order'),
    supabase.from('dh_domain_cards').select('*').eq('sheet_id', sheet.id),
    supabase.from('dh_weapons').select('*').eq('sheet_id', sheet.id),
    supabase.from('dh_inventory').select('*').eq('sheet_id', sheet.id).order('sort_order'),
  ])

  if (expRes.error)     throw new Error('Erro ao carregar experiências.')
  if (cardsRes.error)   throw new Error('Erro ao carregar cartas de domínio.')
  if (weaponsRes.error) throw new Error('Erro ao carregar armas.')
  if (invRes.error)     throw new Error('Erro ao carregar inventário.')

  return {
    sheet,
    experiences: (expRes.data ?? []) as DhExperience[],
    cards:       (cardsRes.data ?? []) as DhDomainCard[],
    weapons:     (weaponsRes.data ?? []) as DhWeapon[],
    inventory:   (invRes.data ?? []) as DhInventoryItem[],
  }
}

// ── Criação ───────────────────────────────────────────────

/**
 * Cria uma ficha DaggerHeart vazia com os valores default da classe escolhida.
 * As duas experiências iniciais (modifier +2) são criadas junto.
 */
export async function createMyDhSheet(
  campaignId: string,
  classKey:   DhClassKey = 'warrior',
): Promise<DhFullSheet> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const cls = getDhClass(classKey)

  const { data: sheet, error } = await supabase
    .from('dh_character_sheets')
    .insert({
      campaign_id:    campaignId,
      user_id:        user.id,
      class_key:      classKey,
      level:          1,
      proficiency:    1,
      evasion:        cls.evasion,
      hp_current:     cls.hp_max,
      hp_max:         cls.hp_max,
      stress_current: 0,
      stress_max:     DH_STRESS_START,
      hope:           DH_HOPE_START,
      spellcast_trait: cls.spellcast_trait ?? null,
      armor_base_major:  3,
      armor_base_severe: 7,
      armor_score:       0,
      armor_score_current: 0,
      gold_handfuls: 1,
    })
    .select()
    .single()

  if (error || !sheet) throw new Error('Não foi possível criar a ficha.')

  const typedSheet = sheet as DhCharacterSheet

  // Cria as 2 experiências padrão (labels em branco para o jogador preencher)
  const { data: exps, error: expErr } = await supabase
    .from('dh_experiences')
    .insert([
      { sheet_id: typedSheet.id, label: '', modifier: 2, sort_order: 0 },
      { sheet_id: typedSheet.id, label: '', modifier: 2, sort_order: 1 },
    ])
    .select()

  if (expErr) throw new Error('Não foi possível criar as experiências iniciais.')

  return {
    sheet:       typedSheet,
    experiences: (exps ?? []) as DhExperience[],
    cards:       [],
    weapons:     [],
    inventory:   [],
  }
}

// ── Atualização da ficha principal ────────────────────────

export async function updateDhSheet(
  sheetId: string,
  patch:   DhSheetUpdateInput,
): Promise<DhCharacterSheet> {
  const { data, error } = await supabase
    .from('dh_character_sheets')
    .update(patch)
    .eq('id', sheetId)
    .select()
    .single()

  if (error || !data) throw new Error('Não foi possível atualizar a ficha.')
  return data as DhCharacterSheet
}

// ── Experiências ──────────────────────────────────────────

export async function addDhExperience(
  sheetId: string,
  input:   DhExperienceInput,
): Promise<DhExperience> {
  const { data, error } = await supabase
    .from('dh_experiences')
    .insert({ sheet_id: sheetId, ...input })
    .select()
    .single()

  if (error || !data) throw new Error('Não foi possível adicionar a experiência.')
  return data as DhExperience
}

export async function updateDhExperience(
  id:    string,
  patch: Partial<DhExperienceInput>,
): Promise<DhExperience> {
  const { data, error } = await supabase
    .from('dh_experiences')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) throw new Error('Não foi possível atualizar a experiência.')
  return data as DhExperience
}

export async function deleteDhExperience(id: string): Promise<void> {
  const { error } = await supabase.from('dh_experiences').delete().eq('id', id)
  if (error) throw new Error('Não foi possível remover a experiência.')
}

// ── Cartas de Domínio ─────────────────────────────────────

export async function addDhDomainCard(
  sheetId: string,
  input:   DhDomainCardInput,
): Promise<DhDomainCard> {
  const { data, error } = await supabase
    .from('dh_domain_cards')
    .insert({ sheet_id: sheetId, is_equipped: true, card_level: 1, ...input })
    .select()
    .single()

  if (error || !data) throw new Error('Não foi possível adicionar a carta de domínio.')
  return data as DhDomainCard
}

export async function updateDhDomainCard(
  id:    string,
  patch: Partial<DhDomainCardInput & { is_equipped: boolean }>,
): Promise<DhDomainCard> {
  const { data, error } = await supabase
    .from('dh_domain_cards')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) throw new Error('Não foi possível atualizar a carta de domínio.')
  return data as DhDomainCard
}

export async function deleteDhDomainCard(id: string): Promise<void> {
  const { error } = await supabase.from('dh_domain_cards').delete().eq('id', id)
  if (error) throw new Error('Não foi possível remover a carta de domínio.')
}

// ── Armas ─────────────────────────────────────────────────

export async function addDhWeapon(
  sheetId: string,
  input:   DhWeaponInput,
): Promise<DhWeapon> {
  const { data, error } = await supabase
    .from('dh_weapons')
    .insert({ sheet_id: sheetId, is_primary: true, is_equipped: true, damage_mod: 0, ...input })
    .select()
    .single()

  if (error || !data) throw new Error('Não foi possível adicionar a arma.')
  return data as DhWeapon
}

export async function updateDhWeapon(
  id:    string,
  patch: Partial<DhWeaponInput & { is_primary: boolean; is_equipped: boolean }>,
): Promise<DhWeapon> {
  const { data, error } = await supabase
    .from('dh_weapons')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) throw new Error('Não foi possível atualizar a arma.')
  return data as DhWeapon
}

export async function deleteDhWeapon(id: string): Promise<void> {
  const { error } = await supabase.from('dh_weapons').delete().eq('id', id)
  if (error) throw new Error('Não foi possível remover a arma.')
}

// ── Inventário ────────────────────────────────────────────

export async function addDhInventoryItem(
  sheetId: string,
  input:   DhInventoryItemInput,
): Promise<DhInventoryItem> {
  const { data, error } = await supabase
    .from('dh_inventory')
    .insert({ sheet_id: sheetId, quantity: 1, ...input })
    .select()
    .single()

  if (error || !data) throw new Error('Não foi possível adicionar o item.')
  return data as DhInventoryItem
}

export async function updateDhInventoryItem(
  id:    string,
  patch: Partial<DhInventoryItemInput>,
): Promise<DhInventoryItem> {
  const { data, error } = await supabase
    .from('dh_inventory')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) throw new Error('Não foi possível atualizar o item.')
  return data as DhInventoryItem
}

export async function deleteDhInventoryItem(id: string): Promise<void> {
  const { error } = await supabase.from('dh_inventory').delete().eq('id', id)
  if (error) throw new Error('Não foi possível remover o item.')
}

// ── Realtime ──────────────────────────────────────────────

/**
 * Subscrição em tempo real para mudanças na ficha principal.
 * Retorna a função de cancelamento.
 */
export function subscribeDhSheet(
  sheetId:  string,
  onChange: (sheet: DhCharacterSheet) => void,
): () => void {
  const channel = supabase
    .channel(`dh_sheet_${sheetId}`)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'dh_character_sheets',
        filter: `id=eq.${sheetId}`,
      },
      (payload) => {
        if (payload.new) onChange(payload.new as DhCharacterSheet)
      },
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
