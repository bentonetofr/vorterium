import { useCallback, useEffect, useRef, useState } from 'react'
import { gm, type TorreView } from './torreService'
import { floorOf, ROLE_TITLES, type Floor, type TorreNet, type TorrePanel, type TorrePeer } from './torreNet'
import { TorreFloor } from './game/room'
import { GRATE } from './game/art'
import { PuzzlePanel } from './PuzzlePanel'
import { HintBanner } from './HintBanner'
import { onSoundChange, sfx, startAmbient, stopAmbient } from './sound'

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
  offset:        number
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
function FloorCanvas({ floor, view, offset, net, peers, controllable, frozen, panel, onOpen, onWatch, onRemotePanel }: FloorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<TorreFloor | null>(null)
  const playersRef = useRef(view.players)
  playersRef.current = view.players
  const peersRef = useRef(peers)
  peersRef.current = peers
  const gameRef0 = useRef(view.game ? { ...view.game, off: offset } : null)
  gameRef0.current = view.game ? { ...view.game, off: offset } : null
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
      // em cima, pisar na grade soa a ferro
      onStep: (x, y) => sfx(floor === 'cima' && x > GRATE.x && x < GRATE.x + GRATE.w && y > GRATE.y && y < GRATE.y + GRATE.h + 4 ? 'stepMetal' : 'step'),
    }, floor)
    game.setPlayers(playersRef.current)
    game.setGame(gameRef0.current)
    game.applyPeers(peersRef.current)
    gameRef.current = game
    const off = net.onPos((msg) => game.pushRemote(msg))
    return () => { off(); game.destroy(); gameRef.current = null }
  }, [view.room.id, me.uid, controllable, net, floor])

  useEffect(() => { gameRef.current?.setPlayers(view.players) }, [view.players])
  useEffect(() => { gameRef.current?.setGame(view.game ? { ...view.game, off: offset } : null) }, [view.game, offset])
  useEffect(() => { gameRef.current?.applyPeers(peers) }, [peers])
  useEffect(() => {
    gameRef.current?.setFrozen(frozen)
    if (controllable) gameRef.current?.setMyPanel(panel)
  }, [frozen, panel, controllable])

  return <canvas ref={canvasRef} className="lb-canvas" aria-label={FLOOR_TITLES[floor]} />
}

/**
 * Sons que vêm do estado (o que mudou desde a última visão): estrela
 * acendendo, o mapa girando, o sino quando a sombra do pêndulo mostra algo
 * (é o "agora!"), a chave, o outro lado girando o Astrário, a dica e o fim.
 */
function useStateSounds(view: TorreView, myFloor: Floor | null) {
  const prev = useRef<TorreView['game'] | null | undefined>(undefined)
  const prevHint = useRef<number | null | undefined>(undefined)
  useEffect(() => {
    const g = view.game
    const p = prev.current
    prev.current = g
    if (p === undefined || !g || !p) return
    const lit = (x: typeof g) => x.tele?.stars.filter((s) => s.state === 'lit').length ?? 0
    if (lit(g) > lit(p)) sfx('sparkle')
    if (g.map?.turned && !p.map?.turned) sfx('grind')
    const showing = (x: typeof g) => !!(x.shadow || x.map?.rim || x.tele?.fifth)
    if (showing(g) && !showing(p)) sfx('bell')
    if (g.inv.chave && !p.inv.chave && myFloor !== 'baixo') sfx('unlock')
    const other = myFloor === 'cima' ? 'baixo_go' : myFloor === 'baixo' ? 'cima_go' : null
    if (other && g.other[other] && g.other[other] !== p.other[other]) sfx('gear')
    if (g.opened && !p.opened) sfx('finale')
  }, [view.game, myFloor])
  useEffect(() => {
    const t = view.hint?.t ?? null
    if (prevHint.current !== undefined && t && t !== prevHint.current) sfx('hint')
    prevHint.current = t
  }, [view.hint])
}

function fmtTime(ms: number) {
  const s = Math.round(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min ${String(s % 60).padStart(2, '0')} s`
}

export function TorreGameView({ view, offset, net, peers }: { view: TorreView; offset: number; net: TorreNet; peers: TorrePeer[] }) {
  const [panel, setPanel] = useState<TorrePanel | null>(null)
  const [watch, setWatch] = useState<string | null>(null)
  const [remotePanels, setRemotePanels] = useState<Record<string, TorrePanel | null>>({})
  const [hint, setHint] = useState(true)
  const me = view.me
  const myFloor = floorOf(me.slot)
  const controllable = myFloor !== null

  // Som de fundo: vento lá em cima, máquinas embaixo (quem assiste ouve os dois).
  useEffect(() => {
    const kind = myFloor ?? 'todos'
    startAmbient(kind)
    const off = onSoundChange((on) => { if (on) startAmbient(kind) })
    return () => { off(); stopAmbient() }
  }, [myFloor])

  useStateSounds(view, myFloor)

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
  const opened = !!view.game?.opened
  const [endSeen, setEndSeen] = useState(false)
  const blurred = !!panel || !!watchedPanel || (opened && !endSeen)
  const took = view.game?.finished_at && view.started_at ? Math.max(0, view.game.finished_at - view.started_at) : null

  useEffect(() => { net.setMe({ panel }) }, [panel, net])

  const floorProps = {
    view, offset, net, peers, frozen: blurred, panel,
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

      {!blurred && <HintBanner hint={view.hint ?? null} offset={offset} />}

      {view.game?.inv.chave && (
        <div className="lb-inv" aria-label="O que a dupla carrega">
          <span className="lb-chip" title="Chave de bronze"><i className="lb-ico lb-ico--key" aria-hidden="true" /> Chave de bronze</span>
        </div>
      )}

      {panel && myFloor && <PuzzlePanel id={panel} floor={myFloor} view={view} offset={offset} onClose={closePanel} />}
      {!panel && watched && watchedPanel && (
        <PuzzlePanel id={watchedPanel} floor={floorOf(watched.slot) ?? 'cima'} view={view} offset={offset} onClose={closeWatch} watching={watched.name} />
      )}

      {opened && !endSeen && !panel && !watchedPanel && (
        <div className="lb-panel-wrap">
          <section className="lb-panel lb-frame lb-ending" role="dialog" aria-label="A cúpula se abriu">
            <p className="lb-kicker">A torre de Caatedrum</p>
            <h2 className="lb-panel__title">A cúpula se abre.</h2>
            <p className="lb-panel__text">O céu inteiro aparece. Não são estrelas: são olhos. Centenas, milhares, abertos, olhando pra baixo.</p>
            <p className="lb-panel__text">E no centro, o maior de todos. Ele estava olhando pra vocês o tempo todo.</p>
            {took !== null && <p className="lb-ending__time">Tempo: {fmtTime(took)}</p>}
            <div className="lb-lock__btns">
              <button type="button" className="lb-btn" onClick={() => setEndSeen(true)}>Ver a torre</button>
              {me.gm && <button type="button" className="lb-btn lb-btn--gold" onClick={() => { if (window.confirm('Encerrar a Torre do Observatório pra todo mundo?')) void gm(view.room.id, { a: 'close' }) }}>Encerrar o jogo</button>}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
