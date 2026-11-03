import type { CharacterSheet } from '../../../shared/types'
import { buildSheetText, kv, prose, ratio } from '../export/sheetText'

const ATTRIBUTES: [keyof CharacterSheet, string][] = [
  ['strength', 'Força'], ['dexterity', 'Destreza'], ['constitution', 'Constituição'],
  ['intelligence', 'Inteligência'], ['wisdom', 'Sabedoria'], ['charisma', 'Carisma'],
]

export function simpleSheetText(s: CharacterSheet): string {
  return buildSheetText(`${s.character_name || 'Personagem'} - Ficha Simples`, [
    { title: 'Identidade', lines: [kv('Nome', s.character_name), kv('Arquétipo', s.archetype), kv('Nível', s.level)] },
    { title: 'Pontos de vida', lines: [kv('PV', ratio(s.hp_current, s.hp_max))] },
    { title: 'Atributos', lines: ATTRIBUTES.map(([key, label]) => kv(label, s[key] as number)) },
    { title: 'Anotações', lines: [prose(s.notes)] },
  ])
}
