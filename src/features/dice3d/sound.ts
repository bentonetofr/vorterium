import { soundVolume } from '../settings/settingsStore'
import type { FxTheme } from './fxThemes'
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
// ────────────────────────────────────────────────────────

export interface Partial_ { freq: number; gain: number; decay: number }

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
export function hitRecipe(strength: number, withDie: boolean, rnd: () => number = Math.random): HitRecipe {
  const s = clamp01(strength)
  // tom do toc: mesa grave no chão, mais seco quando é dado batendo em dado
  const f0 = (withDie ? 260 : 175) * (0.9 + rnd() * 0.22) * (0.92 + s * 0.16)
  const woodLevel = withDie ? 0.32 : 1
  const resinLevel = withDie ? 1 : 0.42

  const wood = WOOD_RATIOS.map((r, i): Partial_ => ({
    freq: f0 * r * (0.985 + rnd() * 0.03),
    gain: WOOD_GAINS[i] * woodLevel,
    decay: WOOD_DECAY[i] * (0.8 + s * 0.5),
  }))
  const resinBase = 2300 + rnd() * 900
  const resin = [1, 1.62, 2.4].map((r, i): Partial_ => ({
    freq: resinBase * r * (0.97 + rnd() * 0.06),
    gain: [1, 0.55, 0.3][i] * resinLevel,
    decay: [0.026, 0.018, 0.012][i] * (0.8 + s * 0.4),
  }))
  return {
    wood, resin,
    click: { dur: 0.006 + s * 0.006, cutoff: 1800 + s * 4200, gain: 0.25 + s * 0.55 },
    bend: 1.05 + s * 0.06,
    volume: 0.1 + Math.pow(s, 0.8) * 0.8,
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
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return ctx
}

/** Uma parcial que nasce no instante t e morre exponencialmente. */
function ring(a: AudioContext, out: AudioNode, t: number, p: Partial_, volume: number, bend = 1): void {
  if (p.gain * volume < 0.002) return
  const o = a.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(p.freq * bend, t)
  if (bend !== 1) o.frequency.exponentialRampToValueAtTime(p.freq, t + 0.014)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(p.gain * volume, t + 0.0012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + p.decay)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + p.decay + 0.02)
}

/** Uma batida: força de 0 a 1; `withDie` = dado com dado (mais estalo, menos madeira). */
export function playDiceHit(strength: number, withDie: boolean): void {
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

  const r = hitRecipe(strength, withDie)
  const t = now + 0.001
  for (const p of r.wood) ring(a, bus, t, p, r.volume, r.bend)
  for (const p of r.resin) ring(a, bus, t, p, r.volume * 0.7)

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
export function playDiceRattle(): void {
  const hits = [0.95, 0.7, 0.8, 0.45, 0.5, 0.3, 0.2, 0.12]
  hits.forEach((s, i) => window.setTimeout(() => playDiceHit(s, i % 3 === 2), i * (70 + i * 14)))
}

/** Acorde curto para o crítico (dourado, subindo) ou a falha (grave, caindo). */
export function playDiceFlourish(kind: 'crit' | 'fumble'): void {
  const level = soundVolume('dice')
  if (muted || level === 0) return
  const a = audio()
  if (!a || !bus) return
  bus.gain.value = 0.9 * level
  const t = a.currentTime
  const notes = kind === 'crit' ? [523.25, 659.25, 783.99, 1046.5] : [220, 174.61, 130.81]
  notes.forEach((f, i) => {
    const o = a.createOscillator()
    o.type = kind === 'crit' ? 'triangle' : 'sawtooth'
    o.frequency.value = f
    const g = a.createGain()
    const start = t + i * (kind === 'crit' ? 0.07 : 0.11)
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(kind === 'crit' ? 0.16 : 0.1, start + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, start + (kind === 'crit' ? 0.9 : 0.6))
    const lp = a.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = kind === 'crit' ? 6000 : 900
    o.connect(lp).connect(g).connect(bus!)
    o.start(start)
    o.stop(start + 1)
  })
}

// ── Crítico (20 natural) e falha crítica (1 natural) ────

/** As notas do crítico: um arpejo dourado que sobe em Dó maior até a oitava, mais o acorde final que fica soando. */
export const CRIT_ARPEGGIO = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98] as const
export const CRIT_CHORD = [523.25, 783.99, 1046.5, 1318.51] as const

