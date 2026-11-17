import type { DhDomain, DhRange, DhTrait } from '../model/types'

// ────────────────────────────────────────────────────────
// Rótulos e regras de referência do Livro Básico: atributos, alcances, domínios, condições, descansos, morte,
// opções do companheiro animal e sugestões de criação (Experiências e descrição).
// ────────────────────────────────────────────────────────

export const TRAIT_INFO: Record<DhTrait, { label: string; verbs: string[]; text: string }> = {
  agility: { label: 'Agilidade', verbs: ['Correr', 'Saltar', 'Manobrar'], text: 'Você é rápido, ágil em terreno difícil e reage logo ao perigo. Subir numa corda, correr até uma cobertura, pular de telhado em telhado.' },
  strength: { label: 'Força', verbs: ['Erguer', 'Esmagar', 'Agarrar'], text: 'Proezas de força física e vigor: arrombar uma porta, levantar objetos pesados, resistir a uma investida.' },
  finesse: { label: 'Acuidade', verbs: ['Controlar', 'Esconder', 'Consertar'], text: 'Precisão, furtividade e controle absoluto: usar ferramentas delicadas, passar despercebido, atacar com exatidão.' },
  instinct: { label: 'Instinto', verbs: ['Perceber', 'Sentir', 'Orientar-se'], text: 'Percepção do ambiente e intuição natural: sentir perigo, notar detalhes, rastrear um inimigo escorregadio.' },
  presence: { label: 'Presença', verbs: ['Encantar', 'Atuar', 'Enganar'], text: 'Força de personalidade e jeito com as pessoas: defender sua causa, intimidar um inimigo, prender a atenção de uma multidão.' },
  knowledge: { label: 'Conhecimento', verbs: ['Recordar', 'Analisar', 'Compreender'], text: 'Saber coisas que outros não sabem e aplicar a mente: interpretar fatos, enxergar padrões, lembrar informações importantes.' },
}

export const RANGE_INFO: Record<DhRange, { label: string; short: string; text: string }> = {
  melee: { label: 'Corpo a corpo', short: 'Corpo a corpo', text: 'Ao alcance do toque.' },
  muito_proximo: { label: 'Muito próximo', short: 'Muito próx.', text: 'Cerca de 1,5 a 3 metros.' },
  proximo: { label: 'Próximo', short: 'Próximo', text: 'Cerca de 3 a 9 metros: do outro lado de uma sala.' },
  distante: { label: 'Distante', short: 'Distante', text: 'Cerca de 9 a 30 metros: do outro lado de um pequeno campo de batalha.' },
  muito_distante: { label: 'Muito distante', short: 'Muito dist.', text: 'Cerca de 30 a 90 metros: você enxerga o vulto, mas não os detalhes.' },
}

export const RANGE_ORDER: DhRange[] = ['melee', 'muito_proximo', 'proximo', 'distante', 'muito_distante']

export const DOMAINS: Record<DhDomain, { name: string; color: string; text: string }> = {
  arcano: { name: 'Arcano', color: '#7a5ba8', text: 'O domínio da magia inata e instintiva. Quem trilha esse caminho aproveita as forças brutas e enigmáticas dos reinos para manipular a própria energia e os elementos. Poder volátil, mas imenso quando bem canalizado.' },
  lamina: { name: 'Lâmina', color: '#b04646', text: 'O domínio do domínio de armas. Seja pelo aço, pelo arco ou por uma arma mais especializada, quem segue esse caminho sabe cortar a vida dos outros e busca um poder inexorável sobre a morte.' },
  falange: { name: 'Falange', color: '#c0953a', text: 'O domínio da tática e do corpo. Seus praticantes têm um controle incomum das próprias capacidades físicas e um olho para prever o comportamento dos outros em combate.' },
  codice: { name: 'Códice', color: '#3f8f9b', text: 'O domínio do estudo mágico intensivo. Quem busca o saber mágico recorre às equações de poder registradas em livros, pergaminhos, paredes ou até no corpo, tatuadas, e alcança uma compreensão versátil da magia.' },
  graca: { name: 'Graça', color: '#c4678f', text: 'O domínio do carisma. Por histórias arrebatadoras, feitiços encantadores ou um manto de mentiras, quem canaliza esse poder define as realidades dos adversários e dobra a percepção à sua vontade.' },
  meia_noite: { name: 'Meia-noite', color: '#4c5b9c', text: 'O domínio das sombras e do sigilo. Por truques engenhosos, magia sutil ou o manto da noite, seus praticantes dominam a arte da obscuridade e descobrem tesouros escondidos.' },
  sabedoria: { name: 'Sabedoria', color: '#5b8f4a', text: 'O domínio do mundo natural. Quem segue esse caminho desperta o poder desimpedido da terra e de suas criaturas, com o vigor de uma flor desabrochando e a ferocidade de um predador faminto.' },
  esplendor: { name: 'Esplendor', color: '#d1a93a', text: 'O domínio da vida. Seus seguidores aprendem a curar e, até certo ponto, a controlar a morte. Um dom magnífico: tanto dar quanto encerrar a vida.' },
  valor: { name: 'Valor', color: '#cf7a3a', text: 'O domínio da proteção. Seja no ataque ou na defesa, quem escolhe essa disciplina canaliza uma força formidável para proteger os aliados em batalha.' },
}

