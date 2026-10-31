// ────────────────────────────────────────────────────────
// Ofício de Altherium (livro 2.0): recursos em frações, Integridade,
// desgaste, reparo, receitas modulares (Base + Núcleo + Catalisador),
// Reforços, Sagas de Ofício e desmontar. Só contas; a tela é
// AltheriumCraftPanel e o inventário.
// ────────────────────────────────────────────────────────

// ── Recursos ─────────────────────────────────────────────

export type ResourceId =
  | 'ferro_velho' | 'couro' | 'madeira' | 'fibra' | 'sebo' | 'ervas' | 'brennivin' | 'osso' | 'po_eryndor' | 'racao'

export type Quality = 'comum' | 'raro' | 'lendario'

export const QUALITIES: { id: Quality; label: string }[] = [
  { id: 'comum',    label: 'Comum' },
  { id: 'raro',     label: 'Raro' },
  { id: 'lendario', label: 'Lendário' },
]

export interface ResourceDef {
  id:        ResourceId
  label:     string
  what:      string
  /** Frações em que aparece. */
  fractions: number[]
  /** Rações não têm qualidade. */
  noQuality?: boolean
}

export const RESOURCES: ResourceDef[] = [
  { id: 'ferro_velho', label: 'Ferro-velho',   what: 'Pregos, pontas, lâminas quebradas', fractions: [10, 20, 25, 50, 100] },
  { id: 'couro',       label: 'Couro',         what: 'Retalhos e tiras',                  fractions: [10, 20, 25, 50, 100] },
  { id: 'madeira',     label: 'Madeira',       what: 'Tábuas, cabos e galhos',            fractions: [10, 20, 25, 50, 100] },
  { id: 'fibra',       label: 'Fibra',         what: 'Corda, linho, tendão',              fractions: [10, 20, 25, 50, 100] },
  { id: 'sebo',        label: 'Sebo',          what: 'Gordura e óleo',                    fractions: [10, 20, 25, 50, 100] },
  { id: 'ervas',       label: 'Ervas',         what: 'Musgo, raízes, flores',             fractions: [10, 20, 25, 50, 100] },
  { id: 'brennivin',   label: 'Brennivín',     what: 'Aguardente forte',                  fractions: [10, 20, 25, 50, 100] },
  { id: 'osso',        label: 'Osso',          what: 'Ossos e chifres de feras',          fractions: [10, 20, 25, 50, 100] },
  { id: 'po_eryndor',  label: 'Pó de Eryndor', what: 'Resíduo cristalino do portão de Eryndor', fractions: [10, 20, 25, 50, 100] },
  { id: 'racao',       label: 'Ração',         what: 'Comida (1 por Descanso Longo)',     fractions: [25, 50, 100], noQuality: true },
]

export function resourceLabel(id: ResourceId): string {
  return RESOURCES.find((r) => r.id === id)?.label ?? id
}

/** Cada personagem carrega no máximo 4 unidades inteiras de cada recurso (e 4 Rações). */
export const RESOURCE_LIMIT_UNITS = 4

/** Estoque em porcentagem: 100% = 1 unidade. */
export type ResourceStock = Partial<Record<ResourceId, Partial<Record<Quality, number>>>>

export function readResources(raw: unknown): ResourceStock {
  const out: ResourceStock = {}
  if (!raw || typeof raw !== 'object') return out
  for (const r of RESOURCES) {
    const row = (raw as Record<string, unknown>)[r.id]
    if (!row || typeof row !== 'object') continue
    const q: Partial<Record<Quality, number>> = {}
    for (const { id } of QUALITIES) {
      const v = Math.max(0, Math.trunc(Number((row as Record<string, unknown>)[id]) || 0))
      if (v > 0) q[id] = v
    }
    if (Object.keys(q).length) out[r.id] = q
  }
  return out
}

export function resourceTotal(stock: ResourceStock, id: ResourceId): number {
  const row = stock[id] ?? {}
  return (row.comum ?? 0) + (row.raro ?? 0) + (row.lendario ?? 0)
}

/** "2 unidades e 25%" */
export function formatAmount(pct: number): string {
  const units = Math.floor(pct / 100)
  const rest = pct % 100
  if (units && rest) return `${units} ${units === 1 ? 'unidade' : 'unidades'} e ${rest}%`
  if (units) return `${units} ${units === 1 ? 'unidade' : 'unidades'}`
  return `${rest}%`
}

