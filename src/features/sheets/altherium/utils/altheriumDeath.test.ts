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
  it('turnos: 2 + 1 a cada 2 de Espírito, até 5', () => {
    expect([0, 1, 2, 4, 6, 10].map(deathTurns)).toEqual([2, 2, 3, 4, 5, 5])
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

  it('10 natural passa sempre; senão precisa de 7', () => {
    expect(deathSuccess(10, 10)).toBe(true)
    expect(deathSuccess(6, 6)).toBe(false)
    expect(deathSuccess(5, 7)).toBe(true)
  })

  it('morre ao falhar em todos os turnos ou com 3 falhas', () => {
    let s = afterDeathRoll(NEW_DYING, false, 2)
    expect(s.result).toBe(null)
    s = afterDeathRoll(s, false, 2)
    expect(s.result).toBe('dead')
    let t = afterDeathRoll(NEW_DYING, false, 5)
    t = afterDeathRoll(t, false, 5)
    t = afterDeathRoll(t, false, 5)
    expect(t).toMatchObject({ failures: 3, result: 'dead' })
    expect(afterDeathRoll({ ...NEW_DYING, failures: 1, rolls: 1 }, true, 4)).toMatchObject({ result: 'stable', failures: 1 })
  })

  it('consequência pelas falhas acumuladas', () => {
    expect(deathConsequence(0, 2).label).toBe('Recupera normalmente')
    expect(deathConsequence(1, 2).label).toBe('Incapacitado')
    expect(deathConsequence(2, 2).coma).toBe(true)
    expect(deathConsequence(2, 0).dead).toBe(true)
    expect([1, 2, 3, 4].map(comaSessions)).toEqual([0, 0, 1, 2])
  })
})
