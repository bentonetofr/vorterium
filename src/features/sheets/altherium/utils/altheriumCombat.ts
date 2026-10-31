import {
  WEAPON_PROPERTIES,
  findArmor,
  findWeapon,
  type DamageType,
  type WeaponAttribute,
  type WeaponCategory,
  type WeaponProperty,
  type WeaponPropertyId,
  type WeaponRange,
} from '../constants/altheriumItems'
import type { AltheriumInventoryItem } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Combate de Altherium ("Crepúsculo Vermelho", livro 2.0). Só contas: a
// tela (AltheriumCombatPanel) monta os testes com isso.
// ────────────────────────────────────────────────────────

// ── Local atingido ───────────────────────────────────────

export type BodyZoneId = 'db_pernas' | 'db_bracos' | 'db_tronco' | 'db_cabeca'

/** 1d10: 1-3 pernas, 4-6 braços, 7-9 tronco, 10 cabeça. */
export function zoneForRoll(n: number): BodyZoneId {
  if (n <= 3) return 'db_pernas'
  if (n <= 6) return 'db_bracos'
  if (n <= 9) return 'db_tronco'
  return 'db_cabeca'
}

export const ZONE_LABELS: Record<BodyZoneId, string> = {
  db_pernas: 'Pernas',
  db_bracos: 'Braços',
  db_tronco: 'Tronco',
  db_cabeca: 'Cabeça',
}

// ── Armas do inventário ──────────────────────────────────

export interface CombatWeapon {
  inventoryId: string
  name:        string
  damageDice:  string
  damageType:  DamageType
  attribute:   WeaponAttribute
  range:       WeaponRange
  category:    WeaponCategory | null
  properties:  WeaponProperty[]
}

/** As armas do inventário (catálogo ou personalizadas) com o que o combate precisa. */
export function combatWeapons(inventory: AltheriumInventoryItem[]): CombatWeapon[] {
  const out: CombatWeapon[] = []
  for (const inv of inventory) {
    if (inv.item_type !== 'arma') continue
    if (inv.custom_name !== null) {
      if (!inv.custom_damage_dice) continue
      out.push({
        inventoryId: inv.id, name: inv.custom_name, damageDice: inv.custom_damage_dice,
        damageType: inv.custom_damage_type ?? 'corte', attribute: inv.custom_attribute ?? 'furia',
        range: inv.custom_range ?? 'toque', category: null, properties: [],
      })
      continue
    }
    const w = findWeapon(inv.item_id)
    if (!w) continue
    out.push({
      inventoryId: inv.id, name: w.name, damageDice: w.damageDice, damageType: w.damageType,
      attribute: w.attribute, range: w.range, category: w.category, properties: w.properties,
    })
  }
  return out
}

export function hasProperty(w: CombatWeapon | null | undefined, id: WeaponPropertyId): boolean {
  return !!w?.properties.some((p) => p.id === id)
}

export function propertyValue(w: CombatWeapon | null | undefined, id: WeaponPropertyId): number {
  return w?.properties.find((p) => p.id === id)?.value ?? 0
}

export type AttackMode = 'corpo' | 'distancia'

/** Modos de ataque da arma: corpo a corpo em Toque, à distância nas de alcance, os dois nas arremessáveis. */
export function attackModes(w: CombatWeapon): AttackMode[] {
  if (hasProperty(w, 'arremessavel')) return w.range === 'curto' ? ['distancia'] : ['corpo', 'distancia']
  if (w.category === 'alcance' || (w.range !== 'toque' && w.range !== 'toque_curto')) return ['distancia']
  return ['corpo']
}

/** Corpo a corpo usa Luta; à distância, Precisão (arremessadas também). */
export function attackDomain(mode: AttackMode): 'luta' | 'precisao' {
  return mode === 'corpo' ? 'luta' : 'precisao'
}

// ── Modificadores ────────────────────────────────────────

/** Soma dos dados a mais ou a menos, presa em ±2 (regra de Armas à Distância e das outras). */
export function clampDice(n: number): number {
  return Math.max(-2, Math.min(2, n))
}

/** Faixas além do alcance: 1 → −1 dado, 2 → −2 dados, mais que isso não alcança (null). */
export function rangePenalty(bandsBeyond: number): number | null {
  if (bandsBeyond <= 0) return 0
  if (bandsBeyond > 2) return null
  return -bandsBeyond
}

/** Cercar: com 2 ou mais em Toque do alvo, cada atacante recebe +1 por atacante além do primeiro. */
export function surroundBonus(attackersInTouch: number): number {
  return attackersInTouch >= 2 ? attackersInTouch - 1 : 0
}

