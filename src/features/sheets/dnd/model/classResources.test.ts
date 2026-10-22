import { describe, expect, it } from 'vitest'
import { AUTO_RESOURCE_KEYS, desiredClassResources, planClassResources, type ExistingClassResource } from './classResources'

const mods = { strength: 2, dexterity: 1, constitution: 2, intelligence: 0, wisdom: 1, charisma: 3 }
const find = (r: ReturnType<typeof desiredClassResources>, key: string) => r.find((x) => x.key === key)

describe('desiredClassResources', () => {
  it('Bárbaro: Fúrias pela tabela do SRD, ilimitadas no 20º nível (sem recurso)', () => {
    const at = (level: number) => find(desiredClassResources({ classes: [{ classKey: 'barbarian', level }], abilityMods: mods }), 'rage')
    expect(at(1)).toMatchObject({ label: 'Fúria', max: 2, recharge: 'long' })
    expect(at(3)?.max).toBe(3)
    expect(at(6)?.max).toBe(4)
    expect(at(12)?.max).toBe(5)
    expect(at(17)?.max).toBe(6)
    expect(at(19)?.max).toBe(6)
    expect(at(20)).toBeUndefined()
  })

  it('Bardo: Inspiração = modificador de Carisma (mínimo 1), recarrega no descanso curto a partir do 5º', () => {
    const r = (level: number, cha: number) => find(desiredClassResources({ classes: [{ classKey: 'bard', level }], abilityMods: { ...mods, charisma: cha } }), 'bardic_inspiration')!
    expect(r(1, 3)).toMatchObject({ max: 3, recharge: 'long' })
    expect(r(4, -1).max).toBe(1)
    expect(r(5, 3).recharge).toBe('short')
  })

  it('Clérigo e Paladino: Canalizar Divindade em linhas separadas', () => {
    const cleric = desiredClassResources({ classes: [{ classKey: 'cleric', level: 1 }], abilityMods: mods })
    expect(find(cleric, 'channel_divinity')).toBeUndefined()
    const mix = desiredClassResources({ classes: [{ classKey: 'cleric', level: 6 }, { classKey: 'paladin', level: 3 }], abilityMods: mods })
    expect(find(mix, 'channel_divinity')?.max).toBe(2)
    expect(find(mix, 'channel_divinity_paladin')?.max).toBe(1)
    expect(find(desiredClassResources({ classes: [{ classKey: 'cleric', level: 18 }], abilityMods: mods }), 'channel_divinity')?.max).toBe(3)
  })

  it('Paladino: Cura pelas Mãos 5 × nível e Sentido Divino 1 + Carisma', () => {
    const r = desiredClassResources({ classes: [{ classKey: 'paladin', level: 5 }], abilityMods: mods })
    expect(find(r, 'lay_on_hands')).toMatchObject({ max: 25, recharge: 'long' })
    expect(find(r, 'divine_sense')?.max).toBe(4)
  })

  it('Guerreiro: Retomar o Fôlego, Surto de Ação e Indomável por nível', () => {
    const at = (level: number) => desiredClassResources({ classes: [{ classKey: 'fighter', level }], abilityMods: mods })
    expect(find(at(1), 'second_wind')?.max).toBe(1)
    expect(find(at(1), 'action_surge')).toBeUndefined()
    expect(find(at(2), 'action_surge')?.max).toBe(1)
    expect(find(at(17), 'action_surge')?.max).toBe(2)
    expect(find(at(8), 'indomitable')).toBeUndefined()
    expect([9, 13, 17].map((l) => find(at(l), 'indomitable')?.max)).toEqual([1, 2, 3])
  })

  it('Monge, Feiticeiro, Druida, Ladino, Mago e Bruxo', () => {
    const one = (classKey: string, level: number) => desiredClassResources({ classes: [{ classKey, level }], abilityMods: mods })
    expect(find(one('monk', 1), 'ki')).toBeUndefined()
    expect(find(one('monk', 5), 'ki')).toMatchObject({ max: 5, recharge: 'short' })
    expect(find(one('sorcerer', 1), 'sorcery_points')).toBeUndefined()
    expect(find(one('sorcerer', 7), 'sorcery_points')).toMatchObject({ max: 7, recharge: 'long' })
    expect(find(one('druid', 1), 'wild_shape')).toBeUndefined()
    expect(find(one('druid', 2), 'wild_shape')).toMatchObject({ max: 2, recharge: 'short' })
    expect(find(one('rogue', 19), 'stroke_of_luck')).toBeUndefined()
    expect(find(one('rogue', 20), 'stroke_of_luck')?.max).toBe(1)
    expect(find(one('wizard', 1), 'arcane_recovery')?.max).toBe(1)
    expect(one('ranger', 10)).toEqual([])
    expect(one('warlock', 10).map((r) => r.key)).toEqual([])
    expect(one('warlock', 17).map((r) => r.key)).toEqual(['mystic_arcanum_6', 'mystic_arcanum_7', 'mystic_arcanum_8', 'mystic_arcanum_9'])
  })

  it('multiclasse soma os recursos de cada classe pelo nível dela', () => {
    const r = desiredClassResources({ classes: [{ classKey: 'fighter', level: 2 }, { classKey: 'monk', level: 3 }], abilityMods: mods })
    expect(r.map((x) => x.key)).toEqual(['second_wind', 'action_surge', 'ki'])
    expect(find(r, 'ki')?.max).toBe(3)
  })

  it('raças com habilidade que gasta uso', () => {
    expect(find(desiredClassResources({ classes: [], abilityMods: mods, raceKey: 'dragonborn' }), 'breath_weapon')).toMatchObject({ source: 'race', recharge: 'short', max: 1 })
    expect(find(desiredClassResources({ classes: [], abilityMods: mods, raceKey: 'half_orc' }), 'relentless_endurance')).toMatchObject({ source: 'race', recharge: 'long' })
    expect(desiredClassResources({ classes: [], abilityMods: mods, raceKey: 'human' })).toEqual([])
  })

  it('só gera chaves automáticas conhecidas', () => {
    const todas = (['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'])
      .flatMap((classKey) => desiredClassResources({ classes: [{ classKey, level: 20 }], abilityMods: mods, raceKey: 'half_orc' }))
    for (const r of todas) expect(AUTO_RESOURCE_KEYS.has(r.key), r.key).toBe(true)
  })
})

