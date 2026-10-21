// ────────────────────────────────────────────────────────
// Formatação de números da ficha D&D (português do Brasil).
// ────────────────────────────────────────────────────────

/** Modificador com sinal explícito: +3, +0, -1 (sinal de menos de verdade, sem travessão). */
export function formatSigned(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

/** Pés para metros como o livro brasileiro: 30 pés = 9 m, 25 pés = 7,5 m, 5 pés = 1,5 m. */
export function feetToMeters(feet: number): number {
  return Math.round(feet * 0.3 * 100) / 100
}

/** "9 m", "7,5 m". */
export function formatMeters(feet: number): string {
  return `${String(feetToMeters(feet)).replace('.', ',')} m`
}

/** Peso em kg com vírgula: 27,5 kg; 0,5 kg; 3 kg. */
export function formatKg(kg: number): string {
  return `${String(Math.round(kg * 100) / 100).replace('.', ',')} kg`
}

/** Capacidade de carga em kg: Força x 15 libras (7,5 kg por ponto de Força). */
export function carryCapacityKg(strength: number): number {
  return strength * 7.5
}

/** Peso total do inventário em kg (peso x quantidade de cada item). */
export function inventoryWeightKg(items: readonly { weight: number; quantity: number }[]): number {
  return Math.round(items.reduce((sum, i) => sum + i.weight * i.quantity, 0) * 100) / 100
}

/** Moedas em ouro equivalente: 10 pc = 1 pp, 10 pp = 1 po, 2 pe = 1 po, 10 po = 1 pl. */
export function coinsInGold(c: { cp: number; sp: number; ep: number; gp: number; pp: number }): number {
  return Math.round((c.cp / 100 + c.sp / 10 + c.ep / 2 + c.gp + c.pp * 10) * 100) / 100
}
