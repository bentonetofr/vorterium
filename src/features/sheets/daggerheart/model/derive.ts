import { ancestry } from '../catalog/heritage'
import { dhClass } from '../catalog/classes'
import { DOMAIN_ORDER } from '../catalog/rules'
import { domainCard } from '../catalog/domainCards'
import { weaponEntry } from '../catalog/weapons'
import { ARMOR_SCORE_MAX, HOPE_MAX, HP_SLOTS_MAX, LOADOUT_MAX, STRESS_SLOTS_MAX } from './defaults'
import type { DhClass, DhDomain, DhModifiers, DhPick, DhSheetData, DhSubclass, DhTier, DhTrait, DhWeaponSlot } from './types'
import { DH_TRAITS } from './types'

// ────────────────────────────────────────────────────────
// Motor de regras (puro): tudo que a ficha mostra e que dá pra calcular vem daqui — nível e patamar, Proficiência,
// espaços de Vida e Fadiga, Evasão, Armadura, limiares de dano, Esperança, atributos, domínios e cartas.
// A ficha guarda só as escolhas; os números são sempre recalculados.
// ────────────────────────────────────────────────────────

export function tierOf(level: number): DhTier {
  if (level <= 1) return 1
  if (level <= 4) return 2
  if (level <= 7) return 3
  return 4
}

export function tierName(tier: number): string {
  return `Patamar ${tier}`
}

/** Níveis em que o personagem ganha uma Experiência nova, +1 de Proficiência (e, nos dois últimos, limpa as marcas de atributo). */
export const ACHIEVEMENT_LEVELS = [2, 5, 8]

export function currentClass(s: DhSheetData): DhClass | undefined {
  return dhClass(s.classKey)
}

export function currentSubclass(s: DhSheetData): DhSubclass | undefined {
  const cls = currentClass(s)
  return cls?.subclasses.find((x) => x.key === s.subclassKey)
}

/** Quantas cartas de subclasse a pessoa tem (1 = só a fundamental, 2 = com especialização, 3 = com maestria). */
export function subclassStage(s: DhSheetData): 1 | 2 | 3 {
  const upgrades = s.advancements.flatMap((a) => a.picks).filter((p) => p.opt === 'subclass').length
  return Math.min(3, 1 + upgrades) as 1 | 2 | 3
}

export function picksOf(s: DhSheetData, opt: DhPick['opt']): DhPick[] {
  return s.advancements.flatMap((a) => a.picks).filter((p) => p.opt === opt)
}

export function multiclassPick(s: DhSheetData): Extract<DhPick, { opt: 'multiclass' }> | null {
  return (picksOf(s, 'multiclass')[0] as Extract<DhPick, { opt: 'multiclass' }> | undefined) ?? null
}

// ── Proficiência ───────────────────────────────────────

export function proficiency(s: DhSheetData): number {
  const achievements = ACHIEVEMENT_LEVELS.filter((l) => s.level >= l).length
  return Math.min(8, 1 + achievements + picksOf(s, 'proficiency').length)
}

// ── Atributos ──────────────────────────────────────────

/** Atributos marcados na subida (ficam marcados até o nível 5 ou 8 limpá-los). */
export function markedTraits(s: DhSheetData): DhTrait[] {
  const clearLevel = s.level >= 8 ? 8 : s.level >= 5 ? 5 : 2
  return s.advancements
    .filter((a) => a.level >= clearLevel)
    .flatMap((a) => a.picks)
    .flatMap((p) => (p.opt === 'traits' ? p.traits : []))
}

export function traitBonusFromPicks(s: DhSheetData, trait: DhTrait): number {
  return s.advancements.flatMap((a) => a.picks).reduce((n, p) => n + (p.opt === 'traits' ? p.traits.filter((t) => t === trait).length : 0), 0)
}

function equippedMods(s: DhSheetData): DhModifiers[] {
  const list: DhModifiers[] = []
  if (s.armor) list.push(s.armor.mods)
  for (const w of [s.primary, s.secondary]) {
    if (w?.catalogId) list.push(weaponMods(w))
  }
  return list
}

function weaponMods(w: DhWeaponSlot): DhModifiers {
  return (w.catalogId ? weaponEntry(w.catalogId)?.mods : undefined) ?? {}
}

export function traitValue(s: DhSheetData, trait: DhTrait): number {
  let v = s.traits[trait] + traitBonusFromPicks(s, trait)
  for (const m of equippedMods(s)) {
    v += (m.traits?.[trait] ?? 0) + (m.allTraits ?? 0)
  }
  return v
}

export function allTraitValues(s: DhSheetData): Record<DhTrait, number> {
  const out = {} as Record<DhTrait, number>
  for (const t of DH_TRAITS) out[t] = traitValue(s, t)
  return out
}

