// ────────────────────────────────────────────────────────
// Companheiro animal de Altherium (livro 2.0): um lobo criado desde filhote, um corvo treinado, um urso domado.
// Não tem turno próprio: age quando o dono gasta a Ação Bônus pra Comandar. Fica Protegido junto do dono e só
// vira alvo (Exposto) quando é comandado. Cai ao chegar no limite de feridas. Vive na coluna `companion`
// (jsonb, migration 20240226) e TUDO nele é editável: o livro traz a ficha do lobo, e outros bichos são
// montados à mão.
// ────────────────────────────────────────────────────────

export type CompanionState = 'protegido' | 'exposto' | 'caido' | 'morto'

export const STATE_LABEL: Record<CompanionState, string> = {
  protegido: 'Protegido', exposto: 'Exposto', caido: 'Caído', morto: 'Morto',
}

export interface CompanionAbility {
  id: string
  name: string
  description: string
  /** Quando serve: "Passiva", "Usar", "Usar · 1x por cena"... (texto livre). */
  usage: string
  /** O companheiro já tem a habilidade (as outras ficam guardadas na lista). */
  learned: boolean
  /** Já usou nesta cena (habilidades de uma vez por cena). */
  used: boolean
}

export interface Companion {
  /** O personagem tem companheiro? Sem isso a aba só mostra o convite. */
  has: boolean
  name: string
  species: string
  photo_url: string | null
  wounds: number
  /** null = 2 feridas (o lobo do livro). */
  wounds_max: number | null
  defense: number
  /** Dados do ataque (o maior vale). */
  attack_dice: number
  attack_bonus: number
  damage: string
  damage_type: string
  damage_name: string
  state: CompanionState
  /** Caído e já estabilizado (não morre mais por falta de socorro). */
  stable: boolean
  /** Comeu 1 Ração neste Descanso Longo (sem comer, não recupera feridas). */
  fed: boolean
  /** Perdeu o companheiro: −1 dado em Vontade até o próximo Descanso Longo. */
  grief: boolean
  abilities: CompanionAbility[]
  notes: string
}

/** Feridas até cair: o campo editado, ou 2 (a ficha do lobo do livro). */
export function woundsMax(c: Companion): number {
  return c.wounds_max ?? 2
}

export function attackText(c: Companion): string {
  const b = c.attack_bonus
  return `${c.attack_dice}d10${b ? (b > 0 ? `+${b}` : String(b)) : ''}`
}

export function damageText(c: Companion): string {
  return `${c.damage}${c.damage_type ? ` (${c.damage_type})` : ''}`
}

export function learnedCount(c: Companion): number {
  return c.abilities.filter((a) => a.learned).length
}

let seq = 0
export const newAbilityId = () => `hab-${Date.now().toString(36)}-${(seq++).toString(36)}`

/** As cinco habilidades do lobo do livro; as duas primeiras já vêm escolhidas. */
export function wolfAbilities(): CompanionAbility[] {
  const mk = (id: string, name: string, usage: string, description: string, learned: boolean): CompanionAbility => ({ id, name, usage, description, learned, used: false })
  return [
    mk('derrubar', 'Derrubar', 'Usar', 'Ao acertar, o alvo testa Leveza + Impulso. Se falhar, fica Derrubado.', true),
    mk('farejar', 'Farejar', 'Ativa', 'Fora de combate, o dono recebe +1 dado em Percepção e Sobrevivência para rastrear.', true),
    mk('matilha', 'Matilha', 'Passiva', 'O lobo conta como aliado para a regra de Cercar enquanto estiver Exposto.', false),
    mk('uivo', 'Uivo', 'Usar · 1x por cena', 'Com o comando, todos os inimigos em alcance Médio testam Vontade + Espírito. Quem falhar fica Amedrontado.', false),
    mk('guardiao', 'Guardião', 'Passiva', 'Se o dono cair a 0 PV, o lobo fica Exposto sobre o corpo, sem precisar de comando. Inimigos que atacarem o dono Caído sofrem −1 dado no ataque.', false),
  ]
}

/** Um companheiro novo: a ficha do lobo do livro (o jogador troca o que quiser). */
export function newWolf(): Companion {
  return {
    has: true, name: '', species: 'Lobo', photo_url: null,
    wounds: 0, wounds_max: null, defense: 12, attack_dice: 2, attack_bonus: 2,
    damage: '1d8', damage_type: 'P', damage_name: 'mordida',
    state: 'protegido', stable: false, fed: false, grief: false,
    abilities: wolfAbilities(), notes: '',
  }
}

export const NO_COMPANION: Companion = {
  has: false, name: '', species: '', photo_url: null,
  wounds: 0, wounds_max: null, defense: 12, attack_dice: 2, attack_bonus: 2,
  damage: '1d8', damage_type: 'P', damage_name: 'mordida',
  state: 'protegido', stable: false, fed: false, grief: false,
  abilities: [], notes: '',
}

