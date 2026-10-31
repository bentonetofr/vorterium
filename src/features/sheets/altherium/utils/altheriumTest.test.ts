import { describe, expect, it } from 'vitest'
import { clampSituation, readTest, testFormula, testOutcome, testPool } from './altheriumTest'

describe('teste de domínio de Altherium', () => {
  it('fica com o maior de 1d10 + 1d10 por ponto', () => {
    expect(testPool({ baseDice: 3, disadvantage: false, situational: 0 })).toEqual({ count: 3, keep: 'highest' })
    expect(testFormula({ count: 3, keep: 'highest' }, 4)).toBe('3#d10+4')
  })

  it('desvantagem rola 1 dado a mais e fica o pior', () => {
    expect(testPool({ baseDice: 1, disadvantage: true, situational: 0 })).toEqual({ count: 2, keep: 'lowest' })
    expect(testFormula({ count: 2, keep: 'lowest' }, 0)).toBe('2@d10')
  })

  it('dados de situação ficam entre −2 e +2', () => {
    expect(clampSituation(5)).toBe(2)
    expect(clampSituation(-3)).toBe(-2)
    expect(testPool({ baseDice: 2, disadvantage: false, situational: 4 })).toEqual({ count: 4, keep: 'highest' })
  })

  it('sem dados sobrando, cada um que falta vira desvantagem', () => {
    expect(testPool({ baseDice: 1, disadvantage: false, situational: -1 })).toEqual({ count: 2, keep: 'lowest' })
    expect(testPool({ baseDice: 1, disadvantage: false, situational: -2 })).toEqual({ count: 3, keep: 'lowest' })
    expect(testPool({ baseDice: 1, disadvantage: true, situational: -1 })).toEqual({ count: 3, keep: 'lowest' })
  })

  it('lê cada dado, o escolhido, o atributo e o crítico', () => {
    const reading = readTest([
      { type: 'keep_highest', notation: '3#d10', quantity: 3, sides: 10, results: [4, 10, 1], kept: 10, subtotal: 10 },
      { type: 'modifier', value: 3 },
    ])
    expect(reading).toEqual({ results: [4, 10, 1], kept: 10, keep: 'highest', attribute: 3, total: 13, crit: true })
  })

  it('compara com a DT: empate passa', () => {
    expect(testOutcome(8, 8)).toEqual({ success: true, margin: 0 })
    expect(testOutcome(3, 8)).toEqual({ success: false, margin: 5 })
  })
})
