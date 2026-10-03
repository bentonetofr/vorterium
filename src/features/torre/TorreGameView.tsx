import { useCallback, useEffect, useRef, useState } from 'react'
import type { TorreView } from './torreService'
import { floorOf, ROLE_TITLES, type Floor, type TorreNet, type TorrePanel, type TorrePeer } from './torreNet'
import { TorreFloor } from './game/room'
import { PuzzlePanel } from './PuzzlePanel'

// ────────────────────────────────────────────────────────
// A partida. Quem joga vê só o SEU andar (o outro aparece como sombra pela
// grade). Quem assiste — e o Mestre — vê os dois andares lado a lado e,
// tocando no balão de quem está num objeto, assiste à mesma janela.
// Interface limpa: chip do papel, dica que some, barra de quem assiste.
// ────────────────────────────────────────────────────────

const PANEL_NAMES: Record<TorrePanel, string> = {
  telescopio: 'no Telescópio', mapa: 'no Mapa estelar', espelhos: 'nos Espelhos',
  manivela: 'na Manivela', pendulo: 'no Pêndulo', astrario: 'no Astrário',
}
const FLOOR_TITLES: Record<Floor, string> = { cima: 'Cima · o Observatório', baixo: 'Baixo · a Casa das Máquinas' }

interface FloorProps {
  floor:         Floor
  view:          TorreView
  net:           TorreNet
  peers:         TorrePeer[]
  controllable:  boolean
  frozen:        boolean
  panel:         TorrePanel | null
  onOpen:        (id: TorrePanel) => void
  onWatch:       (uid: string) => void
  onRemotePanel: (uid: string, p: TorrePanel | null) => void
}

/** Um andar desenhado num canvas (o motor cuida de andar, mouse e luz). */
function FloorCanvas({ floor, view, net, peers, controllable, frozen, panel, onOpen, onWatch, onRemotePanel }: FloorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<TorreFloor | null>(null)
  const playersRef = useRef(view.players)
  playersRef.current = view.players
  const peersRef = useRef(peers)
  peersRef.current = peers
  const cb = useRef({ onOpen, onWatch, onRemotePanel })
  cb.current = { onOpen, onWatch, onRemotePanel }
  const me = view.me

  useEffect(() => {
    const game = new TorreFloor(canvasRef.current!, {
      meUid: me.uid,
      controllable,
      storageKey: `tor-pos:${view.room.id}:${me.uid}`,
      onOpen: (id) => cb.current.onOpen(id),
      onWatch: (uid) => cb.current.onWatch(uid),
      onPos: (msg) => net.sendPos(msg),
      onRemotePanel: (uid, p) => cb.current.onRemotePanel(uid, p),
      // quem assiste vê os dois andares lado a lado: sem isso ficariam em 1×
      integerScale: controllable,
    }, floor)
    game.setPlayers(playersRef.current)
    game.applyPeers(peersRef.current)
    gameRef.current = game
    const off = net.onPos((msg) => game.pushRemote(msg))
    return () => { off(); game.destroy(); gameRef.current = null }
  }, [view.room.id, me.uid, controllable, net, floor])

  useEffect(() => { gameRef.current?.setPlayers(view.players) }, [view.players])
  useEffect(() => { gameRef.current?.setGame(view.game ?? null) }, [view.game])
  useEffect(() => { gameRef.current?.applyPeers(peers) }, [peers])
  useEffect(() => {
    gameRef.current?.setFrozen(frozen)
    if (controllable) gameRef.current?.setMyPanel(panel)
  }, [frozen, panel, controllable])

  return <canvas ref={canvasRef} className="lb-canvas" aria-label={FLOOR_TITLES[floor]} />
}

export function TorreGameView({ view, net, peers }: { view: TorreView; net: TorreNet; peers: TorrePeer[] }) {
  const [panel, setPanel] = useState<TorrePanel | null>(null)
  const [watch, setWatch] = useState<string | null>(null)
  const [remotePanels, setRemotePanels] = useState<Record<string, TorrePanel | null>>({})
  const [hint, setHint] = useState(true)
  const me = view.me
  const myFloor = floorOf(me.slot)
  const controllable = myFloor !== null

  // A dica de controles some sozinha.
  useEffect(() => { const t = window.setTimeout(() => setHint(false), 10000); return () => window.clearTimeout(t) }, [])

  const onRemotePanel = useCallback((uid: string, p: TorrePanel | null) => {
    setRemotePanels((prev) => (prev[uid] === p ? prev : { ...prev, [uid]: p }))
  }, [])

  // Quem eu assisto fechou o objeto: a janela fecha junto.
  const watched = watch ? view.players.find((p) => p.uid === watch) ?? null : null
  const watchedPanel = watch ? remotePanels[watch] ?? null : null
  useEffect(() => { if (watch && !watchedPanel) setWatch(null) }, [watch, watchedPanel])

  const closePanel = useCallback(() => setPanel(null), [])
  const closeWatch = useCallback(() => setWatch(null), [])
  const blurred = !!panel || !!watchedPanel

  useEffect(() => { net.setMe({ panel }) }, [panel, net])

  const floorProps = {
    view, net, peers, frozen: blurred, panel,
    onOpen: setPanel, onWatch: setWatch, onRemotePanel,
  }

  return (
    <div className={`lb-stage${blurred ? ' is-blurred' : ''}`}>
      {controllable ? (
        <FloorCanvas floor={myFloor} controllable {...floorProps} />
      ) : (
        <div className="tor-floors">
          {(['cima', 'baixo'] as const).map((f) => (
            <section key={f} className="tor-floor" aria-label={FLOOR_TITLES[f]}>
              <h2 className="tor-floor__title">{FLOOR_TITLES[f]}</h2>
              <div className="tor-floor__canvas"><FloorCanvas floor={f} controllable={false} {...floorProps} /></div>
            </section>
          ))}
        </div>
      )}

      <div className="lb-chip lb-chip--role">
        {controllable
          ? <><span className={`lb-dot lb-dot--${me.slot}`} /> Você é o {ROLE_TITLES[me.slot!]} · {myFloor === 'cima' ? 'em cima' : 'embaixo'}</>
          : me.gm ? 'Mestre · assistindo' : 'Assistindo'}
      </div>

      {controllable && hint && !blurred && (
        <div className="lb-hint" role="note">
          <b>WASD</b> anda · <b>clique</b> nos objetos (ou <b>E</b> perto deles) · <b>Esc</b> fecha · vocês só se ouvem: <b>falem</b>
        </div>
      )}

      {!controllable && (
        <div className="lb-watchbar" aria-label="Quem está jogando">
          {view.players.map((p) => {
            const at = remotePanels[p.uid] ?? null
            const online = peers.some((x) => x.uid === p.uid)
            return (
              <button key={p.uid} type="button" className="lb-chip lb-chip--player" disabled={!at} onClick={() => setWatch(p.uid)} title={at ? 'Assistir' : undefined}>
                <span className={`lb-dot lb-dot--${p.slot}`} />
                <b>{p.name}</b>
                <span className="lb-chip__sub">{!online ? 'fora' : at ? `${PANEL_NAMES[at]} · assistir` : p.slot === 0 ? 'em cima' : 'embaixo'}</span>
              </button>
            )
          })}
        </div>
      )}

      {panel && myFloor && <PuzzlePanel id={panel} floor={myFloor} view={view} onClose={closePanel} />}
      {!panel && watched && watchedPanel && (
        <PuzzlePanel id={watchedPanel} floor={floorOf(watched.slot) ?? 'cima'} view={view} onClose={closeWatch} watching={watched.name} />
      )}
    </div>
  )
}
