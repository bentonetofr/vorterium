// ────────────────────────────────────────────────────────
// Os sons dos joguinhos (o Livro Bloqueado e a Torre do Observatório) —
// gerados na hora com Web Audio (sem arquivo, sem download), no mesmo
// jeito dos lobos do crítico (dice/utils/wolfSounds). Cada som é uma
// receita curta: osciladores e ruído filtrado com envelope.
//
// O navegador só deixa tocar depois de um clique: o cartão "Clique para
// entrar" já destrava. Se bloquear, só não toca. Dá pra desligar no menu ≡
// (fica guardado neste aparelho).
// ────────────────────────────────────────────────────────

export type SoundName =
  | 'click' | 'step' | 'stepMetal' | 'open' | 'close' | 'ok' | 'bad'
  | 'mirror' | 'crank' | 'latch' | 'unlock' | 'push' | 'tap' | 'grind'
  | 'sparkle' | 'bell' | 'gear' | 'hint' | 'finale'
  // o Livro
  | 'candle' | 'wax' | 'spin' | 'slide' | 'tumble' | 'drawer' | 'medal' | 'chain' | 'tighten' | 'bookOpen'

const KEY = 'vorterium:jogos-som'
const VOLUME = 0.32

let ctx: AudioContext | null = null
let master: GainNode | null = null
let ambient: { stop: () => void } | null = null
let muted = (() => { try { return localStorage.getItem(KEY) === 'off' } catch { return false } })()
const listeners = new Set<(on: boolean) => void>()

function audio(): AudioContext | null {
  if (muted) return null
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!ctx) {
      ctx = new Ctor()
      master = ctx.createGain()
      master.gain.value = VOLUME
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

// ── Peças ───────────────────────────────────────────────

function tone(ac: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, peak: number, endFreq?: number) {
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, at)
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, at + dur)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(g).connect(master!)
  osc.start(at)
  osc.stop(at + dur + 0.05)
}

let noiseBuf: AudioBuffer | null = null
function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

function noise(ac: AudioContext, at: number, dur: number, peak: number, filter: BiquadFilterType, freq: number, q = 1) {
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer(ac)
  const f = ac.createBiquadFilter()
  f.type = filter
  f.frequency.value = freq
  f.Q.value = q
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(f).connect(g).connect(master!)
  src.start(at, Math.random())
  src.stop(at + dur + 0.05)
}

// ── As receitas ─────────────────────────────────────────

