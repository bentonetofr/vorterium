import { describe, expect, it } from 'vitest'
import {
  LOCATIONS,
  LOOT_TABLE,
  complicationFor,
  conditionDice,
  exploreOutcome,
  loseQuarter,
  makeFind,
  rollFind,
  storeFind,
  type Find,
} from './altheriumExplore'

describe('tabela de achados', () => {
  it('cada Local soma 100%', () => {
    for (const l of LOCATIONS) {
      const sum = Object.values(LOOT_TABLE[l.id]).reduce((s, n) => s + (n ?? 0), 0)
      expect(sum, l.label).toBe(100)
    }
  })

  it('o sorteio respeita os pesos (rng fixo)', () => {
    // rng 0 cai no primeiro item da tabela (Ração).
    const f = rollFind('floresta', () => 0)
    expect(f).toMatchObject({ kind: 'resource', id: 'racao', quality: 'comum' })
  })

  it('nunca sorteia o que o Local não tem', () => {
    for (let i = 0; i < 200; i++) {
      const f = rollFind('tundra', Math.random)
      if (f.kind === 'resource') expect(['ferro_velho', 'madeira', 'ervas', 'brennivin']).not.toContain(f.id)
    }
  })

  it('Hacksilver é 1d10 × 10', () => {
    expect(makeFind('hacksilver', () => 0)).toEqual({ kind: 'hacksilver', amount: 10 })
    expect(makeFind('hacksilver', () => 0.99)).toEqual({ kind: 'hacksilver', amount: 100 })
  })

  it('Ração vem em 25, 50 ou 100%', () => {
    for (let i = 0; i < 100; i++) {
      const f = makeFind('racao', Math.random)
      expect(f.kind === 'resource' && [25, 50, 100].includes(f.pct)).toBe(true)
    }
  })
})

describe('resultado da exploração', () => {
  it('falha por 5 ou mais é Complicação; falha comum, nada', () => {
    expect(exploreOutcome(1, 6, false)).toMatchObject({ tier: 'complicacao', complication: true, finds: 0 })
    expect(exploreOutcome(4, 6, false)).toMatchObject({ tier: 'nada', complication: false, finds: 0 })
  })
  it('sucesso 2, por 5 ou mais 3, crítico 3 + raro', () => {
    expect(exploreOutcome(6, 6, false).finds).toBe(2)
    expect(exploreOutcome(11, 6, false).finds).toBe(3)
    expect(exploreOutcome(3, 6, true)).toMatchObject({ finds: 3, rare: true })
  })
  it('na Fenda toda falha gera Complicação', () => {
    expect(exploreOutcome(5, 6, false, true).complication).toBe(true)
    expect(exploreOutcome(6, 6, false, true).complication).toBe(false)
  })
})

describe('condições', () => {
  it('somam e ficam em ±2; o clima conta uma vez (o pior)', () => {
    expect(conditionDice(['noite', 'chuva'])).toBe(-2)
    expect(conditionDice(['noite', 'chuva', 'tempestade'])).toBe(-2)
    expect(conditionDice(['chuva', 'tempestade'])).toBe(-2)
    expect(conditionDice(['ferramenta', 'conhece', 'narrada'])).toBe(2)
    expect(conditionDice(['noite', 'ferramenta'])).toBe(0)
  })
})

describe('guardar achados', () => {
  const empty = { stock: {}, hacksilvers: 0 }
  it('respeita o limite de 4 unidades', () => {
    const f: Find = { kind: 'resource', id: 'couro', pct: 50, quality: 'comum' }
    const full = { stock: { couro: { comum: 400 } }, hacksilvers: 0 }
    expect(storeFind(f, full)).toMatchObject({ ok: false })
    const almost = { stock: { couro: { comum: 380 } }, hacksilvers: 0 }
    const r = storeFind(f, almost)
    expect(r.ok && r.bag.stock.couro?.comum).toBe(400)
    expect(r.text).toContain('o resto não coube')
  })
  it('Faro do Lobo põe +25% na Ração e Cofre Cheio dobra o ¤', () => {
    const r = storeFind({ kind: 'resource', id: 'racao', pct: 25, quality: 'comum' }, empty, { faro: true })
    expect(r.ok && r.bag.stock.racao?.comum).toBe(50)
    const h = storeFind({ kind: 'hacksilver', amount: 40 }, empty, { cofre: true })
    expect(h.ok && h.bag.hacksilvers).toBe(80)
  })
  it('material lendário entra como lendário', () => {
    const r = storeFind({ kind: 'raro', rare: 'lendario', resource: 'osso' }, empty)
    expect(r.ok && r.bag.stock.osso?.lendario).toBe(100)
  })
})

describe('complicações', () => {
  it('1d6: 1-2 encontro, 3 armadilha, 4 ferimento, 5 barulho, 6 perda', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => complicationFor(n).id)).toEqual(['encontro', 'encontro', 'armadilha', 'ferimento', 'barulho', 'perda'])
  })
  it('perde 25% de algo que tenha', () => {
    const r = loseQuarter({ couro: { comum: 50 } }, () => 0)
    expect(r.stock.couro?.comum).toBe(25)
    expect(loseQuarter({}, () => 0).text).toContain('nada')
    expect(loseQuarter({ fibra: { comum: 25 } }, () => 0).stock.fibra).toBeUndefined()
  })
})
