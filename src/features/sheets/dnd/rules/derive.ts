import { ABILITIES, SKILLS, clampLevel, getAbilityModifier, getProficiencyBonus, skillBonus } from './abilities'
import { computeArmorClass, computeMaxHp, hitDicePool } from './combat'
import type { AbilityKey, Derived, DerivedInput, OverridableField, SaveDerived, SkillDerived, SkillKey } from './types'

// ────────────────────────────────────────────────────────
// computeDerived: tudo que a ficha, a rolagem e o card do mestre mostram,
// calculado num lugar só pra os números nunca divergirem. Esqueleto do
// Marco 1: atributos, proficiência, salvaguardas, perícias, iniciativa,
// percepção passiva, CA, PV e dados de vida. Conjuração e progressão entram
// nos próximos passos.
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

  const combat = input.combat ?? {}
  const classKeys = input.classes.map((c) => c.classKey)

  let armorClass = computeArmorClass({
    armor:        combat.armor ?? null,
    shield:       combat.shield === true,
    dexMod:       abilityMods.dexterity,
    conMod:       abilityMods.constitution,
    wisMod:       abilityMods.wisdom,
    barbarianUnarmoredDefense: classKeys.includes('barbarian'),
    monkUnarmoredDefense:      classKeys.includes('monk'),
    mediumDexCap: combat.mediumDexCap,
    bonus:        combat.acBonus,
  })
  if (manual.armor_class != null) { armorClass = manual.armor_class; overridden.push('armor_class') }

  const hpLevels = combat.hpLevels ?? []
  let hpMax: number | null = hpLevels.length > 0
    ? computeMaxHp(hpLevels, abilityMods.constitution, combat.hpBonusPerLevel ?? 0)
    : null
  if (manual.hp_max != null) { hpMax = manual.hp_max; overridden.push('hp_max') }

  return {
    totalLevel,
    proficiencyBonus,
    abilityMods,
    saves,
    skills,
    initiative,
    passivePerception: 10 + skills.perception.bonus,
    armorClass,
    hpMax,
    hitDice: hitDicePool(hpLevels),
    overridden,
  }
}
