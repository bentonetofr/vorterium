import { useCallback, useEffect, useState } from 'react'
import {
  getInitiativeParticipants,
  getInitiativeState,
  startInitiativeEncounter,
  advanceInitiativeTurn,
  endInitiativeEncounter,
  addInitiativeParticipant,
  setInitiativeValue,
  removeInitiativeParticipant,
  rollInitiative,
  subscribeToInitiative,
} from '../services/initiativeService'
import { getCampaignAltheriumSheets } from '../../sheets/altherium/services/altheriumSheetService'
import type { InitiativeParticipant, InitiativeState } from '../../../shared/types'
import type { CampaignSystem } from '../../../shared/constants/systems'
import './InitiativeTrackerPanel.css'

interface InitiativeTrackerPanelProps {
  campaignId:     string
  currentUserId:  string
  userRole:       'master' | 'player'
  campaignSystem: CampaignSystem
}

export function InitiativeTrackerPanel({ campaignId, currentUserId, userRole, campaignSystem }: InitiativeTrackerPanelProps) {
  const isMaster = userRole === 'master'

  const [participants, setParticipants] = useState<InitiativeParticipant[]>([])
  const [state, setState]               = useState<InitiativeState | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [portraitByUserId, setPortraitByUserId] = useState<Record<string, string>>({})

  const [starting, setStarting]   = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [ending, setEnding]       = useState(false)
  const [rollingIds, setRollingIds] = useState<Set<string>>(new Set())

  const [newNpcName, setNewNpcName]   = useState('')
  const [addingNpc, setAddingNpc]     = useState(false)

  const [editingValueId, setEditingValueId]       = useState<string | null>(null)
  const [editingValueDraft, setEditingValueDraft] = useState('')

  const [actionError, setActionError] = useState<string | null>(null)

  const refreshParticipants = useCallback(() => {
    getInitiativeParticipants(campaignId).then(setParticipants).catch(() => { /* selo só não atualiza */ })
  }, [campaignId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [p, s] = await Promise.all([getInitiativeParticipants(campaignId), getInitiativeState(campaignId)])
        if (cancelled) return
        setParticipants(p)
        setState(s)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar o combate.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [campaignId])

  // Retrato do personagem por participante — só existe no sistema Altherium
  // (as fichas D&D/genérica ainda não têm retrato). Sem relação direta no
  // banco entre participantes e fichas, então monta o mapa no cliente.
  useEffect(() => {
    if (campaignSystem !== 'altherium') return
    let cancelled = false
    getCampaignAltheriumSheets(campaignId)
      .then((sheets) => {
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const s of sheets) {
          if (s.portrait_url) map[s.user_id] = s.portrait_url
        }
        setPortraitByUserId(map)
      })
      .catch(() => { /* retrato só não aparece */ })
    return () => { cancelled = true }
  }, [campaignId, campaignSystem])

  useEffect(() => {
    const unsubscribe = subscribeToInitiative(campaignId, refreshParticipants, setState)
    return unsubscribe
  }, [campaignId, refreshParticipants])

  async function handleStart() {
    setStarting(true)
    setActionError(null)
    try {
      await startInitiativeEncounter(campaignId)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível iniciar o combate.')
    } finally {
      setStarting(false)
    }
  }

  async function handleAdvance() {
    setAdvancing(true)
    setActionError(null)
    try {
      await advanceInitiativeTurn(campaignId)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível avançar o turno.')
    } finally {
      setAdvancing(false)
    }
  }

  async function handleEnd() {
    setEnding(true)
    setActionError(null)
    try {
      await endInitiativeEncounter(campaignId)
      setParticipants([])
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível encerrar o combate.')
    } finally {
      setEnding(false)
    }
  }

  async function handleAddNpc(e: React.FormEvent) {
    e.preventDefault()
    if (!newNpcName.trim()) return
    setAddingNpc(true)
    setActionError(null)
    try {
      await addInitiativeParticipant(campaignId, newNpcName)
      setNewNpcName('')
      refreshParticipants()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível adicionar o participante.')
    } finally {
      setAddingNpc(false)
    }
  }

  async function handleRoll(participantId: string) {
    setRollingIds((prev) => new Set(prev).add(participantId))
    setActionError(null)
    try {
      await rollInitiative(campaignId, participantId, campaignSystem)
      refreshParticipants()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível rolar iniciativa.')
    } finally {
      setRollingIds((prev) => {
        const next = new Set(prev)
        next.delete(participantId)
        return next
      })
    }
  }

  function beginEditValue(p: InitiativeParticipant) {
    setEditingValueId(p.id)
    setEditingValueDraft(p.initiative_value != null ? String(p.initiative_value) : '')
  }

  async function commitEditValue(participantId: string) {
    const raw = editingValueDraft.trim()
    setEditingValueId(null)
    if (raw === '') return
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    try {
      await setInitiativeValue(participantId, Math.trunc(value))
      refreshParticipants()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível atualizar a iniciativa.')
    }
  }

  async function handleRemove(participantId: string) {
    try {
      await removeInitiativeParticipant(participantId)
      refreshParticipants()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível remover o participante.')
    }
  }

  // ── Linha de valores: só quem já rolou entra, posição proporcional ──
  const rolled = participants.filter((p) => p.initiative_value != null) as (InitiativeParticipant & { initiative_value: number })[]
  const minValue = rolled.length > 0 ? Math.min(...rolled.map((p) => p.initiative_value)) : 0
  const maxValue = rolled.length > 0 ? Math.max(...rolled.map((p) => p.initiative_value)) : 0
  const valueRange = maxValue - minValue

  if (loading) {
    return (
      <div className="initiative-panel__state">
        <div className="spinner spinner--sm" />
        <span>Carregando combate...</span>
      </div>
    )
  }

  if (error) {
    return <div className="dice-feedback dice-feedback--error" role="alert">{error}</div>
  }

  if (!state) {
    return (
      <div className="initiative-empty">
        <p className="initiative-empty__text">Nenhum combate ativo no momento.</p>
        {isMaster && (
          <button type="button" className="btn btn-primary" onClick={handleStart} disabled={starting}>
            {starting ? <span className="spinner spinner--sm" /> : 'Iniciar combate'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="initiative-panel">
      <div className="initiative-panel__header">
        <span className="initiative-panel__round">Rodada {state.round_number}</span>
        {isMaster && (
          <div className="initiative-panel__header-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={handleAdvance} disabled={advancing || participants.length === 0}>
              {advancing ? <span className="spinner spinner--sm" /> : 'Avançar turno'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleEnd} disabled={ending}>
              {ending ? <span className="spinner spinner--sm" /> : 'Encerrar combate'}
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="dice-feedback dice-feedback--error" role="alert">{actionError}</div>
      )}

      {participants.length === 0 ? (
        <p className="initiative-empty__text">Nenhum participante — adicione um NPC abaixo ou espere os jogadores entrarem.</p>
      ) : (
        <ul className="initiative-list anim-stagger" aria-label="Ordem de iniciativa">
          {participants.map((p) => {
            const isCurrentTurn = state.current_turn_participant_id === p.id
            const canEdit = isMaster || p.user_id === currentUserId
            const isNpc = p.user_id === null
            const isRolling = rollingIds.has(p.id)
            const isEditing = editingValueId === p.id
            const portraitUrl = p.user_id ? portraitByUserId[p.user_id] : undefined

            return (
              <li key={p.id} className={`initiative-row${isCurrentTurn ? ' initiative-row--current' : ''}`}>
                <span className="initiative-row__avatar" aria-hidden="true">
                  {portraitUrl
                    ? <img src={portraitUrl} alt="" loading="lazy" />
                    : p.name.charAt(0).toUpperCase()
                  }
                </span>
                <span className="initiative-row__name">
                  {p.name}
                  {isNpc && <span className="initiative-row__npc-tag">NPC</span>}
                </span>

                {isEditing ? (
                  <input
                    type="number"
                    autoFocus
                    className="input initiative-row__value-input"
                    value={editingValueDraft}
                    onChange={(e) => setEditingValueDraft(e.target.value)}
                    onBlur={() => commitEditValue(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitEditValue(p.id) }
                      if (e.key === 'Escape') setEditingValueId(null)
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="initiative-row__value"
                    onClick={() => canEdit && beginEditValue(p)}
                    disabled={!canEdit}
                    title={canEdit ? 'Clique para digitar um valor' : undefined}
                  >
                    {p.initiative_value ?? '—'}
                  </button>
                )}

                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm initiative-row__roll"
                    onClick={() => handleRoll(p.id)}
                    disabled={isRolling}
                  >
                    {isRolling ? <span className="spinner spinner--sm" /> : 'Rolar'}
                  </button>
                )}

                {isMaster && (
                  <button
                    type="button"
                    className="initiative-row__remove"
                    onClick={() => handleRemove(p.id)}
                    aria-label={`Remover ${p.name}`}
                    title={`Remover ${p.name}`}
                  >
                    ✕
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {rolled.length > 0 && (
        <div className="initiative-value-bar" aria-hidden="true">
          <div className="initiative-value-bar__track">
            {rolled.map((p) => {
              const position = valueRange === 0 ? 50 : ((p.initiative_value - minValue) / valueRange) * 100
              const isCurrentTurn = state.current_turn_participant_id === p.id
              const portraitUrl = p.user_id ? portraitByUserId[p.user_id] : undefined
              return (
                <span
                  key={p.id}
                  className={`initiative-value-bar__marker${isCurrentTurn ? ' initiative-value-bar__marker--current' : ''}`}
                  style={{ left: `${position}%` }}
                  title={`${p.name}: ${p.initiative_value}`}
                >
                  {portraitUrl
                    ? <img src={portraitUrl} alt="" loading="lazy" />
                    : p.name.charAt(0).toUpperCase()
                  }
                </span>
              )
            })}
          </div>
          <div className="initiative-value-bar__labels">
            <span>{minValue}</span>
            <span>{maxValue}</span>
          </div>
        </div>
      )}

      {isMaster && (
        <form className="initiative-add-npc" onSubmit={handleAddNpc}>
          <input
            type="text"
            className="input"
            placeholder="Nome do NPC/monstro"
            value={newNpcName}
            onChange={(e) => setNewNpcName(e.target.value)}
            disabled={addingNpc}
            maxLength={80}
          />
          <button type="submit" className="btn btn-ghost btn-sm" disabled={addingNpc || !newNpcName.trim()}>
            {addingNpc ? <span className="spinner spinner--sm" /> : 'Adicionar NPC'}
          </button>
        </form>
      )}
    </div>
  )
}
