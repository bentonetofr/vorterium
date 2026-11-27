import type { DiceVoice } from './sound'

// ────────────────────────────────────────────────────────
// Batidas gravadas dos dados (public/sons/dados/<banco>/<banco>-NN.wav). Cada banco é um material; a batida sorteia um arquivo
// do banco, muda o tom um pouco (a "afinação" do conjunto e a variação de cada batida) e o volume segue a força.
// As vozes da coleção (sound.ts) escolhem o banco e o tom, e podem manter uma parte da camada sintetizada do material
// (o sino que fica soando, o chiado da brasa, o trovão) por cima da gravação. Tudo isto é dado puro, para poder ser testado.
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

/** Como uma voz usa as gravações. */
export interface SamplePlan {
  bank: SampleBank
  /** Tom: 1 = como gravado; menor = mais grave e mais comprido. */
  rate: number
  /** Volume da gravação (1 = normal). */
  gain: number
  /** Quanto da ressonância sintetizada da voz continua por cima (0 = só a gravação). */
  ring: number
  /** Quanto do sopro sintetizado da voz continua por cima. */
  hiss: number
}

const plan = (bank: SampleBank, rate = 1, ring = 0, hiss = 0, gain = 1): SamplePlan => ({ bank, rate, gain, ring, hiss })

/** A madeira velha (sem voz): a batida padrão. Dado com dado usa o estalo da resina. */
const DEFAULT_PLAN = plan('madeira')
const DIE_ON_DIE = plan('dado', 1, 0, 0, 0.95)

export const VOICE_SAMPLES: Record<DiceVoice, SamplePlan> = {
  // ── os conjuntos iniciais ──
  granito: plan('pedra', 1),
  plastico: plan('ceramica', 0.95),
  betinha: plan('suave', 1.35, 0.6),
  // ── a primeira leva ──
  osso: plan('ceramica', 0.82),
  ferro: plan('metal', 0.8, 0.25),
  argila: plan('suave', 1.1),
  giz: plan('papel', 1.25, 0, 1),
  cobre: plan('metal', 1.3, 0.5),
  marfim: plan('ceramica', 1.15),
  onix: plan('pedra', 1.15),
  ametista: plan('vidro', 1, 0.8),
  granada: plan('vidro', 0.88, 0.8),
  jade: plan('ceramica', 0.78, 0.7),
  fume: plan('vidro', 0.75, 0.6, 0.6),
  gelo: plan('vidro', 1.25, 0.8, 0.6),
  magma: plan('pedra', 0.8, 1, 1),
  meteorito: plan('pedra', 0.68, 1),
  fungo: plan('suave', 0.8, 0.8, 0.5),
  ambar: plan('madeira', 0.9, 0.5),
  morte: plan('pedra', 0.6, 1, 0, 0.8),
  vagalumes: plan('vidro', 1.4, 1),
  runico: plan('metal', 1, 1),
  vortice: plan('madeira', 0.9, 1, 1),
  // ── a segunda leva ──
  cortica: plan('suave', 1.2, 0.3),
  cera: plan('suave', 0.8),
  vidro: plan('vidro', 1.1, 0.6),
  papel: plan('papel', 1, 0, 1),
  sino: plan('sino', 1, 0.8),
  relogio: plan('metal', 1.5, 0.8),
  perola: plan('ceramica', 1.25, 0.7),
  trovao: plan('pedra', 0.55, 1, 1),
  olho: plan('suave', 0.7, 0.8, 0.6),
  cosmos: plan('vidro', 1, 1),
  dragao: plan('pedra', 0.6, 1, 1),
  espelho: plan('vidro', 1.3, 1),
  vazio: plan('suave', 0.5, 1, 0, 0.45),
  prisma: plan('vidro', 1.2, 1),
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

/** Brilho da batida: as fracas perdem os agudos (corte do filtro, em Hz). Nunca passa de 7,5 kHz: o agudo cortante cansa o ouvido. */
export function hitBrightness(strength: number): number {
  const s = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 0
  return 2400 + s * 5100
}
