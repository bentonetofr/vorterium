import type { SpellEntry, SpellSchool } from './types'

// Rótulos e busca das magias, sem os dados: a ficha importa este arquivo à vontade
// e só carrega o catálogo (catalog/spells) quando abre a aba Magias.

export const SPELL_SCHOOL_LABEL: Record<SpellSchool, string> = {
  abjuration: 'Abjuração', conjuration: 'Conjuração', divination: 'Adivinhação', enchantment: 'Encantamento',
  evocation: 'Evocação', illusion: 'Ilusão', necromancy: 'Necromancia', transmutation: 'Transmutação',
}

export const SPELL_SCHOOLS = Object.keys(SPELL_SCHOOL_LABEL) as SpellSchool[]

/** "Truque" ou "3º nível". */
export function spellLevelLabel(level: number): string {
  return level === 0 ? 'Truque' : `${level}º nível`
}

/** Texto das componentes como no livro: "V, S, M (pó de ouro...)". */
export function spellComponentsLabel(c: SpellEntry['components']): string {
  const parts = [c.v ? 'V' : '', c.s ? 'S' : '', c.m ? `M (${c.m})` : ''].filter(Boolean)
  return parts.join(', ')
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export interface SpellFilter {
  /** Trecho do nome (português ou original), sem acento. */
  text?:          string
  level?:         number
  school?:        SpellSchool
  /** Só as magias da lista dessa classe. */
  classKey?:      string
  ritual?:        boolean
  concentration?: boolean
}

/** Magias do catálogo que passam no filtro, em ordem de nível e nome. */
export function searchSpells(filter: SpellFilter, source: readonly SpellEntry[]): SpellEntry[] {
  const q = filter.text ? fold(filter.text.trim()) : ''
  return source
    .filter((s) => {
      if (filter.level != null && s.level !== filter.level) return false
      if (filter.school && s.school !== filter.school) return false
      if (filter.classKey && !s.classes.includes(filter.classKey)) return false
      if (filter.ritual && !s.ritual) return false
      if (filter.concentration && !s.concentration) return false
      return !q || fold(s.name).includes(q) || fold(s.original).includes(q)
    })
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'pt-BR'))
}
