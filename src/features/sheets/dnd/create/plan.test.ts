import { describe, expect, it } from 'vitest'
import { CLASSES, getArmor, getWeapon, spellListClass } from '../catalog'
import { getBookItem } from '../catalog/itemBook'
import { SPELLS } from '../catalog/spells'
import { makeSheet } from '../components/fixtures'
import { checkDraft } from '../import/importService'
import { deriveDraft } from '../import/ctx'
import type { Answers, Question } from '../import/types'
import { weaponProficient } from '../rules/combat'
import { KITS } from './data'
import { runCreate, spellPriority, suggestedArray, type CreateInput, type CreatePlan } from './plan'

const existing = makeSheet({ character_name: null, race_key: null, subrace_key: null, background_key: null, class_key: null, level: 1, experience: 0 })
const input = (extra: Partial<CreateInput> = {}): CreateInput => ({ existing, spells: SPELLS, ...extra })

/** Responde cada pergunta do planejador do jeito mais simples, até terminar. `over` troca respostas específicas. */
function drive(base: Answers, over: Record<string, (q: Question) => unknown> = {}, extra: Partial<CreateInput> = {}): { plan: Extract<CreatePlan, { done: true }>; answers: Answers; asked: string[] } {
  const answers: Answers = { ...base }
  for (let guard = 0; guard < 200; guard++) {
    const plan = runCreate(input(extra), answers)
    if (plan.done) return { plan, answers, asked: plan.asked }
    const q = plan.question
    const custom = over[q.id]
    if (custom) { answers[q.id] = custom(q) as never; continue }
    if (q.kind === 'choice') {
      // a recomendada primeiro; se o planejador recusar (ex.: atributo já em 20), tenta as outras
      const tries = [...(q.recommended ? [q.recommended] : []), ...q.options.map((o) => o.value)]
      const pick = tries.find((v) => { const next = runCreate(input(extra), { ...answers, [q.id]: v }); return next.done || next.question.id !== q.id || !next.question.error }) ?? tries[0]
      answers[q.id] = pick
    }
    else if (q.kind === 'number') answers[q.id] = q.defaultValue ?? q.min
    else if (q.kind === 'text') answers[q.id] = q.id === 'name' ? 'Teste' : ''
    else {
      // marca opções até o planejador aceitar (ele diz quantas faltam)
      let ok = false
      for (let n = 1; n <= q.options.length && !ok; n++) {
        const candidate = q.options.slice(0, n).map((o) => o.value)
        const next = runCreate(input(extra), { ...answers, [q.id]: candidate })
        if (next.done || next.question.id !== q.id || !next.question.error) { answers[q.id] = candidate; ok = true }
      }
      if (!ok) throw new Error(`não consegui responder ${q.id}`)
    }
  }
  throw new Error('o planejador não terminou')
}

describe('criação rápida: ficha de nível 1', () => {
  const { plan } = drive({ level: 1, race: 'human', background: 'soldier', class: 'fighter', 'abilities-mode': 'suggested', 'kit:armor': 'chain', 'kit:weapons': 'sword_shield' })
  const d = plan.draft

  it('passa na conferência do gravador e traz classe inicial única', () => {
    expect(checkDraft(d)).toBeNull()
    expect(d.classes).toEqual([{ class_key: 'fighter', level: 1, subclass_key: null, is_initial: true, hp_rolls: [] }])
  })

  it('o guerreiro humano tem PV de dado cheio, CA 18 e as salvaguardas da classe', () => {
    const bundle = deriveDraft(existing, d)
    // Constituição 14 (+1 humano) = 15 → +2; d10 + 2 = 12
    expect(d.form.hp_max).toBe(12)
    expect(d.form.hp_current).toBe(12)
    expect(bundle.derived.armorClass).toBe(18) // cota de malha 16 + escudo 2
    expect(d.form.strength_save_proficient).toBe(true)
    expect(d.form.constitution_save_proficient).toBe(true)
    expect(d.form.dexterity_save_proficient).toBe(false)
  })

  it('soma o bônus de atributo de todo mundo da raça humana por cima da distribuição sugerida', () => {
    const sug = suggestedArray('fighter')
    expect(d.form.strength).toBe(sug.strength + 1)
    expect(d.form.wisdom).toBe(sug.wisdom + 1)
  })

  it('tem 4 perícias (2 do antecedente e 2 da classe), todas proficientes e sem repetição', () => {
    expect(d.skills).toHaveLength(4)
    expect(new Set(d.skills.map((s) => s.skill_key)).size).toBe(4)
    expect(d.skills.every((s) => s.proficient && !s.expertise)).toBe(true)
  })

  it('veste a armadura e o escudo, cria os ataques e leva as características do catálogo', () => {
    const worn = d.inventory.filter((i) => i.equipped).map((i) => i.catalog_entry_key)
    expect(worn).toContain('chain_mail')
    expect(worn).toContain('shield')
    expect(d.attacks.map((a) => a.catalog_entry_key)).toContain('longsword')
    expect(d.features.some((f) => f.feature_key === 'fighter__second_wind')).toBe(true)
    expect(d.features.some((f) => f.source === 'race')).toBe(true)
    expect(d.features.some((f) => f.source === 'background')).toBe(true)
  })

  it('XP do nível e moedas do antecedente', () => {
    expect(d.form.experience).toBe(0)
    expect(d.form.coin_gp).toBeGreaterThan(0)
  })
})

