import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Aba secreta: rota própria (SECRET_PATH), sem link em lugar nenhum.
 * Ctrl+Ç em qualquer página abre; Ctrl+Ç de novo, Esc ou clique voltam.
 */
export const SECRET_PATH = '/rocketin'

const SRC = '/assets/x/rocketin.webp'

function isCtrlCedilha(e: KeyboardEvent) {
  if (!e.ctrlKey || e.altKey || e.metaKey) return false
  // ABNT2: a tecla Ç tem code "Semicolon"; o key pode vir "ç" ou "Ç".
  return e.key.toLowerCase() === 'ç' || e.code === 'Semicolon'
}

/** Sai da aba: volta pra página anterior, ou pro início se abriu direto pelo link. */
function useLeave() {
  const navigate = useNavigate()
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/', { replace: true })
  }
}

/** Fica dentro do BrowserRouter e escuta o atalho no site todo. */
export function SecretShortcut() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const leave = useLeave()
  const onSecret = pathname === SECRET_PATH

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isCtrlCedilha(e)) {
        e.preventDefault()
        e.stopPropagation()
        if (onSecret) leave()
        else navigate(SECRET_PATH)
      } else if (e.key === 'Escape' && onSecret) {
        leave()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  return null
}

export function SecretPage() {
  const leave = useLeave()

  useEffect(() => {
    const prev = document.title
    document.title = 'Rocketin?'
    return () => { document.title = prev }
  }, [])

  return (
    <div
      onClick={leave}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483647, overflow: 'hidden', background: '#000' }}
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
    </div>
  )
}
