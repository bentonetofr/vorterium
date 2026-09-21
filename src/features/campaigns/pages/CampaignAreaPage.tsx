import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { getCampaignWithRole } from '../services/campaignService'
import { touchCampaignPresence } from '../../activity/services/activityService'
import { formatRole, getCampaignStatusLabel, getCampaignStatusClass } from '../../../shared/utils/campaign'
import { getSystemLabel, getSystemStatus, STATUS_LABELS } from '../../../shared/constants/systems'
import { CampaignOverviewPanel }  from '../components/CampaignOverviewPanel'
import { CampaignMembersPanel }   from '../../members/components/CampaignMembersPanel'
import { CampaignSessionsPanel }  from '../../sessions/components/CampaignSessionsPanel'
import { CampaignSheetPanel }     from '../../sheets/components/CampaignSheetPanel'
import { CampaignSettingsPanel }  from '../components/CampaignSettingsPanel'
import { CampaignActivityPanel }  from '../../activity/components/CampaignActivityPanel'
import { CampaignNotesPanel }     from '../../notes/components/CampaignNotesPanel'
import { CampaignChatPanel }      from '../../chat/components/CampaignChatPanel'
import { getChatUnreadCount, markChatRead, getPrivateUnreadCounts } from '../../chat/services/chatService'
import type { CampaignWithRole } from '../../../shared/types'
import './CampaignPages.css'

// ────────────────────────────────────────────────────────
// Abas disponíveis — exportado para uso no CampaignOverviewPanel
// ────────────────────────────────────────────────────────

export type TabId = 'visao-geral' | 'membros' | 'sessoes' | 'ficha' | 'notas' | 'atividade' | 'chat' | 'configuracoes'

interface Tab {
  id: TabId
  label: string
}

