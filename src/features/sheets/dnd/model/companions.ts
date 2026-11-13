import type { AbilityKey, Derived, SkillKey } from '../rules/types'

// ────────────────────────────────────────────────────────
// Companheiros do personagem (D&D 5e): familiares, constructos (Defensor de Aço, Homúnculo, Canhão Místico), companheiros
// animais, montarias, criaturas invocadas e pets. Cada um é uma ficha de criatura pequena que mora na própria ficha do
// personagem (`choices.companions`, sem tabela nova), com PV, CA, atributos, ataques e habilidades.
//
// Duas formas de usar:
//  • AUTOMÁTICO (`auto`): os números que o livro amarra ao personagem (PV, CA, bônus de ataque e de dano, CD) saem do
//    nível e do bônus de proficiência de quem tem o companheiro. Ex.: Defensor de Aço = 2 + Int + 5 × nível de Artificeiro.
//  • MANUAL: tudo o que está guardado vale do jeito que foi escrito (criatura de livro, homebrew, o que o mestre mandar).
// Este arquivo só tem tipos, leitura segura do que vem do banco e as contas. Sem React.
// ────────────────────────────────────────────────────────

export const COMPANION_LIMIT = 12

export type CompanionKind = 'constructo' | 'familiar' | 'besta' | 'montaria' | 'invocado' | 'pet' | 'outro'
export const KIND_LABEL: Record<CompanionKind, string> = {
  constructo: 'Constructo', familiar: 'Familiar', besta: 'Companheiro animal', montaria: 'Montaria', invocado: 'Invocado', pet: 'Pet', outro: 'Outro',
}
export const KINDS: readonly CompanionKind[] = ['constructo', 'familiar', 'besta', 'montaria', 'invocado', 'pet', 'outro']

/** Qual regra do livro liga os números do companheiro ao personagem (manual = nenhuma). */
export type CompanionRule = 'manual' | 'steel' | 'homunculus' | 'cannon' | 'wildfire' | 'primal' | 'ranger' | 'construct_spirit'

export type CompanionState = 'ativo' | 'ausente' | 'caido' | 'morto'
export const STATE_LABEL: Record<CompanionState, string> = { ativo: 'Ativo', ausente: 'Ausente', caido: 'Caído (0 PV)', morto: 'Morto/destruído' }
const STATES = Object.keys(STATE_LABEL) as CompanionState[]

export const SIZES = ['Miúdo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Imenso'] as const

export type SpeedKey = 'walk' | 'fly' | 'swim' | 'climb' | 'burrow'
export const SPEED_LABEL: Record<SpeedKey, string> = { walk: 'Andando', fly: 'Voo', swim: 'Natação', climb: 'Escalada', burrow: 'Escavação' }
const SPEED_KEYS = Object.keys(SPEED_LABEL) as SpeedKey[]

export type TraitKind = 'trait' | 'action' | 'bonus' | 'reaction'
export const TRAIT_LABEL: Record<TraitKind, string> = { trait: 'Traço', action: 'Ação', bonus: 'Ação bônus', reaction: 'Reação' }
export const TRAIT_KINDS: readonly TraitKind[] = ['trait', 'action', 'bonus', 'reaction']

export interface CompanionAttack {
  id: string
  name: string
  kind: 'melee' | 'ranged'
  /** Alcance corpo a corpo, em pés (a tela converte). */
  reach_ft: number
  /** Alcance normal e longo à distância, em pés (0 = não tem). */
  range_ft: number
  range_long_ft: number
  /** 'spell': usa o bônus de ataque de magia do dono · 'fixed': o número `hit`. */
  hit_mode: 'spell' | 'fixed'
  hit: number
  /** Soma a proficiência do dono ao acerto (companheiro do Patrulheiro). */
  hit_pb: boolean
  /** Efeito que pede salvaguarda em vez de jogada de ataque: o atributo do alvo ('' = é jogada de ataque). */
  save: AbilityKey | ''
  /** CD da salvaguarda (0 = a CD de magia do dono). */
  dc: number
  /** Dados do dano ("1d8", "2d4"; vazio = só o número). */
  dice: string
  dmg: number
  dmg_pb: boolean
  type: string
  /** Efeito extra em texto (cai se falhar na Força CD 11...). */
  text: string
}

