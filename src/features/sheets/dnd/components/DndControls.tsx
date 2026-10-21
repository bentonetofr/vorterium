import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { DndDerivedField } from '../../../../shared/types'
import { removeDndOverride, saveDndOverride } from '../services/dndSheetService'
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

  return (
    <input
      type="text" inputMode={step < 1 || min < 0 ? 'decimal' : 'numeric'} autoComplete="off"
      className={`dsh-num ${className}`} value={text} disabled={disabled} placeholder={placeholder}
      aria-label={label}
      onChange={(e) => commit(e.target.value)}
      onBlur={() => setText(String(value))}
      onFocus={(e) => e.target.select()}
    />
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
// AUTO / MANUAL: os valores que o livro calcula (CA, PV máximo, iniciativa,
// deslocamento, proficiência, CD e ataque das magias). Em AUTO vale a conta;
// em MANUAL vale o número que a pessoa escreveu (guardado em
// dnd_character_overrides). O clique no selo troca de modo.
// ────────────────────────────────────────────────────────

interface DerivedFieldProps {
  ctx:       SheetCtx
  field:     DndDerivedField
  /** Valor que o motor devolveu (em MANUAL, o próprio número manual). */
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
}

export function DerivedField({ ctx, field, value, label, show = (n) => n, unshow = (n) => n, suffix, signed, min = -99, max = 999, step = 1 }: DerivedFieldProps) {
  const { data, sheet, readOnly, report } = ctx
  const override = data.details.overrides.find((o) => o.field_key === field)
  const manual = !!override
  const [busy, setBusy] = useState(false)
  const shown = show(value)
  const text = `${signed && shown >= 0 ? '+' : ''}${String(shown).replace('.', ',')}${suffix ?? ''}`

  async function toggleMode() {
    if (readOnly || busy) return
    setBusy(true)
    report(null)
    try {
      if (manual) {
        await removeDndOverride(sheet.id, field)
        data.setDetails((d) => ({ ...d, overrides: d.overrides.filter((o) => o.field_key !== field) }))
      } else {
        const saved = await saveDndOverride(sheet.id, field, String(value))
        data.setDetails((d) => ({ ...d, overrides: [...d.overrides.filter((o) => o.field_key !== field), saved] }))
      }
    } catch (err) {
      report(err instanceof Error ? err.message : 'Não foi possível trocar o modo.')
    } finally { setBusy(false) }
  }

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
    <span className="dsh-derived">
      {manual && !readOnly
        ? <ManualBox value={shown} onCommit={saveManual} label={label} min={min} max={max} step={step} />
        : <strong className="dsh-derived__value" aria-label={label}>{text}</strong>}
      <button
        type="button" disabled={readOnly || busy}
        className={`dsh-mode${manual ? ' dsh-mode--manual' : ''}`} onClick={() => void toggleMode()}
        title={manual ? 'Valor manual. Clique pra voltar ao cálculo do livro.' : 'Calculado pelas regras do livro. Clique pra digitar à mão.'}
      >
        {manual ? 'MANUAL' : 'AUTO'}
      </button>
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
