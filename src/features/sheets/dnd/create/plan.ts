import type { DndCharacterAttackInput, DndCharacterInventoryInput, DndCharacterSheet, DndCharacterSpellInput } from '../../../../shared/types'
import {
  BACKGROUNDS, FIGHTING_STYLES, RACES, WEAPONS, getArmor, getBackground, getClass, getRace, getSubrace, getTool, getWeapon, spellListClass,
  type ClassDef, type RaceDef, type SpellEntry, type SubraceDef,
} from '../catalog'
import { getBookItem } from '../catalog/itemBook'
import { homebrewKeyFromName } from '../catalog/homebrewKey'
import { SPELL_SCHOOL_LABEL } from '../catalog/spellUtils'
import { availableFeatures } from '../model/features'
import { saveColumns } from '../model/sheetModel'
import { ABILITIES, SKILLS } from '../rules/abilities'
import { xpForLevel } from '../rules/progression'
import type { AbilityKey, SkillKey } from '../rules/types'
import { weaponProficient } from '../rules/combat'
import { deriveDraft, emptyDraft } from '../import/ctx'
import { Pending, type Answer, type Answers, type ImportDraft, type Question } from '../import/types'
import {
  ABILITY_ORDER, ALIGNMENTS, ALL_SKILL_KEYS, CANTRIP_RANK, EXPERTISE_LEVELS, FIGHTING_STYLE_LEVEL, KITS, LANGUAGES, PACKS, SPELL_RANK, STANDARD_ARRAY,
  type KitItem, type KitOption,
} from './data'

// ────────────────────────────────────────────────────────
// O planejador da criação de ficha (rápida e por narrativa). Igual ao do importador de PDF: uma função pura que roda as etapas
// em ordem; cada etapa pergunta o que falta (uma pergunta por vez) e preenche o rascunho. Com as mesmas respostas devolve
// sempre o mesmo rascunho. As SUGESTÕES (vindas da narrativa) viram a opção recomendada de cada pergunta e, no modo
// automático, a própria resposta. O rascunho é gravado pelo mesmo `applyImport` do importador (com cópia de segurança e desfazer),
// nas mesmas tabelas da ficha normal, então tudo continua editável depois.
// ────────────────────────────────────────────────────────

export interface CreateInput {
  existing: DndCharacterSheet
  /** O catálogo de magias (carregado sob demanda). */
  spells: readonly SpellEntry[]
  /** Respostas sugeridas (a narrativa preenche): a opção recomendada de cada pergunta. */
  suggest?: Answers
  /** Sugere a resposta de qualquer pergunta (a narrativa decide pelo perfil); `meta` traz quantas marcar ou as opções do kit. */
  suggester?: (q: Question, meta: AskMeta) => Answer | undefined
  /** Aceita as sugestões sem perguntar (o resumo final da narrativa). */
  auto?: boolean
  /** Textos que a narrativa já escreveu (traços, ideais, vínculos, defeitos, anotações); entram na ficha se existirem. */
  extras?: Partial<Record<'personality_traits' | 'ideals' | 'bonds' | 'flaws' | 'notes', string>>
}

export interface AskMeta { count?: number; kit?: KitOption[] }

export type CreatePlan =
  | { done: false; question: Question; asked: string[] }
  | { done: true; draft: ImportDraft; asked: string[]; summary: string[] }

const ABILITY_LABEL: Record<AbilityKey, string> = Object.fromEntries(ABILITIES.map((a) => [a.key, a.label])) as Record<AbilityKey, string>
const SKILL_LABEL: Record<string, string> = Object.fromEntries(SKILLS.map((s) => [s.key, s.label]))
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const mod = (score: number) => Math.floor((score - 10) / 2)

// ── Perguntas com as sugestões aplicadas ──

function withDefaults(q: Question, s: Answer | undefined): Question {
  if (s === undefined) return q
  if (q.kind === 'choice') return typeof s === 'string' && q.options.some((o) => o.value === s) ? { ...q, recommended: s } : q
  if (q.kind === 'multi') return Array.isArray(s) ? { ...q, options: q.options.map((o) => ({ ...o, checked: s.includes(o.value) })) } : q
  if (q.kind === 'number') return typeof s === 'number' ? { ...q, defaultValue: s } : q
  return typeof s === 'string' ? { ...q, defaultValue: s } : q
}

/** No modo automático, o que vale quando ninguém sugeriu nada: a recomendada, ou a primeira opção. */
function fallbackAnswer(q: Question, meta: AskMeta): Answer | undefined {
  if (q.kind === 'choice') return q.recommended ?? q.options[0]?.value
  if (q.kind === 'multi') return q.options.slice(0, meta.count ?? q.options.length).map((o) => o.value)
  if (q.kind === 'number') return q.defaultValue ?? q.min
  return q.defaultValue ?? ''
}

interface Ctx {
  input: CreateInput
  draft: ImportDraft
  answers: Answers
  asked: string[]
  ask(q: Question, validate?: (a: Answer) => string | null, meta?: AskMeta): Answer
  choice(q: Extract<Question, { kind: 'choice' }>): string
  number(q: Extract<Question, { kind: 'number' }>): number
  text(q: Extract<Question, { kind: 'text' }>, validate?: (v: string) => string | null): string
  /** Lista com um número exato de marcados. */
  pick(q: Extract<Question, { kind: 'multi' }>, count: number, unit?: string): string[]
  summary: string[]
}

