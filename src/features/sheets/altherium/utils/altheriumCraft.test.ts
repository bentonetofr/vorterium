import { describe, expect, it } from 'vitest'
import {
  addResource,
  applyWear,
  armorDbWithIntegrity,
  buildRecipe,
  dismantleReturn,
  doubleDiceText,
  formatAmount,
  missing,
  repairPlan,
  resourceTotal,
  spend,
  weaponIntegrity,
  wearAmount,
} from './altheriumCraft'

describe('Ofício de Altherium', () => {
  it('frações somam e 100% é uma unidade, até 4 unidades', () => {
    let s = addResource({}, 'couro', 'comum', 25).stock
    s = addResource(s, 'couro', 'comum', 25).stock
    s = addResource(s, 'couro', 'raro', 50).stock
    expect(resourceTotal(s, 'couro')).toBe(100)
    expect(formatAmount(125)).toBe('1 unidade e 25%')
    const full = addResource({ couro: { comum: 380 } }, 'couro', 'comum', 50)
    expect(resourceTotal(full.stock, 'couro')).toBe(400)
    expect(full.overflow).toBe(30)
  })

  it('gasta o Comum primeiro e recusa sem material', () => {
    const s = { ferro_velho: { comum: 30, raro: 50 } }
    expect(spend(s, { ferro_velho: 50 })).toEqual({ ferro_velho: { raro: 30 } })
    expect(spend(s, { ferro_velho: 90 })).toBe(null)
    expect(missing(s, { ervas: 50 })).toHaveLength(1)
  })

  it('faixas de Integridade', () => {
    expect([100, 51, 50, 31, 30, 1, 0].map((p) => weaponIntegrity(p))).toEqual([
      { damage: 0, attack: 0, broken: false }, { damage: 0, attack: 0, broken: false },
      { damage: -1, attack: 0, broken: false }, { damage: -1, attack: 0, broken: false },
      { damage: -1, attack: -1, broken: false }, { damage: -1, attack: -1, broken: false },
      { damage: 0, attack: 0, broken: true },
    ])
    expect([100, 40, 20, 0].map((p) => armorDbWithIntegrity(8, p))).toEqual([8, 6, 4, 0])
  })

  it('desgaste: Robusta metade, Frágil o dobro', () => {
    expect(wearAmount(10, { robusta: true })).toBe(5)
    expect(wearAmount(10, { fragil: true })).toBe(20)
    expect(applyWear(15, 20)).toBe(0)
  })

  it('reparo em Campo até 75%, Forja até 100%', () => {
    expect(repairPlan(40, 100, 'campo')).toEqual({ to: 75, amount: 35 })
    expect(repairPlan(40, 100, 'forja')).toEqual({ to: 100, amount: 60 })
    expect(repairPlan(80, 100, 'campo')).toEqual({ to: 80, amount: 0 })
  })

  it('receita: custo somado, combinação inválida e Saga', () => {
    const r = buildRecipe('garrafa', 'fogo', 'fumaca', 'comum', [])
    expect(r.cost).toEqual({ brennivin: 100, sebo: 25 })
    expect(r.error).toBe(null)
    expect(buildRecipe('bandagem', 'fogo', null, 'comum', []).error).toMatch(/não funciona/)
    expect(buildRecipe('garrafa', 'fogo', 'runico', 'comum', []).error).toMatch(/Saga de Eryndor/)
    expect(buildRecipe('garrafa', 'fogo', 'runico', 'comum', ['eryndor']).effect).toContain('4d6')
    expect(doubleDiceText('cura 1d8')).toBe('cura 2d8')
  })

  it('desmontar devolve metade', () => {
    expect(dismantleReturn({ brennivin: 100, sebo: 25 })).toEqual({ brennivin: 50, sebo: 12 })
  })
})