/** Atributo de conjuração: o da subclasse; se ela não tiver, o da subclasse escolhida na multiclasse. */
export function spellcastTrait(s: DhSheetData): DhTrait | null {
  const sub = currentSubclass(s)
  if (sub?.spellcast) return sub.spellcast
  const mc = multiclassPick(s)
  if (mc) {
    const cls = dhClass(mc.classKey)
    return cls?.subclasses.find((x) => x.key === mc.subclassKey)?.spellcast ?? null
  }
  return null
}

// ── Vida, Fadiga, Esperança ────────────────────────────

/** Quantas características de ancestralidade a pessoa tem de cada ancestralidade (a 1ª vem de ancestryKey, a 2ª de ancestry2Key). */
export function ancestryFeatures(s: DhSheetData): { name: string; text: string; from: string }[] {
  const a1 = ancestry(s.ancestryKey)
  const a2 = ancestry(s.ancestry2Key) ?? a1
  const out: { name: string; text: string; from: string }[] = []
  if (a1) out.push({ ...a1.features[0], from: a1.name })
  if (a2) out.push({ ...a2.features[1], from: a2.name })
  return out
}

function hasAncestryFeature(s: DhSheetData, name: string): boolean {
  return ancestryFeatures(s).some((f) => f.name === name)
}

function subclassHas(s: DhSheetData, name: string): boolean {
  const sub = currentSubclass(s)
  if (!sub) return false
  const stage = subclassStage(s)
  const groups = [sub.foundation, stage >= 2 ? sub.specialization : [], stage >= 3 ? sub.mastery : []]
  return groups.some((g) => g.some((f) => f.name === name))
}

export function hpSlots(s: DhSheetData): number {
  const base = currentClass(s)?.hp ?? 6
  let n = base + picksOf(s, 'hp').length + s.hpBonus
  if (hasAncestryFeature(s, 'Resistência')) n += 1
  if (subclassHas(s, 'Mago de Batalha')) n += 1
  return Math.min(HP_SLOTS_MAX, n)
}

export function stressSlots(s: DhSheetData): number {
  let n = 6 + picksOf(s, 'stress').length + s.stressBonus
  if (hasAncestryFeature(s, 'Resiliência')) n += 1
  if (subclassHas(s, 'Vem Tranquilo')) n += 1
  return Math.min(STRESS_SLOTS_MAX, n)
}

export function hopeSlots(s: DhSheetData): number {
  const companion = s.companion?.picks.includes('luz') ? 1 : 0
  return Math.max(0, HOPE_MAX - s.scars + companion)
}

// ── Evasão, Armadura e limiares ────────────────────────

export function evasion(s: DhSheetData): number {
  const base = currentClass(s)?.evasion ?? 10
  let n = base + s.evasionBonus + picksOf(s, 'evasion').length
  if (hasAncestryFeature(s, 'Ágil')) n += 1
  if (subclassHas(s, 'Sombra Fugaz')) n += 1
  for (const m of equippedMods(s)) n += m.evasion ?? 0
  return Math.max(0, n)
}

export function armorScore(s: DhSheetData): number {
  if (!s.armor) {
    // sem armadura o personagem não tem Pontos de Armadura (a carta Armadura Corporal é tratada à parte pelo bônus manual)
    return Math.max(0, Math.min(ARMOR_SCORE_MAX, s.armorBonus))
  }
  let n = s.armor.score + s.armorBonus
  for (const w of [s.primary, s.secondary]) n += w?.catalogId ? (weaponMods(w).armor ?? 0) : 0
  return Math.max(0, Math.min(ARMOR_SCORE_MAX, n))
}

export interface Thresholds {
  major: number
  severe: number
}

/** Limiares de dano: base da armadura + nível + bônus. Sem armadura: nível e o dobro do nível. */
export function thresholds(s: DhSheetData): Thresholds {
  let major = s.armor ? s.armor.major + s.level : s.level
  let severe = s.armor ? s.armor.severe + s.level : s.level * 2
  const stage = subclassStage(s)
  const sub = currentSubclass(s)
  if (sub?.key === 'baluarte') {
    const extra = stage >= 3 ? 6 : stage >= 2 ? 3 : 1
    major += extra
    severe += extra
  }
  if (subclassHas(s, 'Ascensão')) severe += 4
  if (hasAncestryFeature(s, 'Carapaça')) {
    major += proficiency(s)
    severe += proficiency(s)
  }
  for (const w of [s.primary, s.secondary]) severe += w?.catalogId ? (weaponMods(w).severe ?? 0) : 0
  return { major: major + s.majorBonus, severe: severe + s.severeBonus }
}

/** Quantos Pontos de Vida o dano marca, pelos limiares (0 = nenhum). Com a regra opcional de dano massivo, o dobro do grave marca 4. */
export function hpFromDamage(damage: number, t: Thresholds, massive = false): number {
  if (damage <= 0) return 0
  if (massive && damage >= t.severe * 2) return 4
  if (damage >= t.severe) return 3
  if (damage >= t.major) return 2
  return 1
}

