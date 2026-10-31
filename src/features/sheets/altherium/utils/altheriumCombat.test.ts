import { describe, expect, it } from 'vitest'
import type { AltheriumInventoryItem } from '../../../../shared/types'
import {
  EMPTY_COMBAT,
  addCondition,
  applyDamage,
  attackHits,
  attackModes,
  combatWeapons,
  conditionAttributeMod,
  doubleDamage,
  endScene,
  parryResult,
  rangePenalty,
  reactionAvailable,
  startTurn,
  surroundBonus,
  weaponDamageFormula,
  zoneArmor,
  zoneForRoll,
} from './altheriumCombat'

const item = (id: string, item_id: string): AltheriumInventoryItem => ({
  id, sheet_id: 's', item_type: 'arma', item_id, quantity: 1, equipped: false, equipped_zone: null,
  custom_name: null, custom_detail: null, custom_db: null, custom_damage_dice: null,
  custom_damage_type: null, custom_attribute: null, custom_range: null, created_at: '',
})

describe('combate de Altherium', () => {
  it('local atingido pelo 1d10', () => {
    expect([1, 3, 4, 6, 7, 9, 10].map(zoneForRoll)).toEqual(['db_pernas', 'db_pernas', 'db_bracos', 'db_bracos', 'db_tronco', 'db_tronco', 'db_cabeca'])
  })

  it('modos de ataque: arremessável faz os dois, arco só à distância', () => {
    const [lanca, arco, sabre] = combatWeapons([item('a', 'lanca_arremesso'), item('b', 'arco_curto'), item('c', 'sabre')])
    expect(attackModes(lanca)).toEqual(['corpo', 'distancia'])
    expect(attackModes(arco)).toEqual(['distancia'])
    expect(attackModes(sabre)).toEqual(['corpo'])
  })

  it('faixas além do alcance, cercar e crítico', () => {
    expect([0, 1, 2, 3].map(rangePenalty)).toEqual([0, -1, -2, null])
    expect([1, 2, 3].map(surroundBonus)).toEqual([0, 1, 2])
    expect(doubleDamage('2d8')).toBe('4d8')
    expect(doubleDamage('1d10+2')).toBe('2d10+4')
  })

  it('empate favorece a defesa', () => {
    expect(attackHits(10, 10)).toBe(false)
    expect(attackHits(11, 10)).toBe(true)
  })

  it('aparar: contra-ataque com 5 a mais, 4 com Fluxo, ou crítico', () => {
    expect(parryResult(15, 10)).toEqual({ parried: true, counter: true, margin: 5 })
    expect(parryResult(14, 10)).toEqual({ parried: true, counter: false, margin: 4 })
    expect(parryResult(14, 10, { fluxo: true }).counter).toBe(true)
    expect(parryResult(9, 10).parried).toBe(false)
    expect(parryResult(9, 10, { crit: true }).counter).toBe(true)
  })

  it('dano na ordem do livro', () => {
    expect(applyDamage({ damage: 10, type: 'corte', db: 4 }).final).toBe(6)
    expect(applyDamage({ damage: 5, type: 'perfurante', db: 8, ignoreDb: 2 }).final).toBe(1)
    const min = applyDamage({ damage: 3, type: 'impacto', db: 8 })
    expect(min).toMatchObject({ final: 1, armorWear: true })
    expect(applyDamage({ damage: 6, type: 'corte', db: 4, vulnerable: true }).final).toBe(8)
    expect(applyDamage({ damage: 10, type: 'runico', db: 9 }).final).toBe(5)       // ignora 4 do DB
    expect(applyDamage({ damage: 10, type: 'runico', db: 9, eryndorArmor: true }).final).toBe(1)
    expect(applyDamage({ damage: 10, type: 'fogo', db: 2, resistance: 10 }).final).toBe(0)
    expect(applyDamage({ damage: 10, type: 'corte', db: 2, vulnerable: true, resistance: 3 }).final).toBe(8) // se anulam
    expect(applyDamage({ damage: 10, type: 'corte', db: 0, immune: true }).final).toBe(0)
  })

  it('início do turno: renova a Reação, queima e conta os turnos', () => {
    let s = addCondition({ ...EMPTY_COMBAT, reaction_used: true, defend_total: true }, 'queimando')
    s = addCondition(s, 'surpreendido')
    expect(reactionAvailable(s)).toBe(false)
    const t = startTurn(s)
    expect(t.damage).toEqual([{ label: 'Queimando', amount: 2 }])
    expect(t.state).toMatchObject({ reaction_used: false, defend_total: false, conditions: [{ id: 'queimando', turns: 2 }] })
    expect(t.ended).toEqual(['Surpreendido'])
    expect(startTurn(startTurn(t.state).state).state.conditions).toEqual([])
  })

  it('Amedrontado tira 1 de Fúria até o fim da cena', () => {
    const s = addCondition(EMPTY_COMBAT, 'amedrontado')
    expect(conditionAttributeMod(s, 'furia')).toBe(-1)
    expect(endScene(s).conditions).toEqual([])
  })

  it('Integridade e Reforços no dano e no DB', () => {
    const [sabre] = combatWeapons([{ ...item('a', 'sabre'), integrity: 40, reinforcements: ['fio_temperado'] }])
    expect(weaponDamageFormula(sabre, false).formula).toBe('2d10+3')
    expect(weaponDamageFormula(sabre, true).formula).toBe('4d10+3')
    const cota = { ...item('c', 'cota_malha_norte'), item_type: 'armadura' as const, equipped: true, equipped_zone: 'db_tronco' as const, integrity: 20, reinforcements: ['placas_costuradas'] }
    expect(zoneArmor([cota], 'db_tronco')).toMatchObject({ delta: -2, armorId: 'c' })   // metade de 8 (−4) e Placas +2
    expect(zoneArmor([cota], 'db_pernas').delta).toBe(0)
  })
})
