import { describe, expect, it } from 'vitest'
import { availableFeatures, featureKey, findCatalogFeature, missingFeatures } from './features'

const names = (list: ReturnType<typeof availableFeatures>) => list.map((f) => f.name)

describe('availableFeatures', () => {
  it('Guerreiro de 1º nível: só as características do nível 1', () => {
    const list = availableFeatures([{ class_key: 'fighter', level: 1, subclass_key: null }], null, null, null)
    expect(names(list)).toEqual(['Estilo de Luta', 'Retomar o Fôlego'])
    expect(list.every((f) => f.source === 'class' && f.level === 1)).toBe(true)
  })

  it('sobe com o nível e não inclui o Aumento de Atributo', () => {
    const list = availableFeatures([{ class_key: 'fighter', level: 5, subclass_key: null }], null, null, null)
    expect(names(list)).toEqual(expect.arrayContaining(['Surto de Ação', 'Arquétipo Marcial', 'Ataque Extra']))
    expect(names(list)).not.toContain('Aumento de Atributo')
    expect(names(list)).not.toContain('Indomável')      // 9º nível
  })

  it('inclui a subclasse escolhida, só até o nível dela', () => {
    const at3 = availableFeatures([{ class_key: 'fighter', level: 3, subclass_key: 'champion' }], null, null, null)
    expect(at3.filter((f) => f.source === 'subclass').map((f) => f.name)).toEqual(['Crítico Aprimorado'])
    const at10 = availableFeatures([{ class_key: 'fighter', level: 10, subclass_key: 'champion' }], null, null, null)
    expect(at10.filter((f) => f.source === 'subclass').map((f) => f.name)).toEqual(['Crítico Aprimorado', 'Atleta Notável', 'Estilo de Luta Adicional'])
  })

  it('multiclasse: a mesma característica de duas classes tem chaves diferentes', () => {
    const list = availableFeatures([
      { class_key: 'fighter', level: 5, subclass_key: null },
      { class_key: 'paladin', level: 5, subclass_key: null },
    ], null, null, null)
    const extra = list.filter((f) => f.name === 'Ataque Extra')
    expect(extra.map((f) => f.key).sort()).toEqual(['fighter__extra_attack', 'paladin__extra_attack'])
    expect(new Set(list.map((f) => f.key)).size).toBe(list.length)
  })

  it('raça, sub-raça e antecedente', () => {
    const list = availableFeatures([], 'dwarf', 'hill_dwarf', 'acolyte')
    expect(list.map((f) => f.source)).toEqual(expect.arrayContaining(['race', 'subrace', 'background']))
    expect(names(list)).toEqual(expect.arrayContaining(['Visão no Escuro', 'Resiliência Anã', 'Vigor Anão', 'Abrigo dos Fiéis']))
    expect(list.every((f) => f.level === 1)).toBe(true)
  })

  it('chaves cabem no limite do banco e usam só letras minúsculas, números e sublinhado', () => {
    const all = availableFeatures(
      ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'].map((c) => ({ class_key: c, level: 20, subclass_key: null })),
      'half_elf', null, 'acolyte',
    )
    for (const f of all) expect(f.key).toMatch(/^[a-z0-9_]{2,80}$/)
  })

  it('classe ou raça desconhecida (homebrew) não quebra', () => {
    expect(availableFeatures([{ class_key: 'meu_homebrew', level: 3, subclass_key: null }], 'raca_x', 'sub_x', 'bg_x')).toEqual([])
  })

  it('ordem: raça, sub-raça, antecedente, depois classes por nível', () => {
    const list = availableFeatures([{ class_key: 'fighter', level: 3, subclass_key: null }], 'elf', null, 'acolyte')
    expect(list.map((f) => f.source)).toEqual(['race', 'race', 'race', 'race', 'background', 'class', 'class', 'class', 'class'])
  })
})

describe('findCatalogFeature e missingFeatures', () => {
  it('acha a característica gravada na ficha pelo catálogo', () => {
    expect(findCatalogFeature('class', 'fighter__second_wind')?.summary).toContain('1d10')
    expect(findCatalogFeature('subclass', 'fighter__champion__improved_critical')?.name).toBe('Crítico Aprimorado')
    expect(findCatalogFeature('race', featureKey('race', 'elf', 'trance'))?.name).toBe('Transe')
    expect(findCatalogFeature('background', 'background__acolyte__shelter_of_the_faithful')?.origin).toBe('Acólito')
    expect(findCatalogFeature('class', 'nada__nada')).toBeUndefined()
  })

  it('missingFeatures tira o que a ficha já tem', () => {
    const avail = availableFeatures([{ class_key: 'fighter', level: 2, subclass_key: null }], null, null, null)
    const miss = missingFeatures(avail, [{ source: 'class', feature_key: 'fighter__second_wind' }, { source: 'manual', feature_key: null }])
    expect(miss.map((f) => f.key)).toEqual(['fighter__fighting_style', 'fighter__action_surge'])
  })
})
