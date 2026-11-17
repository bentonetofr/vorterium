import { ADVANCE_OPTIONS } from '../catalog/rules'
import { dhClass } from '../catalog/classes'
import { domainCard } from '../catalog/domainCards'
import { MAX_LEVEL, newId } from './defaults'
import { ACHIEVEMENT_LEVELS, loadoutIsFull, markedTraits, maxCardLevel, multiclassPick, ownedDomains, subclassStage, tierOf } from './derive'
import type { DhAdvancement, DhPick, DhSheetData, DhTrait } from './types'

// ────────────────────────────────────────────────────────
// Subida de nível (Livro Básico, "Subindo de Nível"): a cada nível o personagem ganha as conquistas do patamar,
// escolhe duas opções do quadro (ou uma que ocupa as duas: Proficiência ou multiclasse), sobe os limiares (nível + 1)
// e pega uma carta de domínio. Os efeitos não são aplicados na ficha: ficam registrados nas escolhas e o motor recalcula.
// ────────────────────────────────────────────────────────

export type AdvanceOpt = DhPick['opt']
type PickTier = 2 | 3 | 4

const OPTION_BY_KEY = new Map<string, (typeof ADVANCE_OPTIONS)[number]>(ADVANCE_OPTIONS.map((o) => [o.opt, o]))

/** Quanto da subida a opção consome: Proficiência e multiclasse ocupam as duas escolhas. */
export function pickCost(opt: AdvanceOpt): 1 | 2 {
  return opt === 'proficiency' || opt === 'multiclass' ? 2 : 1
}

/** Teto do nível da carta de domínio pela casa do quadro (patamar 2: até o nível 4; patamar 3: até o 7). */
export function domainPickCap(tier: PickTier): number {
  return tier === 2 ? 4 : tier === 3 ? 7 : 10
}

export function slotCapacity(opt: AdvanceOpt, tier: PickTier): number {
  const o = OPTION_BY_KEY.get(opt)
  const slots = (o?.slots ?? {}) as Partial<Record<PickTier, number>>
  return slots[tier] ?? 0
}

export function slotsUsed(s: DhSheetData, opt: AdvanceOpt, tier: PickTier): number {
  return s.advancements.flatMap((a) => a.picks).filter((p) => p.opt === opt && p.tier === tier).length
}

export interface AdvanceChoice {
  opt: AdvanceOpt
  tier: PickTier
  cost: 1 | 2
  /** Casas ainda livres neste quadro. */
  remaining: number
  /** Por que não dá para escolher agora (null = disponível). */
  blocked: string | null
}

/** O que dá para escolher ao subir para `level`: casas livres do patamar do nível e dos anteriores. */
export function advanceChoices(s: DhSheetData, level: number): AdvanceChoice[] {
  const tier = tierOf(level)
  const out: AdvanceChoice[] = []
  const picks = s.advancements.flatMap((a) => a.picks)
  const mc = multiclassPick(s)
  for (let t = 2; t <= tier; t++) {
    const pt = t as PickTier
    for (const o of ADVANCE_OPTIONS) {
      const cap = slotCapacity(o.opt, pt)
      if (cap === 0) continue
      const remaining = cap - slotsUsed(s, o.opt, pt)
      let blocked: string | null = remaining <= 0 ? 'Já escolhida o máximo de vezes neste patamar.' : null
      if (!blocked && o.opt === 'subclass') {
        if (subclassStage(s) >= 3) blocked = 'Você já tem a carta de maestria.'
        else if (mc && mc.tier === pt) blocked = 'Você multiclassou neste patamar.'
      }
      if (!blocked && o.opt === 'multiclass') {
        if (mc) blocked = 'Só dá para multiclassar uma vez.'
        else if (picks.some((p) => p.opt === 'subclass' && p.tier === pt)) blocked = 'Você pegou uma subclasse melhorada neste patamar.'
        else if (level < 5) blocked = 'A partir do nível 5.'
      }
      out.push({ opt: o.opt, tier: pt, cost: pickCost(o.opt), remaining: Math.max(0, remaining), blocked })
    }
  }
  return out
}

/** Atributos que ainda não foram marcados (só esses podem receber +1). */
export function unmarkedTraits(s: DhSheetData, level: number): DhTrait[] {
  const probe = { ...s, level }
  const marked = new Set(markedTraits(probe))
  return (['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'] as const).filter((t) => !marked.has(t))
}

export function canLevelUp(s: DhSheetData): boolean {
  return !!s.classKey && !!s.subclassKey && s.level < MAX_LEVEL
}

export function achievementsAt(level: number): { experience: boolean; proficiency: boolean; clearsMarks: boolean } {
  const gets = ACHIEVEMENT_LEVELS.includes(level)
  return { experience: gets, proficiency: gets, clearsMarks: level === 5 || level === 8 }
}

