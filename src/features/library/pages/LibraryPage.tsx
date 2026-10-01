import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { RulebookPanel, rulebookSystems, useCanEmbedPdf } from '../../rulebook/components/RulebookPanel'
import { getMyCampaigns } from '../../campaigns/services/campaignService'
import {
  DOCUMENT_ACCEPT,
  deleteDocument,
  documentKind,
  fileNameOf,
  formatSize,
  getDocumentUrl,
  getThumbUrls,
  isBoardDocument,
  listMyDocuments,
  updateDocument,
  uploadDocument,
  validateDocument,
  type CampaignDocument,
} from '../services/campaignDocumentsService'
import { getSystemEntry, getSystemLabel, type CampaignSystem } from '../../../shared/constants/systems'
import type { CampaignWithRole } from '../../../shared/types'
import '../../../shared/theme/toolPage.css'
import './LibraryPage.css'

// ────────────────────────────────────────────────────────
// Biblioteca — uma estante (card em forma de livro) por campanha, mais a
// estante dos livros de regras do Vorterium. Abrir a estante mostra um
// card por arquivo (os livros de regras, ou os documentos que o mestre
// guardou na campanha); abrir o arquivo mostra ele no próprio site: PDF no leitor,
// imagem grande, texto como página.
//
// A navegação fica na URL (?estante=…&doc=…), então o "voltar" do
// navegador e os links funcionam. O mestre envia, renomeia, mostra aos
// jogadores e exclui; os jogadores só leem o que está aberto pra mesa.
// ────────────────────────────────────────────────────────

const RULES_SHELF = 'livros'
const RULEBOOK_PREFIX = 'livro:'

/** Um arquivo da estante: o livro de regras do sistema ou um documento. */
type ShelfItem =
  | { type: 'rulebook'; key: string; system: CampaignSystem; title: string; subtitle: string }
  | { type: 'doc'; key: string; doc: CampaignDocument }

interface Shelf {
  key:       string
  name:      string
  kicker:    string
  campaign:  CampaignWithRole | null
  items:     ShelfItem[]
}

/** Troca de tela com a transição nativa do navegador, quando existe. */
function withTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (doc.startViewTransition && !reduce) doc.startViewTransition(() => flushSync(update))
  else update()
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')
}

function countLabel(n: number): string {
  if (n === 0) return 'Nenhum arquivo ainda'
  return `${n} ${n === 1 ? 'arquivo' : 'arquivos'}`
}

const KIND_LABEL = { pdf: 'PDF', image: 'Imagem', text: 'Texto' } as const

/** Nome da transição que liga o card do arquivo ao leitor. */
function transitionName(item: ShelfItem): string {
  return item.type === 'rulebook' ? `doc-livro-${item.system}` : `doc-${item.doc.id}`
}

