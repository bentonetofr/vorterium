import { DND_SKILLS } from '../../../../shared/types'
import { getBackground, getCondition, getRace, getSubrace } from '../catalog'
import { formatKg, formatMeters } from './format'
import { classLine, itemTitle } from './sheetModel'
import { buildSheetText, bullet, kv, prose, ratio, type Line } from '../../export/sheetText'
import type { SheetCtx } from '../components/sheetContext'
import type { AbilityKey } from '../rules/types'

const ABILITIES: [AbilityKey, string][] = [
  ['strength', 'Força'], ['dexterity', 'Destreza'], ['constitution', 'Constituição'],
  ['intelligence', 'Inteligência'], ['wisdom', 'Sabedoria'], ['charisma', 'Carisma'],
]
const PROFICIENCY_CATEGORY = { armor: 'Armaduras', weapon: 'Armas', tool: 'Ferramentas', language: 'Idiomas' } as const
const PROFICIENCY_LEVEL = { none: '', half: ' (metade)', proficient: ' (proficiente)', expertise: ' (especialista)' } as const
const RECHARGE = { short: 'descanso curto', long: 'descanso longo', dawn: 'amanhecer', manual: 'manual' } as const

const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))

/** Ficha de D&D 5e em texto, com os números já calculados pelo motor de regras. */
export function dndSheetText(ctx: SheetCtx): string {
  const { form, derived, data, sheet } = ctx
  const feet = form.speed_unit === 'ft'
  const race = form.race_key ? getRace(form.race_key) : undefined
  const subrace = form.race_key && form.subrace_key ? getSubrace(form.race_key, form.subrace_key) : undefined
  const background = form.background_key ? getBackground(form.background_key) : undefined
  const hpMax = derived.hpMax ?? form.hp_max

  const attributes = ABILITIES.map(([key, label]) => kv(label, `${form[key]} (${signed(derived.abilityMods[key])})`))
  const saves = ABILITIES.map(([key, label]) => {
    const s = derived.saves[key]
    return kv(label, `${signed(s.bonus)}${s.proficient ? ' (proficiente)' : ''}`)
  })
  const skills = DND_SKILLS.map((sk) => {
    const d = derived.skills[sk.key]
    return d ? kv(sk.label, `${signed(d.bonus)}${PROFICIENCY_LEVEL[d.level] ?? ''}`) : null
  })

  const conditions = (form.conditions ?? []).map((c) => getCondition(c)?.name ?? c)
  if (form.exhaustion > 0) conditions.push(`Exaustão ${form.exhaustion}`)

  const spells = [...data.details.spells].sort((a, b) => a.spell_level - b.spell_level || a.sort_order - b.sort_order)
  const spellLines: Line[] = []
  let currentLevel = -1
  for (const sp of spells) {
    if (sp.spell_level !== currentLevel) {
      currentLevel = sp.spell_level
      spellLines.push('', sp.spell_level === 0 ? 'Truques:' : `${sp.spell_level}º nível:`)
    }
    const tags = [sp.prepared && sp.spell_level > 0 ? 'preparada' : '', sp.concentration ? 'concentração' : '', sp.ritual ? 'ritual' : ''].filter(Boolean)
    spellLines.push(bullet(`${sp.name}${tags.length ? ` (${tags.join(', ')})` : ''}`))
  }

  const slots = derived.spellcasting?.slots ?? []
  const slotText = slots.map((n, i) => (n > 0 ? `${i + 1}º: ${n}` : null)).filter(Boolean).join(', ')
  const pact = derived.spellcasting?.pact

  const resources = data.resources.map((r) => bullet(`${r.label}: ${ratio(r.current_value, r.max_value)}${r.recharge ? ` (recarrega: ${RECHARGE[r.recharge] ?? r.recharge})` : ''}`))
  const features = data.features.map((f) => bullet(
    `${f.name}${f.uses_max ? ` (usos: ${ratio(f.uses_current ?? 0, f.uses_max)}${f.recharge ? `, recarrega: ${RECHARGE[f.recharge] ?? f.recharge}` : ''})` : ''}${f.notes ? `\n${f.notes}` : ''}`,
  ))
  const attacks = data.details.attacks.map((a) => bullet(`${a.name}: ataque ${a.attack_bonus || '-'}, dano ${a.damage || '-'}${a.damage_type ? ` ${a.damage_type}` : ''}${a.notes ? `\n${a.notes}` : ''}`))
  const inventory = data.details.inventory.map((i) => bullet(
    `${itemTitle(i.name, i.catalog_entry_key)}${i.quantity !== 1 ? ` x${i.quantity}` : ''}${i.equipped ? ' (equipado)' : ''}${i.notes ? `\n${i.notes}` : ''}`,
  ))
  const carried = form.carried_kg ?? data.details.inventory.reduce((n, i) => n + (i.weight || 0) * (i.quantity || 0), 0)

  const proficiencyLines = (Object.keys(PROFICIENCY_CATEGORY) as (keyof typeof PROFICIENCY_CATEGORY)[]).flatMap((cat): Line[] => {
    const list = data.proficiencies.filter((p) => p.category === cat).map((p) => p.label)
    return list.length ? [kv(PROFICIENCY_CATEGORY[cat], list.join(', '))] : []
  })

  const coins = [['PC', form.coin_cp], ['PP', form.coin_sp], ['PE', form.coin_ep], ['PO', form.coin_gp], ['PL', form.coin_pp]]
    .filter(([, v]) => (v as number) > 0).map(([k, v]) => `${v} ${k}`).join(', ')

  return buildSheetText(`${form.character_name || 'Personagem'} - D&D 5e`, [
    { title: 'Identidade', lines: [
      kv('Personagem', form.character_name), kv('Jogador', form.player_name),
      kv('Raça', subrace?.name ?? race?.name ?? form.race_custom),
      kv('Classe', classLine(data.classes, sheet.class_name, form.class_names)),
      kv('Nível', derived.totalLevel), kv('Antecedente', background?.name ?? form.background_custom),
      kv('Tendência', form.alignment), kv('Experiência', form.experience), kv('Inspiração', form.inspiration || null),
    ] },
    { title: 'Combate', lines: [
      kv('Classe de Armadura', derived.armorClass), kv('Iniciativa', signed(derived.initiative)),
      kv('Deslocamento', feet ? `${derived.speed} ft` : formatMeters(derived.speed)),
      kv('Bônus de proficiência', signed(derived.proficiencyBonus)),
      kv('PV', `${ratio(Math.min(form.hp_current, hpMax), hpMax)}${form.hp_temp ? ` (+${form.hp_temp} temporários)` : ''}`),
      kv('Salvaguardas de morte', form.death_save_successes || form.death_save_failures ? `${form.death_save_successes} sucessos, ${form.death_save_failures} falhas` : null),
      kv('Condições', conditions.join(', ')), kv('Concentrando em', form.concentrating_on),
      kv('Percepção passiva', derived.passives.perception), kv('Intuição passiva', derived.passives.insight), kv('Investigação passiva', derived.passives.investigation),
    ] },
    { title: 'Atributos', lines: attributes },
    { title: 'Salvaguardas', lines: saves },
    { title: 'Perícias', lines: skills },
    { title: 'Ataques', lines: attacks },
    { title: 'Conjuração', lines: derived.spellStats ? [
      kv('CD das magias', derived.spellStats.saveDc), kv('Bônus de ataque de magia', signed(derived.spellStats.attackBonus)),
      kv('Espaços de magia', slotText), pact ? kv('Magia de Pacto', `${pact.slots} espaços de ${pact.level}º nível`) : null,
      ...spellLines,
    ] : spellLines },
    { title: 'Recursos', lines: resources },
    { title: 'Características e talentos', lines: features },
    { title: 'Proficiências e idiomas', lines: proficiencyLines },
    { title: 'Inventário', lines: [kv('Moedas', coins), kv('Peso carregado', carried ? formatKg(carried) : null), ...inventory] },
    { title: 'Personalidade', lines: [
      form.personality_traits && `Traços de personalidade:\n${form.personality_traits}`,
      form.ideals && `Ideais:\n${form.ideals}`, form.bonds && `Vínculos:\n${form.bonds}`, form.flaws && `Defeitos:\n${form.flaws}`,
    ] },
    { title: 'História', lines: [prose(form.backstory)] },
    { title: 'Anotações', lines: [prose(form.notes), form.notes_racial && `Raça:\n${form.notes_racial}`, form.notes_background && `Antecedente:\n${form.notes_background}`, form.notes_class && `Classe:\n${form.notes_class}`] },
  ])
}
