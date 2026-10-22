import type { SubclassDef } from '../types'
import { f } from './helpers'

// ────────────────────────────────────────────────────────
// Subclasses do Livro do Jogador (fora do SRD 5.1): Bárbaro, Bardo e Clérigo.
// Só os nomes e um resumo de cada característica, escrito em palavras nossas.
// ────────────────────────────────────────────────────────

const PHB = 'phb' as const

export const PHB_BARBARIAN: SubclassDef[] = [
  {
    key: 'totem_warrior', name: 'Guerreiro Totêmico', original: 'Path of the Totem Warrior', kind: 'Caminho Primitivo', source: PHB,
    summary: 'Guerreiro ligado ao espírito de um animal, que lhe empresta resistência, olhos de águia ou a força do bando.',
    features: [
      f(3, 'spirit_seeker', 'Buscador de Espíritos', 'Spirit Seeker', 'Você pode conjurar falar com animais e sentido animal como rituais.'),
      f(3, 'totem_spirit', 'Espírito Totêmico', 'Totem Spirit', 'Escolha um totem. Urso: resistência a todo dano, exceto psíquico, enquanto em fúria. Águia: ataques de oportunidade contra você têm desvantagem e você faz Disparada como ação bônus em fúria. Lobo: aliados têm vantagem nos ataques contra criaturas hostis a até 1,5 metro de você em fúria.'),
      f(6, 'aspect_of_the_beast', 'Aspecto da Fera', 'Aspect of the Beast', 'Um benefício do totem. Urso: carga dobrada e vantagem em testes de Força para empurrar, puxar, erguer ou quebrar. Águia: enxerga muito longe e não sofre desvantagem em Percepção na penumbra. Lobo: rastreia com vantagem em ritmo rápido e se move em silêncio em ritmo normal.'),
      f(10, 'spirit_walker', 'Andarilho Espiritual', 'Spirit Walker', 'Você pode conjurar comungar com a natureza como ritual: um espírito de fera o acompanha.'),
      f(14, 'totemic_attunement', 'Sintonia Totêmica', 'Totemic Attunement', 'Um poder do totem enquanto em fúria. Urso: criaturas hostis perto de você têm desvantagem ao atacar outros que não você. Águia: deslocamento de voo igual ao de caminhada. Lobo: com ação bônus, derruba uma criatura Grande ou menor que você acerte.'),
    ],
  },
]

export const PHB_BARD: SubclassDef[] = [
  {
    key: 'valor', name: 'Colégio da Bravura', original: 'College of Valor', kind: 'Colégio de Bardo', source: PHB,
    summary: 'Bardos guerreiros: cantam as façanhas dos heróis e entram na batalha com armadura e armas marciais.',
    features: [
      f(3, 'bonus_proficiencies', 'Proficiências Adicionais', 'Bonus Proficiencies', 'Proficiência com armadura média, escudos e armas marciais.'),
      f(3, 'combat_inspiration', 'Inspiração em Combate', 'Combat Inspiration', 'Quem tem seu dado de Inspiração de Bardo pode somá-lo ao dano de um ataque com arma ou à CA contra um ataque.'),
      f(6, 'extra_attack', 'Ataque Extra', 'Extra Attack', 'Faz dois ataques quando usa a ação Atacar.'),
      f(14, 'battle_magic', 'Magia de Batalha', 'Battle Magic', 'Ao conjurar uma magia com uma ação, você pode fazer um ataque com arma como ação bônus.'),
    ],
  },
]

const domainSpells = (list: string) => f(1, 'domain_spells', 'Magias de Domínio', 'Domain Spells', `Magias sempre preparadas, sem contar no limite: ${list}.`)
const divineStrike = (type: string) => f(8, 'divine_strike', 'Golpe Divino', 'Divine Strike', `Uma vez por turno, ao acertar com arma, causa 1d8 de dano ${type} extra (2d8 a partir do 14º nível).`)

