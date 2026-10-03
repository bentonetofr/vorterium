import { useEffect, useRef, useState } from 'react'
import { gm, lobby, type EnigmaView } from './enigmaService'

// ────────────────────────────────────────────────────────
// Antes do jogo: a abertura da história, o aviso (consentimento), a
// memória do personagem (usada no fim da jornada do Registro) e o
// sorteio das duplas — cada jogador rola 1d20, na tela de todos. O mestre
// sorteia, troca quem quiser de lugar e começa.
// ────────────────────────────────────────────────────────

const ROLL_MS = 1600

export function EnigmaLobby({ view }: { view: EnigmaView }) {
  const me = view.me
  const roomId = view.room.id
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'Não deu certo.') } finally { setBusy(false) }
  }

  // Jogador da campanha entra sozinho ao abrir a aba.
  const joining = useRef(false)
  useEffect(() => {
    if (me.gm || me.joined || joining.current) return
    joining.current = true
    void lobby(roomId, { a: 'join' }).catch((e) => setError(e instanceof Error ? e.message : 'Não foi possível entrar.'))
  }, [me.gm, me.joined, roomId])

  // Dados rolando quando o sorteio sai.
  const [rolling, setRolling] = useState(false)
  const wasDrawn = useRef(view.drawn)
  useEffect(() => {
    if (view.drawn && !wasDrawn.current) {
      setRolling(true)
      const t = window.setTimeout(() => setRolling(false), ROLL_MS)
      wasDrawn.current = true
      return () => window.clearTimeout(t)
    }
    wasDrawn.current = view.drawn
  }, [view.drawn])

  return (
    <div className="en-lobby">
      <section className="en-story" aria-label="Abertura">
        <h3 className="en-h2">{view.historia.nome}</h3>
        {view.historia.abertura.map((p, i) => <p key={i}>{p}</p>)}
      </section>

      {!me.gm && me.joined && <Consent view={view} run={run} busy={busy} />}
      {!me.gm && me.joined && <Memory view={view} />}

      <section className="en-card" aria-label="Jogadores">
        <div className="en-row en-row--between">
          <h4 className="en-h4">Na câmara</h4>
          <span className="en-muted en-small">{view.players.length} de 4</span>
        </div>
        <ul className="en-players">
          {view.players.map((p) => (
            <li key={p.uid} className={`en-player${p.dupla ? ` en-player--${p.dupla}` : ''}`}>
              <span className="en-player__name">{p.name}{p.uid === me.uid ? ' (você)' : ''}</span>
              <span className="en-player__flags">
                <span className={p.consent ? 'is-ok' : ''} title="Aceitou o aviso">{p.consent ? 'aceitou' : 'lendo o aviso'}</span>
                <span className={p.has_memory ? 'is-ok' : ''} title="Escreveu a memória">{p.has_memory ? 'memória' : 'sem memória'}</span>
              </span>
              {p.roll != null && (
                <span className={`en-die${rolling ? ' is-rolling' : ''}`} aria-label={`Tirou ${p.roll} no d20`}>
                  <DieFace value={p.roll} rolling={rolling} />
                </span>
              )}
            </li>
          ))}
        </ul>
        {me.gm && view.players.some((p) => p.memory) && (
          <details className="en-small">
            <summary>Memórias (só você vê)</summary>
            <ul>{view.players.map((p) => <li key={p.uid}><strong>{p.name}:</strong> {p.memory || <em>(vazia — usa o texto padrão)</em>}</li>)}</ul>
          </details>
        )}
      </section>

      {view.drawn && !rolling && <Duplas view={view} run={run} busy={busy} />}

      {me.gm ? (
        <section className="en-card en-gm-lobby" aria-label="Mestre">
          <h4 className="en-h4">Mestre</h4>
          <p className="en-muted en-small">Cada jogador rola 1d20: os dois maiores formam a dupla A (O Registro Perdido), os dois menores a dupla B (O Assassino Mascarado). Dentro da dupla, o maior pega o primeiro papel; nas fases 2 e 3 os papéis se invertem.</p>
          <div className="en-row">
            <button type="button" className="en-btn en-btn--gold" disabled={busy || view.players.length !== 4} onClick={() => void run(() => gm(roomId, { a: 'draw' }))}>
              {view.drawn ? 'Sortear de novo' : 'Sortear as duplas'}
            </button>
            <button type="button" className="en-btn en-btn--danger" disabled={busy || !view.drawn} onClick={() => void run(() => gm(roomId, { a: 'start' }))}>
              Começar o jogo
            </button>
            <button type="button" className="en-btn en-btn--ghost" disabled={busy} onClick={() => void run(() => gm(roomId, { a: 'close' }))}>Fechar a câmara</button>
          </div>
          {view.players.length !== 4 && <p className="en-small en-warn">O Caatedrum precisa de exatamente 4 jogadores na câmara.</p>}
        </section>
      ) : !view.drawn ? (
        <p className="en-card en-wait">O mestre vai sortear as duplas.</p>
      ) : (
        <p className="en-card en-wait">O mestre vai começar.</p>
      )}

      {error && <p className="en-flash" role="alert">{error}</p>}
    </div>
  )
}

