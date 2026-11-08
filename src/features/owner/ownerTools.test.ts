import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../shared/lib/supabase', () => ({ supabase: {}, uniqueChannel: (b: string) => b }))
vi.mock('../activity/services/activityService', () => ({ logActivity: () => {} }))

import { parseDiceFormula, rollEvensPool, rollParsedFormula } from '../dice/services/diceService'
import { diceForced, forcedDie, getOwnerTools, resetOwnerTools, setOwnerTools } from './ownerTools'

beforeEach(() => resetOwnerTools())

describe('ferramentas do dono: dados', () => {
  it('desarmado (outra conta ou campanha que não é dele), nada muda, mesmo com o modo ligado', () => {
    setOwnerTools({ armed: false, dice: 'max' })
    expect(forcedDie(1, 20)).toBeNull()
    expect(diceForced(getOwnerTools())).toBe(false)
    const r = rollParsedFormula(parseDiceFormula('1d20'))
    expect(r.total).toBeGreaterThanOrEqual(1)
  })

  it('máximo: todo dado cai no maior número (crítico no d20, dano máximo)', () => {
    setOwnerTools({ armed: true, dice: 'max' })
    expect(rollParsedFormula(parseDiceFormula('1d20+5')).total).toBe(25)
    expect(rollParsedFormula(parseDiceFormula('2d6+3')).total).toBe(15)
    expect(rollParsedFormula(parseDiceFormula('2#d20')).total).toBe(20)
  })

  it('mínimo: todo dado cai em 1', () => {
    setOwnerTools({ armed: true, dice: 'min' })
    expect(rollParsedFormula(parseDiceFormula('3d8'), { floor: false }).total).toBe(3)
  })

  it('número: cai o mais perto que o dado tem', () => {
    setOwnerTools({ armed: true, dice: 'fixed', fixed: 15 })
    expect(forcedDie(1, 20)).toBe(15)
    expect(forcedDie(1, 6)).toBe(6)
  })

  it('só d20: os outros dados saem no sorteio', () => {
    setOwnerTools({ armed: true, dice: 'max', d20Only: true })
    expect(forcedDie(1, 20)).toBe(20)
    expect(forcedDie(1, 8)).toBeNull()
  })

  it('teste de pares no máximo termina (os dados extras do 6 não são 6)', () => {
    setOwnerTools({ armed: true, dice: 'max' })
    const pool = rollEvensPool(3)
    expect(pool.results).toEqual([6, 6, 6])
    expect(pool.bonus).toEqual([4, 4, 4])
    expect(pool.evens).toBe(6)
  })
})
