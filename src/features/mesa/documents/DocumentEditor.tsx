import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ModalOverlay } from '../../../shared/components/ModalOverlay'
import { loadBoardFont } from '../../../shared/lib/googleFonts'
import { MAX_PAGE_CHARS, MAX_PAGES, saveDocument, type DocPage, type MesaDocument } from './documentsService'
import { BookCover, PaperPage } from './DocViews'
import { FontPicker } from './FontPicker'
import { overflows, reflow, reflowAll } from './pageFlow'
import {
  COVERS, INKS, MAX_AUTHOR, PAPERS, handStack, pageSeed, pageStyle, type DocStyle,
} from './paperStyles'

// ────────────────────────────────────────────────────────
// Editor de documento (só o mestre): título, folha ou livro, as páginas, e
// o estilo — textura do papel, efeitos (queimado, rasgado, dobras,
// manchas), letra à mão, tamanho e cor da tinta. No livro, o estilo vale
// pro livro todo ou só pra página aberta (cada página pode ter o seu).
// O livro começa pela capa; o texto que não cabe numa página desce
// sozinho pra seguinte (e sobe de volta quando sobra espaço).
// ────────────────────────────────────────────────────────

const clone = (d: MesaDocument): MesaDocument => ({ ...d, style: { ...d.style }, pages: d.pages.map((p) => ({ ...p, style: p.style ? { ...p.style } : undefined })) })
const samePages = (a: DocPage[], b: DocPage[]) => a.length === b.length && a.every((p, i) => p.text === b[i].text && !!p.cont === !!b[i].cont)

/** Índice da "página" da capa no editor do livro. */
const COVER = -1

