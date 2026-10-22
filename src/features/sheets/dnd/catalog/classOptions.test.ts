import { describe, expect, it } from 'vitest'
import { CLASS_OPTIONS, INVOCATIONS, METAMAGIC, classOptionFeatureKey, getClassOption } from './classOptions'
import { classOptionAllowance, findCatalogFeature } from '../model/features'

describe('opções de classe do SRD (Metamagia e Invocações Místicas)', () => {
  it('8 opções de Metamagia e 32 Invocações Místicas', () => {
    expect(METAMAGIC).toHaveLength(8)
    expect(INVOCATIONS).toHaveLength(32)
    expect(CLASS_OPTIONS).toHaveLength(40)
  })

  it('chaves únicas e nomes completos', () => {
    expect(new Set(CLASS_OPTIONS.map((o) => `${o.kind}:${o.key}`)).size).toBe(40)
    expect(new Set(CLASS_OPTIONS.map((o) => o.original)).size).toBe(40)
    for (const o of CLASS_OPTIONS) {
      expect(o.name.trim(), o.key).not.toBe('')
      expect(o.summary.trim(), o.key).not.toBe('')
      expect(o.classKey).toBe(o.kind === 'metamagic' ? 'sorcerer' : 'warlock')
    }
  })

  it('o nível mínimo bate com o pré-requisito escrito', () => {
    for (const o of INVOCATIONS) {
      const nivel = o.prerequisite?.match(/(\d+)º nível/)
      expect(o.minLevel, o.key).toBe(nivel ? Number(nivel[1]) : undefined)
    }
    expect(getClassOption('invocation', 'thirsting_blade')).toMatchObject({ minLevel: 5, prerequisite: '5º nível, característica Pacto da Lâmina' })
    expect(getClassOption('invocation', 'agonizing_blast')?.prerequisite).toBe('truque rajada mística')
  })

  it('sem marcação da conversão nem inglês', () => {
    for (const o of CLASS_OPTIONS) {
      const t = `${o.name} ${o.summary} ${o.prerequisite ?? ''}`
      expect(t, o.key).not.toMatch(/\b(the|you|your|feet|foot|spell slot|saving throw)\b/i)
    }
  })

  it('a ficha acha a opção escolhida no catálogo pelo resumo', () => {
    const o = getClassOption('metamagic', 'twinned_spell')!
    expect(classOptionFeatureKey(o)).toBe('sorcerer__metamagic_twinned_spell')
    expect(findCatalogFeature('class', 'sorcerer__metamagic_twinned_spell')).toMatchObject({ name: 'Magia Gêmea', origin: 'Feiticeiro (Metamagia)' })
    expect(findCatalogFeature('class', 'warlock__invocation_lifedrinker')?.summary).toContain('Pré-requisito: 12º nível')
  })
})

describe('classOptionAllowance', () => {
  const row = (class_key: string, level: number) => ({ class_key, level, subclass_key: null })
  it('Metamagia: 0 até o 2º nível, 2 no 3º, 3 no 10º e 4 no 17º', () => {
    expect([1, 2, 3, 9, 10, 16, 17, 20].map((l) => classOptionAllowance('metamagic', [row('sorcerer', l)]))).toEqual([0, 0, 2, 2, 3, 3, 4, 4])
  })
  it('Invocações: 0 no 1º, 2 no 2º, 8 no 18º', () => {
    expect([1, 2, 5, 7, 9, 12, 15, 18].map((l) => classOptionAllowance('invocation', [row('warlock', l)]))).toEqual([0, 2, 3, 4, 5, 6, 7, 8])
  })
  it('sem a classe, não há opções', () => {
    expect(classOptionAllowance('metamagic', [row('wizard', 10)])).toBe(0)
    expect(classOptionAllowance('invocation', [])).toBe(0)
  })
})
