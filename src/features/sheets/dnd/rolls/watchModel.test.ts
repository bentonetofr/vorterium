import { describe, expect, it } from 'vitest'
import type { DiceRoll, DiceRollContext, RollBreakdownItem } from '../../../../shared/types'
import { isCheckRoll, watchedCheck } from './watchModel'

function roll(breakdown: RollBreakdownItem[], context: DiceRollContext | null, result = 15): DiceRoll {
  return {
    id: 'r', campaign_id: 'c', user_id: 'u', die_type: 'd20', result, quantity: 1, modifier: 0, individual_results: null, total_result: result,
    roll_mode: 'sum', kept_result: null, formula: '1d20+5', roll_breakdown: breakdown, is_private: false, created_at: '', roll_label: 'Furtividade',
    roll_context: context, dice_skin: null, no_floor: true,
  }
}
const d20 = (v: number): RollBreakdownItem => ({ type: 'sum', notation: '1d20', quantity: 1, sides: 20, results: [v], subtotal: v })

describe('rolagens dos outros jogadores', () => {
  it('só é teste quando o contexto diz e o d20 vem primeiro', () => {
    expect(isCheckRoll(roll([d20(12), { type: 'modifier', value: 5 }], { kind: 'skill', natural: 12 }))).toBe(true)
    expect(isCheckRoll(roll([d20(12)], { kind: 'damage', natural: 12 }))).toBe(false)
    expect(isCheckRoll(roll([d20(12)], { kind: 'skill' }))).toBe(false)
    expect(isCheckRoll(roll([d20(12)], null))).toBe(false)
    expect(isCheckRoll(roll([{ type: 'sum', notation: '2d6', quantity: 2, sides: 6, results: [3, 4], subtotal: 7 }], { kind: 'skill', natural: 3 }))).toBe(false)
  })

  it('lê o bônus, a CD e o resultado gravados', () => {
    const w = watchedCheck(roll([d20(12), { type: 'modifier', value: 5 }], { kind: 'save', natural: 12, dc: 15, outcome: 'failure', character: 'Zé', advantage: 'advantage' }, 17))
    expect(w).toMatchObject({ label: 'Furtividade', character: 'Zé', dc: 15, dcHidden: false, bonus: 5, outcome: 'failure', crit: null, advantage: 'advantage' })
    expect(w.reading.natural).toBe(12)
    expect(w.reading.total).toBe(17)
  })

  it('CD oculta: quem vê não sabe a CD nem o resultado', () => {
    const w = watchedCheck(roll([d20(9)], { kind: 'skill', natural: 9, dc: 14, dc_hidden: true, outcome: 'failure' }))
    expect(w.dc).toBeNull()
    expect(w.dcHidden).toBe(true)
    expect(w.outcome).toBeNull()
  })

  it('20 e 1 naturais são crítico e falha crítica; reações viram dados com valor', () => {
    expect(watchedCheck(roll([d20(20)], { kind: 'attack', natural: 20 })).crit).toBe('crit')
    expect(watchedCheck(roll([d20(1)], { kind: 'attack', natural: 1 })).crit).toBe('fumble')
    const bless: RollBreakdownItem = { type: 'sum', notation: '1d4', quantity: 1, sides: 4, results: [3], subtotal: 3 }
    const w = watchedCheck(roll([d20(10), bless, { type: 'modifier', value: 2 }], { kind: 'attack', natural: 10, reactions: ['bless'] }, 15))
    expect(w.reactions).toEqual([{ label: 'Bênção', die: 4, value: 3 }])
    expect(w.bonus).toBe(2)
  })
})
