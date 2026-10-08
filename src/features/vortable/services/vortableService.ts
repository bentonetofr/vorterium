import { supabase, uniqueChannel } from '../../../shared/lib/supabase'
import type {
  Appearance, CharacterSave, CharacterStorage, WorldData, WorldStorage, ZoneData, ZoneSummary,
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

export async function createWorldStorage(campaignId: string, campaignName: string): Promise<WorldStorage> {
  const { parseWorld, parseZone, newWorld, summarize } = await loadEngine()

  return {
    async loadWorld(): Promise<WorldData> {
      const { data, error } = await supabase
        .from('vortable_worlds').select('data').eq('campaign_id', campaignId).maybeSingle()
      if (error) fail('não deu pra abrir o mundo', error)
      if (!data) return newWorld(campaignName)
      try {
        return parseWorld(data.data)
      } catch {
        return newWorld(campaignName)
      }
    },

    async saveWorld(world) {
      const { error } = await supabase
        .from('vortable_worlds').upsert({ campaign_id: campaignId, data: world })
      if (error) fail('não deu pra salvar o mundo', error)
    },

    async list(): Promise<ZoneSummary[]> {
      const { data, error } = await supabase
        .from('vortable_zones').select('id, summary, updated_at').eq('campaign_id', campaignId)
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
        name: zone.name,
        summary: summarize(zone),
        data: zone,
      })
      if (error) fail('não deu pra salvar a zona', error)
    },

    async remove(id) {
      const { error } = await supabase
        .from('vortable_zones').delete().eq('campaign_id', campaignId).eq('id', id)
      if (error) fail('não deu pra apagar a zona', error)
    },
  }
}

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
  const created = () => supabase.from('vortable_characters').select('*').eq('campaign_id', campaignId).eq('user_id', userId)

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
    .from('vortable_characters').select('*').eq('campaign_id', campaignId).order('updated_at', { ascending: true })
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
