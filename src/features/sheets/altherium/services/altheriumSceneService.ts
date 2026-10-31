import { supabase, uniqueChannel } from '../../../../shared/lib/supabase'
import { scarcityDef, locationDef, type LocationId, type ScarcityId } from '../utils/altheriumExplore'
import { DEFAULT_DTS, type EnemyState, type StealthDts } from '../utils/altheriumStealth'

// ────────────────────────────────────────────────────────
// Cena da campanha (tabela altherium_scene, uma linha por campanha, migration
// 20240218): o estado dos inimigos e as três DTs da Furtividade, e o Local, a
// Escassez e o clima da Exploração. Todos leem; o mestre define a cena e os
// testes de Furtividade que falham sobem o estado sozinhos. Sem linha (ou sem
// a tabela), vale o padrão.
// ────────────────────────────────────────────────────────

export interface AltheriumScene {
  enemy:    EnemyState
  dts:      StealthDts
  wasAlert: boolean
  location: LocationId
  scarcity: ScarcityId
  /** 'noite', 'chuva' e 'tempestade' marcados na cena (condições da exploração). */
  weather:  string[]
}

export const DEFAULT_SCENE: AltheriumScene = {
  enemy: 'desatento', dts: DEFAULT_DTS, wasAlert: false, location: 'floresta', scarcity: 'normal', weather: [],
}

const TABLE = 'altherium_scene'
const WEATHER = new Set(['noite', 'chuva', 'tempestade'])

interface Row {
  enemy_state?:  string
  dt_desatento?: number
  dt_atento?:    number
  dt_alerta?:    number
  was_alert?:    boolean
  location?:     string
  scarcity?:     string
  weather?:      string
}

function dt(v: unknown, fallback: number): number {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n >= 1 ? Math.min(30, n) : fallback
}

function fromRow(row: Row | null | undefined): AltheriumScene {
  if (!row) return DEFAULT_SCENE
  const enemy = row.enemy_state === 'atento' || row.enemy_state === 'alerta' ? row.enemy_state : 'desatento'
  return {
    enemy,
    dts: {
      desatento: dt(row.dt_desatento, DEFAULT_DTS.desatento),
      atento:    dt(row.dt_atento, DEFAULT_DTS.atento),
      alerta:    dt(row.dt_alerta, DEFAULT_DTS.alerta),
    },
    wasAlert: !!row.was_alert,
    location: locationDef(row.location ?? '').id,
    scarcity: scarcityDef(row.scarcity ?? '').id,
    weather:  (row.weather ?? '').split(',').map((w) => w.trim()).filter((w) => WEATHER.has(w)),
  }
}

function toRow(p: Partial<AltheriumScene>): Row {
  const out: Row = {}
  if (p.enemy !== undefined) out.enemy_state = p.enemy
  if (p.dts) { out.dt_desatento = p.dts.desatento; out.dt_atento = p.dts.atento; out.dt_alerta = p.dts.alerta }
  if (p.wasAlert !== undefined) out.was_alert = p.wasAlert
  if (p.location !== undefined) out.location = p.location
  if (p.scarcity !== undefined) out.scarcity = p.scarcity
  if (p.weather !== undefined) out.weather = p.weather.join(',')
  return out
}

export async function getAltheriumScene(campaignId: string): Promise<AltheriumScene> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('campaign_id', campaignId).maybeSingle()
  if (error) return DEFAULT_SCENE
  return fromRow(data as Row | null)
}

export async function setAltheriumScene(campaignId: string, patch: Partial<AltheriumScene>): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert({ campaign_id: campaignId, ...toRow(patch) }, { onConflict: 'campaign_id' })
  if (error) throw new Error('Não foi possível atualizar a cena (a migration 20240218 já rodou?).')
}

export function subscribeToAltheriumScene(campaignId: string, onScene: (scene: AltheriumScene) => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`altherium_scene:${campaignId}`))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `campaign_id=eq.${campaignId}` },
      (payload) => onScene(fromRow(payload.new as Row)),
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
