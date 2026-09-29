import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getCampaignDetail,
  getCampaignMessages,
  getCampaignRolls,
  getCampaignRows,
  getCampaignSheets,
  getFileUrl,
  listCampaigns,
  fmtAgo,
  fmtDateTime,
  type DevCampaignDetail,
  type DevRecord,
} from '../services/devService'
import { DevAvatar, DevState, RecordView, useLoad } from '../components/DevUi'
import { CampaignActivityPanel } from '../../activity/components/CampaignActivityPanel'
import { getSystemLabel } from '../../../shared/constants/systems'
import { getCampaignStatusLabel } from '../../../shared/utils/campaign'

// ────────────────────────────────────────────────────────
// Campanhas: lista de todas; clicar abre a campanha por dentro, só
// leitura — membros, mensagens (inclusive privadas), rolagens (inclusive
// ocultas), fichas completas, atividade, sessões, anotações e arquivos.
// ────────────────────────────────────────────────────────

export function DevCampaignsPage() {
  const { data, error, loading } = useLoad(listCampaigns, [])
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (data ?? []).filter((c) => !term || c.name.toLowerCase().includes(term) || (c.master?.display_name ?? '').toLowerCase().includes(term))
  }, [data, q])

  return (
    <section className="dev-page">
      <h1 className="dev-page__title">Campanhas {data && <span className="dev-muted">({data.length})</span>}</h1>
      <input className="input dev-search" placeholder="Buscar por nome ou mestre…" value={q} onChange={(e) => setQ(e.target.value)} />
      <DevState loading={loading} error={error}>
        <table className="dev-table">
          <thead>
            <tr><th>Campanha</th><th>Sistema</th><th>Mestre</th><th>Membros</th><th>Status</th><th>Criada</th></tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td><Link to={`/dev/campanhas/${c.id}`} className="dev-strong">{c.name}</Link></td>
                <td>{getSystemLabel(c.system)}</td>
                <td>{c.master ? <Link to={`/dev/usuarios/${c.master.id}`}>{c.master.display_name}</Link> : '—'}</td>
                <td>{c.members[0]?.count ?? 0}</td>
                <td>{getCampaignStatusLabel(c.status)}</td>
                <td>{fmtAgo(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DevState>
    </section>
  )
}

const TABS = [
  { id: 'membros',    label: 'Membros' },
  { id: 'mensagens',  label: 'Mensagens' },
  { id: 'rolagens',   label: 'Rolagens' },
  { id: 'fichas',     label: 'Fichas' },
  { id: 'atividade',  label: 'Atividade' },
  { id: 'sessoes',    label: 'Sessões' },
  { id: 'anotacoes',  label: 'Anotações' },
  { id: 'arquivos',   label: 'Arquivos' },
  { id: 'dados',      label: 'Dados da campanha' },
] as const
type TabId = (typeof TABS)[number]['id']

export function DevCampaignPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { data, error, loading } = useLoad(() => getCampaignDetail(campaignId!), [campaignId])
  const [tab, setTab] = useState<TabId>('membros')

  return (
    <section className="dev-page">
      <Link to="/dev/campanhas" className="dev-back">← Campanhas</Link>
      <DevState loading={loading} error={error}>
        {data && (
          <>
            <header className="dev-hero">
              {typeof data.campaign.cover_url === 'string' && <img className="dev-hero__cover" src={data.campaign.cover_url} alt="" />}
              <div>
                <h1 className="dev-page__title">{data.campaign.name}</h1>
                <p className="dev-muted">{getSystemLabel(data.campaign.system)} · {data.members.length} membros · criada {fmtAgo(data.campaign.created_at as string)}</p>
              </div>
            </header>
            <div className="dev-tabs" role="tablist">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                  className={`dev-tab${tab === t.id ? ' dev-tab--active' : ''}`} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="dev-tab-panel">
              {tab === 'membros'   && <Members detail={data} />}
              {tab === 'mensagens' && <Messages detail={data} />}
              {tab === 'rolagens'  && <Rolls detail={data} />}
              {tab === 'fichas'    && <Sheets detail={data} />}
              {tab === 'atividade' && <CampaignActivityPanel campaignId={data.campaign.id} userRole="master" />}
              {tab === 'sessoes'   && <Rows table="campaign_sessions" detail={data} title={(r) => String(r.title ?? 'Sessão')} />}
              {tab === 'anotacoes' && <Rows table="campaign_notes" detail={data} title={(r) => String(r.title ?? 'Anotação')} />}
              {tab === 'arquivos'  && <Files detail={data} />}
              {tab === 'dados'     && <RecordView row={data.campaign} />}
            </div>
          </>
        )}
      </DevState>
    </section>
  )
}

