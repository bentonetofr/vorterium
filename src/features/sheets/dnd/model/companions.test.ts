import { describe, expect, it } from 'vitest'
import {
  blankCompanion, freeze, heal, ownerCtx, readCompanion, readCompanions, restCompanions, ruleStats, takeDamage, viewOf,
  type Companion, type OwnerCtx,
} from './companions'
import { PRESETS, companionFromPreset, presetAttacks } from './companionCatalog'

// Um personagem de exemplo: proficiência +3 (nível 5), Int 16 (+3), Sab 14 (+2), ataque de magia +6, CD 14.
const owner = (over: Partial<OwnerCtx> = {}): OwnerCtx => ({
  pb: 3,
  mods: { strength: 0, dexterity: 1, constitution: 2, intelligence: 3, wisdom: 2, charisma: 0 },
  spellAttack: 6, spellDc: 14,
  levels: { artificer: 5, ranger: null, druid: null, warlock: null, wizard: null },
  totalLevel: 5, ...over,
})
const make = (key: string, over: Partial<Companion> = {}): Companion => ({ ...companionFromPreset(key)!, ...over })

describe('companheiros: as contas do livro', () => {
  it('Defensor de Aço: PV = 2 + Int + 5 × nível, CA 15 (17 no nível 15), ataque de magia, dano 1d8 + proficiência', () => {
    const c = make('steel')
    expect(ruleStats(c, owner())).toMatchObject({ hpMax: 2 + 3 + 25, ac: 15 })
    expect(ruleStats(c, owner({ levels: { artificer: 15, ranger: null, druid: null, warlock: null, wizard: null } }))).toMatchObject({ hpMax: 2 + 3 + 75, ac: 17 })
    const v = viewOf(c, owner())
    expect(v.hpMax).toBe(30)
    expect(v.attacks[0]).toMatchObject({ hitBonus: 6, dmgBonus: 3, formula: '1d8+3', damageText: '1d8 + 3' })
    // salvaguardas e perícias do bloco: Des +1+PB, Con +2+PB, Atletismo +2+PB, Percepção +0+2×PB
    expect(v.saves.dexterity.bonus).toBe(1 + 3)
    expect(v.saves.constitution.bonus).toBe(2 + 3)
    expect(v.skills.find((s) => s.key === 'athletics')!.bonus).toBe(2 + 3)
    expect(v.skills.find((s) => s.key === 'perception')!.bonus).toBe(0 + 6)
    expect(v.passivePerception).toBe(10 + 6)
  })

  it('Servo Homúnculo: PV = 1 + Int + nível, CA 13, golpe de energia à distância', () => {
    const v = viewOf(make('homunculus'), owner())
    expect(v).toMatchObject({ hpMax: 1 + 3 + 5, ac: 13 })
    expect(v.attacks[0]).toMatchObject({ hitBonus: 6, formula: '1d4+3' })
    expect(v.skills.find((s) => s.key === 'stealth')!.bonus).toBe(2 + 6)
  })

  it('Canhão Místico: PV = 5 × nível, CA 18; no nível 9 o dano soma 1d8; a CD vem da ficha', () => {
    const c = make('cannon:flamethrower')
    expect(viewOf(c, owner()).hpMax).toBe(25)
    expect(viewOf(c, owner()).ac).toBe(18)
    const v5 = viewOf(c, owner()).attacks[0]
    expect(v5).toMatchObject({ saveDc: 14, dice: '2d8' })
    const lvl9 = owner({ levels: { artificer: 9, ranger: null, druid: null, warlock: null, wizard: null } })
    expect(viewOf(c, lvl9).attacks[0].dice).toBe('3d8')
    expect(viewOf(make('cannon:ballista'), lvl9).attacks[0]).toMatchObject({ dice: '3d8', saveDc: null, hitBonus: 6 })
  })

  it('bestas da Tasha: PV 5 + 5 × nível (céu: 4 + 4), CA 13 + proficiência, proficiência em todo teste', () => {
    const o = owner({ levels: { artificer: null, ranger: 5, druid: null, warlock: null, wizard: null } })
    const land = viewOf(make('primal:land'), o)
    expect(land).toMatchObject({ hpMax: 30, ac: 16 })
    expect(land.attacks[0]).toMatchObject({ hitBonus: 6, formula: '1d8+5' })        // 1d8 + 2 + proficiência
    expect(land.saves.dexterity.bonus).toBe(2 + 3)                                  // Vínculo Primal soma a proficiência
    expect(viewOf(make('primal:sky'), o)).toMatchObject({ hpMax: 4 + 20, ac: 16 })
    expect(viewOf(make('primal:sea'), o).hpMax).toBe(30)
    // a Percepção passiva não leva o Vínculo Primal (Sab 14 → 12)
    expect(land.passivePerception).toBe(12)
  })

  it('Companheiro do Patrulheiro (livro-base): CA e ataque levam a proficiência; PV = o maior entre a besta e 4 × nível', () => {
    const o = owner({ levels: { artificer: null, ranger: 5, druid: null, warlock: null, wizard: null } })
    const wolf = make('ranger:wolf')
    const v = viewOf(wolf, o)
    expect(v.ac).toBe(13 + 3)
    expect(v.hpMax).toBe(20)                                                         // 4 × 5 > 11
    expect(v.attacks[0]).toMatchObject({ hitBonus: 4 + 3, formula: '2d4+5' })
    const low = owner({ levels: { artificer: null, ranger: 2, druid: null, warlock: null, wizard: null } })
    expect(viewOf(wolf, low).hpMax).toBe(11)                                         // 4 × 2 = 8 < 11
  })

  it('Espírito de Fogo Selvagem: PV 5 + 5 × nível de Druida, CA 13; ataque de magia e 1d6 + proficiência', () => {
    const o = owner({ levels: { artificer: null, ranger: null, druid: 5, warlock: null, wizard: null } })
    const v = viewOf(make('wildfire'), o)
    expect(v).toMatchObject({ hpMax: 30, ac: 13 })
    expect(v.attacks[0]).toMatchObject({ hitBonus: 6, formula: '1d6+3' })
  })

  it('Constructo Invocado: PV 40 + 15 por nível acima do 4º, CA 13 + nível do espaço', () => {
    const c = make('invoked:construct:stone')
    expect(ruleStats(c, owner())).toMatchObject({ hpMax: 40, ac: 17 })
    expect(ruleStats({ ...c, slot_level: 7 }, owner())).toMatchObject({ hpMax: 85, ac: 20 })
  })

  it('sem o ataque de magia na ficha, usa proficiência + o atributo da regra', () => {
    const v = viewOf(make('steel'), owner({ spellAttack: null, spellDc: null }))
    expect(v.attacks[0].hitBonus).toBe(3 + 3)       // PB + Int
    expect(v.saveDc).toBe(8 + 3 + 3)
  })

  it('o nível digitado vale mais que o da classe, e sem a classe vale o nível total', () => {
    const c = make('steel')
    expect(viewOf({ ...c, level_ref: 7 }, owner()).hpMax).toBe(2 + 3 + 35)
    expect(viewOf(c, owner({ levels: { artificer: null, ranger: null, druid: null, warlock: null, wizard: null }, totalLevel: 4 })).hpMax).toBe(2 + 3 + 20)
  })

  it('manual: valem os números guardados (e a proficiência própria)', () => {
    const wolf = { ...make('pet:wolf'), pb: 2 }
    const v = viewOf(wolf, owner())
    expect(v).toMatchObject({ hpMax: 11, ac: 13, pb: 2, saveDc: null, level: null })
    expect(v.attacks[0]).toMatchObject({ hitBonus: 4, formula: '2d4+2' })
    expect(v.skills.find((s) => s.key === 'stealth')!.bonus).toBe(2 + 2)
  })

  it('freeze: vira manual guardando os números que a regra dava', () => {
    const c = make('steel')
    const f = freeze({ ...c, hp: 99 }, owner())
    expect(f).toMatchObject({ auto: false, hp_max: 30, hp: 30, ac: 15, pb: 3 })
    expect(f.attacks[0]).toMatchObject({ hit_mode: 'fixed', hit: 6, dmg: 3, dmg_pb: false, dice: '1d8' })
    // depois de manual, o nível do dono não mexe mais nos PV
    expect(viewOf(f, owner({ levels: { artificer: 20, ranger: null, druid: null, warlock: null, wizard: null } })).hpMax).toBe(30)
    // voltar ao automático com os ataques do modelo
    expect(presetAttacks('steel')![0]).toMatchObject({ hit_mode: 'spell', dmg_pb: true })
  })

  it('ownerCtx lê os níveis por classe (inclusive Artificeiro digitado à mão)', () => {
    const derived = { proficiencyBonus: 3, abilityMods: owner().mods, spellStats: null, totalLevel: 8 }
    const ctx = ownerCtx(derived, [{ class_key: 'ranger', level: 3 }, { class_key: 'hb_artificeiro', level: 5 }], { hb_artificeiro: 'Artificeiro' })
    expect(ctx.levels).toMatchObject({ ranger: 3, artificer: 5, druid: null })
    expect(ctx.spellAttack).toBeNull()
  })
})

