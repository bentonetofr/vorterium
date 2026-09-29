import type { RollBreakdownItem } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Crítico e falha crítica "totais": TODOS os dados da rolagem caíram no
// valor máximo (crítico) ou todos em 1 (falha crítica) — 1d20 = 20 ou 1;
// 2d10 = 10 e 10, ou 1 e 1; 1d20+2d6 = 20, 6 e 6, ou 1, 1 e 1.
// Modificador não conta (não é dado). Teste de pares (Terra Devastada)
// não entra: lá não existe crítico assim.
// ────────────────────────────────────────────────────────

interface RollLike {
  die_type?:           string | null
  result?:             number | null
  individual_results?: number[] | null
  roll_breakdown?:     RollBreakdownItem[] | null
}

export type FullRollKind = 'critical' | 'fumble'

/** Os dados da rolagem: lados e resultados de cada grupo (null se não dá pra saber). */
function diceGroups(roll: RollLike): { sides: number; results: number[] }[] | null {
  const breakdown = roll.roll_breakdown
  if (breakdown && breakdown.length > 0) {
    if (breakdown.some((b) => b.type === 'evens')) return null
    const groups = breakdown.flatMap((b) =>
      (b.type === 'sum' || b.type === 'keep_highest' || b.type === 'keep_lowest') ? [{ sides: b.sides, results: b.results }] : [])
    return groups.length > 0 ? groups : null
  }
  // Rolagem antiga, sem detalhamento: usa os resultados individuais (ou o total de 1 dado).
  const sides = Number(String(roll.die_type ?? '').replace(/^d/, ''))
  if (!Number.isFinite(sides)) return null
  const results = roll.individual_results?.length ? roll.individual_results : roll.result != null ? [roll.result] : []
  return results.length > 0 ? [{ sides, results }] : null
}

/** Todos os dados no máximo → 'critical'; todos em 1 → 'fumble'; senão null. */
export function fullRollKind(roll: RollLike): FullRollKind | null {
  const groups = diceGroups(roll)
  if (!groups || groups.some((g) => g.sides <= 1 || g.results.length === 0)) return null
  if (groups.every((g) => g.results.every((r) => r === g.sides))) return 'critical'
  if (groups.every((g) => g.results.every((r) => r === 1))) return 'fumble'
  return null
}

export function isFullCritical(roll: RollLike): boolean {
  return fullRollKind(roll) === 'critical'
}

export function isFullFumble(roll: RollLike): boolean {
  return fullRollKind(roll) === 'fumble'
}
