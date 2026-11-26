import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Select } from '../../../../shared/components/Select'

// ────────────────────────────────────────────────────────
// Peças pequenas da ficha, no desenho do livro: faixa de título, fileira de casas (Vida, Fadiga, Armadura, Esperança),
// campo editável no lugar e botão de contar.
// ────────────────────────────────────────────────────────

export function Banner({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="dh-banner">
      <span className="dh-banner__title">{children}</span>
      {right && <span className="dh-banner__right">{right}</span>}
    </div>
  )
}

interface SlotsProps {
  /** Casas que existem (as demais aparecem tracejadas, ainda por conquistar). */
  open: number
  /** Total desenhado. */
  total: number
  marked: number
  onChange?: (marked: number) => void
  shape?: 'box' | 'shield' | 'diamond' | 'dot'
  label: string
  /** Casas riscadas (cicatrizes). */
  lost?: number
  tone?: 'hp' | 'stress' | 'armor' | 'hope'
}

/** Fileira de casas. Clicar na casa N marca até ela; clicar de novo na última marcada desmarca. */
export function Slots({ open, total, marked, onChange, shape = 'box', label, lost = 0, tone }: SlotsProps) {
  const cells = Array.from({ length: total }, (_, i) => i)
  return (
    <div className={`dh-slots dh-slots--${shape}${tone ? ` dh-slots--${tone}` : ''}`} role="group" aria-label={label}>
      {cells.map((i) => {
        const isOpen = i < open
        const isLost = !isOpen && i >= total - lost
        const isMarked = isOpen && i < marked
        return (
          <button
            key={i}
            type="button"
            className={`dh-slot${isMarked ? ' is-marked' : ''}${isOpen ? '' : ' is-locked'}${isLost ? ' is-lost' : ''}`}
            disabled={!isOpen || !onChange}
            aria-pressed={isMarked}
            aria-label={`${label} ${i + 1}`}
            onClick={() => onChange?.(isMarked && i === marked - 1 ? i : i + 1)}
          />
        )
      })}
    </div>
  )
}

interface InlineProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  multiline?: boolean
  maxLength?: number
  rows?: number
  'aria-label'?: string
}

/** Campo que parece texto escrito na ficha: sem borda até receber foco. */
export function Inline({ value, onChange, placeholder, className = '', disabled, multiline, maxLength = 200, rows = 3, ...rest }: InlineProps) {
  const [draft, setDraft] = useState(value)
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setDraft(value) }, [value])
  const common = {
    value: draft,
    placeholder,
    disabled,
    maxLength,
    'aria-label': rest['aria-label'],
    className: `dh-inline ${className}`,
    onFocus: () => { focused.current = true },
    onBlur: () => { focused.current = false; if (draft !== value) onChange(draft) },
  }
  if (multiline) {
    return <textarea {...common} rows={rows} onChange={(e) => { setDraft(e.target.value); onChange(e.target.value) }} />
  }
  return (
    <input
      {...common}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

interface StepperProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  label: string
  format?: (n: number) => string
  disabled?: boolean
}

export function Stepper({ value, onChange, min = -9, max = 99, label, format, disabled }: StepperProps) {
  return (
    <span className="dh-stepper">
      <button type="button" disabled={disabled || value <= min} aria-label={`Diminuir ${label}`} onClick={() => onChange(value - 1)}>−</button>
      <output aria-label={label}>{format ? format(value) : value}</output>
      <button type="button" disabled={disabled || value >= max} aria-label={`Aumentar ${label}`} onClick={() => onChange(value + 1)}>+</button>
    </span>
  )
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

/** Texto de regra com listas: linhas que começam com • viram itens. */
export function RuleText({ text }: { text: string }) {
  const lines = text.split('\n')
  const out: ReactNode[] = []
  let list: string[] = []
  const flush = (key: number) => {
    if (list.length) out.push(<ul key={`u${key}`}>{list.map((l, i) => <li key={i}>{l}</li>)}</ul>)
    list = []
  }
  lines.forEach((l, i) => {
    if (l.startsWith('•')) list.push(l.replace(/^•\s*/, ''))
    else { flush(i); if (l.trim()) out.push(<p key={`p${i}`}>{l}</p>) }
  })
  flush(lines.length)
  return <div className="dh-rule-text">{out}</div>
}

export interface DhOption { value: string; label: string; disabled?: boolean }

/** Lista de escolha no visual do site (a lista aberta do <select> nativo é do sistema e não aceita estilo). */
export function DhSelect({ value, options, onChange, disabled, label, className = '' }: { value: string; options: DhOption[]; onChange: (v: string) => void; disabled?: boolean; label: string; className?: string }) {
  return <Select plain className={`dh-select ${className}`.trim()} options={options} value={value} onChange={onChange} disabled={disabled} aria-label={label} />
}
