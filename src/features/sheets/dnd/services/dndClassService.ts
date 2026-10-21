import { supabase } from '../../../../shared/lib/supabase'
import type { DndCharacterClass } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Classes do personagem (dnd_character_classes, migration 20240204000000).
// Uma linha por classe; multiclasse = várias linhas. O banco confere a soma
// dos níveis (até 20), uma classe inicial só e mantém level/class_key da ficha.
// ────────────────────────────────────────────────────────

const TABLE = 'dnd_character_classes'

export type DndClassInput = Pick<DndCharacterClass, 'class_key' | 'level'>
  & Partial<Pick<DndCharacterClass, 'subclass_key' | 'is_initial' | 'hp_rolls'>>

export async function listDndClasses(sheetId: string): Promise<DndCharacterClass[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('sheet_id', sheetId)
    .order('is_initial', { ascending: false })
    .order('created_at', { ascending: true })
  if (error) throw new Error('Não foi possível carregar as classes do personagem.')
  return (data ?? []) as DndCharacterClass[]
}

/** Cria a classe ou atualiza a que já existe na ficha (a chave é a classe). */
export async function saveDndClass(sheetId: string, input: DndClassInput): Promise<DndCharacterClass> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({ sheet_id: sheetId, ...input }, { onConflict: 'sheet_id,class_key' })
    .select('*')
    .single()
  if (error) {
    if (error.message.includes('nível 20')) throw new Error('O personagem não passa do nível 20 (soma dos níveis das classes).')
    throw new Error('Não foi possível salvar a classe.')
  }
  return data as DndCharacterClass
}

export async function removeDndClass(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error('Não foi possível remover a classe.')
}
