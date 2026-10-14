import type { FeatureEntry } from '../types'

/** Atalho para escrever uma característica: nível, chave, nome, nome original, resumo. */
export function f(level: number, key: string, name: string, original: string, summary: string): FeatureEntry {
  return { level, key, name, original, summary }
}

/** 20 valores iguais ao longo de faixas de nível: `byLevel([[1, 'd6'], [5, 'd8'], [10, 'd10'], [15, 'd12']])`. */
export function byLevel<T>(steps: [number, T][]): T[] {
  return Array.from({ length: 20 }, (_, i) => {
    const level = i + 1
    let value = steps[0][1]
    for (const [from, v] of steps) if (level >= from) value = v
    return value
  })
}

/** Aumento de Atributo (padrão de todas as classes, nos níveis dados). */
export function asiFeatures(levels: readonly number[]): FeatureEntry[] {
  return levels.map((level) =>
    f(level, 'ability_score_improvement', 'Aumento de Atributo', 'Ability Score Improvement',
      'Aumente um atributo em 2 ou dois atributos em 1 (máximo 20). Se a mesa permitir, troque por um talento.'))
}
