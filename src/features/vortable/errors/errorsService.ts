import { supabase, uniqueChannel } from '../../../shared/lib/supabase'
import type { VtSeverity } from './catalog'
import type { VtRole } from './vtErrors'

// ────────────────────────────────────────────────────────
// Lista de erros do Vortable (tabela vortable_errors, migration 20240202000000).
// O mestre lê (e limpa) os da campanha dele; o desenvolvedor lê todos.
// ────────────────────────────────────────────────────────

export interface VtErrorRecord {
  id: string
  campaign_id: string
  user_id: string | null
  role: VtRole
  code: string
  severity: VtSeverity
  detail: string
  context: Record<string, unknown>
  count: number
  occurred_at: string
  created_at: string
  who: { id: string; display_name: string; email?: string } | null
  campaign?: { id: string; name: string } | null
}

export const MIGRATION_HINT = 'A lista de erros ainda não existe no banco: aplique a migration 20240202000000_vortable_erros.sql no Supabase.'

function explain(error: { message: string; code?: string }, fallback: string): Error {
  if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message)) return new Error(MIGRATION_HINT)
  return new Error(`${fallback} (${error.message})`)
}

/** Os erros da campanha, do mais novo pro mais velho (guardados por 30 dias). */
export async function listCampaignErrors(campaignId: string, limit = 300): Promise<VtErrorRecord[]> {
  const { data, error } = await supabase
    .from('vortable_errors')
    .select('*, who:profiles(id, display_name)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw explain(error, 'Não foi possível carregar os erros')
  return (data ?? []) as unknown as VtErrorRecord[]
}

/** Desenvolvedor: os erros de todas as campanhas. */
export async function listAllErrors(limit = 1000): Promise<VtErrorRecord[]> {
  const { data, error } = await supabase
    .from('vortable_errors')
    .select('*, who:profiles(id, display_name, email), campaign:campaigns(id, name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw explain(error, 'Não foi possível carregar os erros')
  return (data ?? []) as unknown as VtErrorRecord[]
}

/** Erro novo chegando na campanha (ao vivo). */
export function watchCampaignErrors(campaignId: string, onInsert: (row: VtErrorRecord) => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`vortable-erros:${campaignId}`))
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'vortable_errors', filter: `campaign_id=eq.${campaignId}`,
    }, (payload) => onInsert({ ...(payload.new as VtErrorRecord), who: null }))
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

/** Mestre: limpa a lista da campanha. */
export async function clearCampaignErrors(campaignId: string): Promise<void> {
  const { error } = await supabase.from('vortable_errors').delete().eq('campaign_id', campaignId)
  if (error) throw explain(error, 'Não foi possível limpar a lista')
}

export const ROLE_LABEL: Record<VtRole, string> = { master: 'Mestre', player: 'Jogador', spectator: 'Assistindo' }

/** Hora do erro: só a hora se foi hoje; senão o dia também. */
export function fmtWhen(iso: string): string {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return today
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Os dados do momento (contexto) em linhas legíveis. */
export function contextLines(r: VtErrorRecord): string {
  const labels: Record<string, string> = {
    texto: 'O que houve', navegador: 'Navegador', versao: 'Versão do site', pagina: 'Página', online: 'Internet',
    conexao: 'Conexão', via: 'Por onde', latencia: 'Latência (ms)', zona: 'Zona', conectados: 'Conectados', rtt: 'Latência (ms)',
  }
  const lines = [`Detalhe: ${r.detail || '-'}`]
  for (const [k, v] of Object.entries(r.context ?? {})) {
    const value = typeof v === 'boolean' ? (v ? 'sim' : 'não') : v == null ? '-' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    lines.push(`${labels[k] ?? k}: ${value}`)
  }
  lines.push(`Hora no aparelho: ${new Date(r.occurred_at).toLocaleString('pt-BR')}`)
  return lines.join('\n')
}
