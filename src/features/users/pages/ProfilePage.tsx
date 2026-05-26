import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ensureProfile, updateCurrentProfile } from '../services/profileService'
import type { Profile } from '../../../shared/types'
import '../../../features/campaigns/pages/CampaignPages.css'
import './ProfilePage.css'

function formatProvider(provider: string | null | undefined): string {
  if (!provider) return '—'
  if (provider === 'google') return 'Google'
  if (provider === 'email') return 'E-mail e senha'
  return provider
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day:   '2-digit',
    month: 'long',
    year:  'numeric',
  })
}

export function ProfilePage() {
  const [profile, setProfile]       = useState<Profile | null>(null)
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    ensureProfile()
      .then((p) => {
        setProfile(p)
        setDisplayName(p.display_name)
      })
      .catch((err) => {
        console.error('Erro ao carregar perfil:', err)
        setLoadError('Não foi possível carregar seu perfil. Tente sair e entrar novamente.')
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setSaveSuccess(false)

    const trimmed = displayName.trim()
    if (!trimmed) {
      setSaveError('O nome não pode ser vazio.')
      return
    }

    setSaving(true)
    try {
      const updated = await updateCurrentProfile({ display_name: trimmed })
      setProfile(updated)
      setDisplayName(updated.display_name)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3500)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível atualizar o perfil.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page__loading animate-fade-in">
          <div className="spinner" />
          <span>Carregando perfil...</span>
        </div>
      </div>
    )
  }

  if (loadError || !profile) {
    return (
      <div className="page">
        <div className="page__feedback page__feedback--error animate-fade-up" role="alert">
          {loadError ?? 'Não foi possível carregar seu perfil. Tente sair e entrar novamente.'}
        </div>
        <Link to="/campanhas" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }}>
          ← Voltar para campanhas
        </Link>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page__header animate-fade-up">
        <div>
          <Link to="/campanhas" className="page__back">← Campanhas</Link>
          <h2 className="page__title" style={{ fontSize: 'var(--text-3xl)' }}>Meu Perfil</h2>
          <p className="page__meta">Gerencie suas informações públicas.</p>
        </div>
      </header>

      <div className="page__content animate-fade-up" style={{ animationDelay: '60ms' }}>
        <div className="profile-card">
          <div className="profile-card__top-line" aria-hidden="true" />

          {/* ── Campos somente leitura ── */}
          <h3 className="profile-card__title">Informações da conta</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="profile-field">
              <span className="profile-field__label">E-mail</span>
              <span className="profile-field__value profile-field__value--mono">{profile.email}</span>
            </div>

            <div className="profile-field">
              <span className="profile-field__label">Provedor</span>
              <span className="profile-field__value">{formatProvider(profile.main_provider)}</span>
            </div>

            <div className="profile-field">
              <span className="profile-field__label">Membro desde</span>
              <span className="profile-field__value">{formatDate(profile.created_at)}</span>
            </div>
          </div>

          <hr className="profile-divider" />

          {/* ── Editar nome público ── */}
          <h3 className="profile-card__title">Nome público</h3>

          {saveSuccess && (
            <p className="profile-msg profile-msg--success" role="status" style={{ marginBottom: 'var(--space-4)' }}>
              Nome atualizado com sucesso.
            </p>
          )}

          <form onSubmit={handleSave} className="profile-form" noValidate>
            <div className="auth-field">
              <label className="label" htmlFor="profile-display-name">Nome público</label>
              <input
                id="profile-display-name"
                type="text"
                className="input"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  setSaveError(null)
                }}
                disabled={saving}
                autoComplete="name"
              />
            </div>

            {saveError && (
              <p className="profile-msg profile-msg--error" role="alert">
                {saveError}
              </p>
            )}

            <div className="profile-form__actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving
                  ? <><span className="spinner spinner--sm" /> Salvando...</>
                  : 'Salvar alterações'
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
