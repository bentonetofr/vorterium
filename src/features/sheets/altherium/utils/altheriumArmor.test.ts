import { describe, expect, it } from 'vitest'
import type { AltheriumInventoryItem } from '../../../../shared/types'
import {
  planArmorWear,
  planEquipPiece,
  planRepairPiece,
  planTrimWorn,
  planUnequipPiece,
  readWorn,
  unwornCount,
  zoneDbTotals,
  zoneDefense,
  type InventoryPatch,
} from './altheriumArmor'

const armor = (id: string, item_id: string, over: Partial<AltheriumInventoryItem> = {}): AltheriumInventoryItem => ({
  id, sheet_id: 's', item_type: 'armadura', item_id, quantity: 1, equipped: false, equipped_zone: null,
  custom_name: null, custom_detail: null, custom_db: null, custom_damage_dice: null,
  custom_damage_type: null, custom_attribute: null, custom_range: null, created_at: '',
  integrity: 100, worn: [], ...over,
})
const shield = (id: string, item_id: string, over: Partial<AltheriumInventoryItem> = {}) => armor(id, item_id, { item_type: 'escudo', ...over })

/** Aplica os patches numa cópia do inventário (o que o banco faria). */
function apply(inv: AltheriumInventoryItem[], plan: { id: string; patch: InventoryPatch }[]): AltheriumInventoryItem[] {
  return inv.map((i) => {
    const p = plan.find((x) => x.id === i.id)
    return p ? ({ ...i, ...p.patch } as AltheriumInventoryItem) : i
  })
}

