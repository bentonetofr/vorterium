import { HUNGER_LABELS, HUNGER_MAX, TOKENS_MAX, type Survival } from '../utils/altheriumSurvival'
import { Pips } from './AltheriumPlayKit'

// ────────────────────────────────────────────────────────
// Fileira de selos no fim do cabeçalho: Fichas de Exploração, Fome, Reação e
// o efeito da Gênese. São as coisas que o jogador confere o tempo todo. O
// turno, as condições e o resto do combate ficam na aba Combate.
// ────────────────────────────────────────────────────────

interface Props {
  survival:   Survival
  /** Sem a coluna no banco (migration 20240218), as Fichas e a Fome valem só nesta tela. */
  survivalKnown: boolean
  onSurvival: (patch: Partial<Survival>) => void
  /** A conta dev observadora só olha. */
  readOnly?:  boolean
  /** Reação do turno: um clique marca como usada (e desmarca). */
  reaction?:  { ok: boolean; used: boolean; onToggle: () => void }
  /** Efeito da Gênese escolhida, em uma linha. */
  genesisEffect?: string
}

export function AltheriumStatusStrip({ survival, survivalKnown, onSurvival, readOnly = false, reaction, genesisEffect }: Props) {
  const hungerText = HUNGER_LABELS[Math.min(survival.hunger, HUNGER_LABELS.length - 1)]
  return (
    <section className="alth-badges" aria-label="Estado">
      <span className="alth-badge" title="Cada exploração de um local gasta 1 Ficha. Descanso Curto recupera 2; Longo com comida, 4 (sem comida, 2).">
        <span className="alth-badge__name">Fichas</span>
        <Pips value={survival.tokens} max={TOKENS_MAX} label="Fichas de Exploração" onChange={readOnly ? undefined : (n) => onSurvival({ tokens: n })} />
      </span>
      <span className="alth-badge" title="Cada nível de Fome dá −1 em todos os testes, até −3. Passou de 3 níveis, o personagem morre.">
        <span className="alth-badge__name">Fome</span>
        <Pips value={Math.min(survival.hunger, HUNGER_MAX)} max={HUNGER_MAX} tone="danger" label="Fome" onChange={readOnly ? undefined : (n) => onSurvival({ hunger: n })} />
        {survival.hunger > 0 && <span className="alth-badge__bad">{hungerText}</span>}
      </span>
      {reaction && (
        <button
          type="button" disabled={readOnly} onClick={reaction.onToggle}
          className={`alth-badge alth-badge--btn${reaction.ok ? ' alth-badge--ok' : ' alth-badge--off'}`}
          title="1 Reação por rodada, renovada no início do seu turno. Clique pra marcar como usada."
        >
          Reação: {reaction.used ? 'usada' : reaction.ok ? 'disponível' : 'bloqueada'}
        </button>
      )}
      {genesisEffect && <span className="alth-badge alth-badge--note" title={genesisEffect}>{genesisEffect}</span>}
      {!survivalKnown && <p className="alth-hint alth-badges__note">O banco ainda não guarda Fichas e Fome (migration 20240218): valem só nesta tela.</p>}
    </section>
  )
}
