import { parseDiceFormula, recordRoll, rollParsedFormula } from '../../../dice/services/diceService'
import { getMyDiceSkin } from '../../../dice3d/diceSkinService'
import { DEFAULT_SKIN } from '../../../dice3d/skins'
import { duality, dualityLabel, rollDie, type DualityResult } from '../model/dice'
import { DH_FEAR_SKIN, DH_HOPE_SKIN } from '../../../dice3d/skins'
import type { DiceRoll } from '../../../../shared/types'
import type { StageDie } from '../../../dice3d/DiceStage'
import { stageDiceFor } from '../../dnd/rolls/diceKinds'

// ────────────────────────────────────────────────────────
// Rolagens do DaggerHeart na mesa: os Dados de Dualidade (2d12: o primeiro é o Dado de Esperança, o segundo o de Medo)
// e rolagens de dano. Cada uma vai para o histórico da campanha, como as dos outros sistemas.
// ────────────────────────────────────────────────────────

export interface DhRollTarget {
  campaignId: string
  /** Sem ficha (rolador de dados do site), vai vazio. */
  sheetId: string | null
  character: string
}

export interface DualityArgs extends DhRollTarget {
  label: string
  modifier: number
  difficulty?: number | null
  advantage?: 'vantagem' | 'desvantagem' | null
  /** Dado de Esperança diferente de d12 (ex.: d20 em algumas habilidades). */
  hopeSides?: number
}

export interface DualityRolled {
  roll: DiceRoll
  result: DualityResult
  /** Os dados para o palco 3D: Esperança (dourado), Medo (roxo) e, se houver, o d6 de vantagem ou desvantagem. */
  dice: StageDie[]
  skin: string
}

export async function rollDualityDice(a: DualityArgs): Promise<DualityResult> {
  return (await rollDualityStaged(a)).result
}

export async function rollDualityStaged(a: DualityArgs): Promise<DualityRolled> {
  const skin = await getMyDiceSkin().catch(() => DEFAULT_SKIN)
  const rolled = rollParsedFormula(parseDiceFormula('2d12'))
  const first = rolled.breakdown[0]
  const results = first && 'results' in first && Array.isArray(first.results) ? (first.results as number[]) : [rollDie(12), rollDie(12)]
  let hope = results[0] ?? rollDie(12)
  const fear = results[1] ?? rollDie(12)
  if (a.hopeSides && a.hopeSides !== 12) hope = rollDie(a.hopeSides)
  const advDie = a.advantage ? rollDie(6) : 0
  const res = duality({ hope, fear, modifier: a.modifier, advantage: a.advantage ?? null, advantageDie: advDie, difficulty: a.difficulty ?? null })

  const sign = a.modifier >= 0 ? `+${a.modifier}` : `${a.modifier}`
  const adv = a.advantage ? ` ${a.advantage === 'vantagem' ? '+' : '−'}d6(${advDie})` : ''
  const label = `${a.label}: ${hope}+${fear} ${sign}${adv} = ${res.total} · ${dualityLabel(res)}`
  const roll = await recordRoll(a.campaignId, rolled, false, {
    label,
    skin,
    context: { system: 'daggerheart', kind: 'custom', ...(a.sheetId ? { sheet_id: a.sheetId } : {}), character: a.character, dc: a.difficulty ?? null },
  })
  const dice: StageDie[] = [
    { kind: a.hopeSides === 20 ? 'd20' : 'd12', value: hope, skin: DH_HOPE_SKIN },
    { kind: 'd12', value: fear, skin: DH_FEAR_SKIN },
  ]
  if (a.advantage) dice.push({ kind: 'd6', value: advDie, skin })
  return { roll, result: res, dice, skin }
}

export interface DamageArgs extends DhRollTarget {
  label: string
  /** Dado do dano, ex.: "d8+3". */
  dice: string
  proficiency: number
  /** Bônus fixos somados (Treinamento de Combate etc.). */
  extra: number
  critical: boolean
}

export interface DamageResult {
  total: number
  formula: string
  dice: number[]
  /** Dados para o palco 3D. */
  stage: StageDie[]
  skin: string
}

export async function rollDamage(a: DamageArgs): Promise<DamageResult> {
  const skin = await getMyDiceSkin().catch(() => DEFAULT_SKIN)
  const m = a.dice.trim().match(/^d(\d+)(?:\s*([+-])\s*(\d+))?$/i)
  if (!m) throw new Error('Dado de dano inválido.')
  const sides = Number(m[1])
  const fixed = m[3] ? (m[2] === '-' ? -Number(m[3]) : Number(m[3])) : 0
  // no crítico começa do valor máximo dos dados e soma a rolagem normal
  const critBase = a.critical ? sides * a.proficiency : 0
  const bonus = fixed + a.extra + critBase
  const formula = `${a.proficiency}d${sides}${bonus ? (bonus > 0 ? `+${bonus}` : `${bonus}`) : ''}`
  const rolled = rollParsedFormula(parseDiceFormula(formula))
  const first = rolled.breakdown[0]
  const dice = first && 'results' in first && Array.isArray(first.results) ? (first.results as number[]) : []
  await recordRoll(a.campaignId, rolled, false, {
    label: `${a.label}${a.critical ? ' (crítico)' : ''}: ${formula} = ${rolled.total}`,
    skin,
    context: { system: 'daggerheart', kind: 'damage', sheet_id: a.sheetId ?? undefined, character: a.character },
  })
  return { total: rolled.total, formula, dice, stage: stageDiceFor(rolled.breakdown, skin), skin }
}

/** Rolagem livre de uma fórmula (Dado de Inspiração, Dados de Oração, efeitos de cartas…). */
export async function rollFree(a: DhRollTarget & { label: string; formula: string }): Promise<number> {
  const skin = await getMyDiceSkin().catch(() => DEFAULT_SKIN)
  const rolled = rollParsedFormula(parseDiceFormula(a.formula))
  await recordRoll(a.campaignId, rolled, false, {
    label: `${a.label}: ${a.formula} = ${rolled.total}`,
    skin,
    context: { system: 'daggerheart', kind: 'custom', sheet_id: a.sheetId ?? undefined, character: a.character },
  })
  return rolled.total
}
