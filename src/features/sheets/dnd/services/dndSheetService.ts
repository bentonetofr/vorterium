// ────────────────────────────────────────────────────────
// Serviço — Ficha D&D 5e
// ────────────────────────────────────────────────────────

import { supabase, uniqueChannel } from '../../../../shared/lib/supabase'
import { pcOnly } from '../../services/npcService'
import { logActivity } from '../../../activity/services/activityService'
import type {
  DndCharacterAttack,
  DndCharacterAttackInput,
  DndCharacterClass,
  DndCharacterProficiency,
  DndCharacterOverride,
  DndCharacterInventoryInput,
  DndCharacterInventoryItem,
  DndCharacterSkill,
  DndCharacterSheet,
  DndCharacterSheetUpdateInput,
  DndCharacterSpell,
  DndCharacterSpellInput,
  DndDerivedField,
  DndRuleCatalogEntry,
  DndSheetDetails,
  ProfilePublic,
} from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Tipos auxiliares
// ────────────────────────────────────────────────────────

export interface DndSheetWithProfile extends DndCharacterSheet {
  profile: ProfilePublic
}

interface RawDndSheetWithProfile extends DndCharacterSheet {
  profiles: ProfilePublic
}

// ────────────────────────────────────────────────────────
// Leitura
// ────────────────────────────────────────────────────────

/**
 * Busca a ficha D&D 5e do usuário autenticado na campanha.
 * Retorna null se a ficha ainda não existir.
 */
export async function getMyDndSheet(
  campaignId: string
): Promise<DndCharacterSheet | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('dnd_character_sheets')
    .select('*')
    .match(await pcOnly())
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null   // ficha não existe
    throw new Error('Não foi possível carregar a ficha.')
  }

  return data as DndCharacterSheet
}

/**
 * Cria uma ficha D&D 5e vazia para o usuário autenticado na campanha.
 * A RLS impede criar ficha para outro usuário ou em campanha que não seja dnd5e.
 */
async function createMyDndSheet(
  campaignId: string
): Promise<DndCharacterSheet> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('dnd_character_sheets')
    .insert({ campaign_id: campaignId, user_id: user.id })
    .select('*')
    .single()

  if (error) {
    console.error('Erro ao criar/carregar ficha D&D', error)
    throw new Error('Não foi possível criar a ficha D&D.')
  }
  return data as DndCharacterSheet
}

/**
 * Retorna a ficha D&D do usuário na campanha, criando-a se não existir.
 */
export async function ensureMyDndSheet(
  campaignId: string
): Promise<DndCharacterSheet> {
  const existing = await getMyDndSheet(campaignId)
  if (existing) return existing
  return createMyDndSheet(campaignId)
}

/**
 * Lista todas as fichas D&D de uma campanha com o perfil do dono.
 * Disponível apenas para o mestre (a RLS de SELECT garante isso).
 */
export async function getCampaignDndSheets(
  campaignId: string
): Promise<DndSheetWithProfile[]> {
  const { data, error } = await supabase
    .from('dnd_character_sheets')
    .select('*, profiles(id, display_name, email, avatar_url)')
    .match(await pcOnly())
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })

  if (error) throw new Error('Não foi possível carregar as fichas da campanha.')
  if (!data || data.length === 0) return []

  return (data as unknown as RawDndSheetWithProfile[]).map((row) => {
    const { profiles, ...sheet } = row
    return { ...sheet, profile: profiles }
  })
}

// ────────────────────────────────────────────────────────
// Escrita
// ────────────────────────────────────────────────────────

/**
 * Atualiza uma ficha D&D 5e pelo id.
 * Registra atividade sheet_updated de forma fire-and-forget.
 */