/** Crítico: o dano é rolado duas vezes ("2d8+1" → "4d8+2"). */
export function doubleDamage(formula: string): string {
  const m = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(formula.trim())
  if (!m) return formula
  const count = (m[1] ? Number(m[1]) : 1) * 2
  const bonus = m[3] ? Number(m[3]) * 2 : 0
  return `${count}d${m[2]}${bonus > 0 ? `+${bonus}` : bonus < 0 ? bonus : ''}`
}

// ── Defesa e Aparar ──────────────────────────────────────

/** Ataque contra Defesa: empate favorece a defesa. */
export function attackHits(attack: number, defense: number): boolean {
  return attack > defense
}

export interface ParryResult {
  parried:  boolean
  counter:  boolean
  margin:   number
}

/** Aparar: segura o golpe com o total igual ou maior; Contra-ataque com 5 a mais (4 com Fluxo) ou crítico. */
export function parryResult(parry: number, attack: number, opts: { fluxo?: boolean; crit?: boolean } = {}): ParryResult {
  const margin = parry - attack
  const parried = margin >= 0 || !!opts.crit
  const need = opts.fluxo ? 4 : 5
  return { parried, counter: parried && (!!opts.crit || margin >= need), margin }
}

// ── Dano ─────────────────────────────────────────────────

export type FullDamageType = DamageType | 'fogo' | 'runico'

export const FULL_DAMAGE_LABELS: Record<FullDamageType, string> = {
  corte:      'Cortante',
  perfurante: 'Perfurante',
  impacto:    'Impacto',
  fogo:       'Fogo',
  runico:     'Rúnico',
}

export interface DamageInput {
  damage:      number
  type:        FullDamageType
  /** DB da parte atingida. */
  db:          number
  /** Perfurante X e outras regras que ignoram armadura. */
  ignoreDb?:   number
  vulnerable?: boolean
  resistance?: number
  immune?:     boolean
  /** Armadura feita com partes de Eryndor protege normalmente contra Rúnico. */
  eryndorArmor?: boolean
}

export interface DamageStep { label: string; value: number }

export interface DamageResult {
  final:      number
  steps:      DamageStep[]
  /** O dano não passou do DB: a armadura daquela parte perde 10% de Integridade. */
  armorWear:  boolean
}

/**
 * Dano e Armadura, na ordem do livro: (1) dano rolado; (2) Vulnerável dobra;
 * (3) tira o DB, já descontando Perfurante e o Rúnico (que ignora metade
 * do DB, arredondada pra baixo, menos em armadura de Eryndor); (4) 0 ou
 * menos vira 1 e a armadura se desgasta; (5) tira a Resistência (pode
 * chegar a 0); (6) Imune ignora tudo. Resistência e vulnerabilidade ao
 * mesmo tipo se anulam.
 */
export function applyDamage(input: DamageInput): DamageResult {
  const steps: DamageStep[] = []
  const cancel = !!input.vulnerable && (input.resistance ?? 0) > 0
  const vulnerable = input.vulnerable && !cancel
  const resistance = cancel ? 0 : Math.max(0, input.resistance ?? 0)

  let dmg = Math.max(0, Math.trunc(input.damage))
  steps.push({ label: 'Dano rolado', value: dmg })
  if (vulnerable) { dmg *= 2; steps.push({ label: 'Vulnerável (dobra)', value: dmg }) }
  if (cancel) steps.push({ label: 'Resistência e vulnerabilidade se anulam', value: dmg })

  let db = Math.max(0, input.db - Math.max(0, input.ignoreDb ?? 0))
  if (input.type === 'runico' && !input.eryndorArmor) db -= Math.floor(db / 2)
  dmg -= db
  steps.push({ label: `Menos o DB (${db})`, value: dmg })

  let armorWear = false
  if (dmg <= 0) {
    dmg = 1
    armorWear = true
    steps.push({ label: 'Dano mínimo', value: 1 })
  }
  if (resistance > 0) {
    dmg = Math.max(0, dmg - resistance)
    steps.push({ label: `Resistência ${resistance}`, value: dmg })
  }
  if (input.immune) {
    dmg = 0
    steps.push({ label: 'Imune', value: 0 })
  }
  return { final: dmg, steps, armorWear }
}

/** O DB da parte vem de uma Armadura do guardião de Eryndor equipada ali? */
export function zoneHasEryndorArmor(inventory: AltheriumInventoryItem[], zone: BodyZoneId): boolean {
  return inventory.some((i) => i.equipped && i.equipped_zone === zone && findArmor(i.item_id)?.id === 'armadura_guardiao_eryndor')
}

// ── Tabela de Punição (falha crítica na Defesa) ──────────

