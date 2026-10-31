import { Select } from '../../../../shared/components/Select'
import {
  CONDITIONS,
  conditionDef,
  reactionAvailable,
  removeCondition,
  type CombatState,
  type ConditionId,
} from '../utils/altheriumCombat'
import { HUNGER_LABELS, HUNGER_MAX, TOKENS_MAX, type Survival } from '../utils/altheriumSurvival'
import { formatAmount } from '../utils/altheriumCraft'
import { enemyStateDef } from '../utils/altheriumStealth'
import { locationDef, scarcityDef } from '../utils/altheriumExplore'
import type { AltheriumScene } from '../services/altheriumSceneService'
import { Pips } from './AltheriumPlayKit'

// ────────────────────────────────────────────────────────
// Faixa de estado, logo abaixo do cabeçalho: o que muda a toda hora no jogo
// e não cabe numa aba. Sobrevivência (Fichas de Exploração, Fome, Rações),
// turno (Reação, Defender Total, Mirar, Novo turno, Fim da cena),
// condições e a cena que o mestre definiu (inimigos e local).
// ────────────────────────────────────────────────────────

const CONDITION_OPTIONS = [{ value: '', label: '+ Condição' }, ...CONDITIONS.map((c) => ({ value: c.id, label: c.label }))]

interface Props {
  survival:   Survival
  /** Sem a coluna no banco (migration 20240218), as Fichas e a Fome valem só nesta tela. */
  survivalKnown: boolean
  onSurvival: (patch: Partial<Survival>) => void
  /** Ração em % (todas as qualidades). */
  rationPct:  number
  onEat:      () => void
  combat:     CombatState
  combatKnown: boolean
  onCombat:   (next: CombatState) => void
  onNewTurn:  () => void
  onEndScene: () => void
  onCondition: (id: ConditionId) => void
  scene:      AltheriumScene
  /** A conta dev observadora só olha. */
  readOnly?:  boolean
  turnNote:   string | null
}

