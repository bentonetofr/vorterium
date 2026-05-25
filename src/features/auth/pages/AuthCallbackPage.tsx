import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../shared/lib/supabase'
import { processPendingInvite } from '../../invites/services/inviteService'

/**
 * Rota: /auth/callback
 *
 * Destino do redirect após autenticação OAuth (Google).
 * O Supabase troca o code por uma sessão automaticamente via PKCE.
 * Esta página aguarda a sessão ser estabelecida e redireciona.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let attempts = 0
    const MAX_ATTEMPTS = 10
    const INTERVAL_MS = 300

    // Supabase processa o hash/code da URL de forma assíncrona.
    // Aguardamos até a sessão estar disponível (ou atingir o limite).
    const interval = setInterval(async () => {
      attempts++
      const { data, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        clearInterval(interval)
        setError('Não foi possível concluir a autenticação. Tente novamente.')
        return
      }

      if (data.session) {
        clearInterval(interval)
        const pendingCampaignId = await processPendingInvite()
        navigate(pendingCampaignId ? `/campanhas/${pendingCampaignId}` : '/campanhas', { replace: true })
        return
      }

      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval)
        navigate('/login', { replace: true })
      }
    }, INTERVAL_MS)

    return () => clearInterval(interval)
  }, [navigate])

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-4)',
          padding: 'var(--space-8)',
          textAlign: 'center',
        }}
      >
        <p style={{ color: 'var(--danger)', fontFamily: 'var(--font-body)' }}>
          {error}
        </p>
        <a href="/login" className="btn btn-ghost">
          Voltar para o login
        </a>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-8)',
      }}
    >
      <div className="spinner" />
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-sm)',
          letterSpacing: '0.1em',
          color: 'var(--text-muted)',
        }}
      >
        Autenticando...
      </p>
    </div>
  )
}
