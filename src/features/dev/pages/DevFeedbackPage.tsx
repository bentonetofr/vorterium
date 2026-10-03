import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listFeedback, setFeedbackStatus, fmtDateTime, type DevFeedback, type FeedbackStatus } from '../services/devService'
import { DevState, useLoad } from '../components/DevUi'

// Caixa de feedback: tudo que os jogadores mandaram, com o print. A única
// alteração possível no painel é o status (novo → lido → resolvido).

const STATUSES: { id: FeedbackStatus; label: string }[] = [
  { id: 'novo', label: 'Novo' },
  { id: 'lido', label: 'Lido' },
  { id: 'resolvido', label: 'Resolvido' },
]
const KIND_LABEL = { problema: 'Problema', sugestao: 'Sugestão', outro: 'Outro' } as const

export function DevFeedbackPage() {
  const { data, error, loading, setData } = useLoad(listFeedback, [])
  const [filter, setFilter] = useState<FeedbackStatus | 'todos'>('novo')
  const [busy, setBusy] = useState<string | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)

  async function change(f: DevFeedback, status: FeedbackStatus) {
    setBusy(f.id)
    try {
      await setFeedbackStatus(f.id, status)
      setData((list) => list?.map((x) => (x.id === f.id ? { ...x, status } : x)) ?? null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível mudar o status.')
    } finally {
      setBusy(null)
    }
  }

  const list = (data ?? []).filter((f) => filter === 'todos' || f.status === filter)
  const count = (s: FeedbackStatus) => (data ?? []).filter((f) => f.status === s).length

  return (
    <section className="dev-page">
      <h1 className="dev-page__title">Feedback</h1>
      <div className="dev-tabs" role="tablist">
        {[...STATUSES, { id: 'todos' as const, label: 'Todos' }].map((s) => (
          <button
            key={s.id} type="button" role="tab" aria-selected={filter === s.id}
            className={`dev-tab${filter === s.id ? ' dev-tab--active' : ''}`}
            onClick={() => setFilter(s.id)}
          >
            {s.label}{s.id !== 'todos' && data ? ` (${count(s.id)})` : ''}
          </button>
        ))}
      </div>

      <DevState loading={loading} error={error}>
        {list.length === 0 ? (
          <p className="dev-muted">Nada por aqui.</p>
        ) : (
          <ul className="dev-feedback">
            {list.map((f) => (
              <li key={f.id} className={`dev-feedback__item dev-feedback__item--${f.status}`}>
                <div className="dev-feedback__head">
                  <span className={`dev-kind dev-kind--${f.kind}`}>{KIND_LABEL[f.kind]}</span>
                  {f.author ? (
                    <Link to={`/dev/usuarios/${f.author.id}`} className="dev-feedback__who">{f.author.display_name} <small>{f.author.email}</small></Link>
                  ) : <span className="dev-muted">conta apagada</span>}
                  <span className="dev-muted">{fmtDateTime(f.created_at)}</span>
                </div>
                <p className="dev-feedback__msg">{f.message}</p>
                {f.imageUrl && (
                  <button type="button" className="dev-feedback__shot" onClick={() => setZoom(f.imageUrl)}>
                    <img src={f.imageUrl} alt="Print enviado" loading="lazy" />
                  </button>
                )}
                <p className="dev-feedback__meta">
                  <span>Onde: {f.page ?? '-'}</span>
                  <span>Versão: {f.app_version ?? '-'}</span>
                  <span title={f.user_agent ?? ''}>Navegador: {shortAgent(f.user_agent)}</span>
                </p>
                <div className="dev-feedback__status" role="group" aria-label="Status">
                  {STATUSES.map((s) => (
                    <button
                      key={s.id} type="button" disabled={busy === f.id}
                      className={`dev-chip${f.status === s.id ? ' dev-chip--on' : ''}`}
                      onClick={() => void change(f, s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DevState>

      {zoom && (
        <button type="button" className="dev-zoom" onClick={() => setZoom(null)} aria-label="Fechar imagem">
          <img src={zoom} alt="" />
        </button>
      )}
    </section>
  )
}

function shortAgent(ua: string | null): string {
  if (!ua) return '-'
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Outro'
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  return os ? `${browser} · ${os}` : browser
}
