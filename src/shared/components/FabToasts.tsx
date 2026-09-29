import { useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { useOpenFloatingPanel } from '../lib/floatingPanels'

// ────────────────────────────────────────────────────────
// Avisos do canto (resultado da rolagem, notificação ao vivo, transmissão
// da Mesa). Com as janelas fechadas, ficam no lugar de sempre, empilhados
// acima do sino. Com uma janela aberta (chat, dados ou notificações),
// ficam ACIMA dela, encostados na borda de cima, sem cobrir nada — e a
// janela encolhe por cima (--fab-toasts-space) enquanto houver aviso,
// pra sobrar lugar na tela.
// ────────────────────────────────────────────────────────

const GAP = 12

let slotEl: HTMLDivElement | null = null
const listeners = new Set<() => void>()

function setSlot(el: HTMLDivElement | null) {
  slotEl = el
  listeners.forEach((l) => l())
}

/** Onde colocar um aviso quando uma janela do canto está aberta (null se não há janela aberta). */
export function useFabToastSlot(): HTMLDivElement | null {
  const open = useOpenFloatingPanel()
  const el = useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l) } },
    () => slotEl,
  )
  return open ? el : null
}

export function FabToasts({ children }: { children: ReactNode }) {
  const open = useOpenFloatingPanel()
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties | undefined>()

  useLayoutEffect(() => {
    setSlot(ref.current)
    return () => setSlot(null)
  }, [])

  useLayoutEffect(() => {
    const slot = ref.current
    const wrapper = slot?.parentElement
    if (!open || !slot || !wrapper) {
      setStyle(undefined)
      wrapper?.style.removeProperty('--fab-toasts-space')
      return
    }
    const panel = document.querySelector<HTMLElement>(`[data-fab-panel="${open}"]`)
    if (!panel) return

    // Espaço que a janela abre em cima pros avisos (0 se não há aviso).
    const reserve = () => {
      const h = slot.offsetHeight
      wrapper.style.setProperty('--fab-toasts-space', h > 0 ? `${h + GAP}px` : '0px')
      place()
    }
    // Pilha colada na borda de cima da janela. offsetTop/offsetLeft ignoram
    // o "pop" de entrada; no celular a janela é fixa (offsetParent null).
    const place = () => {
      const base = (panel.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? { top: 0, left: 0 }
      const top = base.top + panel.offsetTop
      setStyle({
        position: 'fixed',
        bottom: Math.round(window.innerHeight - top + GAP),
        left:   Math.round(base.left + panel.offsetLeft),
        width:  panel.offsetWidth,
      })
    }
    reserve()
    const panelObserver = new ResizeObserver(place)
    panelObserver.observe(panel)
    const slotObserver = new ResizeObserver(reserve)
    slotObserver.observe(slot)
    window.addEventListener('resize', place)
    panel.addEventListener('transitionend', place)
    return () => {
      panel.removeEventListener('transitionend', place)
      panelObserver.disconnect()
      slotObserver.disconnect()
      window.removeEventListener('resize', place)
      wrapper.style.removeProperty('--fab-toasts-space')
    }
  }, [open])

  return (
    <div ref={ref} className={`fab-toasts${open ? ' fab-toasts--over' : ''}`} style={style}>
      {children}
    </div>
  )
}
