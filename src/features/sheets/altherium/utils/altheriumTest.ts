import type { RollBreakdownItem } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Teste de domínio de Altherium (livro 2.0, "Atributos e domínios"):
//   - rola 1d10 + 1d10 por ponto no domínio e fica com o MAIOR;
//   - soma o valor do atributo ligado ao domínio;
//   - desvantagem (atributo 0 ou marcada): 1 dado a mais e fica o PIOR;
//   - modificadores de situação põem ou tiram dados, no máximo ±2;
//   - se os dados tirados deixam menos de 1 dado, cada um que falta vira
//     desvantagem (Veneno: "se já rolaria só 1 dado, rola com desvantagem");
//   - crítico: o dado que valeu é um 10 natural.
// ────────────────────────────────────────────────────────

/** Limite dos dados de situação, pra mais ou pra menos. */
export const SITUATION_LIMIT = 2

export interface TestPoolInput {
  /** Dados do domínio sem a desvantagem: 1 + pontos + gênesis + "+". */
  baseDice:     number
  disadvantage: boolean
  /** Dados de situação (−2 a +2). */
  situational:  number
}

export interface TestPool {
  count: number
  keep:  'highest' | 'lowest'
}

export function clampSituation(n: number): number {
  return Math.max(-SITUATION_LIMIT, Math.min(SITUATION_LIMIT, Math.trunc(n)))
}

export function testPool({ baseDice, disadvantage, situational }: TestPoolInput): TestPool {
  const n = baseDice + clampSituation(situational)
  if (n >= 1) return disadvantage ? { count: n + 1, keep: 'lowest' } : { count: n, keep: 'highest' }
  // 0 dados → 2 e fica o pior; −1 → 3 e fica o pior...
  return { count: 2 - n + (disadvantage ? 1 : 0), keep: 'lowest' }
}

/**
 * Fórmula do rolador: "3#d10+4" (maior de 3) ou "2@d10" (menor de 2). O
 * dado extra (o +1d4 do Gênesis Caçador/Guerreiro) entra somado depois.
 */
export function testFormula(pool: TestPool, modifier: number, extraDie?: number): string {
  let f = `${pool.count}${pool.keep === 'highest' ? '#' : '@'}d10`
  if (extraDie) f += `+1d${extraDie}`
  if (modifier > 0) f += `+${modifier}`
  if (modifier < 0) f += `${modifier}`
  return f
}

export interface TestReading {
  results:   number[]
  kept:      number
  keep:      'highest' | 'lowest'
  /** Soma dos dados extras (o +1d4 do Gênesis). */
  extra:     number
  /** Atributo e bônus fixos somados. */
  modifier:  number
  total:     number
  crit:      boolean
}

/** Lê a rolagem gravada: cada dado, o que valeu, os extras, os bônus e o total. */
export function readTest(breakdown: readonly RollBreakdownItem[]): TestReading | null {
  const term = breakdown.find((b) => b.type === 'keep_highest' || b.type === 'keep_lowest') as
    | { type: 'keep_highest' | 'keep_lowest'; results: number[]; kept: number }
    | undefined
  if (!term) return null
  let extra = 0
  let modifier = 0
  for (const b of breakdown) {
    if (b.type === 'modifier') modifier += b.value
    else if (b.type === 'sum') extra += b.subtotal
  }
  return {
    results:  term.results,
    kept:     term.kept,
    keep:     term.type === 'keep_highest' ? 'highest' : 'lowest',
    extra,
    modifier,
    total:    term.kept + extra + modifier,
    crit:     term.kept === 10,
  }
}

export interface TestOutcome {
  success: boolean
  /** Por quanto passou (≥ 0) ou falhou (> 0). */
  margin:  number
}

/**
 * Contra um alvo: com `tieWins` (DT, Defesa, Aparar) passa com o total igual
 * ou maior; sem (Ataque contra a Defesa), só com o total maior.
 */
export function testOutcome(total: number, target: number, tieWins = true): TestOutcome {
  const success = tieWins ? total >= target : total > target
  return { success, margin: Math.abs(total - target) }
}
