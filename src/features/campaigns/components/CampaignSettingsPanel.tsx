import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAMPAIGN_COVER_MAX_BYTES,
  CAMPAIGN_COVER_TYPES,
  updateCampaignDetails,
  uploadCampaignCover,
  removeCampaignCover,
  deleteCampaign,
  leaveCampaign,
} from '../services/campaignService'
import { CampaignCoverCropEditor } from './CampaignCoverCropEditor'
import { Collapse } from '../../../shared/components/Collapse'
import { getSystemLabel, getSystemStatus, STATUS_LABELS } from '../../../shared/constants/systems'
import type { CampaignWithRole } from '../../../shared/types'
import { Select } from '../../../shared/components/Select'
import './CampaignSettingsPanel.css'

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface CampaignSettingsPanelProps {
  campaign:         CampaignWithRole
  onCampaignUpdate: (updated: {
    name:        string
    description: string | null
    status:      CampaignWithRole['status']
    cover_url:   string | null
  }) => void
}

// ────────────────────────────────────────────────────────
// Constante
// ────────────────────────────────────────────────────────

const NAME_MAX        = 120
const DESCRIPTION_MAX = 1000

const STATUS_OPTIONS: { value: CampaignWithRole['status']; label: string }[] = [
  { value: 'active',   label: 'Ativa' },
  { value: 'paused',   label: 'Pausada' },
  { value: 'archived', label: 'Encerrada' },
]

// ────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────

