import { FormEvent, useCallback, useEffect, useState } from 'react'
import {
  getCampaignSessions,
  createCampaignSession,
  updateCampaignSession,
  deleteCampaignSession,
  type SessionFormData,
} from '../services/sessionService'
import type { CampaignSession } from '../../../shared/types'
import './CampaignSessionsPanel.css'

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface CampaignSessionsPanelProps {
  campaignId: string
  userRole:   'master' | 'player'
}

// ────────────────────────────────────────────────────────
// Constantes e utilitários
// ────────────────────────────────────────────────────────

const TITLE_MAX   = 120
const SUMMARY_MAX = 5000

function validateForm(title: string, summary: string): string | null {
  if (!title.trim())               return 'Informe um título para a sessão.'
  if (title.length > TITLE_MAX)    return `O título deve ter no máximo ${TITLE_MAX} caracteres.`
  if (summary.length > SUMMARY_MAX) return `O resumo deve ter no máximo ${SUMMARY_MAX} caracteres.`
  return null
}

/**
 * Formata 'YYYY-MM-DD' sem conversão UTC → local.
 * Usa `new Date(year, month-1, day)` para evitar desvio de timezone.
 */
function formatSessionDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

// ────────────────────────────────────────────────────────
// Formulário de criação / edição
// ────────────────────────────────────────────────────────

interface SessionFormProps {
  initial?:   CampaignSession
  campaignId: string
  onSaved:    (session: CampaignSession, isNew: boolean) => void
  onCancel:   () => void
}

function SessionForm({ initial, campaignId, onSaved, onCancel }: SessionFormProps) {
  const isEditing = !!initial

  const [title,       setTitle]       = useState(initial?.title        ?? '')
  const [sessionDate, setSessionDate] = useState(initial?.session_date ?? '')
  const [summary,     setSummary]     = useState(initial?.summary      ?? '')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const validationError = validateForm(title, summary)
    if (validationError) { setError(validationError); return }

    const formData: SessionFormData = {
      title:        title.trim(),
      session_date: sessionDate || null,
      summary:      summary.trim() || null,
    }

    setSaving(true)
    try {
      let session: CampaignSession
      if (isEditing) {
        session = await updateCampaignSession(initial!.id, formData)
      } else {
        session = await createCampaignSession(campaignId, formData)
      }
      onSaved(session, !isEditing)
    } catch (err) {
      setError(
        isEditing
          ? (err instanceof Error ? err.message : 'Não foi possível atualizar a sessão.')
          : (err instanceof Error ? err.message : 'Não foi possível criar a sessão.')
      )
    } finally {
      setSaving(false)
    }
  }

  const titleOver   = title.length   > TITLE_MAX
  const summaryOver = summary.length > SUMMARY_MAX

  return (
    <div className="session-form">
      <div className="session-form__header">
        <h4 className="session-form__title">
          {isEditing ? 'Editar sessão' : 'Nova sessão'}
        </h4>
      </div>

      {error && (
        <div className="session-form__error" role="alert">{error}</div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="session-form__fields">

          {/* Título */}
          <div className="session-form__field">
            <label className="session-form__label" htmlFor="session-title">
              Título da sessão *
            </label>
            <input
              id="session-title"
              type="text"
              className={`input${titleOver ? ' input--error' : ''}`}
              placeholder="Ex.: Sessão 1 — Introdução da campanha"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(null) }}
              disabled={saving}
              autoFocus={!isEditing}
            />
            <span className={`session-form__counter${titleOver ? ' session-form__counter--over' : ''}`}>
              {title.length}/{TITLE_MAX}
            </span>
          </div>

          {/* Data */}
          <div className="session-form__field">
            <label className="session-form__label" htmlFor="session-date">
              Data da sessão
            </label>
            <input
              id="session-date"
              type="date"
              className="input session-form__date-input"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Resumo */}
          <div className="session-form__field session-form__field--full">
            <label className="session-form__label" htmlFor="session-summary">
              Resumo da sessão
            </label>
            <textarea
              id="session-summary"
              className={`input session-form__textarea${summaryOver ? ' input--error' : ''}`}
              placeholder="O que aconteceu nesta sessão?"
              value={summary}
              rows={5}
              onChange={(e) => { setSummary(e.target.value); setError(null) }}
              disabled={saving}
            />
            <span className={`session-form__counter${summaryOver ? ' session-form__counter--over' : ''}`}>
              {summary.length}/{SUMMARY_MAX}
            </span>
          </div>
        </div>

        <div className="session-form__actions">
          <button type="submit" className="btn btn-primary" disabled={saving || titleOver || summaryOver}>
            {saving
              ? <><span className="spinner spinner--sm" /> Salvando...</>
              : isEditing ? 'Salvar alterações' : 'Criar sessão'
            }
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Card de sessão
// ────────────────────────────────────────────────────────

interface SessionCardProps {
  session:      CampaignSession
  isMaster:     boolean
  confirmId:    string | null
  setConfirmId: (id: string | null) => void
  deletingId:   string | null
  onEdit:       (session: CampaignSession) => void
  onDelete:     (session: CampaignSession) => void
}

