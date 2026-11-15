import { supabase } from '../../../shared/lib/supabase'
import type { SessionReason } from './liveSession'

// ────────────────────────────────────────────────────────
// As sessões abertas agora nas campanhas da pessoa (RPC my_open_sessions, migration 20240235). Serve ao aviso "a sessão está aberta"
// que aparece pros jogadores em qualquer página do site (SessionOpenNotice).
// ────────────────────────────────────────────────────────

export interface OpenSession {
  campaignId: string
  campaignName: string
  role: 'master' | 'player'
  reason: SessionReason
}

export function parseOpenSessions(raw: unknown): OpenSession[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((r): OpenSession[] => {
    const x = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>
    const reason = x.reason === 'manual' || x.reason === 'scheduled' || x.reason === 'together' ? x.reason : null
    if (typeof x.campaign_id !== 'string' || !reason) return []
    return [{ campaignId: x.campaign_id, campaignName: typeof x.campaign_name === 'string' ? x.campaign_name : 'Campanha', role: x.role === 'master' ? 'master' : 'player', reason }]
  })
}

/** Quais sessões abertas ainda não foram anunciadas, e o que lembrar: quem fechou sai da lista, pra avisar de novo se abrir outra vez. */
export function reconcileAnnounced(announced: ReadonlySet<string>, open: readonly OpenSession[]): { announce: OpenSession[]; announced: Set<string> } {
  const openIds = new Set(open.map((o) => o.campaignId))
  const kept = new Set([...announced].filter((id) => openIds.has(id)))
  const announce = open.filter((o) => !kept.has(o.campaignId))
  for (const o of announce) kept.add(o.campaignId)
  return { announce, announced: kept }
}

export async function fetchOpenSessions(): Promise<OpenSession[]> {
  const { data, error } = await supabase.rpc('my_open_sessions')
  if (error) throw new Error('Não foi possível ver as sessões abertas.')
  return parseOpenSessions(data)
}
