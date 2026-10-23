import type { AbilityKey, SkillKey } from '../../rules/types'
import type { PdfField } from '../pdfFields'
import type { ReadSpell, ReadSpellCard, ReadSlot, SheetRead } from '../readTypes'

// ────────────────────────────────────────────────────────
// Modelo "JohnBard.com DnD 5e CS v1.4": a ficha preenchível de Jeremy
// Wunders (a versão traduzida por Mario Mazzero é a mais usada no Brasil).
// Sete páginas: 1 atributos, perícias, combate e características; 2 aparência,
// história e inventário em texto; 3 lista de magias por nível; 4 em diante
// cartas de magia. Os nomes dos campos são fixos, então a leitura é exata. As
// linhas da lista de magias não dizem o nível no nome ("Spells 1014"): o
// nível vem da posição na página (o cabeçalho de espaços logo acima).
// ────────────────────────────────────────────────────────

export const JOHNBARD_MODEL = 'johnbard-1.4'

/** Campos que só existem nesse modelo (têm de estar todos). */
const SIGNATURE = ['Character Name', 'STR2', 'DEX2', 'SklAcrProf', 'SklSurVal', 'Attack1Name', 'Spells 1014', 'SlotsTotal 19', 'Class Features']

export function isJohnBard(fields: readonly PdfField[]): boolean {
  const names = new Set(fields.map((f) => f.name))
  return SIGNATURE.every((n) => names.has(n))
}

