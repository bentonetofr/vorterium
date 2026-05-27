import { useCallback, useEffect, useState } from 'react'
import {
  getCampaignActivity,
  getCampaignPresence,
  isUserOnline,
  formatActivityTime,
  formatPresenceTime,
  ACTIVITY_ICONS,
} from '../services/activityService'
import { getCampaignMembers } from '../../members/services/memberService'
import type { CampaignActivity, CampaignMemberWithProfile, CampaignPresenceRecord } from '../../../shared/types'
import './CampaignActivityPanel.css'

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface CampaignActivityPanelProps {
  campaignId: string
  userRole:   'master' | 'player'
}

// ────────────────────────────────────────────────────────
// Tipos internos
// ────────────────────────────────────────────────────────

interface MemberPresence {
  member:      CampaignMemberWithProfile
  lastSeenAt:  string | undefined
  online:      boolean
}

// ────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────

export function CampaignActivityPanel({ campaignId }: CampaignActivityPanelProps) {
  const [activities,  setActivities]  = useState<CampaignActivity[]>([])
  const [presenceList, setPresenceList] = useState<MemberPresence[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [refreshing,  setRefreshing]  = useState(false)

  const load = useCallback(async () => {
    try {
      const [acts, members, presence] = await Promise.all([
        getCampaignActivity(campaignId),
        getCampaignMembers(campaignId),
        getCampaignPresence(campaignId),
      ])

      const presenceMap = new Map<string, string>(
        presence.map((p: CampaignPresenceRecord) => [p.user_id, p.last_seen_at])
      )

      const merged: MemberPresence[] = members.map((m) => {
        const lastSeenAt = presenceMap.get(m.user_id)
        return { member: m, lastSeenAt, online: isUserOnline(lastSeenAt) }
      })

      merged.sort((a, b) => {
        if (a.online && !b.online) return -1
        if (!a.online && b.online) return 1
        if (a.lastSeenAt && b.lastSeenAt) {
          return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
        }
        if (a.lastSeenAt) return -1
        if (b.lastSeenAt) return 1
        return 0
      })

      setActivities(acts)
      setPresenceList(merged)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a atividade.')
    }
  }, [campaignId])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  async function handleRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const onlineCount = presenceList.filter((p) => p.online).length

  return (
    <section className="act-panel">

      {/* ── Cabeçalho ── */}
      <header className="act-panel__header">
        <div className="act-panel__header-left">
          <span className="act-panel__icon" aria-hidden="true">◉</span>
          <h3 className="act-panel__title">Atividade</h3>
          {!loading && (
            <span className="act-panel__subtitle">
              Últimas {activities.length} ações da campanha
            </span>
          )}
        </div>
        <button
          className="btn btn-ghost act-panel__refresh"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          aria-label="Atualizar atividade"
        >
          <span className={refreshing ? 'act-panel__refresh-icon--spin' : 'act-panel__refresh-icon'}>
            ↺
          </span>
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </header>

      {/* ── Conteúdo ── */}
      {loading ? (
        <div className="act-state">
          <div className="spinner spinner--sm" />
          <span>Carregando atividade...</span>
        </div>
      ) : error ? (
        <div className="act-state act-state--error" role="alert">{error}</div>
      ) : (
        <div className="act-layout">

          {/* ── Feed de atividade ── */}
          <div className="act-feed-card">
            <h4 className="act-card__title">Histórico recente</h4>

            {activities.length > 0 ? (
              <ul className="act-feed" role="list">
                {activities.map((item) => (
                  <li key={item.id} className="act-item">
                    <span className="act-item__icon" aria-hidden="true">
                      {ACTIVITY_ICONS[item.type] ?? '◦'}
                    </span>
                    <div className="act-item__body">
                      <span className="act-item__message">{item.message}</span>
                      <time className="act-item__time" dateTime={item.created_at}>
                        {formatActivityTime(item.created_at)}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="act-feed__empty">
                Nenhuma atividade registrada ainda.
              </p>
            )}
          </div>

          {/* ── Presença online ── */}
          <div className="act-presence-card">
            <h4 className="act-card__title">
              Membros
              {onlineCount > 0 && (
                <span className="act-presence__online-badge">{onlineCount} online</span>
              )}
            </h4>

            {presenceList.length > 0 ? (
              <ul className="act-presence-list" role="list">
                {presenceList.map(({ member, lastSeenAt, online }) => (
                  <li key={member.user_id} className="presence-item">
                    <span
                      className={`presence-dot ${online ? 'presence-dot--online' : 'presence-dot--offline'}`}
                      aria-label={online ? 'online' : 'offline'}
                    />
                    <div className="presence-item__body">
                      <span className="presence-item__name">
                        {member.profile.display_name}
                        {member.role === 'master' && (
                          <span className="presence-item__role"> (mestre)</span>
                        )}
                      </span>
                      {!online && (
                        <span className="presence-item__time">
                          {formatPresenceTime(lastSeenAt)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="act-feed__empty">Sem membros.</p>
            )}
          </div>

        </div>
      )}
    </section>
  )
}
