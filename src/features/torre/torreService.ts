import { supabase, uniqueChannel } from '../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// A Torre do Observatório — o site só PEDE coisas ao banco: abrir a sala,
// escolher quem joga, começar e "qual é a minha visão agora?" (migration
// 20240179). O movimento dos bonecos não passa por aqui (ver torreNet).
// Liberado pelo Painel de controle (recurso "torre-observatorio").
// ────────────────────────────────────────────────────────

export const TORRE_FEATURE = 'torre-observatorio'

export interface TorreRoomRow {
  id:          string
  campaign_id: string
  status:      'lobby' | 'jogo' | 'fim'
  version:     number
}

export interface TorrePlayer { uid: string; name: string; slot: number }
export interface TorreMember { uid: string; name: string; role: 'master' | 'player' }

/** O jogo como cada um vê agora (os enigmas chegam no marco 2). */
export type TorreGame = Record<string, unknown>

export interface TorreView {
  room:       { id: string; campaign_id: string; status: TorreRoomRow['status']; version: number }
  now:        number
  started_at: number | null
  me:         { uid: string; gm: boolean; slot: number | null }
  players:    TorrePlayer[]
  members:    TorreMember[]
  game?:      TorreGame | null
}

function err(e: { message?: string } | null, fallback: string): never {
  throw new Error(e?.message && !/^(JWT|permission|fetch)/i.test(e.message) ? e.message : fallback)
}

/** A sala aberta da campanha (ou null). */
export async function getOpenRoom(campaignId: string): Promise<TorreRoomRow | null> {
  const { data, error } = await supabase
    .from('tor_rooms')
    .select('id, campaign_id, status, version')
    .eq('campaign_id', campaignId)
    .neq('status', 'fim')
    .maybeSingle()
  if (error) return null
  return (data as TorreRoomRow | null) ?? null
}

export async function getView(roomId: string): Promise<TorreView> {
  const { data, error } = await supabase.rpc('tor_view', { p_room: roomId })
  if (error) err(error, 'Não foi possível abrir a Torre do Observatório.')
  return data as TorreView
}

export async function openRoom(campaignId: string): Promise<string> {
  const { data, error } = await supabase.rpc('tor_open', { p_campaign: campaignId })
  if (error) err(error, 'Não foi possível abrir a Torre do Observatório.')
  return data as string
}

/** Fecha as salas abertas das campanhas em que eu sou o mestre. */
export async function closeMine(): Promise<number> {
  const { data, error } = await supabase.rpc('tor_close_mine')
  if (error) err(error, 'Não foi possível fechar.')
  return (data as number) ?? 0
}

export async function gm(roomId: string, action: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc('tor_gm', { p_room: roomId, p_action: action })
  if (error) err(error, 'Não deu certo.')
}

// ── Painel de controle ──────────────────────────────────

type HereCampaign = { id: string; name: string; master: boolean } | null

/** "Abrir nesta campanha": abre o jogo na campanha que está aberta na tela. */
export async function torreOpenHere(campaign: HereCampaign): Promise<string> {
  if (!campaign) throw new Error('Abra a página da sua campanha primeiro.')
  if (!campaign.master) throw new Error('Você não é o mestre desta campanha.')
  await openRoom(campaign.id)
  return `Aberto em ${campaign.name}.`
}

/** Ligar no painel abre o jogo na campanha aberta; desligar fecha. */
export async function torreToggle(enabled: boolean, ctx: { campaign: HereCampaign }): Promise<string | void> {
  if (!enabled) {
    const n = await closeMine()
    return n ? 'Jogo encerrado.' : undefined
  }
  if (ctx.campaign?.master) return torreOpenHere(ctx.campaign)
  return 'Ligado. Abra a página da sua campanha e toque em "Abrir nesta campanha".'
}

/** Mudanças nas salas da campanha (abriu, mudou de versão, fechou). */
export function subscribeRooms(campaignId: string, onChange: (row: TorreRoomRow | null) => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`torre-salas:${campaignId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tor_rooms', filter: `campaign_id=eq.${campaignId}` },
      (p) => onChange((p.new && 'id' in p.new ? p.new : null) as TorreRoomRow | null))
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}
