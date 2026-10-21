import { describe, expect, it } from 'vitest'
import { computeSpeed, formatDamage, weaponAttack, weaponProficient } from './combat'
import { computeDerived } from './derive'
import type { ArmorInput, DerivedInput, SpellcastingProfile } from './types'

const plate: ArmorInput = { category: 'heavy', baseAc: 18 }
const leather: ArmorInput = { category: 'light', baseAc: 11 }

describe('computeSpeed', () => {
  const base = { base: 30, barbarianLevel: 0, monkLevel: 0, armor: null, shield: false }

  it('é o deslocamento da raça sem características que mudem isso', () => {
    expect(computeSpeed(base)).toBe(30)
    expect(computeSpeed({ ...base, base: 25 })).toBe(25)
  })

  it('Bárbaro de 5º nível ganha +10, menos com armadura pesada', () => {
    expect(computeSpeed({ ...base, barbarianLevel: 4 })).toBe(30)
    expect(computeSpeed({ ...base, barbarianLevel: 5 })).toBe(40)
    expect(computeSpeed({ ...base, barbarianLevel: 5, armor: leather })).toBe(40)
    expect(computeSpeed({ ...base, barbarianLevel: 5, armor: plate })).toBe(30)
  })

  it('Monge sem armadura e sem escudo segue a tabela de Movimento sem Armadura', () => {
    expect(computeSpeed({ ...base, monkLevel: 1 })).toBe(30)
    expect(computeSpeed({ ...base, monkLevel: 2 })).toBe(40)
    expect(computeSpeed({ ...base, monkLevel: 6 })).toBe(45)
    expect(computeSpeed({ ...base, monkLevel: 10 })).toBe(50)
    expect(computeSpeed({ ...base, monkLevel: 14 })).toBe(55)
    expect(computeSpeed({ ...base, monkLevel: 18 })).toBe(60)
    expect(computeSpeed({ ...base, monkLevel: 20 })).toBe(60)
  })

  it('o Monge perde o bônus com armadura ou escudo', () => {
    expect(computeSpeed({ ...base, monkLevel: 6, armor: leather })).toBe(30)
    expect(computeSpeed({ ...base, monkLevel: 6, shield: true })).toBe(30)
  })
})

describe('weaponAttack', () => {
  const w = { properties: [] as string[], damage: '1d8', strMod: 3, dexMod: 1, proficiencyBonus: 2, proficient: true }

  it('corpo a corpo usa Força e soma a proficiência', () => {
    expect(weaponAttack({ ...w, range: 'melee' })).toEqual({ ability: 'strength', attackBonus: 5, damageBonus: 3, damageFormula: '1d8+3' })
  })

  it('arma à distância usa Destreza', () => {
    expect(weaponAttack({ ...w, range: 'ranged', strMod: 0, dexMod: 4 })).toMatchObject({ ability: 'dexterity', attackBonus: 6, damageBonus: 4 })
  })

  it('arma de acuidade usa a melhor das duas', () => {
    expect(weaponAttack({ ...w, range: 'melee', properties: ['acuidade'], strMod: 1, dexMod: 4 })).toMatchObject({ ability: 'dexterity', attackBonus: 6 })
    expect(weaponAttack({ ...w, range: 'melee', properties: ['acuidade'], strMod: 4, dexMod: 1 })).toMatchObject({ ability: 'strength', attackBonus: 6 })
    expect(weaponAttack({ ...w, range: 'melee', properties: ['acuidade'], strMod: 2, dexMod: 2 })).toMatchObject({ ability: 'strength' })
  })

  it('arma de arremesso (corpo a corpo e à distância) usa Força, sem acuidade', () => {
    expect(weaponAttack({ ...w, range: 'both', dexMod: 4, strMod: 1 })).toMatchObject({ ability: 'strength', attackBonus: 3 })
  })

  it('sem proficiência não soma o bônus de proficiência', () => {
    expect(weaponAttack({ ...w, range: 'melee', proficient: false }).attackBonus).toBe(3)
  })

  it('bônus extras de arma mágica e estilo de luta entram no ataque e no dano', () => {
    expect(weaponAttack({ ...w, range: 'ranged', strMod: 0, dexMod: 3, attackExtra: 2, damageExtra: 1 }))
      .toMatchObject({ attackBonus: 3 + 2 + 2, damageBonus: 4 })
  })

  it('modificador negativo vira "-1" na fórmula, e a Rede não tem fórmula', () => {
    expect(weaponAttack({ ...w, range: 'melee', strMod: -1 }).damageFormula).toBe('1d8-1')
    expect(weaponAttack({ ...w, range: 'melee', damage: null }).damageFormula).toBeNull()
  })

  it('formatDamage', () => {
    expect(formatDamage('2d6', 0)).toBe('2d6')
    expect(formatDamage('2d6', 4)).toBe('2d6+4')
    expect(formatDamage('2d6', -2)).toBe('2d6-2')
  })

  it('proficiência por categoria ou por arma específica', () => {
    expect(weaponProficient({ key: 'longsword', category: 'martial' }, ['simple'])).toBe(false)
    expect(weaponProficient({ key: 'longsword', category: 'martial' }, ['simple', 'martial'])).toBe(true)
    expect(weaponProficient({ key: 'longsword', category: 'martial' }, ['longsword'])).toBe(true)
    expect(weaponProficient({ key: 'dagger', category: 'simple' }, ['martial'])).toBe(false)
  })
})

