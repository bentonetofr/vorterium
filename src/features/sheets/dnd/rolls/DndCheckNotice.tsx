import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { useCurrentCampaign } from '../../../campaigns/CurrentCampaignContext'
import { useFeature } from '../../../control/siteFeatures'
import { DND_FEATURE } from '../constants/dnd'
import { listOpenCheckRequests, listRequestAnswers, subscribeToCheckRequests, type DndCheckRequest } from '../services/dndCheckService'
import { dismiss, isDismissed, isSheetListening, requestOpen } from './checkRequests'
import '../components/DndSheet.css'
import '../components/DndMotion.css'
import './DndRolls.css'

// ────────────────────────────────────────────────────────
// Aviso de pedido de teste para o jogador que não está com a ficha aberta:
// "O mestre pede: Furtividade (CD 15)" com "Rolar", que leva até a ficha e
// abre o painel. Com a ficha aberta, quem cuida é a própria ficha.
// ────────────────────────────────────────────────────────

function NoticeInner({ campaignId, userId }: { campaignId: string; userId: string }) {
  const navigate = useNavigate()
  const [queue, setQueue] = useState<DndCheckRequest[]>([])
  // a ficha pode abrir ou fechar a qualquer momento: confere de tempos em tempos quem está ouvindo
  const [, tick] = useState(0)
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 1000); return () => window.clearInterval(t) }, [])
  const current = queue[0] ?? null

  useEffect(() => {
    let alive = true
    const consider = async (req: DndCheckRequest) => {
      if (req.status !== 'open' || !req.targets.includes(userId) || isDismissed(req.id)) {
        setQueue((q) => q.filter((r) => r.id !== req.id))
        return
      }
      const answers = await listRequestAnswers(campaignId, [req.id])
      if (!alive || answers.some((a) => a.user_id === userId)) return
      setQueue((q) => (q.some((r) => r.id === req.id) ? q : [...q, req]))
    }
    void listOpenCheckRequests(campaignId).then((list) => list.forEach((r) => void consider(r)))
    const unsub = subscribeToCheckRequests(campaignId, (r) => void consider(r))
    return () => { alive = false; unsub() }
  }, [campaignId, userId])

  if (!current || isSheetListening()) return null

  const dcText = current.dc_hidden ? ' · CD oculta' : current.dc != null ? ` · CD ${current.dc}` : ''
  const skip = () => { dismiss(current.id); setQueue((q) => q.slice(1)) }
  const go = () => {
    requestOpen(current.id)
    setQueue((q) => q.slice(1))
    navigate(`/campanhas/${campaignId}/mesa-sessao`, { state: { initialSessionSubTab: 'ficha' } })
  }

  return createPortal(
    <div className="dsh-sheet dcnotice" role="alert">
      <span className="dcnotice__kicker">O mestre pede um teste</span>
      <strong className="dcnotice__label">{current.label}<span>{dcText}{current.advantage !== 'normal' ? ` · ${current.advantage === 'advantage' ? 'com vantagem' : 'com desvantagem'}` : ''}</span></strong>
      <div className="dcnotice__actions">
        <button type="button" className="dsh-chip dsh-chip--primary" onClick={go}>Rolar</button>
        <button type="button" className="dsh-chip" onClick={skip}>Depois</button>
      </div>
    </div>,
    document.body,
  )
}

export function DndCheckNotice() {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const feature = useFeature(DND_FEATURE)
  if (!user || !campaign || campaign.system !== 'dnd5e' || campaign.role === 'master' || !feature.visible || typeof document === 'undefined') return null
  return <NoticeInner key={campaign.id} campaignId={campaign.id} userId={user.id} />
}
