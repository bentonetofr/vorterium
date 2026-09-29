import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { supabase } from '../../../shared/lib/supabase'
import { checkIsDeveloper, forgetDeveloperCheck } from '../services/devService'
import '../dev.css'

// ────────────────────────────────────────────────────────
// Login do desenvolvedor — endereço próprio (/dev/entrar), sem link em
// lugar nenhum do site. Só e-mail e senha. Entrou com uma conta que não é
// de desenvolvedor: a sessão é encerrada na hora e aparece o aviso.
// ────────────────────────────────────────────────────────

export function DevLoginPage() {
  const { user, signInWithEmail, signOut } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)

  // Já está logado com a conta dev: vai direto pro painel.
  useEffect(() => {
    if (!user) return
    let alive = true
    void checkIsDeveloper(user.id).then((dev) => { if (alive && dev) navigate('/dev', { replace: true }) })
    return () => { alive = false }
  }, [user, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      // Troca de conta: sai da sessão atual (ex.: a conta de jogador) antes.
      if (user) await signOut()
      forgetDeveloperCheck()
      await signInWithEmail(email, password)
      const { data } = await supabase.auth.getUser()
      const dev = data.user ? await checkIsDeveloper(data.user.id) : false
      if (!dev) {
        await signOut()
        forgetDeveloperCheck()
        setError('Esta conta não é de desenvolvedor.')
        return
      }
      navigate('/dev', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dev-login">
      <form className="dev-login__card" onSubmit={handleSubmit} noValidate>
        <p className="dev-login__tag">vorterium://dev</p>
        <h1 className="dev-login__title">Acesso do desenvolvedor</h1>
        <p className="dev-login__sub">Área interna. Só a conta de desenvolvedor entra.</p>

        {user && (
          <p className="dev-login__hint">
            Você está com a conta <strong>{user.email}</strong>. Entrar aqui encerra essa sessão.
          </p>
        )}
        {error && <p className="dev-login__error" role="alert">{error}</p>}

        <label className="dev-login__label" htmlFor="dev-email">E-mail</label>
        <input
          id="dev-email" type="email" className="input dev-login__input" autoComplete="username"
          value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} required
        />
        <label className="dev-login__label" htmlFor="dev-password">Senha</label>
        <input
          id="dev-password" type="password" className="input dev-login__input" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} required
        />
        <button type="submit" className="dev-login__submit" disabled={busy || !email || !password}>
          {busy ? 'Entrando…' : 'Entrar como dev'}
        </button>
      </form>
    </div>
  )
}
