import { describe, expect, it } from 'vitest'
import { hitRecipe, type DiceVoice } from './sound'
import { COLLECTION_SKINS } from './skins'

const fixed = (v: number) => () => v

describe('receita do som de dado na madeira', () => {
  it('o toc de madeira tem parciais não harmônicos que caem de volume e de duração', () => {
    const r = hitRecipe(0.6, false, fixed(0.5))
    expect(r.wood).toHaveLength(4)
    const freqs = r.wood.map((p) => p.freq)
    expect(freqs).toEqual([...freqs].sort((a, b) => a - b))
    expect(Math.abs(freqs[1] / freqs[0] - 2)).toBeGreaterThan(0.15)   // não é 2× (não é harmônico)
    expect(r.wood[0].gain).toBeGreaterThan(r.wood[3].gain)
    expect(r.wood[0].decay).toBeGreaterThan(r.wood[3].decay)
    expect(freqs[0]).toBeGreaterThan(120)
    expect(freqs[0]).toBeLessThan(320)                                 // grave de mesa, não agudo de sino
  })

  it('no chão manda o toc; dado com dado manda o estalo da resina', () => {
    const floor = hitRecipe(0.7, false, fixed(0.5))
    const dice = hitRecipe(0.7, true, fixed(0.5))
    expect(floor.wood[0].gain).toBeGreaterThan(dice.wood[0].gain)
    expect(dice.resin[0].gain).toBeGreaterThan(floor.resin[0].gain)
    expect(dice.wood[0].freq).toBeGreaterThan(floor.wood[0].freq)      // dado com dado é mais seco
    for (const p of [...floor.resin, ...dice.resin]) expect(p.freq).toBeGreaterThan(1800)
  })

  it('batida mais forte: mais volume, mais brilho e mais duração', () => {
    const soft = hitRecipe(0.1, false, fixed(0.5))
    const hard = hitRecipe(1, false, fixed(0.5))
    expect(hard.volume).toBeGreaterThan(soft.volume)
    expect(hard.click.cutoff).toBeGreaterThan(soft.click.cutoff)
    expect(hard.wood[0].decay).toBeGreaterThan(soft.wood[0].decay)
    expect(hard.bend).toBeGreaterThan(soft.bend)
  })

  it('cada batida varia um pouco; força fora de 0 a 1 não quebra nada', () => {
    const a = hitRecipe(0.5, false, fixed(0.1)).wood[0].freq
    const b = hitRecipe(0.5, false, fixed(0.9)).wood[0].freq
    expect(a).not.toBe(b)
    for (const s of [-3, 0, 1, 7, Number.NaN]) {
      const r = hitRecipe(s, true)
      expect(Number.isFinite(r.volume)).toBe(true)
      expect(r.volume).toBeLessThanOrEqual(1)
      for (const p of [...r.wood, ...r.resin]) { expect(Number.isFinite(p.freq)).toBe(true); expect(p.decay).toBeGreaterThan(0) }
    }
  })
})

describe('as vozes dos conjuntos da coleção', () => {
  const voices = [...new Set(COLLECTION_SKINS.map((s) => s.sound).filter((v): v is DiceVoice => !!v))]

  it('sem voz, a batida é a de sempre: nenhuma ressonância nem sopro', () => {
    const r = hitRecipe(0.6, false, fixed(0.5))
    expect(r.ring).toEqual([])
    expect(r.hiss).toBeNull()
  })

  it('cada conjunto da segunda leva tem a sua voz, e nenhuma se repete', () => {
    expect(voices).toHaveLength(14)
    expect(COLLECTION_SKINS.filter((s) => s.sound)).toHaveLength(14)
  })

  it('toda voz muda a batida (soma ressonância ou sopro) e dá números tocáveis em qualquer força', () => {
    for (const v of voices) {
      for (const s of [0, 0.3, 1]) for (const withDie of [false, true]) {
        const r = hitRecipe(s, withDie, Math.random, v)
        expect(r.ring.length + (r.hiss ? 1 : 0), v).toBeGreaterThan(0)
        for (const p of [...r.wood, ...r.resin, ...r.ring]) {
          expect(Number.isFinite(p.freq) && p.freq > 20 && p.freq < 20000, `${v} freq ${p.freq}`).toBe(true)
          expect(p.gain, v).toBeGreaterThanOrEqual(0)
          expect(p.decay, v).toBeGreaterThan(0)
          expect(p.decay + (p.delay ?? 0), v).toBeLessThan(3)
        }
        if (r.hiss) { expect(r.hiss.dur, v).toBeGreaterThan(0); expect(r.hiss.cutoff, v).toBeGreaterThan(0) }
      }
    }
  })

  it('o sino fica soando; a rolha morre na hora', () => {
    const longest = (v: DiceVoice) => Math.max(...hitRecipe(0.8, false, fixed(0.5), v).ring.map((p) => p.decay))
    expect(longest('sino')).toBeGreaterThan(0.8)
    expect(longest('cortica')).toBeLessThan(0.1)
  })

  it('o vazio quase não tem madeira nem estalo; o dragão bate mais grave que o dado comum', () => {
    const plain = hitRecipe(0.7, false, fixed(0.5))
    const vazio = hitRecipe(0.7, false, fixed(0.5), 'vazio')
    const dragao = hitRecipe(0.7, false, fixed(0.5), 'dragao')
    expect(vazio.wood[0].gain).toBeLessThan(plain.wood[0].gain * 0.5)
    expect(vazio.resin[0].gain).toBeLessThan(plain.resin[0].gain * 0.2)
    expect(dragao.wood[0].freq).toBeLessThan(plain.wood[0].freq)
  })

  it('o prisma toca uma nota da escala a cada batida', () => {
    const notes = new Set([0.05, 0.3, 0.55, 0.8, 0.95].map((x) => Math.round(hitRecipe(0.6, false, fixed(x), 'prisma').ring[0].freq)))
    expect(notes.size).toBeGreaterThan(2)
  })
})