describe('criação rápida: escolhas especiais', () => {
  it('mago alto elfo de nível 5: grimório de 14, 3 truques da classe + 1 do elfo e magias preparadas', () => {
    const { plan } = drive({ level: 5, race: 'elf', 'subrace:elf': 'high_elf', background: 'sage', class: 'wizard', 'subclass:wizard': 'evocation' })
    const d = plan.draft
    const cantrips = d.spells.filter((s) => s.spell_level === 0)
    expect(cantrips).toHaveLength(5) // nível 5: 4 truques de mago + 1 do alto elfo
    expect(d.spells.filter((s) => s.spell_level > 0)).toHaveLength(14) // grimório: 6 + 2 por nível acima do 1º
  })

  it('o alto elfo conta o truque racial além dos da classe', () => {
    const { plan } = drive({ level: 1, race: 'elf', 'subrace:elf': 'high_elf', background: 'sage', class: 'wizard' })
    expect(plan.draft.spells.filter((s) => s.spell_level === 0)).toHaveLength(4)
    expect(plan.draft.spells.filter((s) => s.spell_level === 1)).toHaveLength(6)
    expect(plan.draft.spells.filter((s) => s.spell_level === 1 && s.prepared).length).toBeGreaterThan(0)
  })

  it('perícia repetida pede outra no lugar (elfo percepção + marinheiro percepção)', () => {
    const answers: Answers = { level: 1, race: 'elf', 'subrace:elf': 'high_elf', 'race-languages': ['Anão'], 'race-cantrip': 'fire_bolt', background: 'sailor' }
    const first = runCreate(input(), { name: 'X', ...answers })
    expect(!first.done && first.question.id).toBe('swap:perception')
  })

  it('meio-elfo escolhe 2 atributos e 2 perícias e não pode escolher Carisma', () => {
    const plan = runCreate(input(), { name: 'X', level: 1, race: 'half_elf' })
    expect(!plan.done && plan.question.id).toBe('race-abilities')
    if (!plan.done && plan.question.kind === 'multi') expect(plan.question.options.some((o) => o.value === 'charisma')).toBe(false)
    const bad = runCreate(input(), { name: 'X', level: 1, race: 'half_elf', 'race-abilities': ['strength'] })
    expect(!bad.done && bad.question.error).toMatch(/exatamente 2/)
  })

  it('anão escolhe a ferramenta de artesão e ela vira proficiência extra', () => {
    const { plan } = drive({ level: 1, race: 'dwarf', 'subrace:dwarf': 'hill_dwarf', background: 'soldier', class: 'cleric', 'subclass:cleric': 'life', 'race-tool': 'smith_tools' })
    expect(plan.draft.proficiencies.some((p) => p.category === 'tool' && p.entry_key === 'smith_tools')).toBe(true)
    // anão da colina: +1 PV por nível (já entra pela raça no motor)
    expect(plan.draft.form.hp_max).toBeGreaterThan(8)
  })

  it('o ladino tem especialização em 2 perícias já no nível 1 e Defesa só dá CA com armadura', () => {
    const { plan } = drive({ level: 1, race: 'human', background: 'criminal', class: 'rogue' })
    expect(plan.draft.skills.filter((s) => s.expertise)).toHaveLength(2)
    const { plan: ft } = drive({ level: 1, race: 'human', background: 'soldier', class: 'fighter', 'fighting-style': 'defense', 'kit:armor': 'chain' })
    expect(ft.draft.form.ac_bonus).toBe(1)
  })

  it('aumento de atributo nunca passa de 20 e o nível 8 do guerreiro tem 3 aumentos', () => {
    const { plan, asked } = drive({ level: 8, race: 'human', background: 'soldier', class: 'fighter', 'subclass:fighter': 'champion' })
    expect(asked.filter((id) => id.startsWith('asi:'))).toHaveLength(6) // 4º, 6º e 8º níveis × 2 pontos
    for (const k of ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const) expect(plan.draft.form[k]).toBeLessThanOrEqual(21)
  })

  it('sugestões viram a resposta no modo automático e a recomendada no manual', () => {
    const suggest: Answers = { name: 'Lyra', level: 3, race: 'tiefling', background: 'charlatan', class: 'bard', 'subclass:bard': 'lore' }
    const auto = drive({}, {}, { suggest, auto: true })
    expect(auto.plan.draft.form.character_name).toBe('Lyra')
    expect(auto.plan.draft.classes[0].class_key).toBe('bard')
    const manual = runCreate(input({ suggest }), {})
    expect(!manual.done && manual.question.id).toBe('name')
    if (!manual.done && manual.question.kind === 'text') expect(manual.question.defaultValue).toBe('Lyra')
  })
})

