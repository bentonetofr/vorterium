import { describe, expect, it } from 'vitest'
import { SPELLS } from '../catalog/spells'
import { makeSheet } from '../components/fixtures'
import { deriveDraft } from './ctx'
import { dandrelisInput, drive, readDandrelis, realistic } from './import.testkit'
import { runImport } from './plan'
import { parseClasses } from './steps/basics'
import type { ImportInput } from './types'

describe('importação: identidade, classe, origem e atributos', () => {
  it('lê a classe do texto do PDF e pergunta só o que o PDF não diz', () => {
    const first = runImport(dandrelisInput(), {})
    expect(first.done).toBe(false)
    if (first.done) return
    // Bardo 5 já tem Colégio de Bardo, e o PDF não diz qual
    expect(first.question.id).toBe('subclass:bard')
    expect(first.question.kind).toBe('choice')
  })

  it('parseClasses entende vários jeitos de escrever', () => {
    expect(parseClasses('Bard Nível 5').rows.map((r) => [r.key, r.level])).toEqual([['bard', 5]])
    expect(parseClasses('Bardo 3 / Mago 2').rows.map((r) => [r.key, r.level])).toEqual([['bard', 3], ['wizard', 2]])
    expect(parseClasses('Guerreiro (Campeão) 5').rows.map((r) => [r.key, r.level])).toEqual([['fighter', 5]])
    expect(parseClasses('Fighter level 4, Rogue 1').rows).toHaveLength(2)
    // classe que o livro não tem entra como classe própria, com o nome do PDF
    const own = parseClasses('Artífice 3')
    expect(own.problem).toBeNull()
    expect(own.rows[0]).toMatchObject({ def: null, name: 'Artífice', level: 3 })
    expect(parseClasses('Bardo').problem).not.toBeNull()
    expect(parseClasses('Bardo 15 / Mago 8').problem).toMatch(/20/)
    expect(parseClasses('').problem).not.toBeNull()
  })

  it('com o Colégio escolhido, vem o XP inválido ("MUITA")', () => {
    const r1 = runImport(dandrelisInput(), { 'subclass:bard': 'lore' })
    expect(r1.done).toBe(false)
    if (r1.done) return
    expect(r1.question).toMatchObject({ id: 'xp', kind: 'number' })
    expect(r1.question.body).toContain('MUITA')
  })

  it('número fora do limite volta a mesma pergunta com o motivo', () => {
    const r = runImport(dandrelisInput(), { 'subclass:bard': 'lore', xp: -5 })
    expect(r.done).toBe(false)
    if (r.done) return
    expect(r.question.id).toBe('xp')
    expect(r.question.error).toMatch(/número de 0 a/)
  })

  it('classe digitada à mão numa pergunta é validada e aceita multiclasse', () => {
    const base: ImportInput = { read: { ...readDandrelis(), identity: { ...readDandrelis().identity, classText: '' } }, existing: makeSheet(), spells: SPELLS }
    const first = runImport(base, {})
    expect(first.done).toBe(false)
    if (first.done) return
    expect(first.question).toMatchObject({ id: 'classes', kind: 'text' })
    const bad = runImport(base, { classes: 'Bardo' })
    expect(bad.done).toBe(false)
    if (!bad.done) expect(bad.question.error).toBeTruthy()
    // classe que o livro não tem: aceita como própria e pergunta o dado de vida
    const own = runImport(base, { classes: 'Artífice 3' })
    expect(own.done).toBe(false)
    if (!own.done) expect(own.question.id).toBe('hb-die:artifice')
    const ok = runImport(base, { classes: 'Bardo 3 / Mago 2', 'subclass:bard': 'lore' })
    expect(ok.done).toBe(false)
    if (!ok.done) expect(ok.question.id).toBe('subclass:wizard')   // Mago escolhe a escola no nível 2
  })
})

