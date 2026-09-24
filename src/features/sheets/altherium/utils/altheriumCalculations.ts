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
// Vitalidade, Equilíbrio, Força de Vontade e Pontos Rúnicos NÃO são mais
// calculados aqui — o máximo de cada um é campo direto (`vitality_max`,
// `equilibrio_max`, `fv_max`, `pr_max`), editável na barra da ficha.
// Só as Cartas do Pilar continuam derivadas (do nível).
// ────────────────────────────────────────────────────────

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

/**
 * Triunfos que o Berserker pode ter: ⌊(2 + domínios com ponto) ÷ 2⌋.
 * Conta domínios com pelo menos 1 ponto, não a soma dos pontos.
 */
export function berserkerTriumphLimit(domains: { points: number }[]): number {
  const withPoints = domains.filter((d) => d.points > 0).length
  return Math.floor((2 + withPoints) / 2)
}

/**
 * NR do Runaskin — quantos triunfos pode usar numa cena: 15% do PR máximo
 * (arredondado pra cima) no nível 1, dobrando a cada nível. Conta em
 * inteiros (×15 ÷100) pra 15% de 20 dar 3 e não 3,0000000000000004 → 4.
 */
export function runaskinUsesPerScene(prMaximum: number | null, level: number): number | null {
  if (prMaximum == null) return null
  const base = Math.ceil((prMaximum * 15) / 100)
  return base * 2 ** (level - 1)
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
