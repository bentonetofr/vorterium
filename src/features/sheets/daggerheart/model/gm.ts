import { newId } from './defaults'
import type { DhRange } from './types'

// ────────────────────────────────────────────────────────
// Fichas do mestre (capítulo 4 do Livro Básico): adversários (monstros, vilões, esbirros) e ambientes (lugares que agem na cena).
// Mesmo formato dos blocos do livro: nível (patamar), tipo, descrição, motivações e impulsos, Dificuldade, limiares, Vida, Fadiga,
// ataque padrão, Experiências e habilidades (passiva, ação ou reação, com custo de Medo).
// ────────────────────────────────────────────────────────

export type DhGmKind = 'adversary' | 'environment'
export type DhFeatureKind = 'passiva' | 'acao' | 'reacao'

export interface DhGmFeature {
  id: string
  name: string
  kind: DhFeatureKind
  /** Pontos de Medo que o mestre gasta para usar (0 = de graça). */
  fearCost: number
  text: string
  /** Perguntas para o mestre fazer à mesa (como nos ambientes do livro). */
  questions: string
}

export const ADVERSARY_KINDS = ['Bruto', 'Esbirro', 'Líder', 'Furtivo', 'Distância', 'Apoio', 'Horda', 'Solo', 'Padrão', 'Social'] as const
export const ENVIRONMENT_KINDS = ['Exploração', 'Social', 'Tráfego', 'Evento'] as const

export interface DhAdversary {
  v: 1
  name: string
  tier: 1 | 2 | 3 | 4
  kind: string
  description: string
  motives: string
  difficulty: number
  major: number
  severe: number
  hp: number
  stress: number
  hpMarked: number
  stressMarked: number
  attackBonus: number
  attackName: string
  attackRange: DhRange
  /** Dano do ataque padrão, ex.: "2d8+3" (já com os dados que o livro manda rolar). */
  damage: string
  damageType: 'fis' | 'mag'
  experiences: { id: string; name: string; mod: number }[]
  features: DhGmFeature[]
  notes: string
}

export interface DhEnvironment {
  v: 1
  name: string
  tier: 1 | 2 | 3 | 4
  kind: string
  description: string
  impulses: string
  difficulty: number
  adversaries: string
  features: DhGmFeature[]
  notes: string
}

export function newFeature(kind: DhFeatureKind = 'passiva'): DhGmFeature {
  return { id: newId(), name: '', kind, fearCost: 0, text: '', questions: '' }
}

export function emptyAdversary(): DhAdversary {
  return {
    v: 1, name: 'Novo adversário', tier: 1, kind: 'Padrão', description: '', motives: '', difficulty: 11, major: 7, severe: 12, hp: 5, stress: 3, hpMarked: 0, stressMarked: 0,
    attackBonus: 1, attackName: 'Ataque', attackRange: 'melee', damage: '1d8+2', damageType: 'fis', experiences: [], features: [], notes: '',
  }
}

export function emptyEnvironment(): DhEnvironment {
  return { v: 1, name: 'Novo ambiente', tier: 1, kind: 'Exploração', description: '', impulses: '', difficulty: 11, adversaries: '', features: [], notes: '' }
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback
  return Math.min(max, Math.max(min, n))
}
function str(v: unknown, max = 4000): string { return typeof v === 'string' ? v.slice(0, max) : '' }
function tier(v: unknown): 1 | 2 | 3 | 4 { return (v === 2 || v === 3 || v === 4 ? v : 1) as 1 | 2 | 3 | 4 }

function features(v: unknown): DhGmFeature[] {
  return (Array.isArray(v) ? v : []).slice(0, 30).flatMap((f) => {
    const x = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>
    if (typeof x.name !== 'string') return []
    const kind: DhFeatureKind = x.kind === 'acao' || x.kind === 'reacao' ? x.kind : 'passiva'
    return [{ id: str(x.id, 20) || newId(), name: str(x.name, 120), kind, fearCost: num(x.fearCost, 0, 0, 12), text: str(x.text, 3000), questions: str(x.questions, 1500) }]
  })
}

