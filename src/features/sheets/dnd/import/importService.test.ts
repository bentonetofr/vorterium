import { beforeEach, describe, expect, it, vi } from 'vitest'

// Um banco de mentira em memória: guarda as linhas por tabela e registra cada operação.
const db = vi.hoisted(() => {
  const state = { tables: {} as Record<string, Record<string, unknown>[]>, log: [] as string[], failInsertOn: null as string | null }
  const from = (table: string) => {
    const rows = () => (state.tables[table] ??= [])
    const q: Record<string, unknown> = {}
    let mode: 'select' | 'delete' | 'insert' = 'select'
    let payload: Record<string, unknown>[] = []
    let neqSource = false
    q.select = () => { mode = 'select'; return q }
    q.delete = () => { mode = 'delete'; return q }
    q.insert = (r: Record<string, unknown>[] | Record<string, unknown>) => { mode = 'insert'; payload = Array.isArray(r) ? r : [r]; return q }
    q.eq = () => q
    q.neq = () => { neqSource = true; return q }
    q.then = (resolve: (v: unknown) => void) => {
      if (mode === 'select') { state.log.push(`select ${table}`); resolve({ data: rows().map((r) => ({ ...r })), error: null }); return }
      if (mode === 'delete') {
        state.log.push(`delete ${table}${neqSource ? ' (sem manuais)' : ''}`)
        state.tables[table] = neqSource ? rows().filter((r) => r.source === 'manual') : []
        resolve({ error: null }); return
      }
      state.log.push(`insert ${table} x${payload.length}`)
      if (state.failInsertOn === table) { resolve({ error: { message: 'falhou' } }); return }
      rows().push(...payload.map((p, i) => ({ id: `${table}-${rows().length + i}`, ...p })))
      resolve({ error: null })
    }
    return q
  }
  return { state, from }
})
vi.mock('../../../../shared/lib/supabase', () => ({ supabase: { from: db.from } }))

import { makeSheet } from '../components/fixtures'
import { applyImport, checkDraft } from './importService'
import { drive, realistic } from './import.testkit'
import type { ImportDraft } from './types'

function draft(): ImportDraft {
  const r = drive(realistic).result
  if (!r.done) throw new Error('não terminou')
  return r.draft
}

beforeEach(() => { db.state.tables = {}; db.state.log = []; db.state.failInsertOn = null })

describe('gravar a ficha importada', () => {
  it('apaga o conteúdo antigo antes de gravar e grava tudo, com a classe inicial primeiro', async () => {
    db.state.tables.dnd_character_attacks = [{ id: 'old', sheet_id: 's1', name: 'Velho' }]
    db.state.tables.dnd_character_resources = [{ id: 'r1', sheet_id: 's1', key: 'mine', source: 'manual' }, { id: 'r2', sheet_id: 's1', key: 'rage', source: 'class' }]
    const saved: unknown[] = []
    await applyImport({ sheet: makeSheet(), draft: draft(), saveSheet: async (p) => { saved.push(p) } })

    const log = db.state.log
    // apagou antes de inserir, em cada tabela
    for (const t of ['dnd_character_attacks', 'dnd_character_spells', 'dnd_character_classes', 'dnd_character_features']) {
      expect(log.indexOf(`delete ${t}`)).toBeGreaterThan(-1)
      expect(log.findIndex((l) => l.startsWith(`insert ${t}`))).toBeGreaterThan(log.indexOf(`delete ${t}`))
    }
    expect(db.state.tables.dnd_character_attacks.map((a) => a.name)).toEqual(['Besta leve', 'Adaga'])
    expect(db.state.tables.dnd_character_spells).toHaveLength(10)
    expect(db.state.tables.dnd_character_inventory).toHaveLength(7)
    expect(db.state.tables.dnd_character_skills).toHaveLength(8)
    expect(db.state.tables.dnd_character_classes).toMatchObject([{ class_key: 'bard', level: 5, subclass_key: 'lore', is_initial: true, hp_rolls: [3, 4, 4, 4] }])
    expect(db.state.tables.dnd_character_proficiencies.map((p) => p.label).sort()).toEqual(['Anão', 'Banjo', 'Flauta', 'Harpa'])
    // o recurso manual fica; o de classe antigo sai
    expect(db.state.tables.dnd_character_resources.map((r) => r.key)).toEqual(expect.arrayContaining(['mine', 'spell_slot_1', 'spell_slot_2', 'spell_slot_3']))
    expect(db.state.tables.dnd_character_resources.find((r) => r.key === 'rage')).toBeUndefined()
    // espaços de magia: 4/3/2 de um Bardo 5, com os gastos do PDF (3 do 1º e 3 do 2º)
    const slot = (n: number) => db.state.tables.dnd_character_resources.find((r) => r.key === `spell_slot_${n}`)
    expect(slot(1)).toMatchObject({ max_value: 4, current_value: 1 })
    expect(slot(2)).toMatchObject({ max_value: 3, current_value: 0 })
    expect(slot(3)).toMatchObject({ max_value: 2, current_value: 2 })
    // a ficha: payload do salvamento normal, com PV, CA e CD calculados
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ character_name: 'Dandrelis Eldricon', hp_max: 28, hp_current: 15, race_key: 'half_elf', background_key: 'entertainer', class_name: 'Bardo 5', experience: 6500, coin_gp: 120, hit_dice_used: { '8': 2 } })
  })

  it('se algo falha no meio, devolve a ficha ao que era antes', async () => {
    const before = [{ id: 'a1', sheet_id: 's1', name: 'Velho', attack_bonus: '', damage: '', damage_type: '', notes: '', catalog_entry_key: null, sort_order: 0 }]
    db.state.tables.dnd_character_attacks = before
    db.state.tables.dnd_character_classes = [{ id: 'c1', sheet_id: 's1', class_key: 'fighter', level: 3, subclass_key: null, is_initial: true, hp_rolls: [] }]
    db.state.failInsertOn = 'dnd_character_spells'
    await expect(applyImport({ sheet: makeSheet(), draft: draft(), saveSheet: async () => {} })).rejects.toThrow(/devolvida ao que era antes/)
    expect(db.state.tables.dnd_character_attacks.map((a) => a.name)).toEqual(['Velho'])
    expect(db.state.tables.dnd_character_classes.map((c) => c.class_key)).toEqual(['fighter'])
    expect(db.state.tables.dnd_character_spells ?? []).toEqual([])
  })

  it('não grava nada se o rascunho é inválido', async () => {
    const d = draft()
    d.classes[0].hp_rolls = [99]
    expect(checkDraft(d)).toMatch(/inválidas/)
    await expect(applyImport({ sheet: makeSheet(), draft: d, saveSheet: async () => {} })).rejects.toThrow()
    expect(db.state.log).toEqual([])
    expect(checkDraft({ ...draft(), form: { ...draft().form, character_name: ' ' } })).toMatch(/sem nome/)
  })
})
