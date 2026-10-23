import { TOOLS } from '../../catalog'
import { homebrewKeyFromName } from '../../catalog/homebrewKey'
import { ABILITIES, SKILLS, skillBonus } from '../../rules/abilities'
import type { AbilityKey, ProficiencyLevel } from '../../rules/types'
import type { Ctx } from '../ctx'
import { matchWeapon } from '../match'
import { exact, rank } from '../match'
import { fold, parseInt0, similarity } from '../text'
import type { DraftProficiency } from '../types'

// ────────────────────────────────────────────────────────
// Etapa 5: salvaguardas, perícias (proficiência e especialização) e as
// proficiências de armaduras, armas, ferramentas e idiomas. Só entra como
// "extra" o que a classe e a raça ainda não dão.
// ────────────────────────────────────────────────────────

const SAVE_KEYS = ABILITIES.map((a) => a.key)
const LEVEL_LABEL: Record<ProficiencyLevel, string> = { none: 'sem proficiência', half: 'metade da proficiência', proficient: 'proficiente', expertise: 'especialização' }

function saves(c: Ctx): void {
  const f = c.draft.form
  const on: string[] = []
  for (const key of SAVE_KEYS) {
    const v = c.read.saves[key].proficient
    f[`${key}_save_proficient` as `${AbilityKey}_save_proficient`] = v
    if (v) on.push(ABILITIES.find((a) => a.key === key)!.label)
  }
  c.note(`Salvaguardas com proficiência: ${on.join(', ') || 'nenhuma'}`)
}

function skills(c: Ctx): void {
  const prof = c.derive().derived.proficiencyBonus
  const mods = c.derive().derived.abilityMods
  const out: typeof c.draft.skills = []
  for (const s of SKILLS) {
    const r = c.read.skills[s.key]
    let level: ProficiencyLevel = r.expertise ? 'expertise' : r.proficient ? 'proficient' : 'none'
    const value = parseInt0(r.value)
    if (value != null) {
      const fits = (l: ProficiencyLevel) => skillBonus(mods[s.ability], l, prof) === value
      if (!fits(level)) {
        // o valor escrito bate com outro nível (ex.: o dobro da proficiência sem a caixa de especialização marcada)?
        const others = (['expertise', 'proficient', 'none'] as ProficiencyLevel[]).filter((l) => l !== level && fits(l) && (l !== 'none' || level !== 'half'))
        if (others.length === 1 && others[0] !== 'none') {
          const pick = c.askChoice({
            id: `skill-level:${s.key}`, section: 'Perícias', kind: 'choice',
            title: `${s.label}: a marcação e o valor do PDF não combinam`,
            body: `No PDF ${s.label} está como ${LEVEL_LABEL[level]}, mas o valor escrito (${value >= 0 ? '+' : ''}${value}) é o de ${LEVEL_LABEL[others[0]]}.`,
            options: [
              { value: 'value', label: `Seguir o valor (${LEVEL_LABEL[others[0]]})`, hint: `Bônus ${value >= 0 ? '+' : ''}${value}` },
              { value: 'mark', label: `Seguir a marcação (${LEVEL_LABEL[level]})`, hint: `Bônus ${skillBonus(mods[s.ability], level, prof) >= 0 ? '+' : ''}${skillBonus(mods[s.ability], level, prof)}` },
            ],
          })
          if (pick === 'value') level = others[0]
        }
      }
    }
    if (level === 'proficient' || level === 'expertise') out.push({ skill_key: s.key, proficient: true, expertise: level === 'expertise' })
  }
  c.draft.skills = out
  c.note(`Perícias com proficiência: ${out.map((s) => `${SKILLS.find((x) => x.key === s.skill_key)!.label}${s.expertise ? ' (especialização)' : ''}`).join(', ') || 'nenhuma'}`)
}

// ── Armaduras, armas, ferramentas e idiomas ─────────────

/** Os idiomas do livro, para escrever o nome certo ("Comun" → "Comum"). */
const LANGUAGES = ['Comum', 'Anão', 'Élfico', 'Gigante', 'Gnômico', 'Goblin', 'Halfling', 'Orc', 'Abissal', 'Celestial', 'Dracônico', 'Língua Profunda', 'Infernal', 'Primordial', 'Silvestre', 'Subcomum']

function tokens(text: string): string[] {
  return text.split(/[,;\n]|\s+e\s+/i).map((t) => t.replace(/[.]+$/, '').trim()).filter(Boolean)
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function proficiencies(c: Ctx): void {
  const p = c.read.proficiencies
  const granted = c.derive().prof
  const add: DraftProficiency[] = []
  const have = (cat: DraftProficiency['category'], key: string) => add.some((x) => x.category === cat && x.entry_key === key)

  // armaduras
  for (const [key, label, on] of [['light', 'Armaduras leves', p.armor.light], ['medium', 'Armaduras médias', p.armor.medium], ['heavy', 'Armaduras pesadas', p.armor.heavy], ['shield', 'Escudos', p.armor.shields]] as const) {
    if (on && !granted.armor.includes(key)) add.push({ category: 'armor', entry_key: key, label })
  }
  // armas: categorias marcadas e a lista escrita
  for (const [key, label, on] of [['simple', 'Armas simples', p.weapons.simple], ['martial', 'Armas marciais', p.weapons.martial]] as const) {
    if (on && !granted.weapons.includes(key)) add.push({ category: 'weapon', entry_key: key, label })
  }
  const weaponCovered = (w: { key: string; category: string }) => granted.weapons.includes(w.key) || granted.weapons.includes(w.category) || add.some((a) => a.category === 'weapon' && (a.entry_key === w.key || a.entry_key === w.category))
  for (const tok of tokens(p.weapons.otherText)) {
    const w = matchWeapon(tok)
    if (w) { if (!weaponCovered(w) && !have('weapon', w.key)) add.push({ category: 'weapon', entry_key: w.key, label: w.name }) }
    else if (!have('weapon', homebrewKeyFromName(tok))) add.push({ category: 'weapon', entry_key: homebrewKeyFromName(tok), label: cap(tok) })
  }
  // ferramentas
  for (const tok of tokens(p.tools)) {
    const t = exact(tok, TOOLS) ?? rank(tok, TOOLS, 0.85)[0]?.item
    const label = t ? t.name : cap(tok)
    if (granted.tools.some((g) => fold(g) === fold(label) || fold(g) === fold(tok))) continue
    if (!add.some((a) => a.category === 'tool' && fold(a.label) === fold(label))) add.push({ category: 'tool', entry_key: t?.key ?? homebrewKeyFromName(tok), label })
  }
  // idiomas
  for (const tok of tokens(p.languages)) {
    const known = LANGUAGES.map((l) => ({ l, s: similarity(tok, l) })).sort((a, b) => b.s - a.s)[0]
    const label = known && known.s >= 0.75 ? known.l : cap(tok)
    if (granted.languages.some((g) => fold(g) === fold(label))) continue
    if (!add.some((a) => a.category === 'language' && fold(a.label) === fold(label))) add.push({ category: 'language', entry_key: homebrewKeyFromName(label), label })
  }

  c.draft.proficiencies = add
  if (add.length) c.note(`Proficiências acrescentadas: ${add.map((a) => a.label).join(', ')}`)
}

export const PROFICIENCY_STEPS = [saves, skills, proficiencies]
