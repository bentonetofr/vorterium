import type { DiceVoice, Hiss, Partial_ } from './sound'

// ────────────────────────────────────────────────────────
// Batidas gravadas dos dados (public/sons/dados/<banco>/<banco>-NN.wav). Cada banco é um material; a batida sorteia um arquivo
// do banco, muda o tom um pouco (a "afinação" do conjunto e a variação de cada batida) e o volume segue a força.
// As vozes da coleção (sound.ts) escolhem o banco e o tom, e podem manter uma parte da camada sintetizada do material
// (o sino que fica soando, o chiado da brasa, o trovão) por cima da gravação. Tudo isto é dado puro, para poder ser testado.
//
// Conforto: nada passa de 1,1× o tom gravado (acelerar a gravação deixa o som fino e agudo), cada conjunto fecha o agudo no
// seu "tom" (o corte do filtro): os mais brilhantes soam mais abafados, porque o ouvido sente os agudos bem mais altos.
// Origem e licenças: public/sons/dados/CREDITOS.txt.
// ────────────────────────────────────────────────────────

export type SampleBank = 'madeira' | 'dado' | 'pedra' | 'metal' | 'vidro' | 'suave' | 'papel' | 'sino' | 'ceramica'

/** Quantos arquivos cada banco tem (os nomes são `<banco>-01.wav`, `<banco>-02.wav`...). */
export const BANK_SIZE: Record<SampleBank, number> = {
  madeira: 22, dado: 17, pedra: 10, metal: 14, vidro: 6, suave: 7, papel: 5, sino: 4, ceramica: 10,
}

export function bankFiles(bank: SampleBank): string[] {
  return Array.from({ length: BANK_SIZE[bank] }, (_, i) => `${bank}-${String(i + 1).padStart(2, '0')}.wav`)
}

export function bankUrl(bank: SampleBank, file: string): string {
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/'
  return `${base}sons/dados/${bank}/${file}`.replace(/\/{2,}/g, '/')
}

/** Limites de conforto. */
export const MAX_RATE = 1.1
export const MAX_TONE = 3600
export const LAYER_TOP_HZ = 2400

/** Como uma voz usa as gravações. */
export interface SamplePlan {
  bank: SampleBank
  /** Tom: 1 = como gravado; menor = mais grave e mais comprido. Nunca passa de MAX_RATE. */
  rate: number
  /** Volume da gravação (1 = normal). */
  gain: number
  /** Quanto da ressonância sintetizada da voz continua por cima (0 = só a gravação). */
  ring: number
  /** Quanto do sopro sintetizado da voz continua por cima. */
  hiss: number
  /** Corte do agudo desta voz, em Hz (menor = mais abafado e macio). */
  tone: number
}

const plan = (bank: SampleBank, rate = 1, ring = 0, hiss = 0, gain = 1, tone = MAX_TONE): SamplePlan => ({ bank, rate, gain, ring, hiss, tone })

/** A madeira velha (sem voz): a batida padrão. Dado com dado usa o estalo da resina. */
const DEFAULT_PLAN = plan('madeira', 1, 0, 0, 1, 3600)
const DIE_ON_DIE = plan('dado', 1, 0, 0, 0.9, 3200)

