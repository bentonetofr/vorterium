import { supabase, uniqueChannel } from '../../shared/lib/supabase'
import type { DieForce } from './ownerTools'

// ────────────────────────────────────────────────────────
// Ajuste do PRÓXIMO dado de um jogador (ferramenta privada do dono; tabela roll_nudges, migration 20240230).
// Dois lados:
//  • o dono define, troca e cancela o ajuste de um jogador (setNudge / clearNudge / listNudges);
//  • o cliente de QUALQUER jogador lê o próprio ajuste (startNudgeSync, no layout) e o dado dele o usa uma vez (takeNudgedDie,
//    chamado pelo sorteio): vira rolagem forçada (não conta pras conquistas) e a linha é apagada.
// Nenhum erro aqui atrapalha uma rolagem: sem a migration ou sem rede, o dado sai normal.
// ────────────────────────────────────────────────────────

export type NudgeMode = Exclude<DieForce, 'off'>

export interface Nudge {
  campaign_id: string
  target_user_id: string
  mode: NudgeMode
  fixed: number
  d20_only: boolean
}

const COLUMNS = 'campaign_id, target_user_id, mode, fixed, d20_only'

// ── Lado do dono ────────────────────────────────────────

/** Os ajustes pendentes de uma campanha (o dono enxerga todos). */
export async function listNudges(campaignId: string): Promise<Nudge[]> {
  const { data, error } = await supabase.from('roll_nudges').select(COLUMNS).eq('campaign_id', campaignId)
  if (error) throw new Error('Não deu pra ler os ajustes. A migration 20240230 já rodou?')
  return (data ?? []) as Nudge[]
}

/** Define (ou troca) o ajuste do próximo dado de um jogador. */
export async function setNudge(n: Nudge): Promise<void> {
  const row = { ...n, fixed: Math.max(1, Math.min(1000, Math.round(n.fixed) || 1)) }
  const { error } = await supabase.from('roll_nudges').upsert(row, { onConflict: 'campaign_id,target_user_id' })
  if (error) throw new Error('Não deu pra gravar o ajuste. A migration 20240230 já rodou?')
}

export async function clearNudge(campaignId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('roll_nudges').delete().eq('campaign_id', campaignId).eq('target_user_id', userId)
  if (error) throw new Error('Não deu pra cancelar o ajuste.')
}

// ── Lado do jogador ─────────────────────────────────────

let mine: Nudge[] = []
let currentCampaign: string | null = null
let userId: string | null = null

/** Qual campanha está aberta agora: o ajuste só vale pros dados rolados nela. */
export function setNudgeCampaign(id: string | null): void {
  currentCampaign = id
}

async function reload(): Promise<void> {
  if (!userId) { mine = []; return }
  const { data, error } = await supabase.from('roll_nudges').select(COLUMNS).eq('target_user_id', userId)
  mine = error ? [] : (data as Nudge[])
}

/**
 * Liga a leitura do próprio ajuste: lê agora e a cada mudança (ao vivo). Devolve a função que desliga.
 * (O ajuste que o dono define aparece pro jogador na hora, sem recarregar.)
 */
export function startNudgeSync(uid: string): () => void {
  userId = uid
  void reload().catch(() => { mine = [] })
  const channel = supabase
    .channel(uniqueChannel(`roll_nudges:${uid}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'roll_nudges' }, () => { void reload().catch(() => { mine = [] }) })
    .subscribe()
  return () => { supabase.removeChannel(channel); userId = null; mine = [] }
}

// Todos os dados de UMA rolagem saem no mesmo instante (sincronamente): a janela abaixo vale até o fim desse instante e
// depois o ajuste é gasto, então só o próximo dado (a próxima rolagem) é mexido, não a seguinte.
let active: Nudge | null = null

function spend(n: Nudge): void {
  active = n
  mine = mine.filter((m) => m !== n)
  queueMicrotask(() => {
    active = null
    void supabase.from('roll_nudges').delete().eq('campaign_id', n.campaign_id).eq('target_user_id', n.target_user_id)
      .then(() => undefined, () => undefined)
  })
}

/**
 * O número que o dado deve mostrar por causa de um ajuste do dono (null = sorteio normal).
 * `bonus`: o dado extra do 6 (Terra Devastada) nunca vira 6, senão o sorteio extra não acabaria.
 */
export function takeNudgedDie(min: number, max: number, bonus = false): number | null {
  const n = active ?? mine.find((m) => m.campaign_id === currentCampaign)
  if (!n) return null
  // "só nos d20": o ajuste espera um d20 (não é gasto por dado de dano ou outro)
  if (n.d20_only && max !== 20) return null
  if (n !== active) spend(n)
  if (bonus) return Math.min(max, Math.max(min, 4))
  if (n.mode === 'max') return max
  if (n.mode === 'min') return min
  return Math.min(max, Math.max(min, n.fixed))
}

/** Só pros testes. */
export function resetNudges(nudges: Nudge[] = [], campaign: string | null = null): void {
  mine = nudges
  currentCampaign = campaign
  active = null
}
