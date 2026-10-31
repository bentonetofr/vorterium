import { addResource, RESOURCES, RESOURCE_LIMIT_UNITS, formatAmount, resourceLabel, type Quality, type ResourceId, type ResourceStock, type SagaId } from './altheriumCraft'

// ────────────────────────────────────────────────────────
// Exploração de Altherium (livro 2.0): o mestre define o Local, a Escassez e
// as Condições; o personagem gasta 1 Ficha, faz o teste (Sobrevivência +
// Estratégia na natureza, Investigação + Estratégia ou Percepção + Destino
// em construções) contra a DT da Escassez e sorteia os Achados na tabela do
// Local. Só contas: a tela é AltheriumExploreModal.
// ────────────────────────────────────────────────────────

export type Rng = () => number
/** Número em [0, 1) de verdade (crypto), pra não depender de Math.random. */
export const cryptoRng: Rng = () => {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0] / 0x100000000
}

// ── Locais ───────────────────────────────────────────────

export type LocationId = 'floresta' | 'litoral' | 'montanha' | 'tundra' | 'vilarejo' | 'ruinas' | 'fenda'
export type LocationKind = 'natureza' | 'construcao'

export interface LocationDef {
  id:    LocationId
  label: string
  kind:  LocationKind
  /** Uma linha do que se acha ali. */
  hint:  string
}

export const LOCATIONS: LocationDef[] = [
  { id: 'floresta', label: 'Floresta',        kind: 'natureza',   hint: 'Muita comida e madeira.' },
  { id: 'litoral',  label: 'Litoral',         kind: 'natureza',   hint: 'Comida, madeira, fibra e sucata de naufrágios.' },
  { id: 'montanha', label: 'Montanha',        kind: 'natureza',   hint: 'Osso, couro e ferro, pouca comida.' },
  { id: 'tundra',   label: 'Tundra',          kind: 'natureza',   hint: 'Osso, couro e sebo; frio e pouca coisa.' },
  { id: 'vilarejo', label: 'Vilarejo',        kind: 'construcao', hint: 'Comida, Brennivín e utensílios.' },
  { id: 'ruinas',   label: 'Ruínas',          kind: 'construcao', hint: 'Metal, osso e moedas.' },
  { id: 'fenda',    label: 'Fenda de Eryndor', kind: 'natureza',  hint: 'Pó de Eryndor e raridades. Toda falha vira Complicação.' },
]

export function locationDef(id: string): LocationDef {
  return LOCATIONS.find((l) => l.id === id) ?? LOCATIONS[0]
}

// ── Escassez ─────────────────────────────────────────────

export type ScarcityId = 'abundante' | 'normal' | 'escasso' | 'devastado'

export interface ScarcityDef {
  id:      ScarcityId
  label:   string
  dt:      number
  example: string
}

export const SCARCITY: ScarcityDef[] = [
  { id: 'abundante', label: 'Abundante', dt: 5,  example: 'Floresta virgem, despensa cheia' },
  { id: 'normal',    label: 'Normal',    dt: 6,  example: 'Trilha comum, vilarejo' },
  { id: 'escasso',   label: 'Escasso',   dt: 8,  example: 'Montanha gelada, casa saqueada' },
  { id: 'devastado', label: 'Devastado', dt: 10, example: 'Campo de batalha queimado, tundra profunda' },
]

export function scarcityDef(id: string): ScarcityDef {
  return SCARCITY.find((s) => s.id === id) ?? SCARCITY[1]
}

// ── Condições (dados a mais ou a menos; no máximo ±2 no total) ──

export interface ExploreCondition {
  id:    string
  label: string
  delta: number
  /** Condições do clima são uma escolha só (a pior vale). */
  group?: 'clima'
}

export const EXPLORE_CONDITIONS: ExploreCondition[] = [
  { id: 'noite',    label: 'Noite ou escuridão',                  delta: -1 },
  { id: 'chuva',    label: 'Chuva, neblina ou neve',              delta: -1, group: 'clima' },
  { id: 'tempestade', label: 'Nevasca ou tempestade',             delta: -2, group: 'clima' },
  { id: 'ferramenta', label: 'Ferramenta adequada (Kit de Saqueador)', delta: 1 },
  { id: 'conhece',  label: 'Conhece o local (guia, mapa ou já viveu ali)', delta: 1 },
  { id: 'narrada',  label: 'Exploração narrada (o mestre concede)', delta: 1 },
  { id: 'ajuda',    label: 'Um aliado ajuda (gasta 1 Ficha dele)', delta: 1 },
  { id: 'barulho',  label: 'Barulho: a última exploração aqui deu Complicação', delta: -1 },
]

export const EXPLORE_DICE_LIMIT = 2

