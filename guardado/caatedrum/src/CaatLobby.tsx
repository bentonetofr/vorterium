import { useEffect, useRef, useState } from 'react'
import { gm, lobby, type CaatSeat, type CaatView } from './caatService'
import { Banner, Portrait, SEAT_HEX } from './Heraldry'

// ────────────────────────────────────────────────────────
// O lobby: a mesa com os 4 lugares (você sempre embaixo; o próximo da vez
// fica à sua direita — a ordem é anti-horária). Quem é da campanha senta,
// põe apelido, escolhe o nível e aceita o aviso das interferências. O
// Mestre tira alguém da mesa e começa quando os 4 aceitaram.
// Teste do dono do site: ele senta mesmo sendo o mestre e completa a
// mesa com robôs.
// ────────────────────────────────────────────────────────

/** Lugares em volta da mesa, a partir de quem olha: embaixo, direita, topo, esquerda. */
export function seatsAround(seats: CaatSeat[], mine: number | null): { bottom: CaatSeat; right: CaatSeat; top: CaatSeat; left: CaatSeat } {
  const b = mine ?? 0
  const at = (k: number) => seats[(b + k) % 4]
  return { bottom: at(0), right: at(1), top: at(2), left: at(3) }
}

export function seatName(s: CaatSeat): string {
  return s.nick || s.name || 'Lugar vazio'
}

