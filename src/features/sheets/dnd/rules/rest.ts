import { hitDiceRecoveredOnLongRest } from './combat'

// ────────────────────────────────────────────────────────
// Descansos (5e 2014). Funções puras: recebem o estado e devolvem o novo.
// ────────────────────────────────────────────────────────

export type RechargeKind = 'short' | 'long' | 'dawn' | 'manual'

/** Qualquer coisa que gasta e recarrega: recurso de classe, espaço de magia, característica com usos. */
export interface Rechargeable {
  current:  number
  max:      number
  recharge: RechargeKind | null
}

/** Descanso curto: o que recarrega no descanso curto volta ao máximo. */
export function applyShortRest<T extends Rechargeable>(items: readonly T[]): T[] {
  return items.map((i) => (i.recharge === 'short' ? { ...i, current: i.max } : i))
}

/** Descanso longo: volta tudo que recarrega no descanso curto, no longo ou no amanhecer. */
export function applyLongRest<T extends Rechargeable>(items: readonly T[]): T[] {
  return items.map((i) => (i.recharge === 'short' || i.recharge === 'long' || i.recharge === 'dawn' ? { ...i, current: i.max } : i))
}

/** Dados de vida gastos por tipo de dado ("8": 2 = dois d8 gastos). */
export type HitDiceUsed = Record<string, number>

/** Dados de vida do tipo que ainda não foram gastos. */
export function hitDiceAvailable(pool: Record<number, number>, used: HitDiceUsed, die: number): number {
  return Math.max(0, (pool[die] ?? 0) - (used[String(die)] ?? 0))
}

/** Gasta um dado de vida do tipo; devolve null se não há nenhum sobrando. */
export function spendHitDie(pool: Record<number, number>, used: HitDiceUsed, die: number): HitDiceUsed | null {
  if (hitDiceAvailable(pool, used, die) < 1) return null
  return { ...used, [String(die)]: (used[String(die)] ?? 0) + 1 }
}

/**
 * Descanso longo: recupera dados de vida gastos até metade do total (mínimo 1),
 * começando pelos maiores. Dados que a ficha não tem mais (por exemplo, depois
 * de tirar uma classe) saem da conta de gastos.
 */
export function recoverHitDice(pool: Record<number, number>, used: HitDiceUsed): HitDiceUsed {
  const total = Object.values(pool).reduce((a, b) => a + b, 0)
  let toRecover = total > 0 ? hitDiceRecoveredOnLongRest(total) : 0
  const next: HitDiceUsed = {}
  // limpa gastos de dados que não existem mais e prende no que existe
  for (const [die, n] of Object.entries(used)) {
    const have = pool[Number(die)] ?? 0
    if (have > 0 && n > 0) next[die] = Math.min(n, have)
  }
  for (const die of Object.keys(next).map(Number).sort((a, b) => b - a)) {
    if (toRecover <= 0) break
    const back = Math.min(toRecover, next[String(die)])
    next[String(die)] -= back
    toRecover -= back
    if (next[String(die)] === 0) delete next[String(die)]
  }
  return next
}

/** PV recuperados ao gastar um dado de vida: o dado rolado mais Constituição, nunca negativo. */
export function hitDieHealing(roll: number, conMod: number): number {
  return Math.max(0, roll + conMod)
}

export interface LongRestState {
  hpMax:         number
  hpCurrent:     number
  exhaustion:    number
  deathSaves:    { successes: number; failures: number }
  hitDiceUsed:   HitDiceUsed
  hitDicePool:   Record<number, number>
}

export interface LongRestResult {
  hpCurrent:     number
  exhaustion:    number
  deathSaves:    { successes: number; failures: number }
  hitDiceUsed:   HitDiceUsed
}

/**
 * Descanso longo da ficha: PV ao máximo (os PV temporários ficam como estão),
 * -1 de exaustão, salvaguardas contra a morte zeradas e dados de vida
 * recuperados. Recursos e características recarregam por applyLongRest.
 */
export function longRestSheet(s: LongRestState): LongRestResult {
  return {
    hpCurrent:   Math.max(s.hpCurrent, s.hpMax),
    exhaustion:  Math.max(0, s.exhaustion - 1),
    deathSaves:  { successes: 0, failures: 0 },
    hitDiceUsed: recoverHitDice(s.hitDicePool, s.hitDiceUsed),
  }
}
