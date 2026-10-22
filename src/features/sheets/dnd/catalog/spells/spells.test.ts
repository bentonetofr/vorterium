import { describe, expect, it } from 'vitest'
import { getClass } from '../index'
import { SPELLS, SPELL_SCHOOLS, getSpell, searchSpells, spellComponentsLabel, spellLevelLabel } from './index'

// Conferência do catálogo de magias contra as listas do SRD 5.1.

describe('catálogo de magias do SRD', () => {
  it('tem as 319 magias, na quantidade certa por nível', () => {
    expect(SPELLS).toHaveLength(319)
    const porNivel = Array.from({ length: 10 }, (_, n) => SPELLS.filter((s) => s.level === n).length)
    expect(porNivel).toEqual([24, 49, 54, 42, 31, 37, 31, 20, 16, 15])
  })

  it('chaves e nomes não se repetem', () => {
    expect(new Set(SPELLS.map((s) => s.key)).size).toBe(SPELLS.length)
    expect(new Set(SPELLS.map((s) => s.original)).size).toBe(SPELLS.length)
    expect(new Set(SPELLS.map((s) => s.name)).size).toBe(SPELLS.length)
  })

  it('cada classe tem a quantidade de magias da sua lista no SRD', () => {
    const porClasse = (c: string) => Array.from({ length: 10 }, (_, n) => SPELLS.filter((s) => s.level === n && s.classes.includes(c)).length)
    expect(porClasse('bard')).toEqual([9, 20, 19, 15, 8, 16, 7, 10, 5, 3])
    expect(porClasse('cleric')).toEqual([7, 15, 17, 19, 8, 13, 10, 8, 4, 4])
    expect(porClasse('druid')).toEqual([7, 16, 17, 12, 15, 14, 9, 5, 6, 4])
    expect(porClasse('paladin')).toEqual([0, 11, 8, 6, 3, 3, 0, 0, 0, 0])
    expect(porClasse('ranger')).toEqual([0, 11, 11, 9, 4, 2, 0, 0, 0, 0])
    expect(porClasse('sorcerer')).toEqual([14, 17, 21, 20, 10, 11, 9, 8, 5, 5])
    expect(porClasse('warlock')).toEqual([7, 7, 10, 11, 4, 4, 7, 4, 5, 5])
    expect(porClasse('wizard')).toEqual([14, 27, 31, 28, 23, 23, 19, 15, 12, 12])
  })

  it('toda magia pertence a pelo menos uma classe conjuradora do catálogo', () => {
    for (const s of SPELLS) {
      expect(s.classes.length, s.key).toBeGreaterThan(0)
      for (const c of s.classes) expect(getClass(c)?.spellcasting, `${s.key} -> ${c}`).toBeDefined()
    }
  })

  it('campos completos: escola válida, tempo, alcance, duração e texto', () => {
    for (const s of SPELLS) {
      expect(SPELL_SCHOOLS, s.key).toContain(s.school)
      expect(s.level).toBeGreaterThanOrEqual(0)
      expect(s.level).toBeLessThanOrEqual(9)
      expect(s.name.trim(), s.key).not.toBe('')
      expect(s.castingTime.trim(), s.key).not.toBe('')
      expect(s.range.trim(), s.key).not.toBe('')
      expect(s.duration.trim(), s.key).not.toBe('')
      expect(s.text.length, s.key).toBeGreaterThan(0)
      expect(s.components.v || s.components.s || !!s.components.m, s.key).toBe(true)
      if (s.components.m != null) expect(s.components.m.trim(), s.key).not.toBe('')
    }
  })

  it('concentração e ritual batem com o SRD', () => {
    for (const s of SPELLS) expect(!!s.concentration, s.key).toBe(s.duration.startsWith('Concentração'))
    expect(SPELLS.filter((s) => s.concentration)).toHaveLength(126)
    expect(SPELLS.filter((s) => s.ritual)).toHaveLength(29)
    expect(getSpell('detect_magic')).toMatchObject({ ritual: true, concentration: true })
    expect(getSpell('fireball')).not.toMatchObject({ ritual: true })
  })

  it('não sobrou marcação da conversão nem inglês no texto', () => {
    const ingles = /\b(the|you|your|saving throw|damage|hit points|spell slot|At Higher Levels|within range|target)\b/i
    for (const s of SPELLS) {
      const todo = [s.name, s.castingTime, s.range, s.duration, s.components.m ?? '', ...s.text, s.higher ?? ''].join('\n')
      expect(todo, s.key).not.toMatch(/[⟦⟧]|--/)
      expect(todo, s.key).not.toMatch(ingles)
      expect(todo, s.key).not.toMatch(/\bfeet\b|\bfoot\b|\bmiles?\b|\bpounds?\b|\binch(es)?\b/i)
    }
  })

  it('o texto "Em Níveis Superiores" está separado do corpo', () => {
    for (const s of SPELLS) {
      for (const p of s.text) expect(p, s.key).not.toMatch(/^Em Níveis Superiores/)
      if (s.higher) expect(s.higher, s.key).not.toMatch(/^Em Níveis Superiores\.\s/)
    }
    expect(getSpell('fireball')?.higher).toContain('4º nível')
    expect(getSpell('wish')?.higher).toBeUndefined()
  })

  it('alcances em metros e componentes como no livro', () => {
    expect(getSpell('fireball')).toMatchObject({ name: 'Bola de Fogo', level: 3, school: 'evocation', range: '45 metros', duration: 'Instantânea' })
    expect(spellComponentsLabel(getSpell('fireball')!.components)).toBe('V, S, M (uma minúscula bola de guano de morcego e enxofre)')
    expect(spellComponentsLabel({ v: true, s: false })).toBe('V')
    expect(getSpell('burning_hands')?.range).toBe('Pessoal (cone de 4,5 metros)')
    expect(getSpell('counterspell')?.castingTime).toContain('reação')
    expect(getSpell('shield')?.castingTime).toContain('mísseis mágicos')
    expect(getSpell('mage_armor')?.classes).toEqual(['sorcerer', 'wizard'])
  })

  it('rótulo de nível', () => {
    expect(spellLevelLabel(0)).toBe('Truque')
    expect(spellLevelLabel(3)).toBe('3º nível')
  })
})

