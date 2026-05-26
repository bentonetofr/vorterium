import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import {
  acceptCampaignInviteWithProfile,
  getCampaignInvitePublic,
  savePendingInvite,
} from '../services/inviteService'
import type { CampaignInvitePublic } from '../../../shared/types'
import './InvitePage.css'

type Status =
  | 'loading'
  | 'valid'
  | 'accepting'
  | 'success'
  | 'disabled'
  | 'expired'
  | 'invalid'
  | 'error'

export function InvitePage() {
  const { token }          = useParams<{ token: string }>()
  const { user, loading }  = useAuth()
  const navigate           = useNavigate()

  const [status, setStatus]       = useState<Status>('loading')
  const [inviteInfo, setInviteInfo] = useState<CampaignInvitePublic | null>(null)
  const [errorMsg, setErrorMsg]   = useState('')

  useEffect(() => {
    if (loading) return

    if (!token) {
      setStatus('invalid')
      return
    }

    getCampaignInvitePublic(token)
      .then((info) => {
        setInviteInfo(info)

        if (!info.is_active) {
          setStatus('disabled')
          return
        }

        if (info.expires_at && new Date(info.expires_at) <= new Date()) {
          setStatus('expired')
          return
        }

        if (!user) {
          setStatus('valid')
          return
        }

        // Usuário autenticado — aceita imediatamente
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
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('não encontrado')) {
          setStatus('invalid')
        } else {
          setStatus('error')
          setErrorMsg(msg || 'Erro ao carregar convite.')
        }
      })
  }, [loading, user, token, navigate])

  function handleLoginRedirect() {
    if (token) savePendingInvite(token)
    navigate('/login', { replace: true })
  }

  function handleRegisterRedirect() {
    if (token) savePendingInvite(token)
    navigate('/cadastro', { replace: true })
  }

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

        {status === 'valid' && inviteInfo && (
          <>
            <h2 className="invite-page__title">Você foi convidado</h2>
            <p className="invite-page__text">
              Entre na campanha <strong>{inviteInfo.campaign_name}</strong>.
            </p>
            <p className="invite-page__hint">Faça login ou crie uma conta para aceitar o convite.</p>
            <div className="invite-page__actions">
              <button className="btn btn-ghost" onClick={handleRegisterRedirect}>
                Criar conta
              </button>
              <button className="btn btn-primary" onClick={handleLoginRedirect}>
                Entrar
              </button>
            </div>
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

        {status === 'disabled' && (
          <>
            <p className="invite-page__error">Este convite foi desativado.</p>
            {inviteInfo && (
              <p className="invite-page__hint">Campanha: {inviteInfo.campaign_name}</p>
            )}
            <div className="invite-page__actions">
              <Link to="/campanhas" className="btn btn-ghost">Minhas campanhas</Link>
              <Link to="/login" className="btn btn-primary">Entrar</Link>
            </div>
          </>
        )}

        {status === 'expired' && (
          <>
            <p className="invite-page__error">Este convite expirou.</p>
            {inviteInfo && (
              <p className="invite-page__hint">Campanha: {inviteInfo.campaign_name}</p>
            )}
            <div className="invite-page__actions">
              <Link to="/campanhas" className="btn btn-ghost">Minhas campanhas</Link>
              <Link to="/login" className="btn btn-primary">Entrar</Link>
            </div>
          </>
        )}

        {status === 'invalid' && (
          <>
            <p className="invite-page__error">Convite inválido ou não encontrado.</p>
            <div className="invite-page__actions">
              <Link to="/campanhas" className="btn btn-ghost">Minhas campanhas</Link>
              <Link to="/login" className="btn btn-primary">Entrar</Link>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="invite-page__error">{errorMsg}</p>
            <div className="invite-page__actions">
              <Link to="/campanhas" className="btn btn-ghost">Minhas campanhas</Link>
              <Link to="/login" className="btn btn-primary">Entrar</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
