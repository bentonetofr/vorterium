import { dhClass } from '../catalog/classes'
import type { DhClassKey, DhCompanion, DhModifiers, DhSheetData, DhTrait, DhTrackers, DhWeaponSlot } from './types'
import { DH_TRAITS } from './types'
import { normalizeCardCounters, normalizeCounters } from './counters'

// ────────────────────────────────────────────────────────
// Ficha em branco e normalização do que vem do banco (a ficha inteira mora em uma coluna jsonb,
// então toda leitura passa por `normalizeSheet` para aceitar fichas antigas ou incompletas).
// ────────────────────────────────────────────────────────

export const MAX_LEVEL = 10
export const HP_SLOTS_MAX = 12
export const STRESS_SLOTS_MAX = 12
export const HOPE_MAX = 6
export const LOADOUT_MAX = 5
export const ARMOR_SCORE_MAX = 12
export const INVENTORY_LINES = 6

export function emptyTraits(): Record<DhTrait, number> {
  return { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 }
}

export function emptyTrackers(): DhTrackers {
  return { unstoppable: 0, prayer: [], slayer: 0, strange: 1, rallyGiven: false, choice: '', beastform: '', focus: '' }
}

export function emptyWeaponSlot(): DhWeaponSlot {
  return { catalogId: null, name: '', trait: '', range: '', dice: '', damageType: 'fis', hands: 0, feature: '', attackBonus: 0 }
}

export function emptyCompanion(): DhCompanion {
  return { name: '', evasion: 10, experiences: [], attack: '', damageDie: 6, range: 'melee', stressSlots: 3, stressMarked: 0, picks: [], notes: '' }
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function emptySheet(classKey: DhClassKey | null = null): DhSheetData {
  const cls = dhClass(classKey)
  return {
    v: 1,
    started: false,
    manual: {},
    name: '',
    pronouns: '',
    level: 1,
    classKey,
    subclassKey: null,
    ancestryKey: null,
    ancestry2Key: null,
    ancestryName: '',
    communityKey: null,
    traits: emptyTraits(),
    evasionBonus: 0,
    armorBonus: 0,
    hpBonus: 0,
    stressBonus: 0,
    majorBonus: 0,
    severeBonus: 0,
    hpMarked: 0,
    stressMarked: 0,
    hope: 2,
    scars: 0,
    armorMarked: 0,
    armor: null,
    primary: null,
    secondary: null,
    inventoryWeapons: [null, null],
    experiences: [],
    gold: { handfuls: 1, bags: 0, chests: 0 },
    inventory: cls ? ['Uma tocha', '15 metros de corda', 'Suprimentos básicos (barraca, saco de dormir, isqueiro, rações etc.)'] : [],
    loadout: [],
    vault: [],
    cardsUsed: [],
    counters: [],
    cardCounters: {},
    advancements: [],
    description: { clothes: '', eyes: '', body: '', skin: '', attitude: '' },
    background: ['', '', ''],
    connections: ['', '', ''],
    trackers: emptyTrackers(),
    companion: null,
    notes: '',
  }
}

// ── normalização ───────────────────────────────────────

function num(v: unknown, fallback: number, min = -99, max = 999): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback
  return Math.min(max, Math.max(min, n))
}

function str(v: unknown, max = 4000): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

function strList(v: unknown, size: number, max = 2000): string[] {
  const src = Array.isArray(v) ? v : []
  return Array.from({ length: size }, (_, i) => str(src[i], max))
}

function weaponSlot(v: unknown): DhWeaponSlot | null {
  if (!v || typeof v !== 'object') return null
  const w = v as Record<string, unknown>
  const base = emptyWeaponSlot()
  return {
    catalogId: strOrNull(w.catalogId),
    name: str(w.name, 120),
    trait: (['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge', 'conjuracao'] as const).find((t) => t === w.trait) ?? '',
    range: (['melee', 'muito_proximo', 'proximo', 'distante', 'muito_distante'] as const).find((r) => r === w.range) ?? '',
    dice: str(w.dice, 20),
    damageType: w.damageType === 'mag' || w.damageType === 'ambos' ? w.damageType : base.damageType,
    hands: w.hands === 1 || w.hands === 2 ? w.hands : 0,
    feature: str(w.feature, 600),
    attackBonus: num(w.attackBonus, 0, -10, 10),
  }
}