export const PUNISHMENT_TABLE: { roll: number; name: string; effect: string; condition?: ConditionId }[] = [
  { roll: 1,  name: 'Abertura Fatal',        effect: 'No próximo turno o inimigo tem +3 no teste de Ataque contra você.', condition: 'abertura_fatal' },
  { roll: 2,  name: 'Desequilíbrio',         effect: 'Perde sua Ação Bônus no próximo turno.',                         condition: 'desequilibrio' },
  { roll: 3,  name: 'Arma Exposta',          effect: 'Sofre −2 DB até o fim do turno.',                                condition: 'arma_exposta' },
  { roll: 4,  name: 'Impacto Reverso',       effect: 'Sofre + metade do dano causado.' },
  { roll: 5,  name: 'Fraqueza',              effect: '−1 ponto de Fúria por 1d4 turnos.',                              condition: 'fraqueza' },
  { roll: 6,  name: 'Fôlego Quebrado',       effect: '−1 ponto de Impulso por 1d4 turnos.',                            condition: 'folego_quebrado' },
  { roll: 7,  name: 'Brecha Triunfica',      effect: 'Incapaz de usar triunfos no próximo turno.',                     condition: 'brecha' },
  { roll: 8,  name: 'Sangramento Leve',      effect: 'Sofre 2 de dano por turno até gastar uma Ação Bônus para estancar.', condition: 'sangrando' },
  { roll: 9,  name: 'Atordoamento Breve',    effect: 'Não pode realizar reações até seu próximo turno.',               condition: 'atordoamento_breve' },
  { roll: 10, name: 'Colapso do Crepúsculo', effect: 'Cai no chão e sofre −2 no teste de defesa até levantar (Ação Padrão).', condition: 'derrubado' },
]

/** Falha crítica na Defesa: 1 natural no dado que valeu. */
export function defenseFumble(kept: number): boolean {
  return kept === 1
}

// ── Condições ────────────────────────────────────────────

export type ConditionId =
  | 'sangrando' | 'queimando' | 'atordoado' | 'derrubado' | 'amedrontado' | 'preso' | 'surpreendido'
  | 'abertura_fatal' | 'desequilibrio' | 'arma_exposta' | 'fraqueza' | 'folego_quebrado' | 'brecha' | 'atordoamento_breve'

export interface ConditionDef {
  id:     ConditionId
  label:  string
  effect: string
  /** Dano no início de cada turno (ignora DB). */
  tickDamage?: number
  /** Turnos que dura por padrão (null = até tirar). */
  maxTurns?:   number
  /** Some no início do próximo turno do personagem. */
  untilNextTurn?: boolean
  /** Bloqueia a Reação enquanto durar. */
  blocksReaction?: boolean
  /** Some no fim da cena. */
  scene?: boolean
  /** Mexe num atributo enquanto durar. */
  attribute?: { id: 'furia' | 'impulso'; value: number }
  /** Mexe na Defesa enquanto durar. */
  defense?: number
  /** Mexe no DB enquanto durar. */
  db?: number
}

/** Sangrando: o livro diz 2 por turno (Condições) e 1d4 (Núcleo Corte); fica 2 até o mestre escolher. */
export const BLEED_DAMAGE = 2

export const CONDITIONS: ConditionDef[] = [
  { id: 'sangrando',    label: 'Sangrando',    effect: `Sofre ${BLEED_DAMAGE} de dano por turno até gastar uma Ação Bônus para estancar.`, tickDamage: BLEED_DAMAGE },
  { id: 'queimando',    label: 'Queimando',    effect: '2 de dano no início de cada turno, ignora DB. Até gastar uma Ação de Movimento para apagar, ou no máximo 3 turnos.', tickDamage: 2, maxTurns: 3 },
  { id: 'atordoado',    label: 'Atordoado',    effect: 'Perde a próxima Ação Bônus.' },
  { id: 'derrubado',    label: 'Derrubado',    effect: 'Está no chão: −2 na Defesa até levantar.', defense: -2 },
  { id: 'amedrontado',  label: 'Amedrontado',  effect: '−1 em Fúria até o fim da cena.', scene: true, attribute: { id: 'furia', value: -1 } },
  { id: 'preso',        label: 'Preso',        effect: 'Não pode se mover. Para se soltar, gasta uma Ação Padrão e testa Brutalidade + Fúria.' },
  { id: 'surpreendido', label: 'Surpreendido', effect: 'Não pode usar Reações até o fim do primeiro turno.', untilNextTurn: true, blocksReaction: true },
  { id: 'abertura_fatal',     label: 'Abertura Fatal',     effect: 'No próximo turno o inimigo tem +3 no Ataque contra você.', untilNextTurn: true },
  { id: 'desequilibrio',      label: 'Desequilíbrio',      effect: 'Perde a Ação Bônus no próximo turno.' },
  { id: 'arma_exposta',       label: 'Arma Exposta',       effect: '−2 DB até o fim do turno.', untilNextTurn: true, db: -2 },
  { id: 'fraqueza',           label: 'Fraqueza',           effect: '−1 de Fúria.', attribute: { id: 'furia', value: -1 } },
  { id: 'folego_quebrado',    label: 'Fôlego Quebrado',    effect: '−1 de Impulso.', attribute: { id: 'impulso', value: -1 } },
  { id: 'brecha',             label: 'Brecha Triunfica',   effect: 'Não pode usar triunfos no próximo turno.' },
  { id: 'atordoamento_breve', label: 'Atordoamento Breve', effect: 'Não pode realizar reações até o próximo turno.', untilNextTurn: true, blocksReaction: true },
]

