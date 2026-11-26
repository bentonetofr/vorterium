import { armorEntry } from '../catalog/armor'
import { dhClass } from '../catalog/classes'
import { weaponEntry } from '../catalog/weapons'
import { emptySheet, newId } from './defaults'
import { armorToSlot, weaponToSlot } from './gear'
import type { DhClassKey, DhSheetData, DhTrait } from './types'
import { DH_TRAITS } from './types'

// ────────────────────────────────────────────────────────
// Ficha rápida: as respostas do formulário (uma pergunta por vez) viram uma ficha de nível 1, na ordem do livro.
// Quem entra em nível mais alto passa depois pelas subidas, uma por vez (DhQuickForm aplica cada uma).
// ────────────────────────────────────────────────────────

/** Os valores iniciais dos atributos, para distribuir em qualquer ordem. */
export const START_TRAITS = [2, 1, 1, 0, 0, -1]

export interface QuickAnswers {
  name: string
  pronouns: string
  level: number
  classKey: DhClassKey | null
  subclassKey: string | null
  ancestryKey: string | null
  ancestry2Key: string | null
  communityKey: string | null
  traits: Record<DhTrait, number>
  primaryId: string
  secondaryId: string
  /** Vazio = sem armadura. */
  armorId: string
  potion: number
  keepsake: number
  carry: string
  experiences: [string, string]
  cards: string[]
}

export function emptyAnswers(): QuickAnswers {
  return {
    name: '', pronouns: '', level: 1, classKey: null, subclassKey: null, ancestryKey: null, ancestry2Key: null, communityKey: null,
    traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    primaryId: '', secondaryId: '', armorId: '', potion: 0, keepsake: 0, carry: '', experiences: ['', ''], cards: [],
  }
}

/** Os seis atributos usam exatamente +2, +1, +1, 0, 0 e −1? */
export function traitsValid(traits: Record<DhTrait, number>): boolean {
  const mine = DH_TRAITS.map((t) => traits[t]).sort((a, b) => b - a).join()
  return mine === [...START_TRAITS].sort((a, b) => b - a).join()
}

/** As sugestões da classe (atributos, armas e armadura do guia do personagem) como respostas já preenchidas. */
export function suggestedFor(classKey: DhClassKey): Pick<QuickAnswers, 'traits' | 'primaryId' | 'secondaryId' | 'armorId' | 'potion' | 'keepsake' | 'carry'> {
  const c = dhClass(classKey)!
  return { traits: { ...c.suggested.traits }, primaryId: c.suggested.primary, secondaryId: c.suggested.secondary ?? '', armorId: c.suggested.armor, potion: 0, keepsake: 0, carry: '' }
}

/** A ficha de nível 1 com o que foi respondido. */
export function buildQuickSheet(a: QuickAnswers): DhSheetData {
  const cls = dhClass(a.classKey)
  const base = emptySheet(a.classKey)
  const pri = weaponEntry(a.primaryId)
  const sec = pri && pri.hands === 1 ? weaponEntry(a.secondaryId) : undefined
  const arm = armorEntry(a.armorId)
  const items = [...base.inventory]
  if (cls) {
    items.push(cls.itemChoices.potion[a.potion] ?? cls.itemChoices.potion[0], cls.itemChoices.keepsake[a.keepsake] ?? cls.itemChoices.keepsake[0])
    if (cls.itemChoices.carry && a.carry.trim()) items.push(`Guardo meus feitiços em: ${a.carry.trim()}`)
  }
  return {
    ...base,
    started: true,
    name: a.name.trim(),
    pronouns: a.pronouns.trim(),
    level: 1,
    subclassKey: a.subclassKey,
    ancestryKey: a.ancestryKey,
    ancestry2Key: a.ancestryKey ? a.ancestry2Key : null,
    communityKey: a.communityKey,
    traits: { ...a.traits },
    armor: arm ? armorToSlot(arm) : null,
    primary: pri ? weaponToSlot(pri) : null,
    secondary: sec ? weaponToSlot(sec) : null,
    inventory: items,
    experiences: a.experiences.filter((e) => e.trim()).map((e) => ({ id: newId(), name: e.trim(), mod: 2 })),
    loadout: [...a.cards],
    hope: 2,
  }
}
