import { useState } from 'react'
import { ABILITIES, SKILLS } from '../rules/abilities'
import { formatSigned } from '../model/format'
import { upsertDndSkill } from '../services/dndSheetService'
import { DerivedField, NumberField, Pips } from './DndControls'
import { SkillLegend } from './DndVisuals'
import type { SheetCtx } from './sheetContext'
import { RollButton } from '../rolls/RollButton'
import { useDndRoll } from '../rolls/DndRollProvider'
import { abilityCheck, saveCheck, skillCheck } from '../rolls/checkModel'
import type { AbilityKey } from '../rules/types'

// ────────────────────────────────────────────────────────
// Aba Atributos e Perícias: os seis atributos com modificador e salvaguarda,
// as 18 perícias (proficiência e especialização) e as percepções passivas.
// Os bônus saem do motor de regras: bônus de proficiência pelo nível total,
// Pau para Toda Obra do Bardo, etc.
// ────────────────────────────────────────────────────────

const SAVE_FLAG: Record<AbilityKey, `${AbilityKey}_save_proficient`> = {
  strength: 'strength_save_proficient', dexterity: 'dexterity_save_proficient', constitution: 'constitution_save_proficient',
  intelligence: 'intelligence_save_proficient', wisdom: 'wisdom_save_proficient', charisma: 'charisma_save_proficient',
}

export function DndAtributosTab({ ctx }: { ctx: SheetCtx }) {
  const { form, set, derived, data, sheet, readOnly, report } = ctx
  const [busy, setBusy] = useState<string | null>(null)
  const skillRows = new Map(data.details.skills.map((s) => [s.skill_key, s]))
  const roller = useDndRoll()

  async function setSkillLevel(skillKey: (typeof SKILLS)[number]['key'], filled: number) {
    if (readOnly) return
    setBusy(skillKey)
    report(null)
    try {
      const saved = await upsertDndSkill(sheet.id, skillKey, filled >= 1, filled >= 2)
      data.setDetails((d) => ({ ...d, skills: [...d.skills.filter((s) => s.id !== saved.id && s.skill_key !== saved.skill_key), saved] }))
    } catch (err) {
      report(err instanceof Error ? err.message : 'Não foi possível salvar a perícia.')
    } finally { setBusy(null) }
  }

  return (
    <div className="dsh-tab anim-tab-panel">
      <section className="dsh-card">
        <div className="dsh-card__header">
          <h4 className="dsh-card__title">Atributos e salvaguardas</h4>
          <span className="dsh-badge" title="Modificador = (valor − 10) ÷ 2, para baixo. Bônus de proficiência pelo nível total. Para digitar os números à mão, use Automatizar.">Proficiência {formatSigned(derived.proficiencyBonus)}</span>
        </div>
        <div className="dsh-abilities">
          {ABILITIES.map((a) => {
            const save = derived.saves[a.key]
            return (
              <div key={a.key} className={`dsh-ability${save.proficient ? ' is-prof' : ''}`}>
                <div className="dsh-ability__head">
                  <span className="dsh-ability__name">{a.label}</span>
                  <span className="dsh-ability__short">{a.short}</span>
                  <RollButton label={`Teste de ${a.label}`} onClick={() => roller.check(abilityCheck(derived, a.key))} />
                </div>
                <div className="dsh-ability__body">
                  <span className="dsh-ability__mod" title="Modificador: é o que se soma nas rolagens">
                    <small>Modificador</small>
                    <DerivedField ctx={ctx} field={`mod_${a.key}`} value={derived.abilityMods[a.key]} label={`Modificador de ${a.label}`} signed min={-10} max={20} />
                  </span>
                  <label className="dsh-ability__scorebox" title="Valor do atributo (de 1 a 30): dele sai o modificador">
                    <small>Valor</small>
                    <NumberField value={form[a.key]} onChange={(n) => set(a.key, n)} min={1} max={30} label={a.label} disabled={readOnly} className="dsh-ability__score" />
                  </label>
                </div>
                <div className={`dsh-ability__save${save.proficient ? ' is-on' : ''}`}>
                  <label title="Proficiência na salvaguarda">
                    <input type="checkbox" checked={form[SAVE_FLAG[a.key]]} disabled={readOnly} onChange={(e) => set(SAVE_FLAG[a.key], e.target.checked)} />
                    <span>Salvaguarda</span>
                  </label>
                  <span className="dsh-ability__savebonus">
                    <DerivedField ctx={ctx} field={`save_${a.key}`} value={save.bonus} label={`Salvaguarda de ${a.label}`} signed min={-20} max={30} />
                    <RollButton label={`Rolar salvaguarda de ${a.label}`} onClick={() => roller.check(saveCheck(derived, a.key))} />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="dsh-card">
        <div className="dsh-card__header">
          <h4 className="dsh-card__title">Perícias</h4>
          <span className="dsh-badge">{data.details.skills.filter((s) => s.proficient).length} com proficiência</span>
        </div>
        <p className="dsh-faint dsh-skills__note">O número de cada perícia é o <strong>bônus total</strong> (modificador do atributo + proficiência), o que se soma ao d20. As bolinhas marcam proficiência e especialização.</p>
        <ul className="dsh-skills">
          {SKILLS.map((k) => {
            const row = skillRows.get(k.key)
            const filled = row?.expertise ? 2 : row?.proficient ? 1 : 0
            const d = derived.skills[k.key]
            const ab = ABILITIES.find((x) => x.key === k.ability)!
            return (
              <li key={k.key} className={`dsh-skill${filled ? ' is-prof' : ''}`}>
                <Pips total={2} filled={filled} size="sm" label={`Proficiência em ${k.label}`} onChange={readOnly || busy === k.key ? undefined : (n) => void setSkillLevel(k.key, n)} />
                <span className="dsh-skill__name">{k.label}<small>{ab.short}</small></span>
                {d.level === 'half' && <span className="dsh-skill__half" title="Pau para Toda Obra: metade da proficiência">½</span>}
                <span className="dsh-skill__bonus">
                  <DerivedField ctx={ctx} field={`skill_${k.key}`} value={d.bonus} label={`Bônus de ${k.label}`} signed min={-20} max={40} />
                </span>
                <RollButton label={`Rolar ${k.label}`} onClick={() => roller.check(skillCheck(derived, k.key))} />
              </li>
            )
          })}
        </ul>
        <SkillLegend />
        <span className="dsh-label">Percepções passivas</span>
        <div className="dsh-passives">
          <div className="dsh-passive"><DerivedField ctx={ctx} field="passive_perception" value={derived.passives.perception} label="Percepção passiva" min={0} max={99} /><span>Percepção</span></div>
          <div className="dsh-passive"><DerivedField ctx={ctx} field="passive_insight" value={derived.passives.insight} label="Intuição passiva" min={0} max={99} /><span>Intuição</span></div>
          <div className="dsh-passive"><DerivedField ctx={ctx} field="passive_investigation" value={derived.passives.investigation} label="Investigação passiva" min={0} max={99} /><span>Investigação</span></div>
        </div>
      </section>
    </div>
  )
}
