import type { TdaConditionDuration, TdaInventoryItem } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Terra Devastada Adaptada — números e tabelas (base: resumo de regras da
// original; Vida, dano das armas e bestiário são da adaptada).
// ────────────────────────────────────────────────────────

/** Máximo de dados num teste (1 natural + 5). */
export const POOL_MAX = 6
/** Na criação: até 3 condições. Qualidades e defeitos não têm número fixo: o Narrador diz na mesa. */
export const CONDITIONS_INITIAL_MAX = 3
/** Listas guardadas na ficha (teto do banco). */
export const TRAITS_MAX = 60
export const CONDITIONS_MAX = 40
export const TRUNFOS_MAX = 40
export const INVENTORY_MAX = 120

/** Vida: de 0 (caído) a 6. Cada golpe de infectado tira de 1 a 6. */
export const HEALTH_MAX = 6

export interface HealthBand {
  min:    number
  max:    number
  level:  'ok' | 'hurt' | 'critical' | 'down'
  title:  string
  effect: string
}

export const HEALTH_BANDS: HealthBand[] = [
  { min: 6, max: 6, level: 'ok',       title: 'Inteiro',          effect: 'Sem ferimentos.' },
  { min: 4, max: 5, level: 'hurt',     title: 'Machucado',        effect: 'Ainda de pé. Sangra e sente, mas luta normalmente.' },
  { min: 2, max: 3, level: 'critical', title: 'Ferido',           effect: 'O Narrador pode dar uma condição (ferido, mancando...). Um golpe forte derruba.' },
  { min: 1, max: 1, level: 'critical', title: 'À beira da morte', effect: 'Qualquer golpe derruba. Hora de fugir ou de gastar Convicção.' },
  { min: 0, max: 0, level: 'down',     title: 'Caído',            effect: 'Fora de combate. Sem ajuda, morre.' },
]

export const HORROR_MAX = 12
/** Horror inicial antes das motivações/desmotivações. */
export const HORROR_BASE = 6
export const CONVICTION_MAX = 24
export const CONVICTION_START = 12
/** Situação: de −3 a +3 dados. */
export const SITUATION_LIMIT = 3

export const TEXT_LIMITS = {
  name:        80,
  concept:     160,
  description: 600,
  background:  4000,
  notes:       2000,
  item:        80,
  trunfoDesc:  600,
} as const

export const CONDITION_DURATIONS: { id: TdaConditionDuration; label: string; hint: string }[] = [
  { id: 'curta',         label: 'Curta',         hint: 'Some logo depois que a ação que a causou termina.' },
  { id: 'media',         label: 'Média',         hint: 'Pode durar algumas horas.' },
  { id: 'longa',         label: 'Longa',         hint: 'Pode durar dias.' },
  { id: 'indeterminada', label: 'Indeterminada', hint: 'Dura o quanto o Narrador achar necessário.' },
]

export const ITEM_KINDS: { id: TdaInventoryItem['kind']; label: string; levelLabel: string | null }[] = [
  { id: 'item',     label: 'Item',     levelLabel: null },
  { id: 'arma',     label: 'Arma',     levelLabel: 'Dano' },
  { id: 'protecao', label: 'Proteção', levelLabel: 'Proteção' },
]

/**
 * Arma: o nível é o DANO fixo por acerto (1 a 6). Não soma dados no teste:
 * o teste diz se acerta, e a arma diz quanto tira.
 */
export const WEAPON_LEVELS = [
  { value: 1, label: 'Dano 1 (corpo a corpo)' },
  { value: 2, label: 'Dano 2 (pistola, revólver)' },
  { value: 3, label: 'Dano 3 (escopeta)' },
  { value: 4, label: 'Dano 4 (rifle)' },
  { value: 5, label: 'Dano 5 (especial)' },
  { value: 6, label: 'Dano 6 (especial)' },
] as const

/** Proteção: nível → dados de bônus ao se defender (1d baixa, 2d alta, 3d extrema). */
export const PROTECTION_LEVELS = [
  { value: 1, label: 'Baixa (1d)' },
  { value: 2, label: 'Alta (2d)' },
  { value: 3, label: 'Extrema (3d)' },
] as const

/** Armas prontas pra adicionar rápido (nome + dano). */
export const WEAPON_PRESETS: { name: string; damage: number; wtype?: 'fogo' | 'consumivel' }[] = [
  { name: 'Cano de ferro',    damage: 1 },
  { name: 'Taco',             damage: 1 },
  { name: 'Machadinha',       damage: 1 },
  { name: 'Pistola',          damage: 2 },
  { name: 'Revólver',         damage: 2 },
  { name: 'Escopeta',         damage: 3 },
  { name: 'Rifle de caça',    damage: 4 },
  { name: 'Fuzil',            damage: 4 },
  { name: 'Coquetel molotov', damage: 5, wtype: 'consumivel' },
  { name: 'Lança-chamas',     damage: 5, wtype: 'fogo' },
  { name: 'Granada',          damage: 6, wtype: 'consumivel' },
]

/** Sem arma: socos e chutes. */
export const UNARMED = { name: 'Mãos nuas', damage: 1 } as const

/** Metas de desempenho sugeridas pelo livro (ação contra meta). */
export const DIFFICULTIES = [
  { label: 'Fácil',   range: '1' },
  { label: 'Comum',   range: '2–3' },
  { label: 'Difícil', range: '4–6' },
] as const

// ── Horror ──────────────────────────────────────────────

export interface HorrorOption { id: string; label: string; points: number }

export const HORROR_GRAVITY: HorrorOption[] = [
  { id: 'cadaver-comum',   points: 0, label: 'Cadáver humano em "boas" condições ou cadáver de animal' },
  { id: 'agressao',        points: 1, label: 'Agressão extrema não mortal, ver um zumbi ou cadáver humano em condições terríveis' },
  { id: 'nao-intencional', points: 2, label: 'Assassinato não intencional' },
  { id: 'intencional',     points: 3, label: 'Assassinato intencional' },
  { id: 'hediondo',        points: 4, label: 'Assassinato banal, em massa, em série, hediondo ou agressão extrema seguida de assassinato' },
]

export const HORROR_INVOLVEMENT: HorrorOption[] = [
  { id: 'espectador', points: 1, label: 'Espectador' },
  { id: 'executor',   points: 2, label: 'Executor' },
  { id: 'vitima',     points: 3, label: 'Vítima (se sobreviver)' },
]

/** Vale só a ligação mais forte entre os presentes na cena. */
export const HORROR_AFFECTION: HorrorOption[] = [
  { id: 'nenhuma',          points: 0, label: 'Ninguém em especial' },
  { id: 'animal',           points: 1, label: 'Animal qualquer' },
  { id: 'animal-querido',   points: 2, label: 'Animal querido' },
  { id: 'pessoa-zumbi',     points: 3, label: 'Pessoa qualquer zumbificada' },
  { id: 'querido-zumbi',    points: 4, label: 'Ente querido zumbificado' },
  { id: 'pessoa',           points: 5, label: 'Pessoa qualquer' },
  { id: 'querido',          points: 6, label: 'Ente querido' },
]

export interface HorrorBand {
  min:     number
  max:     number
  title:   string
  effect:  string
  /** O que o jogador deve anotar na ficha ao entrar nessa faixa. */
  gain:    'condicao' | 'perturbacao-leve' | 'perturbacao-grave' | null
}

export const HORROR_BANDS: HorrorBand[] = [
  { min: 0,  max: 0,  title: 'Sem horror',   gain: null,
    effect: 'Nada abalou você ainda.' },
  { min: 1,  max: 3,  title: 'Com medo',     gain: null,
    effect: 'Você sente medo, mas ainda se controla.' },
  { min: 4,  max: 6,  title: 'Horrorizado',  gain: 'condicao',
    effect: 'Ganha uma condição de medo (horrorizado, apavorado...). Ela só some quando o Horror voltar a 3 ou menos.' },
  { min: 7,  max: 9,  title: 'Perturbado',   gain: 'perturbacao-leve',
    effect: 'Ganha uma perturbação leve como defeito: fobia, mania, tique, paranoia, pesadelos...' },
  { min: 10, max: 12, title: 'À beira do abismo', gain: 'perturbacao-grave',
    effect: 'Ganha uma perturbação grave como defeito: esquizofrenia, neurose, amnésia...' },
]
