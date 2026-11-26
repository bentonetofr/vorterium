import { describe, expect, it } from 'vitest'
import { armorEntry } from '../catalog/armor'
import { dhClass } from '../catalog/classes'
import { weaponEntry } from '../catalog/weapons'
import { evasion, hpSlots } from './derive'
import { QUESTIONS, answered, recommend, type NarrativeAnswers } from './narrative'
import { buildQuickSheet, traitsValid } from './quick'

function base(over: NarrativeAnswers = {}): NarrativeAnswers {
  // respostas neutras: a primeira opção de cada pergunta obrigatória, o resto vem do teste
  const a: NarrativeAnswers = { nome: ['Teste'], nivel: ['1'] }
  for (const q of QUESTIONS) {
    if (q.kind === 'text') continue
    if (q.id === 'nivel') continue
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
