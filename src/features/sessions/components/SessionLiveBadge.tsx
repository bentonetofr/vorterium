import { useLiveSession } from '../services/liveSession'
import { formatStart } from '../utils/sessionTime'
import './SessionLiveBadge.css'

// ────────────────────────────────────────────────────────
// O selo "Sessão aberta" do cabeçalho da campanha. Aparece sozinho quando o site reconhece a sessão (horário marcado ou mestre e jogador
// online juntos). Fora disso, mostra a próxima sessão marcada, se houver, e nada se não houver.
// ────────────────────────────────────────────────────────

const WHY = {
  scheduled: 'No horário marcado da sessão',
  together: 'O mestre e os jogadores estão online juntos',
} as const

export function SessionLiveBadge({ campaignId }: { campaignId: string }) {
  const s = useLiveSession(campaignId)
  if (!s.known) return null
  if (s.open && s.reason) {
    return (
      <span className="live-badge live-badge--open" role="status" title={`${WHY[s.reason]}. As conquistas e os conjuntos de dados só contam rolagens feitas agora.`}>
        <i aria-hidden="true" />
        Sessão aberta
        <small>{s.reason === 'scheduled' ? 'horário marcado' : 'mesa reunida'}</small>
      </span>
    )
  }
  if (s.nextAt) {
    return <span className="live-badge live-badge--next" title="A sessão abre sozinha 15 minutos antes do horário marcado.">Próxima sessão: {formatStart(s.nextAt)}</span>
  }
  return null
}
