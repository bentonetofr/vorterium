import { BACKGROUNDS, RACES, type ClassDef, type RaceDef } from '../../catalog'
import { homebrewKeyFromName } from '../../catalog/homebrewKey'
import { xpForLevel } from '../../rules/progression'
import type { AbilityKey } from '../../rules/types'
import type { Ctx } from '../ctx'
import { matchBackground, matchClass, matchRace, subclassInText } from '../match'
import { clip, fold, parseInt0, parseSpeed } from '../text'
import type { DraftClass } from '../types'

// ────────────────────────────────────────────────────────
// Etapas 1 a 4: quem é o personagem (nome, jogador, tendência), as classes e
// níveis, a raça e o antecedente, a experiência e os atributos.
// ────────────────────────────────────────────────────────

export const ABILITY_LABEL: Record<AbilityKey, string> = {
  strength: 'Força', dexterity: 'Destreza', constitution: 'Constituição', intelligence: 'Inteligência', wisdom: 'Sabedoria', charisma: 'Carisma',
}
const ABILITIES = Object.keys(ABILITY_LABEL) as AbilityKey[]

// ── Classes ─────────────────────────────────────────────

/** Uma classe lida: a do livro (`def`) ou uma classe própria, fora do livro (`def` null, com o nome do PDF). */
export interface ParsedClass { def: ClassDef | null; key: string; name: string; level: number }
export interface ParsedClasses { rows: ParsedClass[]; problem: string | null }

/** "Bard Nível 5", "Bardo 3 / Mago 2", "Guerreiro (Campeão) 5": as classes e os níveis. Classe que o livro não tem vira classe própria. */
export function parseClasses(text: string): ParsedClasses {
  const tokens = text.split(/\s*(?:\/|\+|&|,|;|\se\s)\s*/i).map((t) => t.trim()).filter(Boolean)
  if (tokens.length === 0) return { rows: [], problem: 'não está escrito' }
  const rows: ParsedClasses['rows'] = []
  for (const tok of tokens) {
    const m = /^(.*?)\s*(?:\b(?:n[ií]vel|nivel|level|lvl|lv|nv)\b\.?\s*)?(\d{1,2})\s*$/i.exec(tok)
    if (!m || !m[1].trim()) return { rows: [], problem: `não entendi "${tok}"` }
    const name = m[1].replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
    const def = matchClass(name)
    const key = def?.key ?? homebrewKeyFromName(name)
    const level = Number(m[2])
    if (level < 1 || level > 20) return { rows: [], problem: `nível ${level} fora de 1 a 20` }
    if (rows.some((r) => r.key === key)) return { rows: [], problem: `${def?.name ?? name} aparece duas vezes` }
    rows.push({ def, key, name: def?.name ?? name.slice(0, 80), level })
  }
  if (rows.reduce((s, r) => s + r.level, 0) > 20) return { rows: [], problem: 'a soma dos níveis passa de 20' }
  return { rows, problem: null }
}

