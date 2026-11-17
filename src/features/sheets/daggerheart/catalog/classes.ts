import type { DhClass, DhClassKey } from '../model/types'

// ────────────────────────────────────────────────────────
// As nove classes do Livro Básico, cada uma com dois domínios, duas subclasses (fundamental, especialização e maestria),
// habilidade de Esperança, habilidades de classe e as perguntas do guia do personagem.
// Texto conforme a edição brasileira (Evasão, Pontos de Vida, Pontos de Fadiga = Stress, Pontos de Esperança, Pontos de Armadura).
// ────────────────────────────────────────────────────────

const STD_POTION: [string, string] = ['Poção Menor de Vida (recupera 1d4 Pontos de Vida)', 'Poção Menor de Fadiga (recupera 1d4 Pontos de Fadiga)']

export const CLASSES: DhClass[] = [
  {
    key: 'bardo',
    name: 'Bardo',
    description: 'As pessoas mais carismáticas dos reinos. Bardos se especializam em performance (cantar, tocar, contar histórias ou fazer piadas) e brilham em situações sociais, diante de um público ou de uma só pessoa. Podem unir um grupo, ou rachá-lo se estiverem de mau humor.',
    domains: ['codice', 'graca'],
    evasion: 10,
    hp: 5,
    items: ['Um livro de romance ou uma carta que nunca foi aberta'],
    hopeFeature: { name: 'Fazer uma Cena', text: 'Gaste 3 Pontos de Esperança para distrair temporariamente um alvo em alcance próximo, aplicando uma penalidade de −2 à Dificuldade dele.' },
    features: [
      { name: 'Inspiração', text: 'Uma vez por sessão, descreva como você inspira o grupo e dê a você e a cada aliado um Dado de Inspiração. No nível 1, seu Dado de Inspiração é d6. Um personagem pode gastar o Dado de Inspiração, rolando-o, para somar o resultado a um teste, teste de reação ou rolagem de dano, ou para recuperar Pontos de Fadiga iguais ao resultado. No fim de cada sessão, Dados de Inspiração não utilizados são perdidos.\nNo nível 5, seu Dado de Inspiração aumenta para d8.' },
    ],
    subclasses: [
      {
        key: 'trovador', name: 'Trovador', tagline: 'Seja um trovador para tecer canções que fortalecem seus aliados.', spellcast: 'presence',
        foundation: [{ name: 'Artista Talentoso', text: 'Descreva como você se apresenta para as pessoas. Você pode cantar ou tocar cada canção uma vez por descanso longo:\n• Canção Relaxante: você e todos os aliados em alcance próximo recuperam 1 Ponto de Vida;\n• Canção Épica: deixe um alvo em alcance próximo temporariamente Vulnerável;\n• Canção Comovente: você e todos os aliados em alcance próximo recebem 1 Ponto de Esperança.' }],
        specialization: [{ name: 'Maestro', text: 'Suas canções inspiram coragem em quem as ouve. Ao dar um Dado de Inspiração a um aliado, ele pode receber 1 Ponto de Esperança ou recuperar 1 Ponto de Fadiga.' }],
        mastery: [{ name: 'Virtuoso', text: 'Você está entre os maiores de sua arte e sua perícia não tem limites. Você pode apresentar cada canção de Artista Talentoso duas vezes por descanso longo, em vez de uma.' }],
      },
      {
        key: 'beletrista', name: 'Beletrista', tagline: 'Seja um beletrista para cativar multidões com as palavras.', spellcast: 'presence',
        foundation: [
          { name: 'Discurso Inspirador', text: 'Uma vez por descanso longo, você pode fazer um discurso emocionante e inspirador. Todos os aliados em alcance distante recuperam 2 Pontos de Fadiga.' },
          { name: 'Alma de Poeta', text: 'Depois de fazer um teste para impressionar, persuadir ou ofender alguém, você pode gastar 1 Ponto de Esperança para somar 1d4 à rolagem.' },
        ],
        specialization: [{ name: 'Eloquente', text: 'Suas palavras comoventes elevam o moral. Uma vez por sessão, ao encorajar um aliado, você pode fazer um dos seguintes:\n• Ajudá-lo sem gastar Esperança;\n• Dar a ele um movimento de descanso adicional no próximo descanso;\n• Permitir que ele encontre uma ferramenta ou objeto mundano de que precise.' }],
        mastery: [{ name: 'Poesia Épica', text: 'Seu Dado de Inspiração aumenta para d10. Além disso, ao Ajudar um Aliado, você pode narrar o momento como se escrevesse as memórias do heroísmo dele. Se fizer isso, role 1d10 como seu dado de vantagem.' }],
      },
    ],
    suggested: { traits: { agility: 0, strength: -1, finesse: 1, instinct: 0, presence: 2, knowledge: 1 }, primary: 'rapier', secondary: 'small-dagger', armor: 'gambeson-armor' },
    itemChoices: { potion: STD_POTION, keepsake: ['Um livro de romance', 'Uma carta que nunca foi aberta'], carry: { label: 'Onde você guarda seus feitiços', examples: 'cancioneiro, diário etc.' } },
    background: [
      'Quem da sua comunidade lhe ensinou a ter tanta confiança em si mesmo?',
      'Você já se apaixonou. Quem você amava e como essa pessoa partiu seu coração?',
      'Você sempre admirou outro bardo. Quem é e por que o idolatra?',
    ],
    connections: [
      'O que fez você perceber que seríamos grandes amigos?',
      'O que eu faço que irrita você?',
      'Por que você segura minha mão à noite?',
    ],
  },
  {
    key: 'druida',
    name: 'Druida',
    description: 'Ser druida é mais que uma ocupação: é uma vocação para quem quer proteger e aprender com a magia da natureza. Do trabalho silencioso de cultivar plantas às forças indomáveis da natureza, druidas aprendem a se transformar em feras e a moldar o mundo natural.',
    domains: ['sabedoria', 'arcano'],
    evasion: 10,
    hp: 6,
    items: ['Uma pequena bolsa com ossos e pedras ou um estranho pingente encontrado na terra'],
    hopeFeature: { name: 'Evolução', text: 'Gaste 3 Pontos de Esperança para usar Forma de Fera sem marcar Pontos de Fadiga. Ao fazer isso, aumente um atributo em +1 até sair da Forma de Fera.' },
    features: [
      { name: 'Forma de Fera', text: 'Marque 1 Ponto de Fadiga para se transformar magicamente em uma criatura de patamar igual ou menor que o seu na lista de Formas de Fera. Você pode sair dessa forma a qualquer momento. Enquanto estiver transformado, você não pode usar armas nem conjurar feitiços das cartas de domínio, mas feitiços conjurados antes da transformação permanecem ativos pela duração normal, e você ainda pode falar e usar outras habilidades. Você recebe as habilidades da Forma de Fera, soma o bônus de Evasão dela à sua Evasão e usa o atributo indicado nas estatísticas dela para atacar. Enquanto estiver em Forma de Fera, sua armadura se torna parte do seu corpo e você marca Pontos de Armadura normalmente; ao sair da forma, os Pontos de Armadura marcados continuam marcados. Marcar seu último Ponto de Vida faz você sair da Forma de Fera.' },
      { name: 'Dádiva da Natureza', text: 'Você pode criar à vontade efeitos sutis e inofensivos envolvendo a natureza, como fazer uma flor crescer rapidamente, invocar uma brisa ou acender uma fogueira.' },
    ],
    subclasses: [
      {
        key: 'protetor_elementos', name: 'Protetor dos Elementos', tagline: 'Seja um protetor dos elementos para incorporar as forças primordiais da natureza.', spellcast: 'instinct',
        foundation: [{ name: 'Encarnação Elemental', text: 'Marque 1 Ponto de Fadiga para Canalizar um dos elementos a seguir até sofrer dano grave ou até o próximo descanso:\n• Fogo: quando um adversário em alcance corpo a corpo causar dano a você, ele sofre 1d10 de dano mágico;\n• Terra: receba um bônus nos limiares de dano igual à sua Proficiência;\n• Água: quando você causar dano a um adversário em alcance corpo a corpo, todos os outros adversários em alcance muito próximo devem marcar 1 Ponto de Fadiga;\n• Ar: você pode pairar, recebendo vantagem em testes de Agilidade.' }],
        specialization: [{ name: 'Aura Elemental', text: 'Uma vez por descanso, enquanto estiver Canalizando, você pode manifestar uma aura correspondente ao seu elemento. Ela afeta alvos em alcance próximo até o fim da Canalização.\n• Fogo: quando um adversário marca 1 ou mais Pontos de Vida, ele também deve marcar 1 Ponto de Fadiga;\n• Terra: seus aliados recebem +1 de bônus em Força;\n• Água: quando um adversário causar dano a você, você pode marcar 1 Ponto de Fadiga para movê-lo para qualquer ponto em alcance muito próximo de onde ele está;\n• Ar: quando você ou um aliado sofrer dano de um ataque vindo de fora do alcance corpo a corpo, reduza o dano em 1d8.' }],
        mastery: [{ name: 'Soberania Elemental', text: 'Você incorpora ainda mais seu elemento. Enquanto estiver Canalizando, recebe o benefício a seguir:\n• Fogo: +1 de bônus na Proficiência em ataques e feitiços que causam dano;\n• Terra: ao marcar Pontos de Vida, role 1d6 por Ponto de Vida marcado; para cada resultado 6, reduza em 1 o número de Pontos de Vida marcados;\n• Água: quando um ataque contra você for bem-sucedido, você pode marcar 1 Ponto de Fadiga para deixar o atacante temporariamente Vulnerável;\n• Ar: +1 de bônus na Evasão e você pode voar.' }],
      },
      {
        key: 'protetor_renovacao', name: 'Protetor da Renovação', tagline: 'Seja um protetor da renovação para curar o grupo com poderosos efeitos mágicos.', spellcast: 'instinct',
        foundation: [
          { name: 'Serenidade da Natureza', text: 'Uma vez por descanso longo, você pode criar um espaço de serenidade natural em alcance próximo. Ao passar alguns minutos descansando nesse espaço, recupere Pontos de Fadiga iguais ao seu Instinto, distribuídos como quiser entre você e seus aliados.' },
          { name: 'Regeneração', text: 'Toque uma criatura e gaste 3 Pontos de Esperança. Ela recupera 1d4 Pontos de Vida.' },
        ],
        specialization: [
          { name: 'Presença Curativa', text: 'Você pode usar Regeneração em criaturas em alcance muito próximo.' },
          { name: 'Proteção Druídica', text: 'Uma vez por descanso longo, gaste 2 Pontos de Esperança para que 1d4 aliados em alcance próximo recuperem 2 Pontos de Vida.' },
        ],
        mastery: [{ name: 'Defensor', text: 'Sua transformação animal incorpora um espírito curativo protetor. Quando estiver em Forma de Fera e um aliado em alcance próximo marcar 2 ou mais Pontos de Vida, você pode marcar 1 Ponto de Fadiga para reduzir em 1 o número de Pontos de Vida que ele marca.' }],
      },
    ],
    suggested: { traits: { agility: 1, strength: 0, finesse: 1, instinct: 2, presence: -1, knowledge: 0 }, primary: 'shortstaff', secondary: 'round-shield', armor: 'leather-armor' },
    itemChoices: { potion: STD_POTION, keepsake: ['Uma pequena bolsa com ossos e pedras', 'Um estranho pingente encontrado na terra'] },
    background: [
      'Por que a comunidade em que você cresceu dependia tanto da natureza e de suas criaturas?',
      'Qual foi o primeiro animal selvagem com quem você criou um laço? Por que esse laço terminou?',
      'Quem vem tentando caçar você? O que essa pessoa quer de você?',
    ],
    connections: [
      'O que você me confiou que me faz correr para o perigo por você sempre?',
      'De que animal eu digo que você me lembra?',
      'Que apelido carinhoso você me deu?',
    ],
  },
  {
    key: 'feiticeiro',
    name: 'Feiticeiro',
    description: 'Nem todos os que nascem com magia inata decidem aprimorá-la, mas os que o fazem se tornam feiticeiros poderosos. Os dons passam de geração em geração, e o caminho não é acumular poder, e sim aprender a cultivar e controlar o poder que já se tem.',
    domains: ['arcano', 'meia_noite'],
    evasion: 10,
    hp: 6,
    items: ['Um orbe sussurrante ou uma herança de família'],
    hopeFeature: { name: 'Magia Volátil', text: 'Gaste 3 Pontos de Esperança para rolar novamente uma quantidade qualquer de dados de dano em um ataque que cause dano mágico.' },
    features: [
      { name: 'Sentido Arcano', text: 'Você pode sentir a presença de pessoas e objetos mágicos em alcance próximo.' },
      { name: 'Ilusão Menor', text: 'Faça um teste de conjuração (10). Em um sucesso, você cria uma pequena ilusão visual, não maior que você, em alcance próximo. A ilusão parece convincente para qualquer um em alcance próximo ou mais distante.' },
      { name: 'Canalizar Poder Bruto', text: 'Uma vez por descanso longo, você pode colocar uma carta de domínio da sua mão na reserva e escolher entre:\n• Receber Pontos de Esperança iguais ao nível da carta;\n• Aprimorar um feitiço que cause dano, recebendo um bônus na rolagem de dano igual ao dobro do nível da carta.' },
    ],
    subclasses: [
      {
        key: 'elementalista', name: 'Elementalista', tagline: 'Seja um elementalista para canalizar magia bruta e moldá-la em um elemento específico.', spellcast: 'instinct',
        foundation: [{ name: 'Elementalismo', text: 'Escolha um dos elementos a seguir na criação do personagem: água, ar, fogo, relâmpago ou terra. Você pode moldar esse elemento para causar efeitos inofensivos. Além disso, gaste 1 Ponto de Esperança e descreva como seu controle sobre o elemento ajuda em um teste que está prestes a fazer; então receba +2 de bônus no teste ou +3 de bônus na rolagem de dano dele.' }],
        specialization: [{ name: 'Evasão Natural', text: 'Você pode convocar seu elemento para se proteger. Quando um teste de ataque contra você tiver sucesso, você pode marcar 1 Ponto de Fadiga e descrever como usa o elemento para se defender. Ao fazer isso, role 1d6 e some o resultado à sua Evasão contra esse ataque.' }],
        mastery: [{ name: 'Transcendência', text: 'Uma vez por descanso longo, você pode se transformar em uma manifestação física do seu elemento. Ao fazer isso, descreva a transformação e escolha dois dos benefícios a seguir, que duram até o próximo descanso:\n• +4 de bônus no limiar de dano grave;\n• +1 de bônus em um atributo à sua escolha;\n• +1 de bônus na Proficiência;\n• +2 de bônus na Evasão.' }],
      },
      {
        key: 'primordialista', name: 'Primordialista', tagline: 'Seja um primordialista para estender a versatilidade de seus feitiços de formas poderosas.', spellcast: 'instinct',
        foundation: [{ name: 'Manipular Magia', text: 'Sua herança primordial permite alterar a própria essência da magia. Depois de conjurar um feitiço ou atacar com uma arma que cause dano mágico, você pode marcar 1 Ponto de Fadiga para fazer uma das seguintes coisas:\n• Estender o alcance do feitiço ou ataque em um passo;\n• Receber +2 de bônus no resultado do teste;\n• Dobrar um dado de dano à sua escolha;\n• Atingir um alvo adicional ao alcance.' }],
        specialization: [{ name: 'Auxílio Encantado', text: 'Você pode aprimorar a magia dos outros com sua essência. Ao Ajudar um Aliado em um teste de conjuração, você pode rolar 1d8 como dado de vantagem. Uma vez por descanso longo, depois que um aliado fizer um teste de conjuração com sua ajuda, você pode trocar entre si os resultados dos Dados de Dualidade dele.' }],
        mastery: [{ name: 'Carga Arcana', text: 'Você pode reunir energia mágica para aprimorar suas capacidades. Ao sofrer dano mágico, você fica Carregado. Você também pode gastar 2 Pontos de Esperança para ficar Carregado. Ao acertar um ataque que cause dano mágico enquanto estiver Carregado, você pode descarregar para receber +10 de bônus na rolagem de dano ou +3 de bônus na Dificuldade de um teste de reação que o feitiço force o alvo a fazer. Você deixa de estar Carregado no próximo descanso longo.' }],
      },
    ],
    suggested: { traits: { agility: 0, strength: -1, finesse: 1, instinct: 2, presence: 1, knowledge: 0 }, primary: 'dualstaff', armor: 'gambeson-armor' },
    itemChoices: { potion: STD_POTION, keepsake: ['Um orbe sussurrante', 'Uma herança de família'] },
    background: [
      'O que você fez que deixou as pessoas da sua comunidade desconfiadas de você?',
      'Que mentor ensinou você a controlar sua magia indomada, e por que ele não pode mais guiá-lo?',
      'Você tem um medo profundo que esconde de todos. Qual é, e por que ele assusta você?',
    ],
    connections: [
      'Por que você confia tanto em mim?',
      'O que eu fiz que faz você ter cautela comigo?',
      'Por que mantemos nosso passado em comum em segredo?',
    ],
  },
  {
    key: 'guardiao',
    name: 'Guardião',
    description: 'O título de guardião abrange várias profissões marciais e diz mais sobre a bússola moral e a firmeza do que sobre o modo de lutar. Guardiões lutam com ferocidade notável mesmo contra todas as probabilidades, defendendo seu grupo acima de tudo, e respondem em dobro a quem fere um aliado.',
    domains: ['valor', 'lamina'],
    evasion: 9,
    hp: 7,
    items: ['Um totem do seu mentor ou uma chave secreta'],
    hopeFeature: { name: 'Linha de Frente', text: 'Gaste 3 Pontos de Esperança para recuperar 2 Pontos de Armadura.' },
    features: [
      { name: 'Determinação', text: 'Uma vez por descanso longo, você pode ficar Determinado e receber um Dado de Determinação. No nível 1, ele é d4. Coloque-o no espaço da ficha com o número 1 voltado para cima. Depois de fazer uma rolagem de dano que tire 1 ou mais Pontos de Vida de um alvo, aumente o valor do Dado de Determinação em 1. Quando o dado fosse ultrapassar o valor máximo, ou quando a cena acabar, remova-o e encerre a Determinação. No nível 5, o Dado de Determinação aumenta para d6.\nEnquanto estiver Determinado, você recebe os benefícios a seguir:\n• Reduz a gravidade do dano físico em uma categoria (grave para maior, maior para menor, menor para nenhum);\n• Soma o valor atual do Dado de Determinação às suas rolagens de dano;\n• Não pode ser Imobilizado nem ficar Vulnerável.\nDica: se o Dado de Determinação é d4 e o 4 está voltado para cima, remova o dado na próxima vez que fosse aumentá-lo. Se ele já virou d6 e o 4 está para cima, mude o número para 5; você só o remove quando precisar aumentá-lo além de 6.' },
    ],
    subclasses: [
      {
        key: 'baluarte', name: 'Baluarte', tagline: 'Seja um baluarte para continuar lutando mesmo após sofrer pesados golpes.', spellcast: null,
        foundation: [
          { name: 'Resoluto', text: 'Receba +1 de bônus permanente nos limiares de dano.' },
          { name: 'Vontade de Ferro', text: 'Ao sofrer dano físico, você pode marcar 1 Ponto de Armadura adicional para reduzir a gravidade.' },
        ],
        specialization: [
          { name: 'Irrefreável', text: 'Receba +2 de bônus permanente nos limiares de dano.' },
          { name: 'Irmãos de Armas', text: 'Quando um aliado em alcance muito próximo sofrer dano, você pode marcar 1 Ponto de Armadura para reduzir a gravidade em uma categoria.' },
        ],
        mastery: [
          { name: 'Impávido', text: 'Receba +3 de bônus permanente nos limiares de dano.' },
          { name: 'Protetor Leal', text: 'Quando um aliado em alcance próximo tiver 2 ou menos Pontos de Vida e for sofrer dano, você pode marcar 1 Ponto de Fadiga para correr até ele e sofrer o dano no lugar.' },
        ],
      },
      {
        key: 'vingador', name: 'Vingador', tagline: 'Seja um vingador para subjugar as ameaças contra você ou seus aliados.', spellcast: null,
        foundation: [
          { name: 'Vem Tranquilo', text: 'Receba 1 espaço de Fadiga adicional.' },
          { name: 'Revanche', text: 'Quando um adversário em alcance corpo a corpo acertar um ataque contra você, você pode marcar 2 Pontos de Fadiga para forçar o atacante a marcar 1 Ponto de Vida.' },
        ],
        specialization: [{ name: 'Represália', text: 'Quando um adversário causar dano a um aliado em alcance corpo a corpo, você recebe +1 de bônus na Proficiência no próximo ataque bem-sucedido que fizer contra esse adversário.' }],
        mastery: [{ name: 'Nêmesis', text: 'Gaste 2 Pontos de Esperança para Priorizar um adversário até o próximo descanso. Ao atacar o adversário Priorizado, você pode trocar entre si os resultados dos seus Dados de Esperança e de Medo. Você só pode Priorizar um adversário por vez.' }],
      },
    ],
    suggested: { traits: { agility: 1, strength: 2, finesse: -1, instinct: 0, presence: 1, knowledge: 0 }, primary: 'battleaxe', armor: 'chainmail-armor' },
    itemChoices: { potion: STD_POTION, keepsake: ['Um totem do seu mentor', 'Uma chave secreta'] },
    background: [
      'Quem da sua comunidade você não conseguiu proteger, e por que ainda pensa nessa pessoa?',
      'Você foi encarregado de proteger algo importante e levá-lo a um lugar perigoso. O que é, e para onde precisa ir?',
      'Você considera um aspecto seu uma fraqueza. Qual é, e como isso afetou você?',
    ],
    connections: [
      'Como eu salvei sua vida na primeira vez que nos encontramos?',
      'Que pequeno presente você me deu que percebe que eu sempre carrego comigo?',
      'Que mentira você me contou sobre si mesmo em que eu acredito totalmente?',
    ],
  },
  {
    key: 'guerreiro',
    name: 'Guerreiro',
    description: 'Tornar-se guerreiro exige anos, muitas vezes uma vida, de treino e dedicação ao domínio das armas e da violência. Guerreiros entendem a importância de um corpo e uma mente ágeis, e costumam ter uma arma favorita; interpor-se entre eles e sua lâmina é um erro grave.',
    domains: ['lamina', 'falange'],
    evasion: 11,
    hp: 6,
    items: ['O desenho de alguém que ama ou uma pedra de amolar'],
    hopeFeature: { name: 'Sem Piedade', text: 'Gaste 3 Pontos de Esperança para receber +1 de bônus em testes de ataque até o próximo descanso.' },
    features: [
      { name: 'Ataque de Oportunidade', text: 'Se um adversário em alcance corpo a corpo tentar sair desse alcance, faça um teste de reação usando um atributo à sua escolha contra a Dificuldade dele. Em um sucesso, escolha um efeito; em um sucesso crítico, escolha dois:\n• Ele não pode sair de onde está;\n• Você causa dano a ele igual ao dano da sua arma principal;\n• Você se movimenta com ele.' },
      { name: 'Treinamento de Combate', text: 'Você ignora o tipo de empunhadura (o peso) das armas equipadas. Ao causar dano físico, você recebe um bônus na rolagem de dano igual ao seu nível.' },
    ],
    subclasses: [
      {
        key: 'escolhido_bravura', name: 'Escolhido da Bravura', tagline: 'Seja um escolhido da bravura para se alimentar da força de seus inimigos.', spellcast: null,
        foundation: [
          { name: 'Coragem', text: 'Ao falhar com Medo, receba 1 Ponto de Esperança.' },
          { name: 'Ritual de Batalha', text: 'Uma vez por descanso longo, antes de tentar algo muito perigoso ou enfrentar um oponente que claramente supera você, descreva o ritual que faz ou os preparativos. Ao fazer isso, recupere 2 Pontos de Fadiga e receba 2 Pontos de Esperança.' },
        ],
        specialization: [{ name: 'Enfrentar o Desafio', text: 'Você se mantém vigilante diante do perigo crescente. Enquanto tiver 2 ou menos Pontos de Vida desmarcados, você pode rolar 1d20 como seu Dado de Esperança.' }],
        mastery: [{ name: 'Camaradagem', text: 'Sua bravura inabalável é um ponto de apoio para seus aliados. Você pode iniciar um Teste em Dupla adicional por sessão. Além disso, quando um aliado iniciar um Teste em Dupla com você, ele só precisa gastar 2 Pontos de Esperança.' }],
      },
      {
        key: 'escolhido_matanca', name: 'Escolhido da Matança', tagline: 'Seja um escolhido da matança para derrubar os adversários com força descomunal.', spellcast: null,
        foundation: [{ name: 'Matança', text: 'Você tem uma reserva de dados chamada Dados da Matança. Ao rolar com Esperança, você pode colocar 1d6 nesta carta em vez de receber 1 Ponto de Esperança, somando o dado à reserva. Você pode guardar um número de Dados da Matança igual à sua Proficiência. Ao fazer um teste de ataque ou rolagem de dano, você pode gastar qualquer número desses dados, rolando-os e somando o resultado. No fim de cada sessão, remova os Dados da Matança não utilizados desta carta e receba 1 Ponto de Esperança por dado removido.' }],
        specialization: [{ name: 'Especialista em Armas', text: 'Você empunha várias armas com facilidade perigosa. Ao acertar um ataque, você pode gastar 1 Ponto de Esperança para somar à rolagem de dano um dos dados de dano da sua arma secundária. Além disso, uma vez por descanso longo, ao rolar seus Dados da Matança, role novamente qualquer resultado 1.' }],
        mastery: [{ name: 'Preparação Marcial', text: 'Você é um guerreiro inspirador para todos que viajam com você. Seu grupo ganha acesso ao movimento de descanso Preparação Marcial. Para usá-lo durante um descanso, descreva como você instrui e treina com seu grupo. Você e cada aliado que escolher esse movimento recebem um Dado da Matança d6. Um personagem com um Dado da Matança pode gastá-lo, rolando-o e somando o resultado a um teste de ataque ou rolagem de dano à sua escolha.' }],
      },
    ],
    suggested: { traits: { agility: 2, strength: 1, finesse: 0, instinct: 1, presence: -1, knowledge: 0 }, primary: 'longsword', armor: 'chainmail-armor' },
    itemChoices: { potion: STD_POTION, keepsake: ['O desenho de alguém que você ama', 'Uma pedra de amolar'] },
    background: [
      'Quem ensinou você a lutar, e por que ficou para trás quando você saiu de casa?',
      'Alguém derrotou você em batalha anos atrás e o deixou para morrer. Quem foi, e como traiu você?',
      'Que lugar lendário você sempre quis visitar, e por que ele é tão especial?',
    ],
    connections: [
      'Nós nos conhecíamos muito antes de este grupo se formar. Como?',
      'Que tarefa mundana você costuma me ajudar a fazer fora do campo de batalha?',
      'Que medo eu estou ajudando você a superar?',
    ],
  },
  {
    key: 'ladino',
    name: 'Ladino',
    description: 'Ladinos são malandros, tanto na atitude quanto na prática. Conhecidos como mentirosos e ladrões, os melhores se movem pelo mundo no anonimato. Usando sagacidade e lâminas, enganam com manipulação social tão facilmente quanto arrombam fechaduras, escalam janelas ou desferem golpes baixos.',
    domains: ['graca', 'meia_noite'],
    evasion: 12,
    hp: 6,
    items: ['Ferramentas de falsificação ou um arpéu'],
    hopeFeature: { name: 'Esquiva de Ladino', text: 'Gaste 3 Pontos de Esperança para receber +2 de bônus na Evasão até a próxima vez que um ataque for bem-sucedido contra você. Caso isso não aconteça, o bônus dura até o próximo descanso.' },
    features: [
      { name: 'Oculto', text: 'Sempre que você ficaria Escondido, em vez disso fica Oculto. Além dos benefícios da condição Escondido, enquanto estiver Oculto você permanece sem ser visto, desde que fique parado, mesmo que um adversário se mova para onde normalmente o veria. Depois de atacar ou de terminar um movimento dentro da linha de visão de um adversário, você deixa de estar Oculto.' },
      { name: 'Ataque Furtivo', text: 'Ao acertar um ataque enquanto estiver Oculto, ou enquanto um aliado estiver em alcance corpo a corpo do seu alvo, some à rolagem de dano um número de d6 igual ao seu patamar.\nNível 1 → patamar 1; níveis 2 a 4 → patamar 2; níveis 5 a 7 → patamar 3; níveis 8 a 10 → patamar 4.' },
    ],
    subclasses: [
      {
        key: 'gatuno', name: 'Gatuno', tagline: 'Seja um gatuno para manipular as sombras e se esgueirar pelo ambiente.', spellcast: 'finesse',
        foundation: [{ name: 'Passo Sombrio', text: 'Você pode se movimentar de uma sombra para outra. Ao entrar em uma área de escuridão ou na sombra projetada por outra criatura ou objeto, você pode marcar 1 Ponto de Fadiga para desaparecer de onde está e reaparecer dentro de outra sombra em alcance distante. Ao reaparecer, você fica Oculto.' }],
        specialization: [
          { name: 'Nuvem de Escuridão', text: 'Faça um teste de conjuração (15). Em um sucesso, você cria uma nuvem de escuridão temporária que cobre qualquer área em alcance próximo. Quem está na nuvem não enxerga fora dela, e quem está fora não enxerga dentro. Você é considerado Oculto para qualquer adversário cuja linha de visão a nuvem bloqueie.' },
          { name: 'Adrenalina', text: 'Enquanto estiver Vulnerável, some seu nível às suas rolagens de dano.' },
        ],
        mastery: [
          { name: 'Sombra Fugaz', text: 'Receba +1 de bônus permanente na Evasão. Você pode usar Passo Sombrio para se mover até alcance muito distante.' },
          { name: 'Desaparecimento', text: 'Marque 1 Ponto de Fadiga para ficar Oculto a qualquer momento. Enquanto estiver Oculto por esta habilidade, você remove automaticamente a condição Imobilizado, se a tiver. Você permanece Oculto assim até rolar com Medo ou até o próximo descanso.' },
        ],
      },
      {
        key: 'mafioso', name: 'Mafioso', tagline: 'Seja um mafioso para ter uma rede de contatos onde quer que vá.', spellcast: 'finesse',
        foundation: [{ name: 'Conexões', text: 'Ao chegar a uma cidade ou lugar importante, você conhece alguém que mora ali. Dê um nome a essa pessoa, anote como acha que ela pode ser útil e escolha um fato da lista:\n• Ela me deve um favor, mas será difícil de encontrar;\n• Ela vai pedir algo em troca;\n• Ela está sempre em grandes apuros;\n• Nós já fomos um casal. É uma longa história;\n• Não nos despedimos em bons termos.' }],
        specialization: [{ name: 'Contatos', text: 'Uma vez por sessão, você pode convocar brevemente um contato escuso. Escolha um dos benefícios a seguir e descreva o que o trouxe até aqui para ajudar:\n• Ele fornece 1 punhado de ouro, uma ferramenta única ou um objeto mundano de que a situação precise;\n• No seu próximo teste, a ajuda dele dá +3 de bônus no resultado do seu Dado de Esperança ou do Dado de Medo;\n• Na próxima vez que você causar dano, ele atira das sombras, somando 2d8 à sua rolagem de dano.' }],
        mastery: [{ name: 'Reforços Confiáveis', text: 'Você pode usar Contatos três vezes por sessão. As opções a seguir são adicionadas à lista de benefícios que você pode escolher:\n• Quando você marcar 1 ou mais Pontos de Vida, ele sai correndo para protegê-lo, reduzindo em 1 os Pontos de Vida marcados;\n• Ao fazer um teste de Presença em uma conversa, ele apoia você. Você pode rolar 1d20 como seu Dado de Esperança.' }],
      },
    ],
    suggested: { traits: { agility: 1, strength: -1, finesse: 2, instinct: 0, presence: 1, knowledge: 0 }, primary: 'dagger', secondary: 'small-dagger', armor: 'gambeson-armor' },
    itemChoices: { potion: STD_POTION, keepsake: ['Ferramentas de falsificação', 'Um arpéu'] },
    background: [
      'O que você fez ao ser pego que o levou a ser exilado da sua comunidade?',
      'Você tinha outra vida, mas tentou deixá-la para trás. Quem do seu passado ainda persegue você?',
      'De quem do seu passado foi mais triste se despedir?',
    ],
    connections: [
      'O que eu convenci você a fazer recentemente que nos meteu em encrenca?',
      'O que eu descobri sobre o seu passado e guardo em segredo dos outros?',
      'Quem do meu passado você conhece, e como essa pessoa influenciou o que você sente por mim?',
    ],
  },
  {
    key: 'mago',
    name: 'Mago',
    description: 'Por meio de uma instituição ou de estudo individual, magos adquirem e aprimoram imenso poder mágico ao longo de anos, usando livros, pedras, poções e ervas. Muitos se tornam figuras sábias que aconselham governantes, produzem remédios ou lideram conselhos de guerra, mas costumam travar suas maiores disputas entre si: guardar e compartilhar segredos poderosos é tema de debates mortais.',
    domains: ['codice', 'esplendor'],
    evasion: 11,
    hp: 5,
    items: ['Um livro que você está tentando traduzir ou um pequeno elemental de estimação inofensivo'],
    hopeFeature: { name: 'Não Dessa Vez', text: 'Gaste 3 Pontos de Esperança para forçar um adversário em alcance distante ou mais próximo a refazer um teste de ataque ou rolagem de dano.' },
    features: [
      { name: 'Prestidigitação', text: 'Você pode executar efeitos mágicos sutis e inofensivos à vontade. Por exemplo, mudar a cor de um objeto, criar um cheiro, acender uma vela, fazer um pequeno objeto flutuar, iluminar uma sala ou consertar um objeto pequeno.' },
      { name: 'Padrões Estranhos', text: 'Escolha um número de 1 a 12. Ao rolar esse número em um Dado de Dualidade, receba 1 Ponto de Esperança ou recupere 1 Ponto de Fadiga. Você pode mudar o número escolhido durante um descanso longo.' },
    ],
    subclasses: [
      {
        key: 'disc_conhecimento', name: 'Discípulo do Conhecimento', tagline: 'Seja um discípulo do conhecimento para ter uma profunda compreensão do mundo.', spellcast: 'knowledge',
        foundation: [
          { name: 'Promissor', text: 'Pegue uma carta de domínio adicional, do seu nível ou inferior, de um domínio ao qual você tenha acesso.' },
          { name: 'Adepto', text: 'Ao usar uma Experiência, você pode marcar 1 Ponto de Fadiga em vez de gastar 1 Ponto de Esperança. Se fizer isso, dobre o modificador da Experiência nessa jogada.' },
        ],
        specialization: [
          { name: 'Talentoso', text: 'Pegue uma carta de domínio adicional, do seu nível ou inferior, de um domínio ao qual você tenha acesso.' },
          { name: 'Troca Perfeita', text: 'Uma vez por descanso, ao trazer uma carta de domínio da sua reserva, você pode reduzir o custo de troca dela em 1.' },
        ],
        mastery: [
          { name: 'Brilhante', text: 'Pegue uma carta de domínio adicional, do seu nível ou inferior, de um domínio ao qual você tenha acesso.' },
          { name: 'Bem Vivido', text: 'Ao usar uma Experiência, role 1d6. Com resultado 5 ou mais, você pode usá-la sem gastar Pontos de Esperança.' },
        ],
      },
      {
        key: 'disc_guerra', name: 'Discípulo da Guerra', tagline: 'Seja um discípulo da guerra para usar seu treinamento mágico para a violência.', spellcast: 'knowledge',
        foundation: [
          { name: 'Mago de Batalha', text: 'Você concentrou seus estudos em se tornar uma força insuperável no campo de batalha. Receba 1 espaço de Vida adicional.' },
          { name: 'Encare o Medo', text: 'Ao ter sucesso com Medo em um teste de ataque, você causa 1d10 de dano mágico adicional.' },
        ],
        specialization: [
          { name: 'Conjurar Escudo', text: 'Você consegue manter uma barreira mágica protetora. Enquanto tiver ao menos 2 Pontos de Esperança, some sua Proficiência à sua Evasão.' },
          { name: 'Movido por Medo', text: 'O dano mágico adicional de Encare o Medo aumenta para 2d10.' },
        ],
        mastery: [
          { name: 'Triunfo do Caos', text: 'Ao ter sucesso em um ataque, você pode marcar 1 Ponto de Fadiga depois de rolar o dano para forçar o alvo a marcar 1 Ponto de Vida adicional.' },
          { name: 'Não Tenha Medo', text: 'O dano mágico adicional de Encare o Medo aumenta para 3d10.' },
        ],
      },
    ],
    suggested: { traits: { agility: -1, strength: 0, finesse: 0, instinct: 1, presence: 1, knowledge: 2 }, primary: 'greatstaff', armor: 'leather-armor' },
    itemChoices: { potion: STD_POTION, keepsake: ['Um livro que você está tentando traduzir', 'Um pequeno elemental de estimação inofensivo'], carry: { label: 'Onde você guarda seus feitiços', examples: 'grandes tomos, cartas de tarô etc.' } },
    background: [
      'Que responsabilidades sua comunidade esperava de você? Como você a decepcionou?',
      'Você passou a vida procurando um livro ou objeto de grande importância. O que é, e por que é tão importante para você?',
      'Você tem um rival poderoso. Quem é, e por que está tão determinado a derrotá-lo?',
    ],
    connections: [
      'Que favor eu pedi a você que você não tem certeza de conseguir cumprir?',
      'Que hobby estranho ou fascinação esquisita nós dois compartilhamos?',
      'Que segredo sobre si mesmo você confiou só a mim?',
    ],
  },
  {
    key: 'patrulheiro',
    name: 'Patrulheiro',
    description: 'Patrulheiros são caçadores altamente habilidosos que, apesar da perícia marcial, raramente emprestam suas habilidades a um exército. Com domínio do corpo e profundo conhecimento da natureza, tornam-se estrategistas astutos que perseguem a presa com paciência. Muitos caçam ao lado de um companheiro animal com quem têm um laço espiritual.',
    domains: ['falange', 'sabedoria'],
    evasion: 12,
    hp: 6,
    items: ['Um troféu do seu primeiro abate ou uma bússola aparentemente quebrada'],
    hopeFeature: { name: 'Segurem Eles', text: 'Quando acertar um ataque com uma arma, gaste 3 Pontos de Esperança para usar esse mesmo teste contra dois adversários adicionais ao alcance do ataque.' },
    features: [
      { name: 'Marca da Presa', text: 'Gaste 1 Ponto de Esperança e ataque um alvo. Em um sucesso, cause o dano normal do ataque e Marque temporariamente o alvo. Até esta habilidade acabar ou você Marcar outra criatura, você recebe os benefícios a seguir contra o alvo Marcado:\n• Você sabe precisamente em que direção ele está;\n• Quando causar dano a ele, ele deve marcar 1 Ponto de Fadiga;\n• Quando errar um ataque contra ele, você pode encerrar sua Marca da Presa para rolar seus Dados de Dualidade novamente.' },
    ],
    subclasses: [
      {
        key: 'rastreador', name: 'Rastreador', tagline: 'Seja um rastreador para caçar suas presas e atacar com força letal.', spellcast: 'agility',
        foundation: [
          { name: 'Predador Implacável', text: 'Ao fazer uma rolagem de dano, você pode marcar 1 Ponto de Fadiga para receber +1 de bônus na Proficiência. Além disso, quando causar dano grave a um adversário, ele deve marcar 1 Ponto de Fadiga.' },
          { name: 'Avante', text: 'Quando estiver viajando para um lugar que já visitou, ou se carregar um objeto que já esteve nesse lugar, você pode identificar o caminho mais curto e direto até o destino.' },
        ],
        specialization: [{ name: 'Predador Veloz', text: 'Quando sua Presa (o alvo Marcado) atacar você, você recebe +2 de bônus na Evasão contra esse ataque.' }],
        mastery: [{ name: 'Predador Apex', text: 'Antes de fazer um teste de ataque contra sua Presa, você pode gastar 1 Ponto de Esperança. Se o ataque for bem-sucedido, você remove 1 Ponto de Medo da reserva do mestre.' }],
      },
      {
        key: 'treinador', name: 'Treinador', tagline: 'Seja um treinador para formar um laço profundo com um animal.', spellcast: 'agility',
        foundation: [{ name: 'Companheiro Animal', text: 'Você tem um companheiro animal à sua escolha (a critério do mestre). Ele fica ao seu lado, a não ser que você diga o contrário.\nPegue a ficha de Companheiro Animal. Quando subir de nível, escolha também uma opção de aumento de nível para seu companheiro nessa ficha.' }],
        specialization: [
          { name: 'Treinamento Especializado', text: 'Escolha uma opção de aumento de nível adicional para seu companheiro animal.' },
          { name: 'Unidos na Batalha', text: 'Quando um adversário em alcance corpo a corpo do seu companheiro atacar você, você recebe +2 de bônus na Evasão contra esse ataque.' },
        ],
        mastery: [
          { name: 'Treinamento Avançado', text: 'Escolha duas opções de aumento de nível adicionais para seu companheiro animal.' },
          { name: 'Amigo Leal', text: 'Uma vez por descanso longo, quando um ataque fizer seu companheiro marcar o último Ponto de Fadiga ou você marcar seu último Ponto de Vida, e vocês estiverem em alcance próximo um do outro, você ou seu companheiro pode correr até o outro e sofrer o dano no lugar.' },
        ],
      },
    ],
    suggested: { traits: { agility: 2, strength: 0, finesse: 1, instinct: 1, presence: -1, knowledge: 0 }, primary: 'shortbow', armor: 'leather-armor' },
    itemChoices: { potion: STD_POTION, keepsake: ['Um troféu do seu primeiro abate', 'Uma bússola aparentemente quebrada'] },
    background: [
      'Uma criatura terrível feriu sua comunidade e você jurou caçá-la. O que é, e que rastro ou sinal único ela deixa?',
      'Seu primeiro abate quase matou você também. O que foi, e que parte de você nunca mais foi a mesma depois disso?',
      'Você viajou por muitas terras perigosas, mas qual é o único lugar aonde se recusa a ir?',
    ],
    connections: [
      'Que competição amistosa nós temos?',
      'Por que você age de forma diferente quando estamos sozinhos e quando há outros por perto?',
      'Que ameaça você me pediu para vigiar, e por que isso preocupa você?',
    ],
  },
  {
    key: 'serafim',
    name: 'Serafim',
    description: 'Serafins são guerreiros e curandeiros divinos imbuídos de um propósito sagrado. Há muitos deuses nos reinos, e portanto muitos tipos de serafins, cujo ethos costuma refletir o domínio ou os objetivos de seu deus: defender os fracos, vingar, proteger uma terra ou um artefato, sustentar uma fé. É melhor ser aliado de um serafim do que inimigo.',
    domains: ['valor', 'esplendor'],
    evasion: 9,
    hp: 7,
    items: ['Algumas oferendas ou um símbolo do seu deus'],
    hopeFeature: { name: 'Alicerce da Vida', text: 'Gaste 3 Pontos de Esperança para que um aliado em alcance próximo recupere 1 Ponto de Vida.' },
    features: [
      { name: 'Dados de Oração', text: 'No início de cada sessão, role um número de d4 igual ao atributo de conjuração da sua subclasse e coloque-os no espaço da ficha. Eles são seus Dados de Oração. Você pode gastar qualquer número de Dados de Oração para auxiliar você mesmo ou um aliado em alcance distante. Você pode usar o valor de um dado gasto para reduzir o dano sofrido, somá-lo ao resultado de um teste depois de feito, ou receber Pontos de Esperança iguais ao resultado. No fim de cada sessão, remova os Dados de Oração não utilizados.' },
    ],
    subclasses: [
      {
        key: 'portador_divino', name: 'Portador Divino', tagline: 'Seja um portador divino para dominar o campo de batalha com uma arma lendária.', spellcast: 'strength',
        foundation: [
          { name: 'Arma Espiritual', text: 'Quando você tem equipada uma arma com alcance corpo a corpo ou muito próximo, ela pode voar da sua mão para atacar um adversário em alcance próximo e depois voltar para você. Você pode marcar 1 Ponto de Fadiga para atingir um adversário adicional ao alcance com o mesmo teste de ataque.' },
          { name: 'Toque Piedoso', text: 'Uma vez por descanso longo, toque uma criatura para que ela recupere 2 Pontos de Vida ou 2 Pontos de Fadiga.' },
        ],
        specialization: [{ name: 'Devoção', text: 'Ao rolar seus Dados de Oração, você pode rolar um dado adicional e descartar o menor resultado. Além disso, você pode usar Toque Piedoso duas vezes, em vez de uma, por descanso longo.' }],
        mastery: [{ name: 'Ressonância Sagrada', text: 'Ao rolar o dano da sua Arma Espiritual, se algum dos dados resultar no mesmo valor, dobre o valor de cada dado igual. Por exemplo, se rolar dois 5, eles contam como dois 10.' }],
      },
      {
        key: 'sentinela_alada', name: 'Sentinela Alada', tagline: 'Seja uma sentinela alada para levantar voo e desferir golpes devastadores do céu.', spellcast: 'strength',
        foundation: [{ name: 'Asas de Luz', text: 'Você pode voar. Enquanto estiver voando, você pode:\n• Marcar 1 Ponto de Fadiga para erguer e carregar outra criatura voluntária de tamanho parecido com o seu ou menor;\n• Gastar 1 Ponto de Esperança para causar 1d8 de dano adicional em um ataque bem-sucedido.' }],
        specialization: [{ name: 'Visagem Etérea', text: 'Sua feição sobrenatural causa admiração e temor. Enquanto estiver voando, você tem vantagem em testes de Presença. Ao ter sucesso com Esperança em um teste de Presença, você pode remover 1 Ponto de Medo da reserva do mestre em vez de receber 1 Ponto de Esperança.' }],
        mastery: [
          { name: 'Ascensão', text: 'Receba +4 de bônus permanente no limiar de dano grave.' },
          { name: 'Poder dos Deuses', text: 'Enquanto estiver voando, você causa 1d12 de dano adicional, em vez de 1d8, com Asas de Luz.' },
        ],
      },
    ],
    suggested: { traits: { agility: 0, strength: 2, finesse: 0, instinct: 1, presence: 1, knowledge: -1 }, primary: 'hallowed-axe', secondary: 'round-shield', armor: 'chainmail-armor' },
    itemChoices: { potion: STD_POTION, keepsake: ['Algumas oferendas', 'Um símbolo do seu deus'] },
    background: [
      'A que deus você se devotou? Que feito incrível ele realizou por você em um momento de desespero?',
      'Como sua aparência mudou depois que você fez seu juramento?',
      'De que maneira estranha ou única você se comunica com seu deus?',
    ],
    connections: [
      'Que promessa fiz você me prometer, caso eu morra no campo de batalha?',
      'Por que você me faz tantas perguntas sobre o meu deus?',
      'Você me disse para proteger um membro do grupo acima de todos, até de mim mesmo. Quem é, e por quê?',
    ],
  },
]

const BY_KEY = new Map(CLASSES.map((c) => [c.key, c]))

export function dhClass(key: DhClassKey | null | undefined): DhClass | undefined {
  return key ? BY_KEY.get(key) : undefined
}
