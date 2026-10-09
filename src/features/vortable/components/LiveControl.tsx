import { useEffect, useRef, useState } from 'react'
import type { CampaignWithRole } from '../../../shared/types'
import type { LiveSound, WatchControls } from '../../../vendor/vortable/vortable'
import { createWorldStorage, VORTABLE_ASSETS } from '../services/vortableService'
import { useVortableNet } from '../net/VortableNetProvider'
import { useVortableWorlds } from '../worlds/VortableWorldProvider'
import { EngineStage, type Engine } from './EngineStage'
import { SoundPanel } from './SoundPanel'
import './LiveControl.css'

type Peer = ReturnType<WatchControls['peers']>[number]
type Npc = ReturnType<WatchControls['npcs']>[number]
type Pane = 'zonas' | 'jogadores' | 'npcs' | 'hora' | 'tempo' | 'vento' | 'sons'
const OPEN_TITLE: Record<Pane, string> = { zonas: 'Zonas e câmera', jogadores: 'Jogadores', npcs: 'NPCs desta zona', hora: 'Hora', tempo: 'Tempo', vento: 'Vento', sons: 'Sons' }
type EnvPatch = { hour?: number | null; weather?: string | null; wind?: number | null; sound?: LiveSound | null; dayMinutes?: number | null; timeShift?: number | null }

/**
 * Controle do mestre durante a sessão: vê a cena como os jogadores (câmera livre,
 * qualquer zona, o mapa inteiro) e muda hora, tempo e vento ao vivo pra todos.
 * Diferente do Editar mundo, que é a criação antes da sessão.
 */
