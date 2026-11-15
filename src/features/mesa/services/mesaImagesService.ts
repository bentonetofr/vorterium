import { supabase, uniqueChannel } from '../../../shared/lib/supabase'
import { forgetSignedUrl, signedUrl, signedUrls } from '../../../shared/lib/signedUrls'
import { shrinkImage } from '../../../shared/lib/imageUpload'

// ────────────────────────────────────────────────────────
// Galeria — imagens que o mestre guarda pra mostrar à mesa (e as fotos do
// Quadro). Bucket privado "mesa-images" (pasta = campanha) + tabela
// campaign_mesa_images: todos os membros veem (menos a pasta do Escudo do
// mestre); só o mestre guarda, exclui e copia.
// ────────────────────────────────────────────────────────

const BUCKET = 'mesa-images'

/** Lado maior das imagens da Galeria e do Quadro depois de reduzidas (sobra pra tela cheia). */
const GALLERY_MAX_SIDE = 2000
/** Link das imagens da Galeria vale uma semana: o navegador só guarda a imagem pelo endereço inteiro, e link novo é download novo. */
const GALLERY_URL_SECONDS = 7 * 24 * 60 * 60

export const MESA_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const MESA_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

/** Imagem na mesa — link novo, que cobre uma sessão longa (as miniaturas usam o cache de signedUrls). */
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

  const urlByPath = await signedUrls(BUCKET, rows.map((r) => r.path), GALLERY_URL_SECONDS)
  return rows.map((r) => ({ ...r, url: urlByPath.get(r.path) ?? null }))
}

export async function uploadMesaImage(campaignId: string, file: File): Promise<MesaGalleryImage> {
  const problem = validateMesaImage(file)
  if (problem) throw new Error(problem)

  // Leve antes de subir: foto de celular de vários MB vira WebP de algumas centenas de kB.
  const img = await shrinkImage(file, { maxSide: GALLERY_MAX_SIDE })
  const path = `${campaignId}/${crypto.randomUUID()}.${EXTENSIONS[img.type] ?? 'img'}`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, img.blob, { contentType: img.type, cacheControl: '31536000' })

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

  return { ...(data as Omit<MesaGalleryImage, 'url'>), url: await signedUrl(BUCKET, path, GALLERY_URL_SECONDS) }
}

export async function deleteMesaImage(image: MesaGalleryImage): Promise<void> {
  const { error } = await supabase.from('campaign_mesa_images').delete().eq('id', image.id)
  if (error) throw new Error('Não foi possível excluir a imagem.')
  const { error: removeError } = await supabase.storage.from(BUCKET).remove([image.path])
  if (removeError) console.error('Imagem da Mesa ficou no Storage:', removeError)
  forgetSignedUrl(BUCKET, image.path)
}

/** Link que vai pros jogadores ao colocar a imagem na mesa. */
export async function getMesaImageShowUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SHOW_URL_SECONDS)
  if (error || !data?.signedUrl) throw new Error('Não foi possível abrir a imagem.')
  return data.signedUrl
}

// ────────────────────────────────────────────────────────
// Galeria do menu — as imagens de TODAS as campanhas da pessoa (a RLS da
// tabela já só devolve essas), pra rever e reaproveitar.
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

  const urlByPath = await signedUrls(BUCKET, rows.map((r) => r.path), GALLERY_URL_SECONDS)

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
  const url = await signedUrl(BUCKET, path, GALLERY_URL_SECONDS)
  if (!url) throw new Error('Não foi possível abrir a imagem.')
  return url
}

// ────────────────────────────────────────────────────────
// Fotos do Quadro — imagens coladas/arrastadas no Quadro da campanha vêm
// pra cá (não pra Biblioteca). Pastas: "<campanha>/quadro/" (quadro geral:
// qualquer membro envia e todos os membros leem) e "<campanha>/quadro-mestre/"
// (Escudo do mestre: só o mestre, fora da Galeria).
// ────────────────────────────────────────────────────────

export interface BoardPhoto {
  path: string
  name: string
  w:    number
  h:    number
}

/**
 * Toda foto vira WebP leve (lado maior até 2000 px) antes de ir pro Storage: cada abertura
 * da Galeria ou do Quadro baixa essas imagens, e o tráfego do servidor é contado por byte.
 * Antes só ficava menor se passasse de 10 MB (a média da galeria era 650 kB, com fotos de 6 MB).
 */
async function fitForGallery(file: File): Promise<{ blob: Blob; type: string; w: number; h: number }> {
  const img = await shrinkImage(file, { maxSide: GALLERY_MAX_SIDE })
  return { blob: img.blob, type: img.type, w: img.w, h: img.h }
}

