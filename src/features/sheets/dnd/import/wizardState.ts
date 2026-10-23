import type { Answer, Answers } from './types'

// ────────────────────────────────────────────────────────
// O estado do questionário: as respostas e a ordem em que foram dadas.
// Responder de novo uma pergunta antiga apaga as respostas dadas depois
// dela (as perguntas seguintes podem ser outras), e Voltar tira a última.
// ────────────────────────────────────────────────────────

export interface WizardAnswers { answers: Answers; order: string[] }

export const emptyAnswers = (): WizardAnswers => ({ answers: {}, order: [] })

export function withAnswer(state: WizardAnswers, id: string, value: Answer): WizardAnswers {
  const at = state.order.indexOf(id)
  const keep = at < 0 ? state.order : state.order.slice(0, at)
  const answers: Answers = {}
  for (const k of keep) answers[k] = state.answers[k]
  answers[id] = value
  return { answers, order: [...keep, id] }
}

export function goBack(state: WizardAnswers): WizardAnswers {
  if (state.order.length === 0) return state
  const order = state.order.slice(0, -1)
  const answers: Answers = {}
  for (const k of order) answers[k] = state.answers[k]
  return { answers, order }
}
