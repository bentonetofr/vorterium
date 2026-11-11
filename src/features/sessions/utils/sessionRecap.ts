// ────────────────────────────────────────────────────────
// Resumo do dia de um episódio, montado a partir das rolagens daquele dia:
// quantas foram, quem rolou e qual foi a maior. Sem banco aqui — só a
// conta, pra poder ser testada.
// ────────────────────────────────────────────────────────

export interface RecapRoll {
  user_id:      string
  name:         string
  /** Total da rolagem (já com modificador), quando existe. */
  total:        number | null
  /** "4d10+8", "d20"… */
  formula:      string | null
  created_at:   string
}

export interface SessionRecap {
  totalRolls: number
  /** Quem rolou, do que mais rolou pro que menos. */
  players:    { name: string; rolls: number }[]
  /** A maior rolagem do dia. */
  best:       { name: string; total: number; formula: string | null } | null
  /** Primeira e última rolagem (horário local "20:14"). */
  from:       string | null
  to:         string | null
}

/**
 * Janela de tempo de uma sessão marcada pro dia `date` ('AAAA-MM-DD'): do
 * começo daquele dia até as 6h da manhã seguinte (sessão que vira a noite
 * continua sendo a mesma). Em horário local de quem olha.
 */
export function sessionWindow(date: string): { start: Date; end: Date } {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  return { start: new Date(y, m - 1, d, 0, 0, 0), end: new Date(y, m - 1, d + 1, 6, 0, 0) }
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function buildRecap(rolls: RecapRoll[]): SessionRecap {
  if (rolls.length === 0) return { totalRolls: 0, players: [], best: null, from: null, to: null }

  const byPlayer = new Map<string, { name: string; rolls: number }>()
  let best: SessionRecap['best'] = null
  let first = rolls[0].created_at
  let last = rolls[0].created_at

  for (const roll of rolls) {
    const entry = byPlayer.get(roll.user_id) ?? { name: roll.name, rolls: 0 }
    entry.rolls += 1
    byPlayer.set(roll.user_id, entry)
    if (roll.total != null && (best === null || roll.total > best.total)) {
      best = { name: roll.name, total: roll.total, formula: roll.formula }
    }
    if (roll.created_at < first) first = roll.created_at
    if (roll.created_at > last) last = roll.created_at
  }

  return {
    totalRolls: rolls.length,
    players: [...byPlayer.values()].sort((a, b) => b.rolls - a.rolls || a.name.localeCompare(b.name, 'pt-BR')),
    best,
    from: clock(first),
    to: clock(last),
  }
}