/** Põe no estoque até o limite; devolve o que sobrou e não coube. */
export function addResource(stock: ResourceStock, id: ResourceId, quality: Quality, pct: number, limitUnits = RESOURCE_LIMIT_UNITS): { stock: ResourceStock; overflow: number } {
  const room = Math.max(0, limitUnits * 100 - resourceTotal(stock, id))
  const put = Math.min(room, Math.max(0, pct))
  const row = { ...(stock[id] ?? {}) }
  row[quality] = (row[quality] ?? 0) + put
  return { stock: { ...stock, [id]: row }, overflow: Math.max(0, pct) - put }
}

/** Tira do estoque (sem passar de 0) — para perdas e correções. */
export function removeResource(stock: ResourceStock, id: ResourceId, quality: Quality, pct: number): ResourceStock {
  const row = { ...(stock[id] ?? {}) }
  row[quality] = Math.max(0, (row[quality] ?? 0) - Math.max(0, pct))
  if (!row[quality]) delete row[quality]
  const next = { ...stock, [id]: row }
  if (!Object.keys(row).length) delete next[id]
  return next
}

export type Cost = Partial<Record<ResourceId, number>>

export function addCosts(...costs: Cost[]): Cost {
  const out: Cost = {}
  for (const c of costs) for (const [k, v] of Object.entries(c)) out[k as ResourceId] = (out[k as ResourceId] ?? 0) + (v ?? 0)
  return out
}

export function costText(cost: Cost): string {
  return Object.entries(cost).map(([k, v]) => `${v}% ${resourceLabel(k as ResourceId)}`).join(' + ')
}

/** O que falta no estoque para pagar o custo (vazio = dá pra pagar). */
export function missing(stock: ResourceStock, cost: Cost, pinned?: { id: ResourceId; quality: Quality }): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(cost)) {
    const id = k as ResourceId
    const have = pinned && pinned.id === id ? (stock[id]?.[pinned.quality] ?? 0) : resourceTotal(stock, id)
    if (have < (v ?? 0)) out.push(`${resourceLabel(id)} (tem ${have}%, precisa ${v}%)`)
  }
  return out
}

/**
 * Paga o custo: gasta o Comum primeiro, depois Raro e Lendário. `pinned`
 * obriga um recurso a sair de uma qualidade só (o material do Núcleo).
 * Null se não tiver o bastante.
 */
export function spend(stock: ResourceStock, cost: Cost, pinned?: { id: ResourceId; quality: Quality }): ResourceStock | null {
  if (missing(stock, cost, pinned).length) return null
  let next = stock
  for (const [k, v] of Object.entries(cost)) {
    const id = k as ResourceId
    let left = v ?? 0
    const order: Quality[] = pinned && pinned.id === id ? [pinned.quality] : ['comum', 'raro', 'lendario']
    for (const q of order) {
      if (left <= 0) break
      const take = Math.min(left, next[id]?.[q] ?? 0)
      if (take > 0) { next = removeResource(next, id, q, take); left -= take }
    }
  }
  return next
}

// ── Integridade ──────────────────────────────────────────

export type IntegrityBand = 'normal' | 'gasta' | 'danificada' | 'quebrada'

export function integrityBand(pct: number): IntegrityBand {
  if (pct <= 0) return 'quebrada'
  if (pct <= 30) return 'danificada'
  if (pct <= 50) return 'gasta'
  return 'normal'
}

export const BAND_LABELS: Record<IntegrityBand, string> = {
  normal:     'Normal',
  gasta:      'Gasta',
  danificada: 'Danificada',
  quebrada:   'Quebrada',
}

/** Arma: 50–31% −1 no dano; 30–1% −1 no dano e −1 no ataque; 0% quebrada. */
export function weaponIntegrity(pct: number): { damage: number; attack: number; broken: boolean } {
  const band = integrityBand(pct)
  if (band === 'quebrada') return { damage: 0, attack: 0, broken: true }
  if (band === 'danificada') return { damage: -1, attack: -1, broken: false }
  if (band === 'gasta') return { damage: -1, attack: 0, broken: false }
  return { damage: 0, attack: 0, broken: false }
}

/** DB que a peça ainda dá: 50–31% −2; 30–1% metade (arredondada pra baixo); 0% nada. */
export function armorDbWithIntegrity(db: number, pct: number): number {
  const band = integrityBand(pct)
  if (band === 'quebrada') return 0
  if (band === 'danificada') return Math.floor(db / 2)
  if (band === 'gasta') return Math.max(0, db - 2)
  return db
}

