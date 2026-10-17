import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DevState, useLoad } from '../components/DevUi'
import { fillText, SEVERITY_LABEL, VT_AREAS, VT_ERRORS, vtDef, type VtErrorDef, type VtSeverity } from '../../vortable/errors/catalog'
import { contextLines, fmtWhen, listAllErrors, ROLE_LABEL } from '../../vortable/errors/errorsService'
import '../../vortable/errors/errors.css'

// Erros do Vortable de todas as campanhas (só leitura): quem, quando, código, o que houve e os
// detalhes do momento; e o catálogo com todos os códigos possíveis.

const DAY = 24 * 60 * 60 * 1000

export function DevErrorsPage() {
  const { data, error, loading, reload } = useLoad(() => listAllErrors(), [])
  const [tab, setTab] = useState<'erros' | 'catalogo'>('erros')
  const [area, setArea] = useState('')
  const [severity, setSeverity] = useState<VtSeverity | ''>('')
  const [campaign, setCampaign] = useState('')
  const [code, setCode] = useState('')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => data ?? [], [data])
  const campaigns = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) map.set(r.campaign_id, r.campaign?.name ?? r.campaign_id.slice(0, 8))
    return [...map].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])
  const q = search.trim().toLowerCase()
  const shown = rows.filter((r) =>
    (!area || r.code.split('-')[1] === area)
    && (!severity || r.severity === severity)
    && (!campaign || r.campaign_id === campaign)
    && (!code || r.code === code)
    && (!q || `${r.detail} ${r.who?.display_name ?? ''} ${r.who?.email ?? ''} ${JSON.stringify(r.context)}`.toLowerCase().includes(q)))

  const now = Date.now()
  const last24 = rows.filter((r) => now - Date.parse(r.created_at) < DAY)
  const top = useMemo(() => {
    const count = new Map<string, number>()
    for (const r of rows) if (now - Date.parse(r.created_at) < 7 * DAY) count.set(r.code, (count.get(r.code) ?? 0) + r.count)
    return [...count].sort((a, b) => b[1] - a[1]).slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const catalog = Object.values(VT_ERRORS) as VtErrorDef[]

  return (
    <section className="dev-page">
      <h1 className="dev-page__title">Erros do Vortable</h1>
      <div className="dev-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'erros'} className={`dev-tab${tab === 'erros' ? ' dev-tab--active' : ''}`} onClick={() => setTab('erros')}>
          Registrados{data ? ` (${rows.length})` : ''}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'catalogo'} className={`dev-tab${tab === 'catalogo' ? ' dev-tab--active' : ''}`} onClick={() => setTab('catalogo')}>
          Catálogo ({catalog.length} códigos)
        </button>
      </div>

      {tab === 'catalogo' && (
        <div className="dev-tab-panel">
          <p className="dev-muted">Cada código é estável: nunca muda de significado. "Pop-up" = aparece pra quem teve o erro; "Registra" = entra nesta lista e na do mestre.</p>
          <table className="dev-table">
            <thead><tr><th>Código</th><th>Gravidade</th><th>O que é</th><th>O que fazer</th><th>Pop-up</th><th>Registra</th></tr></thead>
            <tbody>
              {catalog.map((d) => (
                <tr key={d.code}>
                  <td><code className={`vt-code vt-code--${d.severity}`}>{d.code}</code></td>
                  <td>{SEVERITY_LABEL[d.severity]}</td>
                  <td><b>{d.title}</b><br /><span className="dev-muted">{fillText(d.what)}</span></td>
                  <td className="dev-muted">{fillText(d.fix)}</td>
                  <td>{d.popup ? 'sim' : 'não'}</td>
                  <td>{d.record ? 'sim' : 'não'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'erros' && (
        <DevState loading={loading} error={error}>
          <div className="dev-stats">
            <div className="dev-stat"><span className="dev-muted">Registrados (30 dias)</span><b>{rows.length}</b></div>
            <div className={`dev-stat${last24.length ? ' dev-stat--hot' : ''}`}><span className="dev-muted">Últimas 24 h</span><b>{last24.length}</b></div>
            <div className="dev-stat"><span className="dev-muted">Graves (24 h)</span><b>{last24.filter((r) => r.severity === 'grave').length}</b></div>
            <div className="dev-stat"><span className="dev-muted">Campanhas com erro</span><b>{campaigns.length}</b></div>
          </div>
          {top.length > 0 && (
            <div className="dev-panel">
              <h2 className="dev-muted">Mais frequentes (7 dias, contando repetições)</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {top.map(([c, n]) => (
                  <button key={c} type="button" className={`dev-chip${code === c ? ' dev-chip--on' : ''}`} onClick={() => setCode(code === c ? '' : c)} title={vtDef(c).title}>
                    {c} · {n}×
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <input className="input dev-search" type="search" placeholder="Buscar (pessoa, detalhe, zona...)" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="input" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área">
              <option value="">Todas as áreas</option>
              {Object.entries(VT_AREAS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value as VtSeverity | '')} aria-label="Gravidade">
              <option value="">Toda gravidade</option>
              {(Object.keys(SEVERITY_LABEL) as VtSeverity[]).map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
            </select>
            <select className="input" value={campaign} onChange={(e) => setCampaign(e.target.value)} aria-label="Campanha">
              <option value="">Todas as campanhas</option>
              {campaigns.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            {code && <button type="button" className="dev-chip dev-chip--on" onClick={() => setCode('')}>{code} ✕</button>}
            <button type="button" className="dev-chip" onClick={() => void reload()}>Atualizar</button>
          </div>
          {shown.length === 0 ? (
            <p className="dev-muted">Nenhum erro{rows.length ? ' com esse filtro' : ' registrado'}.</p>
          ) : (
            <ul className="vt-errors__list dev-panel" style={{ padding: 0 }}>
              {shown.slice(0, 400).map((r) => {
                const def = vtDef(r.code)
                return (
                  <li key={r.id} className="vt-err">
                    <div className="vt-err__head">
                      <code className={`vt-code vt-code--${r.severity}`}>{r.code}</code>
                      {r.who
                        ? <Link to={`/dev/usuarios/${r.who.id}`} className="vt-err__who">{r.who.display_name}</Link>
                        : <span className="vt-err__who dev-muted">conta apagada</span>}
                      <span className="vt-err__role">{ROLE_LABEL[r.role] ?? r.role}</span>
                      <Link to={`/dev/campanhas/${r.campaign_id}`} className="dev-muted">{r.campaign?.name ?? 'campanha'}</Link>
                      <span className="vt-err__when" title={new Date(r.created_at).toLocaleString('pt-BR')}>{fmtWhen(r.created_at)}</span>
                    </div>
                    <p className="vt-err__title">{def.title}{r.count > 1 && <span className="vt-err__count"> · {r.count}×</span>}</p>
                    <p className="vt-err__what">{typeof r.context?.texto === 'string' ? r.context.texto : fillText(def.what)}</p>
                    <details>
                      <summary>Detalhes</summary>
                      <pre>{contextLines(r)}</pre>
                    </details>
                  </li>
                )
              })}
            </ul>
          )}
          {shown.length > 400 && <p className="dev-muted">Mostrando os 400 mais novos de {shown.length}. Use os filtros.</p>}
        </DevState>
      )}
    </section>
  )
}
