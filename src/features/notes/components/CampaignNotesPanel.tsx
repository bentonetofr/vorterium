import { useCallback, useEffect, useState } from 'react'
import {
  getCampaignNotes,
  createCampaignNote,
  updateCampaignNote,
  deleteCampaignNote,
  type NoteFormData,
} from '../services/noteService'
import type { CampaignNote } from '../../../shared/types'
import './CampaignNotesPanel.css'

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface CampaignNotesPanelProps {
  campaignId:    string
  currentUserId: string
  userRole:      'master' | 'player'
}

// ────────────────────────────────────────────────────────
// Utilitários
// ────────────────────────────────────────────────────────

function formatNoteDate(iso: string): string {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1)  return 'agora'
  if (minutes < 60) return `${minutes}min atrás`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `${hours}h atrás`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TITLE_MAX   = 120
const CONTENT_MAX = 10000

// ────────────────────────────────────────────────────────
// NoteForm — criação e edição
// ────────────────────────────────────────────────────────

interface NoteFormProps {
  initialData?: Pick<CampaignNote, 'title' | 'content'>
  saving:       boolean
  onSave:       (data: NoteFormData) => void
  onCancel:     () => void
}

function NoteForm({ initialData, saving, onSave, onCancel }: NoteFormProps) {
  const [title,   setTitle]   = useState(initialData?.title   ?? '')
  const [content, setContent] = useState(initialData?.content ?? '')
  const [error,   setError]   = useState<string | null>(null)

  const isEditing = !!initialData

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    const c = content.trim()
    if (!t)               { setError('Informe um título para a nota.');       return }
    if (!c)               { setError('Informe o conteúdo da nota.');          return }
    if (t.length > TITLE_MAX)   { setError('O título deve ter no máximo 120 caracteres.');      return }
    if (c.length > CONTENT_MAX) { setError('O conteúdo deve ter no máximo 10000 caracteres.'); return }
    setError(null)
    onSave({ title: t, content: c })
  }

  return (
    <form className="note-form" onSubmit={handleSubmit} noValidate>
      <div className="note-form__header">
        <h4 className="note-form__title">{isEditing ? 'Editar nota' : 'Nova nota'}</h4>
      </div>

      {error && <p className="note-form__error" role="alert">{error}</p>}

      <div className="note-form__fields">
        <div className="note-form__field">
          <label className="note-form__label" htmlFor="note-title">Título</label>
          <input
            id="note-title"
            className="input"
            type="text"
            placeholder="Título da nota"
            maxLength={TITLE_MAX + 10}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            autoFocus={!isEditing}
          />
          <span className={`note-form__counter${title.length > TITLE_MAX ? ' note-form__counter--over' : ''}`}>
            {title.length}/{TITLE_MAX}
          </span>
        </div>

        <div className="note-form__field">
          <label className="note-form__label" htmlFor="note-content">Conteúdo</label>
          <textarea
            id="note-content"
            className="input note-form__textarea"
            placeholder="Conteúdo da nota..."
            maxLength={CONTENT_MAX + 100}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={saving}
          />
          <span className={`note-form__counter${content.length > CONTENT_MAX ? ' note-form__counter--over' : ''}`}>
            {content.length}/{CONTENT_MAX}
          </span>
        </div>
      </div>

      <div className="note-form__actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Salvando...' : isEditing ? 'Salvar nota' : 'Criar nota'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ────────────────────────────────────────────────────────
// NoteCard
// ────────────────────────────────────────────────────────

interface NoteCardProps {
  note:          CampaignNote
  canManage:     boolean
  deletingId:    string | null
  deleting:      boolean
  onEdit:        () => void
  onDelete:      () => void
  onConfirmDelete: () => void
  onCancelDelete:  () => void
}

function NoteCard({
  note,
  canManage,
  deletingId,
  deleting,
  onEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: NoteCardProps) {
  const isConfirming = deletingId === note.id

  return (
    <div className="note-card">
      <div className="note-card__header">
        <div className="note-card__meta">
          <h4 className="note-card__title">{note.title}</h4>
          <p className="note-card__byline">
            {note.author?.display_name ?? 'Membro'}
            {' · '}
            <time dateTime={note.updated_at}>{formatNoteDate(note.updated_at)}</time>
          </p>
        </div>

        {canManage && (
          <div className="note-card__actions">
            {isConfirming ? (
              <div className="note-card__confirm">
                <span className="note-card__confirm-label">Excluir?</span>
                <button
                  className="btn btn-ghost note-card__confirm-btn note-card__confirm-btn--danger"
                  onClick={onConfirmDelete}
                  disabled={deleting}
                >
                  {deleting ? '...' : 'Sim'}
                </button>
                <button
                  className="btn btn-ghost note-card__confirm-btn"
                  onClick={onCancelDelete}
                  disabled={deleting}
                >
                  Não
                </button>
              </div>
            ) : (
              <>
                <button
                  className="btn btn-ghost note-card__edit-btn"
                  onClick={onEdit}
                  aria-label="Editar nota"
                >
                  Editar
                </button>
                <button
                  className="btn btn-ghost note-card__delete-btn"
                  onClick={onDelete}
                  aria-label="Excluir nota"
                >
                  Excluir
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="note-card__content">{note.content}</p>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────

export function CampaignNotesPanel({
  campaignId,
  currentUserId,
  userRole,
}: CampaignNotesPanelProps) {
  const [notes,          setNotes]          = useState<CampaignNote[]>([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [saving,         setSaving]         = useState(false)
  const [deleting,       setDeleting]       = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingNoteId,  setEditingNoteId]  = useState<string | null>(null)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [feedback,       setFeedback]       = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await getCampaignNotes(campaignId)
      setNotes(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as notas.')
    }
  }, [campaignId])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  async function handleCreate(data: NoteFormData) {
    setSaving(true)
    try {
      await createCampaignNote(campaignId, data)
      setShowCreateForm(false)
      await load()
      showFeedback('success', 'Nota criada com sucesso.')
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Não foi possível criar a nota.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(data: NoteFormData) {
    if (!editingNoteId) return
    setSaving(true)
    try {
      await updateCampaignNote(editingNoteId, data)
      setEditingNoteId(null)
      await load()
      showFeedback('success', 'Nota atualizada com sucesso.')
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Não foi possível atualizar a nota.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingNoteId) return
    const note = notes.find((n) => n.id === deletingNoteId)
    if (!note) return

    setDeleting(true)
    try {
      await deleteCampaignNote(deletingNoteId, campaignId, note.title)
      setDeletingNoteId(null)
      await load()
      showFeedback('success', 'Nota excluída com sucesso.')
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Não foi possível excluir a nota.')
    } finally {
      setDeleting(false)
    }
  }

  function canManageNote(note: CampaignNote): boolean {
    return note.author_id === currentUserId || userRole === 'master'
  }

  return (
    <div className="notes-panel">

      {/* ── Cabeçalho ── */}
      <div className="notes-panel__intro">
        <h4 className="notes-panel__intro-title">Notas</h4>
        <p className="notes-panel__intro-sub">
          Registre informações importantes da campanha.
        </p>
      </div>

      {/* ── Botão nova nota ── */}
      {!showCreateForm && !editingNoteId && (
        <button
          className="btn btn-primary notes-panel__new-btn"
          onClick={() => { setDeletingNoteId(null); setShowCreateForm(true) }}
        >
          + Nova nota
        </button>
      )}

      {/* ── Formulário de criação ── */}
      {showCreateForm && (
        <NoteForm
          saving={saving}
          onSave={handleCreate}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* ── Feedback ── */}
      {feedback && (
        <div className={`notes-panel__feedback notes-panel__feedback--${feedback.type}`} role="alert">
          {feedback.message}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="notes-panel__state">
          <div className="spinner spinner--sm" />
          <span>Carregando notas...</span>
        </div>
      )}

      {/* ── Erro ── */}
      {!loading && error && (
        <div className="notes-panel__state notes-panel__state--error" role="alert">{error}</div>
      )}

      {/* ── Estado vazio ── */}
      {!loading && !error && notes.length === 0 && (
        <div>
          <p className="notes-panel__empty">Nenhuma nota registrada ainda.</p>
          <p className="notes-panel__empty-sub">
            Crie uma nota para registrar informações importantes da campanha.
          </p>
        </div>
      )}

      {/* ── Lista de notas ── */}
      {!loading && !error && notes.length > 0 && (
        <div className="notes-list">
          {notes.map((note) =>
            editingNoteId === note.id ? (
              <NoteForm
                key={note.id}
                initialData={note}
                saving={saving}
                onSave={handleUpdate}
                onCancel={() => setEditingNoteId(null)}
              />
            ) : (
              <NoteCard
                key={note.id}
                note={note}
                canManage={canManageNote(note)}
                deletingId={deletingNoteId}
                deleting={deleting}
                onEdit={() => { setShowCreateForm(false); setDeletingNoteId(null); setEditingNoteId(note.id) }}
                onDelete={() => { setShowCreateForm(false); setEditingNoteId(null); setDeletingNoteId(note.id) }}
                onConfirmDelete={handleDelete}
                onCancelDelete={() => setDeletingNoteId(null)}
              />
            )
          )}
        </div>
      )}

    </div>
  )
}