export function LibraryPage() {
  const [campaigns, setCampaigns] = useState<CampaignWithRole[]>([])
  const [docs, setDocs]           = useState<CampaignDocument[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [params, setParams]       = useSearchParams()

  const load = useCallback(async () => {
    const [camps, list] = await Promise.all([getMyCampaigns(), listMyDocuments()])
    setCampaigns(camps)
    setDocs(list)
  }, [])

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar a biblioteca.'))
      .finally(() => setLoading(false))
  }, [load])

  const shelves = useMemo<Shelf[]>(() => {
    const books = rulebookSystems()
    const rulebookItem = (b: (typeof books)[number]): ShelfItem => ({
      type: 'rulebook', key: RULEBOOK_PREFIX + b.system, system: b.system, title: b.title, subtitle: b.subtitle,
    })

    const byCampaign = new Map<string, CampaignDocument[]>()
    for (const d of docs) byCampaign.set(d.campaign_id, [...(byCampaign.get(d.campaign_id) ?? []), d])

    // Os livros de regras ficam só na estante própria; a da campanha tem
    // apenas os documentos do mestre.
    const campaignShelves = campaigns.map<Shelf>((c) => ({
      key:      c.id,
      name:     c.name,
      kicker:   getSystemLabel(c.system),
      campaign: c,
      items:    (byCampaign.get(c.id) ?? []).map<ShelfItem>((doc) => ({ type: 'doc', key: doc.id, doc })),
    }))
    // Estantes com documento mais recente primeiro; as vazias por último.
    const latest = (s: Shelf) => {
      const last = s.items[s.items.length - 1]
      return last?.type === 'doc' ? last.doc.created_at : ''
    }
    campaignShelves.sort((a, b) => latest(b).localeCompare(latest(a)))

    const rules: Shelf[] = books.length
      ? [{ key: RULES_SHELF, name: 'Livros de regras', kicker: 'Vorterium', campaign: null, items: books.map(rulebookItem) }]
      : []
    return [...rules, ...campaignShelves]
  }, [campaigns, docs])

  const shelf = shelves.find((s) => s.key === params.get('estante')) ?? null
  const item = shelf?.items.find((i) => i.key === params.get('doc')) ?? null

  const go = useCallback((estante: string | null, doc: string | null = null) => {
    withTransition(() => {
      const next = new URLSearchParams()
      if (estante) next.set('estante', estante)
      if (doc) next.set('doc', doc)
      setParams(next)
    })
    window.scrollTo({ top: 0 })
  }, [setParams])

  let content: ReactNode
  if (loading) {
    content = <div className="tool-page__state"><div className="spinner spinner--sm" /> Tirando o pó das estantes…</div>
  } else if (error) {
    content = <p className="tool-page__error" role="alert">{error}</p>
  } else if (shelf && item) {
    content = (
      <DocumentViewer
        key={item.key}
        shelf={shelf}
        item={item}
        onBack={() => go(shelf.key)}
        onOpen={(i) => go(shelf.key, i.key)}
        onChanged={load}
      />
    )
  } else if (shelf) {
    content = <ShelfView shelf={shelf} onBack={() => go(null)} onOpen={(i) => go(shelf.key, i.key)} onChanged={load} />
  } else if (shelves.length === 0) {
    content = (
      <div className="tool-page__empty">
        <p className="tool-page__empty-icon">❧</p>
        <p className="tool-page__empty-title">A biblioteca ainda está vazia.</p>
        <p className="tool-page__empty-text">
          Cada campanha ganha uma estante aqui, com os livros e documentos da mesa.
          {' '}<Link to="/campanhas/nova">Criar uma campanha</Link>
        </p>
      </div>
    )
  } else {
    content = (
      <div className="library-wall">
        {shelves.map((s, i) => <ShelfCard key={s.key} shelf={s} index={i} onOpen={() => go(s.key)} />)}
      </div>
    )
  }

  return (
    <div className="tool-page library-page">
      {!shelf && (
        <div className="tool-page__header">
          <div className="tool-page__titles">
            <h1 className="tool-page__title">Biblioteca</h1>
            <p className="tool-page__sub">Os livros e documentos de cada campanha, pra ler aqui mesmo.</p>
          </div>
        </div>
      )}
      {content}
    </div>
  )
}

// ── Estante (card em forma de livro) ────────────────────

function ShelfCard({ shelf, index, onOpen }: { shelf: Shelf; index: number; onOpen: () => void }) {
  const cover = shelf.campaign?.cover_url ?? null
  const glyph = shelf.campaign ? getSystemEntry(shelf.campaign.system)?.icon ?? '❧' : '❧'
  const spines = Math.min(shelf.items.length, 7)
  const role = shelf.campaign ? (shelf.campaign.role === 'master' ? 'Mestre' : 'Jogador') : 'Para todos'

  return (
    <button
      type="button"
      className={`tome${shelf.campaign ? '' : ' tome--rules'}`}
      onClick={onOpen}
      style={{ '--i': index, '--float-delay': `${-(index * 1.7) % 7}s` } as CSSProperties}
      aria-label={`Abrir a estante de ${shelf.name}`}
    >
      <span className="tome__book" style={{ viewTransitionName: `estante-${shelf.key}` } as CSSProperties}>
        <span className="tome__pages" aria-hidden="true" />
        <span className="tome__cover">
          {cover && <img className="tome__art" src={cover} alt="" loading="lazy" />}
          <span className="tome__frame" aria-hidden="true" />
          <span className="tome__glyph" aria-hidden="true">{glyph}</span>
          <span className="tome__name">{shelf.name}</span>
        </span>
        <span className="tome__spine" aria-hidden="true" />
      </span>

      <span className="tome__info">
        <span className="tome__kicker">{shelf.kicker} · {role}</span>
        <span className="tome__count">{countLabel(shelf.items.length)}</span>
        <span className="tome__spines" aria-hidden="true">
          {Array.from({ length: spines }, (_, n) => <span key={n} className="tome__mini" style={{ '--n': n, '--h': `${14 + ((n * 7) % 9)}px` } as CSSProperties} />)}
        </span>
      </span>
    </button>
  )
}