describe('computeDerived: Pau para Toda Obra, deslocamento e sobrescritas', () => {
  const scores = { strength: 10, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 12, charisma: 16 }
  const bardProfile: SpellcastingProfile = {
    ability: 'charisma', kind: 'full', learning: 'known',
    cantripsKnown: new Array(20).fill(2), spellsKnown: new Array(20).fill(4),
  }
  const bard = (level: number): DerivedInput => ({
    abilities: scores,
    classes: [{ classKey: 'bard', level, spellcasting: bardProfile }],
    skillProficiency: { persuasion: 'proficient' },
  })

  it('Bardo de 1º nível ainda não tem Pau para Toda Obra', () => {
    const d = computeDerived(bard(1))
    expect(d.skills.athletics.bonus).toBe(0)
    expect(d.initiative).toBe(2)
  })

  it('Bardo de 2º nível soma metade da proficiência no que não domina, e na iniciativa', () => {
    const d = computeDerived(bard(2))            // proficiência +2, metade = 1
    expect(d.skills.athletics).toMatchObject({ level: 'half', bonus: 1 })
    expect(d.skills.stealth.bonus).toBe(2 + 1)   // Des +2
    expect(d.skills.persuasion.bonus).toBe(3 + 2) // proficiente: Car +3 + 2
    expect(d.initiative).toBe(2 + 1)
  })

  it('a especialização não é afetada', () => {
    const d = computeDerived({ ...bard(5), skillProficiency: { persuasion: 'expertise' } })
    expect(d.skills.persuasion.bonus).toBe(3 + 3 * 2)
  })

  it('o deslocamento vem da raça e das características', () => {
    expect(computeDerived({ ...bard(1), combat: { baseSpeed: 25 } }).speed).toBe(25)
    expect(computeDerived({ ...bard(1) }).speed).toBe(30)
    const barb = computeDerived({ abilities: scores, classes: [{ classKey: 'barbarian', level: 5 }], combat: { baseSpeed: 30 } })
    expect(barb.speed).toBe(40)
  })

  it('deslocamento, CD e ataque de magia manuais vencem o cálculo e ficam marcados', () => {
    const d = computeDerived({ ...bard(3), overrides: { speed: 35, spell_save_dc: 17, spell_attack_bonus: 9 } })
    expect(d.speed).toBe(35)
    expect(d.spellcasting!.classes[0]).toMatchObject({ saveDc: 17, attackBonus: 9 })
    expect(d.overridden).toEqual(expect.arrayContaining(['speed', 'spell_save_dc', 'spell_attack_bonus']))
  })

  it('só a CD manual muda a CD; o ataque continua calculado', () => {
    const d = computeDerived({ ...bard(3), overrides: { spell_save_dc: 20 } })
    expect(d.spellcasting!.classes[0].saveDc).toBe(20)
    expect(d.spellcasting!.classes[0].attackBonus).toBe(2 + 3)
  })
})