/** Ruído de 2 s para chiados e trovões (o de 50 ms dos estalos repetiria num zumbido). */
let longNoise: AudioBuffer | null = null

interface Kit { a: AudioContext; out: AudioNode; t: number; noise: AudioBuffer }

/** Um sino: fundamental + parciais inarmônicos (razões 2,76 e 5,4), que morrem antes. */
function bell(k: Kit, t: number, freq: number, peak: number, life: number): void {
  for (const [ratio, level, decay] of [[1, 1, life], [2.76, 0.35, life * 0.45], [5.4, 0.12, life * 0.2]] as const) {
    const o = k.a.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq * ratio
    const g = k.a.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak * level, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    o.connect(g).connect(k.out)
    o.start(t)
    o.stop(t + decay + 0.05)
  }
}

/** Tom que desliza de `f0` a `f1`: pancadas graves, zaps, bolhas, quedas. */
function glide(k: Kit, t: number, f0: number, f1: number, dur: number, peak: number, type: OscillatorType = 'sine', cutoff = 0): void {
  const o = k.a.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
  const g = k.a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.02, dur / 4))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  if (cutoff) {
    const lp = k.a.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = cutoff
    o.connect(lp).connect(g)
  } else o.connect(g)
  g.connect(k.out)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** Chiado: ruído filtrado cuja frequência vai de `f0` a `f1`, subindo e descendo de volume. */
function hiss(k: Kit, t: number, type: BiquadFilterType, f0: number, f1: number, dur: number, peak: number, attack = 0.3, q = 1): void {
  const src = k.a.createBufferSource()
  src.buffer = k.noise
  src.loop = true
  const f = k.a.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(f0, t)
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  const g = k.a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + Math.max(0.004, dur * attack))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(k.out)
  src.start(t, Math.random())
  src.stop(t + dur + 0.05)
}

/** Estalinhos soltos (fogo, rachaduras, cinzas): `n` estalos espalhados em `span` s. */
function crackle(k: Kit, t: number, n: number, span: number, peak: number, hz = 2600): void {
  for (let i = 0; i < n; i++) hiss(k, t + Math.random() * span, 'highpass', hz * (0.7 + Math.random() * 0.8), hz * 0.6, 0.012 + Math.random() * 0.02, peak * (0.4 + Math.random() * 0.6), 0.1)
}

/** Bolhas: seios curtos que sobem de tom. */
function bubbles(k: Kit, t: number, n: number, span: number, lo: number, hi: number, peak: number): void {
  for (let i = 0; i < n; i++) {
    const f = lo + Math.random() * (hi - lo)
    glide(k, t + Math.random() * span, f, f * (1.6 + Math.random() * 0.8), 0.07 + Math.random() * 0.06, peak * (0.5 + Math.random() * 0.5))
  }
}

/** A queda triste da falha: notas que descem, serrilhadas e abafadas. */
function sad(k: Kit, t: number, notes: readonly number[], step = 0.13, peak = 0.12, cutoff = 900): void {
  notes.forEach((f, i) => glide(k, t + i * step, f, f * 0.97, 0.7, peak, 'sawtooth', cutoff))
}

const sparkle = (k: Kit, t: number, notes: readonly number[], peak: number, life = 0.9, gap = 0.065) => notes.forEach((f, i) => bell(k, t + i * gap, f, peak + i * 0.01, life))