const RECIPES: Record<SoundName, (ac: AudioContext, t: number) => void> = {
  // botão: estalinho seco
  click: (ac, t) => { tone(ac, 1800, t, 0.03, 'square', 0.05); noise(ac, t, 0.02, 0.06, 'highpass', 3000) },
  // passo na pedra: batida abafada (cada um um pouco diferente)
  step: (ac, t) => { noise(ac, t, 0.07, 0.12, 'lowpass', 380 + Math.random() * 160, 2); tone(ac, 90 + Math.random() * 20, t, 0.05, 'sine', 0.06) },
  // passo na grade de ferro: o mesmo, com um tinido
  stepMetal: (ac, t) => { noise(ac, t, 0.06, 0.1, 'lowpass', 500, 2); tone(ac, 620 + Math.random() * 80, t, 0.12, 'triangle', 0.025) },
  // abrir a janela de um objeto: sopro subindo
  open: (ac, t) => { noise(ac, t, 0.22, 0.06, 'bandpass', 900, 0.8); tone(ac, 330, t, 0.18, 'sine', 0.035, 520) },
  close: (ac, t) => { noise(ac, t, 0.16, 0.05, 'bandpass', 700, 0.8); tone(ac, 440, t, 0.14, 'sine', 0.03, 300) },
  // deu certo: dois sininhos
  ok: (ac, t) => { tone(ac, 784, t, 0.35, 'triangle', 0.07); tone(ac, 1175, t + 0.08, 0.45, 'triangle', 0.06) },
  // não deu: batida grave
  bad: (ac, t) => { tone(ac, 140, t, 0.28, 'sawtooth', 0.06, 80); noise(ac, t, 0.12, 0.07, 'lowpass', 300) },
  // espelho girando no eixo: tique metálico
  mirror: (ac, t) => { tone(ac, 2400, t, 0.05, 'square', 0.03); tone(ac, 1600, t + 0.02, 0.08, 'triangle', 0.04) },
  // manivela: catraca (três dentes)
  crank: (ac, t) => { for (let i = 0; i < 3; i++) { noise(ac, t + i * 0.05, 0.03, 0.12, 'bandpass', 1400, 3); tone(ac, 260, t + i * 0.05, 0.04, 'square', 0.02) } },
  // argola do trinco
  latch: (ac, t) => { tone(ac, 1250, t, 0.08, 'triangle', 0.05); noise(ac, t, 0.04, 0.06, 'highpass', 2500) },
  // trinco cede / chave gira: clanque e eco
  unlock: (ac, t) => { noise(ac, t, 0.1, 0.14, 'bandpass', 900, 2); tone(ac, 220, t, 0.3, 'square', 0.04, 160); tone(ac, 880, t + 0.12, 0.5, 'triangle', 0.05) },
  // empurrar o pêndulo: rangido de corda
  push: (ac, t) => { tone(ac, 180, t, 0.6, 'sawtooth', 0.025, 120); noise(ac, t, 0.5, 0.04, 'bandpass', 600, 4) },
  // marcador, casa do Astrário: toque na madeira
  tap: (ac, t) => { tone(ac, 520, t, 0.07, 'sine', 0.06); noise(ac, t, 0.03, 0.05, 'bandpass', 1800, 2) },
  // o mapa girando: pedra arrastando
  grind: (ac, t) => { noise(ac, t, 1.1, 0.09, 'lowpass', 220, 1); tone(ac, 55, t, 1.0, 'sawtooth', 0.03, 48) },
  // estrela acendendo lá em cima
  sparkle: (ac, t) => { [1568, 2093, 2637].forEach((f, i) => tone(ac, f, t + i * 0.05, 0.4, 'sine', 0.035)) },
  // a sombra do pêndulo mostrando algo: sino baixo (o "agora!")
  bell: (ac, t) => { tone(ac, 392, t, 1.2, 'sine', 0.07); tone(ac, 784, t, 0.8, 'sine', 0.025); tone(ac, 1176, t, 0.5, 'sine', 0.012) },
  // girar a metade do Astrário: engrenagem
  gear: (ac, t) => { for (let i = 0; i < 6; i++) noise(ac, t + i * 0.07, 0.03, 0.1, 'bandpass', 1100 - i * 60, 4); tone(ac, 110, t, 0.5, 'sawtooth', 0.03, 90) },
  // dica do mestre: sussurro
  hint: (ac, t) => { noise(ac, t, 0.9, 0.05, 'bandpass', 2200, 6); tone(ac, 660, t + 0.1, 0.9, 'sine', 0.025, 640) },
  // ── o Livro ──
  // vela acendendo: sopro e estalo
  candle: (ac, t) => { noise(ac, t, 0.25, 0.08, 'bandpass', 1200, 1.5); tone(ac, 300, t + 0.02, 0.2, 'sine', 0.03, 520) },
  // cera do pavio se partindo
  wax: (ac, t) => { noise(ac, t, 0.05, 0.14, 'highpass', 2200); noise(ac, t + 0.05, 0.04, 0.08, 'highpass', 3000) },
  // ponteiro do astrolábio girando: zumbido de catraca fina
  spin: (ac, t) => { for (let i = 0; i < 8; i++) noise(ac, t + i * 0.06, 0.02, 0.06, 'bandpass', 2600 - i * 120, 5); tone(ac, 660, t + 0.5, 0.4, 'triangle', 0.04) },
  // livro deslizando pra fora da prateleira
  slide: (ac, t) => { noise(ac, t, 0.3, 0.08, 'lowpass', 900, 1) },
  // os livros voltando todos pro lugar
  tumble: (ac, t) => { for (let i = 0; i < 5; i++) { noise(ac, t + i * 0.07, 0.08, 0.1, 'lowpass', 500 + i * 60, 2); tone(ac, 140 - i * 8, t + i * 0.07, 0.08, 'sine', 0.04) } },
  // gaveta secreta abrindo
  drawer: (ac, t) => { noise(ac, t, 0.5, 0.08, 'lowpass', 600, 1); tone(ac, 90, t, 0.45, 'sawtooth', 0.02, 70); tone(ac, 1400, t + 0.48, 0.12, 'triangle', 0.04) },
  // medalhão saindo da moldura
  medal: (ac, t) => { tone(ac, 1760, t, 0.25, 'triangle', 0.05); tone(ac, 2349, t + 0.06, 0.3, 'sine', 0.035) },
  // corrente caindo no chão de pedra
  chain: (ac, t) => { for (let i = 0; i < 7; i++) { noise(ac, t + i * 0.045, 0.05, 0.12, 'bandpass', 2000 + Math.random() * 1500, 6); tone(ac, 900 + Math.random() * 600, t + i * 0.045, 0.06, 'triangle', 0.02) } },
  // as correntes se apertando de novo
  tighten: (ac, t) => { noise(ac, t, 0.35, 0.1, 'bandpass', 700, 3); tone(ac, 180, t, 0.35, 'sawtooth', 0.04, 120) },
  // o livro se abre: páginas e um acorde quente
  bookOpen: (ac, t) => {
    for (let i = 0; i < 6; i++) noise(ac, t + i * 0.09, 0.12, 0.06, 'highpass', 1800)
    ;[262, 330, 392, 523].forEach((f, i) => tone(ac, f, t + 0.5 + i * 0.12, 2.2, 'triangle', 0.05))
  },
  // a cúpula se abre: acorde grave que vira dissonante
  finale: (ac, t) => {
    noise(ac, t, 2.5, 0.08, 'lowpass', 160, 1)
    ;[98, 147, 196].forEach((f) => tone(ac, f, t, 3.2, 'triangle', 0.06))
    ;[233, 277].forEach((f) => tone(ac, f, t + 1.4, 2.6, 'sine', 0.04))
  },
}

