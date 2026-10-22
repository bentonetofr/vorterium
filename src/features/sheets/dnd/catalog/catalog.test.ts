import { describe, expect, it } from 'vitest'
import {
  ARMORS, BACKGROUNDS, CLASSES, CONDITIONS, DRAGONBORN_ANCESTRIES, EXHAUSTION, FIGHTING_STYLES, GEAR, GLOSSARY, RACES, SHIELD,
  TOOLS, WEAPONS, getArmor, getClass, getRace, getSubclass, getSubrace, getWeapon, hitDieOf, raceHpBonusPerLevel,
  searchCatalog, toClassLevels,
} from './index'
import { SKILLS } from '../rules/abilities'
import { computeDerived } from '../rules/derive'
import { highestSpellLevel, computeSpellSlots } from '../rules/spellcasting'
import type { AbilityKey } from '../rules/types'

const skillKeys = new Set(SKILLS.map((s) => s.key))
const weaponKeys = new Set(WEAPONS.map((w) => w.key))
const toolKeys = new Set(TOOLS.map((t) => t.key))

const unique = (keys: string[]) => new Set(keys).size === keys.length

describe('classes: forma geral', () => {
  it('são as 12 classes do SRD, com chaves únicas', () => {
    expect(CLASSES).toHaveLength(12)
    expect(unique(CLASSES.map((c) => c.key))).toBe(true)
    expect(CLASSES.map((c) => c.key)).toEqual(
      ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'])
  })

  it.each(CLASSES.map((c) => [c.key, c] as const))('%s: dado de vida, salvaguardas e perícias válidos', (_key, c) => {
    expect([6, 8, 10, 12]).toContain(c.hitDie)
    expect(c.saves).toHaveLength(2)
    expect(c.skills.count).toBeGreaterThan(0)
    if (c.skills.from !== 'any') {
      expect(c.skills.from.length).toBeGreaterThanOrEqual(c.skills.count)
      for (const s of c.skills.from) expect(skillKeys.has(s)).toBe(true)
    }
    expect(c.startingEquipment.length).toBeGreaterThan(0)
    expect(c.summary.length).toBeGreaterThan(10)
  })

  it.each(CLASSES.map((c) => [c.key, c] as const))('%s: armas referenciadas existem no catálogo', (_key, c) => {
    for (const w of c.weapons) expect(['simple', 'martial'].includes(w) || weaponKeys.has(w)).toBe(true)
    for (const w of c.multiclass.gained.weapons) expect(['simple', 'martial'].includes(w) || weaponKeys.has(w)).toBe(true)
  })

  it.each(CLASSES.map((c) => [c.key, c] as const))('%s: características e tabelas coerentes', (_key, c) => {
    // níveis válidos, chaves únicas, resumo preenchido
    expect(unique(c.features.map((f) => f.key + '@' + f.level))).toBe(true)
    for (const feat of [...c.features, ...c.subclasses.flatMap((s) => s.features)]) {
      expect(feat.level).toBeGreaterThanOrEqual(1)
      expect(feat.level).toBeLessThanOrEqual(20)
      expect(feat.summary.length).toBeGreaterThan(10)
      expect(feat.name.length).toBeGreaterThan(0)
      expect(feat.original.length).toBeGreaterThan(0)
    }
    // Aumentos de Atributo batem com os níveis declarados
    const asi = c.features.filter((f) => f.key === 'ability_score_improvement').map((f) => f.level)
    expect(asi).toEqual([...c.asiLevels])
    // colunas de progressão com 20 valores
    for (const col of c.progression) expect(col.values).toHaveLength(20)
    // a classe tem a característica que escolhe a subclasse, no nível certo
    expect(c.features.some((f) => f.level === c.subclassLevel && /^(Divine Domain|Sorcerous Origin|Otherworldly Patron|Primal Path|Bard College|Druid Circle|Martial Archetype|Monastic Tradition|Sacred Oath|Ranger Archetype|Roguish Archetype|Arcane Tradition)$/.test(f.original))).toBe(true)
    // subclasses: ao menos uma, e características não antes do nível de escolha
    expect(c.subclasses.length).toBeGreaterThanOrEqual(1)
    for (const sub of c.subclasses) {
      expect(sub.features.length).toBeGreaterThan(0)
      for (const feat of sub.features) expect(feat.level).toBeGreaterThanOrEqual(c.subclassLevel)
    }
  })

  it.each(CLASSES.map((c) => [c.key, c] as const))('%s: pré-requisito de multiclasse tem pelo menos um atributo', (_key, c) => {
    expect(c.multiclass.requirement.abilities.length).toBeGreaterThan(0)
  })
})

describe('classes: conferência com as tabelas do SRD (nível em que cada característica aparece)', () => {
  const expected: Record<string, [string, number][]> = {
    barbarian: [['Rage', 1], ['Unarmored Defense', 1], ['Reckless Attack', 2], ['Danger Sense', 2], ['Primal Path', 3], ['Extra Attack', 5],
      ['Fast Movement', 5], ['Feral Instinct', 7], ['Brutal Critical (1 die)', 9], ['Relentless Rage', 11], ['Brutal Critical (2 dice)', 13],
      ['Persistent Rage', 15], ['Brutal Critical (3 dice)', 17], ['Indomitable Might', 18], ['Primal Champion', 20]],
    bard: [['Spellcasting', 1], ['Bardic Inspiration', 1], ['Jack of All Trades', 2], ['Song of Rest', 2], ['Bard College', 3], ['Expertise', 3],
      ['Font of Inspiration', 5], ['Countercharm', 6], ['Magical Secrets', 10], ['Superior Inspiration', 20]],
    cleric: [['Spellcasting', 1], ['Divine Domain', 1], ['Channel Divinity', 2], ['Destroy Undead', 5], ['Divine Intervention', 10]],
    druid: [['Druidic', 1], ['Spellcasting', 1], ['Wild Shape', 2], ['Druid Circle', 2], ['Timeless Body', 18], ['Beast Spells', 18], ['Archdruid', 20]],
    fighter: [['Fighting Style', 1], ['Second Wind', 1], ['Action Surge', 2], ['Martial Archetype', 3], ['Extra Attack', 5], ['Indomitable', 9],
      ['Extra Attack (2)', 11], ['Extra Attack (3)', 20]],
    monk: [['Unarmored Defense', 1], ['Martial Arts', 1], ['Ki', 2], ['Unarmored Movement', 2], ['Monastic Tradition', 3], ['Deflect Missiles', 3],
      ['Slow Fall', 4], ['Extra Attack', 5], ['Stunning Strike', 5], ['Ki-Empowered Strikes', 6], ['Evasion', 7], ['Stillness of Mind', 7],
      ['Purity of Body', 10], ['Tongue of the Sun and Moon', 13], ['Diamond Soul', 14], ['Timeless Body', 15], ['Empty Body', 18], ['Perfect Self', 20]],
    paladin: [['Divine Sense', 1], ['Lay on Hands', 1], ['Fighting Style', 2], ['Spellcasting', 2], ['Divine Smite', 2], ['Divine Health', 3],
      ['Sacred Oath', 3], ['Extra Attack', 5], ['Aura of Protection', 6], ['Aura of Courage', 10], ['Improved Divine Smite', 11],
      ['Cleansing Touch', 14], ['Aura improvements', 18]],
    ranger: [['Favored Enemy', 1], ['Natural Explorer', 1], ['Fighting Style', 2], ['Spellcasting', 2], ['Ranger Archetype', 3], ['Primeval Awareness', 3],
      ['Extra Attack', 5], ["Land's Stride", 8], ['Hide in Plain Sight', 10], ['Vanish', 14], ['Feral Senses', 18], ['Foe Slayer', 20]],
    rogue: [['Expertise', 1], ['Sneak Attack', 1], ["Thieves' Cant", 1], ['Cunning Action', 2], ['Roguish Archetype', 3], ['Uncanny Dodge', 5],
      ['Evasion', 7], ['Reliable Talent', 11], ['Blindsense', 14], ['Slippery Mind', 15], ['Elusive', 18], ['Stroke of Luck', 20]],
    sorcerer: [['Spellcasting', 1], ['Sorcerous Origin', 1], ['Font of Magic', 2], ['Metamagic', 3], ['Sorcerous Restoration', 20]],
    warlock: [['Otherworldly Patron', 1], ['Pact Magic', 1], ['Eldritch Invocations', 2], ['Pact Boon', 3], ['Mystic Arcanum (6th level)', 11],
      ['Mystic Arcanum (7th level)', 13], ['Mystic Arcanum (8th level)', 15], ['Mystic Arcanum (9th level)', 17], ['Eldritch Master', 20]],
    wizard: [['Spellcasting', 1], ['Arcane Recovery', 1], ['Arcane Tradition', 2], ['Spell Mastery', 18], ['Signature Spell', 20]],
  }

  for (const [classKey, pairs] of Object.entries(expected)) {
    it(`${classKey}: características nos níveis certos`, () => {
      const c = getClass(classKey)!
      for (const [original, level] of pairs) {
        const found = c.features.find((f) => f.original === original)
        expect(found, `${classKey}: falta "${original}"`).toBeDefined()
        expect(found!.level, `${classKey}: "${original}" no nível errado`).toBe(level)
      }
    })
  }

  it('subclasses do SRD e seus níveis', () => {
    const levels = (cls: string, sub: string) => getSubclass(cls, sub)!.features.map((f) => f.level)
    expect(levels('barbarian', 'berserker')).toEqual([3, 6, 10, 14])
    expect(levels('bard', 'lore')).toEqual([3, 3, 6, 14])
    expect(levels('cleric', 'life')).toEqual([1, 1, 1, 2, 6, 8, 17])
    expect(levels('druid', 'land')).toEqual([2, 2, 3, 6, 10, 14])
    expect(levels('fighter', 'champion')).toEqual([3, 7, 10, 15, 18])
    expect(levels('monk', 'open_hand')).toEqual([3, 6, 11, 17])
    expect(levels('paladin', 'devotion')).toEqual([3, 3, 7, 15, 20])
    expect(levels('ranger', 'hunter')).toEqual([3, 7, 11, 15])
    expect(levels('rogue', 'thief')).toEqual([3, 3, 9, 13, 17])
    expect(levels('sorcerer', 'draconic')).toEqual([1, 1, 6, 14, 18])
    expect(levels('warlock', 'fiend')).toEqual([1, 1, 6, 10, 14])
    expect(levels('wizard', 'evocation')).toEqual([2, 2, 6, 10, 14])
  })
})

describe('classes: dados e proficiências do SRD', () => {
  it('dados de vida', () => {
    const dice = Object.fromEntries(CLASSES.map((c) => [c.key, c.hitDie]))
    expect(dice).toEqual({
      barbarian: 12, bard: 8, cleric: 8, druid: 8, fighter: 10, monk: 8, paladin: 10, ranger: 10, rogue: 8, sorcerer: 6, warlock: 8, wizard: 6,
    })
  })

  it('salvaguardas de cada classe', () => {
    const saves = (k: string) => getClass(k)!.saves
    expect(saves('barbarian')).toEqual(['strength', 'constitution'])
    expect(saves('bard')).toEqual(['dexterity', 'charisma'])
    expect(saves('cleric')).toEqual(['wisdom', 'charisma'])
    expect(saves('druid')).toEqual(['intelligence', 'wisdom'])
    expect(saves('fighter')).toEqual(['strength', 'constitution'])
    expect(saves('monk')).toEqual(['strength', 'dexterity'])
    expect(saves('paladin')).toEqual(['wisdom', 'charisma'])
    expect(saves('ranger')).toEqual(['strength', 'dexterity'])
    expect(saves('rogue')).toEqual(['dexterity', 'intelligence'])
    expect(saves('sorcerer')).toEqual(['constitution', 'charisma'])
    expect(saves('warlock')).toEqual(['wisdom', 'charisma'])
    expect(saves('wizard')).toEqual(['intelligence', 'wisdom'])
  })

  it('quantidade de perícias à escolha', () => {
    const count = (k: string) => getClass(k)!.skills.count
    expect(['barbarian', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'sorcerer', 'warlock', 'wizard'].map(count)).toEqual(Array(9).fill(2))
    expect(['bard', 'ranger'].map(count)).toEqual([3, 3])
    expect(count('rogue')).toBe(4)
  })

  it('só Bardo escolhe perícias livremente', () => {
    expect(CLASSES.filter((c) => c.skills.from === 'any').map((c) => c.key)).toEqual(['bard'])
  })

  it('pré-requisitos de multiclasse do SRD', () => {
    const req = (k: string) => getClass(k)!.multiclass.requirement
    expect(req('barbarian')).toEqual({ mode: 'all', abilities: ['strength'] })
    expect(req('fighter')).toEqual({ mode: 'any', abilities: ['strength', 'dexterity'] })
    expect(req('monk')).toEqual({ mode: 'all', abilities: ['dexterity', 'wisdom'] })
    expect(req('paladin')).toEqual({ mode: 'all', abilities: ['strength', 'charisma'] })
    expect(req('ranger')).toEqual({ mode: 'all', abilities: ['dexterity', 'wisdom'] })
    expect(req('wizard')).toEqual({ mode: 'all', abilities: ['intelligence'] })
  })

  it('níveis com Aumento de Atributo: padrão, Guerreiro e Ladino', () => {
    expect(getClass('wizard')!.asiLevels).toEqual([4, 8, 12, 16, 19])
    expect(getClass('fighter')!.asiLevels).toEqual([4, 6, 8, 12, 14, 16, 19])
    expect(getClass('rogue')!.asiLevels).toEqual([4, 8, 10, 12, 16, 19])
  })

  it('nível em que a subclasse é escolhida', () => {
    const lv = Object.fromEntries(CLASSES.map((c) => [c.key, c.subclassLevel]))
    expect(lv).toEqual({ barbarian: 3, bard: 3, cleric: 1, druid: 2, fighter: 3, monk: 3, paladin: 3, ranger: 3, rogue: 3, sorcerer: 1, warlock: 1, wizard: 2 })
  })
})

describe('classes: tabelas de progressão', () => {
  const col = (cls: string, key: string) => getClass(cls)!.progression.find((p) => p.key === key)!.values

  it('Bárbaro: fúrias e dano da fúria', () => {
    expect(col('barbarian', 'rages')).toEqual([2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 'Ilimitadas'])
    expect(col('barbarian', 'rage_damage')[0]).toBe(2)
    expect(col('barbarian', 'rage_damage')[8]).toBe(3)
    expect(col('barbarian', 'rage_damage')[15]).toBe(4)
  })

  it('Monge: dado de artes marciais, ki e movimento', () => {
    expect(col('monk', 'martial_arts_die')).toEqual(['d4', 'd4', 'd4', 'd4', 'd6', 'd6', 'd6', 'd6', 'd6', 'd6', 'd8', 'd8', 'd8', 'd8', 'd8', 'd8', 'd10', 'd10', 'd10', 'd10'])
    expect(col('monk', 'ki_points')[0]).toBe(0)
    expect(col('monk', 'ki_points')[1]).toBe(2)
    expect(col('monk', 'ki_points')[19]).toBe(20)
  })

  it('Ladino: Ataque Furtivo vai de 1d6 a 10d6', () => {
    const sneak = col('rogue', 'sneak_attack')
    expect(sneak[0]).toBe('1d6')
    expect(sneak[2]).toBe('2d6')
    expect(sneak[8]).toBe('5d6')
    expect(sneak[19]).toBe('10d6')
  })

  it('Feiticeiro: pontos de feitiçaria e metamagia', () => {
    expect(col('sorcerer', 'sorcery_points')[0]).toBe(0)
    expect(col('sorcerer', 'sorcery_points')[2]).toBe(3)
    expect(col('sorcerer', 'metamagic_known').filter((n) => n === 4)).toHaveLength(4)
  })

  it('Bruxo: invocações conhecidas', () => {
    expect(col('warlock', 'invocations_known')).toEqual([0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8])
  })

  it('Bardo: dado de Inspiração', () => {
    const die = col('bard', 'inspiration_die')
    expect([die[0], die[4], die[9], die[14], die[19]]).toEqual(['d6', 'd8', 'd10', 'd12', 'd12'])
  })

  it('Paladino: cura pelas mãos', () => {
    expect(col('paladin', 'lay_on_hands_pool')[0]).toBe(5)
    expect(col('paladin', 'lay_on_hands_pool')[19]).toBe(100)
  })
})

describe('conjuração por classe, ligada ao motor', () => {
  it('só as 8 classes conjuradoras têm perfil de conjuração', () => {
    expect(CLASSES.filter((c) => c.spellcasting).map((c) => c.key)).toEqual(['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'])
  })

  it('perfis têm 20 entradas de truques e, onde há, de magias conhecidas', () => {
    for (const c of CLASSES.filter((x) => x.spellcasting)) {
      expect(c.spellcasting!.cantripsKnown).toHaveLength(20)
      if (c.spellcasting!.learning === 'known') expect(c.spellcasting!.spellsKnown).toHaveLength(20)
    }
  })

  it('atributo de conjuração de cada classe', () => {
    const ab = (k: string): AbilityKey => getClass(k)!.spellcasting!.ability
    expect(ab('bard')).toBe('charisma')
    expect(ab('cleric')).toBe('wisdom')
    expect(ab('druid')).toBe('wisdom')
    expect(ab('paladin')).toBe('charisma')
    expect(ab('ranger')).toBe('wisdom')
    expect(ab('sorcerer')).toBe('charisma')
    expect(ab('warlock')).toBe('charisma')
    expect(ab('wizard')).toBe('intelligence')
  })

  it('exemplo do SRD (Patrulheiro 4 / Mago 3) usando o catálogo real', () => {
    const classes = toClassLevels([{ classKey: 'ranger', level: 4 }, { classKey: 'wizard', level: 3 }])
    const result = computeSpellSlots(classes.map((c) => ({ profile: c.spellcasting!, level: c.level })))
    expect(result.slots.slice(0, 3)).toEqual([4, 3, 2])
    expect(highestSpellLevel(result)).toBe(3)
  })

  it('Mago 5 do catálogo no computeDerived: 4/3/2 espaços, 4 truques e 9 preparadas com Int 18', () => {
    const d = computeDerived({
      abilities: { strength: 8, dexterity: 14, constitution: 14, intelligence: 18, wisdom: 12, charisma: 10 },
      classes: toClassLevels([{ classKey: 'wizard', level: 5 }]),
    })
    expect(d.spellcasting!.slots.slice(0, 3)).toEqual([4, 3, 2])
    expect(d.spellcasting!.classes[0]).toMatchObject({ cantripsKnown: 4, spellsKnownOrPrepared: 9, spellbookSize: 14, saveDc: 15 })
  })

  it('classe desconhecida (homebrew) passa sem perfil de conjuração', () => {
    expect(toClassLevels([{ classKey: 'meu_homebrew', level: 3 }])).toEqual([{ classKey: 'meu_homebrew', level: 3 }])
  })

  it('dado de vida por classe', () => {
    expect(hitDieOf('barbarian')).toBe(12)
    expect(hitDieOf('wizard')).toBe(6)
    expect(hitDieOf('nada')).toBeNull()
  })
})

describe('raças', () => {
  it('são as 9 do SRD, com chaves únicas', () => {
    expect(RACES.map((r) => r.key)).toEqual(['dwarf', 'elf', 'halfling', 'human', 'dragonborn', 'gnome', 'half_elf', 'half_orc', 'tiefling'])
    expect(unique(RACES.map((r) => r.key))).toBe(true)
  })

  it('bônus de atributo (raça + sub-raça) somam o esperado', () => {
    const total = (key: string) => {
      const r = getRace(key)!
      const base = Object.values(r.abilityBonuses).reduce((a, b) => a + b, 0)
      const sub = Math.max(0, ...r.subraces.map((s) => Object.values(s.abilityBonuses).reduce((a, b) => a + b, 0)))
      const choice = r.abilityChoice ? r.abilityChoice.count * r.abilityChoice.amount : 0
      return base + sub + choice
    }
    expect(RACES.map((r) => [r.key, total(r.key)])).toEqual([
      ['dwarf', 3], ['elf', 3], ['halfling', 3], ['human', 6], ['dragonborn', 3], ['gnome', 3], ['half_elf', 4], ['half_orc', 3], ['tiefling', 3],
    ])
  })

  it('deslocamento e tamanho', () => {
    const speed = Object.fromEntries(RACES.map((r) => [r.key, r.speed]))
    expect(speed).toEqual({ dwarf: 25, elf: 30, halfling: 25, human: 30, dragonborn: 30, gnome: 25, half_elf: 30, half_orc: 30, tiefling: 30 })
    expect(RACES.filter((r) => r.size === 'small').map((r) => r.key)).toEqual(['halfling', 'gnome'])
  })

  it('visão no escuro de 18 metros (60 pés) onde o SRD dá', () => {
    expect(RACES.filter((r) => r.darkvision === 60).map((r) => r.key)).toEqual(['dwarf', 'elf', 'gnome', 'half_elf', 'half_orc', 'tiefling'])
  })

  it('só o SRD de uma sub-raça por raça que as tem', () => {
    expect(RACES.filter((r) => r.subraces.length).map((r) => [r.key, r.subraces.map((s) => s.key)])).toEqual([
      ['dwarf', ['hill_dwarf']], ['elf', ['high_elf']], ['halfling', ['lightfoot']], ['gnome', ['rock_gnome']],
    ])
  })

  it('Anão da Colina dá +1 de PV por nível', () => {
    expect(raceHpBonusPerLevel('dwarf', 'hill_dwarf')).toBe(1)
    expect(raceHpBonusPerLevel('dwarf')).toBe(0)
    expect(raceHpBonusPerLevel('elf', 'high_elf')).toBe(0)
    expect(getSubrace('dwarf', 'hill_dwarf')!.abilityBonuses).toEqual({ wisdom: 1 })
  })

  it('referências de armas e ferramentas existem no catálogo', () => {
    for (const r of RACES) {
      for (const w of r.weaponProficiencies) expect(weaponKeys.has(w), `${r.key}: arma ${w}`).toBe(true)
      for (const tool of r.toolChoice ?? []) expect(toolKeys.has(tool), `${r.key}: ferramenta ${tool}`).toBe(true)
      for (const s of r.skills) expect(skillKeys.has(s)).toBe(true)
      for (const sub of r.subraces) {
        for (const w of sub.weaponProficiencies ?? []) expect(weaponKeys.has(w)).toBe(true)
        for (const tool of sub.tools ?? []) expect(toolKeys.has(tool), `${sub.key}: ferramenta ${tool}`).toBe(true)
      }
    }
  })

  it('Meio-Elfo escolhe 2 atributos +1 (exceto Carisma) e 2 perícias', () => {
    const h = getRace('half_elf')!
    expect(h.abilityBonuses).toEqual({ charisma: 2 })
    expect(h.abilityChoice).toEqual({ count: 2, amount: 1, exclude: ['charisma'] })
    expect(h.skillChoices).toBe(2)
  })

  it('perícias raciais: Elfo (Percepção) e Meio-Orc (Intimidação)', () => {
    expect(getRace('elf')!.skills).toEqual(['perception'])
    expect(getRace('half_orc')!.skills).toEqual(['intimidation'])
  })

  it('10 ancestrais dracônicos com tipo de dano', () => {
    expect(DRAGONBORN_ANCESTRIES).toHaveLength(10)
    expect(DRAGONBORN_ANCESTRIES.find((d) => d.key === 'red')).toMatchObject({ damage: 'fogo', save: 'dexterity' })
    expect(DRAGONBORN_ANCESTRIES.find((d) => d.key === 'green')).toMatchObject({ damage: 'veneno', save: 'constitution' })
  })

  it('toda raça e sub-raça tem traços com resumo', () => {
    for (const r of RACES) {
      expect(r.traits.length).toBeGreaterThan(0)
      for (const tr of [...r.traits, ...r.subraces.flatMap((s) => s.traits)]) expect(tr.summary.length).toBeGreaterThan(5)
    }
  })
})

describe('antecedentes', () => {
  it('os 13 antecedentes do Livro do Jogador e o personalizado, com o Acólito do SRD em primeiro', () => {
    expect(BACKGROUNDS.map((b) => b.key)).toEqual([
      'acolyte', 'charlatan', 'criminal', 'entertainer', 'folk_hero', 'guild_artisan', 'hermit', 'noble', 'outlander', 'sage', 'sailor', 'soldier', 'urchin', 'custom',
    ])
    expect(BACKGROUNDS.filter((b) => b.source === 'srd51').map((b) => b.key)).toEqual(['acolyte'])
    expect(BACKGROUNDS.filter((b) => b.source === 'phb')).toHaveLength(12)
  })

  it('cada antecedente do livro tem duas perícias, característica e equipamento', () => {
    for (const b of BACKGROUNDS.filter((x) => !x.custom)) {
      expect(b.skills, b.key).toHaveLength(2)
      expect(new Set(b.skills).size, b.key).toBe(2)
      expect(b.feature, b.key).not.toBeNull()
      expect(b.feature!.summary.length, b.key).toBeGreaterThan(30)
      expect(b.equipment.length, b.key).toBeGreaterThan(2)
      expect(b.name.trim(), b.key).not.toBe('')
      expect(b.original.trim(), b.key).not.toBe('')
    }
    const get = (k: string) => BACKGROUNDS.find((b) => b.key === k)!
    expect(get('sage').languagesChoices).toBe(2)
    expect(get('criminal').skills).toEqual(['deception', 'stealth'])
    expect(get('soldier').tools).toEqual(['Um jogo à escolha', 'Veículos (terrestres)'])
    expect(unique(BACKGROUNDS.flatMap((b) => (b.feature ? [b.feature.key] : [])))).toBe(true)
  })

  it('Acólito do SRD', () => {
    const acolyte = BACKGROUNDS[0]
    expect(acolyte.skills).toEqual(['insight', 'religion'])
    expect(acolyte.languagesChoices).toBe(2)
    expect(acolyte.feature?.original).toBe('Shelter of the Faithful')
  })

  it('o personalizado dá 2 perícias livres e 2 proficiências entre ferramentas e idiomas', () => {
    const custom = BACKGROUNDS.find((b) => b.custom)!
    expect(custom.skillChoices).toBe(2)
    expect(custom.toolOrLanguageChoices).toBe(2)
  })
})

describe('equipamento (conferido com o SRD)', () => {
  it('armas: 37 do SRD, chaves únicas, categorias', () => {
    expect(WEAPONS).toHaveLength(37)
    expect(unique(WEAPONS.map((w) => w.key))).toBe(true)
    expect(WEAPONS.filter((w) => w.category === 'simple')).toHaveLength(14)
    expect(WEAPONS.filter((w) => w.category === 'martial')).toHaveLength(23)
  })

  it('dano e custo de armas conhecidas', () => {
    expect(getWeapon('longsword')).toMatchObject({ damage: '1d8', damageType: 'cortante', cost: '15 po' })
    expect(getWeapon('greatsword')).toMatchObject({ damage: '2d6', cost: '50 po' })
    expect(getWeapon('dagger')).toMatchObject({ damage: '1d4', damageType: 'perfurante', cost: '2 po' })
    expect(getWeapon('heavy_crossbow')).toMatchObject({ damage: '1d10', cost: '50 po' })
    expect(getWeapon('net')!.damage).toBeNull()
    expect(getWeapon('blowgun')!.damage).toBe('1')
  })

  it('armaduras: CA base e limite de Destreza', () => {
    expect(ARMORS).toHaveLength(12)
    expect(getArmor('leather')).toMatchObject({ category: 'light', baseAc: 11, dexCap: null })
    expect(getArmor('chain_shirt')).toMatchObject({ category: 'medium', baseAc: 13, dexCap: 2 })
    expect(getArmor('plate')).toMatchObject({ category: 'heavy', baseAc: 18, strengthRequirement: 15, stealthDisadvantage: true })
    expect(getArmor('chain_mail')!.strengthRequirement).toBe(13)
    expect(SHIELD.acBonus).toBe(2)
  })

  it('ferramentas do SRD: 17 de artesão, 10 instrumentos, kits e jogos', () => {
    expect(TOOLS.filter((t) => t.group === 'artesão')).toHaveLength(17)
    expect(TOOLS.filter((t) => t.group === 'instrumento')).toHaveLength(10)
    expect(TOOLS.filter((t) => t.group === 'jogo')).toHaveLength(2)
    expect(unique(TOOLS.map((t) => t.key))).toBe(true)
  })

  it('itens com chave única', () => {
    expect(GEAR.length).toBeGreaterThan(10)
    expect(unique(GEAR.map((g) => g.key))).toBe(true)
  })
})

describe('condições, estilos de luta e glossário', () => {
  it('14 condições e a exaustão com 6 níveis', () => {
    expect(CONDITIONS).toHaveLength(14)
    expect(unique(CONDITIONS.map((c) => c.key))).toBe(true)
    expect(EXHAUSTION.levels.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6])
    expect(EXHAUSTION.levels[5].effect).toBe('Morte')
  })

  it('6 estilos de luta, cada um atribuído a classes que existem', () => {
    expect(FIGHTING_STYLES).toHaveLength(6)
    for (const s of FIGHTING_STYLES) for (const c of s.classes) expect(getClass(c)).toBeDefined()
    expect(FIGHTING_STYLES.find((s) => s.key === 'archery')!.classes).toEqual(['fighter', 'ranger'])
    expect(FIGHTING_STYLES.find((s) => s.key === 'protection')!.classes).toEqual(['fighter', 'paladin'])
  })

  it('glossário sem termos repetidos', () => {
    expect(GLOSSARY.length).toBeGreaterThan(20)
    expect(unique(GLOSSARY.map((g) => g.term))).toBe(true)
  })
})

describe('busca no catálogo', () => {
  it('acha por nome em português, sem acento, e pelo original', () => {
    expect(searchCatalog('barbaro')[0]).toMatchObject({ category: 'class', key: 'barbarian' })
    expect(searchCatalog('wizard')[0]).toMatchObject({ category: 'class', key: 'wizard' })
    expect(searchCatalog('espada longa')[0]).toMatchObject({ category: 'weapon', key: 'longsword' })
    expect(searchCatalog('')).toEqual([])
    expect(searchCatalog('zzzzz')).toEqual([])
  })

  it('respeita o limite', () => {
    expect(searchCatalog('a', 5)).toHaveLength(5)
  })
})
