// ────────────────────────────────────────────────────────
// Sons das criaturas do Vortable, sintetizados na hora (Web Audio): nada de arquivo de áudio.
// Cada som tem um pouco de aleatoriedade, então nunca soa exatamente igual duas vezes.
// O mestre toca e a rede manda o mesmo comando pros jogadores (`sys: 'sfx'`), que sintetizam o som aí.
// ────────────────────────────────────────────────────────

export type SoundGroupId = 'corredor' | 'espreitador' | 'estalador' | 'tropego' | 'baiacu' | 'zumbi'

/** Distância: 0 perto, 1 longe (abafado), 2 muito longe (bem abafado e com eco). */
export type SoundDistance = 0 | 1 | 2

export interface SoundDef {
  id: string
  label: string
  /** Quanto dura (s), pra repetir sem sobrepor. */
  dur: number
  play: (c: Ctx, t: number) => void
}

export interface SoundGroup {
  id: SoundGroupId
  label: string
  sounds: SoundDef[]
}

interface Ctx {
  ac: AudioContext
  out: AudioNode
  noise: AudioBuffer
}

// ── Contexto e saída ─────────────────────────────────────

let ac: AudioContext | null = null
let master: GainNode | null = null
let reverb: ConvolverNode | null = null
let noiseBuf: AudioBuffer | null = null
const LS_KEY = 'vortable:creature-sfx'

/** Os sons das criaturas ligados neste navegador (cada jogador pode desligar). */
export function creatureSfxEnabled(): boolean {
  try { return localStorage.getItem(LS_KEY) !== 'off' } catch { return true }
}
export function setCreatureSfxEnabled(on: boolean): void {
  try { localStorage.setItem(LS_KEY, on ? 'on' : 'off') } catch { /* sem armazenamento */ }
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ac) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ac = new Ctor()
    master = ac.createGain()
    master.gain.value = 0.9
    const comp = ac.createDynamicsCompressor()
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.25
    master.connect(comp).connect(ac.destination)
    // eco: ruído que decai (uma sala grande e vazia)
    reverb = ac.createConvolver()
    reverb.buffer = makeReverb(ac)
    reverb.connect(master)
    noiseBuf = makeNoise(ac)
  }
  return ac
}

