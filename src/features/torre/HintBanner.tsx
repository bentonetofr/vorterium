import { useEffect, useState } from 'react'

// ────────────────────────────────────────────────────────
// A dica que o mestre manda (painel do mestre): uma faixa de pergaminho
// que vale 25 s, pela hora do banco.
// ────────────────────────────────────────────────────────

/** No alto da tela ou, com uma janela aberta, dentro dela (inline). */
export function HintBanner({ hint, offset, inline }: { hint: { t: number; text: string } | null; offset: number; inline?: boolean }) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!hint) return
    const left = hint.t + 25000 - (Date.now() + offset)
    if (left <= 0) return
    const t = window.setTimeout(() => tick((n) => n + 1), left + 50)
    return () => window.clearTimeout(t)
  }, [hint, offset])
  if (!hint || Date.now() + offset - hint.t >= 25000) return null
  return (
    <div className={`tor-hint${inline ? ' tor-hint--inline' : ''}`} role="status">
      <span className="tor-hint__kicker">Um sussurro na torre</span>
      <span className="tor-hint__text">{hint.text}</span>
    </div>
  )
}
