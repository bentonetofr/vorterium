import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createCampaign } from '../services/campaignService'
import { SYSTEMS_CATALOG, STATUS_LABELS, isSupportedSystem } from '../../../shared/constants/systems'
import type { CampaignSystem } from '../../../shared/types'
import { DndComingSoon } from '../../sheets/dnd/DndComingSoon'
import './CampaignPages.css'

const NAME_MAX        = 120
const DESCRIPTION_MAX = 1000

export function NewCampaignPage() {
  const navigate = useNavigate()

  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [system,      setSystem]      = useState<CampaignSystem>('generic')
  const [error,       setError]       = useState<string | null>(null)
  const [submitting,  setSubmitting]  = useState(false)
  const [showDndNotice, setShowDndNotice] = useState(false)

  const nameOver = name.length > NAME_MAX
  const descOver = description.length > DESCRIPTION_MAX

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) { setError('O nome da campanha não pode ser vazio.'); return }
    if (nameOver)     { setError(`O nome deve ter no máximo ${NAME_MAX} caracteres.`); return }
    if (descOver)     { setError(`A descrição deve ter no máximo ${DESCRIPTION_MAX} caracteres.`); return }
    if (!isSupportedSystem(system)) { setError('Selecione um sistema válido.'); return }
    if (system === 'dnd5e') { setShowDndNotice(true); return }

    setSubmitting(true)
    try {
      const campaign = await createCampaign(
        trimmedName,
        description.trim() || null,
        system,
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
          maxWidth: '540px',
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
            {/* Nome */}
            <div className="auth-field">
              <label className="label" htmlFor="campaign-name">Nome da campanha</label>
              <input
                id="campaign-name" type="text"
                className={`input${nameOver ? ' input--error' : ''}`}
                autoComplete="off"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null) }}
                disabled={submitting}
                required
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

            {/* Sistema */}
            <div className="auth-field">
              <span className="label">Sistema da campanha</span>
              <div className="system-selector" role="radiogroup" aria-label="Sistema da campanha">
                {SYSTEMS_CATALOG.map((sys) => {
                  const isSelected = system === sys.id
                  const statusLabel = STATUS_LABELS[sys.status]
                  return (
                    <button
                      key={sys.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`system-option${isSelected ? ' system-option--selected' : ''}`}
                      onClick={() => {
                        if (sys.id === 'dnd5e') {
                          setSystem(sys.id)
                          setShowDndNotice(true)
                          setError(null)
                          return
                        }
                        setSystem(sys.id)
                        setShowDndNotice(false)
                        setError(null)
                      }}
                      disabled={submitting}
                    >
                      <div className="system-option__radio">
                        <div className="system-option__radio-dot" />
                      </div>
                      <span className="system-option__icon" aria-hidden="true">{sys.icon}</span>
                      <div className="system-option__info">
                        <span className="system-option__name">
                          {sys.label}
                          {statusLabel && (
                            <span className={`system-status-badge system-status-badge--${sys.status}`}>
                              {statusLabel}
                            </span>
                          )}
                        </span>
                        <p className="system-option__desc">{sys.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
              {showDndNotice && (
                <DndComingSoon compact onClose={() => setShowDndNotice(false)} />
              )}
            </div>

            {/* Descrição */}
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
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || nameOver || descOver || system === 'dnd5e'}
              >
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
