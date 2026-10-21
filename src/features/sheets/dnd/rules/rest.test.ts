import { describe, expect, it } from 'vitest'
import {
  applyLongRest, applyShortRest, hitDiceAvailable, hitDieHealing, longRestSheet, recoverHitDice, spendHitDie,
  type Rechargeable,
} from './rest'

const item = (recharge: Rechargeable['recharge'], current: number, max: number): Rechargeable => ({ recharge, current, max })

describe('recursos nos descansos', () => {
  const items = [item('short', 0, 2), item('long', 1, 4), item('dawn', 0, 1), item('manual', 0, 3), item(null, 0, 1)]

  it('descanso curto recarrega só o que é de descanso curto', () => {
    expect(applyShortRest(items).map((i) => i.current)).toEqual([2, 1, 0, 0, 0])
  })

  it('descanso longo recarrega curto, longo e amanhecer, mas não o manual', () => {
    expect(applyLongRest(items).map((i) => i.current)).toEqual([2, 4, 1, 0, 0])
  })

  it('não muda a lista original', () => {
    applyLongRest(items)
    expect(items[1].current).toBe(1)
  })

  it('preserva outros campos do objeto', () => {
    const r = applyShortRest([{ ...item('short', 0, 1), key: 'ki' }])
    expect(r[0]).toMatchObject({ key: 'ki', current: 1 })
  })
})

describe('dados de vida', () => {
  const pool = { 8: 3, 10: 2 }

  it('conta os que sobram por tipo', () => {
    expect(hitDiceAvailable(pool, {}, 8)).toBe(3)
    expect(hitDiceAvailable(pool, { '8': 2 }, 8)).toBe(1)
    expect(hitDiceAvailable(pool, {}, 12)).toBe(0)
  })

  it('gasta um dado e recusa quando não sobra nenhum', () => {
    expect(spendHitDie(pool, {}, 8)).toEqual({ '8': 1 })
    expect(spendHitDie(pool, { '10': 2 }, 10)).toBeNull()
    expect(spendHitDie(pool, {}, 6)).toBeNull()
  })

  it('o PV recuperado é o dado mais Constituição, nunca negativo', () => {
    expect(hitDieHealing(6, 2)).toBe(8)
    expect(hitDieHealing(1, -3)).toBe(0)
  })

  it('descanso longo devolve metade do total, começando pelos maiores', () => {
    // total 5: recupera 2; os d10 voltam primeiro
    expect(recoverHitDice(pool, { '8': 3, '10': 2 })).toEqual({ '8': 3 })
    expect(recoverHitDice(pool, { '8': 3, '10': 1 })).toEqual({ '8': 2 })
  })

  it('devolve pelo menos 1 mesmo com um dado só', () => {
    expect(recoverHitDice({ 8: 1 }, { '8': 1 })).toEqual({})
  })

  it('sem nada gasto continua sem nada', () => {
    expect(recoverHitDice(pool, {})).toEqual({})
  })

  it('limpa gastos de dados que a ficha não tem mais', () => {
    expect(recoverHitDice({ 8: 2 }, { '12': 3, '8': 2 })).toEqual({ '8': 1 })
  })
})

describe('descanso longo da ficha', () => {
  const base = { hpMax: 30, hpCurrent: 8, exhaustion: 2, deathSaves: { successes: 2, failures: 1 }, hitDiceUsed: { '8': 4 }, hitDicePool: { 8: 6 } }

  it('PV ao máximo, exaustão -1, salvaguardas zeradas e dados recuperados', () => {
    expect(longRestSheet(base)).toEqual({
      hpCurrent: 30, exhaustion: 1, deathSaves: { successes: 0, failures: 0 }, hitDiceUsed: { '8': 1 },
    })
  })

  it('exaustão nunca fica negativa', () => {
    expect(longRestSheet({ ...base, exhaustion: 0 }).exhaustion).toBe(0)
  })

  it('não tira PV de quem está acima do máximo (efeitos que passam do limite)', () => {
    expect(longRestSheet({ ...base, hpCurrent: 35 }).hpCurrent).toBe(35)
  })
})
