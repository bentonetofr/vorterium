import type {
  DndCharacterClass, DndCharacterProficiency, DndCharacterSheet, DndSheetDetails,
} from '../../../../shared/types'
import {
  SHIELD, getArmor, getClass, getGear, getRace, getSubrace, getWeapon, hitDieOf, raceHpBonusPerLevel, toClassLevels,
} from '../catalog'
import type { ArmorEntry, WeaponEntry } from '../catalog'
import { weaponAttack, weaponProficient, type WeaponAttack } from '../rules/combat'
import { computeDerived } from '../rules/derive'
import { buildHpLevels } from '../rules/hpLevels'
import type { AbilityKey, ArmorInput, Derived, DerivedInput, OverridableField, ProficiencyLevel, SkillKey } from '../rules/types'

// ────────────────────────────────────────────────────────
// Liga as linhas do banco (ficha, classes, perícias, inventário, sobrescritas)
// ao motor de regras. É o único lugar que sabe montar o DerivedInput: a tela,
// os cards do mestre e (no Marco 6) as rolagens usam o mesmo resultado.
// ────────────────────────────────────────────────────────

/** Tudo que a ficha precisa para ser calculada. */
export interface SheetBundle {
  sheet:         DndCharacterSheet
  classes:       DndCharacterClass[]
  details:       DndSheetDetails
  proficiencies: DndCharacterProficiency[]
}

/** Nível usado quando a ficha ainda não tem classes (ficha digitada à mão). */
const NO_CLASS = '_sem_classe'

export function abilityScores(sheet: DndCharacterSheet): Record<AbilityKey, number> {
  return {
    strength: sheet.strength, dexterity: sheet.dexterity, constitution: sheet.constitution,
    intelligence: sheet.intelligence, wisdom: sheet.wisdom, charisma: sheet.charisma,
  }
}

export function saveProficiencies(sheet: DndCharacterSheet): Record<AbilityKey, boolean> {
  return {
    strength: sheet.strength_save_proficient, dexterity: sheet.dexterity_save_proficient,
    constitution: sheet.constitution_save_proficient, intelligence: sheet.intelligence_save_proficient,
    wisdom: sheet.wisdom_save_proficient, charisma: sheet.charisma_save_proficient,
  }
}

/** Colunas de proficiência em salvaguarda de uma lista de atributos (ex.: as da classe inicial). */
export function saveColumns(saves: readonly AbilityKey[]): Record<`${AbilityKey}_save_proficient`, boolean> {
  const has = (a: AbilityKey) => saves.includes(a)
  return {
    strength_save_proficient: has('strength'), dexterity_save_proficient: has('dexterity'),
    constitution_save_proficient: has('constitution'), intelligence_save_proficient: has('intelligence'),
    wisdom_save_proficient: has('wisdom'), charisma_save_proficient: has('charisma'),
  }
}

export function skillLevels(details: DndSheetDetails): Partial<Record<SkillKey, ProficiencyLevel>> {
  const out: Partial<Record<SkillKey, ProficiencyLevel>> = {}
  for (const s of details.skills) {
    if (s.expertise) out[s.skill_key] = 'expertise'
    else if (s.proficient) out[s.skill_key] = 'proficient'
  }
  return out
}

/** Valores manuais (modo MANUAL) gravados na ficha. */
export function manualOverrides(details: DndSheetDetails): Partial<Record<OverridableField, number>> {
  const out: Partial<Record<OverridableField, number>> = {}
  for (const o of details.overrides) {
    const n = Number(o.manual_value)
    if (Number.isFinite(n)) out[o.field_key] = n
  }
  return out
}

// ── Equipamento vestido ─────────────────────────────────

export interface EquippedGear {
  armor:  ArmorEntry | null
  shield: boolean
}

/** Armadura e escudo marcados como equipados no inventário (pelo catálogo). */
export function equippedGear(details: DndSheetDetails): EquippedGear {
  let armor: ArmorEntry | null = null
  let shield = false
  for (const item of details.inventory) {
    if (!item.equipped || !item.catalog_entry_key) continue
    if (item.catalog_entry_key === SHIELD.key) { shield = true; continue }
    const found = getArmor(item.catalog_entry_key)
    if (found && !armor) armor = found
  }
  return { armor, shield }
}

