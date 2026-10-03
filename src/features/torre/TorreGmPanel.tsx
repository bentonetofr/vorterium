import { useEffect, useState } from 'react'
import { gm, type Sym, type TorreGame, type TorreView } from './torreService'
import { STAR_NAMES } from './game/sky'
import { GlyphIcon, SymbolIcon } from './puzzles/kit'

// ────────────────────────────────────────────────────────
// O painel do mestre (menu ≡ → "Painel do mestre"), por cima da partida:
//   • Andamento: em que etapa cada objeto está e há quanto tempo jogam;
//   • Dica: uma sugerida pela etapa (ou escrita na hora) — aparece pra
//     todo mundo da sala por 25 s;
//   • Solução: o segredo desta partida, do jeito que se usa na tela;
//   • Linha do tempo: o que cada um fez;
//   • Recomeçar: outra partida, com outro segredo.
// ────────────────────────────────────────────────────────

interface Secret {
  mir: number[]
  dome: number
  seq: Sym[]
  num: number
  runes: [number, number]
  fifth: number
}

const NODE_NAMES: Record<keyof TorreGame['progress'], string> = {
  telescopio: 'Telescópio', mapa: 'Mapa', espelhos: 'Espelhos', manivela: 'Manivela', pendulo: 'Pêndulo',
}
const DIRS = ['em cima', 'em cima à direita', 'à direita', 'embaixo à direita', 'embaixo', 'embaixo à esquerda', 'à esquerda', 'em cima à esquerda']

/** A dica que cabe agora, pela etapa em que a dupla está. */
export function suggestHint(g: TorreGame): string {
  const p = g.progress
  if (p.espelhos === 0) return 'Embaixo, cada espelho joga luz no teto. Em cima, alguém precisa olhar pelo telescópio enquanto eles giram — e dizer quando uma estrela tremeluz.'
  if (p.espelhos === 1) return 'Uma estrela que tremeluz está a um passo de acender. Os espelhos 1 e 2 destravam a engrenagem.'
  if (p.manivela < 2) return 'A manivela gira a cúpula. Quem está no telescópio procura a constelação de ouro desenhada no mapa — e grita "para!".'
  if (p.espelhos < 3) return 'Com a cúpula no lugar certo, os espelhos 3 e 4 alcançam o céu. Não mexam mais na manivela.'
  if (p.mapa < 2) return 'O mapa é o céu visto de fora: tudo o que está à esquerda no telescópio fica à direita no mapa.'
  if (p.pendulo < 2) return 'Com os quatro feixes acesos, empurrem o pêndulo. A sombra dele mostra coisas por um instante.'
  if (p.manivela < 3) return 'As duas runas da seta do mapa abrem o trinco da manivela.'
  if (!g.inv.chave || p.pendulo < 3) return 'Cada símbolo da sombra cai numa casa da borda do mapa: um vê a forma, o outro vê a casa. Falem ao mesmo tempo.'
  return 'A sombra também mostra um número, e o pêndulo tapa a estrela mais brilhante por um instante. No Astrário, os dois giram juntos.'
}