describe('armadura por parte do corpo', () => {
  it('o DB de cada parte soma a peça vestida ali, o escudo e o bônus', () => {
    const inv = [
      armor('a', 'cota_malha_norte', { worn: [{ zone: 'db_tronco', integrity: 100 }], equipped: true }),
      armor('b', 'tunica_couro_runico', { worn: [{ zone: 'db_cabeca', integrity: 100 }], equipped: true }),
      shield('s1', 'escudo_leve', { equipped: true }),
    ]
    expect(zoneDbTotals(inv, { db_cabeca: 1, db_bracos: 0, db_tronco: 0, db_pernas: 0 })).toEqual({
      db_cabeca: 4 + 2 + 1, db_bracos: 2, db_tronco: 8 + 2, db_pernas: 2,
    })
  })

  it('cada peça perde DB pela própria Integridade', () => {
    const inv = [
      armor('a', 'cota_malha_norte', { quantity: 2, equipped: true, worn: [{ zone: 'db_tronco', integrity: 40 }, { zone: 'db_pernas', integrity: 100 }] }),
    ]
    expect(zoneDefense(inv, 'db_tronco', 0).total).toBe(6)   // 50–31%: −2
    expect(zoneDefense(inv, 'db_pernas', 0).total).toBe(8)
  })

  it('banco antigo (sem worn): a armadura equipada numa zona vira uma peça', () => {
    const legacy = armor('a', 'cota_malha_norte', { equipped: true, equipped_zone: 'db_bracos', integrity: 70, worn: undefined })
    expect(readWorn(legacy)).toEqual([{ zone: 'db_bracos', integrity: 70 }])
    expect(zoneDefense([legacy], 'db_bracos', 0).total).toBe(8)
  })

  it('o dano que não passa do DB desgasta só a peça da parte atingida', () => {
    const inv = [
      armor('a', 'cota_malha_norte', { quantity: 2, equipped: true, worn: [{ zone: 'db_tronco', integrity: 100 }, { zone: 'db_bracos', integrity: 100 }] }),
    ]
    const wear = planArmorWear(inv, 'db_tronco')!
    const next = apply(inv, [wear])
    expect(readWorn(next[0])).toEqual([{ zone: 'db_tronco', integrity: 90 }, { zone: 'db_bracos', integrity: 100 }])
    expect(planArmorWear(inv, 'db_pernas')).toBeNull()
  })

  it('vestir: uma parte, uma peça; quem estava lá volta pra mochila', () => {
    let inv = [armor('a', 'cota_malha_norte'), armor('b', 'tunica_couro_runico')]
    inv = apply(inv, planEquipPiece(inv, inv[0], 'db_tronco') as never)
    expect(readWorn(inv[0])).toEqual([{ zone: 'db_tronco', integrity: 100 }])
    expect(inv[0].equipped).toBe(true)

    inv = apply(inv, planEquipPiece(inv, inv[1], 'db_tronco') as never)
    expect(readWorn(inv[0])).toEqual([])
    expect(inv[0].equipped).toBe(false)
    expect(readWorn(inv[1])).toEqual([{ zone: 'db_tronco', integrity: 100 }])
  })

  it('vestir só vai até a quantidade; mudar de parte com 1 peça só troca', () => {
    let inv = [armor('a', 'cota_malha_norte', { integrity: 100 })]
    inv = apply(inv, planEquipPiece(inv, inv[0], 'db_tronco') as never)
    expect(typeof planEquipPiece(inv, inv[0], 'db_bracos')).not.toBe('string')   // troca de parte
    const moved = apply(inv, planEquipPiece(inv, inv[0], 'db_bracos') as never)
    expect(readWorn(moved[0])).toEqual([{ zone: 'db_bracos', integrity: 100 }])

    const two = [armor('a', 'cota_malha_norte', { quantity: 2 })]
    let full = apply(two, planEquipPiece(two, two[0], 'db_tronco') as never)
    full = apply(full, planEquipPiece(full, full[0], 'db_bracos') as never)
    expect(readWorn(full[0]).map((p) => p.zone)).toEqual(['db_tronco', 'db_bracos'])
    expect(unwornCount(full[0])).toBe(0)
    expect(typeof planEquipPiece(full, full[0], 'db_pernas')).toBe('string')   // parte livre, mas não sobrou peça
  })

  it('tirar devolve a peça com a Integridade que ela tinha', () => {
    const inv = [armor('a', 'cota_malha_norte', { equipped: true, worn: [{ zone: 'db_tronco', integrity: 35 }], integrity: 100 })]
    const next = apply(inv, planUnequipPiece(inv[0], 'db_tronco'))
    expect(next[0].equipped).toBe(false)
    expect(next[0].integrity).toBe(35)
    expect(readWorn(next[0])).toEqual([])
  })

  it('tirar uma peça gasta de um monte guarda a menor Integridade', () => {
    const inv = [armor('a', 'cota_malha_norte', { quantity: 2, integrity: 100, equipped: true, worn: [{ zone: 'db_tronco', integrity: 35 }] })]
    const next = apply(inv, planUnequipPiece(inv[0], 'db_tronco'))
    expect(next[0].integrity).toBe(35)
  })

  it('reduzir a quantidade tira do corpo o que passar', () => {
    const inv = armor('a', 'cota_malha_norte', { quantity: 2, equipped: true, worn: [{ zone: 'db_tronco', integrity: 100 }, { zone: 'db_bracos', integrity: 80 }] })
    expect(planTrimWorn(inv, 2)).toBeNull()
    expect(planTrimWorn(inv, 1)).toMatchObject({ worn: [{ zone: 'db_tronco', integrity: 100 }], equipped: true, equipped_zone: 'db_tronco' })
    expect(planTrimWorn(inv, 0)).toMatchObject({ worn: [], equipped: false, equipped_zone: null })
  })

  it('reparo mexe só na peça daquela parte', () => {
    const inv = armor('a', 'cota_malha_norte', { quantity: 2, equipped: true, worn: [{ zone: 'db_tronco', integrity: 20 }, { zone: 'db_bracos', integrity: 50 }] })
    expect(planRepairPiece(inv, 'db_tronco', 75).worn).toEqual([{ zone: 'db_tronco', integrity: 75 }, { zone: 'db_bracos', integrity: 50 }])
  })
})
