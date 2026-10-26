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

// ── Crítico (20 natural) ────────────────────────────────

/** As notas do crítico: um arpejo dourado que sobe em Dó maior até a oitava, mais o acorde final que fica soando. */
export const CRIT_ARPEGGIO = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98] as const
export const CRIT_CHORD = [523.25, 783.99, 1046.5, 1318.51] as const

/** Um sino: fundamental + parcial inarmônico (razão 2,76), que morre antes. */
function bell(a: AudioContext, out: AudioNode, t: number, freq: number, peak: number, life: number): void {
  for (const [ratio, level, decay] of [[1, 1, life], [2.76, 0.35, life * 0.45], [5.4, 0.12, life * 0.2]] as const) {
    const o = a.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq * ratio
    const g = a.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak * level, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + decay + 0.05)
  }
}

/**
 * O som do 20 natural: uma pancada grave (o "whoom" da explosão), um chiado
 * que sobe e brilha, um arpejo de sinos subindo e o acorde final que
 * ressoa. Tudo gerado na hora, no volume dos sons dos dados.
 */
export function playCritSound(): void {
  const level = soundVolume('dice')
  if (muted || level === 0) return
  const a = audio()
  if (!a || !bus) return
  bus.gain.value = 0.9 * level
  const t = a.currentTime + 0.01

  // pancada grave: seno que cai de tom
  const boom = a.createOscillator()
  boom.type = 'sine'
  boom.frequency.setValueAtTime(150, t)
  boom.frequency.exponentialRampToValueAtTime(42, t + 0.35)
  const bg = a.createGain()
  bg.gain.setValueAtTime(0.0001, t)
  bg.gain.exponentialRampToValueAtTime(0.5, t + 0.012)
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
  boom.connect(bg).connect(bus)
  boom.start(t)
  boom.stop(t + 0.55)

  // chiado que sobe e brilha (ruído filtrado, passando de grave a agudo)
  if (noise) {
    const src = a.createBufferSource()
    src.buffer = noise
    src.loop = true
    const bp = a.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.4
    bp.frequency.setValueAtTime(900, t)
    bp.frequency.exponentialRampToValueAtTime(9000, t + 0.7)
    const ng = a.createGain()
    ng.gain.setValueAtTime(0.0001, t)
    ng.gain.exponentialRampToValueAtTime(0.22, t + 0.25)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.85)
    src.connect(bp).connect(ng).connect(bus)
    src.start(t)
    src.stop(t + 0.9)
  }

  // arpejo de sinos
  CRIT_ARPEGGIO.forEach((f, i) => bell(a, bus!, t + 0.08 + i * 0.065, f, 0.1 + i * 0.012, 0.9))
  // acorde final, mais longo
  CRIT_CHORD.forEach((f, i) => bell(a, bus!, t + 0.5, f * (i % 2 ? 1.003 : 0.997), 0.09, 1.9))
}
