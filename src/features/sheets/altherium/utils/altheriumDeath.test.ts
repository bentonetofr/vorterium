import { describe, expect, it } from 'vitest'
import {
  NEW_DYING,
  afterDeathRoll,
  bonusOnTurn,
  comaSessions,
  deathConsequence,
  deathSuccess,
  deathTurns,
  determinationBonus,
  medicineBonus,
} from './altheriumDeath'

describe('Teste de Morte', () => {
  it('turnos: 3, e 4 com mais de 8 de Espírito', () => {
    expect([0, 4, 8, 9, 10].map(deathTurns)).toEqual([3, 3, 3, 4, 4])
  })

  it('bônus de Determinação até +3 e caindo a cada turno', () => {
    expect(determinationBonus(2, 1)).toBe(3)
    expect(determinationBonus(2, 3)).toBe(3)
    expect(determinationBonus(-1, 0)).toBe(0)
    expect([0, 1, 2, 3].map((r) => bonusOnTurn(2, r))).toEqual([2, 1, 0, 0])
  })

  it('Medicina: +1 a cada 5, até +2; crítico +2', () => {
    expect([4, 5, 9, 10, 20].map((r) => medicineBonus(r, false))).toEqual([0, 1, 1, 2, 2])
    expect(medicineBonus(3, true)).toBe(2)
  })

  it('10 natural passa sempre; senão precisa de 6', () => {
    expect(deathSuccess(10, 10)).toBe(true)
    expect(deathSuccess(5, 5)).toBe(false)
    expect(deathSuccess(4, 6)).toBe(true)
  })

  it('morre ao falhar em todos os turnos', () => {
    let s = afterDeathRoll(NEW_DYING, false, 3)
    s = afterDeathRoll(s, false, 3)
    expect(s.result).toBe(null)
    s = afterDeathRoll(s, false, 3)
    expect(s).toMatchObject({ failures: 3, result: 'dead' })
    // Com 4 turnos, 3 falhas ainda dão chance no quarto.
    let t = afterDeathRoll(NEW_DYING, false, 4)
    t = afterDeathRoll(t, false, 4)
    t = afterDeathRoll(t, false, 4)
    expect(t.result).toBe(null)
    expect(afterDeathRoll(t, true, 4)).toMatchObject({ result: 'stable', failures: 3 })
    expect(afterDeathRoll(t, false, 4).result).toBe('dead')
  })

  it('consequência pelas falhas acumuladas', () => {
    expect(deathConsequence(0, 2).label).toBe('Recupera normalmente')
    expect(deathConsequence(1, 2).label).toBe('Incapacitado')
    expect(deathConsequence(2, 2).coma).toBe(true)
    // Com 4 turnos, estabilizar com 3 falhas conta como 2.
    expect(deathConsequence(3, 9).coma).toBe(true)
    expect(deathConsequence(2, 0).dead).toBe(true)
    expect([1, 2, 3, 4].map(comaSessions)).toEqual([0, 0, 1, 2])
  })
})
