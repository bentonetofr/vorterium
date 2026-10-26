import { describe, expect, it } from 'vitest'
import type { DiceRoll, RollBreakdownItem } from '../../../../shared/types'
import { freeContext, freeLabel, idleKindOf, isFreeRoll, readFree, resultsText } from './freeRoll'
import { parseDiceFormula } from '../../../dice/services/diceService'

function roll(breakdown: RollBreakdownItem[], context: DiceRoll['roll_context']): DiceRoll {
  return {
    id: 'r', campaign_id: 'c', user_id: 'u', die_type: 'd6', result: 9, quantity: 1, modifier: 0, individual_results: null, total_result: 9,
    roll_mode: 'sum', kept_result: null, formula: '2d6+1', roll_breakdown: breakdown, is_private: false, created_at: '', roll_label: 'Rolagem livre',
    roll_context: context, dice_skin: null, no_floor: true,
  }
}
const sum = (sides: number, results: number[]): RollBreakdownItem => ({ type: 'sum', notation: `${results.length}d${sides}`, quantity: results.length, sides, results, subtotal: results.reduce((a, b) => a + b, 0) })

describe('rolagem livre', () => {
  it('o rótulo da fórmula e o dado parado no painel', () => {
    for (const f of ['1d20+5', '2#d20+5', '2@d20+5']) expect(() => parseDiceFormula(f)).not.toThrow()
    expect(freeLabel('2d6+1d8-2')).toBe('2d6 + 1d8 - 2')
    expect(freeLabel('2#d20 + 5')).toBe('2#d20 + 5')
    expect(idleKindOf('2#d20+5')).toBe('d20')
    expect(idleKindOf('3d6+1d8')).toBe('d6')
    expect(idleKindOf('1d3+4')).toBe('d3')
    expect(idleKindOf('1d2')).toBe('d2')
    expect(idleKindOf('1d7')).toBe('d20')
    expect(idleKindOf('1d100')).toBe('d100')
  })

  it('só é rolagem livre quando o contexto diz e há dados', () => {
    expect(isFreeRoll(roll([sum(6, [3, 4])], freeContext('Zé')))).toBe(true)
    expect(isFreeRoll(roll([{ type: 'modifier', value: 2 }], freeContext('')))).toBe(false)
    expect(isFreeRoll(roll([sum(6, [3, 4])], { system: 'dnd5e', kind: 'damage', key: 'free' }))).toBe(false)
    expect(isFreeRoll(roll([sum(6, [3, 4])], null))).toBe(false)
    expect(freeContext('').character).toBeUndefined()
  })

  it('lê os grupos, o maior ou menor de vários, o bônus e o total', () => {
    const r = readFree([sum(6, [3, 4]), { type: 'keep_highest', notation: '2#d20', quantity: 2, sides: 20, results: [14, 9], kept: 14, subtotal: 14 }, { type: 'modifier', value: 2 }], 27)
    expect(r.groups[0]).toMatchObject({ sides: 6, results: [3, 4], subtotal: 7, notation: '2d6' })
    expect(r.groups[1]).toMatchObject({ sides: 20, subtotal: 14, keep: 'highest', notation: '2#d20' })
    expect(r.modifier).toBe(2)
    expect(r.total).toBe(27)
    expect(resultsText(r.groups[0])).toBe('3 + 4')
    expect(resultsText(r.groups[1])).toBe('14, 9')
    expect(resultsText({ sides: 6, results: Array.from({ length: 20 }, (_, i) => i + 1), subtotal: 210, notation: '20d6' })).toMatch(/…$/)
  })
})
