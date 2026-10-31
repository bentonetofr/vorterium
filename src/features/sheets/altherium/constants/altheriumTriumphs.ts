// Catálogo oficial de Triunfos do livro de regras de Altherium. Dado fixo
// (como RAIZES/DOMAINS/altheriumItems), sem edição em runtime. Berserker
// escolhe da lista (ids salvos em altherium_character_sheets.berserker_triumphs);
// Pilar tem todos e paga em cartas. Runaskin (runas) fica pra depois.
// Texto transcrito como está no livro.

export type TriumphAction = 'padrao' | 'bonus' | 'livre' | 'reacao'

export const TRIUMPH_ACTION_LABELS: Record<TriumphAction, string> = {
  padrao: 'Ação Padrão',
  bonus:  'Ação Bônus',
  livre:  'Ação Livre',
  reacao: 'Reação',
}

/** Distâncias oferecidas ao criar uma runa — as que o livro usa nos
 *  triunfos, mais Médio e Longo. */
export const TRIUMPH_RANGES = ['Toque', 'Toque/curto', 'Curto', 'Médio', 'Longo', 'Qualquer'] as const

export interface BerserkerTriumphDef {
  id:          string
  name:        string
  description: string
  action:      TriumphAction
  /** Custo em FV. */
  cost:        number
  range:       string
  /** Teste exigido — null quando é "Sem teste". */
  test:        string | null
}

export interface PilarTriumphDef {
  id:          string
  name:        string
  description: string
  /** Custo em cartas (qualquer naipe — o jogador escolhe na hora). Todos são Ação Bônus. */
  cost:        number
  /** Quase todos são Ação Bônus; Jogo de Cintura e Banca Quebrada são Reação. */
  action?:     'reacao'
}

/** Ordem alfabética em português (acentos contam como a letra base). */
export function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
}

