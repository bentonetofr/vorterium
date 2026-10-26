import { describe, expect, it } from 'vitest'
import type { RollBreakdownItem } from '../../../shared/types'
import { D3_NOTE, groupsNote, rollNote } from './rollNotes'
import { fullRollKind } from './critical'

const sum = (sides: number, results: number[]): RollBreakdownItem => ({ type: 'sum', notation: `${results.length}d${sides}`, quantity: results.length, sides, results, subtotal: results.reduce((a, b) => a + b, 0) })

describe('observação do 1d3', () => {
  it('um d3 sozinho (com ou sem modificador) leva a observação; o resto não', () => {
    expect(rollNote({ roll_breakdown: [sum(3, [2])] })).toBe(D3_NOTE)
    expect(rollNote({ roll_breakdown: [sum(3, [1]), { type: 'modifier', value: 4 }] })).toBe(D3_NOTE)
    expect(rollNote({ roll_breakdown: [sum(3, [1, 2])] })).toBeNull()
    expect(rollNote({ roll_breakdown: [sum(3, [1]), sum(6, [4])] })).toBeNull()
    expect(rollNote({ roll_breakdown: [sum(6, [4])] })).toBeNull()
    expect(rollNote({ roll_breakdown: null })).toBeNull()
    expect(groupsNote([{ sides: 3, results: [2] }])).toBe(D3_NOTE)
    expect(groupsNote([{ sides: 2, results: [2] }])).toBeNull()
  })

  it('moeda (d2) e d3 não viram crítico nem falha crítica', () => {
    expect(fullRollKind({ roll_breakdown: [sum(2, [2])] })).toBeNull()
    expect(fullRollKind({ roll_breakdown: [sum(3, [1])] })).toBeNull()
    expect(fullRollKind({ roll_breakdown: [sum(4, [4])] })).toBe('critical')
  })
})
