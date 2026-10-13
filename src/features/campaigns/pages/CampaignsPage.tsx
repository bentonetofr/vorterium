import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { getMyCampaigns, updateCampaignDetails } from '../services/campaignService'
import { formatRole, getCampaignStatusLabel, getCampaignStatusClass } from '../../../shared/utils/campaign'
import { getSystemLabel, getSystemStatus, STATUS_LABELS } from '../../../shared/constants/systems'
import type { CampaignWithRole } from '../../../shared/types'
import { DeleteCampaignModal } from '../components/DeleteCampaignModal'
import './CampaignPages.css'
import { Loader } from '../../../shared/components/Loader'

export function CampaignsPage() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<CampaignWithRole[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [busyId, setBusyId]        = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // campanha que o mestre está excluindo (a janela pede pra escrever DELETAR (nome))
  const [deleting, setDeleting] = useState<CampaignWithRole | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyCampaigns()
        setCampaigns(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar campanhas.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ?? 'Usuário'

  const archived = campaigns.filter((c) => c.status === 'archived')
  const active   = campaigns.filter((c) => c.status !== 'archived')
  const asMaster = active.filter((c) => c.role === 'master')
  const asPlayer = active.filter((c) => c.role === 'player')

  /** Arquiva (some da lista principal e vai pra "Arquivadas") ou desarquiva uma campanha. Só o mestre. */
  async function setArchived(campaign: CampaignWithRole, archive: boolean) {
    const ok = archive
      ? confirm(`Arquivar "${campaign.name}"?\n\nEla sai da lista e vai para "Arquivadas". Nada é apagado e dá pra desarquivar quando quiser.`)
      : true
    if (!ok) return
    setBusyId(campaign.id)
    setActionError(null)
    try {
      const updated = await updateCampaignDetails(campaign.id, {
        name: campaign.name, description: campaign.description, status: archive ? 'archived' : 'active',
      })
      setCampaigns((list) => list.map((c) => (c.id === campaign.id ? { ...c, status: updated.status } : c)))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível arquivar a campanha.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <header className="page__header animate-fade-up">
        <div>
          <h2 className="page__title" style={{ fontSize: 'var(--text-3xl)' }}>
            Olá, {displayName}
          </h2>
          <p className="page__meta">
            Escolha uma campanha para continuar ou crie uma nova.
          </p>
        </div>
        <div className="campaigns-header-actions">
          <Link to="/campanhas/nova" className="btn btn-primary" style={{ borderColor: 'rgba(255,221,184,0.5)', flexShrink: 0 }}>
            + Criar campanha
          </Link>
          <button
            type="button"
            className={`btn btn-ghost campaigns-archived-btn${showArchived ? ' campaigns-archived-btn--on' : ''}`}
            aria-pressed={showArchived}
            onClick={() => setShowArchived((v) => !v)}
            title={showArchived ? 'Voltar às campanhas ativas' : 'Ver as campanhas arquivadas'}
          >
            <EnvelopeIcon /> Arquivadas{archived.length > 0 ? ` (${archived.length})` : ''}
          </button>
        </div>
      </header>

      {actionError && <div className="page__feedback page__feedback--error" role="alert">{actionError}</div>}

      {deleting && (
        <DeleteCampaignModal
          campaignId={deleting.id}
          campaignName={deleting.name}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setCampaigns((list) => list.filter((c) => c.id !== deleting.id)); setDeleting(null) }}
        />
      )}

      {!loading && !error && showArchived && (
        <div className="campaigns-list animate-fade-up">
          <section>
            <h3 className="campaigns-section__title">
              <span className="campaigns-section__title-icon"><EnvelopeIcon /></span>
              Campanhas arquivadas
            </h3>
            {archived.length === 0 ? (
              <p className="page__empty-text">Nenhuma campanha arquivada. Pra arquivar uma, use o botão de envelope ao lado dela na lista.</p>
            ) : (
              <div className="campaign-cards anim-stagger">
                {archived.map((c) => (
                  <CampaignLine key={c.id} campaign={c} archivedView busy={busyId === c.id} onToggleArchive={() => void setArchived(c, false)} onDelete={() => setDeleting(c)} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {loading && (
        <div className="page__loading animate-fade-in">
          <Loader />
        </div>
      )}

      {!loading && error && (
        <div className="page__feedback page__feedback--error" role="alert">{error}</div>
      )}

      {!loading && !error && !showArchived && active.length === 0 && (
        <div className="page__empty animate-fade-up">
          <div className="page__empty-icon" aria-hidden="true">◈</div>
          <h3 className="page__empty-title">Nenhuma campanha ainda</h3>
          <p className="page__empty-text">Crie sua primeira campanha para começar a jogar.</p>
          <Link to="/campanhas/nova" className="btn btn-ghost" style={{ borderColor: 'var(--gilded)' }}>
            Criar campanha
          </Link>
        </div>
      )}

      {!loading && !error && !showArchived && active.length > 0 && (
        <div className="campaigns-list animate-fade-up">
          {asMaster.length > 0 && (
            <section>
              <h3 className="campaigns-section__title">
                <span className="campaigns-section__title-icon">◈</span>
                Campanhas como mestre
              </h3>
              <div className="campaign-cards anim-stagger">
                {asMaster.map((c) => <CampaignLine key={c.id} campaign={c} busy={busyId === c.id} onToggleArchive={() => void setArchived(c, true)} onDelete={() => setDeleting(c)} />)}
              </div>
            </section>
          )}

          {asPlayer.length > 0 && (
            <section>
              <h3 className="campaigns-section__title">
                <span className="campaigns-section__title-icon">◈</span>
                Campanhas como jogador
              </h3>
              <div className="campaign-cards anim-stagger">
                {asPlayer.map((c) => <CampaignLine key={c.id} campaign={c} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function EnvelopeIcon({ open = false }: { open?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open ? (
        <>
          <path d="M3 9.5 12 3l9 6.5V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
          <path d="m3 9.5 9 6 9-6" />
        </>
      ) : (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3.5 7 8.5 6 8.5-6" />
        </>
      )}
    </svg>
  )
}

/** A campanha na lista, com (só pro mestre) o botão de envelope que arquiva ou desarquiva. */
function CampaignLine({ campaign, archivedView = false, busy = false, onToggleArchive, onDelete }: {
  campaign: CampaignWithRole; archivedView?: boolean; busy?: boolean; onToggleArchive?: () => void; onDelete?: () => void
}) {
  const isMaster = campaign.role === 'master'
  const label = archivedView ? `Desarquivar ${campaign.name}` : `Arquivar ${campaign.name}`
  return (
    <div className="campaign-line">
      <CampaignCard campaign={campaign} />
      {isMaster && onToggleArchive && (
        <button type="button" className="campaign-line__archive" onClick={onToggleArchive} disabled={busy} title={label} aria-label={label}>
          <EnvelopeIcon open={archivedView} />
        </button>
      )}
      {isMaster && onDelete && (
        <button type="button" className="campaign-line__archive campaign-line__delete" onClick={onDelete} disabled={busy} title={`Excluir ${campaign.name}`} aria-label={`Excluir ${campaign.name}`}>
          <TrashIcon />
        </button>
      )}
    </div>
  )
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
    </svg>
  )
}

function CampaignCard({ campaign }: { campaign: CampaignWithRole }) {
  const sysStatus      = getSystemStatus(campaign.system)
  const sysStatusLabel = STATUS_LABELS[sysStatus]

  return (
    <div className="campaign-card-row">
      <div
        className={`campaign-card-row__cover${campaign.cover_url ? '' : ' campaign-card-row__cover--empty'}`}
        style={campaign.cover_url ? { backgroundImage: `url(${campaign.cover_url})` } : undefined}
        aria-hidden="true"
      >
        {!campaign.cover_url && '◈'}
      </div>
      <div className="campaign-card-row__info">
        <span className="campaign-card-row__name">{campaign.name}</span>
        <div className="campaign-card-row__meta">
          <span className="badge">{getSystemLabel(campaign.system)}</span>
          {sysStatusLabel && (
            <span className={`system-status-badge system-status-badge--${sysStatus}`}>
              {sysStatusLabel}
            </span>
          )}
          <span className={`campaign-card-role campaign-card-role--${campaign.role}`}>
            {formatRole(campaign.role)}
          </span>
          <span className={`campaign-status ${getCampaignStatusClass(campaign.status)}`}>
            {getCampaignStatusLabel(campaign.status)}
          </span>
        </div>
        {campaign.description && (
          <p className="campaign-card-row__desc">{campaign.description}</p>
        )}
      </div>
      <Link
        to={`/campanhas/${campaign.id}`}
        className="btn btn-ghost campaign-card-row__enter"
      >
        Entrar →
      </Link>
    </div>
  )
}