// Listas em ordem alfabética (Pilar: por combinações de 1 a 4, e
// alfabética dentro de cada custo) — ver os .sort() no fim de cada lista.
export const BERSERKER_TRIUMPHS: BerserkerTriumphDef[] = ([
  { id: 'briga-de-bar',        name: 'Briga de Bar',        description: 'Usa qualquer objeto como arma (1d8).',                                                                         action: 'padrao', cost: 4, range: 'Toque/curto', test: 'Luta com Fúria' },
  { id: 'critico-selvagem',    name: 'Crítico Selvagem',    description: 'Acertos críticos maximizam 1 dado do dano.',                                                                   action: 'bonus',  cost: 2, range: 'Qualquer',    test: null },
  { id: 'corrente-predadora',  name: 'Corrente Predadora',  description: 'Coloca corrente em uma arma pesada ou leve, puxa o inimigo em sua direção e o deixa perto ao acertar.',        action: 'bonus',  cost: 2, range: 'Curto',       test: 'Luta com Impulso' },
  { id: 'folego-extra',        name: 'Fôlego Extra',        description: 'Ganha 1 ação padrão adicional no turno.',                                                                      action: 'livre',  cost: 4, range: 'Qualquer',    test: null },
  { id: 'furia-alucinada',     name: 'Fúria Alucinada',     description: 'Com Cogumelo Berserkr, ganha +1 dado em FÚRIA extra na cena.',                                                 action: 'livre',  cost: 4, range: 'Qualquer',    test: null },
  { id: 'machado-incansavel',  name: 'Machado Incansável',  description: 'Com machados, ganha +1d10 para acertar se atacar o mesmo inimigo até o fim da cena.',                          action: 'bonus',  cost: 4, range: 'Qualquer',    test: null },
  { id: 'golpe-duas-maos',     name: 'Golpe Duas Mãos',     description: 'Ataque usando uma arma com cada mão por 1d4 turnos.',                                                          action: 'bonus',  cost: 6, range: 'Qualquer',    test: null },
  { id: 'mao-de-ferro',        name: 'Mão de Ferro',        description: 'Com maças ou martelos, ignora até 1d4 de DB da armadura inimiga por 1d4 turnos.',                               action: 'bonus',  cost: 2, range: 'Qualquer',    test: null },
  { id: 'impacto-trovejante',  name: 'Impacto Trovejante',  description: 'Crítico com martelo derruba inimigos em um raio de 5 metros (x teste de Equilíbrio).',                         action: 'bonus',  cost: 2, range: 'Qualquer',    test: null },
  { id: 'olho-de-cacador',     name: 'Olho de Caçador',     description: 'Com armas de longa distância, recebe +2 para acertar e +1 no dano por ponto de Fúria.',                        action: 'bonus',  cost: 2, range: 'Qualquer',    test: null },
  { id: 'pele-endurecida',     name: 'Pele Endurecida',     description: 'Reduz 1d8 de dano recebido por uso.',                                                                          action: 'reacao', cost: 2, range: 'Qualquer',    test: null },
  { id: 'rugido-de-guerra',    name: 'Rugido de Guerra',    description: 'Fortalece e revigora suas energias, +1d10 de FV.',                                                             action: 'bonus',  cost: 4, range: 'Qualquer',    test: null },
  { id: 'punhos-de-ferro',     name: 'Punhos de Ferro',     description: 'Causa mais dano quando luta desarmado (1d6).',                                                                 action: 'bonus',  cost: 1, range: 'Qualquer',    test: null },
  { id: 'sangue-quente',       name: 'Sangue Quente',       description: 'Ao ficar com menos de 50% de Vida, ganha +2 de bônus em FÚRIA até o fim da cena.',                             action: 'bonus',  cost: 4, range: 'Qualquer',    test: null },
  { id: 'quebra-armadura',     name: 'Quebra-Armadura',     description: 'Crítico com arma pesada ignora armadura do inimigo.',                                                          action: 'bonus',  cost: 4, range: 'Qualquer',    test: null },
  { id: 'saque-rapido',        name: 'Saque Rápido',        description: 'Pode sacar a sua arma ou itens com uma ação livre.',                                                           action: 'livre',  cost: 2, range: 'Qualquer',    test: null },
  { id: 'rasteira',            name: 'Rasteira',            description: 'Teste de brutalidade com o inimigo; se vencer, ele cai e gasta 1 ação para se levantar.',                      action: 'bonus',  cost: 2, range: 'Toque',       test: 'Brutalidade com Fúria' },
  { id: 'carga-imparavel',     name: 'Carga Imparável',     description: 'Avança até o inimigo em linha reta e ganha +2 no dano do primeiro ataque.',                                    action: 'padrao', cost: 4, range: 'Curto',       test: 'Brutalidade com Impulso' },
  { id: 'sangue-na-lamina',    name: 'Sangue na Lâmina',    description: 'Ao chegar pela primeira vez na metade da vida do inimigo ou menos, recupera 1d10 PV (uma vez por cena).',       action: 'bonus',  cost: 2, range: 'Qualquer',    test: null },
  { id: 'salto-de-matias',     name: 'Salto de Matias',     description: 'Executa um grande salto, aumentando a movimentação. Adiciona mais 5 metros na movimentação por 1d4 turnos.',   action: 'bonus',  cost: 4, range: 'Qualquer',    test: 'Leveza com Impulso' },
  { id: 'acao-sangrenta',      name: 'Ação Sangrenta',      description: 'Quando mata um inimigo corpo a corpo, pode usar a mesma ação para atacar outro inimigo corpo a corpo.',        action: 'bonus',  cost: 3, range: 'Toque',       test: null },
  { id: 'ferro-temperado',     name: 'Ferro Temperado',     description: 'Empunhando uma arma pesada, seus críticos causam +1 dado do dano ou ignoram 5 pontos de armadura.',           action: 'bonus',  cost: 6, range: 'Qualquer',    test: null },
  { id: 'ultimo-grito',        name: 'Último Grito',        description: 'Ganha 5 de resistência a um tipo de dano (à sua escolha) por 1d4 turno.',                                      action: 'bonus',  cost: 4, range: 'Qualquer',    test: 'Resiliência com Espírito' },
  { id: 'cadeia-de-sangue',    name: 'Cadeia de Sangue',    description: 'Ao acertar um inimigo, você pode gastar 1 FV para saltar para outro inimigo a curto alcance e atacá-lo com -2 na rolagem.', action: 'bonus', cost: 1, range: 'Curto', test: null },
  { id: 'grito-de-desafio', name: 'Grito de Desafio', description: 'Provoca os inimigos próximos. Quem falhar num teste de Vontade + Espírito (DT 11) precisa atacar o Berserker no seu próximo turno.', action: 'bonus', cost: 3, range: 'Curto', test: 'Intimidação com Fúria' },
  { id: 'mordida-do-lobo', name: 'Mordida do Lobo', description: 'Ao ser atingido por um ataque corpo a corpo, revida na hora com um ataque com -1 dado, sem precisar Aparar.', action: 'reacao', cost: 3, range: 'Toque', test: 'Luta com Fúria' },
  { id: 'arremesso-brutal', name: 'Arremesso Brutal', description: 'Agarra um inimigo do seu tamanho ou menor e o arremessa a até Fúria x 2 metros. O alvo sofre 1d6 de Impacto e fica Derrubado. Se atingir outra criatura, ela também sofre o dano.', action: 'padrao', cost: 4, range: 'Toque', test: 'Brutalidade com Fúria' },
  { id: 'muralha-de-carne', name: 'Muralha de Carne', description: 'Quando um aliado em Toque for atingido, o Berserker se joga na frente e recebe o ataque no lugar dele, sofrendo o dano na mesma parte do corpo.', action: 'reacao', cost: 2, range: 'Toque', test: null },
  { id: 'sede-de-sangue', name: 'Sede de Sangue', description: 'Até o fim da cena, uma vez por turno, ao derrubar um inimigo a 0 PV, recupera 1d8 FV.', action: 'bonus', cost: 2, range: 'Qualquer', test: null },
  { id: 'quebra-escudo', name: 'Quebra-Escudo', description: 'O próximo ataque que acertar com uma arma pesada destrói a proteção do alvo: o escudo ou a armadura da parte atingida perde 30% de Integridade, além do desgaste normal.', action: 'bonus', cost: 3, range: 'Toque', test: null },
  { id: 'faro-do-lobo', name: 'Faro do Lobo', description: 'Em uma exploração na natureza, usa Fúria no lugar de Estratégia. Toda Ração encontrada nessa exploração vem com +25%.', action: 'livre', cost: 4, range: 'Qualquer', test: 'Sobrevivência com Fúria' },
  { id: 'recusar-a-morte', name: 'Recusar a Morte', description: 'Ao chegar a 0 PV, o Berserker se recusa a cair: fica com 1 PV e perde 1d4 de Equilíbrio. Só pode ser usado uma vez por Descanso Longo.', action: 'reacao', cost: 6, range: 'Qualquer', test: null },
  { id: 'berro-dos-ancestrais', name: 'Berro dos Ancestrais', description: 'Um grito que lembra os mortos do clã. Aliados em Curto deixam de estar Amedrontados e recebem +1 dado no próximo teste de Vontade.', action: 'bonus', cost: 4, range: 'Curto', test: null },
  { id: 'atropelar', name: 'Atropelar', description: 'Avança em linha reta até o fim do seu movimento. Cada inimigo no caminho faz Reflexo + Impulso contra o seu teste: quem perder é empurrado para o lado e fica Derrubado.', action: 'padrao', cost: 2, range: 'Curto', test: 'Brutalidade com Fúria' },
  { id: 'lamina-arremessada', name: 'Lâmina Arremessada', description: 'Arremessa a própria arma pesada em alcance Curto, causando o dano normal da arma. A arma cai junto do alvo e precisa ser recuperada.', action: 'padrao', cost: 4, range: 'Curto', test: 'Precisão com Fúria' },
  { id: 'furia-contida', name: 'Fúria Contida', description: 'Ao sofrer dano, transforma a dor em força: recupera FV igual à metade do dano sofrido, até no máximo 5.', action: 'reacao', cost: 1, range: 'Qualquer', test: null },
  { id: 'agarrao-de-ferro', name: 'Agarrão de Ferro', description: 'Segura um inimigo, que fica Preso enquanto o Berserker gastar uma Ação Bônus por turno para mantê-lo. O Berserker não pode atacar com arma de Duas Mãos enquanto segura.', action: 'padrao', cost: 3, range: 'Toque', test: 'Brutalidade com Fúria contra Brutalidade do alvo' },
  { id: 'escudo-humano', name: 'Escudo Humano', description: 'Usa um inimigo Preso pelo Agarrão de Ferro como escudo: recebe cobertura parcial contra ataques à distância. Se um desses ataques errar com algum 1 nos dados, atinge o refém.', action: 'bonus', cost: 2, range: 'Toque', test: null },
  { id: 'golpe-no-chao', name: 'Golpe no Chão', description: 'Com uma arma de Impacto, golpeia o chão. Todas as criaturas em Toque, inclusive aliados, fazem Reflexo + Impulso (DT 11) ou ficam Derrubadas.', action: 'padrao', cost: 4, range: 'Toque', test: null },
  { id: 'cicatrizes-de-guerra', name: 'Cicatrizes de Guerra', description: 'Ao sofrer um acerto crítico, o Berserker ganha +1 dado no próximo ataque contra quem o acertou.', action: 'livre', cost: 2, range: 'Qualquer', test: null },
  { id: 'presenca-aterradora', name: 'Presença Aterradora', description: 'Encara os inimigos com olhos de fera. Inimigos fracos em Curto que falharem em Vontade + Espírito (DT 11) ficam Amedrontados. O mestre define quem é fraco.', action: 'padrao', cost: 4, range: 'Curto', test: 'Intimidação com Fúria' },
  { id: 'dentes-cerrados', name: 'Dentes Cerrados', description: 'Ignora as penalidades de Fome até o fim da cena.', action: 'livre', cost: 2, range: 'Qualquer', test: null },
  { id: 'martelo-do-ferreiro', name: 'Martelo do Ferreiro', description: 'Durante um Descanso Curto, repara uma arma pesada em Campo até 100% de Integridade, em vez de 75%.', action: 'livre', cost: 2, range: 'Toque', test: null },
  { id: 'ritmo-de-batalha', name: 'Ritmo de Batalha', description: 'Até o fim do turno, cada acerto seguido no mesmo alvo causa +1 de dano cumulativo, até no máximo +3. Um erro encerra o efeito.', action: 'bonus', cost: 3, range: 'Qualquer', test: null },
] satisfies BerserkerTriumphDef[]).sort(byName)

