import { describe, expect, it } from 'vitest'
import { computeDerived } from '../rules/derive'
import {
  abilityCheck, attackCheck, checkContext, checkFormula, critDamage, deathCheck, deathResult, initiativeCheck, judge,
  readCheck, saveCheck, skillCheck, spellAttackCheck, tilesTotal,
} from './checkModel'
import type { RollBreakdownItem } from '../../../../shared/types'

const derived = computeDerived({
  abilities: { strength: 16, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 13, charisma: 8 },
  classes: [{ classKey: 'rogue', level: 5 }],
  skillProficiency: { stealth: 'expertise', perception: 'proficient' },
  saveProficiency: { dexterity: true, intelligence: true },
})

describe('tiles de bônus', () => {
  it('perícia com especialista: Destreza + Proficiência + Especialista', () => {
    const s = skillCheck(derived, 'stealth')
    expect(s.label).toBe('Furtividade')
    expect(s.tiles.map((t) => [t.label, t.value])).toEqual([['Destreza', 2], ['Proficiência', 3], ['Especialista', 3]])
    expect(tilesTotal(s.tiles)).toBe(derived.skills.stealth.bonus)
  })

  it('perícia sem proficiência mostra só o atributo', () => {
    const s = skillCheck(derived, 'athletics')
    expect(s.tiles.map((t) => t.label)).toEqual(['Força'])
    expect(tilesTotal(s.tiles)).toBe(3)
  })

  it('salvaguarda com e sem proficiência; teste de atributo', () => {
    expect(saveCheck(derived, 'dexterity').tiles.map((t) => t.value)).toEqual([2, 3])
    expect(saveCheck(derived, 'strength').tiles.map((t) => t.value)).toEqual([3])
    expect(saveCheck(derived, 'dexterity').label).toBe('Salvaguarda de Destreza')
    expect(abilityCheck(derived, 'wisdom').tiles).toEqual([{ id: 'mod_wisdom', label: 'Sabedoria', value: 1, badge: 'SAB' }])
  })

  it('sobra de bônus vira o tile "Outros"; valor manual vira "Bônus manual"', () => {
    const manual = { ...derived, skills: { ...derived.skills, stealth: { ...derived.skills.stealth, bonus: 12 } }, overridden: ['skill_stealth'] } as typeof derived
    expect(skillCheck(manual, 'stealth').tiles).toEqual([{ id: 'manual', label: 'Bônus manual', value: 12, badge: 'MAN' }])
    const extra = { ...derived, initiative: derived.initiative + 5 }
    const ini = initiativeCheck(extra)
    expect(ini.tiles[ini.tiles.length - 1]).toMatchObject({ label: 'Outros bônus', value: 5 })
    expect(tilesTotal(ini.tiles)).toBe(extra.initiative)
  })

  it('ataque com arma e sem proficiência', () => {
    const a = attackCheck('Espada curta', 'shortsword', 'dexterity', 2, 3, 5)
    expect(a.label).toBe('Ataque: Espada curta')
    expect(a.tiles.map((t) => t.value)).toEqual([2, 3])
    expect(attackCheck('Machado grande', 'greataxe', 'strength', 3, null, 3).tiles.map((t) => t.label)).toEqual(['Força'])
  })

  it('morte: CD 10 sem bônus; ataque de magia só para quem conjura', () => {
    expect(deathCheck()).toMatchObject({ dc: 10, tiles: [] })
    expect(spellAttackCheck(derived)).toBeNull()
  })
})

describe('fórmula, leitura e julgamento', () => {
  const spec = skillCheck(derived, 'stealth')

  it('fórmula com vantagem, desvantagem e reações', () => {
    expect(checkFormula(spec, 'normal', [])).toBe('1d20+8')
    expect(checkFormula(spec, 'advantage', [{ key: 'guidance', die: 4 }])).toBe('2#d20+1d4+8')
    expect(checkFormula(saveCheck(derived, 'charisma'), 'disadvantage', [])).toBe('2@d20-1')
    expect(checkFormula(deathCheck(), 'normal', [])).toBe('1d20')
  })

  it('lê a rolagem gravada: os d20, qual valeu e as reações', () => {
    const b: RollBreakdownItem[] = [
      { type: 'keep_highest', notation: '2#d20', quantity: 2, sides: 20, results: [7, 15], kept: 15, subtotal: 15 } as never,
      { type: 'sum', notation: '1d4', quantity: 1, sides: 4, results: [3], subtotal: 3 } as never,
      { type: 'modifier', value: 8 } as never,
    ]
    expect(readCheck(b, 26)).toEqual({ d20s: [7, 15], keptIndex: 1, natural: 15, reactionValues: [3], total: 26 })
  })

  it('sucesso, falha e crítico', () => {
    expect(judge('skill', 12, 18, 15)).toEqual({ outcome: 'success', crit: null })
    expect(judge('skill', 12, 14, 15)).toEqual({ outcome: 'failure', crit: null })
    expect(judge('skill', 20, 14, 15)).toEqual({ outcome: 'failure', crit: 'crit' })   // regra de 2014: teste não acerta no 20
    expect(judge('save', 1, 16, 15)).toEqual({ outcome: 'success', crit: 'fumble' })
    expect(judge('attack', 20, 5, 30)).toEqual({ outcome: 'success', crit: 'crit' })
    expect(judge('attack', 1, 40, 10)).toEqual({ outcome: 'failure', crit: 'fumble' })
    expect(judge('skill', 10, 15, null)).toEqual({ outcome: null, crit: null })
    expect(judge('death', 9, 9, 10).outcome).toBe('failure')
    expect(judge('death', 10, 10, 10).outcome).toBe('success')
  })

  it('salvaguarda contra a morte muda a ficha pela regra', () => {
    expect(deathResult(20, 20, 1, 2)).toMatchObject({ successes: 0, failures: 0, revive: true })
    expect(deathResult(1, 1, 0, 0)).toMatchObject({ failures: 2, revive: false })
    expect(deathResult(1, 1, 0, 2)).toMatchObject({ failures: 3, label: '1 natural: duas falhas. Morreu.' })
    expect(deathResult(12, 12, 2, 0)).toMatchObject({ successes: 3, label: 'Sucesso: estabilizado.' })
    expect(deathResult(5, 5, 0, 1)).toMatchObject({ failures: 2, label: 'Falha.' })
  })

  it('o contexto gravado esconde o resultado quando a CD é oculta', () => {
    const open = checkContext({ ...spec, dc: 15 }, { advantage: 'normal', reactions: [], natural: 12, total: 20, character: 'Lia', sheetId: 's1' })
    expect(open).toMatchObject({ system: 'dnd5e', kind: 'skill', key: 'stealth', dc: 15, outcome: 'success', natural: 12, character: 'Lia' })
    const hidden = checkContext({ ...spec, dc: 15, dcHidden: true, requestId: 'r1' }, { advantage: 'advantage', reactions: [{ key: 'guidance', die: 4 }], natural: 12, total: 20, character: 'Lia', sheetId: 's1' })
    expect(hidden).toMatchObject({ dc: null, dc_hidden: true, outcome: null, request_id: 'r1', reactions: ['guidance'], advantage: 'advantage' })
  })

  it('dano crítico dobra os dados', () => {
    expect(critDamage('1d8+3')).toBe('2d8+3')
    expect(critDamage('2d6+1d4+2')).toBe('4d6+2d4+2')
    expect(critDamage('d12')).toBe('2d12')
  })
})
