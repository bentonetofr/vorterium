import { useSyncExternalStore } from 'react'

// ────────────────────────────────────────────────────────
// Ferramentas privadas do dono do site (botão acima do sino). Não é recurso do site: não vai nas Novidades.
// Só vale se o botão estiver "armado" (conta do dono, em qualquer campanha, como mestre ou como jogador): quem arma é o OwnerToolsFab;
// fora disso nada aqui mexe em nada.
// ────────────────────────────────────────────────────────

export type DieForce = 'off' | 'max' | 'min' | 'fixed'

export interface OwnerTools {
  /** Conta do dono: sem isto, nada abaixo vale. */
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
  forceUsed = true
  if (bonus) return Math.min(max, Math.max(min, 4))
  if (s.dice === 'max') return max
  if (s.dice === 'min') return min
  return Math.min(max, Math.max(min, s.fixed))
}

// Uma rolagem forçada não conta pras conquistas: quem rola avisa (resetForceUsed antes, takeForceUsed depois) e a rolagem gravada
// fica marcada neste aparelho (markForcedRoll).
let forceUsed = false
export const resetForceUsed = () => { forceUsed = false }
export const takeForceUsed = (): boolean => { const v = forceUsed; forceUsed = false; return v }

const FORCED_KEY = 'owner-tools-forced'
const forcedIds = (): string[] => { try { const v = JSON.parse(localStorage.getItem(FORCED_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [] } catch { return [] } }
export function markForcedRoll(id: string): void {
  try { localStorage.setItem(FORCED_KEY, JSON.stringify([...forcedIds(), id].slice(-1500))) } catch { /* guardar é extra */ }
}
export function isForcedRoll(id: string): boolean {
  return forcedIds().includes(id)
}

// ── O botão some e volta com um atalho ──
// Só esconde o botão (e fecha o painel): o que estiver ligado nos dados continua valendo, e o ponto de aviso volta junto com o botão.

export const OWNER_HIDE_SHORTCUT = 'Alt+Shift+T'
const HIDDEN_KEY = 'owner-tools-hidden'
let hidden = (() => { try { return localStorage.getItem(HIDDEN_KEY) === '1' } catch { return false } })()
const hiddenListeners = new Set<() => void>()

export function setOwnerHidden(next: boolean): void {
  if (next === hidden) return
  hidden = next
  try { localStorage.setItem(HIDDEN_KEY, next ? '1' : '0') } catch { /* guardar é extra */ }
  hiddenListeners.forEach((l) => l())
}
export const toggleOwnerHidden = (): void => setOwnerHidden(!hidden)
export const isOwnerHidden = (): boolean => hidden
export function useOwnerHidden(): boolean {
  return useSyncExternalStore((l) => { hiddenListeners.add(l); return () => { hiddenListeners.delete(l) } }, () => hidden)
}
/** O atalho que esconde e mostra o botão: Alt+Shift+T (sem Ctrl nem Cmd, que o navegador usa). */
export const isHideShortcut = (e: Pick<KeyboardEvent, 'code' | 'altKey' | 'shiftKey' | 'ctrlKey' | 'metaKey'>): boolean =>
  e.code === 'KeyT' && e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey

/** Está mexendo nos dados agora? (pro botão avisar) */
export const diceForced = (s: OwnerTools) => s.armed && s.dice !== 'off'

/** Só pros testes. */
export function resetOwnerTools() {
  state = { ...DEFAULTS }
  hidden = false
  listeners.forEach((l) => l())
  hiddenListeners.forEach((l) => l())
}
