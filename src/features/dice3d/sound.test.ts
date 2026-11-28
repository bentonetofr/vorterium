import { describe, expect, it } from 'vitest'
import { hitRecipe, type DiceVoice } from './sound'
import { ALL_SKINS, COLLECTION_SKINS, DH_FEAR_SKIN, DH_HOPE_SKIN, getSkin } from './skins'
import { BANK_SIZE, LAYER_TOP_HZ, MAX_RATE, MAX_TONE, VOICE_SAMPLES, bankFiles, bankUrl, hitBrightness, hitCutoff, hitGain, samplePlan, softenHiss, softenPartial, type SampleBank } from './diceSamples'

const WAVS = Object.keys(import.meta.glob('/public/sons/dados/*/*.wav'))

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
  const voices = [...new Set(ALL_SKINS.map((s) => s.sound).filter((v): v is DiceVoice => !!v))]

  it('sem voz, a batida é a de sempre: nenhuma ressonância nem sopro', () => {
    const r = hitRecipe(0.6, false, fixed(0.5))
    expect(r.ring).toEqual([])
    expect(r.hiss).toBeNull()
  })

  it('todo conjunto tem a sua voz (só a madeira velha usa a batida padrão), e nenhuma se repete', () => {
    expect(COLLECTION_SKINS.filter((s) => s.sound)).toHaveLength(34)
    expect(ALL_SKINS.filter((s) => !s.sound).map((s) => s.id)).toEqual(['madeira'])
    expect(voices).toHaveLength(37)
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

describe('batidas gravadas dos dados', () => {
  const banks = Object.keys(BANK_SIZE) as SampleBank[]
  const voices = [...new Set(ALL_SKINS.map((s) => s.sound).filter((v): v is DiceVoice => !!v))]

  it('todo arquivo de todo banco existe em public/sons/dados, e não sobra arquivo fora da lista', () => {
    const listed = banks.flatMap((b) => bankFiles(b).map((f) => `/public/sons/dados/${b}/${f}`))
    for (const f of listed) expect(WAVS, f).toContain(f)
    expect(WAVS.length).toBe(listed.length)
  })

  it('toda voz da coleção escolhe um banco que existe, com tom e volume tocáveis', () => {
    for (const v of voices) {
      const p = VOICE_SAMPLES[v]
      expect(p, v).toBeTruthy()
      expect(banks, v).toContain(p.bank)
      expect(p.rate, v).toBeGreaterThan(0.4)
      expect(p.rate, v).toBeLessThanOrEqual(MAX_RATE)
      expect(p.tone, v).toBeLessThanOrEqual(MAX_TONE)
      expect(p.tone, v).toBeGreaterThan(1500)
      expect(p.gain, v).toBeGreaterThan(0)
      expect(p.ring, v).toBeGreaterThanOrEqual(0)
      expect(p.ring, v).toBeLessThanOrEqual(1)
      expect(p.hiss, v).toBeGreaterThanOrEqual(0)
      expect(p.hiss, v).toBeLessThanOrEqual(1)
    }
    expect(Object.keys(VOICE_SAMPLES)).toHaveLength(voices.length + 2)   // + Esperança e Medo, do DaggerHeart
  })

  it('só mantém a camada sintetizada que a voz realmente tem (sem ressonância ou sopro inventado)', () => {
    for (const v of voices) {
      const p = VOICE_SAMPLES[v]
      const r = hitRecipe(0.7, false, fixed(0.5), v)
      if (p.ring > 0) expect(r.ring.length, v).toBeGreaterThan(0)
      if (p.hiss > 0) expect(r.hiss, v).not.toBeNull()
    }
  })

  it('a madeira velha bate na madeira; dado com dado vira o estalo da resina; as outras vozes não mudam', () => {
    expect(samplePlan(undefined, false).bank).toBe('madeira')
    expect(samplePlan(undefined, true).bank).toBe('dado')
    expect(samplePlan('granito', true).bank).toBe('pedra')
    expect(samplePlan('vidro', true).bank).toBe('vidro')
    expect(samplePlan('vortice', true).bank).toBe('dado')   // madeira com redemoinho: o estalo muda, o redemoinho fica
    expect(samplePlan('vortice', true).ring).toBe(VOICE_SAMPLES.vortice.ring)
  })

  it('mais força, mais volume e mais brilho; força fora de 0 a 1 não quebra', () => {
    expect(hitGain(1)).toBeGreaterThan(hitGain(0.5))
    expect(hitGain(0.5)).toBeGreaterThan(hitGain(0.05))
    expect(hitBrightness(1)).toBeGreaterThan(hitBrightness(0.1))
    for (const s of [-4, 0, 1, 9, Number.NaN]) {
      expect(hitGain(s)).toBeGreaterThan(0)
      expect(hitGain(s)).toBeLessThanOrEqual(1)
      expect(hitBrightness(s)).toBeGreaterThan(1000)
      expect(hitBrightness(s)).toBeLessThanOrEqual(5500)
    }
  })

  it('conforto: o agudo é fechado, os conjuntos brilhantes soam mais abafados', () => {
    for (const v of voices) {
      const p = VOICE_SAMPLES[v]
      expect(hitCutoff(1, p.tone), v).toBeLessThanOrEqual(MAX_TONE)
      if (p.bank === 'vidro') expect(p.tone, v).toBeLessThanOrEqual(2600)
    }
    expect(hitCutoff(0.1, 3000)).toBeLessThan(hitCutoff(1, 3000))
  })

  it('os apitos sintéticos dobram para oitavas mais graves (mesma nota) e o chiado agudo vira faixa média', () => {
    const fino = softenPartial({ freq: 7600, to: 3800, gain: 0.3, decay: 0.1 })
    expect(fino.freq).toBeLessThanOrEqual(LAYER_TOP_HZ)
    expect(Math.log2(7600 / fino.freq) % 1).toBeCloseTo(0, 5)
    expect(fino.to! / fino.freq).toBeCloseTo(0.5, 5)
    expect(softenPartial({ freq: 880, gain: 0.3, decay: 0.1 }).freq).toBe(880)
    for (const v of voices) for (const p of hitRecipe(0.8, false, fixed(0.5), v).ring) expect(softenPartial(p).freq, v).toBeLessThanOrEqual(LAYER_TOP_HZ)
    const h = softenHiss({ dur: 0.1, cutoff: 6200, q: 2, gain: 0.5, type: 'highpass' })
    expect(h.type).toBe('bandpass')
    expect(h.cutoff).toBeLessThanOrEqual(2400)
    expect(softenHiss({ dur: 0.1, cutoff: 9000, q: 1, gain: 0.5, type: 'lowpass' }).cutoff).toBeLessThanOrEqual(3200)
  })

  it('os dados de Dualidade do DaggerHeart têm voz própria e suave: só gravações quentes, sem sino, zumbido nem camada sintetizada', () => {
    expect(getSkin(DH_HOPE_SKIN).sound).toBe('esperanca')
    expect(getSkin(DH_FEAR_SKIN).sound).toBe('medo')
    const hope = samplePlan('esperanca', false)
    const fear = samplePlan('medo', false)
    expect(hope.bank).toBe('esperanca')
    expect(fear.bank).toBe('medo')
    for (const p of [hope, fear]) {
      expect(p.ring).toBe(0)
      expect(p.hiss).toBe(0)
      expect(p.rate).toBeLessThanOrEqual(MAX_RATE)
    }
    expect(fear.tone).toBeLessThan(hope.tone)            // o Medo é o mais abafado e fundo
    expect(samplePlan('esperanca', true).bank).toBe('esperanca')
    // não usam mais os bancos de sino e de pancada abafada dos outros conjuntos
    expect(hope.bank).not.toBe('sino')
    expect(fear.bank).not.toBe('suave')
  })

  it('o endereço do arquivo respeita a base do site e não duplica barras', () => {
    expect(bankUrl('madeira', 'madeira-01.wav')).toMatch(/^\/.*sons\/dados\/madeira\/madeira-01\.wav$/)
    expect(bankUrl('madeira', 'madeira-01.wav')).not.toContain('//')
  })
})
