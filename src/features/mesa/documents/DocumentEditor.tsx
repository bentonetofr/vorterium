import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ModalOverlay } from '../../../shared/components/ModalOverlay'
import { loadFontPreview } from '../../../shared/lib/googleFonts'
import { MAX_PAGE_CHARS, MAX_PAGES, saveDocument, type MesaDocument } from './documentsService'
import { BookCover, PaperPage } from './DocViews'
import {
  COVERS, HAND_FONTS, INKS, PAPERS, handStack, pageSeed, pageStyle, type DocStyle,
} from './paperStyles'

// ────────────────────────────────────────────────────────
// Editor de documento (só o mestre): título, folha ou livro, as páginas, e
// o estilo — textura do papel, efeitos (queimado, rasgado, dobras,
// manchas), letra à mão, tamanho e cor da tinta. No livro, o estilo vale
// pro livro todo ou só pra página aberta (cada página pode ter o seu).
// ────────────────────────────────────────────────────────

const clone = (d: MesaDocument): MesaDocument => ({ ...d, style: { ...d.style }, pages: d.pages.map((p) => ({ ...p, style: p.style ? { ...p.style } : undefined })) })

export function DocumentEditor({ doc, onClose, onSaved }: { doc: MesaDocument; onClose: () => void; onSaved: (doc: MesaDocument) => void }) {
  const [draft, setDraft] = useState<MesaDocument>(() => clone(doc))
  const [pageIdx, setPageIdx] = useState(0)
  const [scope, setScope] = useState<'doc' | 'page'>('doc')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const isBook = draft.kind === 'book'
  const page = draft.pages[Math.min(pageIdx, draft.pages.length - 1)]
  const ownStyle = isBook && !!page?.style
  const editingPage = isBook && scope === 'page'
  const style = pageStyle(draft.style, page?.style)

  const change = (fn: (d: MesaDocument) => void) => {
    setDraft((prev) => { const next = clone(prev); fn(next); return next })
    setDirty(true)
  }
  const setStyle = (patch: Partial<DocStyle>) => change((d) => {
    if (editingPage) {
      const p = d.pages[pageIdx]
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
  }

  function addPage() {
    if (draft.pages.length >= MAX_PAGES) return
    change((d) => { d.pages.splice(pageIdx + 1, 0, { text: '' }) })
    setPageIdx(pageIdx + 1)
  }
  function removePage() {
    if (draft.pages.length <= 1) return
    change((d) => { d.pages.splice(pageIdx, 1) })
    setPageIdx(Math.max(0, pageIdx - 1))
  }

  async function save() {
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

  // Ctrl+S salva.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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

          {isBook && (
            <div>
              <p className="doc-editor__label">Estilo de</p>
              <div className="doc-editor__row">
                <button type="button" className={`doc-editor__chip${scope === 'doc' ? ' is-on' : ''}`} onClick={() => setScope('doc')}>Livro todo</button>
                <button type="button" className={`doc-editor__chip${scope === 'page' ? ' is-on' : ''}`} onClick={() => setScope('page')}>Só a página {pageIdx + 1}</button>
              </div>
              {ownStyle && (
                <p className="doc-editor__hint">
                  A página {pageIdx + 1} tem estilo próprio.{' '}
                  <button type="button" className="doc-editor__chip" onClick={() => change((d) => { d.pages[pageIdx].style = undefined })}>Usar o do livro</button>
                </p>
              )}
            </div>
          )}

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

          <div>
            <p className="doc-editor__label">Letra à mão · tamanho {style.size}</p>
            <input
              type="range" min={16} max={48} value={style.size}
              onChange={(e) => setStyle({ size: Number(e.target.value) })}
              aria-label="Tamanho da letra"
              style={{ width: '100%' }}
            />
            <FontList current={style.font} onPick={(font) => setStyle({ font })} />
          </div>

          {isBook && !editingPage && (
            <div>
              <p className="doc-editor__label">Capa</p>
              <div className="doc-editor__cover-mini"><BookCover title={draft.title} style={draft.style} /></div>
              <div className="doc-editor__row">
                {COVERS.map((c) => (
                  <button key={c.id} type="button" className={`doc-editor__chip${draft.style.cover === c.id ? ' is-on' : ''}`} onClick={() => setStyle({ cover: c.id })}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Texto e prévia ── */}
        <div className="doc-editor__main">
          {isBook && (
            <div className="doc-editor__pages" role="tablist" aria-label="Páginas">
              {draft.pages.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={pageIdx === i}
                  className={`doc-editor__chip${pageIdx === i ? ' is-on' : ''}`}
                  onClick={() => setPageIdx(i)}
                  title={p.style ? 'Página com estilo próprio' : undefined}
                >
                  {i + 1}{p.style ? '*' : ''}
                </button>
              ))}
              <button type="button" className="doc-editor__chip" onClick={addPage} disabled={draft.pages.length >= MAX_PAGES}>+ Página</button>
              {draft.pages.length > 1 && <button type="button" className="doc-editor__chip" onClick={removePage}>Tirar a página {pageIdx + 1}</button>}
            </div>
          )}
          <div className="doc-editor__work">
            <textarea
              className="input doc-editor__text"
              value={page?.text ?? ''}
              maxLength={MAX_PAGE_CHARS}
              onChange={(e) => change((d) => { d.pages[Math.min(pageIdx, d.pages.length - 1)].text = e.target.value })}
              placeholder={isBook ? `Escreva a página ${pageIdx + 1}…` : 'Escreva a carta, o bilhete, o édito…'}
              aria-label="Texto"
              style={{ fontFamily: handStack(style.font), fontSize: 18 }}
            />
            <div className="doc-editor__preview">
              <div className="doc-sheet">
                <PaperPage text={page?.text ?? ''} style={style} seed={pageSeed(draft.id, pageIdx)} placeholder="O texto aparece aqui…" />
              </div>
            </div>
          </div>
          <div className="doc-editor__foot">
            <span className="doc-editor__status" role="status">
              {error ?? (saving ? 'Salvando…' : dirty ? 'Alterações não salvas (Ctrl+S salva)' : 'Tudo salvo')}
            </span>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>{dirty ? 'Descartar' : 'Fechar'}</button>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving || !dirty}>Salvar</button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

/** Lista das letras à mão, cada uma escrita na própria fonte (baixa só quando aparece). */
function FontList({ current, onPick }: { current: string; onPick: (font: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const fonts = useMemo(() => HAND_FONTS, [])
  // Rola até a escolhida ao abrir (só dentro da lista, sem mexer no painel).
  useEffect(() => {
    const list = box.current
    const on = list?.querySelector<HTMLElement>('.is-on')
    if (list && on) list.scrollTop = on.offsetTop - list.clientHeight / 2
  }, [])
  return (
    <div className="doc-editor__fonts" ref={box} role="listbox" aria-label="Letra à mão">
      {fonts.map((f) => <FontItem key={f} family={f} on={f === current} root={box} onPick={onPick} />)}
    </div>
  )
}

function FontItem({ family, on, root, onPick }: { family: string; on: boolean; root: RefObject<HTMLDivElement>; onPick: (f: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { loadFontPreview(family); return }
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { loadFontPreview(family); io.disconnect() } }, { root: root.current, rootMargin: '80px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [family, root])
  return (
    <button ref={ref} type="button" role="option" aria-selected={on} className={`doc-editor__font${on ? ' is-on' : ''}`} style={{ fontFamily: handStack(family) }} onClick={() => onPick(family)} title={family}>
      {family}
    </button>
  )
}
