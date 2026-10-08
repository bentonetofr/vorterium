import { useNavigate } from 'react-router-dom'
import type { CampaignWithRole } from '../../../shared/types'
import { MesaArts } from '../../mesa/components/MesaArts'
import { enterFullscreen } from '../fullscreen'
import './VortableMesa.css'

/**
 * Aba Mesa da Sessão: porta de entrada do Vortable (que abre em tela cheia,
 * numa página própria) e as artes recentes da mesa.
 */
export function VortableMesa({ campaign }: { campaign: CampaignWithRole }) {
  const navigate = useNavigate()

  function enter() {
    enterFullscreen() // precisa vir do clique
    navigate(`/campanhas/${campaign.id}/vortable`)
  }

  return (
    <section className="vortable-mesa">
      <div className="vortable-mesa__hero">
        <div>
          <h3 className="vortable-mesa__title">Vortable</h3>
          <p className="vortable-mesa__text">
            {campaign.role === 'master' ? 'Monte o mundo e acompanhe os jogadores.' : 'Entre no mundo com o seu boneco.'}
          </p>
        </div>
        <button type="button" className="btn btn-primary vortable-mesa__enter" onClick={enter}>Entrar no Vortable</button>
      </div>
      <MesaArts campaignId={campaign.id} />
    </section>
  )
}
