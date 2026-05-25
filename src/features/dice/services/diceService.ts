import { supabase } from '../../../shared/lib/supabase'
import type { DiceRoll, DiceRollWithProfile, DieType } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────

export const DIE_TYPES: DieType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

export function dieSides(dieType: DieType): number {
  return parseInt(dieType.slice(1), 10)
}

// ────────────────────────────────────────────────────────
// Tipos internos
// ────────────────────────────────────────────────────────

interface RawRollRow extends DiceRoll {
  profiles: { id: string; display_name: string }
}

// ────────────────────────────────────────────────────────
// Dice Service
// ────────────────────────────────────────────────────────

/**
 * Gera um resultado aleatório, persiste em `dice_rolls` e retorna o registro.
 * O resultado é calculado no cliente e validado pela constraint do banco
 * (dice_rolls_result_valid_range), que rejeita valores fora do intervalo do dado.
 */
export async function rollDie(
  campaignId: string,
  dieType: DieType
): Promise<DiceRoll> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const sides  = dieSides(dieType)
  const result = Math.floor(Math.random() * sides) + 1

  const { data, error } = await supabase
    .from('dice_rolls')
    .insert({ campaign_id: campaignId, user_id: user.id, die_type: dieType, result })
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível registrar a rolagem.')
  return data as DiceRoll
}

/**
 * Retorna as rolagens mais recentes da campanha com o nome do autor.
 */
export async function getRecentRolls(
  campaignId: string,
  limit = 40
): Promise<DiceRollWithProfile[]> {
  const { data, error } = await supabase
    .from('dice_rolls')
    .select('*, profiles(id, display_name)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error('Não foi possível carregar o histórico de rolagens.')
  if (!data || data.length === 0) return []

  return (data as unknown as RawRollRow[]).map((row) => ({
    id:          row.id,
    campaign_id: row.campaign_id,
    user_id:     row.user_id,
    die_type:    row.die_type,
    result:      row.result,
    created_at:  row.created_at,
    profile:     row.profiles,
  }))
}

// Nota: subscribeToRolls foi removido no MVP para reduzir uso do Supabase Realtime.
// O histórico é atualizado localmente após cada rolagem do próprio usuário.
// Realtime pode ser reativado em versões futuras quando necessário.
