import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Aba secreta: Ctrl+Ç abre (e fecha) uma imagem cobrindo a tela toda.
 * Esc também fecha. Não aparece em menu nenhum.
 */
const SRC = '/assets/x/rocketin.webp'

function isCtrlCedilha(e: KeyboardEvent) {
  if (!e.ctrlKey || e.altKey || e.metaKey) return false
  // ABNT2: a tecla Ç tem code "Semicolon"; o key pode vir "ç" ou "Ç".
  return e.key.toLowerCase() === 'ç' || e.code === 'Semicolon'
}

export function SecretTab() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isCtrlCedilha(e)) {
        e.preventDefault()
        e.stopPropagation()
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  if (!open) return null

  return createPortal(
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        overflow: 'hidden',
        background: '#000',
      }}
    >
      {/* Fundo borrado preenche a tela; a imagem inteira fica por cima, sem cortar. */}
      <img
        src={SRC}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          inset: '-40px',
          width: 'calc(100% + 80px)',
          height: 'calc(100% + 80px)',
          objectFit: 'cover',
          filter: 'blur(28px) brightness(0.6)',
        }}
      />
      <img
        src={SRC}
        alt=""
        draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>,
    document.body,
  )
}
