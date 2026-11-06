import { describe, expect, it } from 'vitest'
import { DOMAINS_SHOWN, countDomainUse, pickShownDomains } from './altheriumDomainUse'

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n']

describe('domínios mostrados por padrão', () => {
  it('sem pontos nem rolagens: os 10 primeiros da lista', () => {
    const shown = pickShownDomains({ ids: IDS, points: new Map(), usage: {} })
    expect([...shown]).toEqual(IDS.slice(0, DOMAINS_SHOWN))
  })

  it('os domínios com pontos entram sempre, e as outras vagas vão para os mais rolados', () => {
    const points = new Map([['m', 2], ['n', 1]])
    const usage = { k: 9, l: 5, j: 1 }
    const shown = pickShownDomains({ ids: IDS, points, usage })
    expect(shown.size).toBe(DOMAINS_SHOWN)
    expect(shown.has('m') && shown.has('n')).toBe(true)
    // k e l (mais rolados) e j entram antes dos nunca rolados
    expect(shown.has('k') && shown.has('l') && shown.has('j')).toBe(true)
    // as 5 vagas que sobram completam pela ordem da lista: a, b, c, d e e (o f já fica de fora)
    expect(['a', 'b', 'c', 'd', 'e'].every((id) => shown.has(id))).toBe(true)
    expect(shown.has('f')).toBe(false)
  })

  it('mais rolado ganha de mais antigo na lista; empate segue a ordem', () => {
    const shown = pickShownDomains({ ids: IDS, points: new Map(), usage: { n: 3, m: 3 }, limit: 3 })
    expect([...shown].sort()).toEqual(['a', 'm', 'n'])
  })

  it('com mais de 10 domínios com pontos, mostra todos eles', () => {
    const points = new Map(IDS.slice(0, 12).map((id) => [id, 1] as const))
    expect(pickShownDomains({ ids: IDS, points, usage: {} }).size).toBe(12)
  })

  it('com poucos domínios na lista, mostra todos', () => {
    expect(pickShownDomains({ ids: ['a', 'b'], points: new Map(), usage: {} }).size).toBe(2)
  })
})

describe('uso dos domínios', () => {
  it('conta só os testes de Altherium, por domínio', () => {
    const ctx = (system: string, kind: string, key?: string) => ({ roll_context: { system, kind, key } })
    expect(countDomainUse([
      ctx('altherium', 'skill', 'luta'), ctx('altherium', 'skill', 'luta'), ctx('altherium', 'skill', 'tatica'),
      ctx('altherium', 'custom', 'free'), ctx('dnd5e', 'skill', 'luta'), { roll_context: null }, ctx('altherium', 'skill'),
    ])).toEqual({ luta: 2, tatica: 1 })
  })
})
