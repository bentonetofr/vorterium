import { AuthProvider } from '../../features/auth/AuthProvider'
import { AppRouter } from '../router'

/**
 * Composição de todos os providers globais da aplicação.
 * Novos providers devem ser adicionados aqui, envolvendo AppRouter.
 */
export function AppProviders() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}