/** Reduz a gravidade em uma categoria (Pontos de Armadura): grave→maior→menor→nenhum. */
export function reducedMarks(marks: number, steps = 1): number {
  return Math.max(0, marks - steps)
}

// ── Marcar Fadiga e Vida ───────────────────────────────

/** Marcar Fadiga: o que passar dos espaços livres vira Pontos de Vida. */
export function markStress(s: DhSheetData, amount: number): { stressMarked: number; hpMarked: number } {
  const slots = stressSlots(s)
  const free = Math.max(0, slots - s.stressMarked)
  const toStress = Math.min(free, amount)
  const overflow = amount - toStress
  const hp = hpSlots(s)
  return { stressMarked: s.stressMarked + toStress, hpMarked: Math.min(hp, s.hpMarked + (overflow > 0 ? 1 : 0)) }
}

/** Com todos os espaços de Fadiga marcados o personagem fica Vulnerável. */
export function isVulnerableFromStress(s: DhSheetData): boolean {
  return s.stressMarked >= stressSlots(s)
}

export function isDown(s: DhSheetData): boolean {
  return s.hpMarked >= hpSlots(s)
}

// ── Domínios e cartas ──────────────────────────────────

/** Domínios que o personagem tem: os da classe e, se multiclasse, um da outra classe. */
export function ownedDomains(s: DhSheetData): DhDomain[] {
  const cls = currentClass(s)
  const out: DhDomain[] = cls ? [...cls.domains] : []
  const mc = multiclassPick(s)
  if (mc && !out.includes(mc.domain)) out.push(mc.domain)
  return DOMAIN_ORDER.filter((d) => out.includes(d))
}

/** Nível máximo de carta que o personagem pode pegar de um domínio (multiclasse: metade do nível, arredondado para cima). */
export function maxCardLevel(s: DhSheetData, domain: DhDomain): number {
  const cls = currentClass(s)
  if (cls?.domains.includes(domain)) return s.level
  return Math.ceil(s.level / 2)
}

export function cardsInHand(s: DhSheetData): number {
  return s.loadout.filter((id) => domainCard(id) && id !== 'notorious').length
}

export function loadoutIsFull(s: DhSheetData): boolean {
  return cardsInHand(s) >= LOADOUT_MAX
}

/** Custo, em Fadiga, de trocar uma carta da reserva para a mão fora do descanso. */
export function recallCost(id: string): number {
  return domainCard(id)?.recall ?? 0
}

// ── Armas ──────────────────────────────────────────────

/** Fórmula de dano com a Proficiência: "d8+3" com Proficiência 2 vira "2d8+3". */
export function damageFormula(dice: string, prof: number): string {
  const m = dice.trim().match(/^d(\d+)(\s*[+-]\s*\d+)?$/i)
  if (!m) return dice
  return `${prof}d${m[1]}${m[2] ? m[2].replace(/\s+/g, '') : ''}`
}

/** Bônus de dano que vêm de habilidades fáceis de calcular (Treinamento de Combate do guerreiro soma o nível ao dano físico). */
export function flatDamageBonus(s: DhSheetData, type: 'fis' | 'mag' | 'ambos'): number {
  let n = 0
  if (s.classKey === 'guerreiro' && type !== 'mag') n += s.level
  return n
}

/** Modificador do teste de ataque de uma arma: atributo + bônus da arma (ex.: Confiável +1). */
export function attackModifier(s: DhSheetData, w: DhWeaponSlot): number {
  const trait = w.trait === 'conjuracao' ? spellcastTrait(s) : w.trait || null
  const t = trait ? traitValue(s, trait) : 0
  const entry = w.catalogId ? weaponEntry(w.catalogId) : undefined
  return t + w.attackBonus + (entry?.mods?.attack ?? 0)
}

// ── Experiências ───────────────────────────────────────

/** Bônus de uma Experiência: o valor base mais os +1 das subidas de nível. */
export function experienceMod(s: DhSheetData, id: string): number {
  const exp = s.experiences.find((e) => e.id === id)
  if (!exp) return 0
  const extra = s.advancements.flatMap((a) => a.picks).reduce((n, p) => n + (p.opt === 'experiences' && p.ids.includes(id) ? 1 : 0), 0)
  return exp.mod + extra
}

// ── Ouro ───────────────────────────────────────────────

/** Soma ouro em punhados; 10 punhados = 1 saco, 10 sacos = 1 baú. */
export function addGold(g: DhSheetData['gold'], handfuls: number): DhSheetData['gold'] {
  let h = g.handfuls + handfuls
  let b = g.bags
  let c = g.chests
  while (h >= 10) { h -= 10; b += 1 }
  while (b >= 10) { b -= 10; c += 1 }
  while (h < 0 && (b > 0 || c > 0)) {
    h += 10
    if (b > 0) b -= 1
    else { c -= 1; b += 9 }
  }
  return { handfuls: Math.max(0, h), bags: Math.max(0, b), chests: Math.min(9, Math.max(0, c)) }
}
