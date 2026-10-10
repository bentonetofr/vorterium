import { supabase, uniqueChannel } from '../../../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// Estado de furtividade da cena (tabela tda_scene, uma linha por campanha).
// Todos da campanha leem; só o mestre escreve (RLS). Sem linha, vale o
// padrão: Oculto, Atenção 2.
// ────────────────────────────────────────────────────────

export interface TdaScene {
  /** 0 Oculto, 1 Suspeito, 2 Alertado, 3 Caçado. */
  alert:     number
  /** Meta pra não ser notado (1 a 6). */
  attention: number
}

export const DEFAULT_SCENE: TdaScene = { alert: 0, attention: 2 }

const TABLE = 'tda_scene'

function fromRow(row: Partial<TdaScene> | null | undefined): TdaScene {
  return {
    alert:     Math.max(0, Math.min(3, Number(row?.alert ?? 0) || 0)),
    attention: Math.max(1, Math.min(6, Number(row?.attention ?? 2) || 2)),
  }
}

export async function getTdaScene(campaignId: string): Promise<TdaScene> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('alert, attention')
    .eq('campaign_id', campaignId)
    .maybeSingle()

  if (error) return DEFAULT_SCENE
  return fromRow(data as Partial<TdaScene> | null)
}

/** Só o mestre consegue (a RLS recusa o resto). */
export async function setTdaScene(campaignId: string, patch: Partial<TdaScene>): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .upsert({ campaign_id: campaignId, ...patch }, { onConflict: 'campaign_id' })

  if (error) throw new Error('Não foi possível atualizar a cena.')
}

export function subscribeToTdaScene(campaignId: string, onScene: (scene: TdaScene) => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`tda_scene:${campaignId}`))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `campaign_id=eq.${campaignId}` },
      (payload) => onScene(fromRow(payload.new as Partial<TdaScene>)),
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
