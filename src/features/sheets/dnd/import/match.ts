import {
  ARMORS, BACKGROUNDS, CLASSES, RACES, WEAPONS,
  type ArmorEntry, type BackgroundDef, type ClassDef, type RaceDef, type SpellEntry, type SubclassDef, type SubraceDef, type WeaponEntry,
} from '../catalog'
import { BOOK_ITEMS, type BookItem } from '../catalog/itemBook'
import { SPELL_SCHOOL_LABEL, spellComponentsLabel } from '../catalog/spellUtils'
import type { ReadSpell } from './readTypes'
import { fold, similarity } from './text'

// ────────────────────────────────────────────────────────
// Casar o que está escrito no PDF com o catálogo do sistema (português e
// original, sem acento). Cada função devolve o que casou EXATAMENTE (nome,
// nome original ou chave) e uma lista de candidatos parecidos para perguntar.
// ────────────────────────────────────────────────────────

export interface Cand<T> { item: T; score: number }

interface Named { key: string; name: string; original?: string }

const namesOf = (e: Named) => [e.name, e.original ?? '', e.key.replace(/_/g, ' ')].filter(Boolean)

/** O que casa exatamente (sem acento e maiúscula) pelo nome, nome original ou chave. */
export function exact<T extends Named>(text: string, list: readonly T[]): T | null {
  const t = fold(text)
  if (!t) return null
  return list.find((e) => namesOf(e).some((n) => fold(n) === t)) ?? null
}

/** Candidatos parecidos, do mais para o menos parecido (nota de 0 a 1). */
export function rank<T extends Named>(text: string, list: readonly T[], min = 0.5): Cand<T>[] {
  return list
    .map((item) => ({ item, score: Math.max(...namesOf(item).map((n) => similarity(text, n))) }))
    .filter((c) => c.score >= min)
    .sort((a, b) => b.score - a.score)
}

// ── Classe, raça, antecedente ───────────────────────────

export const matchClass = (text: string): ClassDef | null => exact(text, CLASSES) ?? rank(text, CLASSES, 0.8)[0]?.item ?? null

export function matchBackground(text: string): BackgroundDef | null {
  return exact(text, BACKGROUNDS) ?? rank(text, BACKGROUNDS, 0.85)[0]?.item ?? null
}

/** "Half-Elf", "Elf, High", "Anão da Colina": a raça e, se o texto dizer, a sub-raça. */
export function matchRace(text: string): { race: RaceDef | null; subrace: SubraceDef | null } {
  const whole = exact(text, RACES)
  if (whole) return { race: whole, subrace: null }
  // uma sub-raça pelo nome inteiro ("Anão da Colina", "Hill Dwarf")
  for (const r of RACES) {
    const sub = exact(text, r.subraces)
    if (sub) return { race: r, subrace: sub }
  }
  // "Elf, High" / "Dwarf, Hill": a primeira parte é a raça, o resto a sub-raça
  const parts = text.split(/[,/()–-]/).map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const race = exact(parts[0], RACES) ?? rank(parts[0], RACES, 0.85)[0]?.item ?? null
    if (race) {
      const tail = parts.slice(1).join(' ')
      const sub = race.subraces.find((s) => namesOf(s).some((n) => fold(n).includes(fold(tail)) && fold(tail).length >= 3)) ?? null
      return { race, subrace: sub }
    }
  }
  const near = rank(text, RACES, 0.85)[0]?.item ?? null
  return { race: near, subrace: null }
}

/** Subclasse citada no texto da classe ("Bard (College of Lore) 5"). */
export function subclassInText(text: string, def: ClassDef): SubclassDef | null {
  const t = fold(text)
  return def.subclasses.find((s) => [s.name, s.original, s.key.replace(/_/g, ' ')].some((n) => fold(n).length >= 4 && t.includes(fold(n)))) ?? null
}

// ── Equipamento ─────────────────────────────────────────

