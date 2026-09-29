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
    version: '1.8',
    date:    '2026-09-29',
    title:   'Triunfos em ordem e painel interno de suporte',
    items: [
      'Altherium: triunfos do Pilar agora aparecem por número de combinações, de 1 a 4 (e em ordem alfabética dentro de cada uma); os do Berserker e do Runaskin (trilha e runas descobertas) ficam em ordem alfabética.',
      'Quem desenvolve o Vorterium ganhou um painel interno pra investigar problemas relatados e acompanhar o feedback enviado. O acesso é só de leitura; os detalhes estão na página de Privacidade.',
    ],
  },
  {
    version: '1.7',
    date:    '2026-09-28',
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
    date:    '2026-09-28',
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
    date:    '2026-09-28',
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
    date:    '2026-09-25',
    title:   'Terra Devastada',
    items: [
      'Novo sistema: Terra Devastada, com ficha de características, condições, trunfos e inventário.',
      'Testes de pares em d6 (todo 6 rola de novo), Horror, Convicção e cena de horror calculada.',
      'Atividade detalhada pro mestre: cada mudança nas fichas Altherium com antes e depois.',
    ],
  },
  {
    version: '1.3',
    date:    '2026-09-25',
    title:   'Pilar e Runaskin',
    items: [
      'Pilar: triunfos pedem combinações de naipe, com baralho virtual (uma carta por vez) ou cartas físicas.',
      'Runaskin: triunfos iniciais da trilha editáveis na ficha.',
    ],
  },
  {
    version: '1.2',
    date:    '2026-09-24',
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
    date:    '2026-09-24',
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
