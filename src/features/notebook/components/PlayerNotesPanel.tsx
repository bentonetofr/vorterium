import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCampaignSessions } from '../../sessions/services/sessionService'
import type { CampaignSession, CampaignWithRole } from '../../../shared/types'
import {
  getCampaignNotebookAuthors,
  listNotes,
  mergeNotes,
  sessionLabel,
  subscribeNotes,
  timeLabel,
  type NotebookAuthor,
  type NotebookNote,
} from '../services/notebookService'
import { NoteEditor, type NoteEditorHandle, type SaveStatus } from './NoteEditor'
import { NoteFormatBar } from './NoteFormatBar'
import { noteToHtml, notePlainText } from '../noteHtml'
import { QuillIcon } from './NotebookFab'
import { NoteImages } from './NoteImages'
import './Notebook.css'

// ────────────────────────────────────────────────────────
// Seção do mestre: as anotações dos jogadores com caderno (hoje, a Bruna),
// separadas por sessão. Chegam em tempo real; o mestre lê em página
// inteira e pode editar qualquer uma (salva sozinho, igual ao caderno).
// ────────────────────────────────────────────────────────

const NO_SESSION = '__sem-sessao__'
const NONE_DELETED: ReadonlySet<string> = new Set()

export function PlayerNotesPanel({ campaign }: { campaign: CampaignWithRole }) {
  const [authors, setAuthors]   = useState<NotebookAuthor[]>([])
  const [authorId, setAuthorId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<CampaignSession[]>([])
  const [notes, setNotes]       = useState<NotebookNote[]>([])
  const [picked, setPicked]     = useState<string | null>(null)
  const [editing, setEditing]   = useState<string | null>(null)
  const [status, setStatus]     = useState<SaveStatus>('idle')
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const editorRef = useRef<NoteEditorHandle>(null)

  useEffect(() => {
    let alive = true
    void Promise.all([getCampaignNotebookAuthors(campaign.id), getCampaignSessions(campaign.id).catch(() => [])])
      .then(([a, s]) => {
        if (!alive) return
        setAuthors(a)
        setAuthorId(a[0]?.userId ?? null)
        setSessions(s)
        if (!a.length) setLoading(false)
      })
      .catch(() => { if (alive) { setError('Não foi possível carregar as anotações.'); setLoading(false) } })
    return () => { alive = false }
  }, [campaign.id])

  // Recarregas fora de ordem (internet lenta) não trazem versão velha de volta.
  const reloadSeq = useRef(0)
  const reload = useCallback(async () => {
    if (!authorId) return
    const seq = ++reloadSeq.current
    const fresh = await listNotes(campaign.id, authorId)
    if (seq !== reloadSeq.current) return
    setNotes((prev) => mergeNotes(prev.filter((n) => n.author_id === authorId), fresh, NONE_DELETED))
  }, [campaign.id, authorId])

  useEffect(() => {
    if (!authorId) return
    setLoading(true)
    reload().catch(() => setError('Não foi possível carregar as anotações.')).finally(() => setLoading(false))
  }, [authorId, reload])

  useEffect(() => subscribeNotes(campaign.id, () => { void reload().catch(() => {}) }), [campaign.id, reload])

  // Sessões com anotação (e quantas), da mais nova pra mais antiga; "sem sessão" no fim.
  const groups = useMemo(() => {
    const count = new Map<string, number>()
    for (const n of notes) {
      if (!notePlainText(n.content).trim() && n.images.length === 0) continue
      const k = n.session_id ?? NO_SESSION
      count.set(k, (count.get(k) ?? 0) + 1)
    }
    const list = sessions.filter((s) => count.has(s.id)).map((s) => ({ key: s.id, label: sessionLabel(s), count: count.get(s.id)! }))
    // Sessão apagada depois: as notas ficam "sem sessão" (a coluna vira null).
    if (count.has(NO_SESSION)) list.push({ key: NO_SESSION, label: 'Sem episódio definido', count: count.get(NO_SESSION)! })
    return list
  }, [notes, sessions])

  const selected = picked && groups.some((g) => g.key === picked) ? picked : groups[0]?.key ?? null
  const visible = notes.filter((n) => (notePlainText(n.content).trim() || n.images.length > 0) && (n.session_id ?? NO_SESSION) === selected)
  const author = authors.find((a) => a.userId === authorId) ?? null
  const selectedLabel = groups.find((g) => g.key === selected)?.label ?? ''

  if (!loading && !authors.length) {
    return (
      <div className="player-notes__empty">
        <QuillIcon size={28} />
        <p>Nenhum jogador desta campanha tem caderno de anotações.</p>
      </div>
    )
  }

  return (
    <section className="player-notes">
      <header className="player-notes__head">
        <div>
          <h2 className="player-notes__title">{author?.title ?? 'Anotações dos jogadores'}</h2>
          <p className="player-notes__sub">Chegam na hora em que são escritas. Você pode ler e editar tudo.</p>
        </div>
        {status !== 'idle' && <span className={`notebook-panel__status notebook-panel__status--${status}`}>{status === 'saving' ? 'salvando…' : status === 'saved' ? 'salvo ✓' : 'não salvou'}</span>}
        {authors.length > 1 && (
          <div className="player-notes__authors" role="tablist" aria-label="De quem">
            {authors.map((a) => (
              <button key={a.userId} type="button" role="tab" aria-selected={a.userId === authorId}
                className={`notebook-tab${a.userId === authorId ? ' notebook-tab--on' : ''}`}
                onClick={() => { setAuthorId(a.userId); setPicked(null); setEditing(null) }}>
                {a.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {error && <p className="player-notes__error" role="alert">{error}</p>}

      {loading ? (
        <div className="notebook-panel__loading"><div className="spinner spinner--sm" /></div>
      ) : groups.length === 0 ? (
        <div className="player-notes__empty">
          <QuillIcon size={28} />
          <p>{author?.name ?? 'O jogador'} ainda não anotou nada nesta campanha.</p>
        </div>
      ) : (
        <div className="player-notes__body">
          <nav className="player-notes__sessions" aria-label="Episódios">
            {groups.map((g) => (
              <button key={g.key} type="button"
                className={`player-notes__session${g.key === selected ? ' player-notes__session--on' : ''}`}
                onClick={() => { setPicked(g.key); setEditing(null) }}>
                <span>{g.label}</span>
                <span className="player-notes__count">{g.count}</span>
              </button>
            ))}
          </nav>

          <div className="player-notes__list">
            <h3 className="player-notes__session-title">{selectedLabel}</h3>
            {visible.map((n, i) => (
              <article key={n.id} className="player-note">
                <header className="player-note__head">
                  <span className="player-note__n">{i + 1}</span>
                  <span className="player-note__meta">
                    {timeLabel(n.created_at)}
                    {n.updated_at !== n.created_at && ` · editada ${timeLabel(n.updated_at)}`}
                    {n.updated_by && n.updated_by !== n.author_id && ' (por você)'}
                  </span>
                  <button type="button" className="player-note__edit" onClick={() => setEditing(editing === n.id ? null : n.id)}>
                    {editing === n.id ? 'Pronto' : 'Editar'}
                  </button>
                </header>
                {editing === n.id ? (
                  <>
                  <NoteFormatBar editor={editorRef} />
                  <NoteEditor
                    ref={editorRef}
                    note={n}
                    campaignId={campaign.id}
                    sessionId={n.session_id}
                    autoFocus
                    className="note-sheet--page"
                    onSaved={(saved) => setNotes((prev) => prev.map((x) => (x.id === saved.id ? saved : x)))}
                    onStatus={setStatus}
                  />
                  </>
                ) : (
                  notePlainText(n.content).trim() && (
                    // noteToHtml já passa pelo filtro: só formatação permitida.
                    <div className="player-note__text" dangerouslySetInnerHTML={{ __html: noteToHtml(n.content) }} />
                  )
                )}
                <NoteImages images={n.images} size="lg" />
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
