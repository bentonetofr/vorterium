import { SPELLS } from '../catalog/spells'
import { makeSheet } from '../components/fixtures'
import { dandrelisFields } from './import.fixtures'
import { runImport } from './plan'
import { readSheetFromPdf } from './readPdf'
import type { Answers, ImportInput, PlanResult, Question } from './types'

// Peças dos testes da importação: a leitura da ficha de exemplo e um "motorista" que responde às perguntas.

export const readDandrelis = () => { const o = readSheetFromPdf(dandrelisFields()); if (!o.ok) throw new Error(o.message); return o.sheet }
export const dandrelisInput = (): ImportInput => ({ read: readDandrelis(), existing: makeSheet(), spells: SPELLS })

export type Picker = (q: Question) => string | number | string[] | undefined

/** Responde a cada pergunta com o que `pick` devolver até a importação terminar. */
export function drive(pick: Picker, start: Answers = {}, input: () => ImportInput = dandrelisInput, max = 80): { result: PlanResult; answers: Answers; asked: Question[] } {
  const answers: Answers = { ...start }
  const asked: Question[] = []
  for (let i = 0; i < max; i++) {
    const result = runImport(input(), answers)
    if (result.done) return { result, answers, asked }
    asked.push(result.question)
    const a = pick(result.question)
    if (a === undefined) throw new Error(`sem resposta para ${result.question.id}`)
    answers[result.question.id] = a
  }
  throw new Error('perguntas demais')
}

/** As respostas de quem confirma tudo e escolhe o que faz sentido para a ficha do Dandrelis. */
export function realistic(q: Question): string | number | string[] {
  switch (q.id) {
    case 'subclass:bard': return 'lore'
    case 'xp': return 6500
    case 'spell:sussurros_dissonantes': return 'custom'
    case 'slots-marks': return 'used'
    case 'hitdice:8': return 3
    case 'diverge': return 'system'
  }
  if (q.kind === 'multi') return q.options.filter((o) => o.checked).map((o) => o.value)
  if (q.kind === 'choice') return q.recommended ?? q.options[0].value
  if (q.kind === 'number') return q.defaultValue ?? q.min
  return q.defaultValue ?? ''
}
