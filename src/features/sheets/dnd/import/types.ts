import type {
  DndCharacterAttackInput, DndCharacterInventoryInput, DndCharacterSheet, DndCharacterSpellInput, DndDerivedField, DndFeatureSource, DndRecharge,
} from '../../../../shared/types'
import type { SpellEntry } from '../catalog'
import type { DndForm } from '../model/sheetForm'
import type { SkillKey } from '../rules/types'
import type { SheetRead } from './readTypes'

// ────────────────────────────────────────────────────────
// Tipos da importação: as perguntas (cards), as respostas e o rascunho da
// ficha que o planejador monta. O planejador (plan.ts) é uma função pura:
// recebe a leitura do PDF e as respostas já dadas, e devolve a próxima
// pergunta (ou o rascunho pronto, se não falta nada).
// ────────────────────────────────────────────────────────

export type Answer = string | number | string[]

export interface QuestionOption { value: string; label: string; hint?: string }
export interface MultiOption extends QuestionOption { checked: boolean }

interface QuestionBase {
  /** Identificador estável: é a chave da resposta. */
  id:      string
  /** Assunto, para o selo do card ("Classe", "Magias"...). */
  section: string
  title:   string
  body?:   string
  /** Aviso de resposta inválida (a mesma pergunta volta com o motivo). */
  error?:  string
}

export type Question =
  | (QuestionBase & { kind: 'choice'; options: QuestionOption[]; recommended?: string })
  | (QuestionBase & { kind: 'multi'; options: MultiOption[] })
  | (QuestionBase & { kind: 'number'; min: number; max: number; defaultValue?: number; unit?: string })
  | (QuestionBase & { kind: 'text'; placeholder?: string; defaultValue?: string; multiline?: boolean })

export type Answers = Record<string, Answer>

/** Uma classe da ficha importada. */
export interface DraftClass { class_key: string; level: number; subclass_key: string | null; is_initial: boolean; hp_rolls: number[] }
export interface DraftSkill { skill_key: SkillKey; proficient: boolean; expertise: boolean }
export interface DraftProficiency { category: 'armor' | 'weapon' | 'tool' | 'language'; entry_key: string; label: string }
export interface DraftFeature {
  source: DndFeatureSource; feature_key: string | null; name: string; level: number | null; notes: string
  uses_max?: number | null; recharge?: DndRecharge | null
}
export interface DraftOverride { field_key: DndDerivedField; manual_value: string; reason: string }

/** A ficha como ela ficaria depois da importação. */
export interface ImportDraft {
  /** O formulário da ficha (tudo que a pessoa edita), já com os valores do PDF. */
  form:          DndForm
  classes:       DraftClass[]
  skills:        DraftSkill[]
  attacks:       DndCharacterAttackInput[]
  inventory:     DndCharacterInventoryInput[]
  spells:        DndCharacterSpellInput[]
  proficiencies: DraftProficiency[]
  features:      DraftFeature[]
  overrides:     DraftOverride[]
  /** Espaços de magia gastos por nível (1 a 9). */
  slotsUsed:     Record<number, number>
  /** Linhas do resumo final: o que foi lido e como foi tratado. */
  report:        string[]
}

export interface ImportInput {
  read:     SheetRead
  /** A ficha aberta (a importação substitui o conteúdo dela). */
  existing: DndCharacterSheet
  /** O catálogo de magias (carregado sob demanda). */
  spells:   readonly SpellEntry[]
}

export type PlanResult =
  | { done: false; question: Question; asked: string[] }
  | { done: true; draft: ImportDraft; asked: string[] }

/** Lançado pelo planejador quando precisa de uma resposta que ainda não existe. */
export class Pending extends Error {
  constructor(readonly question: Question) { super(`pergunta pendente: ${question.id}`) }
}
