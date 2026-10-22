import type { SubclassDef } from '../types'
import { f } from './helpers'
import { THIRD_CASTER } from './phbSubclassesB'

// ────────────────────────────────────────────────────────
// Subclasses do Livro do Jogador (fora do SRD 5.1): Ladino, Feiticeiro, Bruxo
// e Mago. Só os nomes e um resumo de cada característica, escrito em palavras
// nossas.
// ────────────────────────────────────────────────────────

const PHB = 'phb' as const

export const PHB_ROGUE: SubclassDef[] = [
  {
    key: 'assassin', name: 'Assassino', original: 'Assassin', kind: 'Arquétipo de Ladino', source: PHB,
    summary: 'Ladino de golpes mortais e disfarces, que prepara a emboscada perfeita.',
    features: [
      f(3, 'bonus_proficiencies', 'Proficiências Adicionais', 'Bonus Proficiencies', 'Proficiência com o kit de disfarce e o kit de venenos.'),
      f(3, 'assassinate', 'Assassinar', 'Assassinate', 'Tem vantagem nos ataques contra criaturas que ainda não agiram no combate, e qualquer acerto contra uma criatura surpresa é um acerto crítico.'),
      f(9, 'infiltration_expertise', 'Perícia em Infiltração', 'Infiltration Expertise', 'Pode criar uma identidade falsa gastando 7 dias e 25 po, com histórico e documentos convincentes.'),
      f(13, 'impostor', 'Impostor', 'Impostor', 'Depois de estudar a fala e os modos de alguém por 3 horas, imita voz, escrita e comportamento, com vantagem em Enganação para sustentar o disfarce.'),
      f(17, 'death_strike', 'Golpe Mortal', 'Death Strike', 'Ao acertar uma criatura surpresa, ela faz uma salvaguarda de Constituição (CD 8 + Destreza + proficiência) ou sofre o dobro do dano.'),
    ],
  },
  {
    key: 'arcane_trickster', name: 'Trapaceiro Arcano', original: 'Arcane Trickster', kind: 'Arquétipo de Ladino', source: PHB,
    summary: 'Ladino que mistura furtividade com magias de ilusão e encantamento.',
    spellcasting: THIRD_CASTER, spellList: 'wizard',
    features: [
      f(3, 'spellcasting', 'Conjuração', 'Spellcasting', 'Conjura magias da lista do Mago, com Inteligência, a partir do 3º nível (um terço de conjurador). A maioria das magias é de ilusão e encantamento. Conhece o truque mãos mágicas.'),
      f(3, 'mage_hand_legerdemain', 'Prestidigitação com Mãos Mágicas', 'Mage Hand Legerdemain', 'Sua mão mágica é invisível e pode guardar ou pegar objetos de um recipiente carregado por outra criatura, abrir fechaduras e usar ferramentas de ladrão à distância.'),
      f(9, 'magical_ambush', 'Emboscada Mágica', 'Magical Ambush', 'Se estiver escondido ao conjurar uma magia, o alvo tem desvantagem na salvaguarda contra ela.'),
      f(13, 'versatile_trickster', 'Trapaceiro Versátil', 'Versatile Trickster', 'Com uma ação bônus, usa a mão mágica para distrair uma criatura e ganhar vantagem nos ataques contra ela.'),
      f(17, 'spell_thief', 'Ladrão de Magias', 'Spell Thief', 'Reação: ao ser alvo de uma magia, anula o efeito sobre você e rouba a magia, podendo conjurá-la por 8 horas (uma vez por descanso longo).'),
    ],
  },
]

export const PHB_SORCERER: SubclassDef[] = [
  {
    key: 'wild_magic', name: 'Magia Selvagem', original: 'Wild Magic', kind: 'Origem de Feitiçaria', source: PHB,
    summary: 'Feiticeiros cuja magia nasce do caos: poderosa, imprevisível e às vezes absurda.',
    features: [
      f(1, 'wild_magic_surge', 'Surto de Magia Selvagem', 'Wild Magic Surge', 'Depois de conjurar uma magia de 1º nível ou superior, o Mestre pode pedir um d20; com 1, role na tabela de efeitos de magia selvagem.'),
      f(1, 'tides_of_chaos', 'Marés do Caos', 'Tides of Chaos', 'Uma vez, ganha vantagem em um ataque, teste de habilidade ou salvaguarda. Recarrega num descanso longo ou quando um surto de magia selvagem ocorre.'),
      f(6, 'bend_luck', 'Dobrar a Sorte', 'Bend Luck', 'Reação: gasta 2 pontos de feitiçaria para somar ou subtrair 1d4 na jogada de outra criatura.'),
      f(14, 'controlled_chaos', 'Caos Controlado', 'Controlled Chaos', 'Ao rolar na tabela de magia selvagem, role duas vezes e escolha o resultado.'),
      f(18, 'spell_bombardment', 'Bombardeio de Magias', 'Spell Bombardment', 'Ao tirar o valor máximo num dado de dano de uma magia, role esse dado de novo e some (uma vez por turno).'),
    ],
  },
]

