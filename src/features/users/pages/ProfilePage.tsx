import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  ensureProfile,
  removeCurrentAvatar,
  updateCurrentPassword,
  updateCurrentProfile,
  uploadCurrentAvatar,
} from '../services/profileService'
import { AvatarCropEditor } from '../components/AvatarCropEditor'
import { Presence } from '../../../shared/components/Presence'
import type { Profile } from '../../../shared/types'
import { useTheme } from '../../../shared/theme/ThemeProvider'
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

  const [avatarBusy, setAvatarBusy]   = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarDraft, setAvatarDraft] = useState<File | null>(null)

  const [password, setPassword]             = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordBusy, setPasswordBusy]     = useState(false)
  const [passwordError, setPasswordError]   = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const { theme } = useTheme()

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

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setAvatarError(null)
    if (!AVATAR_TYPES.includes(file.type as (typeof AVATAR_TYPES)[number])) {
      setAvatarError('Escolha uma imagem JPG, PNG ou WebP.')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError('O avatar deve ter no máximo 2 MB.')
      return
    }

    setAvatarDraft(file)
  }

  async function handleAvatarSave(file: File) {
    setAvatarError(null)
    setAvatarBusy(true)
    try {
      setProfile(await uploadCurrentAvatar(file))
      setAvatarDraft(null)
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Não foi possível atualizar o avatar.')
    } finally {
      setAvatarBusy(false)
    }
  }

  async function handleAvatarRemove() {
    setAvatarError(null)
    setAvatarBusy(true)
    try {
      setProfile(await removeCurrentAvatar())
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Não foi possível remover o avatar.')
    } finally {
      setAvatarBusy(false)
    }
  }

  async function handlePasswordSave(e: FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)
    if (password !== passwordConfirm) {
      setPasswordError('As senhas não coincidem.')
      return
    }
    setPasswordBusy(true)
    try {
      await updateCurrentPassword(password)
      setPassword('')
      setPasswordConfirm('')
      setPasswordSuccess(true)
      setTimeout(() => setPasswordSuccess(false), 3500)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Não foi possível atualizar a senha.')
    } finally {
      setPasswordBusy(false)
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

          {/* ── Identidade visual ── */}
          <h3 className="profile-card__title">Identidade visual</h3>

          <div className="profile-avatar-editor">
            <div
              key={profile.avatar_url ?? 'sem-avatar'}
              className="profile-avatar anim-ring"
              aria-hidden={profile.avatar_url ? undefined : true}
            >
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="" className="anim-img-swap" />
                : profile.display_name.trim().charAt(0).toUpperCase()
              }
            </div>
            <div className="profile-avatar-editor__body">
              <strong>{profile.display_name}</strong>
              <span>JPG, PNG ou WebP · máximo de 2 MB</span>
              <div className="profile-avatar-editor__actions">
                <label className="btn btn-ghost">
                  Escolher imagem
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    disabled={avatarBusy}
                    onChange={handleAvatarChange}
                  />
                </label>
                {profile.avatar_url && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void handleAvatarRemove()}
                    disabled={avatarBusy}
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>

          <Presence show={!!avatarDraft} exitMs={220}>
            {() => avatarDraft && (
              <AvatarCropEditor
                file={avatarDraft}
                saving={avatarBusy}
                onCancel={() => setAvatarDraft(null)}
                onSave={handleAvatarSave}
              />
            )}
          </Presence>

          {avatarError && (
            <p className="profile-msg profile-msg--error" role="alert">{avatarError}</p>
          )}

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

          <hr className="profile-divider" />

          {/* ── Segurança ── */}
          <h3 className="profile-card__title">Segurança</h3>
          <p className="profile-settings-hint">
            Atualize sua senha sempre que quiser. Use pelo menos 8 caracteres.
          </p>

          {passwordSuccess && (
            <p className="profile-msg profile-msg--success" role="status">Senha atualizada com sucesso.</p>
          )}

          <form onSubmit={handlePasswordSave} className="profile-form" noValidate>
            <div className="auth-field">
              <label className="label" htmlFor="profile-new-password">Nova senha</label>
              <input
                id="profile-new-password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(null) }}
                disabled={passwordBusy}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <div className="auth-field">
              <label className="label" htmlFor="profile-new-password-confirm">Confirmar nova senha</label>
              <input
                id="profile-new-password-confirm"
                type="password"
                className="input"
                value={passwordConfirm}
                onChange={(e) => { setPasswordConfirm(e.target.value); setPasswordError(null) }}
                disabled={passwordBusy}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            {passwordError && <p className="profile-msg profile-msg--error" role="alert">{passwordError}</p>}
            <div className="profile-form__actions">
              <button type="submit" className="btn btn-primary" disabled={passwordBusy || !password || !passwordConfirm}>
                {passwordBusy ? <><span className="spinner spinner--sm" /> Salvando...</> : 'Atualizar senha'}
              </button>
            </div>
          </form>

          <hr className="profile-divider" />

          <div className="profile-preference">
            <div>
              <h3 className="profile-card__title">Preferência de aparência</h3>
              <p className="profile-settings-hint">Tema atual: {theme === 'dark' ? 'Medieval escuro' : 'Pergaminho claro'}. Use o botão de tema na barra lateral para alternar.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