function nameOf(detail: DevCampaignDetail, id: string | null | undefined) {
  if (!id) return '—'
  return detail.profiles.get(id)?.display_name ?? 'ex-membro'
}

function Members({ detail }: { detail: DevCampaignDetail }) {
  return (
    <ul className="dev-list">
      {detail.members.map((m) => (
        <li key={m.user_id}>
          <Link to={`/dev/usuarios/${m.user_id}`} className="dev-list__row">
            <DevAvatar name={m.profile?.display_name ?? '?'} url={m.profile?.avatar_url} />
            <span className="dev-list__main">{m.profile?.display_name ?? 'ex-membro'}<small>{m.profile?.email}</small></span>
            <span className={`dev-role dev-role--${m.role}`}>{m.role === 'master' ? 'Mestre' : 'Jogador'}</span>
            <span className="dev-muted">entrou {fmtAgo(m.created_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Messages({ detail }: { detail: DevCampaignDetail }) {
  const { data, error, loading } = useLoad(() => getCampaignMessages(detail.campaign.id), [detail.campaign.id])
  const [onlyPrivate, setOnlyPrivate] = useState(false)
  const list = (data ?? []).filter((m) => !onlyPrivate || m.recipient_id)
  return (
    <DevState loading={loading} error={error}>
      <label className="dev-check"><input type="checkbox" checked={onlyPrivate} onChange={(e) => setOnlyPrivate(e.target.checked)} /> Só privadas</label>
      {list.length === 0 ? <p className="dev-muted">Nenhuma mensagem.</p> : (
        <ul className="dev-feed">
          {list.map((m) => (
            <li key={m.id} className={`dev-feed__item${m.recipient_id ? ' dev-feed__item--private' : ''}`}>
              <span className="dev-feed__who">
                {nameOf(detail, m.user_id)}
                {m.recipient_id && <span className="dev-tag">privada → {nameOf(detail, m.recipient_id)}</span>}
              </span>
              <span className="dev-feed__text">{m.content}</span>
              <span className="dev-muted">{fmtDateTime(m.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
      {data && data.length >= 300 && <p className="dev-muted">Mostrando as 300 mais recentes.</p>}
    </DevState>
  )
}

function Rolls({ detail }: { detail: DevCampaignDetail }) {
  const { data, error, loading } = useLoad(() => getCampaignRolls(detail.campaign.id), [detail.campaign.id])
  return (
    <DevState loading={loading} error={error}>
      {(data ?? []).length === 0 ? <p className="dev-muted">Nenhuma rolagem.</p> : (
        <ul className="dev-feed">
          {(data ?? []).map((r) => (
            <li key={r.id} className={`dev-feed__item${r.is_private ? ' dev-feed__item--private' : ''}`}>
              <span className="dev-feed__who">
                {nameOf(detail, r.user_id)}
                {r.is_private && <span className="dev-tag">oculta</span>}
              </span>
              <span className="dev-feed__text"><code>{r.formula ?? r.die_type}</code> → <strong>{r.result}</strong></span>
              <span className="dev-muted">{fmtDateTime(r.created_at)}</span>
              {r.roll_breakdown != null && (
                <details className="dev-record__json dev-feed__extra"><summary>detalhes</summary><pre>{JSON.stringify(r.roll_breakdown, null, 2)}</pre></details>
              )}
            </li>
          ))}
        </ul>
      )}
    </DevState>
  )
}

const SHEET_LABEL = {
  altherium_character_sheets: 'Altherium',
  td_character_sheets: 'Terra Devastada',
  character_sheets: 'Genérica',
} as const

function Sheets({ detail }: { detail: DevCampaignDetail }) {
  const { data, error, loading } = useLoad(() => getCampaignSheets(detail.campaign.id), [detail.campaign.id])
  return (
    <DevState loading={loading} error={error}>
      {(data ?? []).length === 0 ? <p className="dev-muted">Nenhuma ficha.</p> : (
        <div className="dev-cards">
          {(data ?? []).map((s) => {
            const portrait = typeof s.row.portrait_url === 'string' ? s.row.portrait_url : null
            const name = String(s.row.character_name || 'Sem nome')
            return (
              <details key={String(s.row.id)} className="dev-card">
                <summary className="dev-card__head">
                  <DevAvatar name={name} url={portrait} size={36} />
                  <span className="dev-list__main">{name}<small>{SHEET_LABEL[s.table]} · de {nameOf(detail, s.row.user_id as string)}</small></span>
                  <span className="dev-muted">editada {fmtAgo(s.row.updated_at as string)}</span>
                </summary>
                <RecordView row={s.row} />
                {s.extras?.map((x) => (
                  <details key={x.label} className="dev-record__json">
                    <summary>{x.label} <span className="dev-muted">({x.rows.length})</span></summary>
                    <pre>{JSON.stringify(x.rows, null, 2)}</pre>
                  </details>
                ))}
              </details>
            )
          })}
        </div>
      )}
    </DevState>
  )
}

function Rows({ table, detail, title }: { table: 'campaign_sessions' | 'campaign_notes'; detail: DevCampaignDetail; title: (r: DevRecord) => string }) {
  const { data, error, loading } = useLoad(() => getCampaignRows(table, detail.campaign.id), [table, detail.campaign.id])
  return (
    <DevState loading={loading} error={error}>
      {(data ?? []).length === 0 ? <p className="dev-muted">Nada aqui.</p> : (
        <div className="dev-cards">
          {(data ?? []).map((r) => (
            <details key={String(r.id)} className="dev-card">
              <summary className="dev-card__head">
                <span className="dev-list__main">{title(r)}<small>{fmtDateTime(r.created_at as string)}</small></span>
              </summary>
              <RecordView row={r} />
            </details>
          ))}
        </div>
      )}
    </DevState>
  )
}

function Files({ detail }: { detail: DevCampaignDetail }) {
  const { data, error, loading } = useLoad(async () => {
    const [docs, images] = await Promise.all([
      getCampaignRows('campaign_documents', detail.campaign.id),
      getCampaignRows('campaign_mesa_images', detail.campaign.id),
    ])
    return { docs, images }
  }, [detail.campaign.id])

  async function open(bucket: string, path: string) {
    try {
      window.open(await getFileUrl(bucket, path), '_blank', 'noopener')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível abrir.')
    }
  }

  const row = (bucket: string, r: DevRecord, extra?: ReactNode) => (
    <li key={String(r.id)}>
      <button type="button" className="dev-list__row" onClick={() => void open(bucket, String(r.path))}>
        <span className="dev-list__main">{String(r.name)}<small>{extra}</small></span>
        <span className="dev-muted">{fmtAgo(r.created_at as string)}</span>
      </button>
    </li>
  )

  return (
    <DevState loading={loading} error={error}>
      {data && (
        <>
          <h3 className="dev-panel__title">Biblioteca ({data.docs.length})</h3>
          {data.docs.length === 0 ? <p className="dev-muted">Nenhum documento.</p> : (
            <ul className="dev-list">{data.docs.map((r) => row('campaign-documents', r, <>{String(r.mime_type)}{r.visibility === 'master' ? ' · só o mestre' : ''}</>))}</ul>
          )}
          <h3 className="dev-panel__title">Imagens da Mesa ({data.images.length})</h3>
          {data.images.length === 0 ? <p className="dev-muted">Nenhuma imagem.</p> : (
            <ul className="dev-list">{data.images.map((r) => row('mesa-images', r))}</ul>
          )}
        </>
      )}
    </DevState>
  )
}