describe('companheiros: vida, descanso e leitura do banco', () => {
  it('dano: o PV temporário absorve primeiro; a 0 o companheiro cai', () => {
    const c = blankCompanion({ hp: 10, hp_max: 10, hp_temp: 4 })
    const a = takeDamage(c, 6, 10)
    expect(a).toMatchObject({ hp_temp: 0, hp: 8, state: 'ativo' })
    const b = takeDamage(a, 20, 10)
    expect(b).toMatchObject({ hp: 0, state: 'caido' })
    expect(takeDamage(c, 0, 10)).toBe(c)
  })

  it('cura: respeita o máximo e levanta quem estava caído', () => {
    const down = blankCompanion({ hp: 0, hp_max: 10, state: 'caido' })
    expect(heal(down, 3, 10)).toMatchObject({ hp: 3, state: 'ativo' })
    expect(heal(down, 50, 10).hp).toBe(10)
    expect(heal({ ...down, state: 'morto' }, 3, 10).state).toBe('morto')
  })

  it('descanso curto recarrega só o que é de descanso curto; o longo recarrega tudo', () => {
    const c = make('steel')
    const used = { ...c, traits: c.traits.map((t) => (t.name === 'Reparar' ? { ...t, uses_used: 2 } : { ...t, recharge: 'short' as const, uses_used: t.uses_max ? 1 : 0 })) }
    const short = restCompanions([used], 'short')[0]
    expect(short.traits.find((t) => t.name === 'Reparar')!.uses_used).toBe(2)
    expect(restCompanions([used], 'long')[0].traits.every((t) => t.uses_used === 0)).toBe(true)
    // sem nada gasto, devolve o mesmo objeto (a ficha não salva à toa)
    const fresh = [c]
    expect(restCompanions(fresh, 'long')[0]).toBe(c)
  })

  it('lê o banco com limites: lixo vira valor padrão, listas são cortadas e a regra desconhecida vira manual', () => {
    const c = readCompanion({ name: 'x'.repeat(500), kind: 'dragao', rule: 'magia', hp_max: -5, hp: 9999, ac: 99, abilities: { strength: 99, dexterity: 'a' }, skills: [{ key: 'perception', level: 'expertise' }, { key: 'nada' }], attacks: Array.from({ length: 20 }, () => ({})), save_prof: ['dexterity', 'sorte'] })
    expect(c.name).toHaveLength(80)
    expect(c).toMatchObject({ kind: 'outro', rule: 'manual', auto: false, hp_max: 0, hp: 9999, ac: 40 })
    expect(c.abilities).toMatchObject({ strength: 30, dexterity: 10 })
    expect(c.skills).toEqual([{ key: 'perception', level: 'expertise' }])
    expect(c.attacks).toHaveLength(8)
    expect(c.save_prof).toEqual(['dexterity'])
    expect(readCompanions('nada')).toEqual([])
    expect(readCompanions(Array.from({ length: 30 }, () => ({}))).length).toBe(12)
  })

  it('ida e volta: o que o modelo cria sobrevive a ser gravado e lido', () => {
    for (const p of PRESETS) {
      const c = companionFromPreset(p.key)!
      expect(readCompanion(JSON.parse(JSON.stringify(c)))).toEqual(c)
    }
  })
})

