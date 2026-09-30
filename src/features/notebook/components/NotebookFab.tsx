import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { getCampaignSessions } from '../../sessions/services/sessionService'
import { Presence } from '../../../shared/components/Presence'
import { Select } from '../../../shared/components/Select'
import { useFloatingPanel } from '../../../shared/lib/floatingPanels'
import type { CampaignSession, CampaignWithRole } from '../../../shared/types'
import {
  currentSessionId,
  deleteNote,
  listNotes,
  noteHeadline,
  sessionLabel,
  subscribeNotes,
  timeLabel,
  useMyNotebook,
  type NotebookNote,
} from '../services/notebookService'
import { NoteEditor, type SaveStatus } from './NoteEditor'
import './Notebook.css'

// ────────────────────────────────────────────────────────
// Caderno do jogador — bolinha à esquerda do chat, só pra quem tem caderno
// (hoje, a Bruna), em qualquer campanha. Abre no mesmo lugar e tamanho da
// janela dos dados; já abre com o cursor na anotação da sessão atual. Cada
// anotação salva sozinha e o mestre da campanha vê na hora.
// ────────────────────────────────────────────────────────

export function QuillIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className="quill__pen">
        <path d="M20 4c-6 0-11 4.5-12.5 11.5L6 20" />
        <path d="M20 4c.5 5.5-3 10-9.2 11.2" />
        <path d="M9.6 12.6 13 9.2" />
      </g>
      <path className="quill__ink" d="M4 20h7" />
    </svg>
  )
}

