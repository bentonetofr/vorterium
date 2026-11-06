import { describe, expect, it } from 'vitest'
import type { DiceRoll } from '../../../../shared/types'
import { miniRoll } from './miniRoll'

const roll = (over: Record<string, unknown>) => ({ id: 'r1', user_id: 'u2', result: 0, formula: null, is_private: false, roll_label: null, roll_context: null, roll_breakdown: [], ...over }) as unknown as DiceRoll

describe('rolagem dos outros resumida', () => {
  it('um teste com CD conhecida mostra o d20, o bônus, a CD e o resultado', () => {
    const m = miniRoll(roll({
      result: 19, roll_label: 'Furtividade',
      roll_context: { kind: 'skill', natural: 14, dc: 15, outcome: 'success', character: 'Gutris' },
      roll_breakdown: [{ type: 'sum', notation: '1d20', sides: 20, results: [14], subtotal: 14 }, { type: 'modifier', value: 5 }],
    }), 'Ana')
    expect(m.who).toBe('Gutris')
    expect(m.title).toBe('Furtividade')
    expect(m.total).toBe(19)
    expect(m.detail).toBe('d20 [14] +5 · CD 15')
    expect(m.outcome).toBe('success')
    expect(m.crit).toBeNull()
  })

  it('CD escondida: não mostra a CD nem o resultado', () => {
    const m = miniRoll(roll({
      result: 8, roll_label: 'Percepção',
      roll_context: { kind: 'skill', natural: 8, dc: 12, dc_hidden: true, outcome: 'failure' },
      roll_breakdown: [{ type: 'sum', notation: '1d20', sides: 20, results: [8], subtotal: 8 }],
    }), 'Ana')
    expect(m.detail).toContain('CD escondida')
    expect(m.detail).not.toContain('12')
    expect(m.outcome).toBeNull()
  })

  it('d20 natural 20 e 1 viram crítico e falha crítica', () => {
    const hi = { roll_label: 'Ataque', roll_breakdown: [{ type: 'sum', notation: '1d20', sides: 20, results: [20], subtotal: 20 }] }
    expect(miniRoll(roll({ ...hi, result: 25, roll_context: { kind: 'attack', natural: 20 } }), 'Ana').crit).toBe('crit')
    const lo = { roll_label: 'Ataque', roll_breakdown: [{ type: 'sum', notation: '1d20', sides: 20, results: [1], subtotal: 1 }] }
    expect(miniRoll(roll({ ...lo, result: 6, roll_context: { kind: 'attack', natural: 1 } }), 'Ana').crit).toBe('fumble')
  })

  it('rolagem livre mostra a fórmula, os dados e o jogador', () => {
    const m = miniRoll(roll({
      result: 11, formula: '2d6+3', is_private: true,
      roll_context: { kind: 'custom', key: 'free' },
      roll_breakdown: [{ type: 'sum', notation: '2d6', sides: 6, results: [3, 5], subtotal: 8 }, { type: 'modifier', value: 3 }],
    }), 'Ana')
    expect(m.who).toBe('Ana')
    expect(m.title).toBe('Rolagem livre')
    expect(m.detail).toBe('2d6 [3 + 5] +3')
    expect(m.isPrivate).toBe(true)
  })

  it('maior de dois mostra qual ficou', () => {
    const m = miniRoll(roll({
      result: 14, formula: '2#d20', roll_context: { kind: 'custom', key: 'free' },
      roll_breakdown: [{ type: 'keep_highest', notation: '2#d20', sides: 20, results: [14, 9], kept: 14, subtotal: 14 }],
    }), 'Ana')
    expect(m.detail).toBe('2#d20 [14, 9] fica 14')
  })

  it('teste de Altherium: dado que valeu, DT, resultado e crítico pelo 10 natural', () => {
    const m = miniRoll(roll({
      result: 16, roll_label: 'Teste de Luta',
      roll_context: { system: 'altherium', kind: 'skill', natural: 10, dc: 12, outcome: 'success', character: 'Gutris' },
      roll_breakdown: [{ type: 'keep_highest', notation: '3#d10', sides: 10, results: [10, 3, 7], kept: 10, subtotal: 10 }, { type: 'modifier', value: 6 }],
    }), 'Ana')
    expect(m.who).toBe('Gutris')
    expect(m.title).toBe('Teste de Luta')
    expect(m.detail).toBe('3#d10 [10, 3, 7] fica 10 +6 · DT 12')
    expect(m.outcome).toBe('success')
    expect(m.crit).toBe('crit')
  })

  it('teste de Altherium com 1 natural no dado que valeu é falha crítica', () => {
    const m = miniRoll(roll({
      result: 5, roll_label: 'Teste de Furtividade',
      roll_context: { system: 'altherium', kind: 'skill', natural: 1, outcome: 'failure' },
      roll_breakdown: [{ type: 'keep_lowest', notation: '2@d10', sides: 10, results: [1, 6], kept: 1, subtotal: 1 }, { type: 'modifier', value: 4 }],
    }), 'Ana')
    expect(m.crit).toBe('fumble')
    expect(m.outcome).toBe('failure')
    expect(m.detail).not.toContain('DT')
  })

  it('dano e outras rolagens levam o rótulo da ficha', () => {
    const m = miniRoll(roll({
      result: 7, roll_label: 'Dano: espada longa', formula: '1d8+3', roll_context: { kind: 'damage' },
      roll_breakdown: [{ type: 'sum', notation: '1d8', sides: 8, results: [4], subtotal: 4 }, { type: 'modifier', value: 3 }],
    }), 'Ana')
    expect(m.title).toBe('Dano: espada longa')
    expect(m.detail).toBe('1d8 [4] +3')
  })
})