export function conditionDef(id: ConditionId): ConditionDef {
  return CONDITIONS.find((c) => c.id === id)!
}

/** Condição ativa na ficha: `turns` = turnos que faltam (null = até tirar). */
export interface ActiveCondition {
  id:    ConditionId
  turns: number | null
}

/** Estado de combate guardado na ficha (coluna combat_state). */
export interface CombatState {
  reaction_used: boolean
  defend_total:  boolean
  aim:           boolean
  conditions:    ActiveCondition[]
  /** Armas com Recarga já disparadas (ids do inventário). */
  unloaded:      string[]
}

export const EMPTY_COMBAT: CombatState = { reaction_used: false, defend_total: false, aim: false, conditions: [], unloaded: [] }

export function readCombatState(raw: unknown): CombatState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<CombatState>
  return {
    reaction_used: !!r.reaction_used,
    defend_total:  !!r.defend_total,
    aim:           !!r.aim,
    conditions:    Array.isArray(r.conditions) ? r.conditions.filter((c) => CONDITIONS.some((d) => d.id === c?.id)) : [],
    unloaded:      Array.isArray(r.unloaded) ? r.unloaded.filter((x) => typeof x === 'string') : [],
  }
}

export function hasCondition(state: CombatState, id: ConditionId): boolean {
  return state.conditions.some((c) => c.id === id)
}

/** Põe a condição (ou renova a duração, se já tem). */
export function addCondition(state: CombatState, id: ConditionId, turns: number | null = conditionDef(id).maxTurns ?? null): CombatState {
  const rest = state.conditions.filter((c) => c.id !== id)
  return { ...state, conditions: [...rest, { id, turns }] }
}

export function removeCondition(state: CombatState, id: ConditionId): CombatState {
  return { ...state, conditions: state.conditions.filter((c) => c.id !== id) }
}

/** Pode usar a Reação agora? */
export function reactionAvailable(state: CombatState): boolean {
  return !state.reaction_used && !state.conditions.some((c) => conditionDef(c.id).blocksReaction)
}

/** Soma das condições num atributo (Amedrontado, Fraqueza...). */
export function conditionAttributeMod(state: CombatState, attr: 'furia' | 'impulso'): number {
  return state.conditions.reduce((sum, c) => {
    const a = conditionDef(c.id).attribute
    return a && a.id === attr ? sum + a.value : sum
  }, 0)
}

export function conditionDefenseMod(state: CombatState): number {
  return state.conditions.reduce((sum, c) => sum + (conditionDef(c.id).defense ?? 0), 0)
}

export function conditionDbMod(state: CombatState): number {
  return state.conditions.reduce((sum, c) => sum + (conditionDef(c.id).db ?? 0), 0)
}

export interface TurnStart {
  state:  CombatState
  /** Dano contínuo do início do turno (ignora DB). */
  damage: { label: string; amount: number }[]
  /** Condições que acabaram. */
  ended:  string[]
}

/**
 * Início do turno do personagem: renova a Reação, acaba o Defender Total,
 * aplica o dano contínuo (Queimando, Sangrando), conta os turnos e tira o
 * que durava "até o próximo turno".
 */
export function startTurn(state: CombatState): TurnStart {
  const damage: TurnStart['damage'] = []
  const ended: string[] = []
  const conditions: ActiveCondition[] = []
  for (const c of state.conditions) {
    const def = conditionDef(c.id)
    if (def.tickDamage) damage.push({ label: def.label, amount: def.tickDamage })
    if (def.untilNextTurn) { ended.push(def.label); continue }
    if (c.turns != null) {
      const left = c.turns - 1
      if (left <= 0) { ended.push(def.label); continue }
      conditions.push({ id: c.id, turns: left })
    } else {
      conditions.push(c)
    }
  }
  return { state: { ...state, reaction_used: false, defend_total: false, conditions }, damage, ended }
}

/** Fim da cena: tira as condições de cena (Amedrontado) e zera Mirar e Defender Total. */
export function endScene(state: CombatState): CombatState {
  return {
    ...state,
    aim: false,
    defend_total: false,
    reaction_used: false,
    conditions: state.conditions.filter((c) => !conditionDef(c.id).scene),
  }
}

export function propertyHint(id: WeaponPropertyId): string {
  return WEAPON_PROPERTIES[id].description
}
