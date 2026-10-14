import { STANDARD_ASI_LEVELS } from '../../rules/progression'
import type { ClassDef } from '../types'
import { asiFeatures, byLevel, f } from './helpers'

export const sorcerer: ClassDef = {
  key: 'sorcerer', name: 'Feiticeiro', original: 'Sorcerer',
  hitDie: 6,
  primaryAbilities: ['charisma'],
  saves: ['constitution', 'charisma'],
  skills: { count: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
  armor: [],
  weapons: ['dagger', 'dart', 'sling', 'quarterstaff', 'light_crossbow'],
  tools: [],
  startingEquipment: [
    '(a) uma besta leve e 20 virotes ou (b) qualquer arma simples',
    '(a) uma bolsa de componentes ou (b) um foco arcano',
    '(a) um pacote de aventureiro de masmorra ou (b) um pacote de explorador',
    'Duas adagas',
  ],
  summary: 'Conjurador de magia inata: poucas magias, mas flexíveis, moldadas pela Metamagia e pelos pontos de feitiçaria.',
  subclassLevel: 1,
  asiLevels: STANDARD_ASI_LEVELS,
  spellcasting: {
    ability: 'charisma', kind: 'full', learning: 'known',
    cantripsKnown: byLevel([[1, 4], [4, 5], [10, 6]]),
    spellsKnown: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  },
  features: [
    f(1, 'spellcasting', 'Conjuração', 'Spellcasting', 'Conjura magias de feiticeiro com Carisma. Você conhece um número fixo de magias (tabela da classe) e usa um foco arcano.'),
    f(1, 'sorcerous_origin', 'Origem de Feitiçaria', 'Sorcerous Origin', 'Escolha a origem do seu poder. Ela dá características nos níveis 1, 6, 14 e 18.'),
    f(2, 'font_of_magic', 'Fonte de Magia', 'Font of Magic', 'Você tem pontos de feitiçaria (igual ao nível de feiticeiro) que voltam no descanso longo. Ação bônus: transforme um espaço de magia em pontos (1 por nível do espaço) ou crie espaços de magia gastando pontos (2 pontos para o 1º nível, 3 para o 2º, 5 para o 3º, 6 para o 4º, 7 para o 5º).'),
    f(3, 'metamagic', 'Metamagia', 'Metamagic', 'Escolha duas opções de Metamagia para alterar suas magias gastando pontos de feitiçaria (Cuidadosa, À Distância, Potencializada, Prolongada, Elevada, Acelerada, Sutil, Gêmea). Mais uma no 10º nível e outra no 17º.'),
    ...asiFeatures(STANDARD_ASI_LEVELS),
    f(20, 'sorcerous_restoration', 'Restauração Feiticeira', 'Sorcerous Restoration', 'Recupera 4 pontos de feitiçaria gastos ao terminar um descanso curto.'),
  ],
  progression: [
    { key: 'sorcery_points', label: 'Pontos de Feitiçaria', values: [0, ...Array.from({ length: 19 }, (_, i) => i + 2)] },
    { key: 'metamagic_known', label: 'Metamagia conhecida', values: byLevel([[1, 0], [3, 2], [10, 3], [17, 4]]) },
  ],
  multiclass: {
    requirement: { mode: 'all', abilities: ['charisma'] },
    gained: { armor: [], weapons: [], tools: [] },
  },
  subclasses: [
    {
      key: 'draconic', name: 'Linhagem Dracônica', original: 'Draconic Bloodline', kind: 'Origem de Feitiçaria',
      summary: 'Sangue de dragão nas veias: mais PV, escamas protetoras e afinidade com um tipo de elemento.',
      features: [
        f(1, 'dragon_ancestor', 'Ancestral Dracônico', 'Dragon Ancestor', 'Escolha um tipo de dragão como ancestral: ele define o tipo de dano das suas características. Você fala Dracônico e, em testes de Carisma com dragões, dobra a proficiência.'),
        f(1, 'draconic_resilience', 'Resiliência Dracônica', 'Draconic Resilience', 'Seu PV máximo aumenta em 1 por nível de feiticeiro. Sem armadura, sua CA é 13 + Destreza.'),
        f(6, 'elemental_affinity', 'Afinidade Elemental', 'Elemental Affinity', 'Ao conjurar uma magia com o tipo de dano do seu ancestral, soma seu modificador de Carisma a uma rolagem de dano. Pode gastar 1 ponto de feitiçaria para ganhar resistência a esse tipo por 1 hora.'),
        f(14, 'dragon_wings', 'Asas de Dragão', 'Dragon Wings', 'Ação bônus: cria asas de dragão e ganha deslocamento de voo igual ao terrestre, até dispensá-las. Não funciona com armadura que não acomode asas.'),
        f(18, 'draconic_presence', 'Presença Dracônica', 'Draconic Presence', 'Gaste 5 pontos de feitiçaria: aura de 18 metros por 1 minuto que enfeitiça ou amedronta criaturas hostis (salvaguarda de Sabedoria). Exige concentração.'),
      ],
    },
  ],
}