function fmtClock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function TorreGmPanel({ view, offset, onClose }: { view: TorreView; offset: number; onClose: () => void }) {
  const g = view.game
  const sec = view.gm?.secret as unknown as Secret | undefined
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [, tick] = useState(0)
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 1000); return () => window.clearInterval(t) }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const now = Date.now() + offset
  const hintLeft = view.hint ? Math.max(0, 25000 - (now - view.hint.t)) : 0

  async function run(a: Record<string, unknown>, done?: string) {
    setBusy(true)
    setMsg(null)
    try { await gm(view.room.id, a); if (done) setMsg(done) } catch (e) { setMsg(e instanceof Error ? e.message : 'Não deu certo.') } finally { setBusy(false) }
  }

  if (!g) {
    return (
      <aside className="lb-gm lb-frame" aria-label="Painel do mestre">
        <button type="button" className="lb-x" onClick={onClose} aria-label="Fechar">✕</button>
        <h2 className="lb-panel__title">Painel do mestre</h2>
        <p className="lb-panel__text">A partida ainda não começou.</p>
      </aside>
    )
  }
  const suggestion = suggestHint(g)

  return (
    <aside className="lb-gm lb-frame" aria-label="Painel do mestre">
      <button type="button" className="lb-x" onClick={onClose} aria-label="Fechar">✕</button>
      <h2 className="lb-panel__title">Painel do mestre</h2>

      <section className="lb-gm__sec">
        <h3>Andamento {view.started_at && <span>· {fmtClock(now - view.started_at)} de jogo</span>}</h3>
        <ul className="lb-gm__progress">
          {(Object.keys(NODE_NAMES) as (keyof typeof NODE_NAMES)[]).map((k) => (
            <li key={k}><span>{NODE_NAMES[k]}</span><b className="lb-gm__pips">{[0, 1, 2].map((i) => <i key={i} className={i < g.progress[k] ? 'is-on' : ''} />)}</b></li>
          ))}
        </ul>
      </section>

      <section className="lb-gm__sec">
        <h3>Dica {hintLeft > 0 && <span>· no ar por mais {Math.ceil(hintLeft / 1000)} s</span>}</h3>
        <p className="lb-gm__suggest">{suggestion}</p>
        <div className="lb-lock__btns">
          <button type="button" className="lb-btn" disabled={busy} onClick={() => void run({ a: 'hint', text: suggestion }, 'Dica enviada.')}>Enviar esta</button>
        </div>
        <textarea className="lb-gm__text" maxLength={240} rows={2} placeholder="Ou escreva a sua…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="lb-lock__btns">
          <button type="button" className="lb-btn lb-btn--gold" disabled={busy || !text.trim()} onClick={() => void run({ a: 'hint', text }, 'Dica enviada.').then(() => setText(''))}>Enviar a minha</button>
        </div>
      </section>

      {sec ? (
      <section className="lb-gm__sec">
        <h3>Solução <span>· desta partida</span></h3>
        <dl className="lb-gm__sol">
          <dt>Espelhos</dt><dd>{sec.mir.map((p, k) => `${k + 1}: marca ${p + 1}`).join(' · ')}</dd>
          <dt>Cúpula</dt><dd>{sec.dome} cliques em "Girar ▶" a partir do começo (os espelhos 3 e 4 só acendem ali)</dd>
          <dt>Mapa</dt><dd>cada estrela no buraco espelhado (esquerda ↔ direita) de onde aparece no telescópio</dd>
          <dt>Sequência</dt><dd className="lb-gm__icons">{sec.seq.map((s, i) => <span key={i} title={`Casa ${i + 1}`}><SymbolIcon sym={s} k={3} /></span>)}</dd>
          <dt>Número</dt><dd><b>{sec.num}</b></dd>
          <dt>Trinco</dt><dd className="lb-gm__icons"><GlyphIcon g={sec.runes[0]} k={3} /><GlyphIcon g={sec.runes[1]} k={3} /> <span>({sec.runes[0]} e {sec.runes[1]} cliques em ▶)</span></dd>
          <dt>5ª estrela</dt><dd>{DIRS[sec.fifth]} da mais brilhante</dd>
          <dt>Cores</dt><dd>{STAR_NAMES.map((n, k) => `${k + 1}º espelho: ${n}`).join(' · ')}</dd>
        </dl>
        </section>
      ) : view.me.slot !== null ? (
        <section className="lb-gm__sec">
          <h3>Solução</h3>
          <p className="lb-gm__suggest">Você está jogando: a solução não vem pro seu navegador.</p>
        </section>
      ) : null}

      {view.gm && (
      <section className="lb-gm__sec">
        <h3>Linha do tempo</h3>
        <ol className="lb-gm__events">
          {(view.gm?.events ?? []).slice(-14).reverse().map((e, i) => (
            <li key={i}><span>{view.started_at ? fmtClock(e.t - view.started_at) : ''}</span> {e.m}</li>
          ))}
          {(view.gm?.events ?? []).length === 0 && <li className="lb-muted">Nada ainda.</li>}
        </ol>
      </section>
      )}

      <div className="lb-lock__btns">
        <button type="button" className="lb-btn" disabled={busy} onClick={() => { if (window.confirm('Recomeçar com outro segredo? Tudo o que a dupla fez se perde.')) void run({ a: 'reset' }, 'Partida nova.') }}>Recomeçar</button>
      </div>
      {msg && <p className="lb-toast" role="status">{msg}</p>}
    </aside>
  )
}
