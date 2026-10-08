import { useEffect, useRef, useState } from 'react'
import type { CampaignWithRole } from '../../../shared/types'
import type { WatchControls } from '../../../vendor/vortable/vortable'
import { createWorldStorage, VORTABLE_ASSETS } from '../services/vortableService'
import { useVortableNet } from '../net/VortableNetProvider'
import { useVortableWorlds } from '../worlds/VortableWorldProvider'
import { EngineStage, type Engine } from './EngineStage'
import './LiveControl.css'

type Peer = ReturnType<WatchControls['peers']>[number]
type EnvPatch = { hour?: number | null; weather?: string | null; wind?: number | null }

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
      tick((n) => n + 1)
    }, 500)
    return () => window.clearInterval(timer)
  }, [])

  const key = scope === 'all' ? '*' : zoneId ?? '*'
  const env = watch.current?.envs().find((e) => e.zone === key) ?? { zone: key, hour: null, weather: null, wind: null }

  function change(patch: EnvPatch) {
    const w = watch.current
    if (!w) return
    const now = w.envs().find((e) => e.zone === key) ?? { hour: null, weather: null, wind: null }
    w.setEnv({ zone: key, hour: now.hour, weather: now.weather, wind: now.wind, ...patch })
    tick((n) => n + 1)
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
          <h4>Vale para</h4>
          <div className="live__seg">
            <button type="button" className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>Todas as zonas</button>
            <button type="button" className={scope === 'zone' ? 'on' : ''} onClick={() => setScope('zone')} disabled={!zoneId}>Só esta zona</button>
          </div>
        </section>

        <section className="live__block">
          <h4>Hora {env.hour == null ? '· automática' : `· ${formatHour(env.hour)}`}</h4>
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