function makeCtx(input: CreateInput, answers: Answers): Ctx {
  const asked: string[] = []
  const draft = emptyDraft(input.existing)
  const suggest = input.suggest ?? {}
  const ask: Ctx['ask'] = (q, validate, meta = {}) => {
    asked.push(q.id)
    const suggested = suggest[q.id] ?? input.suggester?.(q, meta) ?? (input.auto ? fallbackAnswer(q, meta) : undefined)
    let a = answers[q.id]
    if (a === undefined && input.auto && suggested !== undefined) a = suggested
    if (a === undefined) throw new Pending(withDefaults(q, suggested))
    const problem = validate?.(a) ?? null
    if (problem) throw new Pending({ ...withDefaults(q, a), error: problem })
    return a
  }
  return {
    input, draft, answers, asked, ask, summary: [],
    choice: (q) => ask(q, (v) => (typeof v === 'string' && q.options.some((o) => o.value === v) ? null : 'Escolha uma das opções.')) as string,
    number: (q) => ask(q, (v) => (typeof v === 'number' && Number.isFinite(v) && v >= q.min && v <= q.max ? null : `Digite um número de ${q.min} a ${q.max}.`)) as number,
    text: (q, validate) => (ask(q, (v) => (typeof v === 'string' ? validate?.(v.trim()) ?? null : 'Escreva um texto.')) as string).trim(),
    pick: (q, count, unit = 'opção') => ask(q, (v) => {
      if (!Array.isArray(v) || !v.every((x) => q.options.some((o) => o.value === x))) return 'Marque só opções da lista.'
      if (new Set(v).size !== count) return `Marque exatamente ${count} ${count === 1 ? unit : `${unit}s`}.`
      return null
    }, { count }) as string[],
  }
}

const multiOpts = (list: { value: string; label: string; hint?: string }[]) => list.map((o) => ({ ...o, checked: false }))

// ── Estado da montagem ──

interface Build {
  name: string
  level: number
  race: RaceDef
  subrace: SubraceDef | null
  scores: Record<AbilityKey, number>
  skills: Map<SkillKey, 'proficient' | 'expertise'>
  languages: string[]
  tools: { key: string; label: string }[]
  racialCantrip: string | null
  cls: ClassDef
  subclassKey: string | null
}

function ownedSkill(b: Build, k: SkillKey): boolean { return b.skills.has(k) }

/** Dá uma perícia; se a pessoa já a tinha, o livro manda trocar por outra à escolha. */
function grantSkill(c: Ctx, b: Build, k: SkillKey, origin: string): void {
  if (!ownedSkill(b, k)) { b.skills.set(k, 'proficient'); return }
  const free = ALL_SKILL_KEYS.filter((x) => !ownedSkill(b, x))
  const pick = c.choice({
    id: `swap:${k}`, section: 'Perícias', kind: 'choice',
    title: `${SKILL_LABEL[k]} se repete: escolha outra perícia no lugar`,
    body: `${origin} dá ${SKILL_LABEL[k]}, mas o personagem já é proficiente nela. Pelas regras, escolha qualquer outra perícia no lugar.`,
    options: free.map((x) => ({ value: x, label: SKILL_LABEL[x] })),
  }) as SkillKey
  b.skills.set(pick, 'proficient')
}

// ── Etapas ──────────────────────────────────────────────

function identity(c: Ctx): { name: string; level: number } {
  const name = c.text({ id: 'name', section: 'Personagem', kind: 'text', title: 'Qual é o nome do personagem?', body: 'Dá para mudar depois na ficha.', placeholder: 'Nome' }, (v) => (v ? null : 'Escreva um nome.')).slice(0, 120)
  const level = c.number({
    id: 'level', section: 'Personagem', kind: 'number', title: 'Em que nível o personagem começa?',
    body: 'A maioria das mesas começa no nível 1. Em níveis mais altos, a ficha já sai com as escolhas de cada nível (magias, perícias e aumentos de atributo).',
    min: 1, max: 20, defaultValue: 1,
  })
  return { name, level }
}

function raceStep(c: Ctx, b: Partial<Build>): void {
  const raceKey = c.choice({
    id: 'race', section: 'Raça', kind: 'choice', title: 'Qual é a raça?', body: 'A raça dá bônus de atributo, deslocamento, idiomas e características.',
    options: RACES.map((r) => ({ value: r.key, label: r.name, hint: clip(r.summary, 110) })),
  })
  b.race = getRace(raceKey)!
  b.subrace = null
  if (b.race.subraces.length > 0) {
    const sk = c.choice({
      id: `subrace:${raceKey}`, section: 'Raça', kind: 'choice', title: `Qual é a sub-raça de ${b.race.name}?`,
      options: b.race.subraces.map((s) => ({ value: s.key, label: s.name, hint: clip(s.summary, 110) })),
    })
    b.subrace = getSubrace(raceKey, sk) ?? null
  }
}

