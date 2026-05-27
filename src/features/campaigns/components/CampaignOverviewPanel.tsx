import { type ReactNode, useEffect, useState } from 'react'
import {
  getMasterOverview,
  getPlayerOverview,
  type OverviewMasterData,
  type OverviewPlayerData,
} from '../services/campaignOverviewService'
import { isSheetFilled } from '../../sheets/services/sheetService'
import type { CampaignWithRole } from '../../../shared/types'
import type { TabId } from '../pages/CampaignAreaPage'
import './CampaignOverviewPanel.css'

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface CampaignOverviewPanelProps {
  campaign:      CampaignWithRole
  currentUserId: string
  onNavigate:    (tab: TabId) => void
}

// ────────────────────────────────────────────────────────
// Utilitários
// ────────────────────────────────────────────────────────

/** Formata 'YYYY-MM-DD' sem desvio de timezone UTC → local. */
function formatDateShort(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short',
  })
}

function formatRelativeTime(iso: string): string {
  const diff    = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5)  return 'agora'
  if (seconds < 60) return `${seconds}s atrás`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}min atrás`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `${hours}h atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ────────────────────────────────────────────────────────
// StatCard
// ────────────────────────────────────────────────────────

interface StatCardProps {
  icon:     string
  title:    string
  action:   { label: string; onClick: () => void }
  children: ReactNode
}

