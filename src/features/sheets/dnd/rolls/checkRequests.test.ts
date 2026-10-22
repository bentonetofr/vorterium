import { describe, expect, it } from 'vitest'
import { computeDerived } from '../rules/derive'
import type { DndCheckRequest } from '../services/dndCheckService'
import { CHECK_CHOICES, specFromRequest } from './checkRequests'
import { tilesTotal } from './checkModel'

const derived = computeDerived({
  abilities: { strength: 10, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 14, charisma: 8 },
  classes: [{ classKey: 'rogue', level: 3 }],
  skillProficiency: { stealth: 'proficient' },
  saveProficiency: { dexterity: true },
})

const req = (over: Partial<DndCheckRequest>): DndCheckRequest => ({
  id: 'r1', campaign_id: 'c', master_id: 'm', targets: ['p'], kind: 'skill', check_key: 'stealth', label: 'Furtividade',
  dc: 15, dc_hidden: false, advantage: 'normal', status: 'open', created_at: '', closed_at: null, ...over,
})

describe('pedido do mestre vira teste da ficha', () => {
  it('perícia com a CD, a vantagem e o id do pedido', () => {
    const s = specFromRequest(req({ advantage: 'advantage' }), derived)
    expect(s).toMatchObject({ kind: 'skill', key: 'stealth', label: 'Furtividade', dc: 15, dcHidden: false, advantage: 'advantage', requestId: 'r1' })
    expect(tilesTotal(s.tiles)).toBe(derived.skills.stealth.bonus)
  })

  it('CD oculta: o painel não recebe o número', () => {
    const s = specFromRequest(req({ kind: 'save', check_key: 'dexterity', label: 'Salvaguarda de Destreza', dc: null, dc_hidden: true }), derived)
    expect(s).toMatchObject({ kind: 'save', dc: null, dcHidden: true })
    expect(tilesTotal(s.tiles)).toBe(derived.saves.dexterity.bonus)
  })

  it('atributo, iniciativa, morte e pedido livre', () => {
    expect(specFromRequest(req({ kind: 'ability', check_key: 'wisdom', label: 'Teste de Sabedoria' }), derived).tiles.map((t) => t.value)).toEqual([2])
    expect(specFromRequest(req({ kind: 'initiative', check_key: null, label: 'Iniciativa', dc: null }), derived).kind).toBe('initiative')
    expect(specFromRequest(req({ kind: 'death', check_key: null, label: 'Morte', dc: null }), derived).dc).toBe(10)
    const free = specFromRequest(req({ kind: 'custom', check_key: null, label: 'Segurar a porta', dc: 12 }), derived)
    expect(free).toMatchObject({ label: 'Segurar a porta', tiles: [], dc: 12 })
  })

  it('chave inválida cai no pedido livre, sem quebrar', () => {
    expect(specFromRequest(req({ kind: 'skill', check_key: 'voar', label: 'Voar' }), derived)).toMatchObject({ label: 'Voar', tiles: [] })
  })

  it('a lista do mestre tem as 18 perícias, 6 salvaguardas, 6 atributos e mais 2', () => {
    expect(CHECK_CHOICES).toHaveLength(18 + 6 + 6 + 2)
    expect(new Set(CHECK_CHOICES.map((c) => c.value)).size).toBe(CHECK_CHOICES.length)
  })
})