function raceChoices(c: Ctx, b: Build): { abilityBonus: Partial<Record<AbilityKey, number>>; notes: string[] } {
  const { race, subrace } = b
  const bonus: Partial<Record<AbilityKey, number>> = {}
  const add = (src: Partial<Record<AbilityKey, number>> | undefined) => { for (const [k, v] of Object.entries(src ?? {})) bonus[k as AbilityKey] = (bonus[k as AbilityKey] ?? 0) + (v as number) }
  add(race.abilityBonuses); add(subrace?.abilityBonuses)
  const notes: string[] = []

  if (race.abilityChoice) {
    const ch = race.abilityChoice
    const from = ABILITIES.filter((a) => !ch.exclude.includes(a.key))
    const picked = c.pick({
      id: 'race-abilities', section: 'Raça', kind: 'multi', title: `Em quais ${ch.count} atributos ${race.name} ganha +${ch.amount}?`,
      body: `Além do bônus fixo, ${race.name} escolhe ${ch.count} atributos diferentes (menos ${ch.exclude.map((e) => ABILITY_LABEL[e]).join(' e ')}).`,
      options: multiOpts(from.map((a) => ({ value: a.key, label: a.label }))),
    }, ch.count, 'atributo')
    for (const k of picked) bonus[k as AbilityKey] = (bonus[k as AbilityKey] ?? 0) + ch.amount
    notes.push(`Bônus à escolha: ${picked.map((k) => `${ABILITY_LABEL[k as AbilityKey]} +${ch.amount}`).join(', ')}`)
  }

  for (const k of race.skills) grantSkill(c, b, k, race.name)

  if (race.skillChoices) {
    const free = ALL_SKILL_KEYS.filter((k) => !ownedSkill(b, k))
    const picked = c.pick({
      id: 'race-skills', section: 'Raça', kind: 'multi', title: `Quais ${race.skillChoices} perícias ${race.name} escolhe?`,
      options: multiOpts(free.map((k) => ({ value: k, label: SKILL_LABEL[k] }))),
    }, race.skillChoices, 'perícia')
    for (const k of picked) b.skills.set(k as SkillKey, 'proficient')
  }

  if (race.toolChoice?.length) {
    const pick = c.choice({
      id: 'race-tool', section: 'Raça', kind: 'choice', title: `Qual ferramenta de artesão ${race.name} sabe usar?`,
      options: race.toolChoice.map((k) => ({ value: k, label: getTool(k)?.name ?? k })),
    })
    b.tools.push({ key: pick, label: getTool(pick)?.name ?? pick })
  }
  for (const t of subrace?.tools ?? []) b.tools.push({ key: t, label: getTool(t)?.name ?? t })

  const extra = (race.extraLanguages ?? 0) + (subrace?.extraLanguages ?? 0)
  if (extra > 0) {
    const free = LANGUAGES.filter((l) => !race.languages.includes(l))
    const picked = c.pick({
      id: 'race-languages', section: 'Raça', kind: 'multi', title: `Que ${extra === 1 ? 'idioma extra' : `${extra} idiomas extras`} o personagem fala?`,
      body: `${race.name} fala ${race.languages.join(' e ')} e aprende ${extra === 1 ? 'mais um idioma' : `mais ${extra}`} à escolha.`,
      options: multiOpts(free.map((l) => ({ value: l, label: l }))),
    }, extra, 'idioma')
    b.languages.push(...picked)
  }

  if (subrace?.cantripChoice) {
    const cc = subrace.cantripChoice
    const list = c.input.spells.filter((s) => s.level === 0 && s.classes.includes(cc.classKey)).sort((a, z) => a.name.localeCompare(z.name, 'pt-BR'))
    const pick = c.choice({
      id: 'race-cantrip', section: 'Raça', kind: 'choice', title: `Qual truque de ${getClass(cc.classKey)?.name ?? 'mago'} o ${subrace.name} conhece?`,
      body: `${ABILITY_LABEL[cc.ability]} é o atributo de conjuração dele.`,
      options: list.map((s) => ({ value: s.key, label: s.name, hint: clip(s.text[0] ?? '', 90) })),
    })
    b.racialCantrip = pick
  }
  return { abilityBonus: bonus, notes }
}

function backgroundStep(c: Ctx, b: Build): { key: string; equipment: string[] } {
  const list = BACKGROUNDS.filter((x) => !x.custom)
  const key = c.choice({
    id: 'background', section: 'Antecedente', kind: 'choice', title: 'Qual é o antecedente?', body: 'O que o personagem fazia antes da aventura: dá perícias, equipamento e uma característica.',
    options: list.map((x) => ({ value: x.key, label: x.name, hint: clip(x.summary, 110) })),
  })
  const def = getBackground(key)!
  for (const k of def.skills) grantSkill(c, b, k, def.name)
  if (def.languagesChoices > 0) {
    const free = LANGUAGES.filter((l) => !b.race.languages.includes(l) && !b.languages.includes(l))
    const picked = c.pick({
      id: 'bg-languages', section: 'Antecedente', kind: 'multi', title: `Que ${def.languagesChoices === 1 ? 'idioma' : `${def.languagesChoices} idiomas`} o antecedente ${def.name} ensina?`,
      options: multiOpts(free.map((l) => ({ value: l, label: l }))),
    }, def.languagesChoices, 'idioma')
    b.languages.push(...picked)
  }
  return { key, equipment: def.equipment }
}

