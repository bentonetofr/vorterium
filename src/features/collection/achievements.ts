import { diceGroups, fullRollKind, wolfKind } from '../dice/utils/critical'
import type { Tier } from '../dice3d/skins'
import type { RollBreakdownItem } from '../../shared/types'

// ────────────────────────────────────────────────────────
// As 20 conquistas da coleção de dados. São SECRETAS: o jogador nunca vê como se ganha uma (só o nome, depois de ganhar).
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

// ── As conquistas, por raridade ─────────────────────────

export const ACHIEVEMENTS: readonly Achievement[] = [
  // Comuns
  { id: 'osso-do-oficio', skin: 'osso', title: 'Osso do Ofício', tier: 'comum', test: (h) => h.total >= 10 },
  { id: 'ferro-e-fogo', skin: 'ferro', title: 'Ferro e Fogo', tier: 'comum', test: (h) => h.rolls.some(isWeak) },
  { id: 'barro-moldado', skin: 'argila', title: 'Barro Moldado', tier: 'comum', test: (h) => h.rolls.some(isStrong) },
  { id: 'rabiscos-de-taverna', skin: 'giz', title: 'Rabiscos de Taverna', tier: 'comum', test: (h) => { const u = usedSides(h.rolls); return SIDES.every((s) => u.has(s)) } },
  { id: 'moedas-de-cobre', skin: 'cobre', title: 'Moedas de Cobre', tier: 'comum', test: (h) => h.campaigns >= 3 },
  // Incomuns
  { id: 'memoria-de-marfim', skin: 'marfim', title: 'Memória de Marfim', tier: 'incomum', test: (h) => h.total >= 100 },
  { id: 'sombra-polida', skin: 'onix', title: 'Sombra Polida', tier: 'incomum', test: (h) => h.rolls.filter(isStrong).length >= 3 },
  { id: 'geodo-escondido', skin: 'ametista', title: 'Geodo Escondido', tier: 'incomum', test: (h) => h.rolls.filter(hasPair).length >= 5 },
  { id: 'sangue-de-uva', skin: 'granada', title: 'Sangue de Uva', tier: 'incomum', test: (h) => { const t = h.rolls.filter((r) => r.roll_context?.outcome).slice(-5); return t.length === 5 && t.every((r) => r.roll_context?.outcome === 'success') } },
  { id: 'calma-do-jade', skin: 'jade', title: 'Calma do Jade', tier: 'incomum', test: (h) => new Set(h.rolls.map(dayOf)).size >= 7 },
  { id: 'fumaca-no-salao', skin: 'fume', title: 'Fumaça no Salão', tier: 'incomum', test: (h) => maxedSides(h.rolls).size >= 3 },
  // Raras
  { id: 'inverno-subito', skin: 'gelo', title: 'Inverno Súbito', tier: 'rara', test: (h) => { const l = last(h.rolls, 2); return !!l && l.every(isStrong) } },
  { id: 'coracao-de-vulcao', skin: 'magma', title: 'Coração de Vulcão', tier: 'rara', test: (h) => h.rolls.some((r) => diceIn(r) >= 3 && fullRollKind(r) === 'critical') },
  { id: 'estrela-caida', skin: 'meteorito', title: 'Estrela Caída', tier: 'rara', test: (h) => { const l = last(h.rolls, 4); return !!l && l.every((r) => r.result === l[0].result) } },
  { id: 'raizes-no-escuro', skin: 'fungo', title: 'Raízes no Escuro', tier: 'rara', test: (h) => h.total >= 500 },
  { id: 'preso-no-tempo', skin: 'ambar', title: 'Preso no Tempo', tier: 'rara', test: (h) => { const m = maxedSides(h.rolls); return SIDES.every((s) => m.has(s)) } },
  // Épicas
  { id: 'apertou-a-mao-da-morte', skin: 'morte', title: 'Apertou a Mão da Morte', tier: 'epica', test: (h) => h.rolls.filter((r) => isDeathTest(r) && isStrong(r)).length >= 3 },
  { id: 'noite-de-vaga-lumes', skin: 'vagalumes', title: 'Noite de Vaga-lumes', tier: 'epica', test: (h) => { const days = new Map<string, number>(); for (const r of h.rolls) if (isStrong(r)) days.set(dayOf(r), (days.get(dayOf(r)) ?? 0) + 1); return [...days.values()].some((n) => n >= 3) } },
  { id: 'runas-acesas', skin: 'runico', title: 'Runas Acesas', tier: 'epica', test: (h) => { const d100 = h.rolls.flatMap((r) => groups(r).filter((g) => g.sides === 100)); return d100.some((g) => g.results.includes(100)) && d100.some((g) => g.results.includes(1)) } },
  // Lendária
  { id: 'o-vortice-chamou', skin: 'vortice', title: 'O Vórtice Chamou', tier: 'lendaria', test: (h) => { const l = last(h.rolls, 3); return !!l && l.every(isStrong) } },
]

export const achievementOf = (id: string): Achievement | undefined => ACHIEVEMENTS.find((a) => a.id === id)
export const achievementForSkin = (skin: string): Achievement | undefined => ACHIEVEMENTS.find((a) => a.skin === skin)

/** As conquistas cujo teste passa agora (já ganhas ou não: quem chama tira as que a conta já tem). */
export function satisfied(h: History): Achievement[] {
  return ACHIEVEMENTS.filter((a) => { try { return a.test(h) } catch { return false } })
}