/** Toca um som (se o som estiver ligado). */
export function sfx(name: SoundName) {
  const ac = audio()
  if (!ac || !master) return
  try { RECIPES[name](ac, ac.currentTime + 0.005) } catch { /* sem áudio */ }
}

// ── Ambiente: camadas que se somam (vento na cúpula, zumbido das
// máquinas, velas estalando na biblioteca) ──

export type Ambient = 'vento' | 'maquinas' | 'velas'

export function startAmbient(layers: Ambient[]) {
  stopAmbient()
  const ac = audio()
  if (!ac || !master) return
  try {
    const nodes: AudioScheduledSourceNode[] = []
    const timers: number[] = []
    const out = ac.createGain()
    out.gain.value = 0
    out.gain.linearRampToValueAtTime(1, ac.currentTime + 2)
    out.connect(master)
    if (layers.includes('vento')) {
      // vento: ruído grave com um filtro que respira
      const src = ac.createBufferSource()
      src.buffer = noiseBuffer(ac)
      src.loop = true
      const f = ac.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 340
      const lfo = ac.createOscillator()
      const lg = ac.createGain()
      lfo.frequency.value = 0.08
      lg.gain.value = 180
      lfo.connect(lg).connect(f.frequency)
      const g = ac.createGain()
      g.gain.value = 0.05
      src.connect(f).connect(g).connect(out)
      src.start()
      lfo.start()
      nodes.push(src, lfo)
    }
    if (layers.includes('maquinas')) {
      // máquinas: zumbido grave
      const o = ac.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = 49
      const f = ac.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 120
      const g = ac.createGain()
      g.gain.value = 0.025
      o.connect(f).connect(g).connect(out)
      o.start()
      nodes.push(o)
    }
    if (layers.includes('velas')) {
      // velas: um chiado bem baixo e estalinhos de vez em quando
      const src = ac.createBufferSource()
      src.buffer = noiseBuffer(ac)
      src.loop = true
      const f = ac.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 900
      f.Q.value = 0.7
      const g = ac.createGain()
      g.gain.value = 0.012
      src.connect(f).connect(g).connect(out)
      src.start()
      nodes.push(src)
      const crackle = () => {
        if (muted || !ctx) return
        try { noise(ctx, ctx.currentTime, 0.02, 0.03 + Math.random() * 0.03, 'highpass', 2500) } catch { /* sem áudio */ }
        timers.push(window.setTimeout(crackle, 400 + Math.random() * 2200))
      }
      crackle()
    }
    ambient = {
      stop: () => {
        timers.forEach((t) => window.clearTimeout(t))
        try { out.gain.linearRampToValueAtTime(0, ac.currentTime + 0.4) } catch { /* já parado */ }
        window.setTimeout(() => { nodes.forEach((n) => { try { n.stop() } catch { /* já parado */ } }); out.disconnect() }, 500)
      },
    }
  } catch { /* sem áudio */ }
}

export function stopAmbient() {
  ambient?.stop()
  ambient = null
}

// ── Ligar / desligar ────────────────────────────────────

export function soundOn() { return !muted }

export function setSoundOn(on: boolean) {
  muted = !on
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* sem storage */ }
  if (!on) stopAmbient()
  listeners.forEach((l) => l(on))
}

export function onSoundChange(cb: (on: boolean) => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