describe('searchSpells', () => {
  it('sem filtro devolve tudo, ordenado por nível e nome', () => {
    const todas = searchSpells()
    expect(todas).toHaveLength(319)
    expect(todas[0].level).toBe(0)
    expect(todas[todas.length - 1].level).toBe(9)
    for (let i = 1; i < todas.length; i++) expect(todas[i].level).toBeGreaterThanOrEqual(todas[i - 1].level)
  })

  it('acha por nome em português ou no original, sem acento nem maiúsculas', () => {
    expect(searchSpells({ text: 'BOLA DE FOGO' }).map((s) => s.key)).toContain('fireball')
    expect(searchSpells({ text: 'fireball' }).map((s) => s.key)).toContain('fireball')
    expect(searchSpells({ text: 'misseis' }).map((s) => s.key)).toContain('magic_missile')
    expect(searchSpells({ text: 'xyzxyz' })).toEqual([])
  })

  it('combina nível, escola, classe, ritual e concentração', () => {
    expect(searchSpells({ level: 0 })).toHaveLength(24)
    expect(searchSpells({ classKey: 'paladin' }).every((s) => s.classes.includes('paladin'))).toBe(true)
    expect(searchSpells({ classKey: 'ranger', level: 2 })).toHaveLength(11)
    expect(searchSpells({ school: 'necromancy', level: 9 }).map((s) => s.key)).toEqual(['astral_projection', 'true_resurrection'])
    expect(searchSpells({ ritual: true, classKey: 'wizard' }).every((s) => s.ritual)).toBe(true)
    expect(searchSpells({ concentration: true, level: 1, classKey: 'cleric' }).map((s) => s.key)).toEqual(
      expect.arrayContaining(['bane', 'bless', 'detect_evil_and_good']),
    )
  })
})
