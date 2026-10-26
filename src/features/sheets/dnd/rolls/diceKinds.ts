import type { DiceRoll, RollBreakdownItem } from '../../../../shared/types'
import type { DieKind } from '../../../dice3d/polyhedra'
import type { StageDie } from '../../../dice3d/DiceStage'

// ────────────────────────────────────────────────────────
// Da rolagem gravada para os dados do palco: cada resultado vira um dado 3D
// (o d100 é o bolão de 100 faces, um dado só; o d2 é uma moeda; o d3, um cubo com 1 a 3 repetidos). Dados sem
// forma 3D (d5, d7...) ficam de fora da animação e aparecem só no resultado.
// ────────────────────────────────────────────────────────

const KIND_OF: Record<number, DieKind> = { 2: 'd2', 3: 'd3', 4: 'd4', 6: 'd6', 8: 'd8', 10: 'd10', 12: 'd12', 20: 'd20', 100: 'd100' }

export function stageDiceFor(breakdown: readonly RollBreakdownItem[], skin?: string): StageDie[] {
  const out: StageDie[] = []
  for (const b of breakdown) {
    if (b.type === 'modifier' || !('results' in b)) continue
    const term = b as { type: string; sides: number; results: number[]; kept?: number }
    const keptIdx = term.type === 'keep_highest' || term.type === 'keep_lowest' ? term.results.indexOf(term.kept ?? -1) : -1
    term.results.forEach((value, i) => {
      const dim = keptIdx >= 0 && i !== keptIdx
      if (KIND_OF[term.sides]) out.push({ kind: KIND_OF[term.sides], value, skin, dim })
    })
  }
  return out.slice(0, 200)
}

/** A conta da rolagem em texto, ex.: "1d20 [14] + 3". */
export function partsText(roll: DiceRoll): string {
  const bits: string[] = []
  for (const b of roll.roll_breakdown ?? []) {
    if (b.type === 'modifier') bits.push(b.value >= 0 ? `+ ${b.value}` : `− ${Math.abs(b.value)}`)
    else if ('results' in b) bits.push(`${bits.length ? '+ ' : ''}${(b as { notation: string }).notation} [${(b as { results: number[] }).results.join(', ')}]`)
  }
  return bits.join(' ')
}