function classStep(c: Ctx, b: Build): void {
  const key = c.choice({
    id: 'class', section: 'Classe', kind: 'choice', title: 'Qual é a classe?', body: 'A classe define como o personagem luta, usa magia e evolui.',
    options: [
      ...(['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'] as const)
        .map((k) => getClass(k)!).map((d) => ({ value: d.key, label: d.name, hint: `d${d.hitDie} · ${clip(d.summary, 100)}` })),
    ],
  })
  b.cls = getClass(key)!
  b.subclassKey = null
  if (b.level >= b.cls.subclassLevel) {
    b.subclassKey = c.choice({
      id: `subclass:${key}`, section: 'Classe', kind: 'choice', title: `Qual é a subclasse de ${b.cls.name}?`,
      body: `${b.cls.name} escolhe ${b.cls.subclasses[0]?.kind ?? 'a subclasse'} no nível ${b.cls.subclassLevel}.`,
      options: b.cls.subclasses.map((s) => ({ value: s.key, label: s.name, hint: clip(s.summary, 110) })),
    })
  }
}

/** Distribuição padrão (15, 14, 13, 12, 10, 8) na ordem de importância da classe. */
export function suggestedArray(classKey: string): Record<AbilityKey, number> {
  const order = ABILITY_ORDER[classKey] ?? ABILITIES.map((a) => a.key)
  const out = {} as Record<AbilityKey, number>
  order.forEach((k, i) => { out[k] = STANDARD_ARRAY[i] })
  return out
}

function abilityStep(c: Ctx, b: Build, bonus: Partial<Record<AbilityKey, number>>): void {
  const sug = suggestedArray(b.cls.key)
  const mode = c.choice({
    id: 'abilities-mode', section: 'Atributos', kind: 'choice', title: 'Como distribuir os atributos?',
    body: 'Os valores do livro são 15, 14, 13, 12, 10 e 8 (a raça soma os bônus por cima).',
    options: [
      { value: 'suggested', label: `Sugestão para ${b.cls.name}`, hint: (ABILITY_ORDER[b.cls.key] ?? []).slice(0, 3).map((k) => `${ABILITY_LABEL[k]} ${sug[k]}`).join(' · ') },
      { value: 'custom', label: 'Escolher cada valor', hint: 'Você distribui o 15, o 14, o 13, o 12, o 10 e o 8.' },
    ],
    recommended: 'suggested',
  })
  let base = sug
  if (mode === 'custom') {
    base = {} as Record<AbilityKey, number>
    const left = [...STANDARD_ARRAY]
    const order = ABILITY_ORDER[b.cls.key] ?? ABILITIES.map((a) => a.key)
    // a ordem das perguntas é a de importância da classe; o último atributo fica com o que sobrar
    for (const k of order.slice(0, 5)) {
      const v = Number(c.choice({
        id: `ability:${k}`, section: 'Atributos', kind: 'choice', title: `Qual é o valor de ${ABILITY_LABEL[k]}?`,
        body: `Valores que ainda sobram: ${left.join(', ')}.`,
        options: left.map((n) => ({ value: String(n), label: String(n), hint: `Modificador ${signed(mod(n))}` })),
        recommended: String(sug[k]),
      }))
      base[k] = v
      left.splice(left.indexOf(v), 1)
    }
    base[order[5]] = left[0]
  }
  for (const a of ABILITIES) b.scores[a.key] = base[a.key] + (bonus[a.key] ?? 0)

  // Aumento de Atributo nos níveis da classe
  for (const lvl of b.cls.asiLevels.filter((l) => l <= b.level)) {
    for (const n of [1, 2]) {
      const pick = c.ask({
        id: `asi:${lvl}:${n}`, section: 'Atributos', kind: 'choice', title: `Nível ${lvl}: em qual atributo vai o ${n === 1 ? 'primeiro' : 'segundo'} +1?`,
        body: 'No Aumento de Atributo são dois pontos: os dois no mesmo atributo (+2) ou um em cada. Nenhum passa de 20.',
        options: ABILITIES.map((a) => ({ value: a.key, label: `${a.label} (${b.scores[a.key]})`, hint: b.scores[a.key] >= 20 ? 'Já está no máximo' : undefined })),
        recommended: (ABILITY_ORDER[b.cls.key] ?? ABILITIES.map((x) => x.key)).find((k) => b.scores[k] < 20),
      }, (v) => (typeof v === 'string' && v in b.scores ? (b.scores[v as AbilityKey] >= 20 ? 'Esse atributo já está em 20.' : null) : 'Escolha um atributo.')) as AbilityKey
      b.scores[pick] += 1
    }
  }
}

