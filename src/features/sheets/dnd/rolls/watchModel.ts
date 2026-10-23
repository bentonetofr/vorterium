import type { DiceRoll } from '../../../../shared/types'
import { REACTIONS, readCheck, type Advantage, type CheckReading, type Crit, type Outcome } from './checkModel'

// ────────────────────────────────────────────────────────
// Rolagens dos outros jogadores, vistas por quem não rolou: o que dá para
// ler da rolagem gravada (dice_rolls) para mostrar o mesmo painel de teste
// (d20 com CD, bônus, sucesso ou falha) ou, nas demais (dano, dado de
// vida...), os dados rolando na bandeja. Sem tela.
// ────────────────────────────────────────────────────────

const CHECK_KINDS = ['skill', 'save', 'ability', 'attack', 'initiative', 'death']

interface Term { sides?: number; results?: number[]; type?: string; value?: number }

/** Teste (perícia, salvaguarda, ataque...) com o d20 em primeiro lugar, como o painel de teste grava. */
export function isCheckRoll(roll: DiceRoll): boolean {
  const c = roll.roll_context
  if (!c?.kind || !CHECK_KINDS.includes(c.kind) || typeof c.natural !== 'number') return false
  const first = roll.roll_breakdown?.[0] as Term | undefined
  return !!first && first.sides === 20 && Array.isArray(first.results) && first.results.length > 0
}

export interface WatchedCheck {
  label:     string
  character: string
  /** CD conhecida; `dcHidden` quando o mestre a escondeu (quem vê não sabe nem o resultado). */
  dc:        number | null
  dcHidden:  boolean
  advantage: Advantage
  reading:   CheckReading
  /** Soma dos bônus fixos (o que a ficha deu mais o bônus de situação). */
  bonus:     number
  /** A parte do bônus que a pessoa digitou na hora (situação da mesa). */
  situational: number
  reactions: { label: string; die: number; value: number }[]
  outcome:   Outcome
  crit:      Crit
}

export function watchedCheck(roll: DiceRoll): WatchedCheck {
  const c = roll.roll_context ?? {}
  const breakdown = roll.roll_breakdown ?? []
  const reading = readCheck(breakdown, roll.result)
  const bonus = breakdown.reduce((s, b) => s + (b.type === 'modifier' ? b.value : 0), 0)
  const dice = breakdown.slice(1).filter((b) => b.type === 'sum') as Term[]
  const reactions = (c.reactions ?? []).map((key, i) => {
    const def = REACTIONS.find((r) => r.key === key)
    return { label: def?.label ?? key, die: dice[i]?.sides ?? def?.die ?? 4, value: reading.reactionValues[i] ?? 0 }
  })
  return {
    label: roll.roll_label ?? 'Teste',
    character: c.character ?? '',
    dc: c.dc_hidden ? null : c.dc ?? null,
    dcHidden: !!c.dc_hidden,
    advantage: c.advantage ?? 'normal',
    reading, bonus, reactions, situational: c.situational ?? 0,
    outcome: c.dc_hidden ? null : c.outcome ?? null,
    crit: c.crit ?? (reading.natural === 20 ? 'crit' : reading.natural === 1 ? 'fumble' : null),
  }
}