export function CaatLobby({ view }: { view: CaatView }) {
  const { me, textos, caso } = view
  const roomId = view.room.id
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const seated = me.seat !== null
  const ready = view.seats.every((s) => s.uid && s.consent)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setMsg(null)
    try { await fn() } catch (e) { setMsg(e instanceof Error ? e.message : 'Não deu certo.') } finally { setBusy(false) }
  }

  async function sit(seat: number) {
    await run(async () => {
      if (!seated) await lobby(roomId, { a: 'join' })
      await lobby(roomId, { a: 'seat', seat })
    })
  }

  const around = seatsAround(view.seats, me.seat)

  return (
    <div className="cd-lobby">
      <section className="cd-panel cd-story" aria-label="O caso">
        <p className="cd-kicker">Caso 1 · {caso.vitima}</p>
        <h3 className="cd-h3">{caso.titulo}</h3>
        {textos.abertura.map((p) => <p key={p}>{p}</p>)}
        <ul className="cd-suspects-mini" aria-label="Suspeitos">
          {caso.suspeitos.map((s) => (
            <li key={s.id} title={s.perfil}><Portrait name={s.nome} size={34} /><span>{s.nome}</span></li>
          ))}
        </ul>
      </section>

      <section className="cd-panel cd-tablebox" aria-label="A mesa">
        <div className="cd-table">
          <div className="cd-table__felt" aria-hidden="true"><span>Caatedrum</span></div>
          {(['top', 'left', 'right', 'bottom'] as const).map((pos) => {
            const s = around[pos]
            const mine = s.uid === me.uid
            return (
              <div key={pos} className={`cd-seat cd-seat--${pos}${mine ? ' is-me' : ''}${s.uid ? '' : ' is-empty'}`} style={{ ['--seat' as string]: SEAT_HEX[s.cor] }}>
                <Banner color={s.cor} emblem={s.emblema} size={34} />
                {s.uid ? (
                  <>
                    <Portrait name={seatName(s)} color={s.cor} size={44} />
                    <div className="cd-seat__who">
                      <strong>{seatName(s)}{mine && <span className="cd-you"> (você)</span>}</strong>
                      {s.bot && <span className="cd-tag">robô</span>}
                      {s.nick && <span className="cd-muted cd-small">{s.name}</span>}
                      <span className="cd-small">Nível {s.level} · {textos.niveis.find((n) => n.n === s.level)?.nome}</span>
                      <span className={`cd-small cd-flag${s.consent ? ' is-ok' : ''}`}>{s.consent ? '✓ aceitou o aviso' : '… ainda não aceitou'}</span>
                    </div>
                    {me.gm && !mine && (
                      <button type="button" className="cd-btn cd-btn--ghost cd-btn--sm" disabled={busy} onClick={() => void run(() => gm(roomId, { a: 'kick', uid: s.uid }))} aria-label={`Tirar ${seatName(s)} da mesa`}>Tirar</button>
                    )}
                  </>
                ) : (
                  <div className="cd-seat__who">
                    <span className="cd-muted">Lugar vazio</span>
                    {me.can_sit && <button type="button" className="cd-btn cd-btn--sm" disabled={busy} onClick={() => void sit(s.seat)}>Sentar aqui</button>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="cd-small cd-muted cd-center">A vez anda no sentido anti-horário: depois de você joga quem está à sua direita.</p>
      </section>

      {seated && <MyPlace view={view} busy={busy} run={run} />}

      {!seated && !me.gm && (
        <p className="cd-panel cd-center">{me.can_sit ? 'Escolha um lugar vazio na mesa para sentar.' : 'Você está assistindo — só os jogadores da campanha sentam.'}</p>
      )}

      {me.gm && (
        <section className="cd-panel cd-gmbar" aria-label="Mestre">
          <div>
            <p className="cd-kicker">Mestre</p>
            <p className="cd-small">{ready ? 'Os 4 sentaram e aceitaram. Pode começar.' : `Sentados: ${view.seats.filter((s) => s.uid).length} de 4 · aceitaram: ${view.seats.filter((s) => s.consent).length}.`}</p>
            {me.owner && !seated && <p className="cd-small cd-muted">Teste: você pode sentar num lugar vazio e completar o resto com robôs.</p>}
          </div>
          <div className="cd-row">
            {me.owner && view.seats.some((s) => !s.uid) && (
              <button type="button" className="cd-btn" disabled={busy} onClick={() => void run(() => gm(roomId, { a: 'bots' }))}>Completar com robôs</button>
            )}
            {me.owner && view.seats.some((s) => s.bot) && (
              <button type="button" className="cd-btn cd-btn--ghost" disabled={busy} onClick={() => void run(() => gm(roomId, { a: 'unbots' }))}>Tirar os robôs</button>
            )}
            <button type="button" className="cd-btn cd-btn--gold" disabled={busy || !ready} onClick={() => void run(() => gm(roomId, { a: 'start' }))}>Começar a partida</button>
            <button type="button" className="cd-btn cd-btn--ghost" disabled={busy} onClick={() => { if (window.confirm('Encerrar esta mesa? Quem está sentado sai.')) void run(() => gm(roomId, { a: 'close' })) }}>Encerrar mesa</button>
          </div>
        </section>
      )}

      {msg && <p className="cd-flash" role="alert">{msg}</p>}
    </div>
  )
}

/** O meu lugar: apelido, nível e o aviso. */
function MyPlace({ view, busy, run }: { view: CaatView; busy: boolean; run: (fn: () => Promise<void>) => Promise<void> }) {
  const { me, textos } = view
  const roomId = view.room.id
  const [nick, setNick] = useState(me.nick)
  const typing = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => { if (!typing.current) setNick(me.nick) }, [me.nick])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <section className="cd-panel cd-me" aria-label="O seu lugar">
      <div className="cd-me__col">
        <label className="cd-label" htmlFor="cd-nick">Apelido na mesa <span className="cd-muted">(opcional)</span></label>
        <input
          id="cd-nick"
          className="cd-input"
          value={nick}
          maxLength={24}
          placeholder="Como os outros te chamam"
          onChange={(e) => {
            const t = e.target.value
            setNick(t)
            typing.current = true
            window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => {
              void lobby(roomId, { a: 'nick', text: t }).catch(() => {}).finally(() => { typing.current = false })
            }, 600)
          }}
        />

        <div className={`cd-consent${me.consent ? ' is-ok' : ''}`}>
          <p className="cd-label">Antes de jogar</p>
          {textos.consentimento.map((p) => <p key={p} className="cd-small">{p}</p>)}
          {me.consent
            ? <p className="cd-flag is-ok">✓ Você aceitou.</p>
            : <button type="button" className="cd-btn cd-btn--gold" disabled={busy} onClick={() => void run(() => lobby(roomId, { a: 'consent' }))}>Li e aceito</button>}
        </div>
        <button type="button" className="cd-btn cd-btn--ghost cd-btn--sm" disabled={busy} onClick={() => void run(() => lobby(roomId, { a: 'leave' }))}>Levantar da mesa</button>
      </div>

      <fieldset className="cd-me__col cd-levels">
        <legend className="cd-label">Seu nível</legend>
        <p className="cd-small cd-muted">{textos.niveisAviso}</p>
        {textos.niveis.map((n) => (
          <label key={n.n} className={`cd-level${me.level === n.n ? ' is-on' : ''}`}>
            <input type="radio" name="cd-level" checked={me.level === n.n} disabled={busy} onChange={() => void run(() => lobby(roomId, { a: 'level', level: n.n }))} />
            <span className="cd-level__n" aria-hidden="true">{n.n}</span>
            <span><strong>{n.nome}</strong><span className="cd-small cd-block">{n.vantagem}</span></span>
          </label>
        ))}
      </fieldset>
    </section>
  )
}