describe('planClassResources', () => {
  const ex = (key: string, current: number, max: number, extra: Partial<ExistingClassResource> = {}): ExistingClassResource =>
    ({ id: `id-${key}`, key, label: '', source: 'class', recharge: 'long', current_value: current, max_value: max, ...extra })

  it('recurso novo nasce cheio', () => {
    const d = desiredClassResources({ classes: [{ classKey: 'barbarian', level: 3 }], abilityMods: mods })
    const { upserts, removals } = planClassResources(d, [])
    expect(upserts).toEqual([{ key: 'rage', label: 'Fúria', max_value: 3, current_value: 3, recharge: 'long', source: 'class', sort_order: 10 }])
    expect(removals).toEqual([])
  })

  it('nada a fazer quando já está igual', () => {
    const d = desiredClassResources({ classes: [{ classKey: 'barbarian', level: 3 }], abilityMods: mods })
    expect(planClassResources(d, [ex('rage', 1, 3, { label: 'Fúria' })])).toEqual({ upserts: [], removals: [] })
  })

  it('subir de nível ganha a diferença como disponível, descer corta o atual', () => {
    const up = planClassResources(desiredClassResources({ classes: [{ classKey: 'barbarian', level: 6 }], abilityMods: mods }), [ex('rage', 0, 3, { label: 'Fúria' })])
    expect(up.upserts[0]).toMatchObject({ max_value: 4, current_value: 1 })
    const down = planClassResources(desiredClassResources({ classes: [{ classKey: 'barbarian', level: 1 }], abilityMods: mods }), [ex('rage', 4, 4, { label: 'Fúria' })])
    expect(down.upserts[0]).toMatchObject({ max_value: 2, current_value: 2 })
  })

  it('apaga o que a ficha não tem mais, mas nunca recursos feitos à mão', () => {
    const d = desiredClassResources({ classes: [{ classKey: 'wizard', level: 1 }], abilityMods: mods })
    const { removals } = planClassResources(d, [ex('rage', 2, 2), ex('minha_reserva', 1, 3, { source: 'manual' }), ex('arcane_recovery', 1, 1, { label: 'Recuperação Arcana' })])
    expect(removals).toEqual(['id-rage'])
  })

  it('recarga mudou (Bardo no 5º nível): atualiza sem mexer no atual', () => {
    const d = desiredClassResources({ classes: [{ classKey: 'bard', level: 5 }], abilityMods: mods })
    const { upserts } = planClassResources(d, [ex('bardic_inspiration', 1, 3, { label: 'Inspiração de Bardo', recharge: 'long' })])
    expect(upserts[0]).toMatchObject({ recharge: 'short', max_value: 3, current_value: 1 })
  })
})
