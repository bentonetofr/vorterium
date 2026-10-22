import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

// ────────────────────────────────────────────────────────
// Barra arrastável de PV, igual à do Altherium: uma linha branca marca o fim
// da barra e arrastar em qualquer ponto muda o valor. Os PV temporários entram
// na mesma barra, em azul, depois dos PV atuais, e a linha branca fica no fim
// de tudo (PV atuais + temporários). Ao diminuir a barra, os temporários
// descem primeiro e só depois os PV atuais; ao aumentar, os PV atuais sobem
// até o máximo. A escala é max(PV máximo, atuais + temporários) e fica
// congelada enquanto se arrasta, para a linha acompanhar o ponteiro.
// Teclado: ← e → andam 1; Home zera; End cura até o máximo.
// ────────────────────────────────────────────────────────

export interface HpState { hp: number; temp: number }

/**
 * O que acontece quando o fim da barra (PV atuais + temporários) vai para `target`.
 * Para baixo: gasta os temporários e depois os PV atuais. Para cima: cura os PV
 * atuais até o máximo (não cria PV temporários).
 */
export function moveHpBar(current: HpState, max: number, target: number): HpState {
  const total = current.hp + current.temp
  const goal = Math.max(0, Math.round(target))
  if (goal === total) return current
  if (goal < total) {
    const drop = total - goal
    const fromTemp = Math.min(current.temp, drop)
    return { temp: current.temp - fromTemp, hp: Math.max(0, current.hp - (drop - fromTemp)) }
  }
  return { temp: current.temp, hp: Math.min(Math.max(0, max), current.hp + (goal - total)) }
}

interface DndDragBarProps {
  value:      number
  max:        number
  /** PV temporários: aparecem em azul depois dos PV atuais. */
  temp?:      number
  onChange:   (next: HpState) => void
  disabled?:  boolean
  label:      string
}

export function DndDragBar({ value, max, temp = 0, onChange, disabled = false, label }: DndDragBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const lastEmitted = useRef<number | null>(null)
  const frozenScale = useRef(0)
  const [dragging, setDragging] = useState(false)

  const usable = !disabled && max > 0
  const tempPts = Math.max(0, temp)
  const total = value + tempPts
  const liveScale = Math.max(max, total)
  const scale = dragging ? frozenScale.current : liveScale
  const round = (n: number) => Math.round(n * 100) / 100
  const pct = scale > 0 ? round(Math.max(0, Math.min(100, (value / scale) * 100))) : 0
  const tempPct = scale > 0 ? round(Math.max(0, Math.min(100 - pct, (tempPts / scale) * 100))) : 0
  const endPct = round(Math.min(100, pct + tempPct))

  function targetAt(clientX: number): number {
    const rect = trackRef.current!.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * scale)
  }

  function emitTarget(target: number) {
    if (target === lastEmitted.current) return
    lastEmitted.current = target
    const next = moveHpBar({ hp: value, temp: tempPts }, max, target)
    if (next.hp !== value || next.temp !== tempPts) onChange(next)
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!usable || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    frozenScale.current = liveScale
    lastEmitted.current = total
    setDragging(true)
    emitTarget(targetAt(e.clientX))
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging) return
    emitTarget(targetAt(e.clientX))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!usable) return
    let target: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp')   target = total + 1
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') target = total - 1
    if (e.key === 'Home') target = 0
    if (e.key === 'End')  target = Math.max(total, max + tempPts)
    if (target === null) return
    e.preventDefault()
    const next = moveHpBar({ hp: value, temp: tempPts }, max, Math.max(0, target))
    if (next.hp !== value || next.temp !== tempPts) onChange(next)
  }

  return (
    <div
      className={`dsh-drag${dragging ? ' dsh-drag--dragging' : ''}${usable ? '' : ' dsh-drag--static'}`}
      role="slider" aria-label={label}
      aria-valuemin={0} aria-valuemax={liveScale} aria-valuenow={total}
      aria-valuetext={tempPts > 0 ? `${value} de ${max}, mais ${tempPts} temporários` : `${value} de ${max}`} aria-disabled={!usable}
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
      {max > 0 && <span className="dsh-drag__handle" style={{ left: `${endPct}%` }} aria-hidden="true" />}
    </div>
  )
}
