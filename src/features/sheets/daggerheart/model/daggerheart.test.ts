import { describe, expect, it } from 'vitest'
import { CLASSES } from '../catalog/classes'
import { ARMORS, armorEntry } from '../catalog/armor'
import { ANCESTRIES, COMMUNITIES } from '../catalog/heritage'
import { DOMAIN_CARDS, domainCard } from '../catalog/domainCards'
import { WEAPONS, weaponEntry } from '../catalog/weapons'
import { DOMAIN_ORDER } from '../catalog/rules'
import { emptySheet, normalizeSheet } from './defaults'
import { buildQuickSheet, emptyAnswers, suggestedFor, traitsValid } from './quick'
import { addGold, damageFormula, evasion, hpFromDamage, hpSlots, markStress, proficiency, stressSlots, thresholds, tierOf, traitValue } from './derive'
import { duality, dualityEffects, dualityLabel } from './dice'
import { advanceChoices, applyAdvancement, undoLastAdvancement, validateAdvancement } from './levelUp'
import type { DhAdvancement, DhSheetData } from './types'

function feiticeiro(): DhSheetData {
  const a = armorEntry('gambeson-armor')!
  return {
    ...emptySheet('feiticeiro'),
    subclassKey: 'primordialista',
    ancestryKey: 'elfo',
    communityKey: 'erudita',
    traits: { agility: 0, strength: -1, finesse: 1, instinct: 2, presence: 1, knowledge: 0 },
    armor: { catalogId: a.id, name: a.name, major: a.major, severe: a.severe, score: a.score, feature: a.feature ?? '', mods: a.mods ?? {} },
    primary: { catalogId: 'dualstaff', name: 'Cajado duplo', trait: 'instinct', range: 'distante', dice: 'd6+3', damageType: 'mag', hands: 2, feature: '', attackBonus: 0 },
  }
}

describe('catálogo do Livro Básico', () => {
  it('tem 9 classes com 2 subclasses, 9 domínios, 18 ancestralidades e 9 comunidades', () => {
    expect(CLASSES).toHaveLength(9)
    for (const c of CLASSES) {
      expect(c.subclasses).toHaveLength(2)
      expect(c.domains).toHaveLength(2)
      expect(c.hopeFeature.name).toBeTruthy()
      expect(c.background).toHaveLength(3)
      expect(c.connections).toHaveLength(3)
      for (const sub of c.subclasses) {
        expect(sub.foundation.length).toBeGreaterThan(0)
        expect(sub.specialization.length).toBeGreaterThan(0)
        expect(sub.mastery.length).toBeGreaterThan(0)
      }
    }
    expect(ANCESTRIES).toHaveLength(18)
    expect(COMMUNITIES).toHaveLength(9)
  })

  it('cada domínio tem 21 cartas, do nível 1 ao 10, e cada classe usa dois domínios que existem', () => {
    for (const d of DOMAIN_ORDER) {
      const cards = DOMAIN_CARDS.filter((c) => c.domain === d)
      expect(cards).toHaveLength(21)
      for (let lvl = 1; lvl <= 10; lvl++) expect(cards.some((c) => c.level === lvl), `${d} nível ${lvl}`).toBe(true)
    }
    expect(DOMAIN_CARDS).toHaveLength(189)
    expect(new Set(DOMAIN_CARDS.map((c) => c.id)).size).toBe(189)
    for (const c of CLASSES) for (const d of c.domains) expect(DOMAIN_ORDER).toContain(d)
  })

  it('as armas e armaduras sugeridas pelas classes existem no catálogo', () => {
    for (const c of CLASSES) {
      expect(weaponEntry(c.suggested.primary), c.key).toBeTruthy()
      if (c.suggested.secondary) expect(weaponEntry(c.suggested.secondary)).toBeTruthy()
      expect(armorEntry(c.suggested.armor)).toBeTruthy()
    }
    expect(WEAPONS.length).toBeGreaterThan(190)
    expect(ARMORS).toHaveLength(34)
  })

  it('as armaduras do patamar 1 têm os limiares do livro', () => {
    expect(armorEntry('gambeson-armor')).toMatchObject({ major: 5, severe: 11, score: 3 })
    expect(armorEntry('leather-armor')).toMatchObject({ major: 6, severe: 13, score: 3 })
    expect(armorEntry('chainmail-armor')).toMatchObject({ major: 7, severe: 15, score: 4, mods: { evasion: -1 } })
    expect(armorEntry('full-plate-armor')).toMatchObject({ major: 8, severe: 17, score: 4 })
  })

  it('cartas conhecidas aparecem com nível, domínio e custo de troca certos', () => {
    expect(domainCard('rune-ward')).toMatchObject({ domain: 'arcano', level: 1, recall: 0, type: 'feitico', name: 'Proteção Rúnica' })
    expect(domainCard('resurrection')).toMatchObject({ domain: 'esplendor', level: 10, name: 'Ressurreição' })
    expect(domainCard('book-of-ava')?.type).toBe('grimorio')
  })
})

