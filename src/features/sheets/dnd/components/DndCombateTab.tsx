import { useState } from 'react'
import { Select } from '../../../../shared/components/Select'
import type { DndCharacterAttack } from '../../../../shared/types'
import { CONDITIONS, EXHAUSTION, WEAPONS, getWeapon } from '../catalog'
import { hitDiceAvailable, hitDieHealing, spendHitDie } from '../rules/rest'
import { armorWarning, attackFor, strengthWarning } from '../model/sheetModel'
import { formatSigned } from '../model/format'
import { createDndAttack, deleteDndAttack, updateDndAttack } from '../services/dndSheetService'
import { DerivedField, NumberField, Pips } from './DndControls'
import { ChipRow, StatChip, StatusPill } from './DndVisuals'
import { DndDragBar } from './DndDragBar'
import type { SheetCtx } from './sheetContext'
import { RollButton } from '../rolls/RollButton'
import { useDndRoll } from '../rolls/DndRollProvider'
import { attackCheck, critDamage, damageFormulaOf, deathCheck, deathResult, initiativeCheck } from '../rolls/checkModel'
import { parseDiceFormula } from '../../../dice/services/diceService'

// ────────────────────────────────────────────────────────
// Aba Combate: PV (dano, cura, PV temporários, salvaguardas contra a morte,
// dados de vida), defesa (armadura e escudo equipados), condições, exaustão,
// concentração e ataques com arma. As contas de ataque saem do motor.
// ────────────────────────────────────────────────────────

const WEAPON_OPTIONS = [{ value: '', label: 'Escolher uma arma' }, ...WEAPONS.map((w) => ({ value: w.key, label: w.name }))]

/** A fórmula de dano dá para rolar? ("1d8+3" sim; "especial" não) */
function validFormula(f: string): boolean {
  try { parseDiceFormula(f.replace(/\s/g, '')); return true } catch { return false }
}

