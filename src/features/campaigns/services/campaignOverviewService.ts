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
  members:       CampaignMemberWithProfile[]
  recentRolls:   DiceRollWithProfile[]
  sheetsFilled:  number
  sheetsTotal:   number
  sessionsTotal: number
  latestSession: CampaignSession | null
  onlineCount:   number
}

export interface OverviewPlayerData {
  members:       CampaignMemberWithProfile[]
  recentRolls:   DiceRollWithProfile[]
  mySheet:       CharacterSheet | null
  sessionsTotal: number
  latestSession: CampaignSession | null
  onlineCount:   number
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
    sheetsTotal:   allSheets.length,
    sessionsTotal: sessions.length,
    latestSession: sessions[0] ?? null,
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
    sessionsTotal: sessions.length,
    latestSession: sessions[0] ?? null,
    onlineCount,
  }
}