describe('motor de regras', () => {
  it('o feiticeiro de exemplo do livro: Evasão 10 (+1 do gibão = 11), Armadura 3, limiares 6/12', () => {
    const s = feiticeiro()
    expect(evasion(s)).toBe(11)
    expect(thresholds(s)).toEqual({ major: 6, severe: 12 })
    expect(hpSlots(s)).toBe(6)
    expect(stressSlots(s)).toBe(6)
    expect(proficiency(s)).toBe(1)
    expect(traitValue(s, 'instinct')).toBe(2)
  })

  it('limiares: armadura + nível; sem armadura, nível e o dobro', () => {
    const s = { ...feiticeiro(), level: 3 }
    expect(thresholds(s)).toEqual({ major: 8, severe: 14 })
    expect(thresholds({ ...s, armor: null })).toEqual({ major: 3, severe: 6 })
  })

  it('pontos de vida marcados pelo dano (exemplo do livro: guardião de cota de malha 8/16)', () => {
    const t = { major: 8, severe: 16 }
    expect(hpFromDamage(7, t)).toBe(1)
    expect(hpFromDamage(8, t)).toBe(2)
    expect(hpFromDamage(15, t)).toBe(2)
    expect(hpFromDamage(16, t)).toBe(3)
    expect(hpFromDamage(32, t, true)).toBe(4)
    expect(hpFromDamage(0, t)).toBe(0)
  })

  it('Fadiga além dos espaços livres vira 1 Ponto de Vida', () => {
    const s = { ...feiticeiro(), stressMarked: 5 }
    expect(markStress(s, 3)).toEqual({ stressMarked: 6, hpMarked: 1 })
    expect(markStress({ ...s, stressMarked: 0 }, 2)).toEqual({ stressMarked: 2, hpMarked: 0 })
  })

  it('ancestralidades mudam os números: gigante +1 PV, humano +1 Fadiga, símio +1 Evasão, galapa soma a Proficiência', () => {
    const base = feiticeiro()
    expect(hpSlots({ ...base, ancestryKey: 'gigante' })).toBe(7)
    expect(stressSlots({ ...base, ancestryKey: 'humano' })).toBe(7)
    expect(evasion({ ...base, ancestryKey: 'simio' })).toBe(12)
    expect(thresholds({ ...base, ancestryKey: 'galapa' })).toEqual({ major: 7, severe: 13 })
    // mista: 1ª habilidade do gigante (Resistência) + 2ª do humano (Adaptabilidade)
    expect(hpSlots({ ...base, ancestryKey: 'gigante', ancestry2Key: 'humano' })).toBe(7)
    expect(stressSlots({ ...base, ancestryKey: 'gigante', ancestry2Key: 'humano' })).toBe(6)
  })

  it('patamares e Proficiência por nível', () => {
    expect([1, 2, 4, 5, 7, 8, 10].map(tierOf)).toEqual([1, 2, 2, 3, 3, 4, 4])
    expect(proficiency({ ...feiticeiro(), level: 2 })).toBe(2)
    expect(proficiency({ ...feiticeiro(), level: 5 })).toBe(3)
    expect(proficiency({ ...feiticeiro(), level: 8 })).toBe(4)
  })

  it('fórmula de dano usa a Proficiência', () => {
    expect(damageFormula('d6+3', 1)).toBe('1d6+3')
    expect(damageFormula('d8', 3)).toBe('3d8')
  })

  it('ouro: 10 punhados viram 1 saco, 10 sacos viram 1 baú', () => {
    expect(addGold({ handfuls: 9, bags: 0, chests: 0 }, 1)).toEqual({ handfuls: 0, bags: 1, chests: 0 })
    expect(addGold({ handfuls: 9, bags: 9, chests: 0 }, 1)).toEqual({ handfuls: 0, bags: 0, chests: 1 })
    expect(addGold({ handfuls: 0, bags: 1, chests: 0 }, -1)).toEqual({ handfuls: 9, bags: 0, chests: 0 })
  })

  it('normalizeSheet aceita lixo e devolve uma ficha válida', () => {
    const s = normalizeSheet({ level: 99, name: 7, traits: { agility: 50 }, hope: -3, classKey: 'nao-existe' })
    expect(s.level).toBe(10)
    expect(s.name).toBe('')
    expect(s.traits.agility).toBe(8)
    expect(s.hope).toBe(0)
    expect(s.classKey).toBeNull()
    expect(normalizeSheet(null).v).toBe(1)
  })
})