// ── Estante aberta: um card por arquivo ─────────────────

interface ShelfViewProps {
  shelf:     Shelf
  onBack:    () => void
  onOpen:    (item: ShelfItem) => void
  onChanged: () => Promise<void>
}

function ShelfView({ shelf, onBack, onOpen, onChanged }: ShelfViewProps) {
  const isMaster = shelf.campaign?.role === 'master'
  const [thumbs, setThumbs]       = useState<Map<string, string>>(new Map())
  const [uploading, setUploading] = useState<string | null>(null)
  const [notice, setNotice]       = useState<string | null>(null)
  const [dragging, setDragging]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)

  const docList = useMemo(
    () => shelf.items.flatMap((i) => (i.type === 'doc' ? [i.doc] : [])),
    [shelf.items],
  )
  useEffect(() => {
    let alive = true
    getThumbUrls(docList).then((m) => { if (alive) setThumbs(m) }).catch(() => {})
    return () => { alive = false }
  }, [docList])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onBack() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice((cur) => (cur === message ? null : cur)), 4000)
  }

  async function handleFiles(files: File[]) {
    if (!shelf.campaign || files.length === 0) return
    const problem = files.map(validateDocument).find(Boolean)
    if (problem) { flash(problem); return }
    try {
      for (const [n, f] of files.entries()) {
        setUploading(files.length === 1 ? 'Guardando…' : `Guardando ${n + 1} de ${files.length}…`)
        await uploadDocument(shelf.campaign.id, f)
      }
      await onChanged()
      flash(files.length === 1 ? 'Arquivo guardado na estante.' : `${files.length} arquivos guardados na estante.`)
    } catch (err) {
      await onChanged().catch(() => {})
      flash(err instanceof Error ? err.message : 'Não foi possível guardar o arquivo.')
    } finally {
      setUploading(null)
    }
  }

  const dropProps = isMaster ? {
    onDragEnter: (e: DragEvent) => { if (e.dataTransfer.types.includes('Files')) { dragDepth.current++; setDragging(true) } },
    onDragLeave: () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragging(false) },
    onDragOver:  (e: DragEvent) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() },
    onDrop:      (e: DragEvent) => {
      e.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      void handleFiles(Array.from(e.dataTransfer.files))
    },
  } : {}

  const cover = shelf.campaign?.cover_url ?? null

  return (
    <section className={`shelf${dragging ? ' shelf--dragging' : ''}`} {...dropProps}>
      <button type="button" className="library-back" onClick={onBack}>
        <span aria-hidden="true">←</span> Biblioteca
      </button>

      <header className="shelf__header">
        <span className="shelf__book" style={{ viewTransitionName: `estante-${shelf.key}` } as CSSProperties} aria-hidden="true">
          {cover ? <img src={cover} alt="" /> : <span className="shelf__glyph">{shelf.campaign ? getSystemEntry(shelf.campaign.system)?.icon ?? '❧' : '❧'}</span>}
        </span>
        <div className="shelf__titles">
          <p className="shelf__kicker">{shelf.kicker}</p>
          <h1 className="shelf__title">{shelf.name}</h1>
          <p className="shelf__count">{countLabel(shelf.items.length)}</p>
        </div>
        {isMaster && (
          <div className="shelf__actions">
            <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={!!uploading}>
              {uploading ?? '+ Adicionar arquivos'}
            </button>
            <input
              ref={fileRef} type="file" hidden multiple accept={DOCUMENT_ACCEPT}
              onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void handleFiles(files) }}
            />
          </div>
        )}
      </header>

      {notice && <p className="tool-page__notice" role="status">{notice}</p>}

      {shelf.items.length === 0 ? (
        <div className="tool-page__empty">
          <p className="tool-page__empty-icon">❧</p>
          <p className="tool-page__empty-title">Estante vazia.</p>
          <p className="tool-page__empty-text">
            {isMaster
              ? 'Arraste pra cá PDFs, imagens ou textos (até 25 MB) — ou use "Adicionar arquivos". Os jogadores da campanha também vão poder ler.'
              : 'Quando o mestre guardar livros e documentos da campanha, eles aparecem aqui.'}
          </p>
        </div>
      ) : (
        <div className="doc-grid">
          {shelf.items.map((it, i) => (
            <DocCard key={it.key} item={it} index={i} thumb={it.type === 'doc' ? thumbs.get(it.doc.path) ?? null : null} onOpen={() => onOpen(it)} />
          ))}
        </div>
      )}

      {isMaster && shelf.items.length > 0 && (
        <p className="tool-hint">Dica: arraste arquivos pra esta página pra guardar na estante. PDF, imagem ou texto, até 25 MB.</p>
      )}

      {dragging && (
        <div className="shelf__drop" aria-hidden="true">
          <span>Solte pra guardar na estante</span>
        </div>
      )}
    </section>
  )
}

