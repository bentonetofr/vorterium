import { useState } from 'react'
import { Select } from '../../../../shared/components/Select'
import type { DndCharacterClass, DndCharacterProficiency } from '../../../../shared/types'
import { BACKGROUNDS, CLASSES, RACES, getBackground, getClass, getRace } from '../catalog'
import { homebrewKeyFromName } from '../catalog/homebrewKey'
import { levelFromXp, meetsRequirement, xpToNextLevel } from '../rules/progression'
import { ABILITIES } from '../rules/abilities'
import { saveColumns } from '../model/sheetModel'
import { formatMeters } from '../model/format'
import { addDndProficiency, removeDndProficiency } from '../services/dndSheetService'
import { removeDndClass, saveDndClass } from '../services/dndClassService'
import { NumberField } from './DndControls'
import { BonusTiles, ChipRow, StatChip, XpMeter } from './DndVisuals'
import type { SheetCtx } from './sheetContext'

// ────────────────────────────────────────────────────────
// Aba Personagem: raça, antecedente, tendência, classes e níveis (multiclasse),
// experiência e proficiências. As classes ficam na tabela dnd_character_classes;
// o banco soma os níveis (até 20) e mantém o nível da ficha.
// ────────────────────────────────────────────────────────

const ALIGNMENTS = [
  'Leal e Bom', 'Neutro e Bom', 'Caótico e Bom',
  'Leal e Neutro', 'Neutro', 'Caótico e Neutro',
  'Leal e Mau', 'Neutro e Mau', 'Caótico e Mau',
]

const RACE_OPTIONS = [{ value: '', label: 'Escolher raça' }, ...RACES.map((r) => ({ value: r.key, label: r.name }))]
const BACKGROUND_OPTIONS = [{ value: '', label: 'Escolher antecedente' }, ...BACKGROUNDS.map((b) => ({ value: b.key, label: b.name }))]
const ALIGNMENT_OPTIONS = [{ value: '', label: 'Sem tendência' }, ...ALIGNMENTS.map((a) => ({ value: a, label: a }))]

const PROFICIENCY_KINDS: { value: DndCharacterProficiency['category']; label: string }[] = [
  { value: 'weapon', label: 'Arma' }, { value: 'armor', label: 'Armadura' },
  { value: 'tool', label: 'Ferramenta' }, { value: 'language', label: 'Idioma' },
]

const ARMOR_LABEL: Record<string, string> = { light: 'Leve', medium: 'Média', heavy: 'Pesada', shield: 'Escudos' }
const WEAPON_LABEL: Record<string, string> = { simple: 'Armas simples', martial: 'Armas marciais' }

