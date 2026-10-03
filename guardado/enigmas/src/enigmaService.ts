import { supabase, uniqueChannel } from '../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// Enigmas (aba da Sessão) — o site só PEDE coisas ao banco: abrir a
// câmara, entrar, jogar, e "qual é a minha visão agora?". Toda a regra e
// as soluções ficam nas funções do banco (migration 20240177); a visão já
// vem filtrada pelo papel de quem pede. Liberado pelo Painel de controle.
// ────────────────────────────────────────────────────────

export const ENIGMAS_FEATURE = 'enigmas'

export interface EnigmaRoomRow {
  id:          string
  campaign_id: string
  game:        string
  status:      'lobby' | 'jogo' | 'fim'
  paused:      boolean
  version:     number
}

export interface EnigmaPlayer {
  uid:        string
  name:       string
  consent:    boolean
  has_memory: boolean
  roll:       number | null
  dupla:      'A' | 'B' | null
  memory?:    string
}

export interface EnigmaMember { uid: string; name: string; role: string | null }

export interface EnigmaDupla {
  nome:    string
  lugar:   string
  segue:   string
  phase:   number | null
  stage:   string | null
  members: EnigmaMember[]
  fases:   { n: number; tipo: string; titulo: string; papeis: string[] }[]
}

/** O que um papel vê da fase (o conteúdo varia por fase — ver os componentes). */
export interface PhaseView {
  phase:       number
  stage:       'jogo' | 'entrega' | 'em-breve' | 'banca'
  tipo:        string
  titulo:      string
  role:        string
  role_nome:   string
  role_resumo: string | null
  started_at:  number
  cenario:     string | null
  regras:      string[] | null
  hints:       string[]
  hints_left:  number
  entrega?: { texto: string; libera: string | null; fragmento: string | null; tracos: string[] | null; skipped: boolean }
  [key: string]: unknown
}

export interface GmDupla {
  view:      PhaseView | null
  score:     number
  hints:     number
  times:     Record<string, { start: number; end: number; skipped: boolean; hints: number }>
  fragments: string[]
  revealed:  boolean
}

export interface EnigmaView {
  room:     { id: string; status: EnigmaRoomRow['status']; paused: boolean; paused_by: string | null; version: number }
  now:      number
  historia: { nome: string; abertura: string[]; consentimento: string[]; memoria_padrao: string }
  me:       { uid: string; gm: boolean; joined: boolean; consent: boolean; memory: string; dupla: 'A' | 'B' | null; role: string | null; dupla_abertura: string | null }
  players:  EnigmaPlayer[]
  drawn:    boolean
  duplas:   Partial<Record<'A' | 'B', EnigmaDupla>>
  mine?:    PhaseView | null
  other?:   PhaseView | null
  gm?:      { events: { t: number; d: string | null; m: string }[]; A?: GmDupla; B?: GmDupla }
}

function err(e: { message?: string } | null, fallback: string): never {
  throw new Error(e?.message && !/^(JWT|permission|fetch)/i.test(e.message) ? e.message : fallback)
}

/** A sala aberta da campanha (ou null). */
export async function getOpenRoom(campaignId: string): Promise<EnigmaRoomRow | null> {
  const { data, error } = await supabase
    .from('enigma_rooms')
    .select('id, campaign_id, game, status, paused, version')
    .eq('campaign_id', campaignId)
    .neq('status', 'fim')
    .maybeSingle()
  if (error) return null
  return (data as EnigmaRoomRow | null) ?? null
}

export async function getView(roomId: string): Promise<EnigmaView> {
  const { data, error } = await supabase.rpc('enigma_view', { p_room: roomId })
  if (error) err(error, 'Não foi possível abrir a câmara.')
  return data as EnigmaView
}

export async function openRoom(campaignId: string): Promise<string> {
  const { data, error } = await supabase.rpc('enigma_open', { p_campaign: campaignId, p_game: 'caatedrum' })
  if (error) err(error, 'Não foi possível abrir a câmara.')
  return data as string
}

export async function lobby(roomId: string, action: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc('enigma_lobby', { p_room: roomId, p_action: action })
  if (error) err(error, 'Não deu certo.')
}

export async function gm(roomId: string, action: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc('enigma_gm', { p_room: roomId, p_action: action })
  if (error) err(error, 'Não deu certo.')
}

export async function play(roomId: string, action: Record<string, unknown>): Promise<{ ok?: boolean; msg?: string }> {
  const { data, error } = await supabase.rpc('enigma_play', { p_room: roomId, p_action: action })
  if (error) err(error, 'Não deu certo.')
  return (data ?? {}) as { ok?: boolean; msg?: string }
}

/** Mudanças nas salas da campanha (abriu, mudou de versão, fechou). */
export function subscribeRooms(campaignId: string, onChange: (row: EnigmaRoomRow | null) => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`enigmas:${campaignId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'enigma_rooms', filter: `campaign_id=eq.${campaignId}` },
      (p) => onChange((p.new && 'id' in p.new ? p.new : null) as EnigmaRoomRow | null))
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

// ── A aba aberta (o aviso não aparece pra quem já está nela) ──

let viewingRoom: string | null = null
const viewingListeners = new Set<() => void>()
export function setViewingRoom(id: string | null) { viewingRoom = id; viewingListeners.forEach((l) => l()) }
export function getViewingRoom() { return viewingRoom }
export function onViewingChange(l: () => void) { viewingListeners.add(l); return () => { viewingListeners.delete(l) } }
