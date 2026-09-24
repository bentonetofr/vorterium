import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Presence } from './Presence'
import './Select.css'

// ────────────────────────────────────────────────────────
// Lista de escolha no visual do site — substitui o <select> nativo, cuja
// lista aberta é desenhada pelo sistema operacional (fundo branco/azul) e
// não aceita estilo.
//
// O foco fica no botão o tempo todo (padrão combobox + aria-activedescendant):
// ↑/↓/Home/End andam, Enter/Espaço escolhem, Esc/Tab fecham, e digitar uma
// letra pula pra opção que começa com ela. A lista vai por portal pro
// <body> (não é cortada por overflow nem fica atrás de janela modal) e abre
// pra cima quando não cabe embaixo.
// ────────────────────────────────────────────────────────

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  options:       SelectOption[]
  /** Controlado. Sem `value`, guarda a escolha sozinho (a partir de `defaultValue`). */
  value?:        string
  defaultValue?: string
  onChange:      (value: string) => void
  className?:    string
  /** Sem a classe .input — pra quem já estiliza o campo sozinho (ex.: .gact-filter). */
  plain?:        boolean
  disabled?:     boolean
  id?:           string
  'aria-label'?: string
}

const LIST_MAX_HEIGHT = 280
const GAP = 6

interface Placement { left: number; width: number; top?: number; bottom?: number; maxHeight: number }

export function Select({
  options, value, defaultValue = '', onChange, className, plain = false, disabled = false, id, 'aria-label': ariaLabel,
}: SelectProps) {
  const [ownValue, setOwnValue] = useState(defaultValue)
  const current = value ?? ownValue

  const [open, setOpen]         = useState(false)
  const [active, setActive]     = useState(-1)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef    = useRef<HTMLUListElement>(null)
  const typed      = useRef({ text: '', at: 0 })
  const listId     = useId()

  const selectedIndex = options.findIndex((o) => o.value === current)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  const place = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const r = trigger.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - GAP - 8
    const above = r.top - GAP - 8
    const width = Math.max(r.width, 160)
    const left  = Math.min(r.left, window.innerWidth - width - 8)
    if (below >= Math.min(LIST_MAX_HEIGHT, 160) || below >= above) {
      setPlacement({ left, width, top: r.bottom + GAP, maxHeight: Math.min(LIST_MAX_HEIGHT, below) })
    } else {
      setPlacement({ left, width, bottom: window.innerHeight - r.top + GAP, maxHeight: Math.min(LIST_MAX_HEIGHT, above) })
    }
  }, [])

  function openList() {
    if (disabled) return
    place()
    setActive(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  function choose(index: number) {
    const option = options[index]
    if (!option) return
    if (value === undefined) setOwnValue(option.value)
    if (option.value !== current) onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  // Acompanha rolagem/redimensionamento enquanto aberto; clique fora fecha.
  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, place])

  useEffect(() => { if (disabled) setOpen(false) }, [disabled])

  // Mantém a opção ativa (teclado) visível dentro da lista.
  useLayoutEffect(() => {
    if (!open || active < 0) return
    const item = listRef.current?.children[active] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    const last = options.length - 1
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault()
        if (!open) { openList(); return }
        const step = e.key === 'ArrowDown' ? 1 : -1
        setActive((i) => Math.max(0, Math.min(last, (i < 0 ? selectedIndex : i) + step)))
        return
      }
      case 'Home': if (open) { e.preventDefault(); setActive(0) } return
      case 'End':  if (open) { e.preventDefault(); setActive(last) } return
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (open) choose(active); else openList()
        return
      case 'Escape':
        if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false) }
        return
      case 'Tab':
        if (open) setOpen(false)
        return
    }
    // Digitar letras pula pra opção que começa com elas.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now()
      typed.current = { text: (now - typed.current.at > 700 ? '' : typed.current.text) + e.key.toLowerCase(), at: now }
      const from = open ? active : selectedIndex
      const match = findByPrefix(options, typed.current.text, from)
      if (match < 0) return
      if (open) setActive(match)
      else choose(match)
    }
  }

  const listStyle: CSSProperties | undefined = placement
    ? {
        left: placement.left, width: placement.width, maxHeight: placement.maxHeight,
        top: placement.top, bottom: placement.bottom,
        transformOrigin: placement.top !== undefined ? 'top center' : 'bottom center',
      }
    : undefined

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`${plain ? '' : 'input '}select-trigger${open ? ' select-trigger--open' : ''}${className ? ` ${className}` : ''}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
      >
        <span className={`select-trigger__value${selected?.value === '' ? ' select-trigger__value--empty' : ''}`}>
          {selected?.label ?? '—'}
        </span>
        <svg className="select-trigger__chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {createPortal(
        <Presence show={open} exitMs={150}>
          {(state) => (
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              className="select-list"
              data-state={state}
              style={listStyle}
              aria-label={ariaLabel}
              // Não rouba o foco do botão ao clicar numa opção.
              onMouseDown={(e) => e.preventDefault()}
            >
              {options.map((option, index) => (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.value === current}
                  className={[
                    'select-list__option',
                    index === active ? 'select-list__option--active' : '',
                    option.value === current ? 'select-list__option--selected' : '',
                    option.value === '' ? 'select-list__option--empty' : '',
                  ].filter(Boolean).join(' ')}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                >
                  <span className="select-list__label">{option.label}</span>
                  {option.value === current && <span className="select-list__check" aria-hidden="true">✓</span>}
                </li>
              ))}
            </ul>
          )}
        </Presence>,
        document.body,
      )}
    </>
  )
}

function findByPrefix(options: SelectOption[], prefix: string, from: number): number {
  const n = options.length
  // Mesma letra repetida ("b", "b") anda entre as opções com essa letra.
  const repeating = prefix.length > 1 && [...prefix].every((c) => c === prefix[0])
  const search = repeating ? prefix[0] : prefix
  const start = repeating || prefix.length === 1 ? from + 1 : Math.max(from, 0)
  for (let k = 0; k < n; k++) {
    const i = (start + k + n) % n
    if (options[i].label.toLowerCase().startsWith(search)) return i
  }
  return -1
}