function classSkillStep(c: Ctx, b: Build): void {
  const sc = b.cls.skills
  const from = (sc.from === 'any' ? ALL_SKILL_KEYS : sc.from).filter((k) => !ownedSkill(b, k))
  const picked = c.pick({
    id: 'class-skills', section: 'Perícias', kind: 'multi', title: `Quais ${sc.count} perícias ${b.cls.name} escolhe?`,
    body: from.length < (sc.from === 'any' ? ALL_SKILL_KEYS : sc.from).length ? 'Perícias que o personagem já tem (da raça ou do antecedente) não aparecem: o livro manda escolher outras.' : undefined,
    options: multiOpts(from.map((k) => ({ value: k, label: SKILL_LABEL[k], hint: ABILITY_LABEL[SKILLS.find((s) => s.key === k)!.ability] }))),
  }, Math.min(sc.count, from.length), 'perícia')
  for (const k of picked) b.skills.set(k as SkillKey, 'proficient')
}

function expertiseStep(c: Ctx, b: Build): void {
  for (const lvl of (EXPERTISE_LEVELS[b.cls.key] ?? []).filter((l) => l <= b.level)) {
    const eligible = [...b.skills.entries()].filter(([, v]) => v === 'proficient').map(([k]) => k)
    if (eligible.length < 2) continue
    const picked = c.pick({
      id: `expertise:${lvl}`, section: 'Perícias', kind: 'multi', title: `Nível ${lvl}: em quais 2 perícias o personagem tem especialização?`,
      body: 'A especialização dobra o bônus de proficiência nessas perícias.',
      options: multiOpts(eligible.map((k) => ({ value: k, label: SKILL_LABEL[k] }))),
    }, 2, 'perícia')
    for (const k of picked) b.skills.set(k as SkillKey, 'expertise')
  }
}

function fightingStyleStep(c: Ctx, b: Build): string[] {
  const need = FIGHTING_STYLE_LEVEL[b.cls.key]
  if (!need || b.level < need) return []
  const styles = FIGHTING_STYLES.filter((s) => s.classes.includes(b.cls.key))
  const first = c.choice({
    id: 'fighting-style', section: 'Classe', kind: 'choice', title: 'Qual é o estilo de luta?',
    options: styles.map((s) => ({ value: s.key, label: s.name, hint: s.summary })),
  })
  const out = [first]
  if (b.cls.key === 'fighter' && b.subclassKey === 'champion' && b.level >= 10) {
    out.push(c.choice({
      id: 'fighting-style-2', section: 'Classe', kind: 'choice', title: 'Qual é o estilo de luta adicional do Campeão?',
      options: styles.filter((s) => s.key !== first).map((s) => ({ value: s.key, label: s.name, hint: s.summary })),
    }))
  }
  return out
}

// ── Equipamento ─────────────────────────────────────────

function weaponAllowed(b: Build, key: string): boolean {
  const w = getWeapon(key)
  if (!w) return true
  const prof = [...b.cls.weapons, ...b.race.weaponProficiencies, ...(b.subrace?.weaponProficiencies ?? [])]
  return weaponProficient(w, prof)
}

function armorAllowed(b: Build, key: string): boolean {
  if (key === 'shield') return b.cls.armor.includes('shield')
  const a = getArmor(key)
  return !a || b.cls.armor.includes(a.category)
}

const itemName = (it: KitItem): string => (it.key ? getBookItem(it.key)?.name ?? it.key : it.name ?? '')

function optionLabel(o: KitOption): string {
  if (o.label) return o.label
  return o.items.map((it) => `${(it.qty ?? 1) > 1 ? `${it.qty} ` : ''}${itemName(it)}`).join(' e ')
}

function optionHint(o: KitOption): string | undefined {
  if (o.hint) return o.hint
  const w = o.items.map((it) => (it.key ? getWeapon(it.key) : undefined)).find(Boolean)
  return w ? `${w.damage ?? ''} ${w.damageType ?? ''}`.trim() || undefined : undefined
}

function optionAllowed(b: Build, o: KitOption): boolean {
  return o.items.every((it) => !it.key || (getWeapon(it.key) ? weaponAllowed(b, it.key) : armorAllowed(b, it.key)))
}

function kitStep(c: Ctx, b: Build): KitItem[] {
  const kit = KITS[b.cls.key]
  if (!kit) return []
  const items: KitItem[] = [...kit.fixed]
  for (const ch of kit.choices) {
    const options = ch.options.filter((o) => optionAllowed(b, o))
    if (options.length === 0) continue
    let chosen: KitOption
    if (options.length === 1) chosen = options[0]
    else {
      const q: Extract<Question, { kind: 'choice' }> = {
        id: `kit:${ch.id}`, section: 'Equipamento', kind: 'choice', title: ch.title, body: 'Equipamento inicial de classe. Tudo pode ser trocado depois no Inventário.',
        options: options.map((o) => ({ value: o.id, label: optionLabel(o), hint: optionHint(o) })),
      }
      const id = c.ask(q, (v) => (typeof v === 'string' && q.options.some((o) => o.value === v) ? null : 'Escolha uma das opções.'), { kit: options }) as string
      chosen = options.find((o) => o.id === id)!
    }
    items.push(...chosen.items)
  }
  return items
}

function invRow(over: Partial<DndCharacterInventoryInput> & { name: string }): DndCharacterInventoryInput {
  return { quantity: 1, weight: 0, equipped: false, notes: '', catalog_entry_key: null, sort_order: 0, ...over }
}