function classes(c: Ctx): void {
  const text = c.read.identity.classText
  let parsed = parseClasses(text)
  if (parsed.problem) {
    const answer = c.askText({
      id: 'classes', section: 'Classe', kind: 'text',
      title: 'Qual é a classe do personagem?',
      body: text ? `No PDF está escrito "${text}", mas ${parsed.problem}. Escreva a classe e o nível, por exemplo "Guerreiro 5" ou, com multiclasse, "Bardo 3 / Mago 2".` : 'O PDF não diz a classe. Escreva a classe e o nível, por exemplo "Guerreiro 5" ou, com multiclasse, "Bardo 3 / Mago 2".',
      placeholder: 'Bardo 5', defaultValue: text,
    }, (v) => parseClasses(v).problem)
    parsed = parseClasses(answer)
  }

  const out: DraftClass[] = []
  const f = c.draft.form
  parsed.rows.forEach(({ def, key, name, level }, i) => {
    if (!def) { out.push(homebrewClass(c, key, name, level, i === 0)); return }
    let subclass: string | null = null
    if (level >= def.subclassLevel) {
      const fromText = subclassInText(text, def)
      if (fromText) subclass = fromText.key
      else {
        const kind = def.subclasses[0]?.kind ?? 'subclasse'
        const pick = c.askChoice({
          id: `subclass:${def.key}`, section: 'Classe', kind: 'choice',
          title: `Qual é a subclasse de ${def.name}?`,
          body: `${def.name} escolhe a subclasse (${kind}) no nível ${def.subclassLevel} e o PDF não diz qual foi a escolhida.`,
          options: [
            ...def.subclasses.map((s) => ({ value: s.key, label: s.name, hint: clip(s.summary, 110) })),
            { value: 'none', label: 'Ainda não escolhi, ou não está na lista', hint: 'Fica sem subclasse; você escolhe depois na ficha.' },
          ],
        })
        subclass = pick === 'none' ? null : pick
      }
    }
    out.push({ class_key: def.key, level, subclass_key: subclass, is_initial: i === 0, hp_rolls: [] })
  })
  c.draft.classes = out
  f.level = out.reduce((s, r) => s + r.level, 0)
  c.note(`Classe: ${parsed.rows.map((r) => `${r.name}${r.def ? '' : ' (própria)'} ${r.level}`).join(' / ')}`)
}

/**
 * Classe que o livro não tem: entra como classe própria, com o nome do PDF. O que o livro diria (dado de
 * vida, subclasse, se conjura) vira pergunta; o resto (características, recursos) fica para mudar na ficha.
 */
function homebrewClass(c: Ctx, key: string, name: string, level: number, initial: boolean): DraftClass {
  const f = c.draft.form
  f.class_names = { ...f.class_names, [key]: name }
  const die = c.askChoice({
    id: `hb-die:${key}`, section: 'Classe', kind: 'choice',
    title: `Qual é o dado de vida de ${name}?`,
    body: `${name} não está no livro do sistema, então entra como classe própria. O dado de vida dá os PV de cada nível e os dados de vida da ficha.`,
    options: [
      { value: '6', label: 'd6', hint: 'Como Feiticeiro e Mago' },
      { value: '8', label: 'd8', hint: 'Como Bardo, Clérigo, Ladino e Bruxo (o mais comum)' },
      { value: '10', label: 'd10', hint: 'Como Guerreiro, Paladino e Patrulheiro' },
      { value: '12', label: 'd12', hint: 'Como Bárbaro' },
    ],
    recommended: '8',
  })
  f.homebrew_hit_die = { ...f.homebrew_hit_die, [key]: Number(die) }
  const sub = c.askText({
    id: `hb-sub:${key}`, section: 'Classe', kind: 'text',
    title: `${name} tem subclasse (arquétipo, caminho, tradição...)?`,
    body: 'Escreva o nome da subclasse, ou deixe em branco se não tiver.',
    placeholder: 'Ex.: Caminho do Sangue', defaultValue: '',
  })
  if (sub) f.subclass_names = { ...f.subclass_names, [key]: sub.slice(0, 80) }
  const casts = c.askChoice({
    id: `hb-cast:${key}`, section: 'Classe', kind: 'choice',
    title: `${name} conjura magias? Com qual atributo?`,
    body: 'O atributo de conjuração dá a CD e o ataque de magia. Os espaços de magia de uma classe própria você escreve na ficha (Automatizar > Espaços de magia em manual).',
    options: [
      { value: 'none', label: 'Não conjura' },
      ...ABILITIES.map((a) => ({ value: a, label: ABILITY_LABEL[a] })),
    ],
  })
  if (casts !== 'none' && !f.spell_ability) f.spell_ability = casts as AbilityKey
  return { class_key: key, level, subclass_key: null, is_initial: initial, hp_rolls: [] }
}

// ── Raça e antecedente ──────────────────────────────────

