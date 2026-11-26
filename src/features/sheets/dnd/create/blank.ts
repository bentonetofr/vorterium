import type { DndCharacterSheet } from '../../../../shared/types'
import type { DndSheetData } from '../hooks/useDndSheetData'

// ────────────────────────────────────────────────────────
// A janela de "como montar a ficha" só aparece numa ficha ainda em branco e que nunca passou por ela: sem nome, raça,
// antecedente, classes, perícias, itens, magias, experiência e com os seis atributos no valor inicial (10). Quem já preencheu
// qualquer coisa não vê nada. A escolha fica gravada em `choices.creation` ('manual', 'quick' ou 'narrative').
// ────────────────────────────────────────────────────────

export type CreationKind = 'manual' | 'quick' | 'narrative'

export function creationOf(sheet: DndCharacterSheet): CreationKind | null {
  const v = (sheet.choices as Record<string, unknown> | null | undefined)?.creation
  return v === 'manual' || v === 'quick' || v === 'narrative' ? v : null
}

export function isBlankSheet(sheet: DndCharacterSheet, data: Pick<DndSheetData, 'classes' | 'details' | 'proficiencies' | 'features'>): boolean {
  if (creationOf(sheet)) return false
  const empty = (s: string | null | undefined) => !s || !s.trim()
  return empty(sheet.character_name) && empty(sheet.race) && empty(sheet.background) && !sheet.race_key && !sheet.background_key
    && sheet.experience === 0 && sheet.strength === 10 && sheet.dexterity === 10 && sheet.constitution === 10 && sheet.intelligence === 10 && sheet.wisdom === 10 && sheet.charisma === 10
    && data.classes.length === 0 && data.details.skills.length === 0 && data.details.inventory.length === 0 && data.details.spells.length === 0
    && data.details.attacks.length === 0 && data.proficiencies.length === 0 && data.features.length === 0
}
