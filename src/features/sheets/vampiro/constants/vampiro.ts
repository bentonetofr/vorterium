// ────────────────────────────────────────────────────────
// Vampiro: A Máscara (5ª edição) — os dados fixos do sistema: atributos,
// perícias, clãs (disciplinas, perdição e compulsão), tipos de predador,
// gerações e a tabela da Potência de Sangue. Só nomes e números das
// regras; nada de texto do livro.
// ────────────────────────────────────────────────────────

/** Chave do recurso no Painel de controle (nasce guardado). */
export const VAMPIRO_FEATURE = 'vampiro'

export type VtmAttrKey =
  | 'strength' | 'dexterity' | 'stamina'
  | 'charisma' | 'manipulation' | 'composure'
  | 'intelligence' | 'wits' | 'resolve'

export type VtmGroup = 'fisico' | 'social' | 'mental'

export const VTM_GROUPS: { id: VtmGroup; label: string }[] = [
  { id: 'fisico', label: 'Físicos' },
  { id: 'social', label: 'Sociais' },
  { id: 'mental', label: 'Mentais' },
]

export const VTM_ATTRIBUTES: { key: VtmAttrKey; label: string; group: VtmGroup }[] = [
  { key: 'strength',     label: 'Força',        group: 'fisico' },
  { key: 'dexterity',    label: 'Destreza',     group: 'fisico' },
  { key: 'stamina',      label: 'Vigor',        group: 'fisico' },
  { key: 'charisma',     label: 'Carisma',      group: 'social' },
  { key: 'manipulation', label: 'Manipulação',  group: 'social' },
  { key: 'composure',    label: 'Autocontrole', group: 'social' },
  { key: 'intelligence', label: 'Inteligência', group: 'mental' },
  { key: 'wits',         label: 'Raciocínio',   group: 'mental' },
  { key: 'resolve',      label: 'Determinação', group: 'mental' },
]

export const VTM_SKILLS: { key: string; label: string; group: VtmGroup }[] = [
  // Físicas
  { key: 'athletics',     label: 'Atletismo',           group: 'fisico' },
  { key: 'brawl',         label: 'Briga',               group: 'fisico' },
  { key: 'craft',         label: 'Ofícios',             group: 'fisico' },
  { key: 'drive',         label: 'Condução',            group: 'fisico' },
  { key: 'firearms',      label: 'Armas de Fogo',       group: 'fisico' },
  { key: 'larceny',       label: 'Furto',               group: 'fisico' },
  { key: 'melee',         label: 'Armas Brancas',       group: 'fisico' },
  { key: 'stealth',       label: 'Furtividade',         group: 'fisico' },
  { key: 'survival',      label: 'Sobrevivência',       group: 'fisico' },
  // Sociais
  { key: 'animal_ken',    label: 'Empatia com Animais', group: 'social' },
  { key: 'etiquette',     label: 'Etiqueta',            group: 'social' },
  { key: 'insight',       label: 'Intuição',            group: 'social' },
  { key: 'intimidation',  label: 'Intimidação',         group: 'social' },
  { key: 'leadership',    label: 'Liderança',           group: 'social' },
  { key: 'performance',   label: 'Performance',         group: 'social' },
  { key: 'persuasion',    label: 'Persuasão',           group: 'social' },
  { key: 'streetwise',    label: 'Manha',               group: 'social' },
  { key: 'subterfuge',    label: 'Lábia',               group: 'social' },
  // Mentais
  { key: 'academics',     label: 'Erudição',            group: 'mental' },
  { key: 'awareness',     label: 'Percepção',           group: 'mental' },
  { key: 'finance',       label: 'Finanças',            group: 'mental' },
  { key: 'investigation', label: 'Investigação',        group: 'mental' },
  { key: 'medicine',      label: 'Medicina',            group: 'mental' },
  { key: 'occult',        label: 'Ocultismo',           group: 'mental' },
  { key: 'politics',      label: 'Política',            group: 'mental' },
  { key: 'science',       label: 'Ciência',             group: 'mental' },
  { key: 'technology',    label: 'Tecnologia',          group: 'mental' },
]

export const VTM_SKILL_KEYS = new Set(VTM_SKILLS.map((s) => s.key))

// ── Disciplinas e clãs ──────────────────────────────────

export type VtmDiscipline =
  | 'animalismo' | 'auspicios' | 'celeridade' | 'dominacao' | 'fortitude'
  | 'metamorfose' | 'oblivio' | 'ofuscacao' | 'potencia' | 'presenca'
  | 'feiticaria' | 'alquimia'

