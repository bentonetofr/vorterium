import type { ReactNode } from 'react'
import { Presence } from './Presence'

// ────────────────────────────────────────────────────────
// Bloco que abre/fecha "deslizando" a altura (grid-template-rows 0fr ⇄ 1fr,
// em motion.css) — sem medir nada em JS. Desmonta depois de fechado.
// ────────────────────────────────────────────────────────

const COLLAPSE_EXIT_MS = 260

interface CollapseProps {
  open:       boolean
  className?: string
  children:   ReactNode | (() => ReactNode)
}

export function Collapse({ open, className, children }: CollapseProps) {
  return (
    <Presence show={open} exitMs={COLLAPSE_EXIT_MS}>
      {(state) => (
        <div className="anim-collapse" data-state={state}>
          <div className={`anim-collapse__inner${className ? ` ${className}` : ''}`}>
            {typeof children === 'function' ? children() : children}
          </div>
        </div>
      )}
    </Presence>
  )
}
