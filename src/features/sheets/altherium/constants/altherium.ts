// ────────────────────────────────────────────────────────
// Catálogos do sistema Altherium
// Fonte: Livro de regras básicas de ALTHERIUM 1.0
// ────────────────────────────────────────────────────────

export type AltheriumRaiz = 'berserker' | 'runaskin' | 'pilar'

export type AltheriumAttribute =
  | 'furia' | 'destino' | 'espirito' | 'impulso' | 'estrategia' | 'runico'

export type AltheriumDomain =
  | 'brutalidade' | 'crime' | 'determinacao' | 'direcao' | 'esconder'
  | 'furtividade' | 'iniciativa' | 'intimidacao' | 'investigacao'
  | 'leveza' | 'luta' | 'medicina' | 'percepcao' | 'persuasao'
  | 'precisao' | 'pressentimento' | 'reflexo' | 'religiao'
  | 'resiliencia' | 'runologia' | 'saberes' | 'sobrevivencia'
  | 'tatica' | 'vontade'

export type AltheriumGenesis =
  | 'cacador' | 'curandeiro' | 'determinado' | 'devoto' | 'filho_de_mercante'
  | 'guerreiro' | 'guia_espiritual' | 'corredor' | 'peregrino'
  | 'rastreador' | 'robusto' | 'sem_passado'

// ── Atributos ────────────────────────────────────────────

export const ATTRIBUTES: { id: AltheriumAttribute; label: string; description: string }[] = [
  { id: 'furia',      label: 'Fúria',      description: 'Testes físicos relacionados a força.' },
  { id: 'destino',    label: 'Destino',    description: 'Sentir o ambiente ao redor e convencer pessoas com a fala.' },
  { id: 'espirito',   label: 'Espírito',   description: 'Resistência física, mental e defesa.' },
  { id: 'impulso',    label: 'Impulso',    description: 'Agilidade, velocidade e aparar.' },
  { id: 'estrategia', label: 'Estratégia', description: 'Inteligência e tática.' },
  { id: 'runico',     label: 'Rúnico',     description: 'Exclusivo de Runaskins — usa os poderes das runas.' },
]

/** Total de pontos distribuídos na criação do personagem. */
export const ATTRIBUTE_POINTS_AT_CREATION = 16
/** Teto de pontos por atributo. */
export const ATTRIBUTE_MAX = 6
/** Runaskin começa com +2 em Rúnico, fora dos 16 pontos. */
export const RUNASKIN_FREE_RUNICO = 2

// ── Raízes ───────────────────────────────────────────────

export interface RaizEntry {
  id:    AltheriumRaiz
  label: string
  description: string
  /** Bases das fórmulas: valor + 1d10 + atributo correspondente. */
  vitalityBase:   number
  equilibrioBase: number
  /** Recurso próprio da raiz — Pilar usa cartas (13 × nível), sem base fixa. */
  fvBase:  number | null
  prBase:  number | null
  /** Domínios disponíveis = base + pontos de Estratégia. */
  domainBase: number
}

export const RAIZES: RaizEntry[] = [
  {
    id: 'berserker',
    label: 'Berserker',
    description: 'Guerreiros que canalizam uma fúria ancestral em combate, tornando-se máquinas de destruição.',
    vitalityBase: 20,
    equilibrioBase: 10,
    fvBase: 14,
    prBase: null,
    domainBase: 4,
  },
  {
    id: 'runaskin',
    label: 'Runaskin',
    description: 'Guerreiros místicos que canalizam o poder das runas para lançar feitiços, fortalecer aliados e manipular o ambiente.',
    vitalityBase: 10,
    equilibrioBase: 20,
    fvBase: null,
    prBase: 20,
    domainBase: 6,
  },
  {
    id: 'pilar',
    label: 'Pilar',
    description: 'Mestres do risco, vivendo entre a sorte e a estratégia. Enxergam o mundo como um grande jogo.',
    vitalityBase: 15,
    equilibrioBase: 15,
    fvBase: null,
    prBase: null,
    domainBase: 8,
  },
]

const _raizById = Object.fromEntries(RAIZES.map((r) => [r.id, r])) as Record<AltheriumRaiz, RaizEntry>

export function getRaiz(raiz: AltheriumRaiz): RaizEntry {
  return _raizById[raiz]
}

// ── Gênesis ──────────────────────────────────────────────

