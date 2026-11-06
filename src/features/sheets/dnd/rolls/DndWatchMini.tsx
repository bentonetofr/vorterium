import { useEffect, useRef, useState } from 'react'
import type { DiceRoll } from '../../../../shared/types'
import { miniRoll } from './miniRoll'
import './DndWatchMini.css'

// ────────────────────────────────────────────────────────
// "Dados dos outros simplificados" (Configurações > Aparência > Dados na
// tela): no lugar do painel grande no meio da tela, a rolagem de outro
// jogador ou do mestre aparece numa janelinha no canto inferior direito, com
// quem rolou, o quê, o total e a conta numa linha. Não cobre a ficha de quem
// está jogando; some sozinha (parada com o mouse em cima).
// ────────────────────────────────────────────────────────

const HOLD_MS = 5200
const HOLD_FAST_MS = 2600
const MAX_SHOWN = 3

interface Props {
  rolls:    DiceRoll[]
  playerOf: (roll: DiceRoll) => string
  onDone:   (id: string) => void
}

export function DndWatchMini({ rolls, playerOf, onDone }: Props) {
  const shown = rolls.slice(-MAX_SHOWN)
  return (
    <div className="dmini" role="log" aria-live="polite" aria-label="Rolagens dos outros">
      {shown.map((r) => <MiniCard key={r.id} roll={r} player={playerOf(r)} hurry={rolls.length > MAX_SHOWN} onDone={onDone} />)}
    </div>
  )
}

function MiniCard({ roll, player, hurry, onDone }: { roll: DiceRoll; player: string; hurry: boolean; onDone: (id: string) => void }) {
  const m = miniRoll(roll, player)
  const [paused, setPaused] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    if (paused) return
    const hold = hurry ? HOLD_FAST_MS : HOLD_MS
    const t1 = window.setTimeout(() => setLeaving(true), hold)
    const t2 = window.setTimeout(() => done.current(roll.id), hold + 260)
    return () => { window.clearTimeout(t1); window.clearTimeout(t2) }
  }, [paused, hurry, roll.id])

  const tone = m.crit === 'crit' ? ' dmini__card--crit' : m.crit === 'fumble' ? ' dmini__card--fumble' : ''
  return (
    <div className={`dmini__card${tone}${leaving ? ' is-leaving' : ''}`}
      onMouseEnter={() => { setPaused(true); setLeaving(false) }} onMouseLeave={() => setPaused(false)}>
      <button type="button" className="dmini__close" onClick={() => done.current(roll.id)} aria-label="Fechar">×</button>
      <div className="dmini__who"><span aria-hidden="true">◉</span> {m.who}{m.isPrivate && <span title="Rolagem privada"> · privada</span>}</div>
      <div className="dmini__title">{m.title}</div>
      <div className="dmini__line">
        <span className="dmini__total">{m.total}</span>
        <span className="dmini__detail">{m.detail}</span>
      </div>
      {(m.outcome || m.crit) && (
        <div className="dmini__tags">
          {m.crit === 'crit' && <span className="dmini__tag dmini__tag--crit">Crítico</span>}
          {m.crit === 'fumble' && <span className="dmini__tag dmini__tag--bad">Falha crítica</span>}
          {m.outcome === 'success' && <span className="dmini__tag dmini__tag--ok">Sucesso</span>}
          {m.outcome === 'failure' && <span className="dmini__tag dmini__tag--bad">Falha</span>}
        </div>
      )}
    </div>
  )
}
