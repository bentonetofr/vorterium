// ────────────────────────────────────────────────────────
// Espaços de magia como recursos da ficha (dnd_character_resources). O máximo
// vem do motor (classe, nível, multiclasse); o gasto fica gravado. Quando o
// máximo muda (subida de nível), este plano diz o que criar ou atualizar.
// ────────────────────────────────────────────────────────

export const PACT_SLOT_KEY = 'pact_slot'

export function spellSlotKey(level: number): string {
  return `spell_slot_${level}`
}

export function spellSlotLabel(level: number): string {
  return `${level}º nível`
}

export interface ExistingResource { key: string; current_value: number; max_value: number }

export interface SlotUpsert {
  key:           string
  label:         string
  max_value:     number
  current_value: number
  recharge:      'short' | 'long'
  source:        'spell_slots'
  sort_order:    number
}

/**
 * O que gravar para os recursos de espaço de magia ficarem iguais ao motor.
 * Espaço novo ou a mais já nasce disponível; máximo menor corta o atual; nível
 * que a ficha não tem mais fica com máximo 0. Devolve só o que mudou.
 */
export function planSlotResources(
  slots: readonly number[],
  pact: { slots: number; level: number } | null,
  existing: readonly ExistingResource[],
): SlotUpsert[] {
  const byKey = new Map(existing.map((r) => [r.key, r]))
  const out: SlotUpsert[] = []

  const plan = (key: string, label: string, max: number, recharge: 'short' | 'long', order: number) => {
    const have = byKey.get(key)
    if (!have && max === 0) return
    if (have && have.max_value === max) return
    const gained = have ? Math.max(0, max - have.max_value) : max
    const current = Math.min(max, (have?.current_value ?? 0) + gained)
    out.push({ key, label, max_value: max, current_value: current, recharge, source: 'spell_slots', sort_order: order })
  }

  slots.forEach((max, i) => plan(spellSlotKey(i + 1), spellSlotLabel(i + 1), max, 'long', i + 1))
  plan(PACT_SLOT_KEY, pact ? `Pacto (${pact.level}º nível)` : 'Pacto', pact?.slots ?? 0, 'short', 20)

  // Pacto de outro nível (o Bruxo subiu): o rótulo muda, mesmo com a mesma quantidade de espaços.
  const pactRow = byKey.get(PACT_SLOT_KEY)
  if (pact && pactRow && pactRow.max_value === pact.slots && !out.some((o) => o.key === PACT_SLOT_KEY)) {
    out.push({ key: PACT_SLOT_KEY, label: `Pacto (${pact.level}º nível)`, max_value: pact.slots, current_value: pactRow.current_value, recharge: 'short', source: 'spell_slots', sort_order: 20 })
  }
  return out
}
