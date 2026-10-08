import { useNavigate } from 'react-router-dom'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { useMesaStream } from '../../mesa/MesaStreamProvider'
import { enterFullscreen, leaveFullscreen } from '../fullscreen'
import { getPip, openPip, setHandoff } from '../pip/pipStore'
import './VortableFab.css'

/** Mesa de jogo com o escudo do mestre (a tela dobrável) em cima. */
export function TableScreenIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* escudo do mestre: tela dobrável de três painéis (o do meio de frente), com um brasão */}
      <path d="M5 7.4 9 5.6h6l4 1.8v9.1H5z" />
      <path d="M9 5.6v10.9M15 5.6v10.9" />
      <path d="M12 8l1.6 2L12 12l-1.6-2z" />
      {/* mesa */}
      <path d="M3 16.5h18l1 2.2H2z" />
      <path d="M4.6 18.7V21.5M19.4 18.7V21.5" />
    </svg>
  )
}

/**
 * Botão redondo de entrar/sair do Vortable, no canto dos botões flutuantes.
 *  • enter (resto do site): o mestre sempre vê; os jogadores só enquanto o mestre
 *    mantém o Vortable liberado (sessão iniciada) — o mesmo momento do aviso "ao vivo".
 *  • leave (dentro do Vortable): todos veem.
 */
export function VortableFab({ mode }: { mode: 'enter' | 'leave' }) {
  const { campaign } = useCurrentCampaign()
  const { live, stage } = useMesaStream()
  const navigate = useNavigate()
  if (!campaign) return null
  const master = campaign.role === 'master'

  if (mode === 'enter') {
    if (!master && !live) return null
    return (
      <button
        type="button"
        className={`vortable-fab${live ? ' vortable-fab--live' : ''}`}
        onClick={() => {
          enterFullscreen() // vem do clique
          // mestre com a telinha aberta: a sessão ao vivo passa da telinha pra página sem cair
          if (getPip()?.role === 'master') setHandoff(campaign.id, stage)
          navigate(`/campanhas/${campaign.id}/vortable`)
        }}
        aria-label="Entrar no Vortable"
        title={master && !live ? 'Entrar no Vortable' : 'Entrar no Vortable (sessão ao vivo)'}
      >
        <TableScreenIcon />
        {live && <span className="vortable-fab__dot" aria-hidden="true" />}
      </button>
    )
  }

  return (
    <button
      type="button"
      className="vortable-fab vortable-fab--leave"
      onClick={() => {
        leaveFullscreen()
        // sessão no ar: uma telinha continua mostrando o jogo enquanto a pessoa anda pelo site
        // (mestre: a sessão passa a ser mantida pela telinha, então não cai)
        if (live && (master || stage.spectate.allow)) {
          if (master) setHandoff(campaign.id, stage)
          openPip(campaign)
        }
        navigate(`/campanhas/${campaign.id}/mesa-sessao`, { state: { initialSessionSubTab: 'mesa' } })
      }}
      aria-label="Sair do Vortable"
      title="Sair do Vortable"
    >
      <TableScreenIcon />
      <span className="vortable-fab__exit" aria-hidden="true">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4h5v16h-5M10 8l-4 4 4 4M6 12h10" /></svg>
      </span>
    </button>
  )
}