export const VOICE_SAMPLES: Record<DiceVoice, SamplePlan> = {
  // ── os conjuntos iniciais ──
  granito: plan('pedra', 1, 0, 0, 1, 3200),
  plastico: plan('ceramica', 0.95, 0, 0, 1, 3000),
  betinha: plan('suave', 1.1, 0.5, 0, 0.9),
  // ── a primeira leva ──
  osso: plan('ceramica', 0.85, 0, 0, 1, 2800),
  ferro: plan('metal', 0.8, 0.25, 0, 1, 2600),
  argila: plan('suave', 1),
  giz: plan('papel', 1, 0, 1, 0.8, 2600),
  cobre: plan('metal', 1, 0.4, 0, 0.85, 2600),
  marfim: plan('ceramica', 1.05, 0, 0, 1, 2800),
  onix: plan('pedra', 1, 0, 0, 1, 3000),
  ametista: plan('vidro', 0.95, 0.6, 0, 1, 2600),
  granada: plan('vidro', 0.88, 0.6, 0, 1, 2600),
  jade: plan('ceramica', 0.8, 0.6, 0, 1, 2600),
  fume: plan('vidro', 0.8, 0.5, 0.4, 1, 2400),
  gelo: plan('vidro', 0.95, 0.5, 0.4, 1, 2300),
  magma: plan('pedra', 0.85, 0.8, 0.8, 1, 3000),
  meteorito: plan('pedra', 0.7, 0.8),
  fungo: plan('suave', 0.85, 0.7, 0.4),
  ambar: plan('madeira', 0.92, 0.5),
  morte: plan('pedra', 0.65, 0.8, 0, 0.8),
  vagalumes: plan('vidro', 1, 0.8, 0, 1, 2300),
  runico: plan('metal', 0.95, 0.8, 0, 1, 2600),
  vortice: plan('madeira', 0.9, 0.8, 0.8),
  // ── a segunda leva ──
  cortica: plan('suave', 1.1, 0.3),
  cera: plan('suave', 0.85),
  vidro: plan('vidro', 1, 0.5, 0, 1, 2400),
  papel: plan('papel', 1, 0, 0.8, 1, 2800),
  sino: plan('sino', 1, 0.6, 0, 0.7),
  relogio: plan('metal', 1.05, 0.6, 0, 0.85, 2600),
  perola: plan('ceramica', 1.05, 0.5, 0, 0.85, 2600),
  trovao: plan('pedra', 0.6, 0.8, 0.8),
  olho: plan('suave', 0.75, 0.6, 0.5),
  cosmos: plan('vidro', 0.95, 0.8, 0, 1, 2500),
  dragao: plan('pedra', 0.65, 0.8, 0.8),
  espelho: plan('vidro', 0.95, 0.8, 0, 1, 2200),
  vazio: plan('suave', 0.6, 0.8, 0, 0.5),
  prisma: plan('vidro', 1, 0.8, 0, 1, 2400),
}

/** Que gravação usar numa batida: a madeira velha e as vozes de madeira passam para o estalo da resina quando é dado com dado. */
export function samplePlan(voice: DiceVoice | undefined, withDie: boolean): SamplePlan {
  const p = voice && VOICE_SAMPLES[voice] ? VOICE_SAMPLES[voice] : DEFAULT_PLAN
  if (withDie && p.bank === 'madeira') return { ...DIE_ON_DIE, ring: p.ring, hiss: p.hiss, rate: DIE_ON_DIE.rate * (p.rate < 1 ? 0.92 : 1) }
  return p
}

/** Volume de uma batida pela força (0 a 1): curva suave, nunca zero. */
export function hitGain(strength: number): number {
  const s = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 0
  return 0.1 + Math.pow(s, 0.85) * 0.9
}

/** Brilho da batida: as fracas perdem os agudos (corte do filtro, em Hz). Nunca passa de 5,5 kHz: o agudo cortante cansa o ouvido. */
export function hitBrightness(strength: number): number {
  const s = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 0
  return 2200 + s * 3300
}

/** Corte final do filtro de uma batida: o brilho da força, limitado pelo tom da voz. */
export function hitCutoff(strength: number, tone: number): number {
  return Math.min(hitBrightness(strength), tone)
}

/** Dobra um apito sintético para uma oitava mais grave até caber abaixo de LAYER_TOP_HZ (o mesmo "tom", sem o agudo fino). */
export function softenPartial(p: Partial_): Partial_ {
  let k = 1
  while (p.freq * k > LAYER_TOP_HZ) k /= 2
  if (k === 1) return p
  return { ...p, freq: p.freq * k, to: p.to ? p.to * k : undefined, gain: p.gain * 0.85 }
}

/** O chiado sintético sem o agudo: o que era filtro de agudos vira uma faixa média, e nenhum passa de 3,2 kHz. */
export function softenHiss(h: Hiss): Hiss {
  if (h.type === 'highpass') return { ...h, type: 'bandpass', cutoff: Math.min(h.cutoff, 2400), q: Math.min(h.q, 0.8) }
  return { ...h, cutoff: Math.min(h.cutoff, 3200) }
}
