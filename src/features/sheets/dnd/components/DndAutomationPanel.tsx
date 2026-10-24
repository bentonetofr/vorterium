import { useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import type { DndCharacterAttack, DndCharacterProficiency } from '../../../../shared/types'
import { getRace } from '../catalog'
import { homebrewKeyFromName } from '../catalog/homebrewKey'
import { AUTOMATION_GROUPS, AUTOMATION_ITEMS, isItemManual, manualSeed, type AutomationItem, type ManualMode } from '../model/automation'
import { formatSigned, inventoryWeightKg } from '../model/format'
import { PROFICIENCY_COPY_SOURCE, attackFor, proficiencyName } from '../model/sheetModel'
import { addDndProficiency, removeDndOverrides, removeDndProficiency, saveDndOverrides, updateDndAttack } from '../services/dndSheetService'
import type { SheetCtx } from './sheetContext'

// ────────────────────────────────────────────────────────
// Janela "Automatizar": no centro da tela, uma lista vertical do que a ficha
// pode calcular sozinha. Cada item tem o nome e uma descrição à esquerda e a
// escolha Automático / Manual à direita. É o único lugar que troca o modo: a
// ficha em si não tem selo nem botão de modo.
// ────────────────────────────────────────────────────────

interface Props {
  ctx:     SheetCtx
  onClose: () => void
}

export function DndAutomationPanel({ ctx, onClose }: Props) {
  const { form, update, derived, data, sheet, readOnly, report, prof } = ctx
  const [busy, setBusy] = useState<string | null>(null)

  const overrideKeys = new Set<string>(data.details.overrides.map((o) => o.field_key))
  const values = { vision: form.vision_ft, carried: form.carried_kg }
  const manualNow = (item: AutomationItem) => isItemManual(item, overrideKeys, form.manual_modes, values)
  const manualCount = AUTOMATION_ITEMS.filter(manualNow).length

  const setMode = (mode: ManualMode, manual: boolean) =>
    update((f) => ({ ...f, manual_modes: (manual ? [...f.manual_modes.filter((m) => m !== mode), mode] : f.manual_modes.filter((m) => m !== mode)).sort() }))

  /** Proficiências manuais: as da classe e da raça viram linhas da ficha (para tirar ou pôr); de volta ao automático, as cópias saem. */
  async function proficiencies(manual: boolean) {
    type Row = [DndCharacterProficiency['category'], string, string]
    if (manual) {
      // as de hoje, menos as que a ficha já tem na lista
      const textual = (cat: string) => cat === 'tool' || cat === 'language'
      const have = new Set(data.proficiencies.map((p) => `${p.category}:${textual(p.category) ? p.label : p.entry_key}`))
      const rows: Row[] = [
        ...prof.armor.map((a): Row => ['armor', a, proficiencyName('armor', a)]),
        ...prof.weapons.map((w): Row => ['weapon', w, proficiencyName('weapon', w)]),
        ...prof.tools.map((t): Row => ['tool', homebrewKeyFromName(t), t]),
        ...prof.languages.map((l): Row => ['language', homebrewKeyFromName(l), l]),
      ].filter(([cat, key, label]) => !have.has(`${cat}:${textual(cat) ? label : key}`))
      const saved: DndCharacterProficiency[] = []
      for (const [cat, key, label] of rows) saved.push(await addDndProficiency(sheet.id, cat, key, label, PROFICIENCY_COPY_SOURCE))
      data.setProficiencies((ps) => [...ps.filter((p) => !saved.some((x) => x.id === p.id)), ...saved])
    } else {
      const copies = data.proficiencies.filter((p) => p.source === PROFICIENCY_COPY_SOURCE)
      for (const p of copies) await removeDndProficiency(p.id)
      data.setProficiencies((ps) => ps.filter((p) => p.source !== PROFICIENCY_COPY_SOURCE))
    }
    setMode('proficiencies', manual)
  }

  /** Ataques manuais: as armas do livro ganham o bônus e o dano de hoje escritos; de volta ao automático, eles saem. */
  async function attacks(manual: boolean) {
    const saved: DndCharacterAttack[] = []
    for (const a of data.details.attacks) {
      const view = a.catalog_entry_key ? attackFor(a.catalog_entry_key, derived, prof.weapons) : null
      if (!view) continue
      const patch = manual
        ? { attack_bonus: a.attack_bonus.trim() || formatSigned(view.attack.attackBonus), damage: a.damage.trim() || view.attack.damageFormula || '' }
        : { attack_bonus: '', damage: '' }
      if (patch.attack_bonus === a.attack_bonus && patch.damage === a.damage) continue
      saved.push(await updateDndAttack(a.id, patch))
    }
    if (saved.length) data.setDetails((d) => ({ ...d, attacks: d.attacks.map((x) => saved.find((s) => s.id === x.id) ?? x) }))
    setMode('attacks', manual)
  }

  async function apply(item: AutomationItem, manual: boolean) {
    if (manual === manualNow(item)) return
    if (item.value === 'vision') {
      const race = form.race_key ? getRace(form.race_key) : undefined
      update((f) => ({ ...f, vision_ft: manual ? (f.vision_ft ?? race?.darkvision ?? 0) : null }))
      return
    }
    if (item.value === 'carried') {
      const carried = Math.round(inventoryWeightKg(data.details.inventory) * 10) / 10
      update((f) => ({ ...f, carried_kg: manual ? carried : null }))
      return
    }
    if (item.mode === 'proficiencies') return proficiencies(manual)
    if (item.mode === 'attacks') return attacks(manual)
    if (item.mode === 'hit_dice') {
      // começa com os dados de hoje; de volta ao automático, o digitado sai
      const seed = Object.fromEntries(Object.entries(derived.hitDice).map(([d, n]) => [String(d), n]))
      update((f) => ({ ...f, manual_hit_dice: manual ? seed : {} }))
      setMode('hit_dice', manual)
      return
    }
    if (item.mode === 'spell_counts') {
      const seed = Object.fromEntries((derived.spellcasting?.classes ?? []).map((c) => [c.classKey, { cantrips: c.cantripsKnown, spells: c.spellsKnownOrPrepared, spellbook: c.spellbookSize }]))
      update((f) => ({ ...f, manual_spell_counts: manual ? seed : {} }))
      setMode('spell_counts', manual)
      return
    }
    if (item.mode) { setMode(item.mode, manual); return }
    const fields = item.fields ?? []
    if (manual) {
      const saved = await saveDndOverrides(sheet.id, manualSeed(item, derived, form.hp_max))
      data.setDetails((d) => ({ ...d, overrides: [...d.overrides.filter((o) => !fields.includes(o.field_key)), ...saved] }))
    } else {
      await removeDndOverrides(sheet.id, fields)
      data.setDetails((d) => ({ ...d, overrides: d.overrides.filter((o) => !fields.includes(o.field_key)) }))
    }
  }

  async function choose(item: AutomationItem, manual: boolean) {
    if (readOnly || busy) return
    setBusy(item.id)
    report(null)
    try { await apply(item, manual) } catch (err) {
      report(err instanceof Error ? err.message : 'Não foi possível trocar o modo.')
    } finally { setBusy(null) }
  }

  /** Passa a ficha inteira para automático ou manual de uma vez (os números numa chamada só; o resto item a item). */
  async function setAll(manual: boolean) {
    if (readOnly || busy) return
    setBusy('all')
    report(null)
    try {
      const numeric = AUTOMATION_ITEMS.filter((i) => i.fields)
      const fields = numeric.flatMap((i) => i.fields ?? [])
      if (manual) {
        const seeds = numeric.filter((i) => !manualNow(i)).flatMap((i) => manualSeed(i, derived, form.hp_max))
        const saved = await saveDndOverrides(sheet.id, seeds)
        data.setDetails((d) => ({ ...d, overrides: [...d.overrides.filter((o) => !seeds.some((x) => x.field === o.field_key)), ...saved] }))
      } else {
        await removeDndOverrides(sheet.id, fields)
        data.setDetails((d) => ({ ...d, overrides: d.overrides.filter((o) => !fields.includes(o.field_key)) }))
      }
      for (const item of AUTOMATION_ITEMS.filter((i) => !i.fields)) await apply(item, manual)
    } catch (err) {
      report(err instanceof Error ? err.message : 'Não foi possível trocar o modo de tudo.')
    } finally { setBusy(null) }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="dsh-sheet dsh-auto" role="dialog" aria-modal="true" aria-labelledby="dsh-auto-title">
        <header className="dsh-auto__head">
          <div>
            <h3 id="dsh-auto-title" className="dsh-auto__title">Automatizar</h3>
            <p className="dsh-auto__lead">Escolha o que a ficha calcula sozinha pelas regras do livro e o que você prefere preencher à mão.</p>
            <div className="dsh-auto__all">
              <button type="button" className="dsh-chip dsh-chip--primary" onClick={() => void setAll(false)} disabled={readOnly || busy !== null || manualCount === 0}>Automatizar tudo</button>
              <button type="button" className="dsh-chip" onClick={() => void setAll(true)} disabled={readOnly || busy !== null || manualCount === AUTOMATION_ITEMS.length}>Manualizar tudo</button>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="dsh-auto__body">
          {AUTOMATION_GROUPS.map((group) => (
            <section key={group} className="dsh-auto__group">
              <h4 className="dsh-auto__group-title">{group}</h4>
              <ul className="dsh-auto__list">
                {AUTOMATION_ITEMS.filter((i) => i.group === group).map((item) => {
                  const manual = manualNow(item)
                  const disabled = readOnly || busy !== null
                  return (
                    <li key={item.id} className="dsh-auto__item">
                      <div className="dsh-auto__text">
                        <strong>{item.title}</strong>
                        <span>{item.description}</span>
                      </div>
                      <div className="dsh-auto__choice" role="group" aria-label={`${item.title}: automático ou manual`}>
                        <button type="button" className={manual ? '' : 'is-on'} aria-pressed={!manual} disabled={disabled} onClick={() => void choose(item, false)}>Automático</button>
                        <button type="button" className={manual ? 'is-on is-manual' : ''} aria-pressed={manual} disabled={disabled} onClick={() => void choose(item, true)}>Manual</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>

        <footer className="dsh-auto__foot">
          <span className="dsh-faint">{manualCount === 0 ? 'Tudo automático.' : `${manualCount} ${manualCount === 1 ? 'item' : 'itens'} em modo manual.`}</span>
          <button type="button" className="dsh-chip dsh-chip--primary" onClick={onClose}>Fechar</button>
        </footer>
      </div>
    </ModalOverlay>
  )
}