export const PHB_WARLOCK: SubclassDef[] = [
  {
    key: 'archfey', name: 'A Fada Soberana', original: 'The Archfey', kind: 'Patrono Transcendental', source: PHB,
    summary: 'Pacto com um poder do Reino Selvagem: encanto, ilusão e fuga.',
    features: [
      f(1, 'expanded_spell_list', 'Lista de Magias Expandida', 'Expanded Spell List', 'Magias extras para escolher: fogo das fadas e sono (1º); acalmar emoções e força fantasmagórica (2º); piscar e crescimento de plantas (3º); dominar fera e invisibilidade maior (4º); dominar pessoa e aparência enganosa (5º).'),
      f(1, 'fey_presence', 'Presença Feérica', 'Fey Presence', 'Com uma ação, criaturas num cubo de 3 metros fazem salvaguarda de Sabedoria ou ficam enfeitiçadas ou amedrontadas até o fim do seu próximo turno. Volta num descanso curto ou longo.'),
      f(6, 'misty_escape', 'Fuga Nebulosa', 'Misty Escape', 'Reação, ao sofrer dano: fica invisível e se teletransporta até 18 metros, até o início do seu próximo turno. Volta num descanso curto ou longo.'),
      f(10, 'beguiling_defenses', 'Defesas Sedutoras', 'Beguiling Defenses', 'Fica imune a ser enfeitiçado; reação: quando alguém tenta enfeitiçá-lo, a criatura precisa passar numa salvaguarda de Sabedoria ou fica enfeitiçada por você por 1 minuto.'),
      f(14, 'dark_delirium', 'Delírio Sombrio', 'Dark Delirium', 'Com uma ação, uma criatura faz salvaguarda de Sabedoria ou fica enfeitiçada ou amedrontada por 1 minuto, achando que está num reino ilusório. Volta num descanso curto ou longo.'),
    ],
  },
  {
    key: 'great_old_one', name: 'O Grande Antigo', original: 'The Great Old One', kind: 'Patrono Transcendental', source: PHB,
    summary: 'Pacto com uma entidade além da compreensão, que concede poder mental e telepatia.',
    features: [
      f(1, 'expanded_spell_list', 'Lista de Magias Expandida', 'Expanded Spell List', 'Magias extras para escolher: sussurros dissonantes e riso histérico (1º); detectar pensamentos e força fantasmagórica (2º); clarividência e transmitir mensagem (3º); dominar fera e tentáculos negros (4º); dominar pessoa e telecinésia (5º).'),
      f(1, 'awakened_mind', 'Mente Desperta', 'Awakened Mind', 'Comunica-se telepaticamente com qualquer criatura que você veja a até 9 metros, mesmo sem idioma em comum.'),
      f(6, 'entropic_ward', 'Proteção Entrópica', 'Entropic Ward', 'Reação: impõe desvantagem no ataque contra você; se errar, você ganha vantagem no seu próximo ataque contra ele. Volta num descanso curto ou longo.'),
      f(10, 'thought_shield', 'Escudo de Pensamentos', 'Thought Shield', 'Seus pensamentos não podem ser lidos à força, você tem resistência a dano psíquico e quem lhe causa dano psíquico sofre o mesmo dano.'),
      f(14, 'create_thrall', 'Criar Servo', 'Create Thrall', 'Com um toque, enfeitiça um humanoide incapacitado até a magia remover maldição o libertar; vocês se comunicam por telepatia.'),
    ],
  },
]

const savant = (school: string, label: string) =>
  f(2, 'savant', `Sábio da ${label}`, `${school} Savant`, `Gasta metade do ouro e do tempo para copiar magias de ${label.toLowerCase()} no grimório.`)