export async function updateDndSheet(
  sheetId:     string,
  updates:     DndCharacterSheetUpdateInput,
  campaignId:  string,
  charName?:   string | null
): Promise<DndCharacterSheet> {
  const { data, error } = await supabase
    .from('dnd_character_sheets')
    .update(updates)
    .eq('id', sheetId)
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível salvar a ficha.')

  const sheet    = data as DndCharacterSheet
  const name     = charName?.trim() || sheet.character_name?.trim()
  const message  = name ? `Ficha de "${name}" atualizada.` : 'Ficha D&D atualizada.'
  // NPC não vai pro histórico: o nome escondido não pode vazar pros jogadores.
  if (!sheet.is_npc) logActivity(campaignId, 'sheet_updated', message)

  return sheet
}

/** Carrega os blocos repetíveis da ficha D&D. */
export async function getDndSheetDetails(sheetId: string): Promise<DndSheetDetails> {
  const [skills, attacks, inventory, spells, overrides] = await Promise.all([
    supabase.from('dnd_character_skills').select('*').eq('sheet_id', sheetId),
    supabase.from('dnd_character_attacks').select('*').eq('sheet_id', sheetId).order('sort_order', { ascending: true }),
    supabase.from('dnd_character_inventory').select('*').eq('sheet_id', sheetId).order('sort_order', { ascending: true }),
    supabase.from('dnd_character_spells').select('*').eq('sheet_id', sheetId).order('spell_level', { ascending: true }).order('sort_order', { ascending: true }),
    supabase.from('dnd_character_overrides').select('*').eq('sheet_id', sheetId),
  ])

  const firstError = [skills, attacks, inventory, spells, overrides].find((result) => result.error)?.error
  if (firstError) {
    console.error('Erro ao carregar detalhes da ficha D&D:', firstError)
    throw new Error('Não foi possível carregar os detalhes da ficha D&D.')
  }

  return {
    skills: (skills.data ?? []) as DndCharacterSkill[],
    attacks: (attacks.data ?? []) as DndCharacterAttack[],
    inventory: (inventory.data ?? []) as DndCharacterInventoryItem[],
    spells: (spells.data ?? []) as DndCharacterSpell[],
    overrides: (overrides.data ?? []) as DndCharacterOverride[],
  }
}

/** Cria ou atualiza a exceção manual de um campo calculado. */
export async function saveDndOverride(
  sheetId: string,
  fieldKey: DndDerivedField,
  manualValue: string,
  reason = '',
): Promise<DndCharacterOverride> {
  const { data, error } = await supabase
    .from('dnd_character_overrides')
    .upsert({ sheet_id: sheetId, field_key: fieldKey, manual_value: manualValue, reason }, { onConflict: 'sheet_id,field_key' })
    .select('*')
    .single()
  if (error) throw new Error('Não foi possível salvar o modo manual.')
  return data as DndCharacterOverride
}

/** Grava vários campos manuais de uma vez (os grupos do botão Automatizar: 6 modificadores, 18 perícias...). */
export async function saveDndOverrides(
  sheetId: string,
  entries: readonly { field: DndDerivedField; value: number }[],
): Promise<DndCharacterOverride[]> {
  if (entries.length === 0) return []
  const rows = entries.map((e) => ({ sheet_id: sheetId, field_key: e.field, manual_value: String(e.value), reason: '' }))
  const { data, error } = await supabase
    .from('dnd_character_overrides')
    .upsert(rows, { onConflict: 'sheet_id,field_key' })
    .select('*')
  if (error) throw new Error('Não foi possível salvar o modo manual.')
  return (data ?? []) as DndCharacterOverride[]
}

/** Devolve vários campos ao cálculo do livro de uma vez. */
export async function removeDndOverrides(sheetId: string, fields: readonly DndDerivedField[]): Promise<void> {
  if (fields.length === 0) return
  const { error } = await supabase
    .from('dnd_character_overrides')
    .delete()
    .eq('sheet_id', sheetId)
    .in('field_key', [...fields])
  if (error) throw new Error('Não foi possível voltar ao modo automático.')
}

