import { useEffect, useRef, useState } from 'react'

// ────────────────────────────────────────────────────────
// Número que "conta" até o valor novo (easeOutCubic) em vez de pular.
// Na primeira vez conta a partir de 0; depois, do valor anterior.
// ────────────────────────────────────────────────────────

const DURATION_MS = 700

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0))
  const from = useRef(shown)

  useEffect(() => {
    const start = from.current
    if (start === value || reducedMotion()) { from.current = value; setShown(value); return }

    const began = performance.now()
    let frame = 0
    function tick(now: number) {
      const t = Math.min(1, (now - began) / DURATION_MS)
      const eased = 1 - (1 - t) ** 3
      const current = Math.round(start + (value - start) * eased)
      from.current = current
      setShown(current)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <>{shown}</>
}
