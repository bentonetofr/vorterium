import type { DiceRoll } from '../../../../shared/types'
import { freeLabel, isFreeRoll, readFree, resultsText } from './freeRoll'
import { isCheckRoll, watchedCheck } from './watchModel'

// ────────────────────────────────────────────────────────
// A rolagem de outra pessoa resumida numa linha, para a janelinha do canto
// ("dados dos outros simplificados"): quem rolou, o quê, o total e uma frase
// com a conta. Só leitura da rolagem gravada; sem tela.
// ────────────────────────────────────────────────────────

export interface MiniRoll {
  /** O personagem (ou, sem ele, o jogador). */
  who:     string
  title:   string
  total:   number
  /** "d20 [14] +5 · CD 12" ou "2d6 [3 + 5] +3". */
  detail:  string
  outcome: 'success' | 'failure' | null
  crit:    'crit' | 'fumble' | null
  isPrivate: boolean
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`)

export function miniRoll(roll: DiceRoll, player: string): MiniRoll {
  const who = roll.roll_context?.character || player
  if (isCheckRoll(roll)) {
    const c = watchedCheck(roll)
    const d = c.reading
    const dice = d.d20s.length > 1 ? `[${d.d20s.join(', ')}] fica ${d.natural}` : `[${d.natural}]`
    const dc = c.dcHidden ? ' · CD escondida' : c.dc != null ? ` · CD ${c.dc}` : ''
    return {
      who, title: c.label, total: roll.result,
      detail: `d20 ${dice}${c.bonus !== 0 ? ` ${signed(c.bonus)}` : ''}${dc}`,
      outcome: c.outcome, crit: c.crit, isPrivate: !!roll.is_private,
    }
  }
  const reading = readFree(roll.roll_breakdown ?? [], roll.result)
  // Teste de Altherium: o dado que valeu (natural) decide crítico e falha crítica; o alvo se chama DT.
  const alth = roll.roll_context
  if (alth?.system === 'altherium' && alth.kind === 'skill') {
    const dice = reading.groups.map((g) => `${g.notation} [${resultsText(g)}]${g.keep ? ` fica ${g.subtotal}` : ''}`).join(' + ')
    const dt = alth.dc != null ? ` · DT ${alth.dc}` : ''
    return {
      who, title: roll.roll_label || 'Teste', total: roll.result,
      detail: `${dice}${reading.modifier !== 0 ? ` ${signed(reading.modifier)}` : ''}${dt}`.trim(),
      outcome: alth.outcome ?? null,
      crit: alth.natural === 10 ? 'crit' : alth.natural === 1 ? 'fumble' : null,
      isPrivate: !!roll.is_private,
    }
  }
  const groups = reading.groups.map((g) => `${g.notation} [${resultsText(g)}]${g.keep ? ` fica ${g.subtotal}` : ''}`).join(' + ')
  const formula = groups || (roll.formula ? freeLabel(roll.formula) : '')
  return {
    who,
    title: isFreeRoll(roll) ? 'Rolagem livre' : roll.roll_label || 'Rolagem',
    total: roll.result,
    detail: `${formula}${reading.modifier !== 0 ? ` ${signed(reading.modifier)}` : ''}`.trim(),
    outcome: null, crit: null, isPrivate: !!roll.is_private,
  }
}
