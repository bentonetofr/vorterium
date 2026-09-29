import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getUserMemberships, listUsers, fmtAgo, fmtDateTime } from '../services/devService'
import { DevAvatar, DevState, useLoad } from '../components/DevUi'
import { getSystemLabel } from '../../../shared/constants/systems'
import { getCampaignStatusLabel } from '../../../shared/utils/campaign'

// Usuários: lista com busca; clicar abre a pessoa (dados de login e as
// campanhas em que está, com o papel em cada uma).

export function DevUsersPage() {
  const { data, error, loading } = useLoad(listUsers, [])
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (data ?? []).filter((u) => !term || u.display_name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
  }, [data, q])

  return (
    <section className="dev-page">
      <h1 className="dev-page__title">Usuários {data && <span className="dev-muted">({data.length})</span>}</h1>
      <input className="input dev-search" placeholder="Buscar por nome ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
      <DevState loading={loading} error={error}>
        <table className="dev-table">
          <thead>
            <tr><th>Pessoa</th><th>Entrada</th><th>Campanhas</th><th>Cadastro</th><th>Último login</th></tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link to={`/dev/usuarios/${u.id}`} className="dev-person">
                    <DevAvatar name={u.display_name} url={u.avatar_url} />
                    <span>{u.display_name}<small>{u.email}</small></span>
                  </Link>
                </td>
                <td>{u.provider ?? '—'}</td>
                <td>{u.campaigns}</td>
                <td>{fmtDateTime(u.created_at)}</td>
                <td>{fmtAgo(u.last_sign_in_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DevState>
    </section>
  )
}

export function DevUserPage() {
  const { userId } = useParams<{ userId: string }>()
  const { data, error, loading } = useLoad(async () => {
    const [users, memberships] = await Promise.all([listUsers(), getUserMemberships(userId!)])
    const user = users.find((u) => u.id === userId)
    if (!user) throw new Error('Usuário não encontrado.')
    return { user, memberships }
  }, [userId])

  return (
    <section className="dev-page">
      <Link to="/dev/usuarios" className="dev-back">← Usuários</Link>
      <DevState loading={loading} error={error}>
        {data && (
          <>
            <header className="dev-hero">
              <DevAvatar name={data.user.display_name} url={data.user.avatar_url} size={56} />
              <div>
                <h1 className="dev-page__title">{data.user.display_name}</h1>
                <p className="dev-muted">{data.user.email}</p>
              </div>
            </header>
            <dl className="dev-facts">
              <div><dt>ID</dt><dd><code>{data.user.id}</code></dd></div>
              <div><dt>Entrada</dt><dd>{data.user.provider ?? '—'}</dd></div>
              <div><dt>Cadastro</dt><dd>{fmtDateTime(data.user.created_at)}</dd></div>
              <div><dt>Último login</dt><dd>{fmtDateTime(data.user.last_sign_in_at)}</dd></div>
            </dl>
            <h2 className="dev-panel__title">Campanhas ({data.memberships.length})</h2>
            {data.memberships.length === 0 ? <p className="dev-muted">Não está em nenhuma campanha.</p> : (
              <ul className="dev-list">
                {data.memberships.map((m) => m.campaign && (
                  <li key={m.campaign.id}>
                    <Link to={`/dev/campanhas/${m.campaign.id}`} className="dev-list__row">
                      <span className="dev-list__main">{m.campaign.name}<small>{getSystemLabel(m.campaign.system)} · {getCampaignStatusLabel(m.campaign.status)}</small></span>
                      <span className={`dev-role dev-role--${m.role}`}>{m.role === 'master' ? 'Mestre' : 'Jogador'}</span>
                      <span className="dev-muted">desde {fmtAgo(m.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </DevState>
    </section>
  )
}
