import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  updateCampaignName,
  deleteCampaign,
  leaveCampaign,
} from '../services/campaignService'
import type { CampaignWithRole } from '../../../shared/types'
import './CampaignSettingsPanel.css'

interface CampaignSettingsPanelProps {
  campaign: CampaignWithRole
  onNameUpdate: (newName: string) => void
}

export function CampaignSettingsPanel({ campaign, onNameUpdate }: CampaignSettingsPanelProps) {
  const navigate  = useNavigate()
  const isMaster  = campaign.role === 'master'
  const isPlayer  = campaign.role === 'player'

  // ── Edição de nome ──
  const [editOpen, setEditOpen]     = useState(false)
  const [editName, setEditName]     = useState(campaign.name)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError]   = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState(false)

  // ── Exclusão ──
  const [deleting, setDeleting]       = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ── Sair ──
  const [leaving, setLeaving]       = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  function openEdit() {
    setEditName(campaign.name)
    setEditError(null)
    setEditSuccess(false)
    setEditOpen(true)
  }

  async function handleSaveName(e: FormEvent) {
    e.preventDefault()
    setEditError(null)
    setEditSuccess(false)

    const trimmed = editName.trim()
    if (!trimmed) {
      setEditError('O nome da campanha não pode ser vazio.')
      return
    }

    setEditSaving(true)
    try {
      await updateCampaignName(campaign.id, trimmed)
      onNameUpdate(trimmed)
      setEditOpen(false)
      setEditSuccess(true)
      setTimeout(() => setEditSuccess(false), 3500)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Não foi possível atualizar a campanha.')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir "${campaign.name}"?\n\n` +
      `Esta ação remove a campanha e todos os dados relacionados ` +
      `(membros, fichas, rolagens e convites). Não é possível desfazer.`
    )
    if (!confirmed) return

    setDeleteError(null)
    setDeleting(true)
    try {
      await deleteCampaign(campaign.id)
      navigate('/campanhas', { replace: true })
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Não foi possível excluir a campanha.')
      setDeleting(false)
    }
  }

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

        {/* ── Editar nome (mestre) ── */}
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
              <form onSubmit={handleSaveName} className="settings-panel__edit-form" noValidate>
                <div className="settings-panel__edit-field">
                  <label className="label" htmlFor="settings-campaign-name">
                    Nome da campanha
                  </label>
                  <input
                    id="settings-campaign-name"
                    type="text"
                    className="input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={editSaving}
                    autoFocus
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
                  <button type="submit" className="btn btn-primary" disabled={editSaving}>
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

        {/* ── Excluir campanha (mestre) ── */}
        {isMaster && (
          <div className="settings-panel__section settings-panel__section--danger">
            <span className="settings-panel__section-label">Zona de risco</span>

            {deleteError && (
              <p className="settings-panel__msg settings-panel__msg--error" role="alert">
                {deleteError}
              </p>
            )}

            <button
              className="btn btn-danger settings-panel__action"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <><span className="spinner spinner--sm" /> Excluindo...</>
                : 'Excluir campanha'
              }
            </button>
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
