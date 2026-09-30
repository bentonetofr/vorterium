import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { getCurrentProfile } from '../../users/services/profileService'
import { documentKind, uploadDocument, type CampaignDocument } from '../../library/services/campaignDocumentsService'
import { signBoardPhotos, uploadBoardPhoto, type BoardPhoto } from '../../mesa/services/mesaImagesService'
import type { CampaignWithRole } from '../../../shared/types'
import {
  connectBoard, deleteBoardItems, listBoardItems, peerColor, saveBoardItems, signBoardPaths,
  type BoardConnection, type BoardId, type BoardItem, type BoardKind, type BoardPeer, type CursorMessage, type Endpoint, type ShapeType,
} from '../services/boardService'
import {
  DEFAULT_SIZE, INK, MAX_ZOOM, MIN_ZOOM, NOTE_COLORS, TEXT_SIZES, clamp, connectorEnds, contains, defaultData,
  editableText, intersects, itemBounds, newId, normRect, rectOf, simplify, unionRect,
  type Point, type Rect, type View,
} from '../boardGeometry'
import { BoardItemView, ConnectorLabel, ConnectorLayer, strokePath } from './BoardItemView'
import {
  BOARD_ACCEPT, BoardContextBar, BoardHelp, BoardToolbar, BoardZoomBar, Icons, ImageLightbox, LibraryPicker, TimelineEditor,
  type PenSettings, type Tool,
} from './BoardChrome'
import './Board.css'

// ────────────────────────────────────────────────────────
// Quadro da campanha — um quadro infinito no estilo do Miro, que a mesa
// monta junta e em tempo real: cada um vê o cursor e o arrasto dos outros,
// e o que alguém muda aparece na hora pra todo mundo.
//
// Tudo fica em refs (itens, vista, arrasto) e um contador força o redesenho
// — assim os eventos do ponteiro sempre leem o estado mais novo sem
// depender de closures. Cada mudança "de verdade" passa por commit(): entra
// no desfazer/refazer e vai pro banco (agrupado, ~0,3 s depois).
// ────────────────────────────────────────────────────────

type Changes = Record<string, BoardItem | null>
interface HistoryEntry { before: Changes; after: Changes }

type Drag =
  | { type: 'pan'; sx: number; sy: number; tx: number; ty: number }
  | { type: 'move'; start: Point; orig: Record<string, BoardItem>; moved: boolean; clickId: string | null }
  | { type: 'resize'; id: string; handle: string; orig: BoardItem; start: Point }
  | { type: 'box'; start: Point; base: string[] }
  | { type: 'draw'; points: Point[] }
  | { type: 'connect'; id: string }
  | { type: 'endpoint'; id: string; end: 'from' | 'to'; orig: BoardItem }

const CLIP_PREFIX = 'vorterium-quadro:'
const SAVE_DELAY = 300
const LIVE_EVERY = 60
const CURSOR_EVERY = 50

const viewKey = (campaignId: string, board: BoardId) => `vorterium:quadro-vista:${campaignId}${board === 'mestre' ? ':mestre' : ''}`
const tabKey = (campaignId: string) => `vorterium:quadro-aba:${campaignId}`

function readSavedView(campaignId: string, board: BoardId): View | null {
  try {
    const v = JSON.parse(localStorage.getItem(viewKey(campaignId, board)) ?? 'null') as View | null
    if (v && [v.tx, v.ty, v.zoom].every((n) => typeof n === 'number' && Number.isFinite(n))) return { ...v, zoom: clamp(v.zoom, MIN_ZOOM, MAX_ZOOM) }
  } catch { /* sem vista salva */ }
  return null
}

function withData(item: BoardItem, patch: BoardItem['data']): BoardItem {
  return { ...item, data: { ...item.data, ...patch } }
}

const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" />
  </svg>
)
const GridIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)

const BOARD_TABS: { id: BoardId; label: string; icon: ReactNode }[] = [
  { id: 'geral',  label: 'Geral',            icon: <GridIcon /> },
  { id: 'mestre', label: 'Escudo do mestre', icon: <ShieldIcon /> },
]

/**
 * Aba Quadro da campanha. O mestre tem duas abas em cima do quadro (como
 * abas de navegador): o quadro Geral, de todo mundo, e o Escudo do mestre,
 * que só os mestres veem. Jogador só tem o Geral (e nem vê as abas).
 */
