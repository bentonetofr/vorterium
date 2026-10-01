import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// Quadro da campanha — quadro infinito que a mesa monta junta (post-its,
// textos, formas, molduras, setas, desenho, linha do tempo, imagens e
// arquivos). Cada coisa é uma linha de campaign_board_items; "data" guarda
// o conteúdo de cada tipo. Todos os membros editam; o mestre pode trancar
// um item (a RLS garante). Imagens e arquivos moram na Biblioteca.
// ────────────────────────────────────────────────────────

/** Quadro geral (todos) ou o escudo do mestre (só mestres — a RLS garante). */
export type BoardId = 'geral' | 'mestre'

export type BoardKind = 'note' | 'text' | 'shape' | 'image' | 'file' | 'frame' | 'connector' | 'drawing' | 'timeline'
export type ShapeType = 'rect' | 'ellipse' | 'diamond' | 'triangle'

/** Ponta de uma seta: presa num item (id) ou solta num ponto do quadro. */
export interface Endpoint {
  id?: string
  x?:  number
  y?:  number
}

export interface TimelineEvent {
  id:    string
  title: string
  when:  string
}

/** Conteúdo de um item — cada tipo usa só os campos dele. */
export interface BoardData {
  text?:   string
  color?:  string
  /** Tamanho da letra (texto solto). */
  size?:   number
  bold?:   boolean
  /** Fonte do Google Fonts (só nomes da lista de boardFonts; outro nome é ignorado). */
  font?:   string
  shape?:  ShapeType
  /** Título (moldura, arquivo). */
  title?:  string
  /** Onde mora a imagem: 'gallery' = foto posta no quadro (Galeria);
   *  sem isso = arquivo da Biblioteca (docId). */
  store?:  'gallery'
  /** Arquivo da Biblioteca (imagem/arquivo). */
  docId?:  string
  path?:   string
  name?:   string
  mime?:   string
  /** Seta. */
  from?:   Endpoint
  to?:     Endpoint
  arrow?:  'end' | 'both' | 'none'
  dashed?: boolean
  /** Seta curva: quanto o meio sai da reta (0/sem = reta). */
  bend?:   number
  /** Desenho: pontos (x, y, x, y…) relativos ao canto, no tamanho bw × bh. */
  points?: number[]
  bw?:     number
  bh?:     number
  width?:  number
  /** Linha do tempo. */
  events?: TimelineEvent[]
}

export interface BoardItem {
  id:          string
  campaign_id: string
  board:       BoardId
  kind:        BoardKind
  x:           number
  y:           number
  w:           number
  h:           number
  z:           number
  data:        BoardData
  locked:      boolean
  created_by:  string | null
  updated_by:  string | null
  updated_at:  string
}

const COLUMNS = 'id, campaign_id, board, kind, x, y, w, h, z, data, locked, created_by, updated_by, updated_at'

export async function listBoardItems(campaignId: string, board: BoardId): Promise<BoardItem[]> {
  const { data, error } = await supabase
    .from('campaign_board_items')
    .select(COLUMNS)
    .eq('campaign_id', campaignId)
    .eq('board', board)
    .order('z', { ascending: true })
  if (error) throw new Error('Não foi possível carregar o quadro.')
  return ((data ?? []) as BoardItem[]).map(normalize)
}

/** Grava (cria ou atualiza) de uma vez. Último a salvar vence, por item. */
export async function saveBoardItems(items: BoardItem[]): Promise<void> {
  if (items.length === 0) return
  const rows = items.map(({ id, campaign_id, board, kind, x, y, w, h, z, data, locked }) => ({ id, campaign_id, board, kind, x, y, w, h, z, data, locked }))
  // Em lotes (uma importação do Miro pode trazer centenas de itens).
  for (let i = 0; i < rows.length; i += 400) {
    const { error } = await supabase.from('campaign_board_items').upsert(rows.slice(i, i + 400), { onConflict: 'id' })
    if (error) {
      console.error('Erro ao salvar o quadro:', error)
      throw new Error(error.code === '54000' ? error.message : 'Não foi possível salvar o quadro.')
    }
  }
}

export async function deleteBoardItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('campaign_board_items').delete().in('id', ids)
  if (error) throw new Error('Não foi possível apagar do quadro.')
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** Linha vinda do banco/tempo real com tudo no lugar (nada de NaN). */
export function normalize(row: BoardItem): BoardItem {
  return {
    ...row,
    board: row.board === 'mestre' ? 'mestre' : 'geral',
    x: num(row.x, 0), y: num(row.y, 0), w: num(row.w, 200), h: num(row.h, 200), z: num(row.z, 0),
    data: row.data && typeof row.data === 'object' ? row.data : {},
    locked: !!row.locked,
  }
}

