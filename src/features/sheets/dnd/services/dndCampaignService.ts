import { supabase } from '../../../../shared/lib/supabase'
import type { DndCampaignSettings, DndHpMode } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Configuração de D&D da campanha (dnd_campaign_settings, migration
// 20240205000000). Hoje: como o PV por nível é definido (média ou rolagem).
// Sem linha (ou sem a migration), vale a média.
// ────────────────────────────────────────────────────────

export const DEFAULT_HP_MODE: DndHpMode = 'average'

export async function getDndCampaignSettings(campaignId: string): Promise<DndCampaignSettings | null> {
  const { data, error } = await supabase
    .from('dnd_campaign_settings').select('*').eq('campaign_id', campaignId).maybeSingle()
  // Sem a migration ou sem acesso: a campanha usa o padrão.
  if (error) return null
  return (data as DndCampaignSettings | null) ?? null
}

export async function getDndHpMode(campaignId: string): Promise<DndHpMode> {
  return (await getDndCampaignSettings(campaignId))?.hp_mode ?? DEFAULT_HP_MODE
}

/** Só o mestre muda (a RLS recusa os outros). */
export async function setDndHpMode(campaignId: string, mode: DndHpMode): Promise<DndCampaignSettings> {
  const { data, error } = await supabase
    .from('dnd_campaign_settings')
    .upsert({ campaign_id: campaignId, hp_mode: mode }, { onConflict: 'campaign_id' })
    .select('*')
    .single()
  if (error) throw new Error('Não foi possível salvar a regra de PV da campanha.')
  return data as DndCampaignSettings
}
