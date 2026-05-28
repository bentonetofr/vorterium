import { getCampaignMembers } from '../../members/services/memberService'
import {
  getCampaignSheets,
  getMySheet,
  isSheetFilled,
} from '../../sheets/services/sheetService'
import { getCampaignRolls } from '../../dice/services/diceService'
import { getCampaignSessions } from '../../sessions/services/sessionService'
import { getCampaignPresence, isUserOnline } from '../../activity/services/activityService'
import type {
  CampaignMemberWithProfile,
  CampaignSession,
  CharacterSheet,
  DiceRollWithProfile,
} from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────

export interface OverviewMasterData {
  members:            CampaignMemberWithProfile[]
  recentRolls:        DiceRollWithProfile[]
  sheetsFilled:       number
  sheetsTotal:        number
  sessionsTotal:      number
  sessionsPlanned:    number
  sessionsCompleted:  number
  nextPlannedSession: CampaignSession | null
  onlineCount:        number
}

export interface OverviewPlayerData {
  members:            CampaignMemberWithProfile[]
  recentRolls:        DiceRollWithProfile[]
  mySheet:            CharacterSheet | null
  sessionsTotal:      number
  sessionsPlanned:    number
  sessionsCompleted:  number
  nextPlannedSession: CampaignSession | null
  onlineCount:        number
}

// ────────────────────────────────────────────────────────
// Utilitários
// ────────────────────────────────────────────────────────

/**
 * Retorna a próxima sessão planejada com data futura ou sem data.
 * Sessions chegam ordenadas por session_date desc, created_at desc.
 */
function findNextPlannedSession(sessions: CampaignSession[]): CampaignSession | null {
  const today = new Date().toISOString().split('T')[0]
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
 * Executa membros + rolagens em paralelo; fichas em seguida.
 */
export async function getMasterOverview(
  campaignId: string
): Promise<OverviewMasterData> {
  const [members, recentRolls, allSheets, sessions, presence] = await Promise.all([
    getCampaignMembers(campaignId),
    getCampaignRolls(campaignId, 3),
    getCampaignSheets(campaignId),
    getCampaignSessions(campaignId),
    getCampaignPresence(campaignId),
  ])

  const sheetsFilled = allSheets.filter(isSheetFilled).length
  const onlineCount  = presence.filter((p) => isUserOnline(p.last_seen_at)).length

  return {
    members,
    recentRolls,
    sheetsFilled,
    sheetsTotal:        allSheets.length,
    sessionsTotal:      sessions.length,
    sessionsPlanned:    sessions.filter((s) => s.status === 'planned').length,
    sessionsCompleted:  sessions.filter((s) => s.status === 'completed').length,
    nextPlannedSession: findNextPlannedSession(sessions),
    onlineCount,
  }
}

/**
 * Carrega os dados da visão geral para o jogador.
 * Executa membros + rolagens + ficha própria em paralelo.
 */
export async function getPlayerOverview(
  campaignId: string
): Promise<OverviewPlayerData> {
  const [members, recentRolls, mySheet, sessions, presence] = await Promise.all([
    getCampaignMembers(campaignId),
    getCampaignRolls(campaignId, 3),
    getMySheet(campaignId),
    getCampaignSessions(campaignId),
    getCampaignPresence(campaignId),
  ])

  const onlineCount = presence.filter((p) => isUserOnline(p.last_seen_at)).length

  return {
    members,
    recentRolls,
    mySheet,
    sessionsTotal:      sessions.length,
    sessionsPlanned:    sessions.filter((s) => s.status === 'planned').length,
    sessionsCompleted:  sessions.filter((s) => s.status === 'completed').length,
    nextPlannedSession: findNextPlannedSession(sessions),
    onlineCount,
  }
}
