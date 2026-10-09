import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { useIsDeveloper } from '../dev/services/devService'
import { Loader } from '../../shared/components/Loader'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, user, loading } = useAuth()
  // A conta de desenvolvedor vê tudo de todas as campanhas — no site dos
  // jogadores o sino e o chat receberiam tudo. Ela mora só no painel /dev.
  const isDev = useIsDeveloper(user?.id)
  const location = useLocation()

  // Enquanto verifica a sessão, mostra loading mínimo
  if (loading || (session && isDev === undefined)) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--bg-base)',
        }}
      >
        <Loader />
      </div>
    )
  }

  // Sem sessão — redireciona para login, preservando a rota de destino
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (isDev) return <Navigate to="/dev" replace />

  return <>{children}</>
}
