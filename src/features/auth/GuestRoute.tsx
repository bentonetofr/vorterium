import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'

interface GuestRouteProps {
  children: ReactNode
}

/**
 * Impede que usuários já autenticados acessem /login ou /cadastro.
 * Se houver sessão ativa, redireciona para /campanhas.
 */
export function GuestRoute({ children }: GuestRouteProps) {
  const { session, loading } = useAuth()

  if (loading) {
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
        <div className="spinner" />
      </div>
    )
  }

  if (session) {
    return <Navigate to="/campanhas" replace />
  }

  return <>{children}</>
}
