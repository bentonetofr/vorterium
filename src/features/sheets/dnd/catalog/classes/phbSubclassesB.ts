import type { SpellcastingProfile } from '../../rules/types'
import type { SubclassDef } from '../types'
import { f } from './helpers'

// ────────────────────────────────────────────────────────
// Subclasses do Livro do Jogador (fora do SRD 5.1): Druida, Guerreiro, Monge,
// Paladino e Patrulheiro. Só os nomes e um resumo de cada característica,
// escrito em palavras nossas.
// ────────────────────────────────────────────────────────

const PHB = 'phb' as const

/** Cavaleiro Místico e Trapaceiro Arcano: conjuradores de um terço (Inteligência, lista do Mago, magias conhecidas). */
export const THIRD_CASTER: SpellcastingProfile = {
  ability: 'intelligence',
  kind: 'third',
  learning: 'known',
  cantripsKnown: [0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  spellsKnown:   [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
}

export const PHB_DRUID: SubclassDef[] = [
  {
    key: 'moon', name: 'Círculo da Lua', original: 'Circle of the Moon', kind: 'Círculo Druídico', source: PHB,
    summary: 'Druidas ferozes, que se transformam em feras poderosas e depois em elementais.',
    features: [
      f(2, 'combat_wild_shape', 'Forma Selvagem em Combate', 'Combat Wild Shape', 'Assume a Forma Selvagem com uma ação bônus e, transformado, pode gastar espaços de magia para recuperar 1d8 PV por nível do espaço.'),
      f(2, 'circle_forms', 'Formas do Círculo', 'Circle Forms', 'Pode assumir feras mais fortes: ND 1 já no 2º nível e, a partir do 6º, ND igual a um terço do seu nível de druida, sem as restrições de voo e natação.'),
      f(6, 'primal_strike', 'Golpe Primal', 'Primal Strike', 'Seus ataques em forma de fera contam como mágicos para vencer resistência e imunidade a dano não mágico.'),
      f(10, 'elemental_wild_shape', 'Forma Selvagem Elemental', 'Elemental Wild Shape', 'Gasta dois usos da Forma Selvagem para virar um elemental do ar, da terra, do fogo ou da água.'),
      f(14, 'thousand_forms', 'Mil Formas', 'Thousand Forms', 'Pode conjurar alterar-se à vontade.'),
    ],
  },
]

export const PHB_FIGHTER: SubclassDef[] = [
  {
    key: 'battle_master', name: 'Mestre de Batalha', original: 'Battle Master', kind: 'Arquétipo Marcial', source: PHB,
    summary: 'Guerreiro tático, que usa dados de superioridade em manobras para controlar o campo de batalha.',
    features: [
      f(3, 'combat_superiority', 'Superioridade em Combate', 'Combat Superiority', 'Aprende três manobras e ganha quatro dados de superioridade (d8), que voltam num descanso curto ou longo. CD das manobras = 8 + proficiência + Força ou Destreza. Mais dados e manobras nos níveis 7, 10 e 15; o dado sobe para d10 no 10º e d12 no 18º.'),
      f(3, 'student_of_war', 'Estudante da Guerra', 'Student of War', 'Proficiência com um tipo de ferramenta de artesão à sua escolha.'),
      f(7, 'know_your_enemy', 'Conheça Seu Inimigo', 'Know Your Enemy', 'Depois de observar uma criatura por 1 minuto, descobre como ela se compara a você em Força, Destreza, Constituição, CA, PV e níveis de classe.'),
      f(10, 'improved_combat_superiority', 'Superioridade em Combate Aprimorada', 'Improved Combat Superiority', 'Os dados de superioridade passam a ser d10 (d12 a partir do 18º nível).'),
      f(15, 'relentless', 'Implacável', 'Relentless', 'Ao rolar iniciativa sem nenhum dado de superioridade, você recupera um.'),
    ],
  },
  {
    key: 'eldritch_knight', name: 'Cavaleiro Místico', original: 'Eldritch Knight', kind: 'Arquétipo Marcial', source: PHB,
    summary: 'Guerreiro que aprende magias de abjuração e evocação para reforçar o combate.',
    spellcasting: THIRD_CASTER, spellList: 'wizard',
    features: [
      f(3, 'spellcasting', 'Conjuração', 'Spellcasting', 'Conjura magias da lista do Mago, com Inteligência, a partir do 3º nível (um terço de conjurador). A maioria das magias é de abjuração e evocação.'),
      f(3, 'weapon_bond', 'Vínculo com Arma', 'Weapon Bond', 'Pode vincular até duas armas: não podem ser desarmadas e voltam à sua mão com uma ação bônus, mesmo à distância.'),
      f(7, 'war_magic', 'Magia de Guerra', 'War Magic', 'Depois de conjurar um truque com uma ação, pode fazer um ataque com arma como ação bônus.'),
      f(10, 'eldritch_strike', 'Golpe Místico', 'Eldritch Strike', 'Ao acertar uma criatura com arma, ela tem desvantagem na próxima salvaguarda contra uma magia sua, até o fim do seu próximo turno.'),
      f(15, 'arcane_charge', 'Carga Arcana', 'Arcane Charge', 'Ao usar o Surto de Ação, teletransporta-se até 9 metros para um espaço que você veja.'),
      f(18, 'improved_war_magic', 'Magia de Guerra Aprimorada', 'Improved War Magic', 'Depois de conjurar qualquer magia com uma ação, pode fazer um ataque com arma como ação bônus.'),
    ],
  },
]

export const PHB_MONK: SubclassDef[] = [
  {
    key: 'shadow', name: 'Caminho das Sombras', original: 'Way of Shadow', kind: 'Tradição Monástica', source: PHB,
    summary: 'Monges que usam a escuridão e o ki para se esgueirar, sumir e surgir de outro canto.',
    features: [
      f(3, 'shadow_arts', 'Artes das Sombras', 'Shadow Arts', 'Gasta 2 pontos de ki para conjurar escuridão, visão no escuro, passos sem rastro ou silêncio; também conhece o truque ilusão menor.'),
      f(6, 'shadow_step', 'Passo das Sombras', 'Shadow Step', 'Com uma ação bônus, teletransporta-se até 18 metros entre áreas de penumbra ou escuridão e tem vantagem no primeiro ataque corpo a corpo depois disso.'),
      f(11, 'cloak_of_shadows', 'Manto de Sombras', 'Cloak of Shadows', 'Com uma ação, fica invisível enquanto estiver em penumbra ou escuridão, até atacar ou conjurar.'),
      f(17, 'opportunist', 'Oportunista', 'Opportunist', 'Reação: ataca uma criatura a 1,5 metro de você que acabou de ser atingida por outra criatura.'),
    ],
  },
  {
    key: 'four_elements', name: 'Caminho dos Quatro Elementos', original: 'Way of the Four Elements', kind: 'Tradição Monástica', source: PHB,
    summary: 'Monges que canalizam o ki em poderes elementais: fogo, água, ar e terra.',
    features: [
      f(3, 'disciple_of_the_elements', 'Discípulo dos Elementos', 'Disciple of the Elements', 'Conhece a disciplina Sintonia Elemental e mais uma à escolha. Gasta pontos de ki para usar as disciplinas, inclusive para conjurar magias elementais. Aprende mais disciplinas nos níveis 6, 11 e 17.'),
      f(6, 'more_disciplines_6', 'Nova Disciplina Elemental (6º)', 'Elemental Discipline', 'Aprende mais uma disciplina elemental.'),
      f(11, 'more_disciplines_11', 'Nova Disciplina Elemental (11º)', 'Elemental Discipline', 'Aprende mais uma disciplina elemental.'),
      f(17, 'more_disciplines_17', 'Nova Disciplina Elemental (17º)', 'Elemental Discipline', 'Aprende mais uma disciplina elemental.'),
    ],
  },
]

export const PHB_PALADIN: SubclassDef[] = [
  {
    key: 'ancients', name: 'Juramento dos Anciões', original: 'Oath of the Ancients', kind: 'Juramento Sagrado', source: PHB,
    summary: 'Paladinos da luz e da vida, que protegem a natureza e a alegria contra a escuridão.',
    features: [
      f(3, 'oath_spells', 'Magias do Juramento', 'Oath Spells', 'Magias sempre preparadas: golpe enredante e falar com animais (3º); raio lunar e passo nebuloso (5º); crescimento de plantas e proteção contra energia (9º); tempestade de gelo e pele de pedra (13º); comunhão com a natureza e caminhar por árvores (17º).'),
      f(3, 'natures_wrath', 'Canalizar Divindade: Fúria da Natureza', 'Channel Divinity: Nature’s Wrath', 'Faz trepadeiras agarrarem uma criatura a 3 metros (salvaguarda de Força ou Destreza) e a deixarem impedida.'),
      f(3, 'turn_the_faithless', 'Canalizar Divindade: Expulsar os Infiéis', 'Channel Divinity: Turn the Faithless', 'Faz fadas e ínferos a 9 metros fugirem de você por 1 minuto, se falharem na salvaguarda de Sabedoria.'),
      f(7, 'aura_of_warding', 'Aura de Proteção', 'Aura of Warding', 'Você e aliados a 3 metros têm resistência a dano de magias (9 metros a partir do 18º nível).'),
      f(15, 'undying_sentinel', 'Sentinela Imortal', 'Undying Sentinel', 'Ao cair a 0 PV sem morrer na hora, fica com 1 PV (uma vez por descanso longo). Você não sofre efeitos de envelhecimento.'),
      f(20, 'elder_champion', 'Campeão Ancestral', 'Elder Champion', 'Por 1 minuto, recupera 10 PV por turno, conjura magias de paladino com ação bônus e impõe desvantagem nas salvaguardas de inimigos próximos contra suas magias.'),
    ],
  },
  {
    key: 'vengeance', name: 'Juramento da Vingança', original: 'Oath of Vengeance', kind: 'Juramento Sagrado', source: PHB,
    summary: 'Paladinos implacáveis, que caçam quem cometeu grandes males sem se importar com o custo.',
    features: [
      f(3, 'oath_spells', 'Magias do Juramento', 'Oath Spells', 'Magias sempre preparadas: praga e marca do caçador (3º); imobilizar pessoa e passo nebuloso (5º); velocidade e proteção contra energia (9º); banimento e porta dimensional (13º); imobilizar monstro e vidência (17º).'),
      f(3, 'abjure_enemy', 'Canalizar Divindade: Abjurar Inimigo', 'Channel Divinity: Abjure Enemy', 'Amedronta uma criatura a 18 metros (salvaguarda de Sabedoria); enquanto amedrontada, seu deslocamento é 0.'),
      f(3, 'vow_of_enmity', 'Canalizar Divindade: Voto de Inimizade', 'Channel Divinity: Vow of Enmity', 'Com uma ação bônus, ganha vantagem nos ataques contra uma criatura a 3 metros por 1 minuto.'),
      f(7, 'relentless_avenger', 'Vingador Implacável', 'Relentless Avenger', 'Ao acertar um ataque de oportunidade, pode se mover até metade do deslocamento, sem provocar novos ataques.'),
      f(15, 'soul_of_vengeance', 'Alma da Vingança', 'Soul of Vengeance', 'Reação: ataca com arma uma criatura sob seu Voto de Inimizade quando ela atacar ou conjurar.'),
      f(20, 'avenging_angel', 'Anjo Vingador', 'Avenging Angel', 'Por 1 hora ganha asas (voo de 18 metros) e uma aura de 9 metros que amedronta inimigos.'),
    ],
  },
]

export const PHB_RANGER: SubclassDef[] = [
  {
    key: 'beast_master', name: 'Mestre das Feras', original: 'Beast Conclave', kind: 'Arquétipo de Patrulheiro', source: PHB,
    summary: 'Patrulheiros com um companheiro animal fiel, que luta ao lado deles.',
    features: [
      f(3, 'rangers_companion', 'Companheiro do Patrulheiro', 'Ranger’s Companion', 'Ganha um animal companheiro de ND 1/4 ou menor e tamanho Médio ou menor, que obedece aos seus comandos e age no seu turno. Ele soma seu bônus de proficiência à CA, aos ataques, ao dano e às salvaguardas e perícias em que for proficiente.'),
      f(7, 'exceptional_training', 'Treinamento Excepcional', 'Exceptional Training', 'Com uma ação bônus, o companheiro pode fazer Disparada, Desengajar, Esquivar ou Ajudar; seus ataques contam como mágicos.'),
      f(11, 'bestial_fury', 'Fúria Bestial', 'Bestial Fury', 'O companheiro faz dois ataques quando usa a ação Atacar.'),
      f(15, 'share_spells', 'Compartilhar Magias', 'Share Spells', 'Magias que você conjura com alvo apenas em você também afetam o companheiro, se ele estiver a 9 metros.'),
    ],
  },
]
