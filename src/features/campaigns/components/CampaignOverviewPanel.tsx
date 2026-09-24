import { type ReactNode, useEffect, useState } from 'react'
import {
  getMasterOverview,
  getPlayerOverview,
  type OverviewMasterData,
  type OverviewPlayerData,
} from '../services/campaignOverviewService'
import { getCampaignSheets, getMySheet } from '../../sheets/services/sheetService'
import { getCampaignAltheriumSheets } from '../../sheets/altherium/services/altheriumSheetService'
import {
  getInitiativeParticipants,
  getInitiativeState,
  subscribeToInitiative,
} from '../../initiative/services/initiativeService'
import { useCurrentCampaign } from '../CurrentCampaignContext'
import type { CampaignWithRole, InitiativeParticipant, InitiativeState } from '../../../shared/types'
import type { TabId, SessionSubTabId } from '../campaignSections'
import './CampaignOverviewPanel.css'

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface CampaignOverviewPanelProps {
  campaign:   CampaignWithRole
  onNavigate: (tab: TabId, sessionSubTab?: SessionSubTabId) => void
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
// SessionTableCard — resumo da Mesa da Sessão: combate (ao vivo, pelo
// Realtime da iniciativa), fichas na mesa e mensagens novas no chat.
// ────────────────────────────────────────────────────────

interface SessionTableCardProps {
  campaign:   CampaignWithRole
  onNavigate: (tab: TabId, sessionSubTab?: SessionSubTabId) => void
}

type SheetsSummary = { kind: 'master'; count: number } | { kind: 'player'; name: string | null; exists: boolean }

async function loadSheetsSummary(campaign: CampaignWithRole): Promise<SheetsSummary> {
  const isMaster = campaign.role === 'master'
  if (campaign.system === 'altherium') {
    // RLS: o mestre recebe todas as fichas da campanha; o jogador só a dele.
    const sheets = await getCampaignAltheriumSheets(campaign.id)
    return isMaster
      ? { kind: 'master', count: sheets.length }
      : { kind: 'player', exists: sheets.length > 0, name: sheets[0]?.character_name ?? null }
  }
  if (isMaster) return { kind: 'master', count: (await getCampaignSheets(campaign.id)).length }
  const mine = await getMySheet(campaign.id)
  return { kind: 'player', exists: !!mine, name: mine?.character_name ?? null }
}

function SessionTableCard({ campaign, onNavigate }: SessionTableCardProps) {
  const { chatUnread } = useCurrentCampaign()
  const [combat, setCombat]             = useState<InitiativeState | null>(null)
  const [participants, setParticipants] = useState<InitiativeParticipant[]>([])
  const [sheets, setSheets]             = useState<SheetsSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadParticipants = () => {
      getInitiativeParticipants(campaign.id).then((p) => { if (!cancelled) setParticipants(p) }).catch(() => {})
    }
    getInitiativeState(campaign.id).then((s) => { if (!cancelled) setCombat(s) }).catch(() => {})
    loadParticipants()
    loadSheetsSummary(campaign).then((s) => { if (!cancelled) setSheets(s) }).catch(() => {})
    const unsubscribe = subscribeToInitiative(campaign.id, loadParticipants, setCombat)
    return () => { cancelled = true; unsubscribe() }
  }, [campaign])

  const currentTurn = combat?.current_turn_participant_id
    ? participants.find((p) => p.id === combat.current_turn_participant_id)?.name ?? null
    : null

  return (
    <StatCard
      icon="⚜"
      title="Mesa da Sessão"
      action={{ label: 'Abrir mesa', onClick: () => onNavigate('mesa-sessao') }}
    >
      <div className="ov-stat__num ov-stat__num--sm">
        <span className={`ov-table-badge ${combat ? 'ov-table-badge--combat' : 'ov-table-badge--idle'}`}>
          {combat ? '⚔ Em combate' : 'Sem combate'}
        </span>
      </div>
      <div className="ov-stat__details">
        {combat && (
          <span>
            Rodada {combat.round_number}
            {currentTurn && <> · vez de <strong className="ov-stat__detail--name">{currentTurn}</strong></>}
          </span>
        )}
        {!combat && participants.length > 0 && (
          <span>{participants.length} na iniciativa</span>
        )}
        {sheets?.kind === 'master' && (
          <span>{sheets.count} ficha{sheets.count !== 1 ? 's' : ''} na mesa</span>
        )}
        {sheets?.kind === 'player' && (
          sheets.exists
            ? <span>Sua ficha: <strong className="ov-stat__detail--name">{sheets.name || 'Sem nome'}</strong></span>
            : <span className="ov-stat__detail--warn">Você ainda não criou sua ficha</span>
        )}
        {chatUnread > 0
          ? <span className="ov-stat__detail--warn">{chatUnread} mensage{chatUnread !== 1 ? 'ns novas' : 'm nova'} no chat</span>
          : <span>Chat em dia</span>}
      </div>
    </StatCard>
  )
}