// ── Tempo real ──────────────────────────────────────────

export interface BoardPeer {
  userId: string
  name:   string
  color:  string
}

export interface CursorMessage extends BoardPeer {
  x: number
  y: number
}

/** Itens sendo arrastados por alguém (antes de salvar) — pra ver o movimento ao vivo. */
export interface LiveMoveMessage {
  userId: string
  items:  BoardItem[]
}

interface BoardHandlers {
  onUpsert: (item: BoardItem) => void
  onDelete: (id: string) => void
  onCursor: (msg: CursorMessage) => void
  onLive:   (msg: LiveMoveMessage) => void
  onPeers:  (peers: BoardPeer[]) => void
}

export interface BoardConnection {
  sendCursor: (msg: CursorMessage) => void
  sendLive:   (msg: LiveMoveMessage) => void
  close:      () => void
}

/**
 * Tempo real de um quadro. O escudo do mestre não usa cursor, arrasto ao
 * vivo nem presença (esses passam por um canal que não tem RLS); só as
 * mudanças do banco, que a RLS já esconde dos jogadores.
 */
export function connectBoard(campaignId: string, board: BoardId, me: BoardPeer, handlers: BoardHandlers): BoardConnection {
  const shared = board === 'geral'
  const upsert = (row: BoardItem) => {
    const item = normalize(row)
    if (item.board === board) handlers.onUpsert(item)
  }
  const channel: RealtimeChannel = supabase
    .channel(`board:${campaignId}:${board}`, { config: { broadcast: { self: false }, presence: { key: me.userId } } })
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'campaign_board_items', filter: `campaign_id=eq.${campaignId}` },
      (payload) => upsert(payload.new as BoardItem),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'campaign_board_items', filter: `campaign_id=eq.${campaignId}` },
      (payload) => upsert(payload.new as BoardItem),
    )
    // DELETE não aceita filtro: chega o id de qualquer quadro; quem não tem
    // o item simplesmente ignora.
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'campaign_board_items' },
      (payload) => { const id = (payload.old as { id?: string }).id; if (id) handlers.onDelete(id) },
    )
  if (shared) {
    channel
      .on('broadcast', { event: 'cursor' }, ({ payload }) => handlers.onCursor(payload as CursorMessage))
      .on('broadcast', { event: 'live' }, ({ payload }) => handlers.onLive(payload as LiveMoveMessage))
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<BoardPeer>()
        const peers = new Map<string, BoardPeer>()
        for (const list of Object.values(state)) for (const p of list) if (p.userId) peers.set(p.userId, { userId: p.userId, name: p.name, color: p.color })
        handlers.onPeers([...peers.values()])
      })
  } else {
    handlers.onPeers([me])
  }
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED' && shared) void channel.track(me)
  })

  return {
    sendCursor: (msg) => { if (shared) void channel.send({ type: 'broadcast', event: 'cursor', payload: msg }) },
    sendLive:   (msg) => { if (shared) void channel.send({ type: 'broadcast', event: 'live', payload: msg }) },
    close:      () => { void supabase.removeChannel(channel) },
  }
}

// ── Imagens da Biblioteca ───────────────────────────────

const BUCKET = 'campaign-documents'
const URL_SECONDS = 6 * 60 * 60
const urlCache = new Map<string, { url: string; until: number }>()

/** Links assinados das imagens do quadro (path → link), com cache. */
export async function signBoardPaths(paths: string[]): Promise<Map<string, string>> {
  const now = Date.now()
  const out = new Map<string, string>()
  const missing: string[] = []
  for (const p of new Set(paths)) {
    const hit = urlCache.get(p)
    if (hit && hit.until > now) out.set(p, hit.url)
    else missing.push(p)
  }
  if (missing.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(missing, URL_SECONDS)
    for (const s of data ?? []) {
      if (s.path && s.signedUrl) {
        urlCache.set(s.path, { url: s.signedUrl, until: now + (URL_SECONDS - 600) * 1000 })
        out.set(s.path, s.signedUrl)
      }
    }
  }
  return out
}

/** Cor de cada pessoa no quadro (cursor, bolinha de presença). */
export function peerColor(userId: string): string {
  const palette = ['#f59e0b', '#38bdf8', '#f472b6', '#4ade80', '#a78bfa', '#fb7185', '#2dd4bf', '#facc15', '#60a5fa', '#fb923c']
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}