/** Desgaste: Robusta perde metade, Frágil perde o dobro. */
export function wearAmount(base: number, opts: { robusta?: boolean; fragil?: boolean } = {}): number {
  if (opts.robusta) return Math.floor(base / 2)
  if (opts.fragil) return base * 2
  return base
}

export function applyWear(integrity: number, amount: number): number {
  return Math.max(0, Math.min(100, integrity - amount))
}

export type RepairPlace = 'campo' | 'forja'

/** Reparo em Campo chega no máximo a 75%; só a Forja devolve 100%. */
export function repairCap(place: RepairPlace, fullInField = false): number {
  return place === 'forja' || fullInField ? 100 : 75
}

/** Quanto dá pra reparar (em %) e o custo: a mesma porcentagem em material. */
export function repairPlan(current: number, wanted: number, place: RepairPlace, fullInField = false): { to: number; amount: number } {
  const to = Math.max(current, Math.min(wanted, repairCap(place, fullInField)))
  return { to, amount: to - current }
}

// ── Receitas modulares ───────────────────────────────────

export type BaseId = 'garrafa' | 'bandagem' | 'oleo' | 'armadilha'
export type CoreId = 'fogo' | 'cura' | 'veneno' | 'corte' | 'calma'
export type CatalystId = 'fumaca' | 'estilhacos' | 'runico' | 'lento'

export const BASES: { id: BaseId; label: string; cost: Cost; use: string }[] = [
  { id: 'garrafa',   label: 'Garrafa',   cost: { brennivin: 50 },                use: 'Ação Padrão, alcance Curto, ataque com Precisão + Impulso (1d4 de dano cortante).' },
  { id: 'bandagem',  label: 'Bandagem',  cost: { fibra: 50 },                    use: 'Ação Bônus, em Toque (pode ser em si mesmo): cura 1d4 de PV na hora.' },
  { id: 'oleo',      label: 'Óleo',      cost: { sebo: 50 },                     use: 'Ação Bônus para aplicar na arma: dura os 3 ataques seguintes (6 com Embebida); seca no fim da cena.' },
  { id: 'armadilha', label: 'Armadilha', cost: { ferro_velho: 50, fibra: 25 },   use: 'Ação Padrão para armar em Toque. Notada com Percepção + Destino (DT 13). Pisada: 1d6 Perfurante e o alvo fica Preso.' },
]

export const CORES: { id: CoreId; label: string; cost: Cost; bases: BaseId[]; effect: Partial<Record<BaseId, string>> }[] = [
  {
    id: 'fogo', label: 'Fogo', cost: { brennivin: 50 }, bases: ['garrafa', 'armadilha', 'oleo'],
    effect: {
      garrafa:   '2d6 de dano de Fogo e o alvo fica Queimando.',
      armadilha: '+2d6 de dano de Fogo e o alvo fica Queimando.',
      oleo:      'Cada acerto causa +1d10 de dano de Fogo; um acerto crítico deixa o alvo Queimando.',
    },
  },
  {
    id: 'cura', label: 'Cura', cost: { ervas: 100 }, bases: ['bandagem', 'garrafa'],
    effect: {
      bandagem: 'Cura 1d8 de PV.',
      garrafa:  'A criatura atingida cura 1d8 de PV, sem teste de ataque se for um aliado disposto.',
    },
  },
  {
    id: 'veneno', label: 'Veneno', cost: { ervas: 50, osso: 25 }, bases: ['garrafa', 'armadilha', 'oleo'],
    effect: {
      garrafa:   'O alvo perde 1 dado no próximo teste até o fim do seu próximo turno (com 1 dado, rola com desvantagem). Resiliência + Espírito ignora.',
      armadilha: 'O alvo perde 1 dado no próximo teste até o fim do seu próximo turno. Resiliência + Espírito ignora.',
      oleo:      'Cada acerto aplica o Veneno (no máximo −1 dado por vez). Resiliência + Espírito ignora.',
    },
  },
  {
    id: 'corte', label: 'Corte', cost: { ferro_velho: 50 }, bases: ['garrafa', 'armadilha', 'oleo'],
    effect: {
      garrafa:   '+1d8 de dano Cortante e o alvo fica Sangrando.',
      armadilha: '+1d8 de dano Cortante e o alvo fica Sangrando.',
      oleo:      'Cada acerto deixa o alvo Sangrando, sem o dano extra.',
    },
  },
  {
    id: 'calma', label: 'Calma', cost: { ervas: 50, brennivin: 25 }, bases: ['bandagem', 'garrafa'],
    effect: {
      bandagem: 'Recupera 2d6 de Equilíbrio (cada personagem só recebe Calma 1 vez por cena).',
      garrafa:  'Recupera 2d6 de Equilíbrio (cada personagem só recebe Calma 1 vez por cena).',
    },
  },
]

