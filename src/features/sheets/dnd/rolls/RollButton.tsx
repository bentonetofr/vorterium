import type { MouseEvent, ReactNode } from 'react'
import { useDndRoll } from './DndRollProvider'

// ────────────────────────────────────────────────────────
// Botãozinho de rolar (ícone de d20) ao lado de perícias, salvaguardas,
// iniciativa, ataques... Some quando a pessoa não pode rolar por esta ficha.
// ────────────────────────────────────────────────────────

export function D20Icon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 21 7v10l-9 5-9-5V7z" />
      <path d="M12 2 7.5 9.5h9zM7.5 9.5 3 7M16.5 9.5 21 7M7.5 9.5 12 17l4.5-7.5M12 17v5M12 17l-9 0M12 17l9 0" opacity="0.7" />
    </svg>
  )
}

export function RollButton({ label, onClick, children, className = '', disabled }: { label: string; onClick: () => void; children?: ReactNode; className?: string; disabled?: boolean }) {
  const { canRoll } = useDndRoll()
  if (!canRoll) return null
  const click = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); onClick() }
  return (
    <button type="button" className={`dsh-rollbtn${children ? ' dsh-rollbtn--text' : ''} ${className}`} onClick={click} title={label} aria-label={label} disabled={disabled}>
      <D20Icon />
      {children && <span>{children}</span>}
    </button>
  )
}
