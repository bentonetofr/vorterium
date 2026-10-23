import { describe, expect, it } from 'vitest'
import { fold, parseDamage, parseInt0, parseSpeed, similarity, splitBullets, splitFeatureBlocks } from './text'

describe('leitura de texto de ficha', () => {
  it('fold e semelhança ignoram acento, maiúscula e pontuação', () => {
    expect(fold('  PRESTIDIGITAÇÃO! ')).toBe('prestidigitacao')
    expect(similarity('Besta Leve', 'besta leve')).toBe(1)
    expect(similarity('Armadura de Couro', 'Couro')).toBeGreaterThanOrEqual(0.85)
    expect(similarity('Perdição', 'Praga')).toBeLessThan(0.5)
    expect(similarity('', 'x')).toBe(0)
  })

  it('números com sinal; textos que não são número viram null', () => {
    expect(parseInt0('+3')).toBe(3)
    expect(parseInt0(' −2 ')).toBe(-2)
    expect(parseInt0('14')).toBe(14)
    for (const bad of ['', '-', 'MUITA', '1d8', '3 po', '1,5']) expect(parseInt0(bad)).toBeNull()
  })

  it('deslocamento em metros, pés ou número solto, sempre em pés', () => {
    expect(parseSpeed('9m')).toEqual({ feet: 30, unit: 'm' })
    expect(parseSpeed('9 metros')).toEqual({ feet: 30, unit: 'm' })
    expect(parseSpeed('7,5m')).toEqual({ feet: 25, unit: 'm' })
    expect(parseSpeed('30 ft')).toEqual({ feet: 30, unit: 'ft' })
    expect(parseSpeed('25 pés')).toEqual({ feet: 25, unit: 'ft' })
    expect(parseSpeed('9')).toEqual({ feet: 30, unit: 'guess-m' })
    expect(parseSpeed('30')).toEqual({ feet: 30, unit: 'guess-ft' })
    expect(parseSpeed('rápido')).toBeNull()
    expect(parseSpeed('')).toBeNull()
  })

  it('dano e tipo: letra, palavra ou nada', () => {
    expect(parseDamage('1d8(P)')).toEqual({ dice: '1d8', type: 'perfurante' })
    expect(parseDamage('1d4 (S)')).toEqual({ dice: '1d4', type: 'cortante' })
    expect(parseDamage('2d6 B')).toEqual({ dice: '2d6', type: 'concussão' })
    expect(parseDamage('1d6+2 cortante')).toEqual({ dice: '1d6+2', type: 'cortante' })
    expect(parseDamage('1d10 fogo')).toEqual({ dice: '1d10', type: 'fogo' })
    expect(parseDamage('1d8')).toEqual({ dice: '1d8', type: '' })
    expect(parseDamage('sem dano')).toBeNull()
  })

  it('lista com marcadores junta as linhas quebradas do PDF', () => {
    const text = '\r\n- Pacote de Diplomata (39 po). Inclui um baú, 2 caixas para\r\nmapas ou pergaminhos, um vidro de\r\ntinta.\r\n\r\n- Banjo (Estribeira Lamentável)\r\n\r\n- Algibeira (15po)'
    expect(splitBullets(text)).toEqual([
      'Pacote de Diplomata (39 po). Inclui um baú, 2 caixas para mapas ou pergaminhos, um vidro de tinta.',
      'Banjo (Estribeira Lamentável)',
      'Algibeira (15po)',
    ])
    expect(splitBullets('Corda\nTocha\n')).toEqual(['Corda', 'Tocha'])
    expect(splitBullets('')).toEqual([])
  })

  it('blocos de características: título em maiúsculas, com dois pontos ou no começo do parágrafo', () => {
    const cls = 'APTIDÃO\r\nNo 3º nível, escolha duas perícias.\r\n(+2 HISTÓRIA)\r\n(+2 MEDICINA)\r\n\r\nInspiração de Bardo:\r\nVocê pode inspirar os outros.\r\nUsa um d6.\r\nVersatilidade:\r\nA partir do 2º nível, soma metade.'
    const blocks = splitFeatureBlocks(cls)
    expect(blocks.map((b) => b.title)).toEqual(['APTIDÃO', 'Inspiração de Bardo', 'Versatilidade'])
    expect(blocks[0].body).toContain('(+2 MEDICINA)')
    expect(blocks[1].body).toBe('Você pode inspirar os outros.\nUsa um d6.')

    const racial = splitFeatureBlocks('Ancestral Feérico: Vantagem em testes contra encantamento.\r\nMagia não faz dormir.')
    expect(racial).toEqual([{ title: 'Ancestral Feérico', body: 'Vantagem em testes contra encantamento.\nMagia não faz dormir.' }])

    // "Pré-requisito:" no meio do texto não vira título
    const feat = splitFeatureBlocks('LÍDER INSPIRADOR\r\nPré-requisito: Carisma 13 ou maior\r\nVocê pode gastar 10 minutos.')
    expect(feat).toHaveLength(1)
    expect(feat[0].title).toBe('LÍDER INSPIRADOR')
    expect(feat[0].body).toContain('Pré-requisito: Carisma 13')

    expect(splitFeatureBlocks('Texto solto sem título.')).toEqual([{ title: '', body: 'Texto solto sem título.' }])
    expect(splitFeatureBlocks('')).toEqual([])
  })
})
