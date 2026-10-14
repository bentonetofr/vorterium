import { STANDARD_ASI_LEVELS } from '../../rules/progression'
import type { ClassDef } from '../types'
import { asiFeatures, byLevel, f } from './helpers'

export const warlock: ClassDef = {
  key: 'warlock', name: 'Bruxo', original: 'Warlock',
  hitDie: 8,
  primaryAbilities: ['charisma'],
  saves: ['wisdom', 'charisma'],
  skills: { count: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
  armor: ['light'],
  weapons: ['simple'],
  tools: [],
  startingEquipment: [
    '(a) uma besta leve e 20 virotes ou (b) qualquer arma simples',
    '(a) uma bolsa de componentes ou (b) um foco arcano',
    '(a) um pacote de acadêmico ou (b) um pacote de aventureiro de masmorra',
    'Armadura de couro, qualquer arma simples e duas adagas',
  ],
  summary: 'Conjurador que fez um pacto com um ser sobrenatural: poucos espaços de magia, que voltam no descanso curto, e invocações místicas.',
  subclassLevel: 1,
  asiLevels: STANDARD_ASI_LEVELS,
  spellcasting: {
    ability: 'charisma', kind: 'pact', learning: 'known',
    cantripsKnown: byLevel([[1, 2], [4, 3], [10, 4]]),
    spellsKnown: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  },
  features: [
    f(1, 'otherworldly_patron', 'Patrono Transcendental', 'Otherworldly Patron', 'Escolha o ser com quem fez o pacto. Ele dá características nos níveis 1, 6, 10 e 14.'),
    f(1, 'pact_magic', 'Magia de Pacto', 'Pact Magic', 'Conjura magias de bruxo com Carisma. Seus poucos espaços de magia têm sempre o nível mais alto (tabela da classe) e voltam todos num descanso curto ou longo.'),
    f(2, 'eldritch_invocations', 'Invocações Místicas', 'Eldritch Invocations', 'Aprende fragmentos de conhecimento proibido que dão habilidades permanentes. Quantidade conhecida na tabela da classe; pode trocar uma ao subir de nível.'),
    f(3, 'pact_boon', 'Dádiva do Pacto', 'Pact Boon', 'Escolha uma: Pacto da Corrente (familiar aprimorado), Pacto da Lâmina (arma de pacto) ou Pacto do Tomo (Livro das Sombras com três truques extras).'),
    ...asiFeatures(STANDARD_ASI_LEVELS),
    f(11, 'mystic_arcanum_6', 'Arcana Mística (6º nível)', 'Mystic Arcanum (6th level)', 'Escolha uma magia de bruxo de 6º nível: conjure uma vez por descanso longo, sem gastar espaço. No 13º, 15º e 17º níveis, ganha uma de 7º, 8º e 9º.'),
    f(13, 'mystic_arcanum_7', 'Arcana Mística (7º nível)', 'Mystic Arcanum (7th level)', 'Escolha uma magia de bruxo de 7º nível, conjurável uma vez por descanso longo.'),
    f(15, 'mystic_arcanum_8', 'Arcana Mística (8º nível)', 'Mystic Arcanum (8th level)', 'Escolha uma magia de bruxo de 8º nível, conjurável uma vez por descanso longo.'),
    f(17, 'mystic_arcanum_9', 'Arcana Mística (9º nível)', 'Mystic Arcanum (9th level)', 'Escolha uma magia de bruxo de 9º nível, conjurável uma vez por descanso longo.'),
    f(20, 'eldritch_master', 'Mestre Místico', 'Eldritch Master', 'Gaste 1 minuto implorando ao patrono para recuperar todos os espaços de magia de Magia de Pacto. Um uso por descanso longo.'),
  ],
  progression: [
    { key: 'invocations_known', label: 'Invocações conhecidas', values: [0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8] },
  ],
  multiclass: {
    requirement: { mode: 'all', abilities: ['charisma'] },
    gained: { armor: ['light'], weapons: ['simple'], tools: [] },
  },
  subclasses: [
    {
      key: 'fiend', name: 'O Corruptor', original: 'The Fiend', kind: 'Patrono Transcendental',
      summary: 'Pacto com um ser dos planos inferiores: poder destruidor em troca de uma alma comprometida.',
      features: [
        f(1, 'fiend_expanded_spells', 'Lista de Magias Expandida', 'Expanded Spell List', 'Magias do Corruptor entram na sua lista: mãos flamejantes e comando (1º); cegueira/surdez e raio ardente (2º); bola de fogo e névoa fétida (3º); escudo de fogo e muralha de fogo (4º); golpe flamejante e consagrar (5º).'),
        f(1, 'dark_ones_blessing', 'Bênção do Obscuro', 'Dark One\'s Blessing', 'Ao reduzir uma criatura hostil a 0 PV, você ganha PV temporários iguais ao seu modificador de Carisma + nível de bruxo (mínimo 1).'),
        f(6, 'dark_ones_own_luck', 'Sorte do Obscuro', 'Dark One\'s Own Luck', 'Ao fazer um teste de habilidade ou salvaguarda, some 1d10 ao resultado. Um uso por descanso curto ou longo.'),
        f(10, 'fiendish_resilience', 'Resiliência Ínfera', 'Fiendish Resilience', 'Depois de um descanso curto ou longo, escolha um tipo de dano: você resiste a ele até escolher outro (exceto dano de armas mágicas ou de prata).'),
        f(14, 'hurl_through_hell', 'Lançar no Inferno', 'Hurl Through Hell', 'Ao acertar um ataque, lança o alvo pelos planos inferiores: ele some até o fim do seu próximo turno e, ao voltar, sofre 10d10 de dano psíquico (se não for ínfero). Um uso por descanso longo.'),
      ],
    },
  ],
}
