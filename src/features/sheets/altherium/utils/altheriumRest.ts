import { HUNGER_MAX, SHORT_RESTS_MAX, TOKENS_MAX, type Survival } from './altheriumSurvival'

// ────────────────────────────────────────────────────────
// Descanso de Altherium (livro 2.0). Curto: ~1 hora, no máximo 2 entre dois
// Longos, sem Ração. Longo: uma noite, 1 Ração, em local seguro. Sem Ração o
// Longo vira um Curto com os pontos de triunfo cheios, só 2 Fichas e +1 de
// Fome. Frio extremo ou sem abrigo: o Longo só dá os benefícios do Curto.
// Interrompido: nada se recupera, e a Ração não se perde. Só contas: a tela
// é AltheriumRestModal.
// ────────────────────────────────────────────────────────

export type RestKind = 'curto' | 'longo'
export type Roller = (sides: number) => number

export interface RestInput {
  kind:       RestKind
  raiz:       'berserker' | 'runaskin' | 'pilar' | null
  genesis:    string
  espirito:   number
  destino:    number
  runico:     number
  vitality:   { current: number; max: number }
  equilibrio: { current: number; max: number }
  fv:         { current: number; max: number }
  pr:         { current: number; max: number }
  /** Cartas do Pilar (null nas outras raízes). */
  cards:      { current: number; max: number } | null
  survival:   Survival
  /** O personagem tem 1 Ração inteira pra comer. */
  hasRation:  boolean
  /** Uma boa refeição pouco antes do descanso conta como Ração. */
  goodMeal:   boolean
  /** Frio extremo ou sem nenhum abrigo (o mestre decide). */
  badConditions: boolean
  /** O descanso foi interrompido por combate ou esforço intenso. */
  interrupted: boolean
  /** Em coma: não recupera nada e não precisa de Ração. */
  coma:       boolean
}

export interface RestResult {
  allowed:    boolean
  /** Por que não pôde (ou nada aconteceu). */
  blocked?:   string
  /** O que realmente valeu (um Longo sem Ração, por exemplo, é "curto"). */
  benefit:    'nenhum' | 'curto' | 'longo'
  consumesRation: boolean
  /** Valores novos já com os limites. */
  vitality:   number
  equilibrio: number
  fv:         number
  pr:         number
  cards:      number | null
  survival:   Survival
  /** Condições que saem (Incapacitado some depois de um Longo). */
  clearConditions: string[]
  lines:      string[]
  warnings:   string[]
}

const roundUp = (n: number) => Math.ceil(n)