/** Navegador só deixa tocar depois de um clique ou tecla: destrava na primeira vez. */
export function unlockCreatureAudio(): void {
  const unlock = () => {
    const a = audio()
    if (a && a.state === 'suspended') void a.resume()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

// ── Peças de síntese ─────────────────────────────────────

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

function env(g: GainNode, t: number, points: [number, number][]) {
  g.gain.setValueAtTime(0.0001, t)
  for (const [dt, v] of points) g.gain.linearRampToValueAtTime(Math.max(0.0001, v), t + dt)
}

function curve(drive: number): Float32Array<ArrayBuffer> {
  const n = 512
  const c = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    c[i] = Math.tanh(x * drive)
  }
  return c
}

interface Voice {
  dur: number
  /** Curva da frequência (Hz): [tempo relativo 0–1, Hz]. */
  f0: [number, number][]
  wave?: OscillatorType
  gain?: number
  /** Ruído misturado (0–1). */
  noise?: number
  /** Formantes (bandas que dão a cor de "boca"). */
  formants?: { f: number; q: number; g: number }[]
  vib?: { rate: number; depth: number }
  /** Tremor da intensidade (rosnado). */
  trem?: { rate: number; depth: number }
  drive?: number
  attack?: number
  release?: number
  detune?: number
  sub?: number
}

/** Uma "voz": oscilador + ruído passando por formantes, com vibrato, tremor e distorção. */
function voice(c: Ctx, t: number, v: Voice) {
  const { ac } = c
  const out = ac.createGain()
  const attack = v.attack ?? 0.06
  const release = v.release ?? 0.3
  env(out, t, [[attack, v.gain ?? 0.5], [Math.max(attack + 0.01, v.dur - release), (v.gain ?? 0.5) * 0.8], [v.dur, 0.0001]])
  const sum = ac.createGain()
  sum.gain.value = 1
  const shaper = ac.createWaveShaper()
  shaper.curve = curve(v.drive ?? 1.5)
  shaper.oversample = '2x'
  const forms = v.formants ?? [{ f: 700, q: 2, g: 1 }]
  const bank = ac.createGain()
  for (const fm of forms) {
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = fm.f * rnd(0.94, 1.06); bp.Q.value = fm.q
    const fg = ac.createGain(); fg.gain.value = fm.g
    sum.connect(bp).connect(fg).connect(bank)
  }
  bank.connect(shaper).connect(out).connect(c.out)

  const mk = (detune: number, level: number) => {
    const osc = ac.createOscillator()
    osc.type = v.wave ?? 'sawtooth'
    const f = osc.frequency
    v.f0.forEach(([rt, hz], i) => {
      const ft = t + rt * v.dur
      if (i === 0) f.setValueAtTime(hz, ft)
      else f.linearRampToValueAtTime(hz, ft)
    })
    osc.detune.value = detune
    if (v.vib) {
      const lfo = ac.createOscillator(); lfo.frequency.value = v.vib.rate * rnd(0.9, 1.1)
      const ld = ac.createGain(); ld.gain.value = v.vib.depth
      lfo.connect(ld).connect(osc.frequency)
      lfo.start(t); lfo.stop(t + v.dur + 0.05)
    }
    const og = ac.createGain(); og.gain.value = level
    osc.connect(og).connect(sum)
    osc.start(t); osc.stop(t + v.dur + 0.05)
  }
  mk(0, 1)
  if (v.detune) mk(v.detune, 0.7)
  if (v.sub) {
    const so = ac.createOscillator(); so.type = 'sine'
    v.f0.forEach(([rt, hz], i) => { const ft = t + rt * v.dur; if (i === 0) so.frequency.setValueAtTime(hz / 2, ft); else so.frequency.linearRampToValueAtTime(hz / 2, ft) })
    const sg = ac.createGain(); sg.gain.value = v.sub
    so.connect(sg).connect(out)
    so.start(t); so.stop(t + v.dur + 0.05)
  }
  if (v.noise) {
    const n = ac.createBufferSource(); n.buffer = c.noise; n.loop = true
    const ng = ac.createGain(); ng.gain.value = v.noise
    n.connect(ng).connect(sum)
    n.start(t, Math.random() * 2); n.stop(t + v.dur + 0.05)
  }
  if (v.trem) {
    const lfo = ac.createOscillator(); lfo.frequency.value = v.trem.rate * rnd(0.9, 1.1)
    const ld = ac.createGain(); ld.gain.value = v.trem.depth
    lfo.connect(ld).connect(out.gain)
    lfo.start(t); lfo.stop(t + v.dur + 0.05)
  }
}

/** Ruído filtrado que sobe e desce (respiração, sopro, sussurro). */
function breath(c: Ctx, t: number, dur: number, f: [number, number], q: number, gain: number, wobble = 0) {
  const { ac } = c
  const n = ac.createBufferSource(); n.buffer = c.noise; n.loop = true
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q
  bp.frequency.setValueAtTime(f[0], t); bp.frequency.linearRampToValueAtTime(f[1], t + dur)
  const g = ac.createGain()
  env(g, t, [[dur * 0.35, gain], [dur * 0.7, gain * 0.7], [dur, 0.0001]])
  if (wobble) {
    const lfo = ac.createOscillator(); lfo.frequency.value = wobble
    const ld = ac.createGain(); ld.gain.value = gain * 0.4
    lfo.connect(ld).connect(g.gain); lfo.start(t); lfo.stop(t + dur)
  }
  n.connect(bp).connect(g).connect(c.out)
  n.start(t, Math.random() * 2); n.stop(t + dur + 0.05)
}

/** Um estalo curto e agudo (o clique do Estalador). */
function click(c: Ctx, t: number, f: number, gain: number) {
  const { ac } = c
  const n = ac.createBufferSource(); n.buffer = c.noise
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 9
  const g = ac.createGain()
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
  n.connect(bp).connect(g).connect(c.out)
  n.start(t, Math.random() * 2); n.stop(t + 0.06)
  const o = ac.createOscillator(); o.type = 'triangle'
  o.frequency.setValueAtTime(f * 0.8, t); o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.04)
  const og = ac.createGain(); og.gain.setValueAtTime(gain * 0.5, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  o.connect(og).connect(c.out); o.start(t); o.stop(t + 0.06)
}

/** Uma pancada grave (passo de Baiacu, estouro). */
function thud(c: Ctx, t: number, f: number, gain: number, dur = 0.35) {
  const { ac } = c
  const o = ac.createOscillator(); o.type = 'sine'
  o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(18, f * 0.35), t + dur)
  const g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.out); o.start(t); o.stop(t + dur + 0.05)
  const n = ac.createBufferSource(); n.buffer = c.noise
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260
  const ng = ac.createGain(); ng.gain.setValueAtTime(gain * 0.9, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7)
  n.connect(lp).connect(ng).connect(c.out); n.start(t, Math.random() * 2); n.stop(t + dur)
}

