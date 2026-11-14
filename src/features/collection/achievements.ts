import { diceGroups, fullRollKind, wolfKind } from '../dice/utils/critical'
import type { Tier } from '../dice3d/skins'
import type { RollBreakdownItem } from '../../shared/types'

// ────────────────────────────────────────────────────────
// As 34 conquistas da coleção de dados (as 20 primeiras e a segunda leva, de 14, que trouxe a raridade mítica). São SECRETAS: o jogador nunca vê como se ganha uma (só o nome, depois de ganhar).
// Por isso nenhuma descrição de regra vai pra tela; este arquivo só tem o teste de cada uma, sobre as rolagens gravadas.
// Todas se medem em rolagens (dice_rolls); "resultado forte" é o crítico do sistema (20 no D&D, 10 no teste do Altherium,
// todos os dados no máximo nas outras rolagens), do jeito que o site já marca.
// ────────────────────────────────────────────────────────

/** A rolagem como o histórico a entrega (só o que as conquistas leem). */
export interface RollLite {
  id: string
  campaign_id: string
  die_type: string
  result: number
  individual_results: number[] | null
  roll_breakdown: RollBreakdownItem[] | null
  roll_context: { system?: string; kind?: string; natural?: number; crit?: 'crit' | 'fumble' | null; outcome?: 'success' | 'failure' | null } | null
  roll_label?: string | null
  created_at: string
}

export interface History {
  /** As rolagens da conta, da mais antiga pra mais nova, sem as que o dono forçou. */
  rolls: readonly RollLite[]
  /** Quantas rolagens a conta tem no total (pode passar das que estão em `rolls`). */
  total: number
  /** Em quantas campanhas diferentes rolou. */
  campaigns: number
  /** Quantos conjuntos da coleção a conta já tem (para a conquista que premia a coleção). */
  owned?: number
}

export interface Achievement {
  id: string
  /** O conjunto de dados que dá. */
  skin: string
  /** Nome (só aparece depois de ganhar). */
  title: string
  tier: Tier
  test(h: History): boolean
}

// ── Leitura das rolagens ────────────────────────────────

const SIDES = [4, 6, 8, 10, 12, 20, 100] as const
const groups = (r: RollLite) => diceGroups(r) ?? []

/** Resultado forte: o crítico que a ficha marcou, ou todos os dados no máximo. */
export const isStrong = (r: RollLite): boolean => r.roll_context?.crit === 'crit' || wolfKind(r) === 'critical'
/** Falha crítica: a que a ficha marcou, ou todos os dados em 1. */
export const isWeak = (r: RollLite): boolean => r.roll_context?.crit === 'fumble' || wolfKind(r) === 'fumble'
/** Teste de morte: a salvaguarda do D&D ou o Teste de Morte do Altherium. */
export const isDeathTest = (r: RollLite): boolean =>
  r.roll_context?.kind === 'death' || (r.roll_context?.system === 'altherium' && /^Teste de Morte/i.test(r.roll_label ?? ''))

const diceIn = (r: RollLite) => groups(r).reduce((n, g) => n + g.results.length, 0)
/** Dois dados iguais num mesmo grupo (uma dupla). */
const hasPair = (r: RollLite) => groups(r).some((g) => g.results.length >= 2 && new Set(g.results).size < g.results.length)
/** Os lados dos dados que caíram no máximo (d4 pra cima: moeda e d3 não contam). */
const maxedSides = (rolls: readonly RollLite[]): Set<number> => {
  const out = new Set<number>()
  for (const r of rolls) for (const g of groups(r)) if (g.sides > 3 && g.results.includes(g.sides)) out.add(g.sides)
  return out
}
const usedSides = (rolls: readonly RollLite[]): Set<number> => {
  const out = new Set<number>()
  for (const r of rolls) for (const g of groups(r)) out.add(g.sides)
  return out
}
const dayOf = (r: RollLite) => new Date(r.created_at).toLocaleDateString('en-CA')
const last = (rolls: readonly RollLite[], n: number) => (rolls.length >= n ? rolls.slice(-n) : null)