describe('companheiros: o catálogo', () => {
  it('as chaves são únicas e cada modelo tem a regra e o tipo certos', () => {
    expect(new Set(PRESETS.map((p) => p.key)).size).toBe(PRESETS.length)
    for (const p of PRESETS) {
      const c = p.build()
      expect(c.kind, p.key).toBe(p.key.startsWith('invoked:') ? 'invocado' : p.group)
      expect(c.template, p.key).toBe(p.key)
      expect(c.auto, p.key).toBe(c.rule !== 'manual')
      expect(c.hp_max, p.key).toBeGreaterThan(0)
    }
  })

  it('familiar de Convocar Familiar não ataca; o do Pacto da Corrente ataca', () => {
    expect(companionFromPreset('familiar:owl')!.attacks).toEqual([])
    expect(companionFromPreset('chain:imp')!.attacks.length).toBeGreaterThan(0)
    expect(companionFromPreset('chain:imp')).toMatchObject({ hp_max: 10, ac: 13 })
  })

  it('montaria convocada tem Inteligência 6 e o cavalo de guerra tem 19 PV', () => {
    const c = companionFromPreset('steed:warhorse')!
    expect(c.abilities.intelligence).toBe(6)
    expect(c).toMatchObject({ hp_max: 19, ac: 11, kind: 'montaria' })
    expect(c.speeds.walk).toBe(60)
  })

  it('o ataque do lobo de livro bate com o bloco (+4, 2d4+2)', () => {
    const v = viewOf(companionFromPreset('pet:wolf')!, owner())
    expect(v.attacks[0]).toMatchObject({ hitBonus: 4, formula: '2d4+2' })
  })

  it('modelo desconhecido não cria nada', () => {
    expect(companionFromPreset('nao-existe')).toBeNull()
  })
})
