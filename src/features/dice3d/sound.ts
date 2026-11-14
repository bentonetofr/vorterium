import { soundVolume } from '../settings/settingsStore'
// ────────────────────────────────────────────────────────
// Som dos dados gerado na hora (Web Audio), sem arquivos. Um dado batendo numa
// mesa de madeira tem duas partes:
//   • o "toc": a madeira ressoando, um corpo oco que cai rápido e sobe um
//     pouquinho de tom no começo da batida (parciais não harmônicos, como numa
//     tábua);
//   • o "clac": o estalo seco da resina do dado, agudo e curtíssimo.
// No chão dominam o toc; dado com dado dominam o clac. A força da batida
// muda o volume, o brilho e o tom. `hitRecipe` só calcula os números (sem
// áudio), para poder ser testado.
//
// Alguns conjuntos da coleção têm VOZ própria (`DiceVoice`): o material do dado
// muda a batida. A voz mexe no quanto de madeira e de estalo entra e soma a
// ressonância do material (`ring`: o sino que fica soando, o vidro que tilinta,
// a nota do prisma) e, em alguns, um sopro de ruído (`hiss`: papel, brasa, trovão).
// ────────────────────────────────────────────────────────

/** `delay`: nasce um pouco depois da batida · `to`: o tom escorrega até aqui · `wave`: forma da onda (padrão: seno). */
export interface Partial_ { freq: number; gain: number; decay: number; delay?: number; to?: number; wave?: OscillatorType }

/** Sopro de ruído filtrado do material. */
export interface Hiss { dur: number; cutoff: number; q: number; gain: number; type: BiquadFilterType; delay?: number }

/** As vozes dos conjuntos da coleção (o campo `sound` de skins.ts). */
export type DiceVoice = 'cortica' | 'cera' | 'vidro' | 'papel' | 'sino' | 'relogio' | 'perola' | 'trovao' | 'olho' | 'cosmos' | 'dragao' | 'espelho' | 'vazio' | 'prisma'

export interface HitRecipe {
  /** Corpo de madeira (toc). */
  wood:   Partial_[]
  /** Estalo da resina (clac). */
  resin:  Partial_[]
  /** Estalo de ruído do impacto: duração em s, brilho (Hz do filtro) e volume. */
  click:  { dur: number; cutoff: number; gain: number }
  /** Subida de tom no começo do toc (1 = nenhuma). */
  bend:   number
  /** Volume geral da batida. */
  volume: number
  /** Ressonância do material (só nos conjuntos com voz). */
  ring:   Partial_[]
  /** Sopro de ruído do material (só em algumas vozes). */
  hiss:   Hiss | null
}

/** O que cada voz muda na batida: quanto de madeira e de estalo fica (1 = igual), o tom deles, e o que ela soma. */
interface VoiceShape { wood?: number; woodPitch?: number; resin?: number; resinPitch?: number; click?: number; ring?: Partial_[]; hiss?: Hiss }

const choose = <T,>(rnd: () => number, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))]

/** Notas do prisma (dó maior pentatônica) e da galáxia (lídio, mais aéreo): cada batida toca uma. */
const PRISM_NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1568] as const
const COSMOS_NOTES = [523.25, 659.25, 739.99, 783.99, 987.77, 1174.66] as const
const BELL_NOTES = [587.33, 659.25, 783.99, 880] as const

