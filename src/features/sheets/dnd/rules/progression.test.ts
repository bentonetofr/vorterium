import { describe, expect, it } from 'vitest'
import {
  FIGHTER_ASI_LEVELS, ROGUE_ASI_LEVELS, STANDARD_ASI_LEVELS, XP_THRESHOLDS, asiCountAt, canMulticlassInto,
  levelFromXp, meetsRequirement, xpForLevel, xpToNextLevel,
} from './progression'
import type { AbilityKey } from './types'

const scores = (over: Partial<Record<AbilityKey, number>> = {}): Record<AbilityKey, number> =>
  ({ strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, ...over })

describe('XP e nível', () => {
  it('tem 20 faixas, crescentes', () => {
    expect(XP_THRESHOLDS).toHaveLength(20)
    for (let i = 1; i < 20; i++) expect(XP_THRESHOLDS[i]).toBeGreaterThan(XP_THRESHOLDS[i - 1])
  })

  it('XP dá o nível certo nas bordas', () => {
    expect(levelFromXp(0)).toBe(1)
    expect(levelFromXp(299)).toBe(1)
    expect(levelFromXp(300)).toBe(2)
    expect(levelFromXp(6499)).toBe(4)
    expect(levelFromXp(6500)).toBe(5)
    expect(levelFromXp(355000)).toBe(20)
    expect(levelFromXp(9_999_999)).toBe(20)
  })

  it('XP do nível e quanto falta para o próximo', () => {
    expect(xpForLevel(5)).toBe(6500)
    expect(xpForLevel(0)).toBe(0)
    expect(xpForLevel(99)).toBe(355000)
    expect(xpToNextLevel(0)).toBe(300)
    expect(xpToNextLevel(6500)).toBe(7500)
    expect(xpToNextLevel(355000)).toBeNull()
  })
})

describe('Aumentos de Atributo', () => {
  it('padrão em 4, 8, 12, 16 e 19; Guerreiro com 6 e 14; Ladino com 10', () => {
    expect(STANDARD_ASI_LEVELS).toEqual([4, 8, 12, 16, 19])
    expect(FIGHTER_ASI_LEVELS).toEqual([4, 6, 8, 12, 14, 16, 19])
    expect(ROGUE_ASI_LEVELS).toEqual([4, 8, 10, 12, 16, 19])
  })

  it('conta quantos já foram ganhos', () => {
    expect(asiCountAt(STANDARD_ASI_LEVELS, 3)).toBe(0)
    expect(asiCountAt(STANDARD_ASI_LEVELS, 4)).toBe(1)
    expect(asiCountAt(STANDARD_ASI_LEVELS, 20)).toBe(5)
    expect(asiCountAt(FIGHTER_ASI_LEVELS, 20)).toBe(7)
  })
})

describe('pré-requisitos de multiclasse', () => {
  it('"all" exige todos os atributos em 13 ou mais', () => {
    const monk = { mode: 'all' as const, abilities: ['dexterity', 'wisdom'] as AbilityKey[] }
    expect(meetsRequirement(scores({ dexterity: 13, wisdom: 13 }), monk)).toBe(true)
    expect(meetsRequirement(scores({ dexterity: 13, wisdom: 12 }), monk)).toBe(false)
  })

  it('"any" aceita um dos atributos (Guerreiro)', () => {
    const fighter = { mode: 'any' as const, abilities: ['strength', 'dexterity'] as AbilityKey[] }
    expect(meetsRequirement(scores({ dexterity: 13 }), fighter)).toBe(true)
    expect(meetsRequirement(scores({ strength: 12, dexterity: 12 }), fighter)).toBe(false)
  })

  it('exige cumprir a classe atual e a nova (exemplo do SRD: Bárbaro para Druida)', () => {
    const barbarian = { mode: 'all' as const, abilities: ['strength'] as AbilityKey[] }
    const druid = { mode: 'all' as const, abilities: ['wisdom'] as AbilityKey[] }
    expect(canMulticlassInto(scores({ strength: 13, wisdom: 13 }), [barbarian], druid)).toBe(true)
    expect(canMulticlassInto(scores({ strength: 13, wisdom: 12 }), [barbarian], druid)).toBe(false)
    expect(canMulticlassInto(scores({ strength: 12, wisdom: 14 }), [barbarian], druid)).toBe(false)
  })
})