export interface CompanionTrait {
  id: string
  name: string
  kind: TraitKind
  text: string
  /** Usos até recarregar (0 = sem limite). */
  uses_max: number
  uses_used: number
  recharge: 'short' | 'long'
}

export interface Companion {
  id: string
  name: string
  kind: CompanionKind
  /** A criatura ou o modelo ("Defensor de Aço", "Lobo", "Corcel"...). */
  species: string
  /** Chave do modelo do catálogo de onde veio ('' = em branco). */
  template: string
  rule: CompanionRule
  /** Com regra: os números amarrados ao personagem saem das contas (senão valem os guardados). */
  auto: boolean
  size: string
  /** Tipo da criatura (Constructo, Besta, Fada...). */
  type: string
  state: CompanionState
  hp: number
  hp_max: number
  hp_temp: number
  /** PV de livro da besta (só a regra do Patrulheiro: vale o maior entre este e 4 × nível). */
  base_hp: number
  ac: number
  /** Proficiência própria (só sem regra: com regra vale a do dono). */
  pb: number
  speeds: Record<SpeedKey, number>
  abilities: Record<AbilityKey, number>
  save_prof: AbilityKey[]
  skills: { key: SkillKey; level: 'proficient' | 'expertise' }[]
  /** Soma a proficiência a todo teste e salvaguarda (Vínculo Primal das bestas da Tasha). */
  pb_checks: boolean
  senses: string
  languages: string
  resistances: string
  immunities: string
  condition_immunities: string
  /** ND (texto, "1/4"); vazio quando a criatura usa o bônus do dono. */
  cr: string
  attacks: CompanionAttack[]
  traits: CompanionTrait[]
  conditions: string[]
  notes: string
  /** Nível de referência digitado (null = o da classe que dá o companheiro, ou o nível total). */
  level_ref: number | null
  /** Nível do espaço de magia (criatura invocada por magia). */
  slot_level: number
  /** Variante: forma do Canhão ('flamethrower' | 'ballista' | 'protector'), besta da Tasha ('land' | 'sea' | 'sky') ou material do Constructo ('clay' | 'metal' | 'stone'). */
  form: string
}

// ── Valores e limites ───────────────────────────────────

let seq = 0
export const newCompanionId = (prefix = 'c'): string => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`

export const ABILITY_KEYS: readonly AbilityKey[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
export const ABILITY_SHORT: Record<AbilityKey, string> = { strength: 'FOR', dexterity: 'DES', constitution: 'CON', intelligence: 'INT', wisdom: 'SAB', charisma: 'CAR' }
export const ABILITY_NAME: Record<AbilityKey, string> = { strength: 'Força', dexterity: 'Destreza', constitution: 'Constituição', intelligence: 'Inteligência', wisdom: 'Sabedoria', charisma: 'Carisma' }

/** Perícias que uma criatura costuma ter (e o atributo de cada uma). */
export const COMPANION_SKILLS: { key: SkillKey; label: string; ability: AbilityKey }[] = [
  { key: 'acrobatics', label: 'Acrobacia', ability: 'dexterity' },
  { key: 'athletics', label: 'Atletismo', ability: 'strength' },
  { key: 'perception', label: 'Percepção', ability: 'wisdom' },
  { key: 'stealth', label: 'Furtividade', ability: 'dexterity' },
  { key: 'survival', label: 'Sobrevivência', ability: 'wisdom' },
  { key: 'insight', label: 'Intuição', ability: 'wisdom' },
  { key: 'intimidation', label: 'Intimidação', ability: 'charisma' },
  { key: 'deception', label: 'Enganação', ability: 'charisma' },
  { key: 'persuasion', label: 'Persuasão', ability: 'charisma' },
  { key: 'arcana', label: 'Arcanismo', ability: 'intelligence' },
  { key: 'nature', label: 'Natureza', ability: 'intelligence' },
  { key: 'investigation', label: 'Investigação', ability: 'intelligence' },
]

export const mod = (score: number): number => Math.floor((score - 10) / 2)
export const signed = (n: number): string => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`)

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
}
const str = (v: unknown, max: number, fallback = ''): string => (typeof v === 'string' ? v.slice(0, max) : fallback)
const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const RULES: CompanionRule[] = ['manual', 'steel', 'homunculus', 'cannon', 'wildfire', 'primal', 'ranger', 'construct_spirit']
const SKILL_KEYS = new Set<string>(COMPANION_SKILLS.map((s) => s.key))

