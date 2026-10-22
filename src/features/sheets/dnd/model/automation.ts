import type { DndDerivedField } from '../../../../shared/types'
import { ABILITIES, SKILLS } from '../rules/abilities'
import type { Derived } from '../rules/types'

// ────────────────────────────────────────────────────────
// Botão "Automatizar": a lista do que a ficha calcula sozinha e que a pessoa
// pode trocar por modo manual. Cada item é um conjunto de campos calculados
// (um só, ou os 6 modificadores, as 18 perícias...) que ficam em modo manual
// quando têm valor digitado (dnd_character_overrides), ou um comportamento
// automático da ficha (espaços de magia e recursos de classe), guardado em
// `choices.manualModes`. Na ficha não aparece selo nenhum: o valor é só
// editável quando o item está manual.
// ────────────────────────────────────────────────────────

/** Comportamentos automáticos da ficha que podem ser desligados. */
export type ManualMode = 'spell_slots' | 'class_resources'
export const MANUAL_MODES: readonly ManualMode[] = ['spell_slots', 'class_resources']

export function isManualMode(value: unknown): value is ManualMode {
  return typeof value === 'string' && (MANUAL_MODES as readonly string[]).includes(value)
}

export type AutomationGroup = 'Valores do personagem' | 'Atributos e perícias' | 'Recursos'

export interface AutomationItem {
  id:          string
  group:       AutomationGroup
  title:       string
  description: string
  /** Campos calculados que viram manuais (itens de números). */
  fields?:     readonly DndDerivedField[]
  /** Comportamento automático que desliga (itens de recursos). */
  mode?:       ManualMode
}

const abilityFields = <P extends 'mod' | 'save'>(prefix: P) => ABILITIES.map((a) => `${prefix}_${a.key}` as DndDerivedField)

export const AUTOMATION_ITEMS: readonly AutomationItem[] = [
  { id: 'proficiency', group: 'Valores do personagem', title: 'Bônus de proficiência', description: 'Sobe com o nível total do personagem (+2 no 1º, +6 no 17º).', fields: ['proficiency_bonus'] },
  { id: 'armor_class', group: 'Valores do personagem', title: 'Classe de Armadura (CA)', description: 'Armadura e escudo vestidos, Destreza, bônus de CA e as defesas sem armadura de Bárbaro e Monge.', fields: ['armor_class'] },
  { id: 'initiative', group: 'Valores do personagem', title: 'Iniciativa', description: 'Modificador de Destreza (mais o Pau para Toda Obra do Bardo).', fields: ['initiative_bonus'] },
  { id: 'speed', group: 'Valores do personagem', title: 'Deslocamento', description: 'Da raça, com o que muda por classe e armadura (Movimento Rápido, Movimento sem Armadura).', fields: ['speed'] },
  { id: 'hp_max', group: 'Valores do personagem', title: 'Pontos de Vida máximos', description: 'Dado de vida da classe a cada nível, Constituição e o bônus da sub-raça.', fields: ['hp_max'] },
  { id: 'carry', group: 'Valores do personagem', title: 'Capacidade de carga', description: 'Força × 7,5 kg.', fields: ['carry_capacity'] },
  { id: 'spell_dc', group: 'Valores do personagem', title: 'CD das magias', description: '8 + proficiência + modificador do atributo de conjuração.', fields: ['spell_save_dc'] },
  { id: 'spell_attack', group: 'Valores do personagem', title: 'Ataque de magia', description: 'Proficiência + modificador do atributo de conjuração.', fields: ['spell_attack_bonus'] },

  { id: 'ability_mods', group: 'Atributos e perícias', title: 'Modificadores de atributo', description: 'Os seis modificadores, calculados do valor de cada atributo ((valor − 10) ÷ 2, para baixo).', fields: abilityFields('mod') },
  { id: 'saves', group: 'Atributos e perícias', title: 'Salvaguardas', description: 'Modificador do atributo mais a proficiência, quando a classe dá.', fields: abilityFields('save') },
  { id: 'skills', group: 'Atributos e perícias', title: 'Perícias', description: 'As 18 perícias: modificador do atributo, proficiência e especialização.', fields: SKILLS.map((s) => `skill_${s.key}` as DndDerivedField) },
  { id: 'passives', group: 'Atributos e perícias', title: 'Percepções passivas', description: '10 + o bônus de Percepção, Intuição e Investigação.', fields: ['passive_perception', 'passive_insight', 'passive_investigation'] },

  { id: 'spell_slots', group: 'Recursos', title: 'Espaços de magia', description: 'O total de cada nível vem da classe e do nível (e da multiclasse). Manual: você escreve o total de cada nível.', mode: 'spell_slots' },
  { id: 'class_resources', group: 'Recursos', title: 'Recursos de classe e raça', description: 'Fúria, Ki, Surto de Ação, Inspiração de Bardo e outros: criados sozinhos, com total e recarga pelo livro. Manual: você mexe no total e na recarga.', mode: 'class_resources' },
]

export const AUTOMATION_GROUPS: readonly AutomationGroup[] = ['Valores do personagem', 'Atributos e perícias', 'Recursos']

/** O item está manual? Números: algum campo dele tem valor digitado. Recursos: o comportamento está desligado. */
export function isItemManual(item: AutomationItem, overrideKeys: ReadonlySet<string>, manualModes: readonly string[]): boolean {
  if (item.mode) return manualModes.includes(item.mode)
  return (item.fields ?? []).some((f) => overrideKeys.has(f))
}

/** O valor que o motor calcula agora para um campo (é o ponto de partida ao passar para manual). */
export function computedValue(field: DndDerivedField, derived: Derived, hpMaxFallback: number): number {
  switch (field) {
    case 'proficiency_bonus':    return derived.proficiencyBonus
    case 'initiative_bonus':     return derived.initiative
    case 'armor_class':          return derived.armorClass
    case 'speed':                return derived.speed
    case 'hp_max':               return derived.hpMax ?? hpMaxFallback
    case 'spell_save_dc':        return derived.spellStats?.saveDc ?? 0
    case 'spell_attack_bonus':   return derived.spellStats?.attackBonus ?? 0
    case 'carry_capacity':       return derived.carryCapacity
    case 'passive_perception':   return derived.passives.perception
    case 'passive_insight':      return derived.passives.insight
    case 'passive_investigation': return derived.passives.investigation
    default: {
      const [kind, ...rest] = field.split('_')
      const key = rest.join('_')
      if (kind === 'mod') return derived.abilityMods[key as keyof Derived['abilityMods']]
      if (kind === 'save') return derived.saves[key as keyof Derived['saves']].bonus
      return derived.skills[key as keyof Derived['skills']].bonus
    }
  }
}

/** Os campos de um item com o valor de hoje, para gravar como manuais. */
export function manualSeed(item: AutomationItem, derived: Derived, hpMaxFallback: number): { field: DndDerivedField; value: number }[] {
  return (item.fields ?? []).map((field) => ({ field, value: computedValue(field, derived, hpMaxFallback) }))
}
