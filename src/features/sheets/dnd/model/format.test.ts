import { describe, expect, it } from 'vitest'
import { carryCapacityKg, coinsInGold, feetToMeters, formatKg, formatMeters, formatSigned, inventoryWeightKg } from './format'

describe('formatSigned', () => {
  it('põe o sinal', () => {
    expect(formatSigned(3)).toBe('+3')
    expect(formatSigned(0)).toBe('+0')
    expect(formatSigned(-2)).toBe('-2')
  })
})

describe('pés para metros (livro brasileiro)', () => {
  it('converte os valores usuais', () => {
    expect(feetToMeters(30)).toBe(9)
    expect(feetToMeters(25)).toBe(7.5)
    expect(feetToMeters(5)).toBe(1.5)
    expect(feetToMeters(60)).toBe(18)
    expect(feetToMeters(0)).toBe(0)
  })

  it('formata com vírgula', () => {
    expect(formatMeters(30)).toBe('9 m')
    expect(formatMeters(25)).toBe('7,5 m')
    expect(formatMeters(45)).toBe('13,5 m')
  })
})

describe('peso e moedas', () => {
  it('formata kg com vírgula', () => {
    expect(formatKg(27.5)).toBe('27,5 kg')
    expect(formatKg(3)).toBe('3 kg')
    expect(formatKg(0.5)).toBe('0,5 kg')
  })

  it('capacidade de carga: Força x 7,5 kg', () => {
    expect(carryCapacityKg(10)).toBe(75)
    expect(carryCapacityKg(16)).toBe(120)
  })

  it('peso do inventário soma peso x quantidade', () => {
    expect(inventoryWeightKg([{ weight: 2.5, quantity: 2 }, { weight: 0.1, quantity: 3 }])).toBe(5.3)
    expect(inventoryWeightKg([])).toBe(0)
  })

  it('moedas em ouro equivalente', () => {
    expect(coinsInGold({ cp: 0, sp: 0, ep: 0, gp: 15, pp: 0 })).toBe(15)
    expect(coinsInGold({ cp: 100, sp: 10, ep: 2, gp: 1, pp: 1 })).toBe(1 + 1 + 1 + 1 + 10)
  })
})
