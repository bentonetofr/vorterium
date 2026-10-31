import { useMemo, useState, type ReactNode } from 'react'
import type { AltheriumInventoryItem } from '../../../../shared/types'
import { Select } from '../../../../shared/components/Select'
import {
  DAMAGE_TYPE_LABELS,
  WEAPON_RANGE_LABELS,
  weaponPropertyLabel,
  WEAPON_PROPERTIES,
} from '../constants/altheriumItems'
import type { AltheriumAttribute, AltheriumDomain } from '../constants/altherium'
import {
  CONDITIONS,
  FULL_DAMAGE_LABELS,
  PUNISHMENT_TABLE,
  ZONE_LABELS,
  addCondition,
  applyDamage,
  attackDomain,
  attackModes,
  combatWeapons,
  conditionDbMod,
  conditionDef,
  conditionDefenseMod,
  defenseFumble,
  doubleDamage,
  endScene,
  hasProperty,
  parryResult,
  propertyValue,
  rangePenalty,
  reactionAvailable,
  removeCondition,
  startTurn,
  surroundBonus,
  zoneForRoll,
  zoneHasEryndorArmor,
  type AttackMode,
  type BodyZoneId,
  type CombatState,
  type CombatWeapon,
  type ConditionId,
  type FullDamageType,
} from '../utils/altheriumCombat'
import { AltheriumTestModal, type AfterCtx, type AltheriumTestSpec, type Modifier } from './AltheriumTestModal'
import {
  addInitiativeParticipant,
  getInitiativeParticipants,
  setInitiativeValue,
} from '../../../initiative/services/initiativeService'

// ────────────────────────────────────────────────────────
// Aba Combate da ficha de Altherium (livro 2.0, "Crepúsculo Vermelho"):
// turno (Reação, Defender Total, Mirar, Novo turno), condições com
// contador, Iniciativa, Atacar (Luta ou Precisão + atributo da arma, com
// os modificadores de alcance, Cercar e Gênesis), Defender e Aparar (com
// a Tabela de Punição e o Contra-ataque) e o cálculo do dano recebido na
// ordem do livro. Tudo rola na janela de teste (dados 3D).
// ────────────────────────────────────────────────────────

/** Dados e atributo de um teste de domínio, como a ficha calcula. */
export interface DomainCheck {
  domainId:       string
  domainLabel:    string
  attributeLabel: string
  attribute:      number
  baseDice:       number
  disadvantage:   string | null
  /** Condições que mexem no atributo (Amedrontado, Fraqueza...). */
  flat:           Modifier[]
}

interface Props {
  campaignId:   string
  sheetId:      string
  character:    string
  genesis:      string
  inventory:    AltheriumInventoryItem[]
  state:        CombatState
  onState:      (next: CombatState) => void
  domainCheck:  (domain: AltheriumDomain, attribute?: AltheriumAttribute) => DomainCheck
  zoneDb:       Record<BodyZoneId, number>
  vitality:     number
  /** Tira PV e marca o ferimento na parte do corpo. */
  onDamage:     (amount: number, zone: BodyZoneId | null) => void
}

type Open = { spec: AltheriumTestSpec; kind: 'attack' | 'defense' | 'parry' | 'initiative'; weapon?: CombatWeapon; mode?: AttackMode; counter?: boolean }

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)
const ZONES: BodyZoneId[] = ['db_pernas', 'db_bracos', 'db_tronco', 'db_cabeca']
const CONDITION_OPTIONS = [{ value: '', label: 'Pôr condição…' }, ...CONDITIONS.map((c) => ({ value: c.id, label: c.label }))]
const DAMAGE_OPTIONS = (Object.keys(FULL_DAMAGE_LABELS) as FullDamageType[]).map((t) => ({ value: t, label: FULL_DAMAGE_LABELS[t] }))
const ZONE_OPTIONS = ZONES.map((z) => ({ value: z, label: ZONE_LABELS[z] }))

