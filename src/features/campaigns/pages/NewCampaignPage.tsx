import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createCampaign } from '../services/campaignService'
import './CampaignPages.css'

export function NewCampaignPage() {
  const navigate = useNavigate()
  const [name, setName]             = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) { setError('O nome da campanha não pode ser vazio.'); return }
    setSubmitting(true)
    try {
      const campaign = await createCampaign(trimmed)
      navigate(`/campanhas/${campaign.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a campanha.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <header className="page__header animate-fade-up">
        <div>
          <Link to="/campanhas" className="page__back">← Campanhas</Link>
          <h2 className="page__title">Criar Campanha</h2>
          <p className="page__meta">Informe os dados básicos da campanha.</p>
        </div>
      </header>

      <div className="page__content animate-fade-up" style={{ animationDelay: '60ms' }}>
        <div style={{
          maxWidth: '520px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--gilded)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-8)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Linha dourada no topo */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
            background: 'linear-gradient(90deg, transparent, var(--accent-bright), transparent)',
          }} aria-hidden="true" />

          <h3 style={{
            fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)',
            color: 'var(--accent-bright)', marginBottom: 'var(--space-6)',
          }}>
            Dados da campanha
          </h3>

          {error && (
            <div className="page__feedback page__feedback--error" style={{ marginBottom: 'var(--space-4)' }} role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="campaign-form" noValidate>
            <div className="auth-field">
              <label className="label" htmlFor="campaign-name">Nome da campanha</label>
              <input
                id="campaign-name" type="text" className="input"
                placeholder="Ex: Minha primeira campanha"
                autoComplete="off"
                value={name} onChange={(e) => setName(e.target.value)}
                disabled={submitting} required
              />
            </div>

            <div className="auth-field">
              <label className="label" htmlFor="campaign-system">Sistema de Regras</label>
              <input
                id="campaign-system" type="text" className="input"
                value="Genérico" readOnly aria-readonly="true"
                style={{ color: 'var(--text-muted)', cursor: 'default' }}
              />
            </div>

            <div className="campaign-form__actions">
              <Link to="/campanhas" className="btn btn-ghost">Cancelar</Link>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting
                  ? <><span className="spinner spinner--sm" /> Criando...</>
                  : 'Criar Campanha'
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