export const DOMAIN_ORDER: DhDomain[] = ['arcano', 'lamina', 'falange', 'codice', 'graca', 'meia_noite', 'sabedoria', 'esplendor', 'valor']

export const CARD_TYPE_LABEL = { talento: 'Talento', feitico: 'Feitiço', grimorio: 'Grimório' } as const

export const CONDITIONS: { name: string; text: string }[] = [
  { name: 'Escondido', text: 'Enquanto você estiver fora da vista de todos os inimigos e eles não souberem onde você está, testes contra você têm desvantagem. Você deixa de estar Escondido quando um adversário se mover para onde veria você, quando você entrar na linha de visão dele ou quando atacar.' },
  { name: 'Imobilizado', text: 'Você não pode se mover até a condição ser removida, mas ainda pode agir da posição atual.' },
  { name: 'Vulnerável', text: 'Você está em uma posição difícil na cena: derrubado, desequilibrado, pego desprevenido, enfraquecido por magia… Enquanto estiver Vulnerável, todos os testes contra você têm vantagem.' },
]

export const SHORT_REST: { key: string; name: string; text: string }[] = [
  { key: 'tend', name: 'Cuidar dos Ferimentos', text: 'Descreva como você se cura às pressas e recupere Pontos de Vida iguais a 1d4 + seu patamar. Pode ser feito em um aliado.' },
  { key: 'stress', name: 'Aliviar a Fadiga', text: 'Descreva como você extravasa ou se recompõe e recupere Pontos de Fadiga iguais a 1d4 + seu patamar.' },
  { key: 'armor', name: 'Consertar a Armadura', text: 'Descreva como conserta rapidamente sua armadura e recupere Pontos de Armadura iguais a 1d4 + seu patamar. Pode ser feito na armadura de um aliado.' },
  { key: 'prepare', name: 'Preparar-se', text: 'Descreva como você se prepara para o caminho adiante e receba 1 Ponto de Esperança. Se fizer isso com membros do grupo, cada um recebe 2.' },
]

export const LONG_REST: { key: string; name: string; text: string }[] = [
  { key: 'tend', name: 'Cuidar de Todos os Ferimentos', text: 'Descreva como você se cura e recupere todos os Pontos de Vida. Pode ser feito em um aliado.' },
  { key: 'stress', name: 'Aliviar Toda a Fadiga', text: 'Descreva como você extravasa ou se recompõe e recupere todos os Pontos de Fadiga.' },
  { key: 'armor', name: 'Consertar Toda a Armadura', text: 'Descreva como você passa o tempo consertando a armadura e recupere todos os Pontos de Armadura. Pode ser feito na armadura de um aliado.' },
  { key: 'prepare', name: 'Preparar-se', text: 'Descreva como você se prepara para a aventura do dia seguinte e receba 1 Ponto de Esperança. Se fizer isso com membros do grupo, cada um recebe 2.' },
  { key: 'project', name: 'Trabalhar em um Projeto', text: 'Comece ou continue um projeto (decifrar um texto antigo, forjar uma nova arma etc.), normalmente com uma Contagem Regressiva de progresso.' },
]

