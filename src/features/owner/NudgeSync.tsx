import { useEffect } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useCurrentCampaign } from '../campaigns/CurrentCampaignContext'
import { setNudgeCampaign, startNudgeSync } from './rollNudge'

// Sem desenho nenhum: liga a leitura do ajuste do próximo dado desta conta e avisa qual campanha está aberta (ver rollNudge.ts).
export function NudgeSync() {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const uid = user?.id ?? null
  useEffect(() => (uid ? startNudgeSync(uid) : undefined), [uid])
  useEffect(() => { setNudgeCampaign(campaign?.id ?? null); return () => setNudgeCampaign(null) }, [campaign?.id])
  return null
}
