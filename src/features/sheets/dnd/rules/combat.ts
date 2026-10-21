import type { ArmorInput, HpLevel } from './types'

// ────────────────────────────────────────────────────────
// Combate (5e 2014): Classe de Armadura, Pontos de Vida e dados de vida.
// ────────────────────────────────────────────────────────

/** Limite de Destreza da armadura média (o talento Mestre em Armadura Média sobe pra 3). */
export const MEDIUM_ARMOR_DEX_CAP = 2

/** Bônus de CA de um escudo. */
export const SHIELD_BONUS = 2

/**
 * CA com armadura: leve soma Destreza inteira, média soma até +2 (ou o limite
 * dado), pesada não soma Destreza. Sem armadura é 10 + Destreza.
 */
export function armorClassFromArmor(armor: ArmorInput | null, dexMod: number, mediumDexCap = MEDIUM_ARMOR_DEX_CAP): number {
  if (!armor) return 10 + dexMod
  switch (armor.category) {
    case 'light':  return armor.baseAc + dexMod
    case 'medium': return armor.baseAc + Math.min(dexMod, mediumDexCap)
    case 'heavy':  return armor.baseAc
  }
}

export interface ArmorClassOptions {
  armor:         ArmorInput | null
  shield:        boolean
  dexMod:        number
  conMod:        number
  wisMod:        number
  /** Defesa sem Armadura do Bárbaro (10 + Des + Con; aceita escudo). */
  barbarianUnarmoredDefense?: boolean
  /** Defesa sem Armadura do Monge (10 + Des + Sab; sem armadura e sem escudo). */
  monkUnarmoredDefense?:      boolean
  mediumDexCap?: number
  /** Bônus fixos (anel de proteção, estilo de luta Defesa, etc.). */
  bonus?:        number
}

/**
 * CA final. Sem armadura, vale a melhor das opções disponíveis (base comum,
 * Defesa sem Armadura de Bárbaro ou de Monge). Escudo soma +2, exceto na do Monge.
 */
export function computeArmorClass(o: ArmorClassOptions): number {
  const shield = o.shield ? SHIELD_BONUS : 0
  const bonus = o.bonus ?? 0

  if (o.armor) return armorClassFromArmor(o.armor, o.dexMod, o.mediumDexCap) + shield + bonus

  const options = [10 + o.dexMod + shield]
  if (o.barbarianUnarmoredDefense) options.push(10 + o.dexMod + o.conMod + shield)
  if (o.monkUnarmoredDefense && !o.shield) options.push(10 + o.dexMod + o.wisMod)
  return Math.max(...options) + bonus
}

/** Média arredondada para cima de um dado de vida (d8 → 5, d10 → 6, d12 → 7). */
export function averageHitDie(die: number): number {
  return Math.floor(die / 2) + 1
}

/**
 * PV máximo. `levels` vem na ordem em que o personagem subiu: o primeiro é o
 * nível 1 (dado cheio da classe inicial) e os outros usam o valor rolado,
 * quando há, ou a média. Cada nível rende no mínimo 1 PV.
 * `bonusPerLevel` cobre Anão da Colina (+1) e o talento Robusto (+2).
 */
export function computeMaxHp(levels: HpLevel[], conMod: number, bonusPerLevel = 0): number {
  return levels.reduce((total, lv, index) => {
    const base = index === 0 ? lv.hitDie : (lv.roll ?? averageHitDie(lv.hitDie))
    return total + Math.max(1, base + conMod + bonusPerLevel)
  }, 0)
}

/** Quantos dados de vida de cada tipo o personagem tem (d6, d8, d10, d12). */
export function hitDicePool(levels: HpLevel[]): Record<number, number> {
  const pool: Record<number, number> = {}
  for (const lv of levels) pool[lv.hitDie] = (pool[lv.hitDie] ?? 0) + 1
  return pool
}

/** Quantos dados de vida voltam num descanso longo: metade do total, mínimo 1. */
export function hitDiceRecoveredOnLongRest(totalDice: number): number {
  return Math.max(1, Math.floor(totalDice / 2))
}

// ────────────────────────────────────────────────────────
// Deslocamento
// ────────────────────────────────────────────────────────

/** Movimento sem Armadura do Monge, em pés, por nível de monge (1 a 20). */
export const MONK_UNARMORED_MOVEMENT: readonly number[] = [
  0, 10, 10, 10, 10, 15, 15, 15, 15, 20, 20, 20, 20, 25, 25, 25, 25, 30, 30, 30,
]

export interface SpeedOptions {
  /** Deslocamento da raça em pés (25 ou 30). */
  base:          number
  barbarianLevel: number
  monkLevel:     number
  armor:         ArmorInput | null
  shield:        boolean
}

/**
 * Deslocamento em pés: base da raça, mais Movimento Rápido do Bárbaro (+10 a
 * partir do 5º nível, sem armadura pesada) e Movimento sem Armadura do Monge
 * (sem armadura e sem escudo).
 */
export function computeSpeed(o: SpeedOptions): number {
  let speed = o.base
  if (o.barbarianLevel >= 5 && o.armor?.category !== 'heavy') speed += 10
  if (o.monkLevel >= 2 && !o.armor && !o.shield) speed += MONK_UNARMORED_MOVEMENT[Math.min(20, o.monkLevel) - 1]
  return speed
}

// ────────────────────────────────────────────────────────
// Ataque com arma
// ────────────────────────────────────────────────────────

export interface WeaponAttackInput {
  range:       'melee' | 'ranged' | 'both'
  /** Propriedades do catálogo em português ("acuidade", "versátil 1d8"...). */
  properties:  readonly string[]
  /** Dado de dano da arma ("1d8"), ou null (Rede). */
  damage:      string | null
  strMod:      number
  dexMod:      number
  proficiencyBonus: number
  proficient:  boolean
  /** Bônus extra de ataque / dano (arma mágica, estilo de luta). */
  attackExtra?: number
  damageExtra?: number
}

export interface WeaponAttack {
  ability:     'strength' | 'dexterity'
  attackBonus: number
  damageBonus: number
  /** Fórmula de dano pronta ("1d8+3"), ou null se a arma não causa dano. */
  damageFormula: string | null
}

/**
 * Força ou Destreza: arma de acuidade usa a melhor das duas; arma à distância
 * usa Destreza; corpo a corpo (inclusive as de arremesso) usa Força.
 */
export function weaponAttack(w: WeaponAttackInput): WeaponAttack {
  const finesse = w.properties.some((p) => p === 'acuidade')
  const useDex = finesse ? w.dexMod > w.strMod : w.range === 'ranged'
  const mod = useDex ? w.dexMod : w.strMod
  const damageBonus = mod + (w.damageExtra ?? 0)
  return {
    ability: useDex ? 'dexterity' : 'strength',
    attackBonus: mod + (w.proficient ? w.proficiencyBonus : 0) + (w.attackExtra ?? 0),
    damageBonus,
    damageFormula: w.damage ? formatDamage(w.damage, damageBonus) : null,
  }
}

/** "1d8" + 3 -> "1d8+3"; + -1 -> "1d8-1"; + 0 -> "1d8". */
export function formatDamage(dice: string, bonus: number): string {
  if (bonus === 0) return dice
  return bonus > 0 ? `${dice}+${bonus}` : `${dice}${bonus}`
}

/** Proficiência com uma arma: a lista tem 'simple', 'martial' ou chaves de armas específicas. */
export function weaponProficient(weapon: { key: string; category: 'simple' | 'martial' }, proficiencies: readonly string[]): boolean {
  return proficiencies.includes(weapon.category) || proficiencies.includes(weapon.key)
}
