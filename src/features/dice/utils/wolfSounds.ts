// ────────────────────────────────────────────────────────
// Sons dos lobos do crítico — gerados na hora com Web Audio (sem arquivo,
// sem download). Os tempos batem com as animações de 2,5 s (CritWolf.css):
//  • Crítico: arpejo brilhante quando o lobo branco entra e um latidinho
//    feliz quando ele abre o sorriso (≈0,55 s).
//  • Falha crítica: pancada grave e sombria quando o lobo preto entra e um
//    rosnado quando a raiva chega (≈0,9 s), tremendo até ele sumir.
// Se o navegador bloquear o áudio (a pessoa ainda não clicou na página),
// só não toca — a animação aparece do mesmo jeito.
// ────────────────────────────────────────────────────────

const MASTER_VOLUME = 0.35

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

function output(ac: AudioContext): GainNode {
  const master = ac.createGain()
  master.gain.value = MASTER_VOLUME
  master.connect(ac.destination)
  return master
}

/** Nota curta com ataque rápido e cauda suave. */
function tone(ac: AudioContext, out: AudioNode, freq: number, at: number, dur: number, type: OscillatorType, peak: number) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, at)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(gain).connect(out)
  osc.start(at)
  osc.stop(at + dur + 0.05)
}

/** Ruído branco (pro rosnado e pro impacto). */
function noise(ac: AudioContext, seconds: number): AudioBufferSourceNode {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * seconds), ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buffer
  return src
}

/** Crítico: arpejo de brilho + latidinho feliz. */
export function playCriticalSound() {
  const ac = audio()
  if (!ac) return
  const out = output(ac)
  const t = ac.currentTime + 0.02

  // Arpejo subindo (dó maior) com um "brilho" agudo por cima.
  ;[1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
    tone(ac, out, f, t + i * 0.07, 0.5, 'triangle', 0.35)
    tone(ac, out, f * 2, t + i * 0.07, 0.25, 'sine', 0.08)
  })
  tone(ac, out, 3136, t + 0.32, 0.6, 'sine', 0.06)

  // Latidinho feliz quando ele sorri: dois "yips" subindo e descendo.
  ;[0.55, 0.75].forEach((offset, i) => {
    const at = t + offset
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    const filter = ac.createBiquadFilter()
    osc.type = 'sawtooth'
    filter.type = 'lowpass'
    filter.frequency.value = 2400
    const base = i === 0 ? 620 : 700
    osc.frequency.setValueAtTime(base, at)
    osc.frequency.exponentialRampToValueAtTime(base * 1.7, at + 0.06)
    osc.frequency.exponentialRampToValueAtTime(base * 1.1, at + 0.16)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.28, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18)
    osc.connect(filter).connect(gain).connect(out)
    osc.start(at)
    osc.stop(at + 0.22)
  })
}

/** Falha crítica: impacto grave + rosnado tremido. */
export function playFumbleSound() {
  const ac = audio()
  if (!ac) return
  const out = output(ac)
  const t = ac.currentTime + 0.02

  // Impacto: baixo que cai + estouro abafado.
  const boom = ac.createOscillator()
  const boomGain = ac.createGain()
  boom.type = 'sine'
  boom.frequency.setValueAtTime(90, t)
  boom.frequency.exponentialRampToValueAtTime(38, t + 0.9)
  boomGain.gain.setValueAtTime(0.0001, t)
  boomGain.gain.exponentialRampToValueAtTime(0.9, t + 0.02)
  boomGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
  boom.connect(boomGain).connect(out)
  boom.start(t)
  boom.stop(t + 1.2)

  const hit = noise(ac, 0.6)
  const hitFilter = ac.createBiquadFilter()
  const hitGain = ac.createGain()
  hitFilter.type = 'lowpass'
  hitFilter.frequency.value = 400
  hitGain.gain.setValueAtTime(0.5, t)
  hitGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
  hit.connect(hitFilter).connect(hitGain).connect(out)
  hit.start(t)

  // Rosnado quando a raiva chega: ruído + serra grave, com tremor rápido.
  const g0 = t + 0.85
  const dur = 1.3
  const growlGain = ac.createGain()
  growlGain.gain.setValueAtTime(0.0001, g0)
  growlGain.gain.exponentialRampToValueAtTime(0.6, g0 + 0.12)
  growlGain.gain.setValueAtTime(0.6, g0 + dur - 0.35)
  growlGain.gain.exponentialRampToValueAtTime(0.0001, g0 + dur)

  const tremolo = ac.createGain()
  tremolo.gain.value = 0.55
  const lfo = ac.createOscillator()
  const lfoDepth = ac.createGain()
  lfo.frequency.value = 22
  lfoDepth.gain.value = 0.45
  lfo.connect(lfoDepth).connect(tremolo.gain)

  const saw = ac.createOscillator()
  saw.type = 'sawtooth'
  saw.frequency.setValueAtTime(78, g0)
  saw.frequency.linearRampToValueAtTime(64, g0 + dur)
  const sawFilter = ac.createBiquadFilter()
  sawFilter.type = 'lowpass'
  sawFilter.frequency.value = 520
  const sawGain = ac.createGain()
  sawGain.gain.value = 0.5

  const rasp = noise(ac, dur + 0.1)
  const raspFilter = ac.createBiquadFilter()
  raspFilter.type = 'bandpass'
  raspFilter.frequency.value = 260
  raspFilter.Q.value = 2.5
  const raspGain = ac.createGain()
  raspGain.gain.value = 0.9

  saw.connect(sawFilter).connect(sawGain).connect(tremolo)
  rasp.connect(raspFilter).connect(raspGain).connect(tremolo)
  tremolo.connect(growlGain).connect(out)

  lfo.start(g0)
  saw.start(g0)
  rasp.start(g0)
  const end = g0 + dur + 0.05
  lfo.stop(end)
  saw.stop(end)
  rasp.stop(end)
}
