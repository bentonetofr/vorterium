import { makeCtx, type Ctx } from './ctx'
import { BASIC_STEPS } from './steps/basics'
import { COMBAT_STEPS } from './steps/combat'
import { FEATURE_STEPS } from './steps/features'
import { GEAR_STEPS } from './steps/gear'
import { PROFICIENCY_STEPS } from './steps/proficiency'
import { SPELL_STEPS } from './steps/spells'
import { VERIFY_STEPS } from './steps/verify'
import { Pending, type Answers, type ImportInput, type PlanResult } from './types'

// ────────────────────────────────────────────────────────
// O planejador da importação: roda as etapas em ordem sobre a leitura do PDF.
// Cada etapa preenche o rascunho e, quando não tem certeza, pergunta (uma
// pergunta de cada vez). É uma função pura: com as mesmas respostas devolve
// sempre o mesmo resultado, então a tela só guarda as respostas, refaz o
// plano a cada resposta e, para voltar, tira a última resposta.
// ────────────────────────────────────────────────────────

type Step = (c: Ctx) => void

const STEPS: Step[] = [...BASIC_STEPS, ...PROFICIENCY_STEPS, ...GEAR_STEPS, ...SPELL_STEPS, ...FEATURE_STEPS, ...COMBAT_STEPS, ...VERIFY_STEPS]

export function runImport(input: ImportInput, answers: Answers): PlanResult {
  const ctx = makeCtx(input, answers)
  try {
    for (const step of STEPS) step(ctx)
    return { done: true, draft: ctx.draft, asked: ctx.asked }
  } catch (err) {
    if (err instanceof Pending) return { done: false, question: err.question, asked: ctx.asked }
    throw err
  }
}
