import { supabase, uniqueChannel } from '../../shared/lib/supabase'
import { checkLoreFile, safeLoreFileName } from './lorePure'

// ────────────────────────────────────────────────────────
// Lore dos personagens (migration 20240225): o texto de cada ficha e os
// arquivos enviados. O dono edita; o mestre da campanha lê tudo.
// ────────────────────────────────────────────────────────

export type LoreSystem = 'altherium' | 'dnd5e'

export interface CharacterLore {
  id:          string
  campaign_id: string
  sheet_id:    string
  system:      LoreSystem
  user_id:     string
  body:        string
  created_at:  string
  updated_at:  string
}

export interface CharacterLoreFile {
  id:          string
  campaign_id: string
  sheet_id:    string
  user_id:     string
  name:        string
  path:        string
  mime:        string | null
  size_bytes:  number
  created_at:  string
}

const BUCKET = 'character-lores'

export async function getLore(sheetId: string): Promise<CharacterLore | null> {
  const { data, error } = await supabase.from('character_lores').select('*').eq('sheet_id', sheetId).maybeSingle()
  if (error) throw new Error('Não foi possível carregar a lore.')
  return (data as CharacterLore | null) ?? null
}

/** Grava o texto (cria a linha na primeira vez). */
export async function saveLoreBody(a: {
  campaignId: string; sheetId: string; system: LoreSystem; userId: string; body: string
}): Promise<CharacterLore> {
  const { data, error } = await supabase
    .from('character_lores')
    .upsert({ campaign_id: a.campaignId, sheet_id: a.sheetId, system: a.system, user_id: a.userId, body: a.body }, { onConflict: 'sheet_id' })
    .select('*')
    .single()
  if (error) throw new Error('Não foi possível salvar a lore.')
  return data as CharacterLore
}

export async function listLoreFiles(sheetId: string): Promise<CharacterLoreFile[]> {
  const { data, error } = await supabase
    .from('character_lore_files').select('*').eq('sheet_id', sheetId).order('created_at', { ascending: true })
  if (error) throw new Error('Não foi possível carregar os arquivos da lore.')
  return (data ?? []) as CharacterLoreFile[]
}

/** Envia um arquivo para o Storage e registra na lista. */
export async function uploadLoreFile(a: {
  campaignId: string; sheetId: string; userId: string; file: File; alreadyHave: number
}): Promise<CharacterLoreFile> {
  const problem = checkLoreFile(a.file, a.alreadyHave)
  if (problem) throw new Error(problem)

  const path = `${a.campaignId}/${a.userId}/${crypto.randomUUID()}-${safeLoreFileName(a.file.name)}`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, a.file, {
    cacheControl: '3600', contentType: a.file.type || 'application/octet-stream',
  })
  if (upErr) throw new Error(`Não foi possível enviar “${a.file.name}”: ${upErr.message}`)

  const { data, error } = await supabase
    .from('character_lore_files')
    .insert({
      campaign_id: a.campaignId, sheet_id: a.sheetId, user_id: a.userId,
      name: a.file.name.slice(0, 200), path, mime: a.file.type || null, size_bytes: a.file.size,
    })
    .select('*')
    .single()
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(`Não foi possível registrar “${a.file.name}”.`)
  }
  return data as CharacterLoreFile
}

export async function removeLoreFile(file: CharacterLoreFile): Promise<void> {
  const { error } = await supabase.from('character_lore_files').delete().eq('id', file.id)
  if (error) throw new Error('Não foi possível remover o arquivo.')
  await supabase.storage.from(BUCKET).remove([file.path])
}

/** Endereço temporário (1 h) para abrir ou baixar o arquivo. */
export async function loreFileUrl(file: CharacterLoreFile, download = false): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET)
    .createSignedUrl(file.path, 3600, download ? { download: file.name } : undefined)
  if (error || !data) throw new Error('Não foi possível abrir o arquivo.')
  return data.signedUrl
}

export async function downloadLoreFile(file: CharacterLoreFile): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(file.path)
  if (error || !data) throw new Error('Não foi possível baixar o arquivo.')
  return data
}

/** Todas as lores e arquivos da campanha (o mestre recebe de todos os jogadores). */
export async function listCampaignLores(campaignId: string): Promise<{ lores: CharacterLore[]; files: CharacterLoreFile[] }> {
  const [l, f] = await Promise.all([
    supabase.from('character_lores').select('*').eq('campaign_id', campaignId),
    supabase.from('character_lore_files').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: true }),
  ])
  if (l.error || f.error) throw new Error('Não foi possível carregar as lores da campanha.')
  return { lores: (l.data ?? []) as CharacterLore[], files: (f.data ?? []) as CharacterLoreFile[] }
}

/** Avisa quando alguém escreve ou envia arquivo (tempo real); quem chama recarrega a lista. */
export function subscribeToCampaignLores(campaignId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`lores:${campaignId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'character_lores', filter: `campaign_id=eq.${campaignId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'character_lore_files', filter: `campaign_id=eq.${campaignId}` }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
