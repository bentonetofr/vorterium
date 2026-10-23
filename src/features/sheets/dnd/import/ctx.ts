import type {
  DndCharacterClass, DndCharacterInventoryItem, DndCharacterProficiency, DndCharacterSheet, DndCharacterSkill, DndSheetDetails,
} from '../../../../shared/types'
import { formFromSheet, sheetWithForm } from '../model/sheetForm'
import { deriveSheet, type DerivedBundle } from '../model/sheetModel'
import { Pending, type Answer, type Answers, type ImportDraft, type ImportInput, type Question } from './types'

// ────────────────────────────────────────────────────────
// O contexto que cada etapa do planejador recebe: a leitura do PDF, a ficha
// aberta, o rascunho em construção e as funções para perguntar e anotar.
// `ask` devolve a resposta se ela já foi dada; senão interrompe o
// planejamento com a pergunta pendente (o cartão que a tela mostra).
// ────────────────────────────────────────────────────────

export interface Ctx extends ImportInput {
  draft: ImportDraft
  answers: Answers
  /** Perguntas já feitas (em ordem), para a tela mostrar o andamento e voltar. */
  asked: string[]
  /** Pergunta e devolve a resposta; sem resposta, interrompe. `validate` devolve o motivo se a resposta não serve. */
  ask(q: Question, validate?: (a: Answer) => string | null): Answer
  askChoice(q: Extract<Question, { kind: 'choice' }>): string
  askNumber(q: Extract<Question, { kind: 'number' }>): number
  askText(q: Extract<Question, { kind: 'text' }>, validate?: (v: string) => string | null): string
  askMulti(q: Extract<Question, { kind: 'multi' }>): string[]
  /** Uma linha do resumo final. */
  note(line: string): void
  /** O cálculo do motor de regras para o rascunho de agora. */
  derive(): DerivedBundle
}

export function emptyDraft(existing: DndCharacterSheet): ImportDraft {
  const form = formFromSheet(existing)
  return {
    // o que o PDF não traz de transitório volta ao começo; os textos só mudam se o PDF tiver o campo
    form: { ...form, conditions: [], concentrating_on: '', hit_dice_used: {}, manual_modes: [], class_names: {}, subclass_names: {}, vision_ft: null, race_custom: '', background_custom: '', ac_bonus: 0, spell_ability: '', exhaustion: 0, death_save_failures: 0, death_save_successes: 0, inspiration: false },
    classes: [], skills: [], attacks: [], inventory: [], spells: [], proficiencies: [], features: [], overrides: [], slotsUsed: {}, report: [],
  }
}

export function makeCtx(input: ImportInput, answers: Answers): Ctx {
  const asked: string[] = []
  const draft = emptyDraft(input.existing)

  const ask: Ctx['ask'] = (q, validate) => {
    asked.push(q.id)
    const a = answers[q.id]
    if (a === undefined) throw new Pending(q)
    const problem = validate?.(a) ?? null
    if (problem) throw new Pending({ ...q, error: problem })
    return a
  }
  const ctx: Ctx = {
    ...input, draft, answers, asked, ask,
    askChoice: (q) => {
      const a = ask(q, (v) => (typeof v === 'string' && q.options.some((o) => o.value === v) ? null : 'Escolha uma das opções.'))
      return a as string
    },
    askNumber: (q) => {
      const a = ask(q, (v) => (typeof v === 'number' && Number.isFinite(v) && v >= q.min && v <= q.max ? null : `Digite um número de ${q.min} a ${q.max}.`))
      return a as number
    },
    askText: (q, validate) => {
      const a = ask(q, (v) => (typeof v === 'string' ? validate?.(v.trim()) ?? null : 'Escreva um texto.'))
      return (a as string).trim()
    },
    askMulti: (q) => {
      const a = ask(q, (v) => (Array.isArray(v) && v.every((x) => q.options.some((o) => o.value === x)) ? null : 'Marque só opções da lista.'))
      return a as string[]
    },
    note: (line) => { draft.report.push(line) },
    derive: () => deriveDraft(input.existing, draft),
  }
  return ctx
}

const T = '1970-01-01T00:00:00.000Z'

/** Roda o motor de regras da ficha no rascunho (as mesmas contas que a ficha faz com os dados gravados). */
export function deriveDraft(existing: DndCharacterSheet, d: ImportDraft): DerivedBundle {
  const sheet = sheetWithForm(existing, d.form)
  const classes: DndCharacterClass[] = d.classes.map((c, i) => ({
    id: `c${i}`, sheet_id: existing.id, class_key: c.class_key, level: c.level, subclass_key: c.subclass_key, is_initial: c.is_initial, hp_rolls: c.hp_rolls, created_at: T, updated_at: T,
  }))
  const skills: DndCharacterSkill[] = d.skills.map((s, i) => ({ id: `s${i}`, sheet_id: existing.id, skill_key: s.skill_key, proficient: s.proficient, expertise: s.expertise }))
  const inventory: DndCharacterInventoryItem[] = d.inventory.map((it, i) => ({ id: `i${i}`, sheet_id: existing.id, ...it, created_at: T, updated_at: T }))
  const details: DndSheetDetails = {
    skills, attacks: [], inventory, spells: [],
    overrides: d.overrides.map((o, i) => ({ id: `o${i}`, sheet_id: existing.id, field_key: o.field_key, manual_value: o.manual_value, reason: o.reason, updated_at: T })),
  }
  const proficiencies: DndCharacterProficiency[] = d.proficiencies.map((p, i) => ({ id: `p${i}`, sheet_id: existing.id, category: p.category, entry_key: p.entry_key, label: p.label, source: 'import', created_at: T }))
  return deriveSheet({ sheet: { ...sheet, level: d.classes.length ? d.classes.reduce((s, c) => s + c.level, 0) : d.form.level }, classes, details, proficiencies })
}