export function normalizeSheet(raw: unknown): DhSheetData {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = emptySheet()
  const traitsRaw = (r.traits && typeof r.traits === 'object' ? r.traits : {}) as Record<string, unknown>
  const traits = emptyTraits()
  for (const t of DH_TRAITS) traits[t] = num(traitsRaw[t], 0, -5, 8)

  const classKey = typeof r.classKey === 'string' && dhClass(r.classKey as DhClassKey) ? (r.classKey as DhClassKey) : null
  const goldRaw = (r.gold && typeof r.gold === 'object' ? r.gold : {}) as Record<string, unknown>
  const descRaw = (r.description && typeof r.description === 'object' ? r.description : {}) as Record<string, unknown>
  const trkRaw = (r.trackers && typeof r.trackers === 'object' ? r.trackers : {}) as Record<string, unknown>
  const armorRaw = r.armor && typeof r.armor === 'object' ? (r.armor as Record<string, unknown>) : null
  const invW = Array.isArray(r.inventoryWeapons) ? r.inventoryWeapons : []

  return {
    ...d,
    v: 1,
    started: r.started === true || classKey !== null,
    manual: normalizeManual(r.manual),
    name: str(r.name, 120),
    pronouns: str(r.pronouns, 60),
    level: num(r.level, 1, 1, MAX_LEVEL),
    classKey,
    subclassKey: strOrNull(r.subclassKey),
    ancestryKey: strOrNull(r.ancestryKey),
    ancestry2Key: strOrNull(r.ancestry2Key),
    ancestryName: str(r.ancestryName, 120),
    communityKey: strOrNull(r.communityKey),
    traits,
    evasionBonus: num(r.evasionBonus, 0, -10, 10),
    armorBonus: num(r.armorBonus, 0, -10, 10),
    hpBonus: num(r.hpBonus, 0, 0, 6),
    stressBonus: num(r.stressBonus, 0, 0, 6),
    majorBonus: num(r.majorBonus, 0, -20, 40),
    severeBonus: num(r.severeBonus, 0, -20, 40),
    hpMarked: num(r.hpMarked, 0, 0, HP_SLOTS_MAX),
    stressMarked: num(r.stressMarked, 0, 0, STRESS_SLOTS_MAX),
    hope: num(r.hope, 2, 0, HOPE_MAX + 1),
    scars: num(r.scars, 0, 0, HOPE_MAX),
    armorMarked: num(r.armorMarked, 0, 0, ARMOR_SCORE_MAX),
    armor: armorRaw ? {
      catalogId: strOrNull(armorRaw.catalogId),
      name: str(armorRaw.name, 120),
      major: num(armorRaw.major, 0, 0, 60),
      severe: num(armorRaw.severe, 0, 0, 90),
      score: num(armorRaw.score, 0, 0, ARMOR_SCORE_MAX),
      feature: str(armorRaw.feature, 600),
      mods: armorRaw.mods && typeof armorRaw.mods === 'object' ? (armorRaw.mods as DhModifiers) : {},
    } : null,
    primary: weaponSlot(r.primary),
    secondary: weaponSlot(r.secondary),
    inventoryWeapons: [weaponSlot(invW[0]), weaponSlot(invW[1])],
    experiences: (Array.isArray(r.experiences) ? r.experiences : []).slice(0, 30).flatMap((e) => {
      const x = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>
      return typeof x.name === 'string' ? [{ id: str(x.id, 20) || newId(), name: str(x.name, 120), mod: num(x.mod, 2, -5, 12) }] : []
    }),
    gold: { handfuls: num(goldRaw.handfuls, 1, 0, 9), bags: num(goldRaw.bags, 0, 0, 9), chests: num(goldRaw.chests, 0, 0, 9) },
    inventory: (Array.isArray(r.inventory) ? r.inventory : []).slice(0, 60).map((i) => str(i, 200)).filter((i) => i !== ''),
    loadout: (Array.isArray(r.loadout) ? r.loadout : []).filter((i): i is string => typeof i === 'string').slice(0, 40),
    vault: (Array.isArray(r.vault) ? r.vault : []).filter((i): i is string => typeof i === 'string').slice(0, 80),
    cardsUsed: (Array.isArray(r.cardsUsed) ? r.cardsUsed : []).filter((i): i is string => typeof i === 'string').slice(0, 80),
    counters: normalizeCounters(r.counters),
    cardCounters: normalizeCardCounters(r.cardCounters),
    advancements: (Array.isArray(r.advancements) ? r.advancements : []).slice(0, 9).flatMap((a) => {
      const x = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>
      if (typeof x.level !== 'number' || !Array.isArray(x.picks)) return []
      return [{ level: num(x.level, 2, 2, MAX_LEVEL), picks: x.picks as DhSheetData['advancements'][number]['picks'], experienceId: strOrNull(x.experienceId), card: strOrNull(x.card) }]
    }),
    description: { clothes: str(descRaw.clothes, 200), eyes: str(descRaw.eyes, 200), body: str(descRaw.body, 200), skin: str(descRaw.skin, 200), attitude: str(descRaw.attitude, 200) },
    background: strList(r.background, 3),
    connections: strList(r.connections, 3),
    trackers: {
      unstoppable: num(trkRaw.unstoppable, 0, 0, 6),
      prayer: (Array.isArray(trkRaw.prayer) ? trkRaw.prayer : []).filter((n): n is number => typeof n === 'number').slice(0, 12),
      slayer: num(trkRaw.slayer, 0, 0, 6),
      strange: num(trkRaw.strange, 1, 1, 12),
      rallyGiven: trkRaw.rallyGiven === true,
      choice: str(trkRaw.choice, 120),
      beastform: str(trkRaw.beastform, 60),
      focus: str(trkRaw.focus, 120),
    },
    companion: r.companion && typeof r.companion === 'object' ? normalizeCompanion(r.companion as Record<string, unknown>) : null,
    notes: str(r.notes, 20000),
  }
}

