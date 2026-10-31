import { useState } from 'react'
import { setAltheriumScene, type AltheriumScene } from '../services/altheriumSceneService'
import { useAltheriumScene } from '../utils/useAltheriumScene'
import { ENEMY_STATES, enemyStateDef, type EnemyState } from '../utils/altheriumStealth'
import { LOCATIONS, SCARCITY, locationDef, scarcityDef } from '../utils/altheriumExplore'
import { Chips, Toggle } from './AltheriumPlayKit'
import './AltheriumPlay.css'

// ────────────────────────────────────────────────────────
// Cena da campanha (só o mestre, no topo das fichas): o estado dos inimigos
// e as DTs da Furtividade (o livro deixa as três em aberto), e o Local, a
// Escassez e o clima da Exploração. Os jogadores veem tudo na faixa de estado
// da própria ficha, e as janelas de Furtividade e Explorar já vêm preenchidas.
// ────────────────────────────────────────────────────────

const WEATHER = [
  { id: 'noite',      label: 'Noite ou escuridão',      delta: '−1 dado' },
  { id: 'chuva',      label: 'Chuva, neblina ou neve',  delta: '−1 dado' },
  { id: 'tempestade', label: 'Nevasca ou tempestade',   delta: '−2 dados' },
]

export function AltheriumSceneBar({ campaignId }: { campaignId: string }) {
  const [scene, setScene] = useAltheriumScene(campaignId)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(true)

  async function change(patch: Partial<AltheriumScene>) {
    const previous = scene
    setScene({ ...scene, ...patch })
    setError(null)
    try {
      await setAltheriumScene(campaignId, patch)
    } catch (err) {
      setScene(previous)
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar a cena.')
    }
  }

  function setEnemy(id: EnemyState) {
    // Descer de Alerta marca que já houve Alerta (Esfriar não volta a Desatento).
    void change({ enemy: id, wasAlert: scene.wasAlert || id === 'alerta' })
  }

  function weather(id: string, on: boolean) {
    // O clima é um só: nevasca e chuva se excluem; a noite soma.
    const keep = scene.weather.filter((w) => w !== id && !((id === 'chuva' && w === 'tempestade') || (id === 'tempestade' && w === 'chuva')))
    void change({ weather: on ? [...keep, id] : keep })
  }

  return (
    <section className="alth-scene" aria-label="Cena">
      <button type="button" className="alth-scene__head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="alth-scene__title">Cena da campanha</span>
        <span className="alth-scene__summary">
          {enemyStateDef(scene.enemy).label} · DT {scene.dts[scene.enemy]} — {locationDef(scene.location).label}, {scarcityDef(scene.scarcity).label}
        </span>
        <span className="alth-scene__chevron" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="alth-scene__body">
          <div className="alth-scene__group">
            <span className="alth-win__label">Furtividade: estado dos inimigos</span>
            <Chips
              label="Estado dos inimigos" value={scene.enemy} onChange={setEnemy}
              options={ENEMY_STATES.map((s) => ({ id: s.id, label: s.label, sub: `DT ${scene.dts[s.id]}` }))}
            />
            <span className="alth-win__hint">{enemyStateDef(scene.enemy).meaning}</span>
            <div className="alth-scene__dts">
              {ENEMY_STATES.map((s) => (
                <label key={s.id} className="alth-scene__dt">
                  <span>DT {s.label}</span>
                  <input
                    type="number" className="input" min={1} max={30} value={scene.dts[s.id]}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(30, Math.trunc(Number(e.target.value)) || s.defaultDt))
                      void change({ dts: { ...scene.dts, [s.id]: n } })
                    }}
                  />
                </label>
              ))}
            </div>
            <span className="alth-win__hint">O livro deixa as DTs em aberto: aqui o padrão é 6, 8 e 10.</span>
          </div>

          <div className="alth-scene__group">
            <span className="alth-win__label">Exploração: onde estão</span>
            <Chips
              label="Local" value={scene.location} onChange={(id) => void change({ location: id })}
              options={LOCATIONS.map((l) => ({ id: l.id, label: l.label }))}
            />
            <Chips
              label="Escassez" value={scene.scarcity} onChange={(id) => void change({ scarcity: id })}
              options={SCARCITY.map((s) => ({ id: s.id, label: s.label, sub: `DT ${s.dt}` }))}
            />
            <span className="alth-win__hint">{scarcityDef(scene.scarcity).example}.</span>
            <div className="alth-scene__weather">
              {WEATHER.map((w) => (
                <Toggle key={w.id} on={scene.weather.includes(w.id)} onChange={(on) => weather(w.id, on)} label={w.label} delta={w.delta} tone="bad" />
              ))}
            </div>
          </div>

          {error && <p className="alth-test__note alth-test__note--warn" role="alert">{error}</p>}
        </div>
      )}
    </section>
  )
}
