import type { CreatureAbility, CreatureAbilityKind, CreatureAttack, CreatureSheet } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Ficha de criatura do Bestiário (Altherium): só a parte de texto — título,
// descrição, Ataque/Defesa/DB/Movimento, golpes e habilidades. Nada daqui
// entra nas contas de vida e dano: elas continuam nos campos hp e damage_dice.
// ────────────────────────────────────────────────────────

export const SHEET_LIMITS = {
  tier: 60, lore: 600, tag: 24, tags: 8, stat: 80, movement: 120,
  attackName: 40, attackDice: 12, attackKind: 12, attacks: 12,
  abilityName: 60, abilityFreq: 40, abilityText: 1200, abilities: 20,
  tactics: 600, weak: 300,
} as const

export const ABILITY_KINDS: { id: CreatureAbilityKind; label: string; short: string }[] = [
  { id: 'passiva',  label: 'Passiva',      short: 'Passiva' },
  { id: 'padrao',   label: 'Ação Padrão',  short: 'Padrão' },
  { id: 'bonus',    label: 'Ação Bônus',   short: 'Bônus' },
  { id: 'reacao',   label: 'Reação',       short: 'Reação' },
  { id: 'livre',    label: 'Ação Livre',   short: 'Livre' },
  { id: 'especial', label: 'Especial',     short: 'Especial' },
]

export function abilityKindLabel(kind: CreatureAbilityKind): string {
  return ABILITY_KINDS.find((k) => k.id === kind)?.label ?? 'Especial'
}

/** Sugestões de título (o texto é livre). */
export const TIER_SUGGESTIONS = [
  'Inimigo Fraco', 'Inimigo Médio', 'Inimigo Forte', 'Inimigo Extremamente Forte', 'Chefe',
]

/** Sugestões de tipo de dano dos golpes (o texto é livre). */
export const DAMAGE_KINDS = ['C', 'P', 'Cortante', 'Fogo', 'Gelo', 'Rúnico']

export function emptySheet(): CreatureSheet {
  return {
    tier: '', lore: '', tags: [], attack: '', defense: '', db: '', movement: '',
    attacks: [], abilities: [], tactics: '', weak: '',
  }
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const KIND_IDS = new Set<string>(ABILITY_KINDS.map((k) => k.id))

/** Lê o jsonb vindo do banco (ou de uma cópia) e devolve uma ficha segura. */
export function readSheet(raw: unknown): CreatureSheet {
  const base = emptySheet()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

  return {
    tier:     text(r.tier, SHEET_LIMITS.tier),
    lore:     text(r.lore, SHEET_LIMITS.lore),
    tags:     list(r.tags).filter((t): t is string => typeof t === 'string').slice(0, SHEET_LIMITS.tags).map((t) => t.slice(0, SHEET_LIMITS.tag)),
    attack:   text(r.attack, SHEET_LIMITS.stat),
    defense:  text(r.defense, SHEET_LIMITS.stat),
    db:       text(r.db, SHEET_LIMITS.stat),
    movement: text(r.movement, SHEET_LIMITS.movement),
    attacks: list(r.attacks).slice(0, SHEET_LIMITS.attacks).map((a): CreatureAttack => {
      const o = obj(a)
      return { name: text(o.name, SHEET_LIMITS.attackName), dice: text(o.dice, SHEET_LIMITS.attackDice), kind: text(o.kind, SHEET_LIMITS.attackKind) }
    }),
    abilities: list(r.abilities).slice(0, SHEET_LIMITS.abilities).map((a): CreatureAbility => {
      const o = obj(a)
      const kind = typeof o.kind === 'string' && KIND_IDS.has(o.kind) ? (o.kind as CreatureAbilityKind) : 'especial'
      return { name: text(o.name, SHEET_LIMITS.abilityName), kind, freq: text(o.freq, SHEET_LIMITS.abilityFreq), text: text(o.text, SHEET_LIMITS.abilityText) }
    }),
    tactics: text(r.tactics, SHEET_LIMITS.tactics),
    weak:    text(r.weak, SHEET_LIMITS.weak),
  }
}

/** Tags digitadas ("morto-vivo, grande") → lista limpa. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of input.split(/[,;\n]/)) {
    const tag = part.trim().slice(0, SHEET_LIMITS.tag)
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    out.push(tag)
    if (out.length >= SHEET_LIMITS.tags) break
  }
  return out
}

/** Tira espaços e linhas vazias. null quando não sobrou nada (nada a guardar). */
export function cleanSheet(sheet: CreatureSheet): CreatureSheet | null {
  const s = readSheet(sheet)
  const clean: CreatureSheet = {
    ...s,
    tier: s.tier.trim(), lore: s.lore.trim(), attack: s.attack.trim(), defense: s.defense.trim(),
    db: s.db.trim(), movement: s.movement.trim(), tactics: s.tactics.trim(), weak: s.weak.trim(),
    tags: parseTags(s.tags.join(',')),
    attacks: s.attacks
      .map((a) => ({ name: a.name.trim(), dice: a.dice.trim().toLowerCase().replace(/\s+/g, ''), kind: a.kind.trim() }))
      .filter((a) => a.name || a.dice),
    abilities: s.abilities
      .map((a) => ({ ...a, name: a.name.trim(), freq: a.freq.trim(), text: a.text.trim() }))
      .filter((a) => a.name || a.text),
  }
  return sheetIsEmpty(clean) ? null : clean
}

export function sheetIsEmpty(s: CreatureSheet): boolean {
  return !(
    s.tier || s.lore || s.tags.length || s.attack || s.defense || s.db || s.movement ||
    s.attacks.length || s.abilities.length || s.tactics || s.weak
  )
}

// ── Texto das habilidades ────────────────────────────────

export type TextPiece = { text: string; mark: 'dice' | 'dt' | null }
export type TextBlock = { type: 'p'; pieces: TextPiece[] } | { type: 'ul'; items: TextPiece[][] }

const MARK = /(\b\d{0,2}d\d{1,3}(?:\s?[+-]\s?\d{1,3})?(?![\wÀ-ú])|\bDT\s?\d{1,2}\b)/g

/** Quebra um trecho em pedaços, marcando dados (2d10+3) e DT (DT 14). */
export function markText(line: string): TextPiece[] {
  const pieces: TextPiece[] = []
  let last = 0
  for (const m of line.matchAll(MARK)) {
    const at = m.index ?? 0
    if (at > last) pieces.push({ text: line.slice(last, at), mark: null })
    pieces.push({ text: m[0], mark: m[0].toUpperCase().startsWith('DT') ? 'dt' : 'dice' })
    last = at + m[0].length
  }
  if (last < line.length) pieces.push({ text: line.slice(last), mark: null })
  return pieces
}

/** Parágrafos e listas ("- item" ou "• item") a partir do texto de uma habilidade. */
export function textBlocks(input: string): TextBlock[] {
  const blocks: TextBlock[] = []
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const bullet = /^[-•*]\s+(.*)$/.exec(line)
    if (bullet) {
      const last = blocks[blocks.length - 1]
      const item = markText(bullet[1])
      if (last?.type === 'ul') last.items.push(item)
      else blocks.push({ type: 'ul', items: [item] })
    } else {
      blocks.push({ type: 'p', pieces: markText(line) })
    }
  }
  return blocks
}
