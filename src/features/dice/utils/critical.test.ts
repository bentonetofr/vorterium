import { describe, expect, it } from 'vitest'
import type { RollBreakdownItem } from '../../../shared/types'
import { fullRollKind, wolfKind } from './critical'
import { isRollBusy, markRollBusy, whenRollIdle } from '../../sheets/dnd/rolls/rollActivity'

const sum = (sides: number, results: number[]): RollBreakdownItem => ({ type: 'sum', notation: `${results.length}d${sides}`, sides, results, subtotal: results.reduce((a, b) => a + b, 0) }) as RollBreakdownItem
const keep = (type: 'keep_highest' | 'keep_lowest', sides: number, results: number[], kept: number): RollBreakdownItem =>
  ({ type, notation: `${results.length}#d${sides}`, sides, results, kept, subtotal: kept }) as RollBreakdownItem

describe('lobos do Altherium', () => {
  it('teste de Altherium: 10 natural no dado que valeu é o lobo branco, mesmo com outros dados', () => {
    const roll = {
      roll_context: { system: 'altherium', kind: 'skill', natural: 10 },
      roll_breakdown: [keep('keep_highest', 10, [10, 3, 7], 10)],
    }
    expect(fullRollKind(roll)).toBeNull()     // a regra antiga (todos no máximo) não pegava
    expect(wolfKind(roll)).toBe('critical')
  })

  it('teste de Altherium: 1 natural no dado que valeu é o lobo preto', () => {
    expect(wolfKind({ roll_context: { system: 'altherium', kind: 'skill', natural: 1 }, roll_breakdown: [keep('keep_lowest', 10, [1, 8], 1)] })).toBe('fumble')
  })

  it('teste de Altherium sem 10 nem 1 no dado que valeu: sem lobo', () => {
    expect(wolfKind({ roll_context: { system: 'altherium', kind: 'skill', natural: 7 }, roll_breakdown: [keep('keep_highest', 10, [7, 7], 7)] })).toBeNull()
  })

  it('as outras rolagens seguem a regra de todos os dados no máximo ou todos em 1', () => {
    expect(wolfKind({ roll_context: { system: 'altherium', kind: 'custom' }, roll_breakdown: [sum(20, [20])] })).toBe('critical')
    expect(wolfKind({ roll_context: null, roll_breakdown: [sum(6, [1, 1])] })).toBe('fumble')
    expect(wolfKind({ roll_context: null, roll_breakdown: [sum(6, [1, 5])] })).toBeNull()
    // d2 e d3 nunca disparam o lobo
    expect(wolfKind({ roll_context: null, roll_breakdown: [sum(3, [3])] })).toBeNull()
  })
})

describe('esperar a própria rolagem terminar', () => {
  it('sem rolagem em andamento, chama na hora', () => {
    let n = 0
    whenRollIdle(() => { n++ })
    expect(n).toBe(1)
    expect(isRollBusy()).toBe(false)
  })

  it('com rolagem em andamento, espera ela terminar (e dá para cancelar)', () => {
    let n = 0, m = 0
    const release = markRollBusy()
    expect(isRollBusy()).toBe(true)
    whenRollIdle(() => { n++ })
    const cancel = whenRollIdle(() => { m++ })
    cancel()
    expect(n).toBe(0)
    release()
    expect(n).toBe(1)
    expect(m).toBe(0)
    expect(isRollBusy()).toBe(false)
  })
})