export const DEATH_MOVES: { key: string; name: string; text: string }[] = [
  { key: 'glory', name: 'Chama de Glória', text: 'Seu personagem abraça a morte e sai em chamas de glória. Faça uma ação (a critério do mestre) que tem sucesso crítico e então atravesse o véu da morte.' },
  { key: 'avoid', name: 'Evitar a Morte', text: 'Seu personagem evita a morte e enfrenta as consequências. Ele fica temporariamente inconsciente e você trabalha com o mestre para descrever como a situação piora. Ele não pode se mover, agir nem ser alvo de ataque, e volta a si quando um aliado recupera 1 ou mais Pontos de Vida dele ou quando o grupo faz um descanso longo. Depois que ele cair inconsciente, role seu Dado de Esperança: se o valor for igual ou menor que o nível do personagem, ele ganha uma cicatriz (risque uma casa de Esperança).' },
  { key: 'risk', name: 'Arriscar Tudo', text: 'Role seus Dados de Dualidade. Se o Dado de Esperança for maior, seu personagem continua de pé e recupera Pontos de Vida ou de Fadiga iguais ao valor do Dado de Esperança (divida como preferir). Se o Dado de Medo for maior, ele atravessa o véu da morte. Em um sucesso crítico, ele continua de pé e recupera todos os Pontos de Vida e de Fadiga.' },
]

export const COMPANION_PICKS: { key: string; name: string; text: string; max?: number }[] = [
  { key: 'inteligente', name: 'Inteligente', text: 'Seu companheiro recebe +1 de bônus permanente em uma Experiência de companheiro à sua escolha.' },
  { key: 'luz', name: 'Luz no Fim do Túnel', text: 'Seu personagem pode marcar 1 Ponto de Esperança adicional.' },
  { key: 'afago', name: 'Afago', text: 'Uma vez por descanso, ao passar um momento de tranquilidade dando carinho e atenção ao seu companheiro, você pode receber 1 Ponto de Esperança ou vocês dois podem recuperar 1 Ponto de Fadiga.' },
  { key: 'blindado', name: 'Blindado', text: 'Quando seu companheiro animal sofrer dano, você pode marcar 1 dos seus Pontos de Armadura em vez de ele marcar 1 Ponto de Fadiga.' },
  { key: 'feroz', name: 'Feroz', text: 'Aumente o dado de dano ou o alcance do seu companheiro em um passo (d6 para d8, próximo para distante etc.).', max: 3 },
  { key: 'resiliente', name: 'Resiliente', text: 'Seu companheiro recebe 1 espaço de Fadiga adicional.', max: 3 },
  { key: 'apegado', name: 'Apegado', text: 'Quando você marcar seu último Ponto de Vida, seu companheiro corre para o seu lado. Role um número de d6 igual aos espaços de Fadiga desmarcados dele e marque-os. Se algum resultado for 6, ele ajuda você a se levantar: recupere seu último Ponto de Vida e volte à cena.' },
  { key: 'atento', name: 'Atento', text: 'Seu companheiro recebe +2 de bônus permanente na Evasão.' },
]

