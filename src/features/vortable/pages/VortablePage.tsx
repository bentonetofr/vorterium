import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { getCampaignWithRole } from '../../campaigns/services/campaignService'
import { CurrentCampaignProvider, useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { ActiveChatProvider } from '../../chat/ActiveChatContext'
import { DiceRollerProvider } from '../../dice/DiceRollerProvider'
import { MesaStreamProvider, useMesaStream } from '../../mesa/MesaStreamProvider'
import type { CampaignWithRole } from '../../../shared/types'
import { MasterStage } from '../components/MasterStage'
import { PlayerStage } from '../components/PlayerStage'
import { VortableTools } from '../components/VortableTools'
import { VortableNetProvider, useVortableNet } from '../net/VortableNetProvider'
import { VortableWorldProvider, useVortableWorlds } from '../worlds/VortableWorldProvider'
import { WorldsPanel } from '../worlds/WorldsPanel'
import { fullscreenSupported, enterFullscreen, leaveFullscreen, useIsFullscreen } from '../fullscreen'
import { closePip } from '../pip/pipStore'
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
            <VortableWorldProvider>
              <VortableNetProvider>
                <VortablePageContent />
              </VortableNetProvider>
            </VortableWorldProvider>
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
  const vnet = useVortableNet()
  const mesa = useMesaStream()
  const { active, editing, error: worldsError } = useVortableWorlds()
  const [showWorlds, setShowWorlds] = useState(false)
  // o mestre escolheu "Editar" num mundo: o MasterStage vai pra aba do editor
  const [editSignal, setEditSignal] = useState(0)
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

  // dentro do Vortable a telinha não faz sentido
  useEffect(() => { closePip() }, [])

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
        {campaign?.role === 'master' && (
          <button type="button" className={`btn btn-ghost vortable-page__worlds${showWorlds ? ' vortable-page__worlds--on' : ''}`} onClick={() => setShowWorlds((v) => !v)}>
            Mundos{(editing ?? active) && <small> · {(editing ?? active)!.name}</small>}
          </button>
        )}
        {campaign?.role === 'master' && (
          <button
            type="button"
            className={`btn ${mesa.live ? 'btn-danger' : 'btn-primary'} vortable-page__live`}
            onClick={() => mesa.setLive(!mesa.live)}
            title={mesa.live ? 'Os jogadores já podem entrar' : 'Libera o botão de entrar dos jogadores e avisa todos'}
          >
            {mesa.live ? 'Encerrar sessão' : 'Iniciar sessão'}
          </button>
        )}
        {campaign && (
          <span className={`vortable-page__net vortable-page__net--${campaign.role === 'master' ? (vnet.peers.some((p) => p.connected) ? 'online' : 'off') : vnet.status}`}>
            {campaign.role === 'master'
              ? `${vnet.peers.filter((p) => p.connected).length} online`
              : vnet.status === 'online' ? 'Conectado' : vnet.status === 'connecting' ? 'Conectando…' : 'Sozinho'}
          </span>
        )}
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
        {worldsError && !error && <p className="vortable-msg vortable-msg--error" role="alert">{worldsError} (a migration 20240194 já foi aplicada no Supabase?)</p>}
        {!error && !campaign && <div className="vortable-page__loading"><div className="spinner" /></div>}
        {campaign && user && campaign.role === 'master' && <MasterStage campaign={campaign} userId={user.id} editSignal={editSignal} />}
        {campaign?.role === 'master' && showWorlds && (
          <WorldsPanel
            campaignId={campaign.id}
            onClose={() => setShowWorlds(false)}
            onEdit={() => { setShowWorlds(false); setEditSignal((n) => n + 1) }}
          />
        )}
        {campaign && user && campaign.role === 'player' && (mesa.live
          ? <PlayerStage campaign={campaign} userId={user.id} />
          : (
            <div className="vortable-page__wait" role="status">
              <div className="spinner" />
              <p>Aguardando o mestre liberar o Vortable…</p>
              <button type="button" className="btn btn-ghost" onClick={exit}>Voltar à Mesa</button>
            </div>
          ))}
      </main>
      {campaign && <VortableTools />}
    </div>
  )
}
