import { supabase, uniqueChannel } from '../../../shared/lib/supabase'
import type {
  Appearance, CharacterSave, CharacterStorage, SpecialNpc, WorldData, WorldStorage, ZoneData, ZoneSummary,
} from '../../../vendor/vortable/vortable'

// ────────────────────────────────────────────────────────
// Ponte Vortable ↔ Supabase: o motor só conhece os contratos
// WorldStorage e CharacterStorage; aqui eles viram tabelas vortable_*
// (um mundo por campanha, ver migration 20240192).
// ────────────────────────────────────────────────────────

/** Carrega o motor só quando a aba Vortable abre (o Phaser sozinho tem ~1,2 MB). */
export const loadEngine = () => import('../../../vendor/vortable/vortable')

/** Pasta dos assets copiados pelo `npm run vorterium` do Vortable. */
export const VORTABLE_ASSETS = `${import.meta.env.BASE_URL}vortable/assets/`

function fail(action: string, error: { message: string }): never {
  throw new Error(`Vortable: ${action} (${error.message})`)
}

/** Um mundo da campanha (um conjunto de zonas). `active` = o mundo onde os jogadores estão. */
export interface CampaignWorld {
  id:        string
  name:      string
  active:    boolean
  zones:     number
  updatedAt: number
}

interface WorldRow { id: string; name: string; active: boolean; updated_at: string }

/** Os mundos da campanha, com quantas zonas cada um tem. */
export async function listWorlds(campaignId: string): Promise<CampaignWorld[]> {
  const [worlds, zones] = await Promise.all([
    supabase.from('vortable_worlds').select('id, name, active, updated_at').eq('campaign_id', campaignId),
    supabase.from('vortable_zones').select('world_id').eq('campaign_id', campaignId),
  ])
  if (worlds.error) fail('não deu pra listar os mundos', worlds.error)
  if (zones.error) fail('não deu pra contar as zonas', zones.error)
  const count = new Map<string, number>()
  for (const z of (zones.data ?? []) as { world_id: string | null }[]) {
    if (z.world_id) count.set(z.world_id, (count.get(z.world_id) ?? 0) + 1)
  }
  return ((worlds.data ?? []) as WorldRow[])
    .map((w) => ({ id: w.id, name: w.name, active: w.active, zones: count.get(w.id) ?? 0, updatedAt: Date.parse(w.updated_at) }))
    .sort((a, b) => a.updatedAt - b.updatedAt)
}

/**
 * Garante que a campanha tem pelo menos um mundo (as zonas antigas, sem mundo,
 * entram nele) e que um deles está aberto. Devolve a lista já certa.
 */
export async function ensureWorlds(campaignId: string, isMaster: boolean): Promise<CampaignWorld[]> {
  let list = await listWorlds(campaignId)
  if (list.length === 0 && isMaster) {
    const { newWorld } = await loadEngine()
    await createWorld(campaignId, 'Mundo principal', newWorld)
    const created = await listWorlds(campaignId)
    // zonas salvas antes dos mundos existirem (sem world_id) passam pro primeiro
    if (created[0]) {
      await supabase.from('vortable_zones').update({ world_id: created[0].id }).eq('campaign_id', campaignId).is('world_id', null)
      await setActiveWorld(campaignId, created[0].id)
    }
    list = await listWorlds(campaignId)
  }
  return list
}

/** Cria um mundo novo (vazio, fechado). */
export async function createWorld(
  campaignId: string, name: string, make?: (name: string) => WorldData,
): Promise<CampaignWorld> {
  const world = (make ?? (await loadEngine()).newWorld)(name)
  const { error } = await supabase.from('vortable_worlds').insert({
    campaign_id: campaignId, id: world.id, name, active: false, data: world,
  })
  if (error) fail('não deu pra criar o mundo', error)
  return { id: world.id, name, active: false, zones: 0, updatedAt: Date.now() }
}

export async function renameWorld(campaignId: string, worldId: string, name: string): Promise<void> {
  const { data, error } = await supabase
    .from('vortable_worlds').select('data').eq('campaign_id', campaignId).eq('id', worldId).maybeSingle()
  if (error) fail('não deu pra renomear o mundo', error)
  const update = await supabase
    .from('vortable_worlds').update({ name, data: { ...((data?.data as object) ?? {}), name } })
    .eq('campaign_id', campaignId).eq('id', worldId)
  if (update.error) fail('não deu pra renomear o mundo', update.error)
}

/**
 * Importa um mundo inteiro de um arquivo (`format: 'vortable-world'`): cria o mundo
 * com as zonas dele. Zonas com id já usado na campanha ganham id novo (e as saídas
 * que levam a elas são religadas), então importar duas vezes não sobrescreve nada.
 */
