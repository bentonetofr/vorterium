import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { getCampaignWithRole } from '../services/campaignService'
import { formatSystem, formatRole } from '../../../shared/utils/campaign'
import { CampaignOverviewPanel } from '../components/CampaignOverviewPanel'
import { CampaignMembersPanel }  from '../../members/components/CampaignMembersPanel'
import { SimpleSheetPanel }      from '../../sheets/components/SimpleSheetPanel'
import { DiceRollerPanel }       from '../../dice/components/DiceRollerPanel'
import { CampaignSettingsPanel } from '../components/CampaignSettingsPanel'
import type { CampaignWithRole } from '../../../shared/types'
import './CampaignPages.css'

// ────────────────────────────────────────────────────────
// Abas disponíveis — exportado para uso no CampaignOverviewPanel
// ────────────────────────────────────────────────────────

export type TabId = 'visao-geral' | 'membros' | 'ficha' | 'rolagem' | 'configuracoes'

interface Tab {
  id: TabId
  label: string
  icon: string
}

const TABS: Tab[] = [
  { id: 'visao-geral',   label: 'Visão geral',   icon: '◎' },
  { id: 'membros',       label: 'Membros',        icon: '⚔' },
  { id: 'ficha',         label: 'Ficha',          icon: '📜' },
  { id: 'rolagem',       label: 'Rolagem',        icon: '⬡' },
  { id: 'configuracoes', label: 'Configurações',  icon: '◈' },
]

// ────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────

export function CampaignAreaPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { user } = useAuth()

  const [campaign, setCampaign]   = useState<CampaignWithRole | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('visao-geral')

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
    <div className="page campaign-area-page">
      {/* ── Cabeçalho ── */}
      <header className="page__header animate-fade-up">
        <div>
          <Link to="/campanhas" className="page__back">← Campanhas</Link>
          <h2 className="page__title">{campaign.name}</h2>
          <div className="campaign-area__header-meta">
            <span className="badge">{formatSystem(campaign.system)}</span>
            <span
              className={`campaign-card-role campaign-card-role--${campaign.role}`}
              style={{
                fontFamily: 'var(--font-label)',
                fontSize: 'var(--text-xs)',
                fontWeight: '600',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {formatRole(campaign.role)}
            </span>
          </div>
        </div>
      </header>

      {/* ── Navegação por abas ── */}
      <nav className="campaign-tabs animate-fade-up" role="tablist" aria-label="Seções da campanha">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            className={`campaign-tab ${activeTab === tab.id ? 'campaign-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="campaign-tab__icon" aria-hidden="true">{tab.icon}</span>
            <span className="campaign-tab__label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Visão geral ── */}
      <div
        id="tabpanel-visao-geral"
        role="tabpanel"
        aria-labelledby="tab-visao-geral"
        hidden={activeTab !== 'visao-geral'}
        className="animate-fade-up"
      >
        {activeTab === 'visao-geral' && (
          <CampaignOverviewPanel
            campaign={campaign}
            currentUserId={user!.id}
            onNavigate={setActiveTab}
          />
        )}
      </div>

      {/* ── Membros ── */}
      <div
        id="tabpanel-membros"
        role="tabpanel"
        aria-labelledby="tab-membros"
        hidden={activeTab !== 'membros'}
        className="animate-fade-up"
      >
        {activeTab === 'membros' && (
          <CampaignMembersPanel
            campaignId={campaign.id}
            userRole={campaign.role}
            currentUserId={user!.id}
          />
        )}
      </div>

      {/* ── Ficha ── */}
      <div
        id="tabpanel-ficha"
        role="tabpanel"
        aria-labelledby="tab-ficha"
        hidden={activeTab !== 'ficha'}
        className="animate-fade-up"
      >
        {activeTab === 'ficha' && (
          <SimpleSheetPanel
            campaignId={campaign.id}
            userRole={campaign.role}
          />
        )}
      </div>

      {/* ── Rolagem ── */}
      <div
        id="tabpanel-rolagem"
        role="tabpanel"
        aria-labelledby="tab-rolagem"
        hidden={activeTab !== 'rolagem'}
        className="animate-fade-up"
      >
        {activeTab === 'rolagem' && (
          <DiceRollerPanel
            campaignId={campaign.id}
            currentUserId={user!.id}
          />
        )}
      </div>

      {/* ── Configurações ── */}
      <div
        id="tabpanel-configuracoes"
        role="tabpanel"
        aria-labelledby="tab-configuracoes"
        hidden={activeTab !== 'configuracoes'}
        className="animate-fade-up"
      >
        {activeTab === 'configuracoes' && (
          <CampaignSettingsPanel
            campaign={campaign}
            onNameUpdate={(newName) =>
              setCampaign((prev) => prev ? { ...prev, name: newName } : prev)
            }
          />
        )}
      </div>
    </div>
  )
}
