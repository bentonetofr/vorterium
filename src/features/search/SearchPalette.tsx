import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Presence } from '../../shared/components/Presence'
import { getSearchIndex, STATIC_ITEMS } from './searchIndex'
import { KIND_LABEL, searchItems, type SearchItem } from './searchCore'
import './Search.css'

// ────────────────────────────────────────────────────────
// Busca geral — Ctrl+K (ou ⌘K) em qualquer página logada, ou o botão
// "Buscar" do menu. Acha páginas, campanhas e suas seções, fichas,
// episódios, notas e criaturas, e leva direto pra lá.
// ↑ ↓ escolhem, Enter abre, Esc fecha.
// ────────────────────────────────────────────────────────

const OPEN_EVENT = 'vorterium:buscar'

/** Abre a busca de qualquer lugar (botão do menu, atalho). */
export function openSearch(): void {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

/** Sem digitar nada: os lugares do site, pra ir direto. */
const SUGGESTED = STATIC_ITEMS.slice(0, 7)

function KindIcon({ kind }: { kind: SearchItem['kind'] }) {
  const glyph: Record<SearchItem['kind'], string> = {
    page: '→', campaign: '◈', section: '›', sheet: '✦', episode: '❖', note: '◇', creature: '☠',
  }
  return <span className={`cmdk__icon cmdk__icon--${kind}`} aria-hidden="true">{glyph[kind]}</span>
}

export function SearchPalette() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SearchItem[]>(STATIC_ITEMS)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Atalho e evento de abrir.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(OPEN_EVENT, onOpen) }
  }, [])

  // Trocou de página: fecha.
  useEffect(() => { setOpen(false) }, [location.pathname])

  // Ao abrir: limpa, foca e carrega o índice (vem do cache quando recente).
  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    const focus = window.setTimeout(() => inputRef.current?.focus(), 30)
    let cancelled = false
    if (user) {
      setLoading(true)
      getSearchIndex(user.id)
        .then((all) => { if (!cancelled) setItems(all) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      cancelled = true
      window.clearTimeout(focus)
      document.body.style.overflow = previousOverflow
    }
  }, [open, user])

  const results = useMemo(
    () => (query.trim() ? searchItems(items, query) : SUGGESTED),
    [items, query],
  )

  useEffect(() => { setActive(0) }, [query])

  // A opção escolhida pelo teclado fica sempre à vista.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function go(item: SearchItem | undefined) {
    if (!item) return
    setOpen(false)
    navigate(item.to)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(Math.max(0, results.length - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
  }

  return (
    <Presence show={open} exitMs={160}>
      {(state) => createPortal(
        <div
          className="cmdk-overlay"
          data-state={state}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="cmdk" role="dialog" aria-modal="true" aria-label="Buscar no Vorterium" onKeyDown={onKeyDown}>
            <div className="cmdk__field">
              <svg className="cmdk__lens" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />
              </svg>
              <input
                ref={inputRef}
                className="cmdk__input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar campanha, ficha, episódio, nota…"
                aria-label="Buscar"
                aria-controls="cmdk-list"
                aria-activedescendant={results[active] ? `cmdk-opt-${active}` : undefined}
                autoComplete="off"
                spellCheck={false}
              />
              {loading && <span className="spinner spinner--sm" aria-label="Carregando" />}
              <kbd className="cmdk__kbd">Esc</kbd>
            </div>

            <ul ref={listRef} id="cmdk-list" className="cmdk__list" role="listbox" aria-label="Resultados">
              {!query.trim() && <li className="cmdk__group" role="presentation">Ir para</li>}
              {results.map((item, i) => (
                <li
                  key={item.key}
                  id={`cmdk-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  className={`cmdk__item${i === active ? ' cmdk__item--active' : ''}`}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(item)}
                >
                  <KindIcon kind={item.kind} />
                  <span className="cmdk__text">
                    <span className="cmdk__title">{item.title}</span>
                    {item.subtitle && <span className="cmdk__sub">{item.subtitle}</span>}
                  </span>
                  <span className="cmdk__kind">{KIND_LABEL[item.kind]}</span>
                </li>
              ))}
              {query.trim() && results.length === 0 && (
                <li className="cmdk__empty" role="presentation">
                  {loading ? 'Procurando…' : `Nada encontrado para "${query.trim()}".`}
                </li>
              )}
            </ul>

            <div className="cmdk__foot" aria-hidden="true">
              <span><kbd className="cmdk__kbd">↑</kbd><kbd className="cmdk__kbd">↓</kbd> escolher</span>
              <span><kbd className="cmdk__kbd">Enter</kbd> abrir</span>
              <span className="cmdk__foot-hint"><kbd className="cmdk__kbd">Ctrl</kbd><kbd className="cmdk__kbd">K</kbd> abre a busca</span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </Presence>
  )
}
