import type { DndCharacterSheet, DndCharacterSheetUpdateInput, DndCondition } from '../../../../shared/types'
import { getBackground, getRace } from '../catalog'
import type { AbilityKey, Derived } from '../rules/types'
import { isManualMode, type ManualMode } from './automation'
import { clampHp, derivedColumns, spellAbilityOf } from './sheetModel'

// ────────────────────────────────────────────────────────
// O que a pessoa edita na ficha D&D (os campos da própria linha da ficha) e
// como isso vira o que o banco recebe. Os números calculados (CA, PV máximo,
// iniciativa, deslocamento, CD das magias) saem do motor de regras e são
// gravados junto, pros cards do mestre.
// ────────────────────────────────────────────────────────

export const DND_TEXT_LIMITS = {
  character_name: 120, player_name: 120, alignment: 80, race_custom: 80,
  concentrating_on: 160, personality_traits: 2000, ideals: 2000, bonds: 2000, flaws: 2000, backstory: 12000, notes: 12000,
  notes_racial: 6000, notes_background: 6000, notes_class: 6000,
} as const

export interface DndForm {
  character_name: string
  player_name:    string
  alignment:      string
  race_key:       string
  subrace_key:    string
  /** Raça digitada à mão (fora do catálogo): vale quando não há raça do catálogo; vai na coluna `race`. */
  race_custom:    string
  background_key: string
  experience:     number
  /** Nível digitado: só vale enquanto a ficha não tem classes (com classes, o nível é a soma delas). */
  level:          number
  inspiration:    boolean
  hp_current:     number
  hp_temp:        number
  /** PV máximo digitado: só vale enquanto a ficha não tem classes com dado de vida. */
  hp_max:         number
  strength: number; dexterity: number; constitution: number; intelligence: number; wisdom: number; charisma: number
  strength_save_proficient: boolean; dexterity_save_proficient: boolean; constitution_save_proficient: boolean
  intelligence_save_proficient: boolean; wisdom_save_proficient: boolean; charisma_save_proficient: boolean
  death_save_successes: number
  death_save_failures:  number
  personality_traits: string
  ideals:             string
  bonds:              string
  flaws:              string
  backstory:          string
  notes:              string
  coin_cp: number; coin_sp: number; coin_ep: number; coin_gp: number; coin_pp: number
  conditions:        DndCondition[]
  exhaustion:        number
  concentrating_on:  string
  hit_dice_used:     Record<string, number>
  /** Bônus fixo de CA (anel de proteção, estilo de luta Defesa); vai em `choices.acBonus`. */
  ac_bonus:          number
  /** Atributo de conjuração escolhido à mão ('' = o da classe); vai em `choices.spellAbility`. */
  spell_ability:     AbilityKey | ''
  /** Anotações por origem (Características): vão em `choices.notesRacial`, `notesBackground` e `notesClass`. */
  notes_racial:      string
  notes_background:  string
  notes_class:       string
  /** Comportamentos automáticos desligados no botão Automatizar; vai em `choices.manualModes`. */
  manual_modes:      ManualMode[]
  /** Unidade em que o deslocamento é mostrado: metros (padrão da edição brasileira) ou pés; vai em `choices.speedUnit`. */
  speed_unit:        'm' | 'ft'
  /** Nomes das classes digitadas à mão (fora do catálogo), por chave da classe; vai em `choices.classNames`. */
  class_names:       Record<string, string>
}

