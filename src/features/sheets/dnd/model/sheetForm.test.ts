import { describe, expect, it } from 'vitest'
import type { DndCharacterClass, DndCharacterSheet } from '../../../../shared/types'
import { cleanHitDice, formEchoKey, formFromSheet, formKey, formToPayload, sheetAfterSave, sheetWithForm, validateForm, withoutDerived, DERIVED_COLUMNS } from './sheetForm'
import { deriveSheet } from './sheetModel'

const now = '2026-10-21T00:00:00Z'

function makeSheet(over: Partial<DndCharacterSheet> = {}): DndCharacterSheet {
  return {
    id: 's1', campaign_id: 'c1', user_id: 'u1',
    character_name: 'Aria', player_name: null, class_name: null, subclass: null, background: null, race: null, alignment: null,
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

const fighter = (level: number): DndCharacterClass => ({
  id: 'f', sheet_id: 's1', class_key: 'fighter', level, subclass_key: null, is_initial: true, hp_rolls: [], created_at: now, updated_at: now,
})

function payloadFor(sheet: DndCharacterSheet, classes: DndCharacterClass[] = []) {
  const form = formFromSheet(sheet)
  const { derived } = deriveSheet({ sheet: sheetWithForm(sheet, form), classes, details: { skills: [], attacks: [], inventory: [], spells: [], overrides: [] }, proficiencies: [] })
  return { form, derived, payload: formToPayload(sheet, form, derived, classes.length ? 'Guerreiro' : '', classes.length > 0) }
}

describe('formFromSheet', () => {
  it('lê os campos, com texto vazio no lugar de null', () => {
    const f = formFromSheet(makeSheet())
    expect(f.character_name).toBe('Aria')
    expect(f.player_name).toBe('')
    expect(f.race_key).toBe('')
    expect(f.coin_gp).toBe(0)
    expect(f.conditions).toEqual([])
    expect(f.exhaustion).toBe(0)
    expect(f.ac_bonus).toBe(0)
  })

  it('lê o que veio das colunas novas e do bônus de CA nas escolhas', () => {
    const f = formFromSheet(makeSheet({ coin_gp: 30, conditions: ['poisoned'], exhaustion: 2, hit_dice_used: { '8': 1 }, choices: { acBonus: 2 }, concentrating_on: 'Bênção' }))
    expect(f).toMatchObject({ coin_gp: 30, conditions: ['poisoned'], exhaustion: 2, hit_dice_used: { '8': 1 }, ac_bonus: 2, concentrating_on: 'Bênção' })
  })

  it('não compartilha referências com a ficha original', () => {
    const sheet = makeSheet({ conditions: ['prone'] })
    const f = formFromSheet(sheet)
    f.conditions.push('poisoned')
    expect(sheet.conditions).toEqual(['prone'])
  })
})

describe('formToPayload', () => {
  it('sem classes: o PV e o nível digitados valem, e o nível vai pro banco', () => {
    const sheet = makeSheet({ level: 4, hp_max: 31, hp_current: 31 })
    const { payload } = payloadFor(sheet)
    expect(payload.hp_max).toBe(31)
    expect(payload.level).toBe(4)
    expect(payload.armor_class).toBe(11)       // 10 + Des +1
  })

  it('com classes: o nível não é enviado (o banco soma as classes) e o PV vem do motor', () => {
    const sheet = makeSheet({ level: 3, hp_max: 1, hp_current: 1 })
    const { payload } = payloadFor(sheet, [fighter(3)])
    expect('level' in payload).toBe(false)
    expect(payload.hp_max).toBe(13 + 9 + 9)    // d10 cheio + média, média, com Con +3
    expect(payload.proficiency_bonus).toBe(2)
    expect(payload.class_name).toBe('Guerreiro')
  })

  it('PV atual é preso no máximo e no zero', () => {
    const sheet = makeSheet({ hp_max: 20, hp_current: 50 })
    expect(payloadFor(sheet).payload.hp_current).toBe(20)
  })

  it('limites do banco: atributos 1 a 30, exaustão 0 a 6, moedas e PV temporário sem negativo', () => {
    const sheet = makeSheet()
    const form = { ...formFromSheet(sheet), strength: 99, dexterity: -4, exhaustion: 9, coin_gp: -5, hp_temp: -3, experience: -1 }
    const { derived } = deriveSheet({ sheet: sheetWithForm(sheet, form), classes: [], details: { skills: [], attacks: [], inventory: [], spells: [], overrides: [] }, proficiencies: [] })
    const p = formToPayload(sheet, form, derived, '', false)
    expect(p).toMatchObject({ strength: 30, dexterity: 1, exhaustion: 6, coin_gp: 0, hp_temp: 0, experience: 0 })
  })

  it('texto vazio vira null e nomes de raça e antecedente vêm do catálogo', () => {
    const sheet = makeSheet({ character_name: null })
    const form = { ...formFromSheet(sheet), character_name: '   ', race_key: 'dwarf', subrace_key: 'hill_dwarf', background_key: 'acolyte' }
    const { derived } = deriveSheet({ sheet: sheetWithForm(sheet, form), classes: [], details: { skills: [], attacks: [], inventory: [], spells: [], overrides: [] }, proficiencies: [] })
    const p = formToPayload(sheet, form, derived, '', false)
    expect(p.character_name).toBeNull()
    expect(p).toMatchObject({ race: 'Anão', race_key: 'dwarf', subrace_key: 'hill_dwarf', background: 'Acólito', background_key: 'acolyte' })
    expect(p.speed).toBe(25)                   // a raça vale no deslocamento calculado
  })

  it('o bônus de CA vai nas escolhas e some quando volta a zero', () => {
    const sheet = makeSheet({ choices: { outro: 'x' } })
    const form = { ...formFromSheet(sheet), ac_bonus: 2 }
    const run = (f: typeof form) => formToPayload(sheet, f, deriveSheet({ sheet: sheetWithForm(sheet, f), classes: [], details: { skills: [], attacks: [], inventory: [], spells: [], overrides: [] }, proficiencies: [] }).derived, '', false)
    expect(run(form).choices).toEqual({ outro: 'x', acBonus: 2 })
    expect(run({ ...form, ac_bonus: 0 }).choices).toEqual({ outro: 'x' })
  })

  it('atributo de conjuração e anotações por origem vão nas escolhas e somem quando vazios', () => {
    const sheet = makeSheet({ choices: { outro: 'x' } })
    const run = (f: ReturnType<typeof formFromSheet>) => formToPayload(sheet, f, deriveSheet({ sheet: sheetWithForm(sheet, f), classes: [], details: { skills: [], attacks: [], inventory: [], spells: [], overrides: [] }, proficiencies: [] }).derived, '', false)
    const form = { ...formFromSheet(sheet), spell_ability: 'wisdom' as const, notes_racial: '  Visão no escuro  ', notes_background: 'Favor do templo', notes_class: '' }
    expect(run(form).choices).toEqual({ outro: 'x', spellAbility: 'wisdom', notesRacial: 'Visão no escuro', notesBackground: 'Favor do templo' })
    expect(run({ ...form, spell_ability: '', notes_racial: '', notes_background: '   ' }).choices).toEqual({ outro: 'x' })
    const back = formFromSheet(makeSheet({ choices: { spellAbility: 'wisdom', notesClass: 'Fúria 2x' } }))
    expect(back).toMatchObject({ spell_ability: 'wisdom', notes_class: 'Fúria 2x', notes_racial: '' })
  })

  it('as anotações por origem respeitam o limite de texto', () => {
    const f = { ...formFromSheet(makeSheet()), notes_class: 'a'.repeat(6001) }
    expect(validateForm(f)).toContain('6000')
  })

  it('condições em ordem fixa e dados de vida só com valores positivos', () => {
    const sheet = makeSheet()
    const form = { ...formFromSheet(sheet), conditions: ['prone', 'blinded'] as const, hit_dice_used: { '10': 0, '8': 2 } }
    const { derived } = deriveSheet({ sheet: sheetWithForm(sheet, { ...form, conditions: [...form.conditions] }), classes: [], details: { skills: [], attacks: [], inventory: [], spells: [], overrides: [] }, proficiencies: [] })
    const p = formToPayload(sheet, { ...form, conditions: [...form.conditions] }, derived, '', false)
    expect(p.conditions).toEqual(['blinded', 'prone'])
    expect(p.hit_dice_used).toEqual({ '8': 2 })
  })
})

describe('eco do próprio salvamento', () => {
  it('a mesma ficha dá a mesma chave, e uma mudança dá chave diferente', () => {
    const sheet = makeSheet({ conditions: ['prone', 'blinded'] })
    expect(formKey(formFromSheet(sheet))).toBe(formKey(formFromSheet(makeSheet({ conditions: ['blinded', 'prone'] }))))
    expect(formKey(formFromSheet(sheet))).not.toBe(formKey({ ...formFromSheet(sheet), coin_gp: 1 }))
  })

  it('cleanHitDice ordena e tira os zeros', () => {
    expect(Object.keys(cleanHitDice({ '12': 1, '6': 2, '8': 0 }))).toEqual(['6', '12'])
  })
})

describe('validateForm', () => {
  it('aceita uma ficha normal e recusa texto grande demais', () => {
    expect(validateForm(formFromSheet(makeSheet()))).toBeNull()
    expect(validateForm({ ...formFromSheet(makeSheet()), character_name: 'x'.repeat(121) })).toContain('120')
    expect(validateForm({ ...formFromSheet(makeSheet()), backstory: 'x'.repeat(12001) })).toContain('12000')
  })
})

describe('eco do salvamento (não pode resetar o formulário no meio da digitação)', () => {
  const emptyDetails = { skills: [], attacks: [], inventory: [], spells: [], overrides: [] }

  function roundTrip(sheet: DndCharacterSheet, edit: Partial<ReturnType<typeof formFromSheet>>, classes: DndCharacterClass[]) {
    const form = { ...formFromSheet(sheet), ...edit }
    const { derived } = deriveSheet({ sheet: sheetWithForm(sheet, form), classes, details: emptyDetails, proficiencies: [] })
    const payload = formToPayload(sheet, form, derived, classes.length ? 'Guerreiro' : '', classes.length > 0)
    const hasClasses = classes.length > 0
    const expected = formEchoKey(formFromSheet(sheetAfterSave(sheet, payload)), hasClasses)
    // o servidor devolve a linha com o payload aplicado
    const echoed = formEchoKey(formFromSheet({ ...sheet, ...payload } as DndCharacterSheet), hasClasses)
    return { expected, echoed, typed: formEchoKey(form, hasClasses) }
  }

  it('texto com espaços nas pontas: o eco bate com o esperado', () => {
    const r = roundTrip(makeSheet(), { character_name: '  Aria  ', backstory: 'linha\n\n' }, [])
    expect(r.echoed).toBe(r.expected)
  })

  it('com classes, o PV máximo e o nível calculados pelo banco não contam como mudança externa', () => {
    const sheet = makeSheet({ hp_max: 1, level: 1 })
    const form = formFromSheet(sheet)
    const withDb = { ...sheet, hp_max: 31, level: 5 }
    expect(formEchoKey(formFromSheet(withDb), true)).toBe(formEchoKey(form, true))
  })

  it('sem classes, o PV máximo digitado conta', () => {
    const sheet = makeSheet({ hp_max: 10 })
    expect(formEchoKey(formFromSheet({ ...sheet, hp_max: 12 }), false)).not.toBe(formEchoKey(formFromSheet(sheet), false))
  })

  it('uma mudança real feita por outra pessoa é reconhecida', () => {
    const sheet = makeSheet()
    expect(formEchoKey(formFromSheet({ ...sheet, coin_gp: 5 }), true)).not.toBe(formEchoKey(formFromSheet(sheet), true))
  })

  it('PV atual acima do máximo volta preso ao máximo no eco', () => {
    const sheet = makeSheet({ hp_max: 20, hp_current: 20 })
    const r = roundTrip(sheet, { hp_current: 50 }, [])
    expect(r.echoed).toBe(r.expected)
    expect(r.typed).not.toBe(r.expected)    // o formulário ainda tem 50: o eco corrige para 20
  })
})

describe('withoutDerived', () => {
  it('tira o que depende das classes carregadas', () => {
    const sheet = makeSheet()
    const form = formFromSheet(sheet)
    const { derived } = deriveSheet({ sheet, classes: [], details: { skills: [], attacks: [], inventory: [], spells: [], overrides: [] }, proficiencies: [] })
    const payload = withoutDerived(formToPayload(sheet, form, derived, 'Guerreiro', false)) as Record<string, unknown>
    for (const k of [...DERIVED_COLUMNS, 'spellcasting_ability', 'class_name', 'level']) expect(k in payload).toBe(false)
    expect(payload.character_name).toBe('Aria')
  })
})
