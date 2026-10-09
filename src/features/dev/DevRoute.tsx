import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useIsDeveloper } from './services/devService'
import { Loader } from '../../shared/components/Loader'

// ────────────────────────────────────────────────────────
// Guarda do painel /dev: sem sessão → login de dev; conta comum → aviso
// (o painel não existe pra ela). Só a conta em app_developers entra.
// ────────────────────────────────────────────────────────

export function DevRoute({ children }: { children: ReactNode }) {
  const { session, user, loading } = useAuth()
  const isDev = useIsDeveloper(user?.id)

  if (loading || (session && isDev === undefined)) {
    return <div className="dev-gate"><Loader /></div>
  }
  if (!session) return <Navigate to="/dev/entrar" replace />
  if (!isDev) {
    return (
      <div className="dev-gate">
        <p className="dev-gate__title">Área restrita</p>
        <p className="dev-gate__text">Esta conta não tem acesso ao painel do desenvolvedor.</p>
        <Link to="/campanhas" className="btn btn-ghost">Voltar pro Vorterium</Link>
      </div>
    )
  }
  return <>{children}</>
}
