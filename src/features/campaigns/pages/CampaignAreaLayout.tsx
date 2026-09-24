import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { getCampaignWithRole } from '../services/campaignService'
import { touchCampaignPresence } from '../../activity/services/activityService'
import { formatRole, getCampaignStatusLabel, getCampaignStatusClass } from '../../../shared/utils/campaign'
import { getSystemLabel, getSystemStatus, STATUS_LABELS } from '../../../shared/constants/systems'
import { getChatUnreadCount, getPrivateUnreadCounts } from '../../chat/services/chatService'
import { useCurrentCampaign } from '../CurrentCampaignContext'
import type { TabId, SessionSubTabId } from '../campaignSections'
import { CampaignOverviewPanel }  from '../components/CampaignOverviewPanel'
import { CampaignMembersPanel }   from '../../members/components/CampaignMembersPanel'
import { CampaignSessionsPanel }  from '../../sessions/components/CampaignSessionsPanel'
import { CampaignSettingsPanel }  from '../components/CampaignSettingsPanel'
import { CampaignNotesPanel }     from '../../notes/components/CampaignNotesPanel'
import { SessionTablePanel }      from '../components/SessionTablePanel'
import './CampaignPages.css'

// ────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────

export function CampaignAreaLayout() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { campaign, setCampaign, setChatUnread, setPrivateUnread } = useCurrentCampaign()
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const onMesaSessao = location.pathname.endsWith('/mesa-sessao')
  // Seção atual (visao-geral, membros...) — a troca de seção anima.
  const section = location.pathname.split('/')[3] ?? ''

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
  }, [campaignId, user, setCampaign])

  // Fecha o submenu da barra lateral ao sair da campanha.
  useEffect(() => () => setCampaign(null), [setCampaign])

  // ── Heartbeat de presença — atualiza a cada 60 segundos ──
  useEffect(() => {
    if (!campaign?.id) return
    void touchCampaignPresence(campaign.id).catch(() => {})
    const interval = setInterval(() => {
      void touchCampaignPresence(campaign.id).catch(() => {})
    }, 60_000)
    return () => clearInterval(interval)
  }, [campaign?.id])

  // ── Selo de chat não lido — só enquanto a Mesa da Sessão não está ativa
  // (a sub-aba padrão dela já é o Chat). O próprio CampaignChatPanel marca
  // como lida quando monta — aqui é só o selo visual do submenu lateral. ──
  useEffect(() => {
    if (!campaign?.id || onMesaSessao) { setChatUnread(0); return }
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
  }, [campaign?.id, onMesaSessao, setChatUnread])

  // ── Selo de mensagem privada não lida — selo separado do selo da mesa
  // acima; não zera ao simplesmente abrir a Mesa da Sessão, só quando o
  // usuário entra em cada conversa privada específica dentro do chat ──
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
  }, [campaign?.id, setPrivateUnread])

  // Passado pro CampaignOverviewPanel — os atalhos de lá que hoje pedem
  // "ficha" precisam também escolher a sub-aba dentro da Mesa da Sessão,
  // que não vive na URL — vai como state da navegação.
  function handleNavigate(tab: TabId, sessionSubTab?: SessionSubTabId) {
    navigate(
      `/campanhas/${campaignId}/${tab}`,
      sessionSubTab ? { state: { initialSessionSubTab: sessionSubTab } } : undefined,
    )
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
          key={campaign.cover_url ?? 'sem-capa'}
          className={`campaign-area__cover anim-img-swap${campaign.cover_url ? '' : ' campaign-area__cover--empty'}`}
          style={campaign.cover_url ? { backgroundImage: `url(${campaign.cover_url})` } : undefined}
          aria-hidden="true"
        >
          {!campaign.cover_url && '◈'}
        </div>
        <div>
          <Link to="/campanhas" className="page__back"><span className="page__back-arrow" aria-hidden="true">←</span> Campanhas</Link>
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

      <div key={section} className="anim-page">
        <Routes>
          <Route index element={<Navigate to="visao-geral" replace />} />
          <Route
            path="visao-geral"
            element={<CampaignOverviewPanel campaign={campaign} onNavigate={handleNavigate} />}
          />
          <Route
            path="membros"
            element={<CampaignMembersPanel campaignId={campaign.id} userRole={campaign.role} currentUserId={user!.id} />}
          />
          <Route
            path="sessoes"
            element={<CampaignSessionsPanel campaignId={campaign.id} userRole={campaign.role} />}
          />
          <Route
            path="notas"
            element={<CampaignNotesPanel campaignId={campaign.id} currentUserId={user!.id} userRole={campaign.role} />}
          />
          <Route
            path="mesa-sessao"
            element={<SessionTablePanel campaign={campaign} currentUserId={user!.id} />}
          />
          <Route
            path="configuracoes"
            element={
              <CampaignSettingsPanel
                campaign={campaign}
                onCampaignUpdate={(updated) =>
                  setCampaign((prev) => prev ? { ...prev, ...updated } : prev)
                }
              />
            }
          />
          <Route path="*" element={<Navigate to="visao-geral" replace />} />
        </Routes>
      </div>
    </div>
  )
}
