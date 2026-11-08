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
    version: '2.27',
    date:    '2026-11-07',
    title:   'Vortable: NPC solto na garupa continua na garupa',
    items: [
      'O NPC que o mestre controla agora pode ir na garupa de um NPC que está parado montado (perto dele aparece Montar na garupa). Ao soltar, ele continua sentado atrás, parado junto, e isso fica guardado na zona e todos veem. Antes ele descia ao ser solto. Controlar o NPC da garupa faz ele descer ao lado; controlar o NPC que conduz também faz quem está atrás descer.',
      'Quando os NPCs seguem um jogador, quem está na garupa vai junto com quem o conduz. Se o condutor não estiver entre os que seguem, quem está atrás fica sentado onde está.',
      'Na garupa de um animal conduzido por um jogador (que anda por conta própria) o NPC ainda desce ao ser solto, porque o animal não fica parado.',
      'Se o mestre soltar um NPC que estava parado montado antes de ele terminar de montar de novo, o animal não se perde mais.',
    ],
  },
  {
    version: '2.26',
    date:    '2026-11-07',
    title:   'Vortable: NPC que segue alguém continua montado',
    items: [
      'Quando os NPCs seguem um jogador, o NPC que estava montado num cavalo ou lobo segue montado: a sala vê o cavaleiro em cima do animal andando e correndo atrás do jogador, e ao parar o conjunto fica guardado na zona como estava.',
    ],
  },
  {
    version: '2.25',
    date:    '2026-11-07',
    title:   'Vortable: cavalo atravessa saídas e NPCs não voltam mais pro lugar antigo',
    items: [
      'Quem atravessa uma saída montado num cavalo ou lobo agora leva o animal junto: ele sai da zona de onde veio e aparece na nova, e o cavaleiro já chega montado. Vale pro jogador e pro NPC que o mestre controla. Antes ele descia do animal antes de passar e o animal ficava pra trás.',
      'Sair do Vortable (por exemplo pra minimizar) e voltar reiniciava o jogo e os NPCs podiam aparecer onde estavam antes. O motivo era uma corrida: o jogo lia a zona do banco antes de a gravação da posição dos NPCs terminar. Agora o jogo espera as gravações pendentes (NPC solto, seguidores que pararam, mudança de zona) antes de ler.',
      'Também passou a ficar guardado na zona o lugar onde um jogador larga um cavalo (o mestre grava quando a câmera dele está nessa zona), e o animal que mudou de zona com o cavaleiro. Se ninguém do mestre estiver com o controle aberto, o ponto onde um jogador largou um cavalo só vale até a página recarregar.',
    ],
  },
  {
    version: '2.24',
    date:    '2026-11-07',
    title:   'Vortable: NPC solto continua montado',
    items: [
      'Quando o mestre solta um NPC que está montado num cavalo ou num lobo gigante, o NPC agora continua montado: ele e o animal ficam parados juntos no mesmo ponto, com o cavaleiro por cima, e todos na sala veem na hora. Antes ele descia do animal ao ser solto.',
      'Fica guardado na zona: ao recarregar ou entrar depois, o NPC segue montado onde foi deixado. Controlar esse NPC de novo já o põe montado, e ao desmontar o animal volta a ser um NPC da zona (e isso também fica guardado). Soltar o NPC a pé não muda nada. Quem vai na garupa de um animal conduzido por jogador continua descendo ao ser solto.',
      'Também corrigi um detalhe: o botão Desmontar ficava na tela depois de soltar o NPC.',
    ],
  },
  {
    version: '2.23',
    date:    '2026-11-07',
    title:   'Vortable: lobo gigante',
    items: [
      'Novo corpo no criador de personagem: o Lobo gigante (aba Corpo, grupo Pós-apocalipse), feito a partir do desenho do lobo branco de olhos de gelo. Pelo branco farto e arrepiado, mancha cinza no olho e no focinho, cicatriz rosa no rosto, rabo cinza peludo e o amuleto redondo no cordão do peito. Anda, corre e fica parado nas quatro direções, e vem em três pelagens: Ártico (a do desenho), Cinzento e Negro.',
      'Ele é grande de propósito: usa a altura de gigante (1,9), então, de quatro patas, fica umas 2 vezes maior que uma pessoa.',
      'No controle ao vivo, o painel Animais ganhou o Lobo gigante ao lado de Cavalo e Cachorro: o mestre põe na cena (já no tamanho certo), arrasta pro mapa e controla como um NPC.',
      'Dá pra montar no lobo gigante igual ao cavalo: chegando perto aparece Montar (E), o cavaleiro sobe nas costas do lobo (que segue enorme e fica um pouco mais rápido que o cavalo), os outros jogadores veem, e dois cabem nele: o segundo vai na garupa. Vale pro jogador e pro NPC que o mestre controla. Desmontar, passar por uma saída ou soltar o NPC descem como no cavalo.',
    ],
  },
  {
    version: '2.22',
    date:    '2026-11-07',
    title:   'Dados 3D: modo leve no celular',
    items: [
      'Os dados 3D apareciam pretos em alguns celulares. Agora, em tela de toque (e em aparelhos com pouca memória), os dados usam um modo leve: texturas com metade do lado (um quarto da memória), material mais simples, sem sombra em tempo real e sem a tela de brilho nos conjuntos que não brilham. O visual segue o mesmo (madeira, granito, plástico e a resina), só com um pouco menos de verniz e sem a sombra projetada. No computador nada muda. Se ainda aparecer preto, dá pra testar abrindo o site com ?dados=leve (ou ?dados=completo pra forçar o modo antigo) e me dizer qual celular e navegador é.',
    ],
  },
  {
    version: '2.21',
    date:    '2026-11-07',
    title:   'Vortable: personagens dos jogadores como NPC do mestre',
    items: [
      'No controle ao vivo, o Gerador de NPCs ganhou a aba Jogadores: ela lista os personagens de Vortable da campanha (os que os jogadores estão usando primeiro, com o nome de quem joga, depois os que ficaram sem jogador). Cada um tem Colocar (entra em cena como um NPC com o mesmo boneco e nome), Colocar e controlar (entra e o mestre já assume o controle) e dá pra arrastar pro mapa. Depois de em cena ele aparece na aba Na zona, com Controlar e Tirar, e o mestre anda com ele como qualquer NPC, inclusive montar em cavalo. É uma cópia: o jogador de verdade e a ficha dele não são afetados.',
    ],
  },
  {
    version: '2.20',
    date:    '2026-11-07',
    title:   'Vortable: Ventania bem mais forte',
    items: [
      'A força Ventania do vento (no controle do mestre e no editor) ficou muito mais potente. Árvores, arbustos, plantas e a grama entortam mais de duas vezes o que antes, as rajadas atravessam o mapa mais rápidas e quase sem pausa, saem muito mais folhas das copas e entram folhas soltas pelo lado de onde vem o vento (que também correm mais pelo chão), as nuvens e as manchas de sol andam mais depressa e o som do vento sobe. Parado e Brisa continuam exatamente como eram, e o efeito cresce aos poucos conforme o controle de vento passa da metade.',
    ],
  },
  {
    version: '2.19',
    date:    '2026-11-07',
    title:   'Vortable: montaria pro NPC do mestre e dois no cavalo',
    items: [
      'O mestre controlando um NPC agora também monta: chegando perto de um cavalo aparece o botão Montar (e a tecla E), o NPC vai por cima do cavalo, mais rápido, e os jogadores o veem montado. Antes só o jogador comum conseguia, e na câmera do mestre o botão nem existia. Desmontar, passar por uma saída, soltar o NPC ou transformá-lo em rato também descem do cavalo.',
      'Perto do cavalo agora aparece também um aviso Montar (E) em cima dele, no próprio mapa, que dá pra clicar ou tocar; assim ele não depende do botão da tela, que podia ficar escondido atrás de outros elementos.',
      'Dois no cavalo: quem monta primeiro conduz. Outro jogador (ou um NPC do mestre, no caso do condutor ser um NPC) chega perto de um cavalo já montado e vê Montar na garupa: ele vai sentado atrás, sem controlar, e anda junto. A garupa tem um lugar só. Se o condutor desce, o da garupa desce junto; ele também pode descer sozinho (Descer ou E).',
      'O NPC que o mestre controla também pode ir na garupa: perto de um cavalo que um jogador está conduzindo aparece Montar na garupa, ele vai sentado atrás, sem andar por conta própria, e os jogadores o veem no cavalo. Desce com Descer (ou E), ao soltar o NPC, ao passar por uma saída ou se o condutor desce. Também corrigi a ordem do desenho de frente: o condutor fica na frente e quem vai atrás aparece por trás dele.',
    ],
  },
  {
    version: '2.19',
    date:    '2026-11-07',
    title:   'Vortable: NPCs seguem um jogador',
    items: [
      'Novo botão no controle ao vivo do mestre, ao lado de NPCs desta zona: Seguir. Escolha um jogador e todos os NPCs da zona passam a andar atrás dele, ocupando lugares diferentes em volta (anéis cada vez maiores se forem muitos), andando e correndo se ele se afastar, e todos os jogadores os veem se movendo. Dá pra marcar quem segue: Pessoas, Animais e Inimigos (cada um com a contagem da zona). Clicar em outro jogador troca quem é seguido; Parar de seguir (ou clicar no mesmo jogador) deixa cada NPC parado onde está, pra todos, e a zona grava as posições.',
      'Como é feito: o navegador do mestre move os NPCs e conta a posição pela rede, do mesmo jeito que já funciona com o NPC que você controla. Por isso só anda com o controle aberto (fechou ou trocou de mundo, eles ficam parados onde estavam) e, por enquanto, os NPCs não desviam de paredes, água nem objetos. Se o jogador for pra outra zona, eles esperam. Controlar um NPC que está seguindo o solta primeiro, no lugar dele.',
      'A lista de Jogadores do controle deixou de contar os NPCs que andam como se fossem gente.',
    ],
  },
  {
    version: '2.18',
    date:    '2026-11-07',
    title:   'Vortable: Monstro de Cabeças e dois Draugr',
    items: [
      'Três inimigos novos no painel Inimigos do controle ao vivo, desenhados por código a partir dos esboços: o Monstro de Cabeças (gigante curvado de juba de cachos em espiral, cabeça de jacaré de boca aberta, outras cabeças e um rostinho no pé; bem maior que um jogador, com 4 variantes de cor pelo catálogo), o Draugr de Elmo (esquelético, de elmo pontudo, ombreiras com chifres, garras enroladas e machado farpado) e o Draugr de Galhada (barbudo, de coroa de chamas, ombreiras de espinhos e espada longa). Andam, correm e ficam parados nas quatro direções.',
      'Cada um tem seus sons sintetizados na aba de sons (rugido de muitas bocas, chiado, mandíbulas e passos de gigante; sussurro, rugido seco, armadura rangendo e passos ocos). O motor agora aceita NPCs bem maiores que o normal (alturas de gigante), usadas só por criaturas assim; o criador de personagem continua com as mesmas alturas. Também entra a peça Mecha de cabelo no criador.',
    ],
  },
  {
    version: '2.17',
    date:    '2026-11-07',
    title:   'Lore: imagens',
    items: [
      'Na aba Lore dos jogadores dá pra enviar imagens junto com os documentos: JPG, PNG, GIF, WebP, AVIF, BMP, SVG, ICO, TIFF e HEIC, até 20 MB cada, em vários de uma vez (no celular o seletor abre a galeria). Clicar na imagem abre o leitor com ela em tela cheia; TIFF e HEIC, que o navegador não desenha, ficam pra baixar. O mestre vê as imagens na Lore de cada ficha do mesmo jeito. Não precisa de migration.',
    ],
  },
  {
    version: '2.16',
    date:    '2026-11-07',
    title:   'Altherium: armadura por parte do corpo',
    items: [
      'Seguindo o livro (toda parte de armadura tem Integridade), cada parte do corpo agora tem a sua peça com Integridade própria. Em Meus itens, a armadura vira Vestir: você escolhe a parte (cabeça, braços, tronco ou pernas), e cada peça vestida mostra a própria barra de Integridade, com um botão tirar. Com 2 ou mais da mesma armadura dá pra vestir várias partes, cada uma com o seu desgaste. Vestir numa parte que já tem peça manda a antiga de volta pra mochila.',
      'O DB de cada parte da ficha agora é calculado sozinho: a peça vestida ali (já com a Integridade gasta e as Placas Costuradas) mais os escudos mais o bônus. O campo que você digitava virou Extra, só para o que não vem de armadura (Robusto e afins); vestir e tirar não mexe mais nele, então acabou o DB que ficava sobrando ao tirar uma peça. As fichas existentes não mudam de DB: a migration separa o que era armadura do que sobra como Extra.',
      'No combate, o dano que não passa do DB desgasta só a peça da parte atingida (10%), e o Reparo do Ofício lista cada peça vestida separada, repondo só a Integridade daquela parte. O histórico do mestre e o texto exportado da ficha mostram as partes vestidas. Precisa rodar a migration 20240228 no Supabase.',
    ],
  },
  {
    version: '2.15',
    date:    '2026-11-07',
    title:   'Vortable: animais (cavalos e cachorros)',
    items: [
      'Montaria: quem joga chega perto de um cavalo e aparece o botão Montar (no PC, e solto na tela no celular; a tecla E também monta e desmonta). Montado, o jogador controla o cavalo, que é bem mais rápido, com o boneco sentado em cima; os outros jogadores e a câmera do mestre veem o cavaleiro no cavalo. Desmontando, o cavalo fica ali (pra todos os que estão na sessão); passar por uma saída desmonta. Vale pra qualquer NPC cujo corpo seja a peça Cavalo.',
      'Criador de personagem: nova peça Mecha de cabelo, uma mecha preta que se põe por cima do cabelo espetado (espaço Cabelo). Ela é recortada do próprio cabelo, então balança junto com ele ao andar.',
      'O cavaleiro fica sentado e parado em cima do cavalo (as pernas e os braços não balançam enquanto o cavalo anda). O cavalo faz som de casco ao andar e correr (mais grave e pesado que passo de gente, com um estalo por cima), tanto montado por você quanto visto de fora: outros jogadores montados e os animais que o mestre controla, mais baixo quanto mais longe da câmera dele.',
      'Novo botão de pata no controle ao vivo do mestre: o painel Animais põe cavalos (preto, branco malhado de laranja, alazão, palomino, tordilho e castanho de meias brancas) e cachorros (pastor alemão clássico, preto, sable e branco) na cena, clicando em Colocar ou arrastando pro mapa, com Onde, Quantos, espalhamento e nome sobre a cabeça. A aba Na zona lista os animais colocados, com Controlar (o mestre anda com o bicho como um jogador) e Tirar.',
      'Cavalo agora é uma peça de corpo do criador de personagem (`tlou/body/cavalo`, seis pelagens), desenhada por código como o cachorro: anda, corre e fica parado nas quatro direções. Se o catálogo do site estiver desatualizado e não tiver a arte do animal, o painel avisa em vez de colocar um corpo humano sem cabeça.',
    ],
  },
  {
    version: '2.14',
    date:    '2026-11-07',
    title:   'Vortable: biblioteca de NPCs do mestre',
    items: [
      'No controle ao vivo, a aba Importar do Gerador de NPCs virou Biblioteca: os personagens que você importa (arquivos .vortable-personagem.json, de um ou vários) ficam guardados na sua conta, valem em todas as campanhas e em qualquer navegador, e é só pegar da lista e colocar, sem importar de novo. Dá pra arrastar pro mapa, usar o Colocar de cada um, marcar vários e usar Colocar marcados (com Onde, espalhamento e nome sobre a cabeça), buscar por nome e tirar da biblioteca.',
      'Na aba Gerar, cada NPC sorteado ganhou o botão Guardar, que manda ele pra biblioteca. Os importados que o navegador já guardava (por campanha) sobem sozinhos pra biblioteca na primeira vez. Precisa rodar a migration 20240227 no Supabase; enquanto isso a biblioteca funciona só neste navegador.',
    ],
  },
  {
    version: '2.13',
    date:    '2026-11-07',
    title:   'Altherium: companheiro animal',
    items: [
      'Nova aba Companheiro na ficha de Altherium, para quem tem um animal (um lobo criado desde filhote, um corvo, um urso). Dá pra começar pelo lobo do livro (2 feridas, Defesa 12, ataque 2d10+2, dano 1d8 de mordida, as 5 habilidades) ou montar outro bicho em branco. A aba mostra tudo como texto, no mesmo estilo da ficha, e o lapizinho ao lado de cada pedaço (nome, espécie e números; cada habilidade; as anotações) abre a edição dele. Tudo é editável: nome, espécie, foto (com o mesmo ajuste de enquadramento do retrato), limite de feridas, Defesa, dados e bônus do ataque, dano, estado e as habilidades (com o companheiro ou guardadas, uma vez por cena, descrição livre).',
      'Regras do livro prontas: Comandar deixa o companheiro Exposto, Recolher volta a Protegido, Ferir e Crítico (2 feridas) derrubam ao chegar no limite, Curar remove 1 ferida, Estabilizou, Morreu (o dono perde 2d6 de Equilíbrio na hora e fica com −1 dado em Vontade até o Descanso Longo) e Fome (sem comer a Ração, o Descanso Longo não cura). A mecânica de Laço ficou de fora.',
      'No retrato do personagem aparece uma bolinha menor com a foto do companheiro, com um pontinho de estado (verde protegido, amarelo exposto, vermelho caído); clicar nela abre a aba. Precisa rodar a migration 20240226 (coluna companion) no Supabase.',
    ],
  },
  {
    version: '2.12',
    date:    '2026-11-06',
    title:   'Vortable: novo mundo Midfold',
    items: [
      'Controle ao vivo: o botão Controlar (e Tirar do mapa) do menu que abre ao clicar num NPC no mapa não fazia nada, porque o clique fechava o menu antes de chegar no botão. Corrigido.',
      'Controle ao vivo: ao controlar um NPC ou inimigo, o foco sai de qualquer campo do painel (quantidade, volume, lista) pra que as setas e o WASD movam o boneco, e se não der pra controlar aparece um aviso em vez de não acontecer nada.',
      'Midfold, um mundo pronto de seis zonas de campo para importar no Vortable (Mundos → Importar mundo, arquivo midfold.mundo.json): campos planos de grama clara e viva, trilha de terra que atravessa quatro zonas da esquerda pra direita, desce e encontra uma estrada de lajotas cinzas de pedra, de beira natural (terra, musgo e ervinhas se misturando à grama), que segue pra baixo por mais duas zonas, até um acampamento no fim. Árvores imensas de troncos colados e copas fundidas, pinheirinhos lá longe e nenhum outro objeto solto.',
      'Midfold ganhou uma cabana abandonada à beira da trilha da segunda zona (a porta leva a uma zona nova, o interior da cabana) e, na quinta zona, do lado direito da estrada, um grande pasto plano de campo de batalha: soldados tombados de dois exércitos, espadas cravadas e caídas, escudos, elmos, flechas, manchas de sangue e estandartes caídos. Para isso entrou um pacote novo de objetos, o Campo de batalha, no catálogo do Vortable.',
    ],
  },
  {
    version: '2.11',
    date:    '2026-11-06',
    title:   'Vortable: tela Mundos mais limpa, réguas novas e grama corrigida',
    items: [
      'Régua do editor com vários tipos: ao escolher a ferramenta Régua aparece uma barra no topo do mapa com Linha (distância e direção, como antes), Área (retângulo com largura, altura, perímetro e m², e Shift deixa quadrado), Círculo (arraste do centro até a borda e veja raio, diâmetro e m²) e Cone (arraste da ponta até o alcance, com abertura de 30°, 60°, 90° ou 120°, mostrando o alcance, os m² e a largura do fundo). Tudo em metros (1 tile = 1 m) e some ao soltar o botão.',
      'Grama corrigida: em alguns momentos (ao reabrir o Vortable ou voltar do teste) as moitas de grama apareciam como quadrados pretos com borda e diagonal verdes. O recorte dos tufos agora é refeito sempre que o jogo recria as texturas.',
      'A tela Mundos foi refeita: cada mundo é um cartão com capa, o mundo aberto vem primeiro (borda dourada, selo “Aberto” e “Jogadores aqui” com a luzinha verde) e os outros têm um botão Abrir bem à vista. Editar, Renomear e Apagar foram para o menu de três pontos de cada cartão (o Apagar avisa por que está desligado: mundo aberto ou único da campanha).',
      'Criador de personagem do Vortable: nova linha “Braços” na aba Corpo, com Os dois, Sem o direito e Sem o esquerdo. O braço sai do desenho pronto (corpo e roupa juntos) em todas as vistas e nas animações de parado, andar e correr; o ombro fica como um coto, coberto pela ombreira, se houver. Vale pra todos os corpos e é guardado no arquivo do personagem (exportar e importar).',
      'Câmera de conversa (mestre, aba Controle): o novo botão de balão de fala escolhe dois personagens (jogadores ou NPCs da zona) e todos os jogadores, e os espectadores, passam a ver os dois lado a lado, de frente, na altura do rosto, com o cenário vivo desfocado atrás, como numa conversa de jogo de aventura. Quem fala fica em destaque (o outro escurece de leve) e todos respiram devagar. Clique em um dos dois, na faixa “Em cena” embaixo, pra passar o destaque, ou em outro nome pra trocar de personagem. Enquanto a cena está no ar ninguém move o boneco; “Encerrar” devolve tudo ao normal. Os rostos aparecem ampliados e suavizados (o mesmo desenho do boneco, só com as bordas escalonadas alisadas, sem inventar traço). Sem texto nenhum na tela.',
      'A lista “Mundos prontos” saiu da página. O cartão “Novo mundo” agora abre uma janela com Em branco, Importar arquivo e os mundos prontos (Torvallen, Cidade em Ruínas, Saltmore e Nova York), cada um com o botão Criar.',
    ],
  },
  {
    version: '2.10',
    date:    '2026-11-06',
    title:   'Lore dos personagens, para o mestre ler tudo num lugar só',
    items: [
      'O botão Atacar da ficha de Altherium perdeu o gradiente: agora é um amarelo liso (e um tom mais claro ao passar o mouse).',
      'O painel Cena da Campanha (Altherium, mestre) agora começa minimizado: o título já mostra o resumo (estado dos inimigos, DT, local e escassez) e um clique abre os ajustes.',
      'Nova aba Lore na ficha de Altherium e na de D&D. O jogador escreve a história do personagem num campo grande (salva sozinho, com contagem de palavras) e/ou guarda arquivos: PDF, DOCX, DOC, ODT, RTF, TXT, MD, JSON e CSV, até 20 MB cada e 25 por ficha. Dá para mandar vários arquivos de uma vez (soltando ou marcando com Ctrl/Shift) e voltar depois para acrescentar outros com “+ Adicionar mais arquivos”, ideal para documentos separados; o envio mostra o andamento (“Enviando 2 de 3”) e o contador (“5 / 25”). Cada arquivo vira um cartão com Ler, Baixar e Remover. No Altherium o texto usa a fonte caligráfica; no D&D, a serifada do site.',
      'Os arquivos abrem numa janela de leitura dentro do site: PDF na tela, DOCX como texto com títulos, e TXT, MD, JSON e CSV direto. DOC, ODT e RTF só baixam.',
      'Nova aba Lores na Sessão do mestre (Altherium e D&D): uma lista com todos os personagens da campanha, com retrato, jogador, trecho do texto, palavras, arquivos e “há quanto tempo”, e a leitura ao lado, em página de livro com letra capitular. Tem busca (por nome, texto ou arquivo), um ponto dourado nas lores com novidade desde a última vez que você leu, “Copiar texto” e atualização ao vivo quando alguém escreve. No celular a lista e a leitura se alternam. Só o jogador mexe na própria lore; o mestre só lê.',
      'Precisa rodar a migration 20240225000000 no Supabase.',
    ],
  },
  {
    version: '2.9',
    date:    '2026-11-05',
    title:   'Altherium: ficha com visual novo e dados 3D em tudo',
    items: [
      'Cabeçalho da ficha refeito: o retrato ficou menor, ao lado do nome, e Raiz, Gênesis, Nível e Hacksilvers ficam todos na mesma faixa. As barras de PV, PE e do recurso da raiz (FV, PR ou Cartas) ficaram grossas, com o número dentro e botões − e + nas pontas para dano e cura de 1 em 1; arrastar a barra e digitar o número continuam funcionando. O “Exportar TXT” saiu do meio da tela e foi para o menu ⋯ do cabeçalho.',
      'Selos de estado no fim do cabeçalho: Fichas de Exploração, Fome, Reação (um clique marca como usada) e o efeito da Gênesis, tudo junto. Antes a Fome e as Fichas ficavam numa faixa solta, longe do botão que gasta as Fichas, e o efeito da Gênesis flutuava sozinho abaixo do cabeçalho.',
      'Uma barra de ações só, com ícone e legenda em cada botão: Atacar (o botão principal, em destaque), Defender, Explorar, Descansar, Furtividade e Equilíbrio. Cada um abre direto a sua janela; o botão “Ações”, que só abria um painel, saiu. Na aba Combate ficaram Receber dano, Iniciativa e, quando o personagem cai, o Teste de Morte.',
      'O pedido do mestre agora é uma faixa fina logo acima das ações, com o botão Rolar, em vez de um cartão grande.',
      'Janela de teste refeita em duas telas: a primeira mostra a conta como um recibo (dados, atributo, bônus, dados de situação com − e +, e o total “1d10 + 4” embaixo), com o alvo (DT), a rolagem privada como interruptor e um botão grande de Rolar. Ao clicar em Rolar, abre um painelzinho só com os dados 3D rolando e, quando eles param, o resultado. Se quiser mudar algo, “Ajustar e rolar de novo” volta para a conta. Os testes que já vêm prontos de uma janela (Explorar, Furtividade, Equilíbrio, pedidos do mestre) continuam abrindo direto no painel dos dados.',
      'Raiz e Gênesis no cabeçalho agora são pílulas com um ícone antes do nome (um machado para o Berserker, uma runa para o Runaskin, um naipe para o Pilar, e um ícone para cada gênesis). Os ícones também aparecem na lista aberta.',
      'Nova opção nas Configurações (engrenagem, aba Aparência): “Dados na tela”, com Normal e Dados dos outros simplificados. No modo simplificado, as rolagens dos outros jogadores e do mestre deixam de abrir o painel grande no meio da tela e aparecem numa janelinha no canto superior direito (quem rolou, o que foi, o total e a conta; crítico, sucesso e falha quando a CD é conhecida), que some sozinha e fica parada se você passar o mouse. Assim elas não atrapalham quem está na própria ficha, e as suas rolagens continuam com os dados 3D. Vale no D&D e no Altherium.',
      'Animações de crítico e falha: saíram todas as animações de tela do 20 natural e do 1 natural (as explosões em volta do dado, os relâmpagos, o fogo, a água e as outras que eram sorteadas, com os sons delas), o brilho, a rachadura e a tremida do painel de teste do D&D, o carimbo de sucesso e falha e a animação do total no aviso de rolagem. Ficam só os lobos do Altherium: o lobo branco no crítico e o lobo preto na falha crítica, com os sons deles. Os textos (“20 natural!”, “1 natural”, sucesso e falha) continuam, só que parados.',
      'Fontes da ficha de Altherium: botões, campos e abas que caíam na fonte padrão do navegador (Arial) agora usam a fonte do site. E ganhou uma segunda fonte, a Cinzel (letras de inscrição romana), nos títulos de cartões e janelas, no nome do personagem, nos números dos atributos e nos totais de dado. Uma terceira fonte, a Almendra (caligráfica), dá a voz de manuscrito aos pedidos do mestre, às descrições de item e de gênesis, ao texto do popover de atributo e às Anotações. As janelas de Item personalizado e do Catálogo agora têm tamanho fixo: trocar de tipo ou de categoria não muda mais o tamanho da janela.',
      'Animações da ficha de Altherium: janelas abrem e fecham com a mola do site (antes só abriam), cartões do inventário, linhas do catálogo, domínios, armas do ataque, contas do dano e condições entram em cascata, trocar o filtro do inventário refaz a entrada, a barra de integridade cresce, chips e abas dão um pop ao ligar e encolhem ao apertar, quantidade e dano final batem ao mudar, o popover de atributo desce suave e os totais dos testes aparecem com um pop. Quem prefere menos movimento no sistema continua sem animações.',
      'Item personalizado refeito: a janela ficou maior, com o formulário à esquerda e, à direita, o cartão do item como vai ficar em Meus itens, atualizando enquanto você preenche. O tipo (Arma, Armadura, Escudo, Consumível, Utilitário) vira botões no topo. A arma agora tem tudo o que as do catálogo têm: categoria (que define 1 ou 2 espaços de Reforço), dado, tipo de dano, atributo de acerto, alcance, material de reparo, as 20 propriedades (Duas Mãos, Serrilhada, Perfurante com valor, Recarga com a ação e as outras, com a regra ao passar o mouse) e preço. Armadura e escudo ganham material de reparo e preço, e a descrição segue para todos. O combate e o Ofício passam a usar essas propriedades, o reparo e os espaços de Reforço da arma personalizada. Precisa rodar a migration 20240224000000 no Supabase.',
      'Inventário refeito: “Meus itens” agora são cartões do mesmo tamanho, sem as duas colunas com rolagem própria. Cada cartão mostra o tipo, se está equipada e em qual parte do corpo, o dano ou o DB, a barra de integridade, a quantidade com − e + e os botões Equipar e Editar. Observações longas de item personalizado ficam em duas linhas, com “Ver mais”. No alto há abas para filtrar (Todos, Armas, Armaduras, Escudos e Outros, com a contagem de cada uma). O catálogo saiu da tela e virou uma janela: botão “+ Adicionar item”, busca, categorias, preço, e o + soma o item sem fechar a janela (ela avisa quantos você já tem). O item personalizado fica no rodapé da janela.',
      'Condições (aba Combate): as 16 condições agora ficam todas à vista, em grupos (Dano contínuo, Controle, Da punição e Graves), e um toque liga ou desliga cada uma, no lugar do menu “+ Condição”. As ativas se acendem (vermelho no dano, dourado no controle, azul-esverdeado nas da punição), mostram os turnos que faltam, e embaixo aparece uma lista do que cada uma faz. O contador no alto diz quantas estão ativas.',
      'Janela Receber dano refeita: a parte atingida agora se escolhe num boneco (com o DB de cada parte ao lado, e as partes também se clicam no desenho), o dano tem botões − e + e atalhos de +5 e +10, o tipo de dano virou chips, e os ajustes (perfurante, resistência, vulnerável e imune) ficam recolhidos até você abrir. A conta passo a passo e o “PV antes → depois” continuam, e o botão diz quanto de dano vai entrar.',
      'Domínios da ficha: por padrão aparecem só 10, os que você mais usa (os domínios em que você tem pontos entram sempre, e as outras vagas vão para os que você mais rolou; quem ainda não rolou vê os primeiros da lista). O botão “Mostrar mais” embaixo da lista abre todos os domínios, e “Mostrar só os mais usados” fecha de novo. Buscar um domínio procura em todos, sem depender do botão.',
      'Painel de Atacar corrigido: agora dá para escolher a arma. Os cartões das armas não recebiam o clique porque uma regra do desenho das armas no boneco (que desliga o clique) usava o mesmo nome e pegava neles também.',
      'Pedido de teste do mestre: o aviso “O mestre pediu…” agora some assim que o jogador rola, seja pelo botão Rolar do aviso, seja rolando o mesmo domínio direto na ficha (ou pela janela de Furtividade ou de Equilíbrio) depois do pedido. Antes só sumia se a rolagem saísse pelo botão do aviso.',
      'Cena da campanha (mestre) refeita: o estado dos inimigos e a escassez viraram escalas, com um ponto por degrau e a cor mudando do calmo ao grave (verde, dourado, vermelho), e a DT de cada degrau embaixo do nome. O local ganhou ícones (floresta, litoral, montanha, tundra, vilarejo, ruínas e fenda), e o clima virou chips que se acendem, com a soma de dados ao lado (“Soma −2 dados”). As três caixas grandes das DTs dos inimigos saíram do caminho: ficam em “Ajustar as DTs”, agora com botões − e + (cada estado com o ponto e a cor dele) e um “Restaurar” para voltar ao padrão 6, 8 e 10. Vale no topo da ficha do mestre e na aba Cena do painel do mestre.',
      'Altherium: agora você vê as rolagens dos outros jogadores e do mestre. No modo Normal (Configurações > Aparência > Dados na tela) abre um painel com os dados 3D rolando, na skin de quem rolou, com o nome, a conta, o crítico e o sucesso ou a falha dos testes; ele espera você terminar a sua rolagem, fica uns segundos e some sozinho. No modo simplificado vira só a janelinha no canto superior direito. Antes o Altherium não mostrava nada das rolagens dos outros na tela.',
      'Lobos do Altherium corrigidos: nos testes de Altherium o lobo branco agora aparece quando o dado que valeu é um 10 natural (o crítico do livro), mesmo com outros dados na rolagem, e o lobo preto quando o dado que valeu é um 1 natural. Antes eles só apareciam quando todos os dados da rolagem eram 10 ou todos eram 1, então quase nenhum crítico de teste chamava o lobo. Além disso, o lobo agora espera os seus dados 3D pararem de rolar para entrar (antes entrava com os dados ainda rolando e sumia antes do resultado). Rolagens livres seguem a regra de sempre (todos os dados no máximo ou todos em 1), e d2 e d3 não chamam o lobo.',
      'Rolador de dados do Altherium: o telão ficou maior (painel mais largo e mais alto) e as paredes da rolagem agora são as bordas do telão. Antes os dados batiam em paredes invisíveis bem dentro do telão, que reservava faixas para o título e para o total; agora eles rolam por quase toda a área, e o total ficou numa pílula pequena na parte de baixo do telão, fora do caminho dos dados.',
      'Rolador de dados do Altherium: a aba Meus dados agora tem o mesmo tamanho e o mesmo estilo da aba Rolagem (o painel não muda de tamanho ao trocar de aba), com a lista dos conjuntos de dados, cada um com o dado 3D de verdade girando ao lado do nome (no lugar do ícone); o dado do telão mostra o conjunto que você escolhe.',
      'Atributos da ficha: o campo de número virou um anel que enche com o valor (de 0 a 10), com o número no meio. Clicar no número e digitar continua funcionando. Ao lado do nome de cada atributo há uma setinha: ao clicar, abre uma janelinha explicando o atributo, quais domínios usam ele e o limite (0 a 10; no máximo 6 na criação). Fecha clicando de novo, fora dela ou com Esc.',
      'Abas: de 8 para 6. A aba Ficha junta Atributos, Domínios, Perfil e Gênesis; a aba Equipamento junta o Inventário (itens e anatomia) e o Ofício, com uma chave no topo para alternar. Nos domínios, os cinco botões (−1, 0, 1, 2 e +) viraram um − e um + com o valor no meio (−1, 0, 1, 2 e “2+”, o dado extra), maiores e mais fáceis de tocar.',
      'Janelas de Explorar, Descansar, Furtividade e Equilíbrio: agora todas têm o mesmo tamanho e ficam no mesmo lugar, então a janela não pula mais ao trocar de aba. O título e as abas ficam parados e só o conteúdo rola por dentro quando precisa. No celular estreito as quatro abas cabem na largura e os botões grandes (como “Resistir”) quebram linha em vez de cortar o texto.',
      'Dados do Altherium corrigidos: o dado que você escolhe em “Meus dados” agora é o que aparece ao rolar. Antes, os testes que rolam sozinhos ao abrir (Equilíbrio, Explorar, pedidos do mestre) rolavam antes de a escolha ser lida e saíam com o dado de madeira; a escolha agora é lida na hora de cada rolagem, e um erro de rede não deixa mais o dado de madeira “preso” até recarregar a página. Se salvar a escolha não alterar o seu perfil, o site avisa em vez de fingir que trocou.',
      'Todas as rolagens do Altherium usam os dados 3D: o coma (1d4), os Ritos de Altherium (Banquete, Oferenda, Juramento...), a tabela de quando o Equilíbrio zera (1d10), os dados do Descanso (Vitalidade 1d8, Destino, Rúnico...) e a recuperação de cartas do Pilar (1d20+3). O resultado só entra na ficha depois que os dados param, e o que aparece no dado é exatamente o que valeu. O rolador de dados da bolinha foi refeito no visual da ficha: um painel largo com o telão à esquerda, onde o seu dado 3D (na skin que você escolheu) fica girando até você rolar, e onde os dados rolam e o total aparece; à direita ficam os dados rápidos (d4 a d100), “Como rolar” (Normal, Vantagem e Desvantagem, no lugar de decorar 2#d20 e 2@d20), a fórmula e a rolagem privada, e a aba Meus dados. Embaixo ficam as últimas rolagens da mesa. No celular, o telão fica em cima.',
      'No celular o cabeçalho ficou bem mais curto (retrato e nome na primeira linha, Raiz e Gênesis lado a lado) e as ações aparecem em duas colunas, com botões grandes.',
    ],
  },
  {
    version: '2.8',
    date:    '2026-11-03',
    title:   'Episódios em ordem e anotações em um arquivo',
    items: [
      'Fichas: novo botão “Exportar TXT” em todas as fichas (Altherium, D&D 5e, Vampiro, Terra Devastada, Terra Devastada Adaptada e Ficha Simples). Ele baixa a ficha inteira em um arquivo de texto, com tudo o que está preenchido e já calculado (no D&D, CA, iniciativa, salvaguardas, perícias, magias, ataques, inventário e características; no Altherium, atributos, pontos, domínios, triunfos, inventário e recursos). Nas fichas de D&D o botão fica ao lado de Importar PDF; nas outras, no topo da ficha.',
      'Quadro: as imagens (e tudo o mais) postas por qualquer pessoa agora chegam para todos. O quadro carregava no máximo 1000 itens e os mais novos, como as últimas imagens, podiam ficar de fora; agora carrega tudo. Além disso, quando a conexão em tempo real cai e volta, ou você volta para a aba depois de um tempo, o quadro se atualiza sozinho com o que foi perdido nesse meio tempo, e uma imagem que não carregou na primeira vez tenta de novo, e uma imagem que não abre mostra “Imagem indisponível” em vez de um espaço vazio. Para os jogadores verem todas as imagens e arquivos do Quadro geral, rode as migrations 20240222 e 20240223. Se o servidor demorar demais para liberar um link, a imagem não fica mais carregando para sempre: vira “Imagem indisponível” e tenta de novo.',
      'Episódios da campanha: novo seletor de ordem ao lado dos filtros, com Mais recentes (o padrão), Mais antigos e ordem alfabética (A–Z e Z–A; “Episódio 2” vem antes do “Episódio 10”). O mesmo seletor está nas Anotações da Bruna, acima da lista de episódios. Um episódio sem data marcada agora entra pela data em que foi criado, então um episódio novo aparece no topo em vez de ir para o fim da lista.',
      'Nas Anotações da Bruna (visão do mestre) há o botão “Baixar tudo (.txt)”: junta tudo o que foi anotado em todos os episódios em um único arquivo de texto, do episódio mais antigo ao mais novo, cada anotação com o horário em que foi escrita. Imagens não entram no texto; o arquivo só avisa quantas havia em cada anotação. O caderno de quem anota também ganhou o botão de baixar (a setinha ao lado do botão de imagem), com as anotações de todos os episódios.',
    ],
  },
  {
    version: '2.7',
    date:    '2026-10-31',
    title:   'Altherium: painel do mestre',
    items: [
      'Novo botão fixo do mestre (a coroa, ao lado do livro dos documentos) nas campanhas de Altherium. Ele abre o Painel do mestre por cima da página, sem sair do que você está fazendo.',
      'No topo do painel você marca quem recebe: todos ou personagem por personagem. Cada um mostra PV, Equilíbrio, Fichas de Exploração, Fome e Rações, e as mudanças chegam ao vivo na ficha do jogador.',
      'Pedir teste: Furtividade (já com a DT do estado atual dos inimigos), Equilíbrio (algo perturbador, com a perda e a DT) ou qualquer teste de domínio. O pedido aparece na ficha de cada jogador com a DT preenchida e o botão Rolar. O resultado já faz o que o livro manda: a Furtividade mostra se o estado sobe, e o Equilíbrio calcula a perda (metade se passou, tudo se falhou). O painel mostra a resposta de cada um ao vivo (total, crítico, passou ou falhou) e o botão Encerrar.',
      'Achados: dar ou tirar um recurso (com qualidade e fração), Ração ou Hacksilvers, ou sortear na tabela do Local (cada personagem recebe o seu sorteio, com a opção de mais 1 Achado Raro). Respeita o limite de 4 unidades por recurso e avisa o que não coube.',
      'Descanso do grupo: Curto ou Longo com as regras do livro para cada personagem (Vitalidade 1d8 + Espírito, Rúnico, Destino, Peregrino, Ração e Fome), com boa refeição, frio extremo e interrupção.',
      'Ajustes: Fichas de Exploração, nível de Fome, dano e cura de PV, e Equilíbrio dos marcados. A aba Cena traz o estado dos inimigos, as DTs, o Local, a Escassez e o clima.',
      'Visual das telas novas de Altherium: sem emojis, com a fonte do sistema em todos os botões e campos, e sem rolagem. As janelas de Explorar, Descansar, Furtividade e Equilíbrio ficaram largas, em duas colunas, e cabem inteiras na tela; o painel do mestre também, com quem recebe de um lado e a ação do outro. A aba Ofício virou quatro telas curtas: Materiais e Rações, Reparo e Desmontar, Fabricar, Reforços e Sagas (e comer 1 Ração agora fica nos materiais).',
      'Tudo editável na mão: em Explorar, Furtividade, Atacar, Defender e Equilíbrio a conta antes de rolar (“3d10 · maior +2”) tem botões para mudar a quantidade de d10, escolher maior ou menor e ajustar o bônus, com “Voltar ao automático”. Explorar e Furtividade também deixam mudar a DT, e Atacar e Defender aceitam a Defesa do alvo e o Ataque recebido (o resultado diz se acertou ou defendeu). Na tela de teste dos domínios há o campo “Ajuste manual” com os mesmos três valores.',
      'Triunfos novos do livro: 20 para o Berserker (Grito de Desafio, Mordida do Lobo, Arremesso Brutal, Muralha de Carne, Sede de Sangue, Quebra-Escudo, Faro do Lobo, Recusar a Morte, Berro dos Ancestrais, Atropelar, Lâmina Arremessada, Fúria Contida, Agarrão de Ferro, Escudo Humano, Golpe no Chão, Cicatrizes de Guerra, Presença Aterradora, Dentes Cerrados, Martelo do Ferreiro e Ritmo de Batalha) e 20 para o Pilar (Aposta Dobrada, Carta na Manga, Jogo de Cintura, Blefe do Mercador, Mapa das Estrelas, Corda das Nornas, Mão Invisível, Ilusão de Passos, Truque de Cartas, Brinde do Rei Bêbado, Roleta de Hel, Leitura do Oponente, Dados Viciados, Golpe de Sorte, Troca de Lugares, Contar Cartas, Cofre Cheio, Banca Quebrada, Rota do Viajante e Hidromel e Histórias).',
      'As Sagas de Ofício saíram por enquanto (ficam para o futuro): o cartão sumiu do Ofício, o Achado Raro não sorteia mais Saga e todos os Reforços e o Catalisador Rúnico ficam liberados.',
      'As abas da ficha agora ocupam a largura toda e, se a tela for estreita, quebram em duas linhas em vez de ficar cortadas. As janelas ficaram um pouco mais largas para caber sem rolar.',
      'O painel de rolagem de dados do canto, nas campanhas de Altherium, ganhou a aba “Meus dados”, igual à do D&D: mostra todos os conjuntos de dados que a sua conta tem, com o dado girando, e vale para todas as suas rolagens.',
      'Para os pedidos funcionarem, rode a migration 20240219.',
      'Mesa: zoom cinematográfico do mestre. Na transmissão (ou numa arte na mesa) há uma barra nova com o botão Zoom: ligado, é só clicar em qualquer ponto da imagem e a câmera desliza devagar até lá, ao mesmo tempo para todos que estão vendo, com cantos levemente escurecidos. Leve, Médio e Forte escolhem o quanto chega perto (Leve é o padrão). Clicar em outro ponto move a câmera sem cortar, e Tirar zoom volta à imagem inteira. Quem entra depois já vê o zoom no lugar.',
      'Mesa, Artes recentes: o mestre pode ocultar uma arte dos jogadores. Cada miniatura ganhou um olho (só para o mestre): oculta, a arte some da lista dos jogadores (e do Storage para eles) e fica apagada com a marca “Oculta” para o mestre. Ao pôr a arte na mesa, todos veem na Transmissão normalmente; depois de tirada, ela continua oculta da lista até o mestre clicar no olho de novo. Para funcionar, rode a migration 20240220.',
      'Novo domínio exclusivo do Pilar: Ofício (atributo Estratégia). Aparece na aba Domínios só nas fichas de Pilar, com pontos, +1d10 e desvantagem como os outros; as demais raízes não veem. O mestre pode pedir um teste de Ofício no painel. Para funcionar, rode a migration 20240221.',
      'Cena a dois: um quick time event ao vivo para a campanha toda. Na ficha de Altherium há o botão “Sexo” (logo abaixo de Ações): ele abre um painel suspenso para escolher um parceiro (ou ir sozinho) e o botão Iniciar. Só de abrir o painel, todos os jogadores e o mestre recebem o aviso “Assistir”. O parceiro precisa aceitar o convite para a cena começar (no máximo 2 jogadores); todos os outros viram espectadores.',
      'Na cena, letras do teclado aparecem em pontos diferentes da arena e somem rápido: aperte a tecla (ou toque na letra) antes do aro fechar. Cada letra dura menos que a anterior e são 30 no total. Com 3 falhas (tecla errada ou letra que sumiu) você perde; aguentar as 30 vence. Quem joga e quem assiste veem as duas arenas ao mesmo tempo, com as vidas, o placar e quem ganhou ou perdeu no final.',
      'A dificuldade vem do Impulso do personagem: cada um joga com o tempo do próprio Impulso, mas a sequência de letras é a mesma para os dois. Só com Impulso 10 fica relativamente tranquilo; com Impulso baixo é bem difícil. O mestre também organiza: na coroa do painel do mestre há a aba “Cena a dois”, para pôr 1 ou 2 jogadores na cena (cada um aceita antes).',
      'A Cena a dois também funciona no celular e no tablet: o painel de preparo sobe da base da tela, as duas arenas se empilham (ou ficam lado a lado com o aparelho deitado) e cada uma cabe inteira sem rolar, a letra nunca sai da arena, toda a área é tocável, o celular vibra quando você erra e a tela não apaga durante a cena. O mestre ganhou o botão Sexo também no topo da Ficha Altherium.',
      'Cena a dois com som: cada tecla que você aperta (ou toca) faz uma batida de impacto, grave e com estalo; o erro faz uma pancada surda. Quem assiste ouve as batidas dos jogadores mais baixinho. O volume segue o controle de sons de jogos das configurações.',
      'O mestre também pode jogar a Cena a dois: no painel do botão Sexo (ou na aba “Cena a dois” da coroa) há “Só organizar” e “Jogar também”. Jogando, o mestre define o Impulso dele na cena (começa com o da ficha, se tiver; senão 5) e leva no máximo 1 jogador, que precisa aceitar. Todos os outros assistem.',
    ],
  },
  {
    version: '2.6',
    date:    '2026-10-31',
    title:   'Altherium: a ficha de jogar (exploração, descanso e furtividade)',
    items: [
      'A ficha de Altherium foi refeita no estilo da Terra Devastada. No topo fica um botão só, Ações, que abre um painel com quatro abas: Explorar, Descansar, Furtividade e Equilíbrio, cada uma com a conta pronta e os dados 3D. O combate (Atacar, Defender, Receber dano e Iniciativa) ficou na aba Combate, e o Teste de Morte aparece na faixa de estado quando o personagem cai.',
      'Faixa fina logo abaixo do cabeçalho com as Fichas de Exploração (toque nas bolinhas para ajustar) e a Fome (−1 em todos os testes por nível, até −3). Reação, Defender Total, Mirar, Novo turno, Fim da cena e condições ficam na aba Combate.',
      'Atacar: escolha a arma pelos cartões (dano, alcance, Integridade e propriedades), marque Cercar, faixas de alcance ou alvo em Toque de um aliado e veja “3d10 · maior +5” antes de rolar. Defender e Aparar ficam na mesma janela, com os motivos quando o Aparar não pode ser usado.',
      'Explorar (livro 2.0): escolha o Local (Floresta, Litoral, Montanha, Tundra, Vilarejo, Ruínas ou Fenda de Eryndor), a Escassez (DT 5, 6, 8 ou 10) e as Condições (noite, chuva, nevasca, ferramenta, conhece o local, exploração narrada, ajuda de um aliado; no máximo ±2 dados). Gasta 1 Ficha e rola Sobrevivência + Estratégia na natureza, ou Investigação + Estratégia / Percepção + Destino em construções.',
      'O resultado sorteia os Achados na tabela do Local: falha por 5 ou mais é Complicação, falha não acha nada, sucesso dá 2 Achados, por 5 ou mais dá 3 e o crítico dá 3 mais 1 Achado Raro (Runa, Saga de Ofício, material lendário ou Relíquia). Cada Achado tem Guardar ou Deixar, respeita o limite de 4 unidades por recurso e vai direto para a aba Ofício. Rações, recursos e Hacksilvers entram nas quantidades do livro.',
      'Complicações (1d6): Encontro, Armadilha (rola o dano), Ferimento (marca Sangrando), Barulho (−1 dado na próxima) e Perda (tira 25% de um recurso). Numa Fenda de Eryndor toda falha vira Complicação. Faro do Lobo (Berserker), Cofre Cheio e Mapa das Estrelas (Pilar) entram como opções na janela.',
      'Descansar (livro 2.0): Curto (até 2 entre Longos, sem Ração) e Longo (1 Ração). O Curto recupera 1d8 + Espírito de PV, metade da FV, 1d8 + Rúnico de PR, 1d8 cartas e 2 Fichas; o Longo recupera tudo, 4 Fichas, 1d4 + Destino de Equilíbrio e tira 1 nível de Fome. Sem Ração o Longo rende só o que o Curto rende, com triunfos cheios, 2 Fichas e +1 de Fome. Boa refeição conta como Ração; frio extremo ou sem abrigo, só o Curto; interrupção não gasta a Ração; Peregrino soma 1d10 em tudo.',
      'Furtividade (livro 2.0): o estado dos inimigos (Desatento, Atento ou Alerta) vem da cena do mestre e define a DT (o livro deixa as três em aberto: o padrão é 6, 8 e 10, e o mestre ajusta). A janela soma sombra, ritmo, peso, cobertura, fumaça, Passo Fantasma, Distração e Sombra Perfeita (±2 dados) e diz o resultado: Sombra Perfeita, passou despercebido, fez barulho (o estado sobe para o grupo todo) ou Descoberto. Também tem Esfriar e a Distração.',
      'Cena do mestre: no topo das fichas o mestre escolhe o estado dos inimigos e as DTs, o Local, a Escassez e o clima da exploração. Os jogadores veem tudo na faixa de estado e as janelas já abrem preenchidas.',
      'Equilíbrio (livro 2.0): “algo perturbador” rola Vontade + Espírito contra a DT do evento (passou perde metade, falhou perde tudo). Em Recuperar entram o Acalmar de um aliado e os Ritos (Banquete ¤100, Oferenda aos Deuses, Juramento Cumprido, Confissão; um por Descanso Longo). Se o Equilíbrio zera, a janela rola a tabela de 1d10, tira 2 do máximo (Cicatriz do Crepúsculo) e guarda a Marca da Ruptura como trauma.',
      'A aba Ofício agora é igual à aba Suprimentos da Terra Devastada, em duas colunas: Materiais em frações com medidor e “Achei +25%”, Rações, Integridade e reparo (Campo ou Forja), Fabricar (Base, Núcleo e Catalisador em botões), Reforços com custo e botão Aplicar, Sagas do grupo e Desmontar.',
      'Os botões de cada janela (Explorar, Furtividade, Atacar, Defender, Equilíbrio...) rolam os dados na hora e já mostram o resultado, sem outra tela de ajuste. Em Explorar o resultado diz se achou, “Ver o que achou” sorteia os Achados, e “Explorar de novo” volta ao painel (gasta outra Ficha).',
      'Corrigido: os testes de Altherium davam “Não foi possível registrar a rolagem” nas campanhas, porque o banco só aceita total abaixo de 1 em campanha de D&D. O total gravado agora tem mínimo 1 (a janela continua mostrando a conta real).',
      'Teste de Morte do livro novo: 3 turnos (4 com mais de 8 de Espírito), DT 6, e só morre quem falha em todos os turnos. Estabilizar com 3 falhas conta como 2 (coma).',
      'Para salvar Fichas, Fome e a cena do mestre no banco, rode a migration 20240218. Sem ela a ficha funciona, mas esses valores valem só na tela.',
    ],
  },
  {
    version: '2.5',
    date:    '2026-10-31',
    title:   'Altherium: livro de regras 2.0',
    items: [
      'O livro de regras de Altherium na Mesa da Sessão e na Biblioteca agora é a versão 2.0.',
      'Catálogo de armas do livro 2.0: preços e tipos de dano novos (Adaga de Gancho ¤200, Porrete de pedra ¤100, Machado de Arremesso Cortante, Besta Leve e Besta Pesada sem o +2 no dano) e a Túnica de Couro Rúnico a ¤300.',
      'Toda arma mostra as suas propriedades (Duas Mãos, Serrilhada, Perfurante 2, Recarga, Fluxo...), o material de reparo e quantos espaços de Reforço tem. Passar o mouse numa propriedade mostra a regra do livro.',
      'O dano Cortante agora aparece com esse nome (antes era “Corte”).',
      'O domínio Esconder saiu do sistema, como no livro novo. Pontos que estavam nele foram apagados.',
      'Atributo vai no máximo até 10 (6 na criação, 10 depois de subir de nível).',
      'Testes pela ficha: clique nos dados de qualquer domínio (ex.: “3d10”) para rolar o teste com os dados 3D. A janela mostra cada dado, qual valeu (o maior, ou o menor na desvantagem), o atributo somado e o total, e avisa o Crítico quando o dado que valeu é um 10 natural.',
      'Na janela do teste dá para pôr ou tirar dados de situação (no máximo 2 a mais ou a menos) e escrever a DT: o resultado diz se foi sucesso ou falha e por quanto. Se os dados tirados deixam menos de 1 dado, cada um que falta vira desvantagem.',
      'Desvantagem automática no teste: atributo em 0 ou −1 marcado no domínio rolam 1 dado a mais e ficam com o pior.',
      'O teste vai para o histórico de dados e, se não for privado, aparece no chat com a conta inteira.',
      'Combate do livro 2.0 (Crepúsculo Vermelho) na ficha de Altherium, em janelas abertas pelos botões Atacar, Defender, Receber dano e Iniciativa, no topo da ficha.',
      'Turno: a Reação (1 por rodada) mostra se está disponível, usada ou bloqueada; Defender Total (+4 na Defesa e no Aparar) e Mirar (+2 no próximo ataque) ficam marcados. “Novo turno” renova a Reação, acaba o Defender Total, aplica Queimando e Sangrando (2 de dano cada, ignorando DB) e conta os turnos das condições. “Fim da cena” tira o Amedrontado.',
      'Condições com contador: Sangrando, Queimando (até 3 turnos), Atordoado, Derrubado (−2 na Defesa), Amedrontado (−1 em Fúria), Preso e Surpreendido (sem Reação), além dos efeitos da Tabela de Punição. As que mexem em atributo entram sozinhas nos testes.',
      'Iniciativa: rola Iniciativa + Impulso e põe o resultado na ordem de iniciativa da mesa com o nome do personagem.',
      'Atacar: escolha a arma; corpo a corpo usa Luta e à distância usa Precisão, os dois com o atributo da arma (nas F-I você escolhe Fúria ou Impulso). Arremessáveis atacam em Toque ou arremessadas. Entram Cercar, Mirar, as faixas além do alcance, inimigo em Toque e alvo em Toque de um aliado (no máximo ±2 dados) e o +1d4 do Gênesis Guerreiro ou Caçador. Empate com a Defesa não acerta; o crítico acerta sempre.',
      'Depois do acerto: rolar o dano (duas vezes no crítico), o local atingido (1d10) e o segundo golpe das armas Par. No crítico aparecem os efeitos de Serrilhada, Atordoante e Prender. Armas com Recarga ficam descarregadas depois do disparo até você recarregar.',
      'Defender (Resiliência + Espírito, empate favorece a defesa, com cobertura parcial) e, no 1 natural, a Tabela de Punição rola sozinha e marca a condição na ficha. Aparar (Reflexo + Impulso) gasta a Reação, só vale contra corpo a corpo e sem crítico, soma Defensiva e tira 2 da Lenta; superar por 5 (4 com Fluxo) ou critar abre o Contra-ataque, e falhar rola o +1d6 de dano.',
      'Receber dano na ordem do livro: Vulnerável dobra, tira o DB da parte (com Perfurante, e o Rúnico ignora metade do DB menos na armadura de Eryndor), mínimo de 1 com aviso de desgaste da armadura, Resistência e Imune. “Aplicar na ficha” tira os PV e marca o ferimento na parte do corpo.',
      'Estado Caído: quando os PV chegam a 0, o botão Teste de Morte aparece no topo da ficha. Ele mostra os turnos para sobreviver (3, e 4 com mais de 8 de Espírito) e o bônus de Determinação de cada turno (0, +1 ou +2 pelos pontos, +1 do Gênesis Determinado, até +3), que cai 1 a cada novo turno caído.',
      'Teste de Morte: 1d10 + bônus contra DT 6 com os dados 3D; o 10 natural passa sempre e o 1 não anula nada. A Medicina de um aliado dá +1 a cada 5 pontos no resultado (até +2, ou +2 direto no crítico) no próximo teste, e a Corda das Nornas do Pilar soma +1 fora desse limite.',
      'Falhar em todos os turnos é morte. Ao estabilizar, a consequência vem das falhas: 0 recupera normalmente, 1 deixa Incapacitado, 2 é coma de 1d4 − 2 sessões (com 0 de Espírito, morte). Incapacitado e Coma viram condições na ficha. O mestre pode tirar o personagem do Estado Caído a qualquer momento.',
      'Nova aba Ofício na ficha de Altherium. Recursos (Ferro-velho, Couro, Madeira, Fibra, Sebo, Ervas, Brennivín, Osso, Pó de Eryndor e Rações) entram em frações de 10, 20, 25, 50 ou 100%, com qualidade Comum, Rara ou Lendária; 100% vira 1 unidade e cada um vai até 4 unidades.',
      'Integridade: toda arma, armadura e escudo tem de 0 a 100%, mostrada no inventário. A arma gasta tira 1 do dano (50% ou menos) e 1 do ataque (30% ou menos); quebrada (0%) não ataca. A armadura gasta protege 2 a menos, metade ou nada, e a conta do dano recebido já usa isso.',
      'Desgaste automático: errar um ataque com um 1 nos dados tira 10% da arma, a falha crítica na Defesa tira 20% e o dano que não passa do DB tira 10% da armadura daquela parte. Robusta perde metade e Frágil o dobro.',
      'Reparo: custa a mesma porcentagem no material da peça. Em Campo vai até 75% e só a Forja chega a 100% (com o Martelo do Ferreiro, a arma pesada chega a 100% em Campo).',
      'Receitas modulares: escolha Base (Garrafa, Bandagem, Óleo ou Armadilha), Núcleo (Fogo, Cura, Veneno, Corte ou Calma), Catalisador opcional (Fumaça, Estilhaços, Rúnico ou Lento) e a qualidade do material do Núcleo. O site confere a combinação e o material, desconta e põe o item pronto no inventário com o efeito escrito. Também dá para fazer o Porrete de pedra (Improvisada) com 100% de Madeira.',
      'Reforços: 1 espaço nas armas leves, de arremesso, de alcance e em cada armadura, 2 nas pesadas. Os efeitos entram no combate: Fio Temperado (+4 de dano em C ou P), Empunhadura de Couro (+1 ao Aparar), Gravação Rúnica (dano Rúnico), Placas Costuradas (+2 de DB), Farpas de Osso, Cravos de Ferro e Corrente de Retorno.',
      'Sagas de Ofício valem para o grupo todo: marcar a Saga do Ferreiro Torto, das Forjas de Torvalenn ou de Eryndor libera os Reforços e o Catalisador Rúnico dela para todos da campanha.',
      'Desmontar devolve metade dos materiais dos itens feitos com receita; nos outros, o mestre diz o que rendem.',
    ],
  },
  {
    version: '2.4',
    date:    '2026-10-24',
    title:   'Configurações do site',
    items: [
      'A engrenagem no lugar do botão de modo claro e escuro abre as Configurações do site, com três abas: Sons, Aparência e Acessibilidade. Tudo vale na hora e fica guardado no seu navegador, também na tela de entrada.',
      'Sons: volume geral e um volume (com botão de mudo e de testar) para cada tipo de som: Dados, Notificações, Chat e Jogos e Vortable. Dá para silenciar tudo de uma vez sem perder os volumes escolhidos.',
      'Aparência: troca do modo claro e escuro (que saiu do botão do canto) e tamanho do texto em quatro níveis.',
      'Acessibilidade: reduzir animações, alto contraste, mais espaço entre letras e linhas, contorno bem visível na seleção pelo teclado e desligar as partículas e o brilho de clique. Há também Restaurar padrões.',
      'Ficha de D&D mais leve e fluida: a ficha só redesenha o que mudou (salvar, avisos e abrir janelas não refazem tudo), o painel Automatizar e o importador de PDF só carregam quando você abre, arrastar a barra de PV acompanha o dedo sem engasgar e a busca de magias e itens não segura a digitação. Listas compridas animam só as primeiras linhas.',
      'Novas animações na ficha: um brilho passa pelas barras de PV, experiência e carga, o dado de rolar balança ao passar o mouse e a ficha carrega com um esqueleto cinza brilhando no lugar do ícone girando.',
      'O d100 agora é o bolão: um dado só, redondo, com 100 faces e os números de 1 a 100 espalhados, no lugar do par de dezena e unidade. O número sorteado aparece na face de frente. A bola rola, tomba e para sozinha numa face.',
      'Dois dados novos em todos os sistemas: o 1d3 e o 1d2. Os dois têm botão na rolagem rápida e valem em qualquer fórmula (2d3+1, 1d2...), e rolam em 3D: o d3 é um cubinho com 1, 2 e 3 repetidos nas faces opostas e o d2 é uma moeda de 2 lados (1 e 2). A rolagem de 1d3 vem com a observação “dado pra ver o tamanho de coisas kkkk”. Moeda e d3 não contam como crítico nem como falha crítica.',
      'Crítico e falha crítica com animações de tela cheia! Quando um d20 para no 20, a tela toda explode a partir do dado e sorteia uma entre 8 animações: fogo, brilho, relâmpago, água, gelo, círculo arcano, natureza ou cosmos. No 1, uma entre 8 animações sombrias: chamas sombrias, relâmpago rubro, sangue escorrendo, trevas, rachaduras, veneno, vazio ou cinzas. Cada uma tem o seu som, nunca repete a anterior e vale para todas as rolagens do D&D (testes, ataques, rolagem livre e personalizada, e as dos outros jogadores). O volume segue o dos sons dos dados; “Sem efeitos” e “Reduzir movimento” deixam só o som.',
      'No Dado de Betinha Tester, o brinquedinho dentro do dado agora fica fixo, de frente para o número mais alto do dado (o 20 no d20) e gira junto com ele. Antes ele já se virava para o resultado antes do dado parar.',
      'O botão flutuante do rolador de dados agora é amarelo com o dado preto. Nas campanhas de D&D ele continua vermelho, também com o dado preto.',
      'Na ficha de Altherium, as barras de PV, PE e do recurso da raiz (FV, PR ou Cartas) ficaram mais juntas no cabeçalho, com bem menos espaço entre elas.',
      'O × dos cartões de rolagem saiu de cima da borda dourada e ficou dentro da moldura, com folga do canto.',
      'O botão Pedir teste do mestre, na lista de fichas, ficou pequeno e alinhado à esquerda, sem ocupar uma linha inteira no meio da tela.',
    ],
  },
  {
    version: '2.3',
    date:    '2026-10-24',
    title:   'Ficha de D&D: tudo pode ser manual',
    items: [
      'O botão Automatizar da ficha de D&D ganhou mais 8 itens. Agora tudo o que a ficha calcula sozinha pode virar manual: visão no escuro, peso carregado, proficiência em salvaguardas, perícias do antecedente, proficiências e idiomas, ataques com arma, dados de vida, e truques e magias conhecidas.',
      'Em manual, cada um começa com o valor de hoje e você muda à vontade: tira ou põe qualquer proficiência (até as da classe e da raça), escreve quantos dados de vida de cada tipo tem, quantos truques e magias cada classe conhece, e quanto carrega. Voltar para Automático devolve as contas do livro.',
      'As características do livro também podem virar suas: no lápis, "Personalizar o texto" copia o texto do livro para você editar.',
      'Importar ficha por PDF: classe, raça e antecedente que não estão no livro do sistema não travam mais a importação. Eles entram como próprios, com o nome do PDF, e a importação pergunta o que o livro diria (dado de vida, subclasse, se a classe conjura e com qual atributo, e se a raça enxerga no escuro). O resto você muda na ficha.',
      'Dados de vida aparecem em toda ficha, também na criada do zero no site: classe própria (fora do livro) ou ficha sem classe entram com d8, e é só clicar no "d8" para trocar.',
      'O quadro da Visão, no alto da ficha, ganhou o botãozinho "Visão no escuro" para marcar e desmarcar.',
      'Nenhuma rolagem cai solta pela tela do Vortable. Dano, dado de vida e as outras rolagens agora rolam num cartão com a mesma moldura dos testes de perícia e atributo (para você, fica até fechar no × ou no Esc; para a mesa, é o cartão azul que some sozinho).',
      'Física dos dados refeita: eles rolam bem mais antes de dar o resultado (pelo menos 2,6 segundos de rolagem, quicando e girando mais), e o bug dos dados presos e grudados num canto foi corrigido. A causa era o chão da rolagem livre com um dado só: ficava menor que o próprio d20, que entalava nas paredes. Agora o chão tem um tamanho mínimo e a câmera se afasta o necessário; o lançamento é conferido e refeito se o dado terminar torto ou rolar pouco.',
      'Dados quase parados não dão mais pulinhos: o empurrão que endireitava um dado torto saltava e virava o resultado de repente; agora o dado só escorrega e tomba, e o resto de quique no fim é amortecido (se terminar torto, o lançamento é refeito antes de aparecer). Só numa multidão de dados o empurrão ainda salta.',
    ],
  },
  {
    version: '2.2',
    date:    '2026-10-23',
    title:   'Um presente para os betas do D&D',
    items: [
      'Quem testou o D&D antes de todo mundo ganhou o Dado de Betinha Tester: resina transparente com um emoji nerd de brinquedo dentro de cada dado, de óculos, sorrisão e luvinhas. Ele aparece numa vitrine girando, com o mascote, na primeira vez que os betas entram, e fica na aba "Meus dados" do cartão de dados. É exclusivo, mas a mesa inteira vê quando um beta rola com ele.',
      'Ficha de D&D: toda arma, magia, item, característica (talento) e recurso tem um lápis e uma lixeira no canto. O lápis abre a edição de tudo (nome, nível, bônus, dano, tipo de dano, escola, alcance, usos, recarga, descrição) e a lixeira tira da ficha. Os cartões ficaram mais limpos: os campos de editar só aparecem no lápis.',
      'Os números de todos os dados ficaram maiores, para ler de longe na mesa. No dado de resina eles têm contorno escuro, e as faces de trás ficam apagadas para não se misturarem com as da frente.',
    ],
  },
  {
    version: '2.1',
    date:    '2026-10-23',
    title:   'Ficha de D&D com animações e feita para o celular',
    items: [
      'Tudo na ficha de D&D se mexe: as abas entram deslizando e os cartões aparecem em cascata, botões afundam no clique, interruptores e bolinhas estalam ao ligar, e os números (CA, perícias, modificadores, contadores) dão um pulinho quando a conta muda.',
      'Adicionar e remover: ataque, magia, item, recurso, característica, classe ou proficiência novos entram com um brilho, e os removidos encolhem e saem da lista em vez de sumir de uma vez.',
      'Barra de PV: o dano faz a barra tremer e deixa um rastro vermelho que escorre atrás dela; a cura acende em verde. Sem PV, o quadro pulsa como um coração.',
      'A ficha se arruma pela largura que tem, não pela da tela: no painel da ficha do Vortable, no mestre e no celular ela troca de colunas sozinha. No celular as sete abas ficam numa grade, todas à vista, os botões são maiores para o dedo, os campos não dão zoom no iPhone e os livros de magias e de itens ocupam a tela inteira.',
      'Cartão de dados sem barra de rolagem: ele cabe inteiro na tela, com o palco dos dados maior e o dado no meio. Na tela larga, rolagem rápida e fórmulas ficam de um lado e os recentes do outro.',
      'O site abre mais rápido: o código da ficha de D&D só é baixado quando alguém abre uma ficha de D&D.',
    ],
  },
  {
    version: '2.0',
    date:    '2026-10-23',
    title:   'TEMOS D&D NO SITE!',
    items: [
      'O D&D 5e (regras de 2014, conteúdo do SRD 5.1 em português) está liberado pra todo mundo. Escolha D&D 5e ao criar a campanha, e cada jogador cria o personagem na aba Ficha (o mestre também cria fichas de NPC).',
      'Ficha completa que se calcula sozinha: atributos, salvaguardas, 18 perícias, proficiência, iniciativa, CA, deslocamento (metros ou pés), visão no escuro, percepção passiva, carga, PV com dados de vida, PV temporários, salvaguardas contra a morte, condições e exaustão. O botão Automatizar deixa qualquer valor manual, até negativo.',
      'Criador de personagem: 9 raças com sub-raças, 12 classes com 40 subclasses, 14 antecedentes e multiclasse até o nível 20. O antecedente já dá as perícias dele, e dá para digitar raça, classe, subclasse e antecedente próprios.',
      'Magias: livro com as 319 magias do SRD (busca e filtros), espaços de magia, Magia de Pacto do Bruxo, CD e ataque de magia e magias próprias no mesmo cartão das do livro. Combate: ataques com bônus e dano, Crítico, descrição da arma ocultável. Inventário: livro com 111 itens, moedas, carga e itens próprios com descrição.',
      'Dados 3D rolando na mesa: clique no d20 de uma perícia, salvaguarda, ataque ou dano e o painel de teste (estilo Baldur’s Gate 3) abre com CD, vantagem, Bênção, Orientação, Inspiração de Bardo e bônus de situação. Os dados têm física de verdade e três conjuntos (madeira velha, granito e plástico marmorizado), e a mesa vê a sua rolagem ao vivo.',
      'O botão de dados do canto virou o rolador de D&D: rolagem rápida, fórmulas como 1d20+5, 2#d20+5 (o maior de dois) e 2@d20+5 (o menor), até 100 dados de uma vez, rolagem privada e os recentes da mesa.',
      'Mestre: peça testes para a mesa com a CD que quiser, oculta ou revelada depois da rolagem. Fichas: importe o PDF da ficha JohnBard DnD 5e pelo botão Importar PDF, com perguntas em cartões, conferência das contas e desfazer.',
    ],
  },
  {
    version: '1.76',
    date:    '2026-10-17',
    title:   'Vortable mais estável, e todo erro com um código',
    items: [
      'A conexão do Vortable foi refeita pra aguentar a mesa cheia (o mestre e 5 jogadores, ou mais) em tempo real. Se a sua internet cai ou fica instável, o Vortable percebe em uns 10 segundos e volta sozinho; ao voltar, o mapa se acerta: quem saiu enquanto você estava fora some, quem entrou aparece, e a hora, o tempo e as zonas que o mestre mudou chegam até você.',
      'Acabaram os bonecos fantasmas e duplicados: quem fecha o Vortable some na hora do mapa de todos, e abrir o Vortable em outra aba ou no celular com a mesma conta não duplica o boneco. A aba antiga avisa e tem o botão "Usar aqui" pra voltar a jogar por ela.',
      'Rede que bloqueia a ligação direta (4G, rede de empresa ou de faculdade)? O jogador entra pela conexão reserva, que passa pelo servidor. É um pouco mais lenta, mas funciona sempre. E as posições agora vão por um canal rápido: um pacote perdido não trava mais o movimento de todo mundo.',
      'O mestre pode recarregar a página no meio da sessão: os jogadores veem "O mestre está sem conexão" e o jogo continua de onde parou quando ele volta (se ele não voltar em 90 segundos, a sessão acaba). Ter o site aberto em outra aba enquanto joga também não derruba mais ninguém.',
      'Todo erro do Vortable tem um código (por exemplo VT-NET-002, conexão com o mestre caiu) e aparece num aviso no canto dizendo o que aconteceu e o que fazer. Os erros que param o jogo abrem uma janela no meio da tela com o botão pra recarregar. Leituras do servidor que falham por rede tentam de novo sozinhas antes de dar erro.',
      'Mestre: um botão "Erros" na barra do Vortable mostra, ao vivo, os erros de todos da campanha (quem, quando, o código, o que houve e os detalhes do momento), com filtro por pessoa e por tipo. Erros sérios de um jogador também aparecem num aviso pra você. A barra mostra a latência de cada jogador e quem está pela conexão reserva.',
      'Pedir pra passar por uma saída enquanto a conexão cai (ou sem resposta do mestre) agora avisa o motivo, em vez de só não deixar passar. E quando o mestre leva alguém a uma zona, manda assistir ou tira da sessão e a pessoa não está conectada, aparece o aviso.',
    ],
  },
  {
    version: '1.75',
    date:    '2026-10-17',
    title:   'Arte na mesa, ao vivo pra todos',
    items: [
      'Aba Mesa, Artes recentes: o mestre ganhou o botão "Na mesa" em cada arte (e "Pôr na mesa" quando a arte está aberta em tamanho grande). A arte aparece na hora, em tempo real, na Transmissão de todos os jogadores.',
      'Se o mestre estiver transmitindo a tela, a arte fica por cima dela (o som continua tocando). O ponteiro funciona sobre a arte: todos veem o brilho no mesmo lugar dela.',
      'A arte que está na mesa ganha uma moldura dourada e a etiqueta "Na mesa". Pra voltar à tela transmitida (ou à cena de espera), é só clicar em "Tirar" ou em "Tirar da mesa" na barra abaixo da Transmissão. Excluir a arte também tira da mesa.',
      'Quem está em outra página recebe o aviso "o mestre pôs uma arte na mesa", com o botão Assistir, igual ao da transmissão de tela.',
    ],
  },
  {
    version: '1.74',
    date:    '2026-10-17',
    title:   'Limite de triunfos editável',
    items: [
      'Ficha de Altherium, aba Triunfos: o limite no canto ("Triunfos: 2 / 3") agora é um número que dá pra mudar, igual ao Movimento. Quer 5 triunfos por causa de uma build ou de uma regra da casa? É só digitar 5.',
      'Mudado à mão, aparece o botão "automático", que volta pra regra de sempre: (2 + domínios com ponto) ÷ 2, arredondado pra baixo. Digitar o mesmo número da regra também volta pro automático, e aí o limite segue os domínios de novo.',
    ],
  },
  {
    version: '1.73',
    date:    '2026-10-16',
    title:   'Transmissão na aba Mesa, Vortable embaixo',
    items: [
      'A Transmissão de tela não tem mais uma aba própria: ela fica no alto da aba Mesa da Sessão, com o mesmo funcionamento de antes (transmitir, pausar, trocar tela, ponteiro, som e tela cheia).',
      'A aba Mesa agora segue esta ordem: Transmissão, Artes recentes e, por último, o campo do Vortable com o botão "Entrar no Vortable".',
      'O ponto de "ao vivo" da aba Mesa acende também quando só há transmissão de tela, e o aviso "Assistir" e o atalho da Visão geral levam direto pra ela.',
    ],
  },
  {
    version: '1.72',
    date:    '2026-10-15',
    title:   'O criador de personagem se adapta à campanha',
    items: [
      'O criador de personagem agora só oferece o que combina com o sistema da campanha. Em Altherium e D&D 5e (mundo medieval) somem as armas de fogo, o taco e o cano, as bombas, o fungo da infecção, a máscara de gás, o colete tático, camisetas, polo, regata, óculos de sol e outras peças de hoje; ficam espadas curtas e machados (facão, machadinha, faca) e o arco, além de elmos, armaduras e chapéus mágicos.',
      'Em Terra Devastada, Terra Devastada Adaptada e Vampiro (mundo atual) somem elmos e armaduras de metal, chapéus de mago, coroas, ombreiras, túnicas e as raças de fantasia (orc, goblin, troll, minotauro...), além de asas, chifres e cauda. As armas, a infecção e as roupas do apocalipse continuam.',
      'Campanha Genérica continua com tudo. Ao abrir um personagem que já tinha uma peça que não combina (a pistola de um personagem de Altherium, por exemplo), ela sai na hora; ao salvar, o personagem fica limpo.',
    ],
  },
  {
    version: '1.71',
    date:    '2026-10-15',
    title:   'Pose sentada de perfil',
    items: [
      'Criador de personagem, pose Sentado: agora de perfil, pra ficar claro que ele está sentado. O tronco fica no chão e as pernas ficam deitadas, esticadas pra frente, com os pés levantados na ponta. Olhando pra esquerda ou pra direita ele vira pro lado certo; de frente e de costas aparece de perfil olhando pra direita.',
    ],
  },
  {
    version: '1.70',
    date:    '2026-10-15',
    title:   'Novo mundo pronto no Vortable: SALTMORE',
    items: [
      'Mundos → Mundos prontos ganhou o SALTMORE: uma floresta montanhosa e escura, de pinheiros azul-esverdeados e trilha de terra, que começa dentro de uma cabana abandonada (térreo com lareira apagada e mobília quebrada, e um sótão pequeno com uma cama e tralhas) e desce, de zona em zona, até a ponte de uma cidade. São 9 zonas e 24 NPCs.',
      'O caminho: a clareira da cabana (horta morta, poço, um túmulo solitário), a trilha da floresta sombria (um santuário esquecido e um acampamento de caçadores abandonado), o riacho com a cascata, o píer e a ponte de madeira, a encosta rochosa em ziguezague (torre em ruínas, mirante e uma emboscada) e a estrada até a ponte de pedra e o portão da cidade, onde o mapa continua.',
      'No meio do caminho fica a Vila de Pedraverde, bem grande: muralha de pedra com dois portões, praça com chafariz e feira, capela com torre e cemitério, ferreiro, hortas, pomar, celeiro e a Estalagem do Corvo, que dá pra visitar por dentro. Os moradores (guardas, estalajadeira, ferreiro, feirantes, padre, uma criança...) já estão nas zonas.',
      'O mundo usa só peças que o Vortable já tinha, então não precisa de nada novo. Dá pra criar o mundo direto por "Criar este mundo" ou baixar o arquivo e usar "Importar mundo".',
    ],
  },
  {
    version: '1.69',
    date:    '2026-10-15',
    title:   'O mestre cria o personagem do jogador, mecha de cabelo e pose sentada',
    items: [
      'Vortable, ficha do jogador: o mestre agora vê, embaixo do retrato da ficha de cada jogador, o botão "Criar personagem do jogador" (ou "Editar personagem do jogador", se ele já tem um). Abre o mesmo criador de personagem do Vortable, e o que o mestre salvar vira o boneco com que aquele jogador joga na campanha. Serve pra quem não consegue montar o boneco sozinho. Dentro do criador o mestre também pode importar um arquivo de personagem (botão de importar, em cima).',
      'Criador de personagem, aba Cabelo: novo espaço "Mecha de cabelo". Pinta uma parte do cabelo de outra cor (a mecha branca no cabelo ruivo): mecha da frente, metade do cabelo ou mecha fina, do lado direito ou do esquerdo do personagem, na cor que quiser. Aparece de frente, de lado e no jogo.',
      'Criador de personagem, aba Corpo: nova linha "Pose" (Em pé ou Sentado). Sentado é pra personagens que não andam: o boneco fica sentado no chão, com as pernas esticadas pra frente, em todas as animações (parado, andando e correndo; ao se mover ele se arrasta).',
      'Personagem pronto pra importar: o ruivo de mecha branca, barba, camiseta preta, tiras vermelhas, braçadeiras e botas, sentado, está em /vortable/personagens/ruivo-mecha-branca-sentado.vortable-personagem.json.',
    ],
  },
  {
    version: '1.68',
    date:    '2026-10-15',
    title:   'Campanhas no celular viram cards que abrem',
    items: [
      'Na lista de campanhas do celular, cada campanha é um card enxuto: capa, nome inteiro (quebra em até duas linhas, sem cortar com "…"), seu papel e o status. Tocando no card ele abre um pouco e mostra a capa grande, o sistema, a descrição e o botão Entrar. Um card aberto por vez; tocar de novo fecha.',
      'O mestre arquiva, desarquiva e exclui pelos botões dentro do card aberto (no computador e no tablet continua como era, com o envelope e a lixeira ao lado).',
    ],
  },
  {
    version: '1.67',
    date:    '2026-10-15',
    title:   'Celular: botão Sair, menu de ferramentas e janelas',
    items: [
      'Sair da conta no celular: o botão da barra de cima agora diz "Sair" (era só uma setinha) e a página Mais ganhou o botão "Sair da conta" no fim.',
      'Os botões do canto (sino, dados, chat, caderno, documentos) ficam recolhidos num botão de menu no celular e no tablet, em vez de taparem campos de texto e botões das páginas. Tocando nele abrem como sempre, com o número de mensagens não lidas em cima; resultado de dado e aviso de mensagem nova continuam aparecendo sozinhos.',
      'Teclado aberto no celular: a barra de baixo sai da frente e as janelas do canto (chat, dados) sobem junto com o teclado em vez de ficarem atrás dele. A altura das telas passou a contar a barra de endereço do navegador do celular, que sobe e desce (nada mais fica escondido embaixo).',
      'Vortable, Mundos: o cabeçalho e os mundos prontos ficam certos no celular (o botão Fechar saía da tela). No editor, a faixa de ferramentas rola quando a tela é baixa, e as últimas ferramentas deixam de ficar inalcançáveis com o celular deitado.',
    ],
  },
  {
    version: '1.66',
    date:    '2026-10-15',
    title:   'Vortable do jogador no celular e no tablet',
    items: [
      'Criar o personagem no celular: o título e o botão Salvar não se sobrepõem mais, e com o celular deitado o boneco fica de um lado e as opções do outro (antes as opções ficavam espremidas numa faixa de uns 110 px).',
      'Assistir o jogo (câmera de espectador): a barra de cima, que ocupava um terço da tela do celular, virou uma faixa compacta (câmera, jogador seguido e "Entrar em jogo"), com botões maiores pro toque. Deitado, as reações ficam miúdas embaixo.',
      'Conferido do lado do jogador: andar com o joystick, Correr, zoom, o menu de ferramentas (dados, chat, ficha), a ficha em tela cheia, o criador de personagem e a câmera de espectador, no celular em pé e deitado e no tablet.',
    ],
  },
  {
    version: '1.65',
    date:    '2026-10-14',
    title:   'Vortable e site no celular e no tablet',
    items: [
      'Vortable com controles na tela: no celular e no tablet aparece um joystick à esquerda (8 direções), o botão Correr à direita e os botões de zoom (− e +) embaixo, que também deixam esconder os controles. Quem testa o mundo pelo editor (botão Testar) também ganha os controles.',
      'O Vortable foi pensado pro celular deitado: com o celular em pé aparece o aviso "Vire o celular" (dá pra continuar em pé), e na tela cheia do Android a tela trava na horizontal. O zoom do jogo acompanha o tamanho da tela (antes ele só mostrava uns 6 blocos de largura no celular).',
      'Dados, chat, ficha, caderno e documentos do Vortable ficam recolhidos num botão de menu na borda direita no celular, pra não cobrirem o jogo nem os botões de andar. A faixa de cima do mestre (modo, cena e editor) ficou bem mais baixa, e o botão Testar esconde essa faixa pra dar a tela toda ao jogo.',
      'Tablet: a barra de baixo e o menu de cima do site passam a valer até 900 px (antes, no iPad em pé, a barra lateral deixava o conteúdo apertado e algumas telas estouravam pro lado). As abas da Sessão rolam por dentro em vez de vazar.',
      'Celular deitado: a barra de baixo, o cabeçalho da campanha e a janela do canto (chat, dados, notificações) encolhem pra caber na altura pequena. No iPhone, nada fica embaixo do entalhe. Telas bem estreitas (320 px) também ficaram certas.',
      'Toque: botões menores das fichas (contadores, caixinhas de Vida, Horror e Convicção, abas, cartões de NPC) ganharam área de toque maior; o site não dá mais zoom ao tocar num campo de texto no iPhone; o fim da página não fica escondido atrás dos botões do canto; o quadro em branco explica o que fazer no toque.',
    ],
  },
  {
    version: '1.64',
    date:    '2026-10-13',
    title:   'Janelinhas do site no lugar dos avisos do navegador',
    items: [
      'Todos os "campaign-lab diz…" (as caixinhas de confirmar, avisar e perguntar do navegador) foram trocados por janelinhas pequenas no centro da tela, com o visual do site: ícone, título dourado, texto e botões. Arquivar, sair da campanha, apagar ficha, criatura, mundo ou zona, tirar alguém da sessão, encerrar o jogo, fechar documento sem salvar e as perguntas do Vortable, entre outras.',
      'As perguntas perigosas (apagar, tirar, encerrar) ganharam visual vermelho e começam com o foco em Cancelar, então um Enter sem querer não apaga nada. Esc cancela, e o Enter confirma nas demais. Quando "Novo mundo" e "Renomear" pedem um nome, o campo de texto fica dentro da própria janelinha.',
      'Se aparecer mais de uma pergunta ao mesmo tempo, elas entram na fila e aparecem uma por vez. As janelinhas ficam acima de qualquer tela cheia (jogos e Vortable).',
      'Por baixo: o criador de personagens e o editor de zonas do motor do Vortable também usam essas janelinhas (mais uma remenda no motor: node scripts/patch-vortable-camera.mjs depois de sincronizar o motor de novo).',
    ],
  },
  {
    version: '1.63',
    date:    '2026-10-13',
    title:   'Criar campanha redesenhado, com janela de escolha de sistema',
    items: [
      'A tela de criar campanha foi refeita: três passos numerados (nome, sistema, descrição), campos maiores, entrada animada e uma prévia viva do cartão da campanha ao lado, que muda na hora conforme você escreve o nome e escolhe o sistema.',
      'O sistema não vem mais todo de uma vez na página. Agora tem o botão "Escolher sistema da campanha", que abre uma janela grande no centro com um cartão por sistema, três por linha, rolando pra baixo se tiver mais. Cada cartão tem arte do sistema, nome, descrição e, quando for o caso, as marcas Em breve, Guardado ou 2 versões.',
      'Artes novas e animações: os cartões entram um depois do outro, sobem e ganham brilho na cor do sistema ao passar o mouse, afundam ao clicar e mostram um visto que "pula" ao marcar, antes de a janela fechar. Escolhido o sistema, a página mostra um banner com a arte e o botão Trocar sistema. Terra Devastada continua perguntando a versão (original ou adaptada).',
      'As artes (dados dourados, castelo e dragão, norte gelado, catedral gótica e uma rua do próprio mundo em pixel art do Terra Devastada) ficam em public/sistemas e são desenhadas por scripts/make-system-art.py.',
    ],
  },
  {
    version: '1.62',
    date:    '2026-10-13',
    title:   'Excluir campanha pela lista',
    items: [
      'Na lista de campanhas (ativas e arquivadas), o mestre ganhou uma lixeira vermelha ao lado do envelope. Ao clicar abre uma janela de confirmação que só libera o botão "Excluir para sempre" depois de escrever, igualzinho, a frase DELETAR seguida do nome da campanha (por exemplo, DELETAR TESTE VAMPIRO), sem parênteses.',
      'Excluir apaga a campanha e tudo o que está nela (fichas, mundos do Vortable, notas, quadro, chat, episódios e jogadores), sem volta. Se só quiser tirar da lista, o envelope arquiva.',
    ],
  },
  {
    version: '1.61',
    date:    '2026-10-13',
    title:   'Arquivar campanhas',
    items: [
      'Na lista de campanhas, o mestre ganhou um botão de envelope ao lado de cada campanha dele: ele arquiva a campanha (com uma confirmação), e ela sai da lista principal. Nada é apagado.',
      'Ao lado do "+ Criar campanha" tem um botão novo, "Arquivadas", que mostra todas as campanhas arquivadas (com o número delas). Lá cada campanha tem o Entrar de sempre e o envelope aberto pra desarquivar. Clique em "Arquivadas" de novo pra voltar às campanhas ativas.',
      'Arquivar usa o status "Arquivada" da campanha (o antigo "Encerrada" mudou de nome, em Configurações também), então vale pra todos: o jogador também vê a campanha em "Arquivadas", mas só o mestre arquiva e desarquiva.',
    ],
  },
  {
    version: '1.60',
    date:    '2026-10-11',
    title:   'Transmissão de tela: a ligação não se perde mais pelo caminho',
    items: [
      'Provável causa dos jogadores que ficavam "conectando" pra sempre: cada rota de rede da ligação ia numa mensagem separada pelo canal em tempo real (uns 20 a 30 avisos em poucos segundos), e o limite de mensagens por segundo derrubava parte delas. Sem as rotas, a ligação nunca abria. Agora o mestre e o jogador juntam todas as rotas e mandam tudo numa mensagem só (a oferta e a resposta), sem avisos soltos.',
      'No painel do mestre, o jogador cuja ligação não abre em 25 segundos sai da lista (em vez de ficar "conectando" pra sempre) e o jogador refaz o pedido sozinho.',
      'Testado com um mestre e um jogador de mentira no mesmo navegador: conectou com vídeo e áudio, usando 1 oferta e 1 resposta e nenhum aviso de rota solto (antes eram dezenas). Rede real (4G, firewall) eu não consigo simular aqui.',
    ],
  },
  {
    version: '1.59',
    date:    '2026-10-11',
    title:   'Transmissão de tela: jogador que ficava só "conectando"',
    items: [
      'Corrigido: quando a ligação direta entre o mestre e um jogador não abria (rede fechada, firewall, 4G), o jogador ficava em "Abrindo a cena…" por até meio minuto, esperando o navegador desistir sozinho. Agora, se a ligação não abre em 15 segundos, ela é refeita.',
      'A partir da segunda tentativa, e havendo servidor TURN configurado, a conexão passa a ir só pelo TURN (dos dois lados), que é a rota que funciona quando a direta não passa. Depois de várias tentativas sem sucesso aparece "Tentar de novo", e em "Detalhes da conexão" fica o motivo.',
    ],
  },
  {
    version: '1.58',
    date:    '2026-10-11',
    title:   'Transmissão de tela de volta',
    items: [
      'A transmissão de tela do mestre voltou, do jeito que era: na Sessão, uma sub-aba nova chamada Transmissão (ao lado de Mesa). O mestre transmite uma janela, aba ou a tela inteira, com som, e os jogadores assistem direto no navegador (WebRTC, nada é gravado).',
      'Voltaram também o ponteiro (clique na imagem e todos veem o brilho no mesmo lugar), Pausar, Trocar tela sem derrubar ninguém, o indicador de qualidade da conexão de cada jogador, a tela cheia, o volume e "Ativar som", a reconexão automática e os "Detalhes da conexão" quando a transmissão não abre.',
      'O jogador recebe o aviso "iniciou uma transmissão de tela" com o botão Assistir em qualquer página do site, o som continua tocando em outras abas, e a Visão geral e o menu da campanha mostram "ao vivo".',
      'Convive com o Vortable: são duas coisas separadas (a sub-aba Mesa continua sendo o mundo 2D e as artes). A transmissão usa um canal próprio, então não precisa de migration nova.',
    ],
  },
  {
    version: '1.57',
    date:    '2026-10-11',
    title:   'Silenciador na fabricação (fichas Terra Devastada)',
    items: [
      'Fabricar ganhou um item novo: o Silenciador, que custa 2 Sucatas e vai pro inventário como item (abafa o tiro de uma arma de fogo; o efeito é do Narrador). Vale em todas as fichas da Terra Devastada Adaptada, inclusive nas de NPC.',
    ],
  },
  {
    version: '1.56',
    date:    '2026-10-10',
    title:   'Pastor alemão, importar NPCs e recarregar sem derrubar ninguém (Vortable)',
    items: [
      'Gerador de NPCs: novo tipo "Cachorro". Sorteia pastores alemães em quatro pelagens (clássico com sela preta, preto, sable e branco) com nomes de cachorro. Anda, corre e fica parado, de frente, de costas e de lado, e dá pra arrastar pro mapa, colocar e controlar como qualquer NPC.',
      'Gerador de NPCs: nova aba "Importar". Importe arquivos de personagem do Vortable (.vortable-personagem.json, de um ou de vários personagens, os mesmos que o criador de personagens exporta). Eles ficam guardados na lista (por campanha, neste navegador), com Colocar, arrastar pro mapa e um ✕ pra tirar da lista. O arquivo do pastor alemão pronto está em /vortable/personagens/pastor-alemao.vortable-personagem.json.',
      'O cachorro aparece também no criador de personagens como um corpo especial (ao lado de esqueleto e zumbi).',
      'Quando um jogador recarrega a página, o resto da mesa não reinicia mais: o mestre lembra quem já está na cena e entrega ao jogador que voltou, sem pedir pra todos se anunciarem de novo (antes, cada entrada ou queda gerava uma enxurrada de mensagens pra todos). E os jogadores não redesenham mais a tela quando o mestre só reenvia o mesmo estado da mesa.',
      'Quando o jogador recarrega a página, fecha a aba ou a conexão cai, ele volta na zona e no ponto em que estava (a posição é guardada no navegador a cada segundo), em vez de voltar pro início do mundo.',
    ],
  },
  {
    version: '1.55',
    date:    '2026-10-10',
    title:   'Hora atual do mapa na barra do Controle ao vivo (Vortable)',
    items: [
      'Ao lado do reloginho da barra do Controle ao vivo agora aparece a hora atual do mapa (por exemplo 18:30), atualizada sozinha enquanto o tempo passa, igual à da zona que você está vendo. Vale tanto no ciclo dia/noite quanto na hora fixa.',
    ],
  },
  {
    version: '1.54',
    date:    '2026-10-10',
    title:   'Zoom do Controle ao vivo mais sensível (Vortable)',
    items: [
      'O zoom da roda do mouse na câmera do mestre ficou o dobro de sensível: cada clique da rodinha aproxima ou afasta cerca de 38% (antes 17%), e no touchpad responde mais rápido. Continua ancorado no cursor.',
    ],
  },
  {
    version: '1.53',
    date:    '2026-10-10',
    title:   'Dias de 3 e 5 horas (Vortable)',
    items: [
      'Na Hora do Controle ao vivo, "Um dia dura" ganhou duas opções novas: 3 horas e 5 horas (além de 12, 24, 48 e 96 minutos). Os dias de 2 horas pra cima aparecem escritos em horas.',
      'A mesma lista vale no editor de zonas (Mundo > Hora do mundo), e o ciclo continua de onde estava ao trocar a duração.',
      'Por baixo: mais uma remenda no motor (node scripts/patch-vortable-camera.mjs depois de sincronizar o motor de novo).',
    ],
  },
  {
    version: '1.52',
    date:    '2026-10-10',
    title:   'Zoom do Controle ao vivo no lugar certo (Vortable)',
    items: [
      'Corrigido: na câmera do mestre, o zoom da roda do mouse (mais e menos) ia pra um lugar errado em vez de ficar onde o cursor está. O motor calculava o ponto sob o mouse com a câmera ainda desatualizada. Agora o ponto do mapa que está sob o cursor fica parado enquanto você aproxima ou afasta, como num mapa online.',
      'Acompanhando um jogador, o zoom fica centrado nele, que é o que faz sentido enquanto a câmera o segue. O zoom também ficou proporcional à força da roda: suave no touchpad e igual ao de antes na rodinha do mouse.',
      'Os botões − e + do painel continuam dando zoom no centro da tela, e "Mapa inteiro" enquadra a zona toda.',
      'Por baixo: mais uma remenda no motor (node scripts/patch-vortable-camera.mjs depois de sincronizar o motor de novo).',
    ],
  },
  {
    version: '1.51',
    date:    '2026-10-10',
    title:   'Roupas coladas no corpo ao correr (Vortable)',
    items: [
      'Corrigido: ao correr, roupas, chapéus, armas e mochilas descolavam do bonequinho e ficavam soltos. A causa: muitas peças só têm o desenho de caminhar, e o corpo usava o desenho de correr (poses que não batem).',
      'Agora, se qualquer peça equipada não tem a animação de correr, o boneco inteiro corre usando os quadros de caminhar: tudo se move junto, sem desgrudar. Quem usa só peças completas continua com a corrida de verdade. O mesmo vale pra ficar parado.',
      'Vale pra todos os jogadores, NPCs e pra câmera do mestre, que montam o boneco do mesmo jeito.',
      'Por baixo: mais uma remenda no motor (node scripts/patch-vortable-camera.mjs depois de sincronizar o motor de novo).',
    ],
  },
  {
    version: '1.50',
    date:    '2026-10-10',
    title:   'O mestre libera a saída de zona (Vortable)',
    items: [
      'Quando um jogador pisa numa saída pra ir a outra zona, o boneco dele para e o mestre recebe um aviso no canto da tela (com um toquinho de som): "Fulano quer sair da zona", de onde pra onde e qual saída, com os botões Sim e Não.',
      'Sim: o boneco atravessa pra outra zona na hora. Não: ele fica onde está, com o aviso "O mestre não permitiu sair daqui", e pode tentar de novo quando quiser.',
      'O jogador vê "Esperando o mestre permitir a ida para…" enquanto não há resposta. Se o mestre não responder em 90 segundos, a saída é negada, e se a conexão com o mestre cair o pedido some.',
      'Os pedidos se empilham se vários jogadores tentarem sair juntos, e somem sozinhos se o jogador desistir ou sair da sessão. Quem joga sozinho, sem o mestre ao vivo, atravessa sem perguntar. O NPC que o mestre controla não precisa de licença.',
      'Corrigido nos interiores novos de Nova York: o nome de cada zona saía com o nome de uma sala em vez do nome do prédio (Farmácia, Bodega, Delegacia…). Importe de novo o nova-york.mundo.json para ver os nomes certos.',
      'Por baixo: mais uma remenda no motor (node scripts/patch-vortable-camera.mjs depois de sincronizar o motor de novo).',
    ],
  },
  {
    version: '1.49',
    date:    '2026-10-10',
    title:   'Interiores de Nova York bem mais detalhados (Vortable)',
    items: [
      'Todos os interiores do mundo NOVA YORK: ZONA MORTA foram refeitos do zero, com várias salas por prédio, paredes e portas entre elas, e muito mais móveis do jeito de cada estabelecimento.',
      'Corrigido o bloqueio que deixava uma parte do ambiente (a sala menor) impossível de alcançar por causa de uma parede: agora toda sala tem passagem e o mundo inteiro foi conferido sala por sala, sem nenhuma área fechada.',
      'Farmácia com balcão, prateleiras, consultório de vacina, escritório, estoque e banheiro; bodega com geladeiras, gôndolas, câmara fria, estoque e escritório; lanchonete com cozinha, despensa e banheiro; loja de roupas com araras, manequins, provadores e estoque; posto com loja, oficina, escritório e banheiro.',
      'Prédio de apartamentos com saguão, apartamentos completos (cama, cozinha, sala, banheiro) e corredores; delegacia com recepção, investigação, interrogatório, arquivo, armeiro, celas, alojamento e comando; escritórios com baias, salas de reunião, copa e diretoria.',
      'Escola com salas de aula, laboratórios, biblioteca, refeitório, sala dos professores, diretoria, música, vestiários e o porão com caldeira e depósitos; restaurante com salão, bar, banheiros, despensa, cozinha industrial, câmara fria e os andares de cima; motel, cabana e galpão também ganharam vários cômodos.',
      'Cerca de 45 móveis e objetos novos numa folha própria (pia, vaso, banheira, chuveiro, geladeira, fogão industrial, araras, carteiras escolares, grades de cela, balcões, elevador, quadros e mais), na categoria "Apocalipse: Interiores" do editor.',
      'Para ver no seu Vortable: importe de novo o arquivo nova-york.mundo.json (mundos já criados continuam com os interiores antigos).',
    ],
  },
  {
    version: '1.48',
    date:    '2026-10-10',
    title:   'Passos do NPC que o mestre controla (Vortable)',
    items: [
      'Corrigido: o NPC que o mestre controla no Controle ao vivo (Controlar, setas ou WASD) andava sem som de passos. Ele é um boneco local da cena, e o som de passos só estava ligado ao boneco do próprio jogador. Agora anda com o som do chão onde pisa, no ritmo da caminhada e da corrida, igual a um jogador.',
      'Os passos dos jogadores que aparecem na câmera do mestre (entrada anterior) continuam valendo, com o volume pela distância. Se ainda ficar mudo, confira no painel Sons se "Ouvir" está ligado e o volume dos passos não está no zero.',
    ],
  },
  {
    version: '1.47',
    date:    '2026-10-10',
    title:   'Tirar NPCs do mapa (Vortable)',
    items: [
      'Controle ao vivo do Vortable: clique num NPC no mapa (qualquer um, inclusive os gerados e os inimigos) e abre um menu com o nome dele, "Controlar" (ou "Soltar") e "Tirar do mapa". Arrastar a câmera não conta como clique, e Esc fecha o menu.',
      'No painel "NPCs desta zona", cada NPC ganhou um botão ✕ para tirar do mapa (com confirmação).',
      'Tirar some na hora para você e para os jogadores da zona, sem recarregar nada, e a zona é gravada sem ele (quem entrar depois também não vê). Se o NPC estiver sendo controlado por você, ele é solto antes.',
      'Por baixo: mais uma remenda no motor, para a lista de NPCs devolver também a posição de cada um (node scripts/patch-vortable-camera.mjs depois de sincronizar o motor de novo).',
    ],
  },
  {
    version: '1.46',
    date:    '2026-10-10',
    title:   'Passos no controle ao vivo do mestre (Vortable)',
    items: [
      'Corrigido: na aba de Controle do mestre ninguém fazia barulho de passos. O motor só tocava o passo do próprio boneco, e a câmera do mestre não tem boneco. Agora os passos dos jogadores e dos NPCs que o mestre controla tocam na câmera, no som do chão onde pisam (grama, pedra, madeira, areia, neve...), com o ritmo da caminhada e da corrida.',
      'O volume acompanha a distância: quem anda perto do centro da câmera faz passos mais altos, quem está longe fica mais baixo, e quem está fora da tela não faz som. Vale o botão "Ouvir" e o volume de passos do painel Sons.',
      'Por baixo: mais uma remenda no motor (node scripts/patch-vortable-camera.mjs, a mesma da câmera). Depois de sincronizar o motor de novo, rode o script de novo.',
    ],
  },
  {
    version: '1.45',
    date:    '2026-10-10',
    title:   'Vortable: inimigos e NPCs em tempo real, e fim do preso nas fachadas',
    items: [
      'Colocar um inimigo ou um NPC gerado (arrastando ou pelo botão) não recarrega mais a zona: ele aparece na hora para você e para os jogadores, sem piscar e sem a câmera voltar. Tirar também some na hora. Tudo continua sendo gravado na zona, então quem entrar depois também vê.',
      'Corrigido: ao sair de um prédio para a rua, o jogador chegava dentro de uma caixa de parede invisível e não conseguia sair. O motor trata a borda de todo cômodo como parede sólida, e as fachadas eram cômodos inteiros, com o alpendre dentro. Agora só a faixa da parede é cômodo, e o alpendre é chão aberto para a rua. Vale para Nova York (ruas, estrada, mata, escola, rio) e para a Cidade em Ruínas.',
      'Corrigido: as passagens laterais entre salas dos interiores (fundos de farmácia, bodega, lanchonete, loja de roupas, posto, restaurante) também ficavam bloqueadas pela mesma regra. Agora dá para passar.',
      'Quem já criou o mundo Nova York ou Cidade em Ruínas na campanha precisa criar de novo (ou importar o arquivo novo) para receber a correção: o que já foi criado continua como estava.',
    ],
  },
  {
    version: '1.44',
    date:    '2026-10-10',
    title:   'Gerador de NPCs no controle do mestre (Vortable)',
    items: [
      'Controle ao vivo do Vortable: novo botão de pessoa com um mais na barra do mestre (depois de NPCs), "Gerador de NPCs".',
      'Sorteia 6 pessoas por vez, prontas para o cenário de The Last of Us: Sobrevivente, Soldado da FEDRA, Oficial da FEDRA, Vagalume, Saqueador, Caçador, Médico e Contrabandista (ou "Qualquer", que mistura). Cada uma vem com nome, função, roupa, cabelo, barba, chapéu, mochila e armas, e "Sortear de novo" troca todas.',
      'Roupas que fazem sentido: farda camuflada com colete tático e capacete ou máscara de gás para os soldados, boina para oficiais, xadrez com boné ou bandana para Vagalumes, bandana e roupa suja para saqueadores, chapéu de aba e barba para caçadores, jaleco branco com máscara e óculos para médicos.',
      'Armas: cada pessoa sai armada conforme o tipo (rifle, escopeta, pistola, revólver, arco, taco, cano de ferro, machadinha, facão, faca, coquetel molotov, granada), na mão, nas costas e na cintura, ou desarmada. O botão "Armamento" escolhe entre conforme o tipo, sempre armado e desarmado.',
      'Para colocar: arraste a pessoa para o mapa e solte onde quiser, ou clique em Colocar (ou "Colocar todos", que usa "Onde" e o espalhamento). Dá para mostrar o nome sobre a cabeça. A aba "Na zona" lista as pessoas geradas, com Controlar e Tirar.',
      'Personagem: cinco chapéus novos no criador (aba Acessórios): boné, gorro de lã, capacete militar, boina e chapéu de aba larga, em várias cores (inclusive camuflado).',
    ],
  },
  {
    version: '1.43',
    date:    '2026-10-10',
    title:   'Arrastar inimigos do painel para o mapa (Vortable)',
    items: [
      'Painel Inimigos do Controle ao vivo: agora é só arrastar o inimigo (Corredor, Espreitador, Estalador, Trôpego ou Baiacu) e soltar no mapa. Ele aparece exatamente onde o mouse soltou, qualquer que seja o zoom ou o lugar da câmera, e uma moldura tracejada mostra onde dá para soltar.',
      'Se "Quantos" estiver em mais de um, o primeiro cai no ponto solto e os outros em volta, conforme o espalhamento escolhido. O botão Colocar continua funcionando, e depois de colocado dá para clicar em Controlar e andar com ele.',
      'Por baixo: o motor ganhou uma remenda pequena (watch.worldAt, que converte um ponto da tela em um ponto do mapa). Se o motor for sincronizado de novo, rode node scripts/patch-vortable-camera.mjs para recolocar a remenda; sem ela o arrastar avisa e o botão Colocar continua.',
    ],
  },
  {
    version: '1.42',
    date:    '2026-10-10',
    title:   'Vortable: o controle do mestre mostra o mundo certo',
    items: [
      'Corrigido: o mundo que o mestre cria, importa ou edita no Editor podia não ser o mundo "aberto pros jogadores", e o Controle ao vivo (que mostra o mundo aberto) aparecia com outro mapa, parecido com um de teste.',
      'Ao sair do Editor para o Controle com um mundo diferente do aberto, o Vortable pergunta se quer abrir o mundo editado pros jogadores agora. Se escolher não, o Controle avisa embaixo qual mundo está sendo mostrado e deixa um botão para abrir o mundo editado a qualquer momento.',
    ],
  },
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
      'Documentos: ao clicar em Liberar, a folha ou o livro vai pra Biblioteca da campanha (na estante dela, junto com os arquivos), e os jogadores leem lá, com o livro folheável. Escondido, não aparece na Biblioteca. O mestre ainda edita e põe na mesa pela aba Mesa.',
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
