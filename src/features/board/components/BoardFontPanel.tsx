import { useEffect, useMemo, useRef, useState } from 'react'
import { BOARD_FONTS, FONT_CATEGORIES, fontStack, loadFontPreview, type BoardFont, type FontCategory } from '../boardFonts'

// ────────────────────────────────────────────────────────
// Galeria de fontes do Quadro: painel do lado direito, com busca e
// categorias. Cada cartão mostra o nome escrito na própria fonte (baixa só
// quando o cartão aparece na rolagem). Clicar aplica nos itens selecionados.
// ────────────────────────────────────────────────────────

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const CAT_LABEL = new Map(FONT_CATEGORIES.map((c) => [c.id, c.label]))

interface Props {
  /** Fonte dos itens selecionados (null = padrão; undefined = fontes diferentes). */
  current: string | null | undefined
  onPick:  (family: string | null) => void
  onClose: () => void
}

export function BoardFontPanel({ current, onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<FontCategory | 'all'>('all')
  const listRef = useRef<HTMLDivElement>(null)
  const q = norm(query.trim())

  const list = useMemo(
    () => BOARD_FONTS.filter((f) => (cat === 'all' || f.cat === cat) && (!q || norm(f.family).includes(q))),
    [cat, q],
  )
  // "Todas" sem busca: separadas por categoria, com título.
  const sections = cat === 'all' && !q
    ? FONT_CATEGORIES.map((c) => ({ id: c.id, label: c.label, fonts: list.filter((f) => f.cat === c.id) }))
    : [{ id: 'busca', label: null as string | null, fonts: list }]

  useEffect(() => { listRef.current?.scrollTo({ top: 0 }) }, [cat, q])

  const card = (f: BoardFont) => (
    <FontCard key={f.family} font={f} on={current === f.family} root={listRef} onPick={onPick} />
  )

  return (
    <div
      className="board-fonts"
      role="dialog"
      aria-label="Fontes"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
    >
      <div className="board-fonts__head">
        <div>
          <h3 className="board-fonts__title">Fontes</h3>
          <p className="board-fonts__sub">{BOARD_FONTS.length} fontes do Google Fonts</p>
        </div>
        <button type="button" className="board-context__btn" onClick={onClose} aria-label="Fechar fontes">✕</button>
      </div>

      <input
        className="input board-fonts__search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Procurar fonte pelo nome…"
        aria-label="Procurar fonte"
      />

      <div className="board-fonts__cats" role="tablist" aria-label="Categorias">
        {[{ id: 'all' as const, label: 'Todas' }, ...FONT_CATEGORIES].map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={cat === c.id}
            className={`board-fonts__cat${cat === c.id ? ' is-on' : ''}`}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="board-fonts__list" ref={listRef}>
        {cat === 'all' && !q && (
          <button
            type="button"
            className={`board-font board-font--default${current === null ? ' is-on' : ''}`}
            aria-pressed={current === null}
            onClick={() => onPick(null)}
          >
            <span className="board-font__name">Padrão</span>
            <span className="board-font__cat">a letra normal do quadro</span>
          </button>
        )}
        {sections.map((s) => s.fonts.length > 0 && (
          <section key={s.id} className="board-fonts__section">
            {s.label && <h4 className="board-fonts__section-title">{s.label} <span>{s.fonts.length}</span></h4>}
            <div className="board-fonts__grid">{s.fonts.map(card)}</div>
          </section>
        ))}
        {list.length === 0 && <p className="board-fonts__empty">Nenhuma fonte com “{query.trim()}”.</p>}
      </div>
    </div>
  )
}

function FontCard({ font, on, root, onPick }: { font: BoardFont; on: boolean; root: React.RefObject<HTMLDivElement>; onPick: (family: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  // Só baixa a amostra quando o cartão chega perto da área visível.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { loadFontPreview(font.family); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { loadFontPreview(font.family); io.disconnect() }
    }, { root: root.current, rootMargin: '200px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [font.family, root])

  return (
    <button
      ref={ref}
      type="button"
      className={`board-font${on ? ' is-on' : ''}`}
      aria-pressed={on}
      title={`${font.family} · ${CAT_LABEL.get(font.cat)}`}
      onClick={() => onPick(font.family)}
    >
      <span className="board-font__name" style={{ fontFamily: fontStack(font.family) }}>{font.family}</span>
    </button>
  )
}