export const PILAR_TRIUMPHS: PilarTriumphDef[] = ([
  { id: 'bencao-de-hamingja',     name: 'Bênção de Hamingja',     cost: 3, description: 'Quando fizer um teste importante, você pode rerrolar os dados e escolher o resultado melhor.' },
  { id: 'chama-inspiradora',      name: 'Chama Inspiradora',      cost: 3, description: 'Escolha um aliado, ele adiciona +2 a um atributo para um teste específico (aplica-se a um único teste).' },
  { id: 'conselho-dos-cacadores', name: 'Conselho dos Caçadores', cost: 3, description: 'Enquanto você coordena uma investigação em grupo, todos ganham +4 em testes de Investigação nessa cena.' },
  { id: 'ecos-do-acontecido',     name: 'Ecos do Acontecido',     cost: 4, description: 'Ao investigar um local por atenção/tempo, você reconstrói eventos recentes: +4 em Investigação e revela até 3 detalhes relevantes escolhidos pelo mestre.' },
  { id: 'fio-do-destino',         name: 'Fio do Destino',         cost: 1, description: 'Adicione -20 a um teste relacionado à sorte ou evento imprevisto. Já que o dado de sorte é 1d100.' },
  { id: 'furia-moldada',          name: 'Fúria Moldada',          cost: 2, description: 'Numa rolagem que normalmente usa Fúria, você pode substituir Fúria por outro atributo à sua escolha para esse teste.' },
  { id: 'guarda-de-skaldir',      name: 'Guarda de Skaldir',      cost: 3, description: 'Por uma cena, aliados próximos recebem +4 em Impulso.' },
  { id: 'instinto-ancestral',     name: 'Instinto Ancestral',     cost: 4, description: 'Antes de tomar uma ação decisiva, role com vantagem narrativa: receba +2 no teste e um breve insight do mestre sobre a probabilidade (uma pista curta).' },
  { id: 'ladrao-de-sorte',        name: 'Ladrão de Sorte',        cost: 2, description: 'Escolha um aliado ou inimigo que acabou de rolar, transfira o resultado dele para você.' },
  { id: 'lingua-de-ferro',        name: 'Língua de Ferro',        cost: 1, description: 'Adicione +1d10 ao teste de Intimidação ou Persuasão.' },
  { id: 'mao-precisa',            name: 'Mão Precisa',            cost: 3, description: 'Escolha uma rolagem importante; todos os dados nessa rolagem têm mínimo 5 (resultados 1–4 contam como 5).' },
  { id: 'mira-do-capitao',        name: 'Mira do Capitão',        cost: 1, description: 'Conceda +1d10 em um teste de ataque de um aliado (próximo ataque).' },
  { id: 'olhar-de-lodin',         name: 'Olhar de Lodin',         cost: 1, description: 'Você recebe +2 em Investigação durante a cena.' },
  { id: 'ouvido-do-julgador',     name: 'Ouvido do Julgador',     cost: 3, description: 'Ao ouvir alguém falar por até 1 minuto, você identifica variações que denunciam mentira, o mestre confirma/negativa.' },
  { id: 'punhal-na-sombra',       name: 'Punhal na Sombra',       cost: 1, description: 'Quando atacar oculto, adicione +4 de dano.' },
  { id: 'rastro-dos-deuses',      name: 'Rastro dos Deuses',      cost: 1, description: 'Adicione +1d10 a um teste de Investigação.' },
  { id: 'retorno-do-baralho',     name: 'Retorno do Baralho',     cost: 3, description: 'Você recupera 1d20+3 cartas do descarte para a sua mão.' },
  { id: 'sangue-ardente',         name: 'Sangue Ardente',         cost: 2, description: 'Em testes que usam Fúria, adicione +1d10.' },
  { id: 'sopro-de-nidhoggr',      name: 'Sopro de Níðhöggr',      cost: 2, description: 'Escolha um inimigo; no próximo teste importante dele, aplique -1d10 ao teste dele.' },
  { id: 'teia-de-urdr',           name: 'Teia de Urðr',           cost: 3, description: 'Uma vez por cena, anule um evento recente: substitua um teste anterior de um aliado ou oponente por uma nova rolagem (o mestre aplica consequências narrativas).' },
  { id: 'toque-do-ermitao',       name: 'Toque do Ermitão',       cost: 1, description: 'Ao tocar ou inspecionar um material/substância desconhecida, você identifica sua natureza e usos possíveis instantaneamente.' },
  { id: 'voz-de-mjorr',           name: 'Voz de Mjörr',           cost: 2, description: 'Por uma cena, você recebe +4 em testes sociais (Persuasão/Enganação/Intimidação) quando fala com presença firme.' },
  { id: 'passo-fantasma',         name: 'Passo Fantasma',         cost: 2, description: 'Durante este turno você se move sem ser notado: ganha +4 em Furtividade e não provoca ataques de oportunidade por movimento.' },
  { id: 'sombra-antecipada',      name: 'Sombra Antecipada',      cost: 3, description: 'Escolha um inimigo visível. Você recebe uma visão lúgubre do próximo ato dele: ele deve declarar se irá atacar, recuar ou usar habilidade especial.' },
  { id: 'olhos-do-augurio',       name: 'Olhos do Augúrio',       cost: 2, description: 'Marque um alvo por até a cena inteira. Enquanto marcado, você recebe +1d10 na próxima ação direta.' },
  { id: 'trilha-do-pressagio',    name: 'Trilha do Presságio',    cost: 3, description: 'Até o fim do turno, seu deslocamento dobra.' },
  { id: 'aposta-dobrada', name: 'Aposta Dobrada', cost: 2, description: 'Antes de um teste, aposte. Se passar, recupera 10 cartas do descarte. Se falhar, descarta mais 2 cartas.' },
  { id: 'carta-na-manga', name: 'Carta na Manga', cost: 1, description: 'Guarde o valor de um dado que você acabou de rolar. Até o fim da cena, você pode usá-lo no lugar de um dado de qualquer teste seu.' },
  { id: 'jogo-de-cintura', name: 'Jogo de Cintura', cost: 2, action: 'reacao', description: 'Quando for atingido, role de novo a parte do corpo atingida e fique com o resultado que preferir.' },
  { id: 'blefe-do-mercador', name: 'Blefe do Mercador', cost: 2, description: 'Numa negociação, compre um item com 20% de desconto ou venda com 20% a mais.' },
  { id: 'mapa-das-estrelas', name: 'Mapa das Estrelas', cost: 2, description: 'Numa exploração, sorteie de novo um dos Achados e fique com o que preferir.' },
  { id: 'corda-das-nornas', name: 'Corda das Nornas', cost: 4, description: 'Um aliado Caído em Curto recebe +1 em todos os seus Testes de Morte. Esse bônus não conta para o limite da Medicina.' },
  { id: 'mao-invisivel', name: 'Mão Invisível', cost: 1, description: 'Passe um item para um aliado em Curto, ou saque e use um item rápido, sem gastar outra ação.' },
  { id: 'ilusao-de-passos', name: 'Ilusão de Passos', cost: 3, description: 'Uma vez por cena, um inimigo Atento volta a ficar Desatento.' },
  { id: 'truque-de-cartas', name: 'Truque de Cartas', cost: 2, description: 'Cria uma distração com as mãos e a fala. Todos os aliados recebem +1 dado no próximo teste de Furtividade.' },
  { id: 'brinde-do-rei-bebado', name: 'Brinde do Rei Bêbado', cost: 3, description: 'Desafie um NPC para um jogo, uma aposta ou uma bebida. Se ele falhar em Vontade + Espírito (DT 13), aceita o desafio e cumpre o que for apostado.' },
  { id: 'roleta-de-hel', name: 'Roleta de Hel', cost: 1, description: 'Role 1d6: 1 — você sofre 1d6 de dano; 2 — nada acontece; 3 ou 4 — um aliado recebe +1 dado no próximo teste; 5 — um inimigo perde 1 dado no próximo teste; 6 — você ganha uma Ação Padrão extra neste turno.' },
  { id: 'leitura-do-oponente', name: 'Leitura do Oponente', cost: 2, description: 'Observe uma criatura e descubra uma de suas resistências, vulnerabilidades ou imunidades. O mestre revela.' },
  { id: 'dados-viciados', name: 'Dados Viciados', cost: 3, description: 'Num teste de um aliado em Curto, os resultados 1 são rolados de novo uma vez.' },
  { id: 'golpe-de-sorte', name: 'Golpe de Sorte', cost: 2, description: 'No seu próximo ataque, um 9 natural também conta como Crítico.' },
  { id: 'troca-de-lugares', name: 'Troca de Lugares', cost: 3, description: 'Troque de lugar com um aliado em Curto. Nenhum dos dois provoca Ataque de Oportunidade.' },
  { id: 'contar-cartas', name: 'Contar Cartas', cost: 1, description: 'Descubra o estado de um inimigo: inteiro, ferido (abaixo da metade) ou quase caído.' },
  { id: 'cofre-cheio', name: 'Cofre Cheio', cost: 1, description: 'Numa exploração, todo Hacksilver encontrado vem dobrado, por 1 cena.' },
  { id: 'banca-quebrada', name: 'Banca Quebrada', cost: 4, action: 'reacao', description: 'Uma vez por cena, transforme um Crítico inimigo contra um aliado em curto em um acerto normal.' },
  { id: 'rota-do-viajante', name: 'Rota do Viajante', cost: 2, description: 'Ganhe 1 Ficha de Exploração. Só pode ser usado uma vez por Descanso Longo.' },
  { id: 'hidromel-e-historias', name: 'Hidromel e Histórias', cost: 2, description: 'Durante um Banquete no Salão ou uma Confissão, todos os aliados presentes recuperam +1d4 de Equilíbrio extra.' },
] satisfies PilarTriumphDef[]).sort((a, b) => a.cost - b.cost || byName(a, b))

