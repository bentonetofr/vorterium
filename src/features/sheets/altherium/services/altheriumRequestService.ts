import { supabase, uniqueChannel } from '../../../../shared/lib/supabase'
import type { DiceRoll } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Pedido de teste do mestre (altherium_check_requests, migration 20240219):
// o mestre pede um teste a um ou mais jogadores e a ficha deles abre a
// rolagem com a DT preenchida. A resposta é a própria rolagem, com o id do
// pedido em roll_context.request_id.
// ────────────────────────────────────────────────────────

export type AltheriumRequestKind = 'domain' | 'stealth' | 'equilibrium'

export interface AltheriumRequest {
  id:          string
  campaign_id: string
  master_id:   string
  targets:     string[]
  kind:        AltheriumRequestKind
  domain:      string | null
  label:       string
  dt:          number | null
  amount:      number | null
  status:      'open' | 'closed'
  created_at:  string
  closed_at:   string | null
}

export interface NewAltheriumRequest {
  campaignId: string
  targets:    string[]
  kind:       AltheriumRequestKind
  domain?:    string | null
  label:      string
  dt?:        number | null
  amount?:    number | null
}

const TABLE = 'altherium_check_requests'
const HINT = 'Confira se a migration 20240219 já rodou.'

export async function createAltheriumRequest(req: NewAltheriumRequest): Promise<AltheriumRequest> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')
  const { data, error } = await supabase.from(TABLE).insert({
    campaign_id: req.campaignId, master_id: user.id, targets: req.targets, kind: req.kind,
    domain: req.domain ?? null, label: req.label.trim().slice(0, 80), dt: req.dt ?? null, amount: req.amount ?? null,
  }).select('*').single()
  if (error) throw new Error(`Não foi possível pedir o teste. ${HINT}`)
  return data as AltheriumRequest
}

/** Pedidos abertos da campanha (o mestre vê todos; o jogador, os dele). Sem a tabela, nenhum. */
export async function listOpenAltheriumRequests(campaignId: string): Promise<AltheriumRequest[]> {
  const { data, error } = await supabase.from(TABLE).select('*')
    .eq('campaign_id', campaignId).eq('status', 'open').order('created_at', { ascending: false }).limit(30)
  if (error) return []
  return data as AltheriumRequest[]
}

export async function closeAltheriumRequest(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error('Não foi possível encerrar o pedido.')
}

/** Novos pedidos e mudanças de situação, ao vivo (a RLS já filtra o que chega). */
export function subscribeToAltheriumRequests(campaignId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`altherium_requests:${campaignId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `campaign_id=eq.${campaignId}` }, () => onChange())
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

/** As rolagens que responderam a estes pedidos (roll_context.request_id), da mais antiga para a mais nova. */
export async function listAltheriumAnswers(campaignId: string, ids: readonly string[]): Promise<DiceRoll[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('dice_rolls').select('*')
    .eq('campaign_id', campaignId).in('roll_context->>request_id', [...ids]).order('created_at', { ascending: true })
  if (error) return []
  return data as DiceRoll[]
}
