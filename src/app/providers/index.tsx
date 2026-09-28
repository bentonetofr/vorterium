import { ThemeProvider } from '../../shared/theme/ThemeProvider'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { AppRouter } from '../router'
import { ClickEffects } from '../../shared/components/ClickEffects'

/**
 * Composição de todos os providers globais da aplicação.
 * ThemeProvider é o mais externo para que o tema esteja disponível
 * em todos os layouts, incluindo as páginas públicas de auth.
 */
export function AppProviders() {
  return (
    <ThemeProvider>
      <ClickEffects />
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ThemeProvider>
  )
}
