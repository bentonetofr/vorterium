import { describe, expect, it } from 'vitest'
import { BOOK_ITEMS } from '../catalog/itemBook'
import {
  filterInventory, groupFeatures, inventoryGroup, isLongDescription, moveItemBy, moveItemTo, orderChanges, sortByGroup, sortByName, sortFeatures, withOrder,
  OWN_FEATURE_SOURCES,
} from './organize'

const feat = (name: string, source: Parameters<typeof sortFeatures>[0][number]['source'], level: number | null = null) => ({ name, source, level })
const inv = (id: string, name: string, key: string | null = null, notes = '', sort_order = 0) => ({ id, name, catalog_entry_key: key, notes, sort_order })

describe('características por origem', () => {
  it('agrupa na ordem raça, antecedente, classe, subclasse, talento, item, própria', () => {
    const groups = groupFeatures([feat('A', 'manual'), feat('B', 'class'), feat('C', 'race'), feat('D', 'feat'), feat('E', 'background'), feat('F', 'subclass')])
    expect(groups.map((g) => g.source)).toEqual(['race', 'background', 'class', 'subclass', 'feat', 'manual'])
  })

  it('uma habilidade própria com origem "raça" cai no grupo da raça, junto das do livro', () => {
    const groups = groupFeatures([feat('Visão no Escuro', 'race', 1), feat('Fogo Astral', 'race', 3), feat('Ataque Extra', 'class', 5), feat('Outra', 'manual')])
    const race = groups.find((g) => g.source === 'race')
    expect(race?.items.map((f) => f.name)).toEqual(['Visão no Escuro', 'Fogo Astral'])
    expect(groups.find((g) => g.source === 'manual')?.items.map((f) => f.name)).toEqual(['Outra'])
  })

  it('dentro do grupo: por nível e depois por nome; grupo vazio não aparece', () => {
    expect(sortFeatures([feat('Z', 'class', 1), feat('B', 'class', 3), feat('A', 'class', 3), feat('X', 'race')]).map((f) => f.name)).toEqual(['X', 'Z', 'A', 'B'])
    expect(groupFeatures([]).length).toBe(0)
  })

  it('todas as origens do livro podem ser escolhidas, e "Própria" é a primeira (padrão)', () => {
    expect(OWN_FEATURE_SOURCES[0]).toBe('manual')
    expect(OWN_FEATURE_SOURCES).toEqual(expect.arrayContaining(['race', 'subrace', 'background', 'class', 'subclass', 'feat', 'item']))
  })
})

