import { describe, expect, it } from 'vitest'
import { normalize, scoreItem, searchItems, type SearchItem } from './searchCore'

const items: SearchItem[] = [
  { key: 'page:/campanhas', kind: 'page', title: 'Campanhas', to: '/campanhas' },
  { key: 'page:/minhas-fichas', kind: 'page', title: 'Minhas fichas', to: '/minhas-fichas', keywords: 'personagens' },
  { key: 'campaign:1', kind: 'campaign', title: 'Altherium', subtitle: 'Mestre', to: '/campanhas/1' },
  { key: 'section:1:mesa-sessao', kind: 'section', title: 'Sessão', subtitle: 'Altherium', to: '/campanhas/1/mesa-sessao' },
  { key: 'sheet:9', kind: 'sheet', title: 'Dandrelis Eldricon', subtitle: 'O Legado de Theria · D&D 5e', to: '/campanhas/2/mesa-sessao' },
  { key: 'episode:5', kind: 'episode', title: 'Episódio 21 - Alinhamento', subtitle: 'Altherium', to: '/campanhas/1/sessoes' },
  { key: 'note:3', kind: 'note', title: 'Pistas do altar', subtitle: 'Altherium', to: '/campanhas/1/notas' },
  { key: 'creature:7', kind: 'creature', title: 'Draugr Bestial', subtitle: 'Meu bestiário', to: '/meu-bestiario' },
]

const titles = (q: string) => searchItems(items, q).map((i) => i.title)

describe('busca geral', () => {
  it('ignora maiúsculas e acentos', () => {
    expect(normalize('  Sessão  ')).toBe('sessao')
    expect(titles('sessao')).toContain('Sessão')
    expect(titles('EPISODIO')).toEqual(['Episódio 21 - Alinhamento'])
  })

  it('consulta vazia não devolve nada', () => {
    expect(searchItems(items, '')).toEqual([])
    expect(searchItems(items, '   ')).toEqual([])
  })

  it('acha pelo começo do título, por palavra do meio e pelo subtítulo', () => {
    expect(titles('dand')[0]).toBe('Dandrelis Eldricon')
    expect(titles('eldricon')).toEqual(['Dandrelis Eldricon'])
    expect(titles('theria')).toEqual(['Dandrelis Eldricon'])
    expect(titles('personagens')).toEqual(['Minhas fichas'])
  })

  it('todas as palavras têm que casar', () => {
    expect(titles('altherium sessao')).toEqual(['Sessão'])
    expect(titles('altherium dragao')).toEqual([])
  })

  it('título que começa com a consulta vem antes de quem só cita no subtítulo', () => {
    const out = titles('altherium')
    expect(out[0]).toBe('Altherium')
    expect(out).toContain('Pistas do altar')
    expect(out.indexOf('Altherium')).toBeLessThan(out.indexOf('Pistas do altar'))
  })

  it('no empate, campanha e ficha vêm antes de página', () => {
    const tie: SearchItem[] = [
      { key: 'page:x', kind: 'page', title: 'Teste', to: '/x' },
      { key: 'campaign:x', kind: 'campaign', title: 'Teste', to: '/y' },
    ]
    expect(searchItems(tie, 'teste').map((i) => i.kind)).toEqual(['campaign', 'page'])
  })

  it('sem casar devolve -1 e respeita o limite', () => {
    expect(scoreItem(items[0], 'zzz')).toBe(-1)
    expect(searchItems(items, 'a', 3)).toHaveLength(3)
  })
})
