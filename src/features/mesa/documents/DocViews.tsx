import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useBoardFont } from '../../../shared/lib/googleFonts'
import { loadDocFonts } from './docHtml'
import type { MesaDocument } from './documentsService'
import { coverOf, handStack, inkOf, pageSeed, pageStyle, paperCss, type DocStyle } from './paperStyles'
import './Documents.css'

// ────────────────────────────────────────────────────────
// Como os documentos aparecem: a folha de papel (textura + texto à mão)
// e o livro (capa de couro, duas páginas abertas e a página virando em 3D).
// O tamanho da letra acompanha a largura da folha (unidades cqw), então o
// mesmo documento fica igual na miniatura, no leitor e na transmissão.
// ────────────────────────────────────────────────────────

interface PaperProps {
  /** Texto formatado da página (HTML já limpo). */
  html:         string
  style:        DocStyle
  seed:         number
  placeholder?: string
  className?:   string
}

/** Letra, tamanho e tinta padrão do texto de uma página. */
export const textCss = (style: DocStyle): CSSProperties => ({ fontFamily: handStack(style.font), color: inkOf(style.ink), fontSize: `${style.size / 6}cqw` })

/** Uma folha: o papel e o texto escrito à mão por cima. */
export function PaperPage({ html, style, seed, placeholder, className }: PaperProps) {
  useBoardFont(style.font)
  useEffect(() => { void loadDocFonts(html) }, [html])
  return (
    <PaperFrame style={style} seed={seed} className={className}>
      {html
        ? <div className="doc-paper__text" style={textCss(style)} dangerouslySetInnerHTML={{ __html: html }} />
        : <div className="doc-paper__text" style={textCss(style)}>{placeholder ? <span className="doc-paper__empty">{placeholder}</span> : null}</div>}
    </PaperFrame>
  )
}

/** Só o papel (textura e efeitos); o texto vem de quem usa (ex.: o editor). */
export function PaperFrame({ style, seed, className, children }: { style: DocStyle; seed: number; className?: string; children: ReactNode }) {
  return <div className={`doc-paper${className ? ` ${className}` : ''}`} style={paperCss(style, seed)}>{children}</div>
}

/**
 * Capa do livro: couro, filete dourado, o título e o autor. A capa é a
 * própria medida (cqw) de tudo que tem dentro, então fica igual em
 * qualquer tamanho — na miniatura da Mesa, no editor e no livro aberto.
 */
export function BookCover({ title, style }: { title: string; style: DocStyle }) {
  useBoardFont('Cinzel Decorative')
  const c = coverOf(style.cover)
  const author = style.author?.trim()
  return (
    <div className="doc-cover" style={{ '--cover': c.color, '--trim': c.trim } as CSSProperties}>
      <span className="doc-cover__frame" aria-hidden="true" />
      <div className="doc-cover__in">
        <span className="doc-cover__title">{title}</span>
        <span className="doc-cover__orn" aria-hidden="true">❦</span>
        {author && <span className="doc-cover__author">{author}</span>}
      </div>
    </div>
  )
}

/** Uma das páginas do livro (ou a capa, ou nada). */
type Side = 'cover' | number | null

/** O que fica à esquerda/direita na "abertura" v (0 = fechado, só a capa). */
function sides(v: number, single: boolean): { left: Side; right: Side } {
  if (v <= 0) return { left: null, right: 'cover' }
  if (single) return { left: null, right: v - 1 }
  return { left: 2 * (v - 1), right: 2 * (v - 1) + 1 }
}

export function bookSpreads(pages: number, single: boolean): number {
  return single ? pages : Math.ceil(pages / 2)
}

interface BookProps {
  doc:        MesaDocument
  /**
   * Página aberta, controlada por fora (ex.: a transmissão): 0 = capa, n = a
   * página n. É pela página (e não pela "abertura") porque cada tela mostra
   * o livro do seu jeito — uma página só no celular, duas no computador —
   * e todo mundo tem que cair na mesma página.
   */
  page?:      number
  /** A pessoa virou a página (setas, clique na página ou teclado). */
  onPage?:    (page: number) => void
  /** Pode virar as páginas (senão, só acompanha `spread`). */
  interactive?: boolean
  /** Teclas ← → viram as páginas. */
  keys?:      boolean
}

const FLIP_MS = 720

