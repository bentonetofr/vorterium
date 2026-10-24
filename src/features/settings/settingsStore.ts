import { useSyncExternalStore } from 'react'

// ────────────────────────────────────────────────────────
// As configurações do site neste navegador: volume de cada tipo de som e
// opções de acessibilidade. Guardadas no localStorage (valem também fora da
// conta, na tela de entrada) e aplicadas no <html> como atributos, que o
// settings.css lê. Sem React aqui dentro além do hook: roda nos testes.
// ────────────────────────────────────────────────────────

export type SoundChannel = 'dice' | 'notify' | 'chat' | 'game'

export const SOUND_CHANNELS: { id: SoundChannel; label: string; hint: string }[] = [
  { id: 'dice',   label: 'Dados',        hint: 'Batidas, rolagens e o som de crítico ou falha' },
  { id: 'notify', label: 'Notificações', hint: 'Avisos do site e da mesa ao vivo' },
  { id: 'chat',   label: 'Chat',         hint: 'Mensagens novas da campanha' },
  { id: 'game',   label: 'Jogos e Vortable', hint: 'Criaturas, portas e os jogos do site' },
]

export const TEXT_SCALES = [90, 100, 115, 130] as const
export type TextScale = (typeof TEXT_SCALES)[number]

export interface Settings {
  /** Mudo em tudo. */
  muteAll: boolean
  /** Volume geral, de 0 a 100. */
  master: number
  /** Volume de cada tipo de som, de 0 a 100. */
  volume: Record<SoundChannel, number>
  /** Cada tipo de som pode ficar mudo sem perder o volume escolhido. */
  mute: Record<SoundChannel, boolean>
  /** Tamanho do texto do site, em % do normal. */
  textScale: TextScale
  reduceMotion: boolean
  highContrast: boolean
  /** Mais espaço entre letras, palavras e linhas (ajuda quem tem dislexia ou vista cansada). */
  roomyText: boolean
  /** Contorno bem visível no que está selecionado pelo teclado. */
  strongFocus: boolean
  /** Sem partículas e sem o anel do clique. */
  noEffects: boolean
}

const STORAGE_KEY = 'vorterium:settings'

export function defaultSettings(): Settings {
  return {
    muteAll: false,
    master: 100,
    volume: { dice: 100, notify: 100, chat: 100, game: 100 },
    mute: { dice: false, notify: false, chat: false, game: false },
    textScale: 100,
    // quem já pediu menos movimento ao sistema começa com ele ligado
    reduceMotion: typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    highContrast: false,
    roomyText: false,
    strongFocus: false,
    noEffects: false,
  }
}

const clamp = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback)
const flag = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

/** Lê o que foi guardado, aceitando qualquer lixo: o que não servir volta ao padrão. */
export function parseSettings(raw: string | null): Settings {
  const base = defaultSettings()
  if (!raw) return base
  let o: Record<string, unknown>
  try { o = JSON.parse(raw) } catch { return base }
  if (!o || typeof o !== 'object') return base
  const vol = (o.volume ?? {}) as Record<string, unknown>
  const mut = (o.mute ?? {}) as Record<string, unknown>
  const channels = SOUND_CHANNELS.map((c) => c.id)
  return {
    muteAll: flag(o.muteAll, base.muteAll),
    master: clamp(o.master, base.master),
    volume: Object.fromEntries(channels.map((c) => [c, clamp(vol[c], base.volume[c])])) as Record<SoundChannel, number>,
    mute: Object.fromEntries(channels.map((c) => [c, flag(mut[c], base.mute[c])])) as Record<SoundChannel, boolean>,
    textScale: (TEXT_SCALES as readonly number[]).includes(o.textScale as number) ? (o.textScale as TextScale) : base.textScale,
    reduceMotion: flag(o.reduceMotion, base.reduceMotion),
    highContrast: flag(o.highContrast, base.highContrast),
    roomyText: flag(o.roomyText, base.roomyText),
    strongFocus: flag(o.strongFocus, base.strongFocus),
    noEffects: flag(o.noEffects, base.noEffects),
  }
}

/** O quanto tocar um tipo de som, de 0 (calado) a 1 (o volume de sempre). */
export function channelGain(s: Settings, channel: SoundChannel): number {
  if (s.muteAll || s.mute[channel]) return 0
  return (s.master / 100) * (s.volume[channel] / 100)
}

// ── Estado (fora do React, com assinantes) ──────────────

function load(): Settings {
  try { return parseSettings(localStorage.getItem(STORAGE_KEY)) } catch { return defaultSettings() }
}

let current: Settings = load()
const listeners = new Set<() => void>()

export function getSettings(): Settings { return current }

export function soundVolume(channel: SoundChannel): number { return channelGain(current, channel) }

export function updateSettings(patch: Partial<Settings> | ((s: Settings) => Settings)): void {
  current = typeof patch === 'function' ? patch(current) : { ...current, ...patch }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)) } catch { /* sem armazenamento */ }
  applySettings(current)
  listeners.forEach((l) => l())
}

export function resetSettings(): void { updateSettings(() => ({ ...defaultSettings(), reduceMotion: false })) }

export function subscribeSettings(l: () => void): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings)
}

/** Passa as opções de acessibilidade para o <html>, de onde o CSS lê. */
export function applySettings(s: Settings): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const set = (name: string, on: boolean) => { if (on) root.setAttribute(name, 'on'); else root.removeAttribute(name) }
  set('data-reduce-motion', s.reduceMotion)
  set('data-high-contrast', s.highContrast)
  set('data-roomy-text', s.roomyText)
  set('data-strong-focus', s.strongFocus)
  set('data-no-effects', s.noEffects)
  root.style.fontSize = s.textScale === 100 ? '' : `${(16 * s.textScale) / 100}px`
}

applySettings(current)
