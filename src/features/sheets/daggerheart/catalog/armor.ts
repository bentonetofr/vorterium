// ────────────────────────────────────────────────────────
// Catálogo de armaduras DaggerHeart — Tier 1 (SRD 2.0).
// base_major e base_severe são os valores DA ARMADURA;
// o limiar real = base + nível (calculado em derive.ts).
// ────────────────────────────────────────────────────────

export interface DhArmorData {
  key:          string
  name_pt:      string
  tier:         1 | 2 | 3
  score:        number  // slots de Armor Score
  base_major:   number
  base_severe:  number
}

export const DH_ARMOR_TIER1: DhArmorData[] = [
  {
    key:         'unarmored',
    name_pt:     'Sem Armadura',
    tier:        1,
    score:       0,
    base_major:  3,
    base_severe: 7,
  },
  {
    key:         'leather',
    name_pt:     'Couro',
    tier:        1,
    score:       2,
    base_major:  5,
    base_severe: 11,
  },
  {
    key:         'chainmail',
    name_pt:     'Cota de Malha',
    tier:        1,
    score:       3,
    base_major:  7,
    base_severe: 14,
  },
  {
    key:         'plate',
    name_pt:     'Placa',
    tier:        1,
    score:       4,
    base_major:  10,
    base_severe: 18,
  },
]

export const DH_ALL_ARMOR: DhArmorData[] = [...DH_ARMOR_TIER1]

export function getDhArmor(key: string): DhArmorData | undefined {
  return DH_ALL_ARMOR.find((a) => a.key === key)
}
