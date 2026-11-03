import type { VtmSheet } from '../../../../shared/types'
import { buildSheetText, bullet, kv, prose, type Line } from '../../export/sheetText'
import { VTM_ATTRIBUTES, VTM_DISCIPLINES, VTM_GROUPS, VTM_SKILLS, getClan, type VtmDiscipline } from '../constants/vampiro'
import { VTM_POWER_BY_ID } from '../constants/vtmPowers'
import { VTM_RITE_BY_ID } from '../constants/vtmRituals'
import { getPredator } from '../constants/vtmPredators'
import { bloodPotencyRow, healthMax, ordinal, willpowerMax } from './vampiroRules'

const ADVANTAGE_KIND = { background: 'Antecedente', merit: 'Mérito', flaw: 'Defeito' } as const
const CONVICTION_STATUS = { vivo: 'vivo', ferido: 'ferido', perdido: 'perdido' } as const

/** Pontos como "●●●○○" (cheios e vazios, até 5). */
function dots(n: number, max = 5): string {
  const v = Math.max(0, Math.min(max, Math.round(n)))
  return `${'●'.repeat(v)}${'○'.repeat(max - v)}`
}

/** Caixas de dano: dano agravado, superficial e livres. */
function track(max: number, superficial: number, aggravated: number): string {
  const agg = Math.min(max, aggravated)
  const sup = Math.min(max - agg, superficial)
  return `${'X'.repeat(agg)}${'/'.repeat(sup)}${'_'.repeat(Math.max(0, max - agg - sup))}  (agravado ${agg}, superficial ${sup})`
}

export function vampiroSheetText(s: VtmSheet): string {
  const clan = getClan(s.clan)
  const predator = getPredator(s.predator_type)
  const hMax = healthMax(s)
  const wMax = willpowerMax(s)
  const bp = bloodPotencyRow(s.blood_potency)

  const attributes = VTM_GROUPS.flatMap((g) => [
    `${g.label}:`,
    ...VTM_ATTRIBUTES.filter((a) => a.group === g.id).map((a) => `  ${a.label}: ${dots((s as unknown as Record<string, number>)[`attr_${a.key}`] ?? 0)} (${(s as unknown as Record<string, number>)[`attr_${a.key}`] ?? 0})`),
  ])

  const skills = VTM_GROUPS.flatMap((g) => {
    const rows = VTM_SKILLS.filter((k) => k.group === g.id && (s.skills?.[k.key] ?? 0) > 0)
    return rows.length ? [`${g.label}:`, ...rows.map((k) => `  ${k.label}: ${dots(s.skills[k.key])} (${s.skills[k.key]})`)] : []
  })

  const skillLabel = (key: string) => VTM_SKILLS.find((k) => k.key === key)?.label ?? key
  const disciplines = Object.entries(s.disciplines ?? {})
    .filter(([, v]) => v > 0)
    .map(([key, v]) => `${VTM_DISCIPLINES[key as VtmDiscipline] ?? key}: ${dots(v)} (${v})`)
  const powers = (s.powers ?? []).map((id) => {
    const p = VTM_POWER_BY_ID.get(id)
    return bullet(p ? `${VTM_DISCIPLINES[p.disc]} ${p.level}: ${p.name}${p.cost ? ` (custo: ${p.cost})` : ''}` : id)
  })
  const rites = (s.rituals ?? []).map((id) => {
    const r = VTM_RITE_BY_ID.get(id)
    return bullet(r ? `${r.name} (nível ${r.level})` : id)
  })

  const advantages = (s.advantages ?? []).map((a) => bullet(
    `${ADVANTAGE_KIND[a.kind] ?? a.kind}: ${a.name}${a.dots ? ` ${dots(a.dots)}` : ''}${a.note ? `\n${a.note}` : ''}`,
  ))
  const convictions = (s.convictions ?? []).map((c) => bullet(
    `${c.conviction}\nPilar de Toque: ${c.touchstone || '-'} (${CONVICTION_STATUS[c.status] ?? c.status})${c.note ? `\n${c.note}` : ''}`,
  ))
  const xp = (s.xp_log ?? []).map((e) => bullet(`${e.kind === 'ganho' ? '+' : '-'}${e.amount} PX: ${e.label}${e.note ? ` (${e.note})` : ''}`))
  const specialties = (s.specialties ?? []).map((sp) => bullet(`${skillLabel(sp.skill)}: ${sp.name}`))

  const gained = (s.xp_log ?? []).filter((e) => e.kind === 'ganho').reduce((n, e) => n + e.amount, 0)
  const spent = (s.xp_log ?? []).filter((e) => e.kind === 'gasto').reduce((n, e) => n + e.amount, 0)

  return buildSheetText(`${s.character_name || 'Personagem'} - Vampiro: A Máscara`, [
    { title: 'Identidade', lines: [
      kv('Nome', s.character_name), kv('Conceito', s.concept), kv('Crônica', s.chronicle),
      kv('Clã', clan?.label ?? s.clan), kv('Senhor (Sire)', s.sire),
      kv('Tipo de predador', predator?.label ?? s.predator_type),
      kv('Geração', s.generation ? ordinal(s.generation) : null),
      kv('Nível de criação', s.creation_tier === 'ancilla' ? 'Ancila' : 'Neófito'),
      kv('Ambição', s.ambition), kv('Desejo', s.desire),
    ] },
    { title: 'Atributos', lines: attributes },
    { title: 'Perícias', lines: skills },
    { title: 'Especializações', lines: specialties },
    { title: 'Estado', lines: [
      kv('Vitalidade', track(hMax, s.health_superficial, s.health_aggravated)),
      kv('Força de Vontade', track(wMax, s.willpower_superficial, s.willpower_aggravated)),
      kv('Fome', `${s.hunger}/5`),
      kv('Humanidade', `${s.humanity}/10 (manchas: ${s.stains})`),
      kv('Potência de Sangue', `${s.blood_potency} (Surto de Sangue +${bp.surge} dados, cura ${bp.mend} de dano superficial, +${bp.power} nas disciplinas)`),
    ] },
    { title: 'Disciplinas', lines: disciplines },
    { title: 'Poderes', lines: powers },
    { title: 'Rituais, cerimônias e fórmulas', lines: rites },
    { title: 'Antecedentes, méritos e defeitos', lines: advantages },
    { title: 'Convicções e Pilares de Toque', lines: convictions },
    { title: 'Experiência', lines: [
      kv('Ganhos', gained), kv('Gastos', spent), kv('Disponível', gained - spent),
      ...xp,
    ] as Line[] },
    { title: 'História', lines: [prose(s.history)] },
    { title: 'Anotações', lines: [prose(s.notes)] },
  ])
}