// ── Os sons de cada criatura ─────────────────────────────

const FORM_GROWL = [{ f: 480, q: 2.2, g: 1 }, { f: 1500, q: 3, g: 0.55 }]
const FORM_SCREAM = [{ f: 950, q: 4, g: 1 }, { f: 2500, q: 5, g: 0.7 }]
const FORM_MOAN = [{ f: 380, q: 3, g: 1 }, { f: 820, q: 3.5, g: 0.6 }, { f: 2100, q: 4, g: 0.2 }]
const FORM_DEEP = [{ f: 210, q: 3, g: 1 }, { f: 520, q: 3, g: 0.6 }]

export const SOUND_GROUPS: SoundGroup[] = [
  {
    id: 'corredor', label: 'Corredor',
    sounds: [
      { id: 'corredor.grunhido', label: 'Grunhido', dur: 0.9, play: (c, t) => voice(c, t, { dur: 0.9, f0: [[0, 95 * rnd(0.9, 1.15)], [0.4, 70], [1, 115]], noise: 0.5, formants: FORM_GROWL, drive: 3, vib: { rate: 22, depth: 9 }, gain: 0.55, release: 0.35, detune: 14 }) },
      { id: 'corredor.grito', label: 'Grito de ataque', dur: 1.1, play: (c, t) => voice(c, t, { dur: 1.1, f0: [[0, 380], [0.3, 880 * rnd(0.9, 1.15)], [1, 620]], noise: 0.5, formants: FORM_SCREAM, drive: 4, vib: { rate: 14, depth: 40 }, gain: 0.5, attack: 0.04, detune: 25 }) },
      { id: 'corredor.ofegante', label: 'Ofegante', dur: 2.2, play: (c, t) => { for (let i = 0; i < 4; i++) breath(c, t + i * 0.55, 0.5, [900, 1900], 1.4, 0.55) } },
      { id: 'corredor.rosnado', label: 'Rosnado curto', dur: 0.5, play: (c, t) => voice(c, t, { dur: 0.5, f0: [[0, 150], [0.4, 300], [1, 120]], noise: 0.65, formants: FORM_GROWL, drive: 4, gain: 0.55, attack: 0.02, release: 0.2 }) },
    ],
  },
  {
    id: 'espreitador', label: 'Espreitador',
    sounds: [
      { id: 'espreitador.respiracao', label: 'Respiração', dur: 3.2, play: (c, t) => { breath(c, t, 1.5, [1800, 900], 1.1, 0.5); breath(c, t + 1.6, 1.5, [900, 2200], 1.1, 0.45) } },
      { id: 'espreitador.sussurro', label: 'Sussurro', dur: 1.8, play: (c, t) => { breath(c, t, 1.7, [1400, 3600], 5, 0.5, rnd(5, 9)); breath(c, t + 0.1, 1.5, [3200, 1500], 6, 0.3, rnd(6, 11)) } },
      { id: 'espreitador.rosnado', label: 'Rosnado baixo', dur: 1.4, play: (c, t) => voice(c, t, { dur: 1.4, f0: [[0, 62], [0.5, 75], [1, 58]], noise: 0.35, formants: [{ f: 300, q: 2.5, g: 1 }, { f: 900, q: 3, g: 0.5 }], drive: 3.5, trem: { rate: 26, depth: 0.28 }, gain: 0.5, attack: 0.2, release: 0.5 }) },
      { id: 'espreitador.estalo', label: 'Estalo de língua', dur: 0.4, play: (c, t) => { click(c, t, 1400, 0.55); click(c, t + 0.16, 1100, 0.45) } },
    ],
  },
  {
    id: 'estalador', label: 'Estalador',
    sounds: [
      { id: 'estalador.cliques', label: 'Cliques', dur: 2.2, play: (c, t) => { let x = 0; for (let i = 0; i < 8; i++) { click(c, t + x, rnd(1900, 3300), rnd(0.5, 0.75)); x += rnd(0.12, 0.34) } } },
      { id: 'estalador.cliques-rapidos', label: 'Cliques rápidos (viu você)', dur: 1.6, play: (c, t) => { let x = 0; for (let i = 0; i < 16; i++) { click(c, t + x, rnd(2200, 3600), rnd(0.55, 0.85)); x += rnd(0.05, 0.11) } } },
      { id: 'estalador.grito', label: 'Grito', dur: 1.5, play: (c, t) => voice(c, t, { dur: 1.5, f0: [[0, 1100], [0.25, 1900 * rnd(0.92, 1.1)], [1, 1250]], noise: 0.35, formants: [{ f: 1500, q: 5, g: 1 }, { f: 3100, q: 6, g: 0.7 }], drive: 4, vib: { rate: 30, depth: 55 }, gain: 0.45, attack: 0.03, detune: 38, release: 0.5 }) },
      { id: 'estalador.agonia', label: 'Agonia', dur: 1.8, play: (c, t) => { voice(c, t, { dur: 1.8, f0: [[0, 700], [1, 160]], noise: 0.4, formants: FORM_SCREAM, drive: 3, vib: { rate: 9, depth: 30 }, gain: 0.45, release: 0.8 }); click(c, t + 0.1, 2400, 0.5); click(c, t + 0.4, 2000, 0.4) } },
    ],
  },
  {
    id: 'tropego', label: 'Trôpego',
    sounds: [
      { id: 'tropego.gemido', label: 'Gemido', dur: 2.2, play: (c, t) => voice(c, t, { dur: 2.2, f0: [[0, 72], [0.45, 98 * rnd(0.9, 1.1)], [1, 58]], noise: 0.25, formants: FORM_MOAN, drive: 2.2, vib: { rate: 4.2, depth: 6 }, gain: 0.5, attack: 0.25, release: 0.9, sub: 0.3 }) },
      { id: 'tropego.gargarejo', label: 'Gargarejo molhado', dur: 1.4, play: (c, t) => voice(c, t, { dur: 1.4, f0: [[0, 85], [0.5, 110], [1, 70]], noise: 0.7, formants: [{ f: 600, q: 4, g: 1 }, { f: 1300, q: 4, g: 0.6 }], drive: 3, trem: { rate: 19, depth: 0.35 }, gain: 0.5, attack: 0.1, release: 0.5 }) },
      { id: 'tropego.estouro', label: 'Bolsa de esporos estourando', dur: 1.1, play: (c, t) => { thud(c, t, 90, 0.7, 0.4); breath(c, t, 0.7, [4200, 300], 0.7, 0.7); for (let i = 0; i < 5; i++) click(c, t + 0.1 + i * 0.07, rnd(500, 900), 0.25) } },
      { id: 'tropego.arrastar', label: 'Passos arrastados', dur: 2.0, play: (c, t) => { for (let i = 0; i < 3; i++) breath(c, t + i * 0.65, 0.45, [500, 220], 0.8, 0.55) } },
    ],
  },
  {
    id: 'baiacu', label: 'Baiacu',
    sounds: [
      { id: 'baiacu.rugido', label: 'Rugido', dur: 2.4, play: (c, t) => voice(c, t, { dur: 2.4, f0: [[0, 48], [0.3, 66 * rnd(0.92, 1.1)], [1, 40]], noise: 0.4, formants: FORM_DEEP, drive: 6, vib: { rate: 17, depth: 5 }, trem: { rate: 12, depth: 0.2 }, gain: 0.7, attack: 0.15, release: 0.9, sub: 0.6, detune: 9 }) },
      { id: 'baiacu.grunhido', label: 'Grunhido grave', dur: 1.2, play: (c, t) => voice(c, t, { dur: 1.2, f0: [[0, 55], [0.5, 72], [1, 50]], noise: 0.45, formants: FORM_DEEP, drive: 5, gain: 0.6, attack: 0.1, release: 0.5, sub: 0.5 }) },
      { id: 'baiacu.passos', label: 'Passos pesados', dur: 2.2, play: (c, t) => { for (let i = 0; i < 4; i++) thud(c, t + i * 0.55, rnd(70, 90), 0.85, 0.5) } },
      { id: 'baiacu.arremesso', label: 'Arremesso de esporos', dur: 1.3, play: (c, t) => { breath(c, t, 0.6, [300, 3500], 0.8, 0.7); thud(c, t + 0.6, 80, 0.8, 0.5); breath(c, t + 0.62, 0.7, [3000, 200], 0.7, 0.6) } },
    ],
  },
  {
    id: 'zumbi', label: 'Zumbi comum',
    sounds: [
      { id: 'zumbi.gemido', label: 'Gemido', dur: 2.0, play: (c, t) => voice(c, t, { dur: 2.0, f0: [[0, 118], [0.4, 150 * rnd(0.9, 1.12)], [1, 92]], noise: 0.3, formants: [{ f: 520, q: 3, g: 1 }, { f: 1250, q: 4, g: 0.55 }, { f: 2400, q: 4, g: 0.2 }], drive: 2, vib: { rate: 5, depth: 8 }, gain: 0.5, attack: 0.2, release: 0.8 }) },
      { id: 'zumbi.grunhido', label: 'Grunhido', dur: 0.8, play: (c, t) => voice(c, t, { dur: 0.8, f0: [[0, 105], [0.5, 135], [1, 90]], noise: 0.5, formants: FORM_GROWL, drive: 3, gain: 0.55, attack: 0.05, release: 0.3 }) },
      { id: 'zumbi.rouco', label: 'Grito rouco', dur: 1.3, play: (c, t) => voice(c, t, { dur: 1.3, f0: [[0, 260], [0.3, 520 * rnd(0.9, 1.1)], [1, 300]], noise: 0.65, formants: [{ f: 800, q: 3, g: 1 }, { f: 1900, q: 4, g: 0.6 }], drive: 4, vib: { rate: 11, depth: 25 }, gain: 0.5, release: 0.5 }) },
      { id: 'zumbi.mastigando', label: 'Mastigando', dur: 1.8, play: (c, t) => { for (let i = 0; i < 7; i++) { breath(c, t + i * 0.24, 0.18, [700, 400], 1.6, 0.5); thud(c, t + i * 0.24 + 0.03, 150, 0.22, 0.12) } } },
    ],
  },
]