export async function importWorldBundle(campaignId: string, raw: unknown): Promise<CampaignWorld> {
  const { parseZone, parseWorld } = await loadEngine()
  const bundle = raw as { format?: unknown; world?: unknown; zones?: unknown } | null
  if (!bundle || bundle.format !== 'vortable-world' || !Array.isArray(bundle.zones) || !bundle.world) {
    throw new Error('Este arquivo não é um mundo do Vortable.')
  }
  const zones: ZoneData[] = bundle.zones.map((z) => parseZone(z))
  if (zones.length === 0) throw new Error('O mundo do arquivo não tem nenhuma zona.')
  const world = parseWorld(bundle.world)

  const used = await supabase.from('vortable_zones').select('id').eq('campaign_id', campaignId)
  if (used.error) fail('não deu pra conferir as zonas da campanha', used.error)
  const taken = new Set((used.data ?? []).map((r) => r.id as string))

  // ids novos onde já existe (e religa as saídas)
  const remap = new Map<string, string>()
  for (const z of zones) remap.set(z.id, taken.has(z.id) ? `${z.id}-${Date.now().toString(36)}` : z.id)
  for (const z of zones) {
    z.id = remap.get(z.id)!
    for (const p of z.portals) if (p.to && remap.has(p.to.zone)) p.to = { ...p.to, zone: remap.get(p.to.zone)! }
  }

  const created = await createWorld(campaignId, world.name.slice(0, 80))
  const storage = await createWorldStorage(campaignId, created.id, created.name)
  for (const z of zones) await storage.save(z)
  await storage.saveWorld({
    ...world,
    id: created.id,
    start: (world.start && remap.get(world.start)) || zones[0].id,
    layout: Object.fromEntries(Object.entries(world.layout).map(([id, pos]) => [remap.get(id) ?? id, pos])),
  })
  return { ...created, zones: zones.length }
}

/** Apaga o mundo e as zonas dele. */
export async function deleteWorld(campaignId: string, worldId: string): Promise<void> {
  const zones = await supabase.from('vortable_zones').delete().eq('campaign_id', campaignId).eq('world_id', worldId)
  if (zones.error) fail('não deu pra apagar as zonas do mundo', zones.error)
  const world = await supabase.from('vortable_worlds').delete().eq('campaign_id', campaignId).eq('id', worldId)
  if (world.error) fail('não deu pra apagar o mundo', world.error)
}

/** Abre o mundo pros jogadores (só um fica aberto por vez). */
export async function setActiveWorld(campaignId: string, worldId: string): Promise<void> {
  // o índice único aceita um aberto só: fecha o atual antes de abrir o novo
  const off = await supabase.from('vortable_worlds').update({ active: false }).eq('campaign_id', campaignId).eq('active', true)
  if (off.error) fail('não deu pra abrir o mundo', off.error)
  const on = await supabase.from('vortable_worlds').update({ active: true }).eq('campaign_id', campaignId).eq('id', worldId)
  if (on.error) fail('não deu pra abrir o mundo', on.error)
}

/** O id do mundo aberto (ou o primeiro, se nenhum estiver). */
export async function getActiveWorldId(campaignId: string): Promise<string | null> {
  const list = await listWorlds(campaignId)
  return (list.find((w) => w.active) ?? list[0])?.id ?? null
}

/** Chama `onChange` quando um mundo é criado, apagado ou aberto. */
export function watchWorlds(campaignId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`vortable-mundos:${campaignId}`))
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'vortable_worlds', filter: `campaign_id=eq.${campaignId}`,
    }, onChange)
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

