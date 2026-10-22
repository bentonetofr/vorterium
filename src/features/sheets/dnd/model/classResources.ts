import type { AbilityKey, ClassLevel } from '../rules/types'
import type { DndRecharge } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Recursos de classe e de raça que gastam e recarregam (Fúria, Ki, Inspiração
// de Bardo, Canalizar Divindade, Forma Selvagem, Pontos de Feitiçaria, Surto
// de Ação...), com o máximo vindo das tabelas do SRD 5.1. Como os espaços de
// magia (slots.ts), a ficha guarda o gasto e o máximo é recalculado quando a
// classe, o nível ou o atributo muda. Descansos recarregam pela recarga de cada um.
// ────────────────────────────────────────────────────────

export interface ClassResourceDef {
  key:      string
  label:    string
  source:   'class' | 'race'
  recharge: DndRecharge
  max:      number
}

export interface ClassResourceInput {
  classes:  readonly Pick<ClassLevel, 'classKey' | 'level'>[]
  abilityMods: Record<AbilityKey, number>
  raceKey?: string | null
}

const RAGES = [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6]

/** Chaves que este módulo cria e mantém; qualquer outra linha de recurso fica como está. */
export const AUTO_RESOURCE_KEYS: ReadonlySet<string> = new Set([
  'rage', 'bardic_inspiration', 'channel_divinity', 'channel_divinity_paladin', 'wild_shape', 'second_wind', 'action_surge',
  'indomitable', 'ki', 'lay_on_hands', 'divine_sense', 'stroke_of_luck', 'sorcery_points', 'arcane_recovery',
  'mystic_arcanum_6', 'mystic_arcanum_7', 'mystic_arcanum_8', 'mystic_arcanum_9', 'breath_weapon', 'relentless_endurance',
])

/** O que a ficha deveria ter de recursos de classe e raça. */
export function desiredClassResources(input: ClassResourceInput): ClassResourceDef[] {
  const out: ClassResourceDef[] = []
  const cha = input.abilityMods.charisma
  const add = (key: string, label: string, recharge: DndRecharge, max: number, source: 'class' | 'race' = 'class') => {
    if (max > 0) out.push({ key, label, source, recharge, max })
  }

  for (const c of input.classes) {
    const lv = Math.max(0, Math.min(20, Math.floor(c.level)))
    if (lv < 1) continue
    switch (c.classKey) {
      case 'barbarian':
        if (lv < 20) add('rage', 'Fúria', 'long', RAGES[lv - 1])     // no 20º nível as Fúrias são ilimitadas
        break
      case 'bard':
        add('bardic_inspiration', 'Inspiração de Bardo', lv >= 5 ? 'short' : 'long', Math.max(1, cha))
        break
      case 'cleric':
        add('channel_divinity', 'Canalizar Divindade', 'short', lv >= 18 ? 3 : lv >= 6 ? 2 : lv >= 2 ? 1 : 0)
        break
      case 'druid':
        add('wild_shape', 'Forma Selvagem', 'short', lv >= 2 ? 2 : 0)
        break
      case 'fighter':
        add('second_wind', 'Retomar o Fôlego', 'short', 1)
        add('action_surge', 'Surto de Ação', 'short', lv >= 17 ? 2 : lv >= 2 ? 1 : 0)
        add('indomitable', 'Indomável', 'long', lv >= 17 ? 3 : lv >= 13 ? 2 : lv >= 9 ? 1 : 0)
        break
      case 'monk':
        add('ki', 'Pontos de Ki', 'short', lv >= 2 ? lv : 0)
        break
      case 'paladin':
        add('lay_on_hands', 'Cura pelas Mãos (PV)', 'long', 5 * lv)
        add('divine_sense', 'Sentido Divino', 'long', Math.max(1, 1 + cha))
        add('channel_divinity_paladin', 'Canalizar Divindade (Paladino)', 'short', lv >= 3 ? 1 : 0)
        break
      case 'rogue':
        add('stroke_of_luck', 'Golpe de Sorte', 'short', lv >= 20 ? 1 : 0)
        break
      case 'sorcerer':
        add('sorcery_points', 'Pontos de Feitiçaria', 'long', lv >= 2 ? lv : 0)
        break
      case 'warlock':
        add('mystic_arcanum_6', 'Arcana Mística (6º nível)', 'long', lv >= 11 ? 1 : 0)
        add('mystic_arcanum_7', 'Arcana Mística (7º nível)', 'long', lv >= 13 ? 1 : 0)
        add('mystic_arcanum_8', 'Arcana Mística (8º nível)', 'long', lv >= 15 ? 1 : 0)
        add('mystic_arcanum_9', 'Arcana Mística (9º nível)', 'long', lv >= 17 ? 1 : 0)
        break
      case 'wizard':
        add('arcane_recovery', 'Recuperação Arcana', 'long', 1)
        break
    }
  }

  if (input.raceKey === 'dragonborn') add('breath_weapon', 'Arma de Sopro', 'short', 1, 'race')
  if (input.raceKey === 'half_orc') add('relentless_endurance', 'Resistência Implacável', 'long', 1, 'race')

  return out
}

export interface ExistingClassResource { id: string; key: string; label: string; source: string; recharge: string; current_value: number; max_value: number }

export interface ClassResourceUpsert {
  key:           string
  label:         string
  max_value:     number
  current_value: number
  recharge:      DndRecharge
  source:        'class' | 'race'
  sort_order:    number
}

/**
 * O que gravar e o que apagar para os recursos automáticos ficarem iguais ao
 * esperado. Recurso novo nasce cheio; máximo maior ganha a diferença como
 * disponível; máximo menor corta o atual; o que a ficha não tem mais é apagado.
 * Só mexe nas chaves automáticas: recursos criados à mão não são tocados.
 */
export function planClassResources(
  desired: readonly ClassResourceDef[],
  existing: readonly ExistingClassResource[],
): { upserts: ClassResourceUpsert[]; removals: string[] } {
  const byKey = new Map(existing.map((r) => [r.key, r]))
  const upserts: ClassResourceUpsert[] = []
  desired.forEach((d, i) => {
    const have = byKey.get(d.key)
    const order = 10 + i
    if (!have) {
      upserts.push({ key: d.key, label: d.label, max_value: d.max, current_value: d.max, recharge: d.recharge, source: d.source, sort_order: order })
      return
    }
    if (have.max_value === d.max && have.label === d.label && have.recharge === d.recharge) return
    const gained = Math.max(0, d.max - have.max_value)
    const current = Math.min(d.max, have.current_value + gained)
    upserts.push({ key: d.key, label: d.label, max_value: d.max, current_value: current, recharge: d.recharge, source: d.source, sort_order: order })
  })
  const keep = new Set(desired.map((d) => d.key))
  const removals = existing.filter((r) => AUTO_RESOURCE_KEYS.has(r.key) && !keep.has(r.key)).map((r) => r.id)
  return { upserts, removals }
}
