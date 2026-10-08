import { supabase } from '../../../shared/lib/supabase'
import type {
  CharacterSave, CharacterStorage, WorldData, WorldStorage, ZoneData, ZoneSummary,
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

export async function createCharacterStorage(campaignId: string, userId: string): Promise<CharacterStorage> {
  const { parseCharacter } = await loadEngine()
  const mine = () => supabase.from('vortable_characters').select('*').eq('campaign_id', campaignId).eq('user_id', userId)

  return {
    async list(): Promise<CharacterSave[]> {
      const { data, error } = await mine()
      if (error) fail('não deu pra listar os personagens', error)
      return (data ?? [])
        .map((row) => parseCharacter({
          id: row.id, name: row.name, appearance: row.appearance, updatedAt: Date.parse(row.updated_at as string),
        }))
        .filter((c): c is CharacterSave => !!c)
        .sort((a, b) => b.updatedAt - a.updatedAt)
    },

    async save(c) {
      // o upsert não mexe em `active`: personagem novo nasce inativo
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
      const { data, error } = await mine().eq('active', true).maybeSingle()
      if (error) fail('não deu pra ler o personagem em uso', error)
      return (data?.id as string | undefined) ?? null
    },

    async setActive(id) {
      // o índice único aceita um ativo só: desliga o atual antes de ligar o novo
      const off = await supabase
        .from('vortable_characters').update({ active: false })
        .eq('campaign_id', campaignId).eq('user_id', userId).eq('active', true)
      if (off.error) fail('não deu pra trocar de personagem', off.error)
      if (!id) return
      const on = await supabase
        .from('vortable_characters').update({ active: true })
        .eq('campaign_id', campaignId).eq('user_id', userId).eq('id', id)
      if (on.error) fail('não deu pra trocar de personagem', on.error)
    },
  }
}