export function blankAttack(over: Partial<CompanionAttack> = {}): CompanionAttack {
  return {
    id: newCompanionId('a'), name: 'Ataque', kind: 'melee', reach_ft: 5, range_ft: 0, range_long_ft: 0,
    hit_mode: 'fixed', hit: 0, hit_pb: false, save: '', dc: 0, dice: '1d4', dmg: 0, dmg_pb: false, type: 'cortante', text: '', ...over,
  }
}

export function blankTrait(over: Partial<CompanionTrait> = {}): CompanionTrait {
  return { id: newCompanionId('t'), name: 'Habilidade', kind: 'trait', text: '', uses_max: 0, uses_used: 0, recharge: 'long', ...over }
}

export function blankCompanion(over: Partial<Companion> = {}): Companion {
  return {
    id: newCompanionId(), name: '', kind: 'outro', species: '', template: '', rule: 'manual', auto: false, size: 'Médio', type: 'Besta',
    state: 'ativo', hp: 10, hp_max: 10, hp_temp: 0, base_hp: 0, ac: 10, pb: 2,
    speeds: { walk: 30, fly: 0, swim: 0, climb: 0, burrow: 0 },
    abilities: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    save_prof: [], skills: [], pb_checks: false,
    senses: '', languages: '', resistances: '', immunities: '', condition_immunities: '', cr: '',
    attacks: [], traits: [], conditions: [], notes: '', level_ref: null, slot_level: 4, form: '', ...over,
  }
}

function readAttack(raw: unknown): CompanionAttack {
  const r = obj(raw)
  const d = blankAttack()
  return {
    id: str(r.id, 40) || d.id, name: str(r.name, 80, d.name), kind: r.kind === 'ranged' ? 'ranged' : 'melee',
    reach_ft: clampInt(r.reach_ft, 0, 300, 5), range_ft: clampInt(r.range_ft, 0, 2000, 0), range_long_ft: clampInt(r.range_long_ft, 0, 4000, 0),
    hit_mode: r.hit_mode === 'spell' ? 'spell' : 'fixed', hit: clampInt(r.hit, -20, 40, 0), hit_pb: bool(r.hit_pb),
    save: ABILITY_KEYS.includes(r.save as AbilityKey) ? (r.save as AbilityKey) : '', dc: clampInt(r.dc, 0, 40, 0),
    dice: str(r.dice, 30), dmg: clampInt(r.dmg, -50, 200, 0), dmg_pb: bool(r.dmg_pb), type: str(r.type, 40), text: str(r.text, 600),
  }
}

function readTrait(raw: unknown): CompanionTrait {
  const r = obj(raw)
  const max = clampInt(r.uses_max, 0, 99, 0)
  return {
    id: str(r.id, 40) || newCompanionId('t'), name: str(r.name, 80, 'Habilidade'),
    kind: TRAIT_KINDS.includes(r.kind as TraitKind) ? (r.kind as TraitKind) : 'trait', text: str(r.text, 2000),
    uses_max: max, uses_used: clampInt(r.uses_used, 0, max, 0), recharge: r.recharge === 'short' ? 'short' : 'long',
  }
}

