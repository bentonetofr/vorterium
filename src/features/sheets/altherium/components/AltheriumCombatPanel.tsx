import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
  FULL_DAMAGE_LABELS,
  PUNISHMENT_TABLE,
  ZONE_LABELS,
  addCondition,
  applyDamage,
  attackDomain,
  attackModes,
  combatWeapons,
  conditionDbMod,
  conditionDefenseMod,
  defenseFumble,
  hasReinforcement,
  weaponDamageFormula,
  weaponDamageType,
  weaponWear,
  zoneArmor,
  hasProperty,
  parryResult,
  propertyValue,
  rangePenalty,
  reactionAvailable,
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
import { testPool } from '../utils/altheriumTest'
import { AltheriumTestModal, type AfterCtx, type AltheriumTestSpec, type Modifier } from './AltheriumTestModal'
import {
  addInitiativeParticipant,
  getInitiativeParticipants,
  setInitiativeValue,
} from '../../../initiative/services/initiativeService'
import { AltheriumDyingPanel } from './AltheriumDyingPanel'
import { applyWear, integrityBand, weaponIntegrity, BAND_LABELS } from '../utils/altheriumCraft'
import {
  DEATH_DT,
  NEW_DYING,
  afterDeathRoll,
  bonusOnTurn,
  deathSuccess,
  deathTurns,
  determinationBonus,
} from '../utils/altheriumDeath'
import { Chips, Field, Formula, Icon, Toggle, Win } from './AltheriumPlayKit'

// ────────────────────────────────────────────────────────
// Combate da ficha de Altherium (livro 2.0, "Crepúsculo Vermelho"), em
// janelas abertas pelos botões de ação do cabeçalho: Atacar (Luta ou
// Precisão + atributo da arma, com alcance, Cercar e Gênesis), Defender e
// Aparar (com a Tabela de Punição e o Contra-ataque), Iniciativa, Receber
// dano (na ordem do livro) e o Estado Caído com o Teste de Morte. Tudo rola
// na janela de teste (dados 3D). A Reação, as condições e o turno ficam na
// faixa de estado.
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

export type CombatAction = 'attack' | 'defend' | 'damage' | 'initiative' | 'dying'

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
  espirito:     number
  /** Pontos no domínio Determinação (bônus do Teste de Morte). */
  determinationPoints: number
  /** Integridade de um item do inventário (desgaste no combate). */
  onPatch:      (id: string, patch: { integrity?: number }) => Promise<void>
  /** Janela aberta (null = nenhuma). */
  action:       CombatAction | null
  onClose:      () => void
}

type Open = { spec: AltheriumTestSpec; kind: 'attack' | 'defense' | 'parry' | 'initiative' | 'death'; weapon?: CombatWeapon; mode?: AttackMode; counter?: boolean }

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)
const ZONES: BodyZoneId[] = ['db_pernas', 'db_bracos', 'db_tronco', 'db_cabeca']
const DAMAGE_OPTIONS = (Object.keys(FULL_DAMAGE_LABELS) as FullDamageType[]).map((t) => ({ value: t, label: FULL_DAMAGE_LABELS[t] }))
const ZONE_OPTIONS = ZONES.map((z) => ({ value: z, label: ZONE_LABELS[z] }))

