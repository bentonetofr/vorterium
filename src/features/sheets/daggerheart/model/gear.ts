import { weaponEntry } from '../catalog/weapons'
import type { DhArmorEntry, DhArmorSlot, DhWeaponEntry, DhWeaponSlot } from './types'

// ────────────────────────────────────────────────────────
// Do catálogo para a ficha: a arma e a armadura equipadas guardam uma cópia dos números (o nome e a característica já
// em português), com a chave do catálogo para os bônus que o motor calcula sozinho.
// ────────────────────────────────────────────────────────

export function weaponToSlot(e: DhWeaponEntry): DhWeaponSlot {
  return {
    catalogId: e.id,
    name: e.name,
    trait: e.trait,
    range: e.range,
    dice: e.dice,
    damageType: e.damageType,
    hands: e.hands,
    feature: e.featureName ? `${e.featureName}: ${e.feature ?? ''}` : '',
    attackBonus: 0,
  }
}

export function armorToSlot(e: DhArmorEntry): DhArmorSlot {
  return {
    catalogId: e.id,
    name: e.name,
    major: e.major,
    severe: e.severe,
    score: e.score,
    feature: e.featureName ? `${e.featureName}: ${e.feature ?? ''}` : '',
    mods: e.mods ?? {},
  }
}

/** Mãos ocupadas pelas armas equipadas (cada personagem tem duas). Guerreiros ignoram o peso (Treinamento de Combate). */
export function handsUsed(primary: DhWeaponSlot | null, secondary: DhWeaponSlot | null): number {
  return (primary?.hands ?? 0) + (secondary?.hands ?? 0)
}

/** A arma equipada ainda existe no catálogo? (armas inventadas têm catalogId nulo.) */
export function isCatalogWeapon(w: DhWeaponSlot | null): boolean {
  return !!w?.catalogId && !!weaponEntry(w.catalogId)
}