/** Lê um companheiro do jsonb do banco, com limites (o que vier torto vira o valor padrão). */
export function readCompanion(raw: unknown): Companion {
  const r = obj(raw)
  const d = blankCompanion()
  const sp = obj(r.speeds)
  const ab = obj(r.abilities)
  const rule = RULES.includes(r.rule as CompanionRule) ? (r.rule as CompanionRule) : 'manual'
  const hpMax = clampInt(r.hp_max, 0, 9999, d.hp_max)
  return {
    id: str(r.id, 40) || newCompanionId(),
    name: str(r.name, 80), kind: KINDS.includes(r.kind as CompanionKind) ? (r.kind as CompanionKind) : 'outro',
    species: str(r.species, 80), template: str(r.template, 60), rule, auto: rule !== 'manual' && bool(r.auto, true),
    size: str(r.size, 20, d.size), type: str(r.type, 40, d.type),
    state: STATES.includes(r.state as CompanionState) ? (r.state as CompanionState) : 'ativo',
    hp: clampInt(r.hp, 0, 9999, hpMax), hp_max: hpMax, hp_temp: clampInt(r.hp_temp, 0, 9999, 0), base_hp: clampInt(r.base_hp, 0, 9999, 0),
    ac: clampInt(r.ac, 0, 40, d.ac), pb: clampInt(r.pb, 0, 12, 2),
    speeds: Object.fromEntries(SPEED_KEYS.map((k) => [k, clampInt(sp[k], 0, 500, k === 'walk' ? 30 : 0)])) as Record<SpeedKey, number>,
    abilities: Object.fromEntries(ABILITY_KEYS.map((k) => [k, clampInt(ab[k], 1, 30, 10)])) as Record<AbilityKey, number>,
    save_prof: (Array.isArray(r.save_prof) ? r.save_prof : []).filter((k): k is AbilityKey => ABILITY_KEYS.includes(k as AbilityKey)),
    skills: (Array.isArray(r.skills) ? r.skills : []).flatMap((s) => {
      const x = obj(s)
      return SKILL_KEYS.has(String(x.key)) ? [{ key: x.key as SkillKey, level: (x.level === 'expertise' ? 'expertise' : 'proficient') as 'proficient' | 'expertise' }] : []
    }).slice(0, 18),
    pb_checks: bool(r.pb_checks),
    senses: str(r.senses, 200), languages: str(r.languages, 200), resistances: str(r.resistances, 200), immunities: str(r.immunities, 200),
    condition_immunities: str(r.condition_immunities, 200), cr: str(r.cr, 12),
    attacks: (Array.isArray(r.attacks) ? r.attacks : []).slice(0, 8).map(readAttack),
    traits: (Array.isArray(r.traits) ? r.traits : []).slice(0, 24).map(readTrait),
    conditions: (Array.isArray(r.conditions) ? r.conditions : []).filter((c): c is string => typeof c === 'string').slice(0, 20),
    notes: str(r.notes, 4000),
    level_ref: r.level_ref == null ? null : clampInt(r.level_ref, 1, 20, 1),
    slot_level: clampInt(r.slot_level, 3, 9, 4), form: str(r.form, 20),
  }
}

/** A lista inteira (até o limite); `raw` pode ser qualquer coisa. */
export function readCompanions(raw: unknown): Companion[] {
  return (Array.isArray(raw) ? raw : []).slice(0, COMPANION_LIMIT).map(readCompanion)
}

// ── As contas ───────────────────────────────────────────

/** Tudo o que o personagem empresta ao companheiro. */
export interface OwnerCtx {
  /** Bônus de proficiência. */
  pb: number
  mods: Record<AbilityKey, number>
  /** Ataque e CD de magia da ficha (null se nada conjura). */
  spellAttack: number | null
  spellDc: number | null
  /** Níveis por classe que dá companheiro (null = não tem a classe) e nível total. */
  levels: { artificer: number | null; ranger: number | null; druid: number | null; warlock: number | null; wizard: number | null }
  totalLevel: number
}

