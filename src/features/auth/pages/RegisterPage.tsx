import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthProvider'
import { processPendingInvite } from '../../invites/services/inviteService'
import './AuthPages.css'

export function RegisterPage() {
  const { signUpWithEmail, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName]           = useState('')
  const [email, setEmail]                       = useState('')
  const [password, setPassword]                 = useState('')
  const [confirmPassword, setConfirmPassword]   = useState('')
  const [error, setError]                       = useState<string | null>(null)
  const [success, setSuccess]                   = useState<string | null>(null)
  const [submitting, setSubmitting]             = useState(false)
  const [googleLoading, setGoogleLoading]       = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null); setSuccess(null)

    if (password !== confirmPassword) { setError('As senhas não coincidem.'); return }
    if (password.length < 6)          { setError('A senha deve ter pelo menos 6 caracteres.'); return }

    setSubmitting(true)
    try {
      const { needsConfirmation } = await signUpWithEmail(email, password, displayName)
      if (needsConfirmation) {
        setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.')
      } else {
        const pendingCampaignId = await processPendingInvite()
        navigate(pendingCampaignId ? `/campanhas/${pendingCampaignId}` : '/campanhas', { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar sua conta.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar com Google.')
      setGoogleLoading(false)
    }
  }

  const busy = submitting || googleLoading

  return (
    <div className="auth-card animate-fade-up">
      <header className="auth-card__header">
        <div className="auth-card__sigil" aria-hidden="true">📜</div>
        <h1 className="auth-card__title">Campaign Lab</h1>
        <p className="auth-card__subtitle">Crie sua conta para organizar campanhas de RPG.</p>
      </header>

      {error   && <div className="auth-feedback auth-feedback--error"   role="alert">{error}</div>}
      {success && <div className="auth-feedback auth-feedback--success" role="status">{success}</div>}

      {!success && (
        <>
          <form className="auth-card__form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label className="label" htmlFor="display-name">Nome público</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true">👤</span>
                <input id="display-name" type="text" className="input"
                  placeholder="Nome que aparecerá para outros usuários"
                  autoComplete="name"
                  value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  disabled={busy} required />
              </div>
            </div>

            <div className="auth-field">
              <label className="label" htmlFor="email">E-mail</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true">✉</span>
                <input id="email" type="email" className="input"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  disabled={busy} required />
              </div>
            </div>

            <div className="auth-field">
              <label className="label" htmlFor="password">Senha</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true">🗝</span>
                <input id="password" type="password" className="input"
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  disabled={busy} required />
              </div>
            </div>

            <div className="auth-field">
              <label className="label" htmlFor="confirm-password">Confirmar senha</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true">🗝</span>
                <input id="confirm-password" type="password" className="input"
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={busy} required />
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full auth-card__submit" disabled={busy}>
              {submitting
                ? <><span className="spinner spinner--sm" /> Criando conta...</>
                : 'Criar conta'
              }
            </button>
          </form>

          <div className="divider">ou</div>

          <button type="button" className="btn btn-ghost w-full"
            onClick={handleGoogle} disabled={busy}
            style={{ borderColor: 'var(--gilded)', gap: 'var(--space-3)' }}>
            {googleLoading
              ? <><span className="spinner spinner--sm" /> Aguardando...</>
              : <><GoogleIcon /> Cadastrar com Google</>
            }
          </button>
        </>
      )}

      <footer className="auth-card__footer">
        <span>Já tem conta?</span>
        <Link to="/login" className="auth-card__footer-link">← Retornar ao Login</Link>
      </footer>

      <nav className="auth-card__legal" aria-label="Links institucionais">
        <Link to="/termos"      className="auth-card__legal-link">Termos de uso</Link>
        <Link to="/privacidade" className="auth-card__legal-link">Privacidade</Link>
      </nav>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
