import { useEffect, useState, type RefObject } from 'react'
import type { DiceStage } from '../../../dice3d/DiceStage'
import type { ThrowStyle } from '../../../dice3d/simulate'

// ────────────────────────────────────────────────────────
// Liga o palco 3D a um elemento da tela. O motor (Three.js + física) só é
// baixado na primeira vez, num pedaço separado do site. Sem WebGL ou com
// "reduzir movimento", `simple` fica true e a tela mostra o modo simples.
// Com `enabled` falso o palco não existe (cada palco é um contexto WebGL, e o
// navegador só aguenta poucos): quem fica o tempo todo na tela só liga o
// palco enquanto há o que rolar.
// ────────────────────────────────────────────────────────

export function useDiceStage(host: RefObject<HTMLElement | null>, style: ThrowStyle, enabled = true): { stage: DiceStage | null; simple: boolean } {
  const [stage, setStage] = useState<DiceStage | null>(null)
  const [simple, setSimple] = useState(false)

  useEffect(() => {
    if (!enabled) { setStage(null); return }
    let alive = true
    let made: DiceStage | null = null
    void import('../../../dice3d/DiceStage').then((m) => {
      if (!alive || !host.current) return
      if (!m.diceStageSupported()) { setSimple(true); return }
      try { made = new m.DiceStage(host.current, style); setStage(made) } catch { setSimple(true) }
    }).catch(() => { if (alive) setSimple(true) })
    return () => { alive = false; made?.dispose() }
  }, [host, style, enabled])

  return { stage, simple }
}
