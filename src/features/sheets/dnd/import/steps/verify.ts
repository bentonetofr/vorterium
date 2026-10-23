import type { DndDerivedField } from '../../../../../shared/types'
import { ABILITIES, SKILLS } from '../../rules/abilities'
import type { AbilityKey } from '../../rules/types'
import type { Ctx } from '../ctx'
import { parseInt0, parseSpeed } from '../text'

// ────────────────────────────────────────────────────────
// Etapa 10: a conferência. Roda o motor de regras da ficha no rascunho e
// compara cada número com o que está escrito no PDF (CA, iniciativa,
// deslocamento, salvaguardas, perícias, percepção passiva, CD e ataque de
// magia). Toda diferença é uma pergunta: ou vale o cálculo do sistema, ou o
// número do PDF vira valor manual na ficha. É isso que garante que a ficha
// importada não fica com um número diferente do que o jogador conhece.
// ────────────────────────────────────────────────────────

interface Div { field: DndDerivedField; label: string; pdf: number; system: number; kind: 'signed' | 'plain' | 'speed' }

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const meters = (feet: number) => `${Math.round(feet * 0.3 * 10) / 10} m`
function fmt(n: number, kind: Div['kind']): string { return kind === 'signed' ? signed(n) : kind === 'speed' ? meters(n) : String(n) }

const ABILITY_CODE: Record<string, AbilityKey> = {
  for: 'strength', str: 'strength', des: 'dexterity', dex: 'dexterity', con: 'constitution', int: 'intelligence', sab: 'wisdom', wis: 'wisdom', car: 'charisma', cha: 'charisma',
}

function divergences(c: Ctx, withProficiency: boolean): Div[] {
  const d = c.derive().derived
  const r = c.read
  const out: Div[] = []
  const cmp = (field: DndDerivedField, label: string, pdfText: string, system: number, kind: Div['kind']) => {
    const pdf = parseInt0(pdfText)
    if (pdf != null && pdf !== system) out.push({ field, label, pdf, system, kind })
  }
  if (withProficiency) cmp('proficiency_bonus', 'Bônus de proficiência', r.profBonus, d.proficiencyBonus, 'signed')
  cmp('armor_class', 'Classe de Armadura', r.combat.ac, d.armorClass, 'plain')
  cmp('initiative_bonus', 'Iniciativa', r.combat.initiative, d.initiative, 'signed')
  const speed = parseSpeed(r.combat.speed)
  if (speed && speed.feet !== d.speed) out.push({ field: 'speed', label: 'Deslocamento', pdf: speed.feet, system: d.speed, kind: 'speed' })
  for (const a of ABILITIES) cmp(`save_${a.key}`, `Salvaguarda de ${a.label}`, r.saves[a.key].value, d.saves[a.key].bonus, 'signed')
  for (const s of SKILLS) cmp(`skill_${s.key}`, s.label, r.skills[s.key].value, d.skills[s.key].bonus, 'signed')
  cmp('passive_perception', 'Percepção passiva', r.passivePerception, d.passives.perception, 'plain')
  if (d.spellStats) {
    cmp('spell_save_dc', 'CD das magias', r.spellcasting.dc, d.spellStats.saveDc, 'plain')
    cmp('spell_attack_bonus', 'Ataque de magia', r.spellcasting.attack, d.spellStats.attackBonus, 'signed')
  }
  return out
}

/** Um motivo provável da diferença, quando dá para saber. */
function why(c: Ctx, list: Div[]): string[] {
  const out: string[] = []
  const prof = c.derive().derived.proficiencyBonus
  const half = Math.floor(prof / 2)
  const bard = c.draft.classes.find((x) => x.class_key === 'bard' && x.level >= 2)
  const joat = list.filter((x) => x.field.startsWith('skill_') && x.system - x.pdf === half && half > 0)
  if (bard && joat.length >= 2) out.push(`Versatilidade de Bardo: em perícias sem proficiência o Bardo soma metade da proficiência (+${half}); o PDF não somou (${joat.length} perícias).`)
  const ac = list.find((x) => x.field === 'armor_class')
  if (ac && parseInt0(c.read.armor.ac) === ac.system) out.push(`A armadura do PDF (${c.read.armor.type || 'armadura'}) dá CA ${ac.system}; o campo de CA do PDF (${ac.pdf}) parece desatualizado.`)
  const dcDiff = list.find((x) => x.field === 'spell_save_dc')
  if (dcDiff && dcDiff.system - dcDiff.pdf === 1) out.push('A CD e o ataque de magia do PDF estão 1 abaixo do cálculo: o modificador de conjuração pode ter mudado depois que foram escritos.')
  return out
}

