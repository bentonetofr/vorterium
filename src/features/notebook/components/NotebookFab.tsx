import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { getCampaignSessions } from '../../sessions/services/sessionService'
import { Presence } from '../../../shared/components/Presence'
import { Select } from '../../../shared/components/Select'
import { useFloatingPanel } from '../../../shared/lib/floatingPanels'
import type { CampaignSession, CampaignWithRole } from '../../../shared/types'
import {
  createNote,
  currentSessionId,
  deleteNote,
  listNotes,
  noteHeadline,
  sessionLabel,
  subscribeNotes,
  timeLabel,
  removeNoteImageFile,
  updateNote,
  uploadNoteImage,
  useMyNotebook,
  type NoteImage,
  type NotebookNote,
} from '../services/notebookService'
import { NoteEditor, type NoteEditorHandle, type SaveStatus } from './NoteEditor'
import { NoteImages } from './NoteImages'
import { EmojiPickerButton } from '../../../shared/components/EmojiPicker'
import { NoteFormatBar } from './NoteFormatBar'
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
  // O caderno em si (null = a conta não tem). O nome no banco (ex.: "Anotações
  // da Bruna") é o que o MESTRE vê; pra quem escreve, é sempre "Meu caderninho".
  const notebook = useMyNotebook(user?.id)
  const title = notebook ? OWNER_TITLE : notebook
  const [isOpen, setIsOpen] = useState(false)
  const campaignId = campaign?.id ?? null

  const close = useCallback(() => setIsOpen(false), [])
  const { height, dragging, gripProps } = usePanelHeight()
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
      if (target && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"], .emoji-pop'))) return
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
            <div
              className={`notebook-panel fab-panel anim-pop${dragging ? ' notebook-panel--resizing' : ''}`}
              data-state={state}
              data-fab-panel="notes"
              role="dialog"
              aria-label={title}
              style={height ? { height } : undefined}
            >
              <div className="notebook-panel__grip" {...gripProps}><span /></div>
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

// ── Altura do painel: arrastando a alça do topo pra cima ──

const HEIGHT_KEY = 'vorterium:caderno-altura'
const MIN_HEIGHT = 240

function readHeight(): number | null {
  try {
    const v = Number(localStorage.getItem(HEIGHT_KEY))
    return Number.isFinite(v) && v >= MIN_HEIGHT ? v : null
  } catch { return null }
}

/**
 * Altura escolhida pela pessoa (guardada neste navegador). Sem escolha, o
 * painel usa a altura padrão das janelas do canto. Duplo clique na alça
 * volta ao padrão; setas ↑/↓ na alça também mudam a altura.
 */
function usePanelHeight() {
  const [height, setHeight] = useState<number | null>(readHeight)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ y: number; h: number; max: number; last: number } | null>(null)

  const save = (h: number | null) => {
    setHeight(h)
    try { if (h) localStorage.setItem(HEIGHT_KEY, String(Math.round(h))); else localStorage.removeItem(HEIGHT_KEY) } catch { /* sem armazenamento */ }
  }
  // Até perto do topo da tela (o CSS ainda deixa lugar pros avisos do canto).
  const maxFor = (panel: Element) => {
    const css = parseFloat(getComputedStyle(panel).maxHeight)
    const room = panel.getBoundingClientRect().bottom - 16
    return Math.max(MIN_HEIGHT, Number.isFinite(css) ? Math.min(css, room) : room)
  }
  const clampH = (h: number, max: number) => Math.round(Math.min(max, Math.max(MIN_HEIGHT, h)))

  const gripProps = {
    role: 'separator' as const,
    'aria-orientation': 'horizontal' as const,
    'aria-label': 'Arraste pra cima ou pra baixo pra mudar a altura',
    title: 'Arraste pra mudar a altura (duplo clique volta ao normal)',
    tabIndex: 0,
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      const panel = e.currentTarget.parentElement
      if (!panel) return
      e.preventDefault()
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* segue sem captura */ }
      const h = panel.getBoundingClientRect().height
      drag.current = { y: e.clientY, h, max: maxFor(panel), last: h }
      setDragging(true)
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d) return
      d.last = clampH(d.h + (d.y - e.clientY), d.max)
      setHeight(d.last)
    },
    onPointerUp: () => {
      const d = drag.current
      if (!d) return
      drag.current = null
      setDragging(false)
      save(d.last)
    },
    onDoubleClick: () => save(null),
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      const panel = e.currentTarget.parentElement
      if (!panel) return
      e.preventDefault()
      const cur = panel.getBoundingClientRect().height
      save(clampH(cur + (e.key === 'ArrowUp' ? 40 : -40), maxFor(panel)))
    },
  }
  return { height, dragging, gripProps }
}