/** Como cada animação soa (todas sintetizadas na hora). */
const RECIPES: Record<FxTheme, (k: Kit) => void> = {
  fire: (k) => {
    glide(k, k.t, 140, 45, 0.45, 0.5)
    hiss(k, k.t, 'lowpass', 300, 3000, 1.1, 0.34, 0.25)
    crackle(k, k.t + 0.1, 18, 1.7, 0.2)
    sparkle(k, k.t + 0.1, [523.25, 659.25, 783.99, 1046.5], 0.08)
  },
  glow: (k) => {
    glide(k, k.t, 150, 42, 0.5, 0.5)
    hiss(k, k.t, 'bandpass', 900, 9000, 0.85, 0.22, 0.3, 1.4)
    sparkle(k, k.t + 0.08, CRIT_ARPEGGIO, 0.1)
    CRIT_CHORD.forEach((f, i) => bell(k, k.t + 0.5, f * (i % 2 ? 1.003 : 0.997), 0.09, 1.9))
  },
  lightning: (k) => {
    hiss(k, k.t, 'highpass', 1800, 900, 0.16, 0.6, 0.05)
    glide(k, k.t, 2200, 60, 0.28, 0.2, 'sawtooth', 5000)
    hiss(k, k.t + 0.08, 'lowpass', 320, 70, 2, 0.55, 0.12)
    hiss(k, k.t + 0.5, 'highpass', 1800, 900, 0.14, 0.45, 0.05)
    sparkle(k, k.t + 0.7, [783.99, 1046.5, 1567.98], 0.07, 1.2, 0.1)
  },
  water: (k) => {
    hiss(k, k.t, 'bandpass', 1800, 700, 0.55, 0.3, 0.12, 0.8)
    hiss(k, k.t + 0.15, 'lowpass', 400, 1400, 1.4, 0.2, 0.4)
    bubbles(k, k.t + 0.2, 16, 1.6, 320, 1100, 0.14)
    sparkle(k, k.t + 0.25, [392, 493.88, 587.33, 783.99, 987.77], 0.07, 1.1, 0.09)
  },
  ice: (k) => {
    glide(k, k.t, 110, 55, 0.4, 0.35)
    hiss(k, k.t, 'highpass', 7000, 5000, 0.35, 0.35, 0.08)
    crackle(k, k.t + 0.05, 10, 0.9, 0.22, 5000)
    sparkle(k, k.t + 0.1, [1046.5, 1318.51, 1567.98, 2093, 2637, 3135.96], 0.07, 1.6, 0.06)
  },
  arcane: (k) => {
    glide(k, k.t, 180, 2400, 0.9, 0.16, 'sawtooth', 3000)
    glide(k, k.t, 182, 2430, 0.9, 0.12, 'sawtooth', 3000)
    hiss(k, k.t, 'bandpass', 500, 7000, 0.9, 0.22, 0.6, 2)
    glide(k, k.t + 0.85, 120, 40, 0.5, 0.45)
    sparkle(k, k.t + 0.9, [440, 523.25, 659.25, 880, 1046.5], 0.09, 1.7, 0.05)
  },
  nature: (k) => {
    hiss(k, k.t, 'bandpass', 500, 1200, 1.6, 0.2, 0.5, 0.9)
    ;[392, 440, 523.25, 587.33, 659.25, 783.99].forEach((f, i) => glide(k, k.t + 0.1 + i * 0.11, f, f * 1.01, 0.55, 0.11, 'triangle'))
    glide(k, k.t, 120, 60, 0.4, 0.3)
    sparkle(k, k.t + 0.75, [1046.5, 1318.51], 0.06, 1.4, 0.1)
  },
  cosmos: (k) => {
    glide(k, k.t, 90, 30, 1.2, 0.5)
    for (let i = 0; i < 4; i++) glide(k, k.t + 0.12 + i * 0.2, 3200, 500, 0.45, 0.07)
    hiss(k, k.t, 'bandpass', 400, 6000, 1, 0.14, 0.5, 1.5)
    sparkle(k, k.t + 0.4, [392, 587.33, 783.99, 1174.66, 1567.98], 0.08, 2, 0.12)
  },
  darkfire: (k) => {
    glide(k, k.t, 100, 38, 0.6, 0.5)
    hiss(k, k.t, 'lowpass', 200, 1500, 1.3, 0.3, 0.3)
    crackle(k, k.t + 0.1, 14, 1.6, 0.18, 1800)
    sad(k, k.t + 0.2, [220, 207.65, 174.61, 130.81])
  },
  redlightning: (k) => {
    hiss(k, k.t, 'highpass', 1600, 800, 0.2, 0.6, 0.05)
    hiss(k, k.t + 0.06, 'lowpass', 260, 50, 2.2, 0.55, 0.1)
    glide(k, k.t, 1800, 50, 0.4, 0.18, 'sawtooth', 3000)
    sad(k, k.t + 0.4, [233.08, 164.81, 116.54], 0.2, 0.12, 700)
  },
  blood: (k) => {
    hiss(k, k.t, 'lowpass', 900, 200, 0.28, 0.5, 0.05)
    glide(k, k.t, 120, 40, 0.35, 0.5)
    for (let i = 0; i < 5; i++) glide(k, k.t + 0.5 + i * 0.28 + Math.random() * 0.1, 900, 320, 0.09, 0.14)
    sad(k, k.t + 0.3, [196, 185, 164.81], 0.25, 0.1, 600)
  },
  shadow: (k) => {
    glide(k, k.t, 60, 48, 2.2, 0.4)
    glide(k, k.t, 63, 50, 2.2, 0.3)
    hiss(k, k.t, 'lowpass', 1800, 150, 1.8, 0.3, 0.6)
    sad(k, k.t + 0.3, [164.81, 155.56, 130.81, 110], 0.28, 0.1, 500)
  },
  cracks: (k) => {
    glide(k, k.t, 100, 35, 0.5, 0.55)
    for (let i = 0; i < 6; i++) hiss(k, k.t + i * 0.07 + Math.random() * 0.04, 'bandpass', 2400 + Math.random() * 2000, 900, 0.06, 0.5, 0.05, 2)
    crackle(k, k.t + 0.5, 14, 1.6, 0.16, 2200)
    sad(k, k.t + 0.5, [196, 146.83], 0.3, 0.1, 700)
  },
  poison: (k) => {
    hiss(k, k.t, 'highpass', 3500, 6500, 1.3, 0.2, 0.5)
    bubbles(k, k.t, 22, 1.8, 140, 520, 0.16)
    glide(k, k.t, 100, 50, 0.5, 0.35)
    sad(k, k.t + 0.5, [185, 174.61, 138.59], 0.22, 0.1, 650)
  },
  void: (k) => {
    glide(k, k.t, 240, 28, 1.9, 0.5)
    glide(k, k.t, 480, 55, 1.9, 0.12, 'triangle')
    hiss(k, k.t, 'bandpass', 4000, 150, 1.9, 0.22, 0.4, 1.2)
    glide(k, k.t + 1.7, 90, 30, 0.6, 0.5)
  },
  ash: (k) => {
    hiss(k, k.t, 'lowpass', 500, 260, 1.8, 0.2, 0.4)
    crackle(k, k.t + 0.1, 9, 1.8, 0.1, 2000)
    glide(k, k.t, 90, 45, 0.5, 0.35)
    ;[220, 185, 164.81, 146.83].forEach((f, i) => glide(k, k.t + i * 0.3, f, f * 0.98, 0.9, 0.08, 'sine'))
  },
}

/** O som do 20 natural (ou do 1) da animação sorteada: cada uma tem o seu, no volume dos sons dos dados. */
export function playFxSound(theme: FxTheme): void {
  const level = soundVolume('dice')
  if (muted || level === 0) return
  const a = audio()
  if (!a || !bus) return
  bus.gain.value = 0.9 * level
  if (!longNoise) {
    longNoise = a.createBuffer(1, a.sampleRate * 2, a.sampleRate)
    const d = longNoise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  RECIPES[theme]({ a, out: bus, t: a.currentTime + 0.01, noise: longNoise })
}
