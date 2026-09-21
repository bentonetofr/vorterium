import { ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { processPendingInvite } from '../invites/services/inviteService'

interface GuestRouteProps {
  children: ReactNode
}

/**
 * Impede que usuários já autenticados acessem /login ou /cadastro.
 * Se houver sessão ativa, processa um convite pendente salvo no
 * sessionStorage (se houver) antes de redirecionar — senão o token fica
 * órfão, já que LoginPage/RegisterPage só processam isso no submit do
 * formulário, que nunca chega a renderizar aqui. `processPendingInvite`
 * retorna rápido (sem chamada de rede) quando não há convite pendente.
 */
export function GuestRoute({ children }: GuestRouteProps) {
  const { session, loading } = useAuth()
  const [redirectTo, setRedirectTo] = useState<string | null>(null)
  const [checkingInvite, setCheckingInvite] = useState(true)

  useEffect(() => {
    if (loading || !session) return
    let cancelled = false
    processPendingInvite().then((campaignId) => {
      if (cancelled) return
      setRedirectTo(campaignId ? `/campanhas/${campaignId}` : '/campanhas')
      setCheckingInvite(false)
    })
    return () => { cancelled = true }
  }, [loading, session])

  if (loading || (session && checkingInvite)) {
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
    return <Navigate to={redirectTo ?? '/campanhas'} replace />
  }

  return <>{children}</>
}