// ── Runaskin ─────────────────────────────────────────────
// Três trilhas, cada uma com 3 triunfos iniciais (custo 1 PR). Os
// triunfos descobertos por runas são criados na ficha (tabela
// altherium_runaskin_runes), não vivem aqui.

export type RunaskinTrail = 'regente' | 'sentinela' | 'carniceiro'

export interface RunaskinTrailDef {
  id:    RunaskinTrail
  label: string
  /** Runa que ilustra os cards da trilha (no lugar de foto). */
  glyph: string
  focus: string
  /** Condição para usar os triunfos da trilha. */
  rule:  string
}

export const RUNASKIN_TRAILS: RunaskinTrailDef[] = [
  {
    id: 'regente', label: 'Regente', glyph: 'ᛒ',
    focus: 'Suporte curativo, utilizando das forças da natureza.',
    rule: 'As runas precisam estar sempre à mostra (se estiver de camisa, precisa tirá-la) e o regente não pode utilizar armaduras.',
  },
  {
    id: 'sentinela', label: 'Sentinela', glyph: 'ᛉ',
    focus: 'Suporte defensivo, utilizando o lado dos mortos.',
    rule: 'Precisa de um corpo morto recente ao redor para se conectar ao outro lado.',
  },
  {
    id: 'carniceiro', label: 'Carniceiro', glyph: 'ᚦ',
    focus: 'Suporte ofensivo, utilizando o sangue dos vivos e dos mortos.',
    rule: 'Precisa ter sangue recente extraído de seu corpo (causando 1d4 de dano em si mesmo) ou ao redor.',
  },
]