/** As linhas do inventário a partir dos itens do kit (um armadura e um escudo vestidos, no máximo). */
export function kitToInventory(items: KitItem[]): DndCharacterInventoryInput[] {
  const rows: DndCharacterInventoryInput[] = []
  let armorOn = false
  let shieldOn = false
  for (const it of items) {
    const qty = it.qty ?? 1
    if (it.key) {
      const book = getBookItem(it.key)
      if (!book) continue
      const isShield = book.kind === 'armor' && book.shield
      const isArmor = book.kind === 'armor' && !book.shield
      let equipped = !!it.equip
      if (isArmor) { equipped = !armorOn; armorOn = armorOn || equipped }
      if (isShield) { equipped = !shieldOn; shieldOn = shieldOn || equipped }
      const prev = rows.find((r) => r.catalog_entry_key === it.key && r.equipped === equipped)
      if (prev) { prev.quantity += qty; continue }
      rows.push(invRow({ name: book.name, weight: book.weight, notes: book.note, catalog_entry_key: it.key, quantity: qty, equipped }))
    } else if (it.name) {
      const prev = rows.find((r) => !r.catalog_entry_key && r.name === it.name)
      if (prev) { prev.quantity += qty; continue }
      let weight = 0
      const pack = Object.values(PACKS).find((p) => p.name === it.name)
      if (pack) weight = Math.round(Object.entries(pack.keys).reduce((s, [k, n]) => s + (getBookItem(k)?.weight ?? 0) * n, 0) * 10) / 10
      rows.push(invRow({ name: it.name, quantity: qty, weight, notes: it.note ?? '' }))
    }
  }
  rows.forEach((r, i) => { r.sort_order = i })
  return rows
}

function attacksFrom(items: KitItem[]): DndCharacterAttackInput[] {
  const out: DndCharacterAttackInput[] = []
  for (const it of items) {
    const w = it.key ? WEAPONS.find((x) => x.key === it.key) : undefined
    if (!w || out.some((a) => a.catalog_entry_key === w.key) || out.length >= 5) continue
    out.push({ name: w.name, attack_bonus: '', damage: '', damage_type: w.damageType ?? '', notes: '', catalog_entry_key: w.key, sort_order: out.length })
  }
  return out
}

// ── Magias ──────────────────────────────────────────────

function spellRow(e: SpellEntry, prepared: boolean): DndCharacterSpellInput {
  return {
    name: e.name, spell_level: e.level, school: SPELL_SCHOOL_LABEL[e.school], casting_time: e.castingTime, spell_range: e.range, duration: e.duration,
    concentration: !!e.concentration, ritual: !!e.ritual, prepared, description: '', catalog_key: e.key, sort_order: 0,
  }
}

const levelLabel = (l: number) => (l === 0 ? 'Truque' : `${l}º nível`)

function spellOption(e: SpellEntry) {
  return { value: e.key, label: `${e.name} (${e.original})`, hint: `${levelLabel(e.level)} · ${SPELL_SCHOOL_LABEL[e.school]}${e.concentration ? ' · concentração' : ''} · ${clip(e.text[0] ?? '', 80)}` }
}

/** A ordem de preferência: o ranking geral e, no resto, nível e nome. */
export function spellPriority(e: SpellEntry): number {
  const rank = e.level === 0 ? CANTRIP_RANK : SPELL_RANK
  const at = rank.indexOf(e.key)
  return at >= 0 ? at : rank.length + e.level * 100
}

/** Maior nível de magia que o personagem já alcança (espaços ou Magia de Pacto). */
export function maxSpellLevel(slots: number[] | undefined, pactLevel: number | null | undefined): number {
  let max = 0
  ;(slots ?? []).forEach((n, i) => { if (n > 0) max = i + 1 })
  return Math.max(max, pactLevel ?? 0)
}