/** Soma dos dados das condições marcadas, preso em ±2. O clima conta uma vez só (o pior). */
export function conditionDice(active: Iterable<string>): number {
  const ids = new Set(active)
  let total = 0
  for (const c of EXPLORE_CONDITIONS) {
    if (!ids.has(c.id) || c.group) continue
    total += c.delta
  }
  const weather = EXPLORE_CONDITIONS.filter((c) => c.group === 'clima' && ids.has(c.id)).map((c) => c.delta)
  if (weather.length) total += Math.min(...weather)
  return Math.max(-EXPLORE_DICE_LIMIT, Math.min(EXPLORE_DICE_LIMIT, total))
}

// ── Resultado do teste ───────────────────────────────────

export type ExploreTier = 'complicacao' | 'nada' | 'sucesso' | 'sucesso5' | 'critico'

export interface ExploreOutcome {
  tier:        ExploreTier
  label:       string
  /** Achados comuns sorteados. */
  finds:       number
  /** 1 Achado Raro a mais. */
  rare:        boolean
  complication: boolean
}

/**
 * Falha por 5 ou mais: Complicação. Falha: nada. Sucesso: 2 Achados; por 5 ou
 * mais: 3; Crítico (10 natural): 3 e 1 Raro. Numa Fenda de Eryndor toda falha
 * gera Complicação.
 */
export function exploreOutcome(total: number, dt: number, crit: boolean, fenda = false): ExploreOutcome {
  if (crit) return { tier: 'critico', label: 'Crítico: 3 Achados e 1 Achado Raro', finds: 3, rare: true, complication: false }
  const diff = total - dt
  if (diff >= 5) return { tier: 'sucesso5', label: 'Sucesso por 5 ou mais: 3 Achados', finds: 3, rare: false, complication: false }
  if (diff >= 0) return { tier: 'sucesso', label: 'Sucesso: 2 Achados', finds: 2, rare: false, complication: false }
  if (diff <= -5 || fenda) {
    return { tier: 'complicacao', label: 'Falha: nada encontrado e uma Complicação', finds: 0, rare: false, complication: true }
  }
  return { tier: 'nada', label: 'Falha: nada encontrado', finds: 0, rare: false, complication: false }
}

// ── Tabela de Achados (chance de cada um, em %, por Local) ──

export type FindKind = ResourceId | 'hacksilver' | 'raro'

type Chances = Partial<Record<FindKind, number>>

export const LOOT_TABLE: Record<LocationId, Chances> = {
  floresta: { racao: 40, ferro_velho: 2,  couro: 6,  madeira: 20, fibra: 10, sebo: 0,  ervas: 15, brennivin: 0,  osso: 5,  hacksilver: 0,  po_eryndor: 1, raro: 1 },
  litoral:  { racao: 40, ferro_velho: 10, couro: 0,  madeira: 15, fibra: 15, sebo: 10, ervas: 0,  brennivin: 0,  osso: 8,  hacksilver: 0,  po_eryndor: 1, raro: 1 },
  montanha: { racao: 20, ferro_velho: 20, couro: 15, madeira: 10, fibra: 0,  sebo: 0,  ervas: 10, brennivin: 0,  osso: 20, hacksilver: 0,  po_eryndor: 3, raro: 2 },
  tundra:   { racao: 15, ferro_velho: 0,  couro: 25, madeira: 0,  fibra: 5,  sebo: 20, ervas: 0,  brennivin: 0,  osso: 30, hacksilver: 0,  po_eryndor: 3, raro: 2 },
  vilarejo: { racao: 35, ferro_velho: 10, couro: 10, madeira: 5,  fibra: 10, sebo: 10, ervas: 0,  brennivin: 15, osso: 0,  hacksilver: 5,  po_eryndor: 0, raro: 0 },
  ruinas:   { racao: 10, ferro_velho: 30, couro: 5,  madeira: 10, fibra: 10, sebo: 0,  ervas: 0,  brennivin: 5,  osso: 15, hacksilver: 10, po_eryndor: 3, raro: 2 },
  fenda:    { racao: 5,  ferro_velho: 20, osso: 25, po_eryndor: 30, raro: 20 },
}

/** Pesos do sorteio: chance (%) de cada achado do Local, sem os zeros. */
export function lootChances(location: LocationId): { kind: FindKind; chance: number }[] {
  return (Object.entries(LOOT_TABLE[location]) as [FindKind, number][])
    .filter(([, c]) => c > 0)
    .map(([kind, chance]) => ({ kind, chance }))
}

function weighted<T>(items: { value: T; weight: number }[], rng: Rng): T {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let at = rng() * total
  for (const i of items) {
    at -= i.weight
    if (at < 0) return i.value
  }
  return items[items.length - 1].value
}

