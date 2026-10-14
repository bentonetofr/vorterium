import type { AbilityKey } from './types'
import { MAX_CHARACTER_LEVEL } from './abilities'

// ────────────────────────────────────────────────────────
// Progressão (5e 2014, SRD 5.1): XP por nível, aumentos de atributo e
// pré-requisitos de multiclasse. Tabelas conferidas contra o SRD.
// ────────────────────────────────────────────────────────

/** XP mínimo para cada nível (índice 0 = nível 1). */
export const XP_THRESHOLDS: readonly number[] = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
]

/** Nível que o XP dá (1 a 20). */
export function levelFromXp(xp: number): number {
  let level = 1
  for (let i = 0; i < XP_THRESHOLDS.length; i++) if (xp >= XP_THRESHOLDS[i]) level = i + 1
  return level
}

/** XP necessário para chegar ao nível (1 a 20; fora disso é preso nos limites). */
export function xpForLevel(level: number): number {
  const lv = Math.max(1, Math.min(MAX_CHARACTER_LEVEL, Math.floor(level)))
  return XP_THRESHOLDS[lv - 1]
}

/** XP que falta para o próximo nível (null no nível 20). */
export function xpToNextLevel(xp: number): number | null {
  const level = levelFromXp(xp)
  return level >= MAX_CHARACTER_LEVEL ? null : XP_THRESHOLDS[level] - xp
}

/** Níveis de classe em que se ganha Aumento de Atributo (ou talento). */
export const STANDARD_ASI_LEVELS: readonly number[] = [4, 8, 12, 16, 19]
/** O Guerreiro ganha dois a mais (6 e 14). */
export const FIGHTER_ASI_LEVELS: readonly number[] = [4, 6, 8, 12, 14, 16, 19]
/** O Ladino ganha um a mais (10). */
export const ROGUE_ASI_LEVELS: readonly number[] = [4, 8, 10, 12, 16, 19]

/** Quantos Aumentos de Atributo uma classe já deu até este nível dela. */
export function asiCountAt(asiLevels: readonly number[], classLevel: number): number {
  return asiLevels.filter((l) => l <= classLevel).length
}

/** Limite de um atributo (20 comum; 30 só com efeitos especiais). */
export const ABILITY_SCORE_CAP = 20

/** Pré-requisito de atributo para entrar numa classe (sempre 13 no mínimo). */
export interface MulticlassRequirement {
  /** all: todos os atributos listados; any: pelo menos um (Guerreiro). */
  mode:      'all' | 'any'
  abilities: AbilityKey[]
}

export const MULTICLASS_MINIMUM = 13

export function meetsRequirement(abilities: Record<AbilityKey, number>, req: MulticlassRequirement): boolean {
  const ok = (a: AbilityKey) => abilities[a] >= MULTICLASS_MINIMUM
  return req.mode === 'all' ? req.abilities.every(ok) : req.abilities.some(ok)
}

/**
 * Pode ganhar um nível na classe nova? Precisa cumprir o pré-requisito da classe
 * atual (todas as que já tem) e o da nova.
 */
export function canMulticlassInto(
  abilities: Record<AbilityKey, number>,
  current: MulticlassRequirement[],
  next: MulticlassRequirement,
): boolean {
  return current.every((r) => meetsRequirement(abilities, r)) && meetsRequirement(abilities, next)
}
