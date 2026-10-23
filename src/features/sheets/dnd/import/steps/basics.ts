import { BACKGROUNDS, CLASSES, RACES, type ClassDef, type RaceDef } from '../../catalog'
import { xpForLevel } from '../../rules/progression'
import type { AbilityKey } from '../../rules/types'
import type { Ctx } from '../ctx'
import { matchBackground, matchClass, matchRace, subclassInText } from '../match'
import { clip, fold, parseInt0 } from '../text'
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

export interface ParsedClasses { rows: { def: ClassDef; level: number }[]; problem: string | null }

/** "Bard Nível 5", "Bardo 3 / Mago 2", "Guerreiro (Campeão) 5": as classes e os níveis. */
export function parseClasses(text: string): ParsedClasses {
  const tokens = text.split(/\s*(?:\/|\+|&|,|;|\se\s)\s*/i).map((t) => t.trim()).filter(Boolean)
  if (tokens.length === 0) return { rows: [], problem: 'não está escrito' }
  const rows: ParsedClasses['rows'] = []
  for (const tok of tokens) {
    const m = /^(.*?)\s*(?:\b(?:n[ií]vel|nivel|level|lvl|lv|nv)\b\.?\s*)?(\d{1,2})\s*$/i.exec(tok)
    if (!m || !m[1].trim()) return { rows: [], problem: `não entendi "${tok}"` }
    const name = m[1].replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
    const def = matchClass(name)
    if (!def) return { rows: [], problem: `não conheço a classe "${name}"` }
    const level = Number(m[2])
    if (level < 1 || level > 20) return { rows: [], problem: `nível ${level} fora de 1 a 20` }
    if (rows.some((r) => r.def.key === def.key)) return { rows: [], problem: `${def.name} aparece duas vezes` }
    rows.push({ def, level })
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
  parsed.rows.forEach(({ def, level }, i) => {
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
  c.draft.form.level = out.reduce((s, r) => s + r.level, 0)
  c.note(`Classe: ${out.map((r) => `${CLASSES.find((d) => d.key === r.class_key)?.name} ${r.level}`).join(' / ')}`)
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
      body: raceText ? 'Não achei essa raça no catálogo do sistema. Escolha a mais parecida; o texto do PDF vai para as anotações da raça.' : 'O PDF não diz a raça.',
      options: [...RACES.map((r) => ({ value: r.key, label: r.name, hint: clip(r.summary, 90) })), { value: 'none', label: 'Nenhuma dessas', hint: 'Fica sem raça no catálogo.' }],
    })
    if (pick !== 'none') race = RACES.find((r) => r.key === pick) ?? null
    if (raceText && (!race || !m.race)) notes.race = `Raça no PDF: ${raceText}`
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
      options: [...BACKGROUNDS.map((b) => ({ value: b.key, label: b.name, hint: clip(b.summary, 90) })), { value: 'none', label: 'Nenhum desses' }],
    })
    background = BACKGROUNDS.find((b) => b.key === pick) ?? null
    if (backgroundText) notes.background = `Antecedente no PDF: ${backgroundText}`
  }
  f.background_key = background?.key ?? ''

  if (notes.race) f.notes_racial = [f.notes_racial, notes.race].filter(Boolean).join('\n')
  if (notes.background) f.notes_background = [f.notes_background, notes.background].filter(Boolean).join('\n')
  f.alignment = alignmentText.slice(0, 80)
  c.note(`Raça: ${race ? race.name : '(sem raça)'}${subraceKey ? ` (${race?.subraces.find((s) => s.key === subraceKey)?.name})` : ''} · Antecedente: ${background ? background.name : '(sem antecedente)'}`)
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