describe('importação completa da ficha do Dandrelis', () => {
  const run = () => {
    const { result, answers, asked } = drive(realistic)
    if (!result.done) throw new Error('não terminou')
    return { draft: result.draft, answers, asked }
  }

  it('faz só as perguntas que precisam (nada é adivinhado em silêncio)', () => {
    const { asked } = run()
    expect(asked.map((q) => q.id)).toEqual([
      'subclass:bard', 'xp', 'items', 'spell:sussurros_dissonantes', 'spell:perdicao', 'spell:esquentar_metal', 'slots-marks',
      'features', 'dest:appearance', 'dest:bio', 'hp', 'hitdice:8', 'diverge',
    ])
  })

  it('identidade, classe, origem e atributos', () => {
    const { draft } = run()
    expect(draft.form).toMatchObject({
      character_name: 'Dandrelis Eldricon', player_name: 'Cisco', alignment: '', race_key: 'half_elf', subrace_key: '', background_key: 'entertainer',
      experience: 6500, level: 5, strength: 13, dexterity: 15, constitution: 13, intelligence: 13, wisdom: 16, charisma: 18,
      dexterity_save_proficient: true, charisma_save_proficient: true, strength_save_proficient: false,
      coin_gp: 120, coin_cp: 0,
    })
    expect(draft.classes).toMatchObject([{ class_key: 'bard', level: 5, subclass_key: 'lore', is_initial: true }])
  })

  it('perícias, proficiências, ataques, inventário e características', () => {
    const { draft } = run()
    expect(draft.skills.map((s) => s.skill_key).sort()).toEqual(['acrobatics', 'deception', 'history', 'insight', 'medicine', 'perception', 'performance', 'persuasion'])
    expect(draft.skills.every((s) => !s.expertise)).toBe(true)
    expect(draft.proficiencies.map((p) => `${p.category}:${p.label}`).sort()).toEqual(['language:Anão', 'tool:Banjo', 'tool:Flauta', 'tool:Harpa'])
    expect(draft.attacks).toMatchObject([
      { name: 'Besta leve', catalog_entry_key: 'light_crossbow', damage_type: 'perfurante', damage: '' },
      { name: 'Adaga', catalog_entry_key: 'dagger', damage_type: 'perfurante' },
    ])
    expect(draft.inventory.map((i) => i.name)).toEqual(['Couro', 'Pacote de Diplomata', 'Banjo', 'Flauta', 'Presente de Admirador secreto', 'Traje de bardo', 'Algibeira'])
    expect(draft.inventory[0]).toMatchObject({ catalog_entry_key: 'leather', equipped: true })
    expect(draft.inventory.filter((i) => i.equipped)).toHaveLength(1)
    expect(draft.features.map((f) => f.name)).toEqual(['LÍDER INSPIRADOR', 'Ancestral Feérico', 'Especialização', 'Inspiração de Bardo', 'Pau para Toda Obra', 'Canção de Descanso', 'Palavras de Interrupção'])
    expect(draft.features.find((f) => f.name === 'LÍDER INSPIRADOR')).toMatchObject({ source: 'feat', feature_key: null })
    expect(draft.features.find((f) => f.name === 'LÍDER INSPIRADOR')?.notes).toContain('Pré-requisito')
  })

  it('magias: as do catálogo ligadas à chave, a de outra tradução pela carta e a de fora do SRD como própria', () => {
    const { draft } = run()
    const byName = new Map(draft.spells.map((s) => [s.name, s]))
    expect(draft.spells).toHaveLength(10)
    expect(byName.get('Mensagem')).toMatchObject({ catalog_key: 'message', spell_level: 0 })
    expect(byName.get('Praga')).toMatchObject({ catalog_key: 'bane', spell_level: 1 })              // "Perdição" no PDF
    expect(byName.get('Metal Quente')).toMatchObject({ catalog_key: 'heat_metal', spell_level: 2 }) // "Esquentar Metal" no PDF
    const own = byName.get('Sussurros Dissonantes')!
    expect(own).toMatchObject({ catalog_key: null, spell_level: 1, spell_range: '18 metros', casting_time: '1 ação', duration: 'Instantânea' })
    expect(own.description.length).toBeGreaterThan(40)
    expect(draft.slotsUsed).toEqual({ 1: 3, 2: 3 })
  })

  it('PV: ajusta as rolagens de cada nível e o motor de regras dá exatamente os 28 do PDF', () => {
    const { draft } = run()
    const d = deriveDraft(makeSheet(), draft).derived
    expect(d.hpMax).toBe(28)
    expect(draft.form.hp_max).toBe(28)
    expect(draft.form.hp_current).toBe(15)
    expect(draft.overrides).toEqual([])
    expect(draft.form.hit_dice_used).toEqual({ '8': 2 })    // restam 3 de 5
  })

  it('conferência: com "usar o sistema" nenhum valor manual é criado; com "manter o PDF" cada diferença vira manual', () => {
    expect(run().draft.overrides).toEqual([])
    const kept = drive((q) => (q.id === 'diverge' ? 'pdf' : realistic(q))).result
    if (!kept.done) throw new Error('não terminou')
    const fields = kept.draft.overrides.map((o) => o.field_key)
    expect(fields).toEqual(expect.arrayContaining(['armor_class', 'initiative_bonus', 'skill_stealth', 'skill_survival', 'spell_save_dc', 'spell_attack_bonus']))
    expect(kept.draft.overrides.every((o) => o.reason === 'Importado do PDF')).toBe(true)
    // com os valores manuais, a ficha mostra exatamente os números do PDF
    const d = deriveDraft(makeSheet(), kept.draft).derived
    expect(d.armorClass).toBe(10)
    expect(d.skills.stealth.bonus).toBe(2)
    expect(d.initiative).toBe(2)
    expect(d.spellStats?.saveDc).toBe(14)
  })

  it('"decidir um por um" pergunta cada diferença', () => {
    const each = drive((q) => (q.id === 'diverge' ? 'each' : q.id.startsWith('diverge:') ? (q.id === 'diverge:armor_class' ? 'pdf' : 'system') : realistic(q)))
    expect(each.asked.filter((q) => q.id.startsWith('diverge:')).length).toBeGreaterThanOrEqual(10)
    if (!each.result.done) throw new Error('não terminou')
    expect(each.result.draft.overrides.map((o) => o.field_key)).toEqual(['armor_class'])
  })

  it('a aparência e os dados físicos vão para a História, sob a marcação, sem apagar o que já havia', () => {
    const { draft } = run()
    expect(draft.form.backstory.startsWith('Vem do norte.')).toBe(true)
    expect(draft.form.backstory).toContain('— Importado do PDF —')
    expect(draft.form.backstory).toContain('Idade: 32 · Altura: 1,60 · Peso: 64kg · Olhos: verdes · Pele: branca · Cabelo: ondulado · Facção: Zhentarim')
    expect(draft.form.backstory).toContain('ANOTAÇÃO:')
  })

  it('o plano é puro: as mesmas respostas dão o mesmo rascunho, e tirar a última resposta volta uma pergunta', () => {
    const a = run()
    const b = run()
    expect(JSON.stringify(a.draft)).toBe(JSON.stringify(b.draft))
    const trimmed = { ...a.answers }
    delete trimmed.diverge
    const again = runImport(dandrelisInput(), trimmed)
    expect(again.done).toBe(false)
    if (!again.done) expect(again.question.id).toBe('diverge')
  })

  it('classe e raça fora do livro: entram como próprias, com perguntas pelo que o livro daria', () => {
    const input = dandrelisInput()
    input.read.identity.classText = 'Caçador de Sangue 4'
    input.read.identity.raceText = 'Tabaxi'
    input.read.combat.vision = ''
    const answers: Record<string, string | number | string[]> = {}
    const asked: string[] = []
    let r = runImport(input, answers)
    // responde as perguntas da classe e da raça próprias e o que vier, com a primeira opção
    for (let guard = 0; guard < 80 && !r.done; guard++) {
      const q = r.question
      asked.push(q.id)
      if (q.id.startsWith('hb-die:')) answers[q.id] = '10'
      else if (q.id.startsWith('hb-sub:')) answers[q.id] = 'Ordem do Lycan'
      else if (q.id.startsWith('hb-cast:')) answers[q.id] = 'intelligence'
      else if (q.id === 'race') answers[q.id] = 'own'
      else if (q.id === 'hb-vision') answers[q.id] = '60'
      else if (q.kind === 'choice') answers[q.id] = q.recommended ?? q.options[0].value
      else if (q.kind === 'multi') answers[q.id] = q.options.filter((o) => o.checked).map((o) => o.value)
      else if (q.kind === 'number') answers[q.id] = q.defaultValue ?? q.min
      else answers[q.id] = q.defaultValue || 'x'
      r = runImport(input, answers)
    }
    expect(r.done).toBe(true)
    if (!r.done) return
    expect(asked).toEqual(expect.arrayContaining(['hb-die:cacador_de_sangue', 'hb-sub:cacador_de_sangue', 'hb-cast:cacador_de_sangue', 'race', 'hb-vision']))
    const f = r.draft.form
    expect(r.draft.classes[0]).toMatchObject({ class_key: 'cacador_de_sangue', level: 4, is_initial: true })
    expect(f.class_names.cacador_de_sangue).toBe('Caçador de Sangue')
    expect(f.homebrew_hit_die.cacador_de_sangue).toBe(10)
    expect(f.subclass_names.cacador_de_sangue).toBe('Ordem do Lycan')
    expect(f.race_custom).toBe('Tabaxi')
    expect(f.race_key).toBe('')
    expect(f.vision_ft).toBe(60)
  })
})
