import { supabase } from '../../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// Galeria da Mesa — imagens que o mestre guarda pra mostrar à mesa.
// Bucket privado "mesa-images" (pasta = campanha) + tabela
// campaign_mesa_images, as duas só do mestre. O jogador nunca lê a
// galeria: recebe um link assinado da imagem que está na mesa.
// ────────────────────────────────────────────────────────

const BUCKET = 'mesa-images'

export const MESA_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const MESA_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

/** Link das miniaturas da galeria (só o mestre vê). */
const THUMB_URL_SECONDS = 60 * 60
/** Link da imagem na mesa — cobre uma sessão longa. */
const SHOW_URL_SECONDS = 12 * 60 * 60

export interface MesaGalleryImage {
  id:          string
  campaign_id: string
  name:        string
  path:        string
  created_at:  string
  /** Link assinado pra miniatura (null se não deu pra gerar). */
  url:         string | null
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
}

export function validateMesaImage(file: File): string | null {
  if (!MESA_IMAGE_TYPES.includes(file.type as (typeof MESA_IMAGE_TYPES)[number])) {
    return 'Escolha uma imagem JPG, PNG, WebP ou GIF.'
  }
  if (file.size > MESA_IMAGE_MAX_BYTES) return 'A imagem deve ter no máximo 10 MB.'
  return null
}

function nameFromFile(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return (base || 'Imagem').slice(0, 120)
}

export async function listMesaImages(campaignId: string): Promise<MesaGalleryImage[]> {
  const { data, error } = await supabase
    .from('campaign_mesa_images')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })

  if (error) throw new Error('Não foi possível carregar a galeria.')
  const rows = (data ?? []) as Omit<MesaGalleryImage, 'url'>[]
  if (rows.length === 0) return []

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(rows.map((r) => r.path), THUMB_URL_SECONDS)

  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
  return rows.map((r) => ({ ...r, url: urlByPath.get(r.path) ?? null }))
}

export async function uploadMesaImage(campaignId: string, file: File): Promise<MesaGalleryImage> {
  const problem = validateMesaImage(file)
  if (problem) throw new Error(problem)

  const path = `${campaignId}/${crypto.randomUUID()}.${EXTENSIONS[file.type] ?? 'img'}`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '3600' })

  if (uploadError) {
    console.error('Erro do Storage ao enviar imagem da Mesa:', uploadError)
    throw new Error('Não foi possível enviar a imagem.')
  }

  const { data, error } = await supabase
    .from('campaign_mesa_images')
    .insert({ campaign_id: campaignId, name: nameFromFile(file), path })
    .select('*')
    .single()

  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error('Não foi possível salvar a imagem na galeria.')
  }

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, THUMB_URL_SECONDS)
  return { ...(data as Omit<MesaGalleryImage, 'url'>), url: signed?.signedUrl ?? null }
}

export async function deleteMesaImage(image: MesaGalleryImage): Promise<void> {
  const { error } = await supabase.from('campaign_mesa_images').delete().eq('id', image.id)
  if (error) throw new Error('Não foi possível excluir a imagem.')
  const { error: removeError } = await supabase.storage.from(BUCKET).remove([image.path])
  if (removeError) console.error('Imagem da Mesa ficou no Storage:', removeError)
}

/** Link que vai pros jogadores ao colocar a imagem na mesa. */
export async function getMesaImageShowUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SHOW_URL_SECONDS)
  if (error || !data?.signedUrl) throw new Error('Não foi possível abrir a imagem.')
  return data.signedUrl
}