describe('Dados de Dualidade', () => {
  it('Esperança maior, Medo maior e crítico', () => {
    expect(duality({ hope: 9, fear: 4, modifier: 4, difficulty: 15 })).toMatchObject({ total: 17, kind: 'esperanca', success: true })
    expect(duality({ hope: 3, fear: 6, modifier: 2, difficulty: 15 })).toMatchObject({ total: 11, kind: 'medo', success: false })
    const crit = duality({ hope: 8, fear: 8, modifier: 0, difficulty: 30 })
    expect(crit.kind).toBe('critico')
    expect(crit.success).toBe(true)
  })

  it('vantagem soma o d6 e desvantagem subtrai', () => {
    expect(duality({ hope: 5, fear: 4, modifier: 0, advantage: 'vantagem', advantageDie: 3 }).total).toBe(12)
    expect(duality({ hope: 5, fear: 4, modifier: 0, advantage: 'desvantagem', advantageDie: 3 }).total).toBe(6)
  })

  it('efeitos e rótulos', () => {
    expect(dualityEffects({ kind: 'esperanca' })).toEqual({ hope: 1, gmFear: 0, clearStress: 0 })
    expect(dualityEffects({ kind: 'medo' })).toEqual({ hope: 0, gmFear: 1, clearStress: 0 })
    expect(dualityEffects({ kind: 'critico' })).toEqual({ hope: 1, gmFear: 0, clearStress: 1 })
    expect(dualityLabel({ kind: 'medo', success: true })).toBe('Sucesso com Medo')
    expect(dualityLabel({ kind: 'esperanca', success: false })).toBe('Falha com Esperança')
    expect(dualityLabel({ kind: 'critico', success: true })).toBe('Sucesso crítico')
  })
})

