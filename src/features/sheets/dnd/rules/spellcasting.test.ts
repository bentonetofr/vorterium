import { describe, expect, it } from 'vitest'
import {
  FULL_CASTER_SLOTS, PACT_MAGIC, cantripsKnownAt, computeSpellSlots, hasSpellcasting,
  highestSpellLevel, multiclassCasterLevel, singleClassSlots, spellAttackFromMod, spellSaveDcFromMod,
  spellsKnownOrPreparedAt, wizardSpellbookSize,
} from './spellcasting'
import { computeDerived } from './derive'
import type { DerivedInput, SpellcastingProfile } from './types'

const trim = (slots: number[]) => { const out = [...slots]; while (out.length && out[out.length - 1] === 0) out.pop(); return out }

const wizard: SpellcastingProfile = {
  ability: 'intelligence', kind: 'full', learning: 'spellbook',
  cantripsKnown: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
}
const paladin: SpellcastingProfile = {
  ability: 'charisma', kind: 'half', learning: 'prepared-half',
  cantripsKnown: new Array(20).fill(0),
}
const ranger: SpellcastingProfile = {
  ability: 'wisdom', kind: 'half', learning: 'known',
  cantripsKnown: new Array(20).fill(0),
  spellsKnown: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
}
const warlock: SpellcastingProfile = {
  ability: 'charisma', kind: 'pact', learning: 'known',
  cantripsKnown: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  spellsKnown: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
}
const sorcerer: SpellcastingProfile = {
  ability: 'charisma', kind: 'full', learning: 'known',
  cantripsKnown: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  spellsKnown: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
}
const cleric: SpellcastingProfile = {
  ability: 'wisdom', kind: 'full', learning: 'prepared',
  cantripsKnown: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
}

describe('espaços de magia de uma classe só', () => {
  it('conjurador completo segue a tabela de classe', () => {
    expect(trim(singleClassSlots(wizard, 1))).toEqual([2])
    expect(trim(singleClassSlots(wizard, 5))).toEqual([4, 3, 2])
    expect(trim(singleClassSlots(wizard, 11))).toEqual([4, 3, 3, 3, 2, 1])
    expect(trim(singleClassSlots(wizard, 20))).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1])
  })

  it('tabela tem 20 linhas e nunca decresce de um nível para o outro', () => {
    expect(FULL_CASTER_SLOTS).toHaveLength(20)
    for (let i = 1; i < 20; i++) {
      FULL_CASTER_SLOTS[i].forEach((n, slot) => expect(n).toBeGreaterThanOrEqual(FULL_CASTER_SLOTS[i - 1][slot]))
    }
  })

  it('Paladino e Patrulheiro só conjuram do 2º nível em diante', () => {
    expect(hasSpellcasting(paladin, 1)).toBe(false)
    expect(trim(singleClassSlots(paladin, 1))).toEqual([])
    expect(trim(singleClassSlots(paladin, 2))).toEqual([2])
    expect(trim(singleClassSlots(paladin, 3))).toEqual([3])
  })

  it('meio conjurador bate com a tabela do Paladino/Patrulheiro do SRD', () => {
    expect(trim(singleClassSlots(paladin, 5))).toEqual([4, 2])
    expect(trim(singleClassSlots(paladin, 9))).toEqual([4, 3, 2])
    expect(trim(singleClassSlots(ranger, 13))).toEqual([4, 3, 3, 1])
    expect(trim(singleClassSlots(ranger, 17))).toEqual([4, 3, 3, 3, 1])
    expect(trim(singleClassSlots(paladin, 20))).toEqual([4, 3, 3, 3, 2])
  })
})

