import { describe, expect, it } from 'vitest'
import { QTE_TOTAL, buildSequence, gapMs, judge, keyPool, promptMs } from './qteEngine'

describe('Cena a dois: motor', () => {
  it('a mesma semente dá a mesma sequência, outra semente dá outra', () => {
    expect(buildSequence(42)).toEqual(buildSequence(42))
    expect(buildSequence(42)).not.toEqual(buildSequence(43))
    expect(buildSequence(42)).toHaveLength(QTE_TOTAL)
  })

  it('nunca repete a letra e mantém a posição dentro da arena', () => {
    for (const seed of [1, 7, 99, 12345]) {
      const seq = buildSequence(seed)
      seq.forEach((p, n) => {
        if (n > 0) expect(p.key).not.toBe(seq[n - 1].key)
        expect(p.x).toBeGreaterThanOrEqual(0.1)
        expect(p.x).toBeLessThanOrEqual(0.9)
        expect(p.y).toBeGreaterThanOrEqual(0.14)
        expect(p.y).toBeLessThanOrEqual(0.86)
        expect(keyPool(p.i)).toContain(p.key)
      })
    }
  })

  it('o tempo só encurta ao longo da partida', () => {
    for (const impulso of [0, 5, 10]) {
      for (let i = 1; i < QTE_TOTAL; i++) {
        expect(promptMs(i, impulso)).toBeLessThanOrEqual(promptMs(i - 1, impulso))
      }
    }
  })

  it('mais Impulso dá mais tempo em toda letra', () => {
    for (let i = 0; i < QTE_TOTAL; i++) {
      for (let imp = 1; imp <= 10; imp++) {
        expect(promptMs(i, imp)).toBeGreaterThan(promptMs(i, imp - 1))
      }
    }
  })

  it('só com Impulso 10 fica folgado; o resto é apertado', () => {
    expect(promptMs(QTE_TOTAL - 1, 10)).toBeGreaterThanOrEqual(850)
    expect(promptMs(QTE_TOTAL - 1, 5)).toBeLessThan(750)
    expect(promptMs(QTE_TOTAL - 1, 0)).toBeLessThan(500)
  })

  it('a pausa entre letras encurta mas tem piso', () => {
    expect(gapMs(0)).toBeGreaterThan(gapMs(20))
    expect(gapMs(200)).toBe(220)
  })

  it('quem termina vence quem caiu; empate quando igual', () => {
    expect(judge([{ uid: 'a', result: 'cleared', hits: 30, lives: 1 }, { uid: 'b', result: 'lost', hits: 25, lives: 0 }]).winner).toBe('a')
    expect(judge([{ uid: 'a', result: 'lost', hits: 12, lives: 0 }, { uid: 'b', result: 'lost', hits: 18, lives: 0 }]).winner).toBe('b')
    expect(judge([{ uid: 'a', result: 'lost', hits: 10, lives: 0 }, { uid: 'b', result: 'lost', hits: 10, lives: 0 }])).toEqual({ winner: null, tie: true })
    expect(judge([{ uid: 'a', result: 'cleared', hits: 30, lives: 3 }]).winner).toBe('a')
    expect(judge([{ uid: 'a', result: 'lost', hits: 3, lives: 0 }]).winner).toBeNull()
  })
})
