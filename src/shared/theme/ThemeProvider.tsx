import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

// ────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'campaign-lab-theme'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

// ────────────────────────────────────────────────────────
// Contexto
// ────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
})

// ────────────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: ReactNode
}

// Navegador com armazenamento bloqueado (cookies desligados, alguns modos
// privados) lança erro ao acessar o localStorage — e este provider fica na
// raiz do app: sem a proteção, a tela inteira ficaria em branco.
function readSavedTheme(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

function saveTheme(theme: Theme) {
  try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* sem armazenamento */ }
}

// ── Troca animada: o tema novo abre num círculo a partir do último clique ──
// (View Transitions; onde o navegador não tem, ou com "reduzir animações",
// a troca é direta como sempre foi.)

let lastPointer: { x: number; y: number } | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => { lastPointer = { x: e.clientX, y: e.clientY } }, { capture: true, passive: true })
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> }
}

function motionReduced(): boolean {
  return document.documentElement.getAttribute('data-reduce-motion') === 'on'
    || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// Enquanto a troca animada espera o navegador fotografar o "antes", ninguém
// mais mexe no data-theme (senão a foto já sairia com o tema novo).
let switchPending = false

/** Aplica o tema no <html> com a animação de círculo, quando dá. */
function applyThemeAnimated(theme: Theme): void {
  const root = document.documentElement
  const doc = document as ViewTransitionDocument
  if (!doc.startViewTransition || motionReduced() || document.visibilityState !== 'visible') {
    root.setAttribute('data-theme', theme)
    return
  }
  const x = lastPointer?.x ?? window.innerWidth / 2
  const y = lastPointer?.y ?? window.innerHeight / 2
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  root.style.setProperty('--vt-x', `${x}px`)
  root.style.setProperty('--vt-y', `${y}px`)
  root.style.setProperty('--vt-r', `${Math.ceil(radius)}px`)
  root.classList.add('theme-switching')
  const done = () => root.classList.remove('theme-switching')
  switchPending = true
  try {
    doc.startViewTransition(() => {
      switchPending = false
      root.setAttribute('data-theme', theme)
    }).finished.then(done, done)
  } catch {
    switchPending = false
    root.setAttribute('data-theme', theme)
    done()
  }
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => (readSavedTheme() === 'light' ? 'light' : 'dark'))
  const themeRef = useRef(theme)
  themeRef.current = theme

  // Troca pedida pela pessoa: anima. (A do carregamento, lá embaixo, não.)
  const setTheme = useCallback((next: Theme | ((current: Theme) => Theme)) => {
    const value = typeof next === 'function' ? next(themeRef.current) : next
    if (value === themeRef.current) return
    themeRef.current = value
    applyThemeAnimated(value)
    setThemeState(value)
  }, [])

  const [accountReady, setAccountReady] = useState(false)

  // Quando não há preferência local, recupera a preferência sincronizada
  // no perfil. O localStorage continua sendo usado para evitar flash visual.
  useEffect(() => {
    let active = true
    const hasLocalPreference = Boolean(readSavedTheme())

    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user && !hasLocalPreference) {
        const { data } = await supabase
          .from('profiles')
          .select('theme_preference')
          .eq('id', session.user.id)
          .maybeSingle()
        if (active && (data?.theme_preference === 'light' || data?.theme_preference === 'dark')) {
          setThemeState(data.theme_preference)
        }
      }
      if (active) setAccountReady(true)
    })()

    return () => { active = false }
  }, [])

  // Aplica o atributo no <html> e persiste
  useEffect(() => {
    if (!switchPending) document.documentElement.setAttribute('data-theme', theme)
    if (!accountReady) return
    saveTheme(theme)

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase
        .from('profiles')
        .update({ theme_preference: theme })
        .eq('id', user.id)
    })()
  }, [theme, accountReady])

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
