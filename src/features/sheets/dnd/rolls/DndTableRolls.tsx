import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DiceRoll } from '../../../../shared/types'
import { useAuth } from '../../../auth/AuthProvider'
import { useCurrentCampaign } from '../../../campaigns/CurrentCampaignContext'
import { useFeature } from '../../../control/siteFeatures'
import { subscribeToRolls } from '../../../dice/services/diceService'
import { getCampaignMembers } from '../../../members/services/memberService'
import { DND_FEATURE } from '../constants/dnd'
import { stageDiceFor } from './diceKinds'
import { useDiceStage } from './useDiceStage'
import './DndRolls.css'

// ────────────────────────────────────────────────────────
// Janelinha da mesa (campanhas de D&D): quando outra pessoa rola, os dados
// dela caem pequenos no canto, no conjunto dela, com o nome do personagem,
// o rótulo e o total (e sucesso ou falha, quando a CD era conhecida). Uma
// rolagem por vez, em fila. Rolagem privada só chega a quem pode ver (RLS).
// ────────────────────────────────────────────────────────

const HOLD_MS = 4200
const MAX_QUEUE = 5

function TableRollsInner({ campaignId, userId }: { campaignId: string; userId: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const { stage } = useDiceStage(hostRef, 'tray')
  const [queue, setQueue] = useState<DiceRoll[]>([])
  const [shown, setShown] = useState(false)
  const names = useRef(new Map<string, string>())
  const current = queue[0] ?? null

  useEffect(() => {
    let alive = true
    getCampaignMembers(campaignId)
      .then((ms) => { if (alive) names.current = new Map(ms.map((m) => [m.user_id, m.profile?.display_name ?? 'Alguém'])) })
      .catch(() => {})
    return () => { alive = false }
  }, [campaignId])

  useEffect(() => subscribeToRolls(campaignId, (row) => {
    if (row.user_id === userId) return
    setQueue((q) => (q.some((r) => r.id === row.id) ? q : [...q, row].slice(-MAX_QUEUE)))
  }), [campaignId, userId])

  const next = useCallback(() => { setShown(false); setQueue((q) => q.slice(1)) }, [])

  useEffect(() => {
    if (!current) return
    let alive = true
    const timers: number[] = []
    setShown(false)
    const dice = stageDiceFor(current.roll_breakdown ?? [], current.dice_skin ?? undefined)
    const play = stage && dice.length ? stage.roll(dice, { skin: current.dice_skin ?? undefined, sound: false }) : Promise.resolve()
    void play.then(() => {
      if (!alive) return
      setShown(true)
      timers.push(window.setTimeout(() => { if (alive) { stage?.clear(); next() } }, HOLD_MS))
    })
    return () => { alive = false; timers.forEach((t) => window.clearTimeout(t)) }
  }, [current, stage, next])

  const ctx = current?.roll_context
  const who = ctx?.character || (current ? names.current.get(current.user_id) : '') || 'Alguém'
  const outcome = ctx?.outcome

  return createPortal(
    <div className={`dsh-sheet dtable${current ? ' is-on' : ''}`} aria-live="polite">
      <div ref={hostRef} className="dtable__canvas" aria-hidden="true" />
      {current && (
        <button type="button" className={`dtable__card${shown ? ' is-shown' : ''}`} onClick={() => { stage?.clear(); next() }} title="Fechar">
          <span className="dtable__who">{who}{current.is_private && <span title="Rolagem privada"> 🔒</span>}</span>
          <span className="dtable__label">{current.roll_label ?? current.formula ?? current.die_type}</span>
          <span className="dtable__total">{shown ? current.result : '…'}</span>
          {shown && outcome && <span className={`dtable__outcome dtable__outcome--${outcome}`}>{outcome === 'success' ? 'Sucesso' : 'Falha'}</span>}
          {shown && ctx?.crit === 'crit' && <span className="dtable__crit">20 natural</span>}
          {shown && ctx?.crit === 'fumble' && <span className="dtable__crit dtable__crit--bad">1 natural</span>}
        </button>
      )}
    </div>,
    document.body,
  )
}

/** Fica montado na área logada; só liga dentro de uma campanha de D&D com o recurso liberado. */
export function DndTableRolls() {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const feature = useFeature(DND_FEATURE)
  if (!user || !campaign || campaign.system !== 'dnd5e' || !feature.visible || typeof document === 'undefined') return null
  return <TableRollsInner key={campaign.id} campaignId={campaign.id} userId={user.id} />
}