const MANUAL_KEYS = new Set(['evasion', 'armor', 'major', 'severe', 'hp', 'stress', 'hope', 'proficiency', ...DH_TRAITS.map((t) => `trait:${t}`)])

function normalizeManual(v: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!v || typeof v !== 'object') return out
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (MANUAL_KEYS.has(k) && typeof n === 'number' && Number.isFinite(n)) out[k] = Math.max(-20, Math.min(99, Math.round(n)))
  }
  return out
}

function normalizeCompanion(c: Record<string, unknown>): DhCompanion {
  const base = emptyCompanion()
  const die = [6, 8, 10, 12].find((n) => n === c.damageDie)
  return {
    name: str(c.name, 80),
    evasion: num(c.evasion, base.evasion, 0, 30),
    experiences: (Array.isArray(c.experiences) ? c.experiences : []).slice(0, 12).flatMap((e) => {
      const x = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>
      return typeof x.name === 'string' ? [{ id: str(x.id, 20) || newId(), name: str(x.name, 80), mod: num(x.mod, 2, -5, 12) }] : []
    }),
    attack: str(c.attack, 200),
    damageDie: (die ?? 6) as DhCompanion['damageDie'],
    range: (['melee', 'muito_proximo', 'proximo', 'distante', 'muito_distante'] as const).find((r) => r === c.range) ?? 'melee',
    stressSlots: num(c.stressSlots, 3, 1, 12),
    stressMarked: num(c.stressMarked, 0, 0, 12),
    picks: (Array.isArray(c.picks) ? c.picks : []).filter((p): p is string => typeof p === 'string').slice(0, 20),
    notes: str(c.notes, 4000),
  }
}
