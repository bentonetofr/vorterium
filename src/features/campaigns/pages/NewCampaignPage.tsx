import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createCampaign } from '../services/campaignService'
import { SYSTEMS_CATALOG, STATUS_LABELS, getSystemEntry, isSupportedSystem } from '../../../shared/constants/systems'
import type { CampaignSystem } from '../../../shared/types'
import { DndComingSoon } from '../../sheets/dnd/DndComingSoon'
import { Presence } from '../../../shared/components/Presence'
import { SystemVariantModal } from '../components/SystemVariantModal'
import { SystemPickerModal } from '../components/SystemPickerModal'
import { useFeature } from '../../control/siteFeatures'
import { VAMPIRO_FEATURE } from '../../sheets/vampiro/constants/vampiro'
import { DND_FEATURE } from '../../sheets/dnd/constants/dnd'
import './CampaignPages.css'
import './NewCampaign.css'

const NAME_MAX        = 120
const DESCRIPTION_MAX = 1000

export function NewCampaignPage() {
  // Vampiro nasce guardado: só aparece pra quem pode ver (o dono, testando).
  const vampiro = useFeature(VAMPIRO_FEATURE)
  // D&D 5e segue "Em breve" pra todo mundo; com o recurso visível (o dono, testando) dá pra criar campanha.
  const dnd = useFeature(DND_FEATURE)
  // Versões alternativas (ex.: Terra Devastada Adaptada) não têm cartão: o do
  // sistema de origem abre a janelinha de escolha.
  const systems = SYSTEMS_CATALOG.filter((s) => !s.variantOf && (s.id !== 'vampiro' || vampiro.visible))
  const navigate = useNavigate()

  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  // nenhum sistema escolhido de início: a pessoa abre a janela e escolhe
  const [system,      setSystem]      = useState<CampaignSystem | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [submitting,  setSubmitting]  = useState(false)
  const [picker,      setPicker]      = useState(false)
  const [variantFor,  setVariantFor]  = useState<CampaignSystem | null>(null)
  const [shake,       setShake]       = useState(0)

  const nameOver = name.length > NAME_MAX
  const descOver = description.length > DESCRIPTION_MAX
  const entry = system ? getSystemEntry(system) : null
  // a versão (Terra Devastada original/adaptada) mostra o cartão do sistema de origem
  const baseEntry = entry?.variantOf ? getSystemEntry(entry.variantOf) : entry
  const art = baseEntry?.art ?? null
  const statusLabel = entry ? STATUS_LABELS[entry.status] : null
  const showDnd = system === 'dnd5e' && !dnd.visible

  function onPick(sys: (typeof systems)[number]) {
    setError(null)
    if (getSystemVariantsCount(sys.id) > 0) {
      // Mais de uma versão: a janelinha decide qual id vai pra campanha
      // (fechar sem escolher não muda nada).
      setVariantFor(sys.id)
      return
    }
    setSystem(sys.id)
    setPicker(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) { setError('O nome da campanha não pode ser vazio.'); return }
    if (nameOver)     { setError(`O nome deve ter no máximo ${NAME_MAX} caracteres.`); return }
    if (descOver)     { setError(`A descrição deve ter no máximo ${DESCRIPTION_MAX} caracteres.`); return }
    if (!system) {
      setError('Escolha o sistema da campanha.')
      setShake((n) => n + 1)
      setPicker(true)
      return
    }
    if (!isSupportedSystem(system)) { setError('Selecione um sistema válido.'); return }
    if (system === 'dnd5e' && !dnd.visible) { setError('O D&D 5e ainda está em desenvolvimento. Escolha outro sistema por enquanto.'); return }

    setSubmitting(true)
    try {
      const campaign = await createCampaign(trimmedName, description.trim() || null, system)
      navigate(`/campanhas/${campaign.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a campanha.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page newc">
      <header className="page__header animate-fade-up">
        <div>
          <Link to="/campanhas" className="page__back"><span className="page__back-arrow" aria-hidden="true">←</span> Campanhas</Link>
          <h2 className="page__title">Criar Campanha</h2>
          <p className="page__meta">Dê um nome, escolha o sistema e comece a contar a sua história.</p>
        </div>
      </header>

      <div className="newc__layout">
        <form onSubmit={handleSubmit} className="newc__panel animate-fade-up" style={{ animationDelay: '60ms' }} noValidate>
          <div className="newc__glow" aria-hidden="true" />

          {error && (
            <div className="page__feedback page__feedback--error" role="alert">{error}</div>
          )}

          {/* 1. Nome */}
          <section className="newc__step" style={{ ['--i' as string]: 0 }}>
            <div className="newc__step-head">
              <span className="newc__num" aria-hidden="true">1</span>
              <label className="newc__label" htmlFor="campaign-name">Nome da campanha</label>
              <span className={`newc__count${nameOver ? ' newc__count--over' : ''}`}>{name.length}/{NAME_MAX}</span>
            </div>
            <input
              id="campaign-name" type="text"
              className={`input newc__name${nameOver ? ' input--error' : ''}`}
              placeholder="Ex.: As Cinzas de Altherium"
              autoComplete="off"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null) }}
              disabled={submitting}
              required
            />
          </section>

          {/* 2. Sistema */}
          <section className="newc__step" style={{ ['--i' as string]: 1 }}>
            <div className="newc__step-head">
              <span className="newc__num" aria-hidden="true">2</span>
              <span className="newc__label">Sistema da campanha</span>
            </div>

            {entry && baseEntry ? (
              <div className="newc__chosen" key={entry.id} style={{ ['--accent-c' as string]: baseEntry.accent ?? '212, 175, 55' }}>
                <span className="newc__chosen-art" style={art ? { backgroundImage: `url(${art})` } : undefined} aria-hidden="true">
                  {!art && baseEntry.icon}
                </span>
                <span className="newc__chosen-info">
                  <strong className="newc__chosen-name">
                    {entry.label}
                    {statusLabel && <span className={`system-status-badge system-status-badge--${entry.status}`}>{statusLabel}</span>}
                  </strong>
                  <span className="newc__chosen-desc">{entry.description}</span>
                </span>
                <button type="button" className="btn btn-ghost newc__change" onClick={() => setPicker(true)} disabled={submitting}>Trocar sistema</button>
              </div>
            ) : (
              <button
                key={shake}
                type="button"
                className={`newc__pick${shake ? ' newc__pick--shake' : ''}`}
                onClick={() => setPicker(true)}
                disabled={submitting}
              >
                <span className="newc__pick-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
                    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
                  </svg>
                </span>
                <span className="newc__pick-text">
                  <strong>Escolher sistema da campanha</strong>
                  <small>Ficha, regras e visual: veja todos os sistemas disponíveis</small>
                </span>
                <span className="newc__pick-arrow" aria-hidden="true">→</span>
              </button>
            )}

            {showDnd && <DndComingSoon compact onClose={() => setSystem(null)} />}
          </section>

          {/* 3. Descrição */}
          <section className="newc__step" style={{ ['--i' as string]: 2 }}>
            <div className="newc__step-head">
              <span className="newc__num" aria-hidden="true">3</span>
              <label className="newc__label" htmlFor="campaign-description">
                Descrição <span className="newc__opt">(opcional)</span>
              </label>
              <span className={`newc__count${descOver ? ' newc__count--over' : ''}`}>{description.length}/{DESCRIPTION_MAX}</span>
            </div>
            <textarea
              id="campaign-description"
              className={`input campaign-form__textarea newc__desc${descOver ? ' input--error' : ''}`}
              placeholder="Uma breve descrição da campanha, cenário ou premissa..."
              value={description}
              onChange={(e) => { setDescription(e.target.value); setError(null) }}
              disabled={submitting}
              rows={4}
            />
          </section>

          <div className="newc__actions">
            <Link to="/campanhas" className="btn btn-ghost">Cancelar</Link>
            <button type="submit" className="btn btn-primary newc__submit" disabled={submitting || nameOver || descOver}>
              {submitting
                ? <><span className="spinner spinner--sm" /> Criando...</>
                : <><span className="newc__submit-spark" aria-hidden="true">✦</span> Criar campanha</>}
            </button>
          </div>
        </form>

        {/* Prévia viva do cartão da campanha */}
        <aside className="newc__preview animate-fade-up" style={{ animationDelay: '140ms' }} aria-label="Prévia da campanha">
          <p className="newc__preview-title">Prévia</p>
          <div className="newc-card" style={{ ['--accent-c' as string]: baseEntry?.accent ?? '212, 175, 55' }}>
            <div className="newc-card__art-wrap" aria-hidden="true">
              {art
                ? <div key={art} className="newc-card__art" style={{ backgroundImage: `url(${art})` }} />
                : <div className="newc-card__art newc-card__art--empty">◈</div>}
              <div className="newc-card__shade" />
            </div>
            <div className="newc-card__body">
              <div className="newc-card__tags">
                <span className="newc-card__tag">{entry?.label ?? 'Sem sistema'}</span>
                <span className="newc-card__tag newc-card__tag--role">Mestre</span>
                <span className="newc-card__tag newc-card__tag--ok">Ativa</span>
              </div>
              <h3 className={`newc-card__name${name.trim() ? '' : ' newc-card__name--empty'}`}>{name.trim() || 'Nome da campanha'}</h3>
              <p className="newc-card__desc">{description.trim() || 'A descrição aparece aqui.'}</p>
            </div>
          </div>
          <p className="newc__preview-note">É assim que a campanha vai aparecer na sua lista. Você poderá mudar nome, descrição e capa depois.</p>
        </aside>
      </div>

      <Presence show={picker} exitMs={220}>
        {() => (
          <SystemPickerModal
            systems={systems}
            current={system}
            guarded={[...(vampiro.guarded ? ['vampiro' as const] : []), ...(dnd.guarded ? ['dnd5e' as const] : [])]}
            onPick={onPick}
            onClose={() => setPicker(false)}
          />
        )}
      </Presence>

      <Presence show={variantFor !== null} exitMs={220}>
        {() => variantFor && (
          <SystemVariantModal
            system={variantFor}
            current={system ?? variantFor}
            onPick={(picked) => { setSystem(picked); setVariantFor(null); setPicker(false); setError(null) }}
            onClose={() => setVariantFor(null)}
          />
        )}
      </Presence>
    </div>
  )
}

function getSystemVariantsCount(id: CampaignSystem): number {
  return SYSTEMS_CATALOG.filter((s) => s.variantOf === id).length
}
