import { diceGroups } from '../dice/utils/critical'
import { isStrong, isWeak, type RollLite } from '../collection/achievements'

// ────────────────────────────────────────────────────────
// Painel do dono, aba Jogadores: o resumo dos dados de cada jogador da campanha, tirado das rolagens gravadas (dice_rolls).
// Só leitura: nada aqui grava nada. O que a conta vê depende do que o banco entrega a ela (rolagem privada de outro
// jogador só aparece pro mestre da campanha).
// ────────────────────────────────────────────────────────

export interface StatRoll extends RollLite {
  user_id: string
  formula?: string | null
  is_private?: boolean
  profile?: { display_name: string | null } | null
}

export interface PlayerRef { userId: string; name: string; role: 'master' | 'player' }

export interface PlayerStats {
  userId: string
  name: string
  role: 'master' | 'player'
  /** Todas as rolagens lidas deste jogador. */
  rolls: number
  /** Quantos d20 ele rolou (um dado = um d20, mesmo numa rolagem de vários). */
  d20: number
  /** Média dos d20 (null se não rolou nenhum). O esperado de um dado justo é 10,5. */
  d20Avg: number | null
  d20Max: number | null
  d20Min: number | null
  /** Resultados fortes (críticos) e falhas críticas, como o site marca. */
  strong: number
  weak: number
  /** Testes com sucesso e com falha (só as rolagens que a ficha classificou). */
  successes: number
  failures: number
  /** A rolagem mais recente. */
  lastAt: string | null
  /** As rolagens mais recentes primeiro (até `recent`). */
  recent: StatRoll[]
}

/**
 * Um resumo por jogador. Quem está na lista de membros aparece mesmo sem rolar; quem rolou e já saiu da campanha entra no fim.
 * `rolls` em qualquer ordem.
 */
export function summarizePlayers(rolls: readonly StatRoll[], members: readonly PlayerRef[], recent = 8): PlayerStats[] {
  const byUser = new Map<string, StatRoll[]>()
  for (const r of rolls) {
    const list = byUser.get(r.user_id)
    if (list) list.push(r); else byUser.set(r.user_id, [r])
  }
  const refs = [...members]
  for (const [userId, list] of byUser) {
    if (!refs.some((m) => m.userId === userId)) refs.push({ userId, name: list[0].profile?.display_name || 'Ex-membro', role: 'player' })
  }
  return refs.map((m) => {
    const mine = (byUser.get(m.userId) ?? []).slice().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    const d20s = mine.flatMap((r) => (diceGroups(r) ?? []).filter((g) => g.sides === 20).flatMap((g) => g.results))
    return {
      userId: m.userId, name: m.name, role: m.role,
      rolls: mine.length,
      d20: d20s.length,
      d20Avg: d20s.length ? d20s.reduce((a, b) => a + b, 0) / d20s.length : null,
      d20Max: d20s.length ? Math.max(...d20s) : null,
      d20Min: d20s.length ? Math.min(...d20s) : null,
      strong: mine.filter(isStrong).length,
      weak: mine.filter(isWeak).length,
      successes: mine.filter((r) => r.roll_context?.outcome === 'success').length,
      failures: mine.filter((r) => r.roll_context?.outcome === 'failure').length,
      lastAt: mine[0]?.created_at ?? null,
      recent: mine.slice(0, recent),
    }
  })
}
