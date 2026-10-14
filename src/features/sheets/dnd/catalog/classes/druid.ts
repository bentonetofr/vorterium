import { STANDARD_ASI_LEVELS } from '../../rules/progression'
import type { ClassDef } from '../types'
import { asiFeatures, byLevel, f } from './helpers'

export const druid: ClassDef = {
  key: 'druid', name: 'Druida', original: 'Druid',
  hitDie: 8,
  primaryAbilities: ['wisdom'],
  saves: ['intelligence', 'wisdom'],
  skills: { count: 2, from: ['arcana', 'animal_handling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
  armor: ['light', 'medium', 'shield'],
  weapons: ['club', 'dagger', 'dart', 'javelin', 'mace', 'quarterstaff', 'scimitar', 'sickle', 'sling', 'spear'],
  tools: ['Kit de herbalismo'],
  startingEquipment: [
    '(a) um escudo de madeira ou (b) qualquer arma simples',
    '(a) uma cimitarra ou (b) qualquer arma simples corpo a corpo',
    'Armadura de couro, um pacote de explorador e um foco druídico',
  ],
  summary: 'Guardião da natureza: conjura magias primais e assume a forma de animais. Não usa armadura nem escudo de metal.',
  subclassLevel: 2,
  asiLevels: STANDARD_ASI_LEVELS,
  spellcasting: {
    ability: 'wisdom', kind: 'full', learning: 'prepared',
    cantripsKnown: byLevel([[1, 2], [4, 3], [10, 4]]),
  },
  features: [
    f(1, 'druidic', 'Druídico', 'Druidic', 'Você conhece o Druídico, o idioma secreto dos druidas, e pode deixar mensagens escondidas nele.'),
    f(1, 'spellcasting', 'Conjuração', 'Spellcasting', 'Conjura magias de druida com Sabedoria. Depois de um descanso longo, prepara magias da lista de druida: nível de druida + modificador de Sabedoria. Usa um foco druídico.'),
    f(2, 'wild_shape', 'Forma Selvagem', 'Wild Shape', 'Ação: assuma a forma de uma fera que você já tenha visto. Usos: 2 por descanso curto ou longo. Nível 2: ND máximo 1/4, sem voo nem natação; nível 4: ND 1/2, sem voo; nível 8: ND 1. Dura metade do seu nível de druida em horas.'),
    f(2, 'druid_circle', 'Círculo Druídico', 'Druid Circle', 'Escolha o círculo a que você pertence.'),
    ...asiFeatures(STANDARD_ASI_LEVELS),
    f(4, 'wild_shape_improvement_4', 'Forma Selvagem Aprimorada (4º)', 'Wild Shape improvement', 'Pode assumir formas de ND até 1/2, sem velocidade de voo.'),
    f(8, 'wild_shape_improvement_8', 'Forma Selvagem Aprimorada (8º)', 'Wild Shape improvement', 'Pode assumir formas de ND até 1, inclusive com voo.'),
    f(18, 'timeless_body', 'Corpo Atemporal', 'Timeless Body', 'A magia primal faz você envelhecer 1 ano a cada 10 anos que passam.'),
    f(18, 'beast_spells', 'Magias Bestiais', 'Beast Spells', 'Você pode conjurar magias com componentes verbais e somáticos na Forma Selvagem.'),
    f(20, 'archdruid', 'Arquidruida', 'Archdruid', 'Forma Selvagem ilimitada. Você ignora componentes verbais, somáticos e materiais sem custo das suas magias de druida.'),
  ],
  progression: [],
  multiclass: {
    requirement: { mode: 'all', abilities: ['wisdom'] },
    gained: { armor: ['light', 'medium', 'shield'], weapons: [], tools: [], note: 'Druidas não usam armadura nem escudo de metal.' },
  },
  subclasses: [
    {
      key: 'land', name: 'Círculo da Terra', original: 'Circle of the Land', kind: 'Círculo Druídico',
      summary: 'Místicos ligados a um tipo de terreno: mais magias e proteção contra criaturas da natureza.',
      features: [
        f(2, 'bonus_cantrip', 'Truque Bônus', 'Bonus Cantrip', 'Aprende um truque de druida à sua escolha.'),
        f(2, 'natural_recovery', 'Recuperação Natural', 'Natural Recovery', 'Num descanso curto, recupera espaços de magia de nível combinado até metade do seu nível de druida (arredondado para cima), nenhum de 6º nível ou mais. Só pode usar de novo depois de um descanso longo.'),
        f(3, 'circle_spells', 'Magias do Círculo', 'Circle Spells', 'Sua ligação com o terreno escolhido (ártico, costa, deserto, floresta, pradaria, montanha ou pântano) dá magias sempre preparadas nos níveis 3, 5, 7 e 9.'),
        f(6, 'lands_stride', 'Passos da Terra', 'Land\'s Stride', 'Mover-se por terreno difícil não mágico não custa movimento extra, e plantas não mágicas não atrapalham. Vantagem contra plantas criadas ou manipuladas por magia.'),
        f(10, 'natures_ward', 'Proteção da Natureza', 'Nature\'s Ward', 'Você não pode ser enfeitiçado nem amedrontado por elementais e fadas, e é imune a veneno e doenças.'),
        f(14, 'natures_sanctuary', 'Santuário da Natureza', 'Nature\'s Sanctuary', 'Feras e plantas que atacam você fazem uma salvaguarda de Sabedoria; se falharem, escolhem outro alvo ou perdem o ataque.'),
      ],
    },
  ],
}
