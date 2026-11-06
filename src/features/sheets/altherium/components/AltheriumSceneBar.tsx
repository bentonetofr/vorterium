import { useState, type ReactNode } from 'react'
import { setAltheriumScene, type AltheriumScene } from '../services/altheriumSceneService'
import { useAltheriumScene } from '../utils/useAltheriumScene'
import { ENEMY_STATES, enemyStateDef, type EnemyState } from '../utils/altheriumStealth'
import { LOCATIONS, SCARCITY, locationDef, scarcityDef } from '../utils/altheriumExplore'
import './AltheriumPlay.css'

// ────────────────────────────────────────────────────────
// Cena da campanha (só o mestre, no topo das fichas): o estado dos inimigos
// e as DTs da Furtividade (o livro deixa as três em aberto), e o Local, a
// Escassez e o clima da Exploração. Os jogadores veem tudo na faixa de estado
// da própria ficha, e as janelas de Furtividade e Explorar já vêm preenchidas.
// O estado e a escassez são escalas (mostram a ordem, de calmo a alerta, de
// farto a devastado); o local tem ícones; o clima são chips que se acendem.
// ────────────────────────────────────────────────────────

const DT_MIN = 1
const DT_MAX = 30

const WEATHER = [
  { id: 'noite',      label: 'Noite',         full: 'Noite ou escuridão',     delta: -1, icon: 'moon' },
  { id: 'chuva',      label: 'Chuva ou neve', full: 'Chuva, neblina ou neve', delta: -1, icon: 'rain' },
  { id: 'tempestade', label: 'Nevasca',       full: 'Nevasca ou tempestade',  delta: -2, icon: 'storm' },
] as const

