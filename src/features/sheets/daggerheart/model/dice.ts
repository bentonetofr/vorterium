// ────────────────────────────────────────────────────────
// Dados de Dualidade: dois d12 (Esperança e Medo) em todo teste. O resultado diz quem foi maior e se é sucesso crítico (dados iguais).
// ────────────────────────────────────────────────────────

export type DualityKind = 'critico' | 'esperanca' | 'medo'

export interface DualityInput {
  hope: number
  fear: number
  /** Soma dos modificadores (atributo, Experiências gastas, bônus). */
  modifier: number
  /** d6 de vantagem (soma) ou de desvantagem (subtrai); 0 = nenhum. */
  advantageDie?: number
  advantage?: 'vantagem' | 'desvantagem' | null
  /** Dificuldade, quando conhecida. */
  difficulty?: number | null
}

export interface DualityResult {
  hope: number
  fear: number
  modifier: number
  advantageDie: number
  advantage: 'vantagem' | 'desvantagem' | null
  total: number
  kind: DualityKind
  difficulty: number | null
  /** null quando a Dificuldade não é conhecida. */
  success: boolean | null
}

export function duality(input: DualityInput): DualityResult {
  const advantage = input.advantage ?? null
  const adv = advantage && input.advantageDie ? (advantage === 'vantagem' ? input.advantageDie : -input.advantageDie) : 0
  const total = input.hope + input.fear + input.modifier + adv
  const kind: DualityKind = input.hope === input.fear ? 'critico' : input.hope > input.fear ? 'esperanca' : 'medo'
  const difficulty = input.difficulty ?? null
  // sucesso crítico vale como sucesso mesmo abaixo da Dificuldade
  const success = difficulty === null ? null : kind === 'critico' ? true : total >= difficulty
  return { hope: input.hope, fear: input.fear, modifier: input.modifier, advantageDie: input.advantageDie ?? 0, advantage, total, kind, difficulty, success }
}

export function dualityLabel(r: Pick<DualityResult, 'kind' | 'success'>): string {
  if (r.kind === 'critico') return 'Sucesso crítico'
  const who = r.kind === 'esperanca' ? 'Esperança' : 'Medo'
  if (r.success === null) return `com ${who}`
  return `${r.success ? 'Sucesso' : 'Falha'} com ${who}`
}

/** O que o resultado dá: Esperança para o jogador (esperança ou crítico), Medo para o mestre (medo); o crítico também limpa 1 Ponto de Fadiga. */
export function dualityEffects(r: Pick<DualityResult, 'kind'>): { hope: number; gmFear: number; clearStress: number } {
  if (r.kind === 'critico') return { hope: 1, gmFear: 0, clearStress: 1 }
  if (r.kind === 'esperanca') return { hope: 1, gmFear: 0, clearStress: 0 }
  return { hope: 0, gmFear: 1, clearStress: 0 }
}

/** Dano de um ataque crítico: o valor máximo dos dados mais a rolagem normal. */
export function criticalBase(dice: string, prof: number): number {
  const m = dice.trim().match(/^d(\d+)/i)
  return m ? Number(m[1]) * prof : 0
}

export function rollDie(sides: number, rnd: () => number = Math.random): number {
  return 1 + Math.floor(rnd() * sides)
}
