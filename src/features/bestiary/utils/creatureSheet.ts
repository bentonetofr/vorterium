import type { CreatureAbility, CreatureAbilityKind, CreatureSheet, CreatureStrike } from '../../../shared/types'

// ────────────────────────────────────────────────────────
// Ficha detalhada de uma criatura (classificação, descrição, Ataque, Defesa, DB, Movimento, golpes e habilidades), guardada no
// jsonb `sheet`. Nada aqui entra nas contas do bestiário (vida e dano continuam vindo da regra do grupo): é texto de mesa.
// ────────────────────────────────────────────────────────

export const SHEET_LIMITS = {
  tier: 60, lore: 1200, stat: 120, strikeName: 40, strikeDice: 24, strikeType: 8, strikes: 12,
  abilityName: 60, abilityUses: 40, abilityText: 1000, abilities: 20,
} as const

export const ABILITY_KINDS: { id: CreatureAbilityKind; label: string; hint: string }[] = [
  { id: 'passiva', label: 'Passiva', hint: 'Sempre ativa, não gasta ação' },
  { id: 'padrao', label: 'Ação Padrão', hint: 'Gasta a ação padrão do turno' },
  { id: 'bonus', label: 'Ação Bônus', hint: 'Gasta a ação bônus do turno' },
  { id: 'reacao', label: 'Reação', hint: 'Acontece no turno de outro, em resposta a algo' },
  { id: 'livre', label: 'Ação Livre', hint: 'Não gasta ação' },
  { id: 'especial', label: 'Especial', hint: 'Regra própria da criatura (como o Muitos Mortos)' },
]

export const abilityKindLabel = (kind: CreatureAbilityKind) => ABILITY_KINDS.find((k) => k.id === kind)?.label ?? 'Especial'

/** Sugestões de tipo de dano (o campo aceita qualquer coisa curta). */
export const STRIKE_TYPES = ['C', 'P', 'Co', 'Ct', 'Fogo', 'Frio']

export const emptyStrike = (): CreatureStrike => ({ name: '', dice: '', type: '' })
export const emptyAbility = (kind: CreatureAbilityKind = 'passiva'): CreatureAbility => ({ kind, name: '', uses: '', text: '' })

const clip = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const KINDS = new Set<string>(ABILITY_KINDS.map((k) => k.id))

/**
 * Limpa uma ficha antes de guardar: apara textos, limita tamanhos, tira linhas vazias e devolve null se não sobrou nada
 * (assim a criatura sem ficha continua sem `sheet` no banco). Aceita lixo (vindo do banco ou de cópia) sem quebrar.
 */
export function cleanSheet(input: CreatureSheet | null | undefined): CreatureSheet | null {
  if (!input || typeof input !== 'object') return null
  const out: CreatureSheet = {}
  const put = (key: 'tier' | 'lore' | 'attack' | 'defense' | 'db' | 'movement', max: number) => {
    const v = clip(input[key], max)
    if (v) out[key] = v
  }
  put('tier', SHEET_LIMITS.tier)
  put('lore', SHEET_LIMITS.lore)
  put('attack', SHEET_LIMITS.stat)
  put('defense', SHEET_LIMITS.stat)
  put('db', SHEET_LIMITS.stat)
  put('movement', SHEET_LIMITS.stat)

  const strikes = (Array.isArray(input.strikes) ? input.strikes : [])
    .map((s): CreatureStrike => ({ name: clip(s?.name, SHEET_LIMITS.strikeName), dice: clip(s?.dice, SHEET_LIMITS.strikeDice), type: clip(s?.type, SHEET_LIMITS.strikeType) }))
    .filter((s) => s.name || s.dice)
    .slice(0, SHEET_LIMITS.strikes)
  if (strikes.length) out.strikes = strikes

  const abilities = (Array.isArray(input.abilities) ? input.abilities : [])
    .map((a): CreatureAbility => ({
      kind: KINDS.has(a?.kind) ? a.kind : 'especial',
      name: clip(a?.name, SHEET_LIMITS.abilityName), uses: clip(a?.uses, SHEET_LIMITS.abilityUses), text: clip(a?.text, SHEET_LIMITS.abilityText),
    }))
    .filter((a) => a.name || a.text)
    .slice(0, SHEET_LIMITS.abilities)
  if (abilities.length) out.abilities = abilities

  return Object.keys(out).length ? out : null
}

/** A criatura tem alguma coisa na ficha detalhada? */
export const hasSheet = (sheet: CreatureSheet | null | undefined): boolean => cleanSheet(sheet) != null
