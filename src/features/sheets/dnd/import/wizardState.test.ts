import { describe, expect, it } from 'vitest'
import { emptyAnswers, goBack, withAnswer } from './wizardState'

describe('estado do questionário', () => {
  it('guarda as respostas em ordem e Voltar tira a última', () => {
    let s = withAnswer(withAnswer(withAnswer(emptyAnswers(), 'a', 1), 'b', 'x'), 'c', ['1'])
    expect(s.order).toEqual(['a', 'b', 'c'])
    s = goBack(s)
    expect(s).toEqual({ answers: { a: 1, b: 'x' }, order: ['a', 'b'] })
    expect(goBack(emptyAnswers())).toEqual(emptyAnswers())
  })

  it('responder de novo uma pergunta antiga apaga as respostas dadas depois dela', () => {
    const s = withAnswer(withAnswer(withAnswer(emptyAnswers(), 'a', 1), 'b', 2), 'c', 3)
    const again = withAnswer(s, 'b', 20)
    expect(again).toEqual({ answers: { a: 1, b: 20 }, order: ['a', 'b'] })
    // a original não muda
    expect(s.order).toEqual(['a', 'b', 'c'])
  })

  it('responder a mesma pergunta duas vezes seguidas (resposta inválida corrigida) mantém uma só', () => {
    const s = withAnswer(withAnswer(emptyAnswers(), 'xp', -5), 'xp', 100)
    expect(s).toEqual({ answers: { xp: 100 }, order: ['xp'] })
  })
})
