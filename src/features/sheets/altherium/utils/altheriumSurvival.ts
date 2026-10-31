// ────────────────────────────────────────────────────────
// Sobrevivência de Altherium (livro 2.0, "Descanso" e "Exploração"): o que a
// ficha guarda além dos pontos de vida: Fichas de Exploração, nível de Fome,
// quantos Descansos Curtos já foram feitos desde o último Longo, se o Rito do
// dia já foi usado e os Traumas permanentes. Vive na coluna `survival` (jsonb,
// migration 20240218).
// ────────────────────────────────────────────────────────

/** Máximo de Fichas de Exploração que um personagem acumula. */
export const TOKENS_MAX = 5
/** Cada nível de Fome dá −1 em todos os testes; passou de 3 níveis, morre. */
export const HUNGER_MAX = 3
/** No máximo 2 Descansos Curtos entre dois Descansos Longos. */
export const SHORT_RESTS_MAX = 2
/** Traumas guardados na ficha. */
export const TRAUMAS_MAX = 6

export interface Survival {
  tokens:      number
  hunger:      number
  short_rests: number
  /** Um Rito de Altherium por Descanso Longo. */
  rite_used:   boolean
  /** Marca da Ruptura: não cura com descanso nem com rito (missão pessoal). */
  traumas:     string[]
}

export const NEW_SURVIVAL: Survival = { tokens: TOKENS_MAX, hunger: 0, short_rests: 0, rite_used: false, traumas: [] }

function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
}

/** Lê o jsonb do banco (sempre na mesma ordem de chaves: o eco do save precisa bater). */
export function readSurvival(raw: unknown): Survival {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    tokens:      int(r.tokens, 0, TOKENS_MAX, TOKENS_MAX),
    // 4 = "passou de 3 níveis": o personagem morre de fome.
    hunger:      int(r.hunger, 0, HUNGER_MAX + 1, 0),
    short_rests: int(r.short_rests, 0, SHORT_RESTS_MAX, 0),
    rite_used:   !!r.rite_used,
    traumas:     Array.isArray(r.traumas)
      ? r.traumas.filter((t): t is string => typeof t === 'string' && t.trim() !== '').map((t) => t.trim().slice(0, 120)).slice(0, TRAUMAS_MAX)
      : [],
  }
}

/** Fome: −1 em todos os testes por nível. */
export function hungerPenalty(hunger: number): number {
  const levels = Math.max(0, Math.min(HUNGER_MAX, hunger))
  return levels === 0 ? 0 : -levels
}

export function starved(hunger: number): boolean {
  return hunger > HUNGER_MAX
}

export const HUNGER_LABELS = ['Sem fome', 'Fome 1 (−1)', 'Fome 2 (−2)', 'Fome 3 (−3)', 'Morte por fome'] as const
