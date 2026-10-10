import { useEffect, useState } from 'react'

// ────────────────────────────────────────────────────────
// Novidades do site — mostradas na página Novidades. Cada versão nova vai
// no TOPO da lista; APP_VERSION é sempre a do primeiro item. Quem ainda não
// abriu a página desde a versão atual vê um ponto no menu.
// ────────────────────────────────────────────────────────

export interface ChangelogEntry {
  version: string
  /** AAAA-MM-DD */
  date:    string
  title:   string
  items:   string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.41',
    date:    '2026-10-10',
    title:   'Inimigos e sons de criaturas no controle do mestre (Vortable)',
    items: [
      'Controle ao vivo do Vortable: novo botão de caveira na barra do mestre (depois de NPCs), "Inimigos e sons de criaturas".',
      'Aba "Colocar": Corredor (dano 1), Espreitador (2), Estalador (3), Trôpego (4) e Baiacu (6), cada um com o próprio boneco. Escolha onde (no ponto de partida da zona ou perto de um jogador), quantos (1 a 8) e quão espalhados, e clique em Colocar: eles aparecem na hora no mapa para o mestre e para quem está na zona.',
      'Aba "Na zona": lista os inimigos de lá, com sons rápidos de cada um, "Controlar" (anda com ele como um jogador, setas ou WASD), "Tirar" e "Tirar todos desta zona".',
      'Aba "Sons": 24 sons sintetizados na hora, sem arquivos: Corredor (grunhido, grito, ofegante, rosnado), Espreitador (respiração, sussurro, rosnado, estalo de língua), Estalador (cliques, cliques rápidos, grito, agonia), Trôpego (gemido, gargarejo, bolsa estourando, passos arrastados), Baiacu (rugido, grunhido, passos pesados, arremesso de esporos) e Zumbi comum (gemido, grunhido, grito rouco, mastigando).',
      'Cada som tem volume, distância (perto, longe e muito longe, que abafa e põe eco), repetição automática (a cada 4, 8 ou 15 segundos), e dá para tocar só para quem está na zona ou para a mesa toda. Os jogadores ouvem junto, e cada um liga ou desliga os sons de criaturas no botão de alto-falante no canto da tela do jogo.',
      'Personagem: três peças novas de infectado no criador (aba Infecção): Espreitador (pele morta e veias), Trôpego (bolsas de esporos) e Baiacu (placas de fungo).',
    ],
  },
  {
    version: '1.40',
    date:    '2026-10-10',
    title:   'Mundo pronto: Nova York — Zona Morta (Vortable)',
    items: [
      'Mundos do Vortable: novo mundo pronto "NOVA YORK: ZONA MORTA", com 37 zonas, no clima de The Last of Us, em "Criar este mundo". Lá fora nunca tem esporos: só mato invadindo o asfalto, carros abandonados, placas dos EUA e musgo em tudo.',
      'Começa numa avenida na vertical (de baixo para cima), com becos dos dois lados, metrô, táxis, escadas de incêndio, carrinho de cachorro-quente e prédios para entrar: edifício de apartamentos (3 andares), bodega, farmácia e lanchonete. Cada prédio é uma zona e cada andar também.',
      'A avenida segue para o norte e faz a curva para a direita (delegacia com 2 andares, edifício de escritórios com 2 andares, loja de roupas), depois a estrada vai perdendo o asfalto até virar estrada de terra na mata (motel e posto de gasolina). Mais adiante, a mata fechada, com cabana, galpão e a escola no centro.',
      'A escola P.S. 114 tem térreo, 2º e 3º andares, porão e túnel de serviço. O túnel dá no metrô, com 5 zonas de estações e túneis cobertos de esporos, vagões abandonados, Estaladores e Corredores. Uma escada leva à superfície, na margem de um rio gigante.',
      'A margem tem 3 zonas (cais, calçadão e o restaurante). O restaurante The Arbor tem salão, cozinha, 2º andar, salão de eventos e terraço, e é o fim do mapa.',
      'Objetos novos (folha "Cidade grande"): trilhos e vagão de metrô, entrada do metrô (SUBWAY), escada de incêndio, toldos listrados, letreiros de neon (DELI, PHARMACY, MOTEL, DINER, POLICE, BANK, P.S. 114, THE ARBOR...), carros vistos de frente e de trás para ruas na vertical, carrinho de cachorro-quente, lixeira de arame, chaminé de vapor, barco encalhado e muro de beco.',
      'O arquivo do mundo (nova-york.mundo.json) também pode ser importado direto pelo botão de importar mundo. Ele é gerado por scripts/tlou_art/world_nyc.py (python scripts/make-tlou-art.py --world).',
    ],
  },
  {
    version: '1.39',
    date:    '2026-10-10',
    title:   'Varredura de erros: Cidade em Ruínas e armas no boneco',
    items: [
      'Cidade em Ruínas: o soldado caído, o guarda da cancela e o Corredor do subsolo usavam o corpo "musculoso", que não aceita camiseta camuflada, xadrez nem colete tático (as peças simplesmente sumiam). Agora usam o corpo normal e aparecem vestidos.',
      'Cidade em Ruínas: a saída do hospital para a rua passava um pouco da borda do mapa e foi encaixada dentro dele.',
      'Armas no boneco: nomes como "marco", "barco", "barraca" ou "ferrolho" não viram mais arco, cano ou bomba por engano (agora só valem as palavras inteiras: arco, cano, barra, ferro, tubo, bomba).',
      'Ficha: o cabeçalho não toca mais a animação de entrada de novo depois do susto de Horror ou de levar dano; o tremor agora fica só nos medidores.',
    ],
  },
  {
    version: '1.38',
    date:    '2026-10-10',
    title:   'Animações na ficha da Terra Devastada Adaptada',
    items: [
      'Horror subindo dá um susto: o quadro do Horror treme, um clarão vermelho cobre o cabeçalho e o número dá um pulinho. Vida caindo faz o mesmo com o tremor e o vermelho; Vida ou Convicção subindo (ou o Horror baixando) acende um brilho verde.',
      'Vida crítica pulsa como um coração e o Horror nas faixas mais altas respira em vermelho, com o título piscando como lâmpada ruim. O Alerta da cena também pulsa (devagar no 2, rápido no 3).',
      'Cada caixinha das trilhas dá um estalo ao acender, e o medidor de suprimentos enche da esquerda para a direita; barras cheias brilham de leve.',
      'Ao trocar de aba, os cartões entram em cascata e as linhas das listas (qualidades, inventário, achados) entram uma a uma. Cartões ganham brilho na borda ao passar o mouse.',
      'Botões: brilho passando ao pôr o mouse, subida nos botões do cabeçalho, afundar ao clicar, o "×" gira e os botões de mais e menos encolhem no clique. Abas, seletores e opções dão um pulinho ao serem marcados.',
      'Resultado dos testes: a caixa entra com o número pulando e brilha em verde no sucesso, em dourado no parcial e treme em vermelho na falha. Dados pares brilham e os seis (6) pulsam em vermelho.',
      'Contadores, o estado do salvamento ("Tudo salvo") e a imagem do personagem (que revela com desfoque ao trocar, e dá zoom ao passar o mouse) também ganharam animação. Com "reduzir movimento" ligado no sistema, tudo isso fica parado.',
    ],
  },
  {
    version: '1.37',
    date:    '2026-10-10',
    title:   'Ruas no estilo dos EUA (Vortable)',
    items: [
      'Texturas novas: asfalto liso azul-acinzentado com rachaduras grossas e mato nascendo nas frestas, asfalto tomado pelo mato, calçada de lajotas de pedra clara com juntas escuras e concreto liso.',
      'Faixas pintadas (objetos de chão de um ladrilho, é só emendar): amarela dupla no meio, amarela simples na borda, branca tracejada, faixa de pedestres, linha de parada, seta no chão e tampa de bueiro, todas na horizontal e na vertical e com a tinta gasta.',
      'Placas dos EUA: velocidade (SPEED LIMIT 35), PARE (STOP), mão única (ONE WAY), entrada proibida, proibido estacionar, hospital (H azul), zona escolar, nome de rua (MAIN ST), passagem de trem e a placa verde de saída de estrada (EXIT).',
      'Peças americanas: poste elétrico de madeira com transformador, mastro com bandeira rasgada, caixa de correio rural, letreiro de posto de gasolina, parquímetro, ônibus escolar amarelo abandonado, outdoor da FEDRA e a pichação "LOOK FOR THE LIGHT".',
      'A Cidade em Ruínas foi refeita com a rua nova: faixas, faixa de pedestres, setas, bueiros, placas e peças americanas na rua e na estrada do Posto de Quarentena. Carros e o resto continuam como estavam.',
    ],
  },
  {
    version: '1.36',
    date:    '2026-10-10',
    title:   'Mundo pronto: Cidade em Ruínas (Vortable)',
    items: [
      'Mundos do Vortable: novo mundo pronto "CIDADE EM RUÍNAS", no clima de The Last of Us, em "Criar este mundo" (ao lado do TORVALLEN). Vem com 4 zonas ligadas por saídas e céu nublado no fim da tarde.',
      'Rua da Cidade: rua bloqueada por entulho, carros abandonados, postes, calçadas tomadas pelo mato, um acampamento de sobreviventes, o hospital e um mercadinho infectado de fungo.',
      'Posto de Quarentena: cancela com barreiras e sacos de areia, cerca de arame, barracas militares, gerador, holofotes e a mesa de comando, com guarda, oficial, médica e um sobrevivente pedindo para entrar.',
      'Hospital Abandonado: enfermaria com camas e soros, recepção com balcão e barricada, ala oeste tomada por cordyceps, um infectado Corredor e um médico sobrevivente.',
      'Subsolo Infectado: o ninho, no escuro, com casulos, bulbos de esporos, árvore de fungo e dois Estaladores e um Corredor esperando.',
      'Os NPCs já vêm vestidos com as peças novas do criador (máscara de gás, colete tático, roupas camufladas e suradas, fungo de Estalador) e armados.',
      'O mundo é gerado pelo mesmo script do pacote Apocalipse (`python scripts/make-tlou-art.py --world`), então dá para ajustar e gerar de novo.',
    ],
  },
  {
    version: '1.35',
    date:    '2026-10-10',
    title:   'Roupas e rostos do apocalipse no criador de personagem',
    items: [
      'Criador de personagem do Vortable: nova peça "Máscara de gás" (aba Acessórios, espaço Máscara), desenhada em cada direção que o boneco olha, com lentes, filtro e tiras.',
      'Nova aba "Infecção": fungo de Estalador (cabeça coberta por placas de cordyceps), fungo parcial (na cabeça e no ombro) e infectado recente (olheiras fundas e veias escuras).',
      'Roupas: camisa xadrez de manga comprida (vermelha, verde, azul e marrom), camiseta camuflada (floresta, deserto e urbana), camiseta surrada e suja (cinza, bege e branca), calça camuflada (floresta, deserto e urbana), calça surrada e suja (jeans, cargo e preta) e colete tático (oliva, preto e caqui).',
      'Marcas: nova peça "Sujeira e lama" (leve, pesada e lama), que suja o corpo mais perto dos pés.',
      'As peças novas funcionam em todos os corpos adultos e acompanham o balanço da caminhada, parado e correndo.',
    ],
  },
  {
    version: '1.34',
    date:    '2026-10-10',
    title:   'Armas no boneco do Vortable',
    items: [
      'Terra Devastada Adaptada: as armas do Inventário aparecem no boneco do Vortable, sozinhas. Cada arma é desenhada na mão, nas costas ou no bolso (cintura): pistola, revólver, escopeta, rifle, taco, cano de ferro, machadinha, facão, faca, arco, coquetel molotov, granada e lança-chamas. O desenho acompanha o balanço da caminhada e muda conforme o lado em que o boneco olha (de costas, a arma das costas aparece inteira).',
      'Cada arma ganhou um seletor "Boneco" no Inventário: automático, na mão, nas costas ou no bolso. No automático, a primeira arma vai pra mão, as compridas pras costas e as pequenas pro bolso; só cabe uma arma em cada lugar.',
      'O boneco se atualiza sozinho quando o inventário muda, e também depois de criar ou editar o personagem. Quem não tem personagem criado ainda vê as armas assim que criar. Bonecos infantis não carregam armas.',
      'Criação de personagem: 11 cores novas de roupa (oliva militar, caqui sujo, ferrugem, jeans desbotado, jeans escuro, cinza fuligem, vinho gasto, azul petróleo, bege poeira, verde musgo e lama) e 3 de cabelo (castanho acinzentado, ruivo queimado e grisalho sujo), para qualquer peça de tecido.',
      'As peças de arma também aparecem no criador de personagem, na aba "Armas", para quem quiser escolher à mão (a ficha sobrescreve na próxima atualização do inventário).',
    ],
  },
  {
    version: '1.33',
    date:    '2026-10-10',
    title:   'Vortable: pacote Apocalipse',
    items: [
      'Vortable: novo pacote de arte de pós-apocalipse (natureza retomando a cidade), disponível no editor de qualquer campanha: 95 objetos novos e 17 terrenos, todos desenhados do zero.',
      'Ruínas e cidade: entulho, lajes e pilares quebrados, pilha de pneus, caçamba, carrinho de supermercado, carros e uma van abandonados (cinco cores), poste, semáforo, hidrante, caixa de correio, banco e muro desabado.',
      'Quarentena: barreira de concreto, barricada de madeira, muro de sacos de areia, cerca e rolo de arame farpado, placas ("Zona de quarentena", "Perigo", "Estrada fechada"), caixotes militares, barraca, gerador, holofote com luz, cone, cavalete, janela e porta tapadas com tábuas e pichações.',
      'Infecção: fungo (cordyceps) na parede, no teto e no chão, tentáculos, corpo tomado pelo fungo, casulos, troncos e uma árvore cobertos de fungo, bulbos de esporos que soltam baforadas e nuvens de esporos que se movem.',
      'Natureza invasora: mato alto e denso, arbustos, hera na parede, árvore morta, tronco quebrado, poças, folhas secas, raízes e ervas rachando o asfalto.',
      'Sobrevivência: mochila, kit médico, bancada de trabalho, fogueira animada com luz, saco de dormir, lanterna e lampião com luz, rádio, cofre com teclado, armário de ferro, barris, abrigo de lona, mesa com mapa, cama de hospital e suporte de soro.',
      'Terrenos novos (categoria "Apocalipse"): asfalto novo, rachado e tomado pelo musgo, calçada, concreto sujo, entulho, terra batida, lama, grama seca, mato invasor, chão de micélio, piso de hospital, madeira podre, carpete sujo, folhas secas, cinzas e neve suja.',
    ],
  },
  {
    version: '1.32',
    date:    '2026-10-10',
    title:   'Criar personagem direto da ficha adaptada',
    items: [
      'Terra Devastada Adaptada: o botão "Criar personagem no Vortable" agora fica logo embaixo do quadro da imagem do personagem, na ficha. Depois de criado, vira "Editar personagem no Vortable".',
    ],
  },
  {
    version: '1.31',
    date:    '2026-10-10',
    title:   'Notificações da Terra Devastada Adaptada',
    items: [
      'Nas campanhas de Terra Devastada Adaptada, os avisos ganham o visual de The Last of Us: pop-up de notificação e de mensagem do chat, a lista do sino e o resultado dos dados, com fundo de carvão granulado, tarja vermelha e letras condensadas (no tema claro, papel de diário).',
      'O aviso de teste de pares fala a língua do sistema: "Ellie testou com 3d: 2 pontos", e o resultado dos seus próprios dados mostra "Teste" e "pontos de desempenho" em vez de fórmula de dado.',
    ],
  },
  {
    version: '1.30',
    date:    '2026-10-10',
    title:   'Retrato na Terra Devastada Adaptada',
    items: [
      'Terra Devastada Adaptada: a ficha ganhou um quadro de foto, preso com fita, no topo, pra escolher a imagem do personagem (clique ou arraste uma imagem JPG, PNG ou WebP de até 2 MB). Dá pra trocar ou remover quando quiser.',
      'A imagem do personagem aparece nos cards do mestre e nas conversas do chat da campanha.',
    ],
  },
  {
    version: '1.29',
    date:    '2026-10-10',
    title:   'Qualidades e defeitos na Terra Devastada Adaptada',
    items: [
      'Terra Devastada Adaptada: as características fixas agora são duas listas, Qualidades (o que você tem de bom) e Defeitos (o que te atrapalha). Não há número limite no sistema: o Narrador diz na mesa quantas de cada o jogador escolhe. Fichas antigas passam a mostrar tudo como qualidades.',
      'Nos testes, as qualidades e os defeitos aparecem em grupos separados. O primeiro toque numa qualidade soma 1d; num defeito, tira 1d (um segundo toque inverte, porque um defeito às vezes ajuda).',
      'As perturbações que o Horror dá (leve e grave) entram na ficha como defeitos, e o suplemento dá uma qualidade nova.',
    ],
  },
  {
    version: '1.28',
    date:    '2026-10-10',
    title:   'Materiais em pedaços, furtividade e revista na Terra Devastada Adaptada',
    items: [
      'Terra Devastada Adaptada: trapos, álcool, lâminas, explosivos e sucata agora se acham em pedaços (meio trapo, 60% de um frasco...). 100% é um inteiro, e cabem até 3 de cada. Só dá pra fabricar com 100% de cada ingrediente, então os pedaços vão se somando pelo caminho; o que sobra continua guardado.',
      'Peças são sempre inteiras (valem no mínimo 1) e não têm limite, porque no jogo se acham aos montes. A Mochila agora só aumenta as balas, os kits médicos e os explosivos de arremesso.',
      'Furtividade (Terra Devastada Adaptada): o mestre controla o Alerta da cena (Oculto, Suspeito, Alertado, Caçado) e a Atenção do lugar numa barra no topo das Fichas; os jogadores veem o Alerta na própria ficha, ao vivo.',
      'Novo botão Furtividade na ficha: passar despercebido (teste contra a Atenção do lugar, com bônus de mato alto e agachado e penalidade de correr, luz forte e cão rastreando), escutar (cada ponto revela uma informação) e distrair (jogar um tijolo ou garrafa).',
      'Golpe furtivo no Atacar: com o alvo sem ter visto você e o Alerta até Suspeito, o ataque corpo a corpo não rola dado e derruba em silêncio quem tem Resistência até 2. A faca improvisada, que se gasta, derruba até Resistência 3 (o Estalador). Arma de fogo faz barulho demais pra isso.',
      'Novo botão Revistar na ficha (Terra Devastada Adaptada): teste contra a meta do Narrador (quão escondido está o que há) e a riqueza do lugar (Escasso, Comum, Rico). Falha não acha nada, sucesso parcial 1 achado, sucesso 2 (e mais um a cada 2 pares além da meta, até 4).',
      'Cada achado sai de uma tabela de d6: nada, trapos, álcool, lâminas ou explosivos, sucata, peça ou munição, e o raro (peça de arma, kit médico ou suplemento). Trapos, álcool, lâminas, explosivos e sucata vêm em pedaços de 25%, 50%, 75% ou 100%; peça vem sempre inteira. Você escolhe guardar ou deixar cada achado, e só cabe o que a Mochila e o teto de 3 permitem. Revistar faz barulho: o Narrador pode subir o Alerta.',
    ],
  },
  {
    version: '1.27',
    date:    '2026-10-10',
    title:   'Suprimentos na Terra Devastada Adaptada',
    items: [
      'Terra Devastada Adaptada: nova aba Suprimentos na ficha, com Mochila (nível 0 a 3), materiais (Trapos, Álcool, Sucata, Lâminas, Explosivos e Peças), kits médicos e suplementos. Nada sobra: cada material e as balas de cada arma cabem até 6, mais 3 por nível de Mochila.',
      'Fabricação: kit médico, coquetel molotov, bomba de pregos, bomba de fumaça e faca improvisada, com o custo à vista. O kit e o molotov gastam os mesmos materiais (Trapos + Álcool): curar ou atacar? Usar um kit devolve 3 de Vida.',
      'Munição e desgaste: arma de fogo gasta 1 bala por ataque, corpo a corpo gasta 1 uso e quebra quando acaba, e arremessos (molotov, granada) somem ao usar. O Atacar já desconta tudo e avisa no chat quanto sobrou; sem bala ou com a arma quebrada, o ataque não rola.',
      'Bancada: no Inventário, cada arma tem tipo, balas ou usos e até 3 melhorias (1 Peça + 1 Sucata cada), que dão +2 balas ou +2 usos e nunca mexem no dano.',
      'Suplementos: tomar um dá uma característica nova à escolha, que entra direto nas Características fixas.',
    ],
  },
  {
    version: '1.26',
    date:    '2026-10-10',
    title:   'Vida e combate na Terra Devastada Adaptada',
    items: [
      'Terra Devastada Adaptada: o personagem agora tem Vida, de 0 a 6, com trilha na ficha e uma faixa de estado (Inteiro, Machucado, Ferido, À beira da morte, Caído). Os cards do mestre também mostram a Vida de cada jogador.',
      'Armas passam a ter Dano fixo, de 1 a 6 (corpo a corpo 1, pistola e revólver 2, escopeta 3, rifle 4, especiais 5 e 6), e deixam de somar dados no teste. O teste diz se você acerta; a arma diz quanto tira. No Inventário, um seletor de "arma pronta" adiciona cano, pistola, escopeta, rifle, lança-chamas, granada e outras já com o dano certo.',
      'Novos botões Atacar e Esquivar na ficha. Atacar compara o seu desempenho com a Defesa do alvo e mostra se a arma mata (dano igual ou maior que a Resistência) ou quanto sobra de Resistência. Esquivar compara com a Ferocidade de quem ataca: desviou, leva 1 a menos (mínimo 1) ou leva o dano inteiro, que dá pra aplicar na Vida ali mesmo.',
      'Última chance: num golpe que derrubaria o personagem, dá pra gastar Convicção (o custo normal, igual ao Horror) e ficar com 1 de Vida. Tudo é anunciado no chat da campanha.',
      'Novo Bestiário (só o mestre) na Sessão das campanhas de Terra Devastada Adaptada: Corredor, Espreitador, Estalador, Cambaleante e Baiacu, mais humanos e um cão de rastreio, cada um com Dano, Resistência, Defesa e Ferocidade. Dá pra copiar uma criatura pra campanha e ajustar, ou criar as suas.',
    ],
  },
  {
    version: '1.25',
    date:    '2026-10-10',
    title:   'Terra Devastada Adaptada',
    items: [
      'Criar campanha: ao escolher Terra Devastada, abre uma janelinha com duas opções: a versão original (a que já existia) e a versão adaptada.',
      'Terra Devastada Adaptada: uma versão mexida do sistema, inspirada em The Last of Us. Começa com a mesma base de regras da original (testes de pares em d6, Horror, Convicção, características, condições, trunfos e inventário), mas com ficha própria.',
      'A ficha adaptada tem visual de The Last of Us Parte II: cores de carvão e osso com tarja vermelha, letras de menu condensadas, granulado de filme e anotações à mão, como num diário. No tema claro, vira papel de caderno.',
    ],
  },
  {
    version: '1.24',
    date:    '2026-10-06',
    title:   'Armas no manequim do Altherium',
    items: [
      'Ficha de Altherium: o manequim da aba Inventário agora segura as armas do personagem, cada uma com o seu próprio desenho — machado, martelo, espada, sabre, adagas, lanças, tridente, arcos, bestas, dardos e todas as outras do catálogo. A primeira arma vai numa mão, a segunda na outra e a terceira fica presa nas costas. As armas acompanham os braços quando você posa o manequim.',
      'Duas unidades da mesma arma vão uma em cada mão, e as Lâminas Gêmeas ocupam as duas mãos. Itens personalizados do tipo Arma ganham o desenho que combina com o nome (um "Machado do Norte" vira machado, uma "Katana" vira sabre…).',
      'Quem tem arco ou besta no inventário ganha uma aljava nas costas, com alça cruzando o peito — de flechas pro arco, de virotes pra besta. Se já tiver uma arma nas costas, a aljava vai pro outro ombro.',
    ],
  },
  {
    version: '1.23',
    date:    '2026-10-01',
    title:   'Artes e referências e Documentos na Mesa',
    items: [
      'Mesa: a galeria virou "Artes e referências" e agora aparece pra todos da campanha: mestre e jogadores enviam imagens (retratos, mapas, artes) pra mostrar como referência, cada uma com o nome de quem enviou. Os jogadores clicam pra ver grande.',
      'Mesa: nada entra na transmissão sozinho. Só o mestre põe uma imagem na mesa, clicando nela, inclusive as que os jogadores enviaram, que aparecem na hora pra ele com a marca "Nova". Cada um pode excluir o que enviou.',
      'Artes e referências também vão pra Galeria da campanha, e dá pra colocá-las no Quadro: pelo botão ▦ em cada arte na aba Mesa (vai pro quadro Geral, ao lado do que já tem lá) ou pelo novo botão "Artes e referências" na barra do Quadro (tecla G), que coloca a arte no meio da tela.',
      'Mesa (Altherium): nova seção Documentos. O mestre escreve cartas e livros em papel antigo, com letra à mão: 16 papéis (fotos reais de papel antigo e pergaminho, e papéis manchados de chá, café, mofo, cinzas, couro, sangue…), efeitos que se combinam (bordas queimadas leves ou fortes, rasgos, dobras, manchas), 7 cores de tinta e dezenas de letras manuscritas e caligráficas.',
      'Mesa (Altherium): o livro tem capa de couro com título dourado e as páginas viram em 3D: dá pra folhear com as setas, clicando na página ou pelas teclas ← →. Cada página pode ter o seu próprio papel e a sua própria letra.',
      'Mesa (Altherium): documentos nascem escondidos. O mestre libera quando os jogadores encontram, ou põe na transmissão. E, num livro, a página que o mestre vira, vira pra todos.',
      'Documentos: a escolha da letra virou uma caixa "Fontes" que abre um card com todas as letras à mão, cada uma escrita nela mesma, com busca pelo nome (antes a lista ficava espremida e as fontes não apareciam).',
      'Documentos: o livro novo começa pela capa: escolhe o título e o couro, e depois segue pras páginas (a capa fica sempre como primeira aba do editor).',
      'Documentos: no livro, o texto que não cabe numa página passa sozinho pra seguinte, e volta a subir quando você apaga e sobra espaço. Mudar a letra ou o tamanho redistribui as páginas. Na folha avulsa, aparece um aviso quando o texto passa do papel.',
      'Documentos: o editor ganhou um × no canto superior direito pra fechar (se tiver alteração sem salvar, ele pergunta antes).',
      'Documentos: a capa do livro na seção Documentos da Mesa agora aparece igual à do editor (o título ficava minúsculo), e a capa ganhou o nome do autor, gravado embaixo em dourado.',
      'Documentos: livro na transmissão: todo mundo cai na mesma página que o mestre, mesmo quem vê uma página por vez (celular) e o mestre vê duas. O jogador também pode folhear por conta própria e volta pra página do mestre quando ele virar. A última página em branco de um livro ímpar não ganha mais número.',
      'Documentos (correções): no livro com 200 páginas (o limite), o texto que passa da última não some mais; as setas ← → não viram ao mesmo tempo o livro da transmissão e o do leitor aberto por cima; ao trocar entre uma e duas páginas (girar o celular, redimensionar) o livro continua na mesma página; o leitor fecha sozinho se o documento for excluído ou escondido; o aviso de "texto passou da folha" mede a folha certa; Ctrl+S não salva duas vezes.',
      'Documentos: as páginas agora se escrevem direto no papel, como no Word: barra de formatação com letra e tamanho (com A+ e A−) só no trecho escolhido, negrito, itálico, sublinhado, tachado, cor da tinta, alinhar à esquerda/centro/direita/justificar, marcadores e numeração, recuo, espaçamento entre linhas e limpar formatação. Tab pula até a próxima parada (numa lista, desce um nível), colar mantém a formatação básica, e Ctrl+Z/Ctrl+Y desfazem e refazem. Atalhos do Word: Ctrl+B/I/U, Ctrl+E/L/R/J, Ctrl+] e Ctrl+[. Documentos antigos continuam iguais.',
      'Documentos: no livro, o texto formatado continua passando sozinho de uma página pra outra: um parágrafo ou item de lista cortado no meio continua na página seguinte sem repetir o marcador, a numeração segue, e tudo volta a se juntar quando sobra espaço.',
    ],
  },
  {
    version: '1.22',
    date:    '2026-10-01',
    title:   'Árvore genealógica e alinhamento de texto no Quadro',
    items: [
      'Quadro: nova linha em degrau (ângulos retos, cantos levemente arredondados), o formato clássico de árvore genealógica: ela sai do item, desce até o meio do caminho, anda na horizontal e entra no outro, e se refaz sozinha quando você mexe nos itens. Setas puxadas das bolinhas azuis já nascem assim, e o botão de degrau na barra da seta liga e desliga.',
      'Quadro: clicar (sem arrastar) numa bolinha azul agora também funciona: a linha sai presa no item; clique no outro item pra ligar, ou clique no caminho pra fazer quinas.',
      'Quadro: textos, post-its e formas agora têm alinhamento (à esquerda, no centro ou à direita) pelos três botões na barra da seleção.',
    ],
  },
  {
    version: '1.21',
    date:    '2026-10-01',
    title:   'Linha com quinas e grade com Shift no Quadro',
    items: [
      'Quadro: com a ferramenta Seta, agora dá pra fazer a linha com cliques: clique pra começar, clique de novo em cada lugar pra fazer uma quina reta, e termine com duplo clique, Enter, Esc ou clicando num item (a ponta se prende nele). Arrastar continua funcionando como antes.',
      'Quadro: novo botão na barra da seta pra alternar entre cantos retos e arredondados em linhas com quinas ou curvas.',
      'Quadro: segure Shift enquanto arrasta um item e aparece uma grade: o item encaixa nela, alinhado com os pontinhos do quadro. Soltando o Shift, a grade some e o item volta a andar livre.',
    ],
  },
  {
    version: '1.20',
    date:    '2026-10-01',
    title:   'Ligar itens do Quadro com setas',
    items: [
      'Quadro: ao selecionar uma imagem, post-it, forma, texto ou moldura, aparecem bolinhas azuis em volta (como no Miro). Arraste uma delas até outro item e nasce uma seta presa nos dois. O item de destino fica destacado enquanto você puxa, e a seta acompanha quando eles mudam de lugar. Bom pra árvores genealógicas e mapas de relações.',
    ],
  },
  {
    version: '1.19',
    date:    '2026-10-01',
    title:   'Galeria de todos',
    items: [
      'Galeria: agora é de todos da campanha: os jogadores também abrem os álbuns e veem as imagens da Mesa e as fotos do Quadro. Adicionar, excluir e levar pra outra campanha continua com o mestre, e as fotos do Escudo do mestre continuam só dele. Na aba Mesa, a seção de imagens passou a se chamar Galeria.',
    ],
  },
  {
    version: '1.18',
    date:    '2026-10-01',
    title:   'Biblioteca de todos, Escudo fechado, setas por cima e fontes no caderninho',
    items: [
      'Biblioteca: tudo que está na estante da campanha agora é de todos: os jogadores leem todos os arquivos, e não existe mais a opção de esconder. Arquivos que o mestre já tinha escondido continuam escondidos até ele clicar em "Mostrar aos jogadores".',
      'Escudo do mestre: fotos, PDFs e textos postos no Escudo agora ficam só no Escudo e não vão mais pra Galeria nem pra Biblioteca. Pra abrir um arquivo do Escudo, é só dar duplo clique nele.',
      'Quadro: setas agora ficam por cima dos post-its e dos outros itens quando são mais novas (antes ficavam sempre por trás), e "Trazer pra frente" e "Mandar pra trás" também valem pras setas.',
      'Meu caderninho: nova escolha de fonte na barra de formatação (o "Aa" no começo), com as mesmas 249 fontes do Google Fonts do Quadro, com busca pelo nome e categorias. A fonte vale pro trecho selecionado ou pro que for escrito a seguir, e o mestre vê a fonte escolhida.',
      'Quadro: depois de clicar num botão (como o dos dados), apertar Espaço com o mouse em cima do quadro agora arrasta o quadro na hora. Antes o botão ficava "aceso" e segurava o Espaço. Em qualquer botão do site, o Espaço também tira o destaque de seleção.',
      'Meu caderninho: clicar de novo num botão de formatação desliga ela: negrito, itálico, sublinhado e tachado agora desligam mesmo com o cursor parado (antes o segundo clique não tirava), e clicar na cor, no marca-texto, no tamanho ou na fonte que já está em uso volta ao normal. A cor e o marca-texto em uso aparecem marcados.',
    ],
  },
  {
    version: '1.17',
    date:    '2026-10-01',
    title:   'Setas com curva de vários pontos, caneta que arredonda o traço e Espaço sem apertar botões',
    items: [
      'Quadro: as setas agora curvam com quantos pontos você quiser. Selecione a seta e arraste uma das bolinhas vazias no meio de cada trecho: ela vira um ponto novo, e a seta passa suave por todos. Arraste os pontos (bolinhas cheias) pra ajustar, e dê duplo clique num ponto pra tirar ele. O botão de curva na barra deixa a seta reta de novo, e a curva acompanha quando os itens mudam de lugar.',
      'Quadro: a caneta agora arredonda o traço sozinha. Enquanto você desenha, a linha segue o mouse com uma folguinha que tira a tremedeira, e ao soltar o traço todo é alisado (curvas tortas viram curvas lisas, e um traço que termina perto do começo fecha certinho). Traços pequenos, como letras, são alisados de leve pra não perder a forma.',
      'No site todo, a tecla Espaço não aperta mais botão nenhum (antes, ela repetia o último botão clicado, como um botão do Quadro ao arrastar com Espaço). Em campos de texto o Espaço continua normal, e o Enter segue apertando botões.',
      'Quadro: trocar entre as abas Geral e Escudo do mestre ficou fluido: a aba escolhida sobe e acende, o quadro desliza do lado dela e o título troca suave. Voltar pra uma aba já aberta aparece na hora, sem "Abrindo o quadro…" (o que mudou chega por trás).',
    ],
  },
  {
    version: '1.16',
    date:    '2026-09-30',
    title:   'Fontes e setas curvas no Quadro, zoom suave e caderninho com Tab',
    items: [
      'Quadro: nova galeria de fontes com 249 fontes do Google Fonts: fantasia e medieval, terror, caligrafia, escrita à mão, clássicas, modernas, títulos chamativos e máquina de escrever/pixel. Selecione um post-it, texto, forma ou moldura e clique em "Aa" na barra da seleção; dá pra procurar pelo nome e filtrar por categoria, e todo mundo no quadro vê a fonte escolhida.',
      'Quadro: setas curvas. Selecione a seta e arraste a bolinha do meio pra curvar (ou use o botão de curva na barra); duplo clique na bolinha deixa reta de novo. A curva acompanha quando os itens mudam de lugar.',
      'Quadro: duplo clique (ou dois toques) agora sempre abre a edição do texto do item, com o cursor onde você clicou. Antes ele às vezes criava um post-it no lugar, e a edição começava com o texto todo selecionado (a primeira tecla apagava tudo). No espaço vazio, o duplo clique não cria mais post-it (use a ferramenta ou a tecla N).',
      'Quadro: zoom mais suave e controlado: a roda do mouse anda uns 10% por clique, girar rápido não arremessa mais o zoom pra longe ou pra perto demais, e o zoom vai de 15% a 300%.',
      'Meu caderninho: o Tab dentro da folha agora escreve uma tabulação, pra organizar eventos e listas (numa lista com marcadores, Tab desce um nível e Shift+Tab sobe). O caderno continua abrindo com Tab e agora fecha com Esc.',
      'Meu caderninho: corrigido o ">" (e o "<" e o "&") que virava "&gt;" ao colar ou escrever, principalmente no Firefox. As anotações que já tinham ficado assim voltam a mostrar o símbolo certo.',
      'Meu caderninho: com a internet lenta, um texto apagado podia voltar sozinho (e uma anotação apagada reaparecer) quando chegava uma versão antiga atrasada. Agora vale sempre a versão mais nova, e se não der pra apagar uma anotação o caderno avisa.',
    ],
  },
  {
    version: '1.15',
    date:    '2026-09-30',
    title:   'Episódios em janela, caderno com formatação, emojis e desvantagem nos domínios',
    items: [
      'Emojis completos, como no WhatsApp, no chat das campanhas (botão 😊 ao lado do campo de mensagem) e no Meu caderninho: todas as categorias, busca em português (dá pra procurar "coração", "kkk", "s2"…), tons de pele e "usados recentemente".',
      'Meu caderninho: nova barra de formatação: negrito, itálico, sublinhado, tachado, cor da letra, marca-texto, tamanho da letra (pequeno, normal, grande, enorme), listas com marcadores e numeradas, e limpar formatação. Ctrl+B, Ctrl+I e Ctrl+U também funcionam, e o mestre vê a formatação na página de anotações.',
      'Episódios: "Nova sessão" e "Editar" agora abrem numa janela no centro da tela, com o fundo embaçado, em vez de empurrar a lista pra baixo. Esc ou clique fora fecham se nada foi mudado; com alterações, feche pelo Cancelar ou pelo ×.',
      'Altherium, domínios: os pontos agora vão de −1 a 2, e depois do 2 tem o "+", uma caixinha menor que acende o 0, o 1 e o 2 e soma mais um dado (4d10). Nem o −1 nem o "+" gastam ponto de domínio.',
      'Altherium, domínios: o −1 marca desvantagem (1d de desvantagem, com "desv." nos dados e a linha avermelhada). Com um atributo em 0, os domínios dele começam com o −1 marcado; clicar no 0, 1, 2 ou "+" tira a desvantagem daquele domínio e usa os dados normais do número clicado.',
      'Altherium, domínios: no celular os botões descem pra uma linha própria e o nome do domínio aparece inteiro.',
    ],
  },
  {
    version: '1.14',
    date:    '2026-09-30',
    title:   'Quadro da campanha e aba Episódios',
    items: [
      'Nova aba Quadro em cada campanha: um quadro infinito, no estilo do Miro, no fundo azul do site com textura de pontinhos. Arraste com Espaço (ou a Mão) e dê zoom com a roda do mouse ou com dois dedos.',
      'No quadro: post-its coloridos (a letra se ajusta ao tamanho), textos, formas (retângulo, elipse, losango e triângulo), setas que ligam um item ao outro e acompanham quando eles mudam de lugar (com legenda, ponta dupla e tracejado), caneta pra desenhar à mão e molduras pra separar áreas, que levam junto tudo o que está dentro.',
      'Linha do tempo: coloque os eventos da campanha em ordem, com "quando" livre (um ano, uma sessão…), e reorganize quando quiser.',
      'Fotos arrastadas do computador ou coladas com Ctrl+V vão direto pra Galeria da campanha, e PDFs e textos pra Biblioteca (os jogadores também podem enviar por aqui); dá pra trazer pro quadro o que já está na estante, ampliar a imagem e abrir o arquivo na Biblioteca.',
      'Todo mundo edita junto e em tempo real: você vê o cursor e o nome de quem está no quadro, e as mudanças dos outros aparecem na hora.',
      'Selecione vários com Shift ou arrastando uma área; copiar, colar, duplicar, desfazer e refazer, trazer pra frente e mandar pra trás. Duplo clique no vazio cria um post-it.',
      'O mestre pode trancar um item (um mapa de fundo, por exemplo): aí só ele mexe. Tem tela cheia, "ver tudo", atalho pras molduras e a lista de atalhos no botão "?".',
      'Escudo do mestre: o mestre tem uma segunda aba no Quadro, em cima do quadro como uma aba de navegador. É um quadro infinito igual ao geral, mas só os mestres veem; fotos postas nele vão pra Galeria do mestre, e arquivos ficam escondidos dos jogadores na Biblioteca.',
      'A aba Sessões da campanha agora se chama Episódios (o card da Visão geral também).',
      'Na barra lateral da campanha, Configurações agora fica sempre por último.',
      'Caderno de anotações: agora dá pra pôr imagens (colando com Ctrl+V, arrastando pra folha ou pelo botão de imagem) e emojis (botão 😊, que põe o emoji onde está o cursor). As imagens aparecem embaixo da anotação, ampliam com um clique e seguem privadas: só quem escreveu e os mestres da campanha veem.',
      'Caderno de anotações: arraste a alça no topo da janela pra deixá-la mais alta (até quase o topo da tela). O tamanho fica guardado; duplo clique na alça volta ao normal.',
      'A janela do caderno agora se chama "Meu caderninho" pra quem escreve. Pro mestre, a seção na barra lateral continua com o nome do caderno do jogador.',
      'Corrigido: abrir o caderno (a pena) com a página de anotações dos jogadores aberta deixava a tela vazia. A mesma falha podia acontecer em outras telas que se atualizam em tempo real (dados, iniciativa, fichas, atividade) quando duas delas ficavam abertas juntas.',
      'Textos acertados: o caderno fala em episódio ("Sem episódio definido"), e a página inicial, a Sobre, a Ajuda e a Privacidade agora mostram o Quadro e o chat no botão do canto.',
    ],
  },
  {
    version: '1.13',
    date:    '2026-09-30',
    title:   'Caderno de anotações',
    items: [
      'Novo caderno de anotações por sessão, liberado por conta: um botão verde com uma pena ao lado do chat abre uma folha pautada já na sessão do dia, e cada anotação salva sozinha enquanto você escreve.',
      'Dá pra ter várias anotações por sessão, trocar de sessão, voltar e editar depois, ou apagar.',
      'Atalho: Tab abre o caderno com o cursor na folha e Tab de novo fecha (dentro de outros campos de texto, o Tab continua normal). Ao abrir, a pena rabisca como se estivesse escrevendo.',
      'O caderno é privado: só quem escreve e os mestres da campanha leem. O mestre tem uma seção própria na barra lateral da campanha, com as anotações separadas por sessão, e também pode editá-las.',
    ],
  },
  {
    version: '1.12',
    date:    '2026-09-30',
    title:   'Mesa mais estável e livro mais fluido',
    items: [
      'Mesa: corrigida uma falha em que partes da negociação da conexão se perdiam quando chegavam antes da hora, deixando o jogador preso em "Reconectando…".',
      'Enquanto a transmissão não abre, o jogador vê "Detalhes da conexão": se a oferta do mestre chegou, se a rede ligou e por qual rota. Ajuda a descobrir o que está travando.',
      'Livro de regras mais leve de rolar: as páginas foram preparadas pra o leitor desenhar bem mais rápido (a página mais pesada caiu de 151 ms pra 58 ms), com a mesma aparência e a busca de texto funcionando.',
    ],
  },
  {
    version: '1.11',
    date:    '2026-09-30',
    title:   'Correções no Firefox',
    items: [
      'Firefox: corrigido um erro no login que atrapalhava o site e a conexão da transmissão da Mesa.',
    ],
  },
  {
    version: '1.9',
    date:    '2026-09-29',
    title:   'Inspirações Skald, habilidades de gênesis e triunfos recentes',
    items: [
      'Altherium: nova aba Inspirações, com cards de Inspirações Skald criados pelo jogador (nome, custo, teste, ação, distância e descrição). "Usar" avisa a mesa.',
      'Na aba Atributos, o quadro Gênesis mostra o efeito do livro e guarda as habilidades de gênesis que o mestre der ao personagem.',
      'Triunfos do Pilar separados em grupos de 1, 2, 3 e 4 combinações, com cartinhas em leque no cabeçalho de cada grupo.',
      'Manequim do Pilar: as tranças ficam presas na cabeça e acompanham quando ela gira; batem na cabeça, nos ombros e nos braços em vez de atravessar, ficam apoiadas no ombro caindo pela frente, e balançam quando o boneco cai sem pernas, levanta ou quando um braço esbarra nelas.',
      'Seção Recentes no topo dos triunfos das três raízes (Berserker, Runaskin com trilha e runas, e Pilar): os 4 últimos que você usou, pra achar rápido sem perder a lista toda.',
    ],
  },
  {
    version: '1.8',
    date:    '2026-09-28',
    title:   'Triunfos em ordem e painel interno de suporte',
    items: [
      'Altherium: triunfos do Pilar agora aparecem por número de combinações, de 1 a 4 (e em ordem alfabética dentro de cada uma); os do Berserker e do Runaskin (trilha e runas descobertas) ficam em ordem alfabética.',
      'Quem desenvolve o Vorterium ganhou um painel interno pra investigar problemas relatados e acompanhar o feedback enviado. O acesso é só de leitura; os detalhes estão na página de Privacidade.',
    ],
  },
  {
    version: '1.7',
    date:    '2026-09-25',
    title:   'Chat flutuante, biblioteca de estantes e galeria de lembranças',
    items: [
      'Galeria virou um mural de álbuns: um card por campanha, com as fotos em pilha que se abrem em leque.',
      'Ao abrir um álbum, as imagens da Mesa aparecem como polaroides, separadas pelo dia em que foram mostradas, com legenda à mão.',
      'Clique numa lembrança pra ver grande, passar com as setas, levar pra outra campanha ou excluir; "Adicionar lembranças" guarda novas fotos direto no álbum.',
      'O chat saiu da aba Sessão e virou um botão branco de mensagem ao lado do dado: abre uma janela de conversa logo acima dele, em qualquer tela da campanha.',
      'Na janela do chat, as conversas ficam numa coluna à esquerda, só com bolinhas: a Mesa, o retrato do personagem de cada jogador (ou a inicial dele) e a coroa do mestre. Passe o mouse pra ver o nome.',
      'Mensagens do chat são avisadas só pelo botão de mensagem: o aviso de mensagem nova aparece logo acima dele e o número de não lidas sobe na hora. O sino não mostra mais mensagens.',
      'Chat, dados e notificações abrem no mesmo lugar e do mesmo tamanho, e só um fica aberto por vez: apertar outro botão fecha o anterior na hora.',
      'Com uma dessas janelas aberta, os avisos (resultado da rolagem, notificação, transmissão da Mesa) aparecem logo acima dela, sem cobrir nada, em vez de ficarem escondidos atrás; enquanto houver aviso, a janela encolhe um pouco pra dar espaço.',
      'Biblioteca virou uma sala de estantes: um livro por campanha, que se abre ao passar o mouse, e mais a estante dos livros de regras.',
      'Abrindo a estante aparecem os arquivos da campanha, cada um como card: PDFs, imagens e textos. Os livros de regras ficam na estante deles.',
      'Clicando num arquivo, ele abre no próprio site: PDF no leitor, imagem grande, texto como uma folha de papel. Dá pra passar pro anterior ou próximo, abrir em nova aba ou baixar.',
      'O mestre guarda livros e documentos na estante (arrastando os arquivos ou em "Adicionar arquivos", até 25 MB), renomeia, exclui e pode esconder um arquivo dos jogadores.',
      'Ponteiro do mouse próprio do Vorterium: uma seta branca pequena, com brilho e sombra.',
      'Sobre botões e links a seta fica dourada; ao apertar o botão do mouse ela encolhe, e o clique abre um anel dourado.',
    ],
  },
  {
    version: '1.6',
    date:    '2026-09-22',
    title:   'Ferramentas no menu',
    items: [
      'Biblioteca: os livros de regras abertos direto do menu, sem entrar numa campanha.',
      'Meu bestiário: guarde criaturas pra usar em qualquer campanha e copie pro bestiário de uma campanha.',
      'Galeria: todas as imagens que você já mostrou na Mesa, pra abrir ou copiar pra outra campanha.',
      'Novidades (esta página), Ajuda e Enviar feedback no menu.',
      'Bestiário: ponha criaturas na iniciativa, com quantidade e numeração ("Lobo 1", "Lobo 2"…).',
    ],
  },
  {
    version: '1.5',
    date:    '2026-09-18',
    title:   'Ajustes da ficha Altherium',
    items: [
      'O joelho do boneco dobra pro lado certo.',
      'Domínios contam os ganhos de nível (Berserker +1, Runaskin +2, Pilar +3 por nível).',
      'O gênesis soma +1d10 no domínio dele (Robusto em Resiliência, por exemplo).',
      'PR, FV e Cartas aparecem no cabeçalho da ficha, embaixo do PE.',
      'Runaskin: foto própria nos triunfos iniciais da trilha.',
    ],
  },
  {
    version: '1.4',
    date:    '2026-09-15',
    title:   'Terra Devastada',
    items: [
      'Novo sistema: Terra Devastada, com ficha de características, condições, trunfos e inventário.',
      'Testes de pares em d6 (todo 6 rola de novo), Horror, Convicção e cena de horror calculada.',
      'Atividade detalhada pro mestre: cada mudança nas fichas Altherium com antes e depois.',
    ],
  },
  {
    version: '1.3',
    date:    '2026-09-11',
    title:   'Pilar e Runaskin',
    items: [
      'Pilar: triunfos pedem combinações de naipe, com baralho virtual (uma carta por vez) ou cartas físicas.',
      'Runaskin: triunfos iniciais da trilha editáveis na ficha.',
    ],
  },
  {
    version: '1.2',
    date:    '2026-09-08',
    title:   'Mesa ao vivo',
    items: [
      'Aba Mesa: o mestre transmite a tela com som, a 30 fps.',
      'Ponteiro, pausa, trocar de tela, galeria de imagens e aviso de "ao vivo" em qualquer página.',
      'Bestiário do mestre com vida e dano calculados pelas fichas do grupo.',
      'Aba Livro com o livro de regras de Altherium.',
    ],
  },
  {
    version: '1.1',
    date:    '2026-09-04',
    title:   'Ficha Altherium completa',
    items: [
      'Triunfos de Berserker, Runaskin e Pilar, inventário com itens personalizados e salvamento automático.',
      'Manequim de proteção e de dano, gráfico de atributos e barras arrastáveis.',
      'Versão pra celular e animações no site todo.',
    ],
  },
]

export const APP_VERSION = CHANGELOG[0].version

const SEEN_KEY = 'vorterium:novidades-vistas'

/** A pessoa já abriu a página Novidades desde a versão atual? */
export function hasUnseenChangelog(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== APP_VERSION
  } catch {
    return false
  }
}

const SEEN_EVENT = 'vorterium:novidades-vistas'

export function markChangelogSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, APP_VERSION)
  } catch {
    /* sem armazenamento: o ponto só continua aparecendo */
  }
  window.dispatchEvent(new Event(SEEN_EVENT))
}

/** Ponto de "novidade" no menu — some assim que a página é aberta. */
export function useUnseenChangelog(): boolean {
  const [unseen, setUnseen] = useState(hasUnseenChangelog)
  useEffect(() => {
    const onSeen = () => setUnseen(hasUnseenChangelog())
    // A página Novidades pode ter marcado antes deste efeito rodar (o
    // efeito do filho roda antes do do pai) — confere de novo ao montar.
    onSeen()
    window.addEventListener(SEEN_EVENT, onSeen)
    return () => window.removeEventListener(SEEN_EVENT, onSeen)
  }, [])
  return unseen
}
