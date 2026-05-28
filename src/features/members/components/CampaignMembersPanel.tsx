import { FormEvent, useCallback, useEffect, useState } from 'react'
import {
  getCampaignMembers,
  getCampaignMembersWithSheetStatus,
  findProfileByEmail,
  addCampaignMember,
  removeCampaignMember,
  type CampaignMemberWithSheetStatus,
  type SheetStatus,
} from '../services/memberService'
import {
  buildInviteUrl,
  createCampaignInvite,
  deactivateCampaignInvite,
  getActiveCampaignInvite,
} from '../../invites/services/inviteService'
import type { CampaignMemberWithProfile } from '../../../shared/types'
import { formatRole } from '../../../shared/utils/campaign'
import './CampaignMembersPanel.css'

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface CampaignMembersPanelProps {
  campaignId:    string
  userRole:      'master' | 'player'
  currentUserId: string
}

// ────────────────────────────────────────────────────────
// Utilitários
// ────────────────────────────────────────────────────────

function formatEntryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  })
}

function AvatarPlaceholder({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return <div className="member-avatar" aria-hidden="true">{initial}</div>
}

function SheetStatusBadge({ status }: { status: SheetStatus }) {
  if (status === 'filled') {
    return <span className="member-sheet-badge member-sheet-badge--filled">Ficha preenchida</span>
  }
  if (status === 'not_filled') {
    return <span className="member-sheet-badge member-sheet-badge--empty">Ficha não preenchida</span>
  }
  return <span className="member-sheet-badge member-sheet-badge--none">Ficha não criada</span>
}

// ────────────────────────────────────────────────────────
// Card individual de membro
// ────────────────────────────────────────────────────────

interface MemberCardProps {
  member:        CampaignMemberWithProfile
  sheetStatus?:  SheetStatus
  currentUserId: string
  isMaster:      boolean
  confirmId:     string | null
  setConfirmId:  (id: string | null) => void
  removingId:    string | null
  onRemove:      (member: CampaignMemberWithProfile) => void
}

function MemberCard({
  member,
  sheetStatus,
  currentUserId,
  isMaster,
  confirmId,
  setConfirmId,
  removingId,
  onRemove,
}: MemberCardProps) {
  const isCurrentUser = member.user_id === currentUserId
  const isRemoving    = removingId === member.user_id
  const isConfirming  = confirmId === member.user_id
  const canRemove     = isMaster && member.role === 'player' && !isCurrentUser

  return (
    <div className={`member-card ${isCurrentUser ? 'member-card--self' : ''}`}>
      <AvatarPlaceholder name={member.profile.display_name} />

      <div className="member-card__info">
        <div className="member-card__name-row">
          <span className="member-card__name">{member.profile.display_name}</span>
          {isCurrentUser && (
            <span className="member-card__you">você</span>
          )}
          <span className={`member-card__role member-card__role--${member.role}`}>
            {formatRole(member.role)}
          </span>
        </div>
        <span className="member-card__email">{member.profile.email}</span>
        <div className="member-card__meta">
          <span className="member-card__date">
            desde {formatEntryDate(member.created_at)}
          </span>
          {sheetStatus !== undefined && (
            <SheetStatusBadge status={sheetStatus} />
          )}
        </div>
      </div>

      {canRemove && (
        <div className="member-card__actions">
          {isConfirming ? (
            <div className="member-card__confirm">
              <span className="member-card__confirm-label">Remover jogador?</span>
              <button
                className="btn btn-danger member-card__confirm-btn"
                onClick={() => onRemove(member)}
                disabled={isRemoving}
                aria-label="Confirmar remoção"
              >
                {isRemoving
                  ? <span className="spinner spinner--sm" />
                  : 'Confirmar'
                }
              </button>
              <button
                className="btn btn-ghost member-card__confirm-btn"
                onClick={() => setConfirmId(null)}
                disabled={isRemoving}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              className="btn btn-ghost member-card__remove"
              onClick={() => setConfirmId(member.user_id)}
              disabled={isRemoving}
              aria-label={`Remover ${member.profile.display_name}`}
            >
              Remover
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Seção de membros (Mestre / Jogadores)
// ────────────────────────────────────────────────────────

interface MemberSectionProps {
  title:         string
  members:       CampaignMemberWithProfile[]
  emptyMessage?: string
  currentUserId: string
  isMaster:      boolean
  confirmId:     string | null
  setConfirmId:  (id: string | null) => void
  removingId:    string | null
  onRemove:      (member: CampaignMemberWithProfile) => void
}

function MemberSection({
  title,
  members,
  emptyMessage,
  currentUserId,
  isMaster,
  confirmId,
  setConfirmId,
  removingId,
  onRemove,
}: MemberSectionProps) {
  return (
    <div className="members-section">
      <h4 className="members-section__title">{title}</h4>
      {members.length === 0 ? (
        <p className="members-section__empty">{emptyMessage ?? 'Nenhum membro.'}</p>
      ) : (
        <div className="members-section__list">
          {members.map((m) => {
            const sheetStatus = ('sheetStatus' in m)
              ? (m as CampaignMemberWithSheetStatus).sheetStatus
              : undefined
            return (
              <MemberCard
                key={m.id}
                member={m}
                sheetStatus={sheetStatus}
                currentUserId={currentUserId}
                isMaster={isMaster}
                confirmId={confirmId}
                setConfirmId={setConfirmId}
                removingId={removingId}
                onRemove={onRemove}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Card de convite por link
// ────────────────────────────────────────────────────────

function InviteCard({ campaignId }: { campaignId: string }) {
  const [inviteUrl,   setInviteUrl]   = useState<string | null>(null)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [initLoading, setInitLoading] = useState(true)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [copied,      setCopied]      = useState(false)

  useEffect(() => {
    setInitLoading(true)
    getActiveCampaignInvite(campaignId)
      .then((invite) => {
        if (invite) {
          setInviteToken(invite.token)
          setInviteUrl(buildInviteUrl(invite.token))
        }
      })
      .catch(() => { /* falha silenciosa — botão "Gerar" fica disponível */ })
      .finally(() => setInitLoading(false))
  }, [campaignId])

  async function handleGenerate() {
    setError(null)
    setLoading(true)
    try {
      const invite = await createCampaignInvite(campaignId)
      setInviteToken(invite.token)
      setInviteUrl(buildInviteUrl(invite.token))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar o convite.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return
    try { await navigator.clipboard.writeText(inviteUrl) } catch { /* sem permissão */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function handleDeactivate() {
    if (!inviteToken) return
    setError(null)
    try {
      await deactivateCampaignInvite(inviteToken, campaignId)
      setInviteUrl(null)
      setInviteToken(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível desativar o convite.')
    }
  }

  return (
    <div className="members-block">
      <div className="members-block__header">
        <span className="members-block__icon" aria-hidden="true">⬡</span>
        <div className="members-block__header-text">
          <h4 className="members-block__title">Convite por link</h4>
          <p className="members-block__desc">
            Compartilhe o link para que jogadores entrem diretamente na campanha.
          </p>
        </div>
        {!initLoading && (
          <span className={`invite-status-badge invite-status-badge--${inviteUrl ? 'active' : 'inactive'}`}>
            {inviteUrl ? 'Convite ativo' : 'Sem convite'}
          </span>
        )}
      </div>

      {error && (
        <div className="members-block__feedback members-block__feedback--error" role="alert">
          {error}
        </div>
      )}

      {initLoading ? (
        <div className="members-block__loading">
          <div className="spinner spinner--sm" />
          <span>Carregando...</span>
        </div>
      ) : !inviteUrl ? (
        <button
          className="btn btn-ghost members-block__action-btn"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading
            ? <><span className="spinner spinner--sm" /> Gerando...</>
            : 'Gerar link de convite'
          }
        </button>
      ) : (
        <>
          <div className="invite-link-row">
            <span className="invite-link-url" title={inviteUrl}>{inviteUrl}</span>
            <button
              className="btn btn-primary invite-link-copy"
              onClick={handleCopy}
              disabled={copied}
            >
              {copied ? '✓ Copiado' : 'Copiar link'}
            </button>
          </div>
          {copied && (
            <span className="invite-copied-msg">Link copiado para a área de transferência!</span>
          )}
          <button
            className="btn btn-ghost invite-deactivate-btn"
            onClick={handleDeactivate}
          >
            Desativar convite
          </button>
        </>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Formulário de adição por e-mail
// ────────────────────────────────────────────────────────

function AddPlayerForm({
  campaignId,
  onAdded,
}: {
  campaignId: string
  onAdded:    () => void
}) {
  const [email,   setEmail]   = useState('')
  const [adding,  setAdding]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const trimmed = email.trim()
    if (!trimmed) { setError('Digite o e-mail do jogador.'); return }

    setAdding(true)
    try {
      const profile = await findProfileByEmail(trimmed)
      if (!profile) {
        setError('Usuário não encontrado. Verifique o e-mail ou peça para o jogador criar uma conta.')
        return
      }
      await addCampaignMember(campaignId, profile.id, profile.display_name)
      setSuccess(`${profile.display_name} adicionado com sucesso!`)
      setEmail('')
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível adicionar o jogador.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="members-block">
      <div className="members-block__header">
        <span className="members-block__icon" aria-hidden="true">⊕</span>
        <div className="members-block__header-text">
          <h4 className="members-block__title">Adicionar jogador</h4>
          <p className="members-block__desc">
            O jogador precisa ter uma conta no Vorterium.
          </p>
        </div>
      </div>

      {error && (
        <div className="members-block__feedback members-block__feedback--error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="members-block__feedback members-block__feedback--success" role="status">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="add-player-form" noValidate>
        <label className="add-player-form__label" htmlFor="add-player-email">
          E-mail do jogador
        </label>
        <div className="add-player-form__row">
          <input
            id="add-player-email"
            type="email"
            className="input add-player-form__input"
            placeholder="jogador@exemplo.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
              setSuccess(null)
            }}
            disabled={adding}
            aria-label="E-mail do jogador"
          />
          <button type="submit" className="btn btn-primary" disabled={adding}>
            {adding
              ? <><span className="spinner spinner--sm" /> Adicionando...</>
              : 'Adicionar jogador'
            }
          </button>
        </div>
      </form>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────

export function CampaignMembersPanel({
  campaignId,
  userRole,
  currentUserId,
}: CampaignMembersPanelProps) {
  const isMaster = userRole === 'master'

  const [members,     setMembers]     = useState<CampaignMemberWithProfile[]>([])
  const [loading,     setLoading]     = useState(true)
  const [listError,   setListError]   = useState<string | null>(null)
  const [removingId,  setRemovingId]  = useState<string | null>(null)
  const [confirmId,   setConfirmId]   = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const loadMembers = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const data = isMaster
        ? await getCampaignMembersWithSheetStatus(campaignId)
        : await getCampaignMembers(campaignId)
      setMembers(data)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Erro ao carregar membros.')
    } finally {
      setLoading(false)
    }
  }, [campaignId, isMaster])

  useEffect(() => { loadMembers() }, [loadMembers])

  async function handleRemove(member: CampaignMemberWithProfile) {
    setRemoveError(null)
    setRemovingId(member.user_id)
    try {
      await removeCampaignMember(campaignId, member.user_id, member.profile.display_name)
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id))
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Não foi possível remover o jogador.')
    } finally {
      setRemovingId(null)
      setConfirmId(null)
    }
  }

  const masterMembers = members.filter((m) => m.role === 'master')
  const playerMembers = members.filter((m) => m.role === 'player')

  return (
    <div className="members-panel">

      {/* ── Ações do mestre ── */}
      {isMaster && <InviteCard campaignId={campaignId} />}
      {isMaster && <AddPlayerForm campaignId={campaignId} onAdded={loadMembers} />}

      {/* ── Lista de membros ── */}
      {loading ? (
        <div className="members-panel__state">
          <div className="spinner spinner--sm" />
          <span>Carregando membros...</span>
        </div>
      ) : listError ? (
        <div className="members-panel__feedback members-panel__feedback--error" role="alert">
          {listError}
        </div>
      ) : (
        <div className="members-list-container">
          {removeError && (
            <div className="members-panel__feedback members-panel__feedback--error" role="alert">
              {removeError}
            </div>
          )}

          <MemberSection
            title="Mestre"
            members={masterMembers}
            currentUserId={currentUserId}
            isMaster={isMaster}
            confirmId={confirmId}
            setConfirmId={setConfirmId}
            removingId={removingId}
            onRemove={handleRemove}
          />

          <MemberSection
            title="Jogadores"
            members={playerMembers}
            emptyMessage="Nenhum jogador adicionado ainda."
            currentUserId={currentUserId}
            isMaster={isMaster}
            confirmId={confirmId}
            setConfirmId={setConfirmId}
            removingId={removingId}
            onRemove={handleRemove}
          />
        </div>
      )}
    </div>
  )
}
