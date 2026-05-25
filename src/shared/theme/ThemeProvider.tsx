import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

// ────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'campaign-lab-theme'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

// ────────────────────────────────────────────────────────
// Contexto
// ────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
})

// ────────────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'light' ? 'light' : 'dark'
  })

  // Aplica o atributo no <html> e persiste
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
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
