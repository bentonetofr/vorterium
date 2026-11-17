import type { DhFeature, DhRange, DhTier, DhTrait } from '../model/types'

// ────────────────────────────────────────────────────────
// Formas de Fera do druida (Livro Básico, capítulo 1). Cada forma dá bônus em um atributo e na Evasão,
// um ataque próprio (que usa a Proficiência do druida), vantagens em certas ações e habilidades.
// ────────────────────────────────────────────────────────

export interface DhBeastform {
  key: string
  tier: DhTier
  name: string
  examples: string
  trait: DhTrait | null
  traitBonus: number
  evasion: number
  attackRange: DhRange
  attackTrait: DhTrait | null
  /** Dado e bônus do dano (físico), ex.: "d8+2". */
  dice: string
  advantages: string[]
  features: DhFeature[]
  /** Formas especiais (lendárias e míticas) que se baseiam em outras. */
  note?: string
}

const FRAGIL: DhFeature = { name: 'Frágil', text: 'Ao sofrer dano maior ou superior, você sai da Forma de Fera.' }
const BESTA_CARGA = (n: number): DhFeature => ({ name: 'Besta de Carga', text: `Você pode carregar até ${n === 2 ? 'dois' : n === 3 ? 'três' : 'quatro'} aliados voluntários com você enquanto se movimenta.` })
const VISAO_AEREA: DhFeature = { name: 'Visão Aérea', text: 'Você pode voar à vontade. Uma vez por descanso, enquanto estiver no ar, você pode perguntar ao mestre algo sobre a cena abaixo sem precisar de teste. Na primeira vez que um personagem fizer um teste para agir com base nessa informação, ele tem vantagem.' }
const AQUATICO: DhFeature = { name: 'Aquático', text: 'Você pode respirar e se movimentar naturalmente debaixo d’água.' }
const ATAQUE_VORAZ: DhFeature = { name: 'Ataque Voraz', text: 'Quando acertar um ataque contra um alvo, você pode gastar 1 Ponto de Esperança para deixá-lo Vulnerável (temporariamente) e receber +1 de bônus na Proficiência nesse ataque.' }
const PECONHA: string = 'Uma criatura Envenenada sofre 1d10 de dano físico direto cada vez que age.'

