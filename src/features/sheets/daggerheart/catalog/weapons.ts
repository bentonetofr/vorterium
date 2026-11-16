// ────────────────────────────────────────────────────────
// Catálogo de armas DaggerHeart — Tier 1 (SRD 2.0).
// damage_die = tipo de dado; damage_mod = modificador fixo.
// Dano final = [proficiency]d[damage_die]+[damage_mod].
// ────────────────────────────────────────────────────────

import type { DhTraitKey } from '../rules/types'

export interface DhWeaponData {
  key:         string
  name_pt:     string
  tier:        1 | 2 | 3
  trait_key:   DhTraitKey
  damage_die:  number
  damage_mod:  number
  hands:       '1h' | '2h'
}

export const DH_WEAPONS_TIER1: DhWeaponData[] = [
  { key: 'unarmed',      name_pt: 'Desarmado',       tier: 1, trait_key: 'strength', damage_die: 4, damage_mod: 0, hands: '1h' },
  { key: 'dagger',       name_pt: 'Adaga',            tier: 1, trait_key: 'finesse',  damage_die: 4, damage_mod: 2, hands: '1h' },
  { key: 'shortsword',   name_pt: 'Espada Curta',     tier: 1, trait_key: 'finesse',  damage_die: 6, damage_mod: 1, hands: '1h' },
  { key: 'handaxe',      name_pt: 'Machado de Mão',   tier: 1, trait_key: 'strength', damage_die: 8, damage_mod: 1, hands: '1h' },
  { key: 'mace',         name_pt: 'Maça',             tier: 1, trait_key: 'strength', damage_die: 6, damage_mod: 2, hands: '1h' },
  { key: 'longsword',    name_pt: 'Espada Longa',     tier: 1, trait_key: 'strength', damage_die: 8, damage_mod: 0, hands: '2h' },
  { key: 'greataxe',     name_pt: 'Machado Grande',   tier: 1, trait_key: 'strength', damage_die: 10,damage_mod: 0, hands: '2h' },
  { key: 'spear',        name_pt: 'Lança',            tier: 1, trait_key: 'strength', damage_die: 8, damage_mod: 0, hands: '2h' },
  { key: 'shortbow',     name_pt: 'Arco Curto',       tier: 1, trait_key: 'agility',  damage_die: 6, damage_mod: 0, hands: '2h' },
  { key: 'longbow',      name_pt: 'Arco Longo',       tier: 1, trait_key: 'agility',  damage_die: 8, damage_mod: 0, hands: '2h' },
  { key: 'crossbow',     name_pt: 'Besta',            tier: 1, trait_key: 'agility',  damage_die: 8, damage_mod: 1, hands: '2h' },
  { key: 'staff',        name_pt: 'Cajado',           tier: 1, trait_key: 'knowledge',damage_die: 6, damage_mod: 0, hands: '2h' },
  { key: 'quarterstaff', name_pt: 'Bordão',           tier: 1, trait_key: 'instinct', damage_die: 6, damage_mod: 1, hands: '2h' },
  { key: 'whip',         name_pt: 'Chicote',          tier: 1, trait_key: 'finesse',  damage_die: 4, damage_mod: 1, hands: '1h' },
  { key: 'grappler',     name_pt: 'Gancho',           tier: 1, trait_key: 'strength', damage_die: 4, damage_mod: 0, hands: '1h' },
]

export const DH_ALL_WEAPONS: DhWeaponData[] = [...DH_WEAPONS_TIER1]

export function getDhWeapon(key: string): DhWeaponData | undefined {
  return DH_ALL_WEAPONS.find((w) => w.key === key)
}
