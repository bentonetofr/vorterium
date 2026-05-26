import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { getCampaignWithRole } from '../services/campaignService'
import { formatSystem, formatRole } from '../../../shared/utils/campaign'
import { CampaignMembersPanel }    from '../../members/components/CampaignMembersPanel'
import { SimpleSheetPanel }         from '../../sheets/components/SimpleSheetPanel'
import { DiceRollerPanel }          from '../../dice/components/DiceRollerPanel'
import { CampaignSettingsPanel }    from '../components/CampaignSettingsPanel'
import type { CampaignWithRole }    from '../../../shared/types'
import './CampaignPages.css'

export function CampaignAreaPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { user } = useAuth()

  const [campaign, setCampaign] = useState<CampaignWithRole | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    if (!campaignId || !user) return
    async function load() {
      try {
        const data = await getCampaignWithRole(campaignId!, user!.id)
        if (!data) setError('Campanha não encontrada ou você não tem acesso a ela.')
        else setCampaign(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar a campanha.')
      } finally { setLoading(false) }
    }
    load()
  }, [campaignId, user])

  if (loading) {
    return (
      <div className="page">
        <div className="page__loading animate-fade-in">
          <div className="spinner" />
          <span>Carregando campanha...</span>
        </div>
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="page">
        <div className="page__feedback page__feedback--error animate-fade-up" role="alert">
          {error ?? 'Campanha não encontrada.'}
        </div>
        <Link to="/campanhas" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }}>
          ← Voltar para campanhas
        </Link>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Cabeçalho */}
      <header className="page__header animate-fade-up">
        <div>
          <Link to="/campanhas" className="page__back">← Campanhas</Link>
          <h2 className="page__title">{campaign.name}</h2>
          <div className="campaign-area__header-meta">
            <span className="badge">{formatSystem(campaign.system)}</span>
            <span className={`campaign-card-role campaign-card-role--${campaign.role}`}
              style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-xs)', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {formatRole(campaign.role)}
            </span>
          </div>
        </div>
      </header>

      {/* Membros */}
      <div className="animate-fade-up" style={{ animationDelay: '60ms' }}>
        <CampaignMembersPanel
          campaignId={campaign.id}
          userRole={campaign.role}
          currentUserId={user!.id}
        />
      </div>

      {/* Ficha Simples */}
      <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
        <SimpleSheetPanel
          campaignId={campaign.id}
          userRole={campaign.role}
        />
      </div>

      {/* Rolagem de Dados */}
      <div className="animate-fade-up" style={{ animationDelay: '180ms' }}>
        <DiceRollerPanel
          campaignId={campaign.id}
          currentUserId={user!.id}
        />
      </div>

      {/* Configurações */}
      <div className="animate-fade-up" style={{ animationDelay: '240ms' }}>
        <CampaignSettingsPanel
          campaign={campaign}
          onNameUpdate={(newName) =>
            setCampaign((prev) => prev ? { ...prev, name: newName } : prev)
          }
        />
      </div>
    </div>
  )
}