/** A cor de cada degrau das escalas: do calmo ao grave. */
const ENEMY_TONE: Record<string, string> = { desatento: 'var(--alth-resource, #54ff9f)', atento: 'var(--accent-bright)', alerta: 'var(--danger-bright)' }
const SCARCITY_TONE: Record<string, string> = { abundante: 'var(--alth-resource, #54ff9f)', normal: 'var(--alth-mystic, #5eead4)', escasso: 'var(--accent-bright)', devastado: 'var(--danger-bright)' }

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

  const enemy = enemyStateDef(scene.enemy)
  const scarcity = scarcityDef(scene.scarcity)
  const dtsChanged = ENEMY_STATES.some((s) => scene.dts[s.id] !== s.defaultDt)
  const weatherSum = WEATHER.filter((w) => scene.weather.includes(w.id)).reduce((sum, w) => sum + w.delta, 0)

  return (
    <section className="alth-scene" aria-label="Cena">
      <button type="button" className="alth-scene__head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="alth-scene__title">Cena da campanha</span>
        <span className="alth-scene__summary">
          {enemy.label} · DT {scene.dts[scene.enemy]} — {locationDef(scene.location).label}, {scarcity.label}
        </span>
        <span className="alth-scene__chevron" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="alth-scene__body">
          <div className="alth-scene__scales">
            <div className="alth-scene__group">
              <div className="alth-scene__line">
                <span className="alth-win__label">Furtividade: estado dos inimigos</span>
                <span className="alth-scene__now" style={{ color: ENEMY_TONE[scene.enemy] }}>{enemy.label} · DT {scene.dts[scene.enemy]}</span>
              </div>
              <Scale
                label="Estado dos inimigos" value={scene.enemy} onChange={setEnemy}
                steps={ENEMY_STATES.map((s) => ({ id: s.id, label: s.label, sub: `DT ${scene.dts[s.id]}`, tone: ENEMY_TONE[s.id] }))}
              />
              <span className="alth-win__hint">{enemy.meaning}</span>
              <details className="alth-scene__dts">
                <summary>Ajustar as DTs</summary>
                <div className="alth-scene__dtlist">
                  {ENEMY_STATES.map((s) => {
                    const dt = scene.dts[s.id]
                    const set = (n: number) => void change({ dts: { ...scene.dts, [s.id]: Math.max(DT_MIN, Math.min(DT_MAX, n)) } })
                    return (
                      <div key={s.id} className="alth-scene__dtitem">
                        <span className="alth-scene__dtname"><i style={{ background: ENEMY_TONE[s.id] }} aria-hidden="true" />{s.label}</span>
                        <span className="alth-stepper" role="group" aria-label={`DT ${s.label}`}>
                          <button type="button" onClick={() => set(dt - 1)} disabled={dt <= DT_MIN} aria-label={`Diminuir a DT ${s.label}`}>−</button>
                          <output style={{ color: ENEMY_TONE[s.id] }}>{dt}</output>
                          <button type="button" onClick={() => set(dt + 1)} disabled={dt >= DT_MAX} aria-label={`Aumentar a DT ${s.label}`}>+</button>
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="alth-scene__dtfoot">
                  <span className="alth-win__hint">O livro deixa as DTs em aberto: o padrão aqui é {ENEMY_STATES.map((s) => s.defaultDt).join(', ')}.</span>
                  <button type="button" className="alth-scene__reset" disabled={!dtsChanged}
                    onClick={() => void change({ dts: Object.fromEntries(ENEMY_STATES.map((s) => [s.id, s.defaultDt])) as unknown as AltheriumScene['dts'] })}>
                    Restaurar
                  </button>
                </div>
              </details>
            </div>

            <div className="alth-scene__group">
              <div className="alth-scene__line">
                <span className="alth-win__label">Exploração: escassez</span>
                <span className="alth-scene__now" style={{ color: SCARCITY_TONE[scene.scarcity] }}>{scarcity.label} · DT {scarcity.dt}</span>
              </div>
              <Scale
                label="Escassez" value={scene.scarcity} onChange={(id) => void change({ scarcity: id })}
                steps={SCARCITY.map((s) => ({ id: s.id, label: s.label, sub: `DT ${s.dt}`, tone: SCARCITY_TONE[s.id] }))}
              />
              <span className="alth-win__hint">{scarcity.example}.</span>
            </div>
          </div>

          <div className="alth-scene__group">
            <span className="alth-win__label">Exploração: onde estão</span>
            <div className="alth-scene__tiles" role="radiogroup" aria-label="Local">
              {LOCATIONS.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={scene.location === l.id} title={l.hint}
                  className={`alth-scene__tile${scene.location === l.id ? ' is-on' : ''}`} onClick={() => void change({ location: l.id })}>
                  <SceneIcon name={l.id} />
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="alth-scene__line alth-scene__line--chips">
            <span className="alth-win__label">Clima</span>
            <div className="alth-scene__chips">
              {WEATHER.map((w) => {
                const on = scene.weather.includes(w.id)
                return (
                  <button key={w.id} type="button" aria-pressed={on} title={`${w.full}: ${w.delta === -1 ? '−1 dado' : '−2 dados'}`}
                    className={`alth-scene__chip${on ? ' is-on' : ''}`} onClick={() => weather(w.id, !on)}>
                    <SceneIcon name={w.icon} />
                    {w.label}
                    <b>{w.delta}</b>
                  </button>
                )
              })}
            </div>
            <span className="alth-scene__sum">{weatherSum === 0 ? 'Sem ajuste de dados' : <>Soma <strong>{weatherSum} {Math.abs(weatherSum) === 1 ? 'dado' : 'dados'}</strong></>}</span>
          </div>

          {error && <p className="alth-test__note alth-test__note--warn" role="alert">{error}</p>}
        </div>
      )}
    </section>
  )
}

// ── Escala: uma barra com um ponto por degrau; clicar no degrau (ponto ou nome) escolhe ──

interface Step<T extends string> { id: T; label: string; sub?: string; tone: string }

function Scale<T extends string>({ label, value, onChange, steps }: { label: string; value: T; onChange: (id: T) => void; steps: Step<T>[] }) {
  const index = Math.max(0, steps.findIndex((s) => s.id === value))
  const n = steps.length
  return (
    <div className="alth-scale" role="radiogroup" aria-label={label}
      style={{ ['--n' as string]: n, ['--i' as string]: index, ['--tone' as string]: steps[index]?.tone }}>
      <span className="alth-scale__bar" aria-hidden="true"><span className="alth-scale__fill" /></span>
      {steps.map((s, i) => (
        <button key={s.id} type="button" role="radio" aria-checked={i === index}
          className={`alth-scale__step${i === index ? ' is-on' : ''}${i < index ? ' is-passed' : ''}`} onClick={() => onChange(s.id)}>
          <span className="alth-scale__dot" />
          <span className="alth-scale__name">{s.label}</span>
          {s.sub && <small>{s.sub}</small>}
        </button>
      ))}
    </div>
  )
}

// ── Ícones de traço fino dos locais e do clima ──

const PATHS: Record<string, ReactNode> = {
  floresta:   <><path d="M12 3 7 10h3l-4 6h12l-4-6h3z" /><path d="M12 16v5" /></>,
  litoral:    <><path d="M3 8c3 0 3-2 6-2s3 2 6 2 3-2 6-2" /><path d="M3 13c3 0 3-2 6-2s3 2 6 2 3-2 6-2" /><path d="M3 18c3 0 3-2 6-2s3 2 6 2 3-2 6-2" /></>,
  montanha:   <path d="M3 20 9 9l4 6 3-4 5 9z" />,
  tundra:     <><path d="M12 3v18" /><path d="m4.2 7.5 15.6 9" /><path d="m19.8 7.5-15.6 9" /><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2" /></>,
  vilarejo:   <><path d="M4 11 12 4l8 7v9H4z" /><path d="M10 20v-5h4v5" /></>,
  ruinas:     <><path d="M5 20h14" /><path d="M7 20V9M12 20V9M17 20V9" /><path d="M4 9h16l-8-5z" /></>,
  fenda:      <path d="M13 2 5 13h6l-1 9 8-12h-6z" />,
  moon:       <path d="M20 14a8 8 0 1 1-9.500-9.500A6.500 6.500 0 0 0 20 14z" />,
  rain:       <><path d="M7 15a4 4 0 0 1 .5-8A5.500 5.500 0 0 1 18 8a3.500 3.500 0 0 1-.5 7z" /><path d="m8 18-1 3M12 18l-1 3M16 18l-1 3" /></>,
  storm:      <><path d="M7 14a4 4 0 0 1 .5-8A5.500 5.500 0 0 1 18 7a3.500 3.500 0 0 1-.5 7z" /><path d="m12 11-2 4h3l-2 5" /></>,
}

function SceneIcon({ name }: { name: string }) {
  return (
    <svg className="alth-scene__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] ?? PATHS.fenda}
    </svg>
  )
}
