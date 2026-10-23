import { supabase } from '../../../../shared/lib/supabase'
import type {
  DndCharacterClass, DndCharacterSheet, DndCharacterSheetUpdateInput,
} from '../../../../shared/types'
import { formToPayload } from '../model/sheetForm'
import { classLine } from '../model/sheetModel'
import { PACT_SLOT_KEY, planSlotResources } from '../model/slots'
import { deriveDraft } from './ctx'
import type { ImportDraft } from './types'

// ────────────────────────────────────────────────────────
// Grava a ficha importada. A importação SUBSTITUI o conteúdo da ficha aberta:
// apaga o que a ficha tinha em cada tabela e grava o rascunho. Antes disso
// guarda uma cópia do que existia e, se algo falhar no meio, tenta devolver
// tudo como estava (as tabelas não têm transação pelo navegador). O que
// depende de cálculo (nível, CA, PV, CD...) vai junto no payload da ficha,
// feito pelo mesmo `formToPayload` do salvamento normal.
// ────────────────────────────────────────────────────────

const CHILD_TABLES = [
  'dnd_character_skills', 'dnd_character_attacks', 'dnd_character_inventory', 'dnd_character_spells',
  'dnd_character_proficiencies', 'dnd_character_features', 'dnd_character_overrides',
] as const

type Row = Record<string, unknown>
interface Snapshot { classes: Row[]; resources: Row[]; tables: Partial<Record<(typeof CHILD_TABLES)[number], Row[]>> }

/** Tira ids e datas para a linha poder ser gravada de novo. */
const bare = (row: Row): Row => { const { id, created_at, updated_at, ...rest } = row; void id; void created_at; void updated_at; return rest }

async function read(table: string, sheetId: string): Promise<Row[]> {
  const { data, error } = await supabase.from(table).select('*').eq('sheet_id', sheetId)
  if (error) throw new Error('Não foi possível ler a ficha atual antes de importar.')
  return (data ?? []) as Row[]
}

async function wipe(table: string, sheetId: string, keepManualResources = false): Promise<void> {
  let q = supabase.from(table).delete().eq('sheet_id', sheetId)
  if (keepManualResources) q = q.neq('source', 'manual')
  const { error } = await q
  if (error) throw new Error('Não foi possível limpar a ficha para importar.')
}

