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

// ────────────────────────────────────────────────────────
// Galeria do menu — as imagens de TODAS as campanhas em que a pessoa é
// mestre (a RLS da tabela já só devolve essas), pra rever e reaproveitar.
// ────────────────────────────────────────────────────────

export interface GalleryImageWithCampaign extends MesaGalleryImage {
  campaign_name: string
}

export async function listAllMyMesaImages(): Promise<GalleryImageWithCampaign[]> {
  const { data, error } = await supabase
    .from('campaign_mesa_images')
    .select('*, campaigns(id, name)')
    .order('created_at', { ascending: false })

  if (error) throw new Error('Não foi possível carregar a galeria.')
  type Row = Omit<MesaGalleryImage, 'url'> & { campaigns: { id: string; name: string } | null }
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.campaigns != null)
  if (rows.length === 0) return []

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(rows.map((r) => r.path), THUMB_URL_SECONDS)
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))

  return rows.map(({ campaigns, ...r }) => ({ ...r, campaign_name: campaigns!.name, url: urlByPath.get(r.path) ?? null }))
}

/** Copia a imagem pra galeria de outra campanha (a pessoa é mestre das duas). */
export async function copyMesaImageToCampaign(image: MesaGalleryImage, campaignId: string): Promise<void> {
  const ext = image.path.split('.').pop() ?? 'img'
  const path = `${campaignId}/${crypto.randomUUID()}.${ext}`
  const { error: copyError } = await supabase.storage.from(BUCKET).copy(image.path, path)
  if (copyError) {
    console.error('Erro do Storage ao copiar imagem da Mesa:', copyError)
    throw new Error('Não foi possível copiar a imagem.')
  }

  const { error } = await supabase
    .from('campaign_mesa_images')
    .insert({ campaign_id: campaignId, name: image.name, path })

  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error('Não foi possível salvar a cópia na galeria.')
  }
}

/** Link temporário pra abrir a imagem em tamanho real numa aba nova. */
export async function getMesaImageViewUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, THUMB_URL_SECONDS)
  if (error || !data?.signedUrl) throw new Error('Não foi possível abrir a imagem.')
  return data.signedUrl
}

// ────────────────────────────────────────────────────────
// Fotos do Quadro — imagens coladas/arrastadas no Quadro da campanha vêm
// pra cá (não pra Biblioteca). Pastas: "<campanha>/quadro/" (quadro geral:
// qualquer membro envia e todos os membros leem) e "<campanha>/quadro-mestre/"
// (Escudo do mestre: só o mestre). O mestre vê todas na Galeria.
// ────────────────────────────────────────────────────────

export interface BoardPhoto {
  path: string
  name: string
  w:    number
  h:    number
}

/** Foto grande demais pro bucket (10 MB) ou formato que ele não aceita vira WebP menor. */
async function fitForGallery(file: File): Promise<{ blob: Blob; type: string; w: number; h: number }> {
  const bmp = await createImageBitmap(file)
  const { width, height } = bmp
  const ok = MESA_IMAGE_TYPES.includes(file.type as (typeof MESA_IMAGE_TYPES)[number]) && file.size <= 9.5 * 1024 * 1024
  if (ok) { bmp.close(); return { blob: file, type: file.type, w: width, h: height } }
  const scale = Math.min(1, 2400 / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', 0.86))
    ?? await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.86))
  if (!blob) throw new Error('Não foi possível preparar a imagem.')
  return { blob, type: blob.type || 'image/jpeg', w, h }
}

export async function uploadBoardPhoto(campaignId: string, file: File, shield: boolean): Promise<BoardPhoto> {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" não é uma imagem.`)
  if (file.size > 40 * 1024 * 1024) throw new Error(`"${file.name}" passa de 40 MB.`)
  const img = await fitForGallery(file)
  const name = nameFromFile(file)
  const path = `${campaignId}/${shield ? 'quadro-mestre' : 'quadro'}/${crypto.randomUUID()}.${EXTENSIONS[img.type] ?? 'img'}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, img.blob, { contentType: img.type, cacheControl: '3600' })
  if (uploadError) {
    console.error('Erro do Storage ao enviar foto do Quadro:', uploadError)
    throw new Error(`Não foi possível enviar "${file.name}".`)
  }

  // Sem .select(): jogador pode registrar a foto na Galeria, mas não lê a tabela.
  const { error } = await supabase.from('campaign_mesa_images').insert({ campaign_id: campaignId, name, path })
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(`Não foi possível guardar "${file.name}" na Galeria.`)
  }
  return { path, name, w: img.w, h: img.h }
}

const photoUrlCache = new Map<string, { url: string; until: number }>()

/** Links temporários das fotos do Quadro (path → link), com cache. */
export async function signBoardPhotos(paths: string[]): Promise<Map<string, string>> {
  const now = Date.now()
  const out = new Map<string, string>()
  const missing = [...new Set(paths)].filter((p) => {
    const hit = photoUrlCache.get(p)
    if (hit && hit.until > now) { out.set(p, hit.url); return false }
    return true
  })
  if (missing.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(missing, SHOW_URL_SECONDS)
    for (const s of data ?? []) {
      if (s.path && s.signedUrl) {
        photoUrlCache.set(s.path, { url: s.signedUrl, until: now + (SHOW_URL_SECONDS - 600) * 1000 })
        out.set(s.path, s.signedUrl)
      }
    }
  }
  return out
}
