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

// ────────────────────────────────────────────────────────
// Aba Combate: PV (dano, cura, PV temporários, salvaguardas contra a morte,
// dados de vida), defesa (armadura e escudo equipados), condições, exaustão,
// concentração e ataques com arma. As contas de ataque saem do motor.
// ────────────────────────────────────────────────────────

const WEAPON_OPTIONS = [{ value: '', label: 'Arma do catálogo' }, ...WEAPONS.map((w) => ({ value: w.key, label: w.name }))]

export function DndCombateTab({ ctx }: { ctx: SheetCtx }) {
  const { form, set, update, derived, data, sheet, readOnly, gear, prof, report } = ctx
  const hpMax = derived.hpMax ?? form.hp_max
  const hp = Math.max(0, Math.min(hpMax, form.hp_current))
  const [amount, setAmount] = useState(1)
  const [lastRoll, setLastRoll] = useState<string | null>(null)
  const [weaponKey, setWeaponKey] = useState('')
  const [customName, setCustomName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const armorMsg = armorWarning(gear, prof.armor)
  const strMsg = strengthWarning(gear, form.strength)
  const exhaustionLevel = EXHAUSTION.levels.find((l) => l.level === form.exhaustion)

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

  function spendDie(die: number) {
    if (readOnly) return
    const next = spendHitDie(derived.hitDice, form.hit_dice_used, die)
    if (!next) return
    const roll = 1 + Math.floor(Math.random() * die)
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
    <div className="dsh-tab dsh-cols anim-tab-panel">
      <div className="dsh-col">
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
                  <button type="button" className="dsh-chip" disabled={readOnly || left < 1} onClick={() => spendDie(die)}>Gastar e rolar</button>
                </div>
              )
            })}
            {lastRoll && <StatusPill tone="good">{lastRoll}</StatusPill>}
          </div>
        )}
      </section>

      <section className="dsh-card">
        <div className="dsh-card__header"><h4 className="dsh-card__title">Ataques</h4></div>
        {data.details.attacks.length === 0 && <p className="dsh-faint">Nenhum ataque ainda. Escolha uma arma do catálogo e o bônus e o dano saem sozinhos.</p>}
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
                      onBlur={(e) => { if (e.target.value !== a.damage) void patchAttack(a, { damage: e.target.value.slice(0, 80) }) }} />
                    <input className="dsh-input dsh-input--sm" defaultValue={a.notes} placeholder="Notas" aria-label={`Notas de ${a.name}`}
                      onBlur={(e) => { if (e.target.value !== a.notes) void patchAttack(a, { notes: e.target.value.slice(0, 300) }) }} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {!readOnly && (
          <div className="dsh-add-row">
            <Select options={WEAPON_OPTIONS} value={weaponKey} onChange={setWeaponKey} aria-label="Arma do catálogo" />
            <input type="text" className="dsh-input" value={customName} maxLength={120} placeholder="ou o nome de um ataque próprio"
              onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addAttack() } }} />
            <button type="button" className="dsh-chip dsh-chip--primary" onClick={() => void addAttack()} disabled={busy === 'new'}>Adicionar</button>
          </div>
        )}
      </section>

      </div>
      <div className="dsh-col">
      <section className="dsh-card">
        <div className="dsh-card__header">
          <h4 className="dsh-card__title">Defesa</h4>
          <span className="dsh-badge">CA {derived.armorClass}</span>
        </div>
        <ChipRow>
          <StatChip label="Armadura" tone={gear.armor ? 'good' : undefined}>{gear.armor ? `${gear.armor.name} (CA ${gear.armor.baseAc})` : 'Nenhuma'}</StatChip>
          <StatChip label="Escudo" tone={gear.shield ? 'good' : undefined}>{gear.shield ? '+2' : 'Nenhum'}</StatChip>
          <StatChip label="Iniciativa"><DerivedField ctx={ctx} field="initiative_bonus" value={derived.initiative} label="Iniciativa" signed min={-20} max={30} /></StatChip>
        </ChipRow>
        <label className="dsh-field">
          <span className="dsh-label" title="Anel de proteção, estilo de luta Defesa...">Bônus fixo de CA</span>
          <NumberField value={form.ac_bonus} onChange={(n) => set('ac_bonus', n)} min={-10} max={10} label="Bônus de CA" disabled={readOnly} className="dsh-num--field" />
        </label>
        {armorMsg && <p className="dsh-warn">{armorMsg}</p>}
        {strMsg && <p className="dsh-warn">{strMsg}</p>}
      </section>

      <section className="dsh-card">
        <div className="dsh-card__header"><h4 className="dsh-card__title">Condições</h4><span className="dsh-badge">{form.conditions.length ? `${form.conditions.length} ativa${form.conditions.length > 1 ? 's' : ''}` : 'nenhuma'}</span></div>
        <div className="dsh-chips">
          {CONDITIONS.map((c) => (
            <button key={c.key} type="button" disabled={readOnly}
              className={`dsh-pick${form.conditions.includes(c.key as never) ? ' is-on' : ''}`}
              onClick={() => toggleCondition(c.key)} title={c.summary} aria-pressed={form.conditions.includes(c.key as never)}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="dsh-field">
          <span className="dsh-label">Exaustão</span>
          <Pips total={6} filled={form.exhaustion} tone="bad" label="Níveis de exaustão" onChange={readOnly ? undefined : (n) => set('exhaustion', n)} />
          {exhaustionLevel && <StatusPill tone="bad" title={EXHAUSTION.rule}>Nível {exhaustionLevel.level}: {exhaustionLevel.effect}</StatusPill>}
        </div>
        <label className="dsh-field">
          <span className="dsh-label">Concentrando em</span>
          <input type="text" className="dsh-input" maxLength={160} value={form.concentrating_on} readOnly={readOnly}
            placeholder="Nenhuma magia" onChange={(e) => set('concentrating_on', e.target.value)} />
        </label>
      </section>

      </div>
    </div>
  )
}
