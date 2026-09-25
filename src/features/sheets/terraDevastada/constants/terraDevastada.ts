import type { TdConditionDuration, TdInventoryItem } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Terra Devastada — números e tabelas do resumo de regras.
// ────────────────────────────────────────────────────────

/** Máximo de dados num teste (1 natural + 5). */
export const POOL_MAX = 6
/** Na criação: até 12 características fixas e até 3 condições. */
export const TRAITS_INITIAL_MAX = 12
export const CONDITIONS_INITIAL_MAX = 3
/** Listas guardadas na ficha (teto do banco). */
export const TRAITS_MAX = 60
export const CONDITIONS_MAX = 40
export const TRUNFOS_MAX = 40
export const INVENTORY_MAX = 120

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

export const CONDITION_DURATIONS: { id: TdConditionDuration; label: string; hint: string }[] = [
  { id: 'curta',         label: 'Curta',         hint: 'Some logo depois que a ação que a causou termina.' },
  { id: 'media',         label: 'Média',         hint: 'Pode durar algumas horas.' },
  { id: 'longa',         label: 'Longa',         hint: 'Pode durar dias.' },
  { id: 'indeterminada', label: 'Indeterminada', hint: 'Dura o quanto o Narrador achar necessário.' },
]

export const ITEM_KINDS: { id: TdInventoryItem['kind']; label: string; levelLabel: string | null }[] = [
  { id: 'item',     label: 'Item',     levelLabel: null },
  { id: 'arma',     label: 'Arma',     levelLabel: 'Letalidade' },
  { id: 'protecao', label: 'Proteção', levelLabel: 'Proteção' },
]

/** Nível de letalidade/proteção → dados de bônus (1d baixa, 2d alta, 3d extrema). */
export const ITEM_LEVELS = [
  { value: 1, label: 'Baixa (1d)' },
  { value: 2, label: 'Alta (2d)' },
  { value: 3, label: 'Extrema (3d)' },
] as const

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
    effect: 'Ganha uma perturbação leve como característica fixa: fobia, mania, tique, paranoia, pesadelos...' },
  { min: 10, max: 12, title: 'À beira do abismo', gain: 'perturbacao-grave',
    effect: 'Ganha uma perturbação grave como característica fixa: esquizofrenia, neurose, amnésia...' },
]
