import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './ModalOverlay.css'

// ────────────────────────────────────────────────────────
// Fundo de janela modal — vai por portal pro <body> (fora de qualquer
// <form> da página), centraliza o conteúdo e embaça o site atrás. Esc ou
// clique fora chamam onClose, exceto com closeDisabled (ex.: salvando);
// a página atrás não rola enquanto está aberto. A própria janela (visual,
// role="dialog", título) fica a cargo de quem usa.
// ────────────────────────────────────────────────────────

interface ModalOverlayProps {
  onClose:        () => void
  closeDisabled?: boolean
  children:       ReactNode
}

export function ModalOverlay({ onClose, closeDisabled = false, children }: ModalOverlayProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !closeDisabled) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeDisabled, onClose])

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !closeDisabled) onClose() }}
    >
      {children}
    </div>,
    document.body,
  )
}
