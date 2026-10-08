import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

// ────────────────────────────────────────────────────────
// Janelas flutuantes do canto (chat, dados, notificações) — só uma aberta
// por vez, sempre no mesmo lugar. Quando uma abre, a que estava aberta
// fecha NA HORA (sem animação de saída, pra não ficar uma por cima da
// outra). A janela aberta fica num pequeno estado global, pros avisos
// (rolagem, notificação, transmissão) saberem que devem aparecer por cima
// dela em vez de atrás.
// ────────────────────────────────────────────────────────

const EVENT = 'vorterium:floating-open'

export type FloatingPanelId = 'chat' | 'dice' | 'bell' | 'notes' | 'control' | 'docs'

let openPanel: FloatingPanelId | null = null
const listeners = new Set<() => void>()

function setOpenPanel(id: FloatingPanelId | null) {
  if (openPanel === id) return
  openPanel = id
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Qual janela do canto está aberta agora (ou null). */
export function useOpenFloatingPanel(): FloatingPanelId | null {
  return useSyncExternalStore(subscribe, () => openPanel)
}

/**
 * Liga uma janela do canto ao revezamento. Devolve `instant`: true quando
 * ela foi fechada porque outra abriu — quem usa pula a animação de saída.
 */
export function useFloatingPanel(id: FloatingPanelId, isOpen: boolean, close: () => void): { instant: boolean } {
  const [instant, setInstant] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setInstant(false)
      window.dispatchEvent(new CustomEvent<FloatingPanelId>(EVENT, { detail: id }))
      setOpenPanel(id)
    } else if (openPanel === id) {
      setOpenPanel(null)
    }
  }, [id, isOpen])

  useEffect(() => () => { if (openPanel === id) setOpenPanel(null) }, [id])

  const onOtherOpen = useCallback((e: Event) => {
    if ((e as CustomEvent<FloatingPanelId>).detail === id) return
    setInstant(true)
    close()
  }, [id, close])

  useEffect(() => {
    window.addEventListener(EVENT, onOtherOpen)
    return () => window.removeEventListener(EVENT, onOtherOpen)
  }, [onOtherOpen])

  return { instant }
}