describe('subida de nível', () => {
  function adv(level: number, picks: DhAdvancement['picks'], card: string, experienceId: string | null = null): DhAdvancement {
    return { level, picks, card, experienceId }
  }

  it('nível 2: duas escolhas, uma carta e uma Experiência nova', () => {
    const s = feiticeiro()
    const a = adv(2, [{ opt: 'hp', tier: 2 }, { opt: 'evasion', tier: 2 }], 'cinder-grasp', 'x1')
    expect(validateAdvancement(s, a)).toBeNull()
    const up = applyAdvancement(s, a, 'Sempre na estrada')
    expect(up.level).toBe(2)
    expect(hpSlots(up)).toBe(7)
    expect(evasion(up)).toBe(12)
    expect(proficiency(up)).toBe(2)
    expect(up.experiences[up.experiences.length - 1]).toEqual({ id: 'x1', name: 'Sempre na estrada', mod: 2 })
    expect(up.loadout).toContain('cinder-grasp')
    expect(thresholds(up)).toEqual({ major: 7, severe: 13 })
  })

  it('exige duas escolhas, carta e Experiência', () => {
    const s = feiticeiro()
    expect(validateAdvancement(s, adv(2, [{ opt: 'hp', tier: 2 }], 'cinder-grasp', 'x1'))).toMatch(/duas opções/)
    expect(validateAdvancement(s, adv(2, [{ opt: 'hp', tier: 2 }, { opt: 'stress', tier: 2 }], '', 'x1'))).toMatch(/carta/)
    expect(validateAdvancement(s, adv(2, [{ opt: 'hp', tier: 2 }, { opt: 'stress', tier: 2 }], 'cinder-grasp', null))).toMatch(/Experiência/)
  })

  it('atributos marcados não sobem de novo no mesmo patamar; limpam no nível 5', () => {
    let s = feiticeiro()
    const a2 = adv(2, [{ opt: 'traits', tier: 2, traits: ['agility', 'strength'] }, { opt: 'hp', tier: 2 }], 'cinder-grasp', 'x1')
    s = applyAdvancement(s, a2, 'A')
    expect(traitValue(s, 'agility')).toBe(1)
    const bad = adv(3, [{ opt: 'traits', tier: 2, traits: ['agility', 'finesse'] }, { opt: 'stress', tier: 2 }], 'floating-eye')
    expect(validateAdvancement(s, bad)).toMatch(/desmarcados/)
    const ok = adv(3, [{ opt: 'traits', tier: 2, traits: ['finesse', 'instinct'] }, { opt: 'stress', tier: 2 }], 'floating-eye')
    expect(validateAdvancement(s, ok)).toBeNull()
  })

  it('o patamar 2 só tem 3 casas de atributo e 2 de Vida', () => {
    let s = feiticeiro()
    s = applyAdvancement(s, adv(2, [{ opt: 'hp', tier: 2 }, { opt: 'hp', tier: 2 }], 'cinder-grasp', 'x1'), 'A')
    const third = adv(3, [{ opt: 'hp', tier: 2 }, { opt: 'stress', tier: 2 }], 'floating-eye')
    expect(validateAdvancement(s, third)).toMatch(/máximo|restam/)
  })

  it('Proficiência e multiclasse só a partir do patamar 3 e ocupam as duas escolhas', () => {
    const s = { ...feiticeiro(), level: 4, loadout: ['rune-ward'] }
    const prof = adv(5, [{ opt: 'proficiency', tier: 3 }], 'rune-ward', 'x5')
    expect(validateAdvancement(s, prof)).toMatch(/já tem/)
    const ok = adv(5, [{ opt: 'proficiency', tier: 3 }], 'chain-lightning', 'x5')
    expect(validateAdvancement(s, ok)).toBeNull()
    const up = applyAdvancement(s, ok, 'B')
    expect(proficiency(up)).toBe(1 + 1 + 1 + 1) // níveis 2 e 5 + a escolha
    const early = { ...feiticeiro(), level: 1 }
    expect(advanceChoices(early, 2).some((c) => c.opt === 'proficiency')).toBe(false)
  })

  it('multiclasse: domínio novo, cartas dele só até metade do nível; subclasse melhorada e multiclasse se excluem no patamar', () => {
    const s = { ...feiticeiro(), level: 4 }
    const a = adv(5, [{ opt: 'multiclass', tier: 3, classKey: 'druida', domain: 'sabedoria', subclassKey: 'protetor_renovacao' }], 'gifted-tracker', 'x5')
    expect(validateAdvancement(s, a)).toBeNull()
    const up = applyAdvancement(s, a, 'C')
    expect(validateAdvancement({ ...up, level: 5 }, adv(6, [{ opt: 'subclass', tier: 3 }, { opt: 'hp', tier: 2 }], 'vicious-entangle'))).toMatch(/multiclass|Você multiclassou/)
    const high = adv(5, [{ opt: 'multiclass', tier: 3, classKey: 'druida', domain: 'sabedoria', subclassKey: 'protetor_renovacao' }], 'tempest', 'x5')
    expect(validateAdvancement(s, high)).toMatch(/nível permitido/)
    expect(validateAdvancement(s, adv(5, [{ opt: 'multiclass', tier: 3, classKey: 'feiticeiro', domain: 'arcano', subclassKey: 'elementalista' }], 'x', 'x5'))).toMatch(/diferente/)
  })

  it('desfazer a última subida volta ao estado anterior', () => {
    const s = feiticeiro()
    const up = applyAdvancement(s, adv(2, [{ opt: 'hp', tier: 2 }, { opt: 'evasion', tier: 2 }], 'cinder-grasp', 'x1'), 'A')
    const back = undoLastAdvancement(up)
    expect(back.level).toBe(1)
    expect(back.advancements).toHaveLength(0)
    expect(back.loadout).not.toContain('cinder-grasp')
    expect(back.experiences).toHaveLength(s.experiences.length)
  })

  it('subclasse melhorada sobe a fase e os bônus do baluarte acumulam nos limiares', () => {
    let s: DhSheetData = { ...emptySheet('guardiao'), subclassKey: 'baluarte', level: 4 }
    s = { ...s, armor: { catalogId: 'chainmail-armor', name: 'Cota de malha', major: 7, severe: 15, score: 4, feature: '', mods: { evasion: -1 } } }
    expect(thresholds(s)).toEqual({ major: 12, severe: 20 })
    s = applyAdvancement(s, adv(5, [{ opt: 'subclass', tier: 3 }, { opt: 'hp', tier: 2 }], 'get-back-up', 'x5'), 'D')
    expect(thresholds(s)).toEqual({ major: 7 + 5 + 3, severe: 15 + 5 + 3 })
  })
})

