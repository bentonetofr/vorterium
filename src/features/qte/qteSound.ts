import { soundVolume } from '../settings/settingsStore'

// ────────────────────────────────────────────────────────
// Sons da Cena a dois, gerados na hora com Web Audio (sem arquivo para
// baixar), no mesmo jeito dos outros joguinhos. Acerto = batida de
// impacto (pancada grave + estalo); falha = pancada surda e rouca.
// Respeita o volume de "jogos" das configurações; se o navegador não
// deixar tocar (precisa de um toque antes) ou não tiver Web Audio, fica mudo.
// ────────────────────────────────────────────────────────

const MASTER = 0.5

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuf: AudioBuffer | null = null

function audio(): AudioContext | null {
  const vol = soundVolume('game')
  if (vol === 0) return null
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!ctx) {
      ctx = new Ctor()
      master = ctx.createGain()
      master.connect(ctx.destination)
    }
    if (master) master.gain.value = MASTER * vol
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

/** Prepara o áudio (chame num toque/clique, p. ex. ao abrir a cena) para o primeiro som não atrasar. */
export function warmUpQteSound(): void {
  audio()
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

function thump(ac: AudioContext, at: number, from: number, to: number, dur: number, peak: number, type: OscillatorType = 'sine') {
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + dur)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(g).connect(master!)
  osc.start(at)
  osc.stop(at + dur + 0.03)
}

function burst(ac: AudioContext, at: number, dur: number, peak: number, filter: BiquadFilterType, freq: number, q = 1) {
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer(ac)
  const f = ac.createBiquadFilter()
  f.type = filter
  f.frequency.value = freq
  f.Q.value = q
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(f).connect(g).connect(master!)
  src.start(at, Math.random() * 0.5)
  src.stop(at + dur + 0.03)
}

/**
 * Impacto de uma tecla. `volume` de 0 a 1 (a sua tecla toca cheia; a do outro
 * jogador, para quem assiste, mais baixa). Cada batida muda um pouquinho de
 * tom para não soar repetida.
 */
export function playQteImpact(kind: 'hit' | 'miss', volume = 1): void {
  const ac = audio()
  if (!ac || !master || volume <= 0) return
  const t = ac.currentTime + 0.003
  const v = Math.min(1, volume)
  const wob = 0.92 + Math.random() * 0.16
  try {
    if (kind === 'hit') {
      thump(ac, t, 190 * wob, 42, 0.2, 0.55 * v)                  // a pancada grave
      thump(ac, t, 520 * wob, 120, 0.06, 0.18 * v, 'triangle')     // o corpo do soco
      burst(ac, t, 0.1, 0.32 * v, 'lowpass', 1100, 1.2)            // o baque abafado
      burst(ac, t, 0.025, 0.2 * v, 'highpass', 3200)               // o estalo da batida
    } else {
      thump(ac, t, 130 * wob, 48, 0.26, 0.4 * v, 'sawtooth')       // pancada surda e rouca
      burst(ac, t, 0.14, 0.25 * v, 'lowpass', 420, 1)
    }
  } catch { /* sem áudio */ }
}