/** O armazenamento de UM mundo: as zonas dele e os dados do mundo. */
export async function createWorldStorage(
  campaignId: string, worldId: string, worldName: string,
  /** Chamado depois de salvar uma zona (o mestre avisa os jogadores pra recarregarem). */
  onZoneSaved?: (zoneId: string) => void,
): Promise<WorldStorage> {
  const { parseWorld, parseZone, newWorld, summarize } = await loadEngine()
  const fresh = () => ({ ...newWorld(worldName), id: worldId })

  return {
    async loadWorld(): Promise<WorldData> {
      const { data, error } = await supabase
        .from('vortable_worlds').select('data').eq('campaign_id', campaignId).eq('id', worldId).maybeSingle()
      if (error) fail('não deu pra abrir o mundo', error)
      if (!data) return fresh()
      try {
        return parseWorld(data.data)
      } catch {
        return fresh()
      }
    },

    async saveWorld(world) {
      const { error } = await supabase
        .from('vortable_worlds').update({ data: { ...world, id: worldId } })
        .eq('campaign_id', campaignId).eq('id', worldId)
      if (error) fail('não deu pra salvar o mundo', error)
    },

    async list(): Promise<ZoneSummary[]> {
      const { data, error } = await supabase
        .from('vortable_zones').select('id, summary, updated_at').eq('campaign_id', campaignId).eq('world_id', worldId)
      if (error) fail('não deu pra listar as zonas', error)
      return (data ?? [])
        .map((row) => ({
          links: [], portals: [],
          ...(row.summary as Partial<ZoneSummary>),
          id: row.id as string,
          updatedAt: Date.parse(row.updated_at as string),
        }) as ZoneSummary)
        .sort((a, b) => b.updatedAt - a.updatedAt)
    },

    async load(id): Promise<ZoneData | null> {
      const { data, error } = await supabase
        .from('vortable_zones').select('data').eq('campaign_id', campaignId).eq('id', id).maybeSingle()
      if (error) fail('não deu pra abrir a zona', error)
      if (!data) return null
      try {
        return parseZone(data.data)
      } catch {
        return null
      }
    },

    async save(zone) {
      const { error } = await supabase.from('vortable_zones').upsert({
        campaign_id: campaignId,
        id: zone.id,
        world_id: worldId,
        name: zone.name,
        summary: summarize(zone),
        data: zone,
      })
      if (error) fail('não deu pra salvar a zona', error)
      onZoneSaved?.(zone.id)
    },

    async remove(id) {
      const { error } = await supabase
        .from('vortable_zones').delete().eq('campaign_id', campaignId).eq('id', id)
      if (error) fail('não deu pra apagar a zona', error)
    },
  }
}

/** Prefixo do id do personagem de um NPC especial (com ficha): `npc:<tabela da ficha>:<id da ficha>`. */
export const NPC_PREFIX = 'npc:'
export const npcCharacterKey = (table: string, sheetId: string) => `${NPC_PREFIX}${table}:${sheetId}`

/** Boneco como o banco guarda: criado por `createdBy`, jogado por `controllerId`. */
export interface CampaignCharacter {
  id:           string
  name:         string
  appearance:   Appearance
  createdBy:    string
  controllerId: string | null
}

interface CharacterRow {
  id: string
  name: string
  appearance: Appearance
  user_id: string
  controller_id: string | null
}

const toCharacter = (row: CharacterRow): CampaignCharacter => ({
  id: row.id, name: row.name, appearance: row.appearance, createdBy: row.user_id, controllerId: row.controller_id,
})

/** Bonecos que a pessoa criou — e qual deles ela joga (o `controller_id` dela). */
export async function createCharacterStorage(campaignId: string, userId: string): Promise<CharacterStorage> {
  const { parseCharacter } = await loadEngine()
  // os personagens dos NPCs especiais (id `npc:…`) ficam fora da lista pessoal
  const created = () => supabase.from('vortable_characters').select('*').eq('campaign_id', campaignId).eq('user_id', userId).not('id', 'like', `${NPC_PREFIX}%`)

  return {
    async list(): Promise<CharacterSave[]> {
      const { data, error } = await created()
      if (error) fail('não deu pra listar os personagens', error)
      return (data ?? [])
        .map((row) => parseCharacter({
          id: row.id, name: row.name, appearance: row.appearance, updatedAt: Date.parse(row.updated_at as string),
        }))
        .filter((c): c is CharacterSave => !!c)
        .sort((a, b) => b.updatedAt - a.updatedAt)
    },

    async save(c) {
      // o upsert não mexe em controller_id: boneco novo nasce sem controlador
      const { error } = await supabase.from('vortable_characters').upsert({
        campaign_id: campaignId, user_id: userId, id: c.id, name: c.name, appearance: c.appearance,
      })
      if (error) fail('não deu pra salvar o personagem', error)
    },

    async remove(id) {
      const { error } = await supabase
        .from('vortable_characters').delete().eq('campaign_id', campaignId).eq('user_id', userId).eq('id', id)
      if (error) fail('não deu pra apagar o personagem', error)
    },

    async getActive() {
      const { data, error } = await supabase
        .from('vortable_characters').select('id').eq('campaign_id', campaignId).eq('controller_id', userId).maybeSingle()
      if (error) fail('não deu pra ler o personagem em uso', error)
      return (data?.id as string | undefined) ?? null
    },

    async setActive(id) {
      await assignCharacter(campaignId, userId, id)
    },
  }
}

/**
 * O personagem de UM NPC especial (o mestre o cria na ficha do NPC): sempre o mesmo id, sem "controlador".
 * `name` é o nome da ficha (o personagem nasce com ele).
 */