export function DocumentEditor({ doc, onClose, onSaved }: { doc: MesaDocument; onClose: () => void; onSaved: (doc: MesaDocument) => void }) {
  const [draft, setDraft] = useState<MesaDocument>(() => clone(doc))
  const [pageIdx, setPageIdx] = useState(doc.kind === 'book' ? COVER : 0)
  const [scope, setScope] = useState<'doc' | 'page'>('doc')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  /** O livro chegou ao limite de páginas e o texto que sobrou não aparece. */
  const [full, setFull] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  /** Onde pôr o cursor depois que o texto correu pra outra página. */
  const caretTo = useRef<number | null>(null)
  const isBook = draft.kind === 'book'
  const onCover = isBook && pageIdx === COVER
  const at = Math.max(0, Math.min(pageIdx, draft.pages.length - 1))
  const page = draft.pages[at]
  const ownStyle = isBook && !!page?.style
  const editingPage = isBook && scope === 'page' && !onCover
  const style = pageStyle(draft.style, page?.style)

  const change = (fn: (d: MesaDocument) => void) => {
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

  function setKind(kind: 'paper' | 'book') {
    change((d) => {
      d.kind = kind
      if (kind === 'book' && d.pages.length < 2) d.pages.push({ text: '' })
    })
    if (kind === 'paper') { setPageIdx(0); setScope('doc') }
    else setPageIdx(COVER)
  }

  /** Página nova (em branco) depois do texto corrido da página aberta. */
  function addPage() {
    if (draft.pages.length >= MAX_PAGES) return
    let end = at
    while (end + 1 < draft.pages.length && draft.pages[end + 1].cont) end++
    change((d) => { d.pages.splice(end + 1, 0, { text: '' }) })
    setPageIdx(end + 1)
  }
  function removePage() {
    if (draft.pages.length <= 1) return
    change((d) => {
      const [gone] = d.pages.splice(at, 1)
      // A seguinte continuava esta: passa a continuar o que vinha antes (ou vira começo).
      const next = d.pages[at]
      if (next?.cont && !gone.cont) delete next.cont
      if (d.pages[0]?.cont) delete d.pages[0].cont
    })
    setPageIdx(Math.max(0, at - 1))
  }

  /** Escreveu na página: no livro, o que não couber desce pra seguinte. */
  function setText(value: string, caret: number) {
    if (!isBook) { change((d) => { d.pages[at].text = value }); return }
    const pages = draft.pages.map((p, i) => (i === at ? { ...p, text: value } : p))
    const flowed = reflow(pages, at, draft.style, caret)
    change((d) => { d.pages = flowed.pages })
    setFull(flowed.full)
    if (flowed.page !== at) setPageIdx(flowed.page)
    caretTo.current = flowed.page !== at || flowed.pages[at]?.text !== value ? flowed.caret : null
  }
  useLayoutEffect(() => {
    const el = textRef.current
    if (caretTo.current == null || !el) return
    el.focus()
    el.setSelectionRange(caretTo.current, caretTo.current)
    caretTo.current = null
  })

  // Mudou a letra, o tamanho ou o tipo: espera as fontes e redistribui o livro.
  const layoutKey = isBook ? [draft.style.font, draft.style.size, ...draft.pages.map((p) => `${p.style?.font ?? ''}/${p.style?.size ?? ''}`)].join('|') : ''
  useEffect(() => {
    if (!isBook) return
    let alive = true
    const fonts = new Set([draft.style.font, ...draft.pages.map((p) => p.style?.font).filter((f): f is string => !!f)])
    void Promise.all([...fonts].map((f) => loadBoardFont(f))).then(() => {
      if (!alive) return
      const prev = draftRef.current
      const { pages, full: over } = reflowAll(prev.pages, prev.style)
      setFull(over)
      if (samePages(pages, prev.pages)) return
      setDraft({ ...prev, pages })
      setDirty(true)
    })
    return () => { alive = false }
  }, [layoutKey])  // eslint-disable-line react-hooks/exhaustive-deps

  // Folha avulsa: avisa quando o texto passa do papel.
  const sheetOverflow = useMemo(() => !isBook && !!page && overflows(page.text, style, false), [isBook, page?.text, style.font, style.size])  // eslint-disable-line react-hooks/exhaustive-deps

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

  // Ctrl+S salva.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (dirty) void save() }
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
              onChange={(e) => change((d) => { d.title = e.target.value })}
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
                <p className="doc-editor__label">Letra à mão · tamanho {style.size}</p>
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
                      <PaperPage text="" style={{ ...style, texture: p.id, burn: 0, torn: false }} seed={i * 97 + 11} />
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
                <p className="doc-editor__label">Tinta</p>
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
                <button type="button" role="tab" aria-selected={onCover} className={`doc-editor__chip${onCover ? ' is-on' : ''}`} onClick={() => setPageIdx(COVER)}>Capa</button>
                {draft.pages.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={!onCover && at === i}
                    className={`doc-editor__chip${!onCover && at === i ? ' is-on' : ''}${p.cont ? ' doc-editor__chip--cont' : ''}`}
                    onClick={() => setPageIdx(i)}
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
              <button type="button" className="btn btn-primary" onClick={() => setPageIdx(0)}>Escrever as páginas ›</button>
            </div>
          ) : (
            <div className="doc-editor__work">
              <textarea
                ref={textRef}
                className="input doc-editor__text"
                value={page?.text ?? ''}
                maxLength={isBook ? undefined : MAX_PAGE_CHARS}
                onChange={(e) => setText(e.target.value, e.target.selectionStart)}
                placeholder={isBook ? (at === 0 ? 'Escreva a primeira página… O que não couber vai sozinho pra próxima.' : `Escreva a página ${at + 1}…`) : 'Escreva a carta, o bilhete, o édito…'}
                aria-label="Texto"
                style={{ fontFamily: handStack(style.font), fontSize: 18 }}
              />
              <div className="doc-editor__preview">
                <div className="doc-sheet">
                  <PaperPage text={page?.text ?? ''} style={style} seed={pageSeed(draft.id, at)} placeholder="O texto aparece aqui…" className={isBook ? 'doc-paper--page' : undefined} />
                </div>
                {sheetOverflow && <p className="doc-editor__hint doc-editor__warn">O texto passou do tamanho da folha. Diminua a letra ou troque pra Livro (aí o resto vai pra próxima página).</p>}
              </div>
            </div>
          )}
          <div className="doc-editor__foot">
            <span className="doc-editor__status" role="status">
              {error ?? (full ? `O livro chegou ao limite de ${MAX_PAGES} páginas — o texto que passou da última não aparece.` : saving ? 'Salvando…' : dirty ? 'Alterações não salvas (Ctrl+S salva)' : 'Tudo salvo')}
            </span>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>{dirty ? 'Descartar' : 'Fechar'}</button>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving || !dirty}>Salvar</button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}
