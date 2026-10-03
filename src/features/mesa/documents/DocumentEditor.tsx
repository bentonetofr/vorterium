import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { ModalOverlay } from '../../../shared/components/ModalOverlay'
import { loadBoardFont } from '../../../shared/lib/googleFonts'
import { CARET_MARK, loadDocFonts, stripCaret } from './docHtml'
import { MAX_PAGES, saveDocument, type DocPage, type MesaDocument } from './documentsService'
import { DocToolbar } from './DocToolbar'
import { BookCover, PaperPage } from './DocViews'
import { FontPicker } from './FontPicker'
import { PageEditor, type ChangeKind, type PageEditorHandle } from './PageEditor'
import { overflows, reflow, reflowAll } from './pageFlow'
import {
  COVERS, INKS, MAX_AUTHOR, PAPERS, pageSeed, pageStyle, type DocStyle,
} from './paperStyles'

// ────────────────────────────────────────────────────────
// Editor de documento (só o mestre): título, folha ou livro, as páginas, e
// o estilo — textura do papel, efeitos (queimado, rasgado, dobras,
// manchas), letra à mão, tamanho e cor da tinta padrão. No livro, o estilo
// vale pro livro todo ou só pra página aberta (cada página pode ter o seu).
// O texto se escreve direto na folha, com formatação de Word (DocToolbar):
// letra, tamanho, negrito…, tinta, alinhamento, listas, recuo, espaçamento
// e Tab. O livro começa pela capa; o texto que não cabe numa página desce
// sozinho pra seguinte (e sobe de volta quando sobra espaço). Ctrl+Z/Ctrl+Y
// desfazem e refazem tudo (texto, formatação, estilo).
// ────────────────────────────────────────────────────────

const clone = (d: MesaDocument): MesaDocument => ({ ...d, style: { ...d.style }, pages: d.pages.map((p) => ({ ...p, style: p.style ? { ...p.style } : undefined })) })
const samePages = (a: DocPage[], b: DocPage[]) => a.length === b.length && a.every((p, i) => p.html === b[i].html && !!p.cont === !!b[i].cont && (p.join ?? 0) === (b[i].join ?? 0))

/** Índice da "página" da capa no editor do livro. */
const COVER = -1
/** Digitação seguida (sem pausa maior que isso, e por até TYPING_GROUP_MS) vira um passo só do desfazer. */
const TYPING_PAUSE_MS = 900
const TYPING_GROUP_MS = 4000
const MAX_HISTORY = 300

/** Um passo do desfazer: o documento, a página aberta e o HTML dela com a marca do cursor. */
interface Snap { draft: MesaDocument; pageIdx: number; marked: string | null }

