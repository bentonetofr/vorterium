// ────────────────────────────────────────────────────────
// Motor de regras DaggerHeart — valores derivados.
// Puro TypeScript, sem React e sem Supabase.
// Baseado no Daggerheart SRD 2.0 (CC-BY 4.0).
// ────────────────────────────────────────────────────────

import type {
  DhDeriveInput,
  DhDerived,
  DhRollResult,
  DhRollOutcome,
} from './types'

// ── Limiares de Dano ──────────────────────────────────────

/**
 * Limiar Grave  = armor.base_major  + nível
 * Limiar Severo = armor.base_severe + nível
 */
export function computeThresholds(input: DhDeriveInput): DhDerived['thresholds'] {
  return {
    major:  input.armor.base_major  + input.level,
    severe: input.armor.base_severe + input.level,
  }
}

// ── Rolar dado de dano ────────────────────────────────────

/**
 * Dados de dano efetivos = [proficiency]d[die]+[mod]
 * Retorna null se não houver arma equipada.
 */
export function computeDamageRoll(input: DhDeriveInput): DhDerived['damage_roll'] {
  if (!input.weapon) return null
  const { damage_die, damage_mod } = input.weapon
  const count = input.proficiency
  const modStr = damage_mod >= 0 ? `+${damage_mod}` : `${damage_mod}`
  return {
    dice_count: count,
    die_type:   damage_die,
    modifier:   damage_mod,
    notation:   `${count}d${damage_die}${damage_mod !== 0 ? modStr : ''}`,
  }
}

// ── Ponto de entrada: computeDerived ─────────────────────

export function computeDerived(input: DhDeriveInput): DhDerived {
  return {
    thresholds:  computeThresholds(input),
    damage_roll: computeDamageRoll(input),
  }
}

// ── HP marcado por quantidade de dano ─────────────────────

/**
 * Devolve quantos slots de HP o personagem deve marcar.
 * Dano já deve estar com resistência aplicada (se houver).
 *
 * SRD 2.0, p. Combat:
 *   < major  → 1 HP
 *   ≥ major e < severe → 2 HP
 *   ≥ severe → 3 HP
 *   dano ≤ 0 → 0 HP
 *   opcional: ≥ 2× severe → 4 HP
 */
export function hpMarkedByDamage(
  damage:   number,
  major:    number,
  severe:   number,
  massiveDamageRule = false,
): number {
  if (damage <= 0) return 0
  if (massiveDamageRule && damage >= severe * 2) return 4
  if (damage >= severe) return 3
  if (damage >= major)  return 2
  return 1
}

// ── Resultado de rolagem Duality Dice ─────────────────────

/**
 * Calcula o resultado de uma rolagem de Duality Dice dados os valores brutos.
 * Esta função não rola dados; recebe os valores já rolados.
 *
 * @param hopeDie     valor do d12 de Esperança (1–12)
 * @param fearDie     valor do d12 de Medo (1–12)
 * @param traitMod    modificador do traço relevante
 * @param difficulty  dificuldade definida pelo Mestre
 * @param advantage   bônus de d6 de vantagem (positivo) ou desvantagem (negativo)
 */
export function resolveDualityRoll(
  hopeDie:    number,
  fearDie:    number,
  traitMod:   number,
  difficulty: number,
  advantage = 0,
): DhRollResult {
  const total = hopeDie + fearDie + traitMod + advantage
  const isCrit = hopeDie === fearDie

  let outcome: DhRollOutcome
  let with_hope: boolean

  if (isCrit) {
    outcome   = 'crit'
    with_hope = true
  } else {
    const success   = total >= difficulty
    const hopeHigher = hopeDie > fearDie
    if (success && hopeHigher)  { outcome = 'success_hope'; with_hope = true  }
    else if (success)           { outcome = 'success_fear'; with_hope = false }
    else if (hopeHigher)        { outcome = 'fail_hope';    with_hope = true  }
    else                        { outcome = 'fail_fear';    with_hope = false }
  }

  return { hope_die: hopeDie, fear_die: fearDie, trait_mod: traitMod, advantage, total, outcome, with_hope }
}

// ── Descrição em PT-BR do resultado ───────────────────────

export function describeRollOutcome(outcome: DhRollOutcome): string {
  switch (outcome) {
    case 'crit':         return 'Sucesso Crítico'
    case 'success_hope': return 'Sucesso com Esperança'
    case 'success_fear': return 'Sucesso com Medo'
    case 'fail_hope':    return 'Falha com Esperança'
    case 'fail_fear':    return 'Falha com Medo'
  }
}