export const CATALYSTS: { id: CatalystId; label: string; cost: Cost; effect: string; saga?: SagaId }[] = [
  { id: 'fumaca',     label: 'Fumaça',     cost: { sebo: 25 },        effect: 'Nuvem de raio Curto (5 m) por 2 turnos: +1 dado em Furtividade dentro dela e −1 dado para quem ataca à distância alguém dentro. O efeito do Núcleo vira gás: quem começar o turno na nuvem sofre o efeito.' },
  { id: 'estilhacos', label: 'Estilhaços', cost: { ferro_velho: 25 }, effect: 'O efeito do Núcleo atinge todas as criaturas em alcance Médio do impacto, aliados também. Reflexo + Impulso para sofrer metade do dano (não evita as condições).' },
  { id: 'runico',     label: 'Rúnico',     cost: { po_eryndor: 25 },  effect: 'O dano vira Rúnico e o efeito dobra: os dados de dano e de cura dobram (2d6 vira 4d6), as durações dobram e a Fumaça dá +2 dados. Bônus fixos não dobram.', saga: 'eryndor' },
  { id: 'lento',      label: 'Lento',      cost: { sebo: 25 },        effect: 'Queimando, Sangrando, o Veneno e a nuvem de Fumaça duram +1d4 turnos. Cura e Calma: o alvo também recupera 1 ponto no início de cada turno, por 1d4 turnos.' },
]

/** "2d6" → "4d6" em todo o texto (Catalisador Rúnico). */
export function doubleDiceText(text: string): string {
  return text.replace(/(\d*)d(\d+)/g, (_, n: string, s: string) => `${(n ? Number(n) : 1) * 2}d${s}`)
}

export interface Recipe {
  name:   string
  effect: string
  cost:   Cost
  /** O material do Núcleo sai desta qualidade. */
  pinned: { id: ResourceId; quality: Quality }
  error:  string | null
}

const QUALITY_BONUS: Record<Quality, string> = {
  comum:    '',
  raro:     ' Material raro: +1 no efeito principal.',
  lendario: ' Material lendário: +2 no efeito principal e o dano vira Rúnico.',
}

/** Monta a receita: Base + Núcleo (+ Catalisador). O Núcleo define o efeito, a qualidade vem do material dele. */
export function buildRecipe(base: BaseId, core: CoreId, catalyst: CatalystId | null, quality: Quality, sagas: SagaId[]): Recipe {
  const b = BASES.find((x) => x.id === base)!
  const c = CORES.find((x) => x.id === core)!
  const k = catalyst ? CATALYSTS.find((x) => x.id === catalyst)! : null
  const mainRes = Object.keys(c.cost)[0] as ResourceId
  let error: string | null = null
  if (!c.bases.includes(base)) error = `O Núcleo ${c.label} não funciona com ${b.label} (só com ${c.bases.map((id) => BASES.find((x) => x.id === id)!.label).join(', ')}).`
  else if (k?.saga && !sagas.includes(k.saga)) error = `O Catalisador ${k.label} precisa da ${SAGAS.find((s) => s.id === k.saga)!.label}.`
  let core_effect = c.effect[base] ?? ''
  if (catalyst === 'runico') core_effect = doubleDiceText(core_effect)
  const effect = [b.use, core_effect, k ? `${k.label}: ${k.effect}` : '', QUALITY_BONUS[quality].trim()].filter(Boolean).join(' ')
  return {
    name: `${b.label} de ${c.label}${k ? ` com ${k.label}` : ''}${quality !== 'comum' ? ` (${QUALITIES.find((q) => q.id === quality)!.label})` : ''}`,
    effect,
    cost: addCosts(b.cost, c.cost, k?.cost ?? {}),
    pinned: { id: mainRes, quality },
    error,
  }
}

// ── Reforços e Sagas ─────────────────────────────────────

export type SagaId = 'ferreiro_torto' | 'forjas_torvalenn' | 'eryndor'

