import { describe, expect, it } from 'vitest'
import { cleanSheet, emptySheet, markText, parseTags, readSheet, textBlocks } from './creatureSheet'

describe('ficha de criatura', () => {
  it('lê qualquer coisa do banco sem quebrar', () => {
    expect(readSheet(null)).toEqual(emptySheet())
    expect(readSheet('x')).toEqual(emptySheet())
    const s = readSheet({ tier: 5, attacks: [{ name: 'Garras', dice: '2d8', kind: 'C' }, 7], abilities: [{ name: 'A', kind: 'inventada' }], tags: ['a', 3] })
    expect(s.tier).toBe('')
    expect(s.attacks).toHaveLength(2)
    expect(s.attacks[1]).toEqual({ name: '', dice: '', kind: '' })
    expect(s.abilities[0].kind).toBe('especial')
    expect(s.tags).toEqual(['a'])
  })

  it('ficha vazia não vira nada para guardar', () => {
    expect(cleanSheet(emptySheet())).toBeNull()
    expect(cleanSheet({ ...emptySheet(), tier: '   ', attacks: [{ name: ' ', dice: '', kind: 'C' }] })).toBeNull()
  })

  it('limpa espaços, dados e linhas vazias', () => {
    const s = cleanSheet({
      ...emptySheet(), lore: '  O morador do monte.  ', attack: ' 3d10 + 4 (Luta) ',
      attacks: [{ name: ' Garras ', dice: ' 2D8 ', kind: ' C ' }, { name: '', dice: '', kind: '' }],
      abilities: [{ name: 'Agarrar', kind: 'padrao', freq: '', text: ' ataque com as garras ' }, { name: '', kind: 'bonus', freq: '1x', text: '' }],
    })!
    expect(s.lore).toBe('O morador do monte.')
    expect(s.attack).toBe('3d10 + 4 (Luta)')
    expect(s.attacks).toEqual([{ name: 'Garras', dice: '2d8', kind: 'C' }])
    expect(s.abilities).toHaveLength(1)
    expect(s.abilities[0].text).toBe('ataque com as garras')
  })

  it('tags: separa por vírgula, sem repetir', () => {
    expect(parseTags('Morto-vivo, grande; morto-vivo\n  Antigo ,')).toEqual(['Morto-vivo', 'grande', 'Antigo'])
    expect(parseTags('a,b,c,d,e,f,g,h,i,j')).toHaveLength(8)
  })

  it('marca dados e DT no texto', () => {
    const p = markText('Causa 2d10+3 de dano contra DT 14 (1d6 de Equilíbrio).')
    expect(p.filter((x) => x.mark).map((x) => [x.text, x.mark])).toEqual([['2d10+3', 'dice'], ['DT 14', 'dt'], ['1d6', 'dice']])
    expect(p.map((x) => x.text).join('')).toBe('Causa 2d10+3 de dano contra DT 14 (1d6 de Equilíbrio).')
    // palavras comuns com "d" não são dados
    expect(markText('pele dura de dedos').every((x) => !x.mark)).toBe(true)
  })

  it('lista com traços vira lista, o resto vira parágrafo', () => {
    const b = textBlocks('Cada rosto tem 8 PV.\n- Rosto do Guerreiro: reação\n- Rosto do Sábio: nada\n\nFim.')
    expect(b.map((x) => x.type)).toEqual(['p', 'ul', 'p'])
    expect(b[1].type === 'ul' && b[1].items).toHaveLength(2)
  })
})
