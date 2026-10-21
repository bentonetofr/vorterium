import type { DndCharacterSheet } from '../../../../shared/types'
import type { DndSheetData } from '../hooks/useDndSheetData'
import type { DndForm } from '../model/sheetForm'
import type { EquippedGear, ProficiencySets } from '../model/sheetModel'
import type { Derived } from '../rules/types'

/** Tudo que as abas da ficha precisam: o formulário, os dados do banco e o resultado do motor de regras. */
export interface SheetCtx {
  /** Última linha salva da ficha. */
  sheet:      DndCharacterSheet
  form:       DndForm
  set:        <K extends keyof DndForm>(key: K, value: DndForm[K]) => void
  update:     (fn: (prev: DndForm) => DndForm) => void
  data:       DndSheetData
  derived:    Derived
  gear:       EquippedGear
  prof:       ProficiencySets
  /** NPC aberto por um jogador, ou falta de permissão: mostra tudo e não salva nada. */
  readOnly:   boolean
  campaignId: string
  /** Mostra um aviso passageiro (erro de uma ação que salva na hora). */
  report:     (message: string | null) => void
}