const CLASS_OF_RULE: Partial<Record<CompanionRule, keyof OwnerCtx['levels']>> = {
  steel: 'artificer', homunculus: 'artificer', cannon: 'artificer', primal: 'ranger', ranger: 'ranger', wildfire: 'druid',
}
/** O atributo de conjuração de cada regra, usado quando a ficha não tem ataque de magia próprio. */
const ABILITY_OF_RULE: Partial<Record<CompanionRule, AbilityKey>> = {
  steel: 'intelligence', homunculus: 'intelligence', cannon: 'intelligence', construct_spirit: 'intelligence',
  primal: 'wisdom', ranger: 'wisdom', wildfire: 'wisdom',
}

/** Os níveis por classe a partir da lista de classes da ficha (`names`: nomes digitados à mão, por chave de classe). */
export function ownerCtx(
  derived: Pick<Derived, 'proficiencyBonus' | 'abilityMods' | 'spellStats' | 'totalLevel'>,
  classes: readonly { class_key: string; level: number }[],
  names: Record<string, string> = {},
): OwnerCtx {
  const levels: OwnerCtx['levels'] = { artificer: null, ranger: null, druid: null, warlock: null, wizard: null }
  const add = (k: keyof OwnerCtx['levels'], n: number) => { levels[k] = (levels[k] ?? 0) + n }
  const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  for (const c of classes) {
    const label = plain(`${c.class_key} ${names[c.class_key] ?? ''}`)
    if (c.class_key === 'ranger' || /patrulh|ranger/.test(label)) add('ranger', c.level)
    else if (c.class_key === 'druid' || /druid/.test(label)) add('druid', c.level)
    else if (c.class_key === 'warlock' || /bruxo|warlock/.test(label)) add('warlock', c.level)
    else if (c.class_key === 'wizard' || /\bmago|wizard/.test(label)) add('wizard', c.level)
    else if (/artific|artificer/.test(label)) add('artificer', c.level)
  }
  return {
    pb: derived.proficiencyBonus, mods: derived.abilityMods,
    spellAttack: derived.spellStats?.attackBonus ?? null, spellDc: derived.spellStats?.saveDc ?? null,
    levels, totalLevel: derived.totalLevel,
  }
}

/** O nível que alimenta as contas deste companheiro: o digitado, o da classe da regra ou o nível total. */
export function levelFor(c: Companion, o: OwnerCtx): number {
  const cls = CLASS_OF_RULE[c.rule]
  return Math.max(1, c.level_ref ?? (cls ? o.levels[cls] : null) ?? o.totalLevel)
}

/** Esta regra depende do nível do dono (e a tela mostra o campo do nível)? */
export const usesLevel = (rule: CompanionRule): boolean => rule in CLASS_OF_RULE
export const usesSlot = (rule: CompanionRule): boolean => rule === 'construct_spirit'

function spellAttackOf(c: Companion, o: OwnerCtx): number {
  const ab = ABILITY_OF_RULE[c.rule] ?? 'intelligence'
  return o.spellAttack ?? o.pb + o.mods[ab]
}
export function spellDcOf(c: Companion, o: OwnerCtx): number {
  const ab = ABILITY_OF_RULE[c.rule] ?? 'intelligence'
  return o.spellDc ?? 8 + o.pb + o.mods[ab]
}

