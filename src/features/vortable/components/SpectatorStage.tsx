import { useEffect, useRef, useState } from 'react'
import type { CampaignWithRole } from '../../../shared/types'
import type { WatchControls } from '../../../vendor/vortable/vortable'
import { useMesaStream } from '../../mesa/MesaStreamProvider'
import { createWorldStorage, VORTABLE_ASSETS } from '../services/vortableService'
import { useVortableNet } from '../net/VortableNetProvider'
import { useVortableWorlds } from '../worlds/VortableWorldProvider'
import { EngineStage } from './EngineStage'
import { SceneOverlay } from './SceneOverlay'
import './SceneBar.css'
import './SpectatorStage.css'

type Peer = ReturnType<WatchControls['peers']>[number]
type Camera = 'seguir' | 'mestre' | 'livre'

const CAMERAS: { id: Camera; label: string }[] = [
  { id: 'seguir', label: 'Seguir jogador' },
  { id: 'mestre', label: 'Câmera do mestre' },
  { id: 'livre', label: 'Câmera livre' },
]
/** Mesmas reações que o motor aceita. */
const EMOJIS = ['👏', '😮', '😂', '❤️', '🔥', '🎉', '😱', '🤔']
const REACT_COOLDOWN_MS = 700

/**
 * Espectador: quem não está em jogo (sem boneco no mundo) assiste. Três câmeras:
 * seguir um jogador (vai junto quando ele muda de zona), a do mestre (o foco que ele
 * escolhe) e a livre. Vê as cenas do mestre, ouve a zona e reage com emojis que
 * aparecem no mapa pra todos.
 */