describe('ordem do inventário', () => {
  const list = [inv('a', 'Corda'), inv('b', 'Adaga'), inv('c', 'Tocha'), inv('d', 'Poção')]

  it('sobe e desce um lugar; nas pontas fica como está', () => {
    expect(moveItemBy(list, 'c', -1).map((i) => i.id)).toEqual(['a', 'c', 'b', 'd'])
    expect(moveItemBy(list, 'a', 1).map((i) => i.id)).toEqual(['b', 'a', 'c', 'd'])
    expect(moveItemBy(list, 'a', -1).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(moveItemBy(list, 'd', 1).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(moveItemBy(list, 'zzz', 1).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('arrastar: o item vai para o lugar do alvo, para cima ou para baixo', () => {
    expect(moveItemTo(list, 'd', 0).map((i) => i.id)).toEqual(['d', 'a', 'b', 'c'])
    expect(moveItemTo(list, 'a', 2).map((i) => i.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItemTo(list, 'a', 99).map((i) => i.id)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('não mexe na lista original', () => {
    const copy = list.map((i) => i.id)
    moveItemTo(list, 'd', 0)
    sortByName(list)
    expect(list.map((i) => i.id)).toEqual(copy)
  })

  it('grava só quem mudou de posição, com a posição na lista', () => {
    const ordered = [inv('a', 'A', null, '', 0), inv('b', 'B', null, '', 1), inv('c', 'C', null, '', 2)]
    expect(orderChanges(ordered)).toEqual([])
    expect(orderChanges(moveItemBy(ordered, 'b', -1))).toEqual([{ id: 'b', sort_order: 0 }, { id: 'a', sort_order: 1 }])
  })

  it('números repetidos (item apagado e outro criado) são corrigidos ao reordenar', () => {
    const dup = [inv('a', 'A', null, '', 0), inv('b', 'B', null, '', 2), inv('c', 'C', null, '', 2)]
    expect(orderChanges(dup)).toEqual([{ id: 'b', sort_order: 1 }])
    expect(withOrder(dup).map((i) => i.sort_order)).toEqual([0, 1, 2])
  })

  it('A–Z ignora maiúscula e acento', () => {
    expect(sortByName([inv('1', 'zarabatana'), inv('2', 'Éter'), inv('3', 'adaga')]).map((i) => i.name)).toEqual(['adaga', 'Éter', 'zarabatana'])
  })
})

describe('tipos e busca do inventário', () => {
  const sword = BOOK_ITEMS.find((b) => b.kind === 'weapon')!
  const armor = BOOK_ITEMS.find((b) => b.kind === 'armor')!
  const gear = BOOK_ITEMS.find((b) => b.kind === 'gear')!

  it('o tipo vem do livro; item escrito pelo jogador é "Próprio"', () => {
    expect(inventoryGroup({ catalog_entry_key: sword.key })).toBe('weapon')
    expect(inventoryGroup({ catalog_entry_key: armor.key })).toBe('armor')
    expect(inventoryGroup({ catalog_entry_key: null })).toBe('custom')
    expect(inventoryGroup({ catalog_entry_key: 'chave_que_nao_existe' })).toBe('custom')
  })

  it('por tipo: armas, armaduras, equipamento, ferramentas, próprios; e dentro, por nome', () => {
    const list = [inv('1', 'Capa estranha'), inv('2', gear.name, gear.key), inv('3', armor.name, armor.key), inv('4', sword.name, sword.key)]
    expect(sortByGroup(list).map((i) => i.id)).toEqual(['4', '3', '2', '1'])
  })

  it('a busca acha pelo nome ou pela descrição, sem acento nem maiúscula', () => {
    const list = [inv('1', 'Anel de Proteção', null, 'Concede +1 na CA'), inv('2', 'Poção de cura', null, 'Recupera 2d4+2 pontos de vida'), inv('3', 'Corda')]
    expect(filterInventory(list, 'pocao', '').map((i) => i.id)).toEqual(['2'])
    expect(filterInventory(list, 'ANEL', '').map((i) => i.id)).toEqual(['1'])
    expect(filterInventory(list, 'vida', '').map((i) => i.id)).toEqual(['2'])
    expect(filterInventory(list, '  ', '').length).toBe(3)
    expect(filterInventory(list, 'xyz', '').length).toBe(0)
  })

  it('o filtro por tipo combina com a busca', () => {
    const list = [inv('1', sword.name, sword.key), inv('2', 'Espada mágica'), inv('3', armor.name, armor.key)]
    expect(filterInventory(list, '', 'weapon').map((i) => i.id)).toEqual(['1'])
    expect(filterInventory(list, 'espada', 'custom').map((i) => i.id)).toEqual(['2'])
  })
})

describe('descrição de item', () => {
  it('curta aparece inteira; comprida (texto longo ou muitas linhas) fica recolhida', () => {
    expect(isLongDescription('Dano 1d8 · Versátil')).toBe(false)
    expect(isLongDescription('a\nb\nc\nd')).toBe(false)
    expect(isLongDescription('a\nb\nc\nd\ne')).toBe(true)
    expect(isLongDescription('x'.repeat(281))).toBe(true)
    expect(isLongDescription('x'.repeat(280))).toBe(false)
  })

  it('linhas em branco não contam', () => {
    expect(isLongDescription('a\n\n\nb\n\nc')).toBe(false)
  })
})
