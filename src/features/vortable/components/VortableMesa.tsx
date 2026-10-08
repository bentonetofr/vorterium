import type { CampaignWithRole } from '../../../shared/types'
import { MasterStage } from './MasterStage'
import { PlayerStage } from './PlayerStage'
import './VortableMesa.css'

/**
 * Aba Mesa da Sessão. O mestre tem o Vortable completo (editar, testar,
 * personagens, jogadores); o jogador só vê o jogo com o boneco dele.
 */
export function VortableMesa({ campaign, currentUserId }: { campaign: CampaignWithRole; currentUserId: string }) {
  return campaign.role === 'master'
    ? <MasterStage campaign={campaign} userId={currentUserId} />
    : <PlayerStage campaign={campaign} userId={currentUserId} />
}