const BY_ID = new Map<string, SoundDef>(SOUND_GROUPS.flatMap((g) => g.sounds.map((s) => [s.id, s] as const)))

export function soundDef(id: string): SoundDef | undefined {
  return BY_ID.get(id)
}

function makeNoise(a: BaseAudioContext): AudioBuffer {
  const nb = a.createBuffer(1, a.sampleRate * 3, a.sampleRate)
  const nd = nb.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  return nb
}

function makeReverb(a: BaseAudioContext): AudioBuffer {
  const len = Math.floor(a.sampleRate * 1.8)
  const ir = a.createBuffer(2, len, a.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6)
  }
  return ir
}

/** Monta a saída de um som (distância: filtro, volume e eco) e toca. */
function startSound(a: BaseAudioContext, def: SoundDef, dest: AudioNode, wetDest: AudioNode, noise: AudioBuffer, volume: number, distance: SoundDistance, when: number): () => void {
  const bus = a.createGain()
  const lp = a.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = distance === 0 ? 20000 : distance === 1 ? 3200 : 1200
  const dry = a.createGain()
  dry.gain.value = Math.max(0, Math.min(1, volume)) * (distance === 0 ? 1 : distance === 1 ? 0.6 : 0.35)
  const wet = a.createGain()
  wet.gain.value = distance === 0 ? 0.12 : distance === 1 ? 0.3 : 0.5
  bus.connect(lp)
  lp.connect(dry).connect(dest)
  lp.connect(wet).connect(wetDest)
  def.play({ ac: a as AudioContext, out: bus, noise }, when)
  return () => { try { bus.disconnect(); lp.disconnect(); dry.disconnect(); wet.disconnect() } catch { /* já solto */ } }
}

