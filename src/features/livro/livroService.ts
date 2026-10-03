import { supabase, uniqueChannel } from '../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// O Livro Bloqueado — o site só PEDE coisas ao banco: abrir a sala,
// escolher quem joga, começar e "qual é a minha visão agora?" (migration
// 20240177). O movimento dos bonecos não passa por aqui (ver livroNet).
// Liberado pelo Painel de controle (recurso "livro-bloqueado").
// ────────────────────────────────────────────────────────

export const LIVRO_FEATURE = 'livro-bloqueado'

export interface LivroRoomRow {
  id:          string
  campaign_id: string
  status:      'lobby' | 'jogo' | 'fim'
  version:     number
  /** Pausado (o outro jogo está na tela): não aparece pra ninguém. */
  paused_at?:  string | null
}

export interface LivroPlayer { uid: string; name: string; slot: number }
export interface LivroMember { uid: string; name: string; role: 'master' | 'player' }

export type Sym = 'sol' | 'lua' | 'estrela' | 'cruz'
export type Quadrant = 'castical' | 'retrato' | 'astrolabio' | 'estante'

/** O jogo como a dupla (e quem assiste) vê agora — só o que já foi descoberto. */
export interface GameView {
  light: 'escuro' | 'parcial' | 'total'
  cast: { lit: boolean[]; sealed: boolean[]; tried?: number[]; view: number; shadows: (Sym | null)[]; digits: number[] | null }
  ret: { view: number; corners: (Sym | null)[]; silhouette: number[] | null; face: number | null; taken?: boolean; table: { l: string; g: number }[] | null }
  astro: { runes: number[]; slots: (Sym | null)[]; known: Sym[]; angle: number | null; pointer: number; lid: boolean; seq: number[] | null }
  est: { books: number[]; pulled: number[]; glyphs: number[]; word_ok: boolean; drawer: boolean }
  ped: { chains: number[]; opened: boolean; progress: Record<Quadrant, number>; links: [Quadrant, Quadrant][] }
  inv: { medalhao: boolean; chave: boolean }
  finished_at: number | null
}

export interface LivroView {
  room:       { id: string; campaign_id: string; status: LivroRoomRow['status']; version: number; paused?: boolean }
  /** Onde cada boneco estava (a Torre só manda a sua pra quem joga). */
  pos?:       Record<string, { x: number; y: number; d: 'down' | 'up' | 'left' | 'right'; p: string | null }>
  now:        number
  started_at: number | null
  me:         { uid: string; gm: boolean; slot: number | null }
  players:    LivroPlayer[]
  members:    LivroMember[]
  game:       GameView | null
  /** Só o mestre: a solução e a linha do tempo. */
  gm?:        { secret: Record<string, unknown>; events: { t: number; m: string }[] }
}

function err(e: { message?: string } | null, fallback: string): never {
  throw new Error(e?.message && !/^(JWT|permission|fetch)/i.test(e.message) ? e.message : fallback)
}

/** A sala aberta da campanha (ou null). */
export async function getOpenRoom(campaignId: string): Promise<LivroRoomRow | null> {
  const { data, error } = await supabase
    .from('lb_rooms')
    .select('id, campaign_id, status, version, paused_at')
    .eq('campaign_id', campaignId)
    .neq('status', 'fim')
    .maybeSingle()
  if (error) return null
  return (data as LivroRoomRow | null) ?? null
}

export async function getView(roomId: string): Promise<LivroView> {
  const { data, error } = await supabase.rpc('lb_view', { p_room: roomId })
  if (error) err(error, 'Não foi possível abrir o Livro Bloqueado.')
  return data as LivroView
}

export async function openRoom(campaignId: string): Promise<string> {
  const { data, error } = await supabase.rpc('lb_open', { p_campaign: campaignId })
  if (error) err(error, 'Não foi possível abrir o Livro Bloqueado.')
  return data as string
}

/** Fecha as salas abertas das campanhas em que eu sou o mestre. */
export async function closeMine(): Promise<number> {
  const { data, error } = await supabase.rpc('lb_close_mine')
  if (error) err(error, 'Não foi possível fechar.')
  return (data as number) ?? 0
}

export async function gm(roomId: string, action: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc('lb_gm', { p_room: roomId, p_action: action })
  if (error) err(error, 'Não deu certo.')
}

/** Uma jogada num objeto. Devolve se deu certo e o que aconteceu. */
export async function play(roomId: string, action: Record<string, unknown>): Promise<{ ok: boolean; msg: string | null }> {
  const { data, error } = await supabase.rpc('lb_play', { p_room: roomId, p_action: action })
  if (error) err(error, 'Não deu certo.')
  return (data ?? { ok: true, msg: null }) as { ok: boolean; msg: string | null }
}

/** Guarda onde o meu boneco está (não acorda as outras telas). */
export async function savePos(roomId: string, pos: { x: number; y: number; d: string; p: string | null }): Promise<void> {
  const { error } = await supabase.rpc('lb_save_pos', { p_room: roomId, p_pos: pos })
  if (error) throw error
}

// ── Painel de controle ──────────────────────────────────

type HereCampaign = { id: string; name: string; master: boolean } | null

/** "Abrir nesta campanha": abre o jogo na campanha que está aberta na tela. */
export async function livroOpenHere(campaign: HereCampaign): Promise<string> {
  if (!campaign) throw new Error('Abra a página da sua campanha primeiro.')
  if (!campaign.master) throw new Error('Você não é o mestre desta campanha.')
  await openRoom(campaign.id)
  return `Aberto em ${campaign.name}.`
}

/** Ligar no painel abre o jogo na campanha aberta; desligar fecha. */
export async function livroToggle(enabled: boolean, ctx: { campaign: HereCampaign }): Promise<string | void> {
  if (!enabled) {
    const n = await closeMine()
    return n ? 'Jogo encerrado.' : undefined
  }
  if (ctx.campaign?.master) return livroOpenHere(ctx.campaign)
  return 'Ligado. Abra a página da sua campanha e toque em "Abrir nesta campanha".'
}

/** Mudanças nas salas da campanha (abriu, mudou de versão, fechou). */
export function subscribeRooms(campaignId: string, onChange: (row: LivroRoomRow | null) => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`livro-salas:${campaignId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lb_rooms', filter: `campaign_id=eq.${campaignId}` },
      (p) => onChange((p.new && 'id' in p.new ? p.new : null) as LivroRoomRow | null))
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}