export function DndPersonagemTab({ ctx }: { ctx: SheetCtx }) {
  const { form, set, update, data, readOnly, derived, prof, report } = ctx
  const [busy, setBusy] = useState(false)
  const [newClass, setNewClass] = useState('')
  const [profKind, setProfKind] = useState<DndCharacterProficiency['category']>('tool')
  const [profText, setProfText] = useState('')

  const race = form.race_key ? getRace(form.race_key) : undefined
  const background = form.background_key ? getBackground(form.background_key) : undefined
  const subraceOptions = race && race.subraces.length > 0
    ? [{ value: '', label: 'Sem sub-raça' }, ...race.subraces.map((s) => ({ value: s.key, label: s.name }))]
    : null

  const totalLevel = data.classes.reduce((n, c) => n + c.level, 0)
  const scores = { strength: form.strength, dexterity: form.dexterity, constitution: form.constitution, intelligence: form.intelligence, wisdom: form.wisdom, charisma: form.charisma }
  const takenKeys = new Set(data.classes.map((c) => c.class_key))
  const addOptions = [{ value: '', label: 'Adicionar classe' }, ...CLASSES.filter((c) => !takenKeys.has(c.key)).map((c) => ({ value: c.key, label: c.name }))]

  async function run(job: () => Promise<void>) {
    setBusy(true)
    report(null)
    try { await job() } catch (err) { report(err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.') } finally { setBusy(false) }
  }

  const replaceClass = (saved: DndCharacterClass) => data.setClasses((cs) => {
    const has = cs.some((c) => c.id === saved.id)
    const next = has ? cs.map((c) => (c.id === saved.id ? saved : c)) : [...cs, saved]
    return next.sort((a, b) => Number(b.is_initial) - Number(a.is_initial))
  })

  /** A classe inicial dá as proficiências de salvaguarda (a multiclasse não dá). */
  function applyInitialSaves(classKey: string) {
    const def = getClass(classKey)
    if (def) update((f) => ({ ...f, ...saveColumns(def.saves) }))
  }

  const addClass = () => run(async () => {
    if (!newClass) return
    const first = data.classes.length === 0
    const saved = await saveDndClass(ctx.sheet.id, { class_key: newClass, level: 1, is_initial: first })
    replaceClass(saved)
    if (first) applyInitialSaves(newClass)
    setNewClass('')
  })

  const setLevel = (row: DndCharacterClass, level: number) => run(async () => {
    const others = totalLevel - row.level
    const max = Math.max(1, 20 - others)
    replaceClass(await saveDndClass(ctx.sheet.id, { class_key: row.class_key, level: Math.min(level, max), hp_rolls: row.hp_rolls.slice(0, Math.min(level, max)) }))
  })

  const setSubclass = (row: DndCharacterClass, key: string) => run(async () => {
    replaceClass(await saveDndClass(ctx.sheet.id, { class_key: row.class_key, level: row.level, subclass_key: key || null }))
  })

  // As rolagens de PV guardadas são "uma por nível acima do 1º do personagem": na classe inicial a
  // primeira posição é o nível 2 da classe; nas outras é o nível 1. Trocar a inicial desloca uma casa.
  const asInitialRolls = (rolls: number[]) => rolls.slice(1)
  const asOtherRolls = (rolls: number[], level: number) => [0, ...rolls].slice(0, level)

  const makeInitial = (row: DndCharacterClass) => run(async () => {
    const old = data.classes.find((c) => c.is_initial && c.id !== row.id)
    // o índice único só deixa uma inicial: tira a antiga antes
    if (old) replaceClass(await saveDndClass(ctx.sheet.id, { class_key: old.class_key, level: old.level, is_initial: false, hp_rolls: asOtherRolls(old.hp_rolls, old.level) }))
    replaceClass(await saveDndClass(ctx.sheet.id, { class_key: row.class_key, level: row.level, is_initial: true, hp_rolls: asInitialRolls(row.hp_rolls) }))
    applyInitialSaves(row.class_key)
  })

  const removeClass = (row: DndCharacterClass) => run(async () => {
    await removeDndClass(row.id)
    data.setClasses((cs) => cs.filter((c) => c.id !== row.id))
    // sem classe inicial, a primeira que sobrar assume
    const rest = data.classes.filter((c) => c.id !== row.id)
    if (row.is_initial && rest.length > 0) {
      const next = rest[0]
      replaceClass(await saveDndClass(ctx.sheet.id, { class_key: next.class_key, level: next.level, is_initial: true, hp_rolls: asInitialRolls(next.hp_rolls) }))
      applyInitialSaves(next.class_key)
    }
  })

  const setHpRoll = (row: DndCharacterClass, index: number, value: number) => run(async () => {
    const rolls = [...row.hp_rolls]
    while (rolls.length <= index) rolls.push(0)
    rolls[index] = value
    replaceClass(await saveDndClass(ctx.sheet.id, { class_key: row.class_key, level: row.level, hp_rolls: rolls }))
  })

  const addProficiency = () => run(async () => {
    const label = profText.trim().slice(0, 80)
    if (!label) return
    const saved = await addDndProficiency(ctx.sheet.id, profKind, homebrewKeyFromName(label), label)
    data.setProficiencies((ps) => [...ps.filter((p) => p.id !== saved.id), saved])
    setProfText('')
  })

  const removeProficiency = (p: DndCharacterProficiency) => run(async () => {
    await removeDndProficiency(p.id)
    data.setProficiencies((ps) => ps.filter((x) => x.id !== p.id))
  })

  const xpLevel = levelFromXp(form.experience)
  const toNext = xpToNextLevel(form.experience)

  return (
    <div className="dsh-tab dsh-cols anim-tab-panel">
      <div className="dsh-col">
      <section className="dsh-card">
        <div className="dsh-card__header"><h4 className="dsh-card__title">Identidade</h4></div>
        <div className="dsh-fields">
        <div className={`dsh-field dsh-field--tile${subraceOptions ? '' : ' dsh-field--full'}`}>
          <span className="dsh-label">Raça</span>
          <Select options={RACE_OPTIONS} value={form.race_key} disabled={readOnly}
            onChange={(v) => update((f) => ({ ...f, race_key: v, subrace_key: '' }))} aria-label="Raça" />
        </div>
        {subraceOptions && (
          <div className="dsh-field dsh-field--tile">
            <span className="dsh-label">Sub-raça</span>
            <Select options={subraceOptions} value={form.subrace_key} disabled={readOnly} onChange={(v) => set('subrace_key', v)} aria-label="Sub-raça" />
          </div>
        )}
        <div className="dsh-field dsh-field--tile">
          <span className="dsh-label">Antecedente</span>
          <Select options={BACKGROUND_OPTIONS} value={form.background_key} disabled={readOnly} onChange={(v) => set('background_key', v)} aria-label="Antecedente" />
        </div>
        <div className="dsh-field dsh-field--tile">
          <span className="dsh-label">Tendência</span>
          <Select options={ALIGNMENT_OPTIONS} value={ALIGNMENTS.includes(form.alignment) ? form.alignment : ''} disabled={readOnly}
            onChange={(v) => set('alignment', v)} aria-label="Tendência" />
        </div>
        </div>
        {race && (
          <BonusTiles
            title={`Da raça · ${race.name}`}
            tiles={[
              { label: 'Deslocamento', value: formatMeters(race.speed), wide: true },
              ...Object.entries(race.abilityBonuses).map(([a, n]) => ({ label: ABILITIES.find((x) => x.key === a)?.short ?? a, value: `+${n}`, tone: 'good' as const, hint: 'Bônus da raça: escreva os atributos já com ele' })),
              ...(race.abilityChoice ? [{ label: 'À escolha', value: `+${race.abilityChoice.amount} em ${race.abilityChoice.count}`, tone: 'good' as const, wide: true, hint: 'Bônus da raça: escreva os atributos já com ele' }] : []),
            ]}
          />
        )}
        {background && background.feature && (
          <div className="dsh-lore"><strong>{background.feature.name}</strong><p>{background.feature.summary}</p></div>
        )}
      </section>

      <section className="dsh-card">
        <div className="dsh-card__header"><h4 className="dsh-card__title">Experiência</h4></div>
        <div className="dsh-field dsh-field--tile">
          <span className="dsh-label">Pontos de experiência</span>
          <NumberField value={form.experience} onChange={(n) => set('experience', n)} min={0} max={99999999} label="Pontos de experiência" disabled={readOnly} className="dsh-num--field" />
        </div>
        <XpMeter xp={form.experience} xpLevel={xpLevel} level={derived.totalLevel} toNext={toNext} />
      </section>

      </div>
      <div className="dsh-col">
      <section className="dsh-card">
        <div className="dsh-card__header">
          <h4 className="dsh-card__title">Classes e níveis</h4>
          <span className={`dsh-badge${totalLevel > 20 ? ' dsh-badge--bad' : ''}`}>Nível {data.classes.length ? totalLevel : form.level}</span>
        </div>

        {data.classes.length === 0 && (
          <div className="dsh-field">
            <span className="dsh-label">Nível <span className="dsh-faint">· vale enquanto não houver classes</span></span>
            <NumberField value={form.level} onChange={(n) => set('level', n)} min={1} max={20} label="Nível" disabled={readOnly} className="dsh-num--field" />
          </div>
        )}

        <ul className="dsh-list">
          {data.classes.map((row) => {
            const def = getClass(row.class_key)
            const others = totalLevel - row.level
            const subOptions = def ? [{ value: '', label: row.level >= def.subclassLevel ? 'Escolher subclasse' : `Subclasse no nível ${def.subclassLevel}` }, ...def.subclasses.map((s) => ({ value: s.key, label: s.name }))] : null
            const dieSize = def?.hitDie ?? 8
            const firstRollable = row.is_initial ? 2 : 1
            const rollLevels = Array.from({ length: Math.max(0, row.level - firstRollable + 1) }, (_, i) => firstRollable + i)
            const blocked = data.classes.length > 1 && !!def && !meetsRequirement(scores, def.multiclass.requirement)
            return (
              <li key={row.id} className="dsh-class">
                <div className="dsh-class__main">
                  <strong className="dsh-class__name">{def?.name ?? row.class_key}{row.is_initial && <span className="dsh-tag">inicial</span>}</strong>
                  <label className="dsh-class__level">
                    <span className="dsh-faint">Nível</span>
                    <NumberField value={row.level} onChange={(n) => void setLevel(row, n)} min={1} max={Math.max(1, 20 - others)} label={`Nível de ${def?.name ?? row.class_key}`} disabled={readOnly || busy} />
                  </label>
                  {!readOnly && (
                    <button type="button" className="dsh-x" onClick={() => void removeClass(row)} disabled={busy} aria-label={`Tirar ${def?.name ?? row.class_key}`}>×</button>
                  )}
                </div>
                {subOptions && (
                  <Select options={subOptions} value={row.subclass_key ?? ''} disabled={readOnly || busy || row.level < (def?.subclassLevel ?? 1)}
                    onChange={(v) => void setSubclass(row, v)} aria-label={`Subclasse de ${def?.name}`} />
                )}
                {!row.is_initial && data.classes.length > 1 && !readOnly && (
                  <button type="button" className="dsh-link" onClick={() => void makeInitial(row)} disabled={busy}>Tornar a classe inicial (a do 1º nível)</button>
                )}
                {blocked && <p className="dsh-warn">Para a multiclasse, {def?.name} pede atributo 13 ou mais ({def!.multiclass.requirement.abilities.map((a) => ABILITIES.find((x) => x.key === a)?.short).join(def!.multiclass.requirement.mode === 'all' ? ' e ' : ' ou ')}).</p>}
                {data.hpMode === 'rolled' && rollLevels.length > 0 && (
                  <div className="dsh-rolls">
                    <span className="dsh-faint">PV rolados (d{dieSize}, 0 usa a média):</span>
                    <div className="dsh-rolls__grid">
                      {rollLevels.map((lv) => (
                        <label key={lv} className="dsh-roll">
                          <span>Nv {lv}</span>
                          <NumberField value={row.hp_rolls[lv - firstRollable] ?? 0} min={0} max={dieSize} label={`PV rolado no nível ${lv}`}
                            disabled={readOnly || busy} onChange={(n) => void setHpRoll(row, lv - firstRollable, n)} />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {!readOnly && totalLevel < 20 && (
          <div className="dsh-add-row">
            <Select options={addOptions} value={newClass} onChange={setNewClass} aria-label="Adicionar classe" />
            <button type="button" className="dsh-chip dsh-chip--primary" onClick={() => void addClass()} disabled={!newClass || busy}>Adicionar</button>
          </div>
        )}
        <ChipRow>
          <StatChip label="PV por nível" title="Regra da campanha, escolhida pelo mestre">{data.hpMode === 'rolled' ? 'Rolagem' : 'Média do dado'}</StatChip>
          <StatChip label="1ª classe" title="É a do 1º nível: dado de vida cheio, proficiências completas e salvaguardas">Dado cheio</StatChip>
        </ChipRow>
      </section>

      <section className="dsh-card">
        <div className="dsh-card__header"><h4 className="dsh-card__title">Proficiências e idiomas</h4></div>
        <dl className="dsh-facts">
          <dt>Armaduras</dt>
          <dd>{prof.armor.length ? prof.armor.map((a) => ARMOR_LABEL[a] ?? a).join(', ') : <span className="dsh-faint">Nenhuma</span>}</dd>
          <dt>Armas</dt>
          <dd>{prof.weapons.length ? prof.weapons.map((w) => WEAPON_LABEL[w] ?? w.replace(/_/g, ' ')).join(', ') : <span className="dsh-faint">Nenhuma</span>}</dd>
          <dt>Ferramentas</dt>
          <dd>{prof.tools.length ? prof.tools.join(', ') : <span className="dsh-faint">Nenhuma</span>}</dd>
          <dt>Idiomas</dt>
          <dd>{prof.languages.length ? prof.languages.join(', ') : <span className="dsh-faint">Nenhum</span>}</dd>
        </dl>
        {data.proficiencies.length > 0 && (
          <div className="dsh-chips">
            {data.proficiencies.map((p) => (
              <span key={p.id} className="dsh-tag">
                {PROFICIENCY_KINDS.find((k) => k.value === p.category)?.label}: {p.label}
                {!readOnly && <button type="button" onClick={() => void removeProficiency(p)} aria-label={`Tirar ${p.label}`}>×</button>}
              </span>
            ))}
          </div>
        )}
        {!readOnly && (
          <div className="dsh-add-row">
            <Select options={PROFICIENCY_KINDS} value={profKind} onChange={(v) => setProfKind(v as DndCharacterProficiency['category'])} aria-label="Tipo de proficiência" />
            <input type="text" className="dsh-input" value={profText} maxLength={80} placeholder="Ex.: Ferramentas de ladrão, Élfico"
              onChange={(e) => setProfText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addProficiency() } }} />
            <button type="button" className="dsh-chip" onClick={() => void addProficiency()} disabled={!profText.trim() || busy}>Adicionar</button>
          </div>
        )}
      </section>

      </div>
    </div>
  )
}
