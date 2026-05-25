import { FormEvent, useCallback, useEffect, useState } from 'react'
import {
  getCampaignMembers,
  findProfileByEmail,
  addCampaignMember,
  removeCampaignMember,
} from '../services/memberService'
import type { CampaignMemberWithProfile } from '../../../shared/types'
import { formatRole } from '../../../shared/utils/campaign'
import './CampaignMembersPanel.css'

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface CampaignMembersPanelProps {
  campaignId: string
  userRole: 'master' | 'player'
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
  return (
    <div className="member-avatar" aria-hidden="true">
      {initial}
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

  // ── Estado: lista de membros ──
  const [members, setMembers]       = useState<CampaignMemberWithProfile[]>([])
  const [loading, setLoading]       = useState(true)
  const [listError, setListError]   = useState<string | null>(null)

  // ── Estado: formulário de adição ──
  const [addEmail, setAddEmail]     = useState('')
  const [adding, setAdding]         = useState(false)
  const [addError, setAddError]     = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState<string | null>(null)

  // ── Estado: remoção ──
  const [removingId, setRemovingId] = useState<string | null>(null)

  // ── Carregamento inicial ──
  const loadMembers = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const data = await getCampaignMembers(campaignId)
      setMembers(data)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Erro ao carregar membros.')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  // ── Adicionar jogador ──
  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setAddError(null)
    setAddSuccess(null)

    const email = addEmail.trim()
    if (!email) {
      setAddError('Digite o e-mail do jogador.')
      return
    }

    setAdding(true)
    try {
      const profile = await findProfileByEmail(email)
      if (!profile) {
        setAddError('Usuário não encontrado. Verifique o e-mail ou peça para o jogador criar uma conta.')
        return
      }

      await addCampaignMember(campaignId, profile.id)
      setAddSuccess(`${profile.display_name} adicionado com sucesso!`)
      setAddEmail('')
      await loadMembers()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Não foi possível adicionar o jogador.')
    } finally {
      setAdding(false)
    }
  }

  // ── Remover jogador ──
  async function handleRemove(member: CampaignMemberWithProfile) {
    const confirmed = window.confirm(
      `Remover ${member.profile.display_name} da campanha?`
    )
    if (!confirmed) return

    setRemovingId(member.user_id)
    try {
      await removeCampaignMember(campaignId, member.user_id)
      await loadMembers()
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Não foi possível remover o jogador.')
    } finally {
      setRemovingId(null)
    }
  }

  // ────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────

  return (
    <section className="members-panel">
      {/* Cabeçalho do painel */}
      <header className="members-panel__header">
        <div className="members-panel__title-row">
          <span className="members-panel__icon" aria-hidden="true">◈</span>
          <h3 className="members-panel__title">Membros</h3>
          {!loading && (
            <span className="badge">{members.length}</span>
          )}
        </div>
      </header>

      {/* Erro da lista */}
      {listError && (
        <div className="members-panel__feedback members-panel__feedback--error" role="alert">
          {listError}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="members-panel__loading">
          <div className="spinner spinner--sm" />
          <span>Carregando membros...</span>
        </div>
      )}

      {/* Lista de membros */}
      {!loading && !listError && (
        <ul className="members-list" aria-label="Membros da campanha">
          {members.map((member) => {
            const isCurrentUser = member.user_id === currentUserId
            const isRemoving    = removingId === member.user_id
            const canRemove     = isMaster && member.role === 'player' && !isCurrentUser

            return (
              <li key={member.id} className="member-row">
                <AvatarPlaceholder name={member.profile.display_name} />

                <div className="member-row__info">
                  <span className="member-row__name">
                    {member.profile.display_name}
                    {isCurrentUser && (
                      <span className="member-row__you"> (você)</span>
                    )}
                  </span>
                  <span className="member-row__email">{member.profile.email}</span>
                </div>

                <div className="member-row__meta">
                  <span className={`member-row__role member-row__role--${member.role}`}>
                    {formatRole(member.role)}
                  </span>
                  <span className="member-row__date">
                    desde {formatEntryDate(member.created_at)}
                  </span>
                </div>

                {canRemove && (
                  <button
                    className="btn btn-danger member-row__remove"
                    onClick={() => handleRemove(member)}
                    disabled={isRemoving}
                    aria-label={`Remover ${member.profile.display_name}`}
                  >
                    {isRemoving
                      ? <span className="spinner spinner--sm" />
                      : 'Remover'
                    }
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Formulário de adição — apenas para o mestre */}
      {isMaster && (
        <div className="members-panel__add">
          <div className="members-panel__add-header">
            <h4 className="members-panel__add-title">Adicionar jogador</h4>
            <p className="members-panel__add-hint">
              O jogador precisa já ter conta no Campaign Lab.
            </p>
          </div>

          {addError && (
            <div className="members-panel__feedback members-panel__feedback--error" role="alert">
              {addError}
            </div>
          )}
          {addSuccess && (
            <div className="members-panel__feedback members-panel__feedback--success" role="status">
              {addSuccess}
            </div>
          )}

          <form onSubmit={handleAdd} className="members-panel__add-form" noValidate>
            <input
              type="email"
              className="input"
              placeholder="E-mail do jogador"
              value={addEmail}
              onChange={(e) => {
                setAddEmail(e.target.value)
                setAddError(null)
                setAddSuccess(null)
              }}
              disabled={adding}
              aria-label="E-mail do jogador"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={adding}
            >
              {adding
                ? <><span className="spinner spinner--sm" /> Adicionando...</>
                : 'Adicionar jogador'
              }
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
