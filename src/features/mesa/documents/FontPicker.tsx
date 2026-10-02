import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { loadFontPreview } from '../../../shared/lib/googleFonts'
import { HAND_FONTS, handStack } from './paperStyles'

// ────────────────────────────────────────────────────────
// Caixa "Fontes": mostra a letra escolhida e, ao clicar, abre um card com
// todas as letras à mão, cada uma escrita nela mesma (só baixa as letras
// do nome, e só quando aparece no card).
// ────────────────────────────────────────────────────────

const CARD_W = 380
const CARD_H = 380

interface PickerProps {
  current:  string
  onPick:   (font: string) => void
  /** Texto da caixa (padrão "Fontes"). */
  label?:   string
  /** Versão menor, pra barra de formatação. */
  compact?: boolean
  /** Opção "volta pra letra padrão" no topo do card (onPick recebe 'default'). */
  defaultLabel?: string
}

export function FontPicker({ current, onPick, label = 'Fontes', compact, defaultLabel }: PickerProps) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => { loadFontPreview(current) }, [current])
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`doc-fontbox${compact ? ' doc-fontbox--compact' : ''}${open ? ' is-open' : ''}`}
        // Não tira o foco do texto (a letra cai no trecho selecionado).
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        title={label}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="doc-fontbox__label">{label}</span>
        <span className="doc-fontbox__name" style={{ fontFamily: handStack(current) }}>{current}</span>
        <span className="doc-fontbox__caret" aria-hidden="true">▾</span>
      </button>
      {open && <FontCard anchor={btn} current={current} defaultLabel={defaultLabel} onPick={(f) => { onPick(f); setOpen(false) }} onClose={() => setOpen(false)} />}
    </>
  )
}

function FontCard({ anchor, current, defaultLabel, onPick, onClose }: { anchor: RefObject<HTMLButtonElement>; current: string; defaultLabel?: string; onPick: (f: string) => void; onClose: () => void }) {
  const card = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState<CSSProperties>({})
  const [query, setQuery] = useState('')
  const fonts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? HAND_FONTS.filter((f) => f.toLowerCase().includes(q)) : HAND_FONTS
  }, [query])

  // Embaixo da caixa (ou em cima, se não couber), sem sair da tela.
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.current?.getBoundingClientRect()
      if (!r) return
      const w = Math.min(CARD_W, window.innerWidth - 16)
      const h = Math.min(CARD_H, window.innerHeight - 16)
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
      const below = window.innerHeight - r.bottom - 8
      const top = below >= h || below >= r.top ? Math.min(r.bottom + 6, window.innerHeight - h - 8) : Math.max(8, r.top - h - 6)
      setPos({ left, top, width: w, maxHeight: h })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [anchor])

  // Rola até a escolhida (só dentro do card) e, com mouse, já deixa pronto pra procurar.
  useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)').matches) search.current?.focus({ preventScroll: true })
    const on = list.current?.querySelector<HTMLElement>('.is-on')
    if (list.current && on) list.current.scrollTop = on.offsetTop - list.current.clientHeight / 2 + on.offsetHeight / 2
  }, [])

  // Clique fora ou Esc fecham só o card (o Esc não chega a fechar o editor).
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (!card.current?.contains(t) && !anchor.current?.contains(t)) onClose()
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key, true) }
  }, [anchor, onClose])

  return createPortal(
    <div ref={card} className="doc-fontcard" style={pos} role="dialog" aria-label="Fontes">
      <div className="doc-fontcard__head">
        <span className="doc-fontcard__title">Fontes · {HAND_FONTS.length}</span>
        <input
          className="input doc-fontcard__search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Procurar…"
          aria-label="Procurar fonte"
          ref={search}
        />
      </div>
      <div ref={list} className="doc-fontcard__grid" role="listbox" aria-label="Letra à mão">
        {defaultLabel && !query && (
          <button type="button" role="option" aria-selected={false} className="doc-fontcard__tile doc-fontcard__tile--default" onClick={() => onPick('default')}>
            {defaultLabel}
          </button>
        )}
        {fonts.map((f) => <FontTile key={f} family={f} on={f === current} root={list} onPick={onPick} />)}
        {!fonts.length && <p className="doc-fontcard__none">Nenhuma fonte com esse nome.</p>}
      </div>
    </div>,
    document.body,
  )
}

function FontTile({ family, on, root, onPick }: { family: string; on: boolean; root: RefObject<HTMLDivElement>; onPick: (f: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { loadFontPreview(family); return }
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { loadFontPreview(family); io.disconnect() } }, { root: root.current, rootMargin: '120px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [family, root])
  return (
    <button ref={ref} type="button" role="option" aria-selected={on} className={`doc-fontcard__tile${on ? ' is-on' : ''}`} onClick={() => onPick(family)} title={family}>
      <span className="doc-fontcard__sample" style={{ fontFamily: handStack(family) }}>{family}</span>
    </button>
  )
}
