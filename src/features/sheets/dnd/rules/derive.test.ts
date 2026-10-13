import { describe, expect, it } from 'vitest'
import { computeDerived } from './derive'
import { clampLevel, skillBonus } from './abilities'
import type { DerivedInput } from './types'

// Guerreiro nível 5 de exemplo: FOR 16, DES 12, CON 16, INT 10, SAB 13, CAR 8.
const fighter: DerivedInput = {
  abilities: { strength: 16, dexterity: 12, constitution: 16, intelligence: 10, wisdom: 13, charisma: 8 },
  classes: [{ classKey: 'fighter', level: 5 }],
  saveProficiency: { strength: true, constitution: true },
  skillProficiency: { athletics: 'proficient', perception: 'proficient', intimidation: 'expertise' },
}

describe('computeDerived', () => {
  const d = computeDerived(fighter)

  it('calcula nível total e bônus de proficiência', () => {
    expect(d.totalLevel).toBe(5)
    expect(d.proficiencyBonus).toBe(3)
  })

  it('calcula modificadores de atributo (arredonda para baixo, inclusive negativos)', () => {
    expect(d.abilityMods).toEqual({ strength: 3, dexterity: 1, constitution: 3, intelligence: 0, wisdom: 1, charisma: -1 })
  })

  it('soma proficiência só nas salvaguardas proficientes', () => {
    expect(d.saves.strength).toEqual({ ability: 'strength', proficient: true, bonus: 6 })
    expect(d.saves.dexterity.bonus).toBe(1)
    expect(d.saves.charisma.bonus).toBe(-1)
  })

  it('calcula perícias com proficiência e especialização', () => {
    expect(d.skills.athletics.bonus).toBe(6)      // 3 + 3
    expect(d.skills.perception.bonus).toBe(4)     // 1 + 3
    expect(d.skills.intimidation.bonus).toBe(5)   // -1 + 6 (dobro)
    expect(d.skills.stealth.bonus).toBe(1)        // sem proficiência
  })

  it('calcula iniciativa e percepção passiva', () => {
    expect(d.initiative).toBe(1)
    expect(d.passivePerception).toBe(14)          // 10 + 4
  })

  it('não marca nada como manual por padrão', () => {
    expect(d.overridden).toEqual([])
  })
})

describe('multiclasse e limites de nível', () => {
  it('soma os níveis das classes', () => {
    const d = computeDerived({ ...fighter, classes: [{ classKey: 'fighter', level: 3 }, { classKey: 'wizard', level: 6 }] })
    expect(d.totalLevel).toBe(9)
    expect(d.proficiencyBonus).toBe(4)
  })

  it('prende o nível entre 1 e 20', () => {
    expect(clampLevel(0)).toBe(1)
    expect(clampLevel(35)).toBe(20)
    expect(clampLevel(NaN)).toBe(1)
    expect(computeDerived({ ...fighter, classes: [] }).totalLevel).toBe(1)
  })
})

describe('proficiência por nível (faixas oficiais)', () => {
  const pb = (level: number) => computeDerived({ ...fighter, classes: [{ classKey: 'fighter', level }] }).proficiencyBonus
  it.each([[1, 2], [4, 2], [5, 3], [8, 3], [9, 4], [12, 4], [13, 5], [16, 5], [17, 6], [20, 6]])('nível %i dá +%i', (level, expected) => {
    expect(pb(level)).toBe(expected)
  })
})

describe('skillBonus', () => {
  it('metade da proficiência arredonda para baixo (Versatilidade do Bardo)', () => {
    expect(skillBonus(2, 'half', 3)).toBe(3)      // 2 + floor(3/2)
    expect(skillBonus(2, 'half', 2)).toBe(3)      // 2 + 1
  })
})

describe('sobrescritas manuais (AUTO/MANUAL)', () => {
  it('o valor manual vence o cálculo e fica marcado', () => {
    const d = computeDerived({ ...fighter, overrides: { initiative_bonus: 5, proficiency_bonus: 4 } })
    expect(d.initiative).toBe(5)
    expect(d.proficiencyBonus).toBe(4)
    expect(d.saves.strength.bonus).toBe(7)        // 3 + 4: a proficiência manual vale pro resto
    expect(d.overridden).toEqual(['proficiency_bonus', 'initiative_bonus'])
  })

  it('aceita zero como valor manual', () => {
    expect(computeDerived({ ...fighter, overrides: { initiative_bonus: 0 } }).initiative).toBe(0)
  })
})
