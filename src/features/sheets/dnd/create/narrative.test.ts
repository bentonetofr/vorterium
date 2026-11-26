import { describe, expect, it } from 'vitest'
import { SPELLS } from '../catalog/spells'
import { makeSheet } from '../components/fixtures'
import { checkDraft } from '../import/importService'
import { alignmentOf, answeredN, narrativeResult, NQUESTIONS, primeSpellCache, profileOf, UNSURE, visibleQuestions, type NAnswers } from './narrative'
import { runCreate } from './plan'

const existing = makeSheet({ character_name: null, race_key: null, subrace_key: null, background_key: null, class_key: null, level: 1, experience: 0 })
primeSpellCache(SPELLS)

/** Respostas neutras: a primeira opção de cada pergunta obrigatória (e perguntas de cena/história escondidas). */
function base(over: NAnswers = {}): NAnswers {
  const a: NAnswers = { nome: 'Teste', nivel: 1, ideias: 'muitas' }
  for (const q of NQUESTIONS) {
    if (q.kind === 'choice' && q.id !== 'ideias') a[q.id] = q.options![0].value
  }
  return { ...a, ...over }
}

function build(a: NAnswers) {
  const r = narrativeResult(a)
  const plan = runCreate({ existing, spells: SPELLS, suggester: r.suggester, extras: r.extras, auto: true }, {})
  if (!plan.done) throw new Error(`pendente: ${plan.question.id} ${plan.question.error ?? ''}`)
  return plan.draft
}