const VOICES: Record<DiceVoice, (s: number, rnd: () => number) => VoiceShape> = {
  // rolha: um "poc" oco e abafado, quase sem estalo
  cortica: (_s, rnd) => ({ wood: 0.7, resin: 0.06, click: 0.3, ring: [{ freq: 380 + rnd() * 90, to: 250, gain: 0.55, decay: 0.045 }] }),
  // cera: baque mole e grave
  cera: (_s, rnd) => ({ wood: 0.55, woodPitch: 0.85, resin: 0.04, click: 0.18, ring: [{ freq: 150 + rnd() * 30, to: 95, gain: 0.6, decay: 0.07 }] }),
  // vitral: o tilintar do vidro
  vidro: (s, rnd) => {
    const f = 3100 + rnd() * 1300
    return { wood: 0.45, resin: 0.5, resinPitch: 1.4, ring: [1, 2.32, 4.25].map((r, i) => ({ freq: f * r, gain: [0.5, 0.22, 0.08][i], decay: [0.26, 0.16, 0.09][i] * (0.6 + s * 0.6) })) }
  },
  // pergaminho: farfalhar de papel seco
  papel: (s, rnd) => ({ wood: 0.4, resin: 0.08, click: 0.5, hiss: { dur: 0.05 + s * 0.03, cutoff: 2400 + rnd() * 1200, q: 0.7, gain: 0.5, type: 'bandpass' } }),
  // sino: parciais de sino (o zumbido, a prima, a terça menor, a quinta...) que ficam soando
  sino: (s, rnd) => {
    const f = choose(rnd, BELL_NOTES)
    const parts: [number, number, number][] = [[0.5, 0.25, 1.4], [1, 0.5, 1.1], [1.19, 0.3, 0.8], [1.5, 0.22, 0.6], [2, 0.3, 0.5], [2.51, 0.14, 0.35], [3.01, 0.08, 0.25]]
    return { wood: 0.5, resin: 0.25, ring: parts.map(([r, g, d]) => ({ freq: f * r, gain: g * (0.35 + s * 0.65), decay: d * (0.5 + s * 0.7) })) }
  },
  // relógio: tique... taque
  relogio: (_s, rnd) => {
    const f = 1700 + rnd() * 500
    return { wood: 0.6, resin: 0.45, ring: [
      { freq: f, gain: 0.34, decay: 0.035, wave: 'triangle' }, { freq: f * 2.7, gain: 0.12, decay: 0.02 },
      { freq: f * 0.74, gain: 0.26, decay: 0.04, wave: 'triangle', delay: 0.06 + rnd() * 0.015 }, { freq: f * 2.1, gain: 0.08, decay: 0.02, delay: 0.062 },
    ] }
  },
  // madrepérola: um "tim" limpo de porcelana
  perola: (s, rnd) => {
    const f = 2500 + rnd() * 600
    return { wood: 0.55, resin: 0.7, resinPitch: 1.15, ring: [1, 2.31, 3.9].map((r, i) => ({ freq: f * r, gain: [0.45, 0.18, 0.06][i], decay: [0.14, 0.09, 0.05][i] * (0.7 + s * 0.5) })) }
  },
  // tempestade: trovão que rola (grave que desce) e o estalo do raio
  trovao: (s, rnd) => ({
    wood: 0.8, woodPitch: 0.8,
    ring: [{ freq: 85 + rnd() * 20, to: 36, gain: 0.9 * s, decay: 0.3 + s * 0.35 }, { freq: 55, to: 30, gain: 0.5 * s, decay: 0.5, delay: 0.05 }],
    hiss: { dur: 0.1 + s * 0.14, cutoff: 700 + s * 900, q: 0.5, gain: 0.55, type: 'lowpass' },
  }),
  // olho: baque molhado
  olho: (_s, rnd) => ({
    wood: 0.5, resin: 0.05, click: 0.3,
    ring: [{ freq: 210 + rnd() * 40, to: 70, gain: 0.7, decay: 0.11 }, { freq: 520 + rnd() * 120, to: 180, gain: 0.25, decay: 0.06, delay: 0.012 }],
    hiss: { dur: 0.06, cutoff: 600, q: 1.2, gain: 0.4, type: 'lowpass' },
  }),
  // galáxia: uma nota aérea, com um par levemente desafinado (o brilho que bate devagar)
  cosmos: (s, rnd) => {
    const n = choose(rnd, COSMOS_NOTES)
    return { wood: 0.4, resin: 0.45, ring: [
      { freq: n, gain: 0.3, decay: 0.7 + s * 0.5 }, { freq: n * 1.005, gain: 0.2, decay: 0.8 }, { freq: n * 2, gain: 0.08, decay: 0.4 }, { freq: n * 3.01, gain: 0.03, decay: 0.25 },
    ] }
  },
  // dragão: pedra pesada e o chiado da brasa
  dragao: (s, rnd) => ({
    wood: 1.15, woodPitch: 0.62, resin: 0.2,
    ring: [{ freq: 120 + rnd() * 16, to: 55, gain: 0.7 * s, decay: 0.16 }],
    hiss: { dur: 0.12 + s * 0.1, cutoff: 5200, q: 0.6, gain: 0.3, type: 'highpass', delay: 0.01 },
  }),
  // espelho: cacos que tilintam, um atrás do outro
  espelho: (_s, rnd) => {
    const n = 3 + Math.floor(rnd() * 3)
    return { wood: 0.45, resin: 0.6, resinPitch: 1.6, click: 1.2, ring: Array.from({ length: n }, (_, i): Partial_ => ({
      freq: 3200 + rnd() * 4600, gain: 0.3 * (0.5 + rnd() * 0.5), decay: 0.06 + rnd() * 0.16, delay: i * 0.012 + rnd() * 0.03,
    })) }
  },
  // vazio: quase não bate; um "vuum" fundo que engole o som e um assobio fraco que cai
  vazio: (s, rnd) => ({
    wood: 0.2, resin: 0.03, click: 0.08,
    ring: [{ freq: 68 + rnd() * 8, to: 30, gain: 1, decay: 0.45 + s * 0.3 }, { freq: 136, to: 62, gain: 0.3, decay: 0.3 }, { freq: 2100 + rnd() * 400, to: 600, gain: 0.07, decay: 0.25, delay: 0.02 }],
  }),
  // prisma: cada batida é uma nota de cristal, e a quinta dela chega logo depois
  prisma: (s, rnd) => {
    const n = choose(rnd, PRISM_NOTES)
    return { wood: 0.35, resin: 0.5, resinPitch: 1.3, ring: [
      { freq: n, gain: 0.42, decay: 0.5 + s * 0.4 }, { freq: n * 2, gain: 0.14, decay: 0.3 }, { freq: n * 3, gain: 0.05, decay: 0.18 }, { freq: n * 1.5, gain: 0.1, decay: 0.45, delay: 0.06 },
    ] }
  },
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0)

