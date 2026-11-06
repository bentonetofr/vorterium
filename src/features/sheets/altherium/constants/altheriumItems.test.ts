import { describe, expect, it } from 'vitest'
import type { AltheriumInventoryItem } from '../../../../shared/types'
import { categoryReinforcementSlots, readWeaponProperties } from './altheriumItems'
import { combatWeapons, hasProperty } from '../utils/altheriumCombat'
import { gearInfo } from '../components/AltheriumCraftPanel'

const custom = (extra: Partial<AltheriumInventoryItem>): AltheriumInventoryItem => ({
  id: 'x', sheet_id: 's', item_type: 'arma', item_id: 'custom:1', quantity: 1, equipped: false, equipped_zone: null,
  custom_name: 'Lâmina do Eclipse', custom_detail: null, custom_db: null, custom_damage_dice: '1d10',
  custom_damage_type: 'corte', custom_attribute: 'furia', custom_range: 'toque', created_at: '', ...extra,
})

describe('propriedades de arma personalizada', () => {
  it('lê o que veio do banco e ignora o que não vale', () => {
    expect(readWeaponProperties(null)).toEqual([])
    expect(readWeaponProperties('x')).toEqual([])
    expect(readWeaponProperties([
      { id: 'serrilhada' },
      { id: 'perfurante', value: 2 },
      { id: 'perfurante', value: 3 },
      { id: 'inventada' },
      { id: 'recarga', action: 'Ação Bônus' },
      null,
    ])).toEqual([{ id: 'serrilhada' }, { id: 'perfurante', value: 2 }, { id: 'recarga', action: 'Ação Bônus' }])
  })

  it('Perfurante sem valor válido vira 1', () => {
    expect(readWeaponProperties([{ id: 'perfurante', value: 99 }])).toEqual([{ id: 'perfurante', value: 1 }])
  })

  it('só a categoria pesada tem 2 espaços de Reforço', () => {
    expect(categoryReinforcementSlots('pesada')).toBe(2)
    expect(['leve', 'arremesso', 'alcance', null].map((c) => categoryReinforcementSlots(c as never))).toEqual([1, 1, 1, 1])
  })

  it('o combate usa categoria e propriedades da arma personalizada', () => {
    const [w] = combatWeapons([custom({ custom_category: 'pesada', custom_properties: [{ id: 'duas_maos' }, { id: 'perfurante', value: 2 }] })])
    expect(w.category).toBe('pesada')
    expect(hasProperty(w, 'duas_maos')).toBe(true)
    expect(hasProperty(w, 'haste')).toBe(false)
  })

  it('o Ofício usa reparo, espaços e desgaste da arma personalizada', () => {
    const g = gearInfo(custom({ custom_category: 'pesada', custom_repair: 'osso', custom_properties: [{ id: 'fragil' }] }))
    expect(g).toMatchObject({ repair: 'osso', slots: 2, heavy: true, fragil: true, robusta: false })
  })

  it('arma personalizada antiga (sem os campos novos) continua igual', () => {
    const g = gearInfo(custom({}))
    expect(g).toMatchObject({ repair: 'ferro_velho', slots: 1, heavy: false })
  })
})
