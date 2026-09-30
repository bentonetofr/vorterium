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
