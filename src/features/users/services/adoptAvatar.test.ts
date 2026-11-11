import { describe, expect, it, vi } from 'vitest'

// o módulo importa o cliente do Supabase; aqui só interessam as funções puras
vi.mock('../../../shared/lib/supabase', () => ({ supabase: {} }))

import { biggerGooglePhoto, isGooglePhoto } from './adoptAvatar'

describe('foto do Google', () => {
  it('reconhece o servidor de fotos do Google e nada além dele', () => {
    expect(isGooglePhoto('https://lh3.googleusercontent.com/a/ACg8ocL=s96-c')).toBe(true)
    expect(isGooglePhoto('https://lh5.googleusercontent.com/-x/photo.jpg')).toBe(true)
    expect(isGooglePhoto('https://xyz.supabase.co/storage/v1/object/public/avatars/u1/avatar?v=1')).toBe(false)
    expect(isGooglePhoto('https://googleusercontent.com.evil.example/a.jpg')).toBe(false)
    expect(isGooglePhoto('não é endereço')).toBe(false)
    expect(isGooglePhoto(null)).toBe(false)
  })

  it('pede a foto num tamanho maior, sem mexer em endereço sem o sufixo', () => {
    expect(biggerGooglePhoto('https://lh3.googleusercontent.com/a/ABC=s96-c')).toBe('https://lh3.googleusercontent.com/a/ABC=s256-c')
    expect(biggerGooglePhoto('https://lh3.googleusercontent.com/a/ABC=s64')).toBe('https://lh3.googleusercontent.com/a/ABC=s256-c')
    expect(biggerGooglePhoto('https://lh3.googleusercontent.com/a/ABC')).toBe('https://lh3.googleusercontent.com/a/ABC')
  })
})
