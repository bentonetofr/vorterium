import { useEffect, useState } from 'react'

// ────────────────────────────────────────────────────────
// "A pessoa está descendo a página?" — verdadeiro depois de rolar um
// tanto pra baixo, falso assim que sobe um pouco ou volta pro topo. Usado
// pra recolher o botão de ferramentas do celular enquanto se lê, e trazer
// de volta quando a pessoa sobe.
// ────────────────────────────────────────────────────────

const DOWN_THRESHOLD = 28
const UP_THRESHOLD = 12
const TOP_ZONE = 80

export function useScrollingDown(enabled = true): boolean {
  const [down, setDown] = useState(false)

  useEffect(() => {
    if (!enabled) { setDown(false); return }
    let anchor = window.scrollY
    let frame = 0

    function check() {
      frame = 0
      const y = window.scrollY
      if (y < TOP_ZONE) { anchor = y; setDown(false); return }
      if (y - anchor > DOWN_THRESHOLD) { anchor = y; setDown(true) }
      else if (anchor - y > UP_THRESHOLD) { anchor = y; setDown(false) }
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(check)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [enabled])

  return down
}
