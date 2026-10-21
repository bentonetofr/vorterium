import { describe, expect, it } from 'vitest'
import { homebrewKeyFromName } from './homebrewKey'

const VALID = /^[a-z0-9_]{2,60}$/

describe('homebrewKeyFromName', () => {
  it('tira acento, põe minúsculas e junta com sublinhado', () => {
    expect(homebrewKeyFromName('Espada Flamejante')).toBe('espada_flamejante')
    expect(homebrewKeyFromName('Poção de Cura (maior)!')).toBe('pocao_de_cura_maior')
  })

  it('nomes curtos ou sem letras ainda viram uma chave válida', () => {
    expect(homebrewKeyFromName('A')).toBe('item_a')
    expect(homebrewKeyFromName('!!!')).toBe('item_x')
    expect(homebrewKeyFromName('')).toBe('item_x')
  })

  it('corta em 60 caracteres sem terminar em sublinhado', () => {
    const key = homebrewKeyFromName('palavra '.repeat(20))
    expect(key.length).toBeLessThanOrEqual(60)
    expect(key.endsWith('_')).toBe(false)
  })

  it.each(['Espada Flamejante', 'A', '!!!', '', 'Ñandú Ç', '日本語', 'x'.repeat(200)])('"%s" sempre dá uma chave aceita pelo banco', (name) => {
    expect(homebrewKeyFromName(name)).toMatch(VALID)
  })
})