export function BookView({ doc, page, onPage, interactive = true, keys = false }: BookProps) {
  const box = useRef<HTMLDivElement>(null)
  const [single, setSingle] = useState(false)
  // página ↔ abertura: com duas páginas, a abertura v mostra as páginas 2v-1 e 2v.
  const toV = (p: number) => (p <= 0 ? 0 : single ? p : Math.ceil(p / 2))
  const toP = (v: number) => (v <= 0 ? 0 : single ? v : 2 * v - 1)
  const [shown, setShown] = useState(() => (page ? Math.ceil(page / 2) : 0))
  const [flip, setFlip] = useState<{ from: number; to: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const wasSingle = useRef(single)

  // Pouco espaço: uma página por vez. Mede o espaço em volta (o livro de uma
  // página é mais estreito — medir ele mesmo prenderia nesse modo).
  useLayoutEffect(() => {
    const el = box.current?.parentElement
    if (!el) return
    const measure = () => setSingle(el.clientWidth < 560)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Trocou entre uma e duas páginas: continua na mesma página, sem animação.
  useLayoutEffect(() => {
    if (wasSingle.current === single) return
    const was = wasSingle.current
    wasSingle.current = single
    const p = page ?? (shown <= 0 ? 0 : was ? shown : 2 * shown - 1)
    window.clearTimeout(timer.current)
    setFlip(null)
    setShown(toV(p))
  }, [single])  // eslint-disable-line react-hooks/exhaustive-deps

  const max = bookSpreads(doc.pages.length, single)
  const clampV = (v: number) => Math.max(0, Math.min(max, v))
  // O livro encolheu (páginas apagadas): não fica aberto além do fim.
  useEffect(() => { if (!flip && shown > max) setShown(max) }, [max, shown, flip])

  const turnTo = (to: number) => {
    to = clampV(to)
    const from = flip ? flip.to : shown
    if (to === from) return
    window.clearTimeout(timer.current)
    if (flip) setShown(flip.to)
    setFlip({ from, to })
    timer.current = window.setTimeout(() => { setShown(to); setFlip(null) }, FLIP_MS)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Controlado por fora (transmissão): vira junto, na mesma página.
  useEffect(() => {
    if (page == null) return
    const target = clampV(toV(page))
    if (target !== (flip ? flip.to : shown)) turnTo(target)
  }, [page])  // eslint-disable-line react-hooks/exhaustive-deps

  const go = (dir: 1 | -1) => {
    const to = clampV((flip ? flip.to : shown) + dir)
    if (page != null && onPage) { onPage(toP(to)); return }
    turnTo(to)
    onPage?.(toP(to))
  }

  useEffect(() => {
    if (!keys || !interactive) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      // Só o livro que está à vista e por cima de tudo (o leitor aberto por
      // cima da transmissão não vira as duas ao mesmo tempo).
      const el = box.current
      if (!el || !el.getClientRects().length) return
      const top = [...document.querySelectorAll('.doc-reader, .modal-overlay')].pop()
      if (top && !top.contains(el)) return
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const renderSide = (s: Side): ReactNode => {
    if (s === null) return null
    if (s === 'cover') return <BookCover title={doc.title} style={doc.style} />
    const pg = doc.pages[s]
    // Livro com número ímpar de páginas: o verso da última fica em branco, sem número.
    if (!pg) return <PaperPage html="" style={doc.style} seed={pageSeed(doc.id, s)} className="doc-paper--page" />
    const style = pageStyle(doc.style, pg.style)
    return (
      <>
        <PaperPage html={pg.html} style={style} seed={pageSeed(doc.id, s)} className="doc-paper--page" />
        <span className={`doc-book__num doc-book__num--${s % 2 ? 'r' : 'l'}`} style={{ fontFamily: handStack(style.font), color: inkOf(style.ink) }}>{s + 1}</span>
      </>
    )
  }

  // Durante a virada: embaixo, o que vai sobrar à mostra; a folha que gira por cima.
  const now = sides(flip ? flip.from : shown, single)
  const next = flip ? sides(flip.to, single) : null
  const forward = flip ? flip.to > flip.from : true
  const under = !flip || !next ? now : forward ? { left: now.left, right: next.right } : { left: next.left, right: now.right }
  const closed = !flip && shown === 0
  const v = flip ? flip.to : shown

  return (
    <div className={`doc-book${single ? ' doc-book--single' : ''}${closed ? ' doc-book--closed' : ''}`} ref={box}>
      {single ? (
        // Uma página por vez: a página nova entra girando pelo lado certo.
        <div className="doc-book__stage">
          <div
            key={v}
            className={`doc-book__half doc-book__half--right${flip ? ` doc-book__turn--${forward ? 'fwd' : 'back'}` : ''}`}
            style={flip ? { animationDuration: `${FLIP_MS}ms` } : undefined}
            onClick={interactive ? () => go(1) : undefined}
          >
            {renderSide(sides(v, true).right)}
          </div>
        </div>
      ) : (
        <div className="doc-book__stage">
          <div className="doc-book__half doc-book__half--left" onClick={interactive ? () => go(-1) : undefined}>{renderSide(under.left)}</div>
          <div className="doc-book__half doc-book__half--right" onClick={interactive ? () => go(1) : undefined}>{renderSide(under.right)}</div>
          {!closed && <span className="doc-book__spine" aria-hidden="true" />}
          {flip && next && (
            <div
              key={`${flip.from}-${flip.to}`}
              className={`doc-book__leaf doc-book__leaf--${forward ? 'fwd' : 'back'}`}
              style={{ animationDuration: `${FLIP_MS}ms` }}
            >
              <div className="doc-book__face doc-book__face--front">{renderSide(forward ? now.right : now.left)}</div>
              <div className="doc-book__face doc-book__face--back">{renderSide(forward ? next.left : next.right)}</div>
            </div>
          )}
        </div>
      )}
      {interactive && (
        <div className="doc-book__nav">
          <button type="button" className="doc-book__btn" onClick={() => go(-1)} disabled={v <= 0} aria-label="Página anterior">‹</button>
          <span className="doc-book__where">
            {v === 0 ? 'Capa' : single ? `pág. ${v} de ${doc.pages.length}` : `pág. ${2 * v - 1}${2 * v <= doc.pages.length ? `–${2 * v}` : ''} de ${doc.pages.length}`}
          </span>
          <button type="button" className="doc-book__btn" onClick={() => go(1)} disabled={v >= max} aria-label="Próxima página">›</button>
        </div>
      )}
    </div>
  )
}

/** O documento inteiro: folha avulsa ou livro. */
export function DocumentView({ doc, page, onPage, interactive = true, keys = false }: BookProps) {
  if (doc.kind === 'book') return <BookView doc={doc} page={page} onPage={onPage} interactive={interactive} keys={keys} />
  const first = doc.pages[0]
  return (
    <div className="doc-sheet">
      <PaperPage html={first?.html ?? ''} style={pageStyle(doc.style, first?.style)} seed={pageSeed(doc.id, 0)} />
    </div>
  )
}