export async function uploadBoardPhoto(campaignId: string, file: File, shield: boolean): Promise<BoardPhoto> {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" não é uma imagem.`)
  if (file.size > 40 * 1024 * 1024) throw new Error(`"${file.name}" passa de 40 MB.`)
  const img = await fitForGallery(file)
  const name = nameFromFile(file)
  const path = `${campaignId}/${shield ? 'quadro-mestre' : 'quadro'}/${crypto.randomUUID()}.${EXTENSIONS[img.type] ?? 'img'}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, img.blob, { contentType: img.type, cacheControl: '31536000' })
  if (uploadError) {
    console.error('Erro do Storage ao enviar foto do Quadro:', uploadError)
    throw new Error(`Não foi possível enviar "${file.name}".`)
  }

  // Escudo do mestre: a foto fica só no Escudo (pasta só do mestre), sem ir pra Galeria.
  if (shield) return { path, name, w: img.w, h: img.h }

  // Sem .select(): jogador pode registrar a foto na Galeria, mas não lê a tabela.
  const { error } = await supabase.from('campaign_mesa_images').insert({ campaign_id: campaignId, name, path })
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(`Não foi possível guardar "${file.name}" na Galeria.`)
  }
  return { path, name, w: img.w, h: img.h }
}

/** Links temporários das fotos do Quadro (path → link), com cache. */
export function signBoardPhotos(paths: string[]): Promise<Map<string, string>> {
  return signedUrls(BUCKET, paths, GALLERY_URL_SECONDS)
}

// ────────────────────────────────────────────────────────
// Artes e referências (aba Mesa) — mestre e jogadores enviam imagens pra
// mostrar como referência (pasta "<campanha>/arte/"). Todos veem; ninguém
// vai pra transmissão sozinho: só o mestre põe uma imagem na mesa. Entram
// também as imagens antigas da galeria da Mesa (na raiz da pasta); as fotos
// do Quadro e do Escudo ficam de fora.
// ────────────────────────────────────────────────────────

export interface MesaArt extends MesaGalleryImage {
  uploaded_by:   string | null
  uploader_name: string | null
  /** Oculta dos jogadores (só o mestre vê); ao pôr na mesa, todos veem. */
  hidden:        boolean
}

type ArtRow = Omit<MesaGalleryImage, 'url'> & { uploaded_by: string | null; hidden?: boolean; uploader: { display_name: string | null } | null }

async function withUrls(rows: ArtRow[]): Promise<MesaArt[]> {
  if (rows.length === 0) return []
  const urlByPath = await signedUrls(BUCKET, rows.map((r) => r.path), GALLERY_URL_SECONDS)
  return rows.map(({ uploader, hidden, ...r }) => ({ ...r, hidden: hidden === true, uploader_name: uploader?.display_name ?? null, url: urlByPath.get(r.path) ?? null }))
}

const ART_BASE_COLUMNS = 'id, campaign_id, name, path, created_at, uploaded_by, uploader:profiles(display_name)'
/** Sem a coluna `hidden` (migration 20240220 ainda não rodada), a lista continua funcionando. */
let hiddenColumnMissing = false
const artColumns = () => (hiddenColumnMissing ? ART_BASE_COLUMNS : `${ART_BASE_COLUMNS}, hidden`)

export async function listMesaArts(campaignId: string): Promise<MesaArt[]> {
  const query = () => supabase
    .from('campaign_mesa_images')
    .select(artColumns())
    .eq('campaign_id', campaignId)
    .not('path', 'like', '%/quadro/%')
    .not('path', 'like', '%/quadro-mestre/%')
    .order('created_at', { ascending: false })
  let { data, error } = await query()
  if (error && !hiddenColumnMissing && /hidden/.test(error.message)) {
    hiddenColumnMissing = true
    ;({ data, error } = await query())
  }
  if (error) throw new Error('Não foi possível carregar as artes e referências.')
  return withUrls((data ?? []) as unknown as ArtRow[])
}

/** O mestre oculta a arte dos jogadores (ou volta a mostrar na lista). */
export async function setMesaArtHidden(artId: string, hidden: boolean): Promise<void> {
  const { error } = await supabase.from('campaign_mesa_images').update({ hidden }).eq('id', artId)
  if (error) throw new Error('Não foi possível mudar a visibilidade da arte. A migration 20240220 já foi rodada?')
}

export async function uploadMesaArt(campaignId: string, file: File): Promise<MesaArt> {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" não é uma imagem.`)
  if (file.size > 40 * 1024 * 1024) throw new Error(`"${file.name}" passa de 40 MB.`)
  const img = await fitForGallery(file)
  const path = `${campaignId}/arte/${crypto.randomUUID()}.${EXTENSIONS[img.type] ?? 'img'}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, img.blob, { contentType: img.type, cacheControl: '31536000' })
  if (uploadError) {
    console.error('Erro do Storage ao enviar arte/referência:', uploadError)
    throw new Error(`Não foi possível enviar "${file.name}".`)
  }
  const { data, error } = await supabase
    .from('campaign_mesa_images')
    .insert({ campaign_id: campaignId, name: nameFromFile(file), path })
    .select(artColumns())
    .single()
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(`Não foi possível guardar "${file.name}".`)
  }
  const [art] = await withUrls([data as unknown as ArtRow])
  return art
}

/** Artes chegando/saindo em tempo real (o mestre vê na hora o que um jogador enviou). */
export function subscribeMesaArts(campaignId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`mesa-artes:${campaignId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_mesa_images', filter: `campaign_id=eq.${campaignId}` }, () => onChange())
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}
