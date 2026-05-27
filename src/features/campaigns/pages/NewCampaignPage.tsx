import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createCampaign } from '../services/campaignService'
import './CampaignPages.css'

const NAME_MAX        = 120
const DESCRIPTION_MAX = 1000

export function NewCampaignPage() {
  const navigate = useNavigate()
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [error,       setError]       = useState<string | null>(null)
  const [submitting,  setSubmitting]  = useState(false)

  const nameOver = name.length > NAME_MAX
  const descOver = description.length > DESCRIPTION_MAX

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmedName = name.trim()
    if (!trimmedName) { setError('O nome da campanha não pode ser vazio.'); return }
    if (nameOver)     { setError(`O nome deve ter no máximo ${NAME_MAX} caracteres.`); return }
    if (descOver)     { setError(`A descrição deve ter no máximo ${DESCRIPTION_MAX} caracteres.`); return }

    setSubmitting(true)
    try {
      const campaign = await createCampaign(
        trimmedName,
        description.trim() || null,
      )
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
                id="campaign-name" type="text"
                className={`input${nameOver ? ' input--error' : ''}`}
                placeholder="Ex: Minha primeira campanha"
                autoComplete="off"
                value={name} onChange={(e) => { setName(e.target.value); setError(null) }}
                disabled={submitting} required
              />
              <span style={{
                fontSize: 'var(--text-xs)',
                color: nameOver ? '#ffb4ab' : 'var(--text-muted)',
                textAlign: 'right',
                display: 'block',
              }}>
                {name.length}/{NAME_MAX}
              </span>
            </div>

            <div className="auth-field">
              <label className="label" htmlFor="campaign-system">Sistema de Regras</label>
              <input
                id="campaign-system" type="text" className="input"
                value="Genérico" readOnly aria-readonly="true"
                style={{ color: 'var(--text-muted)', cursor: 'default' }}
              />
            </div>

            <div className="auth-field">
              <label className="label" htmlFor="campaign-description">
                Descrição <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span>
              </label>
              <textarea
                id="campaign-description"
                className={`input campaign-form__textarea${descOver ? ' input--error' : ''}`}
                placeholder="Uma breve descrição da campanha, cenário ou premissa..."
                value={description}
                onChange={(e) => { setDescription(e.target.value); setError(null) }}
                disabled={submitting}
                rows={4}
              />
              <span style={{
                fontSize: 'var(--text-xs)',
                color: descOver ? '#ffb4ab' : 'var(--text-muted)',
                textAlign: 'right',
                display: 'block',
              }}>
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </div>

            <div className="campaign-form__actions">
              <Link to="/campanhas" className="btn btn-ghost">Cancelar</Link>
              <button type="submit" className="btn btn-primary" disabled={submitting || nameOver || descOver}>
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
