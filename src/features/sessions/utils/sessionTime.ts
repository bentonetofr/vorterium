// ────────────────────────────────────────────────────────
// Horário e duração de uma sessão planejada (colunas session_time e duration_min, migration 20240233). O banco usa os dois pra decidir
// quando a sessão está aberta: do horário marcado menos 15 minutos até o horário mais a duração (o horário vale em Brasília).
// ────────────────────────────────────────────────────────

export const DEFAULT_DURATION_MIN = 240

/** As durações que o formulário oferece, em minutos. */
export const DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 120, label: '2 horas' },
  { value: 180, label: '3 horas' },
  { value: 240, label: '4 horas' },
  { value: 300, label: '5 horas' },
  { value: 360, label: '6 horas' },
  { value: 480, label: '8 horas' },
]

/** O banco devolve "20:00:00": a tela usa "20:00". Vazio ou fora do formato vira null. */
export function normalizeTime(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(raw.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

/** "4 h", "2 h 30". */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

/** A duração entre 30 minutos e 24 horas (o que o banco aceita). */
export const clampDuration = (minutes: number): number => Math.min(1440, Math.max(30, Math.round(Number.isFinite(minutes) ? minutes : DEFAULT_DURATION_MIN)))

/** Quando a sessão abre e fecha, em horário de Brasília (UTC−3, sem horário de verão desde 2019). Só existe com data e horário. */
export function sessionWindow(date: string | null, time: string | null, durationMin: number): { opensAt: Date; startsAt: Date; endsAt: Date } | null {
  const t = normalizeTime(time)
  if (!date || !t || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const startsAt = new Date(`${date}T${t}:00-03:00`)
  if (Number.isNaN(startsAt.getTime())) return null
  return {
    opensAt: new Date(startsAt.getTime() - 15 * 60_000),
    startsAt,
    endsAt: new Date(startsAt.getTime() + clampDuration(durationMin) * 60_000),
  }
}

/** "sáb., 15/11 às 20:00" (no fuso de quem olha). */
export function formatStart(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${day} às ${time}`
}