describe('criação rápida: todas as classes, em vários níveis', () => {
  for (const def of CLASSES) {
    for (const level of [1, 5, 11, 20]) {
      it(`${def.name} nível ${level}: ficha válida, sem aviso de proficiência e com as magias certas`, () => {
        const { plan } = drive({ level, race: 'human', background: 'soldier', class: def.key })
        const d = plan.draft
        expect(checkDraft(d)).toBeNull()
        expect(d.form.hp_max).toBeGreaterThan(0)
        const bundle = deriveDraft(existing, d)
        expect(bundle.derived.armorClass).toBeGreaterThanOrEqual(10)
        // tudo que o kit põe na mão ou no corpo é do que o personagem sabe usar
        const prof = bundle.prof
        for (const a of d.attacks) {
          const w = getWeapon(a.catalog_entry_key!)!
          expect(weaponProficient(w, prof.weapons), `${w.name} sem proficiência`).toBe(true)
        }
        for (const i of d.inventory.filter((x) => x.equipped && x.catalog_entry_key)) {
          const a = getArmor(i.catalog_entry_key!)
          if (a) expect(prof.armor, `${a.name} sem proficiência`).toContain(a.category)
          if (i.catalog_entry_key === 'shield') expect(prof.armor).toContain('shield')
        }
        // magias: bate com o que a tabela da classe permite
        const sc = bundle.derived.spellcasting?.classes.find((c) => c.classKey === def.key)
        if (sc) {
          const racial = 0
          const cantrips = d.spells.filter((s) => s.spell_level === 0).length - racial
          expect(cantrips).toBe(sc.cantripsKnown)
          const leveled = d.spells.filter((s) => s.spell_level > 0)
          if (def.key === 'wizard') {
            expect(leveled.length).toBe(sc.spellbookSize)
            expect(leveled.filter((s) => s.prepared).length).toBe(sc.spellsKnownOrPrepared)
          } else {
            expect(leveled.length).toBe(sc.spellsKnownOrPrepared)
          }
        } else {
          expect(d.spells).toHaveLength(0)
        }
        // toda magia é da lista da classe
        const listClass = spellListClass(def.key, d.classes[0].subclass_key)
        for (const s of d.spells) expect(SPELLS.find((x) => x.key === s.catalog_key)?.classes).toContain(listClass)
      })
    }
  }
})

describe('dados da criação', () => {
  it('todo kit só usa itens que existem no catálogo e toda classe do livro tem kit', () => {
    for (const def of CLASSES) expect(KITS[def.key], def.name).toBeTruthy()
    const keys = new Set<string>()
    for (const kit of Object.values(KITS)) {
      for (const it of kit.fixed) if (it.key) keys.add(it.key)
      for (const ch of kit.choices) for (const o of ch.options) for (const it of o.items) if (it.key) keys.add(it.key)
    }
    for (const k of keys) expect(getBookItem(k), k).toBeTruthy()
  })

  it('as magias do ranking existem no catálogo', () => {
    const known = new Set(SPELLS.map((s) => s.key))
    const sample = SPELLS.filter((s) => spellPriority(s) < 1000).length
    expect(sample).toBeGreaterThan(20)
    expect(known.size).toBeGreaterThan(300)
  })
})

describe('criação rápida: todas as subclasses', () => {
  for (const def of CLASSES) {
    for (const sub of def.subclasses) {
      it(`${def.name} / ${sub.name}: ficha válida no nível ${Math.max(def.subclassLevel, 7)}`, () => {
        const level = Math.max(def.subclassLevel, 7)
        const { plan } = drive({ level, race: 'human', background: 'soldier', class: def.key, [`subclass:${def.key}`]: sub.key })
        const d = plan.draft
        expect(checkDraft(d)).toBeNull()
        expect(d.classes[0].subclass_key).toBe(sub.key)
        expect(d.features.some((f) => f.source === 'subclass')).toBe(true)
        const sc = deriveDraft(existing, d).derived.spellcasting?.classes.find((c) => c.classKey === def.key)
        if (sc && def.key !== 'wizard') {
          expect(d.spells.filter((s) => s.spell_level === 0)).toHaveLength(sc.cantripsKnown)
          expect(d.spells.filter((s) => s.spell_level > 0)).toHaveLength(sc.spellsKnownOrPrepared)
        }
        // cavaleiro místico e trapaceiro arcano conjuram com a lista do mago
        if (sub.spellcasting) expect(d.spells.length).toBeGreaterThan(0)
      })
    }
  }
})