function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
}

const str = (v: unknown, max: number, fallback = ''): string => (typeof v === 'string' ? v.slice(0, max) : fallback)
const STATES: CompanionState[] = ['protegido', 'exposto', 'caido', 'morto']

/** Lê o jsonb do banco (sempre na mesma ordem de chaves: o eco do save precisa bater). */
export function readCompanion(raw: unknown): Companion {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (r.has !== true) return { ...NO_COMPANION, abilities: [] }
  const abilities = (Array.isArray(r.abilities) ? r.abilities : []).slice(0, 24).map((a): CompanionAbility => {
    const x = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>
    return {
      id: str(x.id, 60) || newAbilityId(), name: str(x.name, 60), description: str(x.description, 400), usage: str(x.usage, 40),
      learned: x.learned === true, used: x.used === true,
    }
  })
  return {
    has: true,
    name: str(r.name, 60),
    species: str(r.species, 40),
    photo_url: typeof r.photo_url === 'string' && r.photo_url ? r.photo_url.slice(0, 500) : null,
    wounds: int(r.wounds, 0, 20, 0),
    wounds_max: r.wounds_max == null ? null : int(r.wounds_max, 1, 20, 2),
    defense: int(r.defense, 0, 40, 12),
    attack_dice: int(r.attack_dice, 1, 10, 2),
    attack_bonus: int(r.attack_bonus, -10, 20, 2),
    damage: str(r.damage, 20, '1d8') || '1d8',
    damage_type: str(r.damage_type, 8),
    damage_name: str(r.damage_name, 30),
    state: STATES.includes(r.state as CompanionState) ? (r.state as CompanionState) : 'protegido',
    stable: r.stable === true,
    fed: r.fed === true,
    grief: r.grief === true,
    abilities,
    notes: str(r.notes, 600),
  }
}

// ── Efeitos das regras (cada um devolve o companheiro novo) ──

/** Comandar (Ação Bônus): o companheiro age e fica Exposto até o início do próximo turno do dono. */
export function command(c: Companion): Companion {
  return c.state === 'protegido' ? { ...c, state: 'exposto' } : c
}

/** Início do turno do dono: o companheiro volta a ficar Protegido (e abilities de "turno" renovam). */
export function recall(c: Companion): Companion {
  return c.state === 'exposto' ? { ...c, state: 'protegido' } : c
}

/** Ferir: cada ataque que supera a Defesa causa 1 ferida (crítico, 2). Ao chegar no limite, cai. */
export function wound(c: Companion, amount = 1): Companion {
  if (c.state === 'morto') return c
  const wounds = Math.min(woundsMax(c), c.wounds + amount)
  const down = wounds >= woundsMax(c)
  return { ...c, wounds, state: down ? 'caido' : c.state, stable: down ? false : c.stable }
}

/** Curar (Bandagem ou qualquer cura): remove 1 ferida; saindo do limite, levanta Protegido. */
export function heal(c: Companion, amount = 1): Companion {
  if (c.state === 'morto') return c
  const wounds = Math.max(0, c.wounds - amount)
  const up = c.state === 'caido' && wounds < woundsMax(c)
  return { ...c, wounds, state: up ? 'protegido' : c.state, stable: up ? false : c.stable }
}

/** Estabilizou (Medicina + Estratégia): continua Caído, mas fora de perigo. */
export function stabilize(c: Companion): Companion {
  return c.state === 'caido' ? { ...c, stable: true } : c
}

/** Morreu: o dono perde Equilíbrio na hora (2d6) e fica com −1 dado em Vontade até o Descanso Longo. */
export function die(c: Companion): Companion {
  return { ...c, state: 'morto', stable: false, grief: true }
}

/** Descanso Longo: cura todas as feridas SE comeu a Ração; os efeitos de cena e o luto acabam. */
export function longRest(c: Companion): Companion {
  if (c.state === 'morto') return { ...c, grief: false, fed: false }
  const healed = c.fed
  return {
    ...c,
    wounds: healed ? 0 : c.wounds,
    state: healed ? 'protegido' : c.state === 'exposto' ? 'protegido' : c.state,
    stable: healed ? false : c.stable,
    fed: false, grief: false,
    abilities: c.abilities.map((a) => (a.used ? { ...a, used: false } : a)),
  }
}

/** Fim da cena: renova o que é "uma vez por cena". */
export function endCompanionScene(c: Companion): Companion {
  return { ...c, abilities: c.abilities.map((a) => (a.used ? { ...a, used: false } : a)) }
}

/** Perda de Equilíbrio pela morte do companheiro: 2d6. */
export function griefLoss(roll: () => number = () => 1 + Math.floor(Math.random() * 6)): number {
  return roll() + roll()
}
