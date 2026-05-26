import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import {
  acceptCampaignInviteWithProfile,
  savePendingInvite,
} from '../services/inviteService'
import './InvitePage.css'

type Status = 'loading' | 'redirecting-login' | 'accepting' | 'success' | 'error'

export function InvitePage() {
  const { token }   = useParams<{ token: string }>()
  const { user, loading } = useAuth()
  const navigate    = useNavigate()

  const [status, setStatus]   = useState<Status>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // Aguarda AuthProvider resolver o estado inicial
    if (loading) return

    if (!token) {
      setStatus('error')
      setErrorMsg('Link de convite inválido.')
      return
    }

    // ── Usuário NÃO autenticado ──────────────────────────
    if (!user) {
      savePendingInvite(token)
      setStatus('redirecting-login')
      const timer = setTimeout(() => navigate('/login', { replace: true }), 1800)
      return () => clearTimeout(timer)
    }

    // ── Usuário autenticado — aceita convite ─────────────
    setStatus('accepting')

    acceptCampaignInviteWithProfile(token)
      .then((campaignId) => {
        setStatus('success')
        setTimeout(() => navigate(`/campanhas/${campaignId}`, { replace: true }), 1200)
      })
      .catch((err) => {
        setStatus('error')
        setErrorMsg(err instanceof Error ? err.message : 'Não foi possível aceitar o convite.')
      })
  }, [loading, user, token, navigate])

  return (
    <div className="invite-page animate-fade-in">
      <div className="invite-page__card">
        <span className="invite-page__icon" aria-hidden="true">◈</span>

        {status === 'loading' && (
          <>
            <div className="spinner" />
            <p className="invite-page__text">Carregando convite...</p>
          </>
        )}

        {status === 'redirecting-login' && (
          <>
            <div className="spinner" />
            <h2 className="invite-page__title">Convite encontrado</h2>
            <p className="invite-page__text">
              Para aceitar o convite, você precisa entrar na sua conta.
            </p>
            <p className="invite-page__hint">Redirecionando para o login...</p>
          </>
        )}

        {status === 'accepting' && (
          <>
            <div className="spinner" />
            <p className="invite-page__text">Entrando na campanha...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <p className="invite-page__success">✓ Convite aceito!</p>
            <p className="invite-page__text">Redirecionando para a campanha...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="invite-page__error">{errorMsg}</p>
            <div className="invite-page__actions">
              <Link to="/campanhas" className="btn btn-ghost">
                Minhas campanhas
              </Link>
              <Link to="/login" className="btn btn-primary">
                Entrar
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
