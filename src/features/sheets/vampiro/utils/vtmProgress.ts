import type { VtmAdvantage, VtmPredatorGrants, VtmSheet, VtmSpecialty, VtmXpEntry } from '../../../../shared/types'
import { VTM_DISCIPLINES, getClan, type VtmDiscipline } from '../constants/vampiro'
import { VTM_POWERS, VTM_POWER_BY_ID, type VtmPower } from '../constants/vtmPowers'
import { VTM_RITES, VTM_RITE_BY_ID, VTM_RITE_RULES, type VtmRite, type VtmRiteKind } from '../constants/vtmRituals'
import { VTM_ADV_BY_KEY, VTM_CREATION_BUDGET } from '../constants/vtmAdvantages'
import { getPredator, type VtmPredatorDef } from '../constants/vtmPredators'
import { newId } from './vampiroRules'

// ────────────────────────────────────────────────────────
// Marco 2 da ficha de Vampiro: disciplinas e poderes (o que está liberado
// pelos pontos, amálgamas e poderes exigidos), rituais, vantagens com o
// limite da criação, experiência (custos do V5 e o histórico) e o tipo de
// predador aplicado na ficha (e desfeito ao trocar).
// ────────────────────────────────────────────────────────

type Disc = Pick<VtmSheet, 'disciplines'>
type Clanned = Pick<VtmSheet, 'clan' | 'generation'>

export function discDots(s: Disc, d: string): number {
  const v = s.disciplines?.[d]
  return typeof v === 'number' ? Math.max(0, Math.min(5, v)) : 0
}

export function isClanDiscipline(s: Clanned, d: VtmDiscipline): boolean {
  if (d === 'alquimia') return s.generation >= 14
  return getClan(s.clan)?.disciplines.includes(d) ?? false
}

/** Disciplinas na ordem da ficha: as do clã primeiro, depois as que tem pontos. */
export function sheetDisciplines(s: Disc & Clanned): VtmDiscipline[] {
  const clanDiscs = getClan(s.clan)?.disciplines ?? []
  const owned = (Object.keys(VTM_DISCIPLINES) as VtmDiscipline[]).filter((d) => discDots(s, d) > 0 && !clanDiscs.includes(d))
  return [...clanDiscs, ...owned]
}

// ── Poderes ─────────────────────────────────────────────

export interface PowerCheck { ok: boolean; reason: string | null }

/** O poder pode ser escolhido? (nível, amálgama, poder exigido) */
export function checkPower(s: Disc & Pick<VtmSheet, 'powers'>, p: VtmPower): PowerCheck {
  if (discDots(s, p.disc) < p.level) return { ok: false, reason: `Precisa de ${VTM_DISCIPLINES[p.disc]} ${p.level}` }
  if (p.amalgam && discDots(s, p.amalgam[0]) < p.amalgam[1]) {
    return { ok: false, reason: `Amálgama: precisa de ${VTM_DISCIPLINES[p.amalgam[0]]} ${p.amalgam[1]}` }
  }
  if (p.requires && !p.requires.some((r) => s.powers.includes(r))) {
    const names = p.requires.map((r) => VTM_POWER_BY_ID.get(r)?.name ?? r).join(' ou ')
    return { ok: false, reason: `Precisa do poder ${names}` }
  }
  return { ok: true, reason: null }
}

