import { useEffect, useRef, useState } from 'react'
import type { CampaignWithRole } from '../../../shared/types'
import type { LiveSound, WatchControls } from '../../../vendor/vortable/vortable'
import { createWorldStorage, VORTABLE_ASSETS } from '../services/vortableService'
import { useVortableNet } from '../net/VortableNetProvider'
import { useVortableWorlds } from '../worlds/VortableWorldProvider'
import { EngineStage, type Engine } from './EngineStage'
import './LiveControl.css'

type Peer = ReturnType<WatchControls['peers']>[number]
type Npc = ReturnType<WatchControls['npcs']>[number]
type EnvPatch = { hour?: number | null; weather?: string | null; wind?: number | null; sound?: LiveSound | null }

const HOUR_PRESETS: [string, number][] = [['Amanhecer', 6], ['Dia', 12], ['Entardecer', 18.5], ['Noite', 22]]

/**
 * Controle do mestre durante a sessão: vê a cena como os jogadores (câmera livre,
 * qualquer zona, o mapa inteiro) e muda hora, tempo e vento ao vivo pra todos.
 * Diferente do Editar mundo, que é a criação antes da sessão.
 */
export function LiveControl({ campaign, userId }: { campaign: CampaignWithRole; userId: string }) {
  const vnet = useVortableNet()
  // o controle mostra o mundo onde os jogadores estão
  const { active, ready } = useVortableWorlds()
  const watch = useRef<WatchControls | null>(null)
  const engine = useRef<Engine | null>(null)
  const [zones, setZones] = useState<{ id: string; name: string }[]>([])
  const [zoneId, setZoneId] = useState<string | null>(null)
  const [peers, setPeers] = useState<Peer[]>([])
  const [scope, setScope] = useState<'all' | 'zone'>('all')
  const [following, setFollowing] = useState<string | null>(null)
  // NPCs da zona e o que o mestre controla agora
  const [npcs, setNpcs] = useState<Npc[]>([])
  const [controlling, setControlling] = useState<string | null>(null)
  const [, tick] = useState(0)

  // lista de zonas do mundo
  useEffect(() => {
    if (!active) return
    let dead = false
    createWorldStorage(campaign.id, active.id, active.name)
      .then((worlds) => worlds.list())
      .then((list) => { if (!dead) setZones(list.map((z) => ({ id: z.id, name: z.name }))) })
      .catch(() => {})
    return () => { dead = true }
  }, [campaign.id, active?.id, active?.name])

  // quem está na sala e o ajuste atual: confere duas vezes por segundo
  useEffect(() => {
    const timer = window.setInterval(() => {
      const w = watch.current
      if (!w) return
      setPeers(w.peers())
      setNpcs(w.npcs())
      setControlling(w.controllingNpc())
      tick((n) => n + 1)
    }, 500)
    return () => window.clearInterval(timer)
  }, [])

  const key = scope === 'all' ? '*' : zoneId ?? '*'
  // sem ajuste do mestre, vale o que o mundo tem (hora fixa ou ciclo); "automática" = o tempo passa
  const base = { hour: watch.current?.sky().hour ?? null, weather: null, wind: null, sound: null }
  const env = watch.current?.envs().find((e) => e.zone === key) ?? { zone: key, ...base }

  function change(patch: EnvPatch) {
    const w = watch.current
    if (!w) return
    const now = w.envs().find((e) => e.zone === key) ?? base
    w.setEnv({ zone: key, hour: now.hour, weather: now.weather, wind: now.wind, sound: now.sound, ...patch })
    tick((n) => n + 1)
  }

  /** Controlar um NPC como um jogador (clicar de novo, ou em outro, solta). */
  async function control(id: string) {
    const w = watch.current
    if (!w) return
    const now = w.controllingNpc()
    if (now) await w.releaseNpc()
    if (now !== id) await w.controlNpc(id)
    setFollowing(null)
    setControlling(w.controllingNpc())
  }

  function goTo(id: string) {
    setFollowing(null)
    void watch.current?.setZone(id)
  }

  function follow(peer: Peer) {
    const w = watch.current
    if (!w) return
    if (following === peer.id) { w.follow(null); setFollowing(null); return }
    if (peer.zone && peer.zone !== zoneId) void w.setZone(peer.zone)
    w.follow(peer.id)
    setFollowing(peer.id)
  }

  const here = peers.filter((p) => p.zone === zoneId)
  const elsewhere = peers.filter((p) => p.zone !== zoneId)
  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name ?? 'outra zona'

  if (!ready || !active) {
    return <div className="vortable-stage"><div className="vortable-stage__cover"><div className="spinner" /></div></div>
  }

  return (
    <div className="live">
      <div className="live__view">
        <EngineStage
          key={active.id}
          deps={[campaign.id, userId, vnet.net, active.id]}
          mount={async (eng, host) => {
            engine.current = eng
            const worlds = await createWorldStorage(campaign.id, active.id, active.name)
            const net = vnet.net
            const game = eng.mountVortable(host, {
              mode: 'watch',
              // a câmera não tem boneco: este é só um personagem de enfeite exigido pela API
              appearance: eng.defaultAppearance(),
              assetBase: VORTABLE_ASSETS,
              storage: worlds,
              onZone: (z) => setZoneId(z.id),
              net: net ? { selfId: `watch:${userId}`, name: 'Mestre', send: (m) => net.send(m) } : undefined,
            })
            watch.current = game.watch ?? null
            if (net) {
              net.sink = (m) => game.receive(m)
              net.onOpen = null
              // ao voltar pra esta aba, o que o mestre já ajustou continua valendo e aparecendo
              for (const env of net.envList()) game.receive(env)
            }
            return () => {
              watch.current = null
              if (net) net.sink = null
              game.destroy()
            }
          }}
        />
      </div>

      <aside className="live__panel">
        <section className="live__block">
          <h4>Zonas</h4>
          <div className="live__chips">
            {zones.map((z) => {
              const count = peers.filter((p) => p.zone === z.id).length
              return (
                <button key={z.id} type="button" className={`live__chip${z.id === zoneId ? ' live__chip--on' : ''}`} onClick={() => goTo(z.id)}>
                  {z.name}{count > 0 && <span className="live__count">{count}</span>}
                </button>
              )
            })}
          </div>
          <div className="live__row">
            <button type="button" className="btn btn-ghost" onClick={() => { watch.current?.fit(); setFollowing(null) }}>Mapa inteiro</button>
            <button type="button" className="btn btn-ghost" onClick={() => watch.current?.zoomBy(1 / 1.3)} aria-label="Menos zoom">−</button>
            <button type="button" className="btn btn-ghost" onClick={() => watch.current?.zoomBy(1.3)} aria-label="Mais zoom">+</button>
          </div>
        </section>

        <section className="live__block">
          <h4>Jogadores</h4>
          {peers.length === 0 && <p className="live__empty">Ninguém conectado.</p>}
          <ul className="live__players">
            {[...here, ...elsewhere].map((p) => (
              <li key={p.id}>
                <button type="button" className={`live__player${following === p.id ? ' live__player--on' : ''}`} onClick={() => follow(p)}>
                  <span>{p.name}</span>
                  <small>{p.zone === zoneId ? 'aqui' : zoneName(p.zone)}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="live__block">
          <h4>NPCs desta zona</h4>
          {npcs.length === 0 && <p className="live__empty">Nenhum NPC aqui.</p>}
          <ul className="live__players">
            {npcs.map((n) => (
              <li key={n.id}>
                <button type="button" className={`live__player${controlling === n.id ? ' live__player--on' : ''}`} onClick={() => void control(n.id)}>
                  <span>{n.name}</span>
                  <small>{controlling === n.id ? 'controlando' : n.role || 'controlar'}</small>
                </button>
              </li>
            ))}
          </ul>
          {controlling && <p className="live__empty">Setas ou WASD andam, Shift corre. Clique de novo pra soltar.</p>}
        </section>

        <section className="live__block">
          <h4>Vale para</h4>
          <div className="live__seg">
            <button type="button" className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>Todas as zonas</button>
            <button type="button" className={scope === 'zone' ? 'on' : ''} onClick={() => setScope('zone')} disabled={!zoneId}>Só esta zona</button>
          </div>
        </section>

        <section className="live__block">
          <h4>Hora {env.hour == null ? '· automática (o tempo passa)' : `· ${formatHour(env.hour)}`}</h4>
          <input
            className="live__range"
            type="range" min={0} max={24} step={0.25}
            value={env.hour ?? 12}
            onChange={(e) => change({ hour: Number(e.target.value) })}
            aria-label="Hora do dia"
          />
          <div className="live__chips">
            <button type="button" className={`live__chip${env.hour == null ? ' live__chip--on' : ''}`} onClick={() => change({ hour: null })}>Auto</button>
            {HOUR_PRESETS.map(([label, h]) => (
              <button key={label} type="button" className={`live__chip${env.hour === h ? ' live__chip--on' : ''}`} onClick={() => change({ hour: h })}>{label}</button>
            ))}
          </div>
        </section>

        <section className="live__block">
          <h4>Tempo</h4>
          <WeatherPicker engine={engine.current} value={env.weather} onPick={(w) => change({ weather: w })} />
        </section>

        <section className="live__block">
          <h4>Vento</h4>
          <WindPicker engine={engine.current} value={env.wind} onPick={(w) => change({ wind: w })} />
        </section>

        <section className="live__block">
          <h4>Sons {env.sound ? '· do mestre' : '· da zona'}</h4>
          <SoundPicker engine={engine.current} value={env.sound} onPick={(sound) => change({ sound })} />
        </section>
      </aside>
    </div>
  )
}

function formatHour(hour: number) {
  const h = Math.floor(hour), m = Math.round((hour - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function WeatherPicker({ engine, value, onPick }: { engine: Engine | null; value: string | null; onPick: (w: string | null) => void }) {
  if (!engine) return null
  return (
    <div className="live__chips">
      <button type="button" className={`live__chip${value == null ? ' live__chip--on' : ''}`} onClick={() => onPick(null)}>Padrão</button>
      {engine.WEATHER_ORDER.map((id) => (
        <button key={id} type="button" className={`live__chip${value === id ? ' live__chip--on' : ''}`} onClick={() => onPick(id)}>
          {engine.WEATHERS[id].label}
        </button>
      ))}
    </div>
  )
}

function WindPicker({ engine, value, onPick }: { engine: Engine | null; value: number | null; onPick: (w: number | null) => void }) {
  if (!engine) return null
  return (
    <div className="live__chips">
      <button type="button" className={`live__chip${value == null ? ' live__chip--on' : ''}`} onClick={() => onPick(null)}>Padrão</button>
      {engine.WIND_LEVELS.map(([level, label]) => (
        <button key={label} type="button" className={`live__chip${value === level ? ' live__chip--on' : ''}`} onClick={() => onPick(level)}>{label}</button>
      ))}
    </div>
  )
}

/**
 * Sons ao vivo pra todos: "Da zona" deixa o som que está salvo em cada zona; senão o mestre liga o
 * automático (as camadas seguem o mundo) e/ou camadas à mão, cada uma com seu volume.
 */
function SoundPicker({ engine, value, onPick }: { engine: Engine | null; value: LiveSound | null; onPick: (s: LiveSound | null) => void }) {
  const [picked, setPicked] = useState<string | null>(null)
  if (!engine) return null
  const cur: LiveSound = value ?? { auto: true, layers: {} }
  const set = (patch: Partial<LiveSound>) => onPick({ ...cur, ...patch })
  const toggle = (id: string) => {
    const layers = { ...cur.layers }
    if (layers[id]) { delete layers[id]; if (picked === id) setPicked(null) }
    else { layers[id] = 0.7; setPicked(id) }
    set({ layers })
  }
  const pick = picked && cur.layers[picked] ? picked : null
  return (
    <>
      <div className="live__chips">
        <button type="button" className={`live__chip${value == null ? ' live__chip--on' : ''}`} onClick={() => onPick(null)}>Da zona</button>
        <button type="button" className={`live__chip${value && cur.auto ? ' live__chip--on' : ''}`} onClick={() => set({ auto: !cur.auto })} title="As camadas seguem o tempo, a hora e o que há perto">Automático</button>
      </div>
      <div className="live__chips">
        {engine.SOUND_LAYERS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={`live__chip${cur.layers[l.id] ? ' live__chip--on' : ''}`}
            onClick={() => (cur.layers[l.id] && picked !== l.id ? setPicked(l.id) : toggle(l.id))}
            title={cur.layers[l.id] ? 'Clique de novo pra desligar' : 'Ligar'}
          >
            {l.label}
          </button>
        ))}
      </div>
      {pick && (
        <input
          className="live__range"
          type="range" min={5} max={100} step={5}
          value={Math.round((cur.layers[pick] ?? 0.7) * 100)}
          onChange={(e) => set({ layers: { ...cur.layers, [pick]: Number(e.target.value) / 100 } })}
          aria-label={`Volume: ${engine.SOUND_LAYERS.find((l) => l.id === pick)?.label ?? ''}`}
        />
      )}
    </>
  )
}
