import type { TdaTrait } from '../../../../shared/types'
import {
  HEALTH_BANDS, HEALTH_MAX, HORROR_BANDS, HORROR_BASE, HORROR_MAX, POOL_MAX,
  type HealthBand, type HorrorBand,
} from '../constants/terraDevastadaAdaptada'

// ────────────────────────────────────────────────────────
// Contas do Terra Devastada.
// ────────────────────────────────────────────────────────

export interface PoolInfo {
  /** Dados rolados, com o natural (1 a 6). */
  dice:      number
  /** Soma de vantagens − desvantagens ± situação. */
  net:       number
  /** Dados que passaram do teto de 6 e se perderam. */
  overflow:  number
  /** As desvantagens comeram tudo: sobra só o dado natural. */
  cancelled: boolean
}

/**
 * Parada do teste: 1d natural + 1d por vantagem − 1d por desvantagem ±
 * situação. O natural é imune a penalidades; o total nunca passa de 6.
 */
export function poolSize(net: number): PoolInfo {
  const extra = Math.max(0, net)
  const dice = 1 + Math.min(POOL_MAX - 1, extra)
  return {
    dice,
    net,
    overflow: Math.max(0, extra - (POOL_MAX - 1)),
    cancelled: net < 0,
  }
}

/** Cada ponto de desempenho comprado com Convicção custa o Horror atual (mín. 1). */
export function convictionCost(horror: number): number {
  return Math.max(1, horror)
}

/** Horror inicial: 6, −1 por motivação, +1 por desmotivação (0 a 12). */
export function initialHorror(traits: TdaTrait[]): number {
  const motiva = traits.filter((t) => t.tag === 'motiva').length
  const desmotiva = traits.filter((t) => t.tag === 'desmotiva').length
  return clampHorror(HORROR_BASE - motiva + desmotiva)
}

/** Gravidade + envolvimento + ligação − Horror atual (nunca negativo). */
export function horrorGain(scene: number, current: number): number {
  return Math.max(0, scene - current)
}

/** Redenção do horror: cada 3 pontos de desempenho tiram 1 de Horror. */
export function redemptionAmount(performance: number): number {
  return Math.floor(Math.max(0, performance) / 3)
}

export function clampHorror(value: number): number {
  return Math.max(0, Math.min(HORROR_MAX, value))
}

export function horrorBand(horror: number): HorrorBand {
  return HORROR_BANDS.find((b) => horror >= b.min && horror <= b.max) ?? HORROR_BANDS[0]
}

export type TestOutcome = 'sucesso' | 'parcial' | 'falha'

/**
 * Resultado contra uma meta (ou contra o desempenho de quem reage):
 * maior → sucesso; igual → parcial; menor → falha. Nenhum par é falha
 * automática.
 */
export function outcomeAgainst(performance: number, target: number): TestOutcome {
  if (performance <= 0) return 'falha'
  if (performance > target) return 'sucesso'
  if (performance === target) return 'parcial'
  return 'falha'
}

export const OUTCOME_LABELS: Record<TestOutcome, string> = {
  sucesso: 'Sucesso: o objetivo é alcançado.',
  parcial: 'Parcial: alcança em parte, com consequências menores.',
  falha:   'Falha: o objetivo não é alcançado.',
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

// ── Vida e combate ──────────────────────────────────────

export function clampHealth(value: number): number {
  return Math.max(0, Math.min(HEALTH_MAX, value))
}

export function healthBand(health: number): HealthBand {
  return HEALTH_BANDS.find((b) => health >= b.min && health <= b.max) ?? HEALTH_BANDS[0]
}

/**
 * Resultado de um golpe da arma contra a Resistência do alvo: dano igual ou
 * maior mata em um acerto; menor, tira essa parte (o mestre acumula).
 */
export function hitEffect(damage: number, toughness: number): { kills: boolean; remaining: number } {
  return { kills: damage >= toughness, remaining: Math.max(0, toughness - damage) }
}

/**
 * Esquiva: sucesso desvia (0); parcial reduz 1 (mínimo 1); falha leva o dano
 * inteiro. Dano 6 (Baiacu) não se reduz: é o golpe que mata.
 */
export function damageTaken(outcome: TestOutcome, damage: number): number {
  if (outcome === 'sucesso') return 0
  if (outcome === 'parcial') return damage >= HEALTH_MAX ? damage : Math.max(1, damage - 1)
  return damage
}
