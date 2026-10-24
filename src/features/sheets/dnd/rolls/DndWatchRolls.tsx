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
import { useRollBusy } from './rollActivity'
import { isCheckRoll } from './watchModel'

// ────────────────────────────────────────────────────────
// As rolagens dos outros jogadores, vistas por quem não rolou, nas campanhas
// de D&D. Testes (perícia, salvaguarda, ataque...) abrem o painel de teste; a
// rolagem livre, o dano, o dado de vida e os outros abrem o cartão de rolagem.
// Um de cada vez, com a etiqueta de quem rolou; nada cai solto pela tela.
// Rolagem privada só chega a quem pode ver (RLS).
// ────────────────────────────────────────────────────────

const MAX_WAITING = 8

function WatchInner({ campaignId, userId }: { campaignId: string; userId: string }) {
  const [checks, setChecks] = useState<DiceRoll[]>([])
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
    setChecks(add)
  }), [campaignId, userId])

  const playerOf = useCallback((r: DiceRoll) => names.current.get(r.user_id) ?? 'Alguém', [])
  const nextCheck = useCallback(() => setChecks((l) => l.slice(1)), [])

  const current = !busy ? checks[0] : undefined
  return (
    <>
      {current && (isCheckRoll(current)
        ? <DndWatchPanel key={current.id} roll={current} player={playerOf(current)} hurry={checks.length > 1} onDone={nextCheck} />
        : <DndWatchFreePanel key={current.id} roll={current} player={playerOf(current)} hurry={checks.length > 1} onDone={nextCheck} />)}
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