/** Quantidades menores são mais comuns que as maiores. */
const RESOURCE_PCT: { value: number; weight: number }[] = [
  { value: 10, weight: 30 }, { value: 20, weight: 25 }, { value: 25, weight: 20 }, { value: 50, weight: 15 }, { value: 100, weight: 10 },
]
const RATION_PCT: { value: number; weight: number }[] = [
  { value: 25, weight: 55 }, { value: 50, weight: 30 }, { value: 100, weight: 15 },
]

export type RareKind = 'runa' | 'saga' | 'lendario' | 'reliquia'

export const RARE_LABELS: Record<RareKind, { label: string; text: string }> = {
  runa:     { label: 'Runa',            text: 'Uma pedra gravada: um Runaskin aprende um novo Triunfo.' },
  saga:     { label: 'Saga de Ofício',  text: 'Um registro antigo que destrava receitas para o grupo.' },
  lendario: { label: 'Material lendário', text: '100% de um recurso de Ofício com qualidade lendária.' },
  reliquia: { label: 'Relíquia',        text: 'Uma arma, armadura ou item especial definido pelo mestre.' },
}

export type Find =
  | { kind: 'resource'; id: ResourceId; pct: number; quality: Quality }
  | { kind: 'hacksilver'; amount: number }
  | { kind: 'raro'; rare: RareKind; resource?: ResourceId; saga?: SagaId }

const LEGENDARY_POOL: ResourceId[] = RESOURCES.filter((r) => !r.noQuality).map((r) => r.id)

/** Sorteia o tipo do Achado (o Achado Raro vira um dos quatro tesouros). */
export function rollFind(location: LocationId, rng: Rng = cryptoRng, sagasFound: SagaId[] = []): Find {
  const kind = weighted(lootChances(location).map((c) => ({ value: c.kind, weight: c.chance })), rng)
  return makeFind(kind, rng, sagasFound)
}

export function makeFind(kind: FindKind, rng: Rng = cryptoRng, sagasFound: SagaId[] = []): Find {
  if (kind === 'hacksilver') return { kind, amount: (1 + Math.floor(rng() * 10)) * 10 }
  if (kind === 'raro') return rollRare(rng, sagasFound)
  const noQuality = RESOURCES.find((r) => r.id === kind)?.noQuality
  const pct = weighted(noQuality ? RATION_PCT : RESOURCE_PCT, rng)
  return { kind: 'resource', id: kind, pct, quality: 'comum' }
}

const ALL_SAGAS: SagaId[] = ['ferreiro_torto', 'forjas_torvalenn', 'eryndor']

export function rollRare(rng: Rng = cryptoRng, sagasFound: SagaId[] = []): Find {
  const rare = weighted<RareKind>([
    { value: 'runa', weight: 1 }, { value: 'saga', weight: 1 }, { value: 'lendario', weight: 1 }, { value: 'reliquia', weight: 1 },
  ], rng)
  if (rare === 'lendario') return { kind: 'raro', rare, resource: LEGENDARY_POOL[Math.floor(rng() * LEGENDARY_POOL.length)] }
  if (rare === 'saga') {
    const left = ALL_SAGAS.filter((s) => !sagasFound.includes(s))
    const pool = left.length ? left : ALL_SAGAS
    return { kind: 'raro', rare, saga: pool[Math.floor(rng() * pool.length)] }
  }
  return { kind: 'raro', rare }
}

export function findLabel(f: Find): string {
  switch (f.kind) {
    case 'resource':   return `${formatAmount(f.pct)} de ${resourceLabel(f.id)}`
    case 'hacksilver': return `¤${f.amount}`
    case 'raro': {
      const base = `Achado Raro: ${RARE_LABELS[f.rare].label}`
      if (f.rare === 'lendario' && f.resource) return `${base} (${resourceLabel(f.resource)})`
      return base
    }
  }
}

/** Texto curto do que o Achado é (pra mostrar embaixo do nome). */
export function findHint(f: Find): string {
  if (f.kind === 'raro') return RARE_LABELS[f.rare].text
  if (f.kind === 'hacksilver') return 'Moedas de Hacksilver.'
  return RESOURCES.find((r) => r.id === f.id)?.what ?? ''
}

// ── Guardar na ficha ─────────────────────────────────────

export interface LootBag {
  stock:       ResourceStock
  hacksilvers: number
}

export interface LootBonus {
  /** Faro do Lobo (Berserker): toda Ração encontrada vem com +25%. */
  faro?:  boolean
  /** Cofre Cheio (Pilar): todo Hacksilver encontrado vem dobrado. */
  cofre?: boolean
}

export type Stored =
  | { ok: true;  bag: LootBag; text: string }
  | { ok: false; text: string }

