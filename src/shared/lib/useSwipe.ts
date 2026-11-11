import { useEffect, useRef, type RefObject } from 'react'

// ────────────────────────────────────────────────────────
// Deslizar o dedo pro lado (celular e tablet) pra trocar de aba. Só conta
// um gesto rápido, bem mais horizontal que vertical, e que NÃO começou em
// cima de algo que já usa o arrasto: campo de texto, controle deslizante,
// canvas (Mesa, Quadro, dados), ou qualquer faixa que rola pro lado.
// ────────────────────────────────────────────────────────

const MIN_DISTANCE = 72
const MAX_DURATION_MS = 650
/** O arrasto tem que ser pelo menos isto vezes mais largo que alto. */
const HORIZONTAL_RATIO = 2.2

const BLOCKED = 'input, textarea, select, canvas, video, iframe, [contenteditable="true"], [draggable="true"], [data-no-swipe]'

/** O gesto começou em algo que tem o próprio arrasto? */
export function startsOnDraggable(target: EventTarget | null, container: HTMLElement): boolean {
  if (!(target instanceof Element)) return true
  if (target.closest(BLOCKED)) return true
  // faixa que rola na horizontal (tabela larga, fila de cartões…)
  for (let el: Element | null = target; el && el !== container; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 4) {
      const overflowX = getComputedStyle(el).overflowX
      if (overflowX === 'auto' || overflowX === 'scroll') return true
    }
  }
  return false
}

/** -1 = deslizou pra direita (aba anterior), 1 = pra esquerda (próxima), 0 = não foi um deslize. */
export function swipeDirection(dx: number, dy: number, durationMs: number): -1 | 0 | 1 {
  if (durationMs > MAX_DURATION_MS) return 0
  if (Math.abs(dx) < MIN_DISTANCE) return 0
  if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return 0
  return dx < 0 ? 1 : -1
}

/** Chama `onSwipe(1)` (próxima) ou `onSwipe(-1)` (anterior) quando a pessoa desliza o dedo dentro de `ref`. */
export function useSwipe(ref: RefObject<HTMLElement>, onSwipe: (direction: -1 | 1) => void, enabled = true): void {
  const handler = useRef(onSwipe)
  handler.current = onSwipe

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    let start: { x: number; y: number; at: number } | null = null

    function onStart(e: TouchEvent) {
      start = null
      if (e.touches.length !== 1 || startsOnDraggable(e.target, el!)) return
      // texto selecionado: a pessoa está arrastando a seleção, não a página
      if (window.getSelection()?.toString()) return
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, at: Date.now() }
    }
    function onEnd(e: TouchEvent) {
      if (!start) return
      const touch = e.changedTouches[0]
      const direction = swipeDirection(touch.clientX - start.x, touch.clientY - start.y, Date.now() - start.at)
      start = null
      if (direction !== 0) handler.current(direction)
    }
    const cancel = () => { start = null }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', cancel, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', cancel)
    }
  }, [ref, enabled])
}
