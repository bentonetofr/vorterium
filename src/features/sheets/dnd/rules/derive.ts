import { ABILITIES, SKILLS, clampLevel, getAbilityModifier, getProficiencyBonus, skillBonus } from './abilities'
import { computeArmorClass, computeMaxHp, computeSpeed, hitDicePool } from './combat'
import { computeSpellStats, computeSpellcasting } from './spellcasting'
import type { AbilityKey, Derived, DerivedInput, OverridableField, SaveDerived, SkillDerived, SkillKey } from './types'

// ────────────────────────────────────────────────────────
// computeDerived: tudo que a ficha, a rolagem e o card do mestre mostram,
// calculado num lugar só pra os números nunca divergirem. Esqueleto do
// Marco 1: atributos, proficiência, salvaguardas, perícias, iniciativa,
// percepção passiva, CA, PV, dados de vida e conjuração (espaços, CD, truques,
// magias conhecidas/preparadas).
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

  // Pau para Toda Obra (Bardo, 2º nível): metade da proficiência no que o personagem ainda não domina.
  const jackOfAllTrades = input.classes.some((c) => c.classKey === 'bard' && c.level >= 2)

  const skills = {} as Record<SkillKey, SkillDerived>
  for (const { key, ability } of SKILLS) {
    const stored = input.skillProficiency?.[key] ?? 'none'
    const level = stored === 'none' && jackOfAllTrades ? 'half' : stored
    skills[key] = { ability, level, bonus: skillBonus(abilityMods[ability], level, proficiencyBonus) }
  }

  // A iniciativa é um teste de Destreza: o Pau para Toda Obra também vale nela.
  let initiative = abilityMods.dexterity + (jackOfAllTrades ? Math.floor(proficiencyBonus / 2) : 0)
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

  let speed = computeSpeed({
    base:           combat.baseSpeed ?? 30,
    barbarianLevel: input.classes.filter((c) => c.classKey === 'barbarian').reduce((n, c) => n + c.level, 0),
    monkLevel:      input.classes.filter((c) => c.classKey === 'monk').reduce((n, c) => n + c.level, 0),
    armor:          combat.armor ?? null,
    shield:         combat.shield === true,
  })
  if (manual.speed != null) { speed = manual.speed; overridden.push('speed') }

  const hpLevels = combat.hpLevels ?? []
  let hpMax: number | null = hpLevels.length > 0
    ? computeMaxHp(hpLevels, abilityMods.constitution, combat.hpBonusPerLevel ?? 0)
    : null
  if (manual.hp_max != null) { hpMax = manual.hp_max; overridden.push('hp_max') }

  const spellcasting = computeSpellcasting(input.classes, abilityMods, proficiencyBonus, input.spellAbility)
  const spellStats = computeSpellStats(spellcasting, input.spellAbility, abilityMods, proficiencyBonus)
  if (spellStats && (manual.spell_save_dc != null || manual.spell_attack_bonus != null)) {
    for (const c of spellcasting?.classes ?? []) {
      if (manual.spell_save_dc != null) c.saveDc = manual.spell_save_dc
      if (manual.spell_attack_bonus != null) c.attackBonus = manual.spell_attack_bonus
    }
    if (manual.spell_save_dc != null) { spellStats.saveDc = manual.spell_save_dc; overridden.push('spell_save_dc') }
    if (manual.spell_attack_bonus != null) { spellStats.attackBonus = manual.spell_attack_bonus; overridden.push('spell_attack_bonus') }
  }

  return {
    totalLevel,
    proficiencyBonus,
    abilityMods,
    saves,
    skills,
    initiative,
    passivePerception: 10 + skills.perception.bonus,
    armorClass,
    speed,
    hpMax,
    hitDice: hitDicePool(hpLevels),
    spellcasting,
    spellStats,
    overridden,
  }
}