export function LiveControl({ campaign, userId, onOpen }: { campaign: CampaignWithRole; userId: string; onOpen: (screen: 'personagens' | 'jogadores') => void }) {
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
  const [npcForm, setNpcForm] = useState<'rat' | null>(null)
  // calibrando a hora com a barrinha (enquanto arrasta, ela mostra o valor escolhido; senão, o relógio da cena)
  const [calib, setCalib] = useState<number | null>(null)
  const [, tick] = useState(0)
  // menu flutuante: qual painel está aberto (um por vez)
  const [open, setOpen] = useState<Pane | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // clicar fora (na cena, por exemplo) ou Esc fecha o painel
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setOpen(null) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

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
      setNpcForm(w.npcForm())
      tick((n) => n + 1)
    }, 500)
    return () => window.clearInterval(timer)
  }, [])

  const key = scope === 'all' ? '*' : zoneId ?? '*'
  // sem ajuste do mestre, vale o que o mundo tem (hora fixa ou ciclo); "automática" = o tempo passa
  const base = { hour: watch.current?.sky().hour ?? null, weather: null, wind: null, sound: null, dayMinutes: null, timeShift: null }
  const clock = watch.current?.clock() ?? 12
  const dayMinutes = watch.current ? (watch.current.envs().find((e) => e.zone === key)?.dayMinutes ?? watch.current.sky().dayMinutes) : 24
  const env = watch.current?.envs().find((e) => e.zone === key) ?? { zone: key, ...base }

  function change(patch: EnvPatch) {
    const w = watch.current
    if (!w) return
    const now = w.envs().find((e) => e.zone === key) ?? base
    w.setEnv({ zone: key, hour: now.hour, weather: now.weather, wind: now.wind, sound: now.sound, dayMinutes: now.dayMinutes, timeShift: now.timeShift, ...patch })
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

  const icon = (name: string) => (engine.current ? (engine.current.EDITOR_ICONS as Record<string, string>)[name] ?? '' : '')

  /** Botão redondo-quadrado do menu: abre/fecha um painel. */
  const tool = (id: Pane, iconName: string, label: string, opts: { badge?: number; dot?: boolean } = {}) => (
    <button
      key={id}
      type="button"
      className={`live-tool${open === id ? ' live-tool--open' : ''}`}
      onClick={() => setOpen(open === id ? null : id)}
      title={label}
      aria-label={label}
      aria-expanded={open === id}
    >
      <span className="live-tool__icon" dangerouslySetInnerHTML={{ __html: icon(iconName) }} />
      <svg className="live-tool__chev" width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2 3.5 3 3 3-3" /></svg>
      {opts.badge != null && <span className="live-tool__badge">{opts.badge}</span>}
      {opts.dot && <span className="live-tool__dot" aria-hidden="true" />}
    </button>
  )

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
              // o mestre ouve o som da zona que está vendo (o painel Sons liga, desliga e ajusta)
              listen: true,
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

      <div className="live__menu" ref={menuRef}>
        <div className="live__bar" role="toolbar" aria-label="Controle ao vivo">
          {tool('zonas', 'world', 'Zonas e câmera')}
          {tool('jogadores', 'person', 'Jogadores', { badge: peers.length || undefined })}
          {tool('npcs', 'npc', 'NPCs desta zona', { dot: controlling != null })}
          <span className="live__bar-sep" aria-hidden="true" />
          <button
            type="button"
            className="live-tool live-tool--wide"
            onClick={() => (scope === 'all' ? zoneId && setScope('zone') : setScope('all'))}
            title="O que você muda aqui (hora, tempo, vento, sons) vale pra todas as zonas ou só pra esta"
          >
            <span className="live-tool__text">{scope === 'all' ? 'Todas as zonas' : 'Só esta zona'}</span>
          </button>
          <span className="live__bar-sep" aria-hidden="true" />
          {tool('hora', 'clock', 'Hora')}
          {tool('tempo', 'cloud', 'Tempo')}
          {tool('vento', 'wind', 'Vento')}
          {tool('sons', 'sound', 'Sons')}
        </div>

        {open && (
          <div className="live__pop" role="dialog" aria-label={OPEN_TITLE[open]}>
            {open === 'zonas' && (
              <>
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
              </>
            )}
            {open === 'jogadores' && (
              <>
              <section className="live__block">
                <div className="live__grouphead">
                  <h4>Jogadores</h4>
                  <span className="live__row">
                    <button type="button" className="btn btn-ghost" onClick={() => onOpen('jogadores')} title="Quem joga com qual boneco, espectadores, levar a uma zona">Gerenciar</button>
                    <button type="button" className="btn btn-ghost" onClick={() => onOpen('personagens')} title="Criar e editar personagens">Personagens</button>
                  </span>
                </div>
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
              </>
            )}
            {open === 'npcs' && (
              <>
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
                {controlling && (
                  <>
                    <button
                      type="button" className={`live__chip${npcForm === 'rat' ? ' live__chip--on' : ''}`}
                      title="O NPC vira um ratinho azul, bem pequeno; ao soltar, volta ao normal"
                      onClick={() => { const w = watch.current; if (w) void w.transformNpc(npcForm === 'rat' ? null : 'rat').then(() => setNpcForm(w.npcForm())) }}
                    >
                      {npcForm === 'rat' ? 'Voltar ao normal' : 'Transformar em rato'}
                    </button>
                    <p className="live__empty">Setas ou WASD andam, Shift corre. Clique de novo no NPC pra soltar.</p>
                  </>
                )}
              </section>
              </>
            )}
            {open === 'hora' && (
              <>
              <section className="live__block">
                <h4>Hora ({scope === 'all' ? 'todas as zonas' : 'só esta zona'})</h4>
                {engine.current && (
                  <>
                    <div className="live__climates">
                      {engine.current.SKY_PRESETS.map((p) => (
                        <button key={p.id} type="button" className={`live__climate${env.hour === p.hour ? ' live__climate--on' : ''}`} onClick={() => change({ hour: p.hour })}>
                          <span className="live__climate-sw" style={{ background: engine.current!.skySwatch(p.hour) }} />
                          <span>{p.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="live__segmented">
                      <button
                        type="button" className={`live__seg${env.hour == null ? ' live__seg--on' : ''}`} title="A hora corre sozinha, igual em todas as zonas"
                        onClick={() => env.hour != null && change({ hour: null })}
                      >Ciclo dia/noite</button>
                      <button
                        type="button" className={`live__seg${env.hour != null ? ' live__seg--on' : ''}`} title="As zonas ficam sempre na mesma hora"
                        onClick={() => env.hour == null && change({ hour: Math.round(engine.current!.worldHour(dayMinutes) * 4) / 4 })}
                      >Hora fixa</button>
                    </div>
                    {env.hour == null ? (
                      <>
                        <div className="live__field">
                          <label htmlFor="live-day-length">Um dia dura</label>
                          <select
                            id="live-day-length" className="live__select" value={dayMinutes}
                            onChange={(e) => {
                              const m = Number(e.target.value)
                              // trocar a duração não pula a hora: o ciclo continua de onde estava
                              change({ dayMinutes: m === (watch.current?.sky().dayMinutes ?? 24) ? null : m, timeShift: engine.current!.shiftForHour(clock, m) })
                            }}
                          >
                            {engine.current.DAY_LENGTHS.map((m) => <option key={m} value={m}>{m} min</option>)}
                          </select>
                        </div>
                        <label className="live__sublabel" htmlFor="live-calibrate">Acertar a hora agora (o tempo segue passando)</label>
                        <div className="live__hourrow">
                          <input
                            id="live-calibrate" className="live__range" type="range" min={0} max={23.9} step={0.1}
                            value={calib ?? clock}
                            onChange={(e) => { const hr = Number(e.target.value); setCalib(hr); change({ timeShift: engine.current!.shiftForHour(hr, dayMinutes) }) }}
                            onPointerUp={() => setCalib(null)} onPointerCancel={() => setCalib(null)} onBlur={() => setCalib(null)} onKeyUp={() => setCalib(null)}
                            aria-label="Acertar a hora do ciclo"
                          />
                          <b className="live__hourout">
                            <span dangerouslySetInnerHTML={{ __html: (engine.current.EDITOR_ICONS as Record<string, string>)[engine.current.daylight(calib ?? clock) > 0.5 ? 'sun' : 'moon'] }} />
                            <span>{engine.current.formatHour(calib ?? clock)}</span>
                          </b>
                        </div>
                      </>
                    ) : (
                      <div className="live__hourrow">
                        <input
                          className="live__range"
                          type="range" min={0} max={23.9} step={0.1}
                          value={env.hour}
                          onChange={(e) => change({ hour: Number(e.target.value) })}
                          aria-label="Hora do dia"
                        />
                        <b className="live__hourout">
                          <span dangerouslySetInnerHTML={{ __html: (engine.current.EDITOR_ICONS as Record<string, string>)[engine.current.daylight(env.hour) > 0.5 ? 'sun' : 'moon'] }} />
                          <span>{engine.current.formatHour(env.hour)}</span>
                        </b>
                      </div>
                    )}
                  </>
                )}
              </section>
              </>
            )}
            {open === 'tempo' && (
              <>
              <section className="live__block">
                <h4>Tempo</h4>
                <WeatherPicker engine={engine.current} value={env.weather} onPick={(w) => change({ weather: w })} />
              </section>
              </>
            )}
            {open === 'vento' && (
              <>
              <section className="live__block">
                <h4>Vento</h4>
                <WindPicker engine={engine.current} value={env.wind} onPick={(w) => change({ wind: w })} />
              </section>
              </>
            )}
            {open === 'sons' && (
              <SoundPanel engine={engine.current} watch={watch.current} value={env.sound} onPick={(sound) => change({ sound })} />
            )}
          </div>
        )}
      </div>
    </div>
  )
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
