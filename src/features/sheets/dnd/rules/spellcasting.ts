import type { AbilityKey, ClassLevel, ClassSpellcasting, SpellcastingDerived, SpellcastingProfile, SpellStats } from './types'

// ────────────────────────────────────────────────────────
// Conjuração (5e 2014, SRD 5.1): espaços de magia, multiclasse, Magia de
// Pacto, CD, truques e magias conhecidas ou preparadas. As tabelas abaixo
// foram conferidas contra as de classe e a "Multiclass Spellcaster" do SRD.
// ────────────────────────────────────────────────────────

export const MAX_SPELL_LEVEL = 9

/**
 * Espaços de magia de um conjurador completo, e da tabela de multiclasse,
 * por nível (1 a 20). Cada linha tem os espaços do 1º ao 9º nível de magia.
 */
export const FULL_CASTER_SLOTS: readonly (readonly number[])[] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
]

/** Magia de Pacto do Bruxo por nível de Bruxo (1 a 20): quantos espaços e de que nível. */
export const PACT_MAGIC: readonly { slots: number; level: number }[] = [
  { slots: 1, level: 1 }, { slots: 2, level: 1 }, { slots: 2, level: 2 }, { slots: 2, level: 2 },
  { slots: 2, level: 3 }, { slots: 2, level: 3 }, { slots: 2, level: 4 }, { slots: 2, level: 4 },
  { slots: 2, level: 5 }, { slots: 2, level: 5 }, { slots: 3, level: 5 }, { slots: 3, level: 5 },
  { slots: 3, level: 5 }, { slots: 3, level: 5 }, { slots: 3, level: 5 }, { slots: 3, level: 5 },
  { slots: 4, level: 5 }, { slots: 4, level: 5 }, { slots: 4, level: 5 }, { slots: 4, level: 5 },
]

const NO_SLOTS: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0]

function clampClassLevel(level: number): number {
  return Math.max(0, Math.min(20, Math.floor(level)))
}

/** A classe já tem a característica Conjuração (ou Magia de Pacto) neste nível? */
export function hasSpellcasting(profile: SpellcastingProfile, level: number): boolean {
  if (profile.kind === 'half') return level >= 2     // Paladino e Patrulheiro conjuram a partir do 2º nível
  return level >= 1
}

/** Espaços de uma classe só (tabela própria). Meio conjurador usa a coluna do nível de conjurador ceil(nível / 2). */
export function singleClassSlots(profile: SpellcastingProfile, level: number): number[] {
  const lv = clampClassLevel(level)
  if (profile.kind === 'pact' || !hasSpellcasting(profile, lv)) return [...NO_SLOTS]
  const casterLevel = profile.kind === 'full' ? lv : Math.ceil(lv / 2)
  return [...FULL_CASTER_SLOTS[casterLevel - 1]]
}

/** Nível de conjurador na multiclasse: completo conta tudo; meio conta metade, para baixo; Bruxo não entra. */
export function multiclassCasterLevel(classes: { profile: SpellcastingProfile; level: number }[]): number {
  return classes.reduce((sum, c) => {
    if (!hasSpellcasting(c.profile, c.level)) return sum
    if (c.profile.kind === 'full') return sum + c.level
    if (c.profile.kind === 'half') return sum + Math.floor(c.level / 2)
    return sum
  }, 0)
}

export interface SlotsResult {
  /** Espaços do 1º ao 9º nível (sem a Magia de Pacto). */
  slots: number[]
  pact:  { slots: number; level: number } | null
}

/**
 * Espaços de magia da ficha. Uma classe conjuradora (fora o Bruxo) usa a própria
 * tabela; duas ou mais somam os níveis de conjurador e usam a tabela da
 * multiclasse. A Magia de Pacto fica sempre à parte.
 */
export function computeSpellSlots(classes: { profile: SpellcastingProfile; level: number }[]): SlotsResult {
  const casters = classes.filter((c) => c.profile.kind !== 'pact' && hasSpellcasting(c.profile, c.level))
  let slots: number[] = [...NO_SLOTS]
  if (casters.length === 1) {
    slots = singleClassSlots(casters[0].profile, casters[0].level)
  } else if (casters.length > 1) {
    const level = Math.min(20, multiclassCasterLevel(casters))
    if (level > 0) slots = [...FULL_CASTER_SLOTS[level - 1]]
  }

  const warlockLevels = classes
    .filter((c) => c.profile.kind === 'pact' && hasSpellcasting(c.profile, c.level))
    .reduce((sum, c) => sum + c.level, 0)
  const pact = warlockLevels > 0 ? { ...PACT_MAGIC[Math.min(20, warlockLevels) - 1] } : null

  return { slots, pact }
}