export function normalizeAdversary(raw: unknown): DhAdversary {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = emptyAdversary()
  const range = (['melee', 'muito_proximo', 'proximo', 'distante', 'muito_distante'] as const).find((x) => x === r.attackRange)
  return {
    v: 1,
    name: str(r.name, 120) || d.name,
    tier: tier(r.tier),
    kind: str(r.kind, 40) || d.kind,
    description: str(r.description, 1500),
    motives: str(r.motives, 600),
    difficulty: num(r.difficulty, d.difficulty, 0, 40),
    major: num(r.major, d.major, 0, 80),
    severe: num(r.severe, d.severe, 0, 120),
    hp: num(r.hp, d.hp, 1, 30),
    stress: num(r.stress, d.stress, 0, 20),
    hpMarked: num(r.hpMarked, 0, 0, 30),
    stressMarked: num(r.stressMarked, 0, 0, 20),
    attackBonus: num(r.attackBonus, d.attackBonus, -5, 20),
    attackName: str(r.attackName, 80) || d.attackName,
    attackRange: range ?? 'melee',
    damage: str(r.damage, 30) || d.damage,
    damageType: r.damageType === 'mag' ? 'mag' : 'fis',
    experiences: (Array.isArray(r.experiences) ? r.experiences : []).slice(0, 10).flatMap((e) => {
      const x = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>
      return typeof x.name === 'string' ? [{ id: str(x.id, 20) || newId(), name: str(x.name, 80), mod: num(x.mod, 2, -5, 12) }] : []
    }),
    features: features(r.features),
    notes: str(r.notes, 8000),
  }
}

export function normalizeEnvironment(raw: unknown): DhEnvironment {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = emptyEnvironment()
  return {
    v: 1,
    name: str(r.name, 120) || d.name,
    tier: tier(r.tier),
    kind: str(r.kind, 40) || d.kind,
    description: str(r.description, 1500),
    impulses: str(r.impulses, 600),
    difficulty: num(r.difficulty, d.difficulty, 0, 40),
    adversaries: str(r.adversaries, 800),
    features: features(r.features),
    notes: str(r.notes, 8000),
  }
}

/** Ambientes prontos do livro (para começar de um modelo). */
export const ENVIRONMENT_PRESETS: { id: string; build: () => DhEnvironment }[] = [
  {
    id: 'cidade-assombrada',
    build: () => ({
      ...emptyEnvironment(),
      name: 'Cidade Assombrada',
      tier: 2,
      kind: 'Exploração',
      description: 'Uma cidade abandonada e assombrada por espíritos de eras passadas.',
      impulses: 'Desorientar e confundir, replicar calamidades públicas e pessoais.',
      difficulty: 14,
      adversaries: 'Fantasmas (espectro arqueiro, espectro capitão, espectro guardião), versões fantasmagóricas de outros adversários (veja Forma Fantasmagórica).',
      features: [
        { id: newId(), name: 'Conhecimento Oculto', kind: 'passiva', fearCost: 0,
          text: 'A cidade esconde incontáveis mistérios a serem desvendados. Um personagem que busque informação sobre a cidade pode fazer um teste de Instinto ou Conhecimento para aprender sobre o local e descobrir tesouros (possivelmente assombrados).\n• Sucesso crítico: recebe informações valiosas e um item útil.\n• Sucesso com Esperança: recebe informações valiosas.\n• Sucesso com Medo: recebe informações vagas ou incompletas.\n• Qualquer falha: marque 1 Ponto de Fadiga para encontrar uma pista após uma busca exaustiva.',
          questions: 'Quais segredos estão ocultos na cidade? Por que há tantos fantasmas aqui? Quais aventureiros já encontraram seu fim neste local?' },
        { id: newId(), name: 'Forma Fantasmagórica', kind: 'passiva', fearCost: 0,
          text: 'Adversários que surgem aqui possuem forma fantasmagórica. Eles têm resistência a dano físico e podem marcar 1 Ponto de Fadiga para se moverem até um ponto em alcance Próximo atravessando objetos sólidos.',
          questions: 'Quais feridas em suas formas físicas foram as causas de suas mortes? Quais propósitos inacabados os mantêm presos ao Plano Mortal?' },
        { id: newId(), name: 'Antiga Calamidade', kind: 'acao', fearCost: 1,
          text: 'Gaste 1 Ponto de Medo para manifestar o eco de um desastre passado que assolou a cidade. Ative uma Contagem de Progresso (5) enquanto o desastre é repetido ao redor dos personagens. Para completar a contagem e escapar da catástrofe, os personagens devem superar desafios como incêndios, multidões de civis, queda de estruturas e ruas enquanto descobrem a história do que aconteceu e encontram pistas para escapar do inevitável.',
          questions: 'Foi este desastre que fez com que a cidade fosse abandonada? O que se sabe desse evento, e como esse conhecimento pode ajudar na fuga dos personagens?' },
        { id: newId(), name: 'Sem Saída', kind: 'acao', fearCost: 0,
          text: 'Fantasmas de eras anteriores manifestam cenas de seu tempo, como um festival de rua, uma revolução ou um assalto. Essas assombrações alteram a aparência da cidade ao redor dos personagens, bloqueando o caminho atrás deles, forçando um desvio ou impondo desafios, como confundi-los com ladrões rivais durante o assalto.',
          questions: 'O que os fantasmas querem? O que vocês precisam que eles têm?' },
      ],
    }),
  },
]