const ABILITY_CODES: [AbilityKey, string][] = [
  ['strength', 'STR'], ['dexterity', 'DEX'], ['constitution', 'CON'], ['intelligence', 'INT'], ['wisdom', 'WIS'], ['charisma', 'CHA'],
]
const SAVE_CODES: Record<AbilityKey, string> = { strength: 'Str', dexterity: 'Dex', constitution: 'Con', intelligence: 'Int', wisdom: 'Wis', charisma: 'Cha' }
const SKILL_CODES: Record<SkillKey, string> = {
  acrobatics: 'Acr', arcana: 'Arc', athletics: 'Ath', deception: 'Dec', stealth: 'Ste', history: 'His', insight: 'Ins', intimidation: 'Int',
  investigation: 'Inv', animal_handling: 'Ani', medicine: 'Med', nature: 'Nat', perception: 'Perc', performance: 'Perf', persuasion: 'Pers',
  sleight_of_hand: 'Sle', religion: 'Rel', survival: 'Sur',
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

/** Cada carta de magia é identificada por página e posição ("0.1" = linha 0, coluna 1). */
const CARD_NAME = /^SpellSheet ?(\d)_(.+?)\.(\d+)\.(\d+)(?:\.\d+\.\d+)?$/

export function readJohnBard(fields: readonly PdfField[]): SheetRead {
  const byName = new Map<string, PdfField[]>()
  for (const f of fields) { const l = byName.get(f.name); if (l) l.push(f); else byName.set(f.name, [f]) }

  /** O texto do campo (o primeiro que não está vazio; o mesmo campo pode aparecer em mais de uma página). */
  const text = (name: string): string => {
    for (const f of byName.get(name) ?? []) if (typeof f.value === 'string' && f.value.trim() !== '') return f.value.trim()
    return ''
  }
  const checked = (name: string): boolean => (byName.get(name) ?? []).some((f) => f.value === true)

  const abilities = {} as SheetRead['abilities']
  const saves = {} as SheetRead['saves']
  for (const [key, code] of ABILITY_CODES) {
    abilities[key] = { score: text(`${code}2`), mod: text(`${code}1`) }
    saves[key] = { value: text(`Sav${SAVE_CODES[key]}Val`), proficient: checked(`Sav${SAVE_CODES[key]}Prof`) }
  }
  const skills = {} as SheetRead['skills']
  for (const [key, code] of Object.entries(SKILL_CODES) as [SkillKey, string][]) {
    skills[key] = { value: text(`Skl${code}Val`), proficient: checked(`Skl${code}Prof`), expertise: checked(`Skl${code}Exp`) }
  }

  const six = [1, 2, 3, 4, 5, 6]
  const attacks = six.map((i) => ({ name: text(`Attack${i}Name`), bonus: text(`Attack${i}Bonus`), damage: text(`Attack${i}DmgType`) })).filter((a) => a.name || a.bonus || a.damage)
  const ammo = [1, 2, 3].map((i) => ({ name: text(`Ammo${i}`), qty: text(`NoLeft${i}`) })).filter((a) => a.name || a.qty)
  const consumables = six.map((i) => ({ name: text(`CONSUM${i}`), qty: text(`CNL${i}`) })).filter((a) => a.name || a.qty)
  const attuned = [1, 2, 3].map((i) => text(`AttunedItems${i}`)).filter(Boolean)
  const hitDice = [1, 2].map((i) => ({ die: text(`HD${i}`), total: text(`HDT${i}`), left: text(`HDL${i}`) })).filter((h) => h.die || h.total || h.left)
  const featureRows = six.map((i) => ({
    name: text(`AbilityName${i}`), total: text(`ABT${i}`), left: text(`ABL${i}`),
    shortRest: checked(`recoverySR${i}`), longRest: checked(`recoveryLR${i}`), dawn: checked(`recoveryDN${i}`),
  })).filter((r) => r.name)

  return {
    model: JOHNBARD_MODEL,
    identity: {
      characterName: text('Character Name'), playerName: text('Player Name'), classText: text('Class'), raceText: text('Race'),
      backgroundText: text('Background'), alignmentText: text('Alignment'), xpText: text('Experience Points'), nextLevelText: text('Next Level'),
    },
    abilities, profBonus: text('Proficiency Bonus'), inspiration: checked('Inspiration'), saves, skills,
    passivePerception: text('PassWis'),
    combat: {
      ac: text('Armor Class'), acBonus: text('Temp AC Bonus'), initiative: text('Initiative'), speed: text('Speed'), vision: text('Vision'),
      darkvision: checked('Darkvision'), hpMax: text('Max Hit Points'), hpCurrent: text('Current Hit Points'), hpTemp: text('Temporary Hit Points'),
      exhaustion: text('Exhaustion'), hitDice,
      deathSuccesses: [1, 2, 3].filter((i) => checked(`DeathSaveSuccess${i}`)).length,
      deathFailures: [1, 2, 3].filter((i) => checked(`DeathSaveFailure${i}`)).length,
    },
    armor: {
      type: text('ArmorType'), ac: text('ArmorAC'), maxDex: text('ArmorMaxDex'), strength: text('ArmorSTR'), shield: text('ArmorShieldAC'),
      stealthDisadvantage: checked('StealthDisadvantage'),
    },
    attacks, ammo, consumables, attuned,
    coins: { cp: text('CP'), sp: text('SP'), ep: text('EP'), gp: text('GP'), pp: text('PP') },
    proficiencies: {
      armor: { light: checked('ArmorLight'), medium: checked('ArmorMedium'), heavy: checked('ArmorHeavy'), shields: checked('ArmorShields') },
      weapons: { simple: checked('WeaponSimple'), martial: checked('WeaponMartial'), other: checked('WeaponOther'), otherText: [text('WeaponsOther1'), text('WeaponsOther2')].filter(Boolean).join(', ') },
      tools: text('ToolProfs'), languages: text('Languages'),
    },
    texts: {
      feats: text('Feats'), racialTraits: text('Racial Traits'), classFeatures: text('Class Features'), backgroundFeature: text('Background Feature'),
      additionalFeatures: text('Additional Features & Traits'), appearance: text('Character Appearance'),
      equipment: text('Treasure 1'), equipment2: text('Treasure 2'), allies: text('Allies & Organizations 1'),
      personality: text('Personality Traits'), ideals: text('Ideals'), bonds: text('Bonds'), flaws: text('Flaws'), madness: text('Madness Flaws'),
    },
    bio: { age: text('Age'), height: text('Height'), weight: text('Weight'), eyes: text('Eyes'), skin: text('Skin'), hair: text('Hair'), faction: text('Faction') },
    featureRows,
    spellcasting: readSpellcasting(fields, text, checked),
  }
}

// ── Magias ──────────────────────────────────────────────

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Coluna (1 a 3) de um campo da página de magias, pela posição à esquerda. */
const columnOf = (f: PdfField) => (f.rect[0] < 150 ? 1 : f.rect[0] < 330 ? 2 : 3)

function readSpellcasting(fields: readonly PdfField[], text: (n: string) => string, checked: (n: string) => boolean): SheetRead['spellcasting'] {
  // espaços por nível: o cabeçalho de cada nível fica logo acima da lista dele
  const headers: { level: number; col: number; y: number }[] = []
  const slots: ReadSlot[] = []
  for (let level = 1; level <= 9; level++) {
    const total = fields.find((f) => f.name === `SlotsTotal ${18 + level}`)
    if (total) headers.push({ level, col: columnOf(total), y: total.rect[1] })
    const marked = [1, 2, 3, 4, 5].filter((n) => checked(`SpellSheet1_Spell Slot ${ORDINALS[level - 1]} ${n}`)).length
    slots.push({ level, total: text(`SlotsTotal ${18 + level}`), remaining: text(`SlotsRemaining ${18 + level}`), marked })
  }

  const levelAt = (f: PdfField): number => {
    const above = headers.filter((h) => h.col === columnOf(f) && h.y < f.rect[1])
    return above.length ? above.reduce((a, b) => (b.y > a.y ? b : a)).level : 0
  }

  // lista por nível (página 3): "Spells NNNN" e a bolinha de preparada na mesma linha
  const page3 = fields.filter((f) => f.page === 3)
  const circles = page3.filter((f) => f.kind === 'check' && /^Check Box/.test(f.name))
  const list: ReadSpell[] = page3
    .filter((f) => /^Spells \d+$/.test(f.name) && typeof f.value === 'string' && f.value.trim() !== '')
    .sort((a, b) => columnOf(a) - columnOf(b) || a.rect[1] - b.rect[1])
    .map((f) => {
      const mid = (f.rect[1] + f.rect[3]) / 2
      const circle = circles.find((c) => c.rect[0] < f.rect[0] && f.rect[0] - c.rect[0] < 30 && Math.abs((c.rect[1] + c.rect[3]) / 2 - mid) < 6)
      return { name: String(f.value).trim(), level: levelAt(f), prepared: circle?.value === true, from: 'list' as const, card: null }
    })

  // cartas (página 4 em diante): os campos da mesma carta dividem o sufixo ".linha.coluna"
  const cards = new Map<string, { name: string; level: string; attrs: Map<string, PdfField> }>()
  for (const f of fields) {
    const m = CARD_NAME.exec(f.name)
    if (!m) continue
    const id = `${f.page}:${m[3]}.${m[4]}`
    let c = cards.get(id)
    if (!c) { c = { name: '', level: '', attrs: new Map() }; cards.set(id, c) }
    c.attrs.set(m[2].replace(/\s+/g, ' ').trim(), f)
  }
  const str = (c: { attrs: Map<string, PdfField> }, key: string) => { const v = c.attrs.get(key)?.value; return typeof v === 'string' ? v.trim() : '' }
  const flag = (c: { attrs: Map<string, PdfField> }, key: string) => c.attrs.get(key)?.value === true

  const spells = [...list]
  for (const c of [...cards.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true })).map(([, v]) => v)) {
    const name = str(c, 'Spell Name')
    if (!name) continue
    const card: ReadSpellCard = {
      school: str(c, 'Spell School'), range: str(c, 'Range'), castingTime: str(c, 'Casting Time'), duration: str(c, 'Duration'),
      components: str(c, 'Components'), save: str(c, 'Save'), effect: str(c, 'Spell Effect'),
      verbal: flag(c, 'Verbal'), somatic: flag(c, 'Somatic'), material: flag(c, 'Material'),
      concentration: flag(c, 'Concentration'), ritual: flag(c, 'Ritual'), prepared: flag(c, 'Prepared'),
    }
    const levelText = str(c, 'Spells Level')
    const level = /^\d+$/.test(levelText) ? Number(levelText) : null
    const hit = spells.find((s) => fold(s.name) === fold(name))
    if (hit) {
      hit.card = card
      hit.from = 'both'
      hit.prepared = hit.prepared || card.prepared
    } else spells.push({ name, level: level ?? 0, prepared: card.prepared, from: 'card', card })
  }

  return {
    className: text('Spellcasting Class 2'), ability: text('SpellcastingAbility 2'), dc: text('SpellSaveDC  2') || text('SpellSaveDC'),
    attack: text('SpellAtkBonus 2') || text('SpellATKBonus'), slots, spells,
  }
}
