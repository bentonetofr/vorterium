import { describe, expect, it } from 'vitest'
import { PACT_SLOT_KEY, planSlotResources, spellSlotKey } from './slots'

const row = (level: number, current: number, max: number) => ({ key: spellSlotKey(level), current_value: current, max_value: max })

describe('planSlotResources', () => {
  it('cria os recursos que faltam, já cheios', () => {
    const plan = planSlotResources([4, 3, 2, 0, 0, 0, 0, 0, 0], null, [])
    expect(plan.map((p) => [p.key, p.max_value, p.current_value])).toEqual([
      ['spell_slot_1', 4, 4], ['spell_slot_2', 3, 3], ['spell_slot_3', 2, 2],
    ])
    expect(plan[0]).toMatchObject({ label: '1º nível', recharge: 'long', source: 'spell_slots' })
  })

  it('sem conjuração e sem recursos, não grava nada', () => {
    expect(planSlotResources([0, 0, 0, 0, 0, 0, 0, 0, 0], null, [])).toEqual([])
  })

  it('não mexe no que já está certo', () => {
    expect(planSlotResources([4, 2, 0, 0, 0, 0, 0, 0, 0], null, [row(1, 1, 4), row(2, 0, 2)])).toEqual([])
  })

  it('máximo maior: o espaço novo já vem disponível, o gasto continua gasto', () => {
    const plan = planSlotResources([4, 3, 0, 0, 0, 0, 0, 0, 0], null, [row(1, 1, 4), row(2, 0, 2)])
    expect(plan).toHaveLength(1)
    expect(plan[0]).toMatchObject({ key: 'spell_slot_2', max_value: 3, current_value: 1 })
  })

  it('máximo menor corta o atual', () => {
    const plan = planSlotResources([2, 0, 0, 0, 0, 0, 0, 0, 0], null, [row(1, 4, 4)])
    expect(plan[0]).toMatchObject({ max_value: 2, current_value: 2 })
  })

  it('nível que a ficha perdeu fica com máximo 0', () => {
    const plan = planSlotResources([4, 0, 0, 0, 0, 0, 0, 0, 0], null, [row(1, 4, 4), row(2, 2, 3)])
    expect(plan).toEqual([expect.objectContaining({ key: 'spell_slot_2', max_value: 0, current_value: 0 })])
  })

  it('Magia de Pacto vira um recurso próprio que recarrega no descanso curto', () => {
    const plan = planSlotResources([0, 0, 0, 0, 0, 0, 0, 0, 0], { slots: 2, level: 3 }, [])
    expect(plan).toEqual([{ key: PACT_SLOT_KEY, label: 'Pacto (3º nível)', max_value: 2, current_value: 2, recharge: 'short', source: 'spell_slots', sort_order: 20 }])
  })

  it('o Pacto que sobe de nível atualiza o rótulo mesmo com a mesma quantidade', () => {
    const existing = [{ key: PACT_SLOT_KEY, current_value: 1, max_value: 2 }]
    const plan = planSlotResources([0, 0, 0, 0, 0, 0, 0, 0, 0], { slots: 2, level: 4 }, existing)
    expect(plan).toEqual([expect.objectContaining({ key: PACT_SLOT_KEY, label: 'Pacto (4º nível)', max_value: 2, current_value: 1 })])
  })

  it('multiclasse com Pacto mantém os dois grupos', () => {
    const plan = planSlotResources([2, 0, 0, 0, 0, 0, 0, 0, 0], { slots: 1, level: 1 }, [])
    expect(plan.map((p) => p.key)).toEqual(['spell_slot_1', PACT_SLOT_KEY])
  })
})
