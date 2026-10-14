import { STANDARD_ASI_LEVELS } from '../../rules/progression'
import type { ClassDef } from '../types'
import { asiFeatures, f } from './helpers'

export const ranger: ClassDef = {
  key: 'ranger', name: 'Patrulheiro', original: 'Ranger',
  hitDie: 10,
  primaryAbilities: ['dexterity', 'wisdom'],
  saves: ['strength', 'dexterity'],
  skills: { count: 3, from: ['animal_handling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
  armor: ['light', 'medium', 'shield'],
  weapons: ['simple', 'martial'],
  tools: [],
  startingEquipment: [
    '(a) cota de escamas ou (b) armadura de couro',
    '(a) duas espadas curtas ou (b) duas armas simples corpo a corpo',
    '(a) um pacote de aventureiro de masmorra ou (b) um pacote de explorador',
    'Um arco longo e uma aljava com 20 flechas',
  ],
  summary: 'Caçador e rastreador das terras selvagens: ataca à distância, conhece o terreno e conjura magias da natureza.',
  subclassLevel: 3,
  asiLevels: STANDARD_ASI_LEVELS,
  spellcasting: {
    ability: 'wisdom', kind: 'half', learning: 'known',
    cantripsKnown: new Array(20).fill(0),
    spellsKnown: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
  },
  features: [
    f(1, 'favored_enemy', 'Inimigo Favorito', 'Favored Enemy', 'Escolha um tipo de inimigo (aberrações, bestas, celestiais, construtos, dragões, elementais, fadas, ínferos, gigantes, monstruosidades, limos, plantas ou mortos-vivos, ou duas raças de humanoides). Vantagem em testes de Sabedoria (Sobrevivência) para rastreá-los e de Inteligência para lembrar sobre eles. Aprende um idioma deles. Mais um inimigo no 6º e no 14º nível.'),
    f(1, 'natural_explorer', 'Explorador Natural', 'Natural Explorer', 'Escolha um tipo de terreno favorito. Nele: em testes de Inteligência e Sabedoria relacionados ao terreno, dobra a proficiência; terreno difícil não atrasa o grupo; não se perde; segue em alerta; forrageia o dobro; avança furtivo sozinho. Mais terrenos no 6º e no 10º nível.'),
    f(2, 'fighting_style', 'Estilo de Luta', 'Fighting Style', 'Escolha um estilo de luta (Arquearia, Defesa, Duelismo ou Combate com Duas Armas).'),
    f(2, 'spellcasting', 'Conjuração', 'Spellcasting', 'Conjura magias de patrulheiro com Sabedoria. Você conhece um número fixo de magias (tabela da classe).'),
    f(3, 'ranger_archetype', 'Arquétipo de Patrulheiro', 'Ranger Archetype', 'Escolha o arquétipo que define o seu estilo de caça.'),
    f(3, 'primeval_awareness', 'Consciência Primitiva', 'Primeval Awareness', 'Ação, gastando um espaço de magia: por 1 minuto por nível do espaço, você sente se há aberrações, celestiais, dragões, elementais, fadas, ínferos e mortos-vivos a 1,6 km (9,6 km em terreno favorito), sem saber onde estão nem quantos são.'),
    ...asiFeatures(STANDARD_ASI_LEVELS),
    f(5, 'extra_attack', 'Ataque Extra', 'Extra Attack', 'Faz dois ataques quando usa a ação Atacar.'),
    f(6, 'favored_enemy_improvement_6', 'Inimigo e Terreno Favoritos Aprimorados', 'Favored Enemy and Natural Explorer improvements', 'Escolha mais um inimigo favorito e mais um terreno favorito.'),
    f(8, 'lands_stride', 'Passos da Terra', 'Land\'s Stride', 'Terreno difícil não mágico não custa movimento extra, e plantas não mágicas não atrapalham. Vantagem contra plantas criadas por magia.'),
    f(10, 'natural_explorer_improvement_10', 'Explorador Natural Aprimorado', 'Natural Explorer improvement', 'Escolha mais um terreno favorito.'),
    f(10, 'hide_in_plain_sight', 'Esconder-se à Plena Vista', 'Hide in Plain Sight', 'Gaste 1 minuto camuflando-se com lama, plantas e outros materiais naturais. Encostado numa superfície sólida do seu tamanho, ganha +10 em testes de Destreza (Furtividade) enquanto não se mover nem agir.'),
    f(14, 'favored_enemy_improvement_14', 'Inimigo Favorito Aprimorado', 'Favored Enemy improvement', 'Escolha mais um inimigo favorito.'),
    f(14, 'vanish', 'Desaparecer', 'Vanish', 'Pode usar a ação Esconder-se como ação bônus e não pode ser rastreado por meios não mágicos, a menos que você deixe rastros de propósito.'),
    f(18, 'feral_senses', 'Sentidos Selvagens', 'Feral Senses', 'Não sofre desvantagem ao atacar criaturas que não vê, e sabe onde estão criaturas invisíveis a 9 metros, desde que não estejam escondidas de você e que você não esteja cego nem surdo.'),
    f(20, 'foe_slayer', 'Matador de Inimigos', 'Foe Slayer', 'Uma vez por turno, soma seu modificador de Sabedoria à rolagem de ataque ou de dano contra um inimigo favorito.'),
  ],
  progression: [],
  multiclass: {
    requirement: { mode: 'all', abilities: ['dexterity', 'wisdom'] },
    gained: { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'], tools: [], skills: { count: 1, from: ['animal_handling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] } },
  },
  subclasses: [
    {
      key: 'hunter', name: 'Caçador', original: 'Hunter', kind: 'Arquétipo de Patrulheiro',
      summary: 'Especialista em derrubar ameaças: gigantes, hordas ou qualquer inimigo que os cerque.',
      features: [
        f(3, 'hunters_prey', 'Presa do Caçador', 'Hunter\'s Prey', 'Escolha uma: Matador de Colosso (+1d8 de dano em alvo ferido, uma vez por turno), Matador de Gigantes (reação para atacar uma criatura Grande ou maior a 1,5 metro que acertar ou errar você) ou Destruidor de Hordas (ataque extra contra outra criatura a 1,5 metro do alvo).'),
        f(7, 'defensive_tactics', 'Táticas Defensivas', 'Defensive Tactics', 'Escolha uma: Escapar da Horda (ataques de oportunidade contra você têm desvantagem), Defesa contra Ataques Múltiplos (quando uma criatura acerta você, ganha +4 de CA contra os outros ataques dela no resto do turno) ou Vontade de Aço (vantagem em salvaguardas contra amedrontado).'),
        f(11, 'hunter_multiattack', 'Ataque Múltiplo', 'Multiattack', 'Escolha uma: Rajada (ataque à distância contra todos a 3 metros de um ponto) ou Ataque Giratório (ataque corpo a corpo contra todos a 1,5 metro).'),
        f(15, 'superior_hunters_defense', 'Defesa Superior do Caçador', 'Superior Hunter\'s Defense', 'Escolha uma: Evasão, Resistir à Maré (reação: quando uma criatura erra você em corpo a corpo, ela repete o mesmo ataque contra outra criatura à sua escolha) ou Esquiva Sobrenatural (reação para reduzir à metade o dano de um ataque que você veja).'),
      ],
    },
  ],
}
