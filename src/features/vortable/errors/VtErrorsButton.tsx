import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCampaignMembers } from '../../members/services/memberService'
import { ask } from '../../../shared/components/dialogs'
import { fillText, VT_AREAS, vtDef } from './catalog'
import { clearCampaignErrors, contextLines, fmtWhen, listCampaignErrors, ROLE_LABEL, watchCampaignErrors, type VtErrorRecord } from './errorsService'
import { vtShowRemote } from './vtErrors'
import './errors.css'

const seenKey = (campaignId: string) => `vt:errors-seen:${campaignId}`
const readSeen = (campaignId: string) => {
  try { return Number(localStorage.getItem(seenKey(campaignId)) ?? 0) || 0 } catch { return 0 }
}

/**
 * Mestre: botão "Erros" na barra do Vortable. Os erros de todos na campanha (o mestre e os jogadores)
 * chegam ao vivo; o número mostra os que ele ainda não viu, e os erros sérios de um jogador também
 * aparecem num aviso no canto. A lista mostra quem, quando, o código, o que houve e os detalhes.
 */
export function VtErrorsButton({ campaignId, userId }: { campaignId: string; userId: string }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<VtErrorRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [seenAt, setSeenAt] = useState(() => readSeen(campaignId))
  const [who, setWho] = useState('')
  const [area, setArea] = useState('')
  const [clearing, setClearing] = useState(false)

  const load = useCallback(async () => {
    try {
      setRows(await listCampaignErrors(campaignId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os erros.')
    }
  }, [campaignId])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    getCampaignMembers(campaignId)
      .then((list) => setNames(new Map(list.map((m) => [m.user_id, m.profile.display_name]))))
      .catch(() => { /* sem nomes, mostra "alguém" */ })
  }, [campaignId])

  const nameOf = useCallback((r: VtErrorRecord) => r.who?.display_name ?? (r.user_id ? names.get(r.user_id) : null) ?? 'Alguém', [names])

  // erro novo de alguém da campanha: entra na lista na hora (e, se for sério e de um jogador, num aviso)
  useEffect(() => watchCampaignErrors(campaignId, (row) => {
    setRows((list) => (list ? [row, ...list.filter((r) => r.id !== row.id)] : [row]))
    if (row.user_id !== userId && (row.severity === 'erro' || row.severity === 'grave')) {
      const name = (row.user_id && names.get(row.user_id)) || 'Um jogador'
      vtShowRemote(row.code, name, typeof row.context?.texto === 'string' ? row.context.texto : undefined)
    }
  }), [campaignId, userId, names])

  function toggle() {
    if (!open) {
      const now = Date.now()
      setSeenAt(now)
      try { localStorage.setItem(seenKey(campaignId), String(now)) } catch { /* sem storage */ }
      void load()
    }
    setOpen((v) => !v)
  }

  const unseen = (rows ?? []).filter((r) => Date.parse(r.created_at) > seenAt && r.severity !== 'info').length
  const people = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows ?? []) if (r.user_id) map.set(r.user_id, nameOf(r))
    return [...map]
  }, [rows, nameOf])
  const shown = (rows ?? []).filter((r) => (!who || r.user_id === who) && (!area || r.code.split('-')[1] === area))

  function clear() {
    ask({ title: 'Limpar a lista de erros', message: 'Apagar todos os erros registrados nesta campanha?', tone: 'danger', confirmLabel: 'Limpar' }, () => {
      setClearing(true)
      clearCampaignErrors(campaignId)
        .then(() => setRows([]))
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Não foi possível limpar.'))
        .finally(() => setClearing(false))
    })
  }

  return (
    <>
      <button
        type="button"
        className={`btn btn-ghost vt-errbtn${open ? ' vortable-page__worlds--on' : ''}`}
        onClick={toggle}
        title="Erros de conexão e do jogo nesta campanha (seus e dos jogadores)"
        aria-expanded={open}
      >
        ⚠ Erros
        {unseen > 0 && <span className="vt-errbtn__badge" aria-label={`${unseen} novos`}>{unseen > 99 ? '99+' : unseen}</span>}
      </button>
      {open && (
        <aside className="vt-errors" aria-label="Erros da campanha">
          <div className="vt-errors__head">
            <h3 className="vt-errors__title">Erros da campanha</h3>
            <button type="button" className="btn btn-ghost" onClick={() => void load()}>Atualizar</button>
            <button type="button" className="vt-pop__close" onClick={() => setOpen(false)} aria-label="Fechar">✕</button>
          </div>
          <div className="vt-errors__tools">
            <select className="live__select" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Pessoa">
              <option value="">Todas as pessoas</option>
              {people.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
            <select className="live__select" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Tipo de erro">
              <option value="">Todos os tipos</option>
              {Object.entries(VT_AREAS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <button type="button" className="btn btn-ghost" disabled={clearing || !rows?.length} onClick={clear}>{clearing ? 'Limpando…' : 'Limpar'}</button>
          </div>
          {error && <p className="vortable-msg vortable-msg--error" role="alert" style={{ margin: '10px 14px' }}>{error}</p>}
          {!error && rows && shown.length === 0 && <p className="vt-errors__empty">Nenhum erro registrado{who || area ? ' com esse filtro' : ''}. 🎉</p>}
          <ul className="vt-errors__list">
            {shown.map((r) => {
              const def = vtDef(r.code)
              return (
                <li key={r.id} className="vt-err">
                  <div className="vt-err__head">
                    <code className={`vt-code vt-code--${r.severity}`}>{r.code}</code>
                    <span className="vt-err__who">{nameOf(r)}</span>
                    <span className="vt-err__role">{ROLE_LABEL[r.role] ?? r.role}</span>
                    <span className="vt-err__when" title={new Date(r.created_at).toLocaleString('pt-BR')}>{fmtWhen(r.created_at)}</span>
                  </div>
                  <p className="vt-err__title">{def.title}{r.count > 1 && <span className="vt-err__count"> · {r.count}×</span>}</p>
                  <p className="vt-err__what">{typeof r.context?.texto === 'string' ? r.context.texto : fillText(def.what)}</p>
                  <details>
                    <summary>Detalhes e o que fazer</summary>
                    <p className="vt-err__what"><b>O que fazer:</b> {fillText(def.fix)}</p>
                    <pre>{contextLines(r)}</pre>
                  </details>
                </li>
              )
            })}
          </ul>
          <p className="vt-errors__foot">Os erros ficam guardados por 30 dias. O desenvolvedor do site também vê esta lista.</p>
        </aside>
      )}
    </>
  )
}
