import {
  getRaiz,
  ATTRIBUTE_POINTS_AT_CREATION,
  PILAR_CARDS_PER_LEVEL,
  RUNASKIN_FREE_RUNICO,
  type AltheriumRaiz,
} from '../constants/altherium'
import type { AltheriumSheet } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Máximos derivados
//
// O "+1d10" das fórmulas do livro é rolado uma única vez na criação: a
// ficha guarda o resultado (`*_roll`) e o máximo é recalculado aqui, então
// acompanha mudanças de atributo sem precisar rolar de novo.
// ────────────────────────────────────────────────────────

/** Vitalidade máxima: base da raiz + d10 rolado + Espírito. */
export function vitalityMax(sheet: AltheriumSheet): number | null {
  if (!sheet.raiz || sheet.vitality_roll == null) return null
  return getRaiz(sheet.raiz).vitalityBase + sheet.vitality_roll + sheet.attr_espirito
}

/** Equilíbrio máximo: base da raiz + d10 rolado + Destino. */
export function equilibrioMax(sheet: AltheriumSheet): number | null {
  if (!sheet.raiz || sheet.equilibrio_roll == null) return null
  return getRaiz(sheet.raiz).equilibrioBase + sheet.equilibrio_roll + sheet.attr_destino
}

/** Força de Vontade máxima (só Berserker): 14 + d10 rolado + Impulso. */
export function fvMax(sheet: AltheriumSheet): number | null {
  if (!sheet.raiz || sheet.fv_roll == null) return null
  const base = getRaiz(sheet.raiz).fvBase
  if (base == null) return null
  return base + sheet.fv_roll + sheet.attr_impulso
}

/** Pontos Rúnicos máximos (só Runaskin): 20 + d10 rolado + Rúnico. */
export function prMax(sheet: AltheriumSheet): number | null {
  if (!sheet.raiz || sheet.pr_roll == null) return null
  const base = getRaiz(sheet.raiz).prBase
  if (base == null) return null
  return base + sheet.pr_roll + sheet.attr_runico
}

/** Cartas máximas (só Pilar): 13 por nível — 13/26/39/52/65. */
export function cardsMax(sheet: AltheriumSheet): number | null {
  if (sheet.raiz !== 'pilar') return null
  return PILAR_CARDS_PER_LEVEL * sheet.level
}

// ────────────────────────────────────────────────────────
// Contadores de criação
// ────────────────────────────────────────────────────────

/**
 * Pontos de atributo gastos. Runaskin ganha +2 em Rúnico de graça, fora
 * dos 16 pontos da criação, então esses 2 não contam aqui.
 */
export function attributePointsUsed(sheet: AltheriumSheet): number {
  const total =
    sheet.attr_furia + sheet.attr_destino + sheet.attr_espirito +
    sheet.attr_impulso + sheet.attr_estrategia + sheet.attr_runico

  const free = sheet.raiz === 'runaskin' ? Math.min(RUNASKIN_FREE_RUNICO, sheet.attr_runico) : 0
  return total - free
}

/** Quantos dos 16 pontos ainda restam (pode ficar negativo se estourar). */
export function attributePointsRemaining(sheet: AltheriumSheet): number {
  return ATTRIBUTE_POINTS_AT_CREATION - attributePointsUsed(sheet)
}

/** Domínios disponíveis: base da raiz + pontos de Estratégia. */
export function domainSlotsTotal(sheet: AltheriumSheet): number | null {
  if (!sheet.raiz) return null
  return getRaiz(sheet.raiz).domainBase + sheet.attr_estrategia
}

// ────────────────────────────────────────────────────────
// Combate / deslocamento
// ────────────────────────────────────────────────────────

/** Movimento por turno: 5m com Impulso 0-8, 10m com 9-10. */
export function movementMeters(impulso: number): number {
  return impulso >= 9 ? 10 : 5
}

/**
 * Dados de um teste de domínio: 1d10 padrão + 1d10 por ponto no domínio.
 * Atributo 0 impõe 1d de desvantagem (sinalizado à parte pela interface).
 */
export function domainTestDice(domainPoints: number): number {
  return 1 + domainPoints
}

/** Raízes que usam cada recurso — a interface esconde o que não se aplica. */
export function usesFv(raiz: AltheriumRaiz | null): boolean {
  return raiz === 'berserker'
}
export function usesPr(raiz: AltheriumRaiz | null): boolean {
  return raiz === 'runaskin'
}
export function usesCards(raiz: AltheriumRaiz | null): boolean {
  return raiz === 'pilar'
}
export function usesRunico(raiz: AltheriumRaiz | null): boolean {
  return raiz === 'runaskin'
}
