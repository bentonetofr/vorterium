import { useCallback, useEffect, useRef, useState } from 'react'
import type { LivroView } from './livroService'
import type { LivroNet, NetPeer, PanelId } from './livroNet'
import { LivroGame } from './game/engine'
import { PuzzlePanel } from './PuzzlePanel'

// ────────────────────────────────────────────────────────
// A partida: a sala desenhada no canvas (o motor cuida de andar, mouse e
// luz) e quase nada por cima — interface limpa. Quem joga anda e abre os
// objetos; quem assiste (e o Mestre) vê os dois e, tocando no balão de
// quem está num objeto, assiste à mesma janela.
// ────────────────────────────────────────────────────────

const PANEL_NAMES: Record<PanelId, string> = {
  castical: 'no Castiçal', retrato: 'no Retrato', astrolabio: 'no Astrolábio', estante: 'na Estante', pedestal: 'no Pedestal',
}
const CLOAK_NAMES = ['Capa Azul', 'Capa Vermelha']

export function LivroGameView({ view, net, peers }: { view: LivroView; net: LivroNet; peers: NetPeer[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<LivroGame | null>(null)
  const playersRef = useRef(view.players)
  const peersRef = useRef(peers)
  playersRef.current = view.players
  peersRef.current = peers
  const [panel, setPanel] = useState<PanelId | null>(null)
  const [watch, setWatch] = useState<string | null>(null)
  const [remotePanels, setRemotePanels] = useState<Record<string, PanelId | null>>({})
  const [hint, setHint] = useState(true)
  const me = view.me
  const controllable = me.slot !== null

  useEffect(() => {
    const game = new LivroGame(canvasRef.current!, {
      meUid: me.uid,
      controllable,
      storageKey: `lb-pos:${view.room.id}:${me.uid}`,
      onOpen: (id) => setPanel(id),
      onWatch: (uid) => setWatch(uid),
      onPos: (msg) => net.sendPos(msg),
      onRemotePanel: (uid, p) => setRemotePanels((prev) => (prev[uid] === p ? prev : { ...prev, [uid]: p })),
    })
    game.setPlayers(playersRef.current)
    game.applyPeers(peersRef.current)
    gameRef.current = game
    const off = net.onPos((msg) => game.pushRemote(msg))
    return () => { off(); game.destroy(); gameRef.current = null }
  }, [view.room.id, me.uid, controllable, net])

  useEffect(() => { gameRef.current?.setPlayers(view.players) }, [view.players])
  useEffect(() => { gameRef.current?.applyPeers(peers) }, [peers])

  // Janela aberta (minha ou assistindo): o boneco para e o fundo desfoca.
  useEffect(() => {
    gameRef.current?.setFrozen(!!panel || !!watch)
    gameRef.current?.setMyPanel(panel)
    net.setMe({ panel })
  }, [panel, watch, net])

  // A dica de controles some sozinha.
  useEffect(() => { const t = window.setTimeout(() => setHint(false), 9000); return () => window.clearTimeout(t) }, [])

  // Quem eu assisto fechou o objeto: a janela fecha junto.
  const watched = watch ? view.players.find((p) => p.uid === watch) ?? null : null
  const watchedPanel = watch ? remotePanels[watch] ?? null : null
  useEffect(() => { if (watch && !watchedPanel) setWatch(null) }, [watch, watchedPanel])

  const closePanel = useCallback(() => setPanel(null), [])
  const closeWatch = useCallback(() => setWatch(null), [])
  const blurred = !!panel || !!watchedPanel
  const mine = view.players.find((p) => p.uid === me.uid)

  return (
    <div className={`lb-stage${blurred ? ' is-blurred' : ''}`}>
      <canvas ref={canvasRef} className="lb-canvas" aria-label="A biblioteca de Caatedrum" />

      <div className="lb-chip lb-chip--role">
        {controllable
          ? <><span className={`lb-dot lb-dot--${mine?.slot ?? 0}`} /> Você é a {CLOAK_NAMES[mine?.slot ?? 0]}</>
          : me.gm ? 'Mestre · assistindo' : 'Assistindo'}
      </div>

      {controllable && hint && !blurred && (
        <div className="lb-hint" role="note"><b>WASD</b> anda · <b>clique</b> nos objetos (ou <b>E</b> perto deles) · <b>Esc</b> fecha</div>
      )}

      {!controllable && (
        <div className="lb-watchbar" aria-label="Quem está jogando">
          {view.players.map((p) => {
            const at = p.uid === me.uid ? panel : remotePanels[p.uid] ?? null
            const online = peers.some((x) => x.uid === p.uid)
            return (
              <button key={p.uid} type="button" className="lb-chip lb-chip--player" disabled={!at} onClick={() => setWatch(p.uid)} title={at ? 'Assistir' : undefined}>
                <span className={`lb-dot lb-dot--${p.slot}`} />
                <b>{p.name}</b>
                <span className="lb-chip__sub">{!online ? 'fora' : at ? `${PANEL_NAMES[at]} · assistir` : 'andando'}</span>
              </button>
            )
          })}
        </div>
      )}

      {panel && <PuzzlePanel id={panel} onClose={closePanel} />}
      {!panel && watched && watchedPanel && <PuzzlePanel id={watchedPanel} onClose={closeWatch} watching={watched.name} />}
    </div>
  )
}
