import { useEffect, useState } from 'react'

// ────────────────────────────────────────────────────────
// Instalar o Vorterium como aplicativo (ícone na tela inicial, janela
// própria, sem a barra do navegador). O navegador avisa quando dá pra
// instalar (evento beforeinstallprompt, Chrome/Edge/Android); guardamos o
// aviso pra abrir a janela de instalação quando a pessoa pedir. No iPhone
// não existe esse aviso: lá a instalação é pelo menu Compartilhar, e a
// página "Mais" explica como.
// ────────────────────────────────────────────────────────

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let saved: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // sem o aviso automático do navegador: quem oferece é o nosso botão
    e.preventDefault()
    saved = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => { saved = null; notify() })
}

/** Já está rodando como aplicativo instalado? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** iPhone/iPad no Safari: instala pelo menu Compartilhar. */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

export type InstallState = 'available' | 'ios' | 'installed' | 'unavailable'

/** Como a instalação pode acontecer neste aparelho, e a função que a dispara. */
export function useInstallApp(): { state: InstallState; install: () => Promise<boolean> } {
  const [, force] = useState(0)

  useEffect(() => {
    const listener = () => force((n) => n + 1)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  const state: InstallState = isStandalone() ? 'installed' : saved ? 'available' : isIosSafari() ? 'ios' : 'unavailable'

  async function install(): Promise<boolean> {
    const event = saved
    if (!event) return false
    await event.prompt()
    const { outcome } = await event.userChoice
    // o aviso só vale uma vez
    saved = null
    notify()
    return outcome === 'accepted'
  }

  return { state, install }
}
