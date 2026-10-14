import { STANDARD_ASI_LEVELS } from '../../rules/progression'
import type { ClassDef } from '../types'
import { asiFeatures, byLevel, f } from './helpers'

export const barbarian: ClassDef = {
  key: 'barbarian', name: 'Bárbaro', original: 'Barbarian',
  hitDie: 12,
  primaryAbilities: ['strength'],
  saves: ['strength', 'constitution'],
  skills: { count: 2, from: ['animal_handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
  armor: ['light', 'medium', 'shield'],
  weapons: ['simple', 'martial'],
  tools: [],
  startingEquipment: [
    '(a) um machado grande ou (b) qualquer arma marcial corpo a corpo',
    '(a) dois machados de mão ou (b) qualquer arma simples',
    'Um pacote de explorador e quatro azagaias',
  ],
  summary: 'Guerreiro feroz que entra em fúria: resiste a dano, bate mais forte e aguenta mais pancada que qualquer outro.',
  subclassLevel: 3,
  asiLevels: STANDARD_ASI_LEVELS,
  features: [
    f(1, 'rage', 'Fúria', 'Rage', 'Ação bônus: por 1 minuto você tem vantagem em testes e salvaguardas de Força, soma dano extra nos ataques corpo a corpo com Força e resiste a dano cortante, perfurante e concussão. Não vale com armadura pesada, impede conjurar e concentrar-se, e acaba se você não atacar nem sofrer dano no turno. Os usos voltam no descanso longo.'),
    f(1, 'unarmored_defense', 'Defesa sem Armadura', 'Unarmored Defense', 'Sem armadura, sua CA é 10 + Destreza + Constituição. Escudo pode ser usado.'),
    f(2, 'reckless_attack', 'Ataque Descuidado', 'Reckless Attack', 'No primeiro ataque do turno, você ganha vantagem nos ataques corpo a corpo com Força, mas os ataques contra você têm vantagem até o seu próximo turno.'),
    f(2, 'danger_sense', 'Sentido de Perigo', 'Danger Sense', 'Vantagem em salvaguardas de Destreza contra efeitos que você consiga ver, como armadilhas e magias. Não funciona cego, surdo ou incapacitado.'),
    f(3, 'primal_path', 'Caminho Primitivo', 'Primal Path', 'Escolha o caminho que molda a sua fúria.'),
    ...asiFeatures(STANDARD_ASI_LEVELS),
    f(5, 'extra_attack', 'Ataque Extra', 'Extra Attack', 'Faz dois ataques, em vez de um, quando usa a ação Atacar.'),
    f(5, 'fast_movement', 'Movimento Rápido', 'Fast Movement', '+3 metros de deslocamento se você não usa armadura pesada.'),
    f(7, 'feral_instinct', 'Instinto Selvagem', 'Feral Instinct', 'Vantagem na iniciativa. Se for surpreendido, você pode agir normalmente no primeiro turno, desde que entre em fúria.'),
    f(9, 'brutal_critical_1', 'Crítico Brutal (1 dado)', 'Brutal Critical (1 die)', 'Em um acerto crítico corpo a corpo, role um dado de dano da arma extra.'),
    f(11, 'relentless_rage', 'Fúria Implacável', 'Relentless Rage', 'Se cair a 0 PV em fúria sem morrer na hora, faça salvaguarda de Constituição CD 10: com sucesso você fica com 1 PV. A CD sobe 5 a cada uso seguinte, até um descanso.'),
    f(13, 'brutal_critical_2', 'Crítico Brutal (2 dados)', 'Brutal Critical (2 dice)', 'O Crítico Brutal passa a somar dois dados extras.'),
    f(15, 'persistent_rage', 'Fúria Persistente', 'Persistent Rage', 'A fúria só acaba se você ficar inconsciente ou escolher encerrá-la.'),
    f(17, 'brutal_critical_3', 'Crítico Brutal (3 dados)', 'Brutal Critical (3 dice)', 'O Crítico Brutal passa a somar três dados extras.'),
    f(18, 'indomitable_might', 'Poder Indomável', 'Indomitable Might', 'Se o total de um teste de Força for menor que o seu valor de Força, use o valor no lugar.'),
    f(20, 'primal_champion', 'Campeão Primitivo', 'Primal Champion', 'Força e Constituição sobem 4, e o máximo desses atributos passa a ser 24.'),
  ],
  progression: [
    { key: 'rages', label: 'Fúrias', values: [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 'Ilimitadas'] },
    { key: 'rage_damage', label: 'Dano da Fúria', values: byLevel([[1, 2], [9, 3], [16, 4]]) },
  ],
  multiclass: {
    requirement: { mode: 'all', abilities: ['strength'] },
    gained: { armor: ['shield'], weapons: ['simple', 'martial'], tools: [] },
  },
  subclasses: [
    {
      key: 'berserker', name: 'Caminho do Berserker', original: 'Path of the Berserker', kind: 'Caminho Primitivo',
      summary: 'Fúria pura: golpes extras e uma raiva que ninguém consegue assustar.',
      features: [
        f(3, 'frenzy', 'Frenesi', 'Frenzy', 'Ao entrar em fúria você pode entrar em frenesi: faz um ataque corpo a corpo como ação bônus a cada turno, mas ganha 1 nível de exaustão ao terminar a fúria.'),
        f(6, 'mindless_rage', 'Fúria Cega', 'Mindless Rage', 'Enquanto em fúria, você não pode ser enfeitiçado nem amedrontado, e esses efeitos já ativos ficam suspensos.'),
        f(10, 'intimidating_presence', 'Presença Intimidante', 'Intimidating Presence', 'Ação: amedronta uma criatura a até 9 metros (salvaguarda de Sabedoria, CD 8 + proficiência + Carisma). Pode renovar o efeito com uma ação a cada turno.'),
        f(14, 'retaliation', 'Retaliação', 'Retaliation', 'Quando uma criatura a 1,5 metro de você lhe causa dano, use a reação para fazer um ataque corpo a corpo contra ela.'),
      ],
    },
  ],
}
