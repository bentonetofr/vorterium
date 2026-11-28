import { describe, expect, it } from 'vitest'
import {
  COUNTERS_PER_OWNER, COUNTER_MAX_VALUE, COUNTER_NAME_MAX, cloneCounters, clampValue, counterSummary, newCounter, normalizeCardCounters, normalizeCounters,
  resetCounters, setCounterMax, setCounterValue,
} from './counters'
import { emptySheet, normalizeSheet } from './defaults'
import { duplicateGm, emptyAdversary, emptyEnvironment, nextCopyName, normalizeAdversary, normalizeEnvironment } from './gm'

describe('marcadores: valor e limite', () => {
  it('o valor fica entre 0 e o limite (ou 99, sem limite)', () => {
    expect(clampValue(-4, 0)).toBe(0)
    expect(clampValue(250, 0)).toBe(COUNTER_MAX_VALUE)
    expect(clampValue(9, 3)).toBe(3)
    expect(clampValue(2.6, 5)).toBe(3)
    expect(clampValue(Number.NaN, 5)).toBe(0)
    const c = { ...newCounter('Cargas', 3), value: 1 }
    expect(setCounterValue(c, 7).value).toBe(3)
    expect(setCounterValue(c, -2).value).toBe(0)
  })

  it('baixar o limite puxa o valor para dentro; limite 0 tira o limite', () => {
    const c = { ...newCounter('Cargas', 5), value: 5 }
    expect(setCounterMax(c, 2)).toMatchObject({ max: 2, value: 2 })
    expect(setCounterMax(c, 0)).toMatchObject({ max: 0, value: 5 })
    expect(setCounterMax(c, 500).max).toBe(COUNTER_MAX_VALUE)
    expect(setCounterMax(c, -3).max).toBe(0)
  })

  it('um marcador novo começa em zero, com o nome cortado no tamanho máximo', () => {
    const c = newCounter('x'.repeat(200))
    expect(c.value).toBe(0)
    expect(c.name).toHaveLength(COUNTER_NAME_MAX)
    expect(c.id).toBeTruthy()
  })
})

describe('marcadores: ler o que veio do banco', () => {
  it('aceita lixo sem quebrar: descarta o que não é marcador e arruma o resto', () => {
    expect(normalizeCounters(undefined)).toEqual([])
    expect(normalizeCounters('oi')).toEqual([])
    expect(normalizeCounters([null, 3, { value: 2 }, { name: 4 }])).toEqual([])
    const list = normalizeCounters([{ id: 'a', name: 'Veneno', value: 500, max: 3 }, { id: 'a', name: 'Marca', value: -2 }, { name: 'Sem id', value: 1.4 }])
    expect(list).toHaveLength(3)
    expect(list[0]).toMatchObject({ name: 'Veneno', value: 3, max: 3 })
    expect(list[1].value).toBe(0)
    expect(new Set(list.map((c) => c.id)).size).toBe(3)   // ids repetidos ganham um novo
    expect(list[2].id).toBeTruthy()
  })

  it('guarda no máximo 16 marcadores por dono', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `i${i}`, name: `M${i}`, value: 1, max: 0 }))
    expect(normalizeCounters(many)).toHaveLength(COUNTERS_PER_OWNER)
  })

  it('marcadores das cartas: só guarda carta que tem marcador e ignora chave estranha', () => {
    expect(normalizeCardCounters(null)).toEqual({})
    expect(normalizeCardCounters([1, 2])).toEqual({})
    const out = normalizeCardCounters({ 'rune-ward': [{ id: 'a', name: 'Cargas', value: 2, max: 0 }], 'unleash-chaos': [], '': [{ name: 'x', value: 1 }], [`${'k'.repeat(80)}`]: [{ name: 'y', value: 1 }] })
    expect(Object.keys(out)).toEqual(['rune-ward'])
    expect(out['rune-ward'][0].value).toBe(2)
  })

  it('resumo de uma linha: só o que tem valor, com o limite quando há', () => {
    const list = [{ ...newCounter('Veneno'), value: 2 }, { ...newCounter('Cargas', 3), value: 1 }, newCounter('Marca'), { ...newCounter(''), value: 4 }]
    expect(counterSummary(list)).toBe('Veneno 2 · Cargas 1/3')
    expect(counterSummary([])).toBe('')
  })

  it('zerar e clonar: nomes e limites ficam, ids mudam', () => {
    const list = [{ ...newCounter('Veneno'), value: 2 }, { ...newCounter('Cargas', 3), value: 3 }]
    expect(resetCounters(list).map((c) => c.value)).toEqual([0, 0])
    const copy = cloneCounters(list, true)
    expect(copy.map((c) => c.name)).toEqual(['Veneno', 'Cargas'])
    expect(copy[1].max).toBe(3)
    expect(copy.map((c) => c.value)).toEqual([0, 0])
    expect(copy[0].id).not.toBe(list[0].id)
    expect(cloneCounters(list)[0].value).toBe(2)
  })
})

