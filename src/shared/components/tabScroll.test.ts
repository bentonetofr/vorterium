import { describe, expect, it } from 'vitest'
import { FLING_MAX, FLING_STOP, FLING_TAU, clampScroll, easeOutQuint, flingDistance, maxScroll, releaseVelocity, scrollDuration } from './tabScroll'

describe('rolagem fluida da barra de abas', () => {
  it('a desaceleração vai de 0 a 1 sem voltar e termina devagar', () => {
    expect(easeOutQuint(0)).toBe(0)
    expect(easeOutQuint(1)).toBe(1)
    let prev = 0
    for (let i = 1; i <= 20; i++) {
      const v = easeOutQuint(i / 20)
      expect(v).toBeGreaterThan(prev)
      prev = v
    }
    // sai rápido e chega devagar: na metade do tempo já andou mais de 95%
    expect(easeOutQuint(0.5)).toBeGreaterThan(0.95)
    // fora de 0..1 não passa dos limites
    expect(easeOutQuint(-3)).toBe(0)
    expect(easeOutQuint(7)).toBe(1)
  })

  it('a duração cresce com a distância, entre 260 e 620 ms', () => {
    expect(scrollDuration(0)).toBe(260)
    expect(scrollDuration(100)).toBe(310)
    expect(scrollDuration(-100)).toBe(310)
    expect(scrollDuration(5000)).toBe(620)
  })

  it('o limite da rolagem nunca é negativo e o valor é preso entre 0 e o máximo', () => {
    expect(maxScroll({ scrollWidth: 1278, clientWidth: 790 })).toBe(488)
    expect(maxScroll({ scrollWidth: 500, clientWidth: 800 })).toBe(0)
    expect(clampScroll(-40, 488)).toBe(0)
    expect(clampScroll(900, 488)).toBe(488)
    expect(clampScroll(120, 488)).toBe(120)
  })

  it('a velocidade ao soltar vem das últimas amostras e a barra anda ao contrário do ponteiro', () => {
    const samples = [{ t: 0, x: 500 }, { t: 30, x: 440 }, { t: 60, x: 380 }, { t: 90, x: 320 }]
    // o ponteiro foi 180 px pra esquerda em 90 ms: a barra anda pra direita (positivo) a 2 px/ms
    expect(releaseVelocity(samples, 90)).toBeCloseTo(2)
    expect(releaseVelocity(samples.map((s) => ({ ...s, x: 1000 - s.x })), 90)).toBeCloseTo(-2)
  })

  it('amostra velha ou só uma amostra não dá inércia, e um arrasto brusco é limitado', () => {
    expect(releaseVelocity([{ t: 0, x: 0 }], 10)).toBe(0)
    // o ponteiro parou antes de soltar: as amostras antigas saem da conta
    expect(releaseVelocity([{ t: 0, x: 500 }, { t: 30, x: 300 }], 400)).toBe(0)
    expect(releaseVelocity([{ t: 0, x: 900 }, { t: 5, x: 0 }], 5)).toBe(FLING_MAX)
    expect(releaseVelocity([{ t: 0, x: 0 }, { t: 5, x: 900 }], 5)).toBe(-FLING_MAX)
  })

  it('a inércia anda velocidade × tau e termina abaixo do limite mínimo', () => {
    expect(flingDistance(1)).toBe(FLING_TAU)
    expect(flingDistance(-2)).toBe(-2 * FLING_TAU)
    expect(FLING_STOP).toBeLessThan(0.05)
  })
})
