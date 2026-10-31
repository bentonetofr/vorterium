import { describe, expect, it } from 'vitest'
import { coolState, raiseState, stealthDice, stealthOutcome } from './altheriumStealth'
import { BREAKDOWNS, breakdownFor, calmAmount, equilibriumLoss, scarredMax } from './altheriumMind'
import { NEW_SURVIVAL, hungerPenalty, readSurvival, starved } from './altheriumSurvival'

describe('furtividade', () => {
  it('os estados sobem Desatento → Atento → Alerta', () => {
    expect(raiseState('desatento')).toBe('atento')
    expect(raiseState('atento')).toBe('alerta')
    expect(raiseState('alerta')).toBe('alerta')
  })
  it('esfriar: Alerta volta a Atento, e nunca a Desatento na mesma cena', () => {
    expect(coolState('alerta', true)).toBe('atento')
    expect(coolState('atento', true)).toBe('atento')
    expect(coolState('atento', false)).toBe('desatento')
  })
  it('modificadores somam e ficam em ±2', () => {
    expect(stealthDice(['sombra', 'devagar', 'cobertura'])).toBe(2)
    expect(stealthDice(['luz', 'correndo', 'peso'])).toBe(-2)
    expect(stealthDice(['sombra', 'luz'])).toBe(0)
  })
  it('resultados do livro', () => {
    expect(stealthOutcome(14, 8, false, 'atento').result).toBe('perfeita')
    expect(stealthOutcome(3, 8, true, 'atento').result).toBe('perfeita')
    expect(stealthOutcome(9, 8, false, 'atento')).toMatchObject({ result: 'sucesso', next: 'atento' })
    expect(stealthOutcome(6, 8, false, 'atento')).toMatchObject({ result: 'falha', next: 'alerta' })
    expect(stealthOutcome(2, 8, false, 'desatento')).toMatchObject({ result: 'descoberto' })
    expect(stealthOutcome(9, 10, false, 'alerta')).toMatchObject({ result: 'descoberto' })
  })
})

describe('Equilíbrio', () => {
  it('perda: passou perde metade (para baixo), falhou perde tudo', () => {
    expect(equilibriumLoss(7, true)).toBe(3)
    expect(equilibriumLoss(7, false)).toBe(7)
  })
  it('Acalmar: 1 a cada 5, dobrado no crítico', () => {
    expect(calmAmount(14, false)).toBe(2)
    expect(calmAmount(14, true)).toBe(4)
    expect(calmAmount(4, false)).toBe(0)
  })
  it('Cicatriz tira 2 do máximo; a tabela tem 10 linhas e o 10 é permanente', () => {
    expect(scarredMax(15)).toBe(13)
    expect(scarredMax(2)).toBe(1)
    expect(BREAKDOWNS).toHaveLength(10)
    expect(breakdownFor(10).permanent).toBe(true)
    expect(breakdownFor(99).roll).toBe(10)
  })
})

describe('sobrevivência', () => {
  it('lê o banco com limites e valores padrão', () => {
    expect(readSurvival(undefined)).toEqual(NEW_SURVIVAL)
    expect(readSurvival({ tokens: 9, hunger: 7, short_rests: 5, rite_used: 1, traumas: ['a', '', 3] })).toEqual({
      tokens: 5, hunger: 4, short_rests: 2, rite_used: true, traumas: ['a'],
    })
  })
  it('Fome dá −1 por nível e passou de 3 morre', () => {
    expect([0, 1, 3, 4].map(hungerPenalty)).toEqual([0, -1, -3, -3])
    expect(starved(3)).toBe(false)
    expect(starved(4)).toBe(true)
  })
})