function armorInput(armor: ArmorEntry | null): ArmorInput | null {
  return armor ? { category: armor.category, baseAc: armor.baseAc } : null
}

// ── Proficiências ───────────────────────────────────────

export interface ProficiencySets {
  armor:   string[]
  weapons: string[]
  /** Ferramentas e idiomas, como texto (para mostrar). */
  tools:   string[]
  languages: string[]
}

/**
 * O que o personagem sabe usar: a classe inicial dá tudo; as outras dão só o
 * que a tabela de multiclasse permite; raça, sub-raça e as proficiências
 * extras da ficha somam por cima.
 */
export function proficiencySets(classes: readonly DndCharacterClass[], raceKey: string | null, subraceKey: string | null, extras: readonly DndCharacterProficiency[]): ProficiencySets {
  const armor = new Set<string>()
  const weapons = new Set<string>()
  const tools: string[] = []
  const initial = classes.find((c) => c.is_initial) ?? classes[0]

  for (const row of classes) {
    const def = getClass(row.class_key)
    if (!def) continue
    const source = row === initial ? def : def.multiclass.gained
    source.armor.forEach((a) => armor.add(a))
    source.weapons.forEach((w) => weapons.add(w))
    source.tools.forEach((t) => { if (!tools.includes(t)) tools.push(t) })
  }

  const race = raceKey ? getRace(raceKey) : undefined
  race?.weaponProficiencies.forEach((w) => weapons.add(w))
  if (raceKey && subraceKey) getSubrace(raceKey, subraceKey)?.weaponProficiencies?.forEach((w) => weapons.add(w))

  const languages: string[] = [...(race?.languages ?? [])]
  for (const e of extras) {
    if (e.category === 'weapon') weapons.add(e.entry_key)
    else if (e.category === 'armor') armor.add(e.entry_key)
    else if (e.category === 'tool') { if (!tools.includes(e.label)) tools.push(e.label) }
    else if (e.category === 'language') { if (!languages.includes(e.label)) languages.push(e.label) }
  }
  return { armor: [...armor], weapons: [...weapons], tools, languages }
}

/** Vestindo uma armadura (ou escudo) sem proficiência: desvantagem em ataques, testes e salvaguardas de Força e Destreza, e sem magias. */
export function armorWarning(gear: EquippedGear, armorProf: readonly string[]): string | null {
  const missing: string[] = []
  if (gear.armor && !armorProf.includes(gear.armor.category)) {
    missing.push({ light: 'armadura leve', medium: 'armadura média', heavy: 'armadura pesada' }[gear.armor.category])
  }
  if (gear.shield && !armorProf.includes('shield')) missing.push('escudo')
  return missing.length ? `Sem proficiência com ${missing.join(' e ')}: desvantagem em ataques e testes de Força e Destreza, e não conjura magias.` : null
}

export function strengthWarning(gear: EquippedGear, strength: number): string | null {
  const need = gear.armor?.strengthRequirement
  return need && strength < need ? `Força ${strength} menor que a exigida (${need}): o deslocamento cai 3 metros.` : null
}

// ── Montagem do cálculo ─────────────────────────────────

export interface DerivedBundle {
  input:    DerivedInput
  derived:  Derived
  gear:     EquippedGear
  prof:     ProficiencySets
  /** Dado de vida da classe inicial etc. ficam em derived.hitDice. */
}

/** Bônus de CA digitado pelo jogador (anel de proteção, estilo de luta Defesa...), guardado nas escolhas da ficha. */
export function acBonusOf(sheet: DndCharacterSheet): number {
  const v = (sheet.choices as Record<string, unknown> | undefined)?.acBonus
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(-10, Math.min(10, Math.floor(v))) : 0
}

