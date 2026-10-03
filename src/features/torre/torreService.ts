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

export type Sym = 'sol' | 'lua' | 'estrela' | 'cruz'
export type Node = 'telescopio' | 'mapa' | 'espelhos' | 'manivela' | 'pendulo'

/** Uma estrela escondida que já aparece no telescópio (k = de qual espelho). */
export interface SkyStar { k: number; slot: number; state: 'lit' | 'glimmer' }

/**
 * O jogo como cada um vê agora — só o que já foi descoberto e só do SEU
 * andar (quem assiste recebe os dois). O que depende do pêndulo só vem
 * durante a janela, com `until` (hora do banco) pra sumir sozinho.
 */
export interface TorreGame {
  side:        'cima' | 'baixo' | 'todos'
  pend:        { t0: number | null; until: number | null; period: number }
  progress:    Record<Node, number>
  links:       [Node, Node][]
  inv:         { chave: boolean }
  opened:      boolean
  finished_at: number | null
  other:       { cima_ready: boolean; baixo_ready: boolean; cima_go: number | null; baixo_go: number | null }
  // em cima
  tele?:       { stars: SkyStar[]; pattern: [number, number][]; fifth: { s: number; until: number } | null }
  map?:        { pattern: [number, number][]; holes: number[]; markers: (number | null)[]; colors: number[]; turned: boolean; runes: [number, number] | null; rim: { casa: number; until: number } | null }
  ast_cima?:   { seq: (Sym | null)[]; star: number | null; go: number | null }
  // embaixo
  mir?:        { pos: number[]; reach: boolean[]; full: boolean }
  crank?:      { dome: number; gear: boolean; latch: [number, number]; key: boolean }
  shadow?:     { sym?: Sym; num?: number; until: number } | null
  ast_baixo?:  { num: string; key: boolean; go: number | null }
}

export interface TorreView {
  room:       { id: string; campaign_id: string; status: TorreRoomRow['status']; version: number }
  now:        number
  started_at: number | null
  me:         { uid: string; gm: boolean; slot: number | null }
  players:    TorrePlayer[]
  members:    TorreMember[]
  game?:      TorreGame | null
  /** A dica do mestre, enquanto vale (25 s). */
  hint?:      { t: number; text: string } | null
  /** Só o mestre: a solução e a linha do tempo. */
  gm?:        { secret: Record<string, unknown>; events: { t: number; m: string }[] }
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

/** Uma jogada num objeto. Devolve se deu certo e o que aconteceu. */
export async function play(roomId: string, action: Record<string, unknown>): Promise<{ ok: boolean; msg: string | null }> {
  const { data, error } = await supabase.rpc('tor_play', { p_room: roomId, p_action: action })
  if (error) err(error, 'Não deu certo.')
  return (data ?? { ok: true, msg: null }) as { ok: boolean; msg: string | null }
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
