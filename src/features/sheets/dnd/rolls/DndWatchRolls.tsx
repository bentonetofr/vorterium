import { useCallback, useEffect, useRef, useState } from 'react'
import type { DiceRoll } from '../../../../shared/types'
import { useAuth } from '../../../auth/AuthProvider'
import { useCurrentCampaign } from '../../../campaigns/CurrentCampaignContext'
import { useFeature } from '../../../control/siteFeatures'
import { subscribeToRolls } from '../../../dice/services/diceService'
import { getCampaignMembers } from '../../../members/services/memberService'
import { DND_FEATURE } from '../constants/dnd'
import { DndWatchFreePanel } from './DndWatchFreePanel'
import { DndWatchPanel } from './DndWatchPanel'
import { DndWatchTray } from './DndWatchTray'
import { isFreeRoll } from './freeRoll'
import { useRollBusy } from './rollActivity'
import { isCheckRoll } from './watchModel'

// ────────────────────────────────────────────────────────
// As rolagens dos outros jogadores, vistas por quem não rolou, nas campanhas
// de D&D. Testes (perícia, salvaguarda, ataque...) e a rolagem livre da janela
// de dados abrem o mesmo painel de quem rola, um de cada vez, com a etiqueta de quem rolou. Dano e os
// outros dados rolam na bandeja de baixo, todos ao mesmo tempo, com o
// resultado de cada um. Rolagem privada só chega a quem pode ver (RLS).
// ────────────────────────────────────────────────────────

const MAX_WAITING = 8

function WatchInner({ campaignId, userId }: { campaignId: string; userId: string }) {
  const [checks, setChecks] = useState<DiceRoll[]>([])
  const [drops, setDrops] = useState<DiceRoll[]>([])
  const names = useRef(new Map<string, string>())
  const busy = useRollBusy()

  useEffect(() => {
    let alive = true
    getCampaignMembers(campaignId)
      .then((ms) => { if (alive) names.current = new Map(ms.map((m) => [m.user_id, m.profile?.display_name ?? 'Alguém'])) })
      .catch(() => {})
    return () => { alive = false }
  }, [campaignId])

  useEffect(() => subscribeToRolls(campaignId, (row) => {
    if (row.user_id === userId) return
    const add = (list: DiceRoll[]) => (list.some((r) => r.id === row.id) ? list : [...list, row].slice(-MAX_WAITING))
    if (isCheckRoll(row) || isFreeRoll(row)) setChecks(add)
    else setDrops(add)
  }), [campaignId, userId])

  const playerOf = useCallback((r: DiceRoll) => names.current.get(r.user_id) ?? 'Alguém', [])
  const nameOf = useCallback((r: DiceRoll) => r.roll_context?.character || playerOf(r), [playerOf])
  const takeDrop = useCallback((id: string) => setDrops((l) => l.filter((r) => r.id !== id)), [])
  const nextCheck = useCallback(() => setChecks((l) => l.slice(1)), [])

  const current = !busy ? checks[0] : undefined
  return (
    <>
      {current && (isFreeRoll(current)
        ? <DndWatchFreePanel key={current.id} roll={current} player={playerOf(current)} hurry={checks.length > 1} onDone={nextCheck} />
        : <DndWatchPanel key={current.id} roll={current} player={playerOf(current)} hurry={checks.length > 1} onDone={nextCheck} />)}
      <DndWatchTray pending={drops} take={takeDrop} nameOf={nameOf} />
    </>
  )
}

/** Fica montado na área logada; só liga dentro de uma campanha de D&D com o recurso liberado. */
export function DndWatchRolls() {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const feature = useFeature(DND_FEATURE)
  if (!user || !campaign || campaign.system !== 'dnd5e' || !feature.visible || typeof document === 'undefined') return null
  return <WatchInner key={campaign.id} campaignId={campaign.id} userId={user.id} />
}
