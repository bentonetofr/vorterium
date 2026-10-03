import { useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// Painel do desenvolvedor. A conta dev (tabela app_developers, só pelo
// SQL Editor) LÊ tudo pelas policies "dev: le tudo"; a única escrita é o
// status do feedback. Tudo aqui é leitura, fora setFeedbackStatus.
// ────────────────────────────────────────────────────────

// ── Quem é dev ──────────────────────────────────────────

const devCache = new Map<string, Promise<boolean>>()

/** A conta logada é de desenvolvedor? (Sem a migration, sempre false.) */
export function checkIsDeveloper(userId: string): Promise<boolean> {
  let cached = devCache.get(userId)
  if (!cached) {
    cached = Promise.resolve(supabase.rpc('is_developer'))
      .then(({ data, error }) => !error && data === true)
      .catch(() => false)
    devCache.set(userId, cached)
  }
  return cached
}

/** undefined enquanto confere; depois true/false. */
export function useIsDeveloper(userId: string | null | undefined): boolean | undefined {
  const [state, setState] = useState<{ id: string; dev: boolean } | null>(null)
  useEffect(() => {
    if (!userId) return
    let alive = true
    void checkIsDeveloper(userId).then((dev) => { if (alive) setState({ id: userId, dev }) })
    return () => { alive = false }
  }, [userId])
  if (!userId) return false
  return state?.id === userId ? state.dev : undefined
}

export function forgetDeveloperCheck() {
  devCache.clear()
}

// ── Visão geral ─────────────────────────────────────────

export interface DevOverview {
  users: number
  users_7d: number
  active_24h: number
  online_now: number
  campaigns: number
  campaigns_by_system: Record<string, number>
  sheets: number
  messages: number
  messages_24h: number
  rolls: number
  rolls_24h: number
  documents: number
  feedback_new: number
}

export async function getOverview(): Promise<DevOverview> {
  const { data, error } = await supabase.rpc('dev_overview')
  if (error || !data) throw new Error('Não foi possível carregar os números.')
  return data as DevOverview
}

// ── Usuários ────────────────────────────────────────────

export interface DevUser {
  id: string
  display_name: string
  email: string
  avatar_url: string | null
  provider: string | null
  created_at: string
  last_sign_in_at: string | null
  campaigns: number
}

export async function listUsers(): Promise<DevUser[]> {
  const { data, error } = await supabase.rpc('dev_list_users')
  if (error) throw new Error('Não foi possível carregar os usuários.')
  return (data ?? []) as DevUser[]
}

export interface DevMembership {
  role: 'master' | 'player'
  created_at: string
  campaign: { id: string; name: string; system: string; status: string } | null
}

export async function getUserMemberships(userId: string): Promise<DevMembership[]> {
  const { data, error } = await supabase
    .from('campaign_members')
    .select('role, created_at, campaign:campaigns(id, name, system, status)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error('Não foi possível carregar as campanhas da pessoa.')
  return (data ?? []) as unknown as DevMembership[]
}

// ── Campanhas ───────────────────────────────────────────

export interface DevCampaign {
  id: string
  name: string
  system: string
  status: string
  cover_url: string | null
  created_at: string
  master: { id: string; display_name: string } | null
  members: { count: number }[]
}

export async function listCampaigns(): Promise<DevCampaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, name, system, status, cover_url, created_at, master:profiles!campaigns_master_id_fkey(id, display_name), members:campaign_members(count)')
    .order('created_at', { ascending: false })
  if (error) throw new Error('Não foi possível carregar as campanhas.')
  return (data ?? []) as unknown as DevCampaign[]
}

export interface DevProfile { id: string; display_name: string; email?: string; avatar_url: string | null }

export interface DevMember {
  user_id: string
  role: 'master' | 'player'
  created_at: string
  profile: DevProfile | null
}

export interface DevMessage {
  id: string
  user_id: string
  recipient_id: string | null
  content: string
  created_at: string
}

export interface DevRoll {
  id: string
  user_id: string
  formula: string | null
  die_type: string
  result: number
  is_private: boolean
  roll_breakdown: unknown
  created_at: string
}

export type DevRecord = Record<string, unknown>

export interface DevSheet {
  table: 'character_sheets' | 'altherium_character_sheets' | 'td_character_sheets'
  row: DevRecord
  /** Só Altherium: domínios, inventário e runas. */
  extras?: { label: string; rows: DevRecord[] }[]
}

export interface DevCampaignDetail {
  campaign: DevRecord & { id: string; name: string; system: string }
  members: DevMember[]
  profiles: Map<string, DevProfile>
}

export async function getCampaignDetail(campaignId: string): Promise<DevCampaignDetail> {
  const [camp, mem] = await Promise.all([
    supabase.from('campaigns').select('*').eq('id', campaignId).maybeSingle(),
    supabase
      .from('campaign_members')
      .select('user_id, role, created_at, profile:profiles(id, display_name, email, avatar_url)')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true }),
  ])
  if (camp.error || !camp.data) throw new Error('Campanha não encontrada.')
  const members = (mem.data ?? []) as unknown as DevMember[]
  const profiles = new Map<string, DevProfile>()
  for (const m of members) if (m.profile) profiles.set(m.user_id, m.profile)
  return { campaign: camp.data as DevCampaignDetail['campaign'], members, profiles }
}

