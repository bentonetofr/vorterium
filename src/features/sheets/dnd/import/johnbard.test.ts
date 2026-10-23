import { describe, expect, it } from 'vitest'
import { dandrelisFields } from './import.fixtures'
import { readSheetFromPdf } from './readPdf'
import type { SheetRead } from './readTypes'

function read(): SheetRead {
  const out = readSheetFromPdf(dandrelisFields())
  if (!out.ok) throw new Error(out.message)
  return out.sheet
}

describe('PDF modelo JohnBard 1.4 (ficha do Dandrelis)', () => {
  it('reconhece o modelo', () => {
    expect(read().model).toBe('johnbard-1.4')
  })

  it('lê identidade, atributos, salvaguardas e perícias', () => {
    const s = read()
    expect(s.identity).toMatchObject({ characterName: 'Dandrelis Eldricon', playerName: 'Cisco', classText: 'Bard Nível 5', raceText: 'Half-Elf', backgroundText: 'Entertainer', xpText: 'MUITA' })
    expect(s.abilities.strength).toEqual({ score: '13', mod: '+1' })
    expect(s.abilities.charisma).toEqual({ score: '18', mod: '+4' })
    expect(s.profBonus).toBe('+3')
    expect(s.saves.dexterity).toEqual({ value: '5', proficient: true })
    expect(s.saves.charisma.proficient).toBe(true)
    expect(s.saves.strength.proficient).toBe(false)
    expect(s.skills.acrobatics).toEqual({ value: '5', proficient: true, expertise: false })
    expect(s.skills.stealth).toEqual({ value: '2', proficient: false, expertise: false })       // "Ste" é Furtividade
    expect(s.skills.intimidation.value).toBe('4')                                                   // "Int" é Intimidação
    expect(s.skills.animal_handling.value).toBe('3')
    expect(s.skills.sleight_of_hand.value).toBe('2')
    const proficient = Object.entries(s.skills).filter(([, v]) => v.proficient).map(([k]) => k).sort()
    expect(proficient).toEqual(['acrobatics', 'deception', 'history', 'insight', 'medicine', 'perception', 'performance', 'persuasion'])
  })

  it('lê combate, ataques, armadura, moedas e proficiências', () => {
    const s = read()
    expect(s.combat).toMatchObject({ ac: '10', initiative: '2', speed: '9m', vision: '18m', darkvision: true, hpMax: '28', hpCurrent: '15', hpTemp: '0', deathSuccesses: 0, deathFailures: 0 })
    expect(s.combat.hitDice).toEqual([{ die: 'd8', total: '1', left: '1' }])
    expect(s.attacks).toEqual([{ name: 'Besta Leve', bonus: '', damage: '1d8(P)' }, { name: 'Adaga', bonus: '', damage: '1d4(P)' }])
    expect(s.armor).toMatchObject({ type: 'Armadura de Couro', ac: '13', maxDex: '-', shield: '-' })
    expect(s.coins).toEqual({ cp: '0', sp: '0', ep: '0', gp: '120', pp: '0' })
    expect(s.attuned).toEqual(['Pacote de Diplomata'])
    expect(s.proficiencies.armor).toEqual({ light: true, medium: false, heavy: false, shields: false })
    expect(s.proficiencies.weapons.simple).toBe(true)
    expect(s.proficiencies.weapons.martial).toBe(false)
    expect(s.proficiencies.weapons.otherText).toBe('Besta de mão, Espada longa, Rapieiras, Espada curta.')
    expect(s.proficiencies.tools).toBe('Banjo, flauta, Harpa')
    expect(s.proficiencies.languages).toBe('Comun, Élfico, Anão.')
    expect(s.featureRows).toEqual([{ name: 'Inspiração de bardo', total: '1d8', left: '', shortRest: false, longRest: false, dawn: false }])
  })

  it('lê os textos livres e a descrição do personagem', () => {
    const s = read()
    expect(s.texts.feats.startsWith('LÍDER INSPIRADOR\nPré-requisito: Carisma 13 ou maior')).toBe(true)
    expect(s.texts.racialTraits.startsWith('Ancestral Feérico')).toBe(true)
    expect(s.texts.classFeatures.startsWith('APTIDÃO')).toBe(true)
    expect(s.texts.equipment).toContain('Pacote de Diplomata (39 po)')
    expect(s.texts.appearance.startsWith('ANOTAÇÃO:')).toBe(true)
    expect(s.bio).toEqual({ age: '32', height: '1,60', weight: '64kg', eyes: 'verdes', skin: 'branca', hair: 'ondulado', faction: 'Zhentarim' })
    expect(s.texts.personality).toBe('')
  })

  it('lê as magias por nível, pela posição na página, com os detalhes das cartas', () => {
    const sp = read().spellcasting
    expect(sp).toMatchObject({ className: 'Bardo', ability: 'Car', dc: '14', attack: '6' })
    const names = (level: number) => sp.spells.filter((x) => x.level === level).map((x) => x.name.toLowerCase()).sort()
    expect(names(0)).toEqual(['mensagem', 'prestidigitação', 'zombaria viciosa'])
    expect(names(1)).toEqual(['fogo das fadas', 'palavra curativa', 'perdição', 'sussurros dissonantes'])
    expect(names(2)).toEqual(['esquentar metal', 'imobilizar pessoa', 'sugestão'])
    expect(sp.spells).toHaveLength(10)
    const message = sp.spells.find((x) => x.name === 'Mensagem')!
    expect(message.from).toBe('both')
    expect(message.card).toMatchObject({ range: '36 metros', castingTime: '1 ação', duration: '1 rodada', components: 'V, S, M (um pedaço curto de fio de cobre)' })
    expect(message.card?.effect.startsWith('Você aponta seu dedo')).toBe(true)
    expect(sp.slots.find((x) => x.level === 1)).toMatchObject({ total: '4', marked: 3 })
    expect(sp.slots.find((x) => x.level === 2)).toMatchObject({ total: '3', marked: 3 })
    expect(sp.slots.find((x) => x.level === 3)).toMatchObject({ total: '', marked: 0 })
  })

  it('PDF sem formulário ou de outro modelo é recusado com um motivo claro', () => {
    const none = readSheetFromPdf({ pageCount: 1, fields: [] })
    expect(none).toMatchObject({ ok: false, reason: 'no-form' })
    const other = readSheetFromPdf({ pageCount: 1, fields: [{ name: 'Name', kind: 'text', value: 'x', page: 1, rect: [0, 0, 1, 1] }] })
    expect(other).toMatchObject({ ok: false, reason: 'unknown-model' })
  })
})
