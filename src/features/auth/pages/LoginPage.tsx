import { FormEvent, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthProvider'
import './AuthPages.css'

export function LoginPage() {
  const { signInWithEmail, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const from = (location.state as { from?: { pathname: string } } | null)
    ?.from?.pathname ?? '/campanhas'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signInWithEmail(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro inesperado.')
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
        <div className="auth-card__sigil" aria-hidden="true">⚔</div>
        <h1 className="auth-card__title">Campaign Lab</h1>
        <p className="auth-card__subtitle">Desvende os segredos de Arton.</p>
      </header>

      {error && (
        <div className="auth-feedback auth-feedback--error" role="alert">{error}</div>
      )}

      <form className="auth-card__form" onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label className="label" htmlFor="email">E-mail</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon" aria-hidden="true">✉</span>
            <input
              id="email" type="email" className="input"
              placeholder="mago@guilda.com"
              autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              disabled={busy} required
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="label" htmlFor="password">Senha mística</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon" aria-hidden="true">🗝</span>
            <input
              id="password" type="password" className="input"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              disabled={busy} required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full auth-card__submit"
          disabled={busy}
        >
          {submitting
            ? <><span className="spinner spinner--sm" /> Entrando...</>
            : 'Entrar nos Registros'
          }
        </button>
      </form>

      <div className="divider">ou</div>

      <button
        type="button"
        className="btn btn-ghost w-full"
        onClick={handleGoogle}
        disabled={busy}
        style={{ borderColor: 'var(--gilded)', gap: 'var(--space-3)' }}
      >
        {googleLoading
          ? <><span className="spinner spinner--sm" /> Aguardando...</>
          : <><GoogleIcon /> Entrar com Google</>
        }
      </button>

      <footer className="auth-card__footer">
        <span>Novo na Guilda?</span>
        <Link to="/cadastro" className="auth-card__footer-link">Criar conta</Link>
      </footer>
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
