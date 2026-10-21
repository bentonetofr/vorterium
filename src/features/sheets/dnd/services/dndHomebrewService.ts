import { supabase } from '../../../../shared/lib/supabase'
import type { DndHomebrewCategory, DndHomebrewEntry, DndHomebrewStatus } from '../../../../shared/types'
export { homebrewKeyFromName } from '../catalog/homebrewKey'

// ────────────────────────────────────────────────────────
// Homebrew da campanha (dnd_homebrew_entries, migration 20240205000000).
// Mestre e jogadores criam. Fluxo: personal (só o autor) -> pending (proposto)
// -> approved (todos da campanha) ou volta pra personal com um recado do
// mestre. Quem pode o quê é decidido pela RLS e por um gatilho no banco.
// ────────────────────────────────────────────────────────

const TABLE = 'dnd_homebrew_entries'

export interface DndHomebrewInput {
  category:  DndHomebrewCategory
  entry_key: string
  name:      string
  data?:     Record<string, unknown>
  /** Jogador: personal ou pending. Mestre: também approved (criado direto aprovado). */
  status?:   DndHomebrewStatus
}

/** O que a pessoa pode ver: o mestre vê tudo; o jogador, o dele e o aprovado. */
export async function listDndHomebrew(campaignId: string): Promise<DndHomebrewEntry[]> {
  const { data, error } = await supabase
    .from(TABLE).select('*').eq('campaign_id', campaignId).order('name', { ascending: true })
  if (error) throw new Error('Não foi possível carregar o homebrew da campanha.')
  return (data ?? []) as DndHomebrewEntry[]
}

export async function createDndHomebrew(campaignId: string, input: DndHomebrewInput): Promise<DndHomebrewEntry> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ campaign_id: campaignId, data: {}, status: 'personal', ...input })
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Já existe um homebrew com essa chave nessa categoria.')
    throw new Error(error.message.includes('Limite') ? 'Limite de 300 itens de homebrew por pessoa na campanha.' : 'Não foi possível criar o homebrew.')
  }
  return data as DndHomebrewEntry
}

export async function updateDndHomebrew(id: string, patch: Partial<Pick<DndHomebrewEntry, 'name' | 'data'>>): Promise<DndHomebrewEntry> {
  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select('*').single()
  if (error) throw new Error('Não foi possível salvar o homebrew (um item já aprovado só o mestre altera).')
  return data as DndHomebrewEntry
}

async function setStatus(id: string, status: DndHomebrewStatus, extra: Record<string, unknown> = {}): Promise<DndHomebrewEntry> {
  const { data, error } = await supabase.from(TABLE).update({ status, ...extra }).eq('id', id).select('*').single()
  if (error) throw new Error('Não foi possível mudar a situação do homebrew.')
  return data as DndHomebrewEntry
}

/** Autor: propõe o item à campanha (o mestre decide). */
export const proposeDndHomebrew  = (id: string) => setStatus(id, 'pending')
/** Autor: retira a proposta e volta a usar só na própria ficha. */
export const withdrawDndHomebrew = (id: string) => setStatus(id, 'personal')
/** Mestre: aprova, e o item passa a valer pra campanha toda. */
export const approveDndHomebrew  = (id: string) => setStatus(id, 'approved')
/** Mestre: recusa, volta pra pessoal com um recado ao autor. */
export const rejectDndHomebrew   = (id: string, note: string) => setStatus(id, 'personal', { review_note: note.trim().slice(0, 500) || null })

export async function deleteDndHomebrew(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error('Não foi possível apagar o homebrew (um item já aprovado só o mestre apaga).')
}