function DieFace({ value, rolling }: { value: number; rolling: boolean }) {
  const [shown, setShown] = useState(value)
  useEffect(() => {
    if (!rolling) { setShown(value); return }
    const t = window.setInterval(() => setShown(1 + Math.floor(Math.random() * 20)), 70)
    return () => window.clearInterval(t)
  }, [rolling, value])
  return <><span className="en-die__shape" aria-hidden="true" /><span className="en-die__n">{shown}</span></>
}

function Duplas({ view, run, busy }: { view: EnigmaView; run: (fn: () => Promise<void>) => Promise<void>; busy: boolean }) {
  const [pick, setPick] = useState<string | null>(null)
  return (
    <div className="en-duplas">
      {(['A', 'B'] as const).map((d) => {
        const info = view.duplas[d]
        if (!info) return null
        return (
          <section key={d} className={`en-card en-dupla en-dupla--${d}`} aria-label={info.nome}>
            <p className="en-delivery__kicker">Dupla {d} · segue {info.segue}</p>
            <h4 className="en-h3">{info.nome}</h4>
            <ol className="en-dupla__members">
              {info.members.map((m, i) => (
                <li key={m.uid}>
                  {view.me.gm ? (
                    <button type="button" className={`en-chip${pick === m.uid ? ' is-on' : ''}`} disabled={busy}
                      onClick={() => {
                        if (!pick) { setPick(m.uid); return }
                        if (pick === m.uid) { setPick(null); return }
                        const a = pick
                        setPick(null)
                        void run(() => gm(view.room.id, { a: 'swap', a_uid: a, b_uid: m.uid }))
                      }}>
                      {m.name}
                    </button>
                  ) : <strong>{m.name}{m.uid === view.me.uid ? ' (você)' : ''}</strong>}
                  <span className="en-muted en-small"> — fase 1: {info.fases[0].papeis[i] ? roleName(info.fases[0].papeis[i]) : ''}</span>
                </li>
              ))}
            </ol>
          </section>
        )
      })}
      {view.me.gm && <p className="en-muted en-small">Pra trocar dois jogadores de lugar, toque num e depois no outro.</p>}
    </div>
  )
}

const ROLE_NAMES: Record<string, string> = {
  interrogador: 'Interrogador', cruzador: 'Cruzador', mascaras: 'Máscaras', nomes: 'Nomes',
}
const roleName = (r: string) => ROLE_NAMES[r] ?? r

function Consent({ view, run, busy }: { view: EnigmaView; run: (fn: () => Promise<void>) => Promise<void>; busy: boolean }) {
  return (
    <section className={`en-card en-consent${view.me.consent ? ' is-ok' : ''}`} aria-label="Antes de entrar">
      <h4 className="en-h4">Antes de entrar</h4>
      {view.historia.consentimento.map((p, i) => <p key={i}>{p}</p>)}
      {view.me.consent
        ? <p className="en-small en-ok">Você aceitou.</p>
        : <button type="button" className="en-btn en-btn--gold" disabled={busy} onClick={() => void run(() => lobby(view.room.id, { a: 'consent' }))}>Eu aceito</button>}
    </section>
  )
}

function Memory({ view }: { view: EnigmaView }) {
  const [text, setText] = useState(view.me.memory)
  const [state, setState] = useState<'saved' | 'saving' | 'dirty'>('saved')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <section className="en-card" aria-label="Uma memória">
      <div className="en-row en-row--between">
        <h4 className="en-h4">Uma memória do seu personagem</h4>
        <span className="en-muted en-small">{text.length}/200 · {state === 'saved' ? 'guardada' : 'guardando…'}</span>
      </div>
      <p className="en-muted en-small">Uma lembrança curta, em primeira pessoa. Caatedrum vai usá-la contra você mais tarde. Se ficar vazia, a torre inventa uma.</p>
      <textarea
        className="en-scratch en-scratch--short"
        maxLength={200}
        value={text}
        placeholder={view.historia.memoria_padrao}
        onChange={(e) => {
          const t = e.target.value
          setText(t)
          setState('dirty')
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => {
            setState('saving')
            void lobby(view.room.id, { a: 'memory', text: t }).finally(() => setState('saved'))
          }, 600)
        }}
      />
    </section>
  )
}
