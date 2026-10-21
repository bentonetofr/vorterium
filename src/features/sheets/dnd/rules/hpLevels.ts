import type { HpLevel } from './types'

// ────────────────────────────────────────────────────────
// Liga as classes gravadas na ficha (dnd_character_classes) ao cálculo de PV
// (computeMaxHp). Cada classe guarda `hp_rolls`: um valor por nível acima do
// primeiro nível do personagem (0 = usou a média, 1 a 12 = valor rolado).
// ────────────────────────────────────────────────────────

export interface ClassHpRow {
  classKey:  string
  level:     number
  /** A classe do nível 1 do personagem: o primeiro nível dela usa o dado cheio. */
  isInitial: boolean
  hpRolls:   readonly number[]
}

/**
 * Monta a lista de níveis para `computeMaxHp`. O primeiro item é o nível 1 do
 * personagem (dado cheio da classe inicial); os demais usam o valor rolado, ou
 * a média quando o valor é 0 ou falta. A ordem entre as classes depois do
 * primeiro nível não muda a soma. Classe fora do catálogo (sem dado de vida) é
 * ignorada, e o personagem sem nenhuma classe devolve lista vazia.
 */
export function buildHpLevels(rows: readonly ClassHpRow[], hitDieOf: (classKey: string) => number | null): HpLevel[] {
  const known = rows.filter((r) => r.level >= 1 && hitDieOf(r.classKey) != null)
  if (known.length === 0) return []

  // a classe inicial vem primeiro; se nenhuma estiver marcada, vale a primeira da lista
  const initial = known.find((r) => r.isInitial) ?? known[0]
  const ordered = [initial, ...known.filter((r) => r !== initial)]

  const levels: HpLevel[] = []
  for (const row of ordered) {
    const hitDie = hitDieOf(row.classKey)!
    // o nível 1 do personagem é o primeiro nível da classe inicial (sem rolagem guardada)
    const firstRollable = row === initial ? 2 : 1
    for (let classLevel = 1; classLevel <= row.level; classLevel++) {
      if (row === initial && classLevel === 1) { levels.push({ hitDie }); continue }
      const stored = row.hpRolls[classLevel - firstRollable]
      levels.push(stored && stored > 0 ? { hitDie, roll: stored } : { hitDie })
    }
  }
  return levels
}