export const BEASTFORMS: DhBeastform[] = [
  { key: 'explorador_agil', tier: 1, name: 'Explorador Ágil', examples: 'raposa, camundongo, doninha etc.', trait: 'agility', traitBonus: 1, evasion: 2, attackRange: 'melee', attackTrait: 'agility', dice: 'd4', advantages: ['enganar', 'localizar', 'mover-se furtivamente'], features: [
    { name: 'Ágil', text: 'Seu movimento é silencioso e você pode gastar 1 Ponto de Esperança para se mover até alcance distante sem fazer teste.' }, FRAGIL] },
  { key: 'animal_domestico', tier: 1, name: 'Animal Doméstico', examples: 'cão, coelho, gato etc.', trait: 'instinct', traitBonus: 1, evasion: 2, attackRange: 'melee', attackTrait: 'instinct', dice: 'd6', advantages: ['escalar', 'localizar', 'proteger'], features: [
    { name: 'Companhia', text: 'Ao Ajudar um Aliado, você pode rolar 1d8 como seu dado de vantagem.' }, FRAGIL] },
  { key: 'ruminante_arisco', tier: 1, name: 'Ruminante Arisco', examples: 'cabra, cervo, gazela etc.', trait: 'agility', traitBonus: 1, evasion: 3, attackRange: 'melee', attackTrait: 'agility', dice: 'd6', advantages: ['saltar', 'mover-se furtivamente', 'correr'], features: [
    { name: 'Presa Arisca', text: 'Quando um teste de ataque contra você for ter sucesso, você pode marcar 1 Ponto de Fadiga e rolar 1d4, somando o resultado à sua Evasão contra esse ataque.' }, FRAGIL] },
  { key: 'predador_bando', tier: 1, name: 'Predador de Bando', examples: 'coiote, hiena, lobo etc.', trait: 'strength', traitBonus: 2, evasion: 1, attackRange: 'melee', attackTrait: 'strength', dice: 'd8+2', advantages: ['atacar', 'correr', 'rastrear'], features: [
    { name: 'Golpe Debilitante', text: 'Quando acertar um ataque contra um alvo em alcance corpo a corpo, você pode marcar 1 Ponto de Fadiga para deixá-lo temporariamente Vulnerável.' },
    { name: 'Caça em Bando', text: 'Quando acertar um ataque contra o mesmo alvo de um aliado que agiu imediatamente antes de você, some 1d8 à rolagem de dano.' }] },
  { key: 'explorador_aquatico', tier: 1, name: 'Explorador Aquático', examples: 'enguia, peixe, polvo etc.', trait: 'agility', traitBonus: 1, evasion: 2, attackRange: 'melee', attackTrait: 'agility', dice: 'd4', advantages: ['orientar-se', 'mover-se furtivamente', 'nadar'], features: [AQUATICO, FRAGIL] },
  { key: 'aracnideo_espreitador', tier: 1, name: 'Aracnídeo Espreitador', examples: 'aranha-lobo, tarântula etc.', trait: 'finesse', traitBonus: 1, evasion: 2, attackRange: 'melee', attackTrait: 'finesse', dice: 'd6+1', advantages: ['atacar', 'escalar', 'mover-se furtivamente'], features: [
    { name: 'Picada Peçonhenta', text: `Quando acertar um ataque contra um alvo em alcance corpo a corpo, ele fica temporariamente Envenenado. ${PECONHA}` },
    { name: 'Lança-teia', text: 'Você pode criar um material de teia resistente, útil para explorar e lutar, forte o bastante para sustentar uma criatura. Você pode Imobilizar temporariamente um alvo em alcance próximo se passar em um teste de Acuidade contra ele.' }] },

  { key: 'carapaca_vigilante', tier: 2, name: 'Carapaça Vigilante', examples: 'pangolim, tartaruga, tatu etc.', trait: 'strength', traitBonus: 1, evasion: 1, attackRange: 'melee', attackTrait: 'strength', dice: 'd8+2', advantages: ['cavar', 'localizar', 'proteger'], features: [
    { name: 'Carapaça Reforçada', text: 'Seu exterior endurecido dá resistência a dano físico. Além disso, marque 1 Ponto de Armadura para se recolher na carapaça. Dentro dela, o dano físico sofrido é reduzido em um valor igual à sua Armadura (após aplicar a resistência), mas você não pode realizar outras ações sem sair dessa forma.' },
    { name: 'Canhão Ricochete', text: 'Marque 1 Ponto de Fadiga para que um aliado arremesse você contra um adversário. Para isso, o aliado faz um teste de ataque com Agilidade ou Força (à escolha dele) contra um alvo em alcance próximo. Em um sucesso, o adversário sofre d12+2 de dano físico com a Proficiência do arremessador. Você pode gastar 1 Ponto de Esperança para escolher também um adversário em alcance muito próximo do primeiro; o segundo alvo sofre metade do dano causado ao primeiro.' }] },
  { key: 'fera_poderosa', tier: 2, name: 'Fera Poderosa', examples: 'alce, touro, urso etc.', trait: 'strength', traitBonus: 1, evasion: 3, attackRange: 'melee', attackTrait: 'strength', dice: 'd10+4', advantages: ['orientar-se', 'proteger', 'intimidar'], features: [
    { name: 'Ataque Violento', text: 'Quando tirar 1 em um dado de dano, você pode rolar 1d10 e somar o resultado à rolagem de dano. Além disso, antes de fazer um teste de ataque, você pode marcar 1 Ponto de Fadiga para receber +1 de bônus na Proficiência nesse ataque.' },
    { name: 'Couro Espesso', text: 'Você recebe +2 de bônus nos limiares de dano.' }] },
  { key: 'trotador_robusto', tier: 2, name: 'Trotador Robusto', examples: 'camelo, cavalo, zebra etc.', trait: 'agility', traitBonus: 1, evasion: 2, attackRange: 'melee', attackTrait: 'agility', dice: 'd8+1', advantages: ['saltar', 'orientar-se', 'correr'], features: [
    BESTA_CARGA(2),
    { name: 'Atropelar', text: 'Marque 1 Ponto de Fadiga para se mover em linha reta até alcance próximo e atacar todos os alvos em alcance corpo a corpo da linha. Os alvos em que tiver sucesso sofrem d8+1 de dano físico com sua Proficiência e ficam temporariamente Vulneráveis.' }] },
  { key: 'serpente_traicoeira', tier: 2, name: 'Serpente Traiçoeira', examples: 'cascavel, naja, víbora etc.', trait: 'finesse', traitBonus: 1, evasion: 2, attackRange: 'muito_proximo', attackTrait: 'finesse', dice: 'd8+4', advantages: ['escalar', 'enganar', 'correr'], features: [
    { name: 'Bote Peçonhento', text: `Faça um ataque contra qualquer número de alvos em alcance muito próximo. Em um sucesso, o alvo fica temporariamente Envenenado. ${PECONHA}` },
    { name: 'Silvo de Alerta', text: 'Marque 1 Ponto de Fadiga para forçar qualquer número de alvos em alcance corpo a corpo a recuar para alcance muito próximo.' }] },
  { key: 'predador_furtivo', tier: 2, name: 'Predador Furtivo', examples: 'guepardo, leão, onça etc.', trait: 'instinct', traitBonus: 1, evasion: 3, attackRange: 'melee', attackTrait: 'instinct', dice: 'd8+6', advantages: ['atacar', 'escalar', 'mover-se furtivamente'], features: [
    { name: 'Disparada', text: 'Gaste 1 Ponto de Esperança para se mover até alcance distante sem fazer teste.' },
    { name: 'Abate', text: 'Marque 1 Ponto de Fadiga para se mover até alcance corpo a corpo de um alvo e fazer um teste de ataque contra ele. Em um sucesso, você recebe +2 de bônus na Proficiência nesse ataque e o alvo deve marcar 1 Ponto de Fadiga.' }] },
  { key: 'fera_alada', tier: 2, name: 'Fera Alada', examples: 'coruja, corvo, gavião etc.', trait: 'finesse', traitBonus: 1, evasion: 3, attackRange: 'melee', attackTrait: 'finesse', dice: 'd4+2', advantages: ['enganar', 'localizar', 'intimidar'], features: [
    VISAO_AEREA,
    { name: 'Ossos Ocos', text: 'Você recebe −2 de penalidade nos limiares de dano.' }] },

  { key: 'grande_predador', tier: 3, name: 'Grande Predador', examples: 'lobo-atroz, tigre-dentes-de-sabre, velociraptor etc.', trait: 'strength', traitBonus: 2, evasion: 2, attackRange: 'melee', attackTrait: 'strength', dice: 'd12+8', advantages: ['atacar', 'mover-se furtivamente', 'correr'], features: [BESTA_CARGA(2), ATAQUE_VORAZ] },
  { key: 'lagarto_poderoso', tier: 3, name: 'Lagarto Poderoso', examples: 'crocodilo, jacaré, monstro-de-gila etc.', trait: 'instinct', traitBonus: 2, evasion: 1, attackRange: 'melee', attackTrait: 'instinct', dice: 'd10+7', advantages: ['atacar', 'mover-se furtivamente', 'rastrear'], features: [
    { name: 'Armadura Física', text: 'Você recebe +3 de bônus nos limiares de dano.' },
    { name: 'Golpe Súbito', text: 'Quando acertar um ataque contra um alvo em alcance corpo a corpo, você pode gastar 1 Ponto de Esperança para prendê-lo na mandíbula, deixando-o temporariamente Imobilizado e Vulnerável.' }] },
  { key: 'grande_fera_alada', tier: 3, name: 'Grande Fera Alada', examples: 'águia-gigante, falcão etc.', trait: 'finesse', traitBonus: 2, evasion: 3, attackRange: 'melee', attackTrait: 'finesse', dice: 'd8+6', advantages: ['enganar', 'distrair', 'localizar'], features: [VISAO_AEREA, BESTA_CARGA(2)] },
  { key: 'predador_aquatico', tier: 3, name: 'Predador Aquático', examples: 'golfinho, orca, tubarão etc.', trait: 'agility', traitBonus: 2, evasion: 4, attackRange: 'melee', attackTrait: 'agility', dice: 'd10+6', advantages: ['atacar', 'nadar', 'rastrear'], features: [AQUATICO, ATAQUE_VORAZ] },
  { key: 'fera_lendaria', tier: 3, name: 'Fera Lendária', examples: 'versões aprimoradas das formas de patamar 1', trait: null, traitBonus: 0, evasion: 0, attackRange: 'melee', attackTrait: null, dice: '', advantages: [], features: [
    { name: 'Evoluído', text: 'Escolha uma Forma de Fera de patamar 1 e torne-se uma versão maior e mais poderosa dessa criatura. Enquanto estiver nessa forma, você mantém todos os atributos e habilidades da forma original e recebe:\n• +6 de bônus nas rolagens de dano;\n• +1 de bônus no atributo usado pela forma;\n• +2 de bônus na Evasão.' }], note: 'Aprimora uma forma de patamar 1.' },
  { key: 'hibrido_lendario', tier: 3, name: 'Híbrido Lendário', examples: 'esfinge, grifo etc.', trait: 'strength', traitBonus: 2, evasion: 3, attackRange: 'melee', attackTrait: 'strength', dice: 'd10+8', advantages: [], features: [
    { name: 'Habilidades Híbridas', text: 'Para se transformar nesta criatura, marque 1 Ponto de Fadiga adicional. Escolha duas opções quaisquer de Forma de Fera dos patamares 1 e 2. Escolha um total de quatro vantagens e duas habilidades dessas opções.' }], note: 'Mistura duas formas.' },

  { key: 'fera_massiva', tier: 4, name: 'Fera Massiva', examples: 'elefante, mamute, rinoceronte etc.', trait: 'strength', traitBonus: 3, evasion: 1, attackRange: 'melee', attackTrait: 'strength', dice: 'd12+12', advantages: ['localizar', 'proteger', 'intimidar', 'correr'], features: [
    BESTA_CARGA(4),
    { name: 'Demolir', text: 'Gaste 1 Ponto de Esperança para se mover em linha reta até alcance distante e atacar todos os alvos em alcance corpo a corpo da linha. Os alvos em que tiver sucesso sofrem d8+10 de dano físico e ficam temporariamente Vulneráveis.' },
    { name: 'Impávido', text: 'Você recebe +2 de bônus em todos os limiares de dano.' }] },
  { key: 'lagarto_terrivel', tier: 4, name: 'Lagarto Terrível', examples: 'braquiossauro, tiranossauro etc.', trait: 'strength', traitBonus: 3, evasion: 2, attackRange: 'melee', attackTrait: 'strength', dice: 'd12+10', advantages: ['atacar', 'enganar', 'intimidar', 'rastrear'], features: [
    { name: 'Golpes Devastadores', text: 'Quando causar dano grave a um alvo em alcance corpo a corpo, você pode marcar 1 Ponto de Fadiga para forçá-lo a marcar 1 Ponto de Vida adicional.' },
    { name: 'Disparada Massiva', text: 'Você pode se mover até alcance distante sem fazer teste e ignora terreno difícil (a critério do mestre) por causa do seu tamanho.' }] },
  { key: 'ave_rapina_mortal', tier: 4, name: 'Ave de Rapina Mortal', examples: 'dragão, pterodáctilo, roca, serpe etc.', trait: 'finesse', traitBonus: 3, evasion: 4, attackRange: 'melee', attackTrait: 'finesse', dice: 'd10+11', advantages: ['atacar', 'enganar', 'localizar', 'orientar-se'], features: [
    BESTA_CARGA(3),
    { name: 'Ave de Rapina Mortal', text: 'Você pode voar à vontade e se mover até alcance distante como parte da ação. Ao se mover em linha reta de alcance próximo ou mais longe até alcance corpo a corpo de um alvo e atacá-lo na mesma ação, você pode rolar novamente todos os dados de dano que tirarem resultado menor que sua Proficiência.' }] },
  { key: 'fera_aquatica_epica', tier: 4, name: 'Fera Aquática Épica', examples: 'baleia, lula-gigante etc.', trait: 'agility', traitBonus: 3, evasion: 3, attackRange: 'melee', attackTrait: 'agility', dice: 'd10+10', advantages: ['localizar', 'proteger', 'intimidar', 'rastrear'], features: [
    { name: 'Mestre do Oceano', text: 'Você pode respirar e se movimentar naturalmente debaixo d’água. Quando acertar um ataque contra um alvo em alcance corpo a corpo, você pode deixá-lo temporariamente Imobilizado.' },
    { name: 'Robusto', text: 'Ao marcar 1 Ponto de Armadura, role 1d6. Com resultado 5 ou mais, reduza a gravidade em uma categoria sem marcar o Ponto de Armadura.' }] },
  { key: 'fera_mitica', tier: 4, name: 'Fera Mítica', examples: 'versões aprimoradas das formas de patamar 1 ou 2', trait: null, traitBonus: 0, evasion: 0, attackRange: 'melee', attackTrait: null, dice: '', advantages: [], features: [
    { name: 'Evoluído', text: 'Escolha uma Forma de Fera de patamar 1 ou 2 e torne-se uma versão maior e mais poderosa dessa criatura. Enquanto estiver nessa forma, você mantém todos os atributos e habilidades da forma original e recebe:\n• +9 de bônus nas rolagens de dano;\n• +2 de bônus no atributo usado pela forma;\n• +3 de bônus na Evasão;\n• Seu dado de dano aumenta em um tamanho (d6 vira d8, d8 vira d10 etc.).' }], note: 'Aprimora uma forma de patamar 1 ou 2.' },
  { key: 'hibrido_mitico', tier: 4, name: 'Híbrido Mítico', examples: 'quimera, cocatriz, mantícora etc.', trait: 'strength', traitBonus: 3, evasion: 2, attackRange: 'melee', attackTrait: 'strength', dice: 'd12+10', advantages: [], features: [
    { name: 'Habilidades Híbridas', text: 'Para se transformar nesta criatura, marque 2 Pontos de Fadiga adicionais. Escolha três opções quaisquer de Forma de Fera dos patamares 1 a 3. Escolha um total de cinco vantagens e três habilidades dessas opções.' }], note: 'Mistura três formas.' },
]

export function beastformsUpTo(tier: number): DhBeastform[] {
  return BEASTFORMS.filter((b) => b.tier <= tier)
}

export function beastform(key: string | null | undefined): DhBeastform | undefined {
  return key ? BEASTFORMS.find((b) => b.key === key) : undefined
}
