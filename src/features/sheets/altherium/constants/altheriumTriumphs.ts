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
}

export const BERSERKER_TRIUMPHS: BerserkerTriumphDef[] = [
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
]

export const PILAR_TRIUMPHS: PilarTriumphDef[] = [
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
]

const _berserkerById = new Map(BERSERKER_TRIUMPHS.map((t) => [t.id, t]))

export function findBerserkerTriumph(id: string): BerserkerTriumphDef | undefined {
  return _berserkerById.get(id)
}
