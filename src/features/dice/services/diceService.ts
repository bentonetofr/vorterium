import { supabase } from '../../../shared/lib/supabase'
import { logActivity } from '../../activity/services/activityService'
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
  type: 'sum' | 'keep_highest' | 'keep_lowest'
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
 *   1d20  2d6+3  3d4-1  2#d20  1#d3+4  3#d6+2  2#d20+1d4+3  2@d20
 *
 * O operador '@' funciona como o '#', mas mantém o MENOR resultado
 * em vez do maior (ex: 2@d20 rola 2d20 e mantém o menor).
 */
export function parseDiceFormula(raw: string): ParsedFormula {
  const input = raw.trim()

  if (input.length === 0)       throw new Error('Fórmula inválida.')
  if (input.length > 80)        throw new Error('A fórmula é muito longa.')

  // Permitir apenas: dígitos, d/D, #, @, +, -, espaço
  if (/[^0-9dD#@+\-\s]/.test(input)) {
    throw new Error('Use apenas dados, números, +, -, # e @.')
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

    // keep_lowest: qty@[qty]d<sides>  ex: 2@d20, 2@2d20
    const keepLowMatch = body.match(/^(\d+)@(\d*)d(\d+)$/)
    if (keepLowMatch) {
      if (sign < 0) throw new Error('Fórmula inválida.')
      const klQty  = parseInt(keepLowMatch[1], 10)
      const dQty   = keepLowMatch[2] ? parseInt(keepLowMatch[2], 10) : 1
      const sides  = parseInt(keepLowMatch[3], 10)
      if (klQty < 1 || klQty > 100)  throw new Error('Quantidade de dados acima do limite.')
      if (dQty !== 1)                 throw new Error('Ao usar @, o segundo operando deve ser 1 dado (ex: 2@d20).')
      if (sides < 2 || sides > 1000) throw new Error('Número de lados do dado acima do limite.')
      totalDiceCount += klQty
      if (totalDiceCount > 100)       throw new Error('Quantidade de dados acima do limite.')
      const notation = `${klQty}@d${sides}`
      terms.push({ type: 'keep_lowest', quantity: klQty, sides, notation })
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
    } else if (term.type === 'keep_lowest') {
      const kept     = Math.min(...results)
      const subtotal = kept
      breakdown.push({
        type: 'keep_lowest',
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

  const legacyRollMode: RollMode =
    firstDiceTerm.type === 'keep_highest' ? 'keep_highest' :
    firstDiceTerm.type === 'keep_lowest'  ? 'keep_lowest'  : 'sum'
  const legacyKeptItem = breakdown.find(
    (b): b is RollBreakdownItem & { type: 'keep_highest' | 'keep_lowest'; kept: number } =>
      b.type === 'keep_highest' || b.type === 'keep_lowest'
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
  is_private: boolean
  created_at: string
  profiles: { id: string; display_name: string } | null
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
  isPrivate = false,
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
      is_private:         isPrivate,
    })
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível registrar a rolagem.')
  const roll = data as DiceRoll
  // Rolagem privada não gera rastro na aba Atividade — nem pro autor, nem pro mestre.
  if (!isPrivate) {
    logActivity(campaignId, 'dice_rolled', `Rolagem registrada: ${roll.formula ?? roll.die_type}, resultado ${roll.result}.`)
  }
  return roll
}

// ────────────────────────────────────────────────────────
// Teste de pares (Terra Devastada)
//
// A parada vai de 1 a 6 d6 (1 dado natural + bônus). Cada PAR é um ponto
// de desempenho; todo 6, além de contar, rola de novo (Golpe de Sorte) até
// sair outra coisa. A Convicção compra pontos de desempenho garantidos,
// que entram como modificador. O desempenho pode ser 0.
// ────────────────────────────────────────────────────────

export const EVENS_MAX_DICE = 6

export interface EvensRollResult {
  results:  number[]
  bonus:    number[]
  evens:    number
}

/** Rola a parada (só a sorte — não grava nada). */
export function rollEvensPool(dice: number): EvensRollResult {
  const qty = Math.max(1, Math.min(EVENS_MAX_DICE, Math.floor(dice)))
  const results = Array.from({ length: qty }, () => randomInt(1, 6))
  const bonus: number[] = []
  let pending = results.filter((r) => r === 6).length
  // Teto de segurança: a chance de 100 seis seguidos é nula, mas o banco
  // recusa mais que isso.
  while (pending > 0 && bonus.length < 100) {
    const r = randomInt(1, 6)
    bonus.push(r)
    pending -= 1
    if (r === 6) pending += 1
  }
  const evens = [...results, ...bonus].filter((r) => r % 2 === 0).length
  return { results, bonus, evens }
}

export interface EvensTestOptions {
  /** Pontos de desempenho comprados com Convicção antes de rolar (0 a 10). */
  conviction?: number
  isPrivate?:  boolean
}

/**
 * Faz um teste de pares e grava em dice_rolls — aparece no histórico de
 * dados como qualquer rolagem. `result` = pares + Convicção.
 */
export async function rollEvensTest(
  campaignId: string,
  dice: number,
  { conviction = 0, isPrivate = false }: EvensTestOptions = {},
): Promise<DiceRoll> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const boost = Math.max(0, Math.min(10, Math.floor(conviction)))
  const pool = rollEvensPool(dice)
  const qty = pool.results.length
  const breakdown: RollBreakdownItem[] = [{
    type: 'evens', notation: `${qty}d6`, quantity: qty, sides: 6,
    results: pool.results, bonus: pool.bonus, subtotal: pool.evens,
  }]
  if (boost > 0) breakdown.push({ type: 'modifier', value: boost })
  const total = pool.evens + boost
  const formula = `${qty}d6 pares${boost > 0 ? ` +${boost}` : ''}`

  const { data, error } = await supabase
    .from('dice_rolls')
    .insert({
      campaign_id:        campaignId,
      user_id:            user.id,
      die_type:           'd6',
      result:             total,
      quantity:           qty,
      modifier:           boost,
      individual_results: null,
      total_result:       total,
      roll_mode:          'evens',
      kept_result:        null,
      formula,
      roll_breakdown:     breakdown,
      is_private:         isPrivate,
    })
    .select('*')
    .single()

  if (error) throw new Error('Não foi possível registrar a rolagem.')
  const roll = data as DiceRoll
  if (!isPrivate) {
    logActivity(campaignId, 'dice_rolled', `Teste de pares (${qty}d6): desempenho ${total}.`)
  }
  return roll
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
    is_private:         row.is_private ?? false,
    created_at:         row.created_at,
    profile:            row.profiles,
  }))
}

/**
 * Assina INSERT em `dice_rolls` de uma campanha específica. O payload só
 * traz as colunas cruas da tabela (sem join de perfil) — quem chama
 * resolve o autor por fora (ex: mapa local de membros já carregado) e
 * completa o `DiceRollWithProfile`. RLS já filtra o que chega: rolagem
 * oculta de outro jogador nunca aparece pra quem não é o mestre.
 */
export function subscribeToRolls(
  campaignId: string,
  onInsert: (row: DiceRoll) => void,
): () => void {
  const channel = supabase
    .channel(`dice_rolls:${campaignId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'dice_rolls', filter: `campaign_id=eq.${campaignId}` },
      (payload) => onInsert(payload.new as DiceRoll),
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
