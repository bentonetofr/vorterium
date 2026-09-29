import { supabase } from '../../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// Biblioteca da campanha — livros e documentos que o mestre guarda pra
// mesa. Tabela campaign_documents + bucket privado "campaign-documents"
// (pasta = campanha). O mestre envia, renomeia, esconde e exclui; os
// jogadores leem o que está aberto pra mesa (a RLS já filtra).
// ────────────────────────────────────────────────────────

const BUCKET = 'campaign-documents'

export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024

export type DocumentKind = 'pdf' | 'image' | 'text'
export type DocumentVisibility = 'all' | 'master'

export interface CampaignDocument {
  id:          string
  campaign_id: string
  name:        string
  path:        string
  mime_type:   string
  size_bytes:  number
  visibility:  DocumentVisibility
  created_at:  string
}

const TYPES: Record<string, { kind: DocumentKind; ext: string }> = {
  'application/pdf': { kind: 'pdf',   ext: 'pdf' },
  'image/jpeg':      { kind: 'image', ext: 'jpg' },
  'image/png':       { kind: 'image', ext: 'png' },
  'image/webp':      { kind: 'image', ext: 'webp' },
  'image/gif':       { kind: 'image', ext: 'gif' },
  'text/plain':      { kind: 'text',  ext: 'txt' },
  'text/markdown':   { kind: 'text',  ext: 'md' },
}

/** O que vai no accept do <input type="file">. */
export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.txt,.md,' + Object.keys(TYPES).join(',')

/** Links assinados: cobrem uma sessão longa de leitura. */
const URL_SECONDS = 6 * 60 * 60

export function documentKind(doc: Pick<CampaignDocument, 'mime_type'>): DocumentKind {
  return TYPES[doc.mime_type]?.kind ?? 'text'
}

/** Tipo do arquivo — o navegador às vezes não informa o de .md/.txt. */
function mimeOf(file: File): string | null {
  if (TYPES[file.type]) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'md' || ext === 'markdown') return 'text/markdown'
  if (ext === 'txt') return 'text/plain'
  if (ext === 'pdf') return 'application/pdf'
  return null
}

export function validateDocument(file: File): string | null {
  if (!mimeOf(file)) return `"${file.name}": envie PDF, imagem (JPG, PNG, WebP, GIF) ou texto (.txt, .md).`
  if (file.size > DOCUMENT_MAX_BYTES) return `"${file.name}" passa de 25 MB.`
  return null
}

function nameFromFile(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim()
  return (base || 'Documento').slice(0, 120)
}

/** Todos os documentos que a pessoa pode ver, de todas as campanhas dela. */
export async function listMyDocuments(): Promise<CampaignDocument[]> {
  const { data, error } = await supabase
    .from('campaign_documents')
    .select('id, campaign_id, name, path, mime_type, size_bytes, visibility, created_at')
    .order('created_at', { ascending: true })

  if (error) throw new Error('Não foi possível carregar a biblioteca.')
  return (data ?? []) as CampaignDocument[]
}

export async function uploadDocument(campaignId: string, file: File): Promise<CampaignDocument> {
  const problem = validateDocument(file)
  if (problem) throw new Error(problem)
  const mime = mimeOf(file)!

  const path = `${campaignId}/${crypto.randomUUID()}.${TYPES[mime].ext}`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: mime, cacheControl: '3600' })

  if (uploadError) {
    console.error('Erro do Storage ao enviar documento:', uploadError)
    throw new Error(`Não foi possível enviar "${file.name}".`)
  }

  const { data, error } = await supabase
    .from('campaign_documents')
    .insert({ campaign_id: campaignId, name: nameFromFile(file), path, mime_type: mime, size_bytes: file.size })
    .select('id, campaign_id, name, path, mime_type, size_bytes, visibility, created_at')
    .single()

  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(`Não foi possível guardar "${file.name}" na biblioteca.`)
  }
  return data as CampaignDocument
}

export async function updateDocument(
  doc: CampaignDocument,
  changes: Partial<Pick<CampaignDocument, 'name' | 'visibility'>>,
): Promise<CampaignDocument> {
  const { error } = await supabase.from('campaign_documents').update(changes).eq('id', doc.id)
  if (error) throw new Error('Não foi possível alterar o documento.')
  return { ...doc, ...changes }
}

export async function deleteDocument(doc: CampaignDocument): Promise<void> {
  const { error } = await supabase.from('campaign_documents').delete().eq('id', doc.id)
  if (error) throw new Error('Não foi possível excluir o documento.')
  const { error: removeError } = await supabase.storage.from(BUCKET).remove([doc.path])
  if (removeError) console.error('Documento ficou no Storage:', removeError)
}

/** Link temporário pra ler o arquivo no site (ou baixar, com `download`). */
export async function getDocumentUrl(doc: CampaignDocument, download = false): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.path, URL_SECONDS, download ? { download: fileNameOf(doc) } : undefined)
  if (error || !data?.signedUrl) throw new Error('Não foi possível abrir o documento.')
  return data.signedUrl
}

/** Links das miniaturas das imagens (path → link). */
export async function getThumbUrls(docs: CampaignDocument[]): Promise<Map<string, string>> {
  const images = docs.filter((d) => documentKind(d) === 'image')
  if (images.length === 0) return new Map()
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(images.map((d) => d.path), URL_SECONDS)
  const urls = new Map<string, string>()
  for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl)
  return urls
}

export function fileNameOf(doc: CampaignDocument): string {
  return `${doc.name}.${TYPES[doc.mime_type]?.ext ?? 'txt'}`
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
