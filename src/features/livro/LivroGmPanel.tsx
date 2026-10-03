import { useEffect, useState } from 'react'
import { gm, type GameView, type LivroView, type Quadrant, type Sym } from './livroService'
import { SymbolIcon } from './puzzles/kit'

// ────────────────────────────────────────────────────────
// O painel do mestre do Livro (menu ≡ → "Painel do mestre"), por cima da
// partida — no mesmo jeito do da Torre:
//   • Andamento: em que etapa cada canto do diagrama está e o tempo;
//   • Dica: uma sugerida pela etapa (ou escrita na hora), pra todos por 25 s;
//   • Solução desta partida (só se o mestre estiver assistindo — jogando,
//     ela nem chega ao navegador);
//   • Linha do tempo e Recomeçar (outra partida, outro segredo).
// ────────────────────────────────────────────────────────

interface Secret {
  corners:     Sym[]
  seal_order:  number[]
  shadow:      Record<string, Sym>
  slot_runes:  number[]
  angle:       number
  number:      number[]
  word:        string
  face:        number
  chain_order: number[]
}

const NODE_NAMES: Record<Quadrant, string> = { castical: 'Castiçal', retrato: 'Retrato', astrolabio: 'Astrolábio', estante: 'Estante' }
const ROMAN = ['I', 'II', 'III', 'IV']
const SOCKETS = ['N', 'L', 'S', 'O']

/** A dica que cabe agora, pela etapa em que a dupla está. */
export function suggestLivroHint(g: GameView): string {
  const p = g.ped.progress
  if (p.castical === 0) return 'As velas do castiçal acendem com um toque. Três acendem normal; quatro têm o pavio selado com cera.'
  if (p.retrato === 0) return 'Com as três velas que acendem normal acesas, olhem o retrato com a lupa.'
  if (p.castical < 2) return 'A silhueta do retrato segura quatro velas: é a ordem de abrir os pavios selados. Só no quarto pavio se sabe se a ordem estava certa.'
  if (p.astrolabio === 0) return 'As sombras das velas acesas têm forma de símbolo. Cada encaixe do astrolábio quer a sombra que cai no gancho da sua runa.'
  if (p.astrolabio < 2) return 'O ponteiro do astrolábio só gira sozinho com os quatro encaixes certos. A marca em que ele para é o ângulo de onde se olha.'
  if (p.castical < 3) return 'Com as sete velas acesas, olhem o castiçal da marca que o ponteiro mostrou: as sombras viram um número.'
  if (p.retrato < 2) return 'Da mesma marca, o retrato mostra um rosto e um medalhão. E o quadro de tradução.'
  if (p.estante < 1) return 'Puxem os livros da estante nas posições do número das sombras, na ordem.'
  if (p.estante < 2) return 'As lombadas mostram uma palavra em glifos. O quadro de tradução do retrato diz as letras.'
  if (p.estante < 3) return 'A gaveta escondida da estante tem um encaixe redondo: o medalhão do retrato.'
  if (p.astrolabio < 3) return 'A chave de bronze abre a tampa do astrolábio. Dentro, a ordem das correntes.'
  return 'Cada fechadura do pedestal quer uma resposta: o número, os quatro símbolos dos cantos do retrato, a marca e a palavra, na ordem da tampa.'
}

function fmtClock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function LivroGmPanel({ view, onClose }: { view: LivroView; onClose: () => void }) {
  const g = view.game
  const sec = view.gm?.secret as unknown as Secret | undefined
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [, tick] = useState(0)
  const offset = view.now - Date.now()
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
  const suggestion = suggestLivroHint(g)
  const playing = view.me.slot !== null

  return (
    <aside className="lb-gm lb-frame" aria-label="Painel do mestre">
      <button type="button" className="lb-x" onClick={onClose} aria-label="Fechar">✕</button>
      <h2 className="lb-panel__title">Painel do mestre</h2>

      <section className="lb-gm__sec">
        <h3>Andamento {view.started_at && <span>· {fmtClock(now - view.started_at)} de jogo · {g.ped.chains.length} de 4 correntes</span>}</h3>
        <ul className="lb-gm__progress">
          {(Object.keys(NODE_NAMES) as Quadrant[]).map((k) => (
            <li key={k}><span>{NODE_NAMES[k]}</span><b className="lb-gm__pips">{[0, 1, 2].map((i) => <i key={i} className={i < (g.ped.progress[k] ?? 0) ? 'is-on' : ''} />)}</b></li>
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
            <dt>Pavios</dt><dd>velas {sec.seal_order.map((i) => i + 1).join(', ')} (da esquerda), nessa ordem</dd>
            <dt>Encaixes</dt><dd className="lb-gm__icons">{sec.slot_runes.map((r, k) => <span key={k} title={`Encaixe ${SOCKETS[k]}`}>{SOCKETS[k]} <SymbolIcon sym={sec.shadow[String(r)]} k={2} /></span>)}</dd>
            <dt>Ângulo</dt><dd>marca <b>{sec.angle}</b></dd>
            <dt>Número</dt><dd><b>{sec.number.join('')}</b> (os livros dessas posições, nessa ordem)</dd>
            <dt>Palavra</dt><dd><b>{sec.word}</b></dd>
            <dt>Cantos</dt><dd className="lb-gm__icons">{sec.corners.map((s, i) => <SymbolIcon key={i} sym={s} k={2} />)} <span>(sup. esq., sup. dir., inf. esq., inf. dir.)</span></dd>
            <dt>Rosto</dt><dd>{sec.face === 0 ? 'Capa Azul' : 'Capa Vermelha'}</dd>
            <dt>Correntes</dt><dd>{sec.chain_order.map((n) => ROMAN[n - 1]).join(' → ')}</dd>
          </dl>
        </section>
      ) : playing ? (
        <section className="lb-gm__sec">
          <h3>Solução</h3>
          <p className="lb-gm__suggest">Você está jogando: a solução não vem pro seu navegador.</p>
        </section>
      ) : null}

      {view.gm && (
        <section className="lb-gm__sec">
          <h3>Linha do tempo</h3>
          <ol className="lb-gm__events">
            {view.gm.events.slice(-14).reverse().map((e, i) => (
              <li key={i}><span>{view.started_at ? fmtClock(e.t - view.started_at) : ''}</span> {e.m}</li>
            ))}
            {view.gm.events.length === 0 && <li className="lb-muted">Nada ainda.</li>}
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
