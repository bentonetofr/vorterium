import { Link } from 'react-router-dom'
import { getOverview, listFeedback, listUsers, fmtAgo } from '../services/devService'
import { DevAvatar, DevState, useLoad } from '../components/DevUi'
import { getSystemLabel } from '../../../shared/constants/systems'

// Visão geral: números do site, cadastros recentes e feedback novo.

export function DevOverviewPage() {
  const { data, error, loading } = useLoad(async () => {
    const [overview, users, feedback] = await Promise.all([getOverview(), listUsers(), listFeedback()])
    return { overview, users, feedback: feedback.filter((f) => f.status === 'novo') }
  }, [])

  return (
    <section className="dev-page">
      <h1 className="dev-page__title">Visão geral</h1>
      <DevState loading={loading} error={error}>
        {data && (
          <>
            <div className="dev-stats">
              <Stat label="Usuários" value={data.overview.users} sub={`+${data.overview.users_7d} nos últimos 7 dias`} />
              <Stat label="Online agora" value={data.overview.online_now} sub={`${data.overview.active_24h} ativos em 24 h`} />
              <Stat label="Campanhas" value={data.overview.campaigns} sub={Object.entries(data.overview.campaigns_by_system).map(([s, n]) => `${getSystemLabel(s)} ${n}`).join(' · ')} />
              <Stat label="Fichas" value={data.overview.sheets} />
              <Stat label="Mensagens" value={data.overview.messages} sub={`${data.overview.messages_24h} em 24 h`} />
              <Stat label="Rolagens" value={data.overview.rolls} sub={`${data.overview.rolls_24h} em 24 h`} />
              <Stat label="Documentos" value={data.overview.documents} />
              <Stat label="Feedback novo" value={data.overview.feedback_new} highlight={data.overview.feedback_new > 0} to="/dev/feedback" />
            </div>

            <div className="dev-columns">
              <div className="dev-panel">
                <h2 className="dev-panel__title">Cadastros recentes</h2>
                <ul className="dev-list">
                  {data.users.slice(0, 8).map((u) => (
                    <li key={u.id}>
                      <Link to={`/dev/usuarios/${u.id}`} className="dev-list__row">
                        <DevAvatar name={u.display_name} url={u.avatar_url} />
                        <span className="dev-list__main">{u.display_name}<small>{u.email}</small></span>
                        <span className="dev-muted">{fmtAgo(u.created_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="dev-panel">
                <h2 className="dev-panel__title">Feedback novo</h2>
                {data.feedback.length === 0 ? (
                  <p className="dev-muted">Nada novo. ✓</p>
                ) : (
                  <ul className="dev-list">
                    {data.feedback.slice(0, 6).map((f) => (
                      <li key={f.id}>
                        <Link to="/dev/feedback" className="dev-list__row">
                          <span className={`dev-kind dev-kind--${f.kind}`}>{f.kind}</span>
                          <span className="dev-list__main dev-clamp">{f.message}</span>
                          <span className="dev-muted">{fmtAgo(f.created_at)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </DevState>
    </section>
  )
}

function Stat({ label, value, sub, highlight, to }: { label: string; value: number; sub?: string; highlight?: boolean; to?: string }) {
  const body = (
    <>
      <span className="dev-stat__label">{label}</span>
      <span className="dev-stat__value">{value.toLocaleString('pt-BR')}</span>
      {sub && <span className="dev-stat__sub">{sub}</span>}
    </>
  )
  const cls = `dev-stat${highlight ? ' dev-stat--hot' : ''}`
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}
