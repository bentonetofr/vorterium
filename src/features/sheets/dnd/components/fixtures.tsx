import type {
  DndCharacterClass, DndCharacterFeature, DndCharacterResource, DndCharacterSheet, DndSheetDetails,
} from '../../../../shared/types'
import { formFromSheet } from '../model/sheetForm'
import { deriveSheet } from '../model/sheetModel'
import type { DndSheetData } from '../hooks/useDndSheetData'
import type { SheetCtx } from './sheetContext'

// ────────────────────────────────────────────────────────
// Ficha de exemplo (Guerreiro 3 / Mago 2, anão da colina, de cota de malha e
// escudo) para os testes de renderização e para a prévia visual das abas.
// ────────────────────────────────────────────────────────

export const now = '2026-10-21T00:00:00Z'

export function makeSheet(over: Partial<DndCharacterSheet> = {}): DndCharacterSheet {
  return {
    id: 's1', campaign_id: 'c1', user_id: 'u1',
    character_name: 'Aria Valente', player_name: 'Ana', class_name: null, subclass: null, background: null, race: null, alignment: 'Leal e Bom',
    level: 1, experience: 15000, inspiration: true,
    armor_class: 10, initiative_bonus: 0, speed: 30, proficiency_bonus: 2,
    hp_current: 30, hp_max: 40, hp_temp: 3,
    strength: 16, dexterity: 12, constitution: 16, intelligence: 14, wisdom: 13, charisma: 8,
    strength_save_proficient: true, dexterity_save_proficient: false, constitution_save_proficient: true,
    intelligence_save_proficient: false, wisdom_save_proficient: false, charisma_save_proficient: false,
    death_save_successes: 1, death_save_failures: 0,
    spellcasting_ability: null, spell_save_dc: null, spell_attack_bonus: null,
    notes: 'Nota', backstory: 'Vem do norte.', personality_traits: null, ideals: null, bonds: null, flaws: null,
    ruleset: 'dnd5e_2014', race_key: 'dwarf', subrace_key: 'hill_dwarf', class_key: 'fighter', subclass_key: null, background_key: 'acolyte',
    portrait_url: null, is_npc: false, conditions: ['poisoned'], exhaustion: 1, coin_gp: 25, coin_sp: 3,
    created_at: now, updated_at: now,
    ...over,
  }
}

export const cls = (key: string, level: number, initial: boolean, sub: string | null = null): DndCharacterClass => ({
  id: key, sheet_id: 's1', class_key: key, level, subclass_key: sub, is_initial: initial, hp_rolls: [], created_at: now, updated_at: now,
})

export const item = (key: string | null, name: string, equipped: boolean, weight = 1) => ({
  id: name, sheet_id: 's1', name, quantity: 1, weight, equipped, notes: '', catalog_entry_key: key, sort_order: 0, created_at: now, updated_at: now,
})

export const details = (): DndSheetDetails => ({
  skills: [
    { id: 'k1', sheet_id: 's1', skill_key: 'athletics', proficient: true, expertise: false },
    { id: 'k2', sheet_id: 's1', skill_key: 'perception', proficient: true, expertise: true },
  ],
  attacks: [
    { id: 'a1', sheet_id: 's1', name: 'Espada longa', attack_bonus: '', damage: '', damage_type: 'cortante', notes: '', catalog_entry_key: 'longsword', sort_order: 0, created_at: now, updated_at: now },
    { id: 'a2', sheet_id: 's1', name: 'Soco de pedra', attack_bonus: '+7', damage: '2d6', damage_type: '', notes: 'mágico', catalog_entry_key: null, sort_order: 1, created_at: now, updated_at: now },
  ],
  inventory: [item('chain_mail', 'Cota de malha', true, 27.5), item('shield', 'Escudo', true, 3), item('longsword', 'Espada longa', false, 1.5), item(null, 'Corda', false, 5)],
  spells: [
    { id: 'p1', sheet_id: 's1', name: 'Bola de Fogo', spell_level: 3, school: '', casting_time: '', spell_range: '', duration: '', concentration: false, ritual: false, prepared: true, description: 'Explode.', sort_order: 0, created_at: now, updated_at: now },
    { id: 'p2', sheet_id: 's1', name: 'Prestidigitação', spell_level: 0, school: '', casting_time: '', spell_range: '', duration: '', concentration: false, ritual: false, prepared: false, description: '', sort_order: 1, created_at: now, updated_at: now },
  ],
  overrides: [{ id: 'o1', sheet_id: 's1', field_key: 'initiative_bonus', manual_value: '4', reason: '', updated_at: now }],
})

export const resource = (key: string, label: string, cur: number, max: number, recharge: DndCharacterResource['recharge'], source: DndCharacterResource['source']): DndCharacterResource => ({
  id: key, sheet_id: 's1', key, label, current_value: cur, max_value: max, recharge, source, sort_order: 0, created_at: now, updated_at: now,
})

export const feature = (key: string | null, source: DndCharacterFeature['source'], name: string, uses: number | null): DndCharacterFeature => ({
  id: name, sheet_id: 's1', source, feature_key: key, name, level: 1, notes: 'minha nota', uses_current: uses, uses_max: uses, recharge: uses ? 'short' : null, sort_order: 0, created_at: now, updated_at: now,
})

export function makeData(over: Partial<DndSheetData> = {}): DndSheetData {
  const noop = () => {}
  return {
    loading: false, error: null, degraded: false,
    classes: [cls('fighter', 3, true, 'champion'), cls('wizard', 2, false)],
    details: details(),
    proficiencies: [{ id: 'x1', sheet_id: 's1', category: 'tool', entry_key: 'ferramentas_de_ladrao', label: 'Ferramentas de ladrão', source: 'manual', created_at: now }],
    resources: [
      resource('spell_slot_1', '1º nível', 2, 3, 'long', 'spell_slots'),
      resource('rage', 'Fúria', 1, 2, 'long', 'manual'),
    ],
    features: [feature('fighter__second_wind', 'class', 'Retomar o Fôlego', 1), feature(null, 'manual', 'Cicatriz de guerra', null)],
    hpMode: 'rolled',
    setClasses: noop, setDetails: noop, setProficiencies: noop, setResources: noop, setFeatures: noop,
    reload: async () => {},
    ...over,
  }
}

export function makeCtx(opts: { sheet?: DndCharacterSheet; data?: DndSheetData; readOnly?: boolean } = {}): SheetCtx {
  const sheet = opts.sheet ?? makeSheet()
  const data = opts.data ?? makeData()
  const form = formFromSheet(sheet)
  const { derived, gear, prof } = deriveSheet({ sheet, classes: data.classes, details: data.details, proficiencies: data.proficiencies })
  return {
    sheet, form, set: () => {}, update: () => {}, data, derived, gear, prof,
    readOnly: opts.readOnly ?? false, campaignId: 'c1', report: () => {},
  }
}