/** Toca um som já (volume 0–1; distância: perto, longe ou muito longe). */
export function playCreatureSound(id: string, volume = 0.8, distance: SoundDistance = 0): void {
  const def = BY_ID.get(id)
  const a = audio()
  if (!def || !a || !master || !reverb || !noiseBuf) return
  if (a.state === 'suspended') void a.resume()
  const free = startSound(a, def, master, reverb, noiseBuf, volume, distance, a.currentTime + 0.03)
  window.setTimeout(free, (def.dur + 2.5) * 1000)
}

/** Gera o som em memória (sem tocar), pra conferir ou guardar. */
export async function renderCreatureSound(id: string, volume = 0.8, distance: SoundDistance = 0, sampleRate = 22050): Promise<AudioBuffer | null> {
  const def = BY_ID.get(id)
  if (!def) return null
  const secs = def.dur + 2.2
  const off = new OfflineAudioContext(2, Math.ceil(secs * sampleRate), sampleRate)
  const m = off.createGain(); m.gain.value = 0.9
  const comp = off.createDynamicsCompressor()
  comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.25
  m.connect(comp).connect(off.destination)
  const rv = off.createConvolver(); rv.buffer = makeReverb(off); rv.connect(m)
  startSound(off, def, m, rv, makeNoise(off), volume, distance, 0.03)
  return off.startRendering()
}
