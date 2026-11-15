import { describe, expect, it } from 'vitest'
import { extensionOf, fitSize } from './imageUpload'

describe('fitSize', () => {
  it('reduz o lado maior sem deformar', () => {
    expect(fitSize(4000, 3000, 2000)).toEqual({ w: 2000, h: 1500 })
    expect(fitSize(3000, 6000, 2000)).toEqual({ w: 1000, h: 2000 })
  })

  it('nunca aumenta uma imagem pequena', () => {
    expect(fitSize(800, 600, 2000)).toEqual({ w: 800, h: 600 })
  })

  it('não zera uma dimensão fininha', () => {
    expect(fitSize(10000, 1, 2000)).toEqual({ w: 2000, h: 1 })
  })
})

describe('extensionOf', () => {
  it('traduz o tipo em extensão', () => {
    expect(extensionOf('image/jpeg')).toBe('jpg')
    expect(extensionOf('image/webp')).toBe('webp')
    expect(extensionOf('image/png')).toBe('png')
  })
})