export function CampaignSettingsPanel({ campaign, onCampaignUpdate }: CampaignSettingsPanelProps) {
  const navigate  = useNavigate()
  const isMaster  = campaign.role === 'master'
  const isPlayer  = campaign.role === 'player'

  // ── Edição de dados ──
  const [editOpen,    setEditOpen]    = useState(false)
  const [editName,    setEditName]    = useState(campaign.name)
  const [editDesc,    setEditDesc]    = useState(campaign.description ?? '')
  const [editStatus,  setEditStatus]  = useState<CampaignWithRole['status']>(campaign.status)
  const [editSaving,  setEditSaving]  = useState(false)
  const [editError,   setEditError]   = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState(false)

  // ── Capa ──
  const [coverBusy, setCoverBusy] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)
  const [coverDraft, setCoverDraft] = useState<File | null>(null)

  // ── Exclusão ──
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // ── Sair ──
  const [leaving,    setLeaving]    = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  const nameOver = editName.length > NAME_MAX
  const descOver = editDesc.length > DESCRIPTION_MAX

  // ── Abertura do formulário ──
  function openEdit() {
    setEditName(campaign.name)
    setEditDesc(campaign.description ?? '')
    setEditStatus(campaign.status)
    setEditError(null)
    setEditSuccess(false)
    setEditOpen(true)
  }

  // ── Salvar alterações ──
  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setEditError(null)
    setEditSuccess(false)

    const trimmedName = editName.trim()
    if (!trimmedName) {
      setEditError('O nome da campanha não pode ser vazio.')
      return
    }
    if (nameOver) {
      setEditError(`O nome deve ter no máximo ${NAME_MAX} caracteres.`)
      return
    }
    if (descOver) {
      setEditError(`A descrição deve ter no máximo ${DESCRIPTION_MAX} caracteres.`)
      return
    }
    if (!STATUS_OPTIONS.some((o) => o.value === editStatus)) {
      setEditError('Selecione um status válido.')
      return
    }

    setEditSaving(true)
    try {
      const updated = await updateCampaignDetails(campaign.id, {
        name:        trimmedName,
        description: editDesc.trim() || null,
        status:      editStatus,
      })
      onCampaignUpdate({
        name:        updated.name,
        description: updated.description,
        status:      updated.status,
        cover_url:   updated.cover_url,
      })
      setEditOpen(false)
      setEditSuccess(true)
      setTimeout(() => setEditSuccess(false), 3500)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Não foi possível atualizar a campanha.')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleCoverChange(file: File | undefined) {
    if (!file) return
    setCoverError(null)

    if (!CAMPAIGN_COVER_TYPES.includes(file.type as (typeof CAMPAIGN_COVER_TYPES)[number])) {
      setCoverError('Escolha uma imagem JPG, PNG ou WebP.')
      return
    }
    if (file.size > CAMPAIGN_COVER_MAX_BYTES) {
      setCoverError('A capa deve ter no máximo 10 MB.')
      return
    }

    setCoverDraft(file)
  }

  async function handleCoverSave(file: File) {
    setCoverError(null)
    setCoverBusy(true)
    try {
      const updated = await uploadCampaignCover(campaign.id, file)
      onCampaignUpdate({
        name: updated.name,
        description: updated.description,
        status: updated.status,
        cover_url: updated.cover_url,
      })
      setCoverDraft(null)
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : 'Não foi possível atualizar a capa.')
    } finally {
      setCoverBusy(false)
    }
  }

  async function handleCoverRemove() {
    setCoverError(null)
    setCoverBusy(true)
    try {
      const updated = await removeCampaignCover(campaign.id)
      onCampaignUpdate({
        name: updated.name,
        description: updated.description,
        status: updated.status,
        cover_url: updated.cover_url,
      })
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : 'Não foi possível remover a capa.')
    } finally {
      setCoverBusy(false)
    }
  }

  // ── Excluir campanha ──
  async function handleDelete() {
    setDeleteError(null)
    setDeleting(true)
    try {
      await deleteCampaign(campaign.id)
      navigate('/campanhas', { replace: true })
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Não foi possível excluir a campanha.')
      setDeleting(false)
    } finally {
      setDeleteConfirm(false)
    }
  }

  // ── Sair da campanha ──
  async function handleLeave() {
    const confirmed = window.confirm(
      `Tem certeza que deseja sair de "${campaign.name}"?\n\n` +
      `Você perderá o acesso e precisará de um novo convite para entrar novamente.`
    )
    if (!confirmed) return

    setLeaveError(null)
    setLeaving(true)
    try {
      await leaveCampaign(campaign.id)
      navigate('/campanhas', { replace: true })
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Não foi possível sair da campanha.')
      setLeaving(false)
    }
  }

  return (
    <section className="settings-panel">
      <header className="settings-panel__header">
        <span className="settings-panel__icon" aria-hidden="true">◈</span>
        <h3 className="settings-panel__title">Configurações</h3>
      </header>

      <div className="settings-panel__body">

        {/* ── Sistema (somente leitura) ── */}
        <div className="settings-panel__section">
          <span className="settings-panel__section-label">Sistema</span>
          <div className="settings-system-readonly">
            <span className="settings-system-readonly__label">Sistema da campanha</span>
            <span className="settings-system-readonly__value">
              {getSystemLabel(campaign.system)}
              {STATUS_LABELS[getSystemStatus(campaign.system)] && (
                <span className={`system-status-badge system-status-badge--${getSystemStatus(campaign.system)}`}>
                  {STATUS_LABELS[getSystemStatus(campaign.system)]}
                </span>
              )}
            </span>
            <span className="settings-system-readonly__hint">
              Este campo não pode ser alterado após a criação da campanha.
            </span>
          </div>
        </div>

        {/* ── Editar dados (mestre) ── */}
        {isMaster && (
          <div className="settings-panel__section">
            <span className="settings-panel__section-label">Campanha</span>

            {editSuccess && (
              <p className="settings-panel__msg settings-panel__msg--success" role="status">
                Campanha atualizada com sucesso.
              </p>
            )}

            {!editOpen ? (
              <button
                className="btn btn-ghost settings-panel__action"
                onClick={openEdit}
              >
                Editar campanha
              </button>
            ) : (
              <form onSubmit={handleSave} className="settings-panel__edit-form" noValidate>

                {/* Nome */}
                <div className="settings-panel__edit-field">
                  <label className="label" htmlFor="settings-campaign-name">
                    Nome da campanha
                  </label>
                  <input
                    id="settings-campaign-name"
                    type="text"
                    className={`input${nameOver ? ' input--error' : ''}`}
                    value={editName}
                    onChange={(e) => { setEditName(e.target.value); setEditError(null) }}
                    disabled={editSaving}
                    autoFocus
                  />
                  <span className={`settings-panel__counter${nameOver ? ' settings-panel__counter--over' : ''}`}>
                    {editName.length}/{NAME_MAX}
                  </span>
                </div>

                {/* Descrição */}
                <div className="settings-panel__edit-field">
                  <label className="label" htmlFor="settings-campaign-desc">
                    Descrição{' '}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span>
                  </label>
                  <textarea
                    id="settings-campaign-desc"
                    className={`input settings-panel__textarea${descOver ? ' input--error' : ''}`}
                    placeholder="Breve descrição da campanha, cenário ou premissa..."
                    value={editDesc}
                    rows={4}
                    onChange={(e) => { setEditDesc(e.target.value); setEditError(null) }}
                    disabled={editSaving}
                  />
                  <span className={`settings-panel__counter${descOver ? ' settings-panel__counter--over' : ''}`}>
                    {editDesc.length}/{DESCRIPTION_MAX}
                  </span>
                </div>

                {/* Status */}
                <div className="settings-panel__edit-field">
                  <label className="label" htmlFor="settings-campaign-status">
                    Status
                  </label>
                  <Select
                    id="settings-campaign-status"
                    value={editStatus}
                    onChange={(v) => {
                      setEditStatus(v as CampaignWithRole['status'])
                      setEditError(null)
                    }}
                    disabled={editSaving}
                    options={STATUS_OPTIONS}
                  />
                </div>

                {editError && (
                  <p className="settings-panel__msg settings-panel__msg--error" role="alert">
                    {editError}
                  </p>
                )}

                <div className="settings-panel__edit-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setEditOpen(false)}
                    disabled={editSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={editSaving || nameOver || descOver}
                  >
                    {editSaving
                      ? <><span className="spinner spinner--sm" /> Salvando...</>
                      : 'Salvar alterações'
                    }
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── Capa da campanha (mestre) ── */}
        {isMaster && (
          <div className="settings-panel__section">
            <span className="settings-panel__section-label">Identidade visual</span>

            {campaign.cover_url ? (
              <div
                key={campaign.cover_url}
                className="campaign-cover-preview anim-img-swap"
                style={{ backgroundImage: `url(${campaign.cover_url})` }}
                role="img"
                aria-label={`Capa da campanha ${campaign.name}`}
              />
            ) : (
              <div className="campaign-cover-preview campaign-cover-preview--empty" aria-hidden="true">
                <span>◈</span>
              </div>
            )}

            <p className="settings-panel__hint">
              JPG, PNG ou WebP. Tamanho máximo de 10 MB.
            </p>

            {coverError && (
              <p className="settings-panel__msg settings-panel__msg--error" role="alert">
                {coverError}
              </p>
            )}

            <div className="settings-panel__cover-actions">
              <label className="btn btn-ghost settings-panel__action">
                {coverBusy ? 'Enviando...' : campaign.cover_url ? 'Trocar capa' : 'Enviar capa'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  disabled={coverBusy}
                onChange={(e) => {
                  void handleCoverChange(e.target.files?.[0])
                    e.currentTarget.value = ''
                  }}
                />
              </label>
              {campaign.cover_url && (
                <button
                  type="button"
                  className="btn btn-ghost settings-panel__action"
                  onClick={() => void handleCoverRemove()}
                  disabled={coverBusy}
                >
                  Remover
                </button>
              )}
            </div>

            <Collapse open={!!coverDraft}>
              {() => coverDraft && (
                <CampaignCoverCropEditor
                  file={coverDraft}
                  saving={coverBusy}
                  onCancel={() => setCoverDraft(null)}
                  onSave={handleCoverSave}
                />
              )}
            </Collapse>
          </div>
        )}

        {/* ── Excluir campanha (mestre) ── */}
        {isMaster && (
          <div className="settings-panel__section settings-panel__section--danger">
            <span className="settings-panel__section-label">Zona de risco</span>

            {deleteError && (
              <p className="settings-panel__msg settings-panel__msg--error" role="alert">
                {deleteError}
              </p>
            )}

            {deleteConfirm ? (
              <div className="settings-panel__confirm">
                <p className="settings-panel__confirm-text">
                  Excluir <strong>{campaign.name}</strong>? Esta ação remove todos os dados
                  relacionados e não pode ser desfeita.
                </p>
                <div className="settings-panel__confirm-actions">
                  <button
                    className="btn btn-danger"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting
                      ? <><span className="spinner spinner--sm" /> Excluindo...</>
                      : 'Confirmar exclusão'
                    }
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setDeleteConfirm(false)}
                    disabled={deleting}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="btn btn-danger settings-panel__action"
                onClick={() => setDeleteConfirm(true)}
                disabled={deleting}
              >
                Excluir campanha
              </button>
            )}
          </div>
        )}

        {/* ── Sair da campanha (jogador) ── */}
        {isPlayer && (
          <div className="settings-panel__section settings-panel__section--danger">
            <span className="settings-panel__section-label">Participação</span>

            {leaveError && (
              <p className="settings-panel__msg settings-panel__msg--error" role="alert">
                {leaveError}
              </p>
            )}

            <button
              className="btn btn-danger settings-panel__action"
              onClick={handleLeave}
              disabled={leaving}
            >
              {leaving
                ? <><span className="spinner spinner--sm" /> Saindo...</>
                : 'Sair da campanha'
              }
            </button>
          </div>
        )}

      </div>
    </section>
  )
}
