import { describe, expect, it } from 'vitest'
import type { DndCharacterClass, DndCharacterSheet, DndSheetDetails } from '../../../../shared/types'
import {
  acBonusOf, armorWarning, attackFor, classLine, clampHp, deriveSheet, derivedColumns, equippedGear, itemTitle,
  manualOverrides, proficiencySets, saveColumns, strengthWarning, type SheetBundle,
} from './sheetModel'

const now = '2026-10-21T00:00:00Z'

function makeSheet(over: Partial<DndCharacterSheet> = {}): DndCharacterSheet {
  return {
    id: 's1', campaign_id: 'c1', user_id: 'u1',
    character_name: 'Teste', player_name: null, class_name: null, subclass: null, background: null, race: null, alignment: null,
    level: 1, experience: 0, inspiration: false,
    armor_class: 10, initiative_bonus: 0, speed: 30, proficiency_bonus: 2,
    hp_current: 10, hp_max: 10, hp_temp: 0,
    strength: 16, dexterity: 12, constitution: 16, intelligence: 10, wisdom: 13, charisma: 8,
    strength_save_proficient: false, dexterity_save_proficient: false, constitution_save_proficient: false,
    intelligence_save_proficient: false, wisdom_save_proficient: false, charisma_save_proficient: false,
    death_save_successes: 0, death_save_failures: 0,
    spellcasting_ability: null, spell_save_dc: null, spell_attack_bonus: null,
    notes: null, backstory: null, personality_traits: null, ideals: null, bonds: null, flaws: null,
    ruleset: 'dnd5e_2014', race_key: null, subrace_key: null, class_key: null, subclass_key: null, background_key: null,
    created_at: now, updated_at: now,
    ...over,
  }
}

function makeClass(classKey: string, level: number, over: Partial<DndCharacterClass> = {}): DndCharacterClass {
  return { id: classKey, sheet_id: 's1', class_key: classKey, level, subclass_key: null, is_initial: false, hp_rolls: [], created_at: now, updated_at: now, ...over }
}

const emptyDetails = (): DndSheetDetails => ({ skills: [], attacks: [], inventory: [], spells: [], overrides: [] })

function item(catalogKey: string | null, equipped: boolean, name = 'Item') {
  return { id: catalogKey ?? name, sheet_id: 's1', name, quantity: 1, weight: 0, equipped, notes: '', catalog_entry_key: catalogKey, sort_order: 0, created_at: now, updated_at: now }
}

function bundle(over: Partial<SheetBundle> = {}): SheetBundle {
  return { sheet: makeSheet(), classes: [], details: emptyDetails(), proficiencies: [], ...over }
}

describe('deriveSheet: Guerreiro anão da colina de 3º nível com cota de malha e escudo', () => {
  const b = bundle({
    sheet: makeSheet({ level: 3, race_key: 'dwarf', subrace_key: 'hill_dwarf' }),
    classes: [makeClass('fighter', 3, { is_initial: true })],
    details: { ...emptyDetails(), inventory: [item('chain_mail', true), item('shield', true), item('longsword', false)] },
  })
  const { derived } = deriveSheet(b)

  it('CA = cota de malha 16 + escudo 2', () => { expect(derived.armorClass).toBe(18) })
  it('PV = d10 cheio + média + média, com Con +3 e +1 por nível do anão da colina', () => {
    expect(derived.hpMax).toBe((10 + 3 + 1) + (6 + 3 + 1) + (6 + 3 + 1))
  })
  it('deslocamento vem da raça (25 pés)', () => { expect(derived.speed).toBe(25) })
  it('nível total e proficiência', () => {
    expect(derived.totalLevel).toBe(3)
    expect(derived.proficiencyBonus).toBe(2)
  })
  it('dado de vida da classe', () => { expect(derived.hitDice).toEqual({ 10: 3 }) })
})

describe('deriveSheet: ficha sem classes (digitada à mão)', () => {
  it('usa o nível da ficha e não inventa PV', () => {
    const { derived } = deriveSheet(bundle({ sheet: makeSheet({ level: 9 }) }))
    expect(derived.totalLevel).toBe(9)
    expect(derived.proficiencyBonus).toBe(4)
    expect(derived.hpMax).toBeNull()
  })

  it('o PV máximo digitado continua valendo nas colunas', () => {
    const sheet = makeSheet({ hp_max: 42 })
    const { derived } = deriveSheet(bundle({ sheet }))
    expect(derivedColumns(derived, sheet).hp_max).toBe(42)
  })
})