export interface RunaskinTriumphDef {
  id:          string
  trail:       RunaskinTrail
  name:        string
  description: string
  action:      TriumphAction
  /** Custo em PR. */
  cost:        number
  range:       string
  test:        string
}

export const RUNASKIN_TRIUMPHS: RunaskinTriumphDef[] = ([
  { id: 'raiz-vital',           trail: 'regente',    name: 'Raiz Vital',           action: 'bonus',  cost: 1, range: 'Curto', test: 'Medicina com Rúnico',    description: 'Manipulação da essência natural para curar (+1d10+Rúnico). Raízes emergem do solo e envolvem o alvo, restaurando sua vitalidade.' },
  { id: 'casca-protetora',      trail: 'regente',    name: 'Casca Protetora',      action: 'bonus',  cost: 1, range: 'Toque', test: 'Resiliência com Rúnico', description: 'Manipulação da seiva ancestral para defender (+2 DB para 1 aliado ou você). Uma camada de madeira viva endurece a pele do alvo.' },
  { id: 'esporos-espinhosos',   trail: 'regente',    name: 'Esporos Espinhosos',   action: 'padrao', cost: 1, range: 'Curto', test: 'Luta com Rúnico',        description: 'Manipulação de esporos naturais para atacar (+1d6+Rúnico). Esporos cortantes se espalham em linha reta causando ferimentos leves.' },
  { id: 'veu-ancestral',        trail: 'sentinela',  name: 'Véu Ancestral',        action: 'bonus',  cost: 1, range: 'Curto', test: 'Resiliência com Rúnico', description: 'Manipulação espiritual para defender (+1d4+Rúnico como escudo/corpo todo do seu e de +3 aliados por 2 turnos). Espíritos antigos envolvem o alvo absorvendo dano.' },
  { id: 'marca-eterea',         trail: 'sentinela',  name: 'Marca Etérea',         action: 'padrao', cost: 1, range: 'Curto', test: 'Luta com Rúnico',        description: 'Manipulação espiritual para enfraquecer (+1d4+Rúnico). Uma marca espectral atinge o alvo causando dano.' },
  { id: 'sussurro-restaurador', trail: 'sentinela',  name: 'Sussurro Restaurador', action: 'bonus',  cost: 1, range: 'Toque', test: 'Medicina com Rúnico',    description: 'Manipulação espiritual para curar (+1d4+Rúnico). Um espírito toca o alvo e estabiliza seus ferimentos.' },
  { id: 'sangue-cortante',      trail: 'carniceiro', name: 'Sangue Cortante',      action: 'padrao', cost: 1, range: 'Toque', test: 'Luta com Rúnico',        description: 'Manipulação do sangue dos mortos para atacar (+1d10+Rúnico). Cria uma lâmina de sangue afiada o suficiente para causar um grande ferimento; ao usar 1 vez a lâmina se desfaz.' },
  { id: 'batismo-rubro',        trail: 'carniceiro', name: 'Batismo Rubro',        action: 'bonus',  cost: 1, range: 'Toque', test: 'Resiliência com Rúnico', description: 'Manipulação do sangue dos mortos para defender (+1 DB/corpo todo seu e de +2 aliados). Cria uma camada de armadura de sangue envolta dos alvos, criando proteção.' },
  { id: 'uncao-escarlate',      trail: 'carniceiro', name: 'Unção Escarlate',      action: 'bonus',  cost: 1, range: 'Curto', test: 'Medicina com Rúnico',    description: 'Manipulação do sangue dos mortos para curar (+1d4 de PV para 1 aliado). Cria um fio de sangue que se conecta no alvo e o recupera.' },
] satisfies RunaskinTriumphDef[]).sort(byName)

const _berserkerById = new Map(BERSERKER_TRIUMPHS.map((t) => [t.id, t]))

export function findBerserkerTriumph(id: string): BerserkerTriumphDef | undefined {
  return _berserkerById.get(id)
}
