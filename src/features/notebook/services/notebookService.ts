import { useEffect, useState } from 'react'
import { supabase, uniqueChannel } from '../../../shared/lib/supabase'
import type { CampaignSession } from '../../../shared/types'
import { notePlainText } from '../noteHtml'

// ────────────────────────────────────────────────────────
// Caderno do jogador ("Anotações da Bruna"). Ligado por conta
// (player_notebook_users, só pelo SQL Editor). As anotações ficam por
// sessão da campanha; o autor e o MESTRE da campanha leem e editam (a RLS
// garante), os outros jogadores não veem nada.
// ────────────────────────────────────────────────────────

/** Imagem da anotação (bucket privado player-notes: só a autora e os mestres veem). */
export interface NoteImage {
  path: string
  w:    number
  h:    number
}

export interface NotebookNote {
  id:          string
  campaign_id: string
  author_id:   string
  session_id:  string | null
  content:     string
  images:      NoteImage[]
  updated_by:  string | null
  created_at:  string
  updated_at:  string
}

// ── Quem tem caderno ────────────────────────────────────

const myNotebookCache = new Map<string, Promise<string | null>>()

/** Título do caderno da conta logada (null = não tem caderno). */
export function getMyNotebookTitle(userId: string): Promise<string | null> {
  let cached = myNotebookCache.get(userId)
  if (!cached) {
    cached = Promise.resolve(
      supabase.from('player_notebook_users').select('title').eq('user_id', userId).maybeSingle(),
    ).then(({ data, error }) => (error || !data ? null : (data as { title: string }).title))
      .catch(() => null)
    myNotebookCache.set(userId, cached)
  }
  return cached
}

/** undefined enquanto confere; null = sem caderno; string = título. */
export function useMyNotebook(userId: string | null | undefined): string | null | undefined {
  const [state, setState] = useState<{ id: string; title: string | null } | null>(null)
  useEffect(() => {
    if (!userId) return
    let alive = true
    void getMyNotebookTitle(userId).then((title) => { if (alive) setState({ id: userId, title }) })
    return () => { alive = false }
  }, [userId])
  if (!userId) return null
  return state?.id === userId ? state.title : undefined
}

export interface NotebookAuthor {
  userId: string
  title:  string
  name:   string
  avatar: string | null
}

/** Jogadores desta campanha que têm caderno (o mestre vê; os outros recebem lista vazia). */
export async function getCampaignNotebookAuthors(campaignId: string): Promise<NotebookAuthor[]> {
  const { data: members, error } = await supabase
    .from('campaign_members')
    .select('user_id, profile:profiles(display_name, avatar_url)')
    .eq('campaign_id', campaignId)
    .eq('role', 'player')
  if (error || !members?.length) return []
  const ids = members.map((m) => (m as { user_id: string }).user_id)
  const { data: books } = await supabase.from('player_notebook_users').select('user_id, title').in('user_id', ids)
  const titles = new Map(((books ?? []) as { user_id: string; title: string }[]).map((b) => [b.user_id, b.title]))
  return (members as unknown as { user_id: string; profile: { display_name: string; avatar_url: string | null } | null }[])
    .filter((m) => titles.has(m.user_id))
    .map((m) => ({
      userId: m.user_id,
      title:  titles.get(m.user_id)!,
      name:   m.profile?.display_name ?? 'Jogador',
      avatar: m.profile?.avatar_url ?? null,
    }))
}

const authorsCache = new Map<string, Promise<NotebookAuthor[]>>()

/** Cadernos da campanha pro mestre (com cache por campanha). Jogador → []. */
export function useCampaignNotebookAuthors(campaignId: string | null | undefined, isMaster: boolean): NotebookAuthor[] {
  const [authors, setAuthors] = useState<NotebookAuthor[]>([])
  useEffect(() => {
    if (!campaignId || !isMaster) { setAuthors([]); return }
    let alive = true
    let cached = authorsCache.get(campaignId)
    if (!cached) {
      cached = getCampaignNotebookAuthors(campaignId).catch(() => [])
      authorsCache.set(campaignId, cached)
    }
    void cached.then((list) => { if (alive) setAuthors(list) })
    return () => { alive = false }
  }, [campaignId, isMaster])
  return authors
}

// ── Sessões ─────────────────────────────────────────────

/** Sessão sugerida pra anotar agora: a de hoje; senão a última que já
 *  passou; senão a próxima marcada; senão nenhuma. */
export function currentSessionId(sessions: CampaignSession[]): string | null {
  const today = new Date().toISOString().slice(0, 10)
  const usable = sessions.filter((s) => s.status !== 'canceled')
  const dated = usable.filter((s) => s.session_date)
  const todays = dated.find((s) => s.session_date === today)
  if (todays) return todays.id
  const past = dated.filter((s) => s.session_date! < today).sort((a, b) => b.session_date!.localeCompare(a.session_date!))
  if (past[0]) return past[0].id
  const future = dated.filter((s) => s.session_date! > today).sort((a, b) => a.session_date!.localeCompare(b.session_date!))
  if (future[0]) return future[0].id
  return usable[0]?.id ?? null
}

