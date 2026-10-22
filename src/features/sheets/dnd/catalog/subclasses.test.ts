import { describe, expect, it } from 'vitest'
import { computeSpellcasting, computeSpellSlots, hasSpellcasting } from '../rules/spellcasting'
import { CLASSES, getClass, spellListClass, toClassLevels } from './index'
import { THIRD_CASTER } from './classes/phbSubclassesB'

const mods = { strength: 0, dexterity: 1, constitution: 1, intelligence: 3, wisdom: 0, charisma: 0 }

describe('subclasses do Livro do Jogador', () => {
  it('quantas subclasses cada classe tem (a do SRD primeiro, depois as do livro)', () => {
    const count = Object.fromEntries(CLASSES.map((c) => [c.key, c.subclasses.length]))
    expect(count).toEqual({
      barbarian: 2, bard: 2, cleric: 7, druid: 2, fighter: 3, monk: 3, paladin: 3, ranger: 2, rogue: 3, sorcerer: 2, warlock: 3, wizard: 8,
    })
    expect(CLASSES.flatMap((c) => c.subclasses)).toHaveLength(40)
    for (const c of CLASSES) {
      expect(c.subclasses[0].source, c.key).toBe('srd51')
      for (const s of c.subclasses.slice(1)) expect(s.source, `${c.key}/${s.key}`).toBe('phb')
    }
  })

  it('chaves únicas, nomes completos e características que não vêm antes do nível de escolha', () => {
    for (const c of CLASSES) {
      expect(new Set(c.subclasses.map((s) => s.key)).size, c.key).toBe(c.subclasses.length)
      for (const s of c.subclasses) {
        expect(s.name.trim(), s.key).not.toBe('')
        expect(s.original.trim(), s.key).not.toBe('')
        expect(s.summary.length, s.key).toBeGreaterThan(20)
        expect(s.features.length, s.key).toBeGreaterThanOrEqual(3)
        expect(new Set(s.features.map((x) => x.key)).size, s.key).toBe(s.features.length)
        for (const feat of s.features) {
          expect(feat.level, `${s.key}/${feat.key}`).toBeGreaterThanOrEqual(c.subclassLevel)
          expect(feat.level).toBeLessThanOrEqual(20)
          expect(feat.summary.length, `${s.key}/${feat.key}`).toBeGreaterThan(20)
        }
      }
    }
  })

  it('o tipo de escolha bate com o da classe', () => {
    for (const c of CLASSES) {
      const kinds = new Set(c.subclasses.map((s) => s.kind))
      expect(kinds.size, c.key).toBe(1)
    }
    expect(getClass('cleric')!.subclasses.map((s) => s.key)).toEqual(['life', 'knowledge', 'light', 'nature', 'tempest', 'trickery', 'war'])
    expect(getClass('wizard')!.subclasses.map((s) => s.key)).toEqual(['evocation', 'abjuration', 'conjuration', 'divination', 'enchantment', 'illusion', 'necromancy', 'transmutation'])
  })

  it('sem inglês nem marcação solta nos textos', () => {
    const ingles = /\b(the|you|your|saving throw|damage|spell slot|hit points)\b/i
    for (const c of CLASSES) for (const s of c.subclasses.filter((x) => x.source === 'phb')) {
      const t = [s.name, s.summary, ...s.features.flatMap((x) => [x.name, x.summary])].join('\n')
      expect(t, s.key).not.toMatch(ingles)
    }
  })
})

describe('Cavaleiro Místico e Trapaceiro Arcano (conjuradores de um terço)', () => {
  const ek = (level: number) => toClassLevels([{ classKey: 'fighter', level, subclassKey: 'eldritch_knight' }])
  const at = (level: number) => toClassLevels([{ classKey: 'rogue', level, subclassKey: 'arcane_trickster' }])

  it('as duas subclasses conjuram com Inteligência e a lista do Mago', () => {
    expect(getClass('fighter')!.subclasses.find((s) => s.key === 'eldritch_knight')).toMatchObject({ spellcasting: THIRD_CASTER, spellList: 'wizard' })
    expect(getClass('rogue')!.subclasses.find((s) => s.key === 'arcane_trickster')).toMatchObject({ spellcasting: THIRD_CASTER, spellList: 'wizard' })
    expect(spellListClass('fighter', 'eldritch_knight')).toBe('wizard')
    expect(spellListClass('rogue', 'arcane_trickster')).toBe('wizard')
    expect(spellListClass('fighter', 'champion')).toBe('fighter')
    expect(spellListClass('wizard', 'abjuration')).toBe('wizard')
  })

  it('só liga o perfil de conjuração quando a subclasse é a certa', () => {
    expect(ek(5)[0].spellcasting).toBe(THIRD_CASTER)
    expect(at(5)[0].spellcasting).toBe(THIRD_CASTER)
    expect(toClassLevels([{ classKey: 'fighter', level: 5, subclassKey: 'champion' }])[0].spellcasting).toBeUndefined()
    expect(toClassLevels([{ classKey: 'fighter', level: 5 }])[0].spellcasting).toBeUndefined()
    expect(toClassLevels([{ classKey: 'wizard', level: 5, subclassKey: 'abjuration' }])[0].spellcasting?.kind).toBe('full')
  })

  it('começam a conjurar no 3º nível', () => {
    expect(hasSpellcasting(THIRD_CASTER, 2)).toBe(false)
    expect(hasSpellcasting(THIRD_CASTER, 3)).toBe(true)
    expect(computeSpellcasting(ek(2), mods, 2)).toBeNull()
    expect(computeSpellcasting(ek(3), mods, 2)).not.toBeNull()
  })

  it('espaços de magia pela tabela do Cavaleiro Místico', () => {
    const slots = (level: number) => computeSpellSlots([{ profile: THIRD_CASTER, level }]).slots.slice(0, 4)
    expect(slots(3)).toEqual([2, 0, 0, 0])
    expect(slots(4)).toEqual([3, 0, 0, 0])
    expect(slots(6)).toEqual([3, 0, 0, 0])
    expect(slots(7)).toEqual([4, 2, 0, 0])
    expect(slots(10)).toEqual([4, 3, 0, 0])
    expect(slots(13)).toEqual([4, 3, 2, 0])
    expect(slots(16)).toEqual([4, 3, 3, 0])
    expect(slots(19)).toEqual([4, 3, 3, 1])
    expect(slots(20)).toEqual([4, 3, 3, 1])
  })

  it('truques e magias conhecidas por nível', () => {
    const c = (level: number) => computeSpellcasting(ek(level), mods, 3)!.classes[0]
    expect(c(3)).toMatchObject({ cantripsKnown: 2, spellsKnownOrPrepared: 3, ability: 'intelligence', saveDc: 8 + 3 + 3 })
    expect(c(7).spellsKnownOrPrepared).toBe(5)
    expect(c(10)).toMatchObject({ cantripsKnown: 3, spellsKnownOrPrepared: 7 })
    expect(c(20).spellsKnownOrPrepared).toBe(13)
  })

  it('na multiclasse o terço conta a terça parte, para baixo', () => {
    // Mago 5 (5) + Cavaleiro Místico 6 (2) = nível de conjurador 7
    const r = computeSpellSlots([
      { profile: getClass('wizard')!.spellcasting!, level: 5 },
      { profile: THIRD_CASTER, level: 6 },
    ])
    expect(r.slots.slice(0, 4)).toEqual([4, 3, 3, 1])
  })
})
