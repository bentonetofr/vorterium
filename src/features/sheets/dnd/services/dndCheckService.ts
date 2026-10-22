import { supabase, uniqueChannel } from '../../../../shared/lib/supabase'
import type { DiceRoll } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Pedido de teste do mestre (dnd_check_requests, migration 20240210): o
// mestre pede "Furtividade, CD 15" a um ou mais jogadores; o painel abre
// na tela deles. Com a CD oculta, ela vai para dnd_check_request_dc (só o
// mestre lê) e o jogador a recebe por dnd_check_reveal depois de rolar.
// A resposta é a rolagem, com o id do pedido em roll_context.request_id.
// ────────────────────────────────────────────────────────

export type DndCheckKind = 'skill' | 'save' | 'ability' | 'attack' | 'initiative' | 'death' | 'custom'
export type DndAdvantage = 'normal' | 'advantage' | 'disadvantage'

export interface DndCheckRequest {
  id:          string
  campaign_id: string
  master_id:   string
  targets:     string[]
  kind:        DndCheckKind
  check_key:   string | null
  label:       string
  /** null quando a CD é oculta (ou não tem CD). */
  dc:          number | null
  dc_hidden:   boolean
  advantage:   DndAdvantage
  status:      'open' | 'closed'
  created_at:  string
  closed_at:   string | null
}

export interface NewCheckRequest {
  campaignId: string
  targets:    string[]
  kind:       DndCheckKind
  key?:       string | null
  label:      string
  dc?:        number | null
  dcHidden?:  boolean
  advantage?: DndAdvantage
}

const MIGRATION_HINT = 'Confira se a migration 20240210 (dados 3D do D&D) já rodou.'

export async function createCheckRequest(req: NewCheckRequest): Promise<DndCheckRequest> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')
  const hidden = !!req.dcHidden && req.dc != null
  const { data, error } = await supabase.from('dnd_check_requests').insert({
    campaign_id: req.campaignId, master_id: user.id, targets: req.targets, kind: req.kind, check_key: req.key ?? null,
    label: req.label.trim().slice(0, 80), dc: hidden ? null : req.dc ?? null, dc_hidden: hidden, advantage: req.advantage ?? 'normal',
  }).select('*').single()
  if (error) throw new Error(`Não foi possível pedir o teste. ${MIGRATION_HINT}`)
  const saved = data as DndCheckRequest
  if (hidden) {
    const { error: dcError } = await supabase.from('dnd_check_request_dc').insert({ request_id: saved.id, dc: req.dc })
    if (dcError) {
      await supabase.from('dnd_check_requests').delete().eq('id', saved.id)
      throw new Error('Não foi possível guardar a CD oculta.')
    }
  }
  return saved
}

/** Pedidos abertos da campanha (o mestre vê todos; o jogador, os dele). */
export async function listOpenCheckRequests(campaignId: string): Promise<DndCheckRequest[]> {
  const { data, error } = await supabase.from('dnd_check_requests').select('*')
    .eq('campaign_id', campaignId).eq('status', 'open').order('created_at', { ascending: false }).limit(30)
  if (error) return []
  return data as DndCheckRequest[]
}

export async function closeCheckRequest(id: string): Promise<void> {
  const { error } = await supabase.from('dnd_check_requests').update({ status: 'closed' }).eq('id', id)
  if (error) throw new Error('Não foi possível encerrar o pedido.')
}

/** A CD do pedido: aberta, ou oculta depois que esta pessoa rolou (ou se é o mestre). */
export async function revealCheckDc(id: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('dnd_check_reveal', { p_request: id })
  if (error) return null
  return typeof data === 'number' ? data : null
}

/** Novos pedidos e mudanças de situação, ao vivo (a RLS já filtra o que chega). */
export function subscribeToCheckRequests(campaignId: string, onChange: (row: DndCheckRequest) => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`dnd_checks:${campaignId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dnd_check_requests', filter: `campaign_id=eq.${campaignId}` },
      (payload) => { if (payload.new && 'id' in payload.new) onChange(payload.new as DndCheckRequest) })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

/** As rolagens que responderam a estes pedidos (roll_context.request_id), da mais antiga para a mais nova. */
export async function listRequestAnswers(campaignId: string, ids: readonly string[]): Promise<DiceRoll[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('dice_rolls').select('*')
    .eq('campaign_id', campaignId).in('roll_context->>request_id', [...ids]).order('created_at', { ascending: true })
  if (error) return []
  return data as DiceRoll[]
}
