// ────────────────────────────────────────────────────────
// Som dos dados gerado na hora (Web Audio), sem arquivos: cada batida é um
// estalo curto de ruído filtrado, mais agudo quando é dado com dado e com um
// "toc" grave quando é no chão. O volume segue a força da batida.
// ────────────────────────────────────────────────────────

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null
let muted = false

export function setDiceSoundMuted(value: boolean): void { muted = value }

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx ??= new Ctor()
  if (ctx.state === 'suspended') void ctx.resume()
  if (!noise) {
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3)
  }
  return ctx
}

/** Uma batida: força de 0 a 1; `withDie` = dado com dado (mais agudo). */
export function playDiceHit(strength: number, withDie: boolean): void {
  if (muted) return
  const a = audio()
  if (!a || !noise) return
  const t = a.currentTime
  const vol = Math.min(0.9, 0.12 + strength * 0.8)

  const src = a.createBufferSource()
  src.buffer = noise
  src.playbackRate.value = 0.8 + Math.random() * 0.5
  const band = a.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = (withDie ? 3200 : 1700) + Math.random() * 1400
  band.Q.value = withDie ? 6 : 3
  const g = a.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + (withDie ? 0.06 : 0.1))
  src.connect(band).connect(g).connect(a.destination)
  src.start(t)
  src.stop(t + 0.12)

  if (!withDie) {
    const o = a.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(140 + Math.random() * 40, t)
    o.frequency.exponentialRampToValueAtTime(60, t + 0.09)
    const og = a.createGain()
    og.gain.setValueAtTime(vol * 0.55, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    o.connect(og).connect(a.destination)
    o.start(t)
    o.stop(t + 0.11)
  }
}

/** Acorde curto para o crítico (dourado, subindo) ou a falha (grave, caindo). */
export function playDiceFlourish(kind: 'crit' | 'fumble'): void {
  if (muted) return
  const a = audio()
  if (!a) return
  const t = a.currentTime
  const notes = kind === 'crit' ? [523.25, 659.25, 783.99, 1046.5] : [220, 174.61, 130.81]
  notes.forEach((f, i) => {
    const o = a.createOscillator()
    o.type = kind === 'crit' ? 'triangle' : 'sawtooth'
    o.frequency.value = f
    const g = a.createGain()
    const start = t + i * (kind === 'crit' ? 0.07 : 0.11)
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(kind === 'crit' ? 0.18 : 0.12, start + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, start + (kind === 'crit' ? 0.9 : 0.6))
    const lp = a.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = kind === 'crit' ? 6000 : 900
    o.connect(lp).connect(g).connect(a.destination)
    o.start(start)
    o.stop(start + 1)
  })
}
