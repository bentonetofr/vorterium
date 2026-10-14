import type { ConditionDef, ExhaustionLevel } from './types'

// ────────────────────────────────────────────────────────
// Condições do SRD 5.1 (14 mais Exaustão, que tem 6 níveis). Resumos
// próprios, conferidos contra as definições do SRD em 13/10/2026.
// ────────────────────────────────────────────────────────

export const CONDITIONS: ConditionDef[] = [
  { key: 'blinded', name: 'Cego', original: 'Blinded', summary: 'Não enxerga e falha automaticamente em testes que dependem da visão. Ataques contra ele têm vantagem e os ataques dele têm desvantagem.' },
  { key: 'charmed', name: 'Enfeitiçado', original: 'Charmed', summary: 'Não pode atacar quem o enfeitiçou nem mirá-lo com efeitos nocivos. Quem enfeitiçou tem vantagem em testes sociais contra ele.' },
  { key: 'deafened', name: 'Surdo', original: 'Deafened', summary: 'Não ouve e falha automaticamente em testes que dependem da audição.' },
  { key: 'frightened', name: 'Amedrontado', original: 'Frightened', summary: 'Tem desvantagem em testes de habilidade e ataques enquanto vê a fonte do medo, e não pode se aproximar dela por vontade própria.' },
  { key: 'grappled', name: 'Agarrado', original: 'Grappled', summary: 'Deslocamento 0 e sem bônus de deslocamento. Termina se quem agarra ficar incapacitado ou se algum efeito afastar o alvo do alcance dele.' },
  { key: 'incapacitated', name: 'Incapacitado', original: 'Incapacitated', summary: 'Não pode realizar ações nem reações.' },
  { key: 'invisible', name: 'Invisível', original: 'Invisible', summary: 'Só é visto com magia ou sentido especial. Ataques contra ele têm desvantagem e os ataques dele têm vantagem. Ruído e rastros ainda revelam sua posição.' },
  { key: 'paralyzed', name: 'Paralisado', original: 'Paralyzed', summary: 'Incapacitado, não se move nem fala. Falha automaticamente em salvaguardas de Força e Destreza. Ataques contra ele têm vantagem e, a até 1,5 metro, todo acerto é crítico.' },
  { key: 'petrified', name: 'Petrificado', original: 'Petrified', summary: 'Vira uma substância sólida (pedra), com peso 10 vezes maior e sem envelhecer. Incapacitado, não se move nem fala e não percebe nada. Ataques contra ele têm vantagem; falha em salvaguardas de Força e Destreza; resiste a todo dano e é imune a veneno e doenças.' },
  { key: 'poisoned', name: 'Envenenado', original: 'Poisoned', summary: 'Tem desvantagem em jogadas de ataque e testes de habilidade.' },
  { key: 'prone', name: 'Caído', original: 'Prone', summary: 'Só pode rastejar, a menos que se levante (o que encerra a condição). Tem desvantagem nos ataques. Ataques contra ele têm vantagem a até 1,5 metro e desvantagem de mais longe.' },
  { key: 'restrained', name: 'Contido', original: 'Restrained', summary: 'Deslocamento 0 e sem bônus de deslocamento. Ataques contra ele têm vantagem e os ataques dele têm desvantagem. Desvantagem em salvaguardas de Destreza.' },
  { key: 'stunned', name: 'Atordoado', original: 'Stunned', summary: 'Incapacitado, não se move e fala com dificuldade. Falha automaticamente em salvaguardas de Força e Destreza. Ataques contra ele têm vantagem.' },
  { key: 'unconscious', name: 'Inconsciente', original: 'Unconscious', summary: 'Incapacitado, não se move nem fala e não percebe nada. Larga o que segura e cai. Falha automaticamente em salvaguardas de Força e Destreza. Ataques contra ele têm vantagem e, a até 1,5 metro, todo acerto é crítico.' },
]

export const EXHAUSTION: { key: string; name: string; original: string; levels: ExhaustionLevel[]; rule: string } = {
  key: 'exhaustion', name: 'Exaustão', original: 'Exhaustion',
  levels: [
    { level: 1, effect: 'Desvantagem em testes de habilidade' },
    { level: 2, effect: 'Deslocamento reduzido à metade' },
    { level: 3, effect: 'Desvantagem em ataques e salvaguardas' },
    { level: 4, effect: 'PV máximo reduzido à metade' },
    { level: 5, effect: 'Deslocamento reduzido a 0' },
    { level: 6, effect: 'Morte' },
  ],
  rule: 'Os efeitos se acumulam: cada nível inclui os anteriores. Um descanso longo, com comida e bebida, remove 1 nível.',
}

export const MAX_EXHAUSTION = 6