function spellSteps(c: Ctx, b: Build): { rows: DndCharacterSpellInput[]; lines: string[] } {
  const derived = c.draft ? deriveDraft(c.input.existing, c.draft).derived : null
  const sc = derived?.spellcasting
  const row = sc?.classes.find((x) => x.classKey === b.cls.key)
  const rows: DndCharacterSpellInput[] = []
  const lines: string[] = []
  const catalog = c.input.spells
  const racial = b.racialCantrip ? catalog.find((s) => s.key === b.racialCantrip) : undefined
  if (racial) rows.push(spellRow(racial, true))
  if (!sc || !row) return { rows, lines }

  const profile = b.cls.spellcasting ?? b.cls.subclasses.find((s) => s.key === b.subclassKey)?.spellcasting
  const listClass = spellListClass(b.cls.key, b.subclassKey)
  const maxLvl = maxSpellLevel(sc.slots, sc.pact?.level)
  const all = catalog.filter((s) => s.classes.includes(listClass))
  const ordered = (list: SpellEntry[]) => [...list].sort((a, z) => spellPriority(a) - spellPriority(z) || a.name.localeCompare(z.name, 'pt-BR'))

  if (row.cantripsKnown > 0) {
    const pool = ordered(all.filter((s) => s.level === 0 && s.key !== b.racialCantrip))
    const n = Math.min(row.cantripsKnown, pool.length)
    const keys = c.pick({
      id: 'cantrips', section: 'Magias', kind: 'multi', title: `Quais ${n} truques ${b.cls.name} conhece?`,
      body: 'Truques se lançam à vontade, sem gastar espaço de magia.',
      options: multiOpts(pool.map(spellOption)),
    }, n, 'truque')
    keys.forEach((k) => rows.push(spellRow(catalog.find((s) => s.key === k)!, true)))
    lines.push(`Truques: ${keys.length}`)
  }

  const allowed = ordered(all.filter((s) => s.level >= 1 && s.level <= maxLvl))
  const learning = profile?.learning
  if (learning === 'spellbook') {
    const size = Math.min(row.spellbookSize ?? 0, allowed.length)
    if (size > 0) {
      const book = c.pick({
        id: 'spellbook', section: 'Magias', kind: 'multi', title: `Quais ${size} magias entram no grimório?`,
        body: 'O grimório do mago começa com 6 magias de 1º nível e ganha 2 a cada nível. Dele saem as magias preparadas.',
        options: multiOpts(allowed.map(spellOption)),
      }, size, 'magia')
      const prepCount = Math.min(row.spellsKnownOrPrepared, book.length)
      const pool = allowed.filter((s) => book.includes(s.key))
      const prepared = prepCount > 0 ? c.pick({
        id: 'prepared', section: 'Magias', kind: 'multi', title: `Quais ${prepCount} magias do grimório ficam preparadas?`,
        body: 'Preparadas = nível do mago + modificador de Inteligência. Dá para trocar a cada descanso longo.',
        options: multiOpts(pool.map(spellOption)),
      }, prepCount, 'magia') : []
      book.forEach((k) => rows.push(spellRow(catalog.find((s) => s.key === k)!, prepared.includes(k))))
      lines.push(`Grimório: ${book.length} (${prepared.length} preparadas)`)
    }
  } else if (learning === 'prepared' || learning === 'prepared-half') {
    const n = Math.min(row.spellsKnownOrPrepared, allowed.length)
    if (n > 0) {
      const keys = c.pick({
        id: 'prepared', section: 'Magias', kind: 'multi', title: `Quais ${n} magias ${b.cls.name} prepara?`,
        body: `${b.cls.name} escolhe todo dia, da lista inteira de magias da classe. Preparadas = ${learning === 'prepared' ? 'nível' : 'metade do nível'} + modificador do atributo de conjuração.`,
        options: multiOpts(allowed.map(spellOption)),
      }, n, 'magia')
      keys.forEach((k) => rows.push(spellRow(catalog.find((s) => s.key === k)!, true)))
      lines.push(`Magias preparadas: ${keys.length}`)
    }
  } else if (learning === 'known') {
    const n = Math.min(row.spellsKnownOrPrepared, allowed.length)
    if (n > 0) {
      const eld = b.subclassKey === 'eldritch_knight' || b.subclassKey === 'arcane_trickster'
      const keys = c.pick({
        id: 'spells', section: 'Magias', kind: 'multi', title: `Quais ${n} magias ${b.cls.name} conhece?`,
        body: eld ? 'Cavaleiro Místico e Trapaceiro Arcano aprendem magias do Mago (a maioria deve ser de evocação ou ilusão/encantamento, conforme a subclasse).' : 'Magias conhecidas só mudam ao subir de nível.',
        options: multiOpts(allowed.map(spellOption)),
      }, n, 'magia')
      keys.forEach((k) => rows.push(spellRow(catalog.find((s) => s.key === k)!, true)))
      lines.push(`Magias conhecidas: ${keys.length}`)
    }
  }
  rows.sort((a, z) => a.spell_level - z.spell_level)
  rows.forEach((r, i) => { r.sort_order = i })
  return { rows, lines }
}

// ── Tendência, história e montagem final ───────────────

function finishing(c: Ctx): { alignment: string; story: string } {
  const al = c.choice({
    id: 'alignment', section: 'Personagem', kind: 'choice', title: 'Qual é a tendência do personagem?', body: 'Como ele vê o certo e o errado. É só um guia: dá para mudar sempre.',
    options: [...ALIGNMENTS.map((a) => ({ value: a, label: a })), { value: 'none', label: 'Ainda não sei', hint: 'Fica sem tendência.' }],
  })
  const story = c.text({
    id: 'story', section: 'História', kind: 'text', multiline: true,
    title: 'Quer escrever algo sobre a história do personagem?', body: 'Opcional: de onde veio, o que quer, o que teme. Vai para a aba História e pode ser mudado depois.',
    placeholder: 'Deixe em branco para pular.', defaultValue: '',
  })
  return { alignment: al === 'none' ? '' : al, story }
}