describe('multiclasse', () => {
  it('exemplo do SRD: Patrulheiro 4 / Mago 3 conta como nível 5', () => {
    const classes = [{ profile: ranger, level: 4 }, { profile: wizard, level: 3 }]
    expect(multiclassCasterLevel(classes)).toBe(5)
    expect(trim(computeSpellSlots(classes).slots)).toEqual([4, 3, 2])
  })

  it('meio conjurador arredonda para baixo na multiclasse', () => {
    expect(multiclassCasterLevel([{ profile: paladin, level: 3 }, { profile: cleric, level: 1 }])).toBe(2)
  })

  it('só uma classe conjuradora usa a tabela própria, mesmo com outra que ainda não conjura', () => {
    // Patrulheiro 1 ainda não tem Conjuração: Mago 5 segue a própria tabela.
    expect(trim(computeSpellSlots([{ profile: ranger, level: 1 }, { profile: wizard, level: 5 }]).slots)).toEqual([4, 3, 2])
  })

  it('Paladino 5 / Feiticeiro 5: combinado vira nível 7 (5 + 2)', () => {
    const result = computeSpellSlots([{ profile: paladin, level: 5 }, { profile: sorcerer, level: 5 }])
    expect(trim(result.slots)).toEqual([4, 3, 3, 1])
  })

  it('nível combinado acima de 20 fica preso em 20', () => {
    const result = computeSpellSlots([{ profile: wizard, level: 20 }, { profile: cleric, level: 20 }])
    expect(trim(result.slots)).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1])
  })
})

describe('Magia de Pacto do Bruxo', () => {
  it('segue a tabela do Bruxo e fica separada dos demais espaços', () => {
    expect(PACT_MAGIC).toHaveLength(20)
    expect(computeSpellSlots([{ profile: warlock, level: 1 }]).pact).toEqual({ slots: 1, level: 1 })
    expect(computeSpellSlots([{ profile: warlock, level: 5 }]).pact).toEqual({ slots: 2, level: 3 })
    expect(computeSpellSlots([{ profile: warlock, level: 11 }]).pact).toEqual({ slots: 3, level: 5 })
    expect(computeSpellSlots([{ profile: warlock, level: 17 }]).pact).toEqual({ slots: 4, level: 5 })
  })

  it('Bruxo não soma ao nível de conjurador da multiclasse', () => {
    const result = computeSpellSlots([{ profile: sorcerer, level: 1 }, { profile: warlock, level: 1 }])
    expect(trim(result.slots)).toEqual([2])
    expect(result.pact).toEqual({ slots: 1, level: 1 })
  })

  it('Bruxo sozinho não tem espaços comuns', () => {
    expect(trim(computeSpellSlots([{ profile: warlock, level: 9 }]).slots)).toEqual([])
  })

  it('maior nível de magia considera a Magia de Pacto', () => {
    expect(highestSpellLevel(computeSpellSlots([{ profile: warlock, level: 9 }]))).toBe(5)
    expect(highestSpellLevel(computeSpellSlots([{ profile: wizard, level: 5 }]))).toBe(3)
    expect(highestSpellLevel(computeSpellSlots([]))).toBe(0)
  })
})

describe('CD, ataque, truques e magias', () => {
  it('CD = 8 + proficiência + modificador; ataque = proficiência + modificador', () => {
    expect(spellSaveDcFromMod(3, 4)).toBe(15)
    expect(spellAttackFromMod(3, 4)).toBe(7)
  })

  it('Clérigo, Druida e Mago preparam nível + modificador (mínimo 1)', () => {
    expect(spellsKnownOrPreparedAt(cleric, 5, 3)).toBe(8)
    expect(spellsKnownOrPreparedAt(wizard, 1, -2)).toBe(1)
  })

  it('Paladino prepara metade do nível + modificador (mínimo 1)', () => {
    expect(spellsKnownOrPreparedAt(paladin, 5, 3)).toBe(5)    // 2 + 3
    expect(spellsKnownOrPreparedAt(paladin, 2, -1)).toBe(1)   // 1 - 1 = 0 vira 1
    expect(spellsKnownOrPreparedAt(paladin, 1, 3)).toBe(0)    // ainda não conjura
  })

  it('classes de magias conhecidas usam a tabela', () => {
    expect(spellsKnownOrPreparedAt(sorcerer, 1, 3)).toBe(2)
    expect(spellsKnownOrPreparedAt(sorcerer, 20, 3)).toBe(15)
    expect(spellsKnownOrPreparedAt(ranger, 1, 3)).toBe(0)
    expect(spellsKnownOrPreparedAt(ranger, 2, 3)).toBe(2)
    expect(spellsKnownOrPreparedAt(warlock, 10, 3)).toBe(10)
  })

  it('truques conhecidos sobem nos níveis 4 e 10', () => {
    expect(cantripsKnownAt(wizard, 3)).toBe(3)
    expect(cantripsKnownAt(wizard, 4)).toBe(4)
    expect(cantripsKnownAt(wizard, 10)).toBe(5)
    expect(cantripsKnownAt(warlock, 4)).toBe(3)
    expect(cantripsKnownAt(paladin, 10)).toBe(0)
  })

  it('grimório do Mago começa com 6 e ganha 2 por nível', () => {
    expect(wizardSpellbookSize(1)).toBe(6)
    expect(wizardSpellbookSize(3)).toBe(10)     // exemplo do SRD: Mago 3 tem 10 magias
    expect(wizardSpellbookSize(20)).toBe(44)
  })
})

