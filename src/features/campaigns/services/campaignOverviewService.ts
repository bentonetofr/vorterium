import { getCampaignMembers } from '../../members/services/memberService'
import { getCampaignSessions } from '../../sessions/services/sessionService'
import { getCampaignPresence, isUserOnline } from '../../activity/services/activityService'
import { getCampaignNotesSummary } from '../../notes/services/noteService'
import type {
  CampaignMemberWithProfile,
  CampaignSession,
} from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────

export interface OverviewMasterData {
  members:            CampaignMemberWithProfile[]
  sessionsTotal:      number
  sessionsPlanned:    number
  sessionsCompleted:  number
  nextPlannedSession: CampaignSession | null
  onlineCount:        number
  notesTotal:         number
  latestNote:         { title: string; updated_at: string } | null
}

export interface OverviewPlayerData {
  members:            CampaignMemberWithProfile[]
  sessionsTotal:      number
  sessionsPlanned:    number
  sessionsCompleted:  number
  nextPlannedSession: CampaignSession | null
  onlineCount:        number
  notesTotal:         number
  latestNote:         { title: string; updated_at: string } | null
}

// ────────────────────────────────────────────────────────
// Utilitários
// ────────────────────────────────────────────────────────

/**
 * Retorna a próxima sessão planejada com data futura ou sem data.
 * Sessions chegam ordenadas por session_date desc, created_at desc.
 */
function findNextPlannedSession(sessions: CampaignSession[]): CampaignSession | null {
  // Data de HOJE no fuso da pessoa (toISOString é UTC: no Brasil, depois
  // das 21h já seria "amanhã" e a sessão de hoje sumia da visão geral).
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const planned = sessions.filter((s) => s.status === 'planned')

  // Preferir sessões planejadas com data >= hoje, ordenar por data asc (mais próxima primeiro)
  const upcoming = planned
    .filter((s) => s.session_date != null && s.session_date >= today)
    .sort((a, b) => (a.session_date! < b.session_date! ? -1 : 1))

  return upcoming[0] ?? planned.find((s) => !s.session_date) ?? null
}

// ────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────

/**
 * Carrega os dados da visão geral para o mestre.
 * Membros, sessões, presença e notas em paralelo (as fichas ficam no card da Sessão).
 */
export async function getMasterOverview(
  campaignId: string
): Promise<OverviewMasterData> {
  const [members, sessions, presence, notesSummary] = await Promise.all([
    getCampaignMembers(campaignId),
    getCampaignSessions(campaignId),
    getCampaignPresence(campaignId),
    getCampaignNotesSummary(campaignId).catch(() => ({ total: 0, latest: null })),
  ])

  const onlineCount = presence.filter((p) => isUserOnline(p.last_seen_at)).length

  return {
    members,
    sessionsTotal:      sessions.length,
    sessionsPlanned:    sessions.filter((s) => s.status === 'planned').length,
    sessionsCompleted:  sessions.filter((s) => s.status === 'completed').length,
    nextPlannedSession: findNextPlannedSession(sessions),
    onlineCount,
    notesTotal:         notesSummary.total,
    latestNote:         notesSummary.latest,
  }
}

/**
 * Carrega os dados da visão geral para o jogador.
 * Membros, sessões, presença e notas em paralelo (a ficha fica no card da Sessão).
 */
export async function getPlayerOverview(
  campaignId: string
): Promise<OverviewPlayerData> {
  const [members, sessions, presence, notesSummary] = await Promise.all([
    getCampaignMembers(campaignId),
    getCampaignSessions(campaignId),
    getCampaignPresence(campaignId),
    getCampaignNotesSummary(campaignId).catch(() => ({ total: 0, latest: null })),
  ])

  const onlineCount = presence.filter((p) => isUserOnline(p.last_seen_at)).length

  return {
    members,
    sessionsTotal:      sessions.length,
    sessionsPlanned:    sessions.filter((s) => s.status === 'planned').length,
    sessionsCompleted:  sessions.filter((s) => s.status === 'completed').length,
    nextPlannedSession: findNextPlannedSession(sessions),
    onlineCount,
    notesTotal:         notesSummary.total,
    latestNote:         notesSummary.latest,
  }
}