export function DocumentEditor({ doc, onClose, onSaved }: { doc: MesaDocument; onClose: () => void; onSaved: (doc: MesaDocument) => void }) {
  const [draft, setDraft] = useState<MesaDocument>(() => clone(doc))
  const [pageIdx, setPageIdx] = useState(doc.kind === 'book' ? COVER : 0)
  const [scope, setScope] = useState<'doc' | 'page'>('doc')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  /** O livro chegou ao limite de páginas e o texto que sobrou não aparece. */
  const [full, setFull] = useState(false)
  /** Reescrever a folha editável (v muda) — com a marca do cursor, se `marked`. */
  const [ed, setEd] = useState<{ v: number; marked: string | null }>({ v: 0, marked: null })
  const editor = useRef<PageEditorHandle>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const pageIdxRef = useRef(pageIdx)
  pageIdxRef.current = pageIdx
  /** Página aberta com o cursor, depois da última mudança (= antes da próxima, pro desfazer). */
  const lastMarked = useRef<string | null>(null)
  const undoStack = useRef<Snap[]>([])
  const redoStack = useRef<Snap[]>([])
  const lastTyping = useRef(0)
  const typingSince = useRef(0)
  const [, setHistoryTick] = useState(0)

  const isBook = draft.kind === 'book'
  const onCover = isBook && pageIdx === COVER
  const at = Math.max(0, Math.min(pageIdx, draft.pages.length - 1))
  const page = draft.pages[at]
  const ownStyle = isBook && !!page?.style
  const editingPage = isBook && scope === 'page' && !onCover
  const style = pageStyle(draft.style, page?.style)

  /** Guarda o estado de agora no desfazer (digitação seguida vira um passo só). */
  function remember(kind: ChangeKind | 'other') {
    const now = Date.now()
    if (kind === 'type' && now - lastTyping.current < TYPING_PAUSE_MS && now - typingSince.current < TYPING_GROUP_MS) { lastTyping.current = now; return }
    lastTyping.current = kind === 'type' ? now : 0
    typingSince.current = now
    undoStack.current.push({ draft: draftRef.current, pageIdx: pageIdxRef.current, marked: lastMarked.current })
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift()
    redoStack.current = []
    setHistoryTick((n) => n + 1)
  }

  const change = (fn: (d: MesaDocument) => void, kind: ChangeKind | 'other' = 'other') => {
    remember(kind)
    setDraft((prev) => { const next = clone(prev); fn(next); return next })
    setDirty(true)
  }
  const setStyle = (patch: Partial<DocStyle>) => change((d) => {
    if (editingPage) {
      const p = d.pages[at]
      p.style = { ...(p.style ?? {}), ...patch }
    } else {
      d.style = { ...d.style, ...patch }
    }
  })

  /** Abre uma página (ou a capa); com `marked` (HTML com a marca), já com o cursor nela. */
  function openPage(i: number, marked: string | null = null) {
    setPageIdx(i)
    setEd((e) => ({ v: e.v + 1, marked }))
  }

  function travel(from: MutableRefObject<Snap[]>, to: MutableRefObject<Snap[]>) {
    const snap = from.current.pop()
    if (!snap) return
    to.current.push({ draft: draftRef.current, pageIdx: pageIdxRef.current, marked: editor.current?.marked() ?? lastMarked.current })
    lastTyping.current = 0
    lastMarked.current = snap.marked
    setDraft(snap.draft)
    setDirty(true)
    setFull(false)
    // A marca só vale se ainda é a mesma página (senão abre sem mexer no cursor).
    const same = snap.marked != null && stripCaret(snap.marked) === snap.draft.pages[snap.pageIdx]?.html
    openPage(snap.pageIdx, snap.pageIdx !== COVER && same ? snap.marked : null)
    setHistoryTick((n) => n + 1)
  }
  const undo = () => travel(undoStack, redoStack)
  const redo = () => travel(redoStack, undoStack)

  function setKind(kind: 'paper' | 'book') {
    change((d) => {
      d.kind = kind
      if (kind === 'book' && d.pages.length < 2) d.pages.push({ html: '' })
    })
    if (kind === 'paper') { openPage(0); setScope('doc') }
    else openPage(COVER)
  }

  /** Página nova (em branco) depois do texto corrido da página aberta. */
  function addPage() {
    if (draft.pages.length >= MAX_PAGES) return
    let end = at
    while (end + 1 < draft.pages.length && draft.pages[end + 1].cont) end++
    change((d) => { d.pages.splice(end + 1, 0, { html: '' }) })
    openPage(end + 1, CARET_MARK)
  }
  function removePage() {
    if (draft.pages.length <= 1) return
    change((d) => {
      const [gone] = d.pages.splice(at, 1)
      // A seguinte continuava esta: passa a continuar o que vinha antes (ou vira começo).
      const next = d.pages[at]
      if (next?.cont && !gone.cont) { delete next.cont; delete next.join }
      if (next?.cont) delete next.join
      if (d.pages[0]?.cont) { delete d.pages[0].cont; delete d.pages[0].join }
    })
    openPage(Math.max(0, at - 1))
  }

  /**
   * Escreveu/formatou na página (`marked`: o HTML com a marca do cursor). No
   * livro, o que não couber desce pra seguinte — e o cursor vai junto, se for
   * o caso, pra onde a marca cair.
   */
  function onPageChange(marked: string, kind: ChangeKind) {
    if (!isBook) {
      change((d) => { d.pages[at].html = stripCaret(marked) }, kind)
      lastMarked.current = marked
      return
    }
    const flowed = reflow(draft.pages.map((p, i) => (i === at ? { ...p, html: marked } : p)), at, draft.style)
    const k = flowed.pages.findIndex((p) => p.html.includes(CARET_MARK))
    const markedPage = k >= 0 ? flowed.pages[k].html : null
    const pages = flowed.pages.map((p) => (p.html.includes(CARET_MARK) ? { ...p, html: stripCaret(p.html) } : p))
    change((d) => { d.pages = pages }, kind)
    setFull(flowed.full)
    lastMarked.current = markedPage
    const target = k >= 0 ? k : at
    if (target !== at) openPage(target, markedPage)
    else if (markedPage !== marked) setEd((e) => ({ v: e.v + 1, marked: markedPage }))
  }

  // Mudou a letra, o tamanho ou o tipo: espera as fontes e redistribui o livro.
  const layoutKey = isBook ? [draft.style.font, draft.style.size, ...draft.pages.filter((p) => p.style?.font || p.style?.size).map((p) => `${p.style?.font ?? ''}/${p.style?.size ?? ''}`)].join('|') : ''
  useEffect(() => {
    if (!isBook) return
    let alive = true
    const fonts = new Set([draft.style.font, ...draft.pages.map((p) => p.style?.font).filter((f): f is string => !!f)])
    void Promise.all([...[...fonts].map((f) => loadBoardFont(f)), ...draft.pages.map((p) => loadDocFonts(p.html))]).then(() => {
      if (!alive) return
      const prev = draftRef.current
      const { pages, full: over } = reflowAll(prev.pages, prev.style)
      setFull(over)
      if (samePages(pages, prev.pages)) return
      setDraft({ ...prev, pages })
      setDirty(true)
      const i = pageIdxRef.current
      if (i !== COVER && pages[i]?.html !== prev.pages[i]?.html) setEd((e) => ({ v: e.v + 1, marked: null }))
    })
    return () => { alive = false }
  }, [layoutKey])  // eslint-disable-line react-hooks/exhaustive-deps

  // Folha avulsa: avisa quando o texto passa do papel.
  const sheetOverflow = useMemo(() => !isBook && !!page && overflows(page.html, style, false), [isBook, page?.html, style.font, style.size])  // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const saved = await saveDocument(draft)
      setDirty(false)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  /** O × do canto: com alterações não salvas, pergunta antes de jogar fora. */
  function closeX() {
    if (dirty && !window.confirm('Fechar sem salvar? As alterações deste documento vão se perder.')) return
    onClose()
  }

  // Atalhos: Ctrl+S salva; Ctrl+Z/Ctrl+Y desfazem/refazem (com o foco fora da folha).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.defaultPrevented) return
      const k = e.key.toLowerCase()
      if (k === 's') { e.preventDefault(); if (dirty) void save(); return }
      // Desfazer/refazer com o foco fora da folha (a folha cuida dos dela); campos de texto têm o seu.
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, [contenteditable="true"]')) return
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const coverChoices = (
    <div className="doc-editor__row">
      {COVERS.map((c) => (
        <button key={c.id} type="button" className={`doc-editor__chip${draft.style.cover === c.id ? ' is-on' : ''}`} onClick={() => change((d) => { d.style = { ...d.style, cover: c.id } })}>
          {c.label}
        </button>
      ))}
    </div>
  )

  return (
    <ModalOverlay onClose={onClose} closeDisabled={saving || dirty}>
      <div className="doc-editor" role="dialog" aria-modal="true" aria-label="Editar documento">
        {/* ── Estilo ── */}
        <div className="doc-editor__side">
          <div className="doc-editor__head">
            <input
              className="input doc-editor__title-input"
              value={draft.title}
              maxLength={120}
              onChange={(e) => change((d) => { d.title = e.target.value }, 'type')}
              aria-label="Título do documento"
              placeholder="Título"
            />
          </div>
          <div>
            <p className="doc-editor__label">Tipo</p>
            <div className="doc-editor__row">
              <button type="button" className={`doc-editor__chip${!isBook ? ' is-on' : ''}`} onClick={() => setKind('paper')}>Folha avulsa</button>
              <button type="button" className={`doc-editor__chip${isBook ? ' is-on' : ''}`} onClick={() => setKind('book')}>Livro</button>
            </div>
            {!isBook && draft.pages.length > 1 && <p className="doc-editor__hint">Como folha, só a primeira página aparece.</p>}
          </div>

          {onCover ? (
            <div>
              <p className="doc-editor__label">Capa</p>
              {coverChoices}
              <p className="doc-editor__label" style={{ marginTop: 12 }}>Autor</p>
              <input
                className="input"
                value={draft.style.author}
                maxLength={MAX_AUTHOR}
                onChange={(e) => change((d) => { d.style = { ...d.style, author: e.target.value } })}
                placeholder="Ex.: Irmão Aldric de Varneth (opcional)"
                aria-label="Autor do livro"
                style={{ width: '100%' }}
              />
              <p className="doc-editor__hint" style={{ marginTop: 6 }}>O título acima e o autor vão gravados na capa. Depois é só seguir pras páginas.</p>
            </div>
          ) : (
            <>
              {isBook && (
                <div>
                  <p className="doc-editor__label">Estilo de</p>
                  <div className="doc-editor__row">
                    <button type="button" className={`doc-editor__chip${scope === 'doc' ? ' is-on' : ''}`} onClick={() => setScope('doc')}>Livro todo</button>
                    <button type="button" className={`doc-editor__chip${scope === 'page' ? ' is-on' : ''}`} onClick={() => setScope('page')}>Só a página {at + 1}</button>
                  </div>
                  {ownStyle && (
                    <p className="doc-editor__hint">
                      A página {at + 1} tem estilo próprio.{' '}
                      <button type="button" className="doc-editor__chip" onClick={() => change((d) => { d.pages[at].style = undefined })}>Usar o do livro</button>
                    </p>
                  )}
                </div>
              )}

              <div>
                <p className="doc-editor__label">Letra padrão · tamanho {style.size}</p>
                <FontPicker current={style.font} onPick={(font) => setStyle({ font })} />
                <input
                  type="range" min={16} max={48} value={style.size}
                  onChange={(e) => setStyle({ size: Number(e.target.value) })}
                  aria-label="Tamanho da letra"
                  style={{ width: '100%', marginTop: 8 }}
                />
              </div>

              <div>
                <p className="doc-editor__label">Papel</p>
                <div className="doc-editor__textures">
                  {PAPERS.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`doc-editor__texture${style.texture === p.id ? ' is-on' : ''}`}
                      onClick={() => setStyle({ texture: p.id })}
                      title={p.label}
                      aria-label={p.label}
                    >
                      <PaperPage html="" style={{ ...style, texture: p.id, burn: 0, torn: false }} seed={i * 97 + 11} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="doc-editor__label">Efeitos</p>
                <div className="doc-editor__row">
                  <span className="doc-editor__hint">Queimado:</span>
                  {(['Nada', 'Leve', 'Forte'] as const).map((l, n) => (
                    <button key={l} type="button" className={`doc-editor__chip${style.burn === n ? ' is-on' : ''}`} onClick={() => setStyle({ burn: n })}>{l}</button>
                  ))}
                </div>
                <div className="doc-editor__row" style={{ marginTop: 6 }}>
                  <span className="doc-editor__hint">Manchas:</span>
                  {(['Nenhuma', 'Poucas', 'Muitas'] as const).map((l, n) => (
                    <button key={l} type="button" className={`doc-editor__chip${style.stains === n ? ' is-on' : ''}`} onClick={() => setStyle({ stains: n })}>{l}</button>
                  ))}
                </div>
                <div className="doc-editor__row" style={{ marginTop: 6 }}>
                  <button type="button" className={`doc-editor__chip${style.torn ? ' is-on' : ''}`} onClick={() => setStyle({ torn: !style.torn })}>Rasgado</button>
                  <button type="button" className={`doc-editor__chip${style.folds ? ' is-on' : ''}`} onClick={() => setStyle({ folds: !style.folds })}>Dobrado</button>
                </div>
              </div>

              <div>
                <p className="doc-editor__label">Tinta padrão</p>
                <div className="doc-editor__inks">
                  {INKS.map((ink) => (
                    <button
                      key={ink.id}
                      type="button"
                      className={`doc-editor__ink${style.ink === ink.id ? ' is-on' : ''}`}
                      style={{ background: ink.color }}
                      onClick={() => setStyle({ ink: ink.id })}
                      title={ink.label}
                      aria-label={`Tinta ${ink.label}`}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Texto e prévia ── */}
        <div className="doc-editor__main">
          <div className="doc-editor__top">
            {isBook && (
              <div className="doc-editor__pages" role="tablist" aria-label="Capa e páginas">
                <button type="button" role="tab" aria-selected={onCover} className={`doc-editor__chip${onCover ? ' is-on' : ''}`} onClick={() => openPage(COVER)}>Capa</button>
                {draft.pages.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={!onCover && at === i}
                    className={`doc-editor__chip${!onCover && at === i ? ' is-on' : ''}${p.cont ? ' doc-editor__chip--cont' : ''}`}
                    onClick={() => openPage(i)}
                    title={[p.cont ? 'Continua a página anterior' : '', p.style ? 'Página com estilo próprio' : ''].filter(Boolean).join(' · ') || undefined}
                  >
                    {i + 1}{p.style ? '*' : ''}
                  </button>
                ))}
                <button type="button" className="doc-editor__chip" onClick={addPage} disabled={draft.pages.length >= MAX_PAGES}>+ Página</button>
                {!onCover && draft.pages.length > 1 && <button type="button" className="doc-editor__chip" onClick={removePage}>Tirar a página {at + 1}</button>}
              </div>
            )}
            <button type="button" className="doc-editor__close" onClick={closeX} disabled={saving} aria-label="Fechar" title="Fechar">×</button>
          </div>
          {onCover ? (
            <div className="doc-editor__cover-work">
              <div className="doc-editor__cover-big"><BookCover title={draft.title} style={draft.style} /></div>
              <button type="button" className="btn btn-primary" onClick={() => openPage(0, (draft.pages[0]?.html ?? '') + CARET_MARK)}>Escrever as páginas ›</button>
            </div>
          ) : (
            <>
              <DocToolbar
                editor={editor}
                base={style}
                canUndo={undoStack.current.length > 0}
                canRedo={redoStack.current.length > 0}
                onUndo={undo}
                onRedo={redo}
              />
              <div className="doc-editor__work">
                <div className="doc-editor__sheet">
                  <PageEditor
                    key={at}
                    ref={editor}
                    html={page?.html ?? ''}
                    version={ed.v}
                    marked={ed.marked}
                    style={style}
                    seed={pageSeed(draft.id, at)}
                    book={isBook}
                    placeholder={isBook ? (at === 0 ? 'Escreva a primeira página… O que não couber vai sozinho pra próxima.' : `Escreva a página ${at + 1}…`) : 'Escreva a carta, o bilhete, o édito…'}
                    onChange={onPageChange}
                    onUndo={undo}
                    onRedo={redo}
                  />
                </div>
                {sheetOverflow && <p className="doc-editor__hint doc-editor__warn">O texto passou do tamanho da folha. Diminua a letra ou troque pra Livro (aí o resto vai pra próxima página).</p>}
              </div>
            </>
          )}
          <div className="doc-editor__foot">
            <span className="doc-editor__status" role="status">
              {error ?? (full ? `O livro chegou ao limite de ${MAX_PAGES} páginas: o texto que passou da última não aparece.` : saving ? 'Salvando…' : dirty ? 'Alterações não salvas (Ctrl+S salva)' : 'Tudo salvo')}
            </span>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>{dirty ? 'Descartar' : 'Fechar'}</button>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving || !dirty}>Salvar</button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}