export function powersOf(s: Pick<VtmSheet, 'powers'>, d: VtmDiscipline): VtmPower[] {
  return s.powers.map((id) => VTM_POWER_BY_ID.get(id)).filter((p): p is VtmPower => !!p && p.disc === d)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

export function catalogPowers(d: VtmDiscipline): VtmPower[] {
  return VTM_POWERS.filter((p) => p.disc === d)
}

/** Poderes escolhidos que deixaram de valer (baixou a disciplina, perdeu o amálgama). */
export function brokenPowers(s: Disc & Pick<VtmSheet, 'powers'>): VtmPower[] {
  return s.powers.map((id) => VTM_POWER_BY_ID.get(id)).filter((p): p is VtmPower => !!p && !checkPower(s, p).ok)
}

// ── Rituais, cerimônias e fórmulas ─────────────────────

export function ritesOf(s: Pick<VtmSheet, 'rituals'>, kind: VtmRiteKind): VtmRite[] {
  return s.rituals.map((id) => VTM_RITE_BY_ID.get(id)).filter((r): r is VtmRite => !!r && r.kind === kind)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

export function catalogRites(kind: VtmRiteKind): VtmRite[] {
  return VTM_RITES.filter((r) => r.kind === kind)
}

export function checkRite(s: Disc & Pick<VtmSheet, 'powers'>, r: VtmRite): PowerCheck {
  const disc = VTM_RITE_RULES[r.kind].disc
  if (discDots(s, disc) < r.level) return { ok: false, reason: `Precisa de ${VTM_DISCIPLINES[disc]} ${r.level}` }
  if (r.requires && !r.requires.some((p) => s.powers.includes(p))) {
    const names = r.requires.map((p) => VTM_POWER_BY_ID.get(p)?.name ?? p).join(' ou ')
    return { ok: false, reason: `Precisa do poder ${names}` }
  }
  return { ok: true, reason: null }
}

// ── Experiência (custos do Livro Básico) ────────────────

export const VTM_XP_COSTS = {
  attribute:  (to: number) => to * 5,
  skill:      (to: number) => to * 3,
  specialty:  () => 3,
  clanDisc:   (to: number) => to * 5,
  caitiffDisc: (to: number) => to * 6,
  otherDisc:  (to: number) => to * 7,
  rite:       (level: number) => level * 3,
  advantage:  (dots: number) => dots * 3,
  bloodPotency: (to: number) => to * 10,
}

export function disciplineCost(s: Clanned, d: VtmDiscipline, to: number): { cost: number; why: string } {
  if (isClanDiscipline(s, d)) return { cost: VTM_XP_COSTS.clanDisc(to), why: 'do clã: novo nível × 5' }
  if (s.clan === 'caitiff') return { cost: VTM_XP_COSTS.caitiffDisc(to), why: 'Caitiff: novo nível × 6' }
  return { cost: VTM_XP_COSTS.otherDisc(to), why: 'fora do clã: novo nível × 7' }
}

export function xpTotals(log: VtmXpEntry[]): { earned: number; spent: number; available: number } {
  let earned = 0
  let spent = 0
  for (const e of log) {
    if (e.kind === 'ganho') earned += e.amount
    else spent += e.amount
  }
  return { earned, spent, available: earned - spent }
}

export function xpEntry(kind: VtmXpEntry['kind'], amount: number, label: string, extra?: Partial<VtmXpEntry>): VtmXpEntry {
  return { id: newId(), at: new Date().toISOString(), kind, amount, label, ...extra }
}

// ── Vantagens e limite da criação ───────────────────────

export function advantageTotals(s: Pick<VtmSheet, 'advantages' | 'creation_tier'>) {
  const creation = s.advantages.filter((a) => a.source === 'criacao')
  // Méritos e Defeitos de sangue-ralo são à parte (um por um, casados).
  const isThin = (a: VtmAdvantage) => VTM_ADV_BY_KEY.get(a.key)?.only === 'sangue_ralo'
  const merits = creation.filter((a) => a.kind !== 'flaw' && !isThin(a)).reduce((n, a) => n + a.dots, 0)
  const flaws = creation.filter((a) => a.kind === 'flaw' && !isThin(a)).reduce((n, a) => n + a.dots, 0)
  const thinMerits = creation.filter((a) => a.kind !== 'flaw' && isThin(a)).length
  const thinFlaws = creation.filter((a) => a.kind === 'flaw' && isThin(a)).length
  const budget = VTM_CREATION_BUDGET[s.creation_tier] ?? VTM_CREATION_BUDGET.neonato
  return { merits, flaws, thinMerits, thinFlaws, budget }
}

// ── Criação: disciplinas ────────────────────────────────

/** Pontos de disciplina que vieram da criação (sem o do predador e sem os comprados com XP). */
export function creationDisciplineCheck(s: Disc & Clanned & Pick<VtmSheet, 'predator_grants' | 'xp_log'>): string | null {
  const thin = s.generation >= 14
  if (thin) return null
  const bought: Record<string, number> = {}
  for (const e of s.xp_log) if (e.kind === 'gasto' && e.target?.type === 'disciplina') bought[e.target.key] = (bought[e.target.key] ?? 0) + (e.target.to - e.target.from)
  const pred = s.predator_grants?.discipline ?? null
  const base = (d: string) => Math.max(0, discDots(s, d) - (bought[d] ?? 0) - (pred === d ? 1 : 0))
  const all = Object.keys(VTM_DISCIPLINES)
  const values = all.map(base).filter((n) => n > 0).sort((a, b) => b - a)
  const clanDiscs = getClan(s.clan)?.disciplines ?? []
  const outOfClan = s.clan === 'caitiff' ? [] : all.filter((d) => base(d) > 0 && !clanDiscs.includes(d as VtmDiscipline))
  if (values.join(',') === '2,1' && outOfClan.length === 0) return null
  if (outOfClan.length) return 'Na criação, os 3 pontos vão nas disciplinas do clã (2 numa, 1 noutra).'
  return 'Na criação: 2 pontos numa disciplina do clã e 1 noutra (mais o ponto do predador).'
}

// ── Tipo de predador ────────────────────────────────────

export interface PredatorChoices {
  discipline: VtmDiscipline | null
  specialty:  number
  picks:      Record<number, number>
  splits:     Record<number, Record<string, number>>
}

export function defaultChoices(p: VtmPredatorDef, s: Clanned): PredatorChoices {
  const allowed = p.disciplines.filter((d) => predatorDisciplineOk(p, d, s))
  const splits: PredatorChoices['splits'] = {}
  p.grants.forEach((g, i) => {
    if (g.t === 'split') splits[i] = Object.fromEntries(g.keys.map((k, j) => [k, j === 0 ? g.total : 0]))
  })
  return { discipline: allowed[0] ?? null, specialty: 0, picks: {}, splits }
}

export function predatorDisciplineOk(p: VtmPredatorDef, d: VtmDiscipline, s: Clanned): boolean {
  const clans = p.disciplineClans?.[d]
  return !clans || (!!s.clan && clans.includes(s.clan))
}

/** Avisos de restrição do predador para este personagem. */
export function predatorWarnings(p: VtmPredatorDef, s: Clanned & Pick<VtmSheet, 'blood_potency'>): string[] {
  const out: string[] = []
  if (p.forbiddenClans && s.clan && p.forbiddenClans.includes(s.clan)) out.push(`${getClan(s.clan)?.label} não pode ser ${p.label}.`)
  if (p.maxBloodPotency != null && s.blood_potency > p.maxBloodPotency) out.push(`${p.label} não serve com Potência de Sangue acima de ${p.maxBloodPotency}.`)
  return out
}

type PredForm = Pick<VtmSheet, 'disciplines' | 'specialties' | 'advantages' | 'humanity' | 'blood_potency' | 'predator_grants'>

/** Desfaz o que o predador anterior pôs na ficha. */
export function revertPredator<T extends PredForm>(f: T): T {
  const g = f.predator_grants
  if (!g) return f
  const disciplines = { ...f.disciplines }
  if (g.discipline && (disciplines[g.discipline] ?? 0) > 0) disciplines[g.discipline] = (disciplines[g.discipline] ?? 0) - 1
  return {
    ...f,
    disciplines,
    specialties: f.specialties.filter((sp) => sp.id !== g.specialtyId),
    advantages: f.advantages.filter((a) => !g.advantageIds.includes(a.id)),
    humanity: Math.max(0, Math.min(10, f.humanity - g.humanity)),
    blood_potency: Math.max(0, Math.min(10, f.blood_potency - g.bloodPotency)),
    predator_grants: null,
  }
}

/** Aplica o predador (desfazendo o anterior antes). */
export function applyPredator<T extends PredForm>(f: T, p: VtmPredatorDef, c: PredatorChoices): T {
  const base = revertPredator(f)
  const disciplines = { ...base.disciplines }
  if (c.discipline) disciplines[c.discipline] = Math.min(5, (disciplines[c.discipline] ?? 0) + 1)

  const [skill, specName] = p.specialties[c.specialty] ?? p.specialties[0]
  const specialty: VtmSpecialty = { id: newId(), skill, name: specName }

  const added: VtmAdvantage[] = []
  const push = (key: string, dots: number, note?: string) => {
    if (dots <= 0) return
    const def = VTM_ADV_BY_KEY.get(key)
    added.push({
      id: newId(), key, kind: def?.kind ?? 'merit', name: def?.name ?? key, dots, note: note ?? '', source: 'predador',
    })
  }
  p.grants.forEach((g, i) => {
    if (g.t === 'adv') push(g.key, g.dots, g.note)
    else if (g.t === 'pick') { const o = g.options[c.picks[i] ?? 0] ?? g.options[0]; push(o.key, o.dots, o.note) }
    else for (const k of g.keys) push(k, c.splits[i]?.[k] ?? 0, g.note)
  })

  const grants: VtmPredatorGrants = {
    predator: p.id, discipline: c.discipline, specialtyId: specialty.id,
    advantageIds: added.map((a) => a.id), humanity: p.humanity, bloodPotency: p.bloodPotency,
  }
  return {
    ...base,
    disciplines,
    specialties: [...base.specialties, specialty],
    advantages: [...base.advantages, ...added],
    humanity: Math.max(0, Math.min(10, base.humanity + p.humanity)),
    blood_potency: Math.max(0, Math.min(10, base.blood_potency + p.bloodPotency)),
    predator_grants: grants,
  }
}

export function appliedPredator(s: Pick<VtmSheet, 'predator_grants'>): VtmPredatorDef | null {
  return getPredator(s.predator_grants?.predator)
}