export function buildDerivedInput(b: SheetBundle): { input: DerivedInput; gear: EquippedGear; prof: ProficiencySets } {
  const { sheet, classes, details } = b
  const gear = equippedGear(details)
  const race = sheet.race_key ? getRace(sheet.race_key) : undefined

  const classRows = classes.map((c) => ({ classKey: c.class_key, level: c.level }))
  const engineClasses = classRows.length > 0
    ? toClassLevels(classRows)
    : [{ classKey: NO_CLASS, level: sheet.level }]

  const hpLevels = buildHpLevels(
    classes.map((c) => ({ classKey: c.class_key, level: c.level, isInitial: c.is_initial, hpRolls: c.hp_rolls })),
    hitDieOf,
  )

  const input: DerivedInput = {
    abilities:        abilityScores(sheet),
    classes:          engineClasses,
    saveProficiency:  saveProficiencies(sheet),
    skillProficiency: skillLevels(details),
    combat: {
      armor:           armorInput(gear.armor),
      shield:          gear.shield,
      acBonus:         acBonusOf(sheet),
      hpLevels,
      hpBonusPerLevel: raceHpBonusPerLevel(sheet.race_key ?? '', sheet.subrace_key),
      baseSpeed:       race?.speed ?? 30,
    },
    overrides: manualOverrides(details),
  }
  return { input, gear, prof: proficiencySets(classes, sheet.race_key, sheet.subrace_key, b.proficiencies) }
}

export function deriveSheet(b: SheetBundle): DerivedBundle {
  const { input, gear, prof } = buildDerivedInput(b)
  return { input, derived: computeDerived(input), gear, prof }
}

// ── Ataques com arma ────────────────────────────────────

export interface AttackView {
  weapon:  WeaponEntry
  attack:  WeaponAttack
  proficient: boolean
}

/** Bônus de ataque e dano de uma arma do catálogo para esta ficha. */
export function attackFor(weaponKey: string, derived: Derived, weaponProf: readonly string[]): AttackView | null {
  const weapon = getWeapon(weaponKey)
  if (!weapon) return null
  const proficient = weaponProficient(weapon, weaponProf)
  const attack = weaponAttack({
    range: weapon.range, properties: weapon.properties, damage: weapon.damage,
    strMod: derived.abilityMods.strength, dexMod: derived.abilityMods.dexterity,
    proficiencyBonus: derived.proficiencyBonus, proficient,
  })
  return { weapon, attack, proficient }
}

// ── Colunas calculadas gravadas na ficha ────────────────

/**
 * Valores calculados que a ficha guarda nas próprias colunas, para os cards do
 * mestre e as telas antigas mostrarem sem refazer a conta. A tela sempre
 * recalcula a partir das regras; estas colunas são só o último resultado.
 */
export function derivedColumns(derived: Derived, current: DndCharacterSheet): Partial<DndCharacterSheet> {
  const caster = derived.spellcasting?.classes[0]
  return {
    armor_class:        Math.max(0, Math.min(99, derived.armorClass)),
    initiative_bonus:   Math.max(-99, Math.min(99, derived.initiative)),
    speed:              Math.max(0, Math.min(999, derived.speed)),
    proficiency_bonus:  Math.max(0, Math.min(20, derived.proficiencyBonus)),
    // sem classes com dado de vida, o PV máximo continua sendo o digitado
    hp_max:             Math.max(1, derived.hpMax ?? current.hp_max),
    spell_save_dc:      caster ? caster.saveDc : null,
    spell_attack_bonus: caster ? caster.attackBonus : null,
    spellcasting_ability: caster ? caster.ability : current.spellcasting_ability,
  }
}

/** PV atual preso entre 0 e o máximo. */
export function clampHp(current: number, max: number): number {
  return Math.max(0, Math.min(max, Math.floor(current)))
}

// ── Textos ──────────────────────────────────────────────

/** "Guerreiro 5 / Mago 3" (classe inicial primeiro); sem classes, o texto livre antigo. */
export function classLine(classes: readonly DndCharacterClass[], fallback?: string | null): string {
  if (classes.length === 0) return fallback?.trim() || 'Sem classe'
  const ordered = [...classes].sort((a, b) => Number(b.is_initial) - Number(a.is_initial))
  return ordered.map((c) => `${getClass(c.class_key)?.name ?? c.class_key} ${c.level}`).join(' / ')
}

/** Nome do item do inventário: o do catálogo quando há chave, senão o digitado. */
export function itemTitle(name: string, catalogKey: string | null): string {
  if (!catalogKey) return name
  return getWeapon(catalogKey)?.name ?? getArmor(catalogKey)?.name ?? (catalogKey === SHIELD.key ? SHIELD.name : null) ?? getGear(catalogKey)?.name ?? name
}
