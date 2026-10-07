import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ASCEND_EVENT, refreshSheets, setAscending } from './mestreService'

// ────────────────────────────────────────────────────────
// A ascensão: um livro de couro fecha por cima do site inteiro (as duas
// capas batem no meio), tudo fica escuro por 4 segundos, e o site vai se
// montando de novo já com o tema do Mestre (tudo preto e dourado).
// Roda pra todos os jogadores da campanha juntos (o evento chega pelo
// tempo real) — ou só pro dono do site, no teste.
// ────────────────────────────────────────────────────────

const CLOSE_MS    = 1600
const DARK_MS     = 4000
const ASSEMBLE_MS = 2200

type Phase = 'close' | 'dark' | 'assemble'

export function MestreAscension() {
  const [phase, setPhase] = useState<Phase | null>(null)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [] }
    const start = () => {
      if (timers.current.length) return // já rodando
      const root = document.documentElement
      setAscending(true)
      setPhase('close')
      timers.current.push(
        window.setTimeout(() => setPhase('dark'), CLOSE_MS),
        window.setTimeout(() => {
          // Fim do escuro: o tema liga por baixo e o site se monta.
          setAscending(false)
          refreshSheets()
          root.classList.add('mestre-assemble')
          setPhase('assemble')
        }, CLOSE_MS + DARK_MS),
        window.setTimeout(() => {
          root.classList.remove('mestre-assemble')
          setPhase(null)
          clear()
        }, CLOSE_MS + DARK_MS + ASSEMBLE_MS),
      )
    }
    window.addEventListener(ASCEND_EVENT, start)
    return () => {
      window.removeEventListener(ASCEND_EVENT, start)
      clear()
      document.documentElement.classList.remove('mestre-assemble')
    }
  }, [])

  if (!phase) return null
  return createPortal(
    <div className={`mestre-asc mestre-asc--${phase}`} role="presentation" aria-hidden="true">
      <div className="mestre-asc__book">
        <div className="mestre-asc__cover mestre-asc__cover--left">
          <span className="mestre-asc__frame" />
          <span className="mestre-asc__clasp" />
        </div>
        <div className="mestre-asc__cover mestre-asc__cover--right">
          <span className="mestre-asc__frame" />
          <span className="mestre-asc__sigil">✦</span>
        </div>
        <span className="mestre-asc__seam" />
      </div>
      <div className="mestre-asc__dark" />
    </div>,
    document.body,
  )
}