/** Remove a exceção e devolve o campo ao cálculo do livro. */
export async function removeDndOverride(sheetId: string, fieldKey: DndDerivedField): Promise<void> {
  const { error } = await supabase
    .from('dnd_character_overrides')
    .delete()
    .eq('sheet_id', sheetId)
    .eq('field_key', fieldKey)
  if (error) throw new Error('Não foi possível restaurar o cálculo automático.')
}

/** Lista registros ativos do catálogo oficial para os editores da ficha. */
export async function getDndCatalogEntries(
  categories: DndRuleCatalogEntry['category'][]
): Promise<DndRuleCatalogEntry[]> {
  const { data, error } = await supabase
    .from('dnd_rule_catalog_entries')
    .select('*')
    .eq('ruleset', 'dnd5e_2014')
    .eq('is_active', true)
    .in('category', categories)
    .order('sort_order', { ascending: true })

  if (error) throw new Error('Não foi possível carregar o catálogo D&D.')
  return (data ?? []) as DndRuleCatalogEntry[]
}

/** Salva todas as proficiências exibidas na grade de perícias. */
export async function upsertDndSkill(
  sheetId: string,
  skillKey: string,
  proficient: boolean,
  expertise: boolean,
): Promise<DndCharacterSkill> {
  const { data, error } = await supabase
    .from('dnd_character_skills')
    .upsert({ sheet_id: sheetId, skill_key: skillKey, proficient, expertise }, { onConflict: 'sheet_id,skill_key' })
    .select('*')
    .single()
  if (error) throw new Error('Não foi possível salvar a perícia.')
  return data as DndCharacterSkill
}

export async function createDndAttack(sheetId: string, input: DndCharacterAttackInput): Promise<DndCharacterAttack> {
  const { data, error } = await supabase.from('dnd_character_attacks').insert({ sheet_id: sheetId, ...input }).select('*').single()
  if (error) throw new Error('Não foi possível adicionar o ataque.')
  return data as DndCharacterAttack
}

export async function updateDndAttack(id: string, input: Partial<DndCharacterAttackInput>): Promise<DndCharacterAttack> {
  const { data, error } = await supabase.from('dnd_character_attacks').update(input).eq('id', id).select('*').single()
  if (error) throw new Error('Não foi possível atualizar o ataque.')
  return data as DndCharacterAttack
}

export async function deleteDndAttack(id: string): Promise<void> {
  const { error } = await supabase.from('dnd_character_attacks').delete().eq('id', id)
  if (error) throw new Error('Não foi possível remover o ataque.')
}

export async function createDndInventoryItem(sheetId: string, input: DndCharacterInventoryInput): Promise<DndCharacterInventoryItem> {
  const { data, error } = await supabase.from('dnd_character_inventory').insert({ sheet_id: sheetId, ...input }).select('*').single()
  if (error) throw new Error('Não foi possível adicionar o item.')
  return data as DndCharacterInventoryItem
}

export async function updateDndInventoryItem(id: string, input: Partial<DndCharacterInventoryInput>): Promise<DndCharacterInventoryItem> {
  const { data, error } = await supabase.from('dnd_character_inventory').update(input).eq('id', id).select('*').single()
  if (error) throw new Error('Não foi possível atualizar o item.')
  return data as DndCharacterInventoryItem
}

export async function deleteDndInventoryItem(id: string): Promise<void> {
  const { error } = await supabase.from('dnd_character_inventory').delete().eq('id', id)
  if (error) throw new Error('Não foi possível remover o item.')
}

export async function createDndSpell(sheetId: string, input: DndCharacterSpellInput): Promise<DndCharacterSpell> {
  const { data, error } = await supabase.from('dnd_character_spells').insert({ sheet_id: sheetId, ...input }).select('*').single()
  if (error) throw new Error('Não foi possível adicionar a magia.')
  return data as DndCharacterSpell
}

export async function updateDndSpell(id: string, input: Partial<DndCharacterSpellInput>): Promise<DndCharacterSpell> {
  const { data, error } = await supabase.from('dnd_character_spells').update(input).eq('id', id).select('*').single()
  if (error) throw new Error('Não foi possível atualizar a magia.')
  return data as DndCharacterSpell
}