export function AltheriumCombatPanel({
  campaignId, sheetId, character, genesis, inventory, state, onState, domainCheck, zoneDb, vitality, onDamage,
}: Props) {
  const weapons = useMemo(() => combatWeapons(inventory), [inventory])
  const [open, setOpen] = useState<Open | null>(null)
  const [turnNote, setTurnNote] = useState<string | null>(null)

  // Ataque
  const [weaponId, setWeaponId] = useState<string>('')
  const weapon = weapons.find((w) => w.inventoryId === weaponId) ?? weapons[0] ?? null
  const modes = weapon ? attackModes(weapon) : []
  const [modePick, setModePick] = useState<AttackMode>('corpo')
  const mode: AttackMode = modes.includes(modePick) ? modePick : (modes[0] ?? 'corpo')
  const [attrPick, setAttrPick] = useState<'furia' | 'impulso'>('furia')
  const [attackers, setAttackers] = useState(1)
  const [bands, setBands] = useState(0)
  const [enemyInTouch, setEnemyInTouch] = useState(false)
  const [allyNearTarget, setAllyNearTarget] = useState(false)

  // Defesa
  const [cover, setCover] = useState(false)
  const [parryId, setParryId] = useState('')
  const [incomingRanged, setIncomingRanged] = useState(false)
  const [incomingCrit, setIncomingCrit] = useState(false)

  const meleeWeapons = weapons.filter((w) => attackModes(w).includes('corpo'))
  const parryWeapon = meleeWeapons.find((w) => w.inventoryId === parryId) ?? meleeWeapons[0] ?? null
  const reactionOk = reactionAvailable(state)

  function patch(next: Partial<CombatState>) {
    onState({ ...state, ...next })
  }

  // ── Turno ──
  function newTurn() {
    const t = startTurn(state)
    onState(t.state)
    const dmg = t.damage.reduce((s, d) => s + d.amount, 0)
    if (dmg > 0) onDamage(dmg, null)
    const bits = [
      'Reação renovada',
      ...t.damage.map((d) => `${d.label}: −${d.amount} PV`),
      ...(t.ended.length ? [`acabou: ${t.ended.join(', ')}`] : []),
    ]
    setTurnNote(bits.join(' · '))
  }

  // ── Ataque ──
  function weaponAttr(w: CombatWeapon): 'furia' | 'impulso' {
    return w.attribute === 'furia_impulso' ? attrPick : w.attribute
  }

  function attackSpec(w: CombatWeapon, m: AttackMode, counter = false): AltheriumTestSpec {
    const check = domainCheck(attackDomain(m), weaponAttr(w))
    const flat: Modifier[] = [...check.flat]
    const diceMods: Modifier[] = []
    const notes: string[] = []
    if (!counter && state.aim) flat.push({ label: 'Mirar', value: 2 })
    if (m === 'corpo' && !counter) flat.push({ label: 'Cercar', value: surroundBonus(attackers) })
    if (m === 'distancia') {
      const pen = rangePenalty(bands)
      if (pen) diceMods.push({ label: `${bands} ${bands === 1 ? 'faixa' : 'faixas'} além do alcance`, value: pen })
      if (enemyInTouch && w.category === 'alcance') diceMods.push({ label: 'Inimigo em Toque', value: -1 })
      if (allyNearTarget) diceMods.push({ label: 'Alvo em Toque de um aliado', value: -1 })
    }
    if (counter) notes.push('Contra-ataque: o atacante só pode Defender, nunca Aparar.')
    if (hasProperty(w, 'recarga') && state.unloaded.includes(w.inventoryId)) notes.push('A arma está descarregada: recarregue antes de disparar.')
    const extraDie = m === 'corpo' && genesis === 'guerreiro' ? { label: 'Gênesis Guerreiro', sides: 4 }
      : m === 'distancia' && genesis === 'cacador' ? { label: 'Gênesis Caçador', sides: 4 } : undefined
    return {
      ...check,
      title: `${counter ? 'Contra-ataque' : 'Ataque'} com ${w.name}`,
      flat, diceMods, extraDie, notes,
      targetLabel: 'Defesa do alvo', tieWins: false, words: ['acertou', 'errou'], critSucceeds: true,
    }
  }

  function openAttack(counter = false, w = weapon, m = mode) {
    if (!w) return
    setOpen({ spec: attackSpec(w, m, counter), kind: 'attack', weapon: w, mode: m, counter })
  }

  // ── Defesa / Aparar ──
  function openDefense() {
    const check = domainCheck('resiliencia')
    const flat: Modifier[] = [...check.flat]
    if (state.defend_total) flat.push({ label: 'Defender Total', value: 4 })
    const cond = conditionDefenseMod(state)
    if (cond) flat.push({ label: 'Derrubado', value: cond })
    setOpen({
      kind: 'defense',
      spec: {
        ...check, title: 'Defesa', flat,
        diceMods: cover ? [{ label: 'Cobertura parcial', value: 1 }] : [],
        targetLabel: 'Ataque recebido', words: ['defendeu', 'foi atingido'],
        notes: ['Defender não gasta Reação. Empate favorece a defesa.'],
      },
    })
  }

  function openParry() {
    if (!parryWeapon) return
    const check = domainCheck('reflexo')
    const flat: Modifier[] = [...check.flat]
    if (hasProperty(parryWeapon, 'defensiva')) flat.push({ label: 'Defensiva', value: 1 })
    if (hasProperty(parryWeapon, 'lenta')) flat.push({ label: 'Lenta', value: -2 })
    if (state.defend_total) flat.push({ label: 'Defender Total', value: 4 })
    setOpen({
      kind: 'parry', weapon: parryWeapon,
      spec: {
        ...check, title: `Aparar com ${parryWeapon.name}`, flat,
        targetLabel: 'Ataque recebido', words: ['aparou', 'falhou'],
        notes: [`Gasta a Reação. Contra-ataque se superar o ataque por ${hasProperty(parryWeapon, 'fluxo') ? 4 : 5} ou mais, ou no crítico.`],
      },
    })
  }

  function openInitiative() {
    const check = domainCheck('iniciativa')
    setOpen({ kind: 'initiative', spec: { ...check, title: 'Iniciativa', notes: ['A ordem é do maior para o menor resultado.'] } })
  }

  // ── Condições ──
  function putCondition(id: ConditionId, turns?: number | null) {
    onState(addCondition(state, id, turns))
  }

  return (
    <div className="alth-combat">
      {/* Turno */}
      <section className="alth-section">
        <div className="alth-section__header">
          <h4 className="alth-section__title">Turno</h4>
        </div>
        <div className="alth-combat__row">
          <button type="button" className={`alth-combat__chip${reactionOk ? ' alth-combat__chip--ok' : ' alth-combat__chip--off'}`}
            onClick={() => patch({ reaction_used: !state.reaction_used })}
            title="1 Reação por rodada, renovada no início do seu turno: Aparar, Ataque de Oportunidade ou triunfo de Reação. Defender não gasta.">
            Reação: {state.reaction_used ? 'usada' : reactionOk ? 'disponível' : 'bloqueada'}
          </button>
          <button type="button" className={`alth-combat__chip${state.defend_total ? ' alth-combat__chip--on' : ''}`} aria-pressed={state.defend_total}
            onClick={() => patch({ defend_total: !state.defend_total })} title="Ação Padrão: +4 na Defesa e no Aparar até o próximo turno.">
            Defender Total {state.defend_total ? '(+4)' : ''}
          </button>
          <button type="button" className={`alth-combat__chip${state.aim ? ' alth-combat__chip--on' : ''}`} aria-pressed={state.aim}
            onClick={() => patch({ aim: !state.aim })} title="Ação Padrão: +2 no próximo ataque.">
            Mirar {state.aim ? '(+2)' : ''}
          </button>
          <span className="alth-combat__spacer" />
          <button type="button" className="btn btn-ghost alth-combat__btn" onClick={newTurn}
            title="Início do seu turno: renova a Reação, acaba o Defender Total, aplica Queimando e Sangrando e conta os turnos das condições.">
            Novo turno
          </button>
          <button type="button" className="btn btn-ghost alth-combat__btn" onClick={() => { onState(endScene(state)); setTurnNote('Fim da cena: Amedrontado, Mirar e Defender Total saíram.') }}>
            Fim da cena
          </button>
          <button type="button" className="btn btn-primary alth-combat__btn" onClick={openInitiative}>Iniciativa</button>
        </div>
        {turnNote && <p className="alth-hint">{turnNote}</p>}
      </section>

      {/* Condições */}
      <section className="alth-section">
        <div className="alth-section__header">
          <h4 className="alth-section__title">Condições</h4>
        </div>
        <div className="alth-combat__row">
          {state.conditions.length === 0 && <span className="alth-hint">Nenhuma condição.</span>}
          {state.conditions.map((c) => {
            const def = conditionDef(c.id)
            return (
              <span key={c.id} className="alth-combat__cond" title={def.effect}>
                {def.label}{c.turns != null ? ` · ${c.turns} ${c.turns === 1 ? 'turno' : 'turnos'}` : ''}
                <button type="button" onClick={() => onState(removeCondition(state, c.id))} aria-label={`Tirar ${def.label}`}>×</button>
              </span>
            )
          })}
          <span className="alth-combat__spacer" />
          <div className="alth-combat__select">
            <Select value="" options={CONDITION_OPTIONS} onChange={(v) => { if (v) putCondition(v as ConditionId) }} aria-label="Pôr condição" />
          </div>
        </div>
      </section>

      {/* Atacar */}
      <section className="alth-section">
        <div className="alth-section__header">
          <h4 className="alth-section__title">Atacar</h4>
        </div>
        {weapons.length === 0 && <p className="alth-hint">Nenhuma arma no inventário.</p>}
        {weapon && (
          <div className="alth-combat__form">
            <div className="alth-combat__select alth-combat__select--wide">
              <Select value={weapon.inventoryId} options={weapons.map((w) => ({ value: w.inventoryId, label: w.name }))}
                onChange={setWeaponId} aria-label="Arma" />
            </div>
            <p className="alth-combat__weapon">
              {weapon.damageDice} {DAMAGE_TYPE_LABELS[weapon.damageType]} · {WEAPON_RANGE_LABELS[weapon.range]}
              {weapon.properties.map((p) => (
                <span key={p.id} className="alth-inventory__prop" title={WEAPON_PROPERTIES[p.id].description}>{weaponPropertyLabel(p)}</span>
              ))}
            </p>

            <div className="alth-combat__row">
              {modes.length > 1 && modes.map((m) => (
                <button key={m} type="button" className={`alth-combat__chip${mode === m ? ' alth-combat__chip--on' : ''}`} aria-pressed={mode === m}
                  onClick={() => setModePick(m)}>
                  {m === 'corpo' ? 'Corpo a corpo (Luta)' : 'Arremessar (Precisão)'}
                </button>
              ))}
              {weapon.attribute === 'furia_impulso' && (['furia', 'impulso'] as const).map((a) => (
                <button key={a} type="button" className={`alth-combat__chip${attrPick === a ? ' alth-combat__chip--on' : ''}`} aria-pressed={attrPick === a}
                  onClick={() => setAttrPick(a)}>
                  {a === 'furia' ? 'Fúria' : 'Impulso'}
                </button>
              ))}
            </div>

            {mode === 'corpo' ? (
              <label className="alth-combat__num">
                Atacantes em Toque do alvo
                <input type="number" className="input" min={1} max={8} value={attackers}
                  onChange={(e) => setAttackers(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} />
                <span className="alth-hint">Cercar: {signed(surroundBonus(attackers))}</span>
              </label>
            ) : (
              <div className="alth-combat__row">
                <label className="alth-combat__num">
                  Faixas além do alcance
                  <input type="number" className="input" min={0} max={3} value={bands}
                    onChange={(e) => setBands(Math.max(0, Math.min(3, Number(e.target.value) || 0)))} />
                </label>
                {weapon.category === 'alcance' && (
                  <label className="alth-test__check">
                    <input type="checkbox" checked={enemyInTouch} onChange={(e) => setEnemyInTouch(e.target.checked)} />
                    Inimigo em Toque de mim (−1 dado)
                  </label>
                )}
                <label className="alth-test__check">
                  <input type="checkbox" checked={allyNearTarget} onChange={(e) => setAllyNearTarget(e.target.checked)} />
                  Alvo em Toque de um aliado (−1 dado)
                </label>
              </div>
            )}

            {mode === 'distancia' && rangePenalty(bands) === null && <p className="alth-test__note alth-test__note--warn">Mais de 2 faixas além do alcance: o ataque não alcança.</p>}

            <div className="alth-combat__row">
              {hasProperty(weapon, 'recarga') && (
                state.unloaded.includes(weapon.inventoryId) ? (
                  <button type="button" className="btn btn-ghost alth-combat__btn"
                    onClick={() => patch({ unloaded: state.unloaded.filter((id) => id !== weapon.inventoryId) })}>
                    Recarregar ({weapon.properties.find((p) => p.id === 'recarga')?.action})
                  </button>
                ) : <span className="alth-hint">Carregada</span>
              )}
              <span className="alth-combat__spacer" />
              <button type="button" className="btn btn-primary alth-combat__btn" onClick={() => openAttack()}
                disabled={mode === 'distancia' && rangePenalty(bands) === null}>
                Atacar
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Defender */}
      <section className="alth-section">
        <div className="alth-section__header">
          <h4 className="alth-section__title">Defender</h4>
        </div>
        <div className="alth-combat__row">
          <label className="alth-test__check">
            <input type="checkbox" checked={cover} onChange={(e) => setCover(e.target.checked)} />
            Cobertura parcial (+1 dado na Defesa)
          </label>
          <span className="alth-combat__spacer" />
          <button type="button" className="btn btn-primary alth-combat__btn" onClick={openDefense}>Defender</button>
        </div>
        <div className="alth-combat__form">
          <div className="alth-combat__row">
            {meleeWeapons.length > 1 && (
              <div className="alth-combat__select">
                <Select value={parryWeapon?.inventoryId ?? ''} options={meleeWeapons.map((w) => ({ value: w.inventoryId, label: w.name }))}
                  onChange={setParryId} aria-label="Arma para aparar" />
              </div>
            )}
            <label className="alth-test__check">
              <input type="checkbox" checked={incomingRanged} onChange={(e) => setIncomingRanged(e.target.checked)} />
              O ataque é à distância
            </label>
            <label className="alth-test__check">
              <input type="checkbox" checked={incomingCrit} onChange={(e) => setIncomingCrit(e.target.checked)} />
              O ataque foi crítico
            </label>
            <span className="alth-combat__spacer" />
            <button type="button" className="btn btn-ghost alth-combat__btn" onClick={openParry}
              disabled={!parryWeapon || !reactionOk || incomingRanged || incomingCrit}>
              Aparar
            </button>
          </div>
          <p className="alth-hint">
            {!parryWeapon ? 'Para Aparar é preciso empunhar uma arma corpo a corpo.'
              : !reactionOk ? 'Sem Reação: já foi usada ou está bloqueada.'
              : incomingRanged || incomingCrit ? 'Não dá para Aparar ataques à distância nem acertos críticos.'
              : 'Aparar gasta a Reação. Se falhar, sofre o dano normal +1d6.'}
          </p>
        </div>
      </section>

      <DamageCalculator inventory={inventory} zoneDb={zoneDb} dbMod={conditionDbMod(state)} vitality={vitality} onApply={onDamage} />

      {open && (
        <AltheriumTestModal
          campaignId={campaignId} sheetId={sheetId} character={character} spec={open.spec}
          onClose={() => setOpen(null)}
          onRolled={({ reading }) => {
            if (open.kind === 'attack') {
              const next: Partial<CombatState> = {}
              if (!open.counter && state.aim) next.aim = false
              if (open.weapon && hasProperty(open.weapon, 'recarga')) next.unloaded = [...new Set([...state.unloaded, open.weapon.inventoryId])]
              if (Object.keys(next).length) patch(next)
            }
            if (open.kind === 'parry') patch({ reaction_used: true })
            void reading
          }}
          after={(ctx) => (
            <AfterRoll ctx={ctx} open={open} character={character} campaignId={campaignId}
              onCondition={putCondition} onCounter={() => open.weapon && openAttack(true, open.weapon, 'corpo')} />
          )}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Depois do resultado: dano e local (ataque), Tabela de Punição (defesa),
// Contra-ataque ou +1d6 (aparar), entrar na ordem de iniciativa.
// ────────────────────────────────────────────────────────

function AfterRoll({ ctx, open, character, campaignId, onCondition, onCounter }: {
  ctx: AfterCtx; open: Open; character: string; campaignId: string
  onCondition: (id: ConditionId, turns?: number | null) => void
  onCounter: () => void
}) {
  const [lines, setLines] = useState<string[]>([])
  const [punish, setPunish] = useState<(typeof PUNISHMENT_TABLE)[number] | null>(null)
  const { reading, outcome, rollExtra, busy } = ctx
  const add = (line: string) => setLines((l) => [...l, line])

  async function rollAndSay(formula: string, label: string, say: (total: number) => string) {
    const r = await rollExtra(formula, label)
    if (r) add(say(r.result))
  }

  const extras: ReactNode[] = []

  if (open.kind === 'attack' && open.weapon) {
    const w = open.weapon
    const hit = outcome ? outcome.success : true
    const anyOne = reading.results.includes(1)
    if (hit) {
      const dmg = reading.crit ? doubleDamage(w.damageDice) : w.damageDice
      extras.push(
        <div key="hit" className="alth-test__actions alth-test__actions--start">
          <button type="button" className="btn btn-primary" disabled={busy}
            onClick={() => void rollAndSay(dmg, `Dano: ${w.name}`, (t) => `Dano ${dmg}: ${t} ${DAMAGE_TYPE_LABELS[w.damageType]}${propertyValue(w, 'perfurante') ? ` (ignora ${propertyValue(w, 'perfurante')} de DB)` : ''}`)}>
            Rolar dano ({dmg})
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy}
            onClick={() => void rollAndSay('1d10', 'Local atingido', (t) => `Local (1d10 = ${t}): ${ZONE_LABELS[zoneForRoll(t)]}`)}>
            Local atingido
          </button>
          {hasProperty(w, 'par') && (
            <button type="button" className="btn btn-ghost" disabled={busy}
              onClick={() => void rollAndSay('1d4', `Segundo golpe: ${w.name}`, (t) => `Segundo golpe (Ação Bônus): ${t}`)}>
              Segundo golpe (1d4)
            </button>
          )}
        </div>,
      )
      if (reading.crit) {
        const crit: string[] = ['Crítico: o dano é rolado duas vezes.']
        if (hasProperty(w, 'serrilhada')) crit.push('Serrilhada: o alvo fica Sangrando.')
        if (hasProperty(w, 'atordoante')) crit.push('Atordoante: o alvo fica Atordoado.')
        if (hasProperty(w, 'prender')) crit.push('Prender: o alvo fica Preso.')
        extras.push(<p key="crit" className="alth-test__note">{crit.join(' ')}</p>)
      }
    } else if (anyOne) {
      const bits = ['Errou com um 1 nos dados: a arma se desgasta (perde 10% de Integridade).']
      if (open.mode === 'distancia') bits.push('Se o alvo estava em Toque de um aliado, o tiro acerta o aliado mais próximo.')
      extras.push(<p key="one" className="alth-test__note alth-test__note--warn">{bits.join(' ')}</p>)
    }
  }

  if (open.kind === 'defense' && defenseFumble(reading.kept)) {
    extras.push(
      <div key="fumble" className="alth-combat__punish">
        <p className="alth-test__note alth-test__note--warn">Falha crítica na Defesa (1 natural): role na Tabela de Punição.</p>
        {!punish ? (
          <button type="button" className="btn btn-primary" disabled={busy}
            onClick={async () => {
              const r = await rollExtra('1d10', 'Tabela de Punição')
              if (r) setPunish(PUNISHMENT_TABLE[Math.max(1, Math.min(10, r.result)) - 1])
            }}>
            Rolar Punição (1d10)
          </button>
        ) : (
          <>
            <p className="alth-test__note"><strong>{punish.roll}. {punish.name}:</strong> {punish.effect}</p>
            {punish.condition && (
              <button type="button" className="btn btn-ghost" disabled={busy}
                onClick={async () => {
                  const id = punish.condition!
                  if (id === 'fraqueza' || id === 'folego_quebrado') {
                    const r = await rollExtra('1d4', `${punish.name}: turnos`)
                    if (r) { onCondition(id, r.result); add(`${punish.name} por ${r.result} turnos.`) }
                  } else {
                    onCondition(id)
                    add(`${punish.name} marcada na ficha.`)
                  }
                }}>
                Marcar na ficha
              </button>
            )}
          </>
        )}
      </div>,
    )
  }

  if (open.kind === 'parry' && outcome) {
    const res = parryResult(reading.total, ctx.target ?? 0, { fluxo: hasProperty(open.weapon, 'fluxo'), crit: reading.crit })
    if (res.counter) {
      extras.push(
        <div key="counter" className="alth-test__actions alth-test__actions--start">
          <p className="alth-test__note">Contra-ataque! Faz parte do Aparar, não gasta outra Reação.</p>
          <button type="button" className="btn btn-primary" onClick={onCounter}>Contra-atacar</button>
        </div>,
      )
    } else if (!res.parried) {
      extras.push(
        <div key="fail" className="alth-test__actions alth-test__actions--start">
          <button type="button" className="btn btn-ghost" disabled={busy}
            onClick={() => void rollAndSay('1d6', 'Aparar falhou: dano extra', (t) => `Sofre o dano normal +${t} (1d6).`)}>
            Rolar +1d6 de dano
          </button>
        </div>,
      )
    }
  } else if (open.kind === 'parry' && reading.crit) {
    extras.push(
      <div key="counter" className="alth-test__actions alth-test__actions--start">
        <p className="alth-test__note">Crítico no Aparar: o Contra-ataque é garantido.</p>
        <button type="button" className="btn btn-primary" onClick={onCounter}>Contra-atacar</button>
      </div>,
    )
  }

  if (open.kind === 'initiative') {
    extras.push(
      <div key="init" className="alth-test__actions alth-test__actions--start">
        <button type="button" className="btn btn-primary" disabled={busy}
          onClick={async () => {
            try {
              const name = character.trim()
              const find = async () => (await getInitiativeParticipants(campaignId))
                .find((p) => p.name.trim().toLowerCase() === name.toLowerCase())
              let p = await find()
              if (!p) { await addInitiativeParticipant(campaignId, name); p = await find() }
              if (!p) throw new Error()
              await setInitiativeValue(p.id, reading.total)
              add(`${name} entrou na ordem de iniciativa com ${reading.total}.`)
            } catch {
              add('Não foi possível pôr na ordem de iniciativa.')
            }
          }}>
          Pôr {reading.total} na ordem de iniciativa
        </button>
      </div>,
    )
  }

  return (
    <>
      {extras}
      {lines.length > 0 && (
        <ul className="alth-combat__lines">
          {lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
    </>
  )
}

// ────────────────────────────────────────────────────────
// Dano recebido, na ordem do livro.
// ────────────────────────────────────────────────────────

function DamageCalculator({ inventory, zoneDb, dbMod, vitality, onApply }: {
  inventory: AltheriumInventoryItem[]
  zoneDb: Record<BodyZoneId, number>
  dbMod: number
  vitality: number
  onApply: (amount: number, zone: BodyZoneId | null) => void
}) {
  const [damage, setDamage] = useState('')
  const [type, setType] = useState<FullDamageType>('corte')
  const [zone, setZone] = useState<BodyZoneId>('db_tronco')
  const [ignore, setIgnore] = useState(0)
  const [vulnerable, setVulnerable] = useState(false)
  const [resistance, setResistance] = useState(0)
  const [immune, setImmune] = useState(false)
  const [applied, setApplied] = useState<string | null>(null)

  const db = Math.max(0, zoneDb[zone] + dbMod)
  const value = Math.max(0, Math.trunc(Number(damage) || 0))
  const result = damage.trim() === '' ? null : applyDamage({
    damage: value, type, db, ignoreDb: ignore, vulnerable, resistance, immune,
    eryndorArmor: zoneHasEryndorArmor(inventory, zone),
  })

  return (
    <section className="alth-section">
      <div className="alth-section__header">
        <h4 className="alth-section__title">Receber dano</h4>
      </div>
      <div className="alth-combat__form">
        <div className="alth-combat__row">
          <label className="alth-combat__num">
            Dano
            <input type="number" className="input" min={0} max={999} value={damage} onChange={(e) => { setDamage(e.target.value); setApplied(null) }} placeholder="0" />
          </label>
          <div className="alth-combat__select">
            <Select value={type} options={DAMAGE_OPTIONS} onChange={(v) => setType(v as FullDamageType)} aria-label="Tipo de dano" />
          </div>
          <div className="alth-combat__select">
            <Select value={zone} options={ZONE_OPTIONS} onChange={(v) => setZone(v as BodyZoneId)} aria-label="Parte atingida" />
          </div>
          <span className="alth-hint">DB {db}{dbMod ? ` (Arma Exposta ${dbMod})` : ''}</span>
        </div>
        <div className="alth-combat__row">
          <label className="alth-combat__num">
            Perfurante (ignora DB)
            <input type="number" className="input" min={0} max={20} value={ignore} onChange={(e) => setIgnore(Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <label className="alth-combat__num">
            Resistência
            <input type="number" className="input" min={0} max={50} value={resistance} onChange={(e) => setResistance(Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <label className="alth-test__check"><input type="checkbox" checked={vulnerable} onChange={(e) => setVulnerable(e.target.checked)} /> Vulnerável</label>
          <label className="alth-test__check"><input type="checkbox" checked={immune} onChange={(e) => setImmune(e.target.checked)} /> Imune</label>
        </div>

        {result && (
          <>
            <ol className="alth-combat__steps">
              {result.steps.map((s, i) => <li key={i}>{s.label}: <strong>{s.value}</strong></li>)}
            </ol>
            {result.armorWear && <p className="alth-hint">O dano não passou do DB: a armadura de {ZONE_LABELS[zone]} perde 10% de Integridade.</p>}
            <div className="alth-combat__row">
              <span className="alth-combat__final">Dano final: <strong>{result.final}</strong> · PV {vitality} → {Math.max(0, vitality - result.final)}</span>
              <span className="alth-combat__spacer" />
              <button type="button" className="btn btn-primary alth-combat__btn" disabled={applied !== null}
                onClick={() => {
                  onApply(result.final, zone)
                  setApplied(vitality - result.final <= 0 ? 'PV chegou a 0: Estado Caído.' : 'Dano aplicado.')
                }}>
                Aplicar na ficha
              </button>
            </div>
            {applied && <p className="alth-hint">{applied}</p>}
          </>
        )}
      </div>
    </section>
  )
}