export const GENESIS: { id: AltheriumGenesis; label: string; effect: string }[] = [
  { id: 'cacador',           label: 'Caçador',           effect: '+1d4 no acerto em armas à distância. (+1d10 Furtividade)' },
  { id: 'curandeiro',        label: 'Curandeiro',        effect: '+1d10 na cura. (+1d10 Medicina)' },
  { id: 'determinado',       label: 'Determinado',       effect: '+1d10 em Equilíbrio. (+1d10 Determinação)' },
  { id: 'devoto',            label: 'Devoto',            effect: 'Pode usar Religião no lugar de qualquer teste social.' },
  { id: 'filho_de_mercante', label: 'Filho de mercante', effect: '₴800 adicionais na criação. (+1d10 Persuasão)' },
  { id: 'guerreiro',         label: 'Guerreiro',         effect: '+1d4 no acerto em armas corpo a corpo. (+1d10 Intimidação)' },
  { id: 'guia_espiritual',   label: 'Guia espiritual',   effect: '+1d10 na cura do Equilíbrio. (+1d10 Pressentimento)' },
  { id: 'corredor',          label: 'Corredor',          effect: '+5m de movimento no deslocamento. (+1d10 Leveza)' },
  { id: 'peregrino',         label: 'Peregrino',         effect: 'Recupera +1d10 em todos os pontos básicos em cenas de descanso. (+1d10 Sobrevivência)' },
  { id: 'rastreador',        label: 'Rastreador',        effect: '+1d10 em testes de Investigação. (+1d10 Percepção)' },
  { id: 'robusto',           label: 'Robusto',           effect: '+1 de DB em todas as partes do corpo. (+1d10 Resiliência)' },
  { id: 'sem_passado',       label: 'Sem passado',       effect: 'O mestre define sua habilidade.' },
]

// ── Domínios ─────────────────────────────────────────────

export const DOMAINS: { id: AltheriumDomain; label: string; attribute: AltheriumAttribute }[] = [
  { id: 'brutalidade',    label: 'Brutalidade',    attribute: 'furia' },
  { id: 'crime',          label: 'Crime',          attribute: 'estrategia' },
  { id: 'determinacao',   label: 'Determinação',   attribute: 'espirito' },
  { id: 'direcao',        label: 'Direção',        attribute: 'impulso' },
  { id: 'esconder',       label: 'Esconder',       attribute: 'estrategia' },
  { id: 'furtividade',    label: 'Furtividade',    attribute: 'impulso' },
  { id: 'iniciativa',     label: 'Iniciativa',     attribute: 'impulso' },
  { id: 'intimidacao',    label: 'Intimidação',    attribute: 'furia' },
  { id: 'investigacao',   label: 'Investigação',   attribute: 'estrategia' },
  { id: 'leveza',         label: 'Leveza',         attribute: 'impulso' },
  { id: 'luta',           label: 'Luta',           attribute: 'furia' },
  { id: 'medicina',       label: 'Medicina',       attribute: 'estrategia' },
  { id: 'percepcao',      label: 'Percepção',      attribute: 'destino' },
  { id: 'persuasao',      label: 'Persuasão',      attribute: 'destino' },
  { id: 'precisao',       label: 'Precisão',       attribute: 'impulso' },
  { id: 'pressentimento', label: 'Pressentimento', attribute: 'destino' },
  { id: 'reflexo',        label: 'Reflexo',        attribute: 'impulso' },
  { id: 'religiao',       label: 'Religião',       attribute: 'destino' },
  { id: 'resiliencia',    label: 'Resiliência',    attribute: 'espirito' },
  { id: 'runologia',      label: 'Runologia',      attribute: 'runico' },
  { id: 'saberes',        label: 'Saberes',        attribute: 'estrategia' },
  { id: 'sobrevivencia',  label: 'Sobrevivência',  attribute: 'estrategia' },
  { id: 'tatica',         label: 'Tática',         attribute: 'estrategia' },
  { id: 'vontade',        label: 'Vontade',        attribute: 'espirito' },
]

/** Teto de pontos por domínio. */
export const DOMAIN_MAX_POINTS = 2

// ── Partes do corpo (defesa) ─────────────────────────────

export const BODY_PARTS = [
  { id: 'db_pernas', label: 'Pernas', range: '1-3'  },
  { id: 'db_bracos', label: 'Braços', range: '4-6'  },
  { id: 'db_tronco', label: 'Tronco', range: '7-9'  },
  { id: 'db_cabeca', label: 'Cabeça', range: '10'   },
] as const

/** Cartas do Pilar por nível: 13, 26, 39, 52, 65. */
export const PILAR_CARDS_PER_LEVEL = 13

/** Hacksilvers iniciais. */
export const STARTING_HACKSILVERS = 2000