describe('narrativa de D&D', () => {
  it('um erudito que só quer magia vira mago', () => {
    const d = build(base({ arquetipo: 'erudito', magia: 'central', fonte: 'estudo', papel: 'mente', resistencia: 'fragil', arma: 'cajado', posicao: 'longe', aparencia: 'inventor', oficio: 'sabio' }))
    expect(d.classes[0].class_key).toBe('wizard')
    expect(d.form.race_key).toBe('gnome')
    expect(d.form.background_key).toBe('sage')
    expect(d.form.intelligence).toBeGreaterThanOrEqual(15)
  })

  it('um protetor sem magia vira uma classe de linha de frente e leva armadura pesada e escudo', () => {
    const d = build(base({ arquetipo: 'protetor', magia: 'nenhuma', papel: 'prote', posicao: 'frente', resistencia: 'aguenta', arma: 'espada', armadura: 'pesada', fonte: 'treino', aparencia: 'barba', oficio: 'soldado' }))
    expect(['fighter', 'paladin', 'barbarian']).toContain(d.classes[0].class_key)
    expect(d.form.race_key).toBe('dwarf')
    expect(d.inventory.some((i) => i.equipped && i.catalog_entry_key === 'shield')).toBe(true)
  })

  it('um caçador com arco vira patrulheiro e leva arma à distância', () => {
    const d = build(base({ arquetipo: 'cacador', magia: 'nenhuma', fonte: 'natureza', posicao: 'longe', arma: 'arco', papel: 'batedor', companheiro: 'sim', aparencia: 'orelhas', oficio: 'forasteiro' }))
    expect(d.classes[0].class_key).toBe('ranger')
    expect(d.form.race_key).toBe('elf')
    expect(d.attacks.some((a) => ['longbow', 'shortbow'].includes(a.catalog_entry_key ?? ''))).toBe(true)
  })

  it('um trapaceiro furtivo vira ladino com especialização em perícias furtivas', () => {
    const d = build(base({ arquetipo: 'trapaceiro', magia: 'nenhuma', posicao: 'sombra', ameaca: 'surpresa', arma: 'adagas', resistencia: 'desvia', armadura: 'leve', papel: 'batedor', fonte: 'esperteza', aparencia: 'baixinho', oficio: 'criminoso' }))
    expect(d.classes[0].class_key).toBe('rogue')
    expect(d.skills.filter((s) => s.expertise)).toHaveLength(2)
  })

  it('um artista que lidera pela voz vira bardo com instrumento', () => {
    const d = build(base({ arquetipo: 'artista', papel: 'lider', fonte: 'arte', magia: 'pouca', posicao: 'meio', oficio: 'artista', aparencia: 'mistura' }))
    expect(d.classes[0].class_key).toBe('bard')
    expect(d.form.race_key).toBe('half_elf')
    expect(d.inventory.some((i) => ['lute', 'flute', 'lyre', 'drum', 'viol', 'horn'].includes(i.catalog_entry_key ?? ''))).toBe(true)
  })

  it('o campeão da fé que cura vira clérigo ou paladino', () => {
    const d = build(base({ arquetipo: 'curandeiro', fonte: 'fe', papel: 'cura', magia: 'central', posicao: 'meio', oficio: 'acolito' }))
    expect(['cleric', 'paladin', 'druid']).toContain(d.classes[0].class_key)
  })

  it('o traço físico e o ofício decidem a raça e o antecedente', () => {
    expect(build(base({ aparencia: 'escamas' })).form.race_key).toBe('dragonborn')
    expect(build(base({ aparencia: 'chifres' })).form.race_key).toBe('tiefling')
    expect(build(base({ aparencia: 'presas' })).form.race_key).toBe('half_orc')
    expect(build(base({ oficio: 'marujo' })).form.background_key).toBe('sailor')
  })

  it('a tendência sai dos dois eixos e o nível e o nome entram', () => {
    expect(alignmentOf(profileOf(base({ ordem: 'leal', bondade: 'bom' })))).toBe('Leal e Bom')
    expect(alignmentOf(profileOf(base({ ordem: 'caotico', bondade: 'mau' })))).toBe('Caótico e Mau')
    expect(alignmentOf(profileOf(base({ ordem: 'neutro', bondade: 'neutro' })))).toBe('Neutro')
    const d = build(base({ nome: 'Lyra', nivel: 3, ordem: 'leal', bondade: 'bom' }))
    expect(d.form.character_name).toBe('Lyra')
    expect(d.form.alignment).toBe('Leal e Bom')
    expect(d.classes[0].level).toBe(3)
  })

  it('os textos de personalidade viram traços, ideais, vínculos e defeitos', () => {
    const d = build(base({ motivacao: 'vinganca', jeito: 'amigavel', vinculo: 'mentor', defeito: 'orgulho', mundo: 'heroi', frase: 'Uma desertora', sonho: 'Voltar para casa' }))
    expect(d.form.ideals).toContain('vingança')
    expect(d.form.personality_traits.length).toBeGreaterThan(5)
    expect(d.form.bonds).toContain('mentor')
    expect(d.form.flaws).toContain('Orgulho')
    expect(d.form.backstory).toContain('Uma desertora')
    expect(d.form.backstory).toContain('Voltar para casa')
  })

  it('quem tem pouca ideia vê cenas; quem tem muita vê as perguntas de história', () => {
    const few = visibleQuestions({ ideias: 'nenhuma' }).map((q) => q.id)
    const many = visibleQuestions({ ideias: 'muitas' }).map((q) => q.id)
    expect(few).toContain('cena_dragao')
    expect(few).not.toContain('sonho')
    expect(many).not.toContain('cena_dragao')
    expect(many).toContain('sonho')
  })

  it('"não sei" conta como resposta e tudo "não sei" ainda gera uma ficha válida', () => {
    const a: NAnswers = { nome: 'Sem Ideia', nivel: 1, ideias: 'nenhuma' }
    for (const q of visibleQuestions(a)) if (q.kind === 'choice' && q.id !== 'ideias') a[q.id] = UNSURE
    for (const q of visibleQuestions(a)) if (q.kind === 'choice') expect(answeredN(q, a)).toBe(true)
    const d = build(a)
    expect(checkDraft(d)).toBeNull()
    expect(d.classes).toHaveLength(1)
  })

  it('qualquer combinação de respostas gera uma ficha válida (150 sorteios, níveis 1 a 20)', () => {
    let seed = 11
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    for (let i = 0; i < 150; i++) {
      const a: NAnswers = { nome: 'Sorteio', nivel: 1 + Math.floor(rnd() * 20) }
      for (const q of NQUESTIONS) {
        if (q.kind === 'choice') a[q.id] = q.options![Math.floor(rnd() * q.options!.length)].value
        else if (q.kind === 'multi') a[q.id] = q.options!.filter(() => rnd() < 0.3).map((x) => x.value)
      }
      const d = build(a)
      expect(checkDraft(d), `sorteio ${i}`).toBeNull()
      expect(d.form.hp_max).toBeGreaterThan(0)
      expect(d.form.hp_current).toBe(d.form.hp_max)
      expect(d.skills.length).toBeGreaterThanOrEqual(4)
      expect(d.inventory.length).toBeGreaterThan(0)
    }
  })

  it('mais de 25 perguntas, todas com texto e opções quando são de escolha', () => {
    expect(NQUESTIONS.length).toBeGreaterThanOrEqual(25)
    for (const q of NQUESTIONS) {
      if (q.kind === 'choice' || q.kind === 'multi') {
        expect(q.options!.length, q.id).toBeGreaterThanOrEqual(2)
        expect(new Set(q.options!.map((o) => o.value)).size, q.id).toBe(q.options!.length)
      }
    }
  })
})
