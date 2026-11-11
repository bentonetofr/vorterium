import { supabase } from '../../shared/lib/supabase'
import { getMyCampaigns } from '../campaigns/services/campaignService'
import { CAMPAIGN_SECTIONS } from '../campaigns/campaignSections'
import { SITE_NAV, TOOL_NAV } from '../../app/navigation'
import { formatRole } from '../../shared/utils/campaign'
import { getSystemLabel } from '../../shared/constants/systems'
import type { SearchItem } from './searchCore'

// ────────────────────────────────────────────────────────
// De onde vêm os resultados da busca geral. As páginas do site são fixas;
// campanhas, fichas, episódios, notas e criaturas são lidos do banco na
// primeira vez que a busca abre e ficam guardados por alguns minutos.
// Cada fonte que falhar só fica de fora (a busca nunca quebra por isso).
// ────────────────────────────────────────────────────────

const PAGES: SearchItem[] = [
  { key: 'page:/campanhas',      kind: 'page', title: 'Campanhas',      to: '/campanhas',      keywords: 'inicio home mesas' },
  { key: 'page:/campanhas/nova', kind: 'page', title: 'Nova campanha',  to: '/campanhas/nova', keywords: 'criar campanha mestrar' },
  { key: 'page:/minhas-fichas',  kind: 'page', title: 'Minhas fichas',  to: '/minhas-fichas',  keywords: 'personagens' },
  { key: 'page:/atividade',      kind: 'page', title: 'Atividade',      to: '/atividade',      keywords: 'historico eventos rolagens' },
  { key: 'page:/perfil',         kind: 'page', title: 'Perfil',         to: '/perfil',         keywords: 'conta nome foto senha' },
  ...[...TOOL_NAV, ...SITE_NAV].map((n): SearchItem => ({
    key: `page:${n.to}`, kind: 'page', title: n.label, to: n.to, keywords: n.hint,
  })),
]

async function safe<T>(load: () => PromiseLike<T[]> | Promise<T[]>): Promise<T[]> {
  try { return await load() } catch { return [] }
}

async function rows<T>(table: string, columns: string, campaignIds: string[]): Promise<T[]> {
  if (campaignIds.length === 0) return []
  const { data, error } = await supabase.from(table).select(columns).in('campaign_id', campaignIds).limit(400)
  if (error) return []
  return (data ?? []) as T[]
}

async function loadSheets(): Promise<SearchItem[]> {
  // Os serviços de ficha chegam sob demanda: só quem abre a busca paga por eles.
  const [simple, alth, td, tda, vtm, dnd] = await Promise.all([
    safe(async () => (await import('../sheets/services/sheetService')).getMySheets()),
    safe(async () => (await import('../sheets/altherium/services/altheriumSheetService')).getMyAltheriumSheetsEverywhere()),
    safe(async () => (await import('../sheets/terraDevastada/services/tdSheetService')).getMyTdSheetsEverywhere()),
    safe(async () => (await import('../sheets/terraDevastadaAdaptada/services/tdaSheetService')).getMyTdaSheetsEverywhere()),
    safe(async () => (await import('../sheets/vampiro/services/vampiroSheetService')).getMyVtmSheetsEverywhere()),
    safe(async () => (await import('../sheets/dnd/services/dndSheetService')).getMyDndSheetsEverywhere()),
  ])
  type AnySheet = { id: string; campaign_id: string; campaign_name: string; character_name?: string | null }
  const all: { sheet: AnySheet; system: string }[] = [
    ...simple.map((sheet) => ({ sheet: sheet as AnySheet, system: getSystemLabel(sheet.campaign_system) })),
    ...alth.map((sheet) => ({ sheet: sheet as AnySheet, system: 'Altherium' })),
    ...td.map((sheet) => ({ sheet: sheet as AnySheet, system: 'Terra Devastada' })),
    ...tda.map((sheet) => ({ sheet: sheet as AnySheet, system: 'Terra Devastada' })),
    ...vtm.map((sheet) => ({ sheet: sheet as AnySheet, system: 'Vampiro' })),
    ...dnd.map((sheet) => ({ sheet: sheet as AnySheet, system: 'D&D 5e' })),
  ]
  return all
    .filter(({ sheet }) => sheet.character_name?.trim())
    .map(({ sheet, system }): SearchItem => ({
      key: `sheet:${sheet.id}`,
      kind: 'sheet',
      title: sheet.character_name!.trim(),
      subtitle: `${sheet.campaign_name} · ${system}`,
      to: `/campanhas/${sheet.campaign_id}/mesa-sessao`,
      keywords: 'ficha personagem',
    }))
}

async function loadIndex(): Promise<SearchItem[]> {
  const campaigns = await safe(() => getMyCampaigns())
  const active = campaigns.filter((c) => c.status !== 'archived')
  const ids = active.map((c) => c.id)
  const nameOf = new Map(campaigns.map((c) => [c.id, c.name]))

  const [sheets, episodes, notes, creatures] = await Promise.all([
    safe(loadSheets),
    rows<{ id: string; title: string; campaign_id: string }>('campaign_sessions', 'id, title, campaign_id', ids),
    rows<{ id: string; title: string; campaign_id: string }>('campaign_notes', 'id, title, campaign_id', ids),
    safe(async () => {
      const { data, error } = await supabase.from('user_bestiary').select('id, name').limit(400)
      return error ? [] : ((data ?? []) as { id: string; name: string }[])
    }),
  ])

  return [
    ...PAGES,
    ...campaigns.map((c): SearchItem => ({
      key: `campaign:${c.id}`,
      kind: 'campaign',
      title: c.name,
      subtitle: `${formatRole(c.role)} · ${getSystemLabel(c.system)}${c.status === 'archived' ? ' · arquivada' : ''}`,
      to: `/campanhas/${c.id}`,
    })),
    ...active.flatMap((c) => CAMPAIGN_SECTIONS
      // Configurações é só do mestre
      .filter((s) => s.id !== 'configuracoes' || c.role === 'master')
      .map((s): SearchItem => ({
        key: `section:${c.id}:${s.id}`,
        kind: 'section',
        title: s.label,
        subtitle: c.name,
        to: `/campanhas/${c.id}/${s.id}`,
      }))),
    ...sheets,
    ...episodes.filter((e) => e.title?.trim()).map((e): SearchItem => ({
      key: `episode:${e.id}`, kind: 'episode', title: e.title, subtitle: nameOf.get(e.campaign_id), to: `/campanhas/${e.campaign_id}/sessoes`,
    })),
    ...notes.filter((n) => n.title?.trim()).map((n): SearchItem => ({
      key: `note:${n.id}`, kind: 'note', title: n.title, subtitle: nameOf.get(n.campaign_id), to: `/campanhas/${n.campaign_id}/notas`,
    })),
    ...creatures.filter((c) => c.name?.trim()).map((c): SearchItem => ({
      key: `creature:${c.id}`, kind: 'creature', title: c.name, subtitle: 'Meu bestiário', to: '/meu-bestiario',
    })),
  ]
}

const TTL_MS = 3 * 60 * 1000
let cache: { at: number; userId: string; items: Promise<SearchItem[]> } | null = null

/** Páginas fixas: já dá pra buscar nelas enquanto o resto carrega. */
export const STATIC_ITEMS = PAGES

/** O índice inteiro (guardado por alguns minutos, por conta). */
export function getSearchIndex(userId: string): Promise<SearchItem[]> {
  if (cache && cache.userId === userId && Date.now() - cache.at < TTL_MS) return cache.items
  const items = loadIndex().catch(() => PAGES)
  cache = { at: Date.now(), userId, items }
  return items
}
