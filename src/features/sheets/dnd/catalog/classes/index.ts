import type { ClassDef, SubclassDef } from '../types'
import { barbarian } from './barbarian'
import { bard } from './bard'
import { cleric } from './cleric'
import { druid } from './druid'
import { fighter } from './fighter'
import { monk } from './monk'
import { paladin } from './paladin'
import { ranger } from './ranger'
import { rogue } from './rogue'
import { sorcerer } from './sorcerer'
import { warlock } from './warlock'
import { wizard } from './wizard'
import { PHB_BARBARIAN, PHB_BARD, PHB_CLERIC } from './phbSubclassesA'
import { PHB_DRUID, PHB_FIGHTER, PHB_MONK, PHB_PALADIN, PHB_RANGER } from './phbSubclassesB'
import { PHB_ROGUE, PHB_SORCERER, PHB_WARLOCK, PHB_WIZARD } from './phbSubclassesC'

const SRD_CLASSES: ClassDef[] = [barbarian, bard, cleric, druid, fighter, monk, paladin, ranger, rogue, sorcerer, warlock, wizard]

/** Subclasses do Livro do Jogador (fora do SRD), por classe. */
const PHB_SUBCLASSES: Record<string, SubclassDef[]> = {
  barbarian: PHB_BARBARIAN, bard: PHB_BARD, cleric: PHB_CLERIC, druid: PHB_DRUID, fighter: PHB_FIGHTER, monk: PHB_MONK,
  paladin: PHB_PALADIN, ranger: PHB_RANGER, rogue: PHB_ROGUE, sorcerer: PHB_SORCERER, warlock: PHB_WARLOCK, wizard: PHB_WIZARD,
}

/**
 * As 12 classes do SRD 5.1, em ordem alfabética do nome em inglês (como no livro). A subclasse do SRD vem primeiro
 * (`source: 'srd51'`), seguida das do Livro do Jogador (`source: 'phb'`, com resumos em palavras nossas).
 */
export const CLASSES: ClassDef[] = SRD_CLASSES.map((c) => ({
  ...c,
  subclasses: [...c.subclasses.map((s) => ({ ...s, source: 'srd51' as const })), ...(PHB_SUBCLASSES[c.key] ?? [])],
}))