function verify(c: Ctx): void {
  // o bônus de proficiência vem antes: se ele vale o do PDF, todos os outros números mudam
  const prof = divergences(c, true).find((x) => x.field === 'proficiency_bonus')
  if (prof) {
    const pick = c.askChoice({
      id: 'diverge:proficiency_bonus', section: 'Conferência', kind: 'choice',
      title: `Bônus de proficiência: o PDF diz ${fmt(prof.pdf, 'signed')} e o nível dá ${fmt(prof.system, 'signed')}`,
      body: 'O bônus de proficiência vem do nível total do personagem. Ele muda todas as perícias e salvaguardas.',
      options: [
        { value: 'system', label: `Usar ${fmt(prof.system, 'signed')} (pelo nível)`, hint: 'Recomendado.' },
        { value: 'pdf', label: `Usar ${fmt(prof.pdf, 'signed')} (valor manual)`, hint: 'Fica com o selo MANUAL.' },
      ],
      recommended: 'system',
    })
    if (pick === 'pdf') c.draft.overrides.push({ field_key: 'proficiency_bonus', manual_value: String(prof.pdf), reason: 'Importado do PDF' })
  }

  // a CA do PDF contra a armadura: com armadura vestida, o desempate é a CA escrita na linha da armadura
  const list = divergences(c, false)
  if (list.length === 0) { c.note('Conferência: todos os números do PDF batem com o cálculo do sistema.'); return }
  const reasons = why(c, list)
  const mode = c.askChoice({
    id: 'diverge', section: 'Conferência', kind: 'choice',
    title: `${list.length === 1 ? 'Um número do PDF é diferente' : `${list.length} números do PDF são diferentes`} do que o sistema calcula`,
    body: [
      ...list.slice(0, 24).map((x) => `• ${x.label}: PDF ${fmt(x.pdf, x.kind)} · sistema ${fmt(x.system, x.kind)}`),
      ...(list.length > 24 ? [`… e mais ${list.length - 24}`] : []),
      ...(reasons.length ? ['', ...reasons] : []),
    ].join('\n'),
    options: [
      { value: 'system', label: 'Usar os cálculos do sistema', hint: 'A ficha segue as regras e atualiza sozinha (ao subir de nível, trocar de armadura...). Recomendado.' },
      { value: 'pdf', label: 'Manter os números do PDF', hint: 'Cada um vira um valor manual na ficha (selo MANUAL) e não recalcula sozinho.' },
      ...(list.length > 1 ? [{ value: 'each', label: 'Decidir um por um' }] : []),
    ],
    recommended: 'system',
  })
  const keep = new Set<DndDerivedField>()
  if (mode === 'pdf') list.forEach((x) => keep.add(x.field))
  if (mode === 'each') {
    for (const x of list) {
      const pick = c.askChoice({
        id: `diverge:${x.field}`, section: 'Conferência', kind: 'choice',
        title: `${x.label}: PDF ${fmt(x.pdf, x.kind)} ou sistema ${fmt(x.system, x.kind)}?`,
        options: [
          { value: 'system', label: `Usar ${fmt(x.system, x.kind)} (cálculo do sistema)` },
          { value: 'pdf', label: `Usar ${fmt(x.pdf, x.kind)} (valor manual)` },
        ],
        recommended: 'system',
      })
      if (pick === 'pdf') keep.add(x.field)
    }
  }
  for (const x of list) if (keep.has(x.field)) c.draft.overrides.push({ field_key: x.field, manual_value: String(x.pdf), reason: 'Importado do PDF' })
  c.note(keep.size ? `Valores manuais mantidos do PDF: ${list.filter((x) => keep.has(x.field)).map((x) => x.label).join(', ')}` : 'Conferência: valem os cálculos do sistema nas diferenças.')
}

/** O atributo de conjuração escrito no PDF ("Car") contra o da classe. */
function spellAbility(c: Ctx): void {
  const text = c.read.spellcasting.ability.trim()
  const ability = ABILITY_CODE[text.toLowerCase().slice(0, 3)]
  const stats = c.derive().derived.spellStats
  if (!ability || !stats || stats.ability === ability) return
  const label = (a: AbilityKey) => ABILITIES.find((x) => x.key === a)!.label
  const pick = c.askChoice({
    id: 'spell-ability', section: 'Magias', kind: 'choice',
    title: 'O atributo de conjuração do PDF não é o da classe',
    body: `No PDF o atributo de conjuração é ${label(ability)}, e a classe usa ${label(stats.ability)}.`,
    options: [{ value: 'class', label: `Usar ${label(stats.ability)} (o da classe)`, hint: 'Recomendado.' }, { value: 'pdf', label: `Usar ${label(ability)} (o do PDF)` }],
    recommended: 'class',
  })
  if (pick === 'pdf') c.draft.form.spell_ability = ability
}

export const VERIFY_STEPS = [spellAbility, verify]
