import type { VtmSheet } from '../../../../shared/types'

// O formulário da ficha de Vampiro: a ficha sem os campos de sistema, com
// os textos sempre como string (vazio = null ao salvar). As abas recebem o
// formulário inteiro e um `update` que recebe a versão anterior.

export type VtmForm = Omit<VtmSheet, 'id' | 'campaign_id' | 'user_id' | 'created_at' | 'updated_at' | 'portrait_url'
  | 'is_npc' | 'npc_visible'
  | 'character_name' | 'concept' | 'chronicle' | 'sire' | 'ambition' | 'desire' | 'history' | 'notes' | 'clan' | 'predator_type'> & {
  character_name: string
  concept:        string
  chronicle:      string
  sire:           string
  ambition:       string
  desire:         string
  clan:           string
  predator_type:  string
  history:        string
  notes:          string
}

export type VtmUpdate = (fn: (prev: VtmForm) => VtmForm) => void
