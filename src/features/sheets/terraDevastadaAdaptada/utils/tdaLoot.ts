import type { TdaInventoryItem, TdaSupplies } from '../../../../shared/types'
import type { TestOutcome } from './tdaRules'
import {
  MATERIAL_CAP,
  SUPPLEMENT_MAX,
  SUPPLY_LIST,
  UNIT,
  ammoCap,
  kitCap,
  weaponType,
  type SupplyKey,
} from './tdaSupplies'

// ────────────────────────────────────────────────────────
// Revistar: quantos achados o teste rende, o que cada um é (tabela de d6) e
// como entra na ficha. Tudo puro; o sorteio recebe o dado como argumento.
//
//   Achados   falha 0 · parcial 1 · sucesso 2, +1 a cada 2 pares além da meta
//             + 1 (no máximo 4).
//   Tabela    d6 (+1 em lugar Rico, −1 em Escasso, de 1 a 6):
//             1 nada · 2 trapos · 3 álcool · 4 lâminas ou explosivos ·
//             5 sucata ou munição · 6 raro (peça, kit médico ou suplemento).
//   Pedaços   trapos, álcool, lâminas e explosivos vêm em 25%, 50%, 75% ou
//             100%; sucata, peça, kit e suplemento vêm inteiros.
// ────────────────────────────────────────────────────────

export type Richness = 'escasso' | 'comum' | 'rico'

export const RICHNESS: { id: Richness; label: string; shift: number; hint: string }[] = [
  { id: 'escasso', label: 'Escasso', shift: -1, hint: 'Já foi saqueado: a tabela piora.' },
  { id: 'comum',   label: 'Comum',   shift: 0,  hint: 'Um lugar qualquer.' },
  { id: 'rico',    label: 'Rico',    shift: 1,  hint: 'Intacto ou escondido: a tabela melhora.' },
]

export type PieceKey = 'trapos' | 'alcool' | 'laminas' | 'explosivos'
export type WholeKey = 'sucata' | 'pecas'

export type LootFind =
  | { kind: 'nada' }
  | { kind: 'piece'; key: PieceKey; percent: number }
  | { kind: 'whole'; key: WholeKey }
  | { kind: 'ammo'; bullets: number }
  | { kind: 'kit' }
  | { kind: 'suplemento' }

export type Rng = () => number

/** d6 de verdade (crypto), pra não depender de Math.random. */
export const cryptoD6: Rng = () => {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return (a[0] % 6) + 1
}

export function findCount(outcome: TestOutcome, performance: number, meta: number): number {
  if (outcome === 'falha') return 0
  if (outcome === 'parcial') return 1
  return Math.min(4, 2 + Math.floor(Math.max(0, performance - (meta + 1)) / 2))
}

function piece(key: PieceKey, die: number): LootFind {
  return { kind: 'piece', key, percent: die <= 2 ? 25 : die <= 4 ? 50 : die === 5 ? 75 : 100 }
}

/** Um achado da tabela. `shift` vem da riqueza do lugar. */
export function rollLoot(shift: number, d6: Rng = cryptoD6): LootFind {
  const category = Math.max(1, Math.min(6, d6() + shift))
  const sub = d6()
  switch (category) {
    case 1: return { kind: 'nada' }
    case 2: return piece('trapos', sub)
    case 3: return piece('alcool', sub)
    case 4: return piece(d6() % 2 === 1 ? 'laminas' : 'explosivos', sub)
    case 5: return sub <= 3 ? { kind: 'whole', key: 'sucata' } : { kind: 'ammo', bullets: 1 + ((d6() - 1) >> 1) }
    default: return sub <= 3 ? { kind: 'whole', key: 'pecas' } : sub <= 5 ? { kind: 'kit' } : { kind: 'suplemento' }
  }
}

function label(key: SupplyKey): string {
  return (SUPPLY_LIST.find((s) => s.key === key)?.label ?? key).toLowerCase()
}

export function lootLabel(f: LootFind): string {
  switch (f.kind) {
    case 'nada':       return 'Nada de útil, só lixo'
    case 'piece':      return `${f.percent}% de ${label(f.key)}`
    case 'whole':      return f.key === 'pecas' ? '1 peça de arma' : '1 sucata'
    case 'ammo':       return f.bullets === 1 ? '1 bala' : `${f.bullets} balas`
    case 'kit':        return '1 kit médico'
    case 'suplemento': return '1 suplemento'
  }
}

export interface LootApplied {
  supplies:  TdaSupplies
  inventory: TdaInventoryItem[]
  text:      string
}

/** Guarda um achado na ficha, respeitando o que cabe. */
export function applyLoot(
  f: LootFind, supplies: TdaSupplies, inventory: TdaInventoryItem[], backpack: number, weaponId?: string,
): LootApplied | { error: string } {
  switch (f.kind) {
    case 'nada':
      return { supplies, inventory, text: 'Nada pra guardar' }

    case 'piece': {
      const room = MATERIAL_CAP - supplies[f.key]
      if (room <= 0) return { error: `Já está com 3 de ${label(f.key)}: não cabe mais.` }
      const added = Math.min(room, f.percent)
      return {
        supplies: { ...supplies, [f.key]: supplies[f.key] + added }, inventory,
        text: added < f.percent ? `+${added}% de ${label(f.key)} (o resto não coube)` : `+${added}% de ${label(f.key)}`,
      }
    }

    case 'whole': {
      if (MATERIAL_CAP - supplies[f.key] < UNIT) return { error: `Já está com 3 de ${label(f.key)}: não cabe mais.` }
      return { supplies: { ...supplies, [f.key]: supplies[f.key] + UNIT }, inventory, text: `+1 ${f.key === 'pecas' ? 'peça' : 'sucata'}` }
    }

    case 'kit': {
      if (supplies.kits >= kitCap(backpack)) return { error: `Só cabem ${kitCap(backpack)} kits na mochila.` }
      return { supplies: { ...supplies, kits: supplies.kits + 1 }, inventory, text: '+1 kit médico' }
    }

    case 'suplemento': {
      if (supplies.suplementos >= SUPPLEMENT_MAX) return { error: 'Não cabem mais suplementos.' }
      return { supplies: { ...supplies, suplementos: supplies.suplementos + 1 }, inventory, text: '+1 suplemento' }
    }

    case 'ammo': {
      const gun = inventory.find((i) => i.id === weaponId && i.kind === 'arma' && weaponType(i) === 'fogo')
      if (!gun) return { error: 'Sem arma de fogo pra essa munição.' }
      const room = ammoCap(gun, backpack) - (gun.ammo ?? 0)
      if (room <= 0) return { error: `${gun.name.trim()} já está com a munição cheia.` }
      const added = Math.min(room, f.bullets)
      return {
        supplies,
        inventory: inventory.map((i) => (i.id === gun.id ? { ...i, ammo: (i.ammo ?? 0) + added } : i)),
        text: `+${added} ${added === 1 ? 'bala' : 'balas'} em ${gun.name.trim()}${added < f.bullets ? ' (o resto não coube)' : ''}`,
      }
    }
  }
}
