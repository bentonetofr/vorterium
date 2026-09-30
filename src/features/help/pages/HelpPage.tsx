import { Link } from 'react-router-dom'
import '../../../shared/theme/toolPage.css'
import './HelpPage.css'

// ────────────────────────────────────────────────────────
// Ajuda — guia curto de cada parte do site, em tópicos que abrem e
// fecham. Texto fixo: quando uma função muda, o texto daqui muda junto.
// ────────────────────────────────────────────────────────

interface Topic {
  id:    string
  icon:  string
  title: string
  steps: string[]
}

const TOPICS: Topic[] = [
  {
    id: 'campanhas', icon: '◈', title: 'Campanhas e convites',
    steps: [
      'Em Campanhas, clique em "Nova campanha", dê um nome e escolha o sistema: Genérico, Altherium ou Terra Devastada. Quem cria é o mestre.',
      'Pra chamar os jogadores, abra a campanha → Membros → "Gerar link de convite" e mande o link. Quem abrir o link logado entra como jogador.',
      'Na Visão geral fica o resumo: próxima sessão, combate em andamento, fichas e mensagens novas.',
      'Em Configurações o mestre troca nome, descrição, capa (até 10 MB) e o status da campanha.',
    ],
  },
  {
    id: 'sessao', icon: '✦', title: 'A aba Sessão',
    steps: [
      'É onde o jogo acontece. Sub-abas: Mesa, Ficha (Fichas, pro mestre), Atividade e Iniciativa. O chat fica no botão branco de mensagem, ao lado do dado, em qualquer tela da campanha.',
      'Em Altherium, o mestre também tem Bestiário, e todos têm o Livro de regras.',
      'Os episódios marcados ficam na aba Episódios da campanha. Notas guarda anotações do grupo: todos os membros veem e escrevem.',
    ],
  },
  {
    id: 'quadro', icon: '⌗', title: 'O Quadro da campanha',
    steps: [
      'Um quadro infinito (como o Miro) pra mesa montar junto: post-its, textos, formas, setas ligando as coisas, desenho à mão, molduras pra separar áreas e linhas do tempo. Todo mundo edita e vê o cursor dos outros em tempo real.',
      'Arraste o quadro com Espaço + arrastar (ou a ferramenta Mão), e dê zoom com a roda do mouse. Duplo clique no vazio cria um post-it; duplo clique num item edita o texto.',
      'Fotos arrastadas do computador (ou coladas com Ctrl+V) vão direto pra Galeria da campanha; PDFs e textos vão pra Biblioteca. O botão de Biblioteca coloca no quadro o que já está na estante.',
      'O mestre pode trancar um item (um mapa de fundo, por exemplo): aí só ele move, edita ou apaga. O botão "?" no canto do quadro mostra todos os atalhos.',
    ],
  },
  {
    id: 'mesa', icon: '▣', title: 'Mesa ao vivo (transmissão)',
    steps: [
      'Mestre: na sub-aba Mesa, clique em "Transmitir tela" e escolha uma janela, aba ou a tela inteira. Pra ter som, marque "Compartilhar áudio" na escolha (funciona melhor escolhendo uma aba do navegador).',
      'Clique na imagem pra apontar um lugar: todos veem o ponteiro.',
      '"Pausar" congela a imagem pros jogadores enquanto você arruma algo; "Trocar tela" muda o que está sendo mostrado sem parar a transmissão.',
      'Em "Imagens da mesa" o mestre envia mapas e retratos e clica em "Mostrar" pra pôr na mesa de todo mundo.',
      'Jogador: quando a Mesa entra ao vivo, aparece um aviso em qualquer página do site com o botão "Assistir". Se o navegador bloquear o som, clique em "Ativar som".',
    ],
  },
  {
    id: 'fichas', icon: '◎', title: 'Fichas',
    steps: [
      'Cada jogador tem uma ficha por campanha, na sub-aba Ficha. Tudo salva sozinho: espere o "✓ Tudo salvo" no fim da ficha.',
      'Altherium: escolha raiz e gênesis, distribua atributos e domínios, monte o inventário e use os triunfos na aba Triunfos. As barras de PV, PE e do recurso da raiz dá pra arrastar.',
      'Terra Devastada: anote características, condições e inventário; "Fazer um teste" monta a parada de dados sozinho e "Cena de horror" calcula o Horror.',
      'O mestre vê as fichas de todos em Fichas e pode editar qualquer uma. Minhas fichas, no menu, junta seus personagens de todas as campanhas.',
    ],
  },
  {
    id: 'dados', icon: '⚄', title: 'Dados',
    steps: [
      'O botão de dado no canto da tela abre a rolagem, dentro de qualquer campanha.',
      'Fórmulas: "2d6+3" soma; "2#d20" rola dois e fica com o maior; "2@d20" fica com o menor.',
      'Marque "Rolagem privada" pra só você e o mestre verem o resultado.',
      'Em Terra Devastada há botões de 1d a 6d que contam os pares (todo 6 rola de novo).',
    ],
  },
  {
    id: 'iniciativa', icon: '⚔', title: 'Iniciativa e combate',
    steps: [
      'Mestre: na sub-aba Iniciativa, "Iniciar combate" coloca todos os membros na lista.',
      'Cada um rola a própria iniciativa (ou clica no valor pra digitar). A lista se ordena sozinha.',
      '"Avançar turno" passa a vez e conta as rodadas. "Adicionar NPC" põe um inimigo pelo nome.',
      'Em Altherium, o mestre põe criaturas do Bestiário direto no combate, com quantidade ("Lobo 1", "Lobo 2"…).',
    ],
  },
  {
    id: 'ferramentas', icon: '❧', title: 'Ferramentas do menu',
    steps: [
      'Biblioteca: uma estante com os livros de regras e uma por campanha, com os documentos que o mestre guardou (PDF, imagem ou texto) e os arquivos postos no Quadro. Clique num arquivo pra ler no próprio site. O mestre adiciona arrastando arquivos pra estante e pode esconder um arquivo dos jogadores.',
      'Meu bestiário: criaturas suas pra qualquer campanha. No bestiário de uma campanha, "Guardar" manda a criatura pra cá; daqui, "Copiar pra campanha" leva de volta.',
      'Galeria: um álbum de lembranças por campanha em que você é mestre, com as imagens que já passaram pela Mesa. Clique numa foto pra ver grande ou levar pra outra campanha.',
      'O sino mostra as notificações (rolagens, episódios, membros); as mensagens do chat avisam só no botão de mensagem. Atividade junta o que aconteceu nas suas campanhas.',
    ],
  },
]

export function HelpPage() {
  return (
    <div className="tool-page help-page">
      <div className="tool-page__header">
        <div className="tool-page__titles">
          <h1 className="tool-page__title">Ajuda</h1>
          <p className="tool-page__sub">Um guia rápido de cada parte do Vorterium.</p>
        </div>
      </div>

      <div className="help-topics">
        {TOPICS.map((t, i) => (
          <details key={t.id} className="help-topic" open={i === 0}>
            <summary className="help-topic__summary">
              <span className="help-topic__icon" aria-hidden="true">{t.icon}</span>
              <span className="help-topic__title">{t.title}</span>
              <span className="help-topic__chevron" aria-hidden="true">▾</span>
            </summary>
            <ol className="help-topic__steps">
              {t.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </details>
        ))}
      </div>

      <div className="tool-card help-page__more">
        <p className="tool-hint">
          Não achou o que procurava ou algo não funcionou? <Link to="/feedback">Envie um feedback</Link> — ele chega direto
          pra quem cuida do site. E veja em <Link to="/novidades">Novidades</Link> o que mudou recentemente.
        </p>
      </div>
    </div>
  )
}
