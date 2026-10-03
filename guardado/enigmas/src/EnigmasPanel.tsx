import { useEffect, useState } from 'react'
import { useBoardFont } from '../../shared/lib/googleFonts'
import { gm, openRoom, setViewingRoom } from './enigmaService'
import { EnigmaGame } from './EnigmaGame'
import { EnigmaGm } from './EnigmaGm'
import { EnigmaLobby } from './EnigmaLobby'
import { useEnigmaRoom, useServerNow } from './useEnigmaRoom'
import './Enigmas.css'

// ────────────────────────────────────────────────────────
// Aba Enigmas (Sessão da campanha). Sem câmara aberta: o mestre abre;
// jogador espera. Câmara aberta: lobby (história, aviso, memória, sorteio)
// e depois o jogo — jogador vê a fase da dupla dele (e assiste a outra);
// mestre vê o painel. Pausado: tudo para, pra todos.
// A sala tem identidade própria (arquivo gótico, noturno); a aba segue o site.
// ────────────────────────────────────────────────────────

export function EnigmasPanel({ campaignId, isMaster }: { campaignId: string; isMaster: boolean }) {
  useBoardFont('Grenze Gotisch')
  useBoardFont('Work Sans')
  const { room, view, error, clockOffset, reloadRoom } = useEnigmaRoom(campaignId)
  const [busy, setBusy] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const playing = view?.room.status === 'jogo'
  const now = useServerNow(clockOffset, playing && !view?.room.paused)

  // Quem está na aba não recebe o aviso "a câmara se abriu".
  useEffect(() => {
    setViewingRoom(room?.id ?? null)
    return () => setViewingRoom(null)
  }, [room?.id])

  if (room === undefined) {
    return <div className="en-shell en-shell--plain"><div className="spinner spinner--sm" /> Abrindo…</div>
  }

  if (!room) {
    return (
      <div className="en-shell en-shell--plain">
        <div className="en-closed">
          <p className="en-closed__title">A câmara está fechada.</p>
          {isMaster ? (
            <>
              <p className="en-muted">Ao abrir, os jogadores recebem um aviso para entrar.</p>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => {
                setBusy(true)
                setOpenError(null)
                try { await openRoom(campaignId); await reloadRoom() } catch (e) { setOpenError(e instanceof Error ? e.message : 'Não foi possível.') } finally { setBusy(false) }
              }}>Abrir a câmara de Caatedrum</button>
              {openError && <p className="en-flash" role="alert">{openError}</p>}
            </>
          ) : (
            <p className="en-muted">Quando o mestre abrir, um aviso aparece pra você entrar.</p>
          )}
        </div>
      </div>
    )
  }

  if (!view) {
    return <div className="en-shell en-shell--plain">{error ? <p className="en-flash">{error}</p> : <><div className="spinner spinner--sm" /> Abrindo a câmara…</>}</div>
  }

  return (
    <div className="en-shell enigma-room">
      {view.room.status === 'lobby'
        ? <EnigmaLobby view={view} />
        : view.me.gm
          ? <EnigmaGm view={view} now={now} />
          : view.me.dupla
            ? <EnigmaGame view={view} now={now} />
            : <p className="en-card en-wait">O jogo já começou sem você nesta câmara.</p>}

      {view.room.paused && (
        <div className="en-paused" role="alertdialog" aria-label="Jogo pausado">
          <div className="en-paused__card">
            <p className="en-paused__title">Pausado</p>
            <p>{view.room.paused_by ? <>Pausado por <strong>{view.room.paused_by}</strong>.</> : 'O jogo está pausado.'} Tudo parou para todos.</p>
            {view.me.gm
              ? <button type="button" className="en-btn en-btn--gold" onClick={() => void gm(view.room.id, { a: 'resume' })}>Retomar</button>
              : <p className="en-muted en-small">Só o mestre retoma.</p>}
          </div>
        </div>
      )}
      {error && <p className="en-flash" role="alert">{error}</p>}
    </div>
  )
}
