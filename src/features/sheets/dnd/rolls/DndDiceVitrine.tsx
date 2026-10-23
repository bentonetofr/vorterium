import { useEffect, useRef, useState } from 'react'
import { DICE_SKINS } from '../../../dice3d/skins'
import type { DiceShowcase } from '../../../dice3d/DiceShowcase'

// ────────────────────────────────────────────────────────
// Aba "Dados" da janela de dados: a vitrine. Um d20 de cada conjunto gira
// devagar sobre o seu pedestal, com o nome embaixo; clicar escolhe o
// conjunto (vale para todas as suas rolagens, em qualquer aparelho). Sem
// WebGL (ou com "reduzir movimento"), cada conjunto aparece como uma amostra
// de cor.
// ────────────────────────────────────────────────────────

interface Props { skin: string; error: string | null; onPick: (id: string) => void }

export function DndDiceVitrine({ skin, error, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const pedestals = useRef(new Map<string, HTMLElement>())
  const showcase = useRef<DiceShowcase | null>(null)
  const [simple, setSimple] = useState(false)

  useEffect(() => {
    let alive = true
    let made: DiceShowcase | null = null
    void Promise.all([import('../../../dice3d/DiceStage'), import('../../../dice3d/DiceShowcase')]).then(([stageMod, showMod]) => {
      if (!alive || !hostRef.current) return
      if (!stageMod.diceStageSupported()) { setSimple(true); return }
      try {
        made = new showMod.DiceShowcase(hostRef.current)
        showcase.current = made
        const items = DICE_SKINS.flatMap((s) => { const el = pedestals.current.get(s.id); return el ? [{ id: s.id, el }] : [] })
        void made.show(items)
      } catch { setSimple(true) }
    }).catch(() => { if (alive) setSimple(true) })
    return () => { alive = false; showcase.current = null; made?.dispose() }
  }, [])

  const hover = (id: string | null) => showcase.current?.setHover(id)

  return (
    <div className="ddw-vitrine" ref={hostRef}>
      <p className="ddw-vitrine__intro">Escolha o conjunto de dados. É com ele que os seus dados rolam na mesa, e é assim que os outros jogadores os veem.</p>
      <ul className="ddw-skins">
        {DICE_SKINS.map((s) => {
          const on = skin === s.id
          return (
            <li key={s.id}>
              <button type="button" className={`ddw-skin${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => onPick(s.id)}
                onMouseEnter={() => hover(s.id)} onMouseLeave={() => hover(null)} onFocus={() => hover(s.id)} onBlur={() => hover(null)}
                style={{ ['--skin-glow' as string]: s.glowPower > 0 ? s.glow : s.trim }}>
                <span className="ddw-skin__pedestal" ref={(el) => { if (el) pedestals.current.set(s.id, el); else pedestals.current.delete(s.id) }}>
                  {simple && (
                    <span className="ddw-skin__swatch" style={{ background: `radial-gradient(circle at 35% 30%, ${s.body}, ${s.bodyEdge} 75%)`, borderColor: s.trim, color: s.ink }}>20</span>
                  )}
                </span>
                <strong className="ddw-skin__name">{s.name}</strong>
                <span className="ddw-skin__state">{on ? 'Em uso' : 'Usar estes dados'}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {error && <p className="ddw-error" role="alert">{error}</p>}
    </div>
  )
}
