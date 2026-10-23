import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { DndDerivedField } from '../../../../shared/types'
import { saveDndOverride } from '../services/dndSheetService'
import type { SheetCtx } from './sheetContext'

// ────────────────────────────────────────────────────────
// Peças da ficha de D&D: campo numérico, bolinhas clicáveis (espaços de
// magia, salvaguardas contra a morte, exaustão), interruptor e o seletor
// AUTO/MANUAL dos valores calculados.
// ────────────────────────────────────────────────────────

interface NumberFieldProps {
  value:      number
  onChange:   (n: number) => void
  min?:       number
  max?:       number
  step?:      number
  label:      string
  className?: string
  disabled?:  boolean
  placeholder?: string
}

/** Campo numérico que deixa apagar e digitar à vontade e só aceita o valor quando é válido e dentro do limite. */
export function NumberField({ value, onChange, min = -Infinity, max = Infinity, step = 1, label, className = '', disabled, placeholder }: NumberFieldProps) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])

  function commit(raw: string) {
    setText(raw)
    if (raw.trim() === '' || raw === '-') return
    const n = Number(raw.replace(',', '.'))
    if (!Number.isFinite(n)) return
    onChange(Math.max(min, Math.min(max, step < 1 ? n : Math.floor(n))))
  }

  const input = (
    <input
      type="text" inputMode={step < 1 || min < 0 ? 'decimal' : 'numeric'} autoComplete="off"
      className={`dsh-num ${className}`} value={text} disabled={disabled} placeholder={placeholder}
      aria-label={label}
      onChange={(e) => commit(e.target.value)}
      onBlur={() => setText(String(value))}
      onFocus={(e) => e.target.select()}
    />
  )
  if (min >= 0 || disabled) return input
  // campos que aceitam negativo ganham um botão ± (só aparece em telas de toque, onde o teclado numérico não tem o sinal de menos)
  return (
    <span className="dsh-numwrap">
      {input}
      <button type="button" className="dsh-numsign" tabIndex={-1} aria-label={`Trocar o sinal de ${label}`} title="Trocar o sinal (+ ou −)"
        onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(Math.max(min, Math.min(max, -value)))}>±</button>
    </span>
  )
}

interface PipsProps {
  total:     number
  filled:    number
  onChange?: (filled: number) => void
  label:     string
  /** 'good' (verde), 'bad' (vermelho) ou o padrão da ficha. */
  tone?:     'good' | 'bad' | 'accent'
  size?:     'sm' | 'md'
}

/** Bolinhas clicáveis: clicar na última cheia esvazia ela (volta um). */
export function Pips({ total, filled, onChange, label, tone = 'accent', size = 'md' }: PipsProps) {
  const ro = !onChange
  const pick = (i: number) => {
    if (!onChange) return
    onChange(i + 1 === filled ? i : i + 1)
  }
  const onKey = (e: KeyboardEvent) => {
    if (!onChange) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(total, filled + 1)) }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, filled - 1)) }
  }
  return (
    <span
      className={`dsh-pips dsh-pips--${size}${ro ? ' dsh-pips--ro' : ''}`}
      role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={filled}
      tabIndex={ro ? -1 : 0} onKeyDown={onKey}
    >
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i} type="button" tabIndex={-1} disabled={ro}
          className={`dsh-pip dsh-pip--${tone}${i < filled ? ' is-on' : ''}`}
          onClick={() => pick(i)} aria-label={`${label}: ${i + 1}`}
        />
      ))}
    </span>
  )
}

interface ToggleProps {
  checked:   boolean
  onChange?: (v: boolean) => void
  label:     ReactNode
  title?:    string
}

export function Toggle({ checked, onChange, label, title }: ToggleProps) {
  return (
    <label className={`dsh-toggle${checked ? ' is-on' : ''}${onChange ? '' : ' is-ro'}`} title={title}>
      <input type="checkbox" checked={checked} disabled={!onChange} onChange={(e) => onChange?.(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

// ────────────────────────────────────────────────────────
// Valores que o livro calcula (CA, PV máximo, iniciativa, deslocamento,
// proficiência, CD e ataque das magias, modificadores, salvaguardas, perícias,
// passivas, carga). Automático: mostra a conta. Manual (escolhido no botão
// Automatizar do alto da ficha): vira um campo para digitar o número, guardado
// em dnd_character_overrides. A ficha não tem mais selo nem botão de modo.
// ────────────────────────────────────────────────────────

interface DerivedFieldProps {
  ctx:       SheetCtx
  field:     DndDerivedField
  /** Valor que o motor devolveu (em modo manual, o próprio número manual). */
  value:     number
  label:     string
  /** Mostra o valor (ex.: pés em metros) e converte o que se digita de volta. */
  show?:     (n: number) => number
  unshow?:   (n: number) => number
  suffix?:   string
  signed?:   boolean
  min?:      number
  max?:      number
  step?:     number
  className?: string
  /** Faz a unidade (m, kg...) virar um botão que chama isto ao clicar. */
  onUnitClick?: () => void
  unitTitle?:   string
}

export function DerivedField({ ctx, field, value, label, show = (n) => n, unshow = (n) => n, suffix, signed, min = -99, max = 999, step = 1, className, onUnitClick, unitTitle }: DerivedFieldProps) {
  const { data, sheet, readOnly, report } = ctx
  const override = data.details.overrides.find((o) => o.field_key === field)
  const shown = show(value)
  const number = `${signed && shown >= 0 ? '+' : ''}${String(shown).replace('.', ',')}`
  const text = `${number}${onUnitClick ? '' : (suffix ?? '')}`
  const unit = suffix?.trim()
  const unitEl = unit ? (onUnitClick && !readOnly
    ? <button type="button" className="dsh-derived__suffix dsh-derived__unit" onClick={onUnitClick} title={unitTitle}>{unit}</button>
    : <span className="dsh-derived__suffix">{unit}</span>) : null

  async function saveManual(n: number) {
    if (readOnly) return
    const stored = unshow(n)
    if (override && Number(override.manual_value) === stored) return
    report(null)
    try {
      const saved = await saveDndOverride(sheet.id, field, String(stored), override?.reason ?? '')
      data.setDetails((d) => ({ ...d, overrides: [...d.overrides.filter((o) => o.field_key !== field), saved] }))
    } catch (err) {
      report(err instanceof Error ? err.message : 'Não foi possível salvar o valor manual.')
    }
  }

  return (
    <span className={`dsh-derived${className ? ` ${className}` : ''}`}>
      {override && !readOnly
        ? <><ManualBox value={shown} onCommit={saveManual} label={label} min={min} max={max} step={step} />{unitEl}</>
        : onUnitClick
          ? <><strong className="dsh-derived__value" aria-label={label}>{text}</strong>{unitEl}</>
          : <strong className="dsh-derived__value" aria-label={label}>{text}</strong>}
    </span>
  )
}

function ManualBox({ value, onCommit, label, min, max, step }: { value: number; onCommit: (n: number) => void; label: string; min: number; max: number; step: number }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])
  return (
    <span onBlur={() => onCommit(draft)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCommit(draft) } }}>
      <NumberField value={draft} onChange={setDraft} min={min} max={max} step={step} label={label} className="dsh-num--manual" />
    </span>
  )
}
