import { supabase } from '../../../../shared/lib/supabase'
import type { DndCharacterSheet } from '../../../../shared/types'
import { DND_PORTRAIT_MAX_BYTES, DND_PORTRAIT_TYPES } from '../constants/dnd'

// ────────────────────────────────────────────────────────
// Retrato da ficha D&D: uma imagem por ficha no bucket dnd-portraits
// (migration 20240203000000), caminho "<id da ficha>/portrait". Mesmo jeito
// do retrato de Vampiro e de Altherium.
// ────────────────────────────────────────────────────────

const BUCKET = 'dnd-portraits'

async function setPortraitUrl(sheetId: string, url: string | null): Promise<DndCharacterSheet> {
  const { data, error } = await supabase
    .from('dnd_character_sheets').update({ portrait_url: url }).eq('id', sheetId).select('*').single()
  if (error) throw new Error('Não foi possível salvar o retrato na ficha.')
  return data as DndCharacterSheet
}

/** Envia (ou troca) o retrato e grava a URL na ficha. */
export async function uploadDndPortrait(sheetId: string, file: File): Promise<DndCharacterSheet> {
  if (!DND_PORTRAIT_TYPES.includes(file.type as (typeof DND_PORTRAIT_TYPES)[number])) {
    throw new Error('Escolha uma imagem JPG, PNG ou WebP.')
  }
  if (file.size > DND_PORTRAIT_MAX_BYTES) throw new Error('O retrato deve ter no máximo 2 MB.')

  const path = `${sheetId}/portrait`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type })
  if (error) throw new Error(`Não foi possível enviar o retrato: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return setPortraitUrl(sheetId, `${data.publicUrl}?v=${Date.now()}`)
}

/** Remove o retrato e limpa a URL da ficha. */
export async function removeDndPortrait(sheetId: string): Promise<DndCharacterSheet> {
  const { error } = await supabase.storage.from(BUCKET).remove([`${sheetId}/portrait`])
  if (error) throw new Error(`Não foi possível remover o retrato: ${error.message}`)
  return setPortraitUrl(sheetId, null)
}

// ── Foto de companheiro ──────────────────────────────────
// Mesmo bucket do retrato; o caminho "<id da ficha>/companion-<id do companheiro>" cai nas mesmas regras de acesso (a primeira parte
// do caminho é a ficha). A URL é guardada no próprio companheiro (choices.companions), não numa coluna.

/** Envia (ou troca) a foto de um companheiro e devolve a URL pública. */
export async function uploadDndCompanionPhoto(sheetId: string, companionId: string, file: File): Promise<string> {
  if (!DND_PORTRAIT_TYPES.includes(file.type as (typeof DND_PORTRAIT_TYPES)[number])) throw new Error('Escolha uma imagem JPG, PNG ou WebP.')
  if (file.size > DND_PORTRAIT_MAX_BYTES) throw new Error('A foto deve ter no máximo 2 MB.')
  const path = `${sheetId}/companion-${companionId}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type })
  if (error) throw new Error(`Não foi possível enviar a foto: ${error.message}`)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

/** Remove a foto de um companheiro do armazenamento (quem chama limpa a URL do companheiro). */
export async function removeDndCompanionPhoto(sheetId: string, companionId: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([`${sheetId}/companion-${companionId}`])
  if (error) throw new Error(`Não foi possível remover a foto: ${error.message}`)
}