export function sessionLabel(s: CampaignSession | null | undefined): string {
  if (!s) return 'Sem episódio definido'
  if (!s.session_date) return s.title
  const d = new Date(`${s.session_date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
  return `${s.title} · ${d}`
}

// ── Anotações ───────────────────────────────────────────

export async function listNotes(campaignId: string, authorId?: string): Promise<NotebookNote[]> {
  let query = supabase
    .from('player_session_notes')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (authorId) query = query.eq('author_id', authorId)
  const { data, error } = await query
  if (error) throw new Error('Não foi possível carregar as anotações.')
  return ((data ?? []) as NotebookNote[]).map(normalizeNote)
}

function normalizeNote(n: NotebookNote): NotebookNote {
  return { ...n, images: Array.isArray(n.images) ? n.images : [] }
}

export async function createNote(campaignId: string, sessionId: string | null, content: string): Promise<NotebookNote> {
  const { data, error } = await supabase
    .from('player_session_notes')
    .insert({ campaign_id: campaignId, session_id: sessionId, content })
    .select('*')
    .single()
  if (error || !data) throw new Error('Não foi possível salvar a anotação.')
  return normalizeNote(data as NotebookNote)
}

export async function updateNote(id: string, changes: Partial<Pick<NotebookNote, 'content' | 'session_id' | 'images'>>): Promise<NotebookNote> {
  const { data, error } = await supabase
    .from('player_session_notes')
    .update(changes)
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) throw new Error('Não foi possível salvar a anotação.')
  return normalizeNote(data as NotebookNote)
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('player_session_notes').delete().eq('id', id)
  if (error) throw new Error('Não foi possível apagar a anotação.')
}

/** Anotações da campanha chegando/mudando em tempo real (o mestre acompanha). */
export function subscribeNotes(campaignId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`player-notes:${campaignId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'player_session_notes', filter: `campaign_id=eq.${campaignId}` }, () => onChange())
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

// ── Imagens ─────────────────────────────────────────────

const IMAGES_BUCKET = 'player-notes'
const IMAGE_MAX_SIDE = 1600
const IMAGE_RAW_LIMIT = 25 * 1024 * 1024

/** Deixa a imagem leve (lado maior até 1600 px, WebP) antes de guardar. */
async function prepareImage(file: File): Promise<{ blob: Blob; type: string; ext: string; w: number; h: number }> {
  const bmp = await createImageBitmap(file)
  const { width, height } = bmp
  const keep = (file.type === 'image/gif' && file.size <= 8 * 1024 * 1024)
    || (Math.max(width, height) <= IMAGE_MAX_SIDE && file.size <= 1.5 * 1024 * 1024 && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
  if (keep) {
    bmp.close()
    const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
    return { blob: file, type: file.type, ext, w: width, h: height }
  }
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const toBlob = (type: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, 0.85))
  const webp = await toBlob('image/webp')
  if (webp && webp.type === 'image/webp') return { blob: webp, type: 'image/webp', ext: 'webp', w, h }
  const jpg = await toBlob('image/jpeg')
  if (!jpg) throw new Error('Não foi possível preparar a imagem.')
  return { blob: jpg, type: 'image/jpeg', ext: 'jpg', w, h }
}

/** Guarda uma imagem da anotação (pasta "<campanha>/<autora>/"). */
export async function uploadNoteImage(campaignId: string, authorId: string, file: File): Promise<NoteImage> {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" não é uma imagem.`)
  if (file.size > IMAGE_RAW_LIMIT) throw new Error(`"${file.name}" passa de 25 MB.`)
  const img = await prepareImage(file)
  const path = `${campaignId}/${authorId}/${crypto.randomUUID()}.${img.ext}`
  const { error } = await supabase.storage.from(IMAGES_BUCKET).upload(path, img.blob, { contentType: img.type, cacheControl: '3600' })
  if (error) {
    console.error('Erro ao guardar imagem da anotação:', error)
    throw new Error('Não foi possível guardar a imagem.')
  }
  return { path, w: img.w, h: img.h }
}

/** Apaga o arquivo (só a autora consegue; se falhar, fica órfão e ninguém vê). */
export async function removeNoteImageFile(path: string): Promise<void> {
  await supabase.storage.from(IMAGES_BUCKET).remove([path])
}

const imageUrlCache = new Map<string, { url: string; until: number }>()

/** Links temporários das imagens (path → link), com cache. */
export async function noteImageUrls(paths: string[]): Promise<Map<string, string>> {
  const now = Date.now()
  const out = new Map<string, string>()
  const missing = paths.filter((p) => {
    const hit = imageUrlCache.get(p)
    if (hit && hit.until > now) { out.set(p, hit.url); return false }
    return true
  })
  if (missing.length) {
    const { data } = await supabase.storage.from(IMAGES_BUCKET).createSignedUrls(missing, 3600)
    for (const s of data ?? []) {
      if (s.path && s.signedUrl) {
        imageUrlCache.set(s.path, { url: s.signedUrl, until: now + 50 * 60 * 1000 })
        out.set(s.path, s.signedUrl)
      }
    }
  }
  return out
}

/** Primeira linha do texto, sem formatação (pra dar nome à anotação na lista). */
export function noteHeadline(content: string): string {
  const line = notePlainText(content).split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  return line.length > 48 ? `${line.slice(0, 48)}…` : line
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '')
}