export function rest(input: RestInput, roll: Roller): RestResult {
  const { kind, survival } = input
  const base: RestResult = {
    allowed: true, benefit: 'nenhum', consumesRation: false,
    vitality: input.vitality.current, equilibrio: input.equilibrio.current, fv: input.fv.current, pr: input.pr.current,
    cards: input.cards ? input.cards.current : null,
    survival: { ...survival, traumas: [...survival.traumas] },
    clearConditions: [], lines: [], warnings: [],
  }

  if (input.coma) return { ...base, allowed: false, blocked: 'Em coma: não recupera nada com descansos até acordar (e também não precisa de Ração).' }
  if (input.interrupted) {
    return { ...base, benefit: 'nenhum', lines: ['O descanso foi interrompido: nenhum benefício, mas a Ração não se perde. Recomecem quando a ameaça passar.'] }
  }
  if (kind === 'curto' && survival.short_rests >= SHORT_RESTS_MAX) {
    return { ...base, allowed: false, blocked: `Já foram ${SHORT_RESTS_MAX} Descansos Curtos desde o último Descanso Longo.` }
  }

  const fed = input.hasRation || input.goodMeal
  // Longo sem comida e Longo em condições ruins rendem só o que um Curto rende.
  const fullLong = kind === 'longo' && fed && !input.badConditions
  const benefit: 'curto' | 'longo' = fullLong ? 'longo' : 'curto'
  const r: RestResult = { ...base, benefit }
  const raiz = input.raiz
  const usesFv = raiz === 'berserker'
  const usesPr = raiz === 'runaskin'
  const heal = (cur: number, max: number, n: number) => Math.min(max, cur + Math.max(0, n))

  // ── Vitalidade, Força de Vontade, Pontos Rúnicos, Cartas ──
  if (benefit === 'longo') {
    r.vitality = input.vitality.max
    r.lines.push(`Vitalidade: total (${input.vitality.max}).`)
    if (usesFv) { r.fv = input.fv.max; r.lines.push(`Força de Vontade: todos os pontos (${input.fv.max}).`) }
    if (usesPr) { r.pr = input.pr.max; r.lines.push(`Pontos Rúnicos: todos os pontos (${input.pr.max}).`) }
    if (input.cards) { r.cards = input.cards.max; r.lines.push(`Cartas: todas (${input.cards.max}).`) }
  } else {
    const d = roll(8)
    const pv = d + Math.max(0, input.espirito)
    r.vitality = heal(input.vitality.current, input.vitality.max, pv)
    r.lines.push(`Vitalidade: 1d8 + Espírito = ${d} + ${Math.max(0, input.espirito)} = ${pv}.`)
    if (usesFv) {
      const half = roundUp(input.fv.max / 2)
      r.fv = heal(input.fv.current, input.fv.max, half)
      r.lines.push(`Força de Vontade: metade do máximo (+${half}).`)
    }
    if (usesPr) {
      const d8 = roll(8)
      const pr = d8 + Math.max(0, input.runico)
      r.pr = heal(input.pr.current, input.pr.max, pr)
      r.lines.push(`Pontos Rúnicos: 1d8 + Rúnico = ${d8} + ${Math.max(0, input.runico)} = ${pr}.`)
    }
    if (input.cards) {
      const c = roll(8)
      r.cards = heal(input.cards.current, input.cards.max, c)
      r.lines.push(`Cartas: 1d8 do descarte = ${c}.`)
    }
    // Longo sem Ração: os pontos de triunfo voltam por completo.
    if (kind === 'longo' && !fed) {
      if (usesFv) r.fv = input.fv.max
      if (usesPr) r.pr = input.pr.max
      if (input.cards) r.cards = input.cards.max
      r.lines.push('Sem Ração: só os benefícios de um Curto, mas os pontos de triunfo voltam por completo.')
    }
    if (kind === 'longo' && fed && input.badConditions) {
      r.lines.push('Condições ruins (frio extremo ou sem abrigo): só os benefícios de um Curto, mesmo com comida.')
    }
  }

  // ── Equilíbrio ──
  if (benefit === 'longo') {
    const d = roll(4)
    const eq = d + Math.max(0, input.destino)
    r.equilibrio = heal(input.equilibrio.current, input.equilibrio.max, eq)
    r.lines.push(`Equilíbrio: 1d4 + Destino = ${d} + ${Math.max(0, input.destino)} = ${eq}.`)
  } else {
    r.lines.push('Equilíbrio: não recupera. A mente não se acalma em poucos minutos.')
  }

  // ── Gênesis Peregrino: +1d10 em tudo, a cada Descanso Curto ──
  if (kind === 'curto' && input.genesis === 'peregrino') {
    const p = [roll(10), roll(10), roll(10), roll(10)]
    r.vitality = heal(r.vitality, input.vitality.max, p[0])
    r.equilibrio = heal(r.equilibrio, input.equilibrio.max, p[1])
    if (usesFv) r.fv = heal(r.fv, input.fv.max, p[2])
    if (usesPr) r.pr = heal(r.pr, input.pr.max, p[3])
    r.lines.push(`Peregrino: +1d10 em cada ponto básico (PV +${p[0]}, Equilíbrio +${p[1]}${usesFv ? `, FV +${p[2]}` : ''}${usesPr ? `, PR +${p[3]}` : ''}).`)
  }

  // ── Fichas de Exploração ──
  const tokenGain = benefit === 'longo' ? 4 : 2
  r.survival.tokens = Math.min(TOKENS_MAX, survival.tokens + tokenGain)
  r.lines.push(`Fichas de Exploração: +${tokenGain}${r.survival.tokens === TOKENS_MAX && survival.tokens + tokenGain > TOKENS_MAX ? ' (até o máximo de 5)' : ''}.`)

  // ── Ração, Fome e contagem de Curtos ──
  if (kind === 'curto') {
    r.survival.short_rests = survival.short_rests + 1
    r.lines.push('O Descanso Curto não exige Ração.')
    r.lines.push('Dá para fazer reparos e trabalhos de Ofício em Campo e desmontar itens.')
  } else {
    r.survival.short_rests = 0
    r.survival.rite_used = false
    r.clearConditions = ['incapacitado']
    if (input.hasRation) {
      r.consumesRation = true
      r.lines.push('Consumiu 1 Ração.')
    } else if (input.goodMeal) {
      r.lines.push('Uma boa refeição antes do descanso contou como a Ração.')
    }
    if (!fed) {
      r.survival.hunger = survival.hunger + 1
      r.lines.push(`Sem Ração: +1 nível de Fome (${Math.min(HUNGER_MAX, r.survival.hunger)} de ${HUNGER_MAX}).`)
      if (r.survival.hunger > HUNGER_MAX) r.warnings.push('Mais de 3 níveis de Fome: o personagem morre.')
    } else if (benefit === 'longo' && survival.hunger > 0) {
      r.survival.hunger = survival.hunger - 1
      r.lines.push(`Descanso com comida: remove 1 nível de Fome (agora ${r.survival.hunger}).`)
    }
    r.lines.push('Um Rito de Altherium pode recuperar Equilíbrio extra, e a Forja devolve 100% de Integridade.')
  }

  return r
}

/** Comer 1 Ração fora de combate remove 1 nível de Fome. */
export function eatRation(survival: Survival): Survival {
  return { ...survival, hunger: Math.max(0, survival.hunger - 1) }
}

export const REST_TABLE: { label: string; curto: string; longo: string }[] = [
  { label: 'Exige Ração',        curto: 'Não',              longo: 'Sim (1 por personagem)' },
  { label: 'Vitalidade',         curto: '1d8 + Espírito',   longo: 'Total' },
  { label: 'Força de Vontade',   curto: 'Metade do máximo', longo: 'Tudo' },
  { label: 'Pontos Rúnicos',     curto: '1d8 + Rúnico',     longo: 'Tudo' },
  { label: 'Cartas',             curto: '1d8 cartas',       longo: 'Todas' },
  { label: 'Fichas de Exploração', curto: '2',              longo: '4 (2 sem comida)' },
  { label: 'Equilíbrio',         curto: 'Nada',             longo: '1d4 + Destino' },
  { label: 'Fome',               curto: 'Nada',             longo: 'Remove 1 nível' },
]