/** PV máximos e CA vindos da regra do livro (null = vale o guardado). */
export function ruleStats(c: Companion, o: OwnerCtx): { hpMax: number; ac: number; note: string } | null {
  if (!c.auto || c.rule === 'manual') return null
  const L = levelFor(c, o)
  switch (c.rule) {
    case 'steel': return { hpMax: 2 + o.mods.intelligence + 5 * L, ac: 15 + (L >= 15 ? 2 : 0), note: 'PV = 2 + Int + 5 × nível de Artificeiro · CA 15 (17 no nível 15)' }
    case 'homunculus': return { hpMax: 1 + o.mods.intelligence + L, ac: 13, note: 'PV = 1 + Int + nível de Artificeiro · CA 13' }
    case 'cannon': return { hpMax: 5 * L, ac: 18, note: 'PV = 5 × nível de Artificeiro · CA 18' }
    case 'wildfire': return { hpMax: 5 + 5 * L, ac: 13, note: 'PV = 5 + 5 × nível de Druida · CA 13' }
    case 'primal': return { hpMax: c.form === 'sky' ? 4 + 4 * L : 5 + 5 * L, ac: 13 + o.pb, note: `PV = ${c.form === 'sky' ? '4 + 4' : '5 + 5'} × nível de Patrulheiro · CA 13 + proficiência` }
    case 'ranger': return { hpMax: Math.max(c.base_hp, 4 * L), ac: c.ac + o.pb, note: 'PV = o maior entre os da criatura e 4 × nível de Patrulheiro · CA da criatura + proficiência' }
    case 'construct_spirit': return { hpMax: 40 + 15 * Math.max(0, c.slot_level - 4), ac: 13 + c.slot_level, note: 'PV = 40 + 15 por nível do espaço acima do 4º · CA = 13 + nível do espaço' }
    default: return null
  }
}

/** Os dados do dano com o que o nível acrescenta: o Canhão Explosivo (Artificeiro 9) soma 1d8 ao dano do lança-chamas e da balista. */
function scaledDice(c: Companion, a: CompanionAttack, o: OwnerCtx): string {
  const dice = a.dice.trim()
  if (c.auto && c.rule === 'cannon' && levelFor(c, o) >= 9 && dice === '2d8') return '3d8'
  return dice
}

export interface AttackView {
  attack: CompanionAttack
  /** Bônus de acerto já somado (efeito com salvaguarda não tem). */
  hitBonus: number
  /** CD da salvaguarda, se o efeito pede uma. */
  saveDc: number | null
  /** Bônus fixo do dano já somado. */
  dmgBonus: number
  /** Os dados do dano já com o que o nível acrescenta ("3d8"). */
  dice: string
  /** Fórmula rolável ("1d8+3"). */
  formula: string
  /** "1d8 + 3". */
  damageText: string
}

export interface SkillView { key: SkillKey; label: string; bonus: number; level: 'proficient' | 'expertise' }

export interface CompanionView {
  /** Proficiência que vale pra ele. */
  pb: number
  /** Nível de referência usado (null se a regra não usa nível). */
  level: number | null
  hpMax: number
  ac: number
  saveDc: number | null
  saves: Record<AbilityKey, { bonus: number; proficient: boolean }>
  skills: SkillView[]
  passivePerception: number
  initiative: number
  attacks: AttackView[]
  /** De onde vêm os números automáticos (vazio no manual). */
  note: string
}

