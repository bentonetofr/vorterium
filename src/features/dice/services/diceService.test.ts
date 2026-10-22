import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/lib/supabase', () => ({ supabase: {}, uniqueChannel: (b: string) => b }))
vi.mock('../../activity/services/activityService', () => ({ logActivity: () => {} }))

import { parseDiceFormula, rollParsedFormula } from './diceService'

describe('rolagem: fórmulas do D&D e piso', () => {
  it('vantagem, desvantagem e dado de reação na mesma fórmula', () => {
    const p = parseDiceFormula('2#d20+1d4+5')
    expect(p.terms.map((t) => [t.type, t.quantity, t.sides])).toEqual([['keep_highest', 2, 20], ['sum', 1, 4]])
    expect(p.modifier).toBe(5)
    expect(parseDiceFormula('2@d20-1').terms[0].type).toBe('keep_lowest')
  })

  it('com piso (padrão), o total nunca fica abaixo de 1', () => {
    for (let i = 0; i < 200; i++) expect(rollParsedFormula(parseDiceFormula('1d4-10')).total).toBe(1)
  })

  it('sem piso, o total pode ser 0 ou negativo e bate com a conta', () => {
    for (let i = 0; i < 200; i++) {
      const r = rollParsedFormula(parseDiceFormula('1d4-10'), { floor: false })
      const die = r.breakdown[0] as { results: number[] }
      expect(r.total).toBe(die.results[0] - 10)
      expect(r.total).toBeLessThan(0)
    }
  })

  it('vantagem mantém o maior d20', () => {
    for (let i = 0; i < 100; i++) {
      const r = rollParsedFormula(parseDiceFormula('2#d20+3'), { floor: false })
      const t = r.breakdown[0] as { results: number[]; kept: number }
      expect(t.kept).toBe(Math.max(...t.results))
      expect(r.total).toBe(t.kept + 3)
    }
  })
})
