import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

// ────────────────────────────────────────────────────────
// Barra arrastável de PV, igual à do Altherium: uma linha branca marca o valor
// atual e arrastar em qualquer ponto da barra muda o valor. A posição do
// ponteiro vira o valor direto (0 no começo, máximo no fim), então a linha
// acompanha o dedo ou o mouse. Teclado: ← e → andam 1; Home e End vão às pontas.
// Os PV temporários entram na mesma barra, em azul, logo depois dos PV atuais; se
// passarem do máximo, a barra cresce para caber (a escala é max(PV máximo, atuais + temporários)).
// ────────────────────────────────────────────────────────

interface DndDragBarProps {
  value:      number
  max:        number
  /** PV temporários: aparecem em azul depois dos PV atuais. */
  temp?:      number
  onChange:   (value: number) => void
  disabled?:  boolean
  label:      string
}

export function DndDragBar({ value, max, temp = 0, onChange, disabled = false, label }: DndDragBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const lastEmitted = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)

  const usable = !disabled && max > 0
  const tempPts = Math.max(0, temp)
  const scale = Math.max(max, value + tempPts)
  const pct = scale > 0 ? Math.max(0, Math.min(100, (value / scale) * 100)) : 0
  const tempPct = scale > 0 ? Math.max(0, Math.min(100 - pct, (tempPts / scale) * 100)) : 0

  function valueAt(clientX: number): number {
    const rect = trackRef.current!.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.max(0, Math.min(max, Math.round(ratio * scale)))
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

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!usable) return
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
      className={`dsh-drag${dragging ? ' dsh-drag--dragging' : ''}${usable ? '' : ' dsh-drag--static'}`}
      role="slider" aria-label={label}
      aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={tempPts > 0 ? `${value} de ${max}, mais ${tempPts} temporários` : undefined} aria-disabled={!usable}
      tabIndex={usable ? 0 : -1}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={handleKeyDown}
    >
      <div ref={trackRef} className="dsh-hp__track">
        <div className="dsh-hp__fill" style={{ width: `${pct}%` }} />
        {tempPct > 0 && <div className="dsh-hp__temp" style={{ width: `${tempPct}%` }} title={`${tempPts} PV temporários`} />}
      </div>
      {max > 0 && <span className="dsh-drag__handle" style={{ left: `${pct}%` }} aria-hidden="true" />}
    </div>
  )
}