describe('valores manuais (janela Automatizar)', () => {
  it('um valor manual vale no lugar do cálculo e some ao voltar ao automático', () => {
    const s = feiticeiro()
    expect(evasion(s)).toBe(11)
    expect(evasion({ ...s, manual: { evasion: 15 } })).toBe(15)
    expect(thresholds({ ...s, manual: { major: 9 } })).toEqual({ major: 9, severe: 12 })
    expect(hpSlots({ ...s, manual: { hp: 9 } })).toBe(9)
    expect(stressSlots({ ...s, manual: { stress: 20 } })).toBe(12)
    expect(proficiency({ ...s, manual: { proficiency: 3 } })).toBe(3)
    expect(traitValue({ ...s, manual: { 'trait:instinct': 4 } }, 'instinct')).toBe(4)
    expect(evasion({ ...s, manual: {} })).toBe(11)
  })

  it('normalizeSheet: ficha com classe conta como começada; manual ruim é descartado', () => {
    expect(normalizeSheet({ classKey: 'mago' }).started).toBe(true)
    expect(normalizeSheet({}).started).toBe(false)
    expect(normalizeSheet({ started: true }).started).toBe(true)
    expect(normalizeSheet({ manual: { evasion: 12, lixo: 3, hp: 'x' } }).manual).toEqual({ evasion: 12 })
  })
})

describe('ficha rápida', () => {
  it('monta a ficha de nível 1 com as respostas', () => {
    const a = emptyAnswers()
    const done = {
      ...a, ...suggestedFor('guerreiro'), name: ' Tabby ', pronouns: 'Ela/Dela', classKey: 'guerreiro' as const, subclassKey: 'escolhido_bravura', ancestryKey: 'orc', communityKey: 'montanhesa',
      experiences: ['Soldado', 'Amiga de todos'] as [string, string], cards: ['reckless', 'whirlwind'],
    }
    const s = buildQuickSheet(done)
    expect(s.started).toBe(true)
    expect(s.name).toBe('Tabby')
    expect(s.level).toBe(1)
    expect(s.primary?.catalogId).toBe('longsword')
    expect(s.secondary).toBeNull()
    expect(s.armor?.catalogId).toBe('chainmail-armor')
    expect(s.experiences.map((e) => e.name)).toEqual(['Soldado', 'Amiga de todos'])
    expect(s.loadout).toEqual(['reckless', 'whirlwind'])
    expect(s.inventory.some((i) => i.includes('Poção'))).toBe(true)
    expect(traitsValid(s.traits)).toBe(true)
    expect(evasion(s)).toBe(10)
  })

  it('valida a distribuição dos atributos', () => {
    expect(traitsValid({ agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 })).toBe(true)
    expect(traitsValid({ agility: 2, strength: 2, finesse: 1, instinct: 0, presence: 0, knowledge: -1 })).toBe(false)
  })

  it('arma secundária só entra com a principal de uma mão', () => {
    const a = { ...emptyAnswers(), ...suggestedFor('bardo'), classKey: 'bardo' as const, secondaryId: 'small-dagger' }
    expect(buildQuickSheet(a).secondary?.catalogId).toBe('small-dagger')
    expect(buildQuickSheet({ ...a, primaryId: 'longsword' }).secondary).toBeNull()
  })
})
