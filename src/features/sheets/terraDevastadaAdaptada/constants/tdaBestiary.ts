import type { TdaCreature } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Bestiário de referência da Terra Devastada Adaptada.
//   Dano        o que tira da Vida por golpe (1 a 6; 6 = mata de uma vez).
//   Resistência o dano que aguenta (mesma régua das armas): uma arma com
//               dano igual ou maior mata em um acerto; menor, acumula.
//   Defesa      meta pra ACERTAR (teste de pares do atacante).
//   Ferocidade  meta pra ESQUIVAR (teste de pares de quem é atacado).
// Os danos dos infectados (1 a 6) são os da regra; Defesa, Ferocidade e os
// humanos/cão são sugestões, o mestre ajusta no bestiário da campanha.
// ────────────────────────────────────────────────────────

export type TdaCreatureKind = TdaCreature['kind']

export const CREATURE_KINDS: { id: TdaCreatureKind; label: string }[] = [
  { id: 'infectado', label: 'Infectado' },
  { id: 'humano',    label: 'Humano' },
  { id: 'animal',    label: 'Animal' },
  { id: 'outro',     label: 'Outro' },
]

export interface CreatureStats {
  name:      string
  kind:      TdaCreatureKind
  damage:    number
  toughness: number
  defense:   number
  ferocity:  number
  notes:     string
}

export interface PresetCreature extends CreatureStats {
  id: string
}

export const PRESET_CREATURES: PresetCreature[] = [
  {
    id: 'corredor', name: 'Corredor', kind: 'infectado', damage: 1, toughness: 1, defense: 1, ferocity: 1,
    notes: 'Infectado recente: ainda enxerga, corre e ataca em bando. Frágil sozinho, perigoso em grupo.',
  },
  {
    id: 'espreitador', name: 'Espreitador', kind: 'infectado', damage: 2, toughness: 2, defense: 2, ferocity: 2,
    notes: 'Se esconde e circula a vítima, atacando de surpresa. Foge de luz e de barulho alto.',
  },
  {
    id: 'estalador', name: 'Estalador', kind: 'infectado', damage: 3, toughness: 3, defense: 2, ferocity: 3,
    notes: 'Cego: caça pelo som. Furtividade contra ele é contra o seu barulho. Corpo a corpo de perto é perigoso.',
  },
  {
    id: 'cambaleante', name: 'Cambaleante', kind: 'infectado', damage: 4, toughness: 4, defense: 3, ferocity: 2,
    notes: 'Lento, cheio de esporos ácidos. Ao morrer perto, solta uma nuvem tóxica (o Narrador decide o efeito).',
  },
  {
    id: 'baiacu', name: 'Baiacu', kind: 'infectado', damage: 6, toughness: 6, defense: 1, ferocity: 3,
    notes: 'Enorme e blindado de fungo. Um golpe mata. Aguenta muito: armas de dano 5 ou 6 resolvem.',
  },
  {
    id: 'combatente', name: 'Combatente (corpo a corpo)', kind: 'humano', damage: 1, toughness: 2, defense: 2, ferocity: 2,
    notes: 'Sobrevivente hostil com cano ou taco. Se chama por grito ou apito e cerca a vítima.',
  },
  {
    id: 'pistoleiro', name: 'Pistoleiro', kind: 'humano', damage: 2, toughness: 2, defense: 2, ferocity: 2,
    notes: 'Pistola ou revólver. Usa cobertura e tenta flanquear.',
  },
  {
    id: 'escopeteiro', name: 'Escopeteiro', kind: 'humano', damage: 3, toughness: 2, defense: 2, ferocity: 3,
    notes: 'Escopeta: perigoso de perto. Avança pra fechar a distância.',
  },
  {
    id: 'atirador', name: 'Atirador', kind: 'humano', damage: 4, toughness: 2, defense: 3, ferocity: 3,
    notes: 'Rifle. Mantém distância e cobre os outros.',
  },
  {
    id: 'cao', name: 'Cão de rastreio', kind: 'animal', damage: 2, toughness: 1, defense: 2, ferocity: 2,
    notes: 'Segue o cheiro: derrota a furtividade de quem anda no chão. Morre rápido, mas denuncia.',
  },
]