export const PHB_WIZARD: SubclassDef[] = [
  {
    key: 'abjuration', name: 'Escola de Abjuração', original: 'School of Abjuration', kind: 'Tradição Arcana', source: PHB,
    summary: 'Magos de proteção, que erguem barreiras e anulam magias.',
    features: [
      savant('Abjuration', 'Abjuração'),
      f(2, 'arcane_ward', 'Proteção Arcana', 'Arcane Ward', 'Ao conjurar uma magia de abjuração, cria uma proteção com PV iguais ao dobro do seu nível de mago + Inteligência, que absorve dano. Recarrega num descanso longo ou ao conjurar mais abjuração.'),
      f(6, 'projected_ward', 'Proteção Projetada', 'Projected Ward', 'Reação: sua proteção absorve o dano sofrido por uma criatura a 9 metros.'),
      f(10, 'improved_abjuration', 'Abjuração Aprimorada', 'Improved Abjuration', 'Soma seu bônus de proficiência aos testes de habilidade das magias contramágica e dissipar magia.'),
      f(14, 'spell_resistance', 'Resistência a Magias', 'Spell Resistance', 'Vantagem nas salvaguardas contra magias e resistência a dano de magias.'),
    ],
  },
  {
    key: 'conjuration', name: 'Escola de Conjuração', original: 'School of Conjuration', kind: 'Tradição Arcana', source: PHB,
    summary: 'Magos que invocam criaturas e objetos e deslocam coisas pelo espaço.',
    features: [
      savant('Conjuration', 'Conjuração'),
      f(2, 'minor_conjuration', 'Conjuração Menor', 'Minor Conjuration', 'Cria um objeto não mágico de até 90 cm de lado e 5 kg, que dura 1 hora.'),
      f(6, 'benign_transposition', 'Transposição Benigna', 'Benign Transposition', 'Teletransporta-se até 9 metros ou troca de lugar com uma criatura voluntária. Recarrega num descanso longo ou ao conjurar uma magia de conjuração.'),
      f(10, 'focused_conjuration', 'Conjuração Focada', 'Focused Conjuration', 'Sua concentração numa magia de conjuração não é quebrada por dano.'),
      f(14, 'durable_summons', 'Invocações Duradouras', 'Durable Summons', 'Criaturas que você convoca com conjuração ganham 30 PV temporários.'),
    ],
  },
  {
    key: 'divination', name: 'Escola de Adivinhação', original: 'School of Divination', kind: 'Tradição Arcana', source: PHB,
    summary: 'Magos videntes, que enxergam o que virá e distorcem o destino.',
    features: [
      savant('Divination', 'Adivinhação'),
      f(2, 'portent', 'Prodígio', 'Portent', 'Depois de um descanso longo, rola dois d20 e guarda os resultados; pode trocar uma jogada de ataque, salvaguarda ou teste (sua ou de uma criatura que veja) por um desses valores.'),
      f(6, 'expert_divination', 'Adivinhação Especializada', 'Expert Divination', 'Ao conjurar uma magia de adivinhação de 2º nível ou superior, recupera um espaço de magia de nível menor (até o 5º).'),
      f(10, 'the_third_eye', 'O Terceiro Olho', 'The Third Eye', 'Com uma ação, ganha um benefício à escolha: visão no escuro, visão etérea, compreensão de qualquer idioma ou ver invisível. Volta num descanso curto ou longo.'),
      f(14, 'greater_portent', 'Prodígio Maior', 'Greater Portent', 'O Prodígio passa a usar três d20.'),
    ],
  },
  {
    key: 'enchantment', name: 'Escola de Encantamento', original: 'School of Enchantment', kind: 'Tradição Arcana', source: PHB,
    summary: 'Magos que enfeitiçam e controlam mentes.',
    features: [
      savant('Enchantment', 'Encantamento'),
      f(2, 'hypnotic_gaze', 'Olhar Hipnótico', 'Hypnotic Gaze', 'Com uma ação, enfeitiça uma criatura a 1,5 metro (salvaguarda de Sabedoria): ela fica incapacitada e com deslocamento 0. Cada criatura só pode ser afetada uma vez por descanso longo.'),
      f(6, 'instinctive_charm', 'Charme Instintivo', 'Instinctive Charm', 'Reação: ao ser atacado por uma criatura que você veja, redireciona o ataque para outra criatura (salvaguarda de Sabedoria). Volta num descanso longo.'),
      f(10, 'split_enchantment', 'Encantamento Dividido', 'Split Enchantment', 'Uma magia de encantamento de alvo único pode afetar uma segunda criatura.'),
      f(14, 'alter_memories', 'Alterar Memórias', 'Alter Memories', 'Depois de enfeitiçar uma criatura, você pode fazê-la esquecer que foi enfeitiçada e, com tempo, apagar parte das últimas horas.'),
    ],
  },
  {
    key: 'illusion', name: 'Escola de Ilusão', original: 'School of Illusion', kind: 'Tradição Arcana', source: PHB,
    summary: 'Magos que enganam os sentidos com imagens e sons convincentes.',
    features: [
      savant('Illusion', 'Ilusão'),
      f(2, 'improved_minor_illusion', 'Ilusão Menor Aprimorada', 'Improved Minor Illusion', 'Conhece ilusão menor e pode criar som e imagem com uma só conjuração.'),
      f(6, 'malleable_illusions', 'Ilusões Maleáveis', 'Malleable Illusions', 'Com uma ação, muda a natureza de uma ilusão sua com duração maior que 1 minuto.'),
      f(10, 'illusory_self', 'Eu Ilusório', 'Illusory Self', 'Reação: quando uma criatura o ataca, cria uma duplicata ilusória e o ataque erra automaticamente. Volta num descanso curto ou longo.'),
      f(14, 'illusory_reality', 'Realidade Ilusória', 'Illusory Reality', 'Com uma ação bônus, torna real por 1 minuto um objeto não mágico de uma ilusão sua.'),
    ],
  },
  {
    key: 'necromancy', name: 'Escola de Necromancia', original: 'School of Necromancy', kind: 'Tradição Arcana', source: PHB,
    summary: 'Magos da morte, que drenam vida e comandam mortos-vivos.',
    features: [
      savant('Necromancy', 'Necromancia'),
      f(2, 'grim_harvest', 'Colheita Sombria', 'Grim Harvest', 'Ao matar uma criatura com uma magia de 1º nível ou superior, recupera PV iguais a 2 vezes o nível da magia (3 vezes se for de necromancia). Não funciona com constructos e mortos-vivos.'),
      f(6, 'undead_thralls', 'Servos Mortos-Vivos', 'Undead Thralls', 'Aprende animar mortos; ao conjurá-la, anima um cadáver a mais, e seus mortos-vivos ganham PV extras e somam proficiência ao dano.'),
      f(10, 'inured_to_undeath', 'Imune à Morte-Viva', 'Inured to Undeath', 'Resistência a dano necrótico, e seu máximo de PV não pode ser reduzido.'),
      f(14, 'command_undead', 'Comandar Mortos-Vivos', 'Command Undead', 'Com uma ação, tenta controlar um morto-vivo que você veja a 18 metros (salvaguarda de Carisma).'),
    ],
  },
  {
    key: 'transmutation', name: 'Escola de Transmutação', original: 'School of Transmutation', kind: 'Tradição Arcana', source: PHB,
    summary: 'Magos que modificam a matéria, a forma e as propriedades das coisas.',
    features: [
      savant('Transmutation', 'Transmutação'),
      f(2, 'minor_alchemy', 'Alquimia Menor', 'Minor Alchemy', 'Altera temporariamente o material de um objeto (madeira, pedra, ferro, cobre, prata) de até 30 cm cúbicos, por 10 minutos.'),
      f(6, 'transmuters_stone', 'Pedra do Transmutador', 'Transmuter’s Stone', 'Cria uma pedra que concede um benefício a quem a carrega: visão no escuro, +3 metros de deslocamento, proficiência em salvaguardas de Constituição ou resistência a um tipo de dano.'),
      f(10, 'shapechanger', 'Mudança de Forma', 'Shapechanger', 'Conjura polimorfia em si mesmo, numa fera de ND 1 ou menor, sem gastar espaço de magia. Volta num descanso curto ou longo.'),
      f(14, 'master_transmuter', 'Mestre Transmutador', 'Master Transmuter', 'Consome a Pedra do Transmutador para uma transmutação maior: transmutar matéria, panaceia, restaurar a vida ou restaurar a juventude.'),
    ],
  },
]
