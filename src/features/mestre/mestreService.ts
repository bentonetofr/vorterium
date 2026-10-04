import { useEffect, useSyncExternalStore } from 'react'
import { supabase, uniqueChannel } from '../../shared/lib/supabase'
import { useAuth } from '../auth/AuthProvider'

// ────────────────────────────────────────────────────────
// Raiz Mestre (Altherium) — o botão SE TORNAR UM MESTRE, a ascensão da
// campanha e o tema preto e dourado de quem virou Mestre (migration
// 20240176). Liberado pelo Painel de controle (recurso "raiz-mestre").
//
// Estado global pequeno: se EU sou Mestre (profiles.mestre_at), se a
// animação da ascensão está rodando, e se o tema está ligado (só liga
// no fim da animação, quando o site "se monta" de novo).
// ────────────────────────────────────────────────────────

export const MESTRE_FEATURE = 'raiz-mestre'

interface MestreStore {
  userId:    string | null
  /** null = ainda não sabe. */
  mestre:    boolean | null
  /** A animação do livro está rodando (o tema espera ela). */
  ascending: boolean
}

let store: MestreStore = { userId: null, mestre: null, ascending: false }
const listeners = new Set<() => void>()
function emit(patch: Partial<MestreStore>) {
  store = { ...store, ...patch }
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

async function loadMine(userId: string) {
  const { data, error } = await supabase.from('profiles').select('mestre_at').eq('id', userId).maybeSingle()
  if (store.userId !== userId) return
  // Sem a migration (coluna não existe): ninguém é Mestre.
  emit({ mestre: !error && !!(data as { mestre_at?: string | null } | null)?.mestre_at })
}

/** Eu sou Mestre? E a animação está rodando? (carrega na primeira vez) */
export function useMestreState(): MestreStore {
  const { user } = useAuth()
  const id = user?.id ?? null
  useEffect(() => {
    if (store.userId === id) return
    emit({ userId: id, mestre: id ? null : false })
    if (id) void loadMine(id)
  }, [id])
  return useSyncExternalStore(subscribe, () => store)
}

export function setMyMestre(mestre: boolean) { emit({ mestre }) }
export function setAscending(ascending: boolean) { emit({ ascending }) }

// ── A animação (um evento global; MestreAscension escuta) ──

export const ASCEND_EVENT = 'vorterium:mestre-ascend'
/** Pede pra ficha aberta recarregar (ela virou Mestre, ou voltou ao normal). */
export const SHEET_REFRESH_EVENT = 'vorterium:sheet-refresh'

export function playAscension() { window.dispatchEvent(new Event(ASCEND_EVENT)) }
export function refreshSheets() { window.dispatchEvent(new Event(SHEET_REFRESH_EVENT)) }

const seenKey = (userId: string) => `vorterium:mestre-visto:${userId}`
/** A pessoa já viu a animação? (quem não estava online na hora vê ao voltar) */
export function wasSeen(userId: string): boolean {
  try { return localStorage.getItem(seenKey(userId)) === '1' } catch { return true }
}
export function markSeen(userId: string, seen = true) {
  try { if (seen) localStorage.setItem(seenKey(userId), '1'); else localStorage.removeItem(seenKey(userId)) } catch { /* sem armazenamento */ }
}

// ── O botão numa campanha ───────────────────────────────

export interface CampaignMestre {
  /** Jogadores da campanha (o mestre da mesa não conta). */
  players:  string[]
  /** Quem já apertou. */
  calls:    string[]
  /** Quem apertou NÃO ME TORNAR (sai da conta). */
  refused:  string[]
  ascended: boolean
}

export async function loadCampaignMestre(campaignId: string): Promise<CampaignMestre> {
  const [members, calls, asc, refused] = await Promise.all([
    supabase.from('campaign_members').select('user_id').eq('campaign_id', campaignId).eq('role', 'player'),
    supabase.from('altherium_mestre_calls').select('user_id').eq('campaign_id', campaignId),
    supabase.from('altherium_mestre_ascensions').select('campaign_id').eq('campaign_id', campaignId).maybeSingle(),
    supabase.from('altherium_mestre_refusals').select('user_id').eq('campaign_id', campaignId),
  ])
  if (calls.error || asc.error) throw new Error('A Raiz Mestre ainda não está pronta no banco.')
  // Sem a migration da recusa: ninguém recusou.
  const out = (refused.error ? [] : refused.data ?? []).map((r) => r.user_id as string)
  return {
    players:  (members.data ?? []).map((m) => m.user_id as string).filter((id) => !out.includes(id)),
    calls:    (calls.data ?? []).map((c) => c.user_id as string),
    refused:  out,
    ascended: !!asc.data,
  }
}

/** Aperta o botão. Se com isso todos apertaram, a campanha ascende. */
export async function callMestre(campaignId: string): Promise<{ called: number; total: number; ascended: boolean }> {
  const { data, error } = await supabase.rpc('call_mestre', { p_campaign: campaignId })
  if (error) throw new Error(error.message || 'Não foi possível.')
  return data as { called: number; total: number; ascended: boolean }
}

export async function cancelMestreCall(campaignId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('altherium_mestre_calls').delete().eq('campaign_id', campaignId).eq('user_id', userId)
  if (error) throw new Error('Não foi possível desistir.')
}

/** Quem apertou e a ascensão, em tempo real. */
export function subscribeCampaignMestre(campaignId: string, onChange: (what: 'calls' | 'ascended') => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`mestre:${campaignId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'altherium_mestre_calls', filter: `campaign_id=eq.${campaignId}` }, () => onChange('calls'))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'altherium_mestre_ascensions', filter: `campaign_id=eq.${campaignId}` }, () => onChange('ascended'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'altherium_mestre_refusals', filter: `campaign_id=eq.${campaignId}` }, () => onChange('calls'))
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

/**
 * Aperta NÃO ME TORNAR UM MESTRE: a ficha volta ao nível 1 (o banco faz
 * tudo e guarda uma cópia). Se só faltava eu, os outros ascendem.
 */
export async function refuseMestre(campaignId: string): Promise<{ ascended: boolean }> {
  const { data, error } = await supabase.rpc('mestre_refuse', { p_campaign: campaignId })
  if (error) throw new Error(error.message || 'Não foi possível.')
  refreshSheets()
  return data as { ascended: boolean }
}

/** O mestre da mesa (ou o dono do site) desfaz a recusa: a ficha volta a ser como era. */
export async function undoMestreRefusal(campaignId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('mestre_undo_refusal', { p_campaign: campaignId, p_user: userId })
  if (error) throw new Error(error.message || 'Não foi possível desfazer.')
  refreshSheets()
}

// ── A campanha escolhida (o botão só aparece nela) ──────

/** Esta campanha é a escolhida pelo dono do site? (Sem a migration: não.) */
export async function loadMestreHere(campaignId: string): Promise<boolean> {
  const { data, error } = await supabase.from('altherium_mestre_campaigns').select('campaign_id').eq('campaign_id', campaignId).maybeSingle()
  return !error && !!data
}

/**
 * Avisa quando a escolha muda. Sem filtro de campanha: quando o dono troca
 * de campanha, a linha da antiga é apagada, e o aviso de "apagou" chega
 * sem dizer de qual campanha era — quem recebe confere de novo.
 */
export function subscribeMestreHere(onChange: () => void): () => void {
  const channel = supabase
    .channel(uniqueChannel('mestre-campanha'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'altherium_mestre_campaigns' }, () => onChange())
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

type HereCampaign = { id: string; name: string; master: boolean } | null

/** O dono escolhe a campanha aberta (tira o botão da que era antes). */
export async function mestreChooseHere(campaign: HereCampaign): Promise<string> {
  if (!campaign) return 'Abra a página da campanha de Altherium e toque aqui de novo.'
  const { data, error } = await supabase.rpc('mestre_choose_campaign', { p_campaign: campaign.id })
  if (error) throw new Error(error.message || 'Não foi possível. Confira se a migration da campanha da Raiz Mestre já rodou.')
  return `Agora só em "${data as string}".`
}

/** Em que campanha está (pro Painel). */
export async function mestreWhere(): Promise<string> {
  const { data, error } = await supabase.rpc('mestre_chosen_campaign')
  if (error) throw new Error('Não foi possível. Confira se a migration da campanha da Raiz Mestre já rodou.')
  return data ? `Está em "${data as string}".` : 'Em nenhuma campanha ainda.'
}

/** Ligar com uma campanha aberta já escolhe ela; sem campanha, só avisa onde está. */
export async function mestreToggle(enabled: boolean, ctx: { campaign: HereCampaign }): Promise<string | void> {
  if (!enabled) return 'Desligado em todas as campanhas.'
  if (ctx.campaign) return mestreChooseHere(ctx.campaign)
  const where = await mestreWhere()
  return `Ligado. ${where} Pra escolher outra, abra a página dela e toque em "Só nesta campanha".`
}

// ── Testes do dono do site (só nele) ────────────────────

/** O dono aperta sozinho: só ele vira Mestre (ficha dele nessa campanha, se tiver, e o tema). */
export async function ownerTestMestre(campaignId: string): Promise<void> {
  const { error } = await supabase.rpc('mestre_owner_test', { p_campaign: campaignId })
  if (error) throw new Error(error.message || 'Não foi possível.')
}

/** O dono volta ao normal (fichas como eram, tema azul, botão de novo). */
export async function ownerResetMestre(userId: string | null): Promise<void> {
  const { error } = await supabase.rpc('mestre_owner_reset')
  if (error) throw new Error('Não foi possível voltar ao normal. Confira se a migration da Raiz Mestre já rodou.')
  if (userId) markSeen(userId, false)
  setMyMestre(false)
  refreshSheets()
}
