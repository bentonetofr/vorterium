import { Select } from '../../../../shared/components/Select'
import {
  CONDITIONS,
  conditionDef,
  reactionAvailable,
  removeCondition,
  type CombatState,
  type ConditionId,
} from '../utils/altheriumCombat'

// ────────────────────────────────────────────────────────
// Turno e condições, na aba Combate: Reação, Defender Total, Mirar, Novo
// turno e Fim da cena de um lado; as condições ativas do outro (e o Caído,
// que leva ao Teste de Morte).
// ────────────────────────────────────────────────────────

const CONDITION_OPTIONS = [{ value: '', label: '+ Condição' }, ...CONDITIONS.map((c) => ({ value: c.id, label: c.label }))]

interface Props {
  combat:      CombatState
  combatKnown: boolean
  onCombat:    (next: CombatState) => void
  onNewTurn:   () => void
  onEndScene:  () => void
  onCondition: (id: ConditionId) => void
  onOpenDying: () => void
  readOnly?:   boolean
  turnNote:    string | null
}

export function AltheriumTurnPanel({ combat, combatKnown, onCombat, onNewTurn, onEndScene, onCondition, onOpenDying, readOnly = false, turnNote }: Props) {
  const reactionOk = reactionAvailable(combat)
  const dying = !!combat.dying
  return (
    <div className="alth-turn">
      <section className="alth-card">
        <div className="alth-card__header"><h4 className="alth-card__title">Turno</h4></div>
        <div className="alth-turn__chips">
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
        </div>
        <div className="alth-turn__chips">
          <button type="button" className="alth-strip__mini" disabled={readOnly} onClick={onNewTurn}
            title="Início do seu turno: renova a Reação, acaba o Defender Total, aplica Queimando e Sangrando e conta os turnos das condições.">
            Novo turno
          </button>
          <button type="button" className="alth-strip__mini" disabled={readOnly} onClick={onEndScene}>Fim da cena</button>
        </div>
        {turnNote && <p className="alth-hint">{turnNote}</p>}
        {!combatKnown && <p className="alth-hint">O banco ainda não guarda o estado de combate (migration 20240216): Reação e condições valem só nesta tela.</p>}
      </section>

      <section className="alth-card">
        <div className="alth-card__header"><h4 className="alth-card__title">Condições</h4></div>
        <div className="alth-turn__chips">
          {combat.conditions.length === 0 && !dying && <span className="alth-hint">Nenhuma condição.</span>}
          {dying && (
            <button type="button" className="alth-combat__cond alth-combat__cond--dying" onClick={onOpenDying} disabled={readOnly}>
              Caído · Teste de Morte
            </button>
          )}
          {combat.conditions.map((c) => {
            const def = conditionDef(c.id)
            return (
              <span key={c.id} className="alth-combat__cond" title={def.effect}>
                {def.label}{c.turns != null ? ` · ${c.turns} ${c.turns === 1 ? 'turno' : 'turnos'}` : ''}
                {!readOnly && <button type="button" onClick={() => onCombat(removeCondition(combat, c.id))} aria-label={`Tirar ${def.label}`}>×</button>}
              </span>
            )
          })}
        </div>
        {!readOnly && (
          <div className="alth-combat__select alth-strip__select">
            <Select value="" options={CONDITION_OPTIONS} onChange={(v) => { if (v) onCondition(v as ConditionId) }} aria-label="Pôr condição" />
          </div>
        )}
      </section>
    </div>
  )
}
