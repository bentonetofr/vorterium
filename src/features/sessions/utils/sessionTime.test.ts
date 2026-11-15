import { describe, expect, it } from 'vitest'
import { DEFAULT_DURATION_MIN, clampDuration, durationLabel, formatStart, normalizeTime, sessionWindow } from './sessionTime'

describe('horário da sessão', () => {
  it('o horário do banco (20:00:00) vira 20:00 e o que não é horário vira nada', () => {
    expect(normalizeTime('20:00:00')).toBe('20:00')
    expect(normalizeTime('9:05')).toBe('09:05')
    expect(normalizeTime('24:00')).toBeNull()
    expect(normalizeTime('20:61')).toBeNull()
    expect(normalizeTime('')).toBeNull()
    expect(normalizeTime(null)).toBeNull()
    expect(normalizeTime('de noite')).toBeNull()
  })

  it('a duração fica entre 30 minutos e 24 horas, e aparece em horas', () => {
    expect(clampDuration(10)).toBe(30)
    expect(clampDuration(5000)).toBe(1440)
    expect(clampDuration(NaN)).toBe(DEFAULT_DURATION_MIN)
    expect(durationLabel(240)).toBe('4 h')
    expect(durationLabel(150)).toBe('2 h 30')
    expect(durationLabel(45)).toBe('45 min')
  })

  it('a sessão abre 15 minutos antes do horário de Brasília e fecha no fim da duração', () => {
    const w = sessionWindow('2026-11-15', '20:00', 240)!
    expect(w.startsAt.toISOString()).toBe('2026-11-15T23:00:00.000Z')
    expect(w.opensAt.toISOString()).toBe('2026-11-15T22:45:00.000Z')
    expect(w.endsAt.toISOString()).toBe('2026-11-16T03:00:00.000Z')
  })

  it('sem data ou sem horário não há janela (a sessão marcada só pela data não abre sozinha)', () => {
    expect(sessionWindow(null, '20:00', 240)).toBeNull()
    expect(sessionWindow('2026-11-15', null, 240)).toBeNull()
    expect(sessionWindow('15/11/2026', '20:00', 240)).toBeNull()
  })

  it('o próximo horário aparece com dia e hora', () => {
    expect(formatStart('2026-11-15T23:00:00.000Z')).toMatch(/\d{2}\/\d{2}.* às \d{2}:\d{2}/)
    expect(formatStart('lixo')).toBe('')
  })
})