export function BoardPanel({ campaign }: { campaign: CampaignWithRole }) {
  const isMaster = campaign.role === 'master'
  const [board, setBoard] = useState<BoardId>(() => {
    try { return isMaster && localStorage.getItem(tabKey(campaign.id)) === 'mestre' ? 'mestre' : 'geral' } catch { return 'geral' }
  })
  const [full, setFull] = useState(false)
  const current: BoardId = isMaster ? board : 'geral'

  function pick(b: BoardId) {
    setBoard(b)
    try { localStorage.setItem(tabKey(campaign.id), b) } catch { /* sem armazenamento */ }
  }

  const tabs = isMaster ? (
    <div className="board-tabs" role="tablist" aria-label="Quadros">
      {BOARD_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={current === t.id}
          className={`board-tab board-tab--${t.id}${current === t.id ? ' is-on' : ''}`}
          onClick={() => pick(t.id)}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  ) : null

  return <BoardCanvas key={current} campaign={campaign} board={current} tabs={tabs} full={full} setFull={setFull} />
}

interface CanvasProps {
  campaign: CampaignWithRole
  board:    BoardId
  tabs:     ReactNode
  full:     boolean
  setFull:  React.Dispatch<React.SetStateAction<boolean>>
}

function BoardCanvas({ campaign, board, tabs, full, setFull }: CanvasProps) {
  const shield = board === 'mestre'
  const { user } = useAuth()
  const myId = user!.id
  const navigate = useNavigate()
  const isMaster = campaign.role === 'master'

  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const itemsRef   = useRef<Record<string, BoardItem>>({})
  const viewRef    = useRef<View>({ tx: 0, ty: 0, zoom: 1 })
  const selRef     = useRef<string[]>([])
  const dragRef    = useRef<Drag | null>(null)
  const history    = useRef<{ undo: HistoryEntry[]; redo: HistoryEntry[] }>({ undo: [], redo: [] })
  const pendingSave   = useRef(new Set<string>())
  const pendingDelete = useRef(new Set<string>())
  const saveTimer  = useRef<number | undefined>(undefined)
  const conn       = useRef<BoardConnection | null>(null)
  const meRef      = useRef<BoardPeer>({ userId: myId, name: 'Você', color: peerColor(myId) })
  const cursors    = useRef(new Map<string, CursorMessage & { t: number }>())
  const lastLive   = useRef(0)
  const lastCursor = useRef(0)
  const pointers   = useRef(new Map<number, Point>())
  const pinch      = useRef<{ dist: number; mid: Point; zoom: number; tx: number; ty: number } | null>(null)
  const spaceDown  = useRef(false)
  const active     = useRef(true)
  const editStart  = useRef<BoardItem | null>(null)
  const pointerWorld = useRef<Point | null>(null)
  const vpRef      = useRef<HTMLDivElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const uploadAt   = useRef<Point | null>(null)
  /** Vista pra aplicar assim que o quadro tiver tamanho (a salva, ou enquadrar tudo). */
  const initialView = useRef<View | 'fit' | null>(null)

  const [vp, setVp]             = useState({ w: 0, h: 0 })
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [toast, setToast]       = useState<string | null>(null)
  const [tool, setToolState]    = useState<Tool>('select')
  const [shape, setShape]       = useState<ShapeType>('rect')
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0])
  const [pen, setPen]           = useState<PenSettings>({ color: INK, width: 4 })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [boxRect, setBoxRect]   = useState<Rect | null>(null)
  const [drawing, setDrawing]   = useState<Point[] | null>(null)
  const [panning, setPanning]   = useState(false)
  const [help, setHelp]         = useState(false)
  const [picker, setPicker]     = useState(false)
  const [timelineId, setTimelineId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; name: string; data: BoardItem['data'] } | null>(null)
  const [uploading, setUploading] = useState(0)
  const [peers, setPeers]       = useState<BoardPeer[]>([])
  const [urls, setUrls]         = useState<Map<string, string | null>>(new Map())

  const items = itemsRef.current
  const view = viewRef.current
  const selection = selRef.current

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500)
  }, [])

  // ── Vista ─────────────────────────────────────────────

  const saveViewTimer = useRef<number | undefined>(undefined)
  const setView = useCallback((v: View) => {
    viewRef.current = v
    redraw()
    window.clearTimeout(saveViewTimer.current)
    saveViewTimer.current = window.setTimeout(() => {
      try { localStorage.setItem(viewKey(campaign.id, board), JSON.stringify(viewRef.current)) } catch { /* sem armazenamento */ }
    }, 400)
  }, [campaign.id, board])

  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
    const v = viewRef.current
    const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM)
    const wx = (sx - v.tx) / v.zoom, wy = (sy - v.ty) / v.zoom
    setView({ zoom, tx: sx - wx * zoom, ty: sy - wy * zoom })
  }, [setView])

  const fitRect = useCallback((r: Rect | null, maxZoom = 1) => {
    const el = vpRef.current
    if (!el) return
    const W = el.clientWidth, H = el.clientHeight
    if (!r) { setView({ zoom: 1, tx: W / 2, ty: H / 2 }); return }
    const pad = 60
    const zoom = clamp(Math.min((W - pad * 2) / Math.max(r.w, 1), (H - pad * 2) / Math.max(r.h, 1)), MIN_ZOOM, maxZoom)
    setView({ zoom, tx: W / 2 - (r.x + r.w / 2) * zoom, ty: H / 2 - (r.y + r.h / 2) * zoom })
  }, [setView])

  const fitAll = useCallback(() => {
    const all = itemsRef.current
    fitRect(unionRect(Object.values(all).map((i) => itemBounds(i, all))))
  }, [fitRect])

  const toWorld = useCallback((clientX: number, clientY: number): Point => {
    const r = vpRef.current!.getBoundingClientRect()
    const v = viewRef.current
    return { x: (clientX - r.left - v.tx) / v.zoom, y: (clientY - r.top - v.ty) / v.zoom }
  }, [])

  // ── Estado local, desfazer e salvar ───────────────────

  const setSelection = useCallback((ids: string[]) => {
    selRef.current = ids
    redraw()
  }, [])

  const applyLocal = useCallback((changes: Changes) => {
    const next = { ...itemsRef.current }
    for (const [id, it] of Object.entries(changes)) {
      if (it) next[id] = it
      else delete next[id]
    }
    itemsRef.current = next
    redraw()
  }, [])

  const flush = useCallback(async () => {
    window.clearTimeout(saveTimer.current)
    const saveIds = [...pendingSave.current]
    const delIds = [...pendingDelete.current]
    pendingSave.current.clear()
    pendingDelete.current.clear()
    const rows = saveIds.map((id) => itemsRef.current[id]).filter(Boolean)
    try {
      await saveBoardItems(rows)
      await deleteBoardItems(delIds)
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Não foi possível salvar o quadro.')
    }
  }, [flash])

  const persist = useCallback((changes: Changes) => {
    for (const [id, it] of Object.entries(changes)) {
      if (it) { pendingSave.current.add(id); pendingDelete.current.delete(id) }
      else { pendingDelete.current.add(id); pendingSave.current.delete(id) }
    }
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { void flush() }, SAVE_DELAY)
  }, [flush])

  /** Mudança de verdade: aplica, entra no desfazer e vai pro banco. */
  const commit = useCallback((after: Changes, before?: Changes) => {
    const prev: Changes = before ?? {}
    if (!before) for (const id of Object.keys(after)) prev[id] = itemsRef.current[id] ?? null
    applyLocal(after)
    persist(after)
    const h = history.current
    h.undo.push({ before: prev, after })
    if (h.undo.length > 100) h.undo.shift()
    h.redo = []
  }, [applyLocal, persist])

  const undo = useCallback(() => {
    const entry = history.current.undo.pop()
    if (!entry) return
    history.current.redo.push(entry)
    applyLocal(entry.before)
    persist(entry.before)
    setSelection(selRef.current.filter((id) => itemsRef.current[id]))
  }, [applyLocal, persist, setSelection])

  const redo = useCallback(() => {
    const entry = history.current.redo.pop()
    if (!entry) return
    history.current.undo.push(entry)
    applyLocal(entry.after)
    persist(entry.after)
    setSelection(selRef.current.filter((id) => itemsRef.current[id]))
  }, [applyLocal, persist, setSelection])

  const zRange = useCallback(() => {
    let min = 0, max = 0
    for (const it of Object.values(itemsRef.current)) { min = Math.min(min, it.z); max = Math.max(max, it.z) }
    return { min, max }
  }, [])

  const blank = useCallback((kind: BoardKind, x: number, y: number, w: number, h: number, data: BoardItem['data']): BoardItem => ({
    id: newId(), campaign_id: campaign.id, board, kind, x, y, w, h,
    z: kind === 'frame' ? zRange().min - 1 : zRange().max + 1,
    data, locked: false, created_by: myId, updated_by: myId, updated_at: new Date().toISOString(),
  }), [board, campaign.id, myId, zRange])

  // ── Carregar e tempo real ─────────────────────────────

  useEffect(() => {
    let alive = true
    setLoading(true)
    listBoardItems(campaign.id, board)
      .then((list) => {
        if (!alive) return
        itemsRef.current = Object.fromEntries(list.map((i) => [i.id, i]))
        initialView.current = readSavedView(campaign.id, board) ?? 'fit'
        setLoading(false)
      })
      .catch((err) => { if (alive) { setError(err instanceof Error ? err.message : 'Não foi possível carregar o quadro.'); setLoading(false) } })
    return () => { alive = false }
  }, [campaign.id, board])

  useEffect(() => {
    let alive = true
    let c: BoardConnection | null = null
    void getCurrentProfile().catch(() => null).then((profile) => {
      if (!alive) return
      meRef.current = { userId: myId, name: profile?.display_name || 'Alguém', color: peerColor(myId) }
      c = connectBoard(campaign.id, board, meRef.current, {
        onUpsert: (row) => {
          const d = dragRef.current
          const mine = row.updated_by === myId && itemsRef.current[row.id]
          const busy = pendingSave.current.has(row.id)
            || (d?.type === 'move' && row.id in d.orig)
            || ((d?.type === 'resize' || d?.type === 'endpoint') && d.id === row.id)
            || editStart.current?.id === row.id
          if (mine || busy) return
          applyLocal({ [row.id]: row })
        },
        onDelete: (id) => {
          if (!itemsRef.current[id]) return
          applyLocal({ [id]: null })
          if (selRef.current.includes(id)) setSelection(selRef.current.filter((s) => s !== id))
        },
        onCursor: (msg) => {
          cursors.current.set(msg.userId, { ...msg, t: Date.now() })
          redraw()
        },
        onLive: (msg) => {
          const d = dragRef.current
          const changes: Changes = {}
          for (const it of msg.items) {
            if (!itemsRef.current[it.id]) continue
            if (d?.type === 'move' && it.id in d.orig) continue
            changes[it.id] = it
          }
          if (Object.keys(changes).length) applyLocal(changes)
        },
        onPeers: setPeers,
      })
      conn.current = c
    })
    return () => { alive = false; c?.close(); conn.current = null }
  }, [campaign.id, board, myId, applyLocal, setSelection])

  // Cursores parados somem.
  useEffect(() => {
    const t = window.setInterval(() => {
      let changed = false
      for (const [id, c] of cursors.current) if (Date.now() - c.t > 6000) { cursors.current.delete(id); changed = true }
      if (changed) redraw()
    }, 2000)
    return () => window.clearInterval(t)
  }, [])

  // Salva o que ficou pendente ao sair.
  useEffect(() => {
    const onHide = () => { void flush() }
    window.addEventListener('pagehide', onHide)
    return () => { window.removeEventListener('pagehide', onHide); void flush() }
  }, [flush])

  // Tamanho da área do quadro.
  useLayoutEffect(() => {
    const el = vpRef.current
    if (!el) return
    const measure = () => {
      setVp({ w: el.clientWidth, h: el.clientHeight })
      const iv = initialView.current
      if (iv && el.clientWidth > 0) {
        initialView.current = null
        if (iv === 'fit') fitAll()
        else setView(iv)
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [loading, fitAll, setView])

  // Links das imagens: fotos postas no quadro moram na Galeria; imagens
  // trazidas da estante, na Biblioteca.
  const imageRefs = useMemo(
    () => Object.values(items)
      .filter((i) => i.kind === 'image' && i.data.path)
      .map((i) => ({ path: i.data.path!, gallery: i.data.store === 'gallery' })),
    [items],
  )
  useEffect(() => {
    const missingRefs = imageRefs.filter((r) => !urls.has(r.path))
    if (missingRefs.length === 0) return
    const missing = missingRefs.map((r) => r.path)
    let alive = true
    void Promise.all([
      signBoardPhotos(missingRefs.filter((r) => r.gallery).map((r) => r.path)),
      signBoardPaths(missingRefs.filter((r) => !r.gallery).map((r) => r.path)),
    ]).then(([photos, docs]) => {
      const signed = new Map([...photos, ...docs])
      if (!alive) return
      setUrls((prev) => {
        const next = new Map(prev)
        for (const p of missing) next.set(p, signed.get(p) ?? null)
        return next
      })
    })
    return () => { alive = false }
  }, [imageRefs, urls])

  // ── Ferramentas ───────────────────────────────────────

  const setTool = useCallback((t: Tool) => {
    setToolState(t)
    if (t !== 'select') setSelection([])
  }, [setSelection])

  const startEdit = useCallback((id: string) => {
    const it = itemsRef.current[id]
    if (!it || it.locked || !editableText(it.kind)) return
    editStart.current = it
    setSelection([id])
    setEditingId(id)
  }, [setSelection])

  const createAt = useCallback((kind: BoardKind, p: Point) => {
    const size = DEFAULT_SIZE[kind] ?? { w: 200, h: 200 }
    const it = blank(kind, p.x - size.w / 2, p.y - size.h / 2, size.w, size.h, defaultData(kind, { shape, color: kind === 'note' ? noteColor : undefined }))
    commit({ [it.id]: it }, { [it.id]: null })
    setToolState('select')
    setSelection([it.id])
    if (kind === 'note' || kind === 'text' || kind === 'frame') startEdit(it.id)
    if (kind === 'timeline') setTimelineId(it.id)
  }, [blank, commit, noteColor, setSelection, shape, startEdit])

  // Texto sendo digitado: aparece pros outros enquanto digita (sem desfazer a cada letra).
  const onText = useCallback((id: string, text: string) => {
    const it = itemsRef.current[id]
    if (!it) return
    const next = withData(it, it.kind === 'frame' ? { title: text } : { text })
    applyLocal({ [id]: next })
    persist({ [id]: next })
  }, [applyLocal, persist])

  const onDone = useCallback((id: string) => {
    const before = editStart.current
    editStart.current = null
    setEditingId(null)
    const it = itemsRef.current[id]
    if (!it || !before || before.id !== id) return
    // Texto solto vazio some (como no Miro).
    if (it.kind === 'text' && !(it.data.text ?? '').trim()) {
      commit({ [id]: null }, { [id]: before })
      setSelection([])
      return
    }
    if (JSON.stringify(before.data) !== JSON.stringify(it.data) || before.h !== it.h) commit({ [id]: it }, { [id]: before })
  }, [commit, setSelection])

  const onMeasure = useCallback((id: string, h: number) => {
    const it = itemsRef.current[id]
    if (it && Math.abs(it.h - h) > 1) applyLocal({ [id]: { ...it, h } })
  }, [applyLocal])

  // ── Ações na seleção ──────────────────────────────────

  const selectedItems = useCallback(() => selRef.current.map((id) => itemsRef.current[id]).filter(Boolean), [])
  const editable = useCallback(() => selectedItems().filter((i) => !i.locked), [selectedItems])

  const mapSelected = useCallback((fn: (it: BoardItem) => BoardItem | null) => {
    const after: Changes = {}
    for (const it of editable()) {
      const n = fn(it)
      if (n) after[it.id] = n
    }
    if (Object.keys(after).length) commit(after)
  }, [commit, editable])

  const deleteSelection = useCallback(() => {
    const ids = new Set(editable().map((i) => i.id))
    if (ids.size === 0) return
    // Setas presas no que foi apagado vão junto.
    for (const it of Object.values(itemsRef.current)) {
      if (it.kind === 'connector' && !it.locked && ((it.data.from?.id && ids.has(it.data.from.id)) || (it.data.to?.id && ids.has(it.data.to.id)))) ids.add(it.id)
    }
    const after: Changes = {}
    for (const id of ids) after[id] = null
    commit(after)
    setSelection([])
  }, [commit, editable, setSelection])

  /** Cópia dos itens (com setas entre eles), com ids novos e deslocada. */
  const cloneItems = useCallback((source: BoardItem[], offset: Point) => {
    const idMap = new Map(source.map((i) => [i.id, newId()]))
    const { max } = zRange()
    const after: Changes = {}
    const shiftEnd = (e: Endpoint | undefined): Endpoint | undefined => {
      if (!e) return e
      if (e.id) return { id: idMap.get(e.id) ?? e.id }
      return { x: (e.x ?? 0) + offset.x, y: (e.y ?? 0) + offset.y }
    }
    source.sort((a, b) => a.z - b.z).forEach((it, i) => {
      const id = idMap.get(it.id)!
      after[id] = {
        ...it, id, campaign_id: campaign.id, board, locked: false,
        x: it.x + offset.x, y: it.y + offset.y,
        z: it.kind === 'frame' ? it.z : max + 1 + i,
        data: it.kind === 'connector' ? { ...it.data, from: shiftEnd(it.data.from), to: shiftEnd(it.data.to) } : { ...it.data },
        created_by: myId, updated_by: myId,
      }
    })
    const before: Changes = {}
    for (const id of Object.keys(after)) before[id] = null
    commit(after, before)
    setSelection(Object.keys(after))
  }, [campaign.id, commit, myId, setSelection, zRange])

  /** Seleção + setas cujas duas pontas estão nela. */
  const withInnerConnectors = useCallback((sel: BoardItem[]) => {
    const ids = new Set(sel.map((i) => i.id))
    const extra = Object.values(itemsRef.current).filter((c) =>
      c.kind === 'connector' && !ids.has(c.id)
      && (!c.data.from?.id || ids.has(c.data.from.id)) && (!c.data.to?.id || ids.has(c.data.to.id))
      && (c.data.from?.id || c.data.to?.id))
    return [...sel, ...extra]
  }, [])

  const duplicate = useCallback(() => {
    const sel = selectedItems()
    if (sel.length) cloneItems(withInnerConnectors(sel), { x: 24, y: 24 })
  }, [cloneItems, selectedItems, withInnerConnectors])

  const toClipboardText = useCallback(() => {
    const sel = selectedItems()
    if (!sel.length) return null
    return CLIP_PREFIX + JSON.stringify(withInnerConnectors(sel))
  }, [selectedItems, withInnerConnectors])

  const pasteItems = useCallback((list: BoardItem[]) => {
    if (!list.length) return
    const b = unionRect(list.filter((i) => i.kind !== 'connector').map(rectOf)) ?? { x: 0, y: 0, w: 0, h: 0 }
    const at = pointerWorld.current
    const offset = at ? { x: at.x - (b.x + b.w / 2), y: at.y - (b.y + b.h / 2) } : { x: 24, y: 24 }
    cloneItems(list, offset)
  }, [cloneItems])

  const toggleLock = useCallback(() => {
    if (!isMaster) return
    const sel = selectedItems()
    const lock = sel.some((i) => !i.locked)
    const after: Changes = {}
    for (const it of sel) after[it.id] = { ...it, locked: lock }
    commit(after)
  }, [commit, isMaster, selectedItems])

  const bringFront = useCallback(() => {
    const { max } = zRange()
    const sel = editable().sort((a, b) => a.z - b.z)
    const after: Changes = {}
    sel.forEach((it, i) => { after[it.id] = { ...it, z: max + 1 + i } })
    commit(after)
  }, [commit, editable, zRange])

  const sendBack = useCallback(() => {
    const { min } = zRange()
    const sel = editable().sort((a, b) => a.z - b.z)
    const after: Changes = {}
    sel.forEach((it, i) => { after[it.id] = { ...it, z: min - sel.length + i } })
    commit(after)
  }, [commit, editable, zRange])

  const openInLibrary = useCallback((docId?: string) => {
    if (!docId) return
    void flush()
    navigate(`/biblioteca?estante=${campaign.id}&doc=${docId}`)
  }, [campaign.id, flush, navigate])

  /** Onde abrir o original de uma imagem/arquivo: Galeria (só o mestre entra) ou Biblioteca. */
  const sourceOf = useCallback((data: BoardItem['data'] | undefined): { label: string; open: () => void } | null => {
    if (!data) return null
    if (data.store === 'gallery') {
      return isMaster ? { label: 'Abrir na Galeria', open: () => { void flush(); navigate('/galeria') } } : null
    }
    return data.docId ? { label: 'Abrir na Biblioteca', open: () => openInLibrary(data.docId) } : null
  }, [flush, isMaster, navigate, openInLibrary])

  // ── Arquivos: fotos vão pra Galeria, PDFs e textos pra Biblioteca ──

  /** Foto recém-enviada pra Galeria → item de imagem (já aparece com o arquivo local). */
  const placePhoto = useCallback((photo: BoardPhoto, at: Point, file: File) => {
    setUrls((prev) => new Map(prev).set(photo.path, URL.createObjectURL(file)))
    const scale = Math.min(1, 480 / Math.max(photo.w, photo.h, 1))
    const w = Math.round(photo.w * scale), h = Math.round(photo.h * scale)
    const it = blank('image', at.x - w / 2, at.y - h / 2, w, h, { path: photo.path, name: photo.name, store: 'gallery' })
    commit({ [it.id]: it }, { [it.id]: null })
    return it.id
  }, [blank, commit])

  const placeDoc = useCallback(async (doc: CampaignDocument, at: Point, file?: File) => {
    if (documentKind(doc) === 'image') {
      let nw = 400, nh = 300
      let url: string | null = null
      try {
        if (file) {
          url = URL.createObjectURL(file)
        } else {
          url = (await signBoardPaths([doc.path])).get(doc.path) ?? null
        }
        if (url) {
          const img = new Image()
          img.src = url
          await img.decode()
          nw = img.naturalWidth || nw
          nh = img.naturalHeight || nh
        }
      } catch { /* fica no tamanho padrão */ }
      if (url) setUrls((prev) => new Map(prev).set(doc.path, url))
      const scale = Math.min(1, 480 / Math.max(nw, nh))
      const w = Math.round(nw * scale), h = Math.round(nh * scale)
      const it = blank('image', at.x - w / 2, at.y - h / 2, w, h, { docId: doc.id, path: doc.path, name: doc.name, mime: doc.mime_type })
      commit({ [it.id]: it }, { [it.id]: null })
      return it.id
    }
    const size = DEFAULT_SIZE.file!
    const it = blank('file', at.x - size.w / 2, at.y - size.h / 2, size.w, size.h, { docId: doc.id, path: doc.path, name: doc.name, mime: doc.mime_type })
    commit({ [it.id]: it }, { [it.id]: null })
    return it.id
  }, [blank, commit])

  const viewCenter = useCallback((): Point => {
    const el = vpRef.current
    const v = viewRef.current
    return el ? { x: (el.clientWidth / 2 - v.tx) / v.zoom, y: (el.clientHeight / 2 - v.ty) / v.zoom } : { x: 0, y: 0 }
  }, [])

  const uploadFiles = useCallback(async (files: File[], at: Point | null) => {
    const base = at ?? viewCenter()
    const placed: string[] = []
    await Promise.all(files.slice(0, 20).map(async (file, i) => {
      setUploading((n) => n + 1)
      const at = { x: base.x + i * 40, y: base.y + i * 40 }
      try {
        if (file.type.startsWith('image/')) {
          // Foto → Galeria (a do escudo, numa pasta que só o mestre vê).
          placed.push(placePhoto(await uploadBoardPhoto(campaign.id, file, shield), at, file))
        } else {
          // PDF/texto → Biblioteca (no escudo, escondido dos jogadores).
          const doc = await uploadDocument(campaign.id, file, 'quadro', shield ? 'master' : 'all')
          placed.push(await placeDoc(doc, at, file))
        }
      } catch (err) {
        flash(err instanceof Error ? err.message : `Não foi possível enviar "${file.name}".`)
      } finally {
        setUploading((n) => n - 1)
      }
    }))
    if (placed.length) { setToolState('select'); setSelection(placed) }
  }, [campaign.id, flash, placeDoc, placePhoto, setSelection, shield, viewCenter])

  // ── Ponteiro ──────────────────────────────────────────

  const sendLive = useCallback((ids: string[]) => {
    const now = performance.now()
    if (now - lastLive.current < LIVE_EVERY) return
    lastLive.current = now
    conn.current?.sendLive({ userId: myId, items: ids.map((id) => itemsRef.current[id]).filter(Boolean) })
  }, [myId])

  /** Item (não seta) embaixo do ponteiro, pra prender a ponta de uma seta. */
  const itemAt = useCallback((clientX: number, clientY: number, except: string): string | null => {
    for (const el of document.elementsFromPoint(clientX, clientY)) {
      const id = (el as HTMLElement).closest?.('[data-board-id]')?.getAttribute('data-board-id')
      if (!id || id === except) continue
      const it = itemsRef.current[id]
      if (it && it.kind !== 'connector') return id
    }
    return null
  }, [])

  function endEditingIfAny() {
    const el = document.activeElement as HTMLElement | null
    if (el?.isContentEditable) el.blur()
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.isContentEditable) return
    if (e.button === 2) return
    active.current = true
    endEditingIfAny()
    // Mouse/caneta é um ponteiro só: descarta algum que ficou sem o "soltar".
    if (e.pointerType !== 'touch') pointers.current.clear()
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const el = vpRef.current!

    // Dois dedos: pinça (zoom + arrastar), cancelando o que estava rolando.
    if (e.pointerType === 'touch' && pointers.current.size === 2) {
      const d = dragRef.current
      if (d?.type === 'move') applyLocal(d.orig)
      dragRef.current = null
      setBoxRect(null); setDrawing(null)
      const [a, b] = [...pointers.current.values()]
      const r = el.getBoundingClientRect()
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top },
        zoom: viewRef.current.zoom, tx: viewRef.current.tx, ty: viewRef.current.ty,
      }
      return
    }
    if (pointers.current.size > 1) return

    e.preventDefault()
    try { el.setPointerCapture(e.pointerId) } catch { /* segue sem captura */ }
    const p = toWorld(e.clientX, e.clientY)
    const handle = target.closest<HTMLElement>('[data-handle]')?.dataset.handle
    const hitId = target.closest('[data-board-id]')?.getAttribute('data-board-id') ?? null
    const hit = hitId ? itemsRef.current[hitId] : undefined
    const v = viewRef.current

    if (e.button === 1 || tool === 'hand' || spaceDown.current || (e.pointerType === 'touch' && tool === 'select' && !hit && !handle)) {
      dragRef.current = { type: 'pan', sx: e.clientX, sy: e.clientY, tx: v.tx, ty: v.ty }
      setPanning(true)
      return
    }

    if (handle) {
      const id = selRef.current[0]
      const it = itemsRef.current[id]
      if (!it) return
      if (handle === 'from' || handle === 'to') dragRef.current = { type: 'endpoint', id, end: handle, orig: it }
      else dragRef.current = { type: 'resize', id, handle, orig: it, start: p }
      return
    }

    switch (tool) {
      case 'pen':
        dragRef.current = { type: 'draw', points: [p] }
        setDrawing([p])
        return
      case 'connector': {
        const from: Endpoint = hit && hit.kind !== 'connector' ? { id: hit.id } : { x: p.x, y: p.y }
        const c = blank('connector', 0, 0, 0, 0, { ...defaultData('connector'), from, to: { x: p.x, y: p.y } })
        applyLocal({ [c.id]: c })
        dragRef.current = { type: 'connect', id: c.id }
        return
      }
      case 'note': case 'text': case 'shape': case 'frame': case 'timeline':
        createAt(tool, p)
        return
    }

    // Selecionar
    if (hit) {
      const multi = e.shiftKey || e.ctrlKey || e.metaKey
      let sel = selRef.current
      if (multi) {
        sel = sel.includes(hit.id) ? sel.filter((s) => s !== hit.id) : [...sel, hit.id]
        setSelection(sel)
        if (!sel.includes(hit.id)) return
      } else if (!sel.includes(hit.id)) {
        sel = [hit.id]
        setSelection(sel)
      }
      // Molduras levam junto o que está dentro delas.
      const moving = new Set(sel.filter((id) => itemsRef.current[id] && !itemsRef.current[id].locked))
      for (const id of [...moving]) {
        const f = itemsRef.current[id]
        if (f.kind !== 'frame') continue
        for (const it of Object.values(itemsRef.current)) {
          if (!it.locked && it.kind !== 'connector' && it.id !== f.id && contains(rectOf(f), rectOf(it))) moving.add(it.id)
        }
      }
      if (moving.size === 0) return
      const orig: Record<string, BoardItem> = {}
      for (const id of moving) orig[id] = itemsRef.current[id]
      dragRef.current = { type: 'move', start: p, orig, moved: false, clickId: multi ? null : hit.id }
      return
    }

    const additive = e.shiftKey || e.ctrlKey || e.metaKey
    if (!additive) setSelection([])
    dragRef.current = { type: 'box', start: p, base: additive ? selRef.current : [] }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = vpRef.current
    if (!el) return
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const p = toWorld(e.clientX, e.clientY)
    pointerWorld.current = p

    // Cursor pros outros.
    if (e.pointerType === 'mouse') {
      const now = performance.now()
      if (now - lastCursor.current > CURSOR_EVERY) {
        lastCursor.current = now
        conn.current?.sendCursor({ ...meRef.current, x: p.x, y: p.y })
      }
    }

    const pz = pinch.current
    if (pz && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const r = el.getBoundingClientRect()
      const mid = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top }
      const zoom = clamp(pz.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pz.dist), MIN_ZOOM, MAX_ZOOM)
      const wx = (pz.mid.x - pz.tx) / pz.zoom, wy = (pz.mid.y - pz.ty) / pz.zoom
      setView({ zoom, tx: mid.x - wx * zoom, ty: mid.y - wy * zoom })
      return
    }

    const d = dragRef.current
    if (!d) return
    const v = viewRef.current

    switch (d.type) {
      case 'pan':
        setView({ ...v, tx: d.tx + e.clientX - d.sx, ty: d.ty + e.clientY - d.sy })
        return
      case 'move': {
        const dx = p.x - d.start.x, dy = p.y - d.start.y
        if (!d.moved && Math.hypot(dx * v.zoom, dy * v.zoom) < 3) return
        d.moved = true
        const changes: Changes = {}
        for (const [id, o] of Object.entries(d.orig)) {
          if (o.kind === 'connector') {
            const sh = (e2?: Endpoint) => (e2 && !e2.id ? { x: (e2.x ?? 0) + dx, y: (e2.y ?? 0) + dy } : e2)
            changes[id] = withData(o, { from: sh(o.data.from), to: sh(o.data.to) })
          } else {
            changes[id] = { ...o, x: o.x + dx, y: o.y + dy }
          }
        }
        applyLocal(changes)
        sendLive(Object.keys(changes))
        return
      }
      case 'resize': {
        const o = d.orig
        const dx = p.x - d.start.x, dy = p.y - d.start.y
        let { x, y, w, h } = o
        const hd = d.handle
        if (hd.includes('e')) w = o.w + dx
        if (hd.includes('w')) { w = o.w - dx; x = o.x + dx }
        if (hd.includes('s')) h = o.h + dy
        if (hd.includes('n')) { h = o.h - dy; y = o.y + dy }
        const min = 16
        if (w < min) { if (hd.includes('w')) x -= min - w; w = min }
        if (h < min) { if (hd.includes('n')) y -= min - h; h = min }
        // Imagem mantém a proporção (e o resto, com Shift).
        if ((o.kind === 'image' || e.shiftKey) && hd.length === 2 && o.w > 0 && o.h > 0) {
          const ratio = o.w / o.h
          if (w / h > ratio) w = h * ratio
          else h = w / ratio
          if (hd.includes('w')) x = o.x + o.w - w
          if (hd.includes('n')) y = o.y + o.h - h
        }
        applyLocal({ [d.id]: { ...o, x, y, w, h: o.kind === 'text' ? o.h : h } })
        sendLive([d.id])
        return
      }
      case 'box': {
        const r = normRect(d.start, p)
        setBoxRect(r)
        const all = itemsRef.current
        const hits = Object.values(all).filter((it) => {
          if (it.locked) return false
          const b = itemBounds(it, all)
          return it.kind === 'frame' || it.kind === 'connector' ? contains(r, b) : intersects(r, b)
        }).map((it) => it.id)
        setSelection([...new Set([...d.base, ...hits])])
        return
      }
      case 'draw': {
        const last = d.points[d.points.length - 1]
        if (Math.hypot(p.x - last.x, p.y - last.y) * v.zoom < 1.5) return
        d.points.push(p)
        setDrawing([...d.points])
        return
      }
      case 'connect':
      case 'endpoint': {
        const c = itemsRef.current[d.id]
        if (!c) return
        const end = d.type === 'connect' ? 'to' : d.end
        const other = end === 'to' ? c.data.from : c.data.to
        const over = itemAt(e.clientX, e.clientY, d.id)
        const target: Endpoint = over && over !== other?.id ? { id: over } : { x: p.x, y: p.y }
        applyLocal({ [d.id]: withData(c, { [end]: target }) })
        return
      }
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null
      return
    }
    const d = dragRef.current
    dragRef.current = null
    setPanning(false)
    if (!d) return
    const v = viewRef.current

    switch (d.type) {
      case 'move': {
        if (d.moved) {
          const after: Changes = {}
          for (const id of Object.keys(d.orig)) after[id] = itemsRef.current[id] ?? null
          commit(after, { ...d.orig })
        } else if (d.clickId && selRef.current.length > 1) {
          setSelection([d.clickId])
        }
        return
      }
      case 'resize':
      case 'endpoint': {
        const now = itemsRef.current[d.id]
        if (now && JSON.stringify(now) !== JSON.stringify(d.orig)) commit({ [d.id]: now }, { [d.id]: d.orig })
        return
      }
      case 'box':
        setBoxRect(null)
        return
      case 'draw': {
        setDrawing(null)
        const pts = simplify(d.points, 0.8 / v.zoom)
        const width = pen.width
        const pad = width / 2 + 2
        const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y)
        const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad
        const w = Math.max(...xs) - x + pad, h = Math.max(...ys) - y + pad
        const points = pts.flatMap((q) => [Math.round((q.x - x) * 10) / 10, Math.round((q.y - y) * 10) / 10])
        const it = blank('drawing', x, y, w, h, { points, bw: w, bh: h, color: pen.color, width })
        commit({ [it.id]: it }, { [it.id]: null })
        return
      }
      case 'connect': {
        const c = itemsRef.current[d.id]
        if (!c) return
        const { a, b } = connectorEnds(c, itemsRef.current)
        const tiny = Math.hypot(a.x - b.x, a.y - b.y) * v.zoom < 12
        if (tiny && !(c.data.from?.id && c.data.to?.id)) { applyLocal({ [d.id]: null }); return }
        commit({ [d.id]: c }, { [d.id]: null })
        setSelection([d.id])
        return
      }
    }
  }

  function onDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.isContentEditable || target.closest('.board-toolbar, .board-zoombar, .board-context, .board-help, .board-toast, [data-handle]')) return
    const id = target.closest('[data-board-id]')?.getAttribute('data-board-id')
    const it = id ? itemsRef.current[id] : undefined
    if (!it) {
      // Duplo clique no vazio: um post-it ali mesmo.
      if (tool === 'select') createAt('note', toWorld(e.clientX, e.clientY))
      return
    }
    if (it.kind === 'timeline' && !it.locked) setTimelineId(it.id)
    else if (it.kind === 'image') {
      const url = it.data.path ? urls.get(it.data.path) : null
      if (url) setLightbox({ url, name: it.data.name ?? 'Imagem', data: it.data })
    } else if (it.kind === 'file') openInLibrary(it.data.docId)
    else startEdit(it.id)
  }

  // Roda do mouse: zoom no cursor; trackpad arrasta; Ctrl/pinça dá zoom.
  useEffect(() => {
    const el = vpRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if ((e.target as HTMLElement).closest('.board-help, .board-menu, .board-context__swatches')) return
      e.preventDefault()
      const r = el!.getBoundingClientRect()
      const sx = e.clientX - r.left, sy = e.clientY - r.top
      const v = viewRef.current
      const lineMode = e.deltaMode === 1
      const trackpad = !lineMode && (Math.abs(e.deltaX) > 0.5 || !Number.isInteger(e.deltaY))
      if (e.ctrlKey || e.metaKey) zoomAt(sx, sy, Math.exp(-e.deltaY * 0.01))
      else if (e.shiftKey) setView({ ...v, tx: v.tx - (e.deltaY || e.deltaX) })
      else if (trackpad) setView({ ...v, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY })
      else zoomAt(sx, sy, Math.exp(-e.deltaY * (lineMode ? 0.05 : 0.0015)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [loading, setView, zoomAt])

  // ── Teclado, copiar e colar ───────────────────────────

  useEffect(() => {
    function outside(e: PointerEvent) {
      const root = vpRef.current?.closest('.board')
      if (root && !root.contains(e.target as Node)) active.current = false
    }
    function typing(e: Event) {
      const t = e.target as HTMLElement | null
      // Campos de texto e as janelas/botões do canto (chat, dados, caderno)
      // ficam com as próprias teclas.
      return !!t && (t.isContentEditable || !!t.closest?.('input, textarea, select, [role="combobox"], .dice-fab-wrapper, [data-fab-panel]'))
    }
    function onKeyDown(e: KeyboardEvent) {
      if (!active.current || typing(e) || document.querySelector('.modal-overlay')) return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (e.key === ' ') { if (!spaceDown.current) { spaceDown.current = true; redraw() } e.preventDefault(); return }
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); redraw(); return }
      if (mod && k === 'y') { e.preventDefault(); redo(); redraw(); return }
      if (mod && k === 'd') { e.preventDefault(); duplicate(); return }
      if (mod && k === 'a') {
        e.preventDefault()
        setSelection(Object.values(itemsRef.current).filter((i) => !i.locked).map((i) => i.id))
        return
      }
      if (mod || e.altKey) return
      if (e.shiftKey && e.code === 'Digit1') { e.preventDefault(); fitAll(); return }
      if (e.shiftKey && e.code === 'Digit0') { e.preventDefault(); const el = vpRef.current!; zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1 / viewRef.current.zoom); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return }
      if (e.key === 'Escape') {
        if (selRef.current.length) setSelection([])
        else if (tool !== 'select') setToolState('select')
        else if (full) setFull(false)
        return
      }
      if (e.key === 'Enter' && selRef.current.length === 1) { e.preventDefault(); startEdit(selRef.current[0]); return }
      if (e.key.startsWith('Arrow') && selRef.current.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        mapSelected((it) => (it.kind === 'connector' ? null : { ...it, x: it.x + dx, y: it.y + dy }))
        return
      }
      if (e.key === '+' || e.key === '=') { const el = vpRef.current!; zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1.25); return }
      if (e.key === '-') { const el = vpRef.current!; zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1 / 1.25); return }
      const map: Record<string, Tool> = { v: 'select', h: 'hand', n: 'note', t: 'text', s: 'shape', l: 'connector', p: 'pen', f: 'frame', y: 'timeline' }
      if (map[k]) { setTool(map[k]); return }
      if (k === 'b') setPicker(true)
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === ' ' && spaceDown.current) { spaceDown.current = false; redraw() }
    }
    function onCopy(e: ClipboardEvent) {
      if (!active.current || typing(e)) return
      const text = toClipboardText()
      if (!text || !e.clipboardData) return
      e.clipboardData.setData('text/plain', text)
      e.preventDefault()
    }
    function onCut(e: ClipboardEvent) {
      onCopy(e)
      if (e.defaultPrevented) deleteSelection()
    }
    function onPaste(e: ClipboardEvent) {
      if (!active.current || typing(e) || document.querySelector('.modal-overlay')) return
      const data = e.clipboardData
      if (!data) return
      const files = [...data.files]
      if (files.length) { e.preventDefault(); void uploadFiles(files, pointerWorld.current); return }
      const text = data.getData('text/plain')
      if (!text) return
      e.preventDefault()
      if (text.startsWith(CLIP_PREFIX)) {
        try { pasteItems(JSON.parse(text.slice(CLIP_PREFIX.length)) as BoardItem[]) } catch { /* conteúdo estranho */ }
        return
      }
      // Texto comum vira post-it.
      const at = pointerWorld.current ?? viewCenter()
      const size = DEFAULT_SIZE.note!
      const it = blank('note', at.x - size.w / 2, at.y - size.h / 2, size.w, size.h, { text: text.slice(0, 2000), color: noteColor })
      commit({ [it.id]: it }, { [it.id]: null })
      setSelection([it.id])
    }
    window.addEventListener('pointerdown', outside, true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCut)
    document.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCut)
      document.removeEventListener('paste', onPaste)
    }
  }, [blank, commit, deleteSelection, duplicate, fitAll, full, mapSelected, noteColor, pasteItems, redo, setSelection, setTool, startEdit, toClipboardText, tool, undo, uploadFiles, viewCenter, zoomAt])

  // ── Desenho ───────────────────────────────────────────

  const all = Object.values(items)
  const visible: Rect = {
    x: -view.tx / view.zoom - 200 / view.zoom, y: -view.ty / view.zoom - 200 / view.zoom,
    w: vp.w / view.zoom + 400 / view.zoom, h: vp.h / view.zoom + 400 / view.zoom,
  }
  const selSet = new Set(selection)
  const shown = (it: BoardItem) => selSet.has(it.id) || it.id === editingId || intersects(visible, rectOf(it))
  const frames = all.filter((i) => i.kind === 'frame').sort((a, b) => a.z - b.z)
  const connectors = all.filter((i) => i.kind === 'connector')
  const others = all.filter((i) => i.kind !== 'frame' && i.kind !== 'connector' && shown(i)).sort((a, b) => a.z - b.z)
  const selItems = selection.map((id) => items[id]).filter(Boolean)
  const toScreen = (r: Rect): Rect => ({ x: r.x * view.zoom + view.tx, y: r.y * view.zoom + view.ty, w: r.w * view.zoom, h: r.h * view.zoom })
  const selBounds = unionRect(selItems.map((i) => itemBounds(i, items)))
  const single = selItems.length === 1 ? selItems[0] : null
  const timelineItem = timelineId ? items[timelineId] : null

  const itemProps = { editing: false, onText, onDone, onMeasure }

  const contextPos = selBounds && !editingId && !dragRef.current ? (() => {
    const s = toScreen(selBounds)
    const left = clamp(s.x + s.w / 2, 150, Math.max(150, vp.w - 150))
    // Moldura tem o título em cima — a barra sobe mais um pouco.
    const above = s.y - 56 - (selItems.some((i) => i.kind === 'frame') ? 26 : 0)
    return { left, top: above > 8 ? above : Math.min(s.y + s.h + 14, vp.h - 52) }
  })() : null

  const cursorClass = panning ? 'is-panning'
    : tool === 'hand' || spaceDown.current ? 'is-hand'
    : tool === 'select' ? '' : 'is-creating'

  if (loading) {
    return <div className="board-state"><div className="spinner spinner--sm" /> Abrindo o quadro…</div>
  }
  if (error) {
    return <p className="board-state board-state--error" role="alert">{error}</p>
  }

  return (
    <div className={`board${full ? ' board--full' : ''}`}>
      <header className="board-header">
        <div className="board-header__titles">
          <h3 className="board-header__title">{shield ? 'Escudo do mestre' : 'Quadro'}</h3>
          <p className="board-header__sub">
            {shield
              ? 'Só os mestres da campanha veem este quadro. Fotos postas aqui vão pra Galeria, e arquivos pra Biblioteca escondidos dos jogadores.'
              : 'O quadro infinito da campanha, onde todo mundo edita junto e em tempo real.'}
          </p>
        </div>
        <div className="board-header__side">
          {uploading > 0 && <span className="board-header__status"><span className="spinner spinner--sm" /> Enviando…</span>}
          {!shield && <div className="board-peers" aria-label="Quem está no quadro">
            {peers.slice(0, 6).map((p) => (
              <span key={p.userId} className="board-peer" style={{ background: p.color }} title={p.userId === myId ? `${p.name} (você)` : p.name}>
                {p.name.charAt(0).toUpperCase()}
              </span>
            ))}
            {peers.length > 6 && <span className="board-peer board-peer--more">+{peers.length - 6}</span>}
          </div>}
          <button type="button" className="board-header__btn" onClick={() => setHelp((v) => !v)} aria-expanded={help} title="Atalhos">{Icons.help}</button>
          <button type="button" className="board-header__btn" onClick={() => setFull((v) => !v)} title={full ? 'Sair da tela cheia' : 'Tela cheia'} aria-label={full ? 'Sair da tela cheia' : 'Tela cheia'}>
            {full ? Icons.shrink : Icons.expand}
          </button>
        </div>
      </header>

      {tabs}
      <div
        ref={vpRef}
        className={`board-viewport${tabs ? ' board-viewport--tabbed' : ''}${shield ? ' board-viewport--shield' : ''} ${cursorClass}`}
        style={{
          '--zoom': view.zoom,
          '--inv-zoom': 1 / view.zoom,
          backgroundSize: `${24 * view.zoom * (view.zoom < 0.35 ? 4 : 1)}px ${24 * view.zoom * (view.zoom < 0.35 ? 4 : 1)}px`,
          backgroundPosition: `${view.tx}px ${view.ty}px`,
        } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => { pointerWorld.current = null }}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => { if (dragRef.current) e.preventDefault() }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return
          e.preventDefault()
          void uploadFiles([...e.dataTransfer.files], toWorld(e.clientX, e.clientY))
        }}
      >
        <div className="board-world" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.zoom})` }}>
          {frames.filter(shown).map((f) => (
            <BoardItemView key={f.id} item={f} {...itemProps} editing={editingId === f.id} />
          ))}
          <ConnectorLayer connectors={connectors} items={items} selected={selSet} />
          {others.map((it) => (
            <BoardItemView
              key={it.id}
              item={it}
              {...itemProps}
              editing={editingId === it.id}
              imageUrl={it.kind === 'image' && it.data.path ? (urls.has(it.data.path) ? urls.get(it.data.path) : undefined) : undefined}
            />
          ))}
          {connectors.map((c) => (
            <ConnectorLabel key={c.id} item={c} items={items} {...itemProps} editing={editingId === c.id} />
          ))}
          {drawing && (
            <svg className="board-connectors" aria-hidden="true">
              <path d={strokePath(drawing.flatMap((q) => [q.x, q.y]))} fill="none" stroke={pen.color === INK ? 'var(--text-primary)' : pen.color} strokeWidth={pen.width} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        {/* ── Por cima (em pixels da tela) ── */}
        <div className="board-overlay">
          {selItems.filter((i) => i.kind !== 'connector').map((i) => {
            const s = toScreen(rectOf(i))
            return <div key={i.id} className={`board-sel${i.locked ? ' board-sel--locked' : ''}`} style={{ left: s.x, top: s.y, width: s.w, height: s.h }} />
          })}
          {single && !single.locked && !editingId && single.kind !== 'connector' && (() => {
            const s = toScreen(rectOf(single))
            const hs = single.kind === 'text' ? ['w', 'e'] : ['nw', 'ne', 'sw', 'se']
            const pos: Record<string, Point> = {
              nw: { x: s.x, y: s.y }, ne: { x: s.x + s.w, y: s.y }, sw: { x: s.x, y: s.y + s.h }, se: { x: s.x + s.w, y: s.y + s.h },
              w: { x: s.x, y: s.y + s.h / 2 }, e: { x: s.x + s.w, y: s.y + s.h / 2 },
            }
            return hs.map((h) => <span key={h} className={`board-handle board-handle--${h}`} data-handle={h} style={{ left: pos[h].x, top: pos[h].y }} />)
          })()}
          {single && !single.locked && single.kind === 'connector' && (() => {
            const { a, b } = connectorEnds(single, items)
            return (['from', 'to'] as const).map((end) => {
              const q = end === 'from' ? a : b
              return <span key={end} className="board-handle board-handle--end" data-handle={end} style={{ left: q.x * view.zoom + view.tx, top: q.y * view.zoom + view.ty }} />
            })
          })()}
          {boxRect && (() => { const s = toScreen(boxRect); return <div className="board-box" style={{ left: s.x, top: s.y, width: s.w, height: s.h }} /> })()}
          {[...cursors.current.values()].map((c) => (
            <div key={c.userId} className="board-cursor" style={{ left: c.x * view.zoom + view.tx, top: c.y * view.zoom + view.ty, '--c': c.color } as CSSProperties}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 1l13 7-6 1.5L6 16z" fill="var(--c)" stroke="#0b1326" strokeWidth="1.2" strokeLinejoin="round" /></svg>
              <span className="board-cursor__name">{c.name}</span>
            </div>
          ))}
          {all.length === 0 && (
            <div className="board-empty">
              <p className="board-empty__title">{shield ? 'Escudo em branco' : 'Quadro em branco'}</p>
              <p className="board-empty__text">
                {shield
                  ? 'Segredos, planos, mapas e anotações que os jogadores não podem ver. Só os mestres veem o que for posto aqui.'
                  : 'Escolha uma ferramenta à esquerda, dê um duplo clique pra criar um post-it, ou arraste fotos do computador pra cá. Elas vão direto pra Galeria da campanha.'}
              </p>
            </div>
          )}
        </div>

        {contextPos && (
          <BoardContextBar
            items={selItems}
            left={contextPos.left}
            top={contextPos.top}
            isMaster={isMaster}
            onColor={(color) => mapSelected((it) => (['note', 'shape', 'text', 'connector', 'drawing', 'timeline', 'frame'].includes(it.kind) ? withData(it, { color }) : null))}
            onShape={(s) => mapSelected((it) => (it.kind === 'shape' ? withData(it, { shape: s }) : null))}
            onTextSize={(dir) => mapSelected((it) => {
              if (it.kind !== 'text') return null
              const cur = it.data.size ?? 24
              const idx = TEXT_SIZES.findIndex((s) => s >= cur)
              const next = TEXT_SIZES[clamp((idx < 0 ? TEXT_SIZES.length - 1 : idx) + dir, 0, TEXT_SIZES.length - 1)]
              return withData(it, { size: next })
            })}
            onArrow={() => mapSelected((it) => (it.kind === 'connector' ? withData(it, { arrow: it.data.arrow === 'both' ? 'none' : it.data.arrow === 'none' ? 'end' : 'both' }) : null))}
            onDashed={() => mapSelected((it) => (it.kind === 'connector' ? withData(it, { dashed: !it.data.dashed }) : null))}
            onFront={bringFront}
            onBack={sendBack}
            onDuplicate={duplicate}
            onLock={toggleLock}
            onDelete={deleteSelection}
            onTimeline={() => single && setTimelineId(single.id)}
            openLabel={sourceOf(single?.data)?.label ?? null}
            onOpenLibrary={() => sourceOf(single?.data)?.open()}
            onZoomImage={() => {
              const url = single?.data.path ? urls.get(single.data.path) : null
              if (single && url) setLightbox({ url, name: single.data.name ?? 'Imagem', data: single.data })
            }}
          />
        )}

        <BoardToolbar
          tool={tool}
          onTool={setTool}
          shape={shape}
          onShape={setShape}
          noteColor={noteColor}
          onNoteColor={setNoteColor}
          pen={pen}
          onPen={setPen}
          onUpload={() => { uploadAt.current = null; fileRef.current?.click() }}
          onLibrary={() => setPicker(true)}
          canUndo={history.current.undo.length > 0}
          canRedo={history.current.redo.length > 0}
          onUndo={undo}
          onRedo={redo}
        />

        <BoardZoomBar
          zoom={view.zoom}
          frames={frames}
          onZoom={(f) => zoomAt(vp.w / 2, vp.h / 2, f)}
          onReset={() => zoomAt(vp.w / 2, vp.h / 2, 1 / view.zoom)}
          onFit={fitAll}
          onFrame={(id) => { const f = itemsRef.current[id]; if (f) { fitRect(rectOf(f), 2); setSelection([id]) } }}
        />

        {help && <BoardHelp onClose={() => setHelp(false)} />}
        {toast && <div className="board-toast" role="status">{toast}</div>}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={BOARD_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) void uploadFiles(files, uploadAt.current)
        }}
      />

      {timelineItem && (
        <TimelineEditor
          events={timelineItem.data.events ?? []}
          onClose={() => setTimelineId(null)}
          onSave={(events) => {
            const it = itemsRef.current[timelineItem.id]
            if (it) commit({ [it.id]: withData(it, { events }) })
            setTimelineId(null)
          }}
        />
      )}
      {picker && (
        <LibraryPicker
          campaignId={campaign.id}
          onClose={() => setPicker(false)}
          onUpload={() => { setPicker(false); uploadAt.current = null; fileRef.current?.click() }}
          onPick={(doc) => {
            setPicker(false)
            void placeDoc(doc, viewCenter()).then((id) => { setToolState('select'); setSelection([id]) })
          }}
        />
      )}
      {lightbox && (
        <ImageLightbox
          url={lightbox.url}
          name={lightbox.name}
          onClose={() => setLightbox(null)}
          openLabel={sourceOf(lightbox.data)?.label ?? null}
          onOpenLibrary={() => { setLightbox(null); sourceOf(lightbox.data)?.open() }}
        />
      )}
    </div>
  )
}
