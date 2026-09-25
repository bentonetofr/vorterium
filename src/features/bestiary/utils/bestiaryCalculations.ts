import { findWeapon } from '../../sheets/altherium/constants/altheriumItems'
import type { AltheriumInventoryItem } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Regra de criação de inimigos de Altherium.
//
//  HP    ≈ dano médio do grupo por rodada × rodadas que a luta deve durar
//  Dano  ≈ vida média do grupo × % de perigo (dano médio, não fixo)
//  Dados → o dado (d4…d12) cuja média chega mais perto desse dano, com
//          bônus pro que sobrar.
//
// O "dano do grupo" soma a média da melhor arma de cada personagem (em
// Altherium o dano é só o dado da arma — atributo não soma).
// ────────────────────────────────────────────────────────

const DICE_PATTERN = /^([0-9]{0,2})d([0-9]{1,3})([+-][0-9]{1,3})?$/

/** Média de uma expressão de dados ("2d6+1" → 8). null se não for válida. */
export function diceAverage(expr: string): number | null {
  const match = DICE_PATTERN.exec(expr.trim().toLowerCase())
  if (!match) return null
  const count = match[1] ? Number(match[1]) : 1
  const sides = Number(match[2])
  const bonus = match[3] ? Number(match[3]) : 0
  if (count < 1 || sides < 1) return null
  return (count * (sides + 1)) / 2 + bonus
}

export interface WeaponPick {
  name:    string
  dice:    string
  average: number
}

/** A arma de maior dano médio do inventário (catálogo ou personalizada). */
export function bestWeapon(items: AltheriumInventoryItem[]): WeaponPick | null {
  let best: WeaponPick | null = null
  for (const item of items) {
    if (item.item_type !== 'arma') continue
    const catalog = findWeapon(item.item_id)
    const name = catalog?.name ?? item.custom_name ?? 'Arma'
    const dice = catalog?.damageDice ?? item.custom_damage_dice
    if (!dice) continue
    const average = diceAverage(dice)
    if (average == null) continue
    if (!best || average > best.average) best = { name, dice, average }
  }
  return best
}

// ── Rodadas ──────────────────────────────────────────────

export const ROUNDS_MIN = 1
export const ROUNDS_MAX = 10
export const DEFAULT_ROUNDS = 4

/** 3 rodadas → combate rápido; 4–5 → padrão; 6+ → boss. */
export function roundsLabel(rounds: number): string {
  if (rounds <= 3) return 'Combate rápido'
  if (rounds <= 5) return 'Combate padrão'
  return 'Boss'
}

// ── Perigo ───────────────────────────────────────────────

export type DangerTier = 'fraco' | 'medio' | 'forte'

export const DANGER_TIERS: { id: DangerTier; label: string; min: number; max: number; pct: number }[] = [
  { id: 'fraco', label: 'Fraco', min: 15, max: 20, pct: 18 },
  { id: 'medio', label: 'Médio', min: 20, max: 30, pct: 25 },
  { id: 'forte', label: 'Forte', min: 30, max: 40, pct: 35 },
]

export const DANGER_PCT_MIN = 5
export const DANGER_PCT_MAX = 60

/** Faixa em que o % cai (bordas contam pra faixa de cima); null fora das três. */
export function dangerTierFor(pct: number): DangerTier | null {
  if (pct >= 30 && pct <= 40) return 'forte'
  if (pct >= 20 && pct < 30)  return 'medio'
  if (pct >= 15 && pct < 20)  return 'fraco'
  return null
}

// ── HP / CR ──────────────────────────────────────────────

export function suggestHp(partyDamage: number, rounds: number): number | null {
  if (partyDamage <= 0) return null
  return Math.max(1, Math.round(partyDamage * rounds))
}

/** Faixas usuais: 4–12 CR 0 · 13–20 CR 1 · 21–35 CR 2 · 36–55 CR 3 · 56–80 CR 4. */
export function challengeRating(hp: number): string {
  if (hp <= 12) return 'CR 0'
  if (hp <= 20) return 'CR 1'
  if (hp <= 35) return 'CR 2'
  if (hp <= 55) return 'CR 3'
  if (hp <= 80) return 'CR 4'
  return 'CR 5+'
}

// ── Dano / dados ─────────────────────────────────────────

export function targetDamage(partyAvgHp: number, dangerPct: number): number | null {
  if (partyAvgHp <= 0) return null
  return (partyAvgHp * dangerPct) / 100
}

const DIE_SIDES = [4, 6, 8, 10, 12]
const MAX_DICE  = 10

export interface DiceSuggestion {
  dice:    string
  average: number
}

/**
 * Traduz o dano desejado em dados: usa o menor número de dados que
 * alcança o valor (1 dado até 6,5 de média, 2 até 13...), escolhe o
 * dado cuja média chega mais perto e cobre a sobra com bônus inteiro
 * (só quando passa de 1 ponto — meio ponto de diferença não vale o +1).
 */
export function suggestDice(target: number): DiceSuggestion {
  const count = Math.min(MAX_DICE, Math.max(1, Math.ceil(target / 6.5)))
  let sides = DIE_SIDES[0]
  let bestDiff = Infinity
  for (const s of DIE_SIDES) {
    const diff = Math.abs((count * (s + 1)) / 2 - target)
    if (diff < bestDiff) { bestDiff = diff; sides = s }
  }
  const mean  = (count * (sides + 1)) / 2
  const bonus = Math.max(0, Math.trunc(target - mean))
  const dice  = `${count}d${sides}${bonus > 0 ? `+${bonus}` : ''}`
  return { dice, average: mean + bonus }
}

/** "3,5" — número com vírgula e no máximo 1 casa. */
export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}
