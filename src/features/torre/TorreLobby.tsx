import { useEffect, useRef, useState } from 'react'
import { gm, type TorreView } from './torreService'
import { ROLE_TITLES, type TorrePeer } from './torreNet'
import { CLOAKS, drawActor, makeCanvas } from '../livro/game/art'

// ────────────────────────────────────────────────────────
// O saguão: todo mundo da campanha cai aqui quando o jogo abre. O Mestre
// toca em quem joga — o 1º vira o Observador (andar de cima, Capa Azul),
// o 2º o Mecânico (andar de baixo, Capa Vermelha); tocar de novo tira — e
// começa. A torre precisa dos dois: com 1 só não começa. Quem não for
// escolhido assiste.
// ────────────────────────────────────────────────────────

const GRAY = { c: '#4a4458', C: '#353041', h: '#6b6480', g: '#8a8296' }

function Mini({ slot }: { slot: number | null }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const [src, sctx] = makeCanvas(16, 20)
    drawActor(sctx, 8, 19, 'down', 0, slot === null ? GRAY : CLOAKS[slot])
    c.width = 64
    c.height = 80
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, 64, 80)
    ctx.drawImage(src, 0, 0, 64, 80)
  }, [slot])
  return <canvas ref={ref} className="lb-mini" aria-hidden="true" />
}

export function TorreLobby({ view, peers }: { view: TorreView; peers: TorrePeer[] }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const roomId = view.room.id
  const picked = view.players.map((p) => p.uid)
  const online = new Set(peers.map((p) => p.uid))
  const me = view.me

  async function run(a: Record<string, unknown>) {
    setBusy(true)
    setMsg(null)
    try { await gm(roomId, a) } catch (e) { setMsg(e instanceof Error ? e.message : 'Não deu certo.') } finally { setBusy(false) }
  }

  function toggle(uid: string) {
    let next = picked.includes(uid) ? picked.filter((u) => u !== uid) : [...picked, uid]
    if (next.length > 2) next = [next[0], uid]
    void run({ a: 'pick', uids: next })
  }

  const mySlot = me.slot

  return (
    <div className="lb-lobby">
      <section className="lb-frame lb-lobby__box">
        <p className="lb-kicker">A torre de Caatedrum</p>
        <h1 className="lb-title">A Torre do Observatório</h1>
        <p className="lb-lobby__lead">
          Dois andares, uma grade de ferro entre eles. Um sobe e vê o céu; o outro desce e mexe nas máquinas.
          Vocês não se enxergam, só se ouvem. Falem pela voz.
        </p>

        <ul className="lb-people" aria-label="Quem está na sessão">
          {view.members.map((m) => {
            const slot = picked.indexOf(m.uid)
            const s = slot >= 0 ? slot : null
            const content = (
              <>
                <Mini slot={s} />
                <span className="lb-person__name">{m.name}{m.uid === me.uid ? ' (você)' : ''}</span>
                <span className="lb-person__sub">
                  <span className={`lb-online${online.has(m.uid) ? ' is-on' : ''}`} aria-hidden="true" />
                  {s !== null ? `${ROLE_TITLES[s]} · ${s === 0 ? 'cima' : 'baixo'}` : m.role === 'master' ? 'Mestre' : online.has(m.uid) ? 'aqui' : 'fora'}
                </span>
              </>
            )
            return (
              <li key={m.uid}>
                {me.gm
                  ? <button type="button" className={`lb-person${s !== null ? ` is-picked is-slot${s}` : ''}`} disabled={busy} onClick={() => toggle(m.uid)} aria-pressed={s !== null}>{content}</button>
                  : <div className={`lb-person${s !== null ? ` is-picked is-slot${s}` : ''}`}>{content}</div>}
              </li>
            )
          })}
        </ul>

        {me.gm ? (
          <div className="lb-lobby__foot">
            <p className="lb-muted">
              {picked.length === 0
                ? 'Toque em quem vai jogar: o 1º sobe (Observador), o 2º desce (Mecânico).'
                : picked.length === 1 ? 'Falta o Mecânico: toque em mais um.' : 'Dupla pronta.'}
            </p>
            <button type="button" className="lb-btn lb-btn--gold" disabled={busy || picked.length !== 2} onClick={() => void run({ a: 'start' })}>Começar</button>
          </div>
        ) : (
          <p className="lb-lobby__foot lb-muted">
            {mySlot !== null
              ? <>Você vai ser o <b className={`lb-tc${mySlot}`}>{ROLE_TITLES[mySlot]}</b>, no andar de {mySlot === 0 ? 'cima' : 'baixo'}. Esperando o Mestre começar…</>
              : 'O Mestre está escolhendo quem joga…'}
          </p>
        )}
        {msg && <p className="lb-flash" role="alert">{msg}</p>}
      </section>
    </div>
  )
}
