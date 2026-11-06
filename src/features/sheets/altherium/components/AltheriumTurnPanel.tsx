import {
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

/** As condições em grupos, na ordem em que aparecem; `tone` é a cor de quando estão ligadas. */
const CONDITION_GROUPS: { title: string; tone: 'bad' | 'ctl' | 'pun'; ids: ConditionId[] }[] = [
  { title: 'Dano contínuo', tone: 'bad', ids: ['sangrando', 'queimando'] },
  { title: 'Controle', tone: 'ctl', ids: ['atordoado', 'derrubado', 'amedrontado', 'preso', 'surpreendido'] },
  { title: 'Da punição', tone: 'pun', ids: ['abertura_fatal', 'desequilibrio', 'arma_exposta', 'fraqueza', 'folego_quebrado', 'brecha', 'atordoamento_breve'] },
  { title: 'Graves', tone: 'bad', ids: ['incapacitado', 'coma'] },
]

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
        <div className="alth-card__header">
          <h4 className="alth-card__title">Condições</h4>
          <span className="alth-hint">{combat.conditions.length === 0 && !dying ? 'Nenhuma ativa' : `${combat.conditions.length + (dying ? 1 : 0)} ${combat.conditions.length + (dying ? 1 : 0) === 1 ? 'ativa' : 'ativas'}`}</span>
        </div>
        {dying && (
          <button type="button" className="alth-combat__cond alth-combat__cond--dying" onClick={onOpenDying} disabled={readOnly}>
            Caído · Teste de Morte
          </button>
        )}
        <div className="alth-conds">
          {CONDITION_GROUPS.map((g) => (
            <div key={g.title} className="alth-conds__group">
              <span className="alth-conds__title">{g.title}</span>
              <div className="alth-conds__chips">
                {g.ids.map((id) => {
                  const def = conditionDef(id)
                  const active = combat.conditions.find((c) => c.id === id)
                  return (
                    <button
                      key={id} type="button" disabled={readOnly} aria-pressed={!!active}
                      className={`alth-cond alth-cond--${g.tone}${active ? ' is-on' : ''}`} title={def.effect}
                      onClick={() => (active ? onCombat(removeCondition(combat, id)) : onCondition(id))}
                    >
                      {def.label}
                      {active && active.turns != null && <small>{active.turns} {active.turns === 1 ? 'turno' : 'turnos'}</small>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {combat.conditions.length > 0 && (
          <ul className="alth-conds__effects" aria-label="O que as condições ativas fazem">
            {combat.conditions.map((c) => <li key={c.id}><strong>{conditionDef(c.id).label}:</strong> {conditionDef(c.id).effect}</li>)}
          </ul>
        )}
      </section>
    </div>
  )
}
