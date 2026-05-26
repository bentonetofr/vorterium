import { supabase } from '../../../shared/lib/supabase'
import type { DiceRoll, DiceRollWithProfile, DieType, RollBreakdownItem, RollMode } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────

export const DIE_TYPES: DieType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

export const QUICK_FORMULAS = DIE_TYPES.map((d) => `1${d}`)

// ────────────────────────────────────────────────────────
// Parser de fórmula controlado (sem eval)
// ────────────────────────────────────────────────────────

export interface ParsedDiceTerm {
  type: 'sum' | 'keep_highest'
  quantity: number
  sides: number
  notation: string
}

export interface ParsedFormula {
  terms: ParsedDiceTerm[]
  modifier: number
  raw: string
}

/**
 * Gramática aceita (case-insensitive para o 'd'):
 *
 *   formula  = term ( ('+' | '-') term )*
 *   term     = dice-term | number
 *   dice-term = [qty '#'] [qty] 'd' sides
 *   number   = [1-9][0-9]*
 *
 * Exemplos válidos:
 *   1d20  2d6+3  3d4-1  2#d20  1#d3+4  3#d6+2  2#d20+1d4+3
 */
export function parseDiceFormula(raw: string): ParsedFormula {
  const input = raw.trim()

  if (input.length === 0)       throw new Error('Fórmula inválida.')
  if (input.length > 80)        throw new Error('A fórmula é muito longa.')

  // Permitir apenas: dígitos, d/D, #, +, -, espaço
  if (/[^0-9dD#+\-\s]/.test(input)) {
    throw new Error('Use apenas dados, números, +, - e #.')
  }

  // Normalizar: minúsculas, sem espaços
  const normalized = input.toLowerCase().replace(/\s+/g, '')

  // Tokenizar em segmentos separados por + ou -
  // Preservar o sinal como parte do token
  const rawTokens = normalized.split(/(?=[+\-])/)

  const terms: ParsedDiceTerm[]   = []
  let   modifier                  = 0
  let   totalDiceCount            = 0

  for (const tok of rawTokens) {
    if (tok === '' || tok === '+' || tok === '-') continue

    const sign = tok.startsWith('-') ? -1 : 1
    const body = tok.replace(/^[+\-]/, '')

    if (body === '') throw new Error('Fórmula inválida.')

    // ── Termo de dado: [qty#][qty]d<sides> ──────────────────
    // keep_highest: qty#[qty]d<sides>  ex: 2#d20, 2#2d20
    const keepMatch = body.match(/^(\d+)#(\d*)d(\d+)$/)
    if (keepMatch) {
      if (sign < 0) throw new Error('Fórmula inválida.')
      const khQty  = parseInt(keepMatch[1], 10)
      const dQty   = keepMatch[2] ? parseInt(keepMatch[2], 10) : 1
      const sides  = parseInt(keepMatch[3], 10)
      if (khQty < 1 || khQty > 100)  throw new Error('Quantidade de dados acima do limite.')
      if (dQty !== 1)                 throw new Error('Ao usar #, o segundo operando deve ser 1 dado (ex: 2#d20).')
      if (sides < 2 || sides > 1000) throw new Error('Número de lados do dado acima do limite.')
      totalDiceCount += khQty
      if (totalDiceCount > 100)       throw new Error('Quantidade de dados acima do limite.')
      const notation = `${khQty}#d${sides}`
      terms.push({ type: 'keep_highest', quantity: khQty, sides, notation })
      continue
    }

    // sum: [qty]d<sides>  ex: d20, 1d20, 2d6
    const sumMatch = body.match(/^(\d*)d(\d+)$/)
    if (sumMatch) {
      if (sign < 0) throw new Error('Fórmula inválida.')
      const qty   = sumMatch[1] ? parseInt(sumMatch[1], 10) : 1
      const sides = parseInt(sumMatch[2], 10)
      if (qty < 1 || qty > 100)      throw new Error('Quantidade de dados acima do limite.')
      if (sides < 2 || sides > 1000) throw new Error('Número de lados do dado acima do limite.')
      totalDiceCount += qty
      if (totalDiceCount > 100)      throw new Error('Quantidade de dados acima do limite.')
      const notation = `${qty}d${sides}`
      terms.push({ type: 'sum', quantity: qty, sides, notation })
      continue
    }

    // ── Modificador numérico puro ────────────────────────────
    if (/^\d+$/.test(body)) {
      const val = parseInt(body, 10) * sign
      modifier += val
      continue
    }

    throw new Error('Fórmula inválida.')
  }

  if (terms.length === 0)        throw new Error('Fórmula inválida.')
  if (terms.length > 10)         throw new Error('Quantidade de dados acima do limite.')
  if (Math.abs(modifier) > 999)  throw new Error('Modificador fora do limite permitido.')

  return { terms, modifier, raw: normalized }
}

// ────────────────────────────────────────────────────────
// Roller (gera resultados aleatórios para uma fórmula parseada)
// ────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

interface RollResult {
  breakdown: RollBreakdownItem[]
  total: number
  formula: string
  /** campos legados para compatibilidade */
  legacyQty: number
  legacyDieType: DieType | null
  legacyModifier: number
  legacyRollMode: RollMode
  legacyKeptResult: number | null
  legacyIndividualResults: number[] | null
}

export function rollParsedFormula(parsed: ParsedFormula): RollResult {
  const breakdown: RollBreakdownItem[] = []
  let total = 0

  for (const term of parsed.terms) {
    const results = Array.from({ length: term.quantity }, () =>
      randomInt(1, term.sides)
    )

    if (term.type === 'keep_highest') {
      const kept     = Math.max(...results)
      const subtotal = kept
      breakdown.push({
        type: 'keep_highest',
        notation: term.notation,
        quantity: term.quantity,
        sides: term.sides,
        results,
        kept,
        subtotal,
      })
      total += subtotal
    } else {
      const subtotal = results.reduce((a, b) => a + b, 0)
      breakdown.push({
        type: 'sum',
        notation: term.notation,
        quantity: term.quantity,
        sides: term.sides,
        results,
        subtotal,
      })
      total += subtotal
    }
  }

  if (parsed.modifier !== 0) {
    breakdown.push({ type: 'modifier', value: parsed.modifier })
    total += parsed.modifier
  }

  total = Math.max(1, total)

  // Campos legados: refletem o primeiro termo de dado para compatibilidade
  const firstDiceTerm = parsed.terms[0]
  const legacyDieSides = firstDiceTerm.sides
  let legacyDieType: DieType | null = null
  for (const d of DIE_TYPES) {
    if (parseInt(d.slice(1), 10) === legacyDieSides) { legacyDieType = d; break }
  }

  const legacyRollMode: RollMode = firstDiceTerm.type === 'keep_highest' ? 'keep_highest' : 'sum'
  const legacyKeptItem = breakdown.find(
    (b): b is RollBreakdownItem & { type: 'keep_highest'; kept: number } =>
      b.type === 'keep_highest'
  )

  return {
    breakdown,
    total,
    formula: buildFormulaString(parsed),
    legacyQty:              firstDiceTerm.quantity,
    legacyDieType,
    legacyModifier:         parsed.modifier,
    legacyRollMode,
    legacyKeptResult:       legacyKeptItem?.kept ?? null,
    legacyIndividualResults: breakdown.length === 1 && breakdown[0].type !== 'modifier'
      ? (breakdown[0] as { results: number[] }).results
      : null,
  }
}

function buildFormulaString(parsed: ParsedFormula): string {
  const parts: string[] = parsed.terms.map((t) => t.notation)
  if (parsed.modifier > 0)  parts.push(`+${parsed.modifier}`)
  if (parsed.modifier < 0)  parts.push(`${parsed.modifier}`)
  return parts.join('')
}

// ────────────────────────────────────────────────────────
// Tipos internos
// ────────────────────────────────────────────────────────

interface RawRollRow {
  id: string
  campaign_id: string
  user_id: string
  die_type: DieType
  result: number
  quantity: number
  modifier: number
  individual_results: number[] | null
  total_result: number | null
  roll_mode: RollMode
  kept_result: number | null
  formula: string | null
  roll_breakdown: RollBreakdownItem[] | null
  created_at: string
  profiles: { id: string; display_name: string }
}

// ────────────────────────────────────────────────────────
// Dice Service
// ────────────────────────────────────────────────────────

/**
 * Faz o parse, rola os dados e persiste em dice_rolls.
 * Aceita fórmulas como: "1d20", "2d6+3", "3d4-1", "2#d20", "1#d3+4"
 */
export async function rollDice(
  campaignId: string,
  formulaInput: string,
): Promise<DiceRoll> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const parsed = parseDiceFormula(formulaInput)
  const rolled = rollParsedFormula(parsed)

  const { data, error } = await supabase
    .from('dice_rolls')
    .insert({
      campaign_id:        campaignId,
      user_id:            user.id,
      die_type:           rolled.legacyDieType ?? 'd20',
      result:             rolled.total,
      quantity:           rolled.legacyQty,
      modifier:           rolled.legacyModifier,
      individual_results: rolled.legacyIndividualResults,
      total_result:       rolled.total,
      roll_mode:          rolled.legacyRollMode,
      kept_result:        rolled.legacyKeptResult,
      formula:            rolled.formula,
      roll_breakdown:     rolled.breakdown,
    })
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível registrar a rolagem.')
  return data as DiceRoll
}

/**
 * Retorna as últimas rolagens da campanha com o nome do autor.
 */
export async function getCampaignRolls(
  campaignId: string,
  limit = 20
): Promise<DiceRollWithProfile[]> {
  const { data, error } = await supabase
    .from('dice_rolls')
    .select('*, profiles(id, display_name)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error('Não foi possível carregar o histórico de rolagens.')
  if (!data || data.length === 0) return []

  return (data as unknown as RawRollRow[]).map((row) => ({
    id:                 row.id,
    campaign_id:        row.campaign_id,
    user_id:            row.user_id,
    die_type:           row.die_type,
    result:             row.result,
    quantity:           row.quantity  ?? 1,
    modifier:           row.modifier  ?? 0,
    individual_results: row.individual_results ?? null,
    total_result:       row.total_result       ?? null,
    roll_mode:          (row.roll_mode ?? 'sum') as RollMode,
    kept_result:        row.kept_result         ?? null,
    formula:            row.formula             ?? null,
    roll_breakdown:     (row.roll_breakdown as RollBreakdownItem[] | null) ?? null,
    created_at:         row.created_at,
    profile:            row.profiles,
  }))
}