// As conquistas de sorte da segunda leva só contam dado "de teste" (d10 pra cima): com d4 ou d6 o máximo sai toda hora e a
// sequência rara virava questão de insistir. O crítico que a ficha marcou (roll_context.crit) vale sempre.
const bigDice = (r: RollLite) => { const g = groups(r); return g.length > 0 && g.every((x) => x.sides >= 10) }
const isBigStrong = (r: RollLite) => r.roll_context?.crit === 'crit' || (bigDice(r) && isStrong(r))
const isBigWeak = (r: RollLite) => r.roll_context?.crit === 'fumble' || (bigDice(r) && isWeak(r))
/** Todos os resultados dos d20 da rolagem. */
const d20s = (r: RollLite) => groups(r).filter((g) => g.sides === 20).flatMap((g) => g.results)
/** Todos os dados da rolagem (de qualquer grupo). */
const allDice = (r: RollLite) => groups(r).flatMap((g) => g.results)
/** As horas (0 a 23) no relógio de quem rolou. */
const hourOf = (r: RollLite) => new Date(r.created_at).getHours()
/** Quanto tempo (ms) passou, num mesmo dia, entre a primeira e a última rolagem: o maior de todos os dias. */
const longestDay = (rolls: readonly RollLite[]): number => {
  const span = new Map<string, [number, number]>()
  for (const r of rolls) {
    const t = Date.parse(r.created_at), d = dayOf(r), s = span.get(d)
    if (!s) span.set(d, [t, t]); else { s[0] = Math.min(s[0], t); s[1] = Math.max(s[1], t) }
  }
  return Math.max(0, ...[...span.values()].map(([a, b]) => b - a))
}
/** As últimas rolagens formam um espelho (3, 9, 14, 20, 14, 9, 3), com pelo menos `distinct` números diferentes. */
const mirrored = (rolls: readonly RollLite[], n: number, distinct: number): boolean => {
  const l = last(rolls, n)
  if (!l) return false
  const v = l.map((r) => r.result)
  return v.every((x, i) => x === v[n - 1 - i]) && new Set(v).size >= distinct
}

/** Quantos conjuntos a conta precisa ter para ganhar o prisma. */
export const PRISM_NEEDS = 26

// ── As conquistas, por raridade ─────────────────────────