export async function deleteDndSpell(id: string): Promise<void> {
  const { error } = await supabase.from('dnd_character_spells').delete().eq('id', id)
  if (error) throw new Error('Não foi possível remover a magia.')
}


// ────────────────────────────────────────────────────────
// Ficha nova (Marco 3): proficiências extras, "minhas fichas", Realtime
// ────────────────────────────────────────────────────────

/** Proficiências extras da ficha (armas, armaduras, ferramentas e idiomas além dos de classe e raça). */
export async function listDndProficiencies(sheetId: string): Promise<DndCharacterProficiency[]> {
  const { data, error } = await supabase.from('dnd_character_proficiencies').select('*').eq('sheet_id', sheetId)
  if (error) throw new Error('Não foi possível carregar as proficiências da ficha.')
  return (data ?? []) as DndCharacterProficiency[]
}

export async function addDndProficiency(
  sheetId: string, category: DndCharacterProficiency['category'], entryKey: string, label: string, source = 'manual',
): Promise<DndCharacterProficiency> {
  const { data, error } = await supabase
    .from('dnd_character_proficiencies')
    .upsert({ sheet_id: sheetId, category, entry_key: entryKey, label, source }, { onConflict: 'sheet_id,category,entry_key' })
    .select('*')
    .single()
  if (error) throw new Error('Não foi possível adicionar a proficiência.')
  return data as DndCharacterProficiency
}

export async function removeDndProficiency(id: string): Promise<void> {
  const { error } = await supabase.from('dnd_character_proficiencies').delete().eq('id', id)
  if (error) throw new Error('Não foi possível remover a proficiência.')
}

/** Fichas D&D do usuário em todas as campanhas ("Minhas fichas"). */
export async function getMyDndSheetsEverywhere(): Promise<(DndCharacterSheet & { campaign_name: string })[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('dnd_character_sheets')
    .select('*, campaigns(id, name)')
    .match(await pcOnly())
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  // Sem a migration ou com o recurso guardado: nenhuma ficha (a página não quebra por isso).
  if (error) return []
  return ((data ?? []) as unknown as (DndCharacterSheet & { campaigns: { id: string; name: string } | null })[])
    .filter((row) => row.campaigns != null)
    .map(({ campaigns, ...sheet }) => ({ ...sheet, campaign_name: campaigns!.name }))
}

/** Classes de várias fichas de uma vez (pros cards do mestre). */
export async function listDndClassesForSheets(sheetIds: string[]): Promise<DndCharacterClass[]> {
  if (sheetIds.length === 0) return []
  const { data, error } = await supabase.from('dnd_character_classes').select('*').in('sheet_id', sheetIds)
  // Sem a migration: os cards só ficam sem a linha de classe.
  if (error) return []
  return (data ?? []) as DndCharacterClass[]
}

/**
 * Mudanças nas fichas da campanha (Realtime, respeita a RLS). UPDATE traz a
 * linha inteira sem o perfil: quem chama mescla. INSERT e DELETE pedem
 * recarregar a lista.
 */
export function subscribeToCampaignDndSheets(
  campaignId: string,
  onSheetUpdate: (sheet: DndCharacterSheet) => void,
  onListChange: () => void,
): () => void {
  const table = 'dnd_character_sheets'
  const channel = supabase
    .channel(uniqueChannel(`dnd_sheets:${campaignId}`))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `campaign_id=eq.${campaignId}` },
      (payload) => onSheetUpdate(payload.new as DndCharacterSheet))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `campaign_id=eq.${campaignId}` },
      () => onListChange())
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table, filter: `campaign_id=eq.${campaignId}` },
      () => onListChange())
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

/** Qualquer mudança nas classes (o banco manda só o que a pessoa pode ver): quem chama recarrega. */
export function subscribeToDndClasses(onChange: () => void): () => void {
  const channel = supabase
    .channel(uniqueChannel('dnd_classes'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dnd_character_classes' }, () => onChange())
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}
