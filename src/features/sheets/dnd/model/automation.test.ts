import { describe, expect, it } from 'vitest'
import { computeDerived } from '../rules/derive'
import type { DerivedInput } from '../rules/types'
import { AUTOMATION_GROUPS, AUTOMATION_ITEMS, MANUAL_MODES, computedValue, isItemManual, isManualMode, manualSeed } from './automation'
import { formFromSheet, formToPayload, sheetWithForm } from './sheetForm'
import { deriveSheet } from './sheetModel'
import { makeSheet } from '../components/fixtures'
import migrationSql from '../../../../../supabase/migrations/20240208000000_dnd_automatizar.sql?raw'

const base: DerivedInput = {
  abilities: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 13, charisma: 8 },
  classes: [{ classKey: 'fighter', level: 5 }],
  saveProficiency: { strength: true, constitution: true },
  skillProficiency: { perception: 'proficient', athletics: 'proficient' },
}

describe('itens do Automatizar', () => {
  const byId = (id: string) => AUTOMATION_ITEMS.find((i) => i.id === id)!

  it('14 itens em 3 grupos, com título e descrição', () => {
    expect(AUTOMATION_ITEMS).toHaveLength(14)
    expect(new Set(AUTOMATION_ITEMS.map((i) => i.id)).size).toBe(14)
    for (const i of AUTOMATION_ITEMS) {
      expect(AUTOMATION_GROUPS).toContain(i.group)
      expect(i.title.trim(), i.id).not.toBe('')
      expect(i.description.trim().length, i.id).toBeGreaterThan(10)
      expect(Boolean(i.fields) !== Boolean(i.mode), i.id).toBe(true)
    }
  })

  it('tamanho dos grupos de campos: 6 modificadores, 6 salvaguardas, 18 perícias, 3 passivas', () => {
    expect(byId('ability_mods').fields).toHaveLength(6)
    expect(byId('saves').fields).toHaveLength(6)
    expect(byId('skills').fields).toHaveLength(18)
    expect(byId('passives').fields).toHaveLength(3)
  })

  it('todos os campos estão na lista aceita pela migration e vice-versa', () => {
    const sql = migrationSql
    const accepted = new Set([...sql.slice(sql.indexOf('check (field_key in (')).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))
    const used = new Set(AUTOMATION_ITEMS.flatMap((i) => i.fields ?? []))
    expect(used).toEqual(accepted)
    expect(accepted.size).toBe(41)
  })

  it('manual é quando algum campo tem valor digitado, ou o comportamento está desligado', () => {
    expect(isItemManual(byId('armor_class'), new Set(), [])).toBe(false)
    expect(isItemManual(byId('armor_class'), new Set(['armor_class']), [])).toBe(true)
    expect(isItemManual(byId('skills'), new Set(['skill_stealth']), [])).toBe(true)
    expect(isItemManual(byId('skills'), new Set(['save_wisdom']), [])).toBe(false)
    expect(isItemManual(byId('spell_slots'), new Set(), ['spell_slots'])).toBe(true)
    expect(isItemManual(byId('class_resources'), new Set(), ['spell_slots'])).toBe(false)
  })

  it('os modos manuais conhecidos', () => {
    expect(MANUAL_MODES).toEqual(['spell_slots', 'class_resources'])
    expect(isManualMode('spell_slots')).toBe(true)
    expect(isManualMode('outro')).toBe(false)
    expect(isManualMode(3)).toBe(false)
  })

  it('o valor inicial do modo manual é o que o motor calcula agora', () => {
    const d = computeDerived(base)
    expect(computedValue('armor_class', d, 0)).toBe(d.armorClass)
    expect(computedValue('mod_strength', d, 0)).toBe(3)
    expect(computedValue('save_strength', d, 0)).toBe(6)
    expect(computedValue('skill_athletics', d, 0)).toBe(6)
    expect(computedValue('skill_animal_handling', d, 0)).toBe(d.skills.animal_handling.bonus)
    expect(computedValue('passive_perception', d, 0)).toBe(14)
    expect(computedValue('carry_capacity', d, 0)).toBe(120)
    expect(computedValue('hp_max', d, 77)).toBe(d.hpMax ?? 77)
    expect(computedValue('spell_save_dc', d, 0)).toBe(0)
    const seed = manualSeed(byId('skills'), d, 0)
    expect(seed).toHaveLength(18)
    expect(seed.find((s) => s.field === 'skill_perception')?.value).toBe(4)
  })
})

describe('motor com os novos campos manuais', () => {
  it('modificador manual propaga para salvaguardas, perícias, passivas e iniciativa', () => {
    const d = computeDerived({ ...base, overrides: { mod_dexterity: 5, mod_wisdom: 4 } })
    expect(d.abilityMods.dexterity).toBe(5)
    expect(d.initiative).toBe(5)
    expect(d.saves.dexterity.bonus).toBe(5)
    expect(d.skills.perception.bonus).toBe(4 + 3)
    expect(d.passivePerception).toBe(17)
    expect(d.overridden).toEqual(expect.arrayContaining(['mod_dexterity', 'mod_wisdom']))
  })

  it('salvaguarda, perícia e passiva manuais valem no lugar da conta', () => {
    const d = computeDerived({ ...base, overrides: { save_strength: 11, skill_stealth: 9, passive_investigation: 20, passive_perception: 30 } })
    expect(d.saves.strength.bonus).toBe(11)
    expect(d.skills.stealth.bonus).toBe(9)
    expect(d.passives.investigation).toBe(20)
    expect(d.passives.perception).toBe(30)
    expect(d.passivePerception).toBe(30)
    expect(d.passives.insight).toBe(10 + d.skills.insight.bonus)
  })

  it('perícia manual não muda a passiva manual de outra perícia; sem manual, a passiva segue a perícia', () => {
    const d = computeDerived({ ...base, overrides: { skill_perception: 12 } })
    expect(d.passives.perception).toBe(22)
  })

  it('capacidade de carga: Força × 7,5 kg, ou o valor manual', () => {
    expect(computeDerived(base).carryCapacity).toBe(120)
    expect(computeDerived({ ...base, overrides: { carry_capacity: 200 } }).carryCapacity).toBe(200)
  })

  it('sem manual nenhum, nada aparece como sobrescrito', () => {
    expect(computeDerived(base).overridden).toEqual([])
  })
})

describe('modos manuais no formulário', () => {
  const run = (choices: Record<string, unknown>, modes: ('spell_slots' | 'class_resources')[]) => {
    const sheet = makeSheet({ choices })
    const form = { ...formFromSheet(sheet), manual_modes: modes }
    const { derived } = deriveSheet({ sheet: sheetWithForm(sheet, form), classes: [], details: { skills: [], attacks: [], inventory: [], spells: [], overrides: [] }, proficiencies: [] })
    return formToPayload(sheet, form, derived, '', false).choices
  }

  it('vão para as escolhas da ficha, em ordem, e somem quando vazios', () => {
    expect(run({ outro: 'x' }, ['spell_slots', 'class_resources'])).toEqual({ outro: 'x', manualModes: ['class_resources', 'spell_slots'] })
    expect(run({ outro: 'x', manualModes: ['spell_slots'] }, [])).toEqual({ outro: 'x' })
  })

  it('a ficha lê só os modos conhecidos', () => {
    expect(formFromSheet(makeSheet({ choices: { manualModes: ['spell_slots', 'lixo', 3, 'class_resources'] } })).manual_modes).toEqual(['class_resources', 'spell_slots'])
    expect(formFromSheet(makeSheet()).manual_modes).toEqual([])
  })
})
