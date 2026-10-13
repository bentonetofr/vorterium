import { describe, expect, it } from 'vitest'
import {
  armorClassFromArmor, averageHitDie, computeArmorClass, computeMaxHp, hitDiceRecoveredOnLongRest, hitDicePool,
} from './combat'
import { computeDerived } from './derive'
import type { ArmorInput, DerivedInput, HpLevel } from './types'

const leather: ArmorInput   = { category: 'light',  baseAc: 11 }
const chainShirt: ArmorInput = { category: 'medium', baseAc: 13 }
const chainMail: ArmorInput  = { category: 'heavy',  baseAc: 16 }
const plate: ArmorInput      = { category: 'heavy',  baseAc: 18 }

const base = { shield: false, dexMod: 0, conMod: 0, wisMod: 0 }

describe('CA com armadura', () => {
  it('leve soma a Destreza inteira', () => {
    expect(armorClassFromArmor(leather, 3)).toBe(14)
    expect(armorClassFromArmor(leather, -1)).toBe(10)
  })

  it('média soma no máximo +2 de Destreza (ou o limite dado)', () => {
    expect(armorClassFromArmor(chainShirt, 3)).toBe(15)
    expect(armorClassFromArmor(chainShirt, 1)).toBe(14)
    expect(armorClassFromArmor(chainShirt, 3, 3)).toBe(16)   // Mestre em Armadura Média
  })

  it('média ainda sofre Destreza negativa', () => {
    expect(armorClassFromArmor(chainShirt, -1)).toBe(12)
  })

  it('pesada ignora a Destreza, positiva ou negativa', () => {
    expect(armorClassFromArmor(chainMail, 3)).toBe(16)
    expect(armorClassFromArmor(chainMail, -2)).toBe(16)
  })

  it('sem armadura é 10 + Destreza', () => {
    expect(armorClassFromArmor(null, 2)).toBe(12)
  })
})

describe('computeArmorClass', () => {
  it('escudo soma +2 e bônus fixos somam por cima', () => {
    expect(computeArmorClass({ ...base, armor: plate, shield: true })).toBe(20)
    expect(computeArmorClass({ ...base, armor: plate, shield: true, bonus: 1 })).toBe(21)
  })

  it('Defesa sem Armadura do Bárbaro: 10 + Des + Con, aceita escudo', () => {
    const o = { ...base, armor: null, dexMod: 2, conMod: 3, barbarianUnarmoredDefense: true }
    expect(computeArmorClass(o)).toBe(15)
    expect(computeArmorClass({ ...o, shield: true })).toBe(17)
  })

  it('Defesa sem Armadura do Monge: 10 + Des + Sab, perde ao usar escudo', () => {
    const o = { ...base, armor: null, dexMod: 3, wisMod: 3, monkUnarmoredDefense: true }
    expect(computeArmorClass(o)).toBe(16)
    expect(computeArmorClass({ ...o, shield: true })).toBe(15)   // volta à CA comum + escudo
  })

  it('vestindo armadura, a Defesa sem Armadura não vale', () => {
    expect(computeArmorClass({ ...base, armor: chainMail, dexMod: 2, conMod: 5, barbarianUnarmoredDefense: true })).toBe(16)
  })

  it('sem armadura nem classe especial é 10 + Des', () => {
    expect(computeArmorClass({ ...base, armor: null, dexMod: 2 })).toBe(12)
  })
})

