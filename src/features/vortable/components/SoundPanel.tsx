import { useEffect, useState } from 'react'
import type { LiveSound, WatchControls } from '../../../vendor/vortable/vortable'
import type { Engine } from './EngineStage'

/**
 * Sons do Controle do mestre, no mesmo jeito do painel Sons do editor: ouvir (interruptor, volume,
 * mudo), as camadas em cartões com a barrinha de nível (clique liga; o escolhido mostra o volume),
 * automático e passos. Aqui o ajuste vale ao vivo pra todos os jogadores; "Voltar ao som da zona"
 * devolve o som que está salvo em cada zona.
 */
export function SoundPanel({ engine, watch, value, onPick }: {
  engine: Engine | null
  watch: WatchControls | null
  value: LiveSound | null
  onPick: (s: LiveSound | null) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const [levels, setLevels] = useState<Record<string, number>>({})
  const [, tick] = useState(0)

  // barrinhas de nível: 4× por segundo
  useEffect(() => {
    const timer = window.setInterval(() => setLevels(watch?.audio.levels() ?? {}), 250)
    return () => window.clearInterval(timer)
  }, [watch])

  if (!engine || !watch) return null
  const icons = engine.EDITOR_ICONS as Record<string, string>
  const audio = watch.audio
  const prefs = audio.prefs()
  const listening = audio.listening()
  const cur: LiveSound = value ?? { auto: true, layers: {} }
  const set = (patch: Partial<LiveSound>) => onPick({ ...cur, ...patch })
  const pick = picked && engine.SOUND_LAYERS.some((l) => l.id === picked) ? picked : null
  const changePrefs = (patch: { master?: number; muted?: boolean; steps?: number }) => { audio.setPrefs(patch); tick((n) => n + 1) }

  function clickLayer(id: string) {
    const on = (cur.layers[id] ?? 0) > 0
    setPicked(id)
    // clique no escolhido liga/desliga; em outro, só escolhe (e liga se estava desligado)
    if (pick === id || !on) {
      const layers = { ...cur.layers }
      if (on) delete layers[id]
      else layers[id] = 0.7
      set({ layers })
    }
  }

  const layer = pick ? engine.SOUND_LAYERS.find((l) => l.id === pick)! : null
  const volume = pick ? cur.layers[pick] ?? 0 : 0

  return (
    <>
      <section className="live__block">
        <h4>Sons {value ? '· do mestre' : '· da zona'}</h4>
        <div className="live__soundbar">
          <label className="live__switchrow" title="Ouvir o som da zona que você está vendo">
            <input type="checkbox" className="live__switch" checked={listening} onChange={(e) => { audio.listen(e.target.checked); tick((n) => n + 1) }} />
            <span>Ouvir</span>
          </label>
          <input
            className="live__range" type="range" min={0} max={100} step={5} value={Math.round(prefs.master * 100)}
            onChange={(e) => changePrefs({ master: Number(e.target.value) / 100 })} aria-label="Volume geral"
          />
          <button
            type="button" className={`live__iconbtn${prefs.muted ? ' live__iconbtn--on' : ''}`} title={prefs.muted ? 'Ligar o som' : 'Mudo'}
            onClick={() => changePrefs({ muted: !prefs.muted })}
            dangerouslySetInnerHTML={{ __html: prefs.muted ? icons.mute : icons.sound }}
          />
        </div>
      </section>

      <section className="live__block">
        <div className="live__grouphead">
          <h4>Ambiente</h4>
          <label className="live__switchrow" title="Segue o tempo, a hora e o que há perto">
            <span>Automático</span>
            <input type="checkbox" className="live__switch" checked={cur.auto} onChange={(e) => set({ auto: e.target.checked })} />
          </label>
        </div>
        <div className="live__tiles">
          {engine.SOUND_LAYERS.map((l) => {
            const on = (cur.layers[l.id] ?? 0) > 0
            return (
              <button
                key={l.id} type="button" title={l.label}
                className={`live__tile${on ? ' live__tile--on' : ''}${pick === l.id ? ' live__tile--picked' : ''}`}
                onClick={() => clickLayer(l.id)}
              >
                <span className="live__tile-icon" dangerouslySetInnerHTML={{ __html: icons[l.icon] ?? icons.sound }} />
                <span>{l.label}</span>
                <span className="live__tile-meter" style={{ width: `${Math.round(Math.min(1, levels[l.id] ?? 0) * 100)}%` }} />
              </button>
            )
          })}
        </div>
        {layer ? (
          <div className="live__soundpick">
            <span className="live__tile-icon" dangerouslySetInnerHTML={{ __html: icons[layer.icon] ?? icons.sound }} />
            <label>{layer.label}</label>
            <input
              className="live__range" type="range" min={0} max={100} step={5} value={Math.round(volume * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100
                const layers = { ...cur.layers }
                if (v) layers[layer.id] = v
                else delete layers[layer.id]
                set({ layers })
              }}
              aria-label={`Volume: ${layer.label}`}
            />
            <b>{volume ? `${Math.round(volume * 100)}%` : 'auto'}</b>
            {layer.id === 'thunder' && <button type="button" className="live__iconbtn" title="Ouvir um trovão" onClick={() => audio.thunderNow()} dangerouslySetInnerHTML={{ __html: icons.play }} />}
          </div>
        ) : (
          <small className="live__note">Clique numa camada pra ligar e ajustar.</small>
        )}
        {value && <button type="button" className="live__chip" onClick={() => onPick(null)}>Voltar ao som da zona</button>}
      </section>

      <section className="live__block">
        <div className="live__grouphead">
          <h4>Passos</h4>
          <input
            className="live__range live__range--short" type="range" min={0} max={100} step={5} value={Math.round(prefs.steps * 100)}
            onChange={(e) => changePrefs({ steps: Number(e.target.value) / 100 })} aria-label="Volume dos passos"
          />
        </div>
        <div className="live__chips">
          {Object.entries(engine.SURFACE_LABELS).map(([id, label]) => (
            <button key={id} type="button" className="live__chip" title="Ouvir" onClick={() => audio.previewStep(id)}>{label}</button>
          ))}
        </div>
      </section>
    </>
  )
}