// ── Card de um arquivo ──────────────────────────────────

function DocCard({ item, index, thumb, onOpen }: { item: ShelfItem; index: number; thumb: string | null; onOpen: () => void }) {
  const sheetStyle = { viewTransitionName: transitionName(item) } as CSSProperties

  if (item.type === 'rulebook') {
    return (
      <button type="button" className="doc-card doc-card--rulebook" onClick={onOpen} style={{ '--i': index } as CSSProperties}>
        <span className="doc-card__stack">
          <span className="doc-card__under" aria-hidden="true" />
          <span className="doc-card__sheet" style={sheetStyle}>
            <span className="doc-card__tome-glyph" aria-hidden="true">{getSystemEntry(item.system)?.icon ?? '❧'}</span>
            <span className="doc-card__tome-title">{getSystemLabel(item.system)}</span>
          </span>
        </span>
        <span className="doc-card__info">
          <span className="doc-card__name">{item.title}</span>
          <span className="doc-card__meta">Livro de regras · {item.subtitle}</span>
        </span>
      </button>
    )
  }

  const { doc } = item
  const kind = documentKind(doc)
  return (
    <button type="button" className={`doc-card doc-card--${kind}`} onClick={onOpen} style={{ '--i': index } as CSSProperties}>
      <span className="doc-card__stack">
      <span className="doc-card__under" aria-hidden="true" />
      <span className="doc-card__sheet" style={sheetStyle}>
        {kind === 'image' ? (
          thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="doc-card__letter">▣</span>
        ) : (
          <>
            <span className="doc-card__letter" aria-hidden="true">{doc.name.charAt(0).toUpperCase()}</span>
            <span className="doc-card__lines" aria-hidden="true" />
            {kind === 'pdf' && <span className="doc-card__ribbon" aria-hidden="true">PDF</span>}
          </>
        )}
        {doc.visibility === 'master' && <span className="doc-card__secret" title="Só o mestre vê">só o mestre</span>}
      </span>
      </span>
      <span className="doc-card__info">
        <span className="doc-card__name">{doc.name}</span>
        <span className="doc-card__meta">{KIND_LABEL[kind]}{isBoardDocument(doc) ? ' do Quadro' : ''} · {formatSize(doc.size_bytes)} · {dateLabel(doc.created_at)}</span>
      </span>
    </button>
  )
}

// ── Leitor ──────────────────────────────────────────────

interface DocumentViewerProps {
  shelf:     Shelf
  item:      ShelfItem
  onBack:    () => void
  onOpen:    (item: ShelfItem) => void
  onChanged: () => Promise<void>
}

