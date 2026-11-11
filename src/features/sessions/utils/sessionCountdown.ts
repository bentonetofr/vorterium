// ────────────────────────────────────────────────────────
// Quanto falta pra sessão. As sessões guardam só o dia ('AAAA-MM-DD'), sem
// hora, então a conta é em dias inteiros, no fuso de quem está olhando.
// ────────────────────────────────────────────────────────

/** Hoje no fuso da pessoa, como 'AAAA-MM-DD'. (toISOString é UTC: no Brasil, depois das 21h já seria amanhã.) */
export function localToday(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Dias de hoje até a data (0 = hoje, 1 = amanhã, negativo = já passou). `null` se a data não vale. */
export function daysUntil(date: string | null | undefined, now: Date = new Date()): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  const target = Date.UTC(y, m - 1, d)
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86_400_000)
}

/** "hoje", "amanhã", "em 5 dias", "ontem", "há 3 dias". `null` sem data. */
export function countdownLabel(date: string | null | undefined, now: Date = new Date()): string | null {
  const days = daysUntil(date, now)
  if (days === null) return null
  if (days === 0) return 'hoje'
  if (days === 1) return 'amanhã'
  if (days === -1) return 'ontem'
  if (days > 1) return `em ${days} dias`
  return `há ${-days} dias`
}

/** "sáb., 14 de nov." — dia curto pra acompanhar a contagem. */
export function shortDay(date: string): string {
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}
