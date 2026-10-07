import type { VtmSheet } from '../../../../shared/types'
import {
  VTM_ATTR_SPREAD,
  VTM_BLOOD_POTENCY,
  VTM_BP_BY_GENERATION,
  VTM_HUMANITY_MAX,
  VTM_SKILL_SPREADS,
  VTM_SKILLS,
  type VtmAttrKey,
  type VtmBloodPotencyRow,
} from '../constants/vampiro'

// ────────────────────────────────────────────────────────
// Regras automáticas da ficha de Vampiro (V5): máximos de Vitalidade e
// Força de Vontade, dano superficial/agravado (com o transbordo), estado
// de cada trilha, Humanidade com manchas, Potência de Sangue e a conferência
// da criação (atributos e perícias).
// ────────────────────────────────────────────────────────

export const attr = (s: Pick<VtmSheet, `attr_${VtmAttrKey}`>, k: VtmAttrKey): number => s[`attr_${k}`]

/** Resiliência (Fortitude 1) soma os pontos de Fortitude à Vitalidade. */
export function resilienceBonus(s: Partial<Pick<VtmSheet, 'disciplines' | 'powers'>>): number {
  if (!s.powers?.includes('fortitude.resiliencia')) return 0
  const v = s.disciplines?.fortitude
  return typeof v === 'number' ? Math.max(0, Math.min(5, v)) : 0
}

/** Vitalidade: Vigor + 3 (+ Resiliência + ajuste manual). */
export function healthMax(s: Pick<VtmSheet, 'attr_stamina' | 'health_bonus'> & Partial<Pick<VtmSheet, 'disciplines' | 'powers'>>): number {
  return Math.max(1, s.attr_stamina + 3 + resilienceBonus(s) + s.health_bonus)
}

/** Força de Vontade: Autocontrole + Determinação (+ ajuste manual). */
export function willpowerMax(s: Pick<VtmSheet, 'attr_composure' | 'attr_resolve' | 'willpower_bonus'>): number {
  return Math.max(1, s.attr_composure + s.attr_resolve + s.willpower_bonus)
}

// ── Dano (Vitalidade e Força de Vontade) ────────────────

export interface Track { superficial: number; aggravated: number }

/** O dano nunca passa do máximo (se o máximo cair, o agravado tem prioridade). */
export function clampTrack(t: Track, max: number): Track {
  const aggravated = Math.max(0, Math.min(max, t.aggravated))
  const superficial = Math.max(0, Math.min(max - aggravated, t.superficial))
  return { superficial, aggravated }
}

/**
 * Soma dano. Superficial numa trilha cheia vira agravado (um superficial
 * marcado é trocado por agravado). Agravado numa trilha cheia toma o lugar
 * de um superficial.
 */
export function addDamage(t: Track, max: number, kind: 'superficial' | 'aggravated', amount = 1): Track {
  let { superficial, aggravated } = clampTrack(t, max)
  for (let i = 0; i < amount; i++) {
    const free = max - superficial - aggravated
    if (kind === 'superficial') {
      if (free > 0) superficial++
      else if (superficial > 0) { superficial--; aggravated++ }
    } else if (free > 0) aggravated++
    else if (superficial > 0) { superficial--; aggravated++ }
  }
  return { superficial, aggravated }
}

/** Cura: tira 1 do tipo escolhido. */
export function healDamage(t: Track, kind: 'superficial' | 'aggravated', amount = 1): Track {
  return kind === 'superficial'
    ? { ...t, superficial: Math.max(0, t.superficial - amount) }
    : { ...t, aggravated: Math.max(0, t.aggravated - amount) }
}

export type TrackState = 'ok' | 'impaired' | 'broken'

/**
 * Trilha cheia = Debilitado (−2 dados: físicos na Vitalidade, sociais e
 * mentais na Força de Vontade). Toda agravada = na Vitalidade, torpor (ou
 * a Morte Final, se o golpe foi agravado); na Força de Vontade, sem mais
 * nada pra gastar.
 */
export function trackState(t: Track, max: number): TrackState {
  const c = clampTrack(t, max)
  if (c.aggravated >= max) return 'broken'
  if (c.superficial + c.aggravated >= max) return 'impaired'
  return 'ok'
}

/** Quadradinhos na ordem da ficha: agravados primeiro, depois superficiais. */
export function trackBoxes(t: Track, max: number): ('agg' | 'sup' | 'empty')[] {
  const c = clampTrack(t, max)
  return Array.from({ length: max }, (_, i) => (i < c.aggravated ? 'agg' : i < c.aggravated + c.superficial ? 'sup' : 'empty'))
}

// ── Humanidade e manchas ────────────────────────────────

/**
 * As manchas entram pela direita; se encostam nos pontos de Humanidade, o
 * personagem fica Debilitado pela culpa (degeneração) até o teste de remorso.
 */
export function humanityBoxes(humanity: number, stains: number): ('full' | 'stain' | 'empty' | 'overlap')[] {
  return Array.from({ length: VTM_HUMANITY_MAX }, (_, i) => {
    const filled = i < humanity
    const stained = i >= VTM_HUMANITY_MAX - stains
    if (filled && stained) return 'overlap'
    if (filled) return 'full'
    if (stained) return 'stain'
    return 'empty'
  })
}

export function degenerating(humanity: number, stains: number): boolean {
  return humanity + stains > VTM_HUMANITY_MAX
}

// ── Sangue ──────────────────────────────────────────────

export function bloodPotencyRow(bp: number): VtmBloodPotencyRow {
  return VTM_BLOOD_POTENCY[Math.max(0, Math.min(VTM_BLOOD_POTENCY.length - 1, bp))]
}

export function bpRange(generation: number): { min: number; max: number; start: number } {
  return VTM_BP_BY_GENERATION[generation] ?? { min: 0, max: 10, start: 1 }
}

export function isThinBlood(generation: number): boolean {
  return generation >= 14
}

export function ordinal(generation: number): string {
  return `${generation}ª`
}

// ── Perícias ────────────────────────────────────────────

export function skillDots(s: Pick<VtmSheet, 'skills'>, key: string): number {
  const v = s.skills?.[key]
  return typeof v === 'number' ? Math.max(0, Math.min(5, v)) : 0
}

// ── Conferência da criação ──────────────────────────────

function countsOf(values: number[]): Record<number, number> {
  const out: Record<number, number> = {}
  for (const v of values) out[v] = (out[v] ?? 0) + 1
  return out
}

function sameCounts(a: Record<number, number>, b: Record<number, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].map(Number).filter((k) => k > 0))
  for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false
  return true
}

/** Os atributos batem com a distribuição da criação (4, 3, 3, 3, 2, 2, 2, 2, 1)? */
export function attrSpreadOk(values: number[]): boolean {
  return [...values].sort((x, y) => y - x).join(',') === VTM_ATTR_SPREAD.join(',')
}

/** Qual distribuição de perícias da criação a ficha segue (ou null). */
export function skillSpread(s: Pick<VtmSheet, 'skills'>): string | null {
  const counts = countsOf(VTM_SKILLS.map((k) => skillDots(s, k.key)))
  return VTM_SKILL_SPREADS.find((d) => sameCounts(counts, d.counts))?.label ?? null
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}