/** Parciais de uma tábua de madeira: razões não harmônicas, as agudas morrem primeiro. */
const WOOD_RATIOS = [1, 2.32, 3.87, 5.9] as const
const WOOD_GAINS = [1, 0.5, 0.26, 0.1] as const
const WOOD_DECAY = [0.085, 0.055, 0.035, 0.022] as const

/**
 * A receita de uma batida. `rnd` dá a variação de cada batida (nenhuma soa
 * igual à outra) e vem de fora para os testes serem previsíveis.
 */
export function hitRecipe(strength: number, withDie: boolean, rnd: () => number = Math.random, voice?: DiceVoice): HitRecipe {
  const s = clamp01(strength)
  // tom do toc: mesa grave no chão, mais seco quando é dado batendo em dado
  const pitch = (withDie ? 260 : 175) * (0.9 + rnd() * 0.22) * (0.92 + s * 0.16)
  // a voz do material entra depois do sorteio do tom (sem voz, a receita sai igual à de sempre)
  const v: VoiceShape = voice && VOICES[voice] ? VOICES[voice](s, rnd) : {}
  const f0 = pitch * (v.woodPitch ?? 1)
  const woodLevel = (withDie ? 0.32 : 1) * (v.wood ?? 1)
  const resinLevel = (withDie ? 1 : 0.42) * (v.resin ?? 1)

  const wood = WOOD_RATIOS.map((r, i): Partial_ => ({
    freq: f0 * r * (0.985 + rnd() * 0.03),
    gain: WOOD_GAINS[i] * woodLevel,
    decay: WOOD_DECAY[i] * (0.8 + s * 0.5),
  }))
  const resinBase = (2300 + rnd() * 900) * (v.resinPitch ?? 1)
  const resin = [1, 1.62, 2.4].map((r, i): Partial_ => ({
    freq: resinBase * r * (0.97 + rnd() * 0.06),
    gain: [1, 0.55, 0.3][i] * resinLevel,
    decay: [0.026, 0.018, 0.012][i] * (0.8 + s * 0.4),
  }))
  return {
    wood, resin,
    click: { dur: 0.006 + s * 0.006, cutoff: 1800 + s * 4200, gain: (0.25 + s * 0.55) * (v.click ?? 1) },
    bend: 1.05 + s * 0.06,
    volume: 0.1 + Math.pow(s, 0.8) * 0.8,
    ring: v.ring ?? [],
    hiss: v.hiss ?? null,
  }
}

// ── Áudio ───────────────────────────────────────────────

let ctx: AudioContext | null = null
let bus: GainNode | null = null
let noise: AudioBuffer | null = null
let muted = false
const recent: number[] = []

