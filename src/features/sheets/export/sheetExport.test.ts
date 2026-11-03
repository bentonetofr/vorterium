import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/lib/supabase', () => ({ supabase: {}, uniqueChannel: (base: string) => base }))

import { buildSheetText, kv, sheetFileName } from './sheetText'
import { simpleSheetText } from '../utils/simpleSheetText'
import { tdSheetText } from '../terraDevastada/utils/tdSheetText'
import { vampiroSheetText } from '../vampiro/utils/vampiroSheetText'
import { altheriumSheetText, type AltheriumTextSheet } from '../altherium/utils/altheriumSheetText'
import { dndSheetText } from '../dnd/model/sheetText'
import { makeCtx } from '../dnd/components/fixtures'
import type { CharacterSheet, TdSheet, TdaSheet, VtmSheet } from '../../../shared/types'

describe('texto da ficha', () => {
  it('só escreve o que tem valor e esconde seção vazia', () => {
    const text = buildSheetText('Teste', [
      { title: 'Cheia', lines: [kv('Nome', 'Ana'), kv('Vazio', ''), kv('Sim', true)] },
      { title: 'Vazia', lines: [kv('Nada', null)] },
    ])
    expect(text).toContain('TESTE')
    expect(text).toContain('Nome: Ana')
    expect(text).toContain('Sim: sim')
    expect(text).not.toContain('Vazio:')
    expect(text).not.toContain('VAZIA')
  })

  it('nome de arquivo sem caracteres proibidos', () => {
    expect(sheetFileName('Ana: a "bela"', 'D&D 5e')).toBe('Ana a bela - D&D 5e.txt')
    expect(sheetFileName('', 'Altherium')).toBe('Personagem - Altherium.txt')
  })

  it('ficha simples', () => {
    const s = { character_name: 'Rex', archetype: 'Guerreiro', level: 3, hp_current: 8, hp_max: 12, strength: 14, dexterity: 10, constitution: 12, intelligence: 8, wisdom: 9, charisma: 7, notes: 'Anotei' } as CharacterSheet
    const t = simpleSheetText(s)
    expect(t).toContain('Arquétipo: Guerreiro')
    expect(t).toContain('PV: 8/12')
    expect(t).toContain('Força: 14')
    expect(t).toContain('Anotei')
  })

  it('terra devastada (e a adaptada)', () => {
    const base = {
      character_name: 'Joel', concept: 'Andarilho', description: '', background: 'Passado', notes: '',
      traits: [{ id: '1', name: 'Forte', tag: 'motiva' }], conditions: [{ id: '2', name: 'Ferido', duration: 'longa' }],
      trunfos: [{ id: '3', name: 'Sorte', description: 'Rerrola' }],
      inventory: [{ id: '4', name: 'Pistola', qty: 1, kind: 'arma', level: 2, wtype: 'fogo', ammo: 6 }],
      horror: 3, conviction: 4,
    }
    const td = tdSheetText(base as unknown as TdSheet, false)
    expect(td).toContain('Horror: 3')
    expect(td).toContain('Forte (motiva)')
    const tda = tdSheetText({ ...base, health: 5, backpack: 2, supplies: { trapos: 3 } } as unknown as TdaSheet, true)
    expect(tda).toContain('Vida: 5/6')
    expect(tda).toContain('Trapos: 3')
    expect(tda).toContain('6 balas')
  })

  it('vampiro', () => {
    const s = {
      character_name: 'Ana', concept: '', chronicle: '', sire: '', ambition: '', desire: '', clan: 'brujah', predator_type: null,
      generation: 12, attr_strength: 3, attr_dexterity: 2, attr_stamina: 2, attr_charisma: 1, attr_manipulation: 1, attr_composure: 2,
      attr_intelligence: 2, attr_wits: 2, attr_resolve: 3, skills: { athletics: 2 }, specialties: [],
      health_superficial: 1, health_aggravated: 0, health_bonus: 0, willpower_superficial: 0, willpower_aggravated: 0, willpower_bonus: 0,
      hunger: 2, humanity: 7, stains: 0, blood_potency: 1, history: 'Era uma vez', notes: null,
      disciplines: { celeridade: 1 }, powers: [], rituals: [], advantages: [], convictions: [], xp_log: [], predator_grants: null, creation_tier: 'neonato',
    } as unknown as VtmSheet
    const t = vampiroSheetText(s)
    expect(t).toContain('Clã: Brujah')
    expect(t).toContain('Fome: 2/5')
    expect(t).toContain('Era uma vez')
  })

  it('altherium', () => {
    const s = {
      character_name: 'Thor', level: 2, raiz: 'berserker', genesis: 'guerreiro',
      attr_furia: 5, attr_destino: 2, attr_espirito: 3, attr_impulso: 4, attr_estrategia: 1, attr_runico: 0,
      vitality_current: 20, vitality_max: 25, equilibrio_current: 10, equilibrio_max: 12, fv_current: 8, fv_max: 14, pr_current: 0, pr_max: 0,
      cards_current: 0, hacksilvers: 120, db_pernas: 1, db_bracos: 1, db_tronco: 2, db_cabeca: 1, dano_pernas: 0, dano_bracos: 0, dano_tronco: 3, dano_cabeca: 0,
      berserker_triumphs: [], runaskin_trail: '', runaskin_trail_overrides: {}, genesis_abilities: [], skald_inspirations: [], notes: 'Nota',
      resources: { ferro_velho: { comum: 100 } }, survival: { tokens: 4, hunger: 1, short_rests: 0, rite_used: false, traumas: [] },
    } as unknown as AltheriumTextSheet
    const t = altheriumSheetText(s, [{ id: 'd', sheet_id: 's', domain: 'luta', points: 2 }], [], [])
    expect(t).toContain('Raiz: Berserker')
    expect(t).toContain('Vitalidade (PV): 20/25')
    expect(t).toContain('Luta: 2 pontos')
    expect(t).toContain('Fome (níveis): 1')
  })

  it('d&d 5e', () => {
    const t = dndSheetText(makeCtx())
    expect(t).toContain('D&D 5E')
    expect(t).toContain('Classe de Armadura')
    expect(t).toContain('ATRIBUTOS')
    expect(t).toContain('PERÍCIAS')
  })
})