describe('PV máximo', () => {
  const fighter = (levels: number, rolls: (number | undefined)[] = []): HpLevel[] =>
    Array.from({ length: levels }, (_, i) => ({ hitDie: 10, roll: rolls[i] }))

  it('nível 1 usa o dado cheio mais Constituição', () => {
    expect(computeMaxHp(fighter(1), 2)).toBe(12)
  })

  it('níveis seguintes usam a média arredondada para cima', () => {
    expect(averageHitDie(6)).toBe(4)
    expect(averageHitDie(8)).toBe(5)
    expect(averageHitDie(10)).toBe(6)
    expect(averageHitDie(12)).toBe(7)
    expect(computeMaxHp(fighter(2), 2)).toBe(12 + 8)
    expect(computeMaxHp(fighter(5), 2)).toBe(12 + 4 * 8)
  })

  it('usa o valor rolado quando existe', () => {
    expect(computeMaxHp(fighter(2, [undefined, 3]), 2)).toBe(12 + 5)
  })

  it('cada nível rende no mínimo 1 PV, mesmo com Constituição negativa', () => {
    const wizard: HpLevel[] = [{ hitDie: 6 }, { hitDie: 6, roll: 1 }]
    expect(computeMaxHp([wizard[0]], -3)).toBe(3)            // 6 - 3
    expect(computeMaxHp(wizard, -3)).toBe(3 + 1)             // 1 - 3 vira 1
  })

  it('soma o bônus por nível (Anão da Colina)', () => {
    expect(computeMaxHp(fighter(3), 2)).toBe(28)
    expect(computeMaxHp(fighter(3), 2, 1)).toBe(31)
  })

  it('multiclasse: o primeiro nível usa o dado da classe inicial; os outros, o de cada classe', () => {
    const levels: HpLevel[] = [{ hitDie: 6 }, { hitDie: 10 }, { hitDie: 10 }]   // Mago 1, depois Guerreiro 2
    expect(computeMaxHp(levels, 1)).toBe(7 + 7 + 7)          // 6+1, 6+1, 6+1
  })
})

describe('dados de vida', () => {
  it('conta por tipo de dado', () => {
    const levels: HpLevel[] = [{ hitDie: 10 }, { hitDie: 10 }, { hitDie: 10 }, { hitDie: 6 }, { hitDie: 6 }]
    expect(hitDicePool(levels)).toEqual({ 10: 3, 6: 2 })
  })

  it('descanso longo devolve metade do total, no mínimo 1', () => {
    expect(hitDiceRecoveredOnLongRest(1)).toBe(1)
    expect(hitDiceRecoveredOnLongRest(5)).toBe(2)
    expect(hitDiceRecoveredOnLongRest(20)).toBe(10)
  })
})

describe('computeDerived: CA e PV', () => {
  const sheet: DerivedInput = {
    abilities: { strength: 16, dexterity: 14, constitution: 15, intelligence: 10, wisdom: 12, charisma: 8 },
    classes: [{ classKey: 'fighter', level: 3 }],
    combat: { armor: chainShirt, shield: true, hpLevels: [{ hitDie: 10 }, { hitDie: 10 }, { hitDie: 10 }] },
  }

  it('calcula CA com armadura média, escudo e Destreza limitada', () => {
    expect(computeDerived(sheet).armorClass).toBe(17)        // 13 + 2 + 2
  })

  it('calcula PV e dados de vida', () => {
    const d = computeDerived(sheet)
    expect(d.hpMax).toBe(12 + 8 + 8)                         // Con +2
    expect(d.hitDice).toEqual({ 10: 3 })
  })

  it('PV fica null sem níveis e CA cai para 10 + Des', () => {
    const d = computeDerived({ ...sheet, combat: undefined })
    expect(d.hpMax).toBeNull()
    expect(d.armorClass).toBe(12)
    expect(d.hitDice).toEqual({})
  })

  it('Bárbaro e Monge ganham Defesa sem Armadura pela classe', () => {
    const barbarian = computeDerived({ ...sheet, classes: [{ classKey: 'barbarian', level: 1 }], combat: {} })
    expect(barbarian.armorClass).toBe(10 + 2 + 2)            // Des +2, Con +2
    const monk = computeDerived({ ...sheet, classes: [{ classKey: 'monk', level: 1 }], combat: {} })
    expect(monk.armorClass).toBe(10 + 2 + 1)                 // Des +2, Sab +1
  })

  it('CA e PV manuais vencem o cálculo e ficam marcados', () => {
    const d = computeDerived({ ...sheet, overrides: { armor_class: 21, hp_max: 99 } })
    expect(d.armorClass).toBe(21)
    expect(d.hpMax).toBe(99)
    expect(d.overridden).toEqual(['armor_class', 'hp_max'])
  })
})
