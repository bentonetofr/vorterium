import { useEffect } from 'react'
import './ClickEffects.css'

// ────────────────────────────────────────────────────────
// Efeito do clique do mouse no site todo:
//  • enquanto o botão está apertado, <html> ganha a classe cursor-pressed
//    (o ponteiro encolhe e inclina — ver index.css);
//  • no ponto do clique, um anel dourado se abre e umas faíscas saem.
// É DOM puro numa camada por cima de tudo (sem estado do React, sem
// pegar clique). Toque e caneta ficam de fora; com "reduzir movimento"
// no sistema, sai só o anel.
// ────────────────────────────────────────────────────────

const SPARKS = 6
const MAX_ALIVE = 12
const LIFETIME_MS = 650

export function ClickEffects() {
  useEffect(() => {
    const layer = document.createElement('div')
    layer.className = 'click-fx-layer'
    layer.setAttribute('aria-hidden', 'true')
    document.body.append(layer)

    const root = document.documentElement
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    function burst(x: number, y: number) {
      const fx = document.createElement('span')
      fx.className = 'click-fx'
      fx.style.left = `${x}px`
      fx.style.top = `${y}px`

      const ring = document.createElement('span')
      ring.className = 'click-fx__ring'
      fx.append(ring)

      if (!reduceMotion.matches) {
        const turn = Math.random() * 60
        for (let i = 0; i < SPARKS; i++) {
          const spark = document.createElement('span')
          spark.className = `click-fx__spark${i % 2 ? ' click-fx__spark--white' : ''}`
          spark.style.setProperty('--angle', `${turn + (360 / SPARKS) * i + (Math.random() * 16 - 8)}deg`)
          spark.style.setProperty('--dist', `${12 + Math.random() * 9}px`)
          fx.append(spark)
        }
      }

      layer.append(fx)
      window.setTimeout(() => fx.remove(), LIFETIME_MS)
      while (layer.childElementCount > MAX_ALIVE) layer.firstElementChild?.remove()
    }

    function onDown(e: PointerEvent) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      root.classList.add('cursor-pressed')
      burst(e.clientX, e.clientY)
    }
    function onUp() {
      root.classList.remove('cursor-pressed')
    }

    // Fase de captura: nem um stopPropagation de outro componente impede.
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onUp, true)
    window.addEventListener('blur', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onUp, true)
      window.removeEventListener('blur', onUp)
      root.classList.remove('cursor-pressed')
      layer.remove()
    }
  }, [])

  return null
}
