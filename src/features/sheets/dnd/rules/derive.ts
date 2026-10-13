import { ABILITIES, SKILLS, clampLevel, getAbilityModifier, getProficiencyBonus, skillBonus } from './abilities'
import type { AbilityKey, Derived, DerivedInput, OverridableField, SaveDerived, SkillDerived, SkillKey } from './types'

// ────────────────────────────────────────────────────────
// computeDerived: tudo que a ficha, a rolagem e o card do mestre mostram,
// calculado num lugar só pra os números nunca divergirem. Esqueleto do
// Marco 1: atributos, proficiência, salvaguardas, perícias, iniciativa e
// percepção passiva. CA, PV, conjuração e progressão entram nos próximos.
// ────────────────────────────────────────────────────────

export function computeDerived(input: DerivedInput): Derived {
  const overridden: OverridableField[] = []
  const manual = input.overrides ?? {}

  const totalLevel = clampLevel(input.classes.reduce((sum, c) => sum + c.level, 0))

  let proficiencyBonus = getProficiencyBonus(totalLevel)
  if (manual.proficiency_bonus != null) { proficiencyBonus = manual.proficiency_bonus; overridden.push('proficiency_bonus') }

  const abilityMods = {} as Record<AbilityKey, number>
  const saves = {} as Record<AbilityKey, SaveDerived>
  for (const { key } of ABILITIES) {
    const mod = getAbilityModifier(input.abilities[key])
    const proficient = input.saveProficiency?.[key] === true
    abilityMods[key] = mod
    saves[key] = { ability: key, proficient, bonus: mod + (proficient ? proficiencyBonus : 0) }
  }

  const skills = {} as Record<SkillKey, SkillDerived>
  for (const { key, ability } of SKILLS) {
    const level = input.skillProficiency?.[key] ?? 'none'
    skills[key] = { ability, level, bonus: skillBonus(abilityMods[ability], level, proficiencyBonus) }
  }

  let initiative = abilityMods.dexterity
  if (manual.initiative_bonus != null) { initiative = manual.initiative_bonus; overridden.push('initiative_bonus') }

  return {
    totalLevel,
    proficiencyBonus,
    abilityMods,
    saves,
    skills,
    initiative,
    passivePerception: 10 + skills.perception.bonus,
    overridden,
  }
}
