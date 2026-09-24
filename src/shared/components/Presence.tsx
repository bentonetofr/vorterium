import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

// ────────────────────────────────────────────────────────
// Presença com animação de saída — mantém o conteúdo montado por mais
// alguns milissegundos depois de `show` virar false, com data-state=
// "closing", pra dar tempo da animação de fechar rodar (motion.css).
//
// Enquanto fecha, renderiza o ÚLTIMO conteúdo de quando estava aberto:
// quem usa pode fazer `<Presence show={!!file}>{() => <Editor file={file!} />}</Presence>`
// sem se preocupar com `file` já ter virado null.
// ────────────────────────────────────────────────────────

export type PresenceState = 'open' | 'closing'

const PresenceContext = createContext<PresenceState>('open')

/** Estado de presença do <Presence> mais próximo — 'open' fora de um. */
export function usePresenceState(): PresenceState {
  return useContext(PresenceContext)
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Montado enquanto `open` ou durante os `exitMs` da animação de saída. */
export function usePresence(open: boolean, exitMs = 200): { mounted: boolean; state: PresenceState } {
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) { setMounted(true); return }
    if (prefersReducedMotion()) { setMounted(false); return }
    const timer = window.setTimeout(() => setMounted(false), exitMs)
    return () => window.clearTimeout(timer)
  }, [open, exitMs])

  return { mounted: open || mounted, state: open ? 'open' : 'closing' }
}

type PresenceChildren = ReactNode | ((state: PresenceState) => ReactNode)

interface PresenceProps {
  show:     boolean
  /** Duração da animação de saída — igual à do CSS usado. */
  exitMs?:  number
  children: PresenceChildren
}

export function Presence({ show, exitMs = 200, children }: PresenceProps) {
  const { mounted, state } = usePresence(show, exitMs)
  const last = useRef<PresenceChildren>(children)
  if (show) last.current = children

  if (!mounted) return null
  const content = show ? children : last.current
  return (
    <PresenceContext.Provider value={state}>
      {typeof content === 'function' ? content(state) : content}
    </PresenceContext.Provider>
  )
}