const OWNER_TITLE = 'Meu caderninho'

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
  const [uploading, setUploading] = useState(0)
  const editorRef = useRef<NoteEditorHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef(notes)
  notesRef.current = notes
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

  // Imagens coladas/arrastadas/escolhidas: vão pra anotação aberta (se a
  // folha ainda está em branco, a anotação nasce agora).
  async function addImages(files: File[]) {
    const list = files.filter((f) => f.type.startsWith('image/')).slice(0, 10)
    if (list.length === 0) return
    setUploading((n) => n + list.length)
    setStatus('saving')
    try {
      let note = current
      if (!note) {
        const created = await createNote(campaign.id, sessionId, '')
        note = created
        setNotes((prev) => [...prev, created])
        setActive(created.id)
      }
      const added: NoteImage[] = []
      for (const f of list) {
        try { added.push(await uploadNoteImage(campaign.id, userId, f)) } catch { /* segue com as outras */ }
        setUploading((n) => n - 1)
      }
      if (added.length === 0) { setStatus('error'); return }
      const latest = notesRef.current.find((n) => n.id === note!.id) ?? note
      const saved = await updateNote(note.id, { images: [...latest.images, ...added].slice(0, 30) })
      setNotes((prev) => prev.map((n) => (n.id === saved.id ? saved : n)))
      setStatus(added.length === list.length ? 'saved' : 'error')
    } catch {
      setUploading(0)
      setStatus('error')
    }
  }

  async function removeImage(img: NoteImage) {
    if (!current) return
    try {
      const saved = await updateNote(current.id, { images: current.images.filter((i) => i.path !== img.path) })
      setNotes((prev) => prev.map((n) => (n.id === saved.id ? saved : n)))
      void removeNoteImageFile(img.path).catch(() => {})
    } catch {
      setStatus('error')
    }
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
            <div className="notebook-panel__session">
              <Select
                value={sessionId ?? ''}
                onChange={pickSession}
                aria-label="Episódio"
                options={[
                  ...sessions.filter((s) => s.status !== 'canceled').map((s) => ({ value: s.id, label: sessionLabel(s) })),
                  { value: '', label: 'Sem episódio definido' },
                ]}
              />
            </div>
            <EmojiPickerButton className="note-tool" keepFocus onPick={(e) => editorRef.current?.insert(e)} />
            <button
              type="button"
              className="note-tool"
              onClick={() => fileRef.current?.click()}
              aria-label="Pôr imagem"
              title="Pôr imagem (ou cole com Ctrl+V / arraste pra folha)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" />
              </svg>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ''; void addImages(f) }}
            />
          </div>

          <div className="notebook-panel__tabs" role="tablist" aria-label="Anotações deste episódio">
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

          <NoteFormatBar editor={editorRef} />

          <NoteEditor
            key={sheetKey}
            ref={editorRef}
            note={current}
            campaignId={campaign.id}
            sessionId={sessionId}
            autoFocus
            placeholder="Escreva aqui… salva sozinho. Cole imagens com Ctrl+V. Tab fecha."
            className="note-sheet--panel"
            onSaved={onSaved}
            onStatus={setStatus}
            onFiles={(f) => void addImages(f)}
          />

          <NoteImages images={current?.images ?? []} uploading={uploading} onRemove={(img) => void removeImage(img)} />

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
