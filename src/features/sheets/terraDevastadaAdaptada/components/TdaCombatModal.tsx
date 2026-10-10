import { useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { Select } from '../../../../shared/components/Select'
import { rollEvensTest } from '../../../dice/services/diceService'
import type { RollBreakdownItem, TdaCondition, TdaInventoryItem, TdaTrait } from '../../../../shared/types'
import { HEALTH_MAX, POOL_MAX, UNARMED } from '../constants/terraDevastadaAdaptada'
import { PRESET_CREATURES } from '../constants/tdaBestiary'
import {
  convictionCost,
  damageTaken,
  hitEffect,
  outcomeAgainst,
  plural,
  poolSize,
  type TestOutcome,
} from '../utils/tdaRules'
import { weaponReady, weaponType } from '../utils/tdaSupplies'
import { DiceTray, PoolPicker, picksNet, picksSummary, type Picks } from './TdaDice'
import { playRollSound } from './TdaTestModal'

// ────────────────────────────────────────────────────────
// Janela de combate. Dois usos:
//   atacar   — teste de pares contra a Defesa do alvo. Acertou: a arma tira
//              o dano fixo dela (1 a 6) da Resistência do alvo.
//   esquivar — teste de pares contra a Ferocidade de quem ataca. Esquivou:
//              nada. Empate: leva 1 a menos (mín. 1). Falhou: leva o dano
//              inteiro, que dá pra aplicar na Vida daqui mesmo.
// Convicção compra pontos de desempenho como em qualquer teste; e, num golpe
// que derrubaria, "Última chance" gasta Convicção pra ficar com 1 de Vida.
// Golpe furtivo (Atacar, alvo que não viu você, Alerta até 1, corpo a corpo):
// sem rolagem. Derruba em silêncio quem tem Resistência até 2, ou até 3 com
// a faca improvisada (que se gasta); mais que isso, só causa o dano.
// ────────────────────────────────────────────────────────

export type TdaCombatMode = 'atacar' | 'esquivar'

const MODES: { id: TdaCombatMode; label: string; hint: string }[] = [
  { id: 'atacar',   label: 'Atacar',   hint: 'Marque o que ajuda (+) e o que atrapalha (−). A arma não soma dados: ela decide quanto dano tira se você acertar.' },
  { id: 'esquivar', label: 'Esquivar', hint: 'Marque o que ajuda (+) e o que atrapalha (−). Proteções somam dados ao se defender.' },
]

const CUSTOM = 'custom'
const UNARMED_ID = 'unarmed'

interface TdaCombatModalProps {
  campaignId:   string
  who:          string
  traits:       TdaTrait[]
  conditions:   TdaCondition[]
  inventory:    TdaInventoryItem[]
  health:       number
  horror:       number
  conviction:   number
  initialMode?: TdaCombatMode
  onHealth:     (value: number) => void
  onConviction: (delta: number) => void
  /** Um ataque com a arma gasta uma bala, um uso ou uma unidade. */
  onUseWeapon:  (weaponId: string) => void
  /** Gasta uma unidade de um item (a faca improvisada do golpe furtivo). */
  onUseItem?:   (itemId: string) => void
  /** Alerta da cena (0 a 3): a partir de 2 não dá mais pra surpreender. */
  alertLevel?:  number
  onAnnounce:   (message: string) => void
  onClose:      () => void
}

interface Rolled {
  results:   number[]
  bonus:     number[]
  evens:     number
  dice:      number
  preBoost:  number
  isPrivate: boolean
  /** A arma de quando rolou (o ataque pode ter gasto a última unidade). */
  weaponName:   string
  weaponDamage: number
}

interface SneakResult {
  weaponName: string
  damage:     number
  kills:      boolean
  remaining:  number
  usedShiv:   boolean
}

export function TdaCombatModal({
  campaignId, who, traits, conditions, inventory, health, horror, conviction,
  initialMode = 'atacar', onHealth, onConviction, onUseWeapon, onUseItem, alertLevel = 0, onAnnounce, onClose,
}: TdaCombatModalProps) {
  const [mode, setMode]           = useState<TdaCombatMode>(initialMode)
  const [targetId, setTargetId]   = useState(PRESET_CREATURES[0].id)
  const [stats, setStats]         = useState(() => statsOf(PRESET_CREATURES[0].id))
  const weapons = inventory.filter((i) => i.kind === 'arma' && i.name.trim())
  const [weaponId, setWeaponId]   = useState(weapons[0]?.id ?? UNARMED_ID)
  const [picks, setPicks]         = useState<Picks>({})
  const [situation, setSituation] = useState(0)
  const [boost, setBoost]         = useState(0)
  const [isPrivate, setIsPrivate] = useState(false)
  const [rolling, setRolling]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [rolled, setRolled]       = useState<Rolled | null>(null)
  const [postBoost, setPostBoost] = useState(0)
  const [applied, setApplied]     = useState(false)
  const [sneak, setSneak]         = useState(false)
  const [useShiv, setUseShiv]     = useState(false)
  const [sneakResult, setSneakResult] = useState<SneakResult | null>(null)

  const cost = convictionCost(horror)
  const pool = poolSize(picksNet(picks, situation))
  const info = MODES.find((m) => m.id === mode)!
  const targetName = targetId === CUSTOM ? 'um alvo' : PRESET_CREATURES.find((c) => c.id === targetId)?.name ?? 'um alvo'

  const weapon = weapons.find((w) => w.id === weaponId)
  const weaponName = weapon?.name.trim() ?? UNARMED.name
  const weaponDamage = clampDamage(weapon ? weapon.level || 1 : UNARMED.damage)
  const ready = weapon ? weaponReady(weapon) : { ok: true, reason: null }
  const shownDamage = rolled?.weaponDamage ?? weaponDamage
  const shownWeapon = rolled?.weaponName ?? weaponName
  const weaponKind = weapon ? weaponType(weapon) : 'corpo'
  const shivItem = inventory.find((i) => i.kind === 'item' && i.qty > 0 && /faca improvisada/i.test(i.name))
  const sneakBlock = alertLevel >= 2 ? 'O Alerta está alto: não dá mais pra surpreender.'
    : weaponKind !== 'corpo' ? 'Arma de fogo ou arremesso faz barulho demais.'
    : !ready.ok ? ready.reason
    : null
  const sneakOn = mode === 'atacar' && sneak && !sneakBlock

  const meta = mode === 'atacar' ? stats.defense : stats.ferocity
  const performance = rolled ? rolled.evens + rolled.preBoost + postBoost : 0
  const outcome: TestOutcome | null = rolled ? outcomeAgainst(performance, meta) : null
  const hit = hitEffect(shownDamage, stats.toughness)
  const taken = outcome ? damageTaken(outcome, stats.damage) : 0
  const wouldDrop = taken > 0 && taken >= health

  function statsOf(id: string) {
    const p = PRESET_CREATURES.find((c) => c.id === id)
    return p
      ? { damage: p.damage, toughness: p.toughness, defense: p.defense, ferocity: p.ferocity }
      : { damage: 1, toughness: 1, defense: 1, ferocity: 1 }
  }

  function pickTarget(id: string) {
    setTargetId(id)
    if (id !== CUSTOM) setStats(statsOf(id))
  }

  function setStat(key: keyof typeof stats, value: number, min: number, max: number) {
    setTargetId(CUSTOM)
    setStats((prev) => ({ ...prev, [key]: Math.max(min, Math.min(max, value)) }))
  }

  async function roll() {
    setError(null)
    if (boost * cost > conviction) { setError('Convicção insuficiente.'); return }
    if (mode === 'atacar' && !ready.ok) { setError(`${ready.reason} Troque de arma.`); return }
    setRolling(true)
    try {
      const result = await rollEvensTest(campaignId, pool.dice, { conviction: boost, isPrivate })
      const evens = result.roll_breakdown?.find(
        (b): b is Extract<RollBreakdownItem, { type: 'evens' }> => b.type === 'evens',
      )
      if (!evens) throw new Error('Não foi possível ler a rolagem.')
      if (boost > 0) onConviction(-boost * cost)
      const used = mode === 'atacar' && weapon ? weapon : null
      if (used) onUseWeapon(used.id)
      setRolled({
        results: evens.results, bonus: evens.bonus, evens: evens.subtotal,
        dice: evens.quantity, preBoost: boost, isPrivate,
        weaponName, weaponDamage: mode === 'atacar' ? weaponDamage : 0,
      })
      playRollSound()
      if (!isPrivate) onAnnounce(rollMessage(evens.quantity, evens.subtotal + boost, boost))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível rolar.')
    } finally {
      setRolling(false)
    }
  }

  function rollMessage(dice: number, total: number, pre: number): string {
    const { plus, minus } = picksSummary(picks, traits, conditions, inventory)
    const parts = [
      ...(plus.length ? [`+ ${plus.join(', ')}`] : []),
      ...(minus.length ? [`− ${minus.join(', ')}`] : []),
      ...(situation ? [`situação ${situation > 0 ? '+' : ''}${situation}`] : []),
    ]
    const used = parts.length ? ` (${parts.join('; ')})` : ''
    const conv = pre > 0 ? ` (${pre} com Convicção)` : ''
    const result = outcomeAgainst(total, meta)
    if (mode === 'atacar') {
      const dmg = result === 'falha' ? 'errou' : `${weaponDamage} de dano`
      return truncate(`${who} atacou ${targetName} com ${weaponName} (${dice}d${used}): desempenho ${total}${conv} contra defesa ${meta}, ${outcomeWord(result)}; ${dmg}.${weaponNote()}`, 500)
    }
    const dmg = damageTaken(result, stats.damage)
    return truncate(`${who} tentou esquivar de ${targetName} (${dice}d${used}): desempenho ${total}${conv} contra ferocidade ${meta}, ${outcomeWord(result)}; ${dmg > 0 ? `leva ${dmg} de dano` : 'desvia do golpe'}.`, 500)
  }

  /** O que sobra da arma depois do ataque (munição, usos, unidades). */
  function weaponNote(): string {
    if (!weapon) return ''
    const type = weaponType(weapon)
    if (type === 'fogo') {
      const left = Math.max(0, (weapon.ammo ?? 0) - 1)
      return left === 0 ? ' Acabou a munição.' : ` Restam ${plural(left, 'bala', 'balas')}.`
    }
    if (type === 'corpo') {
      const left = Math.max(0, (weapon.dur ?? 0) - 1)
      return left === 0 ? ` ${weaponName} quebrou!` : ''
    }
    return weapon.qty <= 1 ? ` Acabou: ${weaponName}.` : ` Restam ${weapon.qty - 1}.`
  }

  function spendAfter() {
    if (!rolled || conviction < cost) return
    onConviction(-cost)
    const next = postBoost + 1
    setPostBoost(next)
    if (!rolled.isPrivate) {
      const total = rolled.evens + rolled.preBoost + next
      onAnnounce(`${who} usou Convicção (−${cost}): desempenho agora ${total}, ${outcomeWord(outcomeAgainst(total, meta))}.`)
    }
  }

  function applyDamage() {
    if (applied || taken <= 0) return
    const next = Math.max(0, health - taken)
    onHealth(next)
    if (!rolled?.isPrivate) {
      onAnnounce(`${who} levou ${taken} de dano: Vida ${next}/${HEALTH_MAX}${next === 0 ? ' (caído)' : ''}.`)
    }
    setApplied(true)
  }

  function lastChance() {
    if (applied || conviction < cost) return
    onConviction(-cost)
    onHealth(1)
    if (!rolled?.isPrivate) {
      onAnnounce(`${who} gastou ${cost} de Convicção e resistiu ao golpe de ${taken}: Vida 1/${HEALTH_MAX}.`)
    }
    setApplied(true)
  }

  function sneakStrike() {
    if (!sneakOn) return
    const usedShiv = useShiv && !!shivItem
    const silentLimit = usedShiv ? 3 : 2
    const kills = stats.toughness <= silentLimit || hit.kills
    const remaining = Math.max(0, stats.toughness - weaponDamage)
    if (weapon) onUseWeapon(weapon.id)
    if (usedShiv && shivItem && onUseItem) onUseItem(shivItem.id)
    setSneakResult({ weaponName: usedShiv ? 'a faca improvisada' : weaponName, damage: weaponDamage, kills, remaining, usedShiv })
    const how = usedShiv ? 'a faca improvisada' : weaponName
    onAnnounce(truncate(`${who} atacou ${targetName} pelas costas com ${how}: ${kills ? 'abatido em silêncio' : `${weaponDamage} de dano, mas ele não cai (resistência ${remaining})`}.`, 500))
  }

  function reset() {
    setSneakResult(null)
    setRolled(null)
    setPostBoost(0)
    setApplied(false)
    setBoost(0)
    setError(null)
  }

  const targetOptions = [
    ...PRESET_CREATURES.map((c) => ({ value: c.id, label: `${c.name} (dano ${c.damage})` })),
    { value: CUSTOM, label: 'Outro (números à mão)' },
  ]
  const weaponOptions = [
    { value: UNARMED_ID, label: `${UNARMED.name} (dano ${UNARMED.damage})` },
    ...weapons.map((w) => ({ value: w.id, label: `${w.name.trim()} (dano ${clampDamage(w.level || 1)}${stockLabel(w)})` })),
  ]

  return (
    <ModalOverlay onClose={onClose} closeDisabled={rolling}>
      <div className="alth-modal__window tda-modal tda-combat" role="dialog" aria-modal="true" aria-labelledby="tda-combat-title">
        <header className="alth-modal__header">
          <h4 id="tda-combat-title" className="alth-modal__title tda-modal__title">{info.label}</h4>
          <button type="button" className="modal-close" onClick={onClose} disabled={rolling} aria-label="Fechar">×</button>
        </header>

        <div className="tda-modal__body">
          {!rolled && !sneakResult && (
            <>
              <div className="tda-segmented" role="radiogroup" aria-label="Tipo de ação">
                {MODES.map((m) => (
                  <button
                    key={m.id} type="button" role="radio" aria-checked={mode === m.id}
                    className={`tda-segmented__btn${mode === m.id ? ' tda-segmented__btn--active' : ''}`}
                    onClick={() => setMode(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="tda-field">
                <span className="tda-label">{mode === 'atacar' ? 'Alvo' : 'Quem ataca você'}</span>
                <Select
                  listClassName="tda-select-list"
                  value={targetId} onChange={pickTarget} options={targetOptions}
                  aria-label={mode === 'atacar' ? 'Alvo' : 'Quem ataca'}
                />
              </div>

              {mode === 'atacar' ? (
                <>
                  <div className="tda-field">
                    <span className="tda-label">Arma</span>
                    <Select
                      listClassName="tda-select-list"
                      value={weaponId} onChange={setWeaponId} options={weaponOptions} aria-label="Arma"
                    />
                    {weapon && (
                      <span className={ready.ok ? 'tda-hint' : 'tda-warn'}>
                        {ready.ok ? stockText(weapon) : `${ready.reason} Troque de arma.`}
                      </span>
                    )}
                    {weapons.length === 0 && (
                      <span className="tda-hint">Sem armas no inventário: vão as mãos nuas. Adicione armas na aba Inventário.</span>
                    )}
                  </div>
                  <div className="tda-field">
                    <span className="tda-label">Resistência do alvo</span>
                    <Stepper value={stats.toughness} min={1} max={12} label="Resistência" onChange={(v) => setStat('toughness', v, 1, 12)} />
                    <span className="tda-hint">O dano da arma ({weaponDamage}) é comparado com a Resistência: igual ou maior mata de um golpe.</span>
                  </div>
                  <div className="tda-field">
                    <label className="tda-check">
                      <input type="checkbox" checked={sneak} disabled={!!sneakBlock && !sneak}
                        onChange={(e) => setSneak(e.target.checked)} />
                      Golpe furtivo (o alvo não viu você)
                    </label>
                    {sneak && sneakBlock && <span className="tda-warn">{sneakBlock} Vale o ataque normal.</span>}
                    {!sneak && sneakBlock && <span className="tda-hint">{sneakBlock}</span>}
                    {sneakOn && (
                      <>
                        <span className="tda-hint">
                          Sem rolagem: derruba em silêncio quem tem Resistência até 2 (ou até 3 com a faca improvisada).
                          Mais forte que isso, só leva o dano da arma.
                        </span>
                        {shivItem && (
                          <label className="tda-check">
                            <input type="checkbox" checked={useShiv} onChange={(e) => setUseShiv(e.target.checked)} />
                            Usar a faca improvisada (gasta 1; você tem {shivItem.qty})
                          </label>
                        )}
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="tda-field">
                  <span className="tda-label">Dano do golpe</span>
                  <Stepper value={stats.damage} min={1} max={HEALTH_MAX} label="Dano" onChange={(v) => setStat('damage', v, 1, HEALTH_MAX)} />
                </div>
              )}

              {!sneakOn && (<>
              <div className="tda-field">
                <span className="tda-label">{mode === 'atacar' ? 'Defesa do alvo (meta)' : 'Ferocidade (meta)'}</span>
                <div className="tda-meta" role="radiogroup" aria-label="Meta">
                  {Array.from({ length: POOL_MAX }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n} type="button" role="radio" aria-checked={meta === n}
                      className={`tda-meta__btn${meta === n ? ' tda-meta__btn--active' : ''}`}
                      onClick={() => setStat(mode === 'atacar' ? 'defense' : 'ferocity', n, 1, 6)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <PoolPicker
                traits={traits} conditions={conditions}
                inventory={mode === 'esquivar' ? inventory : []}
                picks={picks} onPicks={setPicks}
                situation={situation} onSituation={setSituation}
                hint={info.hint}
              />

              <div className="tda-field">
                <span className="tda-label">Convicção antes de rolar</span>
                <div className="tda-boost">
                  <div className="tda-stepper">
                    <button
                      type="button" className="tda-stepper__btn" aria-label="Menos um ponto de Convicção"
                      onClick={() => setBoost(Math.max(0, boost - 1))} disabled={boost <= 0}
                    >
                      −
                    </button>
                    <span className="tda-stepper__value">+{boost}</span>
                    <button
                      type="button" className="tda-stepper__btn" aria-label="Mais um ponto de Convicção"
                      onClick={() => setBoost(boost + 1)}
                      disabled={(boost + 1) * cost > conviction || boost >= 10}
                    >
                      +
                    </button>
                  </div>
                  <span className="tda-hint">
                    Cada ponto garantido custa {cost} de Convicção (o seu Horror). Você tem {conviction}.
                    {boost > 0 && ` Vai gastar ${boost * cost}.`}
                  </span>
                </div>
              </div>

              <label className="tda-check">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                Rolagem privada (só você e o Narrador veem, sem aviso no chat)
              </label>

              </>)}

              {error && <p className="tda-warn" role="alert">{error}</p>}

              <div className="tda-actions">
                <button type="button" className="tda-btn" onClick={onClose} disabled={rolling}>Cancelar</button>
                {sneakOn ? (
                  <button type="button" className="tda-btn tda-btn--primary" onClick={sneakStrike}>Golpe furtivo</button>
                ) : (
                  <button type="button" className="tda-btn tda-btn--primary" onClick={() => void roll()}
                    disabled={rolling || (mode === 'atacar' && !ready.ok)}>
                    {rolling ? 'Rolando…' : `Rolar ${pool.dice}d`}
                  </button>
                )}
              </div>
            </>
          )}

          {sneakResult && (
            <>
              <div className="tda-result tda-result--sucesso" role="status">
                <span className="tda-result__label">Golpe furtivo</span>
                <strong className="tda-result__outcome">
                  {sneakResult.kills
                    ? `${capitalize(targetName)} cai em silêncio${sneakResult.usedShiv ? ' (a faca foi gasta)' : ''}.`
                    : `${sneakResult.damage} de dano com ${sneakResult.weaponName}, mas ${targetName} não cai: resistência de ${stats.toughness} vai a ${sneakResult.remaining}. Ele reage e o Alerta pode subir.`}
                </strong>
              </div>
              <div className="tda-actions">
                <button type="button" className="tda-btn" onClick={reset}>Nova ação</button>
                <button type="button" className="tda-btn tda-btn--primary" onClick={onClose}>Fechar</button>
              </div>
            </>
          )}

          {rolled && outcome && (
            <>
              <DiceTray results={rolled.results} bonus={rolled.bonus} />
              {rolled.bonus.length > 0 && (
                <p className="tda-hint tda-hint--center">
                  Golpe de sorte! {plural(rolled.bonus.length, 'dado extra', 'dados extras')} por causa dos 6.
                </p>
              )}

              <div className={`tda-result tda-result--${outcome}`} role="status">
                <span className="tda-result__number">{performance}</span>
                <span className="tda-result__label">
                  {performance === 1 ? 'ponto' : 'pontos'} contra {mode === 'atacar' ? 'defesa' : 'ferocidade'} {meta}
                  {(rolled.preBoost + postBoost) > 0 && ` (${plural(rolled.evens, 'par', 'pares')} + ${rolled.preBoost + postBoost} de Convicção)`}
                </span>
                {mode === 'atacar' ? (
                  <strong className="tda-result__outcome">
                    {outcome === 'falha' && 'Errou. Fazer barulho ou se expor é com o Narrador.'}
                    {outcome !== 'falha' && (
                      <>
                        {outcome === 'parcial' ? 'Acertou, mas se expõe: ' : 'Acertou: '}
                        {shownDamage} de dano com {shownWeapon}. {hit.kills
                          ? `Mata (resistência ${stats.toughness}).`
                          : `Resistência de ${stats.toughness} cai para ${hit.remaining} (anote).`}
                      </>
                    )}
                  </strong>
                ) : (
                  <strong className="tda-result__outcome">
                    {taken === 0 && 'Desviou do golpe.'}
                    {taken > 0 && outcome === 'parcial' && `Esquiva parcial: leva ${taken} de dano (1 a menos).`}
                    {taken > 0 && outcome === 'falha' && `Não escapou: leva ${taken} de dano.`}
                  </strong>
                )}
              </div>

              {!applied && (
                <div className="tda-actions tda-actions--center">
                  <button type="button" className="tda-btn" onClick={spendAfter} disabled={conviction < cost}>
                    +1 com Convicção (−{cost})
                  </button>
                </div>
              )}
              {!applied && conviction < cost && (
                <p className="tda-hint tda-hint--center">Convicção insuficiente para mais um ponto (você tem {conviction}, precisa de {cost}).</p>
              )}

              {mode === 'esquivar' && taken > 0 && (
                <div className="tda-damage">
                  <p className="tda-hint tda-hint--center">
                    Vida {health}/{HEALTH_MAX}
                    {!applied && ` → ${Math.max(0, health - taken)}/${HEALTH_MAX}`}.
                    {!applied && taken >= 3 && ' Um golpe desses pode pedir uma Cena de horror.'}
                  </p>
                  {!applied && wouldDrop && (
                    <p className="tda-warn tda-hint--center">
                      {taken >= HEALTH_MAX ? 'Golpe fatal.' : 'O golpe derruba.'}
                      {conviction >= cost
                        ? ` Última chance: gaste ${cost} de Convicção e fique com 1 de Vida.`
                        : ` Sem Convicção pra uma última chance (precisa de ${cost}).`}
                    </p>
                  )}
                  {!applied && (
                    <div className="tda-actions tda-actions--center">
                      <button type="button" className="tda-btn tda-btn--danger" onClick={applyDamage}>
                        Aplicar {taken} de dano
                      </button>
                      {wouldDrop && conviction >= cost && (
                        <button type="button" className="tda-btn tda-btn--primary" onClick={lastChance}>
                          Última chance (−{cost} Convicção)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="tda-actions">
                <button type="button" className="tda-btn" onClick={reset}>Nova ação</button>
                <button type="button" className="tda-btn tda-btn--primary" onClick={onClose}>Fechar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  )
}

function Stepper({ value, min, max, label, onChange }: {
  value: number; min: number; max: number; label: string; onChange: (value: number) => void
}) {
  return (
    <div className="tda-stepper">
      <button type="button" className="tda-stepper__btn" aria-label={`Menos um de ${label}`}
        onClick={() => onChange(value - 1)} disabled={value <= min}>−</button>
      <span className="tda-stepper__value">{value}</span>
      <button type="button" className="tda-stepper__btn" aria-label={`Mais um de ${label}`}
        onClick={() => onChange(value + 1)} disabled={value >= max}>+</button>
    </div>
  )
}

/** " · 4 balas", " · 3 usos" ou " · x2" pro rótulo da lista de armas. */
function stockLabel(w: TdaInventoryItem): string {
  const type = weaponType(w)
  if (type === 'fogo') return ` · ${plural(w.ammo ?? 0, 'bala', 'balas')}`
  if (type === 'corpo') return ` · ${plural(w.dur ?? 0, 'uso', 'usos')}`
  return ` · x${w.qty}`
}

function stockText(w: TdaInventoryItem): string {
  const type = weaponType(w)
  if (type === 'fogo') return `Cada ataque gasta 1 bala. Restam ${plural(w.ammo ?? 0, 'bala', 'balas')}.`
  if (type === 'corpo') return `Cada ataque gasta 1 uso. Restam ${plural(w.dur ?? 0, 'uso', 'usos')} antes de quebrar.`
  return `Cada uso gasta 1 unidade. Você tem ${w.qty}.`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function clampDamage(value: number): number {
  return Math.max(1, Math.min(6, Math.round(value) || 1))
}

function outcomeWord(o: TestOutcome): string {
  return o === 'sucesso' ? 'sucesso' : o === 'parcial' ? 'sucesso parcial' : 'falha'
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}
