import { supabase } from '../../../shared/lib/supabase'
import { rollDice, rollEvensTest } from '../../dice/services/diceService'
import type { InitiativeParticipant, InitiativeState } from '../../../shared/types'
import type { CampaignSystem } from '../../../shared/constants/systems'

// ────────────────────────────────────────────────────────
// Leitura
// ────────────────────────────────────────────────────────

/** Participantes do combate atual, já ordenados: maior iniciativa primeiro, sem valor por último. */
export async function getInitiativeParticipants(campaignId: string): Promise<InitiativeParticipant[]> {
  const { data, error } = await supabase
    .from('campaign_initiative_participants')
    .select('id, campaign_id, user_id, name, initiative_value, created_at')
    .eq('campaign_id', campaignId)
    .order('initiative_value', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) throw new Error('Não foi possível carregar os participantes.')
  return (data ?? []) as InitiativeParticipant[]
}

/** null quando não há combate ativo nesta campanha. */
export async function getInitiativeState(campaignId: string): Promise<InitiativeState | null> {
  const { data, error } = await supabase
    .from('campaign_initiative_state')
    .select('campaign_id, round_number, current_turn_participant_id')
    .eq('campaign_id', campaignId)
    .maybeSingle()

  if (error) throw new Error('Não foi possível carregar o estado do combate.')
  return data as InitiativeState | null
}

// ────────────────────────────────────────────────────────
// Escrita
// ────────────────────────────────────────────────────────

/** Popula com os membros atuais da campanha (RPC ignora quem já está na lista) e zera a rodada. */
export async function startInitiativeEncounter(campaignId: string): Promise<void> {
  const { error } = await supabase.rpc('start_initiative_encounter', { campaign_id_input: campaignId })
  if (error) throw new Error('Não foi possível iniciar o combate.')
}

/** Passa a vez pro próximo na ordem (soma uma rodada ao dar a volta). */
export async function advanceInitiativeTurn(campaignId: string): Promise<void> {
  const { error } = await supabase.rpc('advance_initiative_turn', { campaign_id_input: campaignId })
  if (error) throw new Error('Não foi possível avançar o turno.')
}

/** Remove todos os participantes e o estado do combate. */
export async function endInitiativeEncounter(campaignId: string): Promise<void> {
  const { error } = await supabase.rpc('end_initiative_encounter', { campaign_id_input: campaignId })
  if (error) throw new Error('Não foi possível encerrar o combate.')
}

/** Adiciona um NPC/monstro (sem user_id), sem iniciativa ainda. */
export async function addInitiativeParticipant(campaignId: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Digite um nome.')

  const { error } = await supabase
    .from('campaign_initiative_participants')
    .insert({ campaign_id: campaignId, name: trimmed, user_id: null })

  if (error) throw new Error('Não foi possível adicionar o participante.')
}

/** Define o valor de iniciativa diretamente — RLS decide quem pode (dono da linha ou mestre). */
export async function setInitiativeValue(participantId: string, value: number): Promise<void> {
  const { error } = await supabase
    .from('campaign_initiative_participants')
    .update({ initiative_value: value })
    .eq('id', participantId)

  if (error) throw new Error('Não foi possível atualizar a iniciativa.')
}

export async function removeInitiativeParticipant(participantId: string): Promise<void> {
  const { error } = await supabase
    .from('campaign_initiative_participants')
    .delete()
    .eq('id', participantId)

  if (error) throw new Error('Não foi possível remover o participante.')
}

/**
 * Rola a iniciativa usando o rolador de dados já existente — grava
 * normalmente em dice_rolls, aparece no histórico e na notificação como
 * qualquer outra rolagem — e grava o resultado no valor de iniciativa.
 * O dado segue o sistema: d10 em Altherium (o dado de teste do livro),
 * teste de pares com o dado natural em Terra Devastada (quem tem
 * características de iniciativa soma à mão), d20 nos demais. Sem
 * modificador automático; quem quiser somar um bônus pode clicar no valor
 * depois de rolar e ajustar à mão.
 */
export async function rollInitiative(campaignId: string, participantId: string, system: CampaignSystem): Promise<void> {
  const roll = system === 'terra_devastada'
    ? await rollEvensTest(campaignId, 1)
    : await rollDice(campaignId, system === 'altherium' ? '1d10' : '1d20')
  await setInitiativeValue(participantId, roll.result)
}

// ────────────────────────────────────────────────────────
// Realtime
// ────────────────────────────────────────────────────────

/**
 * Assina mudanças de participantes e do estado do combate. O payload de
 * participantes não traz o que mudou exatamente — quem chama simplesmente
 * recarrega a lista inteira (poucos participantes, sem paginação, então um
 * full-refetch por evento é simples e evita qualquer risco de estado
 * dessincronizado). O estado já vem com todas as colunas precisando —
 * `null` sinaliza que o combate foi encerrado (linha apagada).
 */
export function subscribeToInitiative(
  campaignId: string,
  onParticipantsChange: () => void,
  onStateChange: (state: InitiativeState | null) => void,
): () => void {
  const channel = supabase
    .channel(`campaign_initiative:${campaignId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'campaign_initiative_participants', filter: `campaign_id=eq.${campaignId}` },
      () => onParticipantsChange(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'campaign_initiative_state', filter: `campaign_id=eq.${campaignId}` },
      (payload) => {
        onStateChange(payload.eventType === 'DELETE' ? null : (payload.new as InitiativeState))
      },
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
