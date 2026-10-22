import type { SpellEntry } from '../types'
import { searchSpells as searchIn, type SpellFilter } from '../spellUtils'
import { SPELLS_TRUQUES } from './truques'
import { SPELLS_NIVEL1 } from './nivel1'
import { SPELLS_NIVEL2 } from './nivel2'
import { SPELLS_NIVEL3 } from './nivel3'
import { SPELLS_NIVEL4 } from './nivel4'
import { SPELLS_NIVEL5 } from './nivel5'
import { SPELLS_NIVEL6 } from './nivel6'
import { SPELLS_NIVEL7 } from './nivel7'
import { SPELLS_NIVEL8 } from './nivel8'
import { SPELLS_NIVEL9 } from './nivel9'

// ────────────────────────────────────────────────────────
// Catálogo de magias do SRD 5.1 (319), traduzido para o português do Brasil.
// É grande (cerca de 400 KB), então a ficha o carrega sob demanda com
// `import('.../catalog/spells')` em vez de colocá-lo no pacote principal.
// ────────────────────────────────────────────────────────

export const SPELLS: readonly SpellEntry[] = [
  ...SPELLS_TRUQUES, ...SPELLS_NIVEL1, ...SPELLS_NIVEL2, ...SPELLS_NIVEL3, ...SPELLS_NIVEL4,
  ...SPELLS_NIVEL5, ...SPELLS_NIVEL6, ...SPELLS_NIVEL7, ...SPELLS_NIVEL8, ...SPELLS_NIVEL9,
]

const byKey = new Map(SPELLS.map((s) => [s.key, s]))

export function getSpell(key: string): SpellEntry | undefined {
  return byKey.get(key)
}

export { SPELL_SCHOOL_LABEL, SPELL_SCHOOLS, spellComponentsLabel, spellLevelLabel, type SpellFilter } from '../spellUtils'

/** Magias do catálogo que passam no filtro, em ordem de nível e nome. */
export function searchSpells(filter: SpellFilter = {}, source: readonly SpellEntry[] = SPELLS): SpellEntry[] {
  return searchIn(filter, source)
}
