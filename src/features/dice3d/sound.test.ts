import { describe, expect, it } from 'vitest'
import { CRIT_ARPEGGIO, CRIT_CHORD, hitRecipe } from './sound'

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

describe('som do 20 natural', () => {
  it('o arpejo sobe sempre e o acorde final cabe dentro dele', () => {
    const up = [...CRIT_ARPEGGIO]
    expect(up).toEqual([...up].sort((a, b) => a - b))
    expect(CRIT_CHORD[0]).toBe(CRIT_ARPEGGIO[0])
    for (const f of CRIT_CHORD) expect(CRIT_ARPEGGIO).toContain(f)
  })
})
