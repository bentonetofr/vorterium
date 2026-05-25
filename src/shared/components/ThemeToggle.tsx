import { useTheme } from '../theme/ThemeProvider'
import './ThemeToggle.css'

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      type="button"
    >
      {/*
        key={theme} força React a desmontar/montar o span quando o tema muda,
        o que reinicia a animação CSS a cada troca.
      */}
      <span key={theme} className="theme-toggle__icon" aria-hidden="true">
        {isDark ? '☀' : '☾'}
      </span>
    </button>
  )
}
