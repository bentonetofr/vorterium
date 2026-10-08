import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { getCampaignWithRole } from '../../campaigns/services/campaignService'
import { CurrentCampaignProvider, useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { ActiveChatProvider } from '../../chat/ActiveChatContext'
import { DiceRollerProvider } from '../../dice/DiceRollerProvider'
import { MesaStreamProvider } from '../../mesa/MesaStreamProvider'
import type { CampaignWithRole } from '../../../shared/types'
import { MasterStage } from '../components/MasterStage'
import { PlayerStage } from '../components/PlayerStage'
import { VortableTools } from '../components/VortableTools'
import { fullscreenSupported, enterFullscreen, leaveFullscreen, useIsFullscreen } from '../fullscreen'
import '../components/VortablePage.css'

/**
 * O Vortable ocupando o navegador todo (fora do layout do site), com os
 * botões de dados, chat, notificações e caderno no canto inferior esquerdo.
 */
export function VortablePage() {
  return (
    <ActiveChatProvider>
      <DiceRollerProvider>
        <CurrentCampaignProvider>
          {/* o mestre aqui avisa os jogadores e manda a cena (ver SceneBar) */}
          <MesaStreamProvider announce>
            <VortablePageContent />
          </MesaStreamProvider>
        </CurrentCampaignProvider>
      </DiceRollerProvider>
    </ActiveChatProvider>
  )
}

function VortablePageContent() {
  const { setCampaign: shareCampaign } = useCurrentCampaign()
  const { campaignId } = useParams<{ campaignId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const fullscreen = useIsFullscreen()
  const [campaign, setCampaign] = useState<CampaignWithRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!campaignId || !user) return
    let dead = false
    getCampaignWithRole(campaignId, user.id)
      .then((c) => {
        if (dead) return
        if (c) { setCampaign(c); shareCampaign(c) }
        else setError('Campanha não encontrada ou sem acesso.')
      })
      .catch((err) => { if (!dead) setError(err instanceof Error ? err.message : 'Não foi possível abrir a campanha.') })
    return () => { dead = true }
  }, [campaignId, user, shareCampaign])

  useEffect(() => {
    document.title = campaign ? `Vortable · ${campaign.name}` : 'Vortable'
  }, [campaign])

  // saiu da página (voltar do navegador, link): a tela cheia não fica presa
  useEffect(() => leaveFullscreen, [])

  function exit() {
    leaveFullscreen()
    navigate(`/campanhas/${campaignId}/mesa-sessao`, { state: { initialSessionSubTab: 'mesa' } })
  }

  return (
    <div className="vortable-page">
      <header className="vortable-page__bar">
        <button type="button" className="btn btn-ghost vortable-page__exit" onClick={exit}>← Sair</button>
        <span className="vortable-page__title">{campaign?.name ?? 'Vortable'}</span>
        {fullscreenSupported() && (
          <button
            type="button"
            className="btn btn-ghost vortable-page__full"
            onClick={() => (fullscreen ? leaveFullscreen() : enterFullscreen())}
          >
            {fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          </button>
        )}
      </header>

      <main className="vortable-page__body">
        {error && <p className="vortable-msg vortable-msg--error" role="alert">{error}</p>}
        {!error && !campaign && <div className="vortable-page__loading"><div className="spinner" /></div>}
        {campaign && user && (campaign.role === 'master'
          ? <MasterStage campaign={campaign} userId={user.id} />
          : <PlayerStage campaign={campaign} userId={user.id} />)}
      </main>
      {campaign && <VortableTools />}
    </div>
  )
}
