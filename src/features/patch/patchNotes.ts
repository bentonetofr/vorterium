// ────────────────────────────────────────────────────────
// O aviso do patch 2.0 (a janelinha que abre uma vez, no centro da tela, na
// primeira vez que cada pessoa entra depois do patch): texto em etapas com o
// que o D&D 5e traz. Para um patch novo, troque PATCH_VERSION e as etapas.
// ────────────────────────────────────────────────────────

export const PATCH_VERSION = '2.0'
export const PATCH_DATE = '23/10/2026'

/** Como o mascote aparece na etapa (cada um é uma animaçãozinha). */
export type MascotPose = 'celebrate' | 'roll' | 'read' | 'wave' | 'peek'

export interface PatchStep {
  id:      string
  emoji:   string
  title:   string
  /** Frase curta embaixo do título. */
  intro?:  string
  lines:   string[]
  mascot?: { pose: MascotPose; says: string }
}

export const PATCH_STEPS: PatchStep[] = [
  {
    id: 'chegou',
    emoji: '⚔',
    title: 'TEMOS D&D NO SITE!',
    intro: 'Patch 2.0 — o maior de todos.',
    lines: [
      'O D&D 5e chegou de vez e está liberado pra todo mundo, sem lista de espera.',
      'Regras de 2014 e o conteúdo do SRD 5.1 em português: ficha completa, criador de personagem, livro de magias, livro de itens, dados 3D e rolagens ao vivo na mesa.',
      'Bora ver tudo o que a ficha faz?',
    ],
    mascot: { pose: 'celebrate', says: 'Chegou! Chegou!' },
  },
  {
    id: 'comecar',
    emoji: '🏰',
    title: 'Comece uma campanha',
    lines: [
      'Na hora de criar a campanha, escolha D&D 5e. Cada jogador cria o seu personagem na aba Ficha.',
      'O mestre também pode criar fichas de NPC para a mesa.',
      'Tem campanha com ficha antiga? Importe o PDF da sua ficha e a gente preenche tudo (veja mais adiante).',
    ],
  },
  {
    id: 'ficha',
    emoji: '📜',
    title: 'Uma ficha que se calcula sozinha',
    intro: 'As regras ficam por conta do site.',
    lines: [
      'Seis atributos, modificadores, salvaguardas, 18 perícias, bônus de proficiência, iniciativa, CA, deslocamento (em metros ou pés), visão no escuro, percepção passiva e carga.',
      'PV com dados de vida, PV temporários, salvaguardas contra a morte, condições e exaustão.',
      'Não gostou de um número? O botão Automatizar deixa qualquer valor manual: digite o seu, até negativo.',
    ],
    mascot: { pose: 'read', says: 'Eu só conferi a conta.' },
  },
  {
    id: 'personagem',
    emoji: '🧙',
    title: 'Raça, classe, antecedente',
    lines: [
      '9 raças com sub-raças, 12 classes com 40 subclasses, 14 antecedentes e multiclasse até o nível 20.',
      'O antecedente já dá as perícias dele sozinho, e as características de raça, classe e subclasse chegam pelo nível.',
      'Quer algo fora do livro? Digite a sua raça, classe, subclasse e antecedente à mão.',
    ],
  },
  {
    id: 'magias',
    emoji: '✨',
    title: 'Magias de verdade',
    lines: [
      'Livro com as 319 magias do SRD, com busca e filtros por nível, classe e escola.',
      'Espaços de magia que você gasta e recupera no descanso, Magia de Pacto do Bruxo (poucos espaços, no nível máximo, voltam no descanso curto), CD e ataque de magia.',
      'Escreva magias próprias com escola, tempo, alcance, duração e descrição, no mesmo cartão das do livro.',
    ],
  },
  {
    id: 'combate',
    emoji: '🗡',
    title: 'Combate e inventário',
    lines: [
      'Ataques com bônus e dano saindo da arma, descrição da arma que dá para esconder e botão de Crítico.',
      'Livro com 111 itens (armas, armaduras, equipamento e ferramentas). Armadura e escudo equipados mudam a CA sozinhos, e a carga em kg é calculada.',
      'Recursos que recarregam em descanso curto ou longo, características de classe e itens próprios com descrição.',
    ],
  },
  {
    id: 'dados',
    emoji: '🎲',
    title: 'Dados 3D rolando na mesa',
    intro: 'O melhor pedaço.',
    lines: [
      'Clique no d20 ao lado de qualquer perícia, salvaguarda, ataque ou dano: abre o painel de teste, no estilo Baldur’s Gate 3, com a CD, vantagem e desvantagem, Bênção, Orientação, Inspiração de Bardo e bônus de situação.',
      'Os dados são 3D de verdade, com física: rolam, batem e param planos. Escolha o seu conjunto: madeira velha, granito ou plástico marmorizado.',
      'A mesa inteira vê a sua rolagem acontecendo, e você vê a dos outros.',
    ],
    mascot: { pose: 'roll', says: 'Vai cair 20!' },
  },
  {
    id: 'livre',
    emoji: '🔮',
    title: 'Rolagem livre',
    lines: [
      'O botão de dados no canto abre o rolador: 1d20+5, 2#d20+5 (o maior de dois), 2@d20+5 (o menor) e até 100 dados de uma vez.',
      'Rolagem privada, rolagem rápida de um dado e a lista dos recentes da mesa, tudo no mesmo cartão.',
    ],
  },
  {
    id: 'mestre',
    emoji: '👑',
    title: 'Ferramentas do mestre',
    lines: [
      'Peça um teste para a mesa com a CD que quiser, e escolha se ela fica oculta ou se é revelada depois da rolagem.',
      'O pedido aparece na ficha de cada jogador, que rola direto, e o mestre acompanha os resultados.',
    ],
  },
  {
    id: 'importar',
    emoji: '📥',
    title: 'Importe a sua ficha em PDF',
    lines: [
      'Já tem a ficha preenchida no PDF JohnBard DnD 5e? Use o botão Importar PDF no alto da ficha.',
      'O site lê o PDF, pergunta o que não tiver certeza em cartões, confere os números com as regras, guarda uma cópia de segurança e deixa desfazer.',
    ],
    mascot: { pose: 'peek', says: 'Eu leio PDF!' },
  },
  {
    id: 'fim',
    emoji: '🎉',
    title: 'Bora jogar!',
    lines: [
      'Crie a sua campanha de D&D ou entre em uma e abra a sua ficha.',
      'Achou algo estranho ou quer uma ideia nova? Avise a gente. O patch 2.0 é só o começo.',
    ],
    mascot: { pose: 'wave', says: 'Boa sorte, aventureiro!' },
  },
]
