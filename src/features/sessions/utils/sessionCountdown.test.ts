import { describe, expect, it } from 'vitest'
import { countdownLabel, daysUntil, localToday } from './sessionCountdown'

// 11 de novembro de 2026, 22h30 no fuso local
const now = new Date(2026, 10, 11, 22, 30)

describe('sessionCountdown', () => {
  it('hoje no fuso da pessoa, mesmo tarde da noite', () => {
    expect(localToday(now)).toBe('2026-11-11')
  })

  it('conta dias inteiros', () => {
    expect(daysUntil('2026-11-11', now)).toBe(0)
    expect(daysUntil('2026-11-12', now)).toBe(1)
    expect(daysUntil('2026-11-18', now)).toBe(7)
    expect(daysUntil('2026-11-10', now)).toBe(-1)
    expect(daysUntil('2026-12-01', now)).toBe(20)
  })

  it('atravessa a virada do ano e o fim do horário', () => {
    expect(daysUntil('2027-01-01', new Date(2026, 11, 31, 23, 59))).toBe(1)
    expect(daysUntil('2026-11-12', new Date(2026, 10, 11, 0, 1))).toBe(1)
  })

  it('sem data ou data torta: null', () => {
    expect(daysUntil(null, now)).toBeNull()
    expect(daysUntil('', now)).toBeNull()
    expect(daysUntil('amanhã', now)).toBeNull()
    expect(countdownLabel(null, now)).toBeNull()
  })

  it('escreve a contagem como gente', () => {
    expect(countdownLabel('2026-11-11', now)).toBe('hoje')
    expect(countdownLabel('2026-11-12', now)).toBe('amanhã')
    expect(countdownLabel('2026-11-16', now)).toBe('em 5 dias')
    expect(countdownLabel('2026-11-10', now)).toBe('ontem')
    expect(countdownLabel('2026-11-08', now)).toBe('há 3 dias')
  })
})