// ────────────────────────────────────────────────────────
// OverviewNotesCard
// ────────────────────────────────────────────────────────

interface OverviewNotesCardProps {
  notesTotal:  number
  latestNote:  { title: string; updated_at: string } | null
  onNavigate:  (tab: TabId, sessionSubTab?: SessionSubTabId) => void
}

function OverviewNotesCard({ notesTotal, latestNote, onNavigate }: OverviewNotesCardProps) {
  return (
    <div className="ov-notes-card">
      <div className="ov-notes-card__header">
        <span className="ov-notes-card__icon" aria-hidden="true">◇</span>
        <span className="ov-notes-card__title">Notas</span>
        <button
          className="btn btn-ghost ov-notes-card__link"
          onClick={() => onNavigate('notas')}
        >
          Ver notas →
        </button>
      </div>
      {notesTotal === 0 ? (
        <p className="ov-notes-card__empty">Nenhuma nota registrada ainda.</p>
      ) : (
        <div className="ov-notes-card__body">
          <span>{notesTotal} nota{notesTotal !== 1 ? 's' : ''}</span>
          {latestNote && (
            <>
              <span className="ov-notes-card__sep">·</span>
              <span className="ov-notes-card__latest-title" title={latestNote.title}>
                {latestNote.title}
              </span>
              <span className="ov-notes-card__sep">·</span>
              <span className="ov-notes-card__latest-time">
                {formatRelativeTime(latestNote.updated_at)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────

export function CampaignOverviewPanel({
  campaign,
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
            campaign={campaign}
            onNavigate={onNavigate}
          />
        : <PlayerDashboard
            campaign={campaign}
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
  campaign,
  onNavigate,
}: {
  campaign:   CampaignWithRole
  onNavigate: (tab: TabId, sessionSubTab?: SessionSubTabId) => void
}) {
  const campaignId = campaign.id
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

        <SessionTableCard campaign={campaign} onNavigate={onNavigate} />

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
          icon="✦"
          title="Sessões"
          action={{ label: 'Ver sessões', onClick: () => onNavigate('sessoes') }}
        >
          <div className="ov-stat__num">{data.sessionsTotal}</div>
          <div className="ov-stat__details">
            {data.sessionsTotal === 0 ? (
              <span>nenhuma registrada</span>
            ) : (
              <>
                {data.sessionsPlanned > 0 && (
                  <span>{data.sessionsPlanned} planejada{data.sessionsPlanned !== 1 ? 's' : ''}</span>
                )}
                {data.sessionsCompleted > 0 && (
                  <span>{data.sessionsCompleted} concluída{data.sessionsCompleted !== 1 ? 's' : ''}</span>
                )}
                {data.nextPlannedSession && (
                  <span className="ov-stat__detail--name">
                    Próxima: {data.nextPlannedSession.title}
                  </span>
                )}
                {data.nextPlannedSession?.session_date && (
                  <span>{formatDateShort(data.nextPlannedSession.session_date)}</span>
                )}
              </>
            )}
          </div>
        </StatCard>

      </div>

      {/* ── Linha 2: notas ── */}
      <OverviewNotesCard
        notesTotal={data.notesTotal}
        latestNote={data.latestNote}
        onNavigate={onNavigate}
      />

    </div>
  )
}

// ────────────────────────────────────────────────────────
// Vista do jogador
// ────────────────────────────────────────────────────────

function PlayerDashboard({
  campaign,
  onNavigate,
}: {
  campaign:   CampaignWithRole
  onNavigate: (tab: TabId, sessionSubTab?: SessionSubTabId) => void
}) {
  const campaignId = campaign.id
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

  const masterMember = data.members.find((m) => m.role === 'master')

  return (
    <div className="ov-dashboard">

      {/* ── Linha 1: cards de resumo ── */}
      <div className="ov-stats">

        <SessionTableCard campaign={campaign} onNavigate={onNavigate} />

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
            {data.sessionsTotal === 0 ? (
              <span>nenhuma registrada</span>
            ) : (
              <>
                {data.sessionsPlanned > 0 && (
                  <span>{data.sessionsPlanned} planejada{data.sessionsPlanned !== 1 ? 's' : ''}</span>
                )}
                {data.sessionsCompleted > 0 && (
                  <span>{data.sessionsCompleted} concluída{data.sessionsCompleted !== 1 ? 's' : ''}</span>
                )}
                {data.nextPlannedSession && (
                  <span className="ov-stat__detail--name">
                    Próxima: {data.nextPlannedSession.title}
                  </span>
                )}
                {data.nextPlannedSession?.session_date && (
                  <span>{formatDateShort(data.nextPlannedSession.session_date)}</span>
                )}
              </>
            )}
          </div>
        </StatCard>

      </div>

      {/* ── Linha 2: notas ── */}
      <OverviewNotesCard
        notesTotal={data.notesTotal}
        latestNote={data.latestNote}
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