function origin(c: Ctx): void {
  const { raceText, backgroundText, alignmentText } = c.read.identity
  const f = c.draft.form
  const notes = { race: '', background: '' }

  // raça
  let race: RaceDef | null = null
  let subraceKey = ''
  const m = raceText ? matchRace(raceText) : { race: null, subrace: null }
  if (m.race) { race = m.race; subraceKey = m.subrace?.key ?? '' }
  else {
    const pick = c.askChoice({
      id: 'race', section: 'Raça', kind: 'choice',
      title: raceText ? `Qual é a raça "${raceText}"?` : 'Qual é a raça do personagem?',
      body: raceText ? 'Não achei essa raça no livro do sistema. Escolha a mais parecida, ou fique com ela como raça própria (o nome do PDF).' : 'O PDF não diz a raça.',
      options: [
        ...(raceText ? [{ value: 'own', label: `Usar "${raceText}" como raça própria`, hint: 'Fica com o nome do PDF; o que ela dá você ajusta na ficha.' }] : []),
        ...RACES.map((r) => ({ value: r.key, label: r.name, hint: clip(r.summary, 90) })),
        { value: 'none', label: 'Sem raça', hint: 'Você escolhe depois na ficha.' },
      ],
      ...(raceText ? { recommended: 'own' } : {}),
    })
    if (pick === 'own') ownRace(c, raceText)
    else if (pick !== 'none') race = RACES.find((r) => r.key === pick) ?? null
    if (raceText && race && !m.race) notes.race = `Raça no PDF: ${raceText}`
  }
  if (race && race.subraces.length > 0 && !subraceKey) {
    const why = raceText && fold(raceText) !== fold(race.name) && fold(raceText) !== fold(race.original) ? `No PDF está "${raceText}", que não é uma das sub-raças do catálogo.` : `${race.name} tem sub-raças e o PDF não diz qual.`
    const pick = c.askChoice({
      id: `subrace:${race.key}`, section: 'Raça', kind: 'choice', title: `Qual é a sub-raça de ${race.name}?`, body: why,
      options: [...race.subraces.map((s) => ({ value: s.key, label: s.name, hint: clip(s.summary, 90) })), { value: 'none', label: 'Nenhuma / outra', hint: 'O texto do PDF vai para as anotações da raça.' }],
    })
    subraceKey = pick === 'none' ? '' : pick
    if (pick === 'none' && raceText) notes.race = `Raça no PDF: ${raceText}`
  }
  f.race_key = race?.key ?? ''
  f.subrace_key = subraceKey

  // antecedente
  let background = backgroundText ? matchBackground(backgroundText) : null
  if (!background) {
    const pick = c.askChoice({
      id: 'background', section: 'Antecedente', kind: 'choice',
      title: backgroundText ? `Qual é o antecedente "${backgroundText}"?` : 'Qual é o antecedente do personagem?',
      body: backgroundText ? 'Não achei esse antecedente no catálogo. Escolha o mais parecido; o texto do PDF vai para as anotações do antecedente.' : 'O PDF não diz o antecedente.',
      options: [...BACKGROUNDS.map((b) => ({ value: b.key, label: b.name, hint: clip(b.summary, 90) })), { value: 'none', label: backgroundText ? `Nenhum desses (fica "${backgroundText}" como antecedente próprio)` : 'Nenhum desses' }],
    })
    background = BACKGROUNDS.find((b) => b.key === pick) ?? null
    if (backgroundText && background) notes.background = `Antecedente no PDF: ${backgroundText}`
    // sem antecedente do livro, fica o nome do PDF como antecedente próprio
    if (backgroundText && !background) f.background_custom = backgroundText.slice(0, 80)
  }
  f.background_key = background?.key ?? ''

  if (notes.race) f.notes_racial = [f.notes_racial, notes.race].filter(Boolean).join('\n')
  if (notes.background) f.notes_background = [f.notes_background, notes.background].filter(Boolean).join('\n')
  f.alignment = alignmentText.slice(0, 80)
  c.note(`Raça: ${race ? race.name : f.race_custom ? `${f.race_custom} (própria)` : '(sem raça)'}${subraceKey ? ` (${race?.subraces.find((s) => s.key === subraceKey)?.name})` : ''} · Antecedente: ${background ? background.name : '(sem antecedente)'}`)
}

