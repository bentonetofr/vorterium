import { useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { CampaignSession } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Caderno do jogador ("Anotações da Bruna"). Ligado por conta
// (player_notebook_users, só pelo SQL Editor). As anotações ficam por
// sessão da campanha; o autor e o MESTRE da campanha leem e editam (a RLS
// garante), os outros jogadores não veem nada.
// ────────────────────────────────────────────────────────

export interface NotebookNote {
  id:          string
  campaign_id: string
  author_id:   string
  session_id:  string | null
  content:     string
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
  if (!s) return 'Sem sessão definida'
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
  return (data ?? []) as NotebookNote[]
}

export async function createNote(campaignId: string, sessionId: string | null, content: string): Promise<NotebookNote> {
  const { data, error } = await supabase
    .from('player_session_notes')
    .insert({ campaign_id: campaignId, session_id: sessionId, content })
    .select('*')
    .single()
  if (error || !data) throw new Error('Não foi possível salvar a anotação.')
  return data as NotebookNote
}

export async function updateNote(id: string, changes: Partial<Pick<NotebookNote, 'content' | 'session_id'>>): Promise<NotebookNote> {
  const { data, error } = await supabase
    .from('player_session_notes')
    .update(changes)
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) throw new Error('Não foi possível salvar a anotação.')
  return data as NotebookNote
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('player_session_notes').delete().eq('id', id)
  if (error) throw new Error('Não foi possível apagar a anotação.')
}

/** Anotações da campanha chegando/mudando em tempo real (o mestre acompanha). */
export function subscribeNotes(campaignId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`player-notes:${campaignId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'player_session_notes', filter: `campaign_id=eq.${campaignId}` }, () => onChange())
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

/** Primeira linha (pra dar nome à anotação na lista). */
export function noteHeadline(content: string): string {
  const line = content.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  return line.length > 48 ? `${line.slice(0, 48)}…` : line
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '')
}