export function formFromSheet(s: DndCharacterSheet): DndForm {
  const choices = (s.choices ?? {}) as Record<string, unknown>
  return {
    character_name: s.character_name ?? '',
    player_name:    s.player_name ?? '',
    alignment:      s.alignment ?? '',
    race_key:       s.race_key ?? '',
    subrace_key:    s.subrace_key ?? '',
    race_custom:    s.race_key ? '' : (s.race ?? ''),
    background_key: s.background_key ?? '',
    experience:     s.experience,
    level:          s.level,
    inspiration:    s.inspiration,
    hp_current:     s.hp_current,
    hp_temp:        s.hp_temp,
    hp_max:         s.hp_max,
    strength: s.strength, dexterity: s.dexterity, constitution: s.constitution,
    intelligence: s.intelligence, wisdom: s.wisdom, charisma: s.charisma,
    strength_save_proficient: s.strength_save_proficient, dexterity_save_proficient: s.dexterity_save_proficient,
    constitution_save_proficient: s.constitution_save_proficient, intelligence_save_proficient: s.intelligence_save_proficient,
    wisdom_save_proficient: s.wisdom_save_proficient, charisma_save_proficient: s.charisma_save_proficient,
    death_save_successes: s.death_save_successes,
    death_save_failures:  s.death_save_failures,
    personality_traits: s.personality_traits ?? '',
    ideals:             s.ideals ?? '',
    bonds:              s.bonds ?? '',
    flaws:              s.flaws ?? '',
    backstory:          s.backstory ?? '',
    notes:              s.notes ?? '',
    coin_cp: s.coin_cp ?? 0, coin_sp: s.coin_sp ?? 0, coin_ep: s.coin_ep ?? 0, coin_gp: s.coin_gp ?? 0, coin_pp: s.coin_pp ?? 0,
    conditions:       [...(s.conditions ?? [])],
    exhaustion:       s.exhaustion ?? 0,
    concentrating_on: s.concentrating_on ?? '',
    hit_dice_used:    { ...(s.hit_dice_used ?? {}) },
    ac_bonus:         typeof choices.acBonus === 'number' ? choices.acBonus : 0,
    spell_ability:    spellAbilityOf(s) ?? '',
    notes_racial:     typeof choices.notesRacial === 'string' ? choices.notesRacial : '',
    notes_background: typeof choices.notesBackground === 'string' ? choices.notesBackground : '',
    notes_class:      typeof choices.notesClass === 'string' ? choices.notesClass : '',
    speed_unit:       choices.speedUnit === 'ft' ? 'ft' : 'm',
    manual_modes:     Array.isArray(choices.manualModes) ? choices.manualModes.filter(isManualMode).sort() : [],
    class_names:      classNamesOf(choices),
  }
}

/** Os nomes das classes digitadas à mão, guardados nas escolhas da ficha (`choices.classNames`). */
export function classNamesOf(choices: unknown): Record<string, string> {
  const raw = (choices as { classNames?: unknown } | null | undefined)?.classNames
  const out: Record<string, string> = {}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 80)
  }
  return out
}

/** A ficha como o motor a enxerga: a linha do banco com o que está no formulário por cima. */
export function sheetWithForm(sheet: DndCharacterSheet, f: DndForm): DndCharacterSheet {
  return {
    ...sheet,
    race_key: f.race_key || null, subrace_key: f.subrace_key || null, background_key: f.background_key || null,
    experience: f.experience, level: f.level, hp_max: f.hp_max,
    strength: f.strength, dexterity: f.dexterity, constitution: f.constitution,
    intelligence: f.intelligence, wisdom: f.wisdom, charisma: f.charisma,
    strength_save_proficient: f.strength_save_proficient, dexterity_save_proficient: f.dexterity_save_proficient,
    constitution_save_proficient: f.constitution_save_proficient, intelligence_save_proficient: f.intelligence_save_proficient,
    wisdom_save_proficient: f.wisdom_save_proficient, charisma_save_proficient: f.charisma_save_proficient,
    choices: { ...(sheet.choices ?? {}), acBonus: f.ac_bonus, spellAbility: f.spell_ability || undefined, manualModes: f.manual_modes },
  }
}

