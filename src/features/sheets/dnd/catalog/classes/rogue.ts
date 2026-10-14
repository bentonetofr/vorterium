import { ROGUE_ASI_LEVELS } from '../../rules/progression'
import type { ClassDef } from '../types'
import { asiFeatures, f } from './helpers'

export const rogue: ClassDef = {
  key: 'rogue', name: 'Ladino', original: 'Rogue',
  hitDie: 8,
  primaryAbilities: ['dexterity'],
  saves: ['dexterity', 'intelligence'],
  skills: { count: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight_of_hand', 'stealth'] },
  armor: ['light'],
  weapons: ['simple', 'hand_crossbow', 'longsword', 'rapier', 'shortsword'],
  tools: ['Ferramentas de ladrão'],
  startingEquipment: [
    '(a) uma rapieira ou (b) uma espada curta',
    '(a) um arco curto e uma aljava com 20 flechas ou (b) uma espada curta',
    '(a) um pacote de ladrão, (b) um pacote de aventureiro de masmorra ou (c) um pacote de explorador',
    'Armadura de couro, duas adagas e ferramentas de ladrão',
  ],
  summary: 'Especialista furtivo e perito em perícias: causa dano devastador quando pega o inimigo de surpresa.',
  subclassLevel: 3,
  asiLevels: ROGUE_ASI_LEVELS,
  features: [
    f(1, 'expertise', 'Especialização', 'Expertise', 'Escolha duas perícias em que é proficiente (ou uma e as ferramentas de ladrão): o bônus de proficiência delas dobra. Mais duas no 6º nível.'),
    f(1, 'sneak_attack', 'Ataque Furtivo', 'Sneak Attack', 'Uma vez por turno, +dano extra (tabela da classe) em um ataque com arma de acuidade ou à distância, se tiver vantagem no ataque ou se um aliado seu estiver a 1,5 metro do alvo (e você sem desvantagem).'),
    f(1, 'thieves_cant', 'Gíria de Ladrão', 'Thieves\' Cant', 'Você conhece o idioma secreto dos ladrões, com mensagens escondidas em conversas comuns.'),
    f(2, 'cunning_action', 'Ação Ardilosa', 'Cunning Action', 'Ação bônus para usar Disparada, Desengajar ou Esconder-se.'),
    f(3, 'roguish_archetype', 'Arquétipo de Ladino', 'Roguish Archetype', 'Escolha o arquétipo que define a sua especialidade.'),
    ...asiFeatures(ROGUE_ASI_LEVELS),
    f(5, 'uncanny_dodge', 'Esquiva Sobrenatural', 'Uncanny Dodge', 'Reação: reduz à metade o dano de um ataque que você veja.'),
    f(6, 'expertise_2', 'Especialização (2ª)', 'Expertise (second)', 'Escolha mais duas proficiências (perícias ou ferramentas de ladrão) para dobrar o bônus.'),
    f(7, 'evasion', 'Evasão', 'Evasion', 'Em salvaguardas de Destreza para metade do dano, sucesso = nenhum dano e falha = metade do dano.'),
    f(11, 'reliable_talent', 'Talento Confiável', 'Reliable Talent', 'Em testes de habilidade em que soma a proficiência, qualquer resultado de 9 ou menos no d20 conta como 10.'),
    f(14, 'blindsense', 'Sentido Cego', 'Blindsense', 'Se puder ouvir, você sabe onde estão criaturas escondidas ou invisíveis a até 3 metros.'),
    f(15, 'slippery_mind', 'Mente Escorregadia', 'Slippery Mind', 'Proficiência em salvaguardas de Sabedoria.'),
    f(18, 'elusive', 'Elusivo', 'Elusive', 'Nenhum ataque tem vantagem contra você, a menos que você esteja incapacitado.'),
    f(20, 'stroke_of_luck', 'Golpe de Sorte', 'Stroke of Luck', 'Transforma um ataque que errou em acerto, ou um teste de habilidade em 20. Um uso por descanso curto ou longo.'),
  ],
  progression: [
    { key: 'sneak_attack', label: 'Ataque Furtivo', values: Array.from({ length: 20 }, (_, i) => `${Math.ceil((i + 1) / 2)}d6`) },
  ],
  multiclass: {
    requirement: { mode: 'all', abilities: ['dexterity'] },
    gained: { armor: ['light'], weapons: [], tools: ['Ferramentas de ladrão'], skills: { count: 1, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight_of_hand', 'stealth'] } },
  },
  subclasses: [
    {
      key: 'thief', name: 'Ladrão', original: 'Thief', kind: 'Arquétipo de Ladino',
      summary: 'Especialista em roubo, escalada e uso rápido de itens.',
      features: [
        f(3, 'fast_hands', 'Mãos Rápidas', 'Fast Hands', 'Pode usar a ação bônus da Ação Ardilosa para Prestidigitação, desarmar uma armadilha, abrir fechadura ou usar um objeto.'),
        f(3, 'second_story_work', 'Trabalho de Segundo Andar', 'Second-Story Work', 'Escala sem gastar movimento extra e o salto em distância aumenta pela sua Destreza.'),
        f(9, 'supreme_sneak', 'Furtividade Suprema', 'Supreme Sneak', 'Vantagem em testes de Destreza (Furtividade) se você se mover no máximo metade do deslocamento no turno.'),
        f(13, 'use_magic_device', 'Usar Dispositivo Mágico', 'Use Magic Device', 'Ignora requisitos de classe, raça e nível para usar itens mágicos.'),
        f(17, 'thiefs_reflexes', 'Reflexos de Ladrão', 'Thief\'s Reflexes', 'Faz dois turnos na primeira rodada de qualquer combate: o primeiro na sua iniciativa e o segundo na iniciativa menos 10.'),
      ],
    },
  ],
}
