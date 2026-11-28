// ────────────────────────────────────────────────────────
// Marcadores (contadores) para a mesa: um nome e um número, com limite opcional. Servem para o que o jogo não numera sozinho
// (Veneno 2, Munição 3, Cargas 1/3, uma Contagem de Progresso). Ficam no personagem, em cada carta de domínio, nos adversários
// e nos ambientes. É só dado: a tela está em components/DhCounters.tsx.
// ────────────────────────────────────────────────────────

export interface DhCounter {
  id: string
  name: string
  value: number
  /** Limite do marcador; 0 = sem limite. */
  max: number
}

export const COUNTER_MAX_VALUE = 99
export const COUNTERS_PER_OWNER = 16
export const COUNTER_NAME_MAX = 40

/** Atalhos para criar marcadores de um toque. */
export const COUNTER_PRESETS = ['Veneno', 'Queimadura', 'Sangramento', 'Munição', 'Cargas', 'Concentração', 'Proteção', 'Marca'] as const

function newCounterId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function newCounter(name = '', max = 0): DhCounter {
  return { id: newCounterId(), name: name.slice(0, COUNTER_NAME_MAX), value: 0, max: clampMax(max) }
}

function clampMax(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(COUNTER_MAX_VALUE, Math.max(0, Math.round(n))) : 0
}

/** O valor sempre entre 0 e o limite (ou 99, sem limite). */
export function clampValue(value: number, max: number): number {
  const top = max > 0 ? Math.min(max, COUNTER_MAX_VALUE) : COUNTER_MAX_VALUE
  return Number.isFinite(value) ? Math.min(top, Math.max(0, Math.round(value))) : 0
}

export function setCounterValue(c: DhCounter, value: number): DhCounter {
  return { ...c, value: clampValue(value, c.max) }
}

/** Muda o limite (0 tira) e puxa o valor para dentro dele. */
export function setCounterMax(c: DhCounter, max: number): DhCounter {
  const m = clampMax(max)
  return { ...c, max: m, value: clampValue(c.value, m) }
}

/** Lê uma lista de marcadores salva (de qualquer jeito que tenha vindo do banco). */
export function normalizeCounters(raw: unknown): DhCounter[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: DhCounter[] = []
  for (const item of raw.slice(0, COUNTERS_PER_OWNER)) {
    const x = (item && typeof item === 'object' ? item : null) as Record<string, unknown> | null
    if (!x || typeof x.name !== 'string') continue
    let id = typeof x.id === 'string' && x.id ? x.id.slice(0, 20) : newCounterId()
    while (seen.has(id)) id = newCounterId()
    seen.add(id)
    const max = clampMax(x.max)
    out.push({ id, name: x.name.slice(0, COUNTER_NAME_MAX), max, value: clampValue(typeof x.value === 'number' ? x.value : 0, max) })
  }
  return out
}

/** Os marcadores de cada carta (por id da carta). Só guarda quem tem algum marcador. */
export function normalizeCardCounters(raw: unknown): Record<string, DhCounter[]> {
  const out: Record<string, DhCounter[]> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [card, list] of Object.entries(raw as Record<string, unknown>).slice(0, 80)) {
    if (!card || card.length > 60) continue
    const counters = normalizeCounters(list)
    if (counters.length) out[card] = counters
  }
  return out
}

/** Todos os valores de volta a zero (os nomes e limites ficam). Usado ao duplicar um adversário e ao "zerar". */
export function resetCounters(list: DhCounter[]): DhCounter[] {
  return list.map((c) => ({ ...c, value: 0 }))
}

/** Cópia com ids novos (para a ficha duplicada não dividir ids com a original). */
export function cloneCounters(list: DhCounter[], resetValues = false): DhCounter[] {
  return list.map((c) => ({ ...c, id: newCounterId(), value: resetValues ? 0 : c.value }))
}

/** "Veneno 2 · Cargas 1/3": o resumo de uma linha dos marcadores que têm algum valor. */
export function counterSummary(list: DhCounter[]): string {
  return list.filter((c) => c.name.trim() && c.value > 0).map((c) => `${c.name.trim()} ${c.value}${c.max > 0 ? `/${c.max}` : ''}`).join(' · ')
}
