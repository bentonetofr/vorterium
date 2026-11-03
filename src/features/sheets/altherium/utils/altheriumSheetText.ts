import type {
  AltheriumDomainPoints,
  AltheriumGenesisAbility,
  AltheriumInventoryItem,
  AltheriumRune,
  AltheriumSkaldInspiration,
  RunaskinTriumphOverride,
} from '../../../../shared/types'
import { buildSheetText, bullet, kv, prose, ratio, type Line } from '../../export/sheetText'
import { ATTRIBUTES, DOMAINS, GENESIS, raizLabel } from '../constants/altherium'
import { DAMAGE_TYPE_LABELS, findArmor, findItem, findWeapon, WEAPON_RANGE_LABELS } from '../constants/altheriumItems'
import { RUNASKIN_TRAILS, TRIUMPH_ACTION_LABELS, findBerserkerTriumph, type TriumphAction } from '../constants/altheriumTriumphs'
import { QUALITIES, RESOURCES, formatAmount, type ResourceStock } from './altheriumCraft'
import type { Survival } from './altheriumSurvival'

/** O que a ficha (ou o formulário, com o que ainda não salvou) já tem na tela. */
export interface AltheriumTextSheet {
  character_name: string
  level: number
  raiz: string
  genesis: string
  attr_furia: number; attr_destino: number; attr_espirito: number
  attr_impulso: number; attr_estrategia: number; attr_runico: number
  vitality_current: number; vitality_max: number
  equilibrio_current: number; equilibrio_max: number
  fv_current: number; fv_max: number
  pr_current: number; pr_max: number
  cards_current: number
  hacksilvers: number
  db_pernas: number; db_bracos: number; db_tronco: number; db_cabeca: number
  dano_pernas: number; dano_bracos: number; dano_tronco: number; dano_cabeca: number
  berserker_triumphs: string[]
  runaskin_trail: string
  runaskin_trail_overrides: Record<string, RunaskinTriumphOverride>
  genesis_abilities: AltheriumGenesisAbility[]
  skald_inspirations: AltheriumSkaldInspiration[]
  notes: string
  resources: ResourceStock
  survival: Survival
}

const ZONES: [string, 'pernas' | 'bracos' | 'tronco' | 'cabeca'][] = [
  ['Cabeça', 'cabeca'], ['Tronco', 'tronco'], ['Braços', 'bracos'], ['Pernas', 'pernas'],
]
const ZONE_LABEL: Record<string, string> = { db_cabeca: 'cabeça', db_bracos: 'braços', db_tronco: 'tronco', db_pernas: 'pernas' }

function actionLabel(a: string | null | undefined): string | null {
  return a ? (TRIUMPH_ACTION_LABELS[a as TriumphAction] ?? a) : null
}

function domainText(d: AltheriumDomainPoints): string {
  const label = DOMAINS.find((x) => x.id === d.domain)?.label ?? d.domain
  if (d.points < 0) return `${label}: desvantagem`
  return `${label}: ${d.points} ponto${d.points === 1 ? '' : 's'}${d.bonus_die ? ' + 1d10 extra' : ''}`
}

function itemName(i: AltheriumInventoryItem): string {
  if (i.custom_name) return i.custom_name
  return findWeapon(i.item_id)?.name ?? findArmor(i.item_id)?.name ?? findItem(i.item_id)?.name ?? i.item_id
}

function itemDetail(i: AltheriumInventoryItem): string {
  const parts: string[] = []
  const w = findWeapon(i.item_id)
  if (i.item_type === 'arma') {
    const dice = i.custom_damage_dice ?? w?.damageDice
    const type = i.custom_damage_type ?? w?.damageType
    const range = i.custom_range ?? w?.range
    if (dice) parts.push(`dano ${dice}${type ? ` ${DAMAGE_TYPE_LABELS[type]}` : ''}`)
    if (range) parts.push(`alcance ${WEAPON_RANGE_LABELS[range]}`)
  }
  if (i.item_type === 'armadura' || i.item_type === 'escudo') {
    const db = i.custom_db ?? findArmor(i.item_id)?.db
    if (db !== undefined && db !== null) parts.push(`DB ${db}`)
  }
  if (i.custom_detail) parts.push(i.custom_detail)
  if (typeof i.integrity === 'number' && i.integrity < 100) parts.push(`integridade ${i.integrity}%`)
  if (i.equipped) parts.push(i.equipped_zone ? `equipado (${ZONE_LABEL[i.equipped_zone] ?? i.equipped_zone})` : 'equipado')
  return parts.join('; ')
}

