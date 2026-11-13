import { describe, expect, it } from 'vitest'
import { autoSpellClass, spellClassLabel } from './spellClasses'

describe('classe da magia (conjurador multiclasse)', () => {
  it('o nome vem do catálogo, do texto digitado ou da própria chave', () => {
    expect(spellClassLabel('wizard')).toBe('Mago')
    expect(spellClassLabel('hb_artificeiro', { hb_artificeiro: 'Artificeiro' })).toBe('Artificeiro')
    expect(spellClassLabel('sem_nome')).toBe('sem_nome')
  })

  it('a magia leva sozinha a classe quando só uma das classes da ficha a tem na lista', () => {
    const casting = [{ classKey: 'wizard' }, { classKey: 'cleric' }]
    expect(autoSpellClass(['wizard', 'sorcerer'], casting)).toBe('wizard')
    expect(autoSpellClass(['cleric'], casting)).toBe('cleric')
  })

  it('com duas classes que a têm, ou nenhuma, fica sem classe até a pessoa escolher', () => {
    const casting = [{ classKey: 'cleric' }, { classKey: 'druid' }]
    expect(autoSpellClass(['cleric', 'druid'], casting)).toBeNull()
    expect(autoSpellClass(['bard'], casting)).toBeNull()
  })

  it('o Cavaleiro Místico conta pela lista do Mago', () => {
    const casting = [{ classKey: 'fighter', subclassKey: 'eldritch_knight' }, { classKey: 'cleric' }]
    expect(autoSpellClass(['wizard'], casting)).toBe('fighter')
  })
})