export function runCreate(input: CreateInput, answers: Answers): CreatePlan {
  const c = makeCtx(input, answers)
  try {
    const id = identity(c)
    const b: Partial<Build> & { name: string; level: number } = { ...id, skills: new Map(), languages: [], tools: [], racialCantrip: null, scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 } }
    raceStep(c, b)
    const full = b as Build
    const rc = raceChoices(c, full)
    const bg = backgroundStep(c, full)
    classStep(c, full)
    abilityStep(c, full, rc.abilityBonus)
    classSkillStep(c, full)
    expertiseStep(c, full)
    const styles = fightingStyleStep(c, full)

    // rascunho parcial para o motor calcular PV e quantas magias
    const f = c.draft.form
    f.character_name = full.name
    f.level = full.level
    f.race_key = full.race.key
    f.subrace_key = full.subrace?.key ?? ''
    f.background_key = bg.key
    f.experience = xpForLevel(full.level)
    for (const a of ABILITIES) f[a.key] = full.scores[a.key]
    Object.assign(f, saveColumns(full.cls.saves))
    c.draft.classes = [{ class_key: full.cls.key, level: full.level, subclass_key: full.subclassKey, is_initial: true, hp_rolls: [] }]

    const kitItems = kitStep(c, full)
    const spells = spellSteps(c, full)
    const end = finishing(c)

    // ── rascunho final ──
    f.alignment = end.alignment
    if (end.story) f.backstory = end.story.slice(0, 12000)
    const ex = c.input.extras ?? {}
    if (ex.personality_traits) f.personality_traits = ex.personality_traits.slice(0, 2000)
    if (ex.ideals) f.ideals = ex.ideals.slice(0, 2000)
    if (ex.bonds) f.bonds = ex.bonds.slice(0, 2000)
    if (ex.flaws) f.flaws = ex.flaws.slice(0, 2000)
    if (ex.notes) f.notes = ex.notes.slice(0, 12000)
    const racialNotes = [...rc.notes]
    if (full.race.skillChoices) racialNotes.push('Perícias da raça escolhidas na criação.')
    if (racialNotes.length) f.notes_racial = racialNotes.join('\n').slice(0, 6000)

    c.draft.skills = [...full.skills.entries()].map(([k, v]) => ({ skill_key: k, proficient: true, expertise: v === 'expertise' }))
    c.draft.proficiencies = [
      ...full.languages.map((l) => ({ category: 'language' as const, entry_key: homebrewKeyFromName(l), label: l })),
      ...full.tools.map((t) => ({ category: 'tool' as const, entry_key: t.key, label: t.label })),
    ]
    c.draft.inventory = kitToInventory(kitItems)
    // equipamento do antecedente: uma linha cada, e o dinheiro da bolsa vai para as moedas
    for (const line of bg.equipment) {
      const gold = /(\d+)\s*po\b/i.exec(line)
      if (gold && /bolsa/i.test(line)) f.coin_gp = Number(gold[1])
      c.draft.inventory.push(invRow({ name: clip(line, 120), sort_order: c.draft.inventory.length, notes: 'Do antecedente' }))
    }
    c.draft.attacks = attacksFrom(kitItems)
    c.draft.spells = spells.rows

    // estilos de luta: Defesa dá +1 de CA com armadura; as características de classe e raça entram ligadas ao catálogo
    const wearsArmor = c.draft.inventory.some((r) => r.equipped && r.catalog_entry_key && getArmor(r.catalog_entry_key))
    if (styles.includes('defense') && wearsArmor) f.ac_bonus = 1
    const styleName = (k: string) => FIGHTING_STYLES.find((s) => s.key === k)?.name ?? k
    c.draft.features = availableFeatures(
      c.draft.classes.map((x) => ({ class_key: x.class_key, level: x.level, subclass_key: x.subclass_key })), f.race_key, f.subrace_key || null, f.background_key,
    ).map((x) => ({
      source: x.source, feature_key: x.key, name: x.name, level: x.level,
      notes: x.key.endsWith('__fighting_style') && styles.length ? `Estilo de luta: ${styles.map(styleName).join(' e ')}.` : '',
    }))

    // PV cheios na criação
    const bundle = deriveDraft(c.input.existing, c.draft)
    const hp = bundle.derived.hpMax ?? f.hp_max
    f.hp_max = hp
    f.hp_current = hp

    const sub = full.subclassKey ? full.cls.subclasses.find((s) => s.key === full.subclassKey)?.name : null
    const d = bundle.derived
    const skillNames = [...full.skills.entries()].map(([k, v]) => `${SKILL_LABEL[k]}${v === 'expertise' ? ' (especialização)' : ''}`)
    const summary = [
      `${full.name} · ${full.race.name}${full.subrace ? ` (${full.subrace.name})` : ''} · ${getBackground(bg.key)?.name} · ${full.cls.name}${sub ? ` (${sub})` : ''} nível ${full.level}`,
      `Atributos: ${ABILITIES.map((a) => `${a.short} ${full.scores[a.key]}`).join(' · ')}`,
      `PV ${hp} · CA ${d.armorClass} · Iniciativa ${signed(d.initiative)} · Proficiência ${signed(d.proficiencyBonus)}`,
      `Perícias: ${skillNames.join(', ') || 'nenhuma'}`,
      `Equipamento: ${c.draft.inventory.filter((r) => r.equipped).map((r) => r.name).join(', ') || 'sem armadura nem arma vestida'} (${c.draft.inventory.length} itens)`,
      ...spells.lines,
    ]
    c.draft.report = summary
    return { done: true, draft: c.draft, asked: c.asked, summary }
  } catch (err) {
    if (err instanceof Pending) return { done: false, question: err.question, asked: c.asked }
    throw err
  }
}

/** Os antecedentes do livro que a criação oferece (o personalizado fica de fora). */
export const CREATE_BACKGROUNDS = BACKGROUNDS.filter((x) => !x.custom)