/** Maior nível de magia que se consegue conjurar com esses espaços (0 = só truques). */
export function highestSpellLevel(result: SlotsResult): number {
  let highest = 0
  result.slots.forEach((n, i) => { if (n > 0) highest = i + 1 })
  if (result.pact) highest = Math.max(highest, result.pact.level)
  return highest
}

/** CD de resistência das magias: 8 + proficiência + modificador de conjuração. */
export function spellSaveDcFromMod(proficiencyBonus: number, abilityMod: number): number {
  return 8 + proficiencyBonus + abilityMod
}

/** Bônus de ataque com magia: proficiência + modificador de conjuração. */
export function spellAttackFromMod(proficiencyBonus: number, abilityMod: number): number {
  return proficiencyBonus + abilityMod
}

/** Truques conhecidos neste nível de classe. */
export function cantripsKnownAt(profile: SpellcastingProfile, level: number): number {
  const lv = clampClassLevel(level)
  return lv < 1 ? 0 : profile.cantripsKnown[lv - 1] ?? 0
}

/**
 * Magias conhecidas (Bardo, Patrulheiro, Feiticeiro, Bruxo) ou quantas podem ser
 * preparadas (Clérigo, Druida e Mago: nível + mod; Paladino: metade do nível + mod; mínimo 1).
 */
export function spellsKnownOrPreparedAt(profile: SpellcastingProfile, level: number, abilityMod: number): number {
  const lv = clampClassLevel(level)
  if (lv < 1 || !hasSpellcasting(profile, lv)) return 0
  switch (profile.learning) {
    case 'known':         return profile.spellsKnown?.[lv - 1] ?? 0
    case 'prepared':
    case 'spellbook':     return Math.max(1, lv + abilityMod)
    case 'prepared-half': return Math.max(1, Math.floor(lv / 2) + abilityMod)
  }
}

/** Magias no grimório do Mago: 6 no 1º nível e mais 2 a cada nível. */
export function wizardSpellbookSize(level: number): number {
  const lv = clampClassLevel(level)
  return lv < 1 ? 0 : 6 + 2 * (lv - 1)
}

/**
 * Tudo da conjuração para a ficha. null se nenhuma classe conjura.
 * `abilityOverride` é o atributo de conjuração escolhido à mão: vale no lugar do
 * da classe na CD, no ataque e na conta das magias preparadas.
 */
export function computeSpellcasting(
  classes: ClassLevel[],
  abilityMods: Record<AbilityKey, number>,
  proficiencyBonus: number,
  abilityOverride?: AbilityKey,
): SpellcastingDerived | null {
  const casting = classes.filter((c): c is ClassLevel & { spellcasting: SpellcastingProfile } =>
    c.spellcasting != null && hasSpellcasting(c.spellcasting, c.level))
  if (casting.length === 0) return null

  const { slots, pact } = computeSpellSlots(casting.map((c) => ({ profile: c.spellcasting, level: c.level })))

  const perClass: ClassSpellcasting[] = casting.map((c) => {
    const ability = abilityOverride ?? c.spellcasting.ability
    const mod = abilityMods[ability]
    return {
      classKey:      c.classKey,
      ability,
      saveDc:        spellSaveDcFromMod(proficiencyBonus, mod),
      attackBonus:   spellAttackFromMod(proficiencyBonus, mod),
      cantripsKnown: cantripsKnownAt(c.spellcasting, c.level),
      spellsKnownOrPrepared: spellsKnownOrPreparedAt(c.spellcasting, c.level, mod),
      spellbookSize: c.spellcasting.learning === 'spellbook' ? wizardSpellbookSize(c.level) : null,
    }
  })

  return { slots, pact, classes: perClass }
}

/**
 * CD e ataque de magia da ficha: os da primeira classe conjuradora e, sem classe
 * conjuradora, os do atributo escolhido à mão (Cavaleiro Místico, itens, homebrew).
 * Sem nenhum dos dois, não há o que mostrar (null).
 */
export function computeSpellStats(
  spellcasting: SpellcastingDerived | null,
  abilityOverride: AbilityKey | undefined,
  abilityMods: Record<AbilityKey, number>,
  proficiencyBonus: number,
): SpellStats | null {
  const first = spellcasting?.classes[0]
  if (first) return { ability: first.ability, saveDc: first.saveDc, attackBonus: first.attackBonus, chosen: abilityOverride != null }
  if (!abilityOverride) return null
  const mod = abilityMods[abilityOverride]
  return { ability: abilityOverride, saveDc: spellSaveDcFromMod(proficiencyBonus, mod), attackBonus: spellAttackFromMod(proficiencyBonus, mod), chosen: true }
}
