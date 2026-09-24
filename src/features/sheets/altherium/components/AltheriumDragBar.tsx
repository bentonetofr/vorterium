import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

// ────────────────────────────────────────────────────────
// Barra de recurso arrastável (PV, PE, FV, PR, Cartas). Uma linha branca
// marca o valor atual; arrastar em qualquer ponto da barra muda o valor.
// A posição do ponteiro vira o valor direto (0 no começo, máximo no fim),
// então a linha acompanha o dedo/mouse — cada ponto vale largura ÷ máximo,
// sem aceleração. Teclado: ←/→ ±1, Home/End.
// ────────────────────────────────────────────────────────

interface AltheriumDragBarProps {
  value:          number
  max:            number | null
  onChange:       (value: number) => void
  disabled:       boolean
  label:          string
  /** Classes da trilha e do preenchimento — cada barra mantém seu visual. */
  trackClassName: string
  fillClassName:  string
}

export function AltheriumDragBar({
  value, max, onChange, disabled, label, trackClassName, fillClassName,
}: AltheriumDragBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const lastEmitted = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)

  const usable = !disabled && max != null && max > 0
  const pct = max && max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0

  function valueAt(clientX: number): number {
    const rect = trackRef.current!.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * (max ?? 0))
  }

  function emit(next: number) {
    if (next === lastEmitted.current) return
    lastEmitted.current = next
    onChange(next)
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!usable || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    lastEmitted.current = value
    setDragging(true)
    emit(valueAt(e.clientX))
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging) return
    emit(valueAt(e.clientX))
  }

  function handlePointerEnd() {
    setDragging(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!usable || max == null) return
    let next: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp')   next = Math.min(max, value + 1)
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') next = Math.max(0, Math.min(max, value) - 1)
    if (e.key === 'Home') next = 0
    if (e.key === 'End')  next = max
    if (next === null) return
    e.preventDefault()
    onChange(next)
  }

  return (
    <div
      className={`alth-drag-bar${dragging ? ' alth-drag-bar--dragging' : ''}${usable ? '' : ' alth-drag-bar--static'}`}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max ?? 0}
      aria-valuenow={value}
      aria-disabled={!usable}
      tabIndex={usable ? 0 : -1}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
    >
      <div ref={trackRef} className={trackClassName}>
        <div className={fillClassName} style={{ width: `${pct}%` }} />
      </div>
      {max != null && max > 0 && (
        <span className="alth-drag-bar__handle" style={{ left: `${pct}%` }} aria-hidden="true" />
      )}
    </div>
  )
}