describe('computeDerived: conjuração', () => {
  const base: DerivedInput = {
    abilities: { strength: 8, dexterity: 14, constitution: 14, intelligence: 18, wisdom: 12, charisma: 10 },
    classes: [{ classKey: 'wizard', level: 5, spellcasting: wizard }],
  }

  it('calcula espaços, CD, ataque e magias do Mago', () => {
    const s = computeDerived(base).spellcasting!
    expect(trim(s.slots)).toEqual([4, 3, 2])
    expect(s.pact).toBeNull()
    expect(s.classes).toEqual([{
      classKey: 'wizard', ability: 'intelligence', saveDc: 8 + 3 + 4, attackBonus: 3 + 4,
      cantripsKnown: 4, spellsKnownOrPrepared: 5 + 4, spellbookSize: 14,
    }])
  })

  it('sem classe conjuradora é null', () => {
    expect(computeDerived({ ...base, classes: [{ classKey: 'fighter', level: 5 }] }).spellcasting).toBeNull()
  })

  it('Paladino de nível 1 ainda não aparece como conjurador', () => {
    expect(computeDerived({ ...base, classes: [{ classKey: 'paladin', level: 1, spellcasting: paladin }] }).spellcasting).toBeNull()
  })

  it('o atributo escolhido vale no lugar do da classe', () => {
    // Mago com INT 18 (+4) escolhendo Carisma 14 (+2): proficiência +3.
    const d = computeDerived({ ...base, abilities: { ...base.abilities, charisma: 14 }, spellAbility: 'charisma' })
    expect(d.spellcasting!.classes[0]).toMatchObject({ ability: 'charisma', saveDc: 8 + 3 + 2, attackBonus: 3 + 2 })
    expect(d.spellStats).toEqual({ ability: 'charisma', saveDc: 13, attackBonus: 5, chosen: true })
  })

  it('sem classe conjuradora, o atributo escolhido ainda calcula CD e ataque', () => {
    const d = computeDerived({
      abilities: { strength: 10, dexterity: 10, constitution: 10, intelligence: 16, wisdom: 10, charisma: 10 },
      classes: [{ classKey: 'fighter', level: 5 }], spellAbility: 'intelligence',
    })
    expect(d.spellcasting).toBeNull()
    expect(d.spellStats).toEqual({ ability: 'intelligence', saveDc: 8 + 3 + 3, attackBonus: 3 + 3, chosen: true })
  })

  it('sem classe conjuradora e sem escolha não há CD nem ataque', () => {
    expect(computeDerived({ abilities: base.abilities, classes: [{ classKey: 'fighter', level: 5 }] }).spellStats).toBeNull()
  })

  it('a CD manual vale também sem classe conjuradora', () => {
    const d = computeDerived({ abilities: base.abilities, classes: [{ classKey: 'fighter', level: 1 }], spellAbility: 'wisdom', overrides: { spell_save_dc: 17 } })
    expect(d.spellStats!.saveDc).toBe(17)
    expect(d.overridden).toContain('spell_save_dc')
  })

  it('proficiência manual muda a CD', () => {
    const s = computeDerived({ ...base, overrides: { proficiency_bonus: 5 } }).spellcasting!
    expect(s.classes[0].saveDc).toBe(8 + 5 + 4)
  })
})
