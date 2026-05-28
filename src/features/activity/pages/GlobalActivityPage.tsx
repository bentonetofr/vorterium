import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getMyRecentActivity,
  formatActivityTime,
  ACTIVITY_ICONS,
  type ActivityWithCampaign,
} from '../services/activityService'
import './GlobalActivityPage.css'

export function GlobalActivityPage() {
  const navigate = useNavigate()
  const [activities, setActivities] = useState<ActivityWithCampaign[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [filter,     setFilter]     = useState<string>('all')

  const load = useCallback(async () => {
    try {
      const data = await getMyRecentActivity()
      setActivities(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as atividades.')
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  async function handleRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const campaigns = useMemo(() => {
    const seen = new Map<string, string>()
    for (const a of activities) {
      if (!seen.has(a.campaign_id)) seen.set(a.campaign_id, a.campaign_name)
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [activities])

  const filtered = filter === 'all'
    ? activities
    : activities.filter((a) => a.campaign_id === filter)

  return (
    <div className="gact-page">

      {/* ── Cabeçalho ── */}
      <div className="gact-page__header">
        <div className="gact-page__header-left">
          <h1 className="gact-page__title">Atividade</h1>
          <p className="gact-page__sub">
            Acompanhe os eventos recentes das campanhas em que você participa.
          </p>
        </div>
        <button
          className="btn btn-ghost gact-page__refresh"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          aria-label="Atualizar atividades"
        >
          <span className={refreshing ? 'gact-spin' : undefined}>↺</span>
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* ── Filtro por campanha (só aparece quando há > 1 campanha) ── */}
      {!loading && !error && campaigns.length > 1 && (
        <div className="gact-toolbar">
          <select
            className="gact-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filtrar por campanha"
          >
            <option value="all">Todas as campanhas</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="gact-state">
          <div className="spinner spinner--sm" />
          <span>Carregando atividades...</span>
        </div>
      )}

      {/* ── Erro ── */}
      {error && (
        <div className="gact-state gact-state--error" role="alert">{error}</div>
      )}

      {/* ── Estado vazio ── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="gact-empty">
          <p className="gact-empty__icon">◉</p>
          <p className="gact-empty__title">Nenhuma atividade encontrada.</p>
          <p className="gact-empty__text">
            As atividades das campanhas em que você participa aparecerão aqui.
          </p>
        </div>
      )}

      {/* ── Lista ── */}
      {!loading && !error && filtered.length > 0 && (
        <ul className="gact-list" role="list">
          {filtered.map((item) => (
            <li key={item.id} className="gact-item">
              <div className="gact-item__icon" aria-hidden="true">
                {ACTIVITY_ICONS[item.type] ?? '◦'}
              </div>
              <div className="gact-item__content">
                <div className="gact-item__top">
                  <span className="gact-item__campaign">{item.campaign_name}</span>
                  <time className="gact-item__time" dateTime={item.created_at}>
                    {formatActivityTime(item.created_at)}
                  </time>
                </div>
                <p className="gact-item__message">{item.message}</p>
              </div>
              <button
                className="btn btn-ghost gact-item__btn"
                onClick={() => navigate(`/campanhas/${item.campaign_id}`)}
                aria-label={`Abrir campanha ${item.campaign_name}`}
              >
                Abrir campanha →
              </button>
            </li>
          ))}
        </ul>
      )}

    </div>
  )
}