export function setDiceSoundMuted(value: boolean): void { muted = value }

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    ctx = new Ctor()
    // um compressor leve segura o barulho quando vários dados batem juntos
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 18
    comp.ratio.value = 4
    comp.attack.value = 0.002
    comp.release.value = 0.12
    bus = ctx.createGain()
    bus.gain.value = 0.9
    bus.connect(comp).connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  if (!noise) {
    // meio segundo de ruído: sobra para o estalo (milésimos) e dá para os sopros das vozes (papel, brasa, trovão)
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return ctx
}

/** Uma parcial que nasce no instante t e morre exponencialmente. */
function ring(a: AudioContext, out: AudioNode, t: number, p: Partial_, volume: number, bend = 1): void {
  if (p.gain * volume < 0.002) return
  const o = a.createOscillator()
  o.type = p.wave ?? 'sine'
  o.frequency.setValueAtTime(p.freq * bend, t)
  if (bend !== 1) o.frequency.exponentialRampToValueAtTime(p.freq, t + 0.014)
  if (p.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, p.to), t + p.decay)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(p.gain * volume, t + 0.0012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + p.decay)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + p.decay + 0.02)
}

/** Um sopro de ruído filtrado (o farfalhar do papel, o chiado da brasa, o estalo do trovão). */
function breath(a: AudioContext, out: AudioNode, t: number, h: Hiss, volume: number): void {
  if (!noise || h.gain * volume < 0.004) return
  const src = a.createBufferSource()
  src.buffer = noise
  const f = a.createBiquadFilter()
  f.type = h.type
  f.frequency.value = h.cutoff
  f.Q.value = h.q
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(h.gain * volume, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + h.dur)
  src.connect(f).connect(g).connect(out)
  // começa num ponto qualquer do ruído, para dois sopros seguidos não soarem iguais
  src.start(t, Math.random() * 0.2)
  src.stop(t + h.dur + 0.02)
}

/** Uma batida: força de 0 a 1; `withDie` = dado com dado (mais estalo, menos madeira); `voice` = o material do conjunto. */
export function playDiceHit(strength: number, withDie: boolean, voice?: DiceVoice): void {
  const level = soundVolume('dice')
  if (muted || level === 0) return
  const a = audio()
  if (!a || !bus) return
  bus.gain.value = 0.9 * level
  const now = a.currentTime
  // muitas batidas no mesmo instante viram só um chiado: descarta as mais fracas
  while (recent.length && now - recent[0] > 0.05) recent.shift()
  if (recent.length >= 6 && strength < 0.5) return
  recent.push(now)

  const r = hitRecipe(strength, withDie, Math.random, voice)
  const t = now + 0.001
  for (const p of r.wood) ring(a, bus, t, p, r.volume, r.bend)
  for (const p of r.resin) ring(a, bus, t, p, r.volume * 0.7)
  // a voz do material: dado com dado soa um pouco menos (os dois dividem a batida)
  const voiceLevel = r.volume * (withDie ? 0.6 : 0.85)
  for (const p of r.ring) ring(a, bus, t + (p.delay ?? 0), p, voiceLevel)
  if (r.hiss) breath(a, bus, t + (r.hiss.delay ?? 0), r.hiss, voiceLevel)

  // estalo de impacto: um grãozinho de ruído filtrado
  if (noise) {
    const src = a.createBufferSource()
    src.buffer = noise
    const hp = a.createBiquadFilter()
    hp.type = 'bandpass'
    hp.frequency.value = r.click.cutoff
    hp.Q.value = 0.8
    const g = a.createGain()
    g.gain.setValueAtTime(r.click.gain * r.volume, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + r.click.dur)
    src.connect(hp).connect(g).connect(bus)
    src.start(t)
    src.stop(t + r.click.dur + 0.01)
  }
}

/** Dado rolando e parando: uma sequência curta de batidas que vão ficando fracas (para testar o som). */
export function playDiceRattle(voice?: DiceVoice): void {
  const hits = [0.95, 0.7, 0.8, 0.45, 0.5, 0.3, 0.2, 0.12]
  hits.forEach((s, i) => window.setTimeout(() => playDiceHit(s, i % 3 === 2, voice), i * (70 + i * 14)))
}