function DocumentViewer({ shelf, item, onBack, onOpen, onChanged }: DocumentViewerProps) {
  const index = shelf.items.findIndex((i) => i.key === item.key)
  const prev = index > 0 ? shelf.items[index - 1] : null
  const next = index < shelf.items.length - 1 ? shelf.items[index + 1] : null

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  const title = item.type === 'rulebook' ? item.title : item.doc.name

  return (
    <section className="doc-viewer">
      <nav className="doc-viewer__crumbs" aria-label="Caminho">
        <button type="button" className="library-back" onClick={onBack}>
          <span aria-hidden="true">←</span> {shelf.name}
        </button>
        <span className="doc-viewer__pos">{index + 1} de {shelf.items.length}</span>
      </nav>

      {item.type === 'rulebook' ? (
        <div className="doc-viewer__frame" style={{ viewTransitionName: transitionName(item) } as CSSProperties}>
          <RulebookPanel system={item.system} />
        </div>
      ) : (
        <DocumentBody doc={item.doc} isMaster={shelf.campaign?.role === 'master'} onChanged={onChanged} onDeleted={onBack} />
      )}

      {(prev || next) && (
        <nav className="doc-viewer__pager" aria-label={`Outros arquivos de ${shelf.name}`}>
          {prev ? (
            <button type="button" className="doc-viewer__page doc-viewer__page--prev" onClick={() => onOpen(prev)}>
              <span className="doc-viewer__page-dir">‹ anterior</span>
              <span className="doc-viewer__page-name">{prev.type === 'rulebook' ? prev.title : prev.doc.name}</span>
            </button>
          ) : <span />}
          {next && (
            <button type="button" className="doc-viewer__page doc-viewer__page--next" onClick={() => onOpen(next)}>
              <span className="doc-viewer__page-dir">próximo ›</span>
              <span className="doc-viewer__page-name">{next.type === 'rulebook' ? next.title : next.doc.name}</span>
            </button>
          )}
        </nav>
      )}
      <span className="sr-only" aria-live="polite">{title}</span>
    </section>
  )
}

interface DocumentBodyProps {
  doc:       CampaignDocument
  isMaster:  boolean
  onChanged: () => Promise<void>
  onDeleted: () => void
}

