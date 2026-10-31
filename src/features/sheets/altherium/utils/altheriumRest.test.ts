import { describe, expect, it } from 'vitest'
import { rest, eatRation, type RestInput } from './altheriumRest'
import { NEW_SURVIVAL } from './altheriumSurvival'

const pair = (cur: number, m: number) => ({ current: cur, max: m })
const base = (over: Partial<RestInput> = {}): RestInput => ({
  kind: 'longo', raiz: 'berserker', genesis: '', espirito: 4, destino: 2, runico: 0,
  vitality: pair(10, 40), equilibrio: pair(5, 15), fv: pair(4, 24), pr: pair(0, 0), cards: null,
  survival: { ...NEW_SURVIVAL, tokens: 1 }, hasRation: true, goodMeal: false, badConditions: false, interrupted: false, coma: false,
  ...over,
})
const fixed = (n: number) => () => n

describe('Descanso Longo', () => {
  it('com Ração: tudo cheio, 4 Fichas, 1d4 + Destino, tira 1 de Fome', () => {
    const r = rest(base({ survival: { ...NEW_SURVIVAL, tokens: 0, hunger: 2 } }), fixed(3))
    expect(r).toMatchObject({ benefit: 'longo', vitality: 40, fv: 24, consumesRation: true, equilibrio: 10 })
    expect(r.survival).toMatchObject({ tokens: 4, hunger: 1, short_rests: 0 })
    expect(r.clearConditions).toContain('incapacitado')
  })
  it('sem Ração: benefícios de Curto, triunfos cheios, 2 Fichas e +1 de Fome', () => {
    const r = rest(base({ hasRation: false }), fixed(5))
    expect(r.benefit).toBe('curto')
    expect(r.consumesRation).toBe(false)
    expect(r.vitality).toBe(10 + 5 + 4)
    expect(r.fv).toBe(24)
    expect(r.equilibrio).toBe(5)
    expect(r.survival).toMatchObject({ tokens: 3, hunger: 1, short_rests: 0 })
  })
  it('boa refeição conta como Ração (e não gasta Ração)', () => {
    const r = rest(base({ hasRation: false, goodMeal: true }), fixed(1))
    expect(r.benefit).toBe('longo')
    expect(r.consumesRation).toBe(false)
  })
  it('condições ruins: só o Curto, mesmo com comida, e a Ração é gasta', () => {
    const r = rest(base({ badConditions: true }), fixed(2))
    expect(r.benefit).toBe('curto')
    expect(r.consumesRation).toBe(true)
    expect(r.survival.hunger).toBe(0)
  })
  it('mais de 3 níveis de Fome avisa a morte', () => {
    const r = rest(base({ hasRation: false, survival: { ...NEW_SURVIVAL, hunger: 3 } }), fixed(1))
    expect(r.survival.hunger).toBe(4)
    expect(r.warnings.length).toBe(1)
  })
})

describe('Descanso Curto', () => {
  it('1d8 + Espírito, metade da FV, 2 Fichas, nada de Equilíbrio', () => {
    const r = rest(base({ kind: 'curto', hasRation: false }), fixed(6))
    expect(r.vitality).toBe(10 + 6 + 4)
    expect(r.fv).toBe(4 + 12)
    expect(r.equilibrio).toBe(5)
    expect(r.survival).toMatchObject({ tokens: 3, short_rests: 1, hunger: 0 })
  })
  it('no máximo 2 entre dois Longos', () => {
    const r = rest(base({ kind: 'curto', survival: { ...NEW_SURVIVAL, short_rests: 2 } }), fixed(1))
    expect(r.allowed).toBe(false)
  })
  it('Peregrino soma 1d10 em tudo', () => {
    const r = rest(base({ kind: 'curto', genesis: 'peregrino' }), fixed(4))
    expect(r.vitality).toBe(10 + 4 + 4 + 4)
    expect(r.equilibrio).toBe(5 + 4)
    expect(r.fv).toBe(4 + 12 + 4)
  })
  it('Runaskin usa 1d8 + Rúnico e Pilar recupera cartas', () => {
    const rk = rest(base({ kind: 'curto', raiz: 'runaskin', runico: 2, pr: pair(0, 20) }), fixed(3))
    expect(rk.pr).toBe(5)
    const pl = rest(base({ kind: 'curto', raiz: 'pilar', cards: pair(10, 26) }), fixed(5))
    expect(pl.cards).toBe(15)
  })
})

describe('interrupção, coma, comer', () => {
  it('interrompido: nada muda e a Ração não se perde', () => {
    const r = rest(base({ interrupted: true }), fixed(5))
    expect(r.benefit).toBe('nenhum')
    expect(r.consumesRation).toBe(false)
    expect(r.vitality).toBe(10)
  })
  it('em coma não descansa', () => {
    expect(rest(base({ coma: true }), fixed(1)).allowed).toBe(false)
  })
  it('comer uma Ração tira 1 nível de Fome', () => {
    expect(eatRation({ ...NEW_SURVIVAL, hunger: 3 }).hunger).toBe(2)
    expect(eatRation(NEW_SURVIVAL).hunger).toBe(0)
  })
})
