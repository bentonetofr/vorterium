import { supabase, uniqueChannel } from '../../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// Fichas de NPC (migration 20240189000000) — iguais pra todos os sistemas:
// a ficha de NPC é uma linha da mesma tabela do sistema, com is_npc = true,
// do mestre (user_id dele). npc_visible = o mestre mostrou pros jogadores
// (eles só leem). Quem decide o que cada um vê é a RLS.
//
// npcReady(): a migration já rodou? Até rodar, as buscas de "a minha
// ficha" não filtram is_npc (a coluna não existe) e a seção de NPCs não
// aparece — o site continua funcionando igual.
// ────────────────────────────────────────────────────────

export type SheetTable = 'character_sheets' | 'altherium_character_sheets' | 'td_character_sheets' | 'vtm_character_sheets'

/** O mínimo que toda ficha tem (pra seção de NPCs funcionar com qualquer sistema). */
export interface NpcSheetBase {
  id:              string
  campaign_id:     string
  character_name:  string | null
  is_npc?:         boolean
  npc_visible?:    boolean
  updated_at:      string
}

let ready: Promise<boolean> | null = null

export function npcReady(): Promise<boolean> {
  if (!ready) {
    ready = Promise.resolve(supabase.from('character_sheets').select('is_npc').limit(1))
      .then(({ error }) => !error)
      .catch(() => false)
  }
  return ready
}

/**
 * Filtro "só fichas de jogador" pras buscas de ficha (.match(await pcOnly())).
 * Antes da migration, não filtra nada.
 */
export async function pcOnly(): Promise<Record<string, boolean>> {
  return (await npcReady()) ? { is_npc: false } : {}
}

/** Os NPCs da campanha (o mestre recebe todos; o jogador, só os mostrados). */
export async function listNpcs<T extends NpcSheetBase>(table: SheetTable, campaignId: string): Promise<T[]> {
  if (!(await npcReady())) return []
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('is_npc', true)
    .order('created_at', { ascending: true })
  if (error) throw new Error('Não foi possível carregar as fichas de NPC.')
  return (data ?? []) as T[]
}

/** Ficha nova de NPC, escondida dos jogadores. */
export async function createNpc<T extends NpcSheetBase>(table: SheetTable, campaignId: string, name = 'Novo NPC'): Promise<T> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')
  const { data, error } = await supabase
    .from(table)
    .insert({ campaign_id: campaignId, user_id: user.id, is_npc: true, npc_visible: false, character_name: name })
    .select('*')
    .single()
  if (error) throw new Error('Não foi possível criar a ficha de NPC.')
  return data as T
}

export async function setNpcVisible<T extends NpcSheetBase>(table: SheetTable, id: string, visible: boolean): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .update({ npc_visible: visible })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error('Não foi possível mudar quem vê a ficha.')
  return data as T
}

export async function deleteNpc(table: SheetTable, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id).eq('is_npc', true)
  if (error) throw new Error('Não foi possível apagar a ficha de NPC.')
}

export interface NpcFeed {
  /** Avisa a mesa que os NPCs mudaram (o mestre chama depois de mostrar, esconder ou apagar). */
  ping: () => void
  stop: () => void
}

/**
 * NPCs ao vivo. Duas vias:
 *   • postgres_changes: o que a pessoa ainda pode ver (criou, editou, mostrou);
 *   • broadcast "mudou": o Realtime não avisa quem PERDEU o acesso à linha
 *     (o mestre escondeu ou apagou), então o mestre avisa e todo mundo
 *     recarrega a lista. O aviso não leva dado nenhum.
 */
export function subscribeNpcs(table: SheetTable, campaignId: string, onChange: () => void): NpcFeed {
  const changes = supabase
    .channel(uniqueChannel(`npcs:${table}:${campaignId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table, filter: `campaign_id=eq.${campaignId}` }, () => onChange())
    .subscribe()

  // Sala compartilhada (nome fixo). Se sobrou um canal velho com o mesmo
  // nome, sai antes (o supabase-js devolveria o velho).
  const room = `npcs-ping:${table}:${campaignId}`
  for (const old of supabase.getChannels()) if (old.topic === `realtime:${room}`) void supabase.removeChannel(old)
  const ping = supabase
    .channel(room, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'changed' }, () => onChange())
    .subscribe()

  return {
    ping: () => { void ping.send({ type: 'broadcast', event: 'changed', payload: {} }) },
    stop: () => { void supabase.removeChannel(changes); void supabase.removeChannel(ping) },
  }
}
