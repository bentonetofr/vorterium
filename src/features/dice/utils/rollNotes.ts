import type { RollBreakdownItem } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Observações que acompanham certas rolagens. Hoje, só o 1d3: o d3 é um dado
// que quase ninguém tem, então a rolagem dele vem com uma piada da casa.
// ────────────────────────────────────────────────────────

export const D3_NOTE = 'dado pra ver o tamanho de coisas kkkk'

interface RollLike { roll_breakdown?: readonly RollBreakdownItem[] | null }

/** A observação da rolagem (ou null): um único d3, sozinho ou com modificador. */
export function rollNote(roll: RollLike): string | null {
  const dice = (roll.roll_breakdown ?? []).filter((b) => b.type !== 'modifier')
  if (dice.length !== 1) return null
  const t = dice[0]
  return 'sides' in t && t.sides === 3 && t.quantity === 1 ? D3_NOTE : null
}

/** Mesma regra, para quem só tem os dados já lidos (o painel da rolagem livre). */
export function groupsNote(groups: readonly { sides: number; results: readonly number[] }[]): string | null {
  return groups.length === 1 && groups[0].sides === 3 && groups[0].results.length === 1 ? D3_NOTE : null
}
