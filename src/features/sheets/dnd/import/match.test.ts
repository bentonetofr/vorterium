import { describe, expect, it } from 'vitest'
import { SPELLS } from '../catalog/spells'
import { dandrelisFields } from './import.fixtures'
import { itemCandidates, matchArmorText, matchBackground, matchClass, matchItemExact, matchRace, matchSpell, matchWeapon, subclassInText } from './match'
import { readSheetFromPdf } from './readPdf'

const sheet = () => { const o = readSheetFromPdf(dandrelisFields()); if (!o.ok) throw new Error(o.message); return o.sheet }

describe('casar com o catálogo', () => {
  it('classe, raça e antecedente em português ou no original', () => {
    expect(matchClass('Bard')?.key).toBe('bard')
    expect(matchClass('bardo')?.key).toBe('bard')
    expect(matchClass('Guerreiro')?.key).toBe('fighter')
    expect(matchClass('Artífice')).toBeNull()
    expect(matchRace('Half-Elf').race?.key).toBe('half_elf')
    expect(matchRace('Meio-Elfo').race?.key).toBe('half_elf')
    expect(matchRace('Elf, High')).toMatchObject({ race: { key: 'elf' }, subrace: { key: 'high_elf' } })
    expect(matchRace('Dwarf, Hill')).toMatchObject({ race: { key: 'dwarf' }, subrace: { key: 'hill_dwarf' } })
    expect(matchRace('Dwarf, Mountain')).toMatchObject({ race: { key: 'dwarf' }, subrace: null })   // não existe no SRD
    expect(matchRace('Hill Dwarf')).toMatchObject({ race: { key: 'dwarf' }, subrace: { key: 'hill_dwarf' } })
    expect(matchRace('Aasimar').race).toBeNull()
    expect(matchBackground('Entertainer')?.key).toBe('entertainer')
    expect(matchBackground('Artista')?.key).toBe('entertainer')
    expect(matchBackground('Soldier')?.key).toBe('soldier')
    expect(subclassInText('Bard (College of Lore) 5', matchClass('bard')!)?.key).toBe('lore')
    expect(subclassInText('Bard 5', matchClass('bard')!)).toBeNull()
  })

  it('armas e itens exatos', () => {
    expect(matchWeapon('Besta Leve')?.key).toBe('light_crossbow')
    expect(matchWeapon('Adaga')?.key).toBe('dagger')
    expect(matchWeapon('Espada de fogo')).toBeNull()
    expect(matchItemExact('Armadura de Couro')).toBeNull()
    expect(matchArmorText('Armadura de Couro')?.key).toBe('leather')
    expect(matchArmorText('Couro batido')?.key).toBe('studded_leather')
    expect(matchArmorText('Cota de malha')?.key).toBe('chain_mail')
    expect(matchItemExact('Escudo')).toMatchObject({ key: 'shield', kind: 'armor' })
    expect(matchItemExact('Mochila')).toMatchObject({ key: 'backpack', kind: 'gear' })
    expect(matchItemExact('Flauta')).toMatchObject({ key: 'flute', kind: 'tool' })
    expect(itemCandidates('Corda')[0]?.item.key).toBe('hempen_rope')
  })

  it('magias da ficha do Dandrelis: as de nome igual casam, as de outra tradução voltam como candidatas pela carta', () => {
    const spells = sheet().spellcasting.spells
    const find = (n: string) => spells.find((s) => s.name.toLowerCase() === n.toLowerCase())!
    for (const [name, key] of [['Mensagem', 'message'], ['Prestidigitação', 'prestidigitation'], ['Zombaria Viciosa', 'vicious_mockery'], ['Fogo das Fadas', 'faerie_fire'], ['Palavra Curativa', 'healing_word'], ['Sugestão', 'suggestion'], ['Imobilizar Pessoa', 'hold_person']] as const) {
      expect(matchSpell(find(name), SPELLS).exact?.key).toBe(key)
    }
    // "Perdição" é o nome oficial em português de Bane; o catálogo chama de "Praga": a carta (alcance, duração, componentes) mostra
    const bane = matchSpell(find('Perdição'), SPELLS)
    expect(bane.exact).toBeNull()
    expect(bane.candidates[0].entry.key).toBe('bane')
    expect(bane.candidates[0].reasons).toEqual(expect.arrayContaining(['alcance', 'duração']))
    expect(matchSpell(find('Esquentar Metal'), SPELLS).candidates[0].entry.key).toBe('heat_metal')
    // "Sussurros Dissonantes" não é do SRD: nenhum candidato convincente
    const whispers = matchSpell(find('Sussurros Dissonantes'), SPELLS)
    expect(whispers.exact).toBeNull()
    expect(whispers.candidates[0]?.score ?? 0).toBeLessThan(0.75)
  })
})
