import { getCampaignMembers } from '../../members/services/memberService'
import {
  getCampaignSheets,
  getMySheet,
  isSheetFilled,
} from '../../sheets/services/sheetService'
import { getCampaignRolls } from '../../dice/services/diceService'
import type {
  CampaignMemberWithProfile,
  CharacterSheet,
  DiceRollWithProfile,
} from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────

export interface OverviewMasterData {
  members:     CampaignMemberWithProfile[]
  recentRolls: DiceRollWithProfile[]
  sheetsFilled: number
  sheetsTotal:  number
}

export interface OverviewPlayerData {
  members:     CampaignMemberWithProfile[]
  recentRolls: DiceRollWithProfile[]
  mySheet:     CharacterSheet | null
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
  const [members, recentRolls, allSheets] = await Promise.all([
    getCampaignMembers(campaignId),
    getCampaignRolls(campaignId, 3),
    getCampaignSheets(campaignId),
  ])

  const sheetsFilled = allSheets.filter(isSheetFilled).length

  return {
    members,
    recentRolls,
    sheetsFilled,
    sheetsTotal: allSheets.length,
  }
}

/**
 * Carrega os dados da visão geral para o jogador.
 * Executa membros + rolagens + ficha própria em paralelo.
 */
export async function getPlayerOverview(
  campaignId: string
): Promise<OverviewPlayerData> {
  const [members, recentRolls, mySheet] = await Promise.all([
    getCampaignMembers(campaignId),
    getCampaignRolls(campaignId, 3),
    getMySheet(campaignId),
  ])

  return { members, recentRolls, mySheet }
}
