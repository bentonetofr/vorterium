import { describe, expect, it } from 'vitest'
import { buildHpLevels } from './hpLevels'
import { computeMaxHp } from './combat'

const dice: Record<string, number> = { fighter: 10, wizard: 6, rogue: 8 }
const hitDieOf = (key: string) => dice[key] ?? null

describe('buildHpLevels', () => {
  it('uma classe: nível 1 com dado cheio, o resto com a média', () => {
    const levels = buildHpLevels([{ classKey: 'fighter', level: 3, isInitial: true, hpRolls: [] }], hitDieOf)
    expect(levels).toEqual([{ hitDie: 10 }, { hitDie: 10 }, { hitDie: 10 }])
    expect(computeMaxHp(levels, 2)).toBe(12 + 8 + 8)
  })

  it('usa os valores rolados guardados e a média onde é 0', () => {
    const levels = buildHpLevels([{ classKey: 'fighter', level: 4, isInitial: true, hpRolls: [7, 0, 3] }], hitDieOf)
    expect(levels).toEqual([{ hitDie: 10 }, { hitDie: 10, roll: 7 }, { hitDie: 10 }, { hitDie: 10, roll: 3 }])
    expect(computeMaxHp(levels, 0)).toBe(10 + 7 + 6 + 3)
  })

  it('rolagens que faltam viram média', () => {
    const levels = buildHpLevels([{ classKey: 'fighter', level: 3, isInitial: true, hpRolls: [9] }], hitDieOf)
    expect(levels).toEqual([{ hitDie: 10 }, { hitDie: 10, roll: 9 }, { hitDie: 10 }])
  })

  it('multiclasse: dado cheio só no primeiro nível da classe inicial', () => {
    // Mago 1 (inicial) + Guerreiro 2: d6 cheio, depois dois d10 (um rolado)
    const levels = buildHpLevels([
      { classKey: 'fighter', level: 2, isInitial: false, hpRolls: [8, 0] },
      { classKey: 'wizard', level: 1, isInitial: true, hpRolls: [] },
    ], hitDieOf)
    expect(levels).toEqual([{ hitDie: 6 }, { hitDie: 10, roll: 8 }, { hitDie: 10 }])
    expect(computeMaxHp(levels, 1)).toBe(7 + 9 + 7)
  })

  it('classe inicial com vários níveis e outra classe: os rolados de cada uma ficam com ela', () => {
    const levels = buildHpLevels([
      { classKey: 'fighter', level: 3, isInitial: true, hpRolls: [4, 5] },
      { classKey: 'rogue', level: 2, isInitial: false, hpRolls: [6, 0] },
    ], hitDieOf)
    expect(levels).toEqual([
      { hitDie: 10 }, { hitDie: 10, roll: 4 }, { hitDie: 10, roll: 5 },
      { hitDie: 8, roll: 6 }, { hitDie: 8 },
    ])
  })

  it('sem classe marcada como inicial, a primeira da lista faz esse papel', () => {
    const levels = buildHpLevels([
      { classKey: 'wizard', level: 2, isInitial: false, hpRolls: [] },
      { classKey: 'fighter', level: 1, isInitial: false, hpRolls: [] },
    ], hitDieOf)
    expect(levels[0]).toEqual({ hitDie: 6 })
    expect(levels).toHaveLength(3)
  })

  it('classe fora do catálogo é ignorada e sem classes dá lista vazia', () => {
    expect(buildHpLevels([{ classKey: 'meu_homebrew', level: 5, isInitial: true, hpRolls: [] }], hitDieOf)).toEqual([])
    expect(buildHpLevels([], hitDieOf)).toEqual([])
  })
})