export function validateForm(f: DndForm): string | null {
  const L = DND_TEXT_LIMITS
  const over = (v: string, n: number) => v.trim().length > n
  if (over(f.character_name, L.character_name)) return `O nome deve ter no máximo ${L.character_name} caracteres.`
  if (over(f.player_name, L.player_name)) return `O nome do jogador deve ter no máximo ${L.player_name} caracteres.`
  if (over(f.alignment, L.alignment)) return `A tendência deve ter no máximo ${L.alignment} caracteres.`
  if (over(f.race_custom, L.race_custom)) return `A raça deve ter no máximo ${L.race_custom} caracteres.`
  if (over(f.concentrating_on, L.concentrating_on)) return `A concentração deve ter no máximo ${L.concentrating_on} caracteres.`
  for (const k of ['personality_traits', 'ideals', 'bonds', 'flaws', 'backstory', 'notes', 'notes_racial', 'notes_background', 'notes_class'] as const) {
    if (over(f[k], L[k])) return `Esse campo passa do limite de ${L[k]} caracteres.`
  }
  return null
}

const clampInt = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(Number.isFinite(n) ? n : min)))

/**
 * O que gravar na ficha: os campos editados, com os limites do banco, e os
 * valores calculados pelo motor. `classText` é o texto "Guerreiro 5 / Mago 3"
 * (a coluna class_name, que os cards e as telas antigas leem).
 */
function setNote(choices: Record<string, unknown>, key: string, text: string): void {
  const clean = text.trim()
  if (clean) choices[key] = clean
  else delete choices[key]
}

export function formToPayload(sheet: DndCharacterSheet, f: DndForm, derived: Derived, classText: string, hasClasses: boolean): DndCharacterSheetUpdateInput {
  const merged = sheetWithForm(sheet, f)
  const calc = derivedColumns(derived, merged)
  const hpMax = calc.hp_max ?? merged.hp_max
  const race = f.race_key ? getRace(f.race_key) : undefined
  const background = f.background_key ? getBackground(f.background_key) : undefined
  const choices = { ...((sheet.choices ?? {}) as Record<string, unknown>) }
  if (f.ac_bonus !== 0) choices.acBonus = clampInt(f.ac_bonus, -10, 10)
  else delete choices.acBonus
  if (f.spell_ability) choices.spellAbility = f.spell_ability
  else delete choices.spellAbility
  if (f.speed_unit === 'ft') choices.speedUnit = 'ft'
  else delete choices.speedUnit
  if (f.manual_modes.length > 0) choices.manualModes = [...f.manual_modes].sort()
  else delete choices.manualModes
  setNote(choices, 'notesRacial', f.notes_racial)
  setNote(choices, 'notesBackground', f.notes_background)
  setNote(choices, 'notesClass', f.notes_class)
  if (Object.keys(f.class_names).length > 0) choices.classNames = f.class_names
  else delete choices.classNames

  return {
    character_name: f.character_name.trim() || null,
    player_name:    f.player_name.trim() || null,
    alignment:      f.alignment.trim() || null,
    race:           race?.name ?? (f.race_key ? null : f.race_custom.trim() || null),
    background:     background?.name ?? null,
    class_name:     classText ? classText.slice(0, 80) : null,
    race_key:       f.race_key || null,
    subrace_key:    f.subrace_key || null,
    background_key: f.background_key || null,
    experience:     clampInt(f.experience, 0, 99999999),
    // com classes, o banco mantém o nível (soma das classes); sem classes, vale o digitado
    ...(hasClasses ? {} : { level: clampInt(f.level, 1, 20) }),
    inspiration:    f.inspiration,
    hp_current:     clampHp(f.hp_current, hpMax),
    hp_temp:        clampInt(f.hp_temp, 0, 9999),
    strength:       clampInt(f.strength, 1, 30),
    dexterity:      clampInt(f.dexterity, 1, 30),
    constitution:   clampInt(f.constitution, 1, 30),
    intelligence:   clampInt(f.intelligence, 1, 30),
    wisdom:         clampInt(f.wisdom, 1, 30),
    charisma:       clampInt(f.charisma, 1, 30),
    strength_save_proficient: f.strength_save_proficient, dexterity_save_proficient: f.dexterity_save_proficient,
    constitution_save_proficient: f.constitution_save_proficient, intelligence_save_proficient: f.intelligence_save_proficient,
    wisdom_save_proficient: f.wisdom_save_proficient, charisma_save_proficient: f.charisma_save_proficient,
    death_save_successes: clampInt(f.death_save_successes, 0, 3),
    death_save_failures:  clampInt(f.death_save_failures, 0, 3),
    personality_traits: f.personality_traits.trim() || null,
    ideals:             f.ideals.trim() || null,
    bonds:              f.bonds.trim() || null,
    flaws:              f.flaws.trim() || null,
    backstory:          f.backstory.trim() || null,
    notes:              f.notes.trim() || null,
    coin_cp: clampInt(f.coin_cp, 0, 99999999), coin_sp: clampInt(f.coin_sp, 0, 99999999), coin_ep: clampInt(f.coin_ep, 0, 99999999),
    coin_gp: clampInt(f.coin_gp, 0, 99999999), coin_pp: clampInt(f.coin_pp, 0, 99999999),
    conditions:       [...f.conditions].sort(),
    exhaustion:       clampInt(f.exhaustion, 0, 6),
    concentrating_on: f.concentrating_on.trim() || null,
    hit_dice_used:    cleanHitDice(f.hit_dice_used),
    choices,
    ...calc,
    hp_max: hpMax,
  }
}

