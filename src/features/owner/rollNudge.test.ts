import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ deletes: [] as Record<string, string>[] }))
vi.mock('../../shared/lib/supabase', () => ({
  uniqueChannel: (b: string) => b,
  supabase: {
    from: () => ({
      delete: () => {
        const filters: Record<string, string> = {}
        const q: Record<string, unknown> = {}
        q.eq = (k: string, v: string) => { filters[k] = v; return q }
        q.then = (res: (v: unknown) => unknown) => { calls.deletes.push(filters); return res({ error: null }) }
        return q
      },
    }),
  },
}))
vi.mock('../activity/services/activityService', () => ({ logActivity: () => {} }))

import { parseDiceFormula, rollEvensPool, rollParsedFormula } from '../dice/services/diceService'
import { resetOwnerTools, setOwnerTools } from './ownerTools'
import { resetNudges, type Nudge } from './rollNudge'

const nudge = (over: Partial<Nudge> = {}): Nudge => ({ campaign_id: 'c1', target_user_id: 'u1', mode: 'max', fixed: 20, d20_only: false, ...over })
const tick = () => new Promise<void>((r) => setTimeout(r, 0))

beforeEach(() => { resetOwnerTools(); resetNudges(); calls.deletes = [] })

describe('ajuste do próximo dado (lado do jogador)', () => {
  it('sem ajuste, o sorteio é normal', () => {
    const r = rollParsedFormula(parseDiceFormula('1d20'))
    expect(r.total).toBeGreaterThanOrEqual(1)
    expect(r.forced).toBeUndefined()
  })

  it('máximo: a próxima rolagem inteira cai no maior número, marcada como forçada, e só ela', async () => {
    resetNudges([nudge()], 'c1')
    const a = rollParsedFormula(parseDiceFormula('2d6+3'))
    expect(a.total).toBe(15)
    expect(a.forced).toBe(true)
    await tick()
    // gasto: a linha foi apagada e a rolagem seguinte é normal
    expect(calls.deletes).toEqual([{ campaign_id: 'c1', target_user_id: 'u1' }])
    const b = rollParsedFormula(parseDiceFormula('1d20'))
    expect(b.forced).toBeUndefined()
  })

  it('mínimo e número fixo', async () => {
    resetNudges([nudge({ mode: 'min' })], 'c1')
    expect(rollParsedFormula(parseDiceFormula('3d8'), { floor: false }).total).toBe(3)
    await tick()
    resetNudges([nudge({ mode: 'fixed', fixed: 13 })], 'c1')
    expect(rollParsedFormula(parseDiceFormula('1d20')).total).toBe(13)
  })

  it('só vale na campanha do ajuste', () => {
    resetNudges([nudge()], 'outra')
    expect(rollParsedFormula(parseDiceFormula('1d20')).forced).toBeUndefined()
    resetNudges([nudge()], null)
    expect(rollParsedFormula(parseDiceFormula('1d20')).forced).toBeUndefined()
  })

  it('só nos d20: o dano não gasta o ajuste, o d20 gasta', async () => {
    resetNudges([nudge({ d20_only: true })], 'c1')
    expect(rollParsedFormula(parseDiceFormula('2d6')).forced).toBeUndefined()
    await tick()
    expect(calls.deletes).toEqual([])
    expect(rollParsedFormula(parseDiceFormula('1d20')).total).toBe(20)
    await tick()
    expect(calls.deletes).toHaveLength(1)
  })

  it('o modo próprio do dono continua mandando (e não gasta ajuste nenhum)', async () => {
    resetNudges([nudge({ mode: 'min' })], 'c1')
    setOwnerTools({ armed: true, dice: 'max' })
    expect(rollParsedFormula(parseDiceFormula('1d20')).total).toBe(20)
    await tick()
    expect(calls.deletes).toEqual([])
  })

  it('teste de pares: o dado extra do 6 nunca vira 6 (o sorteio acaba)', () => {
    resetNudges([nudge()], 'c1')
    const pool = rollEvensPool(2)
    expect(pool.forced).toBe(true)
    expect(pool.results).toEqual([6, 6])
    expect(pool.bonus).toEqual([4, 4])        // um extra pra cada 6, e nenhum deles é 6
  })
})
