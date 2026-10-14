import { STANDARD_ASI_LEVELS } from '../../rules/progression'
import type { ClassDef } from '../types'
import { asiFeatures, byLevel, f } from './helpers'

export const bard: ClassDef = {
  key: 'bard', name: 'Bardo', original: 'Bard',
  hitDie: 8,
  primaryAbilities: ['charisma'],
  saves: ['dexterity', 'charisma'],
  skills: { count: 3, from: 'any' },
  armor: ['light'],
  weapons: ['simple', 'hand_crossbow', 'longsword', 'rapier', 'shortsword'],
  tools: ['Três instrumentos musicais à escolha'],
  startingEquipment: [
    '(a) uma rapieira, (b) uma espada longa ou (c) qualquer arma simples',
    '(a) um pacote de diplomata ou (b) um pacote de artista',
    '(a) um alaúde ou (b) qualquer outro instrumento musical',
    'Armadura de couro e uma adaga',
  ],
  summary: 'Artista e conjurador versátil: inspira aliados, domina muitas perícias e aprende magias de qualquer lista.',
  subclassLevel: 3,
  asiLevels: STANDARD_ASI_LEVELS,
  spellcasting: {
    ability: 'charisma', kind: 'full', learning: 'known',
    cantripsKnown: byLevel([[1, 2], [4, 3], [10, 4]]),
    spellsKnown: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
  },
  features: [
    f(1, 'spellcasting', 'Conjuração', 'Spellcasting', 'Conjura magias de bardo com Carisma. Você conhece um número fixo de magias (tabela da classe) e usa um instrumento musical como foco.'),
    f(1, 'bardic_inspiration', 'Inspiração de Bardo', 'Bardic Inspiration', 'Ação bônus: uma criatura a até 18 metros que ouça você ganha um dado de Inspiração (d6) por 10 minutos, para somar a um teste, ataque ou salvaguarda. Usos por descanso longo = modificador de Carisma (mínimo 1). O dado vira d8 no 5º, d10 no 10º e d12 no 15º nível.'),
    f(2, 'jack_of_all_trades', 'Pau para Toda Obra', 'Jack of All Trades', 'Soma metade da proficiência (para baixo) em testes de habilidade em que você ainda não soma a proficiência.'),
    f(2, 'song_of_rest', 'Canção de Descanso', 'Song of Rest', 'No descanso curto, quem ouve sua música e gasta dados de vida recupera um dado extra de PV (d6, subindo para d8 no 9º, d10 no 13º e d12 no 17º nível).'),
    f(3, 'bard_college', 'Colégio de Bardo', 'Bard College', 'Escolha o colégio que define o seu estilo.'),
    f(3, 'expertise', 'Especialização', 'Expertise', 'Escolha duas perícias em que é proficiente: o bônus de proficiência delas dobra. No 10º nível, mais duas.'),
    ...asiFeatures(STANDARD_ASI_LEVELS),
    f(5, 'font_of_inspiration', 'Fonte de Inspiração', 'Font of Inspiration', 'Os usos de Inspiração de Bardo voltam também no descanso curto.'),
    f(6, 'countercharm', 'Contramágica', 'Countercharm', 'Ação: até o fim do seu próximo turno, você e os aliados a 9 metros que ouvem você têm vantagem em salvaguardas contra amedrontado e enfeitiçado.'),
    f(10, 'expertise_2', 'Especialização (2ª)', 'Expertise (second)', 'Escolha mais duas perícias para dobrar a proficiência.'),
    f(10, 'magical_secrets', 'Segredos Mágicos', 'Magical Secrets', 'Aprenda duas magias de qualquer classe (de um nível que você consiga conjurar). Mais duas no 14º e duas no 18º nível.'),
    f(14, 'magical_secrets_2', 'Segredos Mágicos (14º)', 'Magical Secrets (14th)', 'Aprenda mais duas magias de qualquer classe.'),
    f(18, 'magical_secrets_3', 'Segredos Mágicos (18º)', 'Magical Secrets (18th)', 'Aprenda mais duas magias de qualquer classe.'),
    f(20, 'superior_inspiration', 'Inspiração Superior', 'Superior Inspiration', 'Ao rolar iniciativa sem nenhum uso de Inspiração de Bardo, você recupera um uso.'),
  ],
  progression: [
    { key: 'inspiration_die', label: 'Dado de Inspiração', values: byLevel([[1, 'd6'], [5, 'd8'], [10, 'd10'], [15, 'd12']]) },
  ],
  multiclass: {
    requirement: { mode: 'all', abilities: ['charisma'] },
    gained: { armor: ['light'], weapons: [], tools: ['Um instrumento musical à escolha'], skills: { count: 1, from: 'any' } },
  },
  subclasses: [
    {
      key: 'lore', name: 'Colégio do Conhecimento', original: 'College of Lore', kind: 'Colégio de Bardo',
      summary: 'Bardos eruditos que colecionam saber de todo tipo e usam a língua afiada contra os inimigos.',
      features: [
        f(3, 'bonus_proficiencies', 'Proficiências Bônus', 'Bonus Proficiencies', 'Proficiência em três perícias à sua escolha.'),
        f(3, 'cutting_words', 'Palavras de Interrupção', 'Cutting Words', 'Reação, gastando um uso de Inspiração: subtrai o dado de Inspiração do ataque, dano ou teste de uma criatura a 18 metros que você veja.'),
        f(6, 'additional_magical_secrets', 'Segredos Mágicos Adicionais', 'Additional Magical Secrets', 'Aprenda duas magias de qualquer classe; elas contam como magias de bardo.'),
        f(14, 'peerless_skill', 'Perícia Inigualável', 'Peerless Skill', 'Ao fazer um teste de habilidade, você pode gastar um uso de Inspiração e somar o dado ao resultado.'),
      ],
    },
  ],
}
