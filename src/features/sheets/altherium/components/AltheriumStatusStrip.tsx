import { HUNGER_LABELS, HUNGER_MAX, TOKENS_MAX, type Survival } from '../utils/altheriumSurvival'
import { Pips } from './AltheriumPlayKit'

// ────────────────────────────────────────────────────────
// Faixa fina logo abaixo do cabeçalho: só as Fichas de Exploração e os níveis
// de Fome, as duas coisas que o jogador confere o tempo todo. O turno, as
// condições e o resto do combate ficam na aba Combate.
// ────────────────────────────────────────────────────────

interface Props {
  survival:   Survival
  /** Sem a coluna no banco (migration 20240218), as Fichas e a Fome valem só nesta tela. */
  survivalKnown: boolean
  onSurvival: (patch: Partial<Survival>) => void
  /** A conta dev observadora só olha. */
  readOnly?:  boolean
}

export function AltheriumStatusStrip({ survival, survivalKnown, onSurvival, readOnly = false }: Props) {
  const hungerText = HUNGER_LABELS[Math.min(survival.hunger, HUNGER_LABELS.length - 1)]
  return (
    <section className="alth-strip alth-strip--slim" aria-label="Fichas de Exploração e Fome">
      <div className="alth-strip__cell" title="Cada exploração de um local gasta 1 Ficha. Descanso Curto recupera 2; Longo com comida, 4 (sem comida, 2).">
        <span className="alth-strip__name">Fichas de Exploração</span>
        <Pips value={survival.tokens} max={TOKENS_MAX} label="Fichas de Exploração" onChange={readOnly ? undefined : (n) => onSurvival({ tokens: n })} />
      </div>
      <div className="alth-strip__cell" title="Cada nível de Fome dá −1 em todos os testes, até −3. Passou de 3 níveis, o personagem morre.">
        <span className="alth-strip__name">Fome</span>
        <Pips value={Math.min(survival.hunger, HUNGER_MAX)} max={HUNGER_MAX} tone="danger" label="Fome" onChange={readOnly ? undefined : (n) => onSurvival({ hunger: n })} />
        {survival.hunger > 0 && <span className="alth-strip__value alth-strip__value--bad">{hungerText}</span>}
      </div>
      {!survivalKnown && <p className="alth-hint alth-strip__note">O banco ainda não guarda Fichas e Fome (migration 20240218): valem só nesta tela.</p>}
    </section>
  )
}
