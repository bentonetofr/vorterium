// ────────────────────────────────────────────────────────
// Quais domínios aparecem na ficha por padrão: só 10, os que a pessoa mais usa.
// Os domínios em que ela tem pontos entram sempre (são os dela); o resto das
// vagas vai para os mais rolados. Quem ainda não rolou nada vê os com pontos e,
// depois, os primeiros da lista. "Mostrar mais" abre todos. Só contas.
// ────────────────────────────────────────────────────────

export const DOMAINS_SHOWN = 10

export interface DomainUseInput {
  /** Todos os domínios disponíveis, na ordem da lista. */
  ids:    readonly string[]
  /** Pontos de cada domínio (maior que 0 = a pessoa investiu nele). */
  points: ReadonlyMap<string, number>
  /** Quantas vezes cada domínio foi rolado. */
  usage:  Readonly<Record<string, number>>
  /** Quantos mostrar no mínimo (padrão 10). */
  limit?: number
}

/** Os ids que aparecem por padrão: os com pontos primeiro, depois os mais rolados, até `limit` (ou todos os com pontos, se forem mais). */
export function pickShownDomains({ ids, points, usage, limit = DOMAINS_SHOWN }: DomainUseInput): Set<string> {
  const invested = ids.filter((id) => (points.get(id) ?? 0) > 0)
  const shown = new Set(invested)
  const rest = ids
    .map((id, index) => ({ id, index, uses: usage[id] ?? 0 }))
    .filter((d) => !shown.has(d.id))
    // mais rolados primeiro; empate (inclusive quem nunca rolou) segue a ordem da lista
    .sort((a, b) => b.uses - a.uses || a.index - b.index)
  for (const d of rest) {
    if (shown.size >= limit) break
    shown.add(d.id)
  }
  return shown
}

/** Conta quantas vezes cada domínio foi rolado, nas rolagens de teste do Altherium (roll_context.key). */
export function countDomainUse(rolls: readonly { roll_context?: { system?: string; kind?: string; key?: string } | null }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rolls) {
    const c = r.roll_context
    if (c?.system !== 'altherium' || c.kind !== 'skill' || !c.key) continue
    out[c.key] = (out[c.key] ?? 0) + 1
  }
  return out
}