export async function createNpcCharacterStorage(campaignId: string, masterId: string, key: string): Promise<CharacterStorage> {
  const { parseCharacter } = await loadEngine()
  return {
    async list(): Promise<CharacterSave[]> {
      const { data, error } = await supabase
        .from('vortable_characters').select('*').eq('campaign_id', campaignId).eq('user_id', masterId).eq('id', key)
      if (error) fail('não deu pra ler o personagem do NPC', error)
      return (data ?? [])
        .map((row) => parseCharacter({ id: row.id, name: row.name, appearance: row.appearance, updatedAt: Date.parse(row.updated_at as string) }))
        .filter((c): c is CharacterSave => !!c)
    },
    async save(c) {
      // o NPC tem um personagem só: o id é sempre o da ficha
      const { error } = await supabase.from('vortable_characters').upsert({
        campaign_id: campaignId, user_id: masterId, id: key, name: c.name, appearance: c.appearance,
      })
      if (error) fail('não deu pra salvar o personagem do NPC', error)
    },
    async remove() { await deleteNpcCharacter(campaignId, key) },
    async getActive() { return key },
    async setActive() {},
  }
}

/** Os personagens dos NPCs especiais da campanha (pra pôr nas zonas e mostrar nas fichas). */
export async function listNpcCharacters(campaignId: string): Promise<SpecialNpc[]> {
  const { parseCharacter } = await loadEngine()
  const { data, error } = await supabase
    .from('vortable_characters').select('*').eq('campaign_id', campaignId).like('id', `${NPC_PREFIX}%`)
  if (error) fail('não deu pra listar os NPCs especiais', error)
  return (data ?? [])
    .map((row) => {
      const c = parseCharacter({ id: row.id, name: row.name, appearance: row.appearance })
      return c ? { key: row.id as string, name: c.name, appearance: c.appearance } : null
    })
    .filter((n): n is SpecialNpc => !!n)
}

/** Apaga o personagem de um NPC especial (a ficha foi apagada, ou o mestre quer recomeçar). */
export async function deleteNpcCharacter(campaignId: string, key: string): Promise<void> {
  const { error } = await supabase.from('vortable_characters').delete().eq('campaign_id', campaignId).eq('id', key)
  if (error) fail('não deu pra apagar o personagem do NPC', error)
}

/** O boneco que a pessoa joga agora (null = ainda não tem). */
export async function getMyCharacter(campaignId: string, userId: string): Promise<CampaignCharacter | null> {
  const { data, error } = await supabase
    .from('vortable_characters').select('*').eq('campaign_id', campaignId).eq('controller_id', userId).maybeSingle()
  if (error) fail('não deu pra ler o seu boneco', error)
  return data ? toCharacter(data as CharacterRow) : null
}

/** Todos os bonecos da campanha (o mestre vê e entrega). */
export async function listCampaignCharacters(campaignId: string): Promise<CampaignCharacter[]> {
  const { data, error } = await supabase
    .from('vortable_characters').select('*').eq('campaign_id', campaignId).not('id', 'like', `${NPC_PREFIX}%`).order('updated_at', { ascending: true })
  if (error) fail('não deu pra listar os bonecos', error)
  return ((data ?? []) as CharacterRow[]).map(toCharacter)
}

/**
 * Entrega o boneco `characterId` a `playerId` (null = deixa sem controlador).
 * Cada pessoa joga com um boneco só: o que ela tinha fica livre.
 */
export async function assignCharacter(campaignId: string, playerId: string, characterId: string | null): Promise<void> {
  const free = await supabase
    .from('vortable_characters').update({ controller_id: null })
    .eq('campaign_id', campaignId).eq('controller_id', playerId)
  if (free.error) fail('não deu pra trocar de boneco', free.error)
  if (!characterId) return
  const give = await supabase
    .from('vortable_characters').update({ controller_id: playerId })
    .eq('campaign_id', campaignId).eq('id', characterId)
  if (give.error) fail('não deu pra trocar de boneco', give.error)
}

/** Apaga um boneco (o mestre apaga qualquer um). Quem o jogava volta a criar o seu. */
export async function deleteCharacter(campaignId: string, characterId: string): Promise<void> {
  const { error } = await supabase
    .from('vortable_characters').delete().eq('campaign_id', campaignId).eq('id', characterId)
  if (error) fail('não deu pra apagar o boneco', error)
}

/**
 * Aparência pra jogar/testar: o boneco que a pessoa controla, senão o último
 * que ela criou, senão o padrão.
 */
export async function resolveAppearance(characters: CharacterStorage): Promise<Appearance> {
  const engine = await loadEngine()
  const data = await engine.loadCharacterData(VORTABLE_ASSETS)
  const [list, active] = await Promise.all([characters.list(), characters.getActive()])
  const chosen = list.find((c) => c.id === active) ?? list[0]
  return engine.normalizeAppearance(data, chosen?.appearance ?? engine.defaultAppearance())
}

/** Chama `onChange` quando os bonecos da campanha mudam (o mestre troca, apaga, alguém cria). */
export function watchCharacters(campaignId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`vortable-bonecos:${campaignId}`))
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'vortable_characters', filter: `campaign_id=eq.${campaignId}`,
    }, onChange)
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}