export function AltheriumCombatActions({
  campaignId, sheetId, character, genesis, inventory, state, onState, domainCheck, zoneDb, vitality, onDamage,
  espirito, determinationPoints, onPatch, action, onClose,
}: Props) {
  const weapons = useMemo(() => combatWeapons(inventory), [inventory])
  const [open, setOpen] = useState<Open | null>(null)
  // Troca a cada teste novo (Contra-ataque, Rolar de novo): a janela de teste recomeça.
  const [nonce, setNonce] = useState(0)

  // Ataque
  const [weaponId, setWeaponId] = useState<string>('')
  const weapon = weapons.find((w) => w.inventoryId === weaponId) ?? weapons.find((w) => !weaponIntegrity(w.integrity).broken) ?? weapons[0] ?? null
  const modes = weapon ? attackModes(weapon) : []
  const [modePick, setModePick] = useState<AttackMode>('corpo')
  const mode: AttackMode = modes.includes(modePick) ? modePick : (modes[0] ?? 'corpo')
  const [attrPick, setAttrPick] = useState<'furia' | 'impulso'>('furia')
  const [attackers, setAttackers] = useState(1)
  const [bands, setBands] = useState(0)
  const [enemyInTouch, setEnemyInTouch] = useState(false)
  const [allyNearTarget, setAllyNearTarget] = useState(false)

  // Defesa
  const [defMode, setDefMode] = useState<'defender' | 'aparar'>('defender')
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

  function launch(next: Open) {
    setOpen(next)
    setNonce((n) => n + 1)
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
    const integ = weaponIntegrity(w.integrity)
    if (integ.attack) flat.push({ label: 'Integridade', value: integ.attack })
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
    launch({ spec: attackSpec(w, m, counter), kind: 'attack', weapon: w, mode: m, counter })
  }

  // ── Defesa / Aparar ──
  function defenseSpec(): AltheriumTestSpec {
    const check = domainCheck('resiliencia')
    const flat: Modifier[] = [...check.flat]
    if (state.defend_total) flat.push({ label: 'Defender Total', value: 4 })
    const cond = conditionDefenseMod(state)
    if (cond) flat.push({ label: 'Derrubado', value: cond })
    return {
      ...check, title: 'Defesa', flat,
      diceMods: cover ? [{ label: 'Cobertura parcial', value: 1 }] : [],
      targetLabel: 'Ataque recebido', words: ['defendeu', 'foi atingido'],
      notes: ['Defender não gasta Reação. Empate favorece a defesa.'],
    }
  }

  function parrySpec(w: CombatWeapon): AltheriumTestSpec {
    const check = domainCheck('reflexo')
    const flat: Modifier[] = [...check.flat]
    if (hasProperty(w, 'defensiva')) flat.push({ label: 'Defensiva', value: 1 })
    if (hasProperty(w, 'lenta')) flat.push({ label: 'Lenta', value: -2 })
    if (hasReinforcement(w, 'empunhadura_couro')) flat.push({ label: 'Empunhadura de Couro', value: 1 })
    if (state.defend_total) flat.push({ label: 'Defender Total', value: 4 })
    return {
      ...check, title: `Aparar com ${w.name}`, flat,
      targetLabel: 'Ataque recebido', words: ['aparou', 'falhou'],
      notes: [`Gasta a Reação. Contra-ataque se superar o ataque por ${hasProperty(w, 'fluxo') ? 4 : 5} ou mais, ou no crítico.`],
    }
  }

  function openDefense() {
    launch({ kind: 'defense', spec: defenseSpec() })
  }

  function openParry() {
    if (!parryWeapon) return
    launch({ kind: 'parry', weapon: parryWeapon, spec: parrySpec(parryWeapon) })
  }

  function openInitiative() {
    const check = domainCheck('iniciativa')
    launch({ kind: 'initiative', spec: { ...check, title: 'Iniciativa', notes: ['A ordem é do maior para o menor resultado.'] } })
  }

  // ── Desgaste ──
  function wear(w: CombatWeapon, base: number) {
    const amount = weaponWear(w, base)
    if (amount > 0) void onPatch(w.inventoryId, { integrity: applyWear(w.integrity, amount) }).catch(() => {})
  }

  // ── Teste de Morte ──
  const turns = deathTurns(espirito)
  // Gênesis Determinado é a "outra fonte" que o livro cita: +1, com o total até +3.
  const baseBonus = determinationBonus(determinationPoints, genesis === 'determinado' ? 1 : 0)

  function openDeath() {
    const dying = state.dying ?? NEW_DYING
    const flat: Modifier[] = []
    if (dying.medicine) flat.push({ label: 'Medicina', value: dying.medicine })
    if (dying.nornas) flat.push({ label: 'Corda das Nornas', value: 1 })
    launch({
      kind: 'death',
      spec: {
        domainId: 'determinacao', domainLabel: 'Teste de Morte', attributeLabel: 'Determinação',
        attribute: bonusOnTurn(baseBonus, dying.rolls), baseDice: 1, disadvantage: null,
        title: `Teste de Morte (turno ${dying.rolls + 1} de ${turns})`, flat,
        targetLabel: 'DT', initialTarget: DEATH_DT, critSucceeds: true, noSituation: true,
        words: ['sobreviveu', 'falhou'],
        notes: [`1d10 + Determinação contra DT ${DEATH_DT}. 10 natural é sucesso automático, e aqui o 1 não anula nada.`],
      },
    })
  }

  // ── Condições ──
  function putCondition(id: ConditionId, turns?: number | null) {
    onState(addCondition(state, id, turns))
  }

  // ── Prévia da conta (o que a janela mostra antes de rolar) ──
  function previewOf(spec: AltheriumTestSpec) {
    const dm = (spec.diceMods ?? []).reduce((s, m) => s + m.value, 0)
    const pool = testPool({ baseDice: spec.baseDice, disadvantage: !!spec.disadvantage, situational: dm })
    const bonus = spec.attribute + (spec.flat ?? []).reduce((s, m) => s + m.value, 0)
    return { pool, bonus }
  }

  const close = () => { setOpen(null); onClose() }

  // A Iniciativa não tem ajuste: já abre o teste.
  useEffect(() => {
    if (action === 'initiative' && !open) openInitiative()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action])

  // Janela de teste (a conta com os dados 3D).
  if (open) {
    return (
      <AltheriumTestModal
        key={nonce}
        campaignId={campaignId} sheetId={sheetId} character={character} spec={open.spec}
        onClose={close}
        onRolled={({ reading, outcome }) => {
          if (open.kind === 'attack') {
            const next: Partial<CombatState> = {}
            if (!open.counter && state.aim) next.aim = false
            if (open.weapon && hasProperty(open.weapon, 'recarga')) next.unloaded = [...new Set([...state.unloaded, open.weapon.inventoryId])]
            if (Object.keys(next).length) patch(next)
          }
          if (open.kind === 'parry') patch({ reaction_used: true })
          // Desgaste da arma: errar com algum 1 nos dados (−10%), falha crítica na Defesa (−20%).
          if (open.kind === 'attack' && open.weapon && outcome && !outcome.success && reading.results.includes(1)) wear(open.weapon, 10)
          if (open.kind === 'defense' && defenseFumble(reading.kept) && parryWeapon) wear(parryWeapon, 20)
          if (open.kind === 'death') {
            patch({ dying: afterDeathRoll(state.dying ?? NEW_DYING, deathSuccess(reading.kept, reading.total), turns) })
          }
        }}
        after={(ctx) => (
          <AfterRoll ctx={ctx} open={open} character={character} campaignId={campaignId}
            onCondition={putCondition} onCounter={() => open.weapon && openAttack(true, open.weapon, 'corpo')}
            onWear={(w, base) => wear(w, base)} defendWeapon={parryWeapon} />
        )}
      />
    )
  }

  // ── Atacar ──
  if (action === 'attack') {
    const spec = weapon ? attackSpec(weapon, mode) : null
    const pv = spec ? previewOf(spec) : null
    const cantReach = mode === 'distancia' && rangePenalty(bands) === null
    const broken = !!weapon && weaponIntegrity(weapon.integrity).broken
    const unloaded = !!weapon && hasProperty(weapon, 'recarga') && state.unloaded.includes(weapon.inventoryId)
    return (
      <Win title="Atacar" subtitle={state.aim ? 'Mirar ativo (+2)' : undefined} onClose={onClose}>
        {weapons.length === 0 && <p className="alth-hint">Nenhuma arma no inventário.</p>}
        {weapon && spec && pv && (
          <>
            <ul className="alth-weapons" aria-label="Arma">
              {weapons.map((w) => {
                const band = integrityBand(w.integrity)
                return (
                  <li key={w.inventoryId}>
                    <button
                      type="button" aria-pressed={w.inventoryId === weapon.inventoryId}
                      className={`alth-weapon${w.inventoryId === weapon.inventoryId ? ' alth-weapon--on' : ''}`}
                      onClick={() => setWeaponId(w.inventoryId)}
                    >
                      <strong>{w.name}</strong>
                      <span>{w.damageDice} {DAMAGE_TYPE_LABELS[w.damageType]} · {WEAPON_RANGE_LABELS[w.range]}</span>
                      <span className={`alth-integrity alth-integrity--${band}`}>{w.integrity}%{band !== 'normal' ? ` · ${BAND_LABELS[band]}` : ''}</span>
                      <span className="alth-weapon__props">
                        {w.properties.map((p) => (
                          <span key={p.id} className="alth-inventory__prop" title={WEAPON_PROPERTIES[p.id].description}>{weaponPropertyLabel(p)}</span>
                        ))}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            {modes.length > 1 && (
              <Chips<AttackMode>
                label="Como ataca" value={mode} onChange={setModePick}
                options={modes.map((m) => ({ id: m, label: m === 'corpo' ? 'Corpo a corpo' : 'Arremessar', sub: m === 'corpo' ? 'Luta' : 'Precisão' }))}
              />
            )}
            {weapon.attribute === 'furia_impulso' && (
              <Chips<'furia' | 'impulso'>
                label="Atributo" value={attrPick} onChange={setAttrPick}
                options={[{ id: 'furia', label: 'Fúria', sub: 'brutal' }, { id: 'impulso', label: 'Impulso', sub: 'técnico' }]}
              />
            )}

            {mode === 'corpo' ? (
              <Field label="Atacantes em Toque do alvo" hint={`Cercar: ${signed(surroundBonus(attackers))} no ataque. O bônus só vale se todos estão engajados corpo a corpo.`}>
                <div className="alth-test__stepper">
                  <button type="button" onClick={() => setAttackers(Math.max(1, attackers - 1))} disabled={attackers <= 1} aria-label="Menos um atacante">−</button>
                  <span className="alth-test__stepper-value">{attackers}</span>
                  <button type="button" onClick={() => setAttackers(Math.min(8, attackers + 1))} disabled={attackers >= 8} aria-label="Mais um atacante">+</button>
                </div>
              </Field>
            ) : (
              <>
                <Field label="Faixas além do alcance da arma" hint="Cada faixa a mais tira 1 dado. Mais de 2 faixas: o ataque não alcança.">
                  <div className="alth-test__stepper">
                    <button type="button" onClick={() => setBands(Math.max(0, bands - 1))} disabled={bands <= 0} aria-label="Menos uma faixa">−</button>
                    <span className="alth-test__stepper-value">{bands}</span>
                    <button type="button" onClick={() => setBands(Math.min(3, bands + 1))} disabled={bands >= 3} aria-label="Mais uma faixa">+</button>
                  </div>
                </Field>
                <div className="alth-toggles">
                  {weapon.category === 'alcance' && <Toggle on={enemyInTouch} onChange={setEnemyInTouch} tone="bad" label="Inimigo em Toque de mim" delta="−1 dado" />}
                  <Toggle on={allyNearTarget} onChange={setAllyNearTarget} tone="bad" label="Alvo em Toque de um aliado" delta="−1 dado" hint="Se errar com algum 1, o tiro acerta o aliado mais próximo." />
                </div>
              </>
            )}

            {cantReach && <p className="alth-test__note alth-test__note--warn">Mais de 2 faixas além do alcance: o ataque não alcança.</p>}
            {broken && <p className="alth-test__note alth-test__note--warn">A arma está quebrada: repare na Forja.</p>}
            {unloaded && (
              <div className="alth-test__actions alth-test__actions--start">
                <p className="alth-hint">Descarregada.</p>
                <button type="button" className="btn btn-ghost"
                  onClick={() => patch({ unloaded: state.unloaded.filter((id) => id !== weapon.inventoryId) })}>
                  Recarregar ({weapon.properties.find((p) => p.id === 'recarga')?.action})
                </button>
              </div>
            )}

            <Formula
              dice={pv.pool.count} keep={pv.pool.keep} bonus={pv.bonus}
              note={`${spec.domainLabel} + ${spec.attributeLabel}${spec.extraDie ? ` · +1d${spec.extraDie.sides} ${spec.extraDie.label}` : ''}${(spec.flat ?? []).length ? ` · ${(spec.flat ?? []).map((m) => `${m.label} ${signed(m.value)}`).join(', ')}` : ''}`}
            />

            <div className="alth-test__actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button type="button" className="btn btn-primary alth-win__go" disabled={cantReach || broken || unloaded} onClick={() => openAttack()}>
                <Icon name="attack" /> Rolar ataque
              </button>
            </div>
          </>
        )}
      </Win>
    )
  }

  // ── Defender / Aparar ──
  if (action === 'defend') {
    const parrySp = parryWeapon ? parrySpec(parryWeapon) : null
    const sp = defMode === 'aparar' && parrySp ? parrySp : defenseSpec()
    const pv = previewOf(sp)
    const parryWhy = !parryWeapon ? 'Para Aparar é preciso empunhar uma arma corpo a corpo.'
      : !reactionOk ? 'Sem Reação: já foi usada ou está bloqueada.'
      : incomingRanged || incomingCrit ? 'Não dá para Aparar ataques à distância nem acertos críticos.' : null
    return (
      <Win title="Defender" subtitle={state.defend_total ? 'Defender Total ativo (+4)' : undefined} onClose={onClose}>
        <Chips<'defender' | 'aparar'>
          label="Como se defende" value={defMode} onChange={setDefMode}
          options={[
            { id: 'defender', label: 'Defender', sub: 'Resiliência + Espírito · sem Reação' },
            { id: 'aparar',   label: 'Aparar',   sub: 'Reflexo + Impulso · gasta a Reação' },
          ]}
        />
        {defMode === 'defender' ? (
          <div className="alth-toggles">
            <Toggle on={cover} onChange={setCover} tone="good" label="Cobertura parcial (muro baixo, árvore, carroça)" delta="+1 dado" />
          </div>
        ) : (
          <>
            {meleeWeapons.length > 1 && (
              <Field label="Arma para aparar">
                <Select value={parryWeapon?.inventoryId ?? ''} options={meleeWeapons.map((w) => ({ value: w.inventoryId, label: w.name }))} onChange={setParryId} aria-label="Arma para aparar" />
              </Field>
            )}
            <div className="alth-toggles">
              <Toggle on={incomingRanged} onChange={setIncomingRanged} label="O ataque é à distância" />
              <Toggle on={incomingCrit} onChange={setIncomingCrit} label="O ataque foi crítico" />
            </div>
            <p className={parryWhy ? 'alth-test__note alth-test__note--warn' : 'alth-hint'}>
              {parryWhy ?? 'Aparar gasta a Reação. Se falhar, sofre o dano normal +1d6.'}
            </p>
          </>
        )}
        <Formula dice={pv.pool.count} keep={pv.pool.keep} bonus={pv.bonus} note={`${sp.domainLabel} + ${sp.attributeLabel}${(sp.flat ?? []).length ? ` · ${(sp.flat ?? []).map((m) => `${m.label} ${signed(m.value)}`).join(', ')}` : ''}`} />
        <div className="alth-test__actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary alth-win__go" disabled={defMode === 'aparar' && !!parryWhy}
            onClick={() => (defMode === 'aparar' ? openParry() : openDefense())}>
            <Icon name={defMode === 'aparar' ? 'parry' : 'defend'} /> {defMode === 'aparar' ? 'Rolar Aparar' : 'Rolar Defesa'}
          </button>
        </div>
      </Win>
    )
  }

  // ── Receber dano ──
  if (action === 'damage') {
    return (
      <Win title="Receber dano" subtitle={`PV ${vitality}`} onClose={onClose}>
        <DamageCalculator inventory={inventory} zoneDb={zoneDb} dbMod={conditionDbMod(state)} vitality={vitality} onApply={onDamage}
          onArmorWear={(id) => { const i = inventory.find((x) => x.id === id); if (i) void onPatch(id, { integrity: applyWear(i.integrity ?? 100, 10) }).catch(() => {}) }} />
      </Win>
    )
  }

  // ── Estado Caído ──
  if (action === 'dying') {
    return (
      <Win title="Estado Caído" onClose={onClose}>
        <AltheriumDyingPanel
          state={state} turns={turns} baseBonus={baseBonus} espirito={espirito}
          onState={onState} onRoll={openDeath}
          campaignId={campaignId} sheetId={sheetId} character={character}
        />
      </Win>
    )
  }

  return null
}

// ────────────────────────────────────────────────────────
// Depois do resultado: dano e local (ataque), Tabela de Punição (defesa),
// Contra-ataque ou +1d6 (aparar), entrar na ordem de iniciativa.
// ────────────────────────────────────────────────────────

function AfterRoll({ ctx, open, character, campaignId, onCondition, onCounter, onWear, defendWeapon }: {
  ctx: AfterCtx; open: Open; character: string; campaignId: string
  onCondition: (id: ConditionId, turns?: number | null) => void
  onCounter: () => void
  onWear: (w: CombatWeapon, base: number) => void
  defendWeapon: CombatWeapon | null
}) {
  const [worn, setWorn] = useState(false)
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
      const { formula: dmg, notes: dmgNotes } = weaponDamageFormula(w, reading.crit)
      const dmgType = FULL_DAMAGE_LABELS[weaponDamageType(w)]
      const ignore = propertyValue(w, 'perfurante')
      const dmgExtra = [
        ...dmgNotes,
        ...(ignore ? [`ignora ${ignore} de DB`] : []),
        ...(hasReinforcement(w, 'cravos_ferro') && w.damageType === 'impacto' ? ['Cravos de Ferro: ignora 1 de DB'] : []),
      ]
      extras.push(
        <div key="hit" className="alth-test__actions alth-test__actions--start">
          <button type="button" className="btn btn-primary" disabled={busy}
            onClick={() => void rollAndSay(dmg, `Dano: ${w.name}`, (t) => `Dano ${dmg}: ${t} ${dmgType}${dmgExtra.length ? ` (${dmgExtra.join('; ')})` : ''}`)}>
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
        if (hasReinforcement(w, 'farpas_osso')) crit.push('Farpas de Osso: o alvo fica Sangrando.')
        extras.push(<p key="crit" className="alth-test__note">{crit.join(' ')}</p>)
      }
      if (anyOne && !outcome) {
        extras.push(
          <div key="wear" className="alth-test__actions alth-test__actions--start">
            <span className="alth-hint">Sem a Defesa do alvo o site não sabe se errou. Errou com um 1 nos dados?</span>
            <button type="button" className="btn btn-ghost" disabled={worn} onClick={() => { onWear(w, 10); setWorn(true) }}>
              {worn ? 'Arma desgastada' : `Errei: desgastar (−${weaponWear(w, 10)}%)`}
            </button>
          </div>,
        )
      }
    } else if (anyOne) {
      const bits = [`Errou com um 1 nos dados: ${w.name} perdeu ${weaponWear(w, 10)}% de Integridade.`]
      if (open.mode === 'distancia') bits.push('Se o alvo estava em Toque de um aliado, o tiro acerta o aliado mais próximo.')
      extras.push(<p key="one" className="alth-test__note alth-test__note--warn">{bits.join(' ')}</p>)
    }
  }

  if (open.kind === 'defense' && defenseFumble(reading.kept)) {
    extras.push(
      <div key="fumble" className="alth-combat__punish">
        <p className="alth-test__note alth-test__note--warn">
          Falha crítica na Defesa (1 natural): role na Tabela de Punição.
          {defendWeapon ? ` ${defendWeapon.name} perdeu ${weaponWear(defendWeapon, 20)}% de Integridade.` : ''}
        </p>
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

function DamageCalculator({ inventory, zoneDb, dbMod, vitality, onApply, onArmorWear }: {
  inventory: AltheriumInventoryItem[]
  zoneDb: Record<BodyZoneId, number>
  dbMod: number
  vitality: number
  onApply: (amount: number, zone: BodyZoneId | null) => void
  onArmorWear: (inventoryId: string) => void
}) {
  const [damage, setDamage] = useState('')
  const [type, setType] = useState<FullDamageType>('corte')
  const [zone, setZone] = useState<BodyZoneId>('db_tronco')
  const [ignore, setIgnore] = useState(0)
  const [vulnerable, setVulnerable] = useState(false)
  const [resistance, setResistance] = useState(0)
  const [immune, setImmune] = useState(false)
  const [applied, setApplied] = useState<string | null>(null)

  const piece = zoneArmor(inventory, zone)
  const dbNotes = [...(dbMod ? [`Arma Exposta ${dbMod}`] : []), ...piece.notes]
  const db = Math.max(0, zoneDb[zone] + dbMod + piece.delta)
  const value = Math.max(0, Math.trunc(Number(damage) || 0))
  const result = damage.trim() === '' ? null : applyDamage({
    damage: value, type, db, ignoreDb: ignore, vulnerable, resistance, immune,
    eryndorArmor: zoneHasEryndorArmor(inventory, zone),
  })

  return (
    <div className="alth-combat__form">
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
          <span className="alth-hint">DB {db}{dbNotes.length ? ` (${dbNotes.join(', ')})` : ''}</span>
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
                  if (result.armorWear && piece.armorId) onArmorWear(piece.armorId)
                  setApplied(vitality - result.final <= 0 ? 'PV chegou a 0: Estado Caído.' : 'Dano aplicado.')
                }}>
                Aplicar na ficha
              </button>
            </div>
            {applied && <p className="alth-hint">{applied}</p>}
          </>
        )}
      </div>
    </div>
  )
}
