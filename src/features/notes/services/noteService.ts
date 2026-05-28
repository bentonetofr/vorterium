import { supabase } from '../../../shared/lib/supabase'
import { logActivity } from '../../activity/services/activityService'
import type { CampaignNote } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────

export interface NoteFormData {
  title:   string
  content: string
}

interface RawNote {
  id:          string
  campaign_id: string
  author_id:   string
  title:       string
  content:     string
  created_at:  string
  updated_at:  string
  profiles:    { id: string; display_name: string; email: string } | null
}

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function mapNote(raw: RawNote): CampaignNote {
  const { profiles, ...rest } = raw
  return { ...rest, author: profiles ?? undefined }
}

// ────────────────────────────────────────────────────────
// Note Service
// ────────────────────────────────────────────────────────

/**
 * Lista todas as notas da campanha com dados do autor,
 * ordenadas por updated_at desc.
 */
export async function getCampaignNotes(campaignId: string): Promise<CampaignNote[]> {
  const { data, error } = await supabase
    .from('campaign_notes')
    .select('*, profiles(id, display_name, email)')
    .eq('campaign_id', campaignId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error('Não foi possível carregar as notas.')
  if (!data || data.length === 0) return []

  return (data as unknown as RawNote[]).map(mapNote)
}

/**
 * Busca contagem e última nota atualizada — usado pela Visão Geral.
 */
export async function getCampaignNotesSummary(
  campaignId: string
): Promise<{ total: number; latest: { title: string; updated_at: string } | null }> {
  const { data, count, error } = await supabase
    .from('campaign_notes')
    .select('title, updated_at', { count: 'exact' })
    .eq('campaign_id', campaignId)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) throw new Error('Não foi possível carregar o resumo das notas.')
  return {
    total:  count ?? 0,
    latest: data?.[0] as { title: string; updated_at: string } | null ?? null,
  }
}

/**
 * Cria uma nota na campanha. author_id é preenchido com auth.uid().
 */
export async function createCampaignNote(
  campaignId: string,
  formData:   NoteFormData
): Promise<CampaignNote> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('campaign_notes')
    .insert({
      campaign_id: campaignId,
      author_id:   user.id,
      title:       formData.title.trim(),
      content:     formData.content.trim(),
    })
    .select('*, profiles(id, display_name, email)')
    .single()

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('note_title_length'))   throw new Error('O título deve ter no máximo 120 caracteres.')
    if (msg.includes('note_content_length')) throw new Error('O conteúdo deve ter no máximo 10000 caracteres.')
    throw new Error('Não foi possível criar a nota.')
  }

  const note = mapNote(data as unknown as RawNote)
  logActivity(campaignId, 'note_created', `Nota "${note.title}" criada.`)
  return note
}

/**
 * Atualiza título e conteúdo de uma nota.
 * RLS garante que apenas o autor ou mestre pode editar.
 */
export async function updateCampaignNote(
  noteId:   string,
  formData: NoteFormData
): Promise<CampaignNote> {
  const { data, error } = await supabase
    .from('campaign_notes')
    .update({
      title:   formData.title.trim(),
      content: formData.content.trim(),
    })
    .eq('id', noteId)
    .select('*, profiles(id, display_name, email)')
    .single()

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('note_title_length'))   throw new Error('O título deve ter no máximo 120 caracteres.')
    if (msg.includes('note_content_length')) throw new Error('O conteúdo deve ter no máximo 10000 caracteres.')
    throw new Error('Não foi possível atualizar a nota.')
  }

  const note = mapNote(data as unknown as RawNote)
  logActivity(note.campaign_id, 'note_updated', `Nota "${note.title}" atualizada.`)
  return note
}

/**
 * Exclui uma nota pelo id.
 * RLS garante que apenas o autor ou mestre pode excluir.
 */
export async function deleteCampaignNote(
  noteId:     string,
  campaignId: string,
  title:      string
): Promise<void> {
  const { error } = await supabase
    .from('campaign_notes')
    .delete()
    .eq('id', noteId)

  if (error) throw new Error('Não foi possível excluir a nota.')
  logActivity(campaignId, 'note_deleted', `Nota "${title}" excluída.`)
}