export const ACHIEVEMENTS: readonly Achievement[] = [
  // Comuns
  { id: 'osso-do-oficio', skin: 'osso', title: 'Osso do Ofício', tier: 'comum', test: (h) => h.total >= 10 },
  { id: 'ferro-e-fogo', skin: 'ferro', title: 'Ferro e Fogo', tier: 'comum', test: (h) => h.rolls.some(isWeak) },
  { id: 'barro-moldado', skin: 'argila', title: 'Barro Moldado', tier: 'comum', test: (h) => h.rolls.some(isStrong) },
  { id: 'rabiscos-de-taverna', skin: 'giz', title: 'Rabiscos de Taverna', tier: 'comum', test: (h) => { const u = usedSides(h.rolls); return SIDES.every((s) => u.has(s)) } },
  { id: 'moedas-de-cobre', skin: 'cobre', title: 'Moedas de Cobre', tier: 'comum', test: (h) => h.campaigns >= 3 },
  { id: 'rolha-estourada', skin: 'cortica', title: 'Rolha Estourada', tier: 'comum', test: (h) => h.rolls.some((r) => diceIn(r) >= 5) },
  { id: 'ate-o-toco-da-vela', skin: 'vela', title: 'Até o Toco da Vela', tier: 'comum', test: (h) => longestDay(h.rolls) >= 3 * 3600_000 },
  // Incomuns
  { id: 'memoria-de-marfim', skin: 'marfim', title: 'Memória de Marfim', tier: 'incomum', test: (h) => h.total >= 100 },
  { id: 'sombra-polida', skin: 'onix', title: 'Sombra Polida', tier: 'incomum', test: (h) => h.rolls.filter(isStrong).length >= 3 },
  { id: 'geodo-escondido', skin: 'ametista', title: 'Geodo Escondido', tier: 'incomum', test: (h) => h.rolls.filter(hasPair).length >= 5 },
  { id: 'sangue-de-uva', skin: 'granada', title: 'Sangue de Uva', tier: 'incomum', test: (h) => { const t = h.rolls.filter((r) => r.roll_context?.outcome).slice(-5); return t.length === 5 && t.every((r) => r.roll_context?.outcome === 'success') } },
  { id: 'calma-do-jade', skin: 'jade', title: 'Calma do Jade', tier: 'incomum', test: (h) => new Set(h.rolls.map(dayOf)).size >= 7 },
  { id: 'fumaca-no-salao', skin: 'fume', title: 'Fumaça no Salão', tier: 'incomum', test: (h) => maxedSides(h.rolls).size >= 3 },
  { id: 'cacos-coloridos', skin: 'vitral', title: 'Cacos Coloridos', tier: 'incomum', test: (h) => h.rolls.filter(isWeak).length >= 3 },
  { id: 'letra-por-letra', skin: 'pergaminho', title: 'Letra por Letra', tier: 'incomum', test: (h) => new Set(h.rolls.flatMap(d20s)).size >= 20 },
  // Raras
  { id: 'inverno-subito', skin: 'gelo', title: 'Inverno Súbito', tier: 'rara', test: (h) => { const l = last(h.rolls, 2); return !!l && l.every(isStrong) } },
  { id: 'coracao-de-vulcao', skin: 'magma', title: 'Coração de Vulcão', tier: 'rara', test: (h) => h.rolls.some((r) => diceIn(r) >= 3 && fullRollKind(r) === 'critical') },
  { id: 'estrela-caida', skin: 'meteorito', title: 'Estrela Caída', tier: 'rara', test: (h) => { const l = last(h.rolls, 4); return !!l && l.every((r) => r.result === l[0].result) } },
  { id: 'raizes-no-escuro', skin: 'fungo', title: 'Raízes no Escuro', tier: 'rara', test: (h) => h.total >= 500 },
  { id: 'preso-no-tempo', skin: 'ambar', title: 'Preso no Tempo', tier: 'rara', test: (h) => { const m = maxedSides(h.rolls); return SIDES.every((s) => m.has(s)) } },
  { id: 'badalada-da-meia-noite', skin: 'sino', title: 'Badalada da Meia-Noite', tier: 'rara', test: (h) => h.rolls.some((r) => hourOf(r) === 0 && isBigStrong(r)) },
  { id: 'engrenagens-no-lugar', skin: 'relogio', title: 'Engrenagens no Lugar', tier: 'rara', test: (h) => { const l = last(h.rolls, 3); return !!l && l.every(bigDice) && l[1].result === l[0].result + 1 && l[2].result === l[1].result + 1 } },
  { id: 'perola-na-lama', skin: 'perola', title: 'Pérola na Lama', tier: 'rara', test: (h) => { const l = last(h.rolls, 2); return !!l && isBigWeak(l[0]) && isBigStrong(l[1]) } },
  // Épicas
  { id: 'apertou-a-mao-da-morte', skin: 'morte', title: 'Apertou a Mão da Morte', tier: 'epica', test: (h) => h.rolls.filter((r) => isDeathTest(r) && isStrong(r)).length >= 3 },
  { id: 'noite-de-vaga-lumes', skin: 'vagalumes', title: 'Noite de Vaga-lumes', tier: 'epica', test: (h) => { const days = new Map<string, number>(); for (const r of h.rolls) if (isStrong(r)) days.set(dayOf(r), (days.get(dayOf(r)) ?? 0) + 1); return [...days.values()].some((n) => n >= 3) } },
  { id: 'runas-acesas', skin: 'runico', title: 'Runas Acesas', tier: 'epica', test: (h) => { const d100 = h.rolls.flatMap((r) => groups(r).filter((g) => g.sides === 100)); return d100.some((g) => g.results.includes(100)) && d100.some((g) => g.results.includes(1)) } },
  { id: 'o-raio-caiu-duas-vezes', skin: 'tempestade', title: 'O Raio Caiu Duas Vezes', tier: 'epica', test: (h) => h.rolls.some((r) => { const d = d20s(r); return d.length >= 2 && d.every((x) => x === 20) }) },
  { id: 'o-abismo-olhou-de-volta', skin: 'olho', title: 'O Abismo Olhou de Volta', tier: 'epica', test: (h) => h.rolls.filter(isBigWeak).length >= 13 },
  { id: 'alinhamento-dos-astros', skin: 'galaxia', title: 'Alinhamento dos Astros', tier: 'epica', test: (h) => h.rolls.some((r) => { const d = allDice(r); return d.length >= 4 && groups(r).every((g) => g.sides >= 6) && d.every((x) => x === d[0]) }) },
  // Lendárias
  { id: 'o-vortice-chamou', skin: 'vortice', title: 'O Vórtice Chamou', tier: 'lendaria', test: (h) => { const l = last(h.rolls, 3); return !!l && l.every(isStrong) } },
  { id: 'tesouro-do-dragao', skin: 'dragao', title: 'Tesouro do Dragão', tier: 'lendaria', test: (h) => h.total >= 2000 },
  { id: 'sete-anos-de-azar', skin: 'espelho', title: 'Sete Anos de Azar', tier: 'lendaria', test: (h) => mirrored(h.rolls, 7, 4) },
  // Míticas
  { id: 'o-nada-respondeu', skin: 'vazio', title: 'O Nada Respondeu', tier: 'mitica', test: (h) => { const l = last(h.rolls, 4); return !!l && l.every(isBigWeak) } },
  { id: 'todas-as-cores', skin: 'prisma', title: 'Todas as Cores', tier: 'mitica', test: (h) => (h.owned ?? 0) >= PRISM_NEEDS },
]

