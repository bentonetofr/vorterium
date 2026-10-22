import { describe, expect, it } from 'vitest'
import { ARMORS, GEAR, SHIELD, TOOLS, WEAPONS } from './equipment.data'
import {
  BOOK_ITEMS, costInGold, getBookItem, groupsOf, propertyName, searchItems, weaponDamageTypes, weaponProperties,
} from './itemBook'

describe('livro de itens', () => {
  it('reúne tudo do catálogo, com chaves únicas', () => {
    expect(BOOK_ITEMS).toHaveLength(WEAPONS.length + ARMORS.length + 1 + GEAR.length + TOOLS.length)
    expect(new Set(BOOK_ITEMS.map((i) => i.key)).size).toBe(BOOK_ITEMS.length)
    for (const i of BOOK_ITEMS) {
      expect(i.name.trim(), i.key).not.toBe('')
      expect(i.group.trim(), i.key).not.toBe('')
      expect(i.note.trim(), i.key).not.toBe('')
      expect(i.facts.length, i.key).toBeGreaterThan(0)
    }
  })

  it('a nota gravada na ficha continua igual à de antes', () => {
    expect(getBookItem('club')!.note).toBe('1 pp · 1d4 concussão · leve')
    expect(getBookItem('chain_mail')!.note).toBe(`CA 16 · ${ARMORS.find((a) => a.key === 'chain_mail')!.cost}`)
    expect(getBookItem('leather')!.note).toBe(`CA 11 + Des · ${ARMORS.find((a) => a.key === 'leather')!.cost}`)
    expect(getBookItem(SHIELD.key)!.note).toBe(`+2 de CA · ${SHIELD.cost}`)
    expect(getBookItem('backpack')!.note).toBe('2 po')
  })

  it('preço em peças de ouro', () => {
    expect(costInGold('50 po')).toBe(50)
    expect(costInGold('5 pp')).toBeCloseTo(0.5)
    expect(costInGold('1 pc')).toBeCloseTo(0.01)
    expect(costInGold('1.500 po')).toBe(1500)
    expect(costInGold('—')).toBe(0)
  })

  it('propriedades sem números', () => {
    expect(propertyName('arremesso 6/18')).toBe('arremesso')
    expect(propertyName('versátil 1d10')).toBe('versátil')
    expect(propertyName('leve')).toBe('leve')
    expect(weaponProperties()).toContain('acuidade')
    expect(weaponProperties()).toContain('arremesso')
    expect(weaponProperties().some((p) => /\d/.test(p))).toBe(false)
    expect(weaponDamageTypes()).toEqual(expect.arrayContaining(['cortante', 'perfurante', 'concussão']))
  })

  it('categorias de cada tipo', () => {
    expect(groupsOf('weapon')).toEqual(['Simples', 'Marcial'])
    expect(groupsOf('armor')).toEqual(['Leve', 'Média', 'Pesada', 'Escudo'])
    expect(groupsOf('gear').length).toBeGreaterThan(2)
    expect(groupsOf('tool').length).toBeGreaterThan(1)
  })
})

describe('busca de itens', () => {
  const names = (f: Parameters<typeof searchItems>[0]) => searchItems(f).map((i) => i.name)

  it('por nome, sem acento nem maiúscula', () => {
    expect(names({ text: 'espada' }).every((n) => /espada/i.test(n))).toBe(true)
    expect(names({ text: 'ESPADA LONGA' })).toEqual(['Espada longa'])
    expect(names({ text: 'zzz' })).toEqual([])
  })

  it('por tipo e categoria', () => {
    expect(searchItems({ kind: 'weapon' })).toHaveLength(WEAPONS.length)
    expect(searchItems({ kind: 'armor', group: 'Pesada' }).every((i) => i.armor?.category === 'heavy')).toBe(true)
    expect(names({ kind: 'armor', group: 'Escudo' })).toEqual(['Escudo'])
    expect(searchItems({ kind: 'weapon', group: 'Marcial' }).every((i) => i.weapon?.category === 'martial')).toBe(true)
  })

  it('armas por alcance, dano e propriedade', () => {
    const melee = searchItems({ kind: 'weapon', range: 'melee' })
    expect(melee.every((i) => i.weapon!.range !== 'ranged')).toBe(true)
    const ranged = searchItems({ kind: 'weapon', range: 'ranged' })
    expect(ranged.every((i) => i.weapon!.range !== 'melee')).toBe(true)
    expect(ranged.map((i) => i.key)).toContain('dagger')            // arremesso: serve nos dois
    expect(searchItems({ damageType: 'perfurante' }).every((i) => i.weapon?.damageType === 'perfurante')).toBe(true)
    expect(names({ property: 'acuidade' })).toContain('Adaga')
    expect(searchItems({ property: 'arremesso' }).length).toBeGreaterThan(2)
  })

  it('"que sei usar" filtra só armas e armaduras', () => {
    const usable = { weapons: ['simple'], armor: ['light', 'shield'] }
    const all = searchItems({ usable })
    expect(all.some((i) => i.weapon?.category === 'martial')).toBe(false)
    expect(all.some((i) => i.armor?.category === 'heavy')).toBe(false)
    expect(all.some((i) => i.key === SHIELD.key)).toBe(true)
    expect(all.some((i) => i.kind === 'gear')).toBe(true)
    expect(searchItems({ usable: { weapons: ['longsword'], armor: [] } }).some((i) => i.key === 'longsword')).toBe(true)
  })

  it('ordenação por nome, peso e preço', () => {
    const w = searchItems({ kind: 'weapon', sort: 'weight' }).map((i) => i.weight)
    expect(w).toEqual([...w].sort((a, b) => a - b))
    const c = searchItems({ kind: 'armor', sort: 'cost' }).map((i) => i.costGold)
    expect(c).toEqual([...c].sort((a, b) => a - b))
    const n = searchItems({ kind: 'gear' }).map((i) => i.name)
    expect(n).toEqual([...n].sort((a, b) => a.localeCompare(b, 'pt-BR')))
  })
})
