import { useEffect, useState } from 'react'
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
// Utilitário
// ────────────────────────────────────────────────────────

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
      {/* ── Cabeçalho discreto ── */}
      <div className="overview-intro">
        <h4 className="overview-intro__title">Resumo da campanha</h4>
        <p className="overview-intro__sub">
          Veja os principais dados e acesse rapidamente as áreas da campanha.
        </p>
      </div>

      {/* ── Cards ── */}
      {isMaster
        ? <MasterCards campaignId={campaign.id} onNavigate={onNavigate} />
        : <PlayerCards campaignId={campaign.id} currentUserId={currentUserId} onNavigate={onNavigate} />
      }
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Vista do mestre
// ────────────────────────────────────────────────────────

function MasterCards({
  campaignId,
  onNavigate,
}: {
  campaignId: string
  onNavigate: (tab: TabId) => void
}) {
  const [data, setData]     = useState<OverviewMasterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

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
    <div className="overview-grid">

      {/* ── Membros ── */}
      <div className="overview-card">
        <div className="overview-card__header">
          <span className="overview-card__icon" aria-hidden="true">⚔</span>
          <span className="overview-card__title">Membros</span>
        </div>
        <div className="overview-card__body">
          <div className="overview-card__stat">{data.members.length}</div>
          <div className="overview-card__details">
            <span>{players.length} jogador{players.length !== 1 ? 'es' : ''}</span>
            {master && <span>Mestre: {master.profile.display_name}</span>}
          </div>
        </div>
        <button
          className="btn btn-ghost overview-card__action"
          onClick={() => onNavigate('membros')}
        >
          Gerenciar membros →
        </button>
      </div>

      {/* ── Fichas ── */}
      <div className="overview-card">
        <div className="overview-card__header">
          <span className="overview-card__icon" aria-hidden="true">📜</span>
          <span className="overview-card__title">Fichas</span>
        </div>
        <div className="overview-card__body">
          <div className="overview-card__stat">
            {data.sheetsFilled}
            <span className="overview-card__stat-denom">/{data.sheetsTotal}</span>
          </div>
          <div className="overview-card__details">
            <span>preenchidas</span>
            {data.sheetsTotal < players.length && (
              <span className="overview-card__detail--warn">
                {players.length - data.sheetsTotal} sem ficha criada
              </span>
            )}
            {data.sheetsTotal > 0 && data.sheetsFilled < data.sheetsTotal && (
              <span className="overview-card__detail--warn">
                {data.sheetsTotal - data.sheetsFilled} não preenchida{data.sheetsTotal - data.sheetsFilled !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <button
          className="btn btn-ghost overview-card__action"
          onClick={() => onNavigate('ficha')}
        >
          Ver fichas →
        </button>
      </div>

      {/* ── Rolagens ── */}
      <div className="overview-card">
        <div className="overview-card__header">
          <span className="overview-card__icon" aria-hidden="true">⬡</span>
          <span className="overview-card__title">Rolagens</span>
        </div>
        <div className="overview-card__body">
          {data.recentRolls.length > 0 ? (
            <ul className="overview-rolls">
              {data.recentRolls.map((r) => (
                <li key={r.id} className="overview-rolls__item">
                  <span className="overview-rolls__formula">{r.formula ?? r.die_type}</span>
                  <span className="overview-rolls__result">{r.result}</span>
                  <span className="overview-rolls__meta">
                    {r.profile.display_name} · {formatRelativeTime(r.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="overview-card__empty">Nenhuma rolagem registrada ainda.</p>
          )}
        </div>
        <button
          className="btn btn-ghost overview-card__action"
          onClick={() => onNavigate('rolagem')}
        >
          Rolar dados →
        </button>
      </div>

      {/* ── Configurações ── */}
      <div className="overview-card overview-card--slim">
        <div className="overview-card__header">
          <span className="overview-card__icon" aria-hidden="true">◈</span>
          <span className="overview-card__title">Configurações</span>
        </div>
        <div className="overview-card__body">
          <p className="overview-card__desc">
            Edite dados da campanha, exclua a campanha ou saia da campanha, conforme sua permissão.
          </p>
        </div>
        <button
          className="btn btn-ghost overview-card__action"
          onClick={() => onNavigate('configuracoes')}
        >
          Abrir configurações →
        </button>
      </div>

    </div>
  )
}

// ────────────────────────────────────────────────────────
// Vista do jogador
// ────────────────────────────────────────────────────────

function PlayerCards({
  campaignId,
  currentUserId,
  onNavigate,
}: {
  campaignId:    string
  currentUserId: string
  onNavigate:    (tab: TabId) => void
}) {
  const [data, setData]     = useState<OverviewPlayerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    getPlayerOverview(campaignId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar a visão geral.'))
      .finally(() => setLoading(false))
  }, [campaignId])

  if (loading) return <OverviewLoading />
  if (error)   return <OverviewError message={error} />
  if (!data)   return null

  const sheetFilled = data.mySheet ? isSheetFilled(data.mySheet) : false

  return (
    <div className="overview-grid">

      {/* ── Minha ficha ── */}
      <div className="overview-card">
        <div className="overview-card__header">
          <span className="overview-card__icon" aria-hidden="true">📜</span>
          <span className="overview-card__title">Minha ficha</span>
        </div>
        <div className="overview-card__body">
          {data.mySheet ? (
            <>
              <div className="overview-card__stat overview-card__stat--sm">
                <span className={`sheet-filled-badge ${sheetFilled ? 'sheet-filled-badge--filled' : 'sheet-filled-badge--empty'}`}>
                  {sheetFilled ? 'Preenchida' : 'Não preenchida'}
                </span>
              </div>
              <div className="overview-card__details">
                {data.mySheet.character_name && (
                  <span className="overview-card__detail--name">{data.mySheet.character_name}</span>
                )}
                {data.mySheet.archetype && <span>{data.mySheet.archetype}</span>}
                <span>Nível {data.mySheet.level} · {data.mySheet.hp_current}/{data.mySheet.hp_max} PV</span>
              </div>
            </>
          ) : (
            <p className="overview-card__empty">Ficha ainda não criada.</p>
          )}
        </div>
        <button
          className="btn btn-ghost overview-card__action"
          onClick={() => onNavigate('ficha')}
        >
          Abrir ficha →
        </button>
      </div>

      {/* ── Membros ── */}
      <div className="overview-card">
        <div className="overview-card__header">
          <span className="overview-card__icon" aria-hidden="true">⚔</span>
          <span className="overview-card__title">Membros</span>
        </div>
        <div className="overview-card__body">
          <div className="overview-card__stat">{data.members.length}</div>
          <div className="overview-card__details">
            <span>na campanha</span>
            {data.members.find((m) => m.role === 'master') && (
              <span>Mestre: {data.members.find((m) => m.role === 'master')!.profile.display_name}</span>
            )}
          </div>
        </div>
        <button
          className="btn btn-ghost overview-card__action"
          onClick={() => onNavigate('membros')}
        >
          Ver membros →
        </button>
      </div>

      {/* ── Rolagens ── */}
      <div className="overview-card">
        <div className="overview-card__header">
          <span className="overview-card__icon" aria-hidden="true">⬡</span>
          <span className="overview-card__title">Rolagens recentes</span>
        </div>
        <div className="overview-card__body">
          {data.recentRolls.length > 0 ? (
            <ul className="overview-rolls">
              {data.recentRolls.map((r) => (
                <li
                  key={r.id}
                  className={`overview-rolls__item ${r.user_id === currentUserId ? 'overview-rolls__item--own' : ''}`}
                >
                  <span className="overview-rolls__formula">{r.formula ?? r.die_type}</span>
                  <span className="overview-rolls__result">{r.result}</span>
                  <span className="overview-rolls__meta">
                    {r.user_id === currentUserId ? 'Você' : r.profile.display_name}
                    {' · '}{formatRelativeTime(r.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="overview-card__empty">Nenhuma rolagem registrada ainda.</p>
          )}
        </div>
        <button
          className="btn btn-ghost overview-card__action"
          onClick={() => onNavigate('rolagem')}
        >
          Rolar dados →
        </button>
      </div>

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