/** Dados de vida gastos: só tipos com valor positivo, na ordem dos dados (o jsonb devolve reordenado). */
export function cleanHitDice(used: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const die of Object.keys(used).map(Number).sort((a, b) => a - b)) {
    const n = used[String(die)]
    if (n > 0) out[String(die)] = Math.floor(n)
  }
  return out
}

/** Chave estável do que está no formulário. */
export function formKey(f: DndForm): string {
  return JSON.stringify({ ...f, conditions: [...f.conditions].sort(), hit_dice_used: cleanHitDice(f.hit_dice_used) })
}

/**
 * Chave para reconhecer o eco do próprio salvamento. Com classes, o nível e o PV
 * máximo são do banco (soma das classes e dado de vida), então não entram:
 * senão o banco "discordaria" do formulário a cada save e o resetaria.
 */
export function formEchoKey(f: DndForm, hasClasses: boolean): string {
  const base = { ...f, conditions: [...f.conditions].sort(), hit_dice_used: cleanHitDice(f.hit_dice_used) } as Partial<DndForm>
  if (hasClasses) { delete base.level; delete base.hp_max }
  return JSON.stringify(base)
}

/** A ficha como ficará depois de gravar este payload (o que o servidor devolve): pra comparar o eco sem diferença de espaços e nulos. */
export function sheetAfterSave(sheet: DndCharacterSheet, payload: DndCharacterSheetUpdateInput): DndCharacterSheet {
  return { ...sheet, ...payload } as DndCharacterSheet
}

/** Colunas da ficha que o motor de regras calcula (ver derivedColumns). */
export const DERIVED_COLUMNS = [
  'armor_class', 'initiative_bonus', 'speed', 'proficiency_bonus', 'hp_max', 'spell_save_dc', 'spell_attack_bonus',
] as const

/**
 * O mesmo payload sem o que depende de classes carregadas (números calculados,
 * texto das classes, nível): usado quando alguma tabela da ficha não carregou,
 * pra um cálculo incompleto não sobrescrever o que está certo no banco.
 */
export function withoutDerived(payload: DndCharacterSheetUpdateInput): DndCharacterSheetUpdateInput {
  const out: Record<string, unknown> = { ...payload }
  for (const k of [...DERIVED_COLUMNS, 'spellcasting_ability', 'class_name', 'level']) delete out[k]
  return out as DndCharacterSheetUpdateInput
}