export const matchWeapon = (text: string): WeaponEntry | null => exact(text, WEAPONS) ?? rank(text, WEAPONS, 0.9)[0]?.item ?? null

/** Item do catálogo (arma, armadura, escudo, equipamento ou ferramenta) pelo nome exato. */
export function matchItemExact(text: string): BookItem | null {
  return exact(text, BOOK_ITEMS)
}

/** Itens parecidos (não exatos) para sugerir. */
export function itemCandidates(text: string, min = 0.75, limit = 3): Cand<BookItem>[] {
  return rank(text, BOOK_ITEMS, min).slice(0, limit)
}

/** Armadura pelo texto da ficha ("Armadura de Couro" é "Couro"): nome exato, sem o "Armadura de", ou muito parecido. */
export function matchArmorText(text: string): ArmorEntry | null {
  const bare = text.replace(/^\s*(armadura|armor|cota)\s+(de\s+)?/i, '').trim()
  return exact(text, ARMORS) ?? exact(bare, ARMORS) ?? rank(bare, ARMORS, 0.9)[0]?.item ?? null
}

// ── Magias ──────────────────────────────────────────────

export interface SpellCandidate { entry: SpellEntry; score: number; reasons: string[] }

/** Candidata de verdade: nome parecido, ou alcance, tempo de conjuração e duração todos iguais aos da carta. */

const eq = (a: string, b: string) => !!a && !!b && fold(a) === fold(b)

/**
 * A magia do catálogo para uma magia lida do PDF. `exact` quando o nome
 * (português ou original) é igual. Senão, candidatos ordenados pela nota:
 * parecença do nome e o que a carta do PDF tem em comum com a magia do
 * catálogo (nível, alcance, tempo, duração, componentes, concentração,
 * ritual, escola). Dá para reconhecer "Perdição" como "Praga" pela carta.
 */
export function matchSpell(spell: ReadSpell, catalog: readonly SpellEntry[]): { exact: SpellEntry | null; candidates: SpellCandidate[] } {
  const hit = exact(spell.name, catalog)
  if (hit) return { exact: hit, candidates: [] }
  const card = spell.card
  const candidates: SpellCandidate[] = []
  for (const entry of catalog) {
    const reasons: string[] = []
    const nameSim = Math.max(similarity(spell.name, entry.name), similarity(spell.name, entry.original))
    let score = nameSim * 0.4
    let core = false
    if (entry.level === spell.level) { score += 0.15; reasons.push('mesmo nível') } else score -= 0.2
    if (card) {
      const checks: [boolean, string, number][] = [
        [eq(card.range, entry.range), 'alcance', 0.12],
        [eq(card.castingTime, entry.castingTime), 'tempo de conjuração', 0.1],
        [eq(card.duration.replace(/^concentra[cç][aã]o,?\s*/i, ''), entry.duration.replace(/^concentra[cç][aã]o,?\s*/i, '')) || eq(card.duration, entry.duration), 'duração', 0.12],
        [!!card.components && fold(card.components) === fold(spellComponentsLabel(entry.components)), 'componentes', 0.15],
        [card.concentration === !!entry.concentration, 'concentração', 0.04],
        [card.ritual === !!entry.ritual, 'ritual', 0.02],
        [!!card.school && fold(card.school) === fold(SPELL_SCHOOL_LABEL[entry.school]), 'escola', 0.1],
      ]
      for (const [ok, label, w] of checks) if (ok) { score += w; reasons.push(label) }
      core = checks[0][0] && checks[1][0] && checks[2][0]
      // a carta do PDF traz o texto da magia: o começo costuma coincidir com o do catálogo
      if (card.effect && entry.text[0] && similarity(card.effect.slice(0, 80), entry.text[0].slice(0, 80)) > 0.6) { score += 0.1; reasons.push('texto') }
    }
    if (score > 0.3 && (nameSim >= 0.55 || core)) candidates.push({ entry, score, reasons })
  }
  candidates.sort((a, b) => b.score - a.score)
  return { exact: null, candidates: candidates.slice(0, 3) }
}