export function altheriumSheetText(
  s: AltheriumTextSheet,
  domains: AltheriumDomainPoints[],
  inventory: AltheriumInventoryItem[],
  runes: AltheriumRune[],
): string {
  const raiz = raizLabel(s.raiz)
  const genesis = GENESIS.find((g) => g.id === s.genesis)
  const trail = RUNASKIN_TRAILS.find((t) => t.id === s.runaskin_trail)

  const attributes = ATTRIBUTES
    .filter((a) => a.id !== 'runico' || s.raiz === 'runaskin' || s.attr_runico > 0)
    .map((a) => kv(a.label, (s as unknown as Record<string, number>)[`attr_${a.id}`]))

  const body = ZONES.map(([label, z]) => kv(label, `DB ${s[`db_${z}`]}, dano sofrido ${s[`dano_${z}`]}`))

  const pointed = domains.filter((d) => d.points !== 0 || d.bonus_die)
  const berserker = (s.berserker_triumphs ?? []).map((id) => {
    const t = findBerserkerTriumph(id)
    return bullet(t ? `${t.name} (${actionLabel(t.action)}, custo ${t.cost} FV, alcance ${t.range}${t.test ? `, teste: ${t.test}` : ''})\n${t.description}` : id)
  })
  const trailTriumphs = Object.values(s.runaskin_trail_overrides ?? {}).map((o) => bullet(
    `${o.name}${o.cost ? ` (custo ${o.cost} PR)` : ''}${actionLabel(o.action) ? ` - ${actionLabel(o.action)}` : ''}${o.range ? `, alcance ${o.range}` : ''}${o.test ? `, teste: ${o.test}` : ''}\n${o.description}`,
  ))
  const runeLines = runes.map((r) => bullet(
    `${r.name} (custo ${r.pr_cost} PR${actionLabel(r.action) ? `, ${actionLabel(r.action)}` : ''}${r.range ? `, alcance ${r.range}` : ''}${r.test ? `, teste: ${r.test}` : ''})\n${r.description}`,
  ))
  const abilities = (s.genesis_abilities ?? []).map((a) => bullet(`${a.name}${a.description ? `\n${a.description}` : ''}`))
  const inspirations = (s.skald_inspirations ?? []).map((i) => bullet(
    `${i.name}${i.cost ? ` (custo: ${i.cost})` : ''}${actionLabel(i.action) ? `, ${actionLabel(i.action)}` : ''}${i.range ? `, alcance ${i.range}` : ''}${i.test ? `, teste: ${i.test}` : ''}${i.description ? `\n${i.description}` : ''}`,
  ))

  const resources: Line[] = RESOURCES.flatMap((r): Line[] => {
    const row = s.resources?.[r.id]
    if (!row) return []
    const parts = QUALITIES.filter((q) => (row[q.id] ?? 0) > 0).map((q) => (r.noQuality ? formatAmount(row[q.id]!) : `${q.label}: ${formatAmount(row[q.id]!)}`))
    return parts.length ? [kv(r.label, parts.join('; '))] : []
  })

  return buildSheetText(`${s.character_name || 'Personagem'} - Altherium`, [
    { title: 'Identidade', lines: [
      kv('Nome', s.character_name), kv('Nível', s.level), kv('Raiz', raiz),
      trail ? kv('Trilha', trail.label) : null,
      genesis ? kv('Gênesis', `${genesis.label} (${genesis.effect})`) : null,
    ] },
    { title: 'Atributos', lines: attributes },
    { title: 'Pontos básicos', lines: [
      kv('Vitalidade (PV)', ratio(s.vitality_current, s.vitality_max)),
      kv('Equilíbrio', ratio(s.equilibrio_current, s.equilibrio_max)),
      s.raiz === 'berserker' ? kv('Fúria Vital (FV)', ratio(s.fv_current, s.fv_max)) : null,
      s.raiz === 'runaskin' ? kv('Poder Rúnico (PR)', ratio(s.pr_current, s.pr_max)) : null,
      s.raiz === 'pilar' ? kv('Cartas', s.cards_current) : null,
      kv('Hacksilvers', s.hacksilvers),
    ] },
    { title: 'Corpo (defesa e dano sofrido)', lines: body },
    { title: 'Domínios', lines: pointed.map((d) => domainText(d)) },
    { title: 'Triunfos do Berserker', lines: berserker },
    { title: 'Triunfos iniciais da trilha', lines: trailTriumphs },
    { title: 'Runas descobertas', lines: runeLines },
    { title: 'Habilidades de gênesis', lines: abilities },
    { title: 'Inspirações Skald', lines: inspirations },
    { title: 'Inventário', lines: inventory.map((i) => {
      const detail = itemDetail(i)
      return bullet(`${itemName(i)}${i.quantity > 1 ? ` x${i.quantity}` : ''}${detail ? ` (${detail})` : ''}`)
    }) },
    { title: 'Recursos de Ofício', lines: resources },
    { title: 'Sobrevivência', lines: [
      kv('Fichas de Exploração', s.survival ? `${s.survival.tokens}/5` : null),
      kv('Fome (níveis)', s.survival?.hunger),
      kv('Descansos curtos desde o último longo', s.survival?.short_rests),
      s.survival?.traumas?.length ? `Traumas: ${s.survival.traumas.join('; ')}` : null,
    ] },
    { title: 'Anotações', lines: [prose(s.notes)] },
  ])
}
