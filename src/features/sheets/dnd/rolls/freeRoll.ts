import type { DiceRoll, DiceRollContext, RollBreakdownItem } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// A rolagem livre da janela de dados: o rolador do site (rolagem rápida e
// fórmula escrita à mão: 1d20+5, 2#d20+5 para o maior de dois, 2@d20+5 para o
// menor). Sem tela: o contexto que vai gravado com a
// rolagem e a leitura da rolagem gravada em grupos de dados (para o painel de
// quem rola e para o de quem assiste).
// ────────────────────────────────────────────────────────

/** "2d6+1d8-2" como se lê: "2d6 + 1d8 - 2". */
export function freeLabel(formula: string): string {
  return formula.replace(/\s+/g, '').replace(/([+-])/g, ' $1 ').trim()
}

export function freeContext(character: string): DiceRollContext {
  return { system: 'dnd5e', kind: 'custom', key: 'free', character: character || undefined }
}

/** Rolagem livre (a que o painel da janela de dados grava). */
export function isFreeRoll(roll: DiceRoll): boolean {
  const c = roll.roll_context
  return c?.kind === 'custom' && c.key === 'free' && (roll.roll_breakdown ?? []).some((b) => b.type !== 'modifier')
}

export interface FreeGroup {
  sides:    number
  results:  number[]
  /** O que o grupo soma: a soma de todos, ou só o dado que valeu (2#d20 e 2@d20). */
  subtotal: number
  /** "2d6", "2#d20", "2@d20". */
  notation: string
  /** Maior ou menor de vários: os dados que não valeram aparecem apagados. */
  keep?:    'highest' | 'lowest'
}

export interface FreeReading {
  groups:   FreeGroup[]
  modifier: number
  total:    number
}

export function readFree(breakdown: readonly RollBreakdownItem[], total: number): FreeReading {
  const groups: FreeGroup[] = []
  let modifier = 0
  for (const b of breakdown) {
    if (b.type === 'modifier') modifier += b.value
    else if (b.type === 'sum') groups.push({ sides: b.sides, results: b.results, subtotal: b.subtotal, notation: b.notation })
    else if (b.type === 'keep_highest' || b.type === 'keep_lowest') {
      groups.push({ sides: b.sides, results: b.results, subtotal: b.subtotal, notation: b.notation, keep: b.type === 'keep_highest' ? 'highest' : 'lowest' })
    }
  }
  return { groups, modifier, total }
}

/** "3 + 5" (ou "14, 9" no maior/menor de vários); com muitos dados, os primeiros e reticências. */
export function resultsText(g: FreeGroup): string {
  const sep = g.keep ? ', ' : ' + '
  return g.results.length <= 12 ? g.results.join(sep) : `${g.results.slice(0, 12).join(sep)}${sep}…`
}

/** O dado de forma 3D que fica parado no painel antes de rolar (o primeiro da fórmula; d20 se não achar). */
export function idleKindOf(formula: string): 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100' {
  const m = /d(\d+)/i.exec(formula)
  const sides = m ? Number(m[1]) : 20
  return ([4, 6, 8, 10, 12, 20, 100].includes(sides) ? `d${sides}` : 'd20') as ReturnType<typeof idleKindOf>
}