/**
 * O que o jogador fez pra ganhar, dito depois que ele ganhou (só o cartão da conquista mostra isto; antes, a regra é segredo).
 */
const DID: Record<string, string> = {
  'osso-do-oficio': 'Fez 10 rolagens de dado.',
  'ferro-e-fogo': 'Tirou uma falha crítica.',
  'barro-moldado': 'Tirou o seu primeiro resultado forte (crítico).',
  'rabiscos-de-taverna': 'Rolou todos os tipos de dado: d4, d6, d8, d10, d12, d20 e d100.',
  'moedas-de-cobre': 'Rolou dados em 3 campanhas diferentes.',
  'memoria-de-marfim': 'Fez 100 rolagens de dado.',
  'sombra-polida': 'Tirou 3 resultados fortes (críticos).',
  'geodo-escondido': 'Tirou 5 rolagens com dois dados iguais.',
  'sangue-de-uva': 'Teve 5 sucessos seguidos em testes.',
  'calma-do-jade': 'Rolou dados em 7 dias diferentes.',
  'fumaca-no-salao': 'Tirou o número máximo em 3 tipos de dado diferentes.',
  'inverno-subito': 'Tirou 2 resultados fortes seguidos.',
  'coracao-de-vulcao': 'Tirou o máximo em todos os dados de uma rolagem de 3 ou mais dados.',
  'estrela-caida': 'Tirou o mesmo resultado 4 vezes seguidas.',
  'raizes-no-escuro': 'Fez 500 rolagens de dado.',
  'preso-no-tempo': 'Tirou o número máximo em todos os tipos de dado, do d4 ao d100.',
  'apertou-a-mao-da-morte': 'Passou em 3 testes de morte com resultado forte.',
  'noite-de-vaga-lumes': 'Tirou 3 resultados fortes no mesmo dia.',
  'runas-acesas': 'Tirou 100 e também 1 no d100.',
  'o-vortice-chamou': 'Tirou 3 resultados fortes seguidos.',
  'rolha-estourada': 'Rolou 5 ou mais dados de uma vez.',
  'ate-o-toco-da-vela': 'Rolou dados por 3 horas no mesmo dia.',
  'cacos-coloridos': 'Tirou 3 falhas críticas.',
  'letra-por-letra': 'Tirou todos os números do d20, do 1 ao 20.',
  'badalada-da-meia-noite': 'Tirou um resultado forte entre a meia-noite e a 1 da manhã.',
  'engrenagens-no-lugar': 'Tirou três resultados em escada, um depois do outro (como 7, 8 e 9).',
  'perola-na-lama': 'Tirou uma falha crítica e, logo em seguida, um resultado forte.',
  'o-raio-caiu-duas-vezes': 'Tirou 20 em dois d20 na mesma rolagem.',
  'o-abismo-olhou-de-volta': 'Tirou 13 falhas críticas.',
  'alinhamento-dos-astros': 'Tirou o mesmo número em todos os dados de uma rolagem de 4 ou mais dados.',
  'tesouro-do-dragao': 'Fez 2.000 rolagens de dado.',
  'sete-anos-de-azar': 'Suas últimas 7 rolagens formaram um espelho perfeito (como 3, 9, 14, 20, 14, 9, 3).',
  'o-nada-respondeu': 'Tirou 4 falhas críticas seguidas.',
  'todas-as-cores': `Reuniu ${PRISM_NEEDS} dados da coleção.`,
}
export const didOf = (id: string): string | undefined => DID[id]

export const achievementOf = (id: string): Achievement | undefined => ACHIEVEMENTS.find((a) => a.id === id)
export const achievementForSkin = (skin: string): Achievement | undefined => ACHIEVEMENTS.find((a) => a.skin === skin)

/** As conquistas cujo teste passa agora (já ganhas ou não: quem chama tira as que a conta já tem). */
export function satisfied(h: History): Achievement[] {
  return ACHIEVEMENTS.filter((a) => { try { return a.test(h) } catch { return false } })
}
