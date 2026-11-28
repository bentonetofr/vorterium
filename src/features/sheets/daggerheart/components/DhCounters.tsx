import { COUNTERS_PER_OWNER, COUNTER_MAX_VALUE, COUNTER_NAME_MAX, COUNTER_PRESETS, newCounter, resetCounters, setCounterMax, setCounterValue, type DhCounter } from '../model/counters'
import { Inline, Stepper } from './DhUi'

// ────────────────────────────────────────────────────────
// Marcadores da mesa: cada um tem nome, um número (− e +) e, se quiser, um limite. A mesma peça serve para o personagem, para cada
// carta de domínio, para os adversários e para os ambientes. Quem só olha (jogador vendo um adversário) vê os marcadores sem mexer.
// ────────────────────────────────────────────────────────

interface Props {
  counters: DhCounter[]
  onChange: (next: DhCounter[]) => void
  canEdit: boolean
  /** Para leitores de tela e para os nomes dos botões. */
  label: string
  /** Versão apertada (dentro da carta): sem atalhos, só "+ Marcador". */
  compact?: boolean
}

export function DhCounters({ counters, onChange, canEdit, label, compact }: Props) {
  const full = counters.length >= COUNTERS_PER_OWNER
  const patch = (id: string, fn: (c: DhCounter) => DhCounter) => onChange(counters.map((c) => (c.id === id ? fn(c) : c)))
  const shown = canEdit ? counters : counters.filter((c) => c.name.trim() || c.value > 0)
  const missing = COUNTER_PRESETS.filter((p) => !counters.some((c) => c.name.trim().toLowerCase() === p.toLowerCase()))

  if (!canEdit && shown.length === 0) return null

  return (
    <div className={`dh-ctrs${compact ? ' dh-ctrs--compact' : ''}`} role="group" aria-label={label}>
      {shown.length > 0 && (
        <ul className="dh-ctrs__list">
          {shown.map((c) => (
            <li key={c.id} className={`dh-ctr${c.value > 0 ? ' has-value' : ''}${c.max > 0 && c.value >= c.max ? ' is-full' : ''}`}>
              {canEdit
                ? <Inline className="dh-ctr__name" value={c.name} onChange={(v) => patch(c.id, (x) => ({ ...x, name: v.slice(0, COUNTER_NAME_MAX) }))} placeholder="Nome" maxLength={COUNTER_NAME_MAX} aria-label="Nome do marcador" />
                : <span className="dh-ctr__name">{c.name || 'Marcador'}</span>}
              {canEdit
                ? <Stepper value={c.value} min={0} max={c.max > 0 ? c.max : COUNTER_MAX_VALUE} label={`Valor de ${c.name || 'marcador'}`} onChange={(v) => patch(c.id, (x) => setCounterValue(x, v))} />
                : <b className="dh-ctr__value">{c.value}</b>}
              {canEdit ? (
                <label className="dh-ctr__max" title="Limite do marcador (vazio = sem limite)">
                  <span>de</span>
                  <input type="number" inputMode="numeric" min={0} max={COUNTER_MAX_VALUE} value={c.max > 0 ? c.max : ''} placeholder="∞" aria-label={`Limite de ${c.name || 'marcador'}`}
                    onChange={(e) => patch(c.id, (x) => setCounterMax(x, e.target.value === '' ? 0 : Number(e.target.value)))} />
                </label>
              ) : c.max > 0 && <small className="dh-ctr__of">de {c.max}</small>}
              {canEdit && <button type="button" className="dh-x" aria-label={`Remover ${c.name || 'marcador'}`} onClick={() => onChange(counters.filter((x) => x.id !== c.id))}>×</button>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="dh-ctrs__add">
          <button type="button" className="dh-link" disabled={full} onClick={() => onChange([...counters, newCounter()])}>+ Marcador</button>
          {!compact && !full && missing.slice(0, 6).map((p) => <button key={p} type="button" className="dh-link dh-ctrs__preset" onClick={() => onChange([...counters, newCounter(p)])}>{p}</button>)}
          {counters.some((c) => c.value > 0) && <button type="button" className="dh-link dh-ctrs__reset" onClick={() => onChange(resetCounters(counters))}>Zerar todos</button>}
        </div>
      )}
    </div>
  )
}