export function NotebookFab() {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const title = useMyNotebook(user?.id)
  const [isOpen, setIsOpen] = useState(false)
  const campaignId = campaign?.id ?? null

  const close = useCallback(() => setIsOpen(false), [])
  const { instant } = useFloatingPanel('notes', isOpen, close)
  useEffect(() => { setIsOpen(false) }, [campaignId])

  // Ao abrir (clique ou Tab), a pena rabisca a linha como se escrevesse.
  const [writing, setWriting] = useState(0)
  useEffect(() => {
    if (!isOpen) return
    setWriting((n) => n + 1)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  // Atalho: Tab abre o caderno já com o cursor na folha; Tab de novo (de
  // dentro dele) fecha. Fora dele, Tab em campo de texto ou com janela modal
  // aberta continua sendo o Tab normal.
  const enabled = !!user && !!campaign && !!title
  useEffect(() => {
    if (!enabled) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing || e.defaultPrevented) return
      const target = e.target instanceof HTMLElement ? e.target : null
      if (target?.closest('[data-fab-panel="notes"]')) {
        e.preventDefault()
        setIsOpen(false)
        return
      }
      if (target && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]'))) return
      if (document.querySelector('.modal-overlay, [aria-modal="true"]')) return
      e.preventDefault()
      setIsOpen((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])

  if (!user || !campaign || !title) return null

  return (
    <>
      {(isOpen || !instant) && (
        <Presence show={isOpen} exitMs={180}>
          {(state) => (
            <div className="notebook-panel fab-panel anim-pop" data-state={state} data-fab-panel="notes" role="dialog" aria-label={title}>
              <NotebookPanel campaign={campaign} title={title} userId={user.id} onClose={close} />
            </div>
          )}
        </Presence>
      )}
      <div className="notebook-fab">
        <button
          type="button"
          className={`notebook-fab__button${isOpen ? ' notebook-fab__button--open' : ''}${writing ? ' notebook-fab__button--writing' : ''}`}
          onClick={() => setIsOpen((v) => !v)}
          aria-label={title}
          aria-expanded={isOpen}
          aria-keyshortcuts="Tab"
          title={`${title} (Tab)`}
        >
          <QuillIcon key={writing} />
        </button>
      </div>
    </>
  )
}

const STATUS_LABEL: Record<SaveStatus, string> = { idle: '', saving: 'salvando…', saved: 'salvo ✓', error: 'não salvou — tente de novo' }

function NotebookPanel({ campaign, title, userId, onClose }: { campaign: CampaignWithRole; title: string; userId: string; onClose: () => void }) {
  const [sessions, setSessions] = useState<CampaignSession[]>([])
  const [notes, setNotes]       = useState<NotebookNote[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  /** Id da anotação aberta, ou 'new' (folha em branco que vira nota ao digitar). */
  const [active, setActive]     = useState<string>('new')
  const [status, setStatus]     = useState<SaveStatus>('idle')
  const [loading, setLoading]   = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Muda só quando a pessoa troca de anotação/sessão — salvar a primeira vez
  // não recria a folha (o cursor não pula no meio da digitação).
  const [sheetKey, setSheetKey] = useState(0)
  const open = (id: string) => { setActive(id); setConfirmDelete(false); setSheetKey((k) => k + 1) }

  const reload = useCallback(async () => {
    setNotes(await listNotes(campaign.id, userId))
  }, [campaign.id, userId])

  useEffect(() => {
    let alive = true
    void Promise.all([getCampaignSessions(campaign.id).catch(() => []), listNotes(campaign.id, userId).catch(() => [])])
      .then(([s, n]) => {
        if (!alive) return
        setSessions(s)
        setNotes(n)
        const sid = currentSessionId(s)
        setSessionId(sid)
        const inSession = n.filter((x) => x.session_id === sid)
        setActive(inSession.length ? inSession[inSession.length - 1].id : 'new')
        setLoading(false)
      })
    return () => { alive = false }
  }, [campaign.id, userId])

  // O mestre também pode editar — mantém a lista em dia.
  useEffect(() => subscribeNotes(campaign.id, () => { void reload().catch(() => {}) }), [campaign.id, reload])

  const inSession = useMemo(() => notes.filter((n) => n.session_id === sessionId), [notes, sessionId])
  const current = notes.find((n) => n.id === active) ?? null

  function pickSession(value: string) {
    const sid = value || null
    setSessionId(sid)
    const list = notes.filter((n) => n.session_id === sid)
    open(list.length ? list[list.length - 1].id : 'new')
  }

  function onSaved(note: NotebookNote) {
    setNotes((prev) => (prev.some((n) => n.id === note.id) ? prev.map((n) => (n.id === note.id ? note : n)) : [...prev, note]))
    setActive(note.id)
  }

  async function remove() {
    if (!current) return
    try {
      await deleteNote(current.id)
      const rest = notes.filter((n) => n.id !== current.id)
      setNotes(rest)
      const list = rest.filter((n) => n.session_id === sessionId)
      open(list.length ? list[list.length - 1].id : 'new')
    } catch {
      setStatus('error')
    }
    setConfirmDelete(false)
  }

  return (
    <>
      <div className="notebook-panel__header">
        <span className="notebook-panel__icon"><QuillIcon size={16} /></span>
        <span className="notebook-panel__titles">
          <span className="notebook-panel__title">{title}</span>
          <span className="notebook-panel__campaign">{campaign.name}</span>
        </span>
        <span className={`notebook-panel__status notebook-panel__status--${status}`} aria-live="polite">{STATUS_LABEL[status]}</span>
        <button type="button" className="notebook-panel__close" onClick={onClose} aria-label="Fechar anotações">✕</button>
      </div>

      {loading ? (
        <div className="notebook-panel__loading"><div className="spinner spinner--sm" /></div>
      ) : (
        <>
          <div className="notebook-panel__bar">
            <Select
              value={sessionId ?? ''}
              onChange={pickSession}
              aria-label="Sessão"
              options={[
                ...sessions.filter((s) => s.status !== 'canceled').map((s) => ({ value: s.id, label: sessionLabel(s) })),
                { value: '', label: 'Sem sessão definida' },
              ]}
            />
          </div>

          <div className="notebook-panel__tabs" role="tablist" aria-label="Anotações desta sessão">
            {inSession.map((n, i) => (
              <button
                key={n.id} type="button" role="tab" aria-selected={active === n.id}
                className={`notebook-tab${active === n.id ? ' notebook-tab--on' : ''}`}
                onClick={() => { if (active !== n.id) open(n.id) }}
                title={noteHeadline(n.content) || 'Anotação vazia'}
              >
                <span className="notebook-tab__n">{i + 1}</span>
                <span className="notebook-tab__text">{noteHeadline(n.content) || '—'}</span>
              </button>
            ))}
            <button
              type="button"
              className={`notebook-tab notebook-tab--new${active === 'new' ? ' notebook-tab--on' : ''}`}
              onClick={() => open('new')}
              aria-label="Nova anotação"
              title="Nova anotação"
            >
              +
            </button>
          </div>

          <NoteEditor
            key={sheetKey}
            note={current}
            campaignId={campaign.id}
            sessionId={sessionId}
            autoFocus
            placeholder="Escreva aqui… salva sozinho. Tab fecha."
            className="note-sheet--panel"
            onSaved={onSaved}
            onStatus={setStatus}
          />

          <div className="notebook-panel__foot">
            {current ? (
              <>
                <span className="notebook-panel__meta">
                  criada {timeLabel(current.created_at)}
                  {current.updated_at !== current.created_at && ` · editada ${timeLabel(current.updated_at)}`}
                  {current.updated_by && current.updated_by !== userId && ' pelo mestre'}
                </span>
                {confirmDelete ? (
                  <span className="notebook-panel__confirm">
                    Apagar?
                    <button type="button" onClick={() => void remove()}>Sim</button>
                    <button type="button" onClick={() => setConfirmDelete(false)}>Não</button>
                  </span>
                ) : (
                  <button type="button" className="notebook-panel__delete" onClick={() => setConfirmDelete(true)}>Apagar</button>
                )}
              </>
            ) : (
              <span className="notebook-panel__meta">O mestre da campanha vê o que você anotar aqui.</span>
            )}
          </div>
        </>
      )}
    </>
  )
}
