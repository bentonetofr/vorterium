import { useState } from 'react'
import type { PhaseView } from '../enigmaService'
import { Token } from './visual'

// ────────────────────────────────────────────────────────
// Peças que as fases repetem: a acusação (um propõe, o parceiro
// confirma), as dicas e a Entrega no fim da fase.
// ────────────────────────────────────────────────────────

export type Act = (action: Record<string, unknown>) => Promise<{ ok?: boolean; msg?: string } | void>

export interface Proposal { name: string; by_name: string; mine: boolean }

/** Acusar: escolhe um nome e propõe; o parceiro confirma (ou recusa). */
export function Accuse({ names, proposal, act, readOnly, label = 'Acusar' }: {
  names: string[]; proposal: Proposal | null | undefined; act: Act; readOnly: boolean; label?: string
}) {
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const run = async (a: Record<string, unknown>) => {
    setBusy(true)
    setMsg(null)
    try {
      const r = await act(a)
      if (r && r.ok === false && r.msg) setMsg(r.msg)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Não deu certo.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="en-card en-accuse" aria-label={label}>
      <h4 className="en-h4">{label}</h4>
      {proposal ? (
        <div className="en-accuse__pending">
          <p className="en-accuse__who"><strong>{proposal.by_name}</strong> acusa <Token name={proposal.name} size={34} /> <strong className="en-accuse__name">{proposal.name}</strong></p>
          {readOnly ? null : proposal.mine ? (
            <div className="en-row">
              <span className="en-muted">Esperando o parceiro confirmar…</span>
              <button type="button" className="en-btn en-btn--ghost" onClick={() => void run({ a: 'cancel' })} disabled={busy}>Desfazer</button>
            </div>
          ) : (
            <div className="en-row">
              <button type="button" className="en-btn en-btn--danger" onClick={() => void run({ a: 'confirm' })} disabled={busy}>Confirmar a acusação</button>
              <button type="button" className="en-btn en-btn--ghost" onClick={() => void run({ a: 'cancel' })} disabled={busy}>Recusar</button>
            </div>
          )}
        </div>
      ) : readOnly ? (
        <p className="en-muted">Ninguém acusou ainda.</p>
      ) : (
        <div className="en-accuse__pick">
          <div className="en-chips" role="radiogroup" aria-label="Quem?">
            {names.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={pick === n} className={`en-chip en-chip--token${pick === n ? ' is-on' : ''}`} onClick={() => setPick(n)}><Token name={n} size={28} />{n}</button>
            ))}
          </div>
          <button type="button" className="en-btn en-btn--danger" disabled={!pick || busy} onClick={() => void run({ a: 'propose', name: pick })}>
            Propor a acusação
          </button>
          <p className="en-muted en-small">O parceiro precisa confirmar. Errar custa caro.</p>
        </div>
      )}
      {msg && <p className="en-flash" role="alert">{msg}</p>}
    </section>
  )
}

/** Escada de 3 dicas. */
export function Hints({ v, act, readOnly }: { v: PhaseView; act: Act; readOnly: boolean }) {
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  return (
    <section className="en-card en-hints" aria-label="Dicas">
      <div className="en-row en-row--between">
        <h4 className="en-h4">Dicas</h4>
        <span className="en-muted en-small">{v.hints_left} de 3 ainda trancadas</span>
      </div>
      {v.hints.length > 0
        ? <ol className="en-hints__list">{v.hints.map((h, i) => <li key={i}>{h}</li>)}</ol>
        : <p className="en-muted en-small">Nenhuma dica aberta.</p>}
      {!readOnly && v.hints_left > 0 && (
        confirm ? (
          <div className="en-row">
            <span className="en-small">Abrir a próxima dica? O mestre vê.</span>
            <button type="button" className="en-btn" disabled={busy} onClick={async () => { setBusy(true); try { await act({ a: 'hint' }) } finally { setBusy(false); setConfirm(false) } }}>Abrir</button>
            <button type="button" className="en-btn en-btn--ghost" onClick={() => setConfirm(false)}>Não</button>
          </div>
        ) : (
          <button type="button" className="en-btn en-btn--ghost" onClick={() => setConfirm(true)}>Pedir dica</button>
        )
      )}
    </section>
  )
}

/** Fim de fase: o que saiu dela e o que libera na próxima. */
export function Delivery({ v, act, spectator, nextTitle }: { v: PhaseView; act: Act | null; spectator: boolean; nextTitle: string | null }) {
  const [busy, setBusy] = useState(false)
  const e = v.entrega
  if (!e) return null
  return (
    <section className="en-delivery" aria-label="Entrega">
      <p className="en-delivery__kicker">{e.skipped ? 'Fase pulada pelo mestre' : 'Entrega'}</p>
      <h3 className="en-h3">{v.titulo}</h3>
      <p className="en-delivery__text">{e.texto}</p>
      {e.tracos && e.tracos.length > 0 && (
        <ul className="en-delivery__traits">{e.tracos.map((t) => <li key={t}>{t}</li>)}</ul>
      )}
      {e.fragmento && (
        <p className="en-delivery__frag">Fragmento para a Banca: <strong>{e.fragmento}</strong> <span className="en-muted en-small">(só a sua dupla vê)</span></p>
      )}
      {e.libera && <p className="en-delivery__next"><span className="en-muted">Na próxima fase:</span> {e.libera}</p>}
      {spectator
        ? <p className="en-muted">A outra dupla terminou esta fase.</p>
        : act && nextTitle && (
          <button type="button" className="en-btn en-btn--gold" disabled={busy} onClick={async () => { setBusy(true); try { await act({ a: 'next' }) } finally { setBusy(false) } }}>
            Seguir: {nextTitle}
          </button>
        )}
    </section>
  )
}