function SessionCard({
  session, isMaster, confirmId, setConfirmId, deletingId, onEdit, onDelete,
}: SessionCardProps) {
  const isDeleting   = deletingId === session.id
  const isConfirming = confirmId  === session.id

  return (
    <div className="session-card">
      <div className="session-card__header">
        <div className="session-card__meta">
          <h4 className="session-card__title">{session.title}</h4>
          {session.session_date && (
            <span className="session-card__date">
              {formatSessionDate(session.session_date)}
            </span>
          )}
        </div>

        {isMaster && (
          <div className="session-card__actions">
            {isConfirming ? (
              <div className="session-card__confirm">
                <span className="session-card__confirm-label">Excluir sessão?</span>
                <button
                  className="btn btn-danger session-card__confirm-btn"
                  onClick={() => onDelete(session)}
                  disabled={isDeleting}
                >
                  {isDeleting ? <span className="spinner spinner--sm" /> : 'Confirmar'}
                </button>
                <button
                  className="btn btn-ghost session-card__confirm-btn"
                  onClick={() => setConfirmId(null)}
                  disabled={isDeleting}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <button
                  className="btn btn-ghost session-card__edit-btn"
                  onClick={() => onEdit(session)}
                  disabled={isDeleting}
                >
                  Editar
                </button>
                <button
                  className="btn btn-ghost session-card__delete-btn"
                  onClick={() => setConfirmId(session.id)}
                  disabled={isDeleting}
                >
                  Excluir
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {session.summary && (
        <p className="session-card__summary">{session.summary}</p>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────

export function CampaignSessionsPanel({
  campaignId,
  userRole,
}: CampaignSessionsPanelProps) {
  const isMaster = userRole === 'master'

  const [sessions,       setSessions]       = useState<CampaignSession[]>([])
  const [loading,        setLoading]        = useState(true)
  const [listError,      setListError]      = useState<string | null>(null)
  const [showForm,       setShowForm]       = useState(false)
  const [editingSession, setEditingSession] = useState<CampaignSession | null>(null)
  const [successMsg,     setSuccessMsg]     = useState<string | null>(null)
  const [confirmId,      setConfirmId]      = useState<string | null>(null)
  const [deletingId,     setDeletingId]     = useState<string | null>(null)
  const [deleteError,    setDeleteError]    = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const data = await getCampaignSessions(campaignId)
      setSessions(data)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Erro ao carregar sessões.')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { loadSessions() }, [loadSessions])

  function openCreate() {
    setEditingSession(null)
    setShowForm(true)
    setSuccessMsg(null)
    setDeleteError(null)
  }

  function handleEdit(session: CampaignSession) {
    setEditingSession(session)
    setShowForm(true)
    setSuccessMsg(null)
    setDeleteError(null)
  }

  function handleCancel() {
    setShowForm(false)
    setEditingSession(null)
  }

  function handleSaved(session: CampaignSession, isNew: boolean) {
    if (isNew) {
      // Insere no topo (mais recente primeiro)
      setSessions((prev) => [session, ...prev])
      setSuccessMsg('Sessão criada com sucesso.')
    } else {
      setSessions((prev) => prev.map((s) => s.id === session.id ? session : s))
      setSuccessMsg('Sessão atualizada com sucesso.')
    }
    setShowForm(false)
    setEditingSession(null)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  async function handleDelete(session: CampaignSession) {
    setDeleteError(null)
    setDeletingId(session.id)
    try {
      await deleteCampaignSession(session.id)
      setSessions((prev) => prev.filter((s) => s.id !== session.id))
      setSuccessMsg('Sessão excluída com sucesso.')
      setTimeout(() => setSuccessMsg(null), 3500)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Não foi possível excluir a sessão.')
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  return (
    <div className="sessions-panel">

      {/* ── Cabeçalho ── */}
      <div className="sessions-panel__intro">
        <h4 className="sessions-panel__intro-title">Sessões da campanha</h4>
        <p className="sessions-panel__intro-sub">
          Registre os encontros, o histórico e os acontecimentos de cada sessão.
        </p>
      </div>

      {/* ── Formulário (mestre) ou botão nova sessão ── */}
      {isMaster && (
        showForm ? (
          <SessionForm
            initial={editingSession ?? undefined}
            campaignId={campaignId}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        ) : (
          <button className="btn btn-primary sessions-panel__new-btn" onClick={openCreate}>
            + Nova sessão
          </button>
        )
      )}

      {/* ── Mensagens de feedback ── */}
      {successMsg && (
        <div className="sessions-panel__feedback sessions-panel__feedback--success" role="status">
          {successMsg}
        </div>
      )}
      {deleteError && (
        <div className="sessions-panel__feedback sessions-panel__feedback--error" role="alert">
          {deleteError}
        </div>
      )}

      {/* ── Lista ── */}
      {loading ? (
        <div className="sessions-panel__state">
          <div className="spinner spinner--sm" />
          <span>Carregando sessões...</span>
        </div>
      ) : listError ? (
        <div className="sessions-panel__feedback sessions-panel__feedback--error" role="alert">
          {listError}
        </div>
      ) : sessions.length === 0 ? (
        <p className="sessions-panel__empty">
          {isMaster
            ? 'Nenhuma sessão registrada ainda. Clique em "+ Nova sessão" para começar.'
            : 'Nenhuma sessão registrada ainda.'
          }
        </p>
      ) : (
        <div className="sessions-list">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              isMaster={isMaster}
              confirmId={confirmId}
              setConfirmId={setConfirmId}
              deletingId={deletingId}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