export const SAGAS: { id: SagaId; label: string; tier: string; unlocks: string }[] = [
  { id: 'ferreiro_torto',   label: 'Saga do Ferreiro Torto',     tier: 'Comum',    unlocks: 'Empunhadura de Couro, Cravos de Ferro' },
  { id: 'forjas_torvalenn', label: 'Saga das Forjas de Torvalenn', tier: 'Rara',   unlocks: 'Placas Costuradas, Fio Temperado' },
  { id: 'eryndor',          label: 'Saga de Eryndor',            tier: 'Lendária', unlocks: 'Gravação Rúnica, Catalisador Rúnico' },
]

export type ReinforcementId =
  | 'empunhadura_couro' | 'cravos_ferro' | 'fio_temperado' | 'corrente_retorno'
  | 'farpas_osso' | 'placas_costuradas' | 'forro_la' | 'gravacao_runica'

export interface ReinforcementDef {
  id:     ReinforcementId
  label:  string
  cost:   Cost
  /** Onde se faz: Campo, Forja ou Rúnico (como está no livro). */
  place:  'Campo' | 'Forja' | 'Rúnico'
  effect: string
  target: 'arma' | 'armadura'
  saga?:  SagaId
}

export const REINFORCEMENTS: ReinforcementDef[] = [
  { id: 'empunhadura_couro', label: 'Empunhadura de Couro', cost: { couro: 100, fibra: 50 },       place: 'Campo',  target: 'arma',     saga: 'ferreiro_torto',   effect: 'Não pode ser desarmado. +1 ao Aparar.' },
  { id: 'cravos_ferro',      label: 'Cravos de Ferro',      cost: { ferro_velho: 200 },            place: 'Forja',  target: 'arma',     saga: 'ferreiro_torto',   effect: 'Armas de Impacto ignoram 1 de DB.' },
  { id: 'fio_temperado',     label: 'Fio Temperado',        cost: { ferro_velho: 200, sebo: 100 }, place: 'Forja',  target: 'arma',     saga: 'forjas_torvalenn', effect: '+4 de dano (armas C ou P).' },
  { id: 'corrente_retorno',  label: 'Corrente de Retorno',  cost: { ferro_velho: 100, fibra: 100 }, place: 'Campo', target: 'arma',     effect: 'Arma de arremesso volta para a mão.' },
  { id: 'farpas_osso',       label: 'Farpas de Osso',       cost: { osso: 100, madeira: 50 },      place: 'Campo',  target: 'arma',     effect: 'Crítico deixa o alvo Sangrando.' },
  { id: 'placas_costuradas', label: 'Placas Costuradas',    cost: { ferro_velho: 200, couro: 100 }, place: 'Forja', target: 'armadura', saga: 'forjas_torvalenn', effect: '+2 de DB naquela parte.' },
  { id: 'forro_la',          label: 'Forro de Lã',          cost: { couro: 100, fibra: 100 },      place: 'Campo',  target: 'armadura', effect: 'Ignora penalidades de frio extremo.' },
  { id: 'gravacao_runica',   label: 'Gravação Rúnica',      cost: { ferro_velho: 200, po_eryndor: 100 }, place: 'Rúnico', target: 'arma', saga: 'eryndor', effect: 'O dano da arma vira Rúnico.' },
]

export function reinforcementDef(id: string): ReinforcementDef | undefined {
  return REINFORCEMENTS.find((r) => r.id === id)
}

export function readReinforcements(raw: unknown): ReinforcementId[] {
  return Array.isArray(raw) ? raw.filter((x): x is ReinforcementId => typeof x === 'string' && !!reinforcementDef(x)) : []
}

export function readSagas(raw: unknown): SagaId[] {
  return Array.isArray(raw) ? raw.filter((x): x is SagaId => SAGAS.some((s) => s.id === x)) : []
}

/** Reforço liberado? Os que não estão em nenhuma Saga ficam livres. */
export function reinforcementUnlocked(r: ReinforcementDef, sagas: SagaId[]): boolean {
  return !r.saga || sagas.includes(r.saga)
}

// ── Desmontar ────────────────────────────────────────────

/** Desmontar devolve metade dos materiais usados (arredondada pra baixo). */
export function dismantleReturn(materials: Cost): Cost {
  const out: Cost = {}
  for (const [k, v] of Object.entries(materials)) {
    const half = Math.floor((v ?? 0) / 2)
    if (half > 0) out[k as ResourceId] = half
  }
  return out
}

export function readCost(raw: unknown): Cost {
  const out: Cost = {}
  if (!raw || typeof raw !== 'object') return out
  for (const r of RESOURCES) {
    const v = Math.trunc(Number((raw as Record<string, unknown>)[r.id]) || 0)
    if (v > 0) out[r.id] = v
  }
  return out
}