function DocumentBody({ doc, isMaster, onChanged, onDeleted }: DocumentBodyProps) {
  const kind = documentKind(doc)
  const canEmbed = useCanEmbedPdf()
  const [url, setUrl]           = useState<string | null>(null)
  const [text, setText]         = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [name, setName]         = useState(doc.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy]         = useState(false)

  useEffect(() => {
    let alive = true
    getDocumentUrl(doc)
      .then(async (u) => {
        if (!alive) return
        setUrl(u)
        if (kind === 'text') {
          const res = await fetch(u)
          if (!res.ok) throw new Error('Não foi possível ler o texto.')
          const body = await res.text()
          if (alive) setText(body)
        }
      })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'Não foi possível abrir o documento.') })
    return () => { alive = false }
  }, [doc, kind])

  async function download() {
    try {
      window.location.href = await getDocumentUrl(doc, true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível baixar.')
    }
  }

  async function saveName() {
    const clean = name.trim().slice(0, 120)
    if (!clean || clean === doc.name) { setName(doc.name); setRenaming(false); return }
    setBusy(true)
    try {
      await updateDocument(doc, { name: clean })
      await onChanged()
      setRenaming(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível renomear.')
    } finally {
      setBusy(false)
    }
  }

  // A Biblioteca é de todos da campanha: não dá mais pra esconder. Documento
  // escondido antes disso continua escondido até o mestre mostrar.
  async function showToPlayers() {
    setBusy(true)
    try {
      await updateDocument(doc, { visibility: 'all' })
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await deleteDocument(doc)
      onDeleted()
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir.')
      setBusy(false)
    }
  }

  let body: ReactNode
  if (error) {
    body = <p className="tool-page__error" role="alert">{error}</p>
  } else if (!url || (kind === 'text' && text == null)) {
    body = <div className="tool-page__state"><div className="spinner spinner--sm" /> Abrindo…</div>
  } else if (kind === 'image') {
    body = <div className="doc-viewer__image"><img src={url} alt={doc.name} /></div>
  } else if (kind === 'text') {
    body = <article className="doc-viewer__paper">{doc.mime_type === 'text/markdown' ? <Markdown source={text!} /> : <p className="doc-viewer__plain">{text}</p>}</article>
  } else if (canEmbed) {
    body = <iframe className="doc-viewer__pdf" src={`${url}#navpanes=0&view=FitH`} title={doc.name} />
  } else {
    body = (
      <div className="rulebook__mobile">
        <p>No celular, o PDF abre no leitor do aparelho.</p>
        <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer">Abrir o PDF</a>
      </div>
    )
  }

  return (
    <div className="doc-viewer__frame" style={{ viewTransitionName: `doc-${doc.id}` } as CSSProperties}>
      <header className="doc-viewer__bar">
        <div className="doc-viewer__titles">
          {renaming ? (
            <form className="doc-viewer__rename" onSubmit={(e) => { e.preventDefault(); void saveName() }}>
              <input
                className="input" value={name} maxLength={120} autoFocus disabled={busy}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setName(doc.name); setRenaming(false) } }}
                aria-label="Nome do arquivo"
              />
              <button type="submit" className="btn btn-primary doc-viewer__btn" disabled={busy}>Salvar</button>
            </form>
          ) : (
            <h2 className="doc-viewer__title">{doc.name}</h2>
          )}
          <span className="doc-viewer__meta">
            {KIND_LABEL[kind]}{isBoardDocument(doc) ? ' do Quadro' : ''} · {formatSize(doc.size_bytes)} · guardado em {dateLabel(doc.created_at)}
            {doc.visibility === 'master' && <span className="doc-viewer__secret"> · só o mestre vê</span>}
          </span>
        </div>
        <div className="doc-viewer__actions">
          {isBoardDocument(doc) && <Link className="btn btn-ghost doc-viewer__btn" to={`/campanhas/${doc.campaign_id}/quadro`}>Ir pro Quadro</Link>}
          {url && <a className="btn btn-ghost doc-viewer__btn" href={url} target="_blank" rel="noopener noreferrer">Abrir em nova aba</a>}
          <button type="button" className="btn btn-ghost doc-viewer__btn" onClick={() => void download()}>Baixar</button>
          {isMaster && !renaming && (
            <button type="button" className="btn btn-ghost doc-viewer__btn" onClick={() => setRenaming(true)}>Renomear</button>
          )}
          {isMaster && doc.visibility === 'master' && (
            <button type="button" className="btn btn-ghost doc-viewer__btn" onClick={() => void showToPlayers()} disabled={busy}>
              Mostrar aos jogadores
            </button>
          )}
          {isMaster && (confirmDelete ? (
            <span className="doc-viewer__confirm">
              <span>Excluir {fileNameOf(doc)}?</span>
              <button type="button" className="btn btn-danger doc-viewer__btn" onClick={() => void remove()} disabled={busy}>
                {busy ? 'Excluindo…' : 'Excluir'}
              </button>
              <button type="button" className="btn btn-ghost doc-viewer__btn" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancelar</button>
            </span>
          ) : (
            <button type="button" className="btn btn-ghost doc-viewer__btn doc-viewer__btn--danger" onClick={() => setConfirmDelete(true)}>Excluir</button>
          ))}
        </div>
      </header>
      {body}
    </div>
  )
}

// ── Markdown simples (títulos, listas, negrito, itálico) ─

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0]
    out.push(t.startsWith('**') ? <strong key={m.index}>{t.slice(2, -2)}</strong> : <em key={m.index}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = []
  let para: string[] = []
  let list: string[] = []
  const flush = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>)
    if (list.length) blocks.push(<ul key={blocks.length}>{list.map((li, n) => <li key={n}>{inline(li)}</li>)}</ul>)
    para = []
    list = []
  }
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trimEnd()
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      const Tag = (['h3', 'h4', 'h5'] as const)[heading[1].length - 1]
      blocks.push(<Tag key={blocks.length}>{inline(heading[2])}</Tag>)
    } else if (bullet) {
      if (para.length) { const p = para; para = []; blocks.push(<p key={blocks.length}>{inline(p.join(' '))}</p>) }
      list.push(bullet[1])
    } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flush()
      blocks.push(<hr key={blocks.length} />)
    } else if (!line.trim()) {
      flush()
    } else {
      if (list.length) { const l = list; list = []; blocks.push(<ul key={blocks.length}>{l.map((li, n) => <li key={n}>{inline(li)}</li>)}</ul>) }
      para.push(line.trim())
    }
  }
  flush()
  return <div className="doc-viewer__md">{blocks}</div>
}
