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
    version: '1.24',
    date:    '2026-10-03',
    title:   'Dois jogos de enigma pra sessão: O Livro Bloqueado e A Torre do Observatório',
    items: [
      'Novos joguinhos em pixel art pra jogar no meio da sessão, por cima do site: o mestre abre na campanha, escolhe quem joga, e o jogo cobre a tela de todo mundo dela. Quem não joga assiste ao vivo, com a tela dividida mostrando os dois jogadores.',
      'O Livro Bloqueado: uma biblioteca trancada com um castiçal, um retrato, um astrolábio, uma estante e o livro preso por correntes no pedestal. Cada partida tem um segredo novo. Quem assiste vê na hora o que a dupla escolhe, o que digita e por onde passa a lupa no retrato.',
      'A Torre do Observatório: pra exatamente 2 jogadores, um em cada andar da torre. Eles não se veem e só se ouvem — o que um enxerga, o outro precisa pra avançar, então tudo depende de falar pela voz.',
      'Os dois jogos têm sons (passos, cliques, velas, engrenagens, um fundo de vento e máquinas), que dá pra desligar no menu ≡, e funcionam no celular (de preferência deitado).',
      'Pro mestre: painel com o andamento, dicas prontas pela etapa em que a dupla está (ou escritas na hora, que aparecem pra todos por 25 s), a solução da partida, a linha do tempo do que cada um fez e o botão Recomeçar. Se o mestre estiver jogando, a solução nem chega ao navegador dele.',
      'Dá pra trocar de um jogo pro outro pelo menu ≡ no meio da sessão: o jogo que sai fica pausado (o relógio para) e, ao voltar, tudo está onde parou — posição dos bonecos, janela aberta, luzes e progresso.',
    ],
  },
  {
    version: '1.23',
    date:    '2026-10-01',
    title:   'Artes e referências e Documentos na Mesa',
    items: [
      'Mesa: a galeria virou "Artes e referências" e agora aparece pra todos da campanha — mestre e jogadores enviam imagens (retratos, mapas, artes) pra mostrar como referência, cada uma com o nome de quem enviou. Os jogadores clicam pra ver grande.',
      'Mesa: nada entra na transmissão sozinho. Só o mestre põe uma imagem na mesa, clicando nela — inclusive as que os jogadores enviaram, que aparecem na hora pra ele com a marca "Nova". Cada um pode excluir o que enviou.',
      'Artes e referências também vão pra Galeria da campanha, e dá pra colocá-las no Quadro: pelo botão ▦ em cada arte na aba Mesa (vai pro quadro Geral, ao lado do que já tem lá) ou pelo novo botão "Artes e referências" na barra do Quadro (tecla G), que coloca a arte no meio da tela.',
      'Mesa (Altherium): nova seção Documentos. O mestre escreve cartas e livros em papel antigo, com letra à mão — 16 papéis (fotos reais de papel antigo e pergaminho, e papéis manchados de chá, café, mofo, cinzas, couro, sangue…), efeitos que se combinam (bordas queimadas leves ou fortes, rasgos, dobras, manchas), 7 cores de tinta e dezenas de letras manuscritas e caligráficas.',
      'Mesa (Altherium): o livro tem capa de couro com título dourado e as páginas viram em 3D — dá pra folhear com as setas, clicando na página ou pelas teclas ← →. Cada página pode ter o seu próprio papel e a sua própria letra.',
      'Mesa (Altherium): documentos nascem escondidos. O mestre libera quando os jogadores encontram, ou põe na transmissão — e, num livro, a página que o mestre vira, vira pra todos.',
      'Documentos: a escolha da letra virou uma caixa "Fontes" que abre um card com todas as letras à mão, cada uma escrita nela mesma, com busca pelo nome (antes a lista ficava espremida e as fontes não apareciam).',
      'Documentos: o livro novo começa pela capa — escolhe o título e o couro, e depois segue pras páginas (a capa fica sempre como primeira aba do editor).',
      'Documentos: no livro, o texto que não cabe numa página passa sozinho pra seguinte, e volta a subir quando você apaga e sobra espaço. Mudar a letra ou o tamanho redistribui as páginas. Na folha avulsa, aparece um aviso quando o texto passa do papel.',
      'Documentos: o editor ganhou um × no canto superior direito pra fechar (se tiver alteração sem salvar, ele pergunta antes).',
      'Documentos: a capa do livro na seção Documentos da Mesa agora aparece igual à do editor (o título ficava minúsculo), e a capa ganhou o nome do autor, gravado embaixo em dourado.',
      'Documentos: livro na transmissão — todo mundo cai na mesma página que o mestre, mesmo quem vê uma página por vez (celular) e o mestre vê duas. O jogador também pode folhear por conta própria e volta pra página do mestre quando ele virar. A última página em branco de um livro ímpar não ganha mais número.',
      'Documentos (correções): no livro com 200 páginas (o limite), o texto que passa da última não some mais; as setas ← → não viram ao mesmo tempo o livro da transmissão e o do leitor aberto por cima; ao trocar entre uma e duas páginas (girar o celular, redimensionar) o livro continua na mesma página; o leitor fecha sozinho se o documento for excluído ou escondido; o aviso de "texto passou da folha" mede a folha certa; Ctrl+S não salva duas vezes.',
      'Documentos: as páginas agora se escrevem direto no papel, como no Word — barra de formatação com letra e tamanho (com A+ e A−) só no trecho escolhido, negrito, itálico, sublinhado, tachado, cor da tinta, alinhar à esquerda/centro/direita/justificar, marcadores e numeração, recuo, espaçamento entre linhas e limpar formatação. Tab pula até a próxima parada (numa lista, desce um nível), colar mantém a formatação básica, e Ctrl+Z/Ctrl+Y desfazem e refazem. Atalhos do Word: Ctrl+B/I/U, Ctrl+E/L/R/J, Ctrl+] e Ctrl+[. Documentos antigos continuam iguais.',
      'Documentos: no livro, o texto formatado continua passando sozinho de uma página pra outra — um parágrafo ou item de lista cortado no meio continua na página seguinte sem repetir o marcador, a numeração segue, e tudo volta a se juntar quando sobra espaço.',
    ],
  },
  {
    version: '1.22',
    date:    '2026-10-01',
    title:   'Árvore genealógica e alinhamento de texto no Quadro',
    items: [
      'Quadro: nova linha em degrau (ângulos retos, cantos levemente arredondados), o formato clássico de árvore genealógica — ela sai do item, desce até o meio do caminho, anda na horizontal e entra no outro, e se refaz sozinha quando você mexe nos itens. Setas puxadas das bolinhas azuis já nascem assim, e o botão de degrau na barra da seta liga e desliga.',
      'Quadro: clicar (sem arrastar) numa bolinha azul agora também funciona — a linha sai presa no item; clique no outro item pra ligar, ou clique no caminho pra fazer quinas.',
      'Quadro: textos, post-its e formas agora têm alinhamento — à esquerda, no centro ou à direita — pelos três botões na barra da seleção.',
    ],
  },
  {
    version: '1.21',
    date:    '2026-10-01',
    title:   'Linha com quinas e grade com Shift no Quadro',
    items: [
      'Quadro: com a ferramenta Seta, agora dá pra fazer a linha com cliques — clique pra começar, clique de novo em cada lugar pra fazer uma quina reta, e termine com duplo clique, Enter, Esc ou clicando num item (a ponta se prende nele). Arrastar continua funcionando como antes.',
      'Quadro: novo botão na barra da seta pra alternar entre cantos retos e arredondados em linhas com quinas ou curvas.',
      'Quadro: segure Shift enquanto arrasta um item e aparece uma grade — o item encaixa nela, alinhado com os pontinhos do quadro. Soltando o Shift, a grade some e o item volta a andar livre.',
    ],
  },
  {
    version: '1.20',
    date:    '2026-10-01',
    title:   'Ligar itens do Quadro com setas',
    items: [
      'Quadro: ao selecionar uma imagem, post-it, forma, texto ou moldura, aparecem bolinhas azuis em volta (como no Miro). Arraste uma delas até outro item e nasce uma seta presa nos dois — o item de destino fica destacado enquanto você puxa, e a seta acompanha quando eles mudam de lugar. Bom pra árvores genealógicas e mapas de relações.',
    ],
  },
  {
    version: '1.19',
    date:    '2026-10-01',
    title:   'Galeria de todos',
    items: [
      'Galeria: agora é de todos da campanha — os jogadores também abrem os álbuns e veem as imagens da Mesa e as fotos do Quadro. Adicionar, excluir e levar pra outra campanha continua com o mestre, e as fotos do Escudo do mestre continuam só dele. Na aba Mesa, a seção de imagens passou a se chamar Galeria.',
    ],
  },
  {
    version: '1.18',
    date:    '2026-10-01',
    title:   'Biblioteca de todos, Escudo fechado, setas por cima e fontes no caderninho',
    items: [
      'Biblioteca: tudo que está na estante da campanha agora é de todos — os jogadores leem todos os arquivos, e não existe mais a opção de esconder. Arquivos que o mestre já tinha escondido continuam escondidos até ele clicar em "Mostrar aos jogadores".',
      'Escudo do mestre: fotos, PDFs e textos postos no Escudo agora ficam só no Escudo — não vão mais pra Galeria nem pra Biblioteca. Pra abrir um arquivo do Escudo, é só dar duplo clique nele.',
      'Quadro: setas agora ficam por cima dos post-its e dos outros itens quando são mais novas (antes ficavam sempre por trás), e "Trazer pra frente" e "Mandar pra trás" também valem pras setas.',
      'Meu caderninho: nova escolha de fonte na barra de formatação (o "Aa" no começo), com as mesmas 249 fontes do Google Fonts do Quadro — busca pelo nome e categorias. A fonte vale pro trecho selecionado ou pro que for escrito a seguir, e o mestre vê a fonte escolhida.',
      'Quadro: depois de clicar num botão (como o dos dados), apertar Espaço com o mouse em cima do quadro agora arrasta o quadro na hora — antes o botão ficava "aceso" e segurava o Espaço. Em qualquer botão do site, o Espaço também tira o destaque de seleção.',
      'Meu caderninho: clicar de novo num botão de formatação desliga ela — negrito, itálico, sublinhado e tachado agora desligam mesmo com o cursor parado (antes o segundo clique não tirava), e clicar na cor, no marca-texto, no tamanho ou na fonte que já está em uso volta ao normal. A cor e o marca-texto em uso aparecem marcados.',
    ],
  },
  {
    version: '1.17',
    date:    '2026-10-01',
    title:   'Setas com curva de vários pontos, caneta que arredonda o traço e Espaço sem apertar botões',
    items: [
      'Quadro: as setas agora curvam com quantos pontos você quiser. Selecione a seta e arraste uma das bolinhas vazias no meio de cada trecho: ela vira um ponto novo, e a seta passa suave por todos. Arraste os pontos (bolinhas cheias) pra ajustar, e dê duplo clique num ponto pra tirar ele. O botão de curva na barra deixa a seta reta de novo, e a curva acompanha quando os itens mudam de lugar.',
      'Quadro: a caneta agora arredonda o traço sozinha. Enquanto você desenha, a linha segue o mouse com uma folguinha que tira a tremedeira, e ao soltar o traço todo é alisado (curvas tortas viram curvas lisas, e um traço que termina perto do começo fecha certinho). Traços pequenos, como letras, são alisados de leve pra não perder a forma.',
      'No site todo, a tecla Espaço não aperta mais botão nenhum (antes, ela repetia o último botão clicado — como um botão do Quadro ao arrastar com Espaço). Em campos de texto o Espaço continua normal, e o Enter segue apertando botões.',
      'Quadro: trocar entre as abas Geral e Escudo do mestre ficou fluido — a aba escolhida sobe e acende, o quadro desliza do lado dela e o título troca suave. Voltar pra uma aba já aberta aparece na hora, sem "Abrindo o quadro…" (o que mudou chega por trás).',
    ],
  },
  {
    version: '1.16',
    date:    '2026-09-30',
    title:   'Fontes e setas curvas no Quadro, zoom suave e caderninho com Tab',
    items: [
      'Quadro: nova galeria de fontes com 249 fontes do Google Fonts — fantasia e medieval, terror, caligrafia, escrita à mão, clássicas, modernas, títulos chamativos e máquina de escrever/pixel. Selecione um post-it, texto, forma ou moldura e clique em "Aa" na barra da seleção; dá pra procurar pelo nome e filtrar por categoria, e todo mundo no quadro vê a fonte escolhida.',
      'Quadro: setas curvas. Selecione a seta e arraste a bolinha do meio pra curvar (ou use o botão de curva na barra); duplo clique na bolinha deixa reta de novo. A curva acompanha quando os itens mudam de lugar.',
      'Quadro: duplo clique (ou dois toques) agora sempre abre a edição do texto do item, com o cursor onde você clicou — antes ele às vezes criava um post-it no lugar, e a edição começava com o texto todo selecionado (a primeira tecla apagava tudo). No espaço vazio, o duplo clique não cria mais post-it (use a ferramenta ou a tecla N).',
      'Quadro: zoom mais suave e controlado — a roda do mouse anda uns 10% por clique, girar rápido não arremessa mais o zoom pra longe ou pra perto demais, e o zoom vai de 15% a 300%.',
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
      'Meu caderninho: nova barra de formatação — negrito, itálico, sublinhado, tachado, cor da letra, marca-texto, tamanho da letra (pequeno, normal, grande, enorme), listas com marcadores e numeradas, e limpar formatação. Ctrl+B, Ctrl+I e Ctrl+U também funcionam, e o mestre vê a formatação na página de anotações.',
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
      'Enquanto a transmissão não abre, o jogador vê "Detalhes da conexão": se a oferta do mestre chegou, se a rede ligou e por qual rota — ajuda a descobrir o que está travando.',
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
      'Seção Recentes no topo dos triunfos das três raízes (Berserker, Runaskin — trilha e runas — e Pilar): os 4 últimos que você usou, pra achar rápido sem perder a lista toda.',
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
