import { useEffect, useState } from 'react'
import { useBoardFont } from '../../shared/lib/googleFonts'
import { gm, openRoom, play, setViewingRoom, type CaatView } from './caatService'
import { CaatLobby, seatName, seatsAround } from './CaatLobby'
import { Banner, Portrait, SEAT_HEX } from './Heraldry'
import { useCaatRoom } from './useCaatRoom'
import './Caatedrum.css'

// ────────────────────────────────────────────────────────
// Aba Caatedrum (Sessão da campanha). Sem mesa: o mestre põe; jogador
// espera o aviso. Mesa posta: lobby e depois a partida. Pausado: tudo
// para, pra todos (qualquer jogador pausa; só o Mestre retoma).
// A mesa tem identidade própria (carvalho, pergaminho, cera e ouro velho);
// a aba e o aviso seguem o site.
// ────────────────────────────────────────────────────────

export function CaatedrumPanel({ campaignId, isMaster }: { campaignId: string; isMaster: boolean }) {
  useBoardFont('IM Fell English')
  useBoardFont('Work Sans')
  useBoardFont('Caveat')
  const { room, view, error, reloadRoom } = useCaatRoom(campaignId)
  const [busy, setBusy] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  // Quem está na aba não recebe o aviso "a mesa está posta".
  useEffect(() => {
    setViewingRoom(room?.id ?? null)
    return () => setViewingRoom(null)
  }, [room?.id])

  if (room === undefined) {
    return <div className="cd-shell cd-shell--plain"><div className="spinner spinner--sm" /> Abrindo…</div>
  }

  if (!room) {
    return (
      <div className="cd-shell cd-shell--plain">
        <div className="cd-closed">
          <p className="cd-closed__title">Nenhuma mesa de Caatedrum posta.</p>
          {isMaster ? (
            <>
              <p className="cd-muted">Ao pôr a mesa, os jogadores recebem um aviso para sentar.</p>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => {
                setBusy(true)
                setOpenError(null)
                try { await openRoom(campaignId); await reloadRoom() } catch (e) { setOpenError(e instanceof Error ? e.message : 'Não foi possível.') } finally { setBusy(false) }
              }}>Pôr a mesa de Caatedrum</button>
              {openError && <p className="cd-flash" role="alert">{openError}</p>}
            </>
          ) : (
            <p className="cd-muted">Quando o mestre puser a mesa, um aviso aparece pra você sentar.</p>
          )}
        </div>
      </div>
    )
  }

  if (!view) {
    return <div className="cd-shell cd-shell--plain">{error ? <p className="cd-flash">{error}</p> : <><div className="spinner spinner--sm" /> Abrindo a mesa…</>}</div>
  }

  const seated = view.me.seat !== null

  return (
    <div className="cd-shell caat-room">
      <TopBar view={view} />

      {view.room.status === 'lobby' ? <CaatLobby view={view} /> : <Started view={view} />}

      {view.me.gm && <Timeline view={view} />}

      {view.room.paused && (
        <div className="cd-paused" role="alertdialog" aria-label="Jogo pausado">
          <div className="cd-paused__card">
            <p className="cd-paused__title">Pausado</p>
            <p>{view.room.paused_by ? <>Pausado por <strong>{view.room.paused_by}</strong>.</> : 'O jogo está pausado.'} Tudo parou para todos.</p>
            {view.me.gm
              ? <button type="button" className="cd-btn cd-btn--gold" onClick={() => void gm(view.room.id, { a: 'resume' })}>Retomar</button>
              : <p className="cd-muted cd-small">Só o Mestre retoma.</p>}
          </div>
        </div>
      )}
      {error && <p className="cd-flash" role="alert">{error}</p>}
      {!seated && !view.me.gm && view.room.status === 'jogo' && <p className="cd-small cd-muted cd-center">Você está assistindo esta partida.</p>}
    </div>
  )
}

/** A faixa do alto (como na mesa): o sino, o nome e a rodada; Pausar. */
function TopBar({ view }: { view: CaatView }) {
  const seated = view.me.seat !== null
  const [busy, setBusy] = useState(false)
  const pause = async () => {
    setBusy(true)
    try { if (view.me.gm) await gm(view.room.id, { a: 'pause' }); else await play(view.room.id, { a: 'pause' }) } catch { /* já pausado */ } finally { setBusy(false) }
  }
  return (
    <header className="cd-bar">
      <div className="cd-bar__cell">
        <BellIcon />
        <span>
          <strong>{view.room.status === 'lobby' ? 'Lobby' : `Rodada ${view.round}`}</strong>
          <span className="cd-small cd-block cd-muted">{view.room.status === 'lobby' ? 'esperando os 4' : view.caso.titulo}</span>
        </span>
      </div>
      <h2 className="cd-bar__title"><span aria-hidden="true">✠</span> Caatedrum <span aria-hidden="true">✠</span></h2>
      <div className="cd-bar__cell cd-bar__cell--end">
        {(seated || view.me.gm) && !view.room.paused && (
          <button type="button" className="cd-btn cd-btn--pause" disabled={busy} onClick={() => void pause()}>Pausar</button>
        )}
      </div>
    </header>
  )
}

/** Partida começou (marco 1): a mesa com quem começa. O tabuleiro e as cartas chegam nos próximos marcos. */
function Started({ view }: { view: CaatView }) {
  const around = seatsAround(view.seats, view.me.seat)
  return (
    <div className="cd-lobby">
      <section className="cd-panel cd-tablebox" aria-label="A mesa">
        <div className="cd-table">
          <div className="cd-table__felt" aria-hidden="true"><span>Caatedrum</span></div>
          {(['top', 'left', 'right', 'bottom'] as const).map((pos) => {
            const s = around[pos]
            const starts = view.start_seat === s.seat
            return (
              <div key={pos} className={`cd-seat cd-seat--${pos}${s.uid === view.me.uid ? ' is-me' : ''}`} style={{ ['--seat' as string]: SEAT_HEX[s.cor] }}>
                <Banner color={s.cor} emblem={s.emblema} size={34} />
                <Portrait name={seatName(s)} color={s.cor} size={44} />
                <div className="cd-seat__who">
                  <strong>{seatName(s)}{s.uid === view.me.uid && <span className="cd-you"> (você)</span>}</strong>
                  {s.bot && <span className="cd-tag">robô</span>}
                  <span className="cd-small">Nível {s.level}</span>
                  {starts && <span className="cd-small cd-flag is-ok">♜ começa com o busto de Orlan</span>}
                </div>
              </div>
            )
          })}
        </div>
      </section>
      <p className="cd-panel cd-center">A partida começou. O tabuleiro, as cartas e as trocas chegam nos próximos marcos.</p>
    </div>
  )
}

function Timeline({ view }: { view: CaatView }) {
  const events = view.gm?.events ?? []
  return (
    <details className="cd-panel cd-timeline">
      <summary className="cd-label">Linha do tempo (só o Mestre vê)</summary>
      <ol>
        {[...events].reverse().map((e, i) => (
          <li key={i}><span className="cd-timeline__t">{new Date(e.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>{e.m}</li>
        ))}
      </ol>
    </details>
  )
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="cd-bar__bell">
      <path d="M6 16.5h12l-1.8-2.6V10a4.2 4.2 0 0 0-8.4 0v3.9zM10 19.5h4M12 3.5v2.3" />
    </svg>
  )
}
