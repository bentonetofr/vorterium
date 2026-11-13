import { describe, expect, it } from 'vitest'
import { scrollHints } from './TabIndicator'

describe('barra de abas que rola: setas de "tem mais abas"', () => {
  it('sem sobra, nenhuma seta', () => {
    expect(scrollHints(0, 800, 800)).toEqual({ left: false, right: false })
  })

  it('no começo, só a seta da direita', () => {
    expect(scrollHints(0, 600, 1000)).toEqual({ left: false, right: true })
  })

  it('no meio, as duas', () => {
    expect(scrollHints(150, 600, 1000)).toEqual({ left: true, right: true })
  })

  it('no fim, só a da esquerda (a folga de arredondamento não conta)', () => {
    expect(scrollHints(400, 600, 1000)).toEqual({ left: true, right: false })
    expect(scrollHints(399, 600, 1000)).toEqual({ left: true, right: false })
    expect(scrollHints(1, 600, 1000)).toEqual({ left: false, right: true })
  })
})
