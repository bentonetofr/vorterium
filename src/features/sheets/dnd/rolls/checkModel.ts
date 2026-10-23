import { ABILITIES, SKILLS } from '../rules/abilities'
import type { AbilityKey, Derived, SkillKey } from '../rules/types'
import type { DiceRollContext, RollBreakdownItem } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Modelo do painel de teste (estilo Baldur's Gate 3), sem tela: os tiles de
// bônus montados a partir da ficha, a fórmula com vantagem e reações, e a
// decisão de sucesso, falha e crítico. A tela (DndCheckPanel) só mostra.
// ────────────────────────────────────────────────────────

export type CheckKind = 'skill' | 'save' | 'ability' | 'attack' | 'initiative' | 'death' | 'spell_attack'
export type Advantage = 'normal' | 'advantage' | 'disadvantage'

export interface BonusTile {
  /** Chave estável (para animar a entrada de cada tile). */
  id:    string
  label: string
  value: number
  /** Sigla curta para o ícone (FOR, PROF, ESP...). */
  badge: string
}

export interface CheckSpec {
  kind:      CheckKind
  /** Chave do teste: perícia, atributo, arma... */
  key:       string
  /** "Furtividade", "Salvaguarda de Destreza", "Ataque: Espada longa"... */
  label:     string
  tiles:     BonusTile[]
  /** CD conhecida (null = sem CD, ou oculta). */
  dc:        number | null
  dcHidden:  boolean
  advantage: Advantage
  /** Pedido do mestre que este teste responde. */
  requestId?: string
}

export interface Reaction {
  key:   string
  label: string
  /** Dado que soma (d4 da Orientação e da Bênção; o da Inspiração de Bardo varia). */
  die:   number
  /** Em que testes vale. */
  applies: readonly CheckKind[]
  hint:  string
}

const CHECKS: readonly CheckKind[] = ['skill', 'ability', 'initiative']
export const REACTIONS: readonly Reaction[] = [
  { key: 'guidance', label: 'Orientação', die: 4, applies: CHECKS, hint: 'Truque: +1d4 em um teste de atributo.' },
  { key: 'bless', label: 'Bênção', die: 4, applies: ['attack', 'save', 'spell_attack'], hint: '+1d4 em ataques e salvaguardas.' },
  { key: 'resistance', label: 'Resistência', die: 4, applies: ['save'], hint: 'Truque: +1d4 em uma salvaguarda.' },
  { key: 'bardic', label: 'Inspiração de Bardo', die: 6, applies: [...CHECKS, 'attack', 'save', 'spell_attack'], hint: 'O dado que o bardo deu (d6 a d12): soma em um teste, ataque ou salvaguarda.' },
]

export const BARDIC_DICE = [6, 8, 10, 12] as const

const abilityOf = (key: AbilityKey) => ABILITIES.find((a) => a.key === key)!

/** Tiles que somam `total`: os conhecidos e, se sobrar diferença (valor manual, item...), um tile "Outros". */
function withRest(tiles: BonusTile[], total: number, manual: boolean): BonusTile[] {
  const sum = tiles.reduce((s, t) => s + t.value, 0)
  if (manual) return [{ id: 'manual', label: 'Bônus manual', value: total, badge: 'MAN' }]
  if (sum === total) return tiles
  return [...tiles, { id: 'outros', label: 'Outros bônus', value: total - sum, badge: '+' }]
}

function abilityTile(key: AbilityKey, mod: number): BonusTile {
  const a = abilityOf(key)
  return { id: `mod_${key}`, label: a.label, value: mod, badge: a.short }
}

function profTiles(level: 'none' | 'half' | 'proficient' | 'expertise', prof: number): BonusTile[] {
  if (level === 'half') return [{ id: 'half', label: 'Meia proficiência', value: Math.floor(prof / 2), badge: '½' }]
  if (level === 'proficient') return [{ id: 'prof', label: 'Proficiência', value: prof, badge: 'PROF' }]
  if (level === 'expertise') return [{ id: 'prof', label: 'Proficiência', value: prof, badge: 'PROF' }, { id: 'exp', label: 'Especialista', value: prof, badge: 'ESP' }]
  return []
}

const base = (kind: CheckKind, key: string, label: string, tiles: BonusTile[]): CheckSpec =>
  ({ kind, key, label, tiles, dc: null, dcHidden: false, advantage: 'normal' })

export function skillCheck(derived: Derived, key: SkillKey): CheckSpec {
  const s = derived.skills[key]
  const def = SKILLS.find((x) => x.key === key)!
  const tiles = [abilityTile(s.ability, derived.abilityMods[s.ability]), ...profTiles(s.level, derived.proficiencyBonus)]
  return base('skill', key, def.label, withRest(tiles, s.bonus, derived.overridden.includes(`skill_${key}` as never)))
}

export function saveCheck(derived: Derived, key: AbilityKey): CheckSpec {
  const s = derived.saves[key]
  const tiles = [abilityTile(key, derived.abilityMods[key]), ...(s.proficient ? profTiles('proficient', derived.proficiencyBonus) : [])]
  return base('save', key, `Salvaguarda de ${abilityOf(key).label}`, withRest(tiles, s.bonus, derived.overridden.includes(`save_${key}` as never)))
}

export function abilityCheck(derived: Derived, key: AbilityKey): CheckSpec {
  return base('ability', key, `Teste de ${abilityOf(key).label}`, [abilityTile(key, derived.abilityMods[key])])
}

export function initiativeCheck(derived: Derived): CheckSpec {
  return base('initiative', 'initiative', 'Iniciativa', withRest([abilityTile('dexterity', derived.abilityMods.dexterity)], derived.initiative, derived.overridden.includes('initiative_bonus' as never)))
}

export function deathCheck(): CheckSpec {
  return { ...base('death', 'death', 'Salvaguarda contra a morte', []), dc: 10 }
}

export function attackCheck(label: string, key: string, ability: 'strength' | 'dexterity', mod: number, proficiency: number | null, total: number): CheckSpec {
  const tiles = [abilityTile(ability, mod), ...(proficiency ? profTiles('proficient', proficiency) : [])]
  return base('attack', key, `Ataque: ${label}`, withRest(tiles, total, false))
}

export function spellAttackCheck(derived: Derived): CheckSpec | null {
  const st = derived.spellStats
  if (!st) return null
  const tiles = [abilityTile(st.ability, derived.abilityMods[st.ability]), ...profTiles('proficient', derived.proficiencyBonus)]
  return base('spell_attack', 'spell_attack', 'Ataque de magia', withRest(tiles, st.attackBonus, derived.overridden.includes('spell_attack_bonus' as never)))
}

export const tilesTotal = (tiles: readonly BonusTile[]) => tiles.reduce((s, t) => s + t.value, 0)

export interface ChosenReaction { key: string; die: number }

/** Bônus ou ônus de situação aceito no painel (−20 a +20). */
export const SITUATIONAL_MAX = 20

/** "1d20+5", "2#d20+1d4+5" (vantagem), "2@d20-1" (desvantagem). `situational` soma ao bônus (para casos da mesa, como −2 por estar colado no inimigo). */
export function checkFormula(spec: CheckSpec, advantage: Advantage, reactions: readonly ChosenReaction[], situational = 0): string {
  const d20 = advantage === 'advantage' ? '2#d20' : advantage === 'disadvantage' ? '2@d20' : '1d20'
  const extra = reactions.map((r) => `+1d${r.die}`).join('')
  const mod = tilesTotal(spec.tiles) + situational
  return `${d20}${extra}${mod > 0 ? `+${mod}` : mod < 0 ? `${mod}` : ''}`
}

export interface CheckReading {
  /** Os d20 jogados (dois na vantagem/desvantagem) e qual valeu. */
  d20s:     number[]
  keptIndex: number
  natural:  number
  /** Valor de cada reação, na ordem em que foram escolhidas. */
  reactionValues: number[]
  total:    number
}

/** Lê a rolagem gravada (roll_breakdown) do jeito que o painel precisa. */
export function readCheck(breakdown: readonly RollBreakdownItem[], total: number): CheckReading {
  const first = breakdown[0] as { type: string; results: number[]; kept?: number }
  const d20s = first.results
  const natural = first.type === 'sum' ? d20s[0] : (first.kept ?? d20s[0])
  const keptIndex = Math.max(0, d20s.indexOf(natural))
  const reactionValues = breakdown.slice(1).filter((b) => b.type === 'sum').map((b) => (b as { results: number[] }).results[0])
  return { d20s, keptIndex, natural, reactionValues, total }
}

export type Outcome = 'success' | 'failure' | null
export type Crit = 'crit' | 'fumble' | null

/**
 * Sucesso ou falha. Ataque: 20 natural sempre acerta e 1 sempre erra.
 * Salvaguarda contra a morte: CD 10 (o 20 e o 1 têm regra própria, ver deathResult).
 * Testes e salvaguardas comuns: só o total contra a CD (regra de 2014).
 */
export function judge(kind: CheckKind, natural: number, total: number, dc: number | null): { outcome: Outcome; crit: Crit } {
  const crit: Crit = natural === 20 ? 'crit' : natural === 1 ? 'fumble' : null
  if (kind === 'attack' || kind === 'spell_attack') {
    if (natural === 20) return { outcome: dc == null ? null : 'success', crit }
    if (natural === 1) return { outcome: dc == null ? null : 'failure', crit }
  }
  if (kind === 'death') return { outcome: natural === 20 || total >= 10 ? 'success' : 'failure', crit }
  if (dc == null) return { outcome: null, crit }
  return { outcome: total >= dc ? 'success' : 'failure', crit }
}

/** Salvaguarda contra a morte: o que muda na ficha. 20: volta com 1 PV; 1: duas falhas. */
export function deathResult(natural: number, total: number, successes: number, failures: number):
  { successes: number; failures: number; revive: boolean; label: string } {
  if (natural === 20) return { successes: 0, failures: 0, revive: true, label: '20 natural: volta com 1 PV!' }
  if (natural === 1) { const f = Math.min(3, failures + 2); return { successes, failures: f, revive: false, label: f >= 3 ? '1 natural: duas falhas. Morreu.' : '1 natural: duas falhas.' } }
  if (total >= 10) { const s = Math.min(3, successes + 1); return { successes: s, failures, revive: false, label: s >= 3 ? 'Sucesso: estabilizado.' : 'Sucesso.' } }
  const f = Math.min(3, failures + 1)
  return { successes, failures: f, revive: false, label: f >= 3 ? 'Falha: morreu.' : 'Falha.' }
}

/** O contexto que vai gravado com a rolagem (dice_rolls.roll_context). */
export function checkContext(spec: CheckSpec, opts: { advantage: Advantage; reactions: readonly ChosenReaction[]; natural: number; total: number; character: string; sheetId: string; rerolledFrom?: string; situational?: number }): DiceRollContext {
  const { outcome, crit } = judge(spec.kind, opts.natural, opts.total, spec.dc)
  return {
    system: 'dnd5e',
    kind: spec.kind === 'spell_attack' ? 'attack' : spec.kind,
    key: spec.key,
    sheet_id: opts.sheetId,
    character: opts.character.slice(0, 80) || undefined,
    dc: spec.dcHidden ? null : spec.dc,
    dc_hidden: spec.dcHidden || undefined,
    advantage: opts.advantage,
    reactions: opts.reactions.length ? opts.reactions.map((r) => r.key) : undefined,
    natural: opts.natural,
    outcome: spec.dcHidden ? null : outcome,
    crit,
    request_id: spec.requestId,
    rerolled_from: opts.rerolledFrom,
    situational: opts.situational ? opts.situational : undefined,
  }
}

/** Dobra os dados de uma fórmula de dano para o crítico ("1d8+3" → "2d8+3"). */
export function critDamage(formula: string): string {
  return formula.replace(/(\d*)d(\d+)/g, (_, q: string, s: string) => `${(q ? Number(q) : 1) * 2}d${s}`)
}
