import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { getMyCampaigns } from '../services/campaignService'
import { formatSystem, formatRole } from '../../../shared/utils/campaign'
import type { CampaignWithRole } from '../../../shared/types'
import './CampaignPages.css'

export function CampaignsPage() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<CampaignWithRole[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyCampaigns()
        setCampaigns(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar campanhas.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ?? 'Aventureiro'

  const asMaster = campaigns.filter((c) => c.role === 'master')
  const asPlayer = campaigns.filter((c) => c.role === 'player')

  return (
    <div className="page">
      <header className="page__header animate-fade-up">
        <div>
          <h2 className="page__title" style={{ fontSize: 'var(--text-3xl)' }}>
            Olá, {displayName}
          </h2>
          <p className="page__meta">
            Escolha uma campanha para continuar ou crie uma nova.
          </p>
        </div>
        <Link to="/campanhas/nova" className="btn btn-primary" style={{ borderColor: 'rgba(255,221,184,0.5)', flexShrink: 0 }}>
          + Criar campanha
        </Link>
      </header>

      {loading && (
        <div className="page__loading animate-fade-in">
          <div className="spinner" />
          <span>Carregando campanhas...</span>
        </div>
      )}

      {!loading && error && (
        <div className="page__feedback page__feedback--error" role="alert">{error}</div>
      )}

      {!loading && !error && campaigns.length === 0 && (
        <div className="page__empty animate-fade-up">
          <div className="page__empty-icon" aria-hidden="true">◈</div>
          <h3 className="page__empty-title">Nenhuma campanha ainda</h3>
          <p className="page__empty-text">Crie sua primeira campanha para começar a jogar.</p>
          <Link to="/campanhas/nova" className="btn btn-ghost" style={{ borderColor: 'var(--gilded)' }}>
            Criar campanha
          </Link>
        </div>
      )}

      {!loading && !error && campaigns.length > 0 && (
        <div className="campaigns-list animate-fade-up">
          {asMaster.length > 0 && (
            <section>
              <h3 className="campaigns-section__title">
                <span className="campaigns-section__title-icon">◈</span>
                Campanhas como mestre
              </h3>
              <div className="campaign-cards">
                {asMaster.map((c) => <CampaignCard key={c.id} campaign={c} />)}
              </div>
            </section>
          )}

          {asPlayer.length > 0 && (
            <section>
              <h3 className="campaigns-section__title">
                <span className="campaigns-section__title-icon">⚔</span>
                Campanhas como jogador
              </h3>
              <div className="campaign-cards">
                {asPlayer.map((c) => <CampaignCard key={c.id} campaign={c} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function CampaignCard({ campaign }: { campaign: CampaignWithRole }) {
  return (
    <div className="campaign-card-row">
      <div className="campaign-card-row__info">
        <span className="campaign-card-row__name">{campaign.name}</span>
        <div className="campaign-card-row__meta">
          <span className="badge">{formatSystem(campaign.system)}</span>
          <span className={`campaign-card-role campaign-card-role--${campaign.role}`}>
            {formatRole(campaign.role)}
          </span>
        </div>
      </div>
      <Link
        to={`/campanhas/${campaign.id}`}
        className="btn btn-ghost campaign-card-row__enter"
      >
        Entrar →
      </Link>
    </div>
  )
}
