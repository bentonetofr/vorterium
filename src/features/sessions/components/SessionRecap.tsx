import { useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { CampaignSession } from '../../../shared/types'
import { buildRecap, sessionWindow, type RecapRoll, type SessionRecap as Recap } from '../utils/sessionRecap'

// ────────────────────────────────────────────────────────
// "Resumo do dia" de um episódio concluído: abre dentro do cartão e mostra
// as rolagens daquele dia (quantas, quem rolou, a maior). É lido só quando
// a pessoa abre, e só das rolagens públicas — as privadas não entram.
// ────────────────────────────────────────────────────────

interface Row {
  user_id: string
  formula: string | null
  die_type: string | null
  quantity: number | null
  result: number | null
  total_result: number | null
  created_at: string
  profiles: { display_name: string } | null
}

async function loadRecap(session: CampaignSession): Promise<Recap> {
  const { start, end } = sessionWindow(session.session_date!)
  const { data, error } = await supabase
    .from('dice_rolls')
    .select('user_id, formula, die_type, quantity, result, total_result, created_at, profiles(display_name)')
    .eq('campaign_id', session.campaign_id)
    .eq('is_private', false)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: true })
    .limit(1000)

  if (error) throw new Error('Não foi possível montar o resumo.')
  const rolls: RecapRoll[] = ((data ?? []) as unknown as Row[]).map((r) => ({
    user_id: r.user_id,
    name: r.profiles?.display_name ?? 'Alguém',
    total: r.total_result ?? r.result,
    formula: r.formula ?? (r.die_type ? `${r.quantity && r.quantity > 1 ? r.quantity : ''}${r.die_type}` : null),
    created_at: r.created_at,
  }))
  return buildRecap(rolls)
}

export function SessionRecap({ session }: { session: CampaignSession }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [recap, setRecap] = useState<Recap | null>(null)

  // Só faz sentido pra episódio concluído e com data.
  if (session.status !== 'completed' || !session.session_date) return null

  function onToggle(open: boolean) {
    if (!open || state === 'loading' || state === 'ready') return
    setState('loading')
    loadRecap(session)
      .then((r) => { setRecap(r); setState('ready') })
      .catch(() => setState('error'))
  }

  return (
    <details className="session-recap anim-details" onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="session-recap__summary">
        <span className="session-recap__icon" aria-hidden="true">⬡</span>
        Resumo do dia
        <span className="session-recap__chevron" aria-hidden="true">▾</span>
      </summary>
      <div className="session-recap__body">
        {state === 'loading' && <span className="spinner spinner--sm" aria-label="Carregando" />}
        {state === 'error' && <p className="session-recap__empty">Não deu pra carregar o resumo agora.</p>}
        {state === 'ready' && recap && recap.totalRolls === 0 && (
          <p className="session-recap__empty">Nenhuma rolagem registrada neste dia.</p>
        )}
        {state === 'ready' && recap && recap.totalRolls > 0 && (
          <>
            <dl className="session-recap__stats">
              <div>
                <dt>Rolagens</dt>
                <dd>{recap.totalRolls}</dd>
              </div>
              <div>
                <dt>Quem rolou</dt>
                <dd>{recap.players.length}</dd>
              </div>
              {recap.best && (
                <div>
                  <dt>Maior resultado</dt>
                  <dd>{recap.best.total}</dd>
                </div>
              )}
              {recap.from && recap.to && (
                <div>
                  <dt>Das</dt>
                  <dd className="session-recap__time">{recap.from} às {recap.to}</dd>
                </div>
              )}
            </dl>
            {recap.best && (
              <p className="session-recap__best">
                A maior foi de <strong>{recap.best.name}</strong>{recap.best.formula ? <> ({recap.best.formula})</> : null}.
              </p>
            )}
            <ul className="session-recap__players">
              {recap.players.map((p) => (
                <li key={p.name}><span>{p.name}</span><b>{p.rolls}</b></li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  )
}