export function viewOf(c: Companion, o: OwnerCtx): CompanionView {
  const rule = ruleStats(c, o)
  const pb = c.rule === 'manual' ? c.pb : o.pb
  const mods = Object.fromEntries(ABILITY_KEYS.map((k) => [k, mod(c.abilities[k])])) as Record<AbilityKey, number>
  const extra = c.pb_checks ? pb : 0
  const saves = Object.fromEntries(ABILITY_KEYS.map((k) => {
    const proficient = c.save_prof.includes(k)
    return [k, { bonus: mods[k] + (proficient ? pb : 0) + extra, proficient }]
  })) as CompanionView['saves']
  const skills = c.skills.flatMap((s): SkillView[] => {
    const def = COMPANION_SKILLS.find((x) => x.key === s.key)
    return def ? [{ key: s.key, label: def.label, level: s.level, bonus: mods[def.ability] + pb * (s.level === 'expertise' ? 2 : 1) + extra }] : []
  })
  const perception = c.skills.find((s) => s.key === 'perception')
  const attacks = c.attacks.map((a): AttackView => {
    const hitBonus = (a.hit_mode === 'spell' ? spellAttackOf(c, o) : a.hit) + (a.hit_pb ? pb : 0)
    const saveDc = a.save ? (a.dc > 0 ? a.dc : spellDcOf(c, o)) : null
    const dmgBonus = a.dmg + (a.dmg_pb ? pb : 0)
    const bonusText = dmgBonus > 0 ? `+${dmgBonus}` : dmgBonus < 0 ? `${dmgBonus}` : ''
    const dice = scaledDice(c, a, o)
    const formula = dice ? `${dice}${bonusText}` : String(Math.max(0, dmgBonus))
    const damageText = dice ? `${dice}${dmgBonus ? ` ${dmgBonus > 0 ? '+' : '−'} ${Math.abs(dmgBonus)}` : ''}` : String(Math.max(0, dmgBonus))
    return { attack: a, hitBonus, saveDc, dmgBonus, dice, formula, damageText }
  })
  return {
    pb, level: usesLevel(c.rule) && c.auto ? levelFor(c, o) : null,
    hpMax: rule?.hpMax ?? c.hp_max, ac: rule?.ac ?? c.ac,
    saveDc: c.rule === 'manual' ? null : spellDcOf(c, o),
    saves, skills,
    passivePerception: 10 + mods.wisdom + (perception ? pb * (perception.level === 'expertise' ? 2 : 1) : 0),
    initiative: mods.dexterity,
    attacks, note: rule?.note ?? '',
  }
}

/** Vira manual: grava no próprio companheiro os números que a regra estava dando, pra continuar de onde estava. */
export function freeze(c: Companion, o: OwnerCtx): Companion {
  const v = viewOf(c, o)
  return {
    ...c, auto: false, hp_max: v.hpMax, hp: Math.min(c.hp, v.hpMax), ac: v.ac, pb: v.pb,
    attacks: c.attacks.map((a, i) => ({ ...a, hit_mode: 'fixed', hit: v.attacks[i].hitBonus, hit_pb: false, dice: v.attacks[i].dice, dmg: v.attacks[i].dmgBonus, dmg_pb: false, dc: v.attacks[i].saveDc ?? a.dc })),
  }
}

/** Volta pro automático (a regra manda de novo nos PV, na CA e nos bônus). */
export function unfreeze(c: Companion, original: Pick<Companion, 'attacks'> | null): Companion {
  if (c.rule === 'manual') return c
  return { ...c, auto: true, attacks: original ? original.attacks.map((a) => ({ ...a })) : c.attacks }
}

// ── Mexer na vida e nos usos ────────────────────────────

/** Tira dano: o PV temporário absorve primeiro; a 0 o companheiro cai (ou, sendo constructo ou invocado, é destruído por quem decide). */
export function takeDamage(c: Companion, amount: number, hpMax: number): Companion {
  const n = Math.max(0, Math.floor(amount))
  if (n === 0) return c
  const absorbed = Math.min(c.hp_temp, n)
  const hp = Math.max(0, Math.min(hpMax, c.hp) - (n - absorbed))
  return { ...c, hp_temp: c.hp_temp - absorbed, hp, state: hp === 0 && c.state === 'ativo' ? 'caido' : c.state }
}

export function heal(c: Companion, amount: number, hpMax: number): Companion {
  const n = Math.max(0, Math.floor(amount))
  if (n === 0) return c
  const hp = Math.min(hpMax, c.hp + n)
  return { ...c, hp, state: c.state === 'caido' && hp > 0 ? 'ativo' : c.state }
}

/** Descanso: recarrega os usos das habilidades (o curto só as de descanso curto; o longo todas). */
export function restCompanions(list: readonly Companion[], kind: 'short' | 'long'): Companion[] {
  return list.map((c) => (c.traits.some((t) => t.uses_used > 0 && (kind === 'long' || t.recharge === 'short'))
    ? { ...c, traits: c.traits.map((t) => (kind === 'long' || t.recharge === 'short' ? { ...t, uses_used: 0 } : t)) }
    : c))
}
