import { soundVolume } from '../settings/settingsStore'
import type { Tier } from '../dice3d/skins'

// ────────────────────────────────────────────────────────
// O som da conquista: um arpejo que sobe, mais longo e mais cheio quanto mais rara a raridade, com um brilho agudo por cima
// e (nas épicas e nas lendárias) um "trovão" grave de entrada. A mítica tem tudo isso e mais: o arpejo sobe duas vezes e
// fecha num acorde largo com um coro agudo que demora a sumir. Gerado na hora com Web Audio (sem arquivo). Se o navegador
// bloquear o áudio, só não toca.
// ────────────────────────────────────────────────────────

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

function tone(ac: AudioContext, out: AudioNode, freq: number, at: number, dur: number, type: OscillatorType, peak: number) {
  const osc = ac.createOscillator(), gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, at)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(gain).connect(out)
  osc.start(at); osc.stop(at + dur + 0.05)
}

// Dó maior pentatônica, subindo
const SCALE = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093, 2637]
const NOTES: Record<Tier, number> = { comum: 3, incomum: 4, rara: 5, epica: 7, lendaria: 8, mitica: 16 }

export function playUnlockSound(tier: Tier): void {
  const ac = audio()
  if (!ac) return
  const master = ac.createGain()
  master.gain.value = 0.3 * soundVolume('dice')
  master.connect(ac.destination)
  const t = ac.currentTime + 0.03
  if (tier === 'epica' || tier === 'lendaria' || tier === 'mitica') {
    // trovão grave de entrada
    const osc = ac.createOscillator(), g = ac.createGain()
    osc.type = 'sine'; osc.frequency.setValueAtTime(110, t); osc.frequency.exponentialRampToValueAtTime(42, t + 0.6)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75)
    osc.connect(g).connect(master); osc.start(t); osc.stop(t + 0.8)
  }
  const n = NOTES[tier]
  for (let i = 0; i < n; i++) {
    const f = SCALE[i % SCALE.length], at = t + 0.1 + i * 0.085
    tone(ac, master, f, at, 0.55, 'triangle', 0.32)
    tone(ac, master, f * 2, at, 0.3, 'sine', 0.09)
  }
  // o acorde final, aberto
  const end = t + 0.1 + n * 0.085
  for (const f of [SCALE[0], SCALE[2], SCALE[3]]) tone(ac, master, f, end, 1.1, 'sine', 0.22)
  if (tier !== 'comum') tone(ac, master, 3136, end, 0.9, 'sine', 0.08)
  if (tier === 'mitica') {
    // o acorde largo (com a oitava de baixo) e o coro agudo, levemente desafinado, que fica no ar
    for (const f of [130.81, 261.63, 392, 659.25]) tone(ac, master, f, end, 2.2, 'triangle', 0.16)
    for (const f of [2093, 2100, 2637, 3136, 3951]) tone(ac, master, f, end + 0.12, 2.6, 'sine', 0.05)
  }
}
