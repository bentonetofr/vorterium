import type { DiceRoll, RollBreakdownItem } from '../../../../shared/types'
import type { DieKind } from '../../../dice3d/polyhedra'
import type { StageDie } from '../../../dice3d/DiceStage'

// ────────────────────────────────────────────────────────
// Da rolagem gravada para os dados do palco: cada resultado vira um dado 3D
// (o d100 vira dois, dezena e unidade). Dados sem forma 3D (d2, d3...) ficam
// de fora da animação e aparecem só no resultado.
// ────────────────────────────────────────────────────────

const KIND_OF: Record<number, DieKind> = { 4: 'd4', 6: 'd6', 8: 'd8', 10: 'd10', 12: 'd12', 20: 'd20' }

/** Um resultado de d100 (1 a 100) como dezena (00 a 90) e unidade (1 a 10, o 10 aparece como 0). */
export function splitPercentile(v: number): { tens: number; units: number } {
  const unitsDigit = v % 10
  return { tens: (v % 100) - unitsDigit, units: unitsDigit === 0 ? 10 : unitsDigit }
}

export function stageDiceFor(breakdown: readonly RollBreakdownItem[], skin?: string): StageDie[] {
  const out: StageDie[] = []
  for (const b of breakdown) {
    if (b.type === 'modifier' || !('results' in b)) continue
    const term = b as { type: string; sides: number; results: number[]; kept?: number }
    const keptIdx = term.type === 'keep_highest' || term.type === 'keep_lowest' ? term.results.indexOf(term.kept ?? -1) : -1
    term.results.forEach((value, i) => {
      const dim = keptIdx >= 0 && i !== keptIdx
      if (term.sides === 100) {
        const { tens, units } = splitPercentile(value)
        out.push({ kind: 'd100', value: tens, skin, dim }, { kind: 'd10', value: units, skin, dim })
      } else if (KIND_OF[term.sides]) out.push({ kind: KIND_OF[term.sides], value, skin, dim })
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
