import { supabase, uniqueChannel } from '../../../shared/lib/supabase'
import { DEFAULT_STYLE, normalizeStyle, type DocStyle } from './paperStyles'

// ────────────────────────────────────────────────────────
// Documentos da Mesa (tabela campaign_mesa_documents): folhas e livros que
// o mestre escreve. A RLS já entrega pro jogador só o que foi liberado.
// ────────────────────────────────────────────────────────

export type DocKind = 'paper' | 'book'

export interface DocPage {
  text:   string
  /** Estilo só desta página (o resto vem do documento). */
  style?: Partial<DocStyle>
  /** Continua a página anterior (o texto que não coube nela desceu pra cá). */
  cont?:  boolean
}

export interface MesaDocument {
  id:          string
  campaign_id: string
  kind:        DocKind
  title:       string
  style:       DocStyle
  pages:       DocPage[]
  visible:     boolean
  created_at:  string
  updated_at:  string
}

export const MAX_PAGES = 200
export const MAX_PAGE_CHARS = 4000

const COLUMNS = 'id, campaign_id, kind, title, style, pages, visible, created_at, updated_at'

function normalize(row: Record<string, unknown>): MesaDocument {
  const pages = Array.isArray(row.pages) ? (row.pages as unknown[]) : []
  return {
    id:          String(row.id),
    campaign_id: String(row.campaign_id),
    kind:        row.kind === 'book' ? 'book' : 'paper',
    title:       String(row.title ?? 'Documento'),
    style:       normalizeStyle(row.style),
    pages:       (pages.length ? pages : [{ text: '' }]).map((p) => {
      const o = (p && typeof p === 'object' ? p : {}) as { text?: unknown; style?: unknown; cont?: unknown }
      return { text: typeof o.text === 'string' ? o.text : '', style: o.style && typeof o.style === 'object' ? o.style as Partial<DocStyle> : undefined, ...(o.cont === true ? { cont: true } : {}) }
    }),
    visible:     !!row.visible,
    created_at:  String(row.created_at ?? ''),
    updated_at:  String(row.updated_at ?? ''),
  }
}

export async function listDocuments(campaignId: string): Promise<MesaDocument[]> {
  const { data, error } = await supabase
    .from('campaign_mesa_documents')
    .select(COLUMNS)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
  if (error) throw new Error('Não foi possível carregar os documentos.')
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>))
}

export async function getDocument(id: string): Promise<MesaDocument | null> {
  const { data, error } = await supabase.from('campaign_mesa_documents').select(COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new Error('Não foi possível abrir o documento.')
  return data ? normalize(data as Record<string, unknown>) : null
}

export async function createDocument(campaignId: string, kind: DocKind): Promise<MesaDocument> {
  const pages: DocPage[] = kind === 'book' ? [{ text: '' }, { text: '' }] : [{ text: '' }]
  const { data, error } = await supabase
    .from('campaign_mesa_documents')
    .insert({ campaign_id: campaignId, kind, title: kind === 'book' ? 'Livro sem título' : 'Carta sem título', style: DEFAULT_STYLE, pages })
    .select(COLUMNS)
    .single()
  if (error || !data) throw new Error('Não foi possível criar o documento.')
  return normalize(data as Record<string, unknown>)
}

export async function saveDocument(doc: MesaDocument): Promise<MesaDocument> {
  const pages = doc.pages.slice(0, MAX_PAGES).map((p) => ({ text: p.text.slice(0, MAX_PAGE_CHARS), ...(p.style ? { style: p.style } : {}), ...(p.cont ? { cont: true } : {}) }))
  const { data, error } = await supabase
    .from('campaign_mesa_documents')
    .update({ kind: doc.kind, title: doc.title.trim().slice(0, 120) || 'Documento', style: doc.style, pages })
    .eq('id', doc.id)
    .select(COLUMNS)
    .single()
  if (error || !data) throw new Error('Não foi possível salvar o documento.')
  return normalize(data as Record<string, unknown>)
}

export async function setDocumentVisible(id: string, visible: boolean): Promise<void> {
  const { error } = await supabase.from('campaign_mesa_documents').update({ visible }).eq('id', id)
  if (error) throw new Error('Não foi possível mudar quem vê o documento.')
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from('campaign_mesa_documents').delete().eq('id', id)
  if (error) throw new Error('Não foi possível excluir o documento.')
}

/** Documentos mudando em tempo real (liberado, editado, apagado). */
export function subscribeDocuments(campaignId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`mesa-documentos:${campaignId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_mesa_documents', filter: `campaign_id=eq.${campaignId}` }, () => onChange())
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}