export function SpectatorStage({ campaign, userId, canPlay, onPlay }: {
  campaign: CampaignWithRole
  userId: string
  /** Tem boneco: o botão leva ao jogo. Sem boneco, leva a criar um. */
  canPlay: boolean
  onPlay: () => void
}) {
  const vnet = useVortableNet()
  const { active, ready } = useVortableWorlds()
  const { stage } = useMesaStream()
  const rules = stage.spectate
  const watch = useRef<WatchControls | null>(null)
  const [peers, setPeers] = useState<Peer[]>([])
  const [camera, setCamera] = useState<Camera>('seguir')
  const [picked, setPicked] = useState<string | null>(null)
  const [zones, setZones] = useState<{ id: string; name: string }[]>([])
  const [zone, setZone] = useState<{ id: string; name: string } | null>(null)
  const [cooling, setCooling] = useState(false)
  // sobe a cada vez que o palco é (re)montado, pra câmera apontar de novo pro alvo
  const [epoch, setEpoch] = useState(0)

  // sem câmera livre liberada, cai pra "seguir"
  const effective: Camera = camera === 'livre' && !rules.free ? 'seguir' : camera
  const inGame = peers.filter((p) => p.zone)

  // quem a câmera acompanha agora
  const followId: string | null = (() => {
    if (effective === 'livre') return null
    if (effective === 'mestre' && rules.focus && inGame.some((p) => p.id === rules.focus)) return rules.focus
    if (picked && inGame.some((p) => p.id === picked)) return picked
    return inGame[0]?.id ?? null
  })()

  // lista de zonas (câmera livre)
  useEffect(() => {
    if (!active) return
    let dead = false
    createWorldStorage(campaign.id, active.id, active.name)
      .then((worlds) => worlds.list())
      .then((list) => { if (!dead) setZones(list.map((z) => ({ id: z.id, name: z.name }))) })
      .catch(() => {})
    return () => { dead = true }
  }, [campaign.id, active?.id, active?.name])

  // quem está na sala: confere duas vezes por segundo
  useEffect(() => {
    const timer = window.setInterval(() => {
      const w = watch.current
      if (w) setPeers(w.peers())
    }, 500)
    return () => window.clearInterval(timer)
  }, [])

  // aponta a câmera pro alvo (e solta ao entrar na câmera livre)
  useEffect(() => {
    const w = watch.current
    if (!w) return
    if (followId) { if (w.following() !== followId) w.follow(followId) }
    else if (effective === 'livre') { w.follow(null); w.fit() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followId, effective, epoch])

  function react(emoji: string) {
    if (cooling) return
    watch.current?.react(emoji)
    setCooling(true)
    window.setTimeout(() => setCooling(false), REACT_COOLDOWN_MS)
  }

  function step(delta: number) {
    if (inGame.length === 0) return
    const i = Math.max(0, inGame.findIndex((p) => p.id === followId))
    const next = inGame[(i + delta + inGame.length) % inGame.length]
    setPicked(next.id)
    setCamera('seguir')
  }

  if (!ready || !active) {
    return <div className="vortable-stage"><div className="vortable-stage__cover"><div className="spinner" /></div></div>
  }

  const followed = inGame.find((p) => p.id === followId)
  const waitingMaster = effective === 'mestre' && !rules.focus

  return (
    <div className="vortable-player-wrap spectator">
      <EngineStage
        key={active.id}
        deps={[campaign.id, userId, vnet.net, active.id]}
        mount={async (engine, host, isDead) => {
          const worlds = await createWorldStorage(campaign.id, active.id, active.name)
          if (isDead()) return () => {}
          const net = vnet.net
          const game = engine.mountVortable(host, {
            mode: 'watch',
            listen: true,
            // a câmera não tem boneco: este é só o personagem de enfeite exigido pela API
            appearance: engine.defaultAppearance(),
            assetBase: VORTABLE_ASSETS,
            storage: worlds,
            onZone: (z) => setZone({ id: z.id, name: z.name }),
            net: net ? { selfId: `spec:${userId}`, get name() { return net.name }, send: (m) => net.send(m) } : undefined,
          })
          watch.current = game.watch ?? null
          setEpoch((n) => n + 1)
          if (net) {
            net.sink = (m) => game.receive(m)
            net.onOpen = () => game.resync()
            game.resync()
          }
          return () => {
            watch.current = null
            if (net) { net.sink = null; net.onOpen = null }
            game.destroy()
          }
        }}
      />

      <div className="spectator__bar">
        <div className="spectator__row">
          <span className="spectator__tag">👁 Assistindo</span>
          {zone && <span className="spectator__zone">{zone.name}</span>}
          <span className="spectator__spacer" />
          <button type="button" className="btn btn-primary spectator__play" onClick={onPlay}>
            {canPlay ? 'Entrar em jogo' : 'Criar meu boneco'}
          </button>
        </div>

        <div className="spectator__row">
          <div className="spectator__chips" role="tablist" aria-label="Câmera">
            {CAMERAS.filter((c) => c.id !== 'livre' || rules.free).map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={effective === c.id}
                className={`spectator__chip${effective === c.id ? ' spectator__chip--on' : ''}`}
                onClick={() => setCamera(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {effective !== 'livre' && (
          <div className="spectator__row spectator__row--players">
            <button type="button" className="spectator__arrow" onClick={() => step(-1)} aria-label="Jogador anterior" disabled={inGame.length < 2}>‹</button>
            <span className="spectator__following">
              {followed ? followed.name : 'Ninguém em jogo no momento'}
              {waitingMaster && followed && <small> · o mestre ainda não escolheu um foco</small>}
            </span>
            <button type="button" className="spectator__arrow" onClick={() => step(1)} aria-label="Próximo jogador" disabled={inGame.length < 2}>›</button>
          </div>
        )}
        {effective === 'livre' && zones.length > 1 && (
          <div className="spectator__row spectator__row--zones">
            {zones.map((z) => (
              <button
                key={z.id}
                type="button"
                className={`spectator__chip${z.id === zone?.id ? ' spectator__chip--on' : ''}`}
                onClick={() => void watch.current?.setZone(z.id)}
              >
                {z.name}{peers.filter((p) => p.zone === z.id).length > 0 && <span className="spectator__count">{peers.filter((p) => p.zone === z.id).length}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="spectator__react" role="group" aria-label="Reações">
        {EMOJIS.map((e) => (
          <button key={e} type="button" className="spectator__emoji" disabled={cooling} onClick={() => react(e)} aria-label={`Reagir ${e}`}>{e}</button>
        ))}
      </div>

      <SceneOverlay scene={stage.scene} />
    </div>
  )
}