async function insert(table: string, rows: Row[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase.from(table).insert(rows)
  if (error) throw new Error(`Não foi possível gravar a ficha importada (${table.replace('dnd_character_', '')}).`)
}

async function insertClasses(sheetId: string, rows: Row[]): Promise<void> {
  // a classe inicial primeiro: o banco só aceita uma e confere a soma dos níveis a cada linha
  for (const r of [...rows].sort((a, b) => Number(!!b.is_initial) - Number(!!a.is_initial))) await insert('dnd_character_classes', [{ ...r, sheet_id: sheetId }])
}

async function snapshot(sheetId: string): Promise<Snapshot> {
  const tables: Snapshot['tables'] = {}
  for (const t of CHILD_TABLES) tables[t] = (await read(t, sheetId)).map(bare)
  return { classes: (await read('dnd_character_classes', sheetId)).map(bare), resources: (await read('dnd_character_resources', sheetId)).map(bare), tables }
}

async function restore(sheetId: string, snap: Snapshot): Promise<void> {
  for (const t of CHILD_TABLES) { await wipe(t, sheetId); await insert(t, snap.tables[t] ?? []) }
  await wipe('dnd_character_classes', sheetId)
  await insertClasses(sheetId, snap.classes)
  await wipe('dnd_character_resources', sheetId)
  await insert('dnd_character_resources', snap.resources)
}

/** Verifica o rascunho antes de gravar qualquer coisa. Devolve o motivo se algo não pode ser gravado. */
export function checkDraft(draft: ImportDraft): string | null {
  if (!draft.form.character_name.trim()) return 'O personagem está sem nome.'
  if (draft.classes.length > 0) {
    if (draft.classes.reduce((s, c) => s + c.level, 0) > 20) return 'A soma dos níveis passa de 20.'
    if (draft.classes.filter((c) => c.is_initial).length !== 1) return 'Tem de haver uma classe inicial.'
    for (const c of draft.classes) if (c.hp_rolls.some((n) => !Number.isInteger(n) || n < 0 || n > 12) || c.hp_rolls.length > c.level) return 'As rolagens de PV de uma classe são inválidas.'
  }
  return null
}

export interface ApplyOptions {
  sheet:      DndCharacterSheet
  draft:      ImportDraft
  /** Grava o payload da ficha pelo caminho normal de salvamento (atualiza a tela e o histórico). */
  saveSheet:  (payload: DndCharacterSheetUpdateInput) => Promise<void>
}

export async function applyImport({ sheet, draft, saveSheet }: ApplyOptions): Promise<void> {
  const problem = checkDraft(draft)
  if (problem) throw new Error(problem)
  const id = sheet.id
  const snap = await snapshot(id)
  try {
    // 1) o conteúdo antigo
    for (const t of CHILD_TABLES) await wipe(t, id)
    await wipe('dnd_character_classes', id)
    await wipe('dnd_character_resources', id, true)

    // 2) o novo
    await insertClasses(id, draft.classes.map((c) => ({ class_key: c.class_key, level: c.level, subclass_key: c.subclass_key, is_initial: c.is_initial, hp_rolls: c.hp_rolls })))
    await insert('dnd_character_skills', draft.skills.map((s) => ({ sheet_id: id, skill_key: s.skill_key, proficient: s.proficient, expertise: s.expertise })))
    await insert('dnd_character_attacks', draft.attacks.map((a) => ({ sheet_id: id, ...a })))
    await insert('dnd_character_inventory', draft.inventory.map((i) => ({ sheet_id: id, ...i })))
    await insert('dnd_character_spells', draft.spells.map((s) => ({ sheet_id: id, ...s })))
    await insert('dnd_character_proficiencies', draft.proficiencies.map((p) => ({ sheet_id: id, category: p.category, entry_key: p.entry_key, label: p.label, source: 'manual' })))
    await insert('dnd_character_features', draft.features.map((f, i) => ({
      sheet_id: id, source: f.source, feature_key: f.feature_key, name: f.name, level: f.level, notes: f.notes, uses_current: f.uses_max ?? null, uses_max: f.uses_max ?? null, recharge: f.recharge ?? null, sort_order: i,
    })))
    await insert('dnd_character_overrides', draft.overrides.map((o) => ({ sheet_id: id, field_key: o.field_key, manual_value: o.manual_value, reason: o.reason })))

    // 3) espaços de magia, com os gastos do PDF (os recursos de classe a própria ficha cria ao abrir)
    const bundle = deriveDraft(sheet, draft)
    const slots = bundle.derived.spellcasting?.slots ?? []
    const plan = planSlotResources(slots, bundle.derived.spellcasting?.pact ?? null, [])
    await insert('dnd_character_resources', plan.map((p) => {
      const lvl = p.key === PACT_SLOT_KEY ? 0 : Number(p.key.replace('spell_slot_', ''))
      const used = lvl > 0 ? draft.slotsUsed[lvl] ?? 0 : 0
      return { sheet_id: id, key: p.key, label: p.label, max_value: p.max_value, current_value: Math.max(0, p.max_value - used), recharge: p.recharge, source: p.source, sort_order: p.sort_order }
    }))

    // 4) a própria ficha (nível e classe já foram acertados pelo banco quando as classes entraram)
    const classRows: DndCharacterClass[] = draft.classes.map((c, i) => ({
      id: `c${i}`, sheet_id: id, class_key: c.class_key, level: c.level, subclass_key: c.subclass_key, is_initial: c.is_initial, hp_rolls: c.hp_rolls, created_at: '', updated_at: '',
    }))
    await saveSheet(formToPayload(sheet, draft.form, bundle.derived, classLine(classRows, sheet.class_name), classRows.length > 0))
  } catch (err) {
    try { await restore(id, snap) } catch { /* o aviso abaixo diz o que fazer */ }
    throw new Error(`${err instanceof Error ? err.message : 'Não foi possível importar a ficha.'} A ficha foi devolvida ao que era antes da importação.`)
  }
}
