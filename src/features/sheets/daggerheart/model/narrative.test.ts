import { describe, expect, it } from 'vitest'
import { armorEntry } from '../catalog/armor'
import { dhClass } from '../catalog/classes'
import { weaponEntry } from '../catalog/weapons'
import { evasion, hpSlots } from './derive'
import { DONT_KNOW, QUESTIONS, answered, recommend, visibleQuestions, type NarrativeAnswers } from './narrative'
import { buildQuickSheet, traitsValid } from './quick'

function base(over: NarrativeAnswers = {}): NarrativeAnswers {
  // respostas neutras: a primeira opção de cada pergunta obrigatória, o resto vem do teste
  const a: NarrativeAnswers = { nome: ['Teste'], nivel: ['1'], ideias: ['muitas'] }
  for (const q of QUESTIONS) {
    if (q.kind === 'text') continue
    if (q.id === 'nivel' || q.id === 'ideias') continue
    a[q.id] = [q.options![0].id]
  }
  return { ...a, ...over }
}

describe('ficha por narrativa', () => {
  it('um erudito que só quer magia vira Mago', () => {
    const r = recommend(base({ arquetipo: ['erudito'], magia: ['central'], fonte: ['estudo'], papel: ['mente'], arma: ['varinha'], aparencia: ['mente'], resistencia: ['fragil'] }))
    expect(r.answers.classKey).toBe('mago')
    expect(r.answers.subclassKey).toBe('disc_conhecimento')
  })

  it('um protetor sem magia que segura a linha vira Guardião', () => {
    const r = recommend(base({ arquetipo: ['protetor'], magia: ['nenhuma'], papel: ['prote'], posicao: ['frente'], resistencia: ['aguenta'], ameaca: ['protege'], fonte: ['vinganca'], armadura: ['placas'], aparencia: ['musculo'] }))
    expect(r.answers.classKey).toBe('guardiao')
    expect(r.answers.armorId).toBe('full-plate-armor')
  })

  it('um caçador com arco e um bicho ao lado vira Patrulheiro Treinador', () => {
    const r = recommend(base({ arquetipo: ['domador'], companheiro: ['sim'], arma: ['arco'], posicao: ['longe'], fonte: ['natureza'], magia: ['nenhuma'], quero: ['bicho', 'rapido'], papel: ['batedor'] }))
    expect(r.answers.classKey).toBe('patrulheiro')
    expect(r.answers.subclassKey).toBe('treinador')
    expect(weaponEntry(r.answers.primaryId)?.range).toMatch(/distante/)
  })

  it('um trapaceiro furtivo de adagas vira Ladino', () => {
    const r = recommend(base({ arquetipo: ['trapaceiro'], posicao: ['sombra'], ameaca: ['surpresa'], arma: ['adagas'], magia: ['nenhuma'], resistencia: ['desvia'], armadura: ['gibao'] }))
    expect(r.answers.classKey).toBe('ladino')
    expect(r.answers.armorId).toBe('gambeson-armor')
  })

  it('um artista que lidera pela voz vira Bardo', () => {
    const r = recommend(base({ arquetipo: ['artista'], papel: ['lider'], fonte: ['arte'], aparencia: ['musica'], magia: ['pouca'], posicao: ['meio'], quero: ['cena'] }))
    expect(r.answers.classKey).toBe('bardo')
  })

  it('o que a pessoa descreveu no corpo decide a ancestralidade', () => {
    expect(recommend(base({ traco: ['orelhas'] })).answers.ancestryKey).toBe('elfo')
    expect(recommend(base({ traco: ['metal'] })).answers.ancestryKey).toBe('clank')
    expect(recommend(base({ traco: ['casco'] })).answers.ancestryKey).toBe('galapa')
  })

  it('o lugar onde cresceu decide a comunidade', () => {
    expect(recommend(base({ comunidade: ['mar'] })).answers.communityKey).toBe('maritima')
    expect(recommend(base({ comunidade: ['floresta'] })).answers.communityKey).toBe('silvestre')
  })

  it('sangue misto escolhe uma segunda ancestralidade diferente da primeira', () => {
    const r = recommend(base({ traco: ['asas'], mista: ['sim'] }))
    expect(r.answers.ancestry2Key).toBeTruthy()
    expect(r.answers.ancestry2Key).not.toBe(r.answers.ancestryKey)
    expect(recommend(base({ mista: ['nao'] })).answers.ancestry2Key).toBeNull()
  })

  it('as Experiências vêm do ofício e do talento, ou da frase sobre o passado', () => {
    const a = recommend(base({ oficio: ['ferreiro'], talento: ['prata'] })).answers
    expect(a.experiences).toEqual(['Ferreiro', 'Língua de prata'])
    expect(recommend(base({ passado: ['Ex-guarda-costas do rei caído'], oficio: ['soldado'] })).answers.experiences[0]).toBe('Ex-guarda-costas do rei caído')
  })

  it('o nível e os textos entram nas respostas e nas anotações', () => {
    const r = recommend(base({ nivel: ['4'], pronomes: ['Ela/Dela'], frase: ['Uma desertora'], sonho: ['Voltar para casa'] }))
    expect(r.answers.level).toBe(4)
    expect(r.answers.pronouns).toBe('Ela/Dela')
    expect(r.notes).toContain('Uma desertora')
    expect(r.notes).toContain('Voltar para casa')
  })

  it('não dá arma mágica a quem não conjura', () => {
    const r = recommend(base({ arquetipo: ['guerreiro'], magia: ['nenhuma'], arma: ['punhos'] }))
    const cls = dhClass(r.answers.classKey)!
    const sub = cls.subclasses.find((s) => s.key === r.answers.subclassKey)!
    if (!sub.spellcast) expect(weaponEntry(r.answers.primaryId)?.damageType).toBe('fis')
  })

  it('pergunta obrigatória sem resposta não deixa seguir; texto opcional sim', () => {
    const nome = QUESTIONS.find((q) => q.id === 'nome')!
    const frase = QUESTIONS.find((q) => q.id === 'frase')!
    expect(answered(nome, {})).toBe(false)
    expect(answered(nome, { nome: ['  '] })).toBe(false)
    expect(answered(nome, { nome: ['Ana'] })).toBe(true)
    expect(answered(frase, {})).toBe(true)
  })

  it('as mesmas respostas sempre dão a mesma ficha', () => {
    const a = base({ arquetipo: ['lider'], traco: ['pelos'] })
    expect(JSON.stringify(recommend(a).answers)).toBe(JSON.stringify(recommend(a).answers))
  })

  it('qualquer combinação de respostas gera uma ficha válida (200 sorteios)', () => {
    let seed = 7
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    for (let n = 0; n < 200; n++) {
      const a: NarrativeAnswers = { nome: ['Sorteio'] }
      for (const q of QUESTIONS) {
        if (q.kind === 'text') continue
        const ids = q.options!.map((o) => o.id)
        const take = q.kind === 'many' ? 1 + Math.floor(rnd() * (q.max ?? 1)) : 1
        const picked: string[] = []
        while (picked.length < take) { const id = ids[Math.floor(rnd() * ids.length)]; if (!picked.includes(id)) picked.push(id) }
        a[q.id] = picked
      }
      const r = recommend(a)
      const q = r.answers
      expect(q.classKey, `sorteio ${n}`).toBeTruthy()
      expect(traitsValid(q.traits)).toBe(true)
      expect(weaponEntry(q.primaryId)).toBeTruthy()
      if (q.secondaryId) expect(weaponEntry(q.secondaryId)).toBeTruthy()
      if (q.armorId) expect(armorEntry(q.armorId)).toBeTruthy()
      expect(q.cards).toHaveLength(2)
      expect(new Set(q.cards).size).toBe(2)
      expect(q.experiences[0].trim()).not.toBe('')
      expect(q.experiences[1].trim()).not.toBe('')
      expect(q.experiences[0].toLowerCase()).not.toBe(q.experiences[1].toLowerCase())
      const sheet = buildQuickSheet(q)
      expect(sheet.classKey).toBe(q.classKey)
      expect(hpSlots(sheet)).toBeGreaterThan(0)
      expect(evasion(sheet)).toBeGreaterThan(0)
      expect(sheet.loadout).toHaveLength(2)
    }
  })

  it('quem tem pouca ideia vê cenas e guia; quem tem muita vê as perguntas de história', () => {
    const few = visibleQuestions({ ideias: ['nenhuma'] }).map((q) => q.id)
    const many = visibleQuestions({ ideias: ['muitas'] }).map((q) => q.id)
    expect(few).toContain('cena_dragao')
    expect(few).not.toContain('sonho')
    expect(few).not.toContain('passado')
    expect(many).not.toContain('cena_dragao')
    expect(many).toContain('sonho')
    expect(visibleQuestions({ ideias: ['algumas'] }).map((q) => q.id)).toEqual(expect.arrayContaining(['cena_dragao', 'sonho']))
  })

  it('as cenas mostram o jeito de jogar de quem tem pouca ideia', () => {
    const sneaky = recommend(base({ ideias: ['nenhuma'], cena_dragao: ['esgueirar'], cena_festa: ['segue'], cena_ponte: ['improviso'], cena_animal: ['segue'], cena_taverna: ['sai'], cena_livro: ['arromba'], arquetipo: ['trapaceiro'], magia: ['nenhuma'] }))
    expect(sneaky.answers.classKey).toBe('ladino')
    const healer = recommend(base({ ideias: ['nenhuma'], cena_dragao: ['protege'], cena_festa: ['papo'], cena_ponte: ['fe'], cena_animal: ['cuida'], cena_taverna: ['separa'], cena_livro: ['pessoas'], arquetipo: ['curandeiro'], papel: ['cura'], posicao: ['meio'], resistencia: ['equilibra'], ameaca: ['conversa'], encurralado: ['fe'], quero: ['curar'], fonte: ['natureza'], aparencia: ['folhas'], magia: ['pouca'], motivacao: ['proteger'] }))
    expect(['druida', 'serafim', 'bardo']).toContain(healer.answers.classKey)
  })

  it('"não sei" conta como resposta e não muda a escolha; tudo "não sei" ainda gera ficha válida', () => {
    const q = QUESTIONS.find((x) => x.id === 'arquetipo')!
    expect(answered(q, { arquetipo: [DONT_KNOW] })).toBe(true)
    const a: NarrativeAnswers = { nome: ['Sem Ideia'], nivel: ['1'], ideias: ['nenhuma'] }
    for (const x of visibleQuestions(a)) if (x.kind !== 'text' && x.id !== 'nivel' && x.id !== 'ideias') a[x.id] = [DONT_KNOW]
    const r = recommend(a)
    expect(r.answers.classKey).toBeTruthy()
    expect(traitsValid(r.answers.traits)).toBe(true)
    expect(r.answers.cards).toHaveLength(2)
    expect(r.answers.experiences[0].length).toBeGreaterThan(0)
  })

  it('quem tem pouca ideia recebe um resumo e as perguntas do guia da classe nas anotações', () => {
    const r = recommend(base({ ideias: ['nenhuma'], nome: ['Lyra'] }))
    expect(r.pitch).toContain('Lyra')
    expect(r.storyPrompts.length).toBeGreaterThan(0)
    expect(r.notes).toContain(r.storyPrompts[0])
    expect(recommend(base({ ideias: ['muitas'] })).storyPrompts).toHaveLength(0)
  })

  it('as sugestões de texto existem (nome, frase, passado, sonho, item)', () => {
    for (const id of ['nome', 'frase', 'passado', 'sonho', 'item']) {
      expect(QUESTIONS.find((x) => x.id === id)!.examples!.length, id).toBeGreaterThanOrEqual(5)
    }
  })

  it('mais de 25 perguntas, todas com opções ou texto', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(25)
    for (const q of QUESTIONS) {
      if (q.kind === 'text') expect(q.options).toBeUndefined()
      else expect(q.options!.length).toBeGreaterThanOrEqual(2)
      const ids = (q.options ?? []).map((o) => o.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