describe('deriveSheet: conjurador', () => {
  it('Mago 5 com Int 18: CD e magias saem das colunas calculadas', () => {
    const sheet = makeSheet({ level: 5, intelligence: 18 })
    const { derived } = deriveSheet(bundle({ sheet, classes: [makeClass('wizard', 5, { is_initial: true })] }))
    const cols = derivedColumns(derived, sheet)
    expect(cols.spell_save_dc).toBe(8 + 3 + 4)
    expect(cols.spell_attack_bonus).toBe(3 + 4)
    expect(cols.spellcasting_ability).toBe('intelligence')
  })

  it('não conjurador deixa CD e ataque vazios', () => {
    const sheet = makeSheet()
    const { derived } = deriveSheet(bundle({ sheet, classes: [makeClass('fighter', 1, { is_initial: true })] }))
    expect(derivedColumns(derived, sheet)).toMatchObject({ spell_save_dc: null, spell_attack_bonus: null })
  })
})

describe('perícias, sobrescritas e bônus de CA', () => {
  it('proficiência e especialização das perícias entram na conta', () => {
    const details: DndSheetDetails = {
      ...emptyDetails(),
      skills: [
        { id: '1', sheet_id: 's1', skill_key: 'athletics', proficient: true, expertise: false },
        { id: '2', sheet_id: 's1', skill_key: 'perception', proficient: true, expertise: true },
      ],
    }
    const { derived } = deriveSheet(bundle({ details }))
    expect(derived.skills.athletics.bonus).toBe(3 + 2)
    expect(derived.skills.perception.bonus).toBe(1 + 4)
  })

  it('valores manuais viram sobrescritas do motor', () => {
    const details: DndSheetDetails = {
      ...emptyDetails(),
      overrides: [
        { id: 'o1', sheet_id: 's1', field_key: 'armor_class', manual_value: '21', reason: '', updated_at: now },
        { id: 'o2', sheet_id: 's1', field_key: 'speed', manual_value: 'abc', reason: '', updated_at: now },
      ],
    }
    expect(manualOverrides(details)).toEqual({ armor_class: 21 })
    expect(deriveSheet(bundle({ details })).derived.armorClass).toBe(21)
  })

  it('bônus de CA digitado soma, preso entre -10 e 10', () => {
    expect(acBonusOf(makeSheet({ choices: { acBonus: 2 } }))).toBe(2)
    expect(acBonusOf(makeSheet({ choices: { acBonus: 99 } }))).toBe(10)
    expect(acBonusOf(makeSheet({ choices: { acBonus: 'x' } }))).toBe(0)
    expect(acBonusOf(makeSheet())).toBe(0)
    const { derived } = deriveSheet(bundle({ sheet: makeSheet({ choices: { acBonus: 1 } }) }))
    expect(derived.armorClass).toBe(10 + 1 + 1)
  })
})

describe('equipamento vestido', () => {
  it('só conta o que está equipado e é do catálogo', () => {
    const gear = equippedGear({ ...emptyDetails(), inventory: [item('plate', false), item('leather', true), item(null, true, 'Capa'), item('chave_inexistente', true)] })
    expect(gear.armor?.key).toBe('leather')
    expect(gear.shield).toBe(false)
  })

  it('escudo equipado é reconhecido', () => {
    expect(equippedGear({ ...emptyDetails(), inventory: [item('shield', true)] }).shield).toBe(true)
  })

  it('com duas armaduras equipadas vale a primeira', () => {
    expect(equippedGear({ ...emptyDetails(), inventory: [item('plate', true), item('leather', true)] }).armor?.key).toBe('plate')
  })

  it('avisos de proficiência e de Força', () => {
    const plate = equippedGear({ ...emptyDetails(), inventory: [item('plate', true), item('shield', true)] })
    expect(armorWarning(plate, ['light'])).toContain('armadura pesada e escudo')
    expect(armorWarning(plate, ['light', 'medium', 'heavy', 'shield'])).toBeNull()
    expect(armorWarning({ armor: null, shield: false }, [])).toBeNull()
    expect(strengthWarning(plate, 14)).toContain('15')
    expect(strengthWarning(plate, 15)).toBeNull()
    expect(strengthWarning({ armor: null, shield: false }, 3)).toBeNull()
  })
})