export const VTM_DISCIPLINES: Record<VtmDiscipline, string> = {
  animalismo:  'Animalismo',
  auspicios:   'Auspícios',
  celeridade:  'Celeridade',
  dominacao:   'Dominação',
  fortitude:   'Fortitude',
  metamorfose: 'Metamorfose',
  oblivio:     'Oblívio',
  ofuscacao:   'Ofuscação',
  potencia:    'Potência',
  presenca:    'Presença',
  feiticaria:  'Feitiçaria de Sangue',
  alquimia:    'Alquimia de Sangue Ralo',
}

export interface VtmClan {
  id:          string
  label:       string
  disciplines: VtmDiscipline[]
  /** Nome da perdição do clã (a gravidade sai da Potência de Sangue). */
  bane:        string | null
  compulsion:  string | null
}

export const VTM_CLANS: VtmClan[] = [
  { id: 'brujah',     label: 'Brujah',     disciplines: ['celeridade', 'potencia', 'presenca'],     bane: 'Fúria Violenta',        compulsion: 'Rebeldia' },
  { id: 'gangrel',    label: 'Gangrel',    disciplines: ['animalismo', 'fortitude', 'metamorfose'], bane: 'Traços Bestiais',       compulsion: 'Impulsos Ferais' },
  { id: 'malkavian',  label: 'Malkaviano', disciplines: ['auspicios', 'dominacao', 'ofuscacao'],    bane: 'Perspectiva Fraturada', compulsion: 'Delírio' },
  { id: 'nosferatu',  label: 'Nosferatu',  disciplines: ['animalismo', 'ofuscacao', 'potencia'],    bane: 'Repulsa',               compulsion: 'Criptofilia' },
  { id: 'toreador',   label: 'Toreador',   disciplines: ['auspicios', 'celeridade', 'presenca'],    bane: 'Fixação Estética',      compulsion: 'Obsessão' },
  { id: 'tremere',    label: 'Tremere',    disciplines: ['auspicios', 'dominacao', 'feiticaria'],   bane: 'Sangue Deficiente',     compulsion: 'Perfeccionismo' },
  { id: 'ventrue',    label: 'Ventrue',    disciplines: ['dominacao', 'fortitude', 'presenca'],     bane: 'Paladar Raro',          compulsion: 'Arrogância' },
  { id: 'banu_haqim', label: 'Banu Haqim', disciplines: ['celeridade', 'feiticaria', 'ofuscacao'],  bane: 'Vício em Sangue',       compulsion: 'Julgamento' },
  { id: 'ministerio', label: 'Ministério', disciplines: ['metamorfose', 'ofuscacao', 'presenca'],   bane: 'Aversão à Luz',         compulsion: 'Transgressão' },
  { id: 'hecata',     label: 'Hecata',     disciplines: ['auspicios', 'fortitude', 'oblivio'],      bane: 'Beijo Doloroso',        compulsion: 'Fascínio Mórbido' },
  { id: 'lasombra',   label: 'Lasombra',   disciplines: ['dominacao', 'oblivio', 'potencia'],       bane: 'Imagem Distorcida',     compulsion: 'Ambição Implacável' },
  { id: 'ravnos',     label: 'Ravnos',     disciplines: ['animalismo', 'ofuscacao', 'presenca'],    bane: 'Condenado',             compulsion: 'Tentação' },
  { id: 'salubri',    label: 'Salubri',    disciplines: ['auspicios', 'dominacao', 'fortitude'],    bane: 'Caçado',                compulsion: 'Afeição' },
  { id: 'tzimisce',   label: 'Tzimisce',   disciplines: ['animalismo', 'dominacao', 'metamorfose'], bane: 'Apego à Terra',         compulsion: 'Cobiça' },
  { id: 'caitiff',    label: 'Caitiff',    disciplines: [],                                         bane: 'Desconfiança',          compulsion: null },
  { id: 'sangue_ralo', label: 'Sangue-Ralo', disciplines: ['alquimia'],                             bane: null,                    compulsion: null },
]

export function getClan(id: string | null | undefined): VtmClan | null {
  return VTM_CLANS.find((c) => c.id === id) ?? null
}

// Tipos de predador: vtmPredators.ts (com o que cada um dá na criação).

// ── Geração e Potência de Sangue ────────────────────────

export const VTM_GENERATION_MIN = 4
export const VTM_GENERATION_MAX = 16