describe('marcadores na ficha do personagem', () => {
  it('ficha nova não tem marcadores e uma ficha antiga (sem o campo) abre normalmente', () => {
    const s = emptySheet('feiticeiro')
    expect(s.counters).toEqual([])
    expect(s.cardCounters).toEqual({})
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>
    delete old.counters
    delete old.cardCounters
    const back = normalizeSheet(old)
    expect(back.counters).toEqual([])
    expect(back.cardCounters).toEqual({})
  })

  it('os marcadores do personagem e das cartas sobrevivem a salvar e abrir', () => {
    const s = { ...emptySheet('feiticeiro'), counters: [{ id: 'a', name: 'Munição', value: 3, max: 0 }], cardCounters: { 'rune-ward': [{ id: 'b', name: 'Cargas', value: 1, max: 3 }] } }
    const back = normalizeSheet(JSON.parse(JSON.stringify(s)))
    expect(back.counters).toEqual(s.counters)
    expect(back.cardCounters).toEqual(s.cardCounters)
  })
})

describe('adversários e ambientes: marcadores e cópia', () => {
  it('têm marcadores (vazios por padrão) e leem fichas antigas sem o campo', () => {
    expect(emptyAdversary().counters).toEqual([])
    expect(emptyEnvironment().counters).toEqual([])
    expect(normalizeAdversary({ name: 'Lobo' }).counters).toEqual([])
    expect(normalizeEnvironment({ name: 'Cidade' }).counters).toEqual([])
    const a = normalizeAdversary({ name: 'Lobo', counters: [{ id: 'x', name: 'Veneno', value: 2 }] })
    expect(a.counters[0]).toMatchObject({ name: 'Veneno', value: 2 })
  })

  it('nome da cópia: "Goblin (2)", depois "(3)", e nunca repete um nome que já existe', () => {
    expect(nextCopyName('Goblin', ['Goblin'])).toBe('Goblin (2)')
    expect(nextCopyName('Goblin', ['Goblin', 'Goblin (2)'])).toBe('Goblin (3)')
    expect(nextCopyName('Goblin (2)', ['Goblin', 'Goblin (2)'])).toBe('Goblin (3)')   // copiar uma cópia
    expect(nextCopyName('Goblin', ['Goblin', 'Goblin (3)'])).toBe('Goblin (2)')       // aproveita o buraco
    expect(nextCopyName('  ', [])).toBe('Cópia (2)')
    expect(nextCopyName('x'.repeat(200), []).length).toBeLessThanOrEqual(120)
  })

  it('a cópia de um adversário nasce inteira: Vida e Fadiga sem marcas, marcadores zerados, ids novos', () => {
    const a = {
      ...emptyAdversary(), name: 'Lobo Sombrio', hp: 6, hpMarked: 4, stressMarked: 2, difficulty: 13, damage: '2d8+3',
      counters: [{ ...newCounter('Veneno'), value: 2 }, { ...newCounter('Cargas', 3), value: 1 }],
      experiences: [{ id: 'e1', name: 'Caçador', mod: 2 }],
      features: [{ id: 'f1', name: 'Mordida', kind: 'acao' as const, fearCost: 1, text: 'Morde.', questions: '' }],
    }
    const c = duplicateGm(a, 'Lobo Sombrio (2)')
    expect(c.name).toBe('Lobo Sombrio (2)')
    expect(c).toMatchObject({ hp: 6, hpMarked: 0, stressMarked: 0, difficulty: 13, damage: '2d8+3' })
    expect(c.counters.map((x) => `${x.name}:${x.value}/${x.max}`)).toEqual(['Veneno:0/0', 'Cargas:0/3'])
    expect(c.counters[0].id).not.toBe(a.counters[0].id)
    expect(c.features[0]).toMatchObject({ name: 'Mordida', fearCost: 1 })
    expect(c.features[0].id).not.toBe('f1')
    expect(c.experiences[0].id).not.toBe('e1')
    expect(c.experiences[0].name).toBe('Caçador')
    // a original não muda
    expect(a.hpMarked).toBe(4)
    expect(a.counters[0].value).toBe(2)
    expect(a.features[0].id).toBe('f1')
  })

  it('a cópia de um ambiente também zera os marcadores', () => {
    const e = { ...emptyEnvironment(), name: 'Cidade', counters: [{ ...newCounter('Contagem'), value: 3 }] }
    const c = duplicateGm(e, 'Cidade (2)')
    expect(c.counters[0].value).toBe(0)
    expect(c.name).toBe('Cidade (2)')
    expect('hp' in c).toBe(false)
  })
})
