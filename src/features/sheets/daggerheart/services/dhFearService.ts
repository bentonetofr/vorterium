import { useCallback, useEffect, useState } from 'react'
import { supabase, uniqueChannel } from '../../../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// O Medo do mestre (migration 20240240): um contador de 0 a 12 que todos da campanha veem. O mestre muda à vontade;
// quem rola com Medo soma 1 (função dh_fear_gain, que qualquer membro pode chamar).
// ────────────────────────────────────────────────────────

export const FEAR_MAX = 12

export async function getFear(campaignId: string): Promise<number> {
  const { data, error } = await supabase.from('dh_fear').select('value').eq('campaign_id', campaignId).maybeSingle()
  if (error) throw new Error('Não foi possível ler o Medo.')
  return data?.value ?? 0
}

export async function setFear(campaignId: string, value: number): Promise<number> {
  const v = Math.max(0, Math.min(FEAR_MAX, Math.round(value)))
  const { error } = await supabase.from('dh_fear').upsert({ campaign_id: campaignId, value: v }, { onConflict: 'campaign_id' })
  if (error) throw new Error('Não foi possível mudar o Medo.')
  return v
}

/** Soma Medo (o que acontece quando alguém rola com Medo). Devolve o valor novo. */
export async function gainFear(campaignId: string, amount = 1): Promise<number> {
  const { data, error } = await supabase.rpc('dh_fear_gain', { p_campaign: campaignId, p_amount: amount })
  if (error) throw new Error('Não foi possível somar o Medo.')
  return Number(data)
}

/** O Medo ao vivo. `loaded` fica false até a primeira leitura; `failed` quando a migration ainda não rodou. */
export function useFear(campaignId: string): { value: number; loaded: boolean; failed: boolean; set: (v: number) => Promise<void> } {
  const [value, setValue] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    void getFear(campaignId).then((v) => { if (alive) { setValue(v); setLoaded(true); setFailed(false) } }).catch(() => { if (alive) { setFailed(true); setLoaded(true) } })
    const channel = supabase
      .channel(uniqueChannel(`dh_fear:${campaignId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dh_fear', filter: `campaign_id=eq.${campaignId}` },
        (payload) => { const row = payload.new as { value?: number } | null; if (alive && row && typeof row.value === 'number') setValue(row.value) })
      .subscribe()
    return () => { alive = false; void supabase.removeChannel(channel) }
  }, [campaignId])

  const set = useCallback(async (v: number) => {
    const before = value
    const next = Math.max(0, Math.min(FEAR_MAX, v))
    setValue(next)
    try { await setFear(campaignId, next) } catch (e) { setValue(before); throw e }
  }, [campaignId, value])

  return { value, loaded, failed, set }
}
