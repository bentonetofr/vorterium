import { describe, expect, it } from 'vitest'
import { swipeDirection } from './useSwipe'

describe('swipeDirection', () => {
  it('deslizar pra esquerda vai pra próxima aba; pra direita, pra anterior', () => {
    expect(swipeDirection(-120, 8, 200)).toBe(1)
    expect(swipeDirection(140, -10, 250)).toBe(-1)
  })

  it('gesto curto não conta', () => {
    expect(swipeDirection(-40, 0, 150)).toBe(0)
    expect(swipeDirection(60, 0, 150)).toBe(0)
  })

  it('rolagem na vertical (ou na diagonal) não troca de aba', () => {
    expect(swipeDirection(-90, 200, 300)).toBe(0)
    expect(swipeDirection(-100, 60, 300)).toBe(0)
  })

  it('arrasto lento não é um deslize', () => {
    expect(swipeDirection(-200, 0, 900)).toBe(0)
  })
})
