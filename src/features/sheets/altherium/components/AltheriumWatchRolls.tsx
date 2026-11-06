import { useCallback, useEffect, useRef, useState } from 'react'
import type { DiceRoll } from '../../../../shared/types'
import { useAuth } from '../../../auth/AuthProvider'
import { useCurrentCampaign } from '../../../campaigns/CurrentCampaignContext'
import { subscribeToRolls } from '../../../dice/services/diceService'
import { getCampaignMembers } from '../../../members/services/memberService'
import { useSettings } from '../../../settings/settingsStore'
import { useRollBusy } from '../../dnd/rolls/rollActivity'
import { DndWatchMini } from '../../dnd/rolls/DndWatchMini'
import { AltheriumWatchPanel } from './AltheriumWatchPanel'

// ────────────────────────────────────────────────────────
// As rolagens dos outros jogadores e do mestre, vistas por quem não rolou, nas
// campanhas de Altherium. Em Configurações > Aparência > Dados na tela:
//  - Normal: um painel com os dados 3D rolando (um de cada vez, com o nome de
//    quem rolou), que espera a própria pessoa terminar a rolagem dela;
//  - Dados dos outros simplificados: só uma janelinha no canto inferior direito.
// Rolagem privada só chega a quem pode ver (RLS).
// ────────────────────────────────────────────────────────

const MAX_WAITING = 8

function WatchInner({ campaignId, userId }: { campaignId: string; userId: string }) {
  const [queue, setQueue] = useState<DiceRoll[]>([])
  const [minis, setMinis] = useState<DiceRoll[]>([])
  const simple = useSettings().diceOnScreen === 'simples'
  const simpleNow = useRef(simple)
  simpleNow.current = simple
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
    if (simpleNow.current) setMinis(add)
    else setQueue(add)
  }), [campaignId, userId])

  // Trocou de modo: o que esperava pelo outro jeito não abre mais.
  useEffect(() => { if (simple) setQueue([]); else setMinis([]) }, [simple])

  const playerOf = useCallback((r: DiceRoll) => names.current.get(r.user_id) ?? 'Alguém', [])
  const next = useCallback(() => setQueue((l) => l.slice(1)), [])
  const dropMini = useCallback((id: string) => setMinis((l) => l.filter((r) => r.id !== id)), [])

  if (simple) return minis.length > 0 ? <DndWatchMini rolls={minis} playerOf={playerOf} onDone={dropMini} /> : null

  // O painel espera a própria pessoa terminar a rolagem dela (um dado por cima do outro atrapalha).
  const current = !busy ? queue[0] : undefined
  return current ? <AltheriumWatchPanel key={current.id} roll={current} player={playerOf(current)} hurry={queue.length > 1} onDone={next} /> : null
}

/** Fica montado na área logada; só liga dentro de uma campanha de Altherium. */
export function AltheriumWatchRolls() {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  if (!user || !campaign || campaign.system !== 'altherium' || typeof document === 'undefined') return null
  return <WatchInner key={campaign.id} campaignId={campaign.id} userId={user.id} />
}