const LIST_LIMIT = 300

export async function getCampaignMessages(campaignId: string): Promise<DevMessage[]> {
  const { data, error } = await supabase
    .from('campaign_messages')
    .select('id, user_id, recipient_id, content, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT)
  if (error) throw new Error('Não foi possível carregar as mensagens.')
  return (data ?? []) as DevMessage[]
}

export async function getCampaignRolls(campaignId: string): Promise<DevRoll[]> {
  const { data, error } = await supabase
    .from('dice_rolls')
    .select('id, user_id, formula, die_type, result, is_private, roll_breakdown, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT)
  if (error) throw new Error('Não foi possível carregar as rolagens.')
  return (data ?? []) as DevRoll[]
}

export async function getCampaignSheets(campaignId: string): Promise<DevSheet[]> {
  const tables = ['altherium_character_sheets', 'td_character_sheets', 'character_sheets'] as const
  const results = await Promise.all(
    tables.map((t) => supabase.from(t).select('*').eq('campaign_id', campaignId).order('created_at', { ascending: true })),
  )
  const sheets: DevSheet[] = []
  results.forEach((res, i) => {
    for (const row of (res.data ?? []) as DevRecord[]) sheets.push({ table: tables[i], row })
  })

  const altIds = sheets.filter((s) => s.table === 'altherium_character_sheets').map((s) => s.row.id as string)
  if (altIds.length > 0) {
    const [dom, inv, runes] = await Promise.all([
      supabase.from('altherium_character_domains').select('*').in('sheet_id', altIds),
      supabase.from('altherium_character_inventory').select('*').in('sheet_id', altIds),
      supabase.from('altherium_runaskin_runes').select('*').in('sheet_id', altIds),
    ])
    const by = (rows: DevRecord[] | null, id: string) => (rows ?? []).filter((r) => r.sheet_id === id)
    for (const s of sheets) {
      if (s.table !== 'altherium_character_sheets') continue
      const id = s.row.id as string
      s.extras = [
        { label: 'Domínios', rows: by(dom.data as DevRecord[] | null, id) },
        { label: 'Inventário', rows: by(inv.data as DevRecord[] | null, id) },
        { label: 'Runas', rows: by(runes.data as DevRecord[] | null, id) },
      ]
    }
  }
  return sheets
}

export async function getCampaignRows(
  table: 'campaign_notes' | 'campaign_sessions' | 'campaign_documents' | 'campaign_mesa_images',
  campaignId: string,
): Promise<DevRecord[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT)
  if (error) throw new Error('Não foi possível carregar.')
  return (data ?? []) as DevRecord[]
}

/** Link temporário pra abrir um arquivo privado de qualquer bucket. */
export async function getFileUrl(bucket: string, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) throw new Error('Não foi possível abrir o arquivo.')
  return data.signedUrl
}

// ── Feedback ────────────────────────────────────────────

export type FeedbackStatus = 'novo' | 'lido' | 'resolvido'

export interface DevFeedback {
  id: string
  kind: 'problema' | 'sugestao' | 'outro'
  message: string
  page: string | null
  app_version: string | null
  user_agent: string | null
  image_path: string | null
  status: FeedbackStatus
  created_at: string
  author: { id: string; display_name: string; email: string } | null
  imageUrl: string | null
}

export async function listFeedback(): Promise<DevFeedback[]> {
  const { data, error } = await supabase
    .from('site_feedback')
    .select('id, kind, message, page, app_version, user_agent, image_path, status, created_at, author:profiles(id, display_name, email)')
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT)
  if (error) throw new Error('Não foi possível carregar o feedback.')
  const rows = (data ?? []) as unknown as Omit<DevFeedback, 'imageUrl'>[]

  const paths = rows.map((r) => r.image_path).filter((p): p is string => !!p)
  const urls = new Map<string, string>()
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from('feedback-images').createSignedUrls(paths, 60 * 60)
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl)
  }
  return rows.map((r) => ({ ...r, imageUrl: r.image_path ? urls.get(r.image_path) ?? null : null }))
}

/** A única alteração que o desenvolvedor pode fazer. */
export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  const { error } = await supabase.from('site_feedback').update({ status }).eq('id', id)
  if (error) throw new Error('Não foi possível mudar o status.')
}

// ── Formatação ──────────────────────────────────────────

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return 'nunca'
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h atrás`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} ${d === 1 ? 'dia' : 'dias'} atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