/** Raça que o livro não tem: fica o nome do PDF, e a visão no escuro (que o livro daria) vem do PDF ou de uma pergunta. */
function ownRace(c: Ctx, name: string): void {
  const f = c.draft.form
  f.race_custom = name.slice(0, 80)
  const vision = parseSpeed(c.read.combat.vision)
  if (vision) { f.vision_ft = vision.feet; return }
  const pick = c.askChoice({
    id: 'hb-vision', section: 'Raça', kind: 'choice',
    title: `${name} enxerga no escuro?`,
    body: 'A visão no escuro vem da raça; como esta não está no livro, diga qual é (dá para mudar depois clicando na Visão, no alto da ficha).',
    options: [
      { value: '0', label: 'Não, visão normal' },
      { value: '60', label: 'Sim, 18 metros (60 pés)', hint: 'A mais comum' },
      { value: '120', label: 'Sim, 36 metros (120 pés)' },
    ],
  })
  f.vision_ft = Number(pick)
}

// ── Identidade, XP e atributos ──────────────────────────

function identity(c: Ctx): void {
  const { characterName, playerName } = c.read.identity
  const f = c.draft.form
  f.character_name = (characterName || c.askText({ id: 'name', section: 'Personagem', kind: 'text', title: 'Qual é o nome do personagem?', body: 'O campo de nome está vazio no PDF.', placeholder: 'Nome' }, (v) => (v ? null : 'Escreva um nome.'))).slice(0, 120)
  if (playerName) f.player_name = playerName.slice(0, 120)
  c.note(`Personagem: ${f.character_name}${playerName ? ` (jogador: ${playerName})` : ''}`)
}

function experience(c: Ctx): void {
  const text = c.read.identity.xpText
  const level = c.draft.form.level
  const f = c.draft.form
  if (!text) { f.experience = xpForLevel(level); return }
  const n = parseInt0(text.replace(/[.\s]/g, ''))
  if (n != null && n >= 0 && n <= 99999999) { f.experience = n; return }
  f.experience = c.askNumber({
    id: 'xp', section: 'Personagem', kind: 'number',
    title: 'Quantos pontos de experiência?',
    body: `No PDF está escrito "${text}", que não é um número. Nível ${level} começa em ${xpForLevel(level)} XP.`,
    min: 0, max: 99999999, defaultValue: xpForLevel(level), unit: 'XP',
  })
}

function abilities(c: Ctx): void {
  const f = c.draft.form
  for (const key of ABILITIES) {
    const raw = c.read.abilities[key]
    let score = parseInt0(raw.score)
    if (score == null || score < 1 || score > 30) {
      score = c.askNumber({
        id: `ability:${key}`, section: 'Atributos', kind: 'number', title: `Qual é o valor de ${ABILITY_LABEL[key]}?`,
        body: raw.score ? `No PDF está escrito "${raw.score}", que não é um valor de 1 a 30.` : `${ABILITY_LABEL[key]} está vazio no PDF.`,
        min: 1, max: 30, defaultValue: 10,
      })
    } else {
      const mod = parseInt0(raw.mod)
      const calc = Math.floor((score - 10) / 2)
      if (mod != null && mod !== calc) {
        const pick = c.askChoice({
          id: `ability-mod:${key}`, section: 'Atributos', kind: 'choice',
          title: `${ABILITY_LABEL[key]}: o valor e o modificador não batem`,
          body: `No PDF o valor é ${score} (modificador ${calc >= 0 ? '+' : ''}${calc}), mas o modificador escrito é ${mod >= 0 ? '+' : ''}${mod}.`,
          options: [
            { value: 'score', label: `Valor ${score}`, hint: `Modificador ${calc >= 0 ? '+' : ''}${calc}` },
            { value: 'mod', label: `Modificador ${mod >= 0 ? '+' : ''}${mod}`, hint: `Valor ${Math.max(1, Math.min(30, 10 + 2 * mod))}` },
          ],
        })
        if (pick === 'mod') score = Math.max(1, Math.min(30, 10 + 2 * mod))
      }
    }
    f[key] = score
  }
  c.note(`Atributos: ${ABILITIES.map((k) => `${ABILITY_LABEL[k].slice(0, 3)} ${f[k]}`).join(', ')}`)
}

export const BASIC_STEPS = [identity, classes, origin, experience, abilities]