export function DndCombateTab({ ctx }: { ctx: SheetCtx }) {
  const { form, set, update, derived, data, sheet, readOnly, gear, prof, report } = ctx
  const hpMax = derived.hpMax ?? form.hp_max
  const hp = Math.max(0, Math.min(hpMax, form.hp_current))
  const [amount, setAmount] = useState(1)
  const [lastRoll, setLastRoll] = useState<string | null>(null)
  const [weaponKey, setWeaponKey] = useState('')
  const [customName, setCustomName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const roller = useDndRoll()
  const [critReady, setCritReady] = useState<Record<string, boolean>>({})
  const [freeText, setFreeText] = useState('')
  const freeFormula = damageFormulaOf(freeText)
  const freeOk = freeFormula !== '' && validFormula(freeFormula)

  function rollDeath() {
    roller.check(deathCheck(), {
      onResult: ({ reading }) => {
        const r = deathResult(reading.natural, reading.total, form.death_save_successes, form.death_save_failures)
        update((f) => ({ ...f, death_save_successes: r.successes, death_save_failures: r.failures, hp_current: r.revive ? Math.max(1, f.hp_current) : f.hp_current }))
      },
    })
  }

  function rollAttack(a: DndCharacterAttack, view: ReturnType<typeof attackFor>, bonusText: string) {
    const manual = Number.parseInt(bonusText.replace(/\s/g, ''), 10)
    const total = Number.isFinite(manual) ? manual : view?.attack.attackBonus ?? 0
    const ability = view?.attack.ability ?? 'strength'
    const spec = view
      ? attackCheck(a.name, a.catalog_entry_key ?? a.id, ability, derived.abilityMods[ability], view.proficient ? derived.proficiencyBonus : null, total)
      : { ...attackCheck(a.name, a.id, ability, 0, null, total), tiles: [{ id: 'bonus', label: 'Bônus de ataque', value: total, badge: '+' }] }
    roller.check(spec, { onResult: ({ crit }) => setCritReady((m) => ({ ...m, [a.id]: crit === 'crit' })) })
  }

  function rollFree(crit: boolean) {
    if (!freeOk) return
    void roller.roll(crit ? 'Rolagem livre (crítico)' : 'Rolagem livre', crit ? critDamage(freeFormula) : freeFormula, { kind: 'damage', key: 'free' })
  }

  function rollDamage(a: DndCharacterAttack, formula: string, damageType: string | null | undefined, forceCrit = false) {
    const crit = forceCrit || !!critReady[a.id]
    const clean = damageFormulaOf(formula)
    void roller.roll(`${crit ? 'Dano crítico' : 'Dano'}: ${a.name}${damageType ? ` (${damageType})` : ''}`, crit ? critDamage(clean) : clean, { kind: 'damage', key: a.catalog_entry_key ?? a.id })
    if (crit) setCritReady((m) => ({ ...m, [a.id]: false }))
  }

  const armorMsg = armorWarning(gear, prof.armor)
  const strMsg = strengthWarning(gear, form.strength)
  const exhaustionLevel = EXHAUSTION.levels.find((l) => l.level === form.exhaustion)
  const activeConditions = CONDITIONS.filter((c) => form.conditions.includes(c.key as never))

  function damage(n: number) {
    if (readOnly || n <= 0) return
    let left = n
    const absorbed = Math.min(form.hp_temp, left)
    left -= absorbed
    update((f) => ({ ...f, hp_temp: f.hp_temp - absorbed, hp_current: Math.max(0, hp - left) }))
  }

  function heal(n: number) {
    if (readOnly || n <= 0) return
    update((f) => ({ ...f, hp_current: Math.min(hpMax, hp + n), death_save_successes: 0, death_save_failures: 0 }))
  }

  async function spendDie(die: number) {
    if (readOnly) return
    const next = spendHitDie(derived.hitDice, form.hit_dice_used, die)
    if (!next) return
    // com a mesa: o dado cai na bandeja e fica no histórico; sem campanha, sorteio local
    const rolled = roller.canRoll ? await roller.roll(`Dado de vida (d${die})`, `1d${die}`, { kind: 'hit_die' }) : null
    if (roller.canRoll && !rolled) return
    const roll = rolled ? rolled.result : 1 + Math.floor(Math.random() * die)
    const gained = hitDieHealing(roll, derived.abilityMods.constitution)
    update((f) => ({ ...f, hit_dice_used: next, hp_current: Math.min(hpMax, Math.max(0, f.hp_current) + gained) }))
    setLastRoll(`d${die}: ${roll} ${derived.abilityMods.constitution >= 0 ? '+' : '−'} ${Math.abs(derived.abilityMods.constitution)} = ${gained} PV recuperados`)
  }

  function toggleCondition(key: (typeof CONDITIONS)[number]['key']) {
    if (readOnly) return
    update((f) => ({
      ...f,
      conditions: f.conditions.includes(key as never) ? f.conditions.filter((c) => c !== key) : [...f.conditions, key as never],
    }))
  }

  async function run(key: string, job: () => Promise<void>) {
    setBusy(key)
    report(null)
    try { await job() } catch (err) { report(err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.') } finally { setBusy(null) }
  }

  const addAttack = () => run('new', async () => {
    const weapon = weaponKey ? getWeapon(weaponKey) : undefined
    const name = (weapon?.name ?? customName).trim()
    if (!name) { report('Escolha uma arma do catálogo ou escreva o nome do ataque.'); return }
    const saved = await createDndAttack(sheet.id, {
      name, attack_bonus: '', damage: '', damage_type: weapon?.damageType ?? '', notes: '',
      catalog_entry_key: weapon?.key ?? null, sort_order: data.details.attacks.length,
    })
    data.setDetails((d) => ({ ...d, attacks: [...d.attacks, saved] }))
    setWeaponKey(''); setCustomName('')
  })

  const patchAttack = (a: DndCharacterAttack, patch: Partial<Pick<DndCharacterAttack, 'attack_bonus' | 'damage' | 'notes'>>) =>
    run(a.id, async () => {
      const saved = await updateDndAttack(a.id, patch)
      data.setDetails((d) => ({ ...d, attacks: d.attacks.map((x) => (x.id === saved.id ? saved : x)) }))
    })

  const removeAttack = (a: DndCharacterAttack) => run(a.id, async () => {
    await deleteDndAttack(a.id)
    data.setDetails((d) => ({ ...d, attacks: d.attacks.filter((x) => x.id !== a.id) }))
  })

  const diePool = Object.entries(derived.hitDice).map(([die, total]) => ({ die: Number(die), total })).sort((a, b) => b.die - a.die)

  return (
    <div className="dsh-tab dsh-personagem anim-tab-panel">
      <section className="dsh-card">
        <div className="dsh-card__header">
          <h4 className="dsh-card__title">Pontos de vida</h4>
          <span className="dsh-badge">{hp} / {hpMax}{form.hp_temp ? ` (+${form.hp_temp})` : ''}</span>
        </div>
        <div className="dsh-trio">
          <label className="dsh-field dsh-field--tile dsh-hptile"><span className="dsh-label">Atuais</span>
            <NumberField value={hp} onChange={(n) => set('hp_current', n)} min={0} max={hpMax} label="PV atuais" disabled={readOnly} className="dsh-num--field" /></label>
          <div className="dsh-field dsh-field--tile dsh-hptile dsh-hptile--max"><span className="dsh-label">Máximo</span>
            {derived.hpMax != null
              ? <DerivedField ctx={ctx} field="hp_max" value={derived.hpMax} label="PV máximo" min={1} max={9999} />
              : <NumberField value={form.hp_max} onChange={(n) => set('hp_max', n)} min={1} max={9999} label="PV máximo" disabled={readOnly} className="dsh-num--field" />}
          </div>
          <label className="dsh-field dsh-field--tile dsh-hptile dsh-hptile--temp"><span className="dsh-label">Temporários</span>
            <NumberField value={form.hp_temp} onChange={(n) => set('hp_temp', n)} min={0} max={9999} label="PV temporários" disabled={readOnly} className="dsh-num--field" /></label>
        </div>
        <DndDragBar value={hp} max={hpMax} temp={form.hp_temp} onChange={({ hp: nextHp, temp }) => update((f) => ({ ...f, hp_current: nextHp, hp_temp: temp }))} disabled={readOnly} label="Pontos de vida" />
        {!readOnly && (
          <div className="dsh-hpadjust">
            <button type="button" className="dsh-hpadjust__btn dsh-hpadjust__btn--bad" onClick={() => damage(amount)} title="O dano gasta os PV temporários primeiro">Dano</button>
            <label className="dsh-hpadjust__amount"><small>Quantidade</small>
              <NumberField value={amount} onChange={setAmount} min={1} max={9999} label="Quantidade" className="dsh-hpadjust__num" /></label>
            <button type="button" className="dsh-hpadjust__btn dsh-hpadjust__btn--good" onClick={() => heal(amount)}>Cura</button>
          </div>
        )}

        <div className={`dsh-death${hp === 0 ? ' is-active' : ''}`}>
          <div className="dsh-death__head">
            <span className="dsh-label">Salvaguardas contra a morte</span>
            <RollButton label="Rolar salvaguarda contra a morte" onClick={rollDeath}>Rolar</RollButton>
            {form.death_save_failures >= 3 && <StatusPill tone="bad">Morreu</StatusPill>}
            {form.death_save_successes >= 3 && <StatusPill tone="good">Estabilizado</StatusPill>}
          </div>
          <div className="dsh-death__row">
            <div className="dsh-death__box dsh-death__box--good"><span>Sucessos</span><Pips total={3} filled={form.death_save_successes} tone="good" label="Sucessos" onChange={readOnly ? undefined : (n) => set('death_save_successes', n)} /></div>
            <div className="dsh-death__box dsh-death__box--bad"><span>Falhas</span><Pips total={3} filled={form.death_save_failures} tone="bad" label="Falhas" onChange={readOnly ? undefined : (n) => set('death_save_failures', n)} /></div>
          </div>
        </div>

        {diePool.length > 0 && (
          <div className="dsh-hitdice">
            <span className="dsh-label">Dados de vida</span>
            {diePool.map(({ die, total }) => {
              const left = hitDiceAvailable(derived.hitDice, form.hit_dice_used, die)
              return (
                <div key={die} className="dsh-hitdice__row">
                  <span className="dsh-hitdice__die">d{die}</span>
                  <span className="dsh-hitdice__count"><strong>{left}</strong>/{total}</span>
                  {total <= 12 && <Pips total={total} filled={left} size="sm" label={`Dados d${die} disponíveis`} />}
                  <button type="button" className="dsh-chip" disabled={readOnly || left < 1} onClick={() => void spendDie(die)}>Gastar e rolar</button>
                </div>
              )
            })}
            {lastRoll && <StatusPill tone="good">{lastRoll}</StatusPill>}
          </div>
        )}
      </section>

      <section className="dsh-card">
        <div className="dsh-card__header"><h4 className="dsh-card__title">Ataques</h4></div>
        {data.details.attacks.length === 0 && (
          <div className="dsh-noattack">
            <strong>Nenhum ataque ainda</strong>
            <span>Escolha uma arma do catálogo e o bônus e o dano saem sozinhos.</span>
          </div>
        )}
        <ul className="dsh-list">
          {data.details.attacks.map((a) => {
            const view = a.catalog_entry_key ? attackFor(a.catalog_entry_key, derived, prof.weapons) : null
            const bonusText = a.attack_bonus.trim() || (view ? formatSigned(view.attack.attackBonus) : '')
            const dmgText = a.damage.trim() || view?.attack.damageFormula || ''
            return (
              <li key={a.id} className="dsh-attack">
                <div className="dsh-attack__main">
                  <strong className="dsh-attack__name">{a.name}</strong>
                  <span className="dsh-attack__stat" title="Bônus de ataque">{bonusText || '-'}</span>
                  <span className="dsh-attack__stat dsh-attack__stat--dmg" title="Dano">{dmgText || '-'}{view?.weapon.damageType ? ` ${view.weapon.damageType}` : a.damage_type ? ` ${a.damage_type}` : ''}</span>
                  {!readOnly && <button type="button" className="dsh-x" onClick={() => void removeAttack(a)} disabled={busy === a.id} aria-label={`Remover ${a.name}`}>×</button>}
                </div>
                {roller.canRoll && (
                  <div className="dsh-attack__rolls">
                    <RollButton label={`Atacar com ${a.name}`} onClick={() => rollAttack(a, view, bonusText)}>Atacar</RollButton>
                    {dmgText && validFormula(damageFormulaOf(dmgText)) && (
                      <>
                        <RollButton label={`Dano de ${a.name}`} className={critReady[a.id] ? 'is-crit' : ''}
                          onClick={() => rollDamage(a, dmgText, view?.weapon.damageType ?? a.damage_type)}>{critReady[a.id] ? 'Dano crítico' : 'Dano'}</RollButton>
                        {!critReady[a.id] && (
                          <RollButton label={`Dano crítico de ${a.name} (dobra os dados)`} className="is-crit"
                            onClick={() => rollDamage(a, dmgText, view?.weapon.damageType ?? a.damage_type, true)}>Crítico</RollButton>
                        )}
                      </>
                    )}
                  </div>
                )}
                {view && (
                  <ChipRow>
                    <StatChip label="Atributo">{view.attack.ability === 'strength' ? 'FOR' : 'DES'}</StatChip>
                    <StatChip label="Proficiência" tone={view.proficient ? 'good' : 'bad'}>{view.proficient ? 'Sim' : 'Não'}</StatChip>
                    {view.weapon.properties.map((prop) => <StatusPill key={prop}>{prop}</StatusPill>)}
                  </ChipRow>
                )}
                {!readOnly && (
                  <div className="dsh-attack__edit">
                    <input className="dsh-input dsh-input--sm" defaultValue={a.attack_bonus} placeholder="Bônus (manual)" aria-label={`Bônus manual de ${a.name}`}
                      onBlur={(e) => { if (e.target.value !== a.attack_bonus) void patchAttack(a, { attack_bonus: e.target.value.slice(0, 40) }) }} />
                    <input className="dsh-input dsh-input--sm" defaultValue={a.damage} placeholder="Dano (manual)" aria-label={`Dano manual de ${a.name}`}
                      onBlur={(e) => { if (e.target.value !== a.damage) void patchAttack(a, { damage: e.target.value.slice(0, 200) }) }} />
                    <input className="dsh-input dsh-input--sm" defaultValue={a.notes} placeholder="Notas" aria-label={`Notas de ${a.name}`}
                      onBlur={(e) => { if (e.target.value !== a.notes) void patchAttack(a, { notes: e.target.value.slice(0, 300) }) }} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {roller.canRoll && (
          <div className="dsh-freeroll">
            <label className="dsh-field dsh-field--tile dsh-freeroll__field"><span className="dsh-label">Rolagem livre de dano</span>
              <input type="text" className="dsh-focus__input" value={freeText} maxLength={120} placeholder="Ex.: 1d8+3 cortante + 2d6 fogo"
                onChange={(e) => setFreeText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); rollFree(false) } }} aria-label="Fórmula de dano livre" /></label>
            <div className="dsh-freeroll__btns">
              <RollButton label="Rolar a fórmula" onClick={() => rollFree(false)} disabled={!freeOk}>Rolar</RollButton>
              <RollButton label="Rolar a fórmula como crítico (dobra os dados)" className="is-crit" onClick={() => rollFree(true)} disabled={!freeOk}>Crítico</RollButton>
            </div>
            {freeText.trim() && <p className="dsh-faint dsh-freeroll__hint">{freeOk ? `Rola ${freeFormula}; o crítico rola ${critDamage(freeFormula)}.` : 'Escreva dados e números, como 2d6+3.'}</p>}
          </div>
        )}
        {!readOnly && (
          <div className="dsh-newattack">
            <div className="dsh-field dsh-field--tile dsh-newattack__weapon"><span className="dsh-label">Arma do catálogo</span>
              <Select options={WEAPON_OPTIONS} value={weaponKey} onChange={setWeaponKey} aria-label="Arma do catálogo" /></div>
            <label className="dsh-field dsh-field--tile dsh-newattack__custom"><span className="dsh-label">Ou um ataque próprio</span>
              <input type="text" className="dsh-focus__input" value={customName} maxLength={120} placeholder="Nome do ataque"
                onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addAttack() } }} /></label>
            <button type="button" className="dsh-newattack__add" onClick={() => void addAttack()} disabled={busy === 'new'}>+ Adicionar ataque</button>
          </div>
        )}
      </section>

      <section className="dsh-card">
        <div className="dsh-card__header"><h4 className="dsh-card__title">Defesa</h4></div>
        <div className="dsh-defense">
          <div className="dsh-defense__ac" title="Classe de armadura">
            <span className="dsh-defense__label">Classe de armadura</span>
            <span className="dsh-defense__value"><DerivedField ctx={ctx} field="armor_class" value={derived.armorClass} label="Classe de Armadura" min={0} max={99} /></span>
          </div>
          <div className={`dsh-defense__tile dsh-defense__tile--armor${gear.armor ? ' is-on' : ''}`}>
            <span className="dsh-defense__label">Armadura</span>
            <span className="dsh-defense__text">{gear.armor ? `${gear.armor.name} (CA ${gear.armor.baseAc})` : 'Nenhuma'}</span>
          </div>
          <div className={`dsh-defense__tile${gear.shield ? ' is-on' : ''}`}>
            <span className="dsh-defense__label">Escudo</span>
            <span className="dsh-defense__text">{gear.shield ? '+2' : 'Nenhum'}</span>
          </div>
          <div className="dsh-defense__tile">
            <span className="dsh-defense__label">Iniciativa <RollButton label="Rolar iniciativa" onClick={() => roller.check(initiativeCheck(derived))} /></span>
            <span className="dsh-defense__text"><DerivedField ctx={ctx} field="initiative_bonus" value={derived.initiative} label="Iniciativa" signed min={-20} max={30} /></span>
          </div>
          <label className="dsh-defense__tile dsh-defense__tile--bonus" title="Anel de proteção, estilo de luta Defesa...">
            <span className="dsh-defense__label">Bônus fixo de CA</span>
            <NumberField value={form.ac_bonus} onChange={(n) => set('ac_bonus', n)} min={-10} max={10} label="Bônus de CA" disabled={readOnly} className="dsh-defense__num" />
          </label>
        </div>
        {armorMsg && <p className="dsh-warn">{armorMsg}</p>}
        {strMsg && <p className="dsh-warn">{strMsg}</p>}
      </section>

      <section className="dsh-card">
        <div className="dsh-card__header"><h4 className="dsh-card__title">Condições</h4><span className="dsh-badge">{form.conditions.length ? `${form.conditions.length} ativa${form.conditions.length > 1 ? 's' : ''}` : 'nenhuma'}</span></div>
        <div className="dsh-conds">
          {CONDITIONS.map((c) => {
            const on = form.conditions.includes(c.key as never)
            return (
              <button key={c.key} type="button" disabled={readOnly} className={`dsh-cond${on ? ' is-on' : ''}`}
                onClick={() => toggleCondition(c.key)} title={c.summary} aria-pressed={on}>
                {c.name}
              </button>
            )
          })}
        </div>
        {activeConditions.length > 0 && (
          <ul className="dsh-condfx">
            {activeConditions.map((c) => <li key={c.key}><strong>{c.name}</strong><span>{c.summary}</span></li>)}
          </ul>
        )}
        <div className="dsh-field">
          <span className="dsh-label">Exaustão</span>
          <div className="dsh-exhaust" role="group" aria-label="Níveis de exaustão">
            {EXHAUSTION.levels.map((l) => (
              <button key={l.level} type="button" disabled={readOnly} title={`Nível ${l.level}: ${l.effect}`} aria-pressed={form.exhaustion >= l.level}
                className={`dsh-exhaust__step${form.exhaustion >= l.level ? ' is-on' : ''}${l.level === 6 ? ' is-death' : ''}`}
                onClick={() => set('exhaustion', form.exhaustion === l.level ? l.level - 1 : l.level)}>
                {l.level}
              </button>
            ))}
          </div>
          {exhaustionLevel && <StatusPill tone="bad" title={EXHAUSTION.rule}>Nível {exhaustionLevel.level}: {exhaustionLevel.effect}</StatusPill>}
        </div>
        <label className={`dsh-field dsh-field--tile dsh-focus${form.concentrating_on.trim() ? ' is-on' : ''}`}>
          <span className="dsh-label">Concentrando em</span>
          <input type="text" className="dsh-focus__input" maxLength={160} value={form.concentrating_on} readOnly={readOnly}
            placeholder="Nenhuma magia" onChange={(e) => set('concentrating_on', e.target.value)} />
        </label>
      </section>

    </div>
  )
}