export const PHB_CLERIC: SubclassDef[] = [
  {
    key: 'knowledge', name: 'Domínio do Conhecimento', original: 'Knowledge Domain', kind: 'Domínio Divino', source: PHB,
    summary: 'Divindades do saber, da memória e da verdade: clérigos eruditos, que leem mentes e dominam muitas áreas.',
    features: [
      domainSpells('1º comando e identificação; 3º augúrio e sugestão; 5º não detecção e falar com os mortos; 7º olho arcano e confusão; 9º lenda e vidência'),
      f(1, 'blessings_of_knowledge', 'Bênçãos do Conhecimento', 'Blessings of Knowledge', 'Aprende dois idiomas e fica proficiente em duas entre Arcanismo, História, Natureza e Religião, com o dobro do bônus de proficiência nelas.'),
      f(2, 'knowledge_of_the_ages', 'Canalizar Divindade: Conhecimento das Eras', 'Channel Divinity: Knowledge of the Ages', 'Com uma ação, ganha proficiência em uma perícia ou ferramenta à escolha por 10 minutos.'),
      f(6, 'read_thoughts', 'Canalizar Divindade: Ler Pensamentos', 'Channel Divinity: Read Thoughts', 'Lê os pensamentos superficiais de uma criatura e, depois, pode lançar sugestão nela sem gastar espaço de magia.'),
      f(8, 'potent_spellcasting', 'Conjuração Potente', 'Potent Spellcasting', 'Soma o modificador de Sabedoria ao dano dos seus truques de clérigo.'),
      f(17, 'visions_of_the_past', 'Visões do Passado', 'Visions of the Past', 'Meditando sobre um objeto ou local, recebe visões do que aconteceu ali (a duração depende do nível).'),
    ],
  },
  {
    key: 'light', name: 'Domínio da Luz', original: 'Light Domain', kind: 'Domínio Divino', source: PHB,
    summary: 'Divindades do sol, do fogo e da verdade: clérigos que queimam a escuridão e protegem com clarões.',
    features: [
      domainSpells('1º mãos flamejantes e fogo das fadas; 3º esfera flamejante e raio ardente; 5º luz do dia e bola de fogo; 7º guardião da fé e muralha de fogo; 9º coluna de chamas e vidência'),
      f(1, 'bonus_cantrip', 'Truque Adicional', 'Bonus Cantrip', 'Você conhece o truque luz.'),
      f(1, 'warding_flare', 'Clarão Protetor', 'Warding Flare', 'Reação: impõe desvantagem a um atacante que você veja. Usos iguais ao modificador de Sabedoria, por descanso longo.'),
      f(2, 'radiance_of_the_dawn', 'Canalizar Divindade: Brilho da Aurora', 'Channel Divinity: Radiance of the Dawn', 'Dissipa escuridão mágica a 9 metros e causa 2d10 + nível de dano radiante a criaturas hostis na área (Constituição reduz à metade).'),
      f(6, 'improved_flare', 'Clarão Aprimorado', 'Improved Flare', 'O Clarão Protetor também pode proteger aliados a até 9 metros.'),
      f(8, 'potent_spellcasting', 'Conjuração Potente', 'Potent Spellcasting', 'Soma o modificador de Sabedoria ao dano dos seus truques de clérigo.'),
      f(17, 'corona_of_light', 'Coroa de Luz', 'Corona of Light', 'Por 1 minuto emite luz plena a 18 metros; inimigos na luz têm desvantagem nas salvaguardas contra suas magias de fogo ou radiantes.'),
    ],
  },
  {
    key: 'nature', name: 'Domínio da Natureza', original: 'Nature Domain', kind: 'Domínio Divino', source: PHB,
    summary: 'Divindades da natureza: clérigos de armadura pesada que falam com animais e plantas.',
    features: [
      domainSpells('1º amizade animal e falar com animais; 3º pele de árvore e crescer espinhos; 5º crescimento de plantas e muralha de vento; 7º dominar fera e videira agarradora; 9º praga de insetos e caminhar por árvores'),
      f(1, 'acolyte_of_nature', 'Acólito da Natureza', 'Acolyte of Nature', 'Aprende um truque de druida e fica proficiente em uma entre Adestrar Animais, Natureza e Sobrevivência.'),
      f(1, 'bonus_proficiency', 'Proficiência Adicional', 'Bonus Proficiency', 'Proficiência com armadura pesada.'),
      f(2, 'charm_animals_and_plants', 'Canalizar Divindade: Enfeitiçar Animais e Plantas', 'Channel Divinity: Charm Animals and Plants', 'Com uma ação, animais e plantas à vista precisam passar numa salvaguarda de Sabedoria ou ficam enfeitiçados por 1 minuto.'),
      f(6, 'dampen_elements', 'Abafar Elementos', 'Dampen Elements', 'Reação: você ou uma criatura a 9 metros ganha resistência a dano de ácido, frio, fogo, elétrico ou trovejante.'),
      divineStrike('de frio, fogo ou elétrico (à escolha)'),
      f(17, 'master_of_nature', 'Mestre da Natureza', 'Master of Nature', 'Com uma ação bônus, comanda animais e plantas que estejam enfeitiçados por você.'),
    ],
  },
  {
    key: 'tempest', name: 'Domínio da Tempestade', original: 'Tempest Domain', kind: 'Domínio Divino', source: PHB,
    summary: 'Divindades do trovão, das ondas e do vento: clérigos de armadura pesada que atacam com raios e estrondos.',
    features: [
      domainSpells('1º névoa obscurecente e onda trovejante; 3º lufada de vento e despedaçar; 5º convocar relâmpago e tempestade de granizo; 7º controlar a água e tempestade de gelo; 9º onda destrutiva e praga de insetos'),
      f(1, 'bonus_proficiencies', 'Proficiências Adicionais', 'Bonus Proficiencies', 'Proficiência com armas marciais e armadura pesada.'),
      f(1, 'wrath_of_the_storm', 'Fúria da Tempestade', 'Wrath of the Storm', 'Reação: quando uma criatura a 1,5 metro o acerta, ela faz salvaguarda de Destreza ou sofre 2d8 de dano elétrico ou trovejante (metade se passar). Usos iguais ao modificador de Sabedoria, por descanso longo.'),
      f(2, 'destructive_wrath', 'Canalizar Divindade: Fúria Destruidora', 'Channel Divinity: Destructive Wrath', 'Ao causar dano elétrico ou trovejante, você pode usar o dano máximo em vez de rolar.'),
      f(6, 'thunderbolt_strike', 'Golpe do Relâmpago', 'Thunderbolt Strike', 'Ao causar dano elétrico a uma criatura Grande ou menor, você a empurra até 3 metros.'),
      divineStrike('trovejante'),
      f(17, 'stormborn', 'Nascido da Tempestade', 'Stormborn', 'Ao ar livre e fora de subterrâneos, você tem deslocamento de voo igual ao de caminhada.'),
    ],
  },
  {
    key: 'trickery', name: 'Domínio da Enganação', original: 'Trickery Domain', kind: 'Domínio Divino', source: PHB,
    summary: 'Divindades da astúcia e da malícia: clérigos que enganam com ilusões, furtividade e duplicatas.',
    features: [
      domainSpells('1º enfeitiçar pessoa e disfarçar-se; 3º imagem espelhada e passos sem rastro; 5º piscar e dissipar magia; 7º porta dimensional e polimorfia; 9º dominar pessoa e modificar memória'),
      f(1, 'blessing_of_the_trickster', 'Bênção do Trapaceiro', 'Blessing of the Trickster', 'Com uma ação, dá a uma criatura voluntária vantagem em Furtividade por 1 hora (ou até você repetir).'),
      f(2, 'invoke_duplicity', 'Canalizar Divindade: Invocar Duplicidade', 'Channel Divinity: Invoke Duplicity', 'Cria uma cópia ilusória de você por 1 minuto, com vantagem nos ataques quando você e a cópia estão perto do mesmo alvo.'),
      f(6, 'cloak_of_shadows', 'Canalizar Divindade: Manto de Sombras', 'Channel Divinity: Cloak of Shadows', 'Com uma ação, fica invisível até o fim do seu próximo turno (acaba se atacar ou conjurar).'),
      divineStrike('venenoso'),
      f(17, 'improved_duplicity', 'Duplicidade Aprimorada', 'Improved Duplicity', 'Invocar Duplicidade cria até quatro cópias, que você move como ação bônus.'),
    ],
  },
  {
    key: 'war', name: 'Domínio da Guerra', original: 'War Domain', kind: 'Domínio Divino', source: PHB,
    summary: 'Divindades do combate e da honra: clérigos guerreiros, com armas marciais e armadura pesada.',
    features: [
      domainSpells('1º favor divino e escudo da fé; 3º arma mágica e arma espiritual; 5º manto do cruzado e guardiões espirituais; 7º liberdade de movimento e pele de pedra; 9º coluna de chamas e imobilizar monstro'),
      f(1, 'bonus_proficiencies', 'Proficiências Adicionais', 'Bonus Proficiencies', 'Proficiência com armas marciais e armadura pesada.'),
      f(1, 'war_priest', 'Sacerdote da Guerra', 'War Priest', 'Quando faz a ação Atacar, pode fazer um ataque com arma como ação bônus. Usos iguais ao modificador de Sabedoria, por descanso longo.'),
      f(2, 'guided_strike', 'Canalizar Divindade: Golpe Guiado', 'Channel Divinity: Guided Strike', 'Ao fazer um ataque, soma +10 à jogada de ataque.'),
      f(6, 'war_gods_blessing', 'Canalizar Divindade: Bênção do Deus da Guerra', 'Channel Divinity: War God’s Blessing', 'Reação: dá +10 na jogada de ataque de uma criatura a 9 metros.'),
      divineStrike('do mesmo tipo da arma'),
      f(17, 'avatar_of_battle', 'Avatar da Batalha', 'Avatar of Battle', 'Resistência a dano contundente, perfurante e cortante de armas não mágicas.'),
    ],
  },
]
