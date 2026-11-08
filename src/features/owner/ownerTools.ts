import { useSyncExternalStore } from 'react'

// ────────────────────────────────────────────────────────
// Ferramentas privadas do dono do site (botão acima do sino). Não é recurso do site: não vai nas Novidades.
// Só vale se o botão estiver "armado" (conta do dono + campanha aberta em que ele é mestre): quem arma é o OwnerToolsFab;
// fora disso nada aqui mexe em nada.
// ────────────────────────────────────────────────────────

export type DieForce = 'off' | 'max' | 'min' | 'fixed'

export interface OwnerTools {
  /** Conta do dono + campanha em que ele é mestre: sem isto, nada abaixo vale. */
  armed: boolean
  /** O que fazer com cada dado que o dono rolar: sorteio normal, sempre o máximo (crítico), sempre o mínimo ou um número. */
  dice: DieForce
  /** Número do modo `fixed` (vale o mais perto que o dado tem). */
  fixed: number
  /** Só mexe nos d20 (o dano e os outros dados saem no sorteio). */
  d20Only: boolean
}

const KEY = 'owner-tools'
const DEFAULTS: OwnerTools = { armed: false, dice: 'off', fixed: 20, d20Only: false }

function load(): OwnerTools {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<OwnerTools> | null
    if (!raw) return DEFAULTS
    const dice = raw.dice === 'max' || raw.dice === 'min' || raw.dice === 'fixed' ? raw.dice : 'off'
    const fixed = typeof raw.fixed === 'number' && Number.isFinite(raw.fixed) ? Math.max(1, Math.min(1000, Math.round(raw.fixed))) : 20
    return { armed: false, dice, fixed, d20Only: raw.d20Only === true }
  } catch {
    return DEFAULTS
  }
}

let state: OwnerTools = load()
const listeners = new Set<() => void>()

function emit(next: OwnerTools) {
  state = next
  listeners.forEach((l) => l())
  try { localStorage.setItem(KEY, JSON.stringify({ dice: next.dice, fixed: next.fixed, d20Only: next.d20Only })) } catch { /* guardar é extra */ }
}

export function getOwnerTools(): OwnerTools {
  return state
}

export function setOwnerTools(patch: Partial<OwnerTools>) {
  emit({ ...state, ...patch })
}

export function useOwnerTools(): OwnerTools {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => state)
}

/**
 * O número que o dado deve mostrar (null = sorteio normal). `bonus`: dado extra do 6 (Terra Devastada), que não pode ser 6
 * de novo, senão o sorteio extra nunca acabaria.
 */
export function forcedDie(min: number, max: number, bonus = false): number | null {
  const s = state
  if (!s.armed || s.dice === 'off') return null
  if (s.d20Only && max !== 20) return null
  if (bonus) return Math.min(max, Math.max(min, 4))
  if (s.dice === 'max') return max
  if (s.dice === 'min') return min
  return Math.min(max, Math.max(min, s.fixed))
}

/** Está mexendo nos dados agora? (pro botão avisar) */
export const diceForced = (s: OwnerTools) => s.armed && s.dice !== 'off'

/** Só pros testes. */
export function resetOwnerTools() {
  state = { ...DEFAULTS }
  listeners.forEach((l) => l())
}