export const EXPERIENCE_EXAMPLES: { label: string; items: string[] }[] = [
  { label: 'Histórias', items: ['Assassino', 'Ferreiro', 'Guarda-costas', 'Caçador de recompensas', 'Chef da família real', 'Artista de circo', 'Vigarista', 'Monarca caído', 'Médico de campo', 'Alta sacerdotisa', 'Mercador', 'Nobre', 'Pirata', 'Político', 'Fugitivo', 'Estudioso', 'Mercenário', 'Soldado', 'Contador de histórias', 'Ladrão', 'Viajante do mundo'] },
  { label: 'Características', items: ['Afável', 'Calejado em batalha', 'Rato de biblioteca', 'Encantador', 'Covarde', 'Amigo de todos', 'Prestativo', 'Presença intimidadora', 'Líder', 'Lobo solitário', 'Leal', 'Observador', 'Brincalhão', 'Língua de prata', 'Dedos leves', 'Teimoso até o fim', 'Sobrevivente', 'Jovem e ingênuo'] },
  { label: 'Especialidades', items: ['Acrobata', 'Jogador', 'Curandeiro', 'Inventor', 'Historiador mágico', 'Cartógrafo', 'Mestre dos disfarces', 'Navegador', 'Atirador de elite', 'Sobrevivencialista', 'Espadachim', 'Estrategista'] },
  { label: 'Perícias', items: ['Sussurrador de animais', 'Barganha', 'Mira mortal', 'Aprendiz rápido', 'Força incrível', 'Mentiroso', 'Pés leves', 'Negociador', 'Memória fotográfica', 'Mãos rápidas', 'Consertos', 'Catador', 'Rastreador'] },
  { label: 'Frases', items: ['Me pega se for capaz', 'Finja até conseguir', 'Na primeira vez dá certo', 'Segurem a linha', 'Não vou decepcionar vocês', 'Eu seguro você', 'Estou com vocês', 'Conhecimento é poder', 'Amigo da natureza', 'Nunca mais', 'Ninguém fica para trás', 'O espetáculo tem que continuar', 'Isto não é uma negociação', 'Lobo em pele de cordeiro'] },
]

export const DESCRIPTION_HINTS: Record<'clothes' | 'eyes' | 'body' | 'skin' | 'attitude', { label: string; items: string[] }> = {
  clothes: { label: 'Roupas', items: ['sempre em movimento', 'extravagantes', 'discretas', 'em camadas', 'ornamentadas', 'justas'] },
  eyes: { label: 'Olhos', items: ['cravo', 'terra', 'oceano sem fim', 'fogo', 'hera', 'lilases', 'noite', 'espuma do mar', 'inverno'] },
  body: { label: 'Corpo', items: ['largo', 'esculpido', 'curvilíneo', 'desengonçado', 'roliço', 'baixo', 'atarracado', 'alto', 'magro', 'miúdo', 'definido'] },
  skin: { label: 'Pele', items: ['cinzas', 'trevo', 'neve caindo', 'areia fina', 'obsidiana', 'rosa', 'safira', 'glicínia'] },
  attitude: { label: 'Atitude', items: ['de celebridade', 'de comandante', 'de político', 'de brincalhão', 'de lobo em pele de cordeiro'] },
}

/** Opções da subida de nível, na ordem do quadro do livro, com o número de casas por patamar. */
export const ADVANCE_OPTIONS = [
  { opt: 'traits', label: 'Receba +1 de bônus em dois atributos desmarcados e marque-os.', slots: { 2: 3, 3: 3, 4: 3 } },
  { opt: 'hp', label: 'Receba permanentemente 1 espaço de Vida.', slots: { 2: 2, 3: 2, 4: 2 } },
  { opt: 'stress', label: 'Receba permanentemente 1 espaço de Fadiga.', slots: { 2: 2, 3: 2, 4: 2 } },
  { opt: 'experiences', label: 'Receba permanentemente +1 de bônus em duas Experiências.', slots: { 2: 1, 3: 1, 4: 1 } },
  { opt: 'domain', label: 'Escolha uma carta de domínio adicional de um domínio que você tenha, do seu nível ou inferior.', slots: { 2: 1, 3: 1, 4: 1 } },
  { opt: 'evasion', label: 'Receba permanentemente +1 de bônus na Evasão.', slots: { 2: 1, 3: 1, 4: 1 } },
  { opt: 'subclass', label: 'Pegue uma carta de subclasse melhorada. Depois, risque a opção de multiclasse deste patamar.', slots: { 3: 1, 4: 1 } },
  { opt: 'proficiency', label: 'Aumente sua Proficiência em +1. (Ocupa as duas escolhas do nível.)', slots: { 3: 1, 4: 1 } },
  { opt: 'multiclass', label: 'Multiclasse: escolha uma classe adicional. (Ocupa as duas escolhas do nível.)', slots: { 3: 1, 4: 1 } },
] as const