const TABS: Tab[] = [
  { id: 'visao-geral',   label: 'Visão geral' },
  { id: 'membros',       label: 'Membros' },
  { id: 'sessoes',       label: 'Sessões' },
  { id: 'ficha',         label: 'Ficha' },
  { id: 'notas',         label: 'Notas' },
  { id: 'atividade',     label: 'Atividade' },
  { id: 'chat',          label: 'Chat' },
  { id: 'configuracoes', label: 'Configurações' },
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
  const [chatUnread, setChatUnread] = useState(0)
  const [privateUnread, setPrivateUnread] = useState(0)

  useEffect(() => {
    if (!campaignId || !user) return
    let cancelled = false
    async function load() {
      try {
        const data = await getCampaignWithRole(campaignId!, user!.id)
        if (cancelled) return
        if (!data) setError('Campanha não encontrada ou você não tem acesso a ela.')
        else setCampaign(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar a campanha.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [campaignId, user])

  // ── Heartbeat de presença — atualiza a cada 60 segundos ──
  useEffect(() => {
    if (!campaign?.id) return
    void touchCampaignPresence(campaign.id).catch(() => {})
    const interval = setInterval(() => {
      void touchCampaignPresence(campaign.id).catch(() => {})
    }, 60_000)
    return () => clearInterval(interval)
  }, [campaign?.id])

  // ── Selo de chat não lido — só enquanto a aba de chat não está ativa ──
  useEffect(() => {
    if (!campaign?.id || activeTab === 'chat') { setChatUnread(0); return }
    let cancelled = false
    async function refresh() {
      try {
        const count = await getChatUnreadCount(campaign!.id)
        if (!cancelled) setChatUnread(count)
      } catch { /* selo só deixa de atualizar, não quebra a tela */ }
    }
    refresh()
    const interval = setInterval(refresh, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [campaign?.id, activeTab])

  // ── Selo de mensagem privada não lida — selo separado do selo da mesa
  // acima; não zera ao simplesmente abrir a aba Chat (que abre na visão
  // "Mesa" por padrão), só quando o usuário entra em cada conversa
  // privada específica dentro do painel ──
  useEffect(() => {
    if (!campaign?.id) { setPrivateUnread(0); return }
    let cancelled = false
    async function refresh() {
      try {
        const counts = await getPrivateUnreadCounts(campaign!.id)
        if (!cancelled) setPrivateUnread(Array.from(counts.values()).reduce((sum, n) => sum + n, 0))
      } catch { /* selo só deixa de atualizar, não quebra a tela */ }
    }
    refresh()
    const interval = setInterval(refresh, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [campaign?.id])

  function handleTabClick(tabId: TabId) {
    setActiveTab(tabId)
    if (tabId === 'chat' && campaign?.id) {
      setChatUnread(0)
      markChatRead(campaign.id).catch(() => {})
    }
  }

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
      <header className="page__header campaign-area__page-header animate-fade-up">
        <div
          className={`campaign-area__cover${campaign.cover_url ? '' : ' campaign-area__cover--empty'}`}
          style={campaign.cover_url ? { backgroundImage: `url(${campaign.cover_url})` } : undefined}
          aria-hidden="true"
        >
          {!campaign.cover_url && '◈'}
        </div>
        <div>
          <Link to="/campanhas" className="page__back">← Campanhas</Link>
          <h2 className="page__title">{campaign.name}</h2>
          <div className="campaign-area__header-meta">
            <span className="badge">{getSystemLabel(campaign.system)}</span>
            {STATUS_LABELS[getSystemStatus(campaign.system)] && (
              <span className={`system-status-badge system-status-badge--${getSystemStatus(campaign.system)}`}>
                {STATUS_LABELS[getSystemStatus(campaign.system)]}
              </span>
            )}
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
            <span className={`campaign-status ${getCampaignStatusClass(campaign.status)}`}>
              {getCampaignStatusLabel(campaign.status)}
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
            onClick={() => handleTabClick(tab.id)}
          >
            <span className="campaign-tab__label">{tab.label}</span>
            {tab.id === 'chat' && chatUnread > 0 && (
              <span className="campaign-tab__badge">{chatUnread > 99 ? '99+' : chatUnread}</span>
            )}
            {tab.id === 'chat' && privateUnread > 0 && (
              <span className="campaign-tab__badge campaign-tab__badge--private" title="Mensagem privada não lida">
                {privateUnread > 99 ? '99+' : privateUnread}
              </span>
            )}
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

      {/* ── Sessões ── */}
      <div
        id="tabpanel-sessoes"
        role="tabpanel"
        aria-labelledby="tab-sessoes"
        hidden={activeTab !== 'sessoes'}
        className="animate-fade-up"
      >
        {activeTab === 'sessoes' && (
          <CampaignSessionsPanel
            campaignId={campaign.id}
            userRole={campaign.role}
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
          <CampaignSheetPanel
            campaign={campaign}
            currentUserId={user!.id}
          />
        )}
      </div>

      {/* ── Notas ── */}
      <div
        id="tabpanel-notas"
        role="tabpanel"
        aria-labelledby="tab-notas"
        hidden={activeTab !== 'notas'}
        className="animate-fade-up"
      >
        {activeTab === 'notas' && (
          <CampaignNotesPanel
            campaignId={campaign.id}
            currentUserId={user!.id}
            userRole={campaign.role}
          />
        )}
      </div>

      {/* ── Atividade ── */}
      <div
        id="tabpanel-atividade"
        role="tabpanel"
        aria-labelledby="tab-atividade"
        hidden={activeTab !== 'atividade'}
        className="animate-fade-up"
      >
        {activeTab === 'atividade' && (
          <CampaignActivityPanel
            campaignId={campaign.id}
            userRole={campaign.role}
          />
        )}
      </div>

      {/* ── Chat ── */}
      <div
        id="tabpanel-chat"
        role="tabpanel"
        aria-labelledby="tab-chat"
        hidden={activeTab !== 'chat'}
        className="animate-fade-up"
      >
        {activeTab === 'chat' && (
          <CampaignChatPanel
            campaignId={campaign.id}
            currentUserId={user!.id}
            userRole={campaign.role}
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
            onCampaignUpdate={(updated) =>
              setCampaign((prev) => prev ? { ...prev, ...updated } : prev)
            }
          />
        )}
      </div>
    </div>
  )
}