function StatCard({ icon, title, action, children }: StatCardProps) {
  return (
    <div className="ov-stat">
      <div className="ov-stat__header">
        <span className="ov-stat__icon" aria-hidden="true">{icon}</span>
        <span className="ov-stat__title">{title}</span>
      </div>
      <div className="ov-stat__body">{children}</div>
      <button className="btn btn-ghost ov-stat__action" onClick={action.onClick}>
        {action.label} →
      </button>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// RecentRollsCard
// ────────────────────────────────────────────────────────

interface RecentRollsCardProps {
  rolls:         OverviewMasterData['recentRolls']
  currentUserId: string
  onNavigate:    (tab: TabId) => void
}

function RecentRollsCard({ rolls, currentUserId, onNavigate }: RecentRollsCardProps) {
  return (
    <div className="ov-rolls-card">
      <div className="ov-rolls-card__header">
        <span className="ov-rolls-card__icon" aria-hidden="true">⬡</span>
        <span className="ov-rolls-card__title">Rolagens recentes</span>
        <button
          className="btn btn-ghost ov-rolls-card__link"
          onClick={() => onNavigate('rolagem')}
        >
          Rolar dados →
        </button>
      </div>

      {rolls.length > 0 ? (
        <ul className="ov-rolls-list">
          {rolls.map((r) => (
            <li
              key={r.id}
              className={`ov-roll${r.user_id === currentUserId ? ' ov-roll--own' : ''}`}
            >
              <span className="ov-roll__formula">{r.formula ?? r.die_type}</span>
              <span className="ov-roll__meta">
                {r.user_id === currentUserId ? 'Você' : r.profile.display_name}
                {' · '}{formatRelativeTime(r.created_at)}
              </span>
              <span className="ov-roll__result">{r.result}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ov-rolls-card__empty">Nenhuma rolagem registrada ainda.</p>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────

export function CampaignOverviewPanel({
  campaign,
  currentUserId,
  onNavigate,
}: CampaignOverviewPanelProps) {
  const isMaster = campaign.role === 'master'

  return (
    <div className="overview">
      <div className="overview-intro">
        <h4 className="overview-intro__title">Resumo da campanha</h4>
        <p className="overview-intro__sub">
          Veja os principais dados e acesse rapidamente as áreas da campanha.
        </p>
      </div>

      {/* ── Descrição (quando existir) ── */}
      {campaign.description && (
        <div className="ov-description">
          <p className="ov-description__label">Descrição</p>
          <p className="ov-description__text">{campaign.description}</p>
        </div>
      )}

      {isMaster
        ? <MasterDashboard
            campaignId={campaign.id}
            currentUserId={currentUserId}
            onNavigate={onNavigate}
          />
        : <PlayerDashboard
            campaignId={campaign.id}
            currentUserId={currentUserId}
            onNavigate={onNavigate}
          />
      }
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Vista do mestre
// ────────────────────────────────────────────────────────

function MasterDashboard({
  campaignId,
  currentUserId,
  onNavigate,
}: {
  campaignId:    string
  currentUserId: string
  onNavigate:    (tab: TabId) => void
}) {
  const [data,    setData]    = useState<OverviewMasterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    getMasterOverview(campaignId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar a visão geral.'))
      .finally(() => setLoading(false))
  }, [campaignId])

  if (loading) return <OverviewLoading />
  if (error)   return <OverviewError message={error} />
  if (!data)   return null

  const master  = data.members.find((m) => m.role === 'master')
  const players = data.members.filter((m) => m.role === 'player')

  return (
    <div className="ov-dashboard">

      {/* ── Linha 1: cards de resumo ── */}
      <div className="ov-stats">

        <StatCard
          icon="⚔"
          title="Membros"
          action={{ label: 'Gerenciar membros', onClick: () => onNavigate('membros') }}
        >
          <div className="ov-stat__num">{data.members.length}</div>
          <div className="ov-stat__details">
            <span>{players.length} jogador{players.length !== 1 ? 'es' : ''}</span>
            {master && <span>Mestre: {master.profile.display_name}</span>}
            {data.onlineCount > 0 && (
              <span className="ov-stat__detail--online">● {data.onlineCount} online</span>
            )}
          </div>
        </StatCard>

        <StatCard
          icon="📜"
          title="Fichas"
          action={{ label: 'Ver fichas', onClick: () => onNavigate('ficha') }}
        >
          <div className="ov-stat__num">
            {data.sheetsFilled}
            <span className="ov-stat__denom">/{data.sheetsTotal}</span>
          </div>
          <div className="ov-stat__details">
            <span>preenchidas</span>
            {data.sheetsTotal > 0 && data.sheetsFilled < data.sheetsTotal && (
              <span className="ov-stat__detail--warn">
                {data.sheetsTotal - data.sheetsFilled} pendente{data.sheetsTotal - data.sheetsFilled !== 1 ? 's' : ''}
              </span>
            )}
            {data.sheetsTotal < players.length && (
              <span className="ov-stat__detail--warn">
                {players.length - data.sheetsTotal} sem ficha
              </span>
            )}
          </div>
        </StatCard>

        <StatCard
          icon="✦"
          title="Sessões"
          action={{ label: 'Ver sessões', onClick: () => onNavigate('sessoes') }}
        >
          <div className="ov-stat__num">{data.sessionsTotal}</div>
          <div className="ov-stat__details">
            <span>registrada{data.sessionsTotal !== 1 ? 's' : ''}</span>
            {data.latestSession && (
              <span className="ov-stat__detail--name">{data.latestSession.title}</span>
            )}
            {data.latestSession?.session_date && (
              <span>{formatDateShort(data.latestSession.session_date)}</span>
            )}
          </div>
        </StatCard>

      </div>

      {/* ── Linha 2: rolagens ── */}
      <RecentRollsCard
        rolls={data.recentRolls}
        currentUserId={currentUserId}
        onNavigate={onNavigate}
      />

    </div>
  )
}

// ────────────────────────────────────────────────────────
// Vista do jogador
// ────────────────────────────────────────────────────────

function PlayerDashboard({
  campaignId,
  currentUserId,
  onNavigate,
}: {
  campaignId:    string
  currentUserId: string
  onNavigate:    (tab: TabId) => void
}) {
  const [data,    setData]    = useState<OverviewPlayerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    getPlayerOverview(campaignId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar a visão geral.'))
      .finally(() => setLoading(false))
  }, [campaignId])

  if (loading) return <OverviewLoading />
  if (error)   return <OverviewError message={error} />
  if (!data)   return null

  const sheetFilled  = data.mySheet ? isSheetFilled(data.mySheet) : false
  const masterMember = data.members.find((m) => m.role === 'master')

  return (
    <div className="ov-dashboard">

      {/* ── Linha 1: cards de resumo ── */}
      <div className="ov-stats">

        <StatCard
          icon="📜"
          title="Minha ficha"
          action={{ label: 'Abrir ficha', onClick: () => onNavigate('ficha') }}
        >
          {data.mySheet ? (
            <>
              <div className="ov-stat__num ov-stat__num--sm">
                <span className={`ov-sheet-badge ${sheetFilled ? 'ov-sheet-badge--filled' : 'ov-sheet-badge--empty'}`}>
                  {sheetFilled ? 'Preenchida' : 'Incompleta'}
                </span>
              </div>
              <div className="ov-stat__details">
                {data.mySheet.character_name && (
                  <span className="ov-stat__detail--name">{data.mySheet.character_name}</span>
                )}
                {data.mySheet.archetype && <span>{data.mySheet.archetype}</span>}
                <span>Nível {data.mySheet.level} · {data.mySheet.hp_current}/{data.mySheet.hp_max} PV</span>
              </div>
            </>
          ) : (
            <p className="ov-stat__empty">Ficha não criada.</p>
          )}
        </StatCard>

        <StatCard
          icon="⚔"
          title="Membros"
          action={{ label: 'Ver membros', onClick: () => onNavigate('membros') }}
        >
          <div className="ov-stat__num">{data.members.length}</div>
          <div className="ov-stat__details">
            <span>na campanha</span>
            {masterMember && <span>Mestre: {masterMember.profile.display_name}</span>}
            {data.onlineCount > 0 && (
              <span className="ov-stat__detail--online">● {data.onlineCount} online</span>
            )}
          </div>
        </StatCard>

        <StatCard
          icon="✦"
          title="Sessões"
          action={{ label: 'Ver sessões', onClick: () => onNavigate('sessoes') }}
        >
          <div className="ov-stat__num">{data.sessionsTotal}</div>
          <div className="ov-stat__details">
            <span>registrada{data.sessionsTotal !== 1 ? 's' : ''}</span>
            {data.latestSession && (
              <span className="ov-stat__detail--name">{data.latestSession.title}</span>
            )}
            {data.latestSession?.session_date && (
              <span>{formatDateShort(data.latestSession.session_date)}</span>
            )}
          </div>
        </StatCard>

      </div>

      {/* ── Linha 2: rolagens ── */}
      <RecentRollsCard
        rolls={data.recentRolls}
        currentUserId={currentUserId}
        onNavigate={onNavigate}
      />

    </div>
  )
}

// ────────────────────────────────────────────────────────
// Sub-componentes de estado
// ────────────────────────────────────────────────────────

function OverviewLoading() {
  return (
    <div className="overview-state">
      <div className="spinner spinner--sm" />
      <span>Carregando visão geral...</span>
    </div>
  )
}

function OverviewError({ message }: { message: string }) {
  return (
    <div className="overview-state overview-state--error" role="alert">
      {message}
    </div>
  )
}
