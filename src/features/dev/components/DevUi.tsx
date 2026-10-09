import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { DevRecord } from '../services/devService'
import { Loader } from '../../../shared/components/Loader'

// ────────────────────────────────────────────────────────
// Peças do painel do desenvolvedor: carregamento, erro, tabela de
// campos (mostra QUALQUER linha do banco, inclusive JSON) e avatar.
// ────────────────────────────────────────────────────────

/** Carrega algo assíncrono; `reload` busca de novo. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData]   = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await run())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar.')
    } finally {
      setLoading(false)
    }
  }, [run])

  useEffect(() => { void reload() }, [reload])
  return { data, error, loading, reload, setData }
}

export function DevState({ loading, error, children }: { loading: boolean; error: string | null; children: ReactNode }) {
  if (loading) return <div className="dev-state"><Loader small /></div>
  if (error) return <p className="dev-error" role="alert">{error}</p>
  return <>{children}</>
}

export function DevAvatar({ name, url, size = 28 }: { name: string; url?: string | null; size?: number }) {
  return (
    <span className="dev-avatar" style={{ width: size, height: size }} aria-hidden="true">
      {url ? <img src={url} alt="" /> : (name || '?').charAt(0).toUpperCase()}
    </span>
  )
}

function isPlainValue(v: unknown) {
  return v == null || ['string', 'number', 'boolean'].includes(typeof v)
}

function fmtValue(key: string, v: unknown): ReactNode {
  if (v == null || v === '') return <span className="dev-muted">-</span>
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  if (typeof v === 'string' && /_at$/.test(key) && !Number.isNaN(Date.parse(v))) {
    return new Date(v).toLocaleString('pt-BR')
  }
  if (typeof v === 'string' && /^https?:\/\//.test(v)) {
    return <a href={v} target="_blank" rel="noopener noreferrer">{v.length > 60 ? `${v.slice(0, 60)}…` : v}</a>
  }
  return String(v)
}

/** Todos os campos de uma linha: valores simples em grade, JSON à parte. */
export function RecordView({ row, hide = [] }: { row: DevRecord; hide?: string[] }) {
  const entries = Object.entries(row).filter(([k]) => !hide.includes(k))
  const plain = entries.filter(([, v]) => isPlainValue(v))
  const complex = entries.filter(([, v]) => !isPlainValue(v))
  return (
    <div className="dev-record">
      <dl className="dev-record__grid">
        {plain.map(([k, v]) => (
          <div key={k} className="dev-record__cell">
            <dt>{k}</dt>
            <dd>{fmtValue(k, v)}</dd>
          </div>
        ))}
      </dl>
      {complex.map(([k, v]) => (
        <details key={k} className="dev-record__json">
          <summary>{k} <span className="dev-muted">({Array.isArray(v) ? `${v.length} itens` : 'objeto'})</span></summary>
          <pre>{JSON.stringify(v, null, 2)}</pre>
        </details>
      ))}
    </div>
  )
}