/** Confere uma subida. Devolve a primeira regra quebrada ou null se estiver tudo certo. */
export function validateAdvancement(s: DhSheetData, adv: DhAdvancement): string | null {
  if (adv.level !== s.level + 1) return 'A subida precisa ser para o próximo nível.'
  if (adv.level > MAX_LEVEL) return 'O nível máximo é 10.'
  const cost = adv.picks.reduce((n, p) => n + pickCost(p.opt), 0)
  if (cost !== 2) return 'Escolha duas opções (ou uma que ocupe as duas).'

  const after: DhSheetData = { ...s, level: adv.level }
  const choices = advanceChoices(s, adv.level)
  const used = new Map<string, number>()
  const marked = new Set(markedTraits(after))
  const ownedCards = new Set([...s.loadout, ...s.vault])
  const takenCards = new Set<string>()

  for (const p of adv.picks) {
    const key = `${p.opt}:${p.tier}`
    used.set(key, (used.get(key) ?? 0) + 1)
    const choice = choices.find((c) => c.opt === p.opt && c.tier === p.tier)
    if (!choice) return 'Opção indisponível neste patamar.'
    if (choice.blocked) return choice.blocked
    if ((used.get(key) ?? 0) > choice.remaining) return 'Não restam casas para essa opção.'

    if (p.opt === 'traits') {
      if (p.traits[0] === p.traits[1]) return 'Escolha dois atributos diferentes.'
      if (p.traits.some((t) => marked.has(t))) return 'Só atributos desmarcados podem subir.'
      for (const t of p.traits) marked.add(t)
    }
    if (p.opt === 'experiences') {
      if (p.ids[0] === p.ids[1]) return 'Escolha duas Experiências diferentes.'
      const known = new Set(s.experiences.map((e) => e.id))
      if (adv.experienceId) known.add(adv.experienceId)
      if (p.ids.some((id) => !known.has(id))) return 'Experiência não encontrada.'
    }
    if (p.opt === 'domain') {
      const c = domainCard(p.card)
      if (!c) return 'Carta de domínio não encontrada.'
      if (!ownedDomains(after).includes(c.domain)) return 'Essa carta é de um domínio que você não tem.'
      if (c.level > Math.min(maxCardLevel(after, c.domain), domainPickCap(p.tier))) return 'A carta passa do nível permitido.'
      if (ownedCards.has(p.card) || takenCards.has(p.card)) return 'Você já tem essa carta.'
      takenCards.add(p.card)
    }
    if (p.opt === 'multiclass') {
      const cls = dhClass(p.classKey)
      if (!cls || cls.key === s.classKey) return 'Escolha uma classe diferente da sua.'
      if (!cls.domains.includes(p.domain)) return 'Esse domínio não é da classe escolhida.'
      if (ownedDomains(after).includes(p.domain)) return 'Escolha um domínio que você ainda não tem.'
      if (!cls.subclasses.some((x) => x.key === p.subclassKey)) return 'Escolha uma subclasse da classe.'
    }
  }

  // carta de domínio que todo nível dá
  if (!adv.card) return 'Escolha a carta de domínio do nível.'
  const c = domainCard(adv.card)
  if (!c) return 'Carta de domínio não encontrada.'
  const afterPicks: DhSheetData = { ...after, advancements: [...s.advancements, adv] }
  if (!ownedDomains(afterPicks).includes(c.domain)) return 'Essa carta é de um domínio que você não tem.'
  if (c.level > maxCardLevel(afterPicks, c.domain)) return 'A carta passa do nível permitido.'
  if (ownedCards.has(adv.card) || takenCards.has(adv.card)) return 'Você já tem essa carta.'

  const gets = achievementsAt(adv.level)
  if (gets.experience && !adv.experienceId) return 'Dê um nome à nova Experiência.'
  return null
}

/** Aplica a subida (já validada): sobe o nível, junta a Experiência e as cartas. Cartas vão para a mão enquanto houver espaço, senão para a reserva. */
export function applyAdvancement(s: DhSheetData, adv: DhAdvancement, experienceName?: string): DhSheetData {
  const next: DhSheetData = { ...s, level: adv.level, advancements: [...s.advancements, adv], loadout: [...s.loadout], vault: [...s.vault], experiences: [...s.experiences] }
  if (adv.experienceId && experienceName) next.experiences.push({ id: adv.experienceId, name: experienceName, mod: 2 })
  const newCards = [adv.card, ...adv.picks.flatMap((p) => (p.opt === 'domain' ? [p.card] : []))].filter((c): c is string => !!c)
  for (const id of newCards) {
    if (!loadoutIsFull(next)) next.loadout.push(id)
    else next.vault.push(id)
  }
  return next
}

/** Desfaz a última subida (útil para corrigir um erro). */
export function undoLastAdvancement(s: DhSheetData): DhSheetData {
  const last = s.advancements[s.advancements.length - 1]
  if (!last) return s
  const cards = new Set([last.card, ...last.picks.flatMap((p) => (p.opt === 'domain' ? [p.card] : []))].filter((c): c is string => !!c))
  return {
    ...s,
    level: last.level - 1,
    advancements: s.advancements.slice(0, -1),
    experiences: s.experiences.filter((e) => e.id !== last.experienceId),
    loadout: s.loadout.filter((id) => !cards.has(id)),
    vault: s.vault.filter((id) => !cards.has(id)),
    cardsUsed: s.cardsUsed.filter((id) => !cards.has(id)),
  }
}

export function newExperienceId(): string {
  return newId()
}
