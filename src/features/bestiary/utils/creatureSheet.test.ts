import { describe, expect, it } from 'vitest'
import { ABILITY_KINDS, SHEET_LIMITS, cleanSheet, hasSheet } from './creatureSheet'
import type { CreatureSheet } from '../../../shared/types'

describe('cleanSheet', () => {
  it('devolve null pra ficha vazia, nula ou lixo', () => {
    expect(cleanSheet(null)).toBeNull()
    expect(cleanSheet(undefined)).toBeNull()
    expect(cleanSheet({})).toBeNull()
    expect(cleanSheet({ tier: '   ', strikes: [{ name: '', dice: '', type: 'C' }], abilities: [{ kind: 'passiva', name: '', uses: '', text: '' }] })).toBeNull()
    expect(cleanSheet('oi' as unknown as CreatureSheet)).toBeNull()
  })

  it('apara textos e tira linhas vazias, mantendo as que têm nome ou dados', () => {
    const out = cleanSheet({
      tier: '  Inimigo Forte ',
      attack: ' 3d10 + 4 (Luta) ',
      strikes: [{ name: ' Garras ', dice: ' 2d8 ', type: ' C ' }, { name: '', dice: '', type: '' }, { name: 'Mordida', dice: '', type: 'P' }],
      abilities: [{ kind: 'reacao', name: ' Rosto ', uses: '', text: ' texto ' }, { kind: 'passiva', name: '', uses: '1x', text: '' }],
    })
    expect(out).toEqual({
      tier: 'Inimigo Forte',
      attack: '3d10 + 4 (Luta)',
      strikes: [{ name: 'Garras', dice: '2d8', type: 'C' }, { name: 'Mordida', dice: '', type: 'P' }],
      abilities: [{ kind: 'reacao', name: 'Rosto', uses: '', text: 'texto' }],
    })
  })

  it('limita os tamanhos e as quantidades', () => {
    const out = cleanSheet({
      lore: 'a'.repeat(SHEET_LIMITS.lore + 50),
      strikes: Array.from({ length: SHEET_LIMITS.strikes + 5 }, (_, i) => ({ name: `G${i}`, dice: '1d4', type: 'C' })),
      abilities: Array.from({ length: SHEET_LIMITS.abilities + 5 }, (_, i) => ({ kind: 'passiva' as const, name: `H${i}`, uses: '', text: 'x' })),
    })!
    expect(out.lore!.length).toBe(SHEET_LIMITS.lore)
    expect(out.strikes!.length).toBe(SHEET_LIMITS.strikes)
    expect(out.abilities!.length).toBe(SHEET_LIMITS.abilities)
  })

  it('troca um tipo de habilidade desconhecido por Especial', () => {
    const out = cleanSheet({ abilities: [{ kind: 'xyz' as never, name: 'A', uses: '', text: '' }] })!
    expect(out.abilities![0].kind).toBe('especial')
    expect(ABILITY_KINDS.map((k) => k.id)).toContain('especial')
  })

  it('hasSheet diz se há algo guardado', () => {
    expect(hasSheet({ movement: '5 metros' })).toBe(true)
    expect(hasSheet({ movement: ' ' })).toBe(false)
  })
})
