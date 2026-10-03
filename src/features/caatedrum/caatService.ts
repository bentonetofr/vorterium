import { supabase, uniqueChannel } from '../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// O Crime de Caatedrum (aba da Sessão) — o site só PEDE coisas ao banco:
// pôr a mesa, sentar, jogar e "qual é a minha visão agora?". Toda a regra,
// o baralho, as mãos e a solução ficam nas funções do banco (migration
// 20240177); a visão já vem filtrada pra quem pede.
// Liberado pelo Painel de controle (recurso "caatedrum").
// ────────────────────────────────────────────────────────

export const CAATEDRUM_FEATURE = 'caatedrum'

export interface CaatRoomRow {
  id:          string
  campaign_id: string
  status:      'lobby' | 'jogo' | 'fim'
  paused:      boolean
  version:     number
}

export type SeatColor = 'azul' | 'vermelho' | 'verde' | 'roxo'
export type SeatEmblem = 'torre' | 'chave' | 'folha' | 'sino'

export interface CaatSeat {
  seat:    number
  uid:     string | null
  name:    string | null
  nick:    string | null
  level:   number | null
  consent: boolean | null
  /** Robô do teste do dono do site. */
  bot:     boolean
  cor:     SeatColor
  emblema: SeatEmblem
}

export interface CaatTextos {
  nome:          string
  chamada:       string
  abertura:      string[]
  consentimento: string[]
  niveis:        { n: number; nome: string; vantagem: string }[]
  niveisAviso:   string
}

export interface CaatCasoPublico {
  titulo:   string
  vitima:   string
  sinos:    { id: string; nome: string; quando: string }[]
  suspeitos: { id: string; nome: string; perfil: string; motivos: string[] }[]
  criadagem: { id: string; nome: string }[]
  salas:    { id: string; nome: string }[]
  ligacoes: [string, string][]
  motivos:  { id: string; nome: string }[]
  sinais:   { id: string; nome: string }[]
  armas:    { id: string; nome: string; morte: string; sinais: string[] }[]
}

export interface CaatView {
  room:       { id: string; status: CaatRoomRow['status']; paused: boolean; paused_by: string | null; version: number }
  now:        number
  phase:      string
  round:      number
  start_seat: number | null
  deadline:   number | null
  me:         { uid: string; gm: boolean; owner: boolean; can_sit: boolean; seat: number | null; consent: boolean; nick: string; level: number }
  seats:      CaatSeat[]
  textos:     CaatTextos
  regras:     Record<string, unknown>
  caso:       CaatCasoPublico
  gm?:        { events: { t: number; m: string }[] }
}

function err(e: { message?: string } | null, fallback: string): never {
  throw new Error(e?.message && !/^(JWT|permission|fetch)/i.test(e.message) ? e.message : fallback)
}

/** A mesa aberta da campanha (ou null). */
export async function getOpenRoom(campaignId: string): Promise<CaatRoomRow | null> {
  const { data, error } = await supabase
    .from('caat_rooms')
    .select('id, campaign_id, status, paused, version')
    .eq('campaign_id', campaignId)
    .neq('status', 'fim')
    .maybeSingle()
  if (error) return null
  return (data as CaatRoomRow | null) ?? null
}

export async function getView(roomId: string): Promise<CaatView> {
  const { data, error } = await supabase.rpc('caat_view', { p_room: roomId })
  if (error) err(error, 'Não foi possível abrir a mesa.')
  return data as CaatView
}

export async function openRoom(campaignId: string): Promise<string> {
  const { data, error } = await supabase.rpc('caat_open', { p_campaign: campaignId })
  if (error) err(error, 'Não foi possível pôr a mesa.')
  return data as string
}

export async function lobby(roomId: string, action: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc('caat_lobby', { p_room: roomId, p_action: action })
  if (error) err(error, 'Não deu certo.')
}

export async function gm(roomId: string, action: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc('caat_gm', { p_room: roomId, p_action: action })
  if (error) err(error, 'Não deu certo.')
}

export async function play(roomId: string, action: Record<string, unknown>): Promise<{ ok?: boolean; msg?: string }> {
  const { data, error } = await supabase.rpc('caat_play', { p_room: roomId, p_action: action })
  if (error) err(error, 'Não deu certo.')
  return (data ?? {}) as { ok?: boolean; msg?: string }
}

/** Mudanças nas mesas da campanha (pôs, mudou de versão, encerrou). */
export function subscribeRooms(campaignId: string, onChange: (row: CaatRoomRow | null) => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`caatedrum:${campaignId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'caat_rooms', filter: `campaign_id=eq.${campaignId}` },
      (p) => onChange((p.new && 'id' in p.new ? p.new : null) as CaatRoomRow | null))
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

// ── A aba aberta (o aviso não aparece pra quem já está nela) ──

let viewingRoom: string | null = null
const viewingListeners = new Set<() => void>()
export function setViewingRoom(id: string | null) { viewingRoom = id; viewingListeners.forEach((l) => l()) }
export function getViewingRoom() { return viewingRoom }
export function onViewingChange(l: () => void) { viewingListeners.add(l); return () => { viewingListeners.delete(l) } }