/** Potência de Sangue mínima e máxima por geração (14ª–16ª: sangue-ralo). */
export const VTM_BP_BY_GENERATION: Record<number, { min: number; max: number; start: number }> = {
  4:  { min: 5, max: 10, start: 5 },
  5:  { min: 4, max: 9,  start: 4 },
  6:  { min: 3, max: 8,  start: 3 },
  7:  { min: 3, max: 7,  start: 3 },
  8:  { min: 2, max: 6,  start: 2 },
  9:  { min: 2, max: 5,  start: 2 },
  10: { min: 1, max: 4,  start: 2 },
  11: { min: 1, max: 4,  start: 2 },
  12: { min: 1, max: 3,  start: 1 },
  13: { min: 1, max: 3,  start: 1 },
  14: { min: 0, max: 0,  start: 0 },
  15: { min: 0, max: 0,  start: 0 },
  16: { min: 0, max: 0,  start: 0 },
}

export interface VtmBloodPotencyRow {
  /** Dados a mais no Surto de Sangue. */
  surge:     number
  /** Dano superficial curado a cada teste de despertar. */
  mend:      number
  /** Bônus somado às disciplinas. */
  power:     number
  /** Até que nível de disciplina o teste de despertar pode ser rerrolado (0 = nenhum). */
  reroll:    number
  /** Gravidade da perdição do clã. */
  bane:      number
  /** O que muda ao se alimentar. */
  feeding:   string
}

export const VTM_BLOOD_POTENCY: VtmBloodPotencyRow[] = [
  { surge: 1, mend: 1, power: 0, reroll: 0, bane: 0, feeding: 'Sem penalidade.' },
  { surge: 2, mend: 1, power: 0, reroll: 1, bane: 2, feeding: 'Sem penalidade.' },
  { surge: 2, mend: 2, power: 1, reroll: 1, bane: 2, feeding: 'Sangue animal e de bolsa sacia só metade da Fome.' },
  { surge: 3, mend: 2, power: 1, reroll: 2, bane: 3, feeding: 'Sangue animal e de bolsa não sacia a Fome.' },
  { surge: 3, mend: 3, power: 2, reroll: 2, bane: 3, feeding: 'Sangue animal e de bolsa não sacia; humanos saciam 1 de Fome a menos.' },
  { surge: 4, mend: 3, power: 2, reroll: 3, bane: 4, feeding: 'Humanos saciam 1 a menos; pra deixar a Fome abaixo de 2, precisa drenar e matar.' },
  { surge: 4, mend: 3, power: 3, reroll: 3, bane: 4, feeding: 'Humanos saciam 2 a menos; pra deixar a Fome abaixo de 2, precisa drenar e matar.' },
  { surge: 5, mend: 3, power: 3, reroll: 4, bane: 5, feeding: 'Humanos saciam 2 a menos; pra deixar a Fome abaixo de 2, precisa drenar e matar.' },
  { surge: 5, mend: 4, power: 4, reroll: 4, bane: 5, feeding: 'Humanos saciam 2 a menos; pra deixar a Fome abaixo de 3, precisa drenar e matar.' },
  { surge: 6, mend: 4, power: 4, reroll: 5, bane: 6, feeding: 'Humanos saciam 2 a menos; pra deixar a Fome abaixo de 3, precisa drenar e matar.' },
  { surge: 6, mend: 5, power: 5, reroll: 5, bane: 6, feeding: 'Humanos saciam 3 a menos; pra deixar a Fome abaixo de 3, precisa drenar e matar.' },
]

// ── Criação ─────────────────────────────────────────────

/** Atributos na criação: um em 4, três em 3, quatro em 2, um em 1. */
export const VTM_ATTR_SPREAD = [4, 3, 3, 3, 2, 2, 2, 2, 1]

/** Distribuições de perícias na criação (pontos → quantas perícias). */
export const VTM_SKILL_SPREADS: { id: string; label: string; counts: Record<number, number> }[] = [
  { id: 'faz_tudo',    label: 'Faz-tudo',    counts: { 3: 1, 2: 8, 1: 10 } },
  { id: 'equilibrado', label: 'Equilibrado', counts: { 3: 3, 2: 5, 1: 7 } },
  { id: 'especialista', label: 'Especialista', counts: { 4: 1, 3: 3, 2: 3, 1: 3 } },
]

export const VTM_HUNGER_MAX   = 5
export const VTM_HUMANITY_MAX = 10
export const VTM_DOTS_MAX     = 5
export const VTM_START_HUMANITY = 7

export const VTM_TEXT_LIMITS = {
  character_name: 80, concept: 160, chronicle: 120, sire: 80,
  ambition: 300, desire: 300, history: 6000, notes: 4000, specialty: 60,
} as const

export const VTM_PORTRAIT_MAX_BYTES = 2 * 1024 * 1024
export const VTM_PORTRAIT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