export function AltheriumStatusStrip({
  survival, survivalKnown, onSurvival, rationPct, onEat, combat, combatKnown, onCombat, onNewTurn, onEndScene,
  onCondition, scene, readOnly = false, turnNote,
}: Props) {
  const reactionOk = reactionAvailable(combat)
  const enemy = enemyStateDef(scene.enemy)
  const dying = !!combat.dying
  const hungerText = HUNGER_LABELS[Math.min(survival.hunger, HUNGER_LABELS.length - 1)]

  return (
    <section className="alth-strip" aria-label="Estado do personagem">
      <div className="alth-strip__group">
        <span className="alth-strip__title">Sobrevivência</span>
        <div className="alth-strip__cell" title="Cada exploração de um local gasta 1 Ficha. Descanso Curto recupera 2; Longo com comida, 4 (sem comida, 2).">
          <span className="alth-strip__name">Fichas de Exploração</span>
          <Pips value={survival.tokens} max={TOKENS_MAX} label="Fichas de Exploração" onChange={readOnly ? undefined : (n) => onSurvival({ tokens: n })} />
        </div>
        <div className="alth-strip__cell" title="Cada nível de Fome dá −1 em todos os testes, até −3. Passou de 3 níveis, o personagem morre.">
          <span className="alth-strip__name">Fome</span>
          <Pips value={Math.min(survival.hunger, HUNGER_MAX)} max={HUNGER_MAX} tone="danger" label="Fome" onChange={readOnly ? undefined : (n) => onSurvival({ hunger: n })} />
          <span className={`alth-strip__value${survival.hunger > 0 ? ' alth-strip__value--bad' : ''}`}>{hungerText}</span>
        </div>
        <div className="alth-strip__cell" title="Cada Descanso Longo gasta 1 Ração. Comer 1 fora de combate remove 1 nível de Fome. Limite de 4.">
          <span className="alth-strip__name">Rações</span>
          <span className="alth-strip__value">{rationPct > 0 ? formatAmount(rationPct) : 'nenhuma'}</span>
          {survival.hunger > 0 && rationPct >= 100 && !readOnly && (
            <button type="button" className="alth-strip__mini" onClick={onEat}>Comer (−1 Fome)</button>
          )}
        </div>
        {!survivalKnown && <p className="alth-hint">O banco ainda não guarda Fichas e Fome (migration 20240218): valem só nesta tela.</p>}
      </div>

      <div className="alth-strip__group">
        <span className="alth-strip__title">Turno</span>
        <button
          type="button" disabled={readOnly}
          className={`alth-combat__chip${reactionOk ? ' alth-combat__chip--ok' : ' alth-combat__chip--off'}`}
          onClick={() => onCombat({ ...combat, reaction_used: !combat.reaction_used })}
          title="1 Reação por rodada, renovada no início do seu turno: Aparar, Ataque de Oportunidade ou triunfo de Reação. Defender não gasta."
        >
          Reação: {combat.reaction_used ? 'usada' : reactionOk ? 'disponível' : 'bloqueada'}
        </button>
        <button
          type="button" disabled={readOnly} aria-pressed={combat.defend_total}
          className={`alth-combat__chip${combat.defend_total ? ' alth-combat__chip--on' : ''}`}
          onClick={() => onCombat({ ...combat, defend_total: !combat.defend_total })}
          title="Ação Padrão: +4 na Defesa e no Aparar até o próximo turno."
        >
          Defender Total{combat.defend_total ? ' (+4)' : ''}
        </button>
        <button
          type="button" disabled={readOnly} aria-pressed={combat.aim}
          className={`alth-combat__chip${combat.aim ? ' alth-combat__chip--on' : ''}`}
          onClick={() => onCombat({ ...combat, aim: !combat.aim })}
          title="Ação Padrão: +2 no próximo ataque."
        >
          Mirar{combat.aim ? ' (+2)' : ''}
        </button>
        <span className="alth-combat__spacer" />
        <button type="button" className="alth-strip__mini" disabled={readOnly} onClick={onNewTurn}
          title="Início do seu turno: renova a Reação, acaba o Defender Total, aplica Queimando e Sangrando e conta os turnos das condições.">
          Novo turno
        </button>
        <button type="button" className="alth-strip__mini" disabled={readOnly} onClick={onEndScene}>Fim da cena</button>
        {turnNote && <p className="alth-hint alth-strip__note">{turnNote}</p>}
        {!combatKnown && <p className="alth-hint">O banco ainda não guarda o estado de combate (migration 20240216): Reação e condições valem só nesta tela.</p>}
      </div>

      <div className="alth-strip__group">
        <span className="alth-strip__title">Condições</span>
        {combat.conditions.length === 0 && !dying && <span className="alth-hint">Nenhuma condição.</span>}
        {dying && <span className="alth-combat__cond alth-combat__cond--dying">Caído</span>}
        {combat.conditions.map((c) => {
          const def = conditionDef(c.id)
          return (
            <span key={c.id} className="alth-combat__cond" title={def.effect}>
              {def.label}{c.turns != null ? ` · ${c.turns} ${c.turns === 1 ? 'turno' : 'turnos'}` : ''}
              {!readOnly && <button type="button" onClick={() => onCombat(removeCondition(combat, c.id))} aria-label={`Tirar ${def.label}`}>×</button>}
            </span>
          )
        })}
        {!readOnly && (
          <div className="alth-combat__select alth-strip__select">
            <Select value="" options={CONDITION_OPTIONS} onChange={(v) => { if (v) onCondition(v as ConditionId) }} aria-label="Pôr condição" />
          </div>
        )}
      </div>

      <div className={`alth-strip__scene alth-strip__scene--${scene.enemy}`} role="status">
        <span className="alth-strip__title">Cena</span>
        <span><strong>{enemy.label}</strong> · DT {scene.dts[scene.enemy]} <small>(inimigos, para Furtividade)</small></span>
        <span>{locationDef(scene.location).label} · {scarcityDef(scene.scarcity).label} · DT {scarcityDef(scene.scarcity).dt} <small>(exploração)</small></span>
        {scene.weather.length > 0 && <span className="alth-strip__weather">{scene.weather.join(' · ')}</span>}
      </div>
    </section>
  )
}