describe('proficiências', () => {
  it('a classe inicial dá tudo; a multiclasse só o que a tabela permite', () => {
    const fighterFirst = proficiencySets([makeClass('fighter', 2, { is_initial: true }), makeClass('wizard', 1)], null, null, [])
    expect(fighterFirst.armor.sort()).toEqual(['heavy', 'light', 'medium', 'shield'])
    expect(fighterFirst.weapons.sort()).toEqual(['martial', 'simple'])

    const wizardFirst = proficiencySets([makeClass('wizard', 1, { is_initial: true }), makeClass('fighter', 2)], null, null, [])
    expect(wizardFirst.armor.sort()).toEqual(['light', 'medium', 'shield'])     // sem armadura pesada
    expect(wizardFirst.weapons).toEqual(expect.arrayContaining(['martial', 'simple', 'dagger']))
  })

  it('raça, sub-raça e proficiências extras somam', () => {
    const p = proficiencySets(
      [makeClass('wizard', 1, { is_initial: true })], 'elf', 'high_elf',
      [{ id: 'p1', sheet_id: 's1', category: 'weapon', entry_key: 'rapier', label: 'Rapieira', source: 'manual', created_at: now },
       { id: 'p2', sheet_id: 's1', category: 'language', entry_key: 'goblin', label: 'Goblin', source: 'manual', created_at: now }],
    )
    expect(p.weapons).toEqual(expect.arrayContaining(['longsword', 'shortbow', 'rapier', 'dagger']))
    expect(p.languages).toEqual(['Comum', 'Élfico', 'Goblin'])
  })

  it('sem classes não há proficiências de classe', () => {
    expect(proficiencySets([], null, null, [])).toEqual({ armor: [], weapons: [], tools: [], languages: [] })
  })
})

describe('ataque com arma', () => {
  it('Guerreiro com espada longa: +5 e 1d8+3', () => {
    const b = bundle({ classes: [makeClass('fighter', 1, { is_initial: true })] })
    const { derived, prof } = deriveSheet(b)
    const a = attackFor('longsword', derived, prof.weapons)!
    expect(a.proficient).toBe(true)
    expect(a.attack.attackBonus).toBe(3 + 2)
    expect(a.attack.damageFormula).toBe('1d8+3')
  })

  it('Mago sem proficiência com a espada: só o modificador', () => {
    const b = bundle({ classes: [makeClass('wizard', 1, { is_initial: true })] })
    const { derived, prof } = deriveSheet(b)
    expect(attackFor('longsword', derived, prof.weapons)!.attack.attackBonus).toBe(3)
    expect(attackFor('dagger', derived, prof.weapons)!.proficient).toBe(true)
  })

  it('arma que não existe no catálogo devolve null', () => {
    const { derived, prof } = deriveSheet(bundle())
    expect(attackFor('espada_inventada', derived, prof.weapons)).toBeNull()
  })
})

describe('textos e utilitários', () => {
  it('classLine põe a classe inicial primeiro', () => {
    expect(classLine([makeClass('wizard', 3), makeClass('fighter', 5, { is_initial: true })])).toBe('Guerreiro 5 / Mago 3')
    expect(classLine([], 'Ladino')).toBe('Ladino')
    expect(classLine([])).toBe('Sem classe')
    expect(classLine([makeClass('meu_homebrew', 2, { is_initial: true })])).toBe('meu_homebrew 2')
  })

  it('itemTitle usa o nome do catálogo quando há chave', () => {
    expect(itemTitle('x', 'longsword')).toBe('Espada longa')
    expect(itemTitle('x', 'plate')).toBe('Cota de placas')
    expect(itemTitle('x', 'shield')).toBe('Escudo')
    expect(itemTitle('Minha capa', null)).toBe('Minha capa')
    expect(itemTitle('Minha capa', 'sem_chave')).toBe('Minha capa')
  })

  it('clampHp prende entre 0 e o máximo', () => {
    expect(clampHp(-3, 20)).toBe(0)
    expect(clampHp(25, 20)).toBe(20)
    expect(clampHp(12.7, 20)).toBe(12)
  })

  it('saveColumns marca só as salvaguardas da lista', () => {
    expect(saveColumns(['strength', 'constitution'])).toEqual({
      strength_save_proficient: true, dexterity_save_proficient: false, constitution_save_proficient: true,
      intelligence_save_proficient: false, wisdom_save_proficient: false, charisma_save_proficient: false,
    })
  })

  it('derivedColumns prende os valores nos limites do banco', () => {
    const sheet = makeSheet()
    const { derived } = deriveSheet(bundle({ sheet, details: { ...emptyDetails(), overrides: [
      { id: 'o', sheet_id: 's1', field_key: 'armor_class', manual_value: '500', reason: '', updated_at: now },
      { id: 'p', sheet_id: 's1', field_key: 'speed', manual_value: '-5', reason: '', updated_at: now },
    ] } }))
    const cols = derivedColumns(derived, sheet)
    expect(cols.armor_class).toBe(99)
    expect(cols.speed).toBe(0)
  })
})
