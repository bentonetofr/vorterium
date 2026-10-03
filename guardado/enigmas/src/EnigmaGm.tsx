import { useState } from 'react'
import { gm, type EnigmaView, type GmDupla } from './enigmaService'
import { EnigmaPhase } from './EnigmaPhase'
import { fmtClock } from './useEnigmaRoom'

// ────────────────────────────────────────────────────────
// Painel do mestre durante o jogo: as duas duplas lado a lado (tudo o que
// os dois papéis veem), placar, dicas, tempo, e os botões — liberar dica
// (sem custo), pular a fase, ver a solução, tintas, relógio, pausar e
// retomar. Embaixo, a linha do tempo da sessão.
// ────────────────────────────────────────────────────────

export function EnigmaGm({ view, now }: { view: EnigmaView; now: number }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const roomId = view.room.id
  const run = async (action: Record<string, unknown>) => {
    setBusy(true)
    setError(null)
    try { await gm(roomId, action) } catch (e) { setError(e instanceof Error ? e.message : 'Não deu certo.') } finally { setBusy(false) }
  }
  const events = [...(view.gm?.events ?? [])].reverse()

  return (
    <div className="en-gm">
      <header className="en-gm__bar">
        <h3 className="en-h3">Painel do mestre</h3>
        <div className="en-row">
          {view.room.paused
            ? <button type="button" className="en-btn en-btn--gold" disabled={busy} onClick={() => void run({ a: 'resume' })}>Retomar</button>
            : <button type="button" className="en-btn en-btn--pause" disabled={busy} onClick={() => void run({ a: 'pause' })}>Pausar tudo</button>}
          <button type="button" className="en-btn en-btn--ghost" disabled={busy} onClick={() => { if (window.confirm('Fechar a câmara? O jogo termina para todos.')) void run({ a: 'close' }) }}>Fechar a câmara</button>
        </div>
      </header>
      {error && <p className="en-flash" role="alert">{error}</p>}

      <div className="en-gm__cols">
        {(['A', 'B'] as const).map((d) => {
          const info = view.duplas[d]
          const g = view.gm?.[d]
          if (!info || !g) return null
          return <GmColumn key={d} d={d} view={view} g={g} now={now} run={run} busy={busy} />
        })}
      </div>

      <section className="en-card en-timeline" aria-label="Linha do tempo">
        <h4 className="en-h4">Linha do tempo</h4>
        <ol>
          {events.map((e, i) => (
            <li key={i}>
              <span className="en-timeline__t">{new Date(e.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              {e.d && <span className={`en-timeline__d en-timeline__d--${e.d}`}>{e.d}</span>}
              {e.m}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function GmColumn({ d, view, g, now, run, busy }: {
  d: 'A' | 'B'; view: EnigmaView; g: GmDupla; now: number; run: (a: Record<string, unknown>) => Promise<void>; busy: boolean
}) {
  const info = view.duplas[d]!
  const v = g.view
  const [open, setOpen] = useState(true)
  const elapsed = v && typeof v.started_at === 'number' ? now - v.started_at : null
  const deadline = typeof v?.deadline === 'number' ? (v.deadline as number) : null
  const playing = v?.stage === 'jogo'
  const inks = typeof v?.inks === 'number' ? (v.inks as number) : null

  return (
    <section className={`en-gm__col en-gm__col--${d}`} aria-label={info.nome}>
      <header className={`en-top en-top--${d}`}>
        <div className="en-top__who">
          <span className="en-crest" aria-hidden="true">{d}</span>
          <div>
            <p className="en-top__dupla">{info.nome}</p>
            <p className="en-top__sub">{info.members.map((m) => `${m.name}${m.role ? ` (${roleName(m.role)})` : ''}`).join(' · ')}</p>
          </div>
        </div>
        <div className="en-top__right">
          <span className="en-pill">Placar {g.score}</span>
          <span className="en-pill">Dicas {g.hints}/3</span>
          {elapsed != null && playing && <span className="en-pill">⌛ {fmtClock(elapsed)}</span>}
          {deadline != null && playing && <span className={`en-pill${deadline - now <= 0 ? ' is-over' : ''}`}>{deadline - now <= 0 ? 'Tempo esgotado' : `⏳ ${fmtClock(deadline - now)}`}</span>}
          {inks != null && playing && <span className={`en-pill${inks === 0 ? ' is-over' : ''}`}>Tintas {inks}</span>}
        </div>
      </header>

      <div className="en-gm__actions">
        <button type="button" className="en-btn" disabled={busy || !playing || g.hints >= 3} onClick={() => void run({ a: 'hint', dupla: d })}>Liberar dica</button>
        <button type="button" className="en-btn en-btn--ghost" disabled={busy || !(playing || v?.stage === 'em-breve')} onClick={() => { if (window.confirm('Pular esta fase? Ela conta como terminada.')) void run({ a: 'skip', dupla: d }) }}>Pular fase</button>
        <button type="button" className="en-btn en-btn--ghost" disabled={busy || !playing || g.revealed} onClick={() => void run({ a: 'reveal', dupla: d })}>{g.revealed ? 'Solução à vista' : 'Revelar solução'}</button>
        {d === 'A' && v?.phase === 1 && playing && <button type="button" className="en-btn en-btn--ghost" disabled={busy} onClick={() => void run({ a: 'inks', n: 3 })}>+3 tintas</button>}
        {deadline != null && playing && (
          <>
            <button type="button" className="en-btn en-btn--ghost" disabled={busy} onClick={() => void run({ a: 'time', dupla: d, seconds: 60 })}>+1 min</button>
            <button type="button" className="en-btn en-btn--ghost" disabled={busy} onClick={() => void run({ a: 'time', dupla: d, seconds: -60 })}>−1 min</button>
          </>
        )}
        <button type="button" className="en-btn en-btn--ghost en-gm__toggle" onClick={() => setOpen((o) => !o)}>{open ? 'Esconder a fase' : 'Ver a fase'}</button>
      </div>
      {g.fragments.length > 0 && <p className="en-small">Fragmentos: <strong>{g.fragments.join(' · ')}</strong></p>}

      {open && <EnigmaPhase dupla={d} info={info} v={v} act={async () => {}} readOnly now={now} />}
    </section>
  )
}

const ROLE_NAMES: Record<string, string> = {
  interrogador: 'Interrogador', cruzador: 'Cruzador', linhas: 'Linhas', colunas: 'Colunas', gramatica: 'Gramática', sentido: 'Sentido',
  mascaras: 'Máscaras', nomes: 'Nomes', maos: 'Mãos', olhos: 'Olhos', ve: 'Vê', monta: 'Monta',
}
const roleName = (r: string) => ROLE_NAMES[r] ?? r