/** Guarda um Achado respeitando o limite de 4 unidades inteiras de cada recurso. */
export function storeFind(f: Find, bag: LootBag, bonus: LootBonus = {}, limit = RESOURCE_LIMIT_UNITS): Stored {
  switch (f.kind) {
    case 'resource': {
      const pct = f.id === 'racao' && bonus.faro ? f.pct + 25 : f.pct
      const res = addResource(bag.stock, f.id, f.quality, pct, limit)
      if (res.overflow >= pct) return { ok: false, text: `Já está com ${limit} unidades de ${resourceLabel(f.id).toLowerCase()}: não cabe mais.` }
      const put = pct - res.overflow
      return {
        ok: true, bag: { ...bag, stock: res.stock },
        text: res.overflow > 0 ? `+${put}% de ${resourceLabel(f.id).toLowerCase()} (o resto não coube)` : `+${put}% de ${resourceLabel(f.id).toLowerCase()}`,
      }
    }
    case 'hacksilver': {
      const amount = bonus.cofre ? f.amount * 2 : f.amount
      return { ok: true, bag: { ...bag, hacksilvers: bag.hacksilvers + amount }, text: `+¤${amount}${bonus.cofre ? ' (Cofre Cheio)' : ''}` }
    }
    case 'raro': {
      if (f.rare === 'lendario' && f.resource) {
        const res = addResource(bag.stock, f.resource, 'lendario', 100, limit)
        if (res.overflow >= 100) return { ok: false, text: `Já está com ${limit} unidades de ${resourceLabel(f.resource).toLowerCase()}: não cabe mais.` }
        return { ok: true, bag: { ...bag, stock: res.stock }, text: `+100% de ${resourceLabel(f.resource).toLowerCase()} lendário` }
      }
      if (f.rare === 'saga') return { ok: true, bag, text: 'Saga registrada para o grupo (aba Ofício)' }
      if (f.rare === 'runa') return { ok: true, bag, text: 'Runa anunciada no chat: um Runaskin cria o Triunfo na aba Triunfos' }
      return { ok: true, bag, text: 'Relíquia anunciada no chat: o mestre define o que é' }
    }
  }
}

// ── Complicações (1d6) ───────────────────────────────────

export type ComplicationId = 'encontro' | 'armadilha' | 'ferimento' | 'barulho' | 'perda'

export interface ComplicationDef {
  id:     ComplicationId
  label:  string
  effect: string
}

export const COMPLICATIONS: { range: string; def: ComplicationDef }[] = [
  { range: '1-2', def: { id: 'encontro',  label: 'Encontro',  effect: 'Uma criatura, fera ou saqueador aparece. O mestre define.' } },
  { range: '3',   def: { id: 'armadilha', label: 'Armadilha', effect: 'O personagem sofre 1d6 de dano.' } },
  { range: '4',   def: { id: 'ferimento', label: 'Ferimento', effect: 'O personagem se corta e fica Sangrando.' } },
  { range: '5',   def: { id: 'barulho',   label: 'Barulho',   effect: 'A próxima exploração no local tem −1 dado.' } },
  { range: '6',   def: { id: 'perda',     label: 'Perda',     effect: 'Algo cai da mochila: perde 25% de um recurso ou de uma Ração.' } },
]

export function complicationFor(d6: number): ComplicationDef {
  const n = Math.max(1, Math.min(6, Math.trunc(d6)))
  return COMPLICATIONS[n <= 2 ? 0 : n - 2].def
}

/** Perde 25% de um recurso (ou Ração) que o personagem tenha; sem nada, não perde nada. */
export function loseQuarter(stock: ResourceStock, rng: Rng = cryptoRng): { stock: ResourceStock; text: string } {
  const owned: { id: ResourceId; quality: Quality; have: number }[] = []
  for (const r of RESOURCES) {
    for (const q of ['comum', 'raro', 'lendario'] as Quality[]) {
      const have = stock[r.id]?.[q] ?? 0
      if (have > 0) owned.push({ id: r.id, quality: q, have })
    }
  }
  if (!owned.length) return { stock, text: 'Não havia nada na mochila para perder.' }
  const pick = owned[Math.floor(rng() * owned.length)]
  const lost = Math.min(25, pick.have)
  const row = { ...(stock[pick.id] ?? {}) }
  const left = (row[pick.quality] ?? 0) - lost
  if (left > 0) row[pick.quality] = left
  else delete row[pick.quality]
  const next = { ...stock, [pick.id]: row }
  if (!Object.keys(row).length) delete next[pick.id]
  return { stock: next, text: `Perdeu ${lost}% de ${resourceLabel(pick.id).toLowerCase()}.` }
}
