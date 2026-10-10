import { useState } from 'react'
import { POOL_MAX } from '../constants/terraDevastadaAdaptada'
import { ALERT_LEVELS, alertLevel } from '../constants/tdaStealth'
import { setTdaScene, type TdaScene } from '../services/tdaSceneService'
import { useTdaScene } from '../utils/useTdaScene'
import './TerraDevastadaAdaptadaSheet.css'

// ────────────────────────────────────────────────────────
// Barra da cena (só o mestre): Alerta (Oculto, Suspeito, Alertado, Caçado)
// e Atenção do lugar (a meta pra não ser notado). Os jogadores veem o
// Alerta na própria ficha e a Atenção já vem preenchida no teste de
// furtividade.
// ────────────────────────────────────────────────────────

export function TdaSceneBar({ campaignId }: { campaignId: string }) {
  const [scene, setScene] = useTdaScene(campaignId)
  const [error, setError] = useState<string | null>(null)
  const level = alertLevel(scene.alert)

  async function change(patch: Partial<TdaScene>) {
    const previous = scene
    setScene({ ...scene, ...patch })
    setError(null)
    try {
      await setTdaScene(campaignId, patch)
    } catch (err) {
      setScene(previous)
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar a cena.')
    }
  }

  return (
    <section className="tda-scene" aria-label="Cena">
      <div className="tda-scene__group">
        <span className="tda-label">Alerta da cena</span>
        <div className="tda-segmented" role="radiogroup" aria-label="Alerta">
          {ALERT_LEVELS.map((a) => (
            <button
              key={a.id} type="button" role="radio" aria-checked={scene.alert === a.id}
              className={`tda-segmented__btn tda-segmented__btn--alert-${a.id}${scene.alert === a.id ? ' tda-segmented__btn--active' : ''}`}
              onClick={() => void change({ alert: a.id })}
            >
              {a.label}
            </button>
          ))}
        </div>
        <span className="tda-hint">{level.effect}</span>
      </div>

      <div className="tda-scene__group">
        <span className="tda-label">Atenção do lugar</span>
        <div className="tda-meta" role="radiogroup" aria-label="Atenção do lugar">
          {Array.from({ length: POOL_MAX }, (_, i) => i + 1).map((n) => (
            <button
              key={n} type="button" role="radio" aria-checked={scene.attention === n}
              className={`tda-meta__btn${scene.attention === n ? ' tda-meta__btn--active' : ''}`}
              onClick={() => void change({ attention: n })}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="tda-hint">Meta pra não ser notado (fácil 1, comum 2–3, difícil 4–6).</span>
      </div>

      {error && <p className="tda-warn" role="alert">{error}</p>}
    </section>
  )
}
