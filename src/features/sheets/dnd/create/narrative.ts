import { getArmor, getWeapon } from '../catalog'
import type { SpellEntry } from '../catalog'
import type { Answer, Question } from '../import/types'
import { spellPriority, type AskMeta, type CreateInput } from './plan'
import { ABILITY_ORDER, type KitOption } from './data'

// ────────────────────────────────────────────────────────
// Ficha por narrativa (D&D): a pessoa responde perguntas sobre a história, a personalidade e o jeito de jogar do personagem, e o
// site escolhe sozinho a melhor montagem: raça, antecedente, classe, subclasse, perícias, equipamento, magias e tendência.
// Cada resposta soma pontos em "afinidades" (luta de perto, magia arcana, furtividade…); cada raça, antecedente, classe e subclasse
// tem as suas, e a que mais pontua ganha. As mesmas respostas dão sempre a mesma ficha. O resultado entra no planejador da
// criação rápida como SUGESTÃO (`suggester`), então cada escolha pode ser conferida e trocada antes de criar.
// ────────────────────────────────────────────────────────

export type Tag =
  | 'melee' | 'ranged' | 'tank' | 'damage' | 'stealth' | 'social' | 'support' | 'healing' | 'control' | 'utility'
  | 'arcane' | 'divine' | 'nature' | 'wild' | 'lore' | 'discipline' | 'speed' | 'companion'

export const TAGS: Tag[] = ['melee', 'ranged', 'tank', 'damage', 'stealth', 'social', 'support', 'healing', 'control', 'utility', 'arcane', 'divine', 'nature', 'wild', 'lore', 'discipline', 'speed', 'companion']

export const TAG_LABEL: Record<Tag, string> = {
  melee: 'luta de perto', ranged: 'ataque à distância', tank: 'aguentar pancada', damage: 'causar dano', stealth: 'furtividade', social: 'conversa e presença',
  support: 'apoiar o grupo', healing: 'cura', control: 'controlar o campo', utility: 'soluções criativas', arcane: 'magia arcana', divine: 'fé e poder divino',
  nature: 'natureza', wild: 'poder bruto', lore: 'conhecimento', discipline: 'disciplina e técnica', speed: 'agilidade', companion: 'companhia de animais',
}

type W = Partial<Record<Tag, number>>

export interface NOption {
  value: string
  label: string
  hint?: string
  /** Afinidades que a resposta soma. */
  t?: W
  /** Pontos diretos para raças ("elf", "half_orc"…) e sub-raças. */
  race?: Record<string, number>
  /** Pontos diretos para antecedentes. */
  bg?: Record<string, number>
  /** Eixo da tendência: ordem ('lawful' | 'neutral' | 'chaotic') e bondade ('good' | 'neutral' | 'evil'). */
  order?: string
  moral?: string
  /** Texto que vai para a ficha (traço, ideal, vínculo, defeito). */
  text?: string
}

export interface NQuestion {
  id: string
  section: string
  title: string
  body?: string
  kind: 'choice' | 'multi' | 'number' | 'text'
  mult?: number
  optional?: boolean
  options?: NOption[]
  placeholder?: string
  examples?: string[]
  when?: (a: NAnswers) => boolean
}

/** Respostas: o valor escolhido (ou os valores, na lista); "_" é "não sei". */
export type NAnswers = Record<string, string | string[] | number>

export const UNSURE = '_'
const few = (a: NAnswers) => a.ideias !== 'muitas'
const some = (a: NAnswers) => a.ideias !== 'nenhuma'

const NAMES = ['Aldric', 'Brienne', 'Corvin', 'Dara', 'Elowen', 'Fenwick', 'Gwen', 'Hakon', 'Ilsa', 'Jarek', 'Kira', 'Lorcan', 'Mira', 'Nyx', 'Orsin', 'Petra', 'Quill', 'Rhea', 'Soren', 'Tamsin']

/** Cria uma opção; `t` são as afinidades. */
const o = (value: string, label: string, t: W = {}, extra: Partial<NOption> = {}): NOption => ({ value, label, t, ...extra })

export const NQUESTIONS: NQuestion[] = [
  // ── Conceito ──
  { id: 'nome', section: 'Conceito', kind: 'text', title: 'Qual é o nome do personagem?', body: 'Dá para mudar depois. Sem ideia? Clique em uma sugestão.', placeholder: 'Nome', examples: NAMES },
  { id: 'nivel', section: 'Conceito', kind: 'number', title: 'Em que nível o personagem começa?', body: 'A maioria das mesas começa no nível 1.' },
  {
    id: 'ideias', section: 'Conceito', kind: 'choice', title: 'Quanta ideia você já tem sobre esse personagem?',
    body: 'Sem problema nenhum se for pouca: eu faço perguntas simples, com cenas de aventura, e monto o resto para você.',
    options: [
      o('nenhuma', 'Quase nenhuma: me guie', {}, { hint: 'Perguntas com situações fáceis. Eu sugiro tudo, até a história.' }),
      o('algumas', 'Algumas ideias soltas', {}, { hint: 'Um pouco de cada: cenas e perguntas sobre o personagem.' }),
      o('muitas', 'Já imagino bastante coisa', {}, { hint: 'Perguntas mais detalhadas sobre a história e a personalidade.' }),
    ],
  },
  { id: 'frase', section: 'Conceito', kind: 'text', optional: true, when: some, title: 'Em uma frase, quem é essa pessoa?', body: 'Opcional. Vai para a aba História. Sem ideia? Pule ou clique em uma sugestão.', placeholder: 'Ex.: uma soldada que desertou e agora só quer paz', examples: ['Alguém em busca de um lugar para chamar de lar', 'Um herói improvável que só queria uma vida simples', 'Alguém com um passado que prefere esquecer', 'Um aventureiro atrás de fama e fortuna'] },
  {
    id: 'arquetipo', section: 'Conceito', kind: 'choice', mult: 2, title: 'Qual arquétipo mais parece com a ideia que você tem?', body: 'Escolha o que chega mais perto. As próximas perguntas refinam.',
    options: [
      o('protetor', 'O protetor', { tank: 3, support: 1, melee: 1 }, { hint: 'Fica na frente para que os outros não se machuquem.' }),
      o('erudito', 'O erudito', { lore: 3, arcane: 2, control: 1 }, { hint: 'Sabe de tudo e resolve com a cabeça.' }),
      o('cacador', 'O caçador', { ranged: 3, nature: 2, stealth: 1 }, { hint: 'Rastreia, observa e acerta de longe.' }),
      o('trapaceiro', 'O trapaceiro', { stealth: 3, utility: 2, speed: 1, social: 1 }, { hint: 'Esperto, rápido, sempre com uma carta na manga.' }),
      o('lider', 'O líder carismático', { social: 3, support: 2, discipline: 1 }, { hint: 'As pessoas seguem a voz dele.' }),
      o('guerreiro', 'O guerreiro implacável', { melee: 3, discipline: 2, tank: 1, damage: 1 }, { hint: 'Treinado para a batalha, só avança.' }),
      o('curandeiro', 'O curandeiro', { healing: 3, support: 2, divine: 1, nature: 1 }, { hint: 'Cuida, restaura e protege.' }),
      o('foradalei', 'O fora da lei', { stealth: 2, utility: 2, melee: 1, social: 1 }, { hint: 'Vive nas margens e não pede licença.' }),
      o('sagrado', 'O campeão da fé', { divine: 3, melee: 2, support: 1, tank: 1 }, { hint: 'Uma missão maior que a vida dele.' }),
      o('selvagem', 'O filho da natureza', { nature: 3, wild: 2, companion: 1 }, { hint: 'Mais à vontade com bichos e árvores do que com gente.' }),
      o('artista', 'O artista', { social: 3, support: 2, arcane: 1 }, { hint: 'Canta, conta, encanta; vive de plateia.' }),
      o('poder', 'O poder indomado', { wild: 3, arcane: 2, damage: 2 }, { hint: 'Uma força que ele mal controla.' }),
      o('mistico', 'O místico de pacto', { arcane: 3, control: 2, social: 1 }, { hint: 'Um poder que veio de um acordo misterioso.' }),
      o('monge', 'O asceta disciplinado', { discipline: 3, melee: 2, speed: 2 }, { hint: 'Corpo e mente treinados até o limite.' }),
    ],
  },
  {
    id: 'quero', section: 'Conceito', kind: 'multi', title: 'O que você mais quer fazer na mesa?', body: 'Marque o que quiser.',
    options: [
      o('salvar', 'Ser o herói que protege todo mundo', { tank: 2, support: 2 }),
      o('cena', 'Brilhar nas cenas de conversa', { social: 3 }),
      o('misterio', 'Resolver mistérios e descobrir segredos', { lore: 3, utility: 1 }),
      o('explodir', 'Causar estrago enorme', { damage: 2, wild: 1, arcane: 1 }),
      o('rapido', 'Ser o mais rápido, escalar, acrobacias', { speed: 3, stealth: 1 }),
      o('bicho', 'Ter um animal ao meu lado', { companion: 3, nature: 1 }),
      o('curar', 'Curar e cuidar dos amigos', { healing: 3, support: 1 }),
      o('pecas', 'Pregar peças e enganar', { stealth: 1, utility: 2, social: 1 }),
      o('estrategia', 'Planejar e controlar a batalha', { control: 3, discipline: 1 }),
      o('fe', 'Viver uma missão de fé', { divine: 3 }),
    ],
  },

  // ── Cenas (para quem tem pouca ideia) ──
  {
    id: 'cena_dragao', section: 'Cenas', kind: 'choice', mult: 1.3, when: few, title: 'Cena: o grupo encontra um dragão dormindo sobre um monte de tesouro. O que você faria?', body: 'Não existe resposta certa: escolha o que seria mais divertido para você.',
    options: [
      o('esgueirar', 'Me esgueiro e pego o que puder sem acordá-lo', { stealth: 3, utility: 2 }),
      o('plano', 'Monto um plano para o grupo atacar junto', { discipline: 2, control: 2, support: 1 }),
      o('ataque', 'Parto para cima antes que ele acorde', { melee: 3, damage: 1 }),
      o('conversa', 'Tento conversar: até dragões têm vaidade', { social: 3, utility: 1 }),
      o('estudo', 'Estudo a criatura e procuro pontos fracos', { lore: 3, control: 1 }),
      o('longe', 'Fico longe, com a mira pronta', { ranged: 3 }),
      o('protege', 'Fico perto dos aliados, pronto para protegê-los se der errado', { tank: 2, support: 2, divine: 1 }),
    ],
  },
  {
    id: 'cena_festa', section: 'Cenas', kind: 'choice', mult: 1.3, when: few, title: 'Cena: numa festa de nobres, você descobre que há um espião entre os convidados.',
    options: [
      o('papo', 'Puxo conversa até ele se entregar', { social: 3 }),
      o('segue', 'Observo de longe e sigo a pessoa', { stealth: 2, lore: 1 }),
      o('confusao', 'Invento uma confusão para distrair todo mundo', { utility: 3, social: 1 }),
      o('comanda', 'Aviso os guardas e assumo o controle da situação', { discipline: 2, social: 1, melee: 1 }),
      o('magia', 'Uso um feitiço discreto para descobrir quem é', { arcane: 3, control: 1 }),
      o('encara', 'Encaro a pessoa de frente e peço explicações', { melee: 1, tank: 1, social: 1 }),
    ],
  },
  {
    id: 'cena_ponte', section: 'Cenas', kind: 'choice', mult: 1.3, when: few, title: 'Cena: uma ponte está desabando e um aliado está do outro lado.',
    options: [
      o('corre', 'Corro para alcançá-lo', { speed: 3 }),
      o('segura', 'Seguro a ponte enquanto ele passa', { tank: 3, melee: 1 }),
      o('corda', 'Atiro uma corda com uma flecha', { ranged: 2, nature: 1, utility: 1 }),
      o('magia', 'Uso magia para atravessar ou segurá-la', { arcane: 3 }),
      o('fe', 'Peço ajuda a algo maior e confio', { divine: 2, support: 2 }),
      o('improviso', 'Aposto na sorte e improviso', { utility: 2, speed: 1 }),
    ],
  },
  {
    id: 'cena_animal', section: 'Cenas', kind: 'choice', mult: 1.3, when: few, title: 'Cena: no meio da floresta, você encontra um animal ferido.',
    options: [
      o('cuida', 'Cuido das feridas dele', { healing: 3, nature: 1 }),
      o('amigo', 'Tento acalmá-lo e fazer amizade', { companion: 3, nature: 1 }),
      o('cuidado', 'Primeiro olho em volta: o que o feriu pode estar por perto', { stealth: 1, ranged: 1, lore: 1 }),
      o('magia', 'Uso magia para entender o que ele sente', { arcane: 1, nature: 2, divine: 1 }),
      o('segue', 'Sigo meu caminho: não é problema meu', { utility: 1, melee: 1 }),
    ],
  },
  {
    id: 'cena_taverna', section: 'Cenas', kind: 'choice', mult: 1.3, when: few, title: 'Cena: uma briga de taverna está prestes a começar.',
    options: [
      o('separa', 'Entro no meio para separar todo mundo', { tank: 2, support: 1, melee: 1 }),
      o('soco', 'Dou o primeiro soco', { melee: 3, damage: 1 }),
      o('piada', 'Conto uma piada para esfriar os ânimos', { social: 3 }),
      o('sai', 'Saio de fininho e aproveito a confusão', { utility: 2, stealth: 1 }),
      o('olha', 'Fico de lado e vejo quem é quem', { lore: 1, stealth: 1, control: 1 }),
      o('anima', 'Subo no balcão e animo a multidão', { social: 2, support: 1, arcane: 1 }),
    ],
  },
  {
    id: 'cena_livro', section: 'Cenas', kind: 'choice', mult: 1.3, when: few, title: 'Cena: numa biblioteca antiga, há um livro trancado por magia.',
    options: [
      o('estuda', 'Estudo os símbolos até entender', { lore: 3, arcane: 1 }),
      o('arromba', 'Arrombo a tranca com jeitinho', { stealth: 2, utility: 2 }),
      o('forca', 'Quebro a tranca na força', { melee: 2, wild: 1 }),
      o('magia', 'Respondo à magia com a minha', { arcane: 3 }),
      o('pessoas', 'Procuro quem guarda a chave', { social: 2 }),
    ],
  },

  // ── Estilo de jogo ──
  {
    id: 'posicao', section: 'Estilo de jogo', kind: 'choice', title: 'Em um combate, onde ele prefere ficar?',
    options: [
      o('frente', 'Na linha de frente', { melee: 3, tank: 2 }),
      o('meio', 'No meio do grupo, ajudando quem precisa', { support: 3, healing: 1 }),
      o('longe', 'Longe, mirando de uma posição segura', { ranged: 3 }),
      o('sombra', 'Nas sombras, esperando a hora de agir', { stealth: 3, utility: 1 }),
      o('ar', 'Se movendo sem parar', { speed: 3, melee: 1 }),
      o('varia', 'Depende da situação: se adapta', { control: 3, utility: 1 }),
    ],
  },
  {
    id: 'ameaca', section: 'Estilo de jogo', kind: 'choice', title: 'Diante de uma ameaça, o que ele faz primeiro?',
    options: [
      o('enfrenta', 'Enfrenta de peito aberto', { melee: 2, tank: 1, discipline: 1 }),
      o('planeja', 'Observa, planeja e usa o ambiente', { control: 2, lore: 1, discipline: 1 }),
      o('protege', 'Coloca-se entre a ameaça e os outros', { tank: 3, support: 1 }),
      o('surpresa', 'Some e ataca de surpresa', { stealth: 3, damage: 1 }),
      o('conversa', 'Tenta resolver na conversa', { social: 3 }),
      o('poder', 'Libera todo o poder que tem', { wild: 2, arcane: 2, damage: 1 }),
      o('reza', 'Invoca algo maior que ele', { divine: 3 }),
    ],
  },
  {
    id: 'resistencia', section: 'Estilo de jogo', kind: 'choice', title: 'Como ele lida com o dano?',
    options: [
      o('aguenta', 'Aguenta pancada: nada o derruba fácil', { tank: 3, melee: 1 }),
      o('equilibra', 'Equilibrado: leva alguns golpes, desvia de outros', {}),
      o('desvia', 'Desvia de tudo: é rápido demais para ser acertado', { speed: 2, stealth: 1 }),
      o('fragil', 'Frágil: depende dos outros para protegê-lo', { arcane: 1, lore: 1 }),
    ],
  },
  {
    id: 'papel', section: 'Estilo de jogo', kind: 'choice', mult: 1.5, title: 'Qual é o papel dele no grupo?',
    options: [
      o('dano', 'Causar dano', { damage: 3, melee: 1, ranged: 1 }, { hint: 'Derruba os inimigos mais rápido que todo mundo.' }),
      o('prote', 'Proteger', { tank: 3 }, { hint: 'Absorve os golpes e guarda os aliados.' }),
      o('cura', 'Curar e apoiar', { healing: 3, support: 2 }, { hint: 'Mantém todo mundo de pé.' }),
      o('lider', 'Liderar e inspirar', { social: 2, support: 2, discipline: 1 }, { hint: 'Coordena e levanta o moral.' }),
      o('batedor', 'Explorar e fazer de batedor', { stealth: 2, nature: 1, speed: 1 }, { hint: 'Vai na frente, descobre o caminho.' }),
      o('cara', 'Negociar e convencer', { social: 3, utility: 1 }, { hint: 'Abre portas que a espada não abre.' }),
      o('mente', 'Ser a mente do grupo', { lore: 3, control: 1 }, { hint: 'Conhece, analisa e resolve.' }),
    ],
  },
  {
    id: 'magia', section: 'Estilo de jogo', kind: 'choice', title: 'E a magia, onde entra?',
    options: [
      o('nenhuma', 'Não tem magia nenhuma', { arcane: -6, divine: -4, wild: -1 }, { hint: 'Tudo é treino, aço e coragem.' }),
      o('pouca', 'Um pouco, como apoio', { arcane: 1, divine: 1 }, { hint: 'Uma benção, um truque, algo discreto.' }),
      o('central', 'É central: ele é um conjurador', { arcane: 3, divine: 3 }, { hint: 'Feitiços fazem parte de quase tudo que ele faz.' }),
    ],
  },
  {
    id: 'fonte', section: 'Estilo de jogo', kind: 'choice', mult: 1.5, title: 'De onde vem o poder dele?',
    options: [
      o('treino', 'Treino duro, anos de prática', { melee: 2, discipline: 2, tank: 1 }),
      o('estudo', 'Estudo e dedicação', { lore: 3, arcane: 3, control: 1 }),
      o('natureza', 'Uma ligação com a natureza', { nature: 3, wild: 1, healing: 1 }),
      o('fe', 'Fé, um chamado ou uma divindade', { divine: 3, support: 1 }),
      o('sangue', 'Sangue, nascença ou herança misteriosa', { wild: 3, arcane: 2 }),
      o('pacto', 'Um pacto com um ser poderoso', { arcane: 3, control: 1, social: 1 }),
      o('esperteza', 'Esperteza, sorte e jogo de cintura', { utility: 3, stealth: 1, social: 1 }),
      o('arte', 'Música, histórias e presença', { social: 3, support: 2, arcane: 1 }),
      o('vinganca', 'Uma promessa de justiça ou vingança', { melee: 2, divine: 2, damage: 1 }),
      o('corpo', 'Corpo e espírito levados ao extremo', { discipline: 3, speed: 2, melee: 1 }),
    ],
  },
  {
    id: 'arma', section: 'Estilo de jogo', kind: 'choice', mult: 1.2, title: 'Que arma você imagina na mão dele?',
    options: [
      o('espada', 'Espada e escudo', { melee: 2, tank: 2 }),
      o('pesada', 'Machado ou espada grande, de duas mãos', { melee: 3, damage: 2 }),
      o('arco', 'Arco ou besta', { ranged: 3 }),
      o('adagas', 'Adagas e lâminas leves', { stealth: 2, speed: 1, utility: 1 }),
      o('rapieira', 'Rapieira ou cimitarra', { speed: 2, social: 1, melee: 1 }),
      o('cajado', 'Cajado', { nature: 1, arcane: 1 }),
      o('simbolo', 'Maça e um símbolo sagrado', { divine: 2, melee: 1, support: 1 }),
      o('punhos', 'Nenhuma: os próprios punhos', { discipline: 2, speed: 2, melee: 1 }),
      o('nenhuma', 'Nenhuma em especial', {}),
    ],
  },
  {
    id: 'armadura', section: 'Estilo de jogo', kind: 'choice', title: 'O que ele veste para a batalha?',
    options: [
      o('pesada', 'Armadura pesada, de placas ou malha', { tank: 2 }),
      o('media', 'Armadura média', { tank: 1 }),
      o('leve', 'Couro ou roupas acolchoadas', { speed: 1 }),
      o('nada', 'Nada: roupas comuns', { arcane: 1, discipline: 1 }),
      o('auto', 'Tanto faz: escolham o melhor', {}),
    ],
  },
  {
    id: 'companheiro', section: 'Estilo de jogo', kind: 'choice', title: 'Ele tem um animal ou criatura ao lado dele?',
    options: [o('sim', 'Sim, um companheiro fiel', { companion: 5, nature: 1 }), o('talvez', 'Talvez um bicho que aparece de vez em quando', { companion: 1, nature: 1 }), o('nao', 'Não', { companion: -2 })],
  },
  {
    id: 'foracombate', section: 'Estilo de jogo', kind: 'multi', title: 'Fora de combate, como ele resolve problemas?', body: 'Marque o que quiser.',
    options: [
      o('conversa', 'Conversando', { social: 3 }), o('investiga', 'Investigando e estudando', { lore: 3 }), o('terreno', 'Lendo o terreno e os rastros', { nature: 3 }),
      o('infiltra', 'Se infiltrando e abrindo o que está fechado', { stealth: 2, utility: 2 }), o('forca', 'Na força', { melee: 2, tank: 1 }), o('magia', 'Com magia', { arcane: 3 }),
      o('fe', 'Pedindo ajuda ao divino', { divine: 3 }), o('animal', 'Com a ajuda de um animal', { companion: 3, nature: 1 }),
    ],
  },

  // ── Origem ──
  {
    id: 'aparencia', section: 'Origem', kind: 'choice', mult: 1.5, title: 'Qual traço físico mais marca a aparência dele?', body: 'Isso decide a raça.',
    options: [
      o('comum', 'Nada fora do comum: parece uma pessoa qualquer', {}, { race: { human: 7 } }),
      o('orelhas', 'Orelhas pontudas e olhos que parecem enxergar longe', {}, { race: { elf: 7, half_elf: 2 } }),
      o('mistura', 'Um pouco de gente, um pouco de elfo: não é de lugar nenhum', {}, { race: { half_elf: 7, elf: 1, human: 1 } }),
      o('baixinho', 'Baixinho, de pés grandes e cheio de sorte', {}, { race: { halfling: 7, gnome: 1 } }),
      o('barba', 'Baixo e largo, resistente como pedra', {}, { race: { dwarf: 7 } }),
      o('inventor', 'Pequeno, de olhar curioso e mãos que não param de consertar', {}, { race: { gnome: 7, halfling: 1 } }),
      o('escamas', 'Escamas, presas e um sopro que queima', {}, { race: { dragonborn: 7 } }),
      o('chifres', 'Chifres, cauda e olhar infernal', {}, { race: { tiefling: 7 } }),
      o('presas', 'Pele dura, presas e músculos de combate', {}, { race: { half_orc: 7 } }),
    ],
  },
  {
    id: 'oficio', section: 'Origem', kind: 'choice', mult: 1.5, title: 'O que ele fazia da vida antes da aventura?', body: 'Isso decide o antecedente.',
    options: [
      o('acolito', 'Servia num templo', { divine: 1, lore: 1 }, { bg: { acolyte: 7 } }),
      o('golpista', 'Aplicava golpes e vendia ilusões', { social: 1, utility: 1 }, { bg: { charlatan: 7 } }),
      o('criminoso', 'Era ladrão ou criminoso', { stealth: 1, utility: 1 }, { bg: { criminal: 7 } }),
      o('artista', 'Era artista de rua ou de palco', { social: 1 }, { bg: { entertainer: 7 } }),
      o('heroi', 'Era gente do povo que se destacou numa crise', { tank: 1, melee: 1 }, { bg: { folk_hero: 7 } }),
      o('artesao', 'Era artesão de uma guilda', { utility: 1 }, { bg: { guild_artisan: 7 } }),
      o('eremita', 'Vivia isolado, em busca de respostas', { lore: 1, nature: 1 }, { bg: { hermit: 7 } }),
      o('nobre', 'Nasceu entre títulos e salões', { social: 1 }, { bg: { noble: 7 } }),
      o('forasteiro', 'Cresceu longe das cidades, na natureza selvagem', { nature: 1, melee: 1 }, { bg: { outlander: 7 } }),
      o('sabio', 'Era estudioso ou escriba', { lore: 1, arcane: 1 }, { bg: { sage: 7 } }),
      o('marujo', 'Era marinheiro ou pirata', { speed: 1, social: 1 }, { bg: { sailor: 7 } }),
      o('soldado', 'Era soldado ou mercenário', { melee: 1, discipline: 1 }, { bg: { soldier: 7 } }),
      o('rua', 'Cresceu sozinho nas ruas', { stealth: 1, speed: 1 }, { bg: { urchin: 7 } }),
    ],
  },
  {
    id: 'mundo', section: 'Origem', kind: 'choice', title: 'Como o mundo enxerga esse personagem?',
    options: [
      o('heroi', 'Como um herói', { support: 1, tank: 1, social: 1 }, { text: 'Muita gente o vê como um herói, e ele carrega o peso dessa fama.' }),
      o('lenda', 'Como uma lenda viva (ou nem tanto)', { social: 2, discipline: 1 }, { text: 'Corre o boato de que ele é uma lenda; a verdade é mais simples.' }),
      o('criminoso', 'Como um criminoso procurado', { stealth: 1, utility: 2 }, { text: 'Há gente procurando por ele, com razão ou não.' }),
      o('estranho', 'Como um estranho que ninguém entende', { wild: 1, arcane: 1, nature: 1 }, { text: 'Ninguém o entende de verdade, e ele já se acostumou.' }),
      o('curandeiro', 'Como um curandeiro ou conselheiro', { healing: 2, support: 1 }, { text: 'As pessoas o procuram quando precisam de ajuda ou de um conselho.' }),
      o('ameaca', 'Como uma ameaça', { wild: 1, melee: 1, damage: 1 }, { text: 'Muitos o temem antes de conhecê-lo.' }),
      o('ninguem', 'Como ninguém: passa despercebido', { stealth: 2 }, { text: 'Passa despercebido, e isso o ajuda mais do que parece.' }),
    ],
  },
  {
    id: 'ordem', section: 'Origem', kind: 'choice', title: 'Qual é a relação dele com regras e autoridade?',
    options: [
      o('leal', 'Respeita a ordem e cumpre o que prometeu', { discipline: 1 }, { order: 'lawful' }),
      o('neutro', 'Segue as regras quando fazem sentido', {}, { order: 'neutral' }),
      o('caotico', 'Desconfia de quem manda e faz do jeito dele', { utility: 1 }, { order: 'chaotic' }),
    ],
  },
  {
    id: 'bondade', section: 'Origem', kind: 'choice', title: 'E com as outras pessoas?',
    options: [
      o('bom', 'Ajuda quem precisa, mesmo sem ganhar nada', { support: 1, healing: 1 }, { moral: 'good' }),
      o('neutro', 'Cuida de si e dos seus, e ajuda quando dá', {}, { moral: 'neutral' }),
      o('mau', 'O mundo é duro: cada um por si, e ele pega o que quer', { damage: 1 }, { moral: 'evil' }),
    ],
  },

  // ── Personalidade ──
  {
    id: 'motivacao', section: 'Personalidade', kind: 'choice', mult: 1.2, title: 'O que move esse personagem?',
    options: [
      o('vinganca', 'Vingança por algo que perdeu', { melee: 1, damage: 2 }, { text: 'Busca vingança por uma perda que nunca superou.' }),
      o('curiosidade', 'Curiosidade, vontade de descobrir', { lore: 2, arcane: 1 }, { text: 'A curiosidade o empurra para onde ninguém quer ir.' }),
      o('proteger', 'Proteger quem ama', { tank: 2, support: 1 }, { text: 'Faria qualquer coisa para proteger quem ama.' }),
      o('fama', 'Fama, ouro ou reconhecimento', { social: 2, utility: 1 }, { text: 'Quer ser lembrado e reconhecido pelo que faz.' }),
      o('fe', 'Fé ou dever', { divine: 3 }, { text: 'Age por fé ou por dever, mesmo quando custa caro.' }),
      o('liberdade', 'Liberdade acima de tudo', { speed: 1, utility: 1, nature: 1 }, { text: 'Prefere a estrada a qualquer lugar fixo; liberdade acima de tudo.' }),
      o('redencao', 'Redenção por erros do passado', { healing: 1, divine: 1, support: 1 }, { text: 'Quer consertar os erros do passado, um de cada vez.' }),
      o('poder', 'Dominar o próprio poder', { wild: 2, arcane: 1 }, { text: 'Precisa dominar o poder que carrega antes que ele o domine.' }),
      o('justica', 'Justiça, mesmo contra a lei', { melee: 1, social: 1, divine: 1 }, { text: 'Acredita em justiça, mesmo quando a lei diz o contrário.' }),
      o('lar', 'Encontrar um lugar para chamar de lar', { support: 1, healing: 1, nature: 1 }, { text: 'Procura um lugar para chamar de lar.' }),
    ],
  },
  {
    id: 'jeito', section: 'Personalidade', kind: 'choice', title: 'Como ele se comporta com estranhos?',
    options: [
      o('amigavel', 'Amigável e aberto', { social: 1, support: 1 }, { text: 'Fala com todo mundo e faz amigos com facilidade.' }),
      o('reservado', 'Reservado e observador', { stealth: 1, lore: 1 }, { text: 'Observa muito e fala pouco.' }),
      o('intimidador', 'Intimidador', { melee: 1, tank: 1 }, { text: 'Sua presença intimida, mesmo quando não quer.' }),
      o('calculista', 'Calculista, avaliando tudo', { control: 1, utility: 1 }, { text: 'Avalia cada pessoa e cada situação antes de agir.' }),
      o('brincalhao', 'Brincalhão, sempre com uma piada', { utility: 1, social: 1 }, { text: 'Usa o humor para esconder o que sente.' }),
    ],
  },
  {
    id: 'vinculo', section: 'Personalidade', kind: 'choice', title: 'Quem ou o que mais importa para ele?',
    options: [
      o('familia', 'A família', {}, { text: 'A família é tudo para ele, mesmo à distância.' }),
      o('mentor', 'Um mentor que lhe ensinou tudo', {}, { text: 'Deve tudo a um mentor e quer fazê-lo sentir orgulho.' }),
      o('lar', 'A terra onde cresceu', {}, { text: 'Faria de tudo para proteger o lugar onde cresceu.' }),
      o('divida', 'Uma dívida que precisa pagar', {}, { text: 'Tem uma dívida que ainda precisa pagar.' }),
      o('rival', 'Um rival que quer superar', {}, { text: 'Tem um rival que quer superar.' }),
      o('ordem', 'Uma ordem, um grupo ou uma causa', {}, { text: 'Pertence a uma causa maior que ele mesmo.' }),
    ],
  },
  {
    id: 'defeito', section: 'Personalidade', kind: 'choice', title: 'Qual é o maior defeito ou medo dele?',
    options: [
      o('orgulho', 'Orgulho', {}, { text: 'Orgulho: nunca admite que errou.' }), o('confianca', 'Confia demais nos outros', {}, { text: 'Confia depressa demais nas pessoas.' }),
      o('desconfianca', 'Não confia em ninguém', {}, { text: 'Não confia em ninguém, e isso o isola.' }), o('raiva', 'Raiva que explode', {}, { text: 'Tem um temperamento que explode sem aviso.' }),
      o('culpa', 'Culpa do passado', {}, { text: 'Carrega uma culpa do passado que não o deixa em paz.' }), o('escuro', 'Medo do desconhecido', {}, { text: 'Tem medo do que não entende.' }),
      o('solidao', 'Medo de ficar sozinho', {}, { text: 'Tem pavor de ficar sozinho.' }), o('ganancia', 'Ganância', {}, { text: 'Não resiste a um bom tesouro.' }),
      o('curiosidade', 'Curiosidade que atrai problemas', {}, { text: 'A curiosidade o mete em encrenca.' }),
    ],
  },
  { id: 'sonho', section: 'Personalidade', kind: 'text', optional: true, when: some, title: 'O que ele sonha em alcançar?', body: 'Opcional. Vai para a aba História.', placeholder: 'Ex.: reconstruir a vila onde nasceu', examples: ['Reconstruir a vila onde nasceu', 'Ficar famoso no mundo todo', 'Encontrar quem sumiu', 'Provar que estavam errados sobre ele', 'Ter um lar de verdade'] },
]

// ── Pesos das raças, antecedentes, classes e subclasses ─────────

const CLASS_VEC: Record<string, W> = {
  barbarian: { melee: 3, damage: 3, tank: 2, wild: 2 },
  bard: { social: 3, support: 3, arcane: 2, lore: 1, utility: 1 },
  cleric: { divine: 3, healing: 3, support: 3, tank: 1 },
  druid: { nature: 3, wild: 2, control: 2, healing: 1, companion: 2 },
  fighter: { melee: 3, discipline: 3, tank: 2, damage: 2, ranged: 1 },
  monk: { discipline: 3, speed: 3, melee: 2, damage: 1, stealth: 1 },
  paladin: { divine: 3, melee: 3, tank: 3, social: 1, healing: 1 },
  ranger: { ranged: 3, nature: 3, stealth: 2, companion: 1, utility: 1 },
  rogue: { stealth: 3, utility: 3, damage: 2, speed: 1, social: 1, ranged: 1 },
  sorcerer: { arcane: 3, wild: 3, damage: 3, social: 1 },
  warlock: { arcane: 3, social: 2, damage: 2, control: 1 },
  wizard: { arcane: 3, lore: 3, control: 3, utility: 2 },
}

const SUB_VEC: Record<string, W> = {
  berserker: { damage: 3, wild: 2 }, totem_warrior: { nature: 3, tank: 2 },
  lore: { lore: 3, utility: 2, social: 1 }, valor: { melee: 3, tank: 1, support: 1 },
  life: { healing: 3, support: 2 }, knowledge: { lore: 3 }, light: { damage: 2, divine: 1 }, nature: { nature: 3 }, tempest: { damage: 3, wild: 2 }, trickery: { stealth: 2, utility: 2, social: 1 }, war: { melee: 3, damage: 2 },
  land: { nature: 3, control: 2 }, moon: { melee: 3, wild: 3, tank: 2 },
  champion: { melee: 3, damage: 1 }, battle_master: { control: 2, support: 1, discipline: 3 }, eldritch_knight: { arcane: 3, melee: 2 },
  open_hand: { melee: 2, control: 2 }, shadow: { stealth: 3, arcane: 1 }, four_elements: { arcane: 3, wild: 2, nature: 1 },
  devotion: { healing: 1, tank: 2, support: 2 }, ancients: { nature: 2, healing: 1, support: 1 }, vengeance: { damage: 3, speed: 1 },
  hunter: { damage: 3, melee: 1 }, beast_master: { companion: 4, nature: 1 },
  thief: { utility: 3, speed: 2 }, assassin: { stealth: 3, damage: 3 }, arcane_trickster: { arcane: 3, stealth: 1, control: 1 },
  draconic: { tank: 2, damage: 2 }, wild_magic: { wild: 3, utility: 1 },
  fiend: { damage: 3, tank: 1 }, archfey: { social: 2, control: 3 }, great_old_one: { control: 2, lore: 2 },
  evocation: { damage: 3 }, abjuration: { tank: 2, support: 2 }, conjuration: { control: 2, utility: 2 }, divination: { lore: 3, utility: 2 },
  enchantment: { social: 3, control: 2 }, illusion: { stealth: 2, control: 2, social: 1 }, necromancy: { damage: 2, control: 1, wild: 1 }, transmutation: { utility: 3 },
}

const RACE_VEC: Record<string, W> = {
  human: { social: 1, utility: 1 }, dwarf: { tank: 3, melee: 2, discipline: 1 }, elf: { ranged: 2, stealth: 2, arcane: 1, speed: 1, nature: 1 },
  halfling: { stealth: 2, social: 1, speed: 1, utility: 1 }, dragonborn: { melee: 2, damage: 2, divine: 1, tank: 1 }, gnome: { arcane: 2, lore: 2, utility: 2 },
  half_elf: { social: 3, utility: 1, arcane: 1 }, half_orc: { melee: 3, damage: 3, tank: 1, wild: 1 }, tiefling: { arcane: 2, social: 2, damage: 1 },
}

const BG_VEC: Record<string, W> = {
  acolyte: { divine: 2, lore: 1 }, charlatan: { social: 3, stealth: 1, utility: 1 }, criminal: { stealth: 3, utility: 1 }, entertainer: { social: 3, speed: 1 },
  folk_hero: { tank: 1, nature: 1, melee: 1 }, guild_artisan: { social: 1, utility: 2 }, hermit: { nature: 1, lore: 2, healing: 1 }, noble: { social: 3, lore: 1 },
  outlander: { nature: 3, melee: 1 }, sage: { lore: 3, arcane: 1 }, sailor: { speed: 1, melee: 1, social: 1 }, soldier: { melee: 2, discipline: 2, tank: 1 },
  urchin: { stealth: 2, speed: 2, utility: 1 },
}

/** Que afinidades puxam cada perícia. */
const SKILL_TAGS: Record<string, W> = {
  acrobatics: { speed: 2, stealth: 1 }, animal_handling: { nature: 2, companion: 3 }, arcana: { arcane: 3, lore: 2 }, athletics: { melee: 2, tank: 2, speed: 1 },
  deception: { social: 2, utility: 2 }, history: { lore: 3 }, insight: { social: 1, support: 2, healing: 1 }, intimidation: { melee: 1, tank: 1, social: 1 },
  investigation: { lore: 2, utility: 2 }, medicine: { healing: 3, support: 1 }, nature: { nature: 3 }, perception: { stealth: 1, ranged: 2, nature: 1, utility: 1 },
  performance: { social: 2, support: 1 }, persuasion: { social: 3 }, religion: { divine: 3, lore: 1 }, sleight_of_hand: { stealth: 2, utility: 2 }, stealth: { stealth: 3 }, survival: { nature: 2, ranged: 1 },
}

/** Etiquetas das magias mais comuns (a escolha por afinidade; o resto segue o ranking geral). */
const SPELL_TAGS: Record<string, W> = {
  fire_bolt: { damage: 2, ranged: 1 }, eldritch_blast: { damage: 3, ranged: 1 }, sacred_flame: { damage: 2, divine: 1 }, vicious_mockery: { social: 2, damage: 1 }, produce_flame: { damage: 2, nature: 1 },
  shillelagh: { melee: 2, nature: 1 }, ray_of_frost: { damage: 1, control: 1 }, shocking_grasp: { damage: 2, melee: 1 }, poison_spray: { damage: 2 }, chill_touch: { damage: 1 }, acid_splash: { damage: 1 },
  guidance: { support: 2, divine: 1 }, mage_hand: { utility: 2 }, minor_illusion: { utility: 1, stealth: 1, social: 1 }, prestidigitation: { utility: 2 }, light: { utility: 1 }, druidcraft: { nature: 2, utility: 1 },
  thaumaturgy: { social: 1, divine: 1 }, message: { utility: 1, stealth: 1 }, resistance: { support: 1, tank: 1 }, spare_the_dying: { healing: 2 }, dancing_lights: { utility: 1 }, mending: { utility: 1 }, true_strike: { support: 1 },
  magic_missile: { damage: 3 }, shield: { tank: 3 }, cure_wounds: { healing: 3 }, healing_word: { healing: 3, support: 1 }, bless: { support: 3 }, guiding_bolt: { damage: 2, divine: 1 }, sleep: { control: 3 },
  mage_armor: { tank: 2 }, thunderwave: { control: 2, damage: 1 }, detect_magic: { lore: 2, utility: 1 }, burning_hands: { damage: 3 }, charm_person: { social: 3, control: 1 }, faerie_fire: { support: 2, control: 1 },
  entangle: { control: 3, nature: 1 }, hunters_mark: { damage: 2, ranged: 1 }, hex: { damage: 2 }, hellish_rebuke: { damage: 1, tank: 1 }, shield_of_faith: { tank: 2, support: 1 }, command: { control: 2, social: 1 },
  disguise_self: { stealth: 2, social: 1, utility: 1 }, find_familiar: { companion: 3, utility: 1 }, goodberry: { healing: 2, nature: 1 }, longstrider: { speed: 2 }, speak_with_animals: { nature: 2, companion: 1 },
  identify: { lore: 2 }, feather_fall: { utility: 1, speed: 1 }, color_spray: { control: 1 }, fog_cloud: { control: 1, stealth: 1 }, expeditious_retreat: { speed: 2 }, animal_friendship: { companion: 2, nature: 1 },
  misty_step: { speed: 2, utility: 1 }, hold_person: { control: 3 }, invisibility: { stealth: 3 }, mirror_image: { tank: 2 }, spiritual_weapon: { damage: 2, divine: 1 }, lesser_restoration: { healing: 2 },
  scorching_ray: { damage: 3 }, shatter: { damage: 2 }, web: { control: 3 }, suggestion: { social: 3, control: 1 }, moonbeam: { damage: 1, control: 1, nature: 1 }, pass_without_trace: { stealth: 3 },
  aid: { support: 2, healing: 1 }, blur: { tank: 1 }, darkness: { stealth: 1, control: 1 }, enhance_ability: { support: 2, utility: 1 }, silence: { stealth: 1, control: 1 }, barkskin: { tank: 2, nature: 1 },
  heat_metal: { damage: 1, control: 1 }, flaming_sphere: { damage: 2, control: 1 }, fireball: { damage: 3 }, counterspell: { control: 3, lore: 1 }, haste: { support: 3, speed: 1 }, fly: { utility: 3, speed: 1 },
  revivify: { healing: 3 }, dispel_magic: { utility: 2, control: 1 }, lightning_bolt: { damage: 3 }, hypnotic_pattern: { control: 3 }, spirit_guardians: { damage: 2, tank: 1, divine: 1 }, call_lightning: { damage: 2, nature: 1 },
}

// ── Cálculo ─────────────────────────────────────────────

export interface Profile {
  tags: Record<Tag, number>
  race: Record<string, number>
  bg: Record<string, number>
  order: string | null
  moral: string | null
  texts: { traits: string[]; bonds: string[]; flaws: string[]; world: string[]; motive: string[] }
}

const emptyTags = (): Record<Tag, number> => Object.fromEntries(TAGS.map((t) => [t, 0])) as Record<Tag, number>

export function visibleQuestions(a: NAnswers): NQuestion[] { return NQUESTIONS.filter((q) => !q.when || q.when(a)) }

const arr = (v: string | string[] | number | undefined): string[] => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : [])

export function profileOf(raw: NAnswers): Profile {
  const keep = new Set(visibleQuestions(raw).map((q) => q.id))
  const p: Profile = { tags: emptyTags(), race: {}, bg: {}, order: null, moral: null, texts: { traits: [], bonds: [], flaws: [], world: [], motive: [] } }
  for (const q of NQUESTIONS) {
    if (!keep.has(q.id) || !q.options) continue
    const m = q.mult ?? 1
    for (const v of arr(raw[q.id])) {
      const opt = q.options.find((x) => x.value === v)
      if (!opt) continue
      for (const [k, n] of Object.entries(opt.t ?? {})) p.tags[k as Tag] += (n as number) * m
      for (const [k, n] of Object.entries(opt.race ?? {})) p.race[k] = (p.race[k] ?? 0) + n * m
      for (const [k, n] of Object.entries(opt.bg ?? {})) p.bg[k] = (p.bg[k] ?? 0) + n * m
      if (opt.order) p.order = opt.order
      if (opt.moral) p.moral = opt.moral
      if (opt.text) {
        const bucket = { jeito: 'traits', vinculo: 'bonds', defeito: 'flaws', mundo: 'world', motivacao: 'motive' }[q.id] as keyof Profile['texts'] | undefined
        if (bucket) p.texts[bucket].push(opt.text)
      }
    }
  }
  return p
}

const dot = (a: Record<string, number>, b: W): number => Object.entries(b).reduce((s, [k, n]) => s + (a[k] ?? 0) * (n as number), 0)
const norm = (tags: Record<Tag, number>): Record<Tag, number> => {
  const max = Math.max(1, ...TAGS.map((t) => Math.abs(tags[t])))
  return Object.fromEntries(TAGS.map((t) => [t, (tags[t] / max) * 6])) as Record<Tag, number>
}

/** A chave de maior pontuação entre as opções oferecidas (a ordem das opções desempata). */
function best(options: string[], score: (k: string) => number): string {
  let top = options[0]
  let topScore = -Infinity
  for (const k of options) { const s = score(k); if (s > topScore) { top = k; topScore = s } }
  return top
}

const rankTop = (keys: string[], n: number, score: (k: string) => number): string[] =>
  keys.map((k, i) => ({ k, s: score(k), i })).sort((a, z) => z.s - a.s || a.i - z.i).slice(0, n).map((x) => x.k)

/** Os assuntos que mais pesaram numa escolha (para explicar o porquê). */
export function why(user: Record<Tag, number>, vec: W, n = 3): string[] {
  return TAGS.filter((t) => (vec[t] ?? 0) > 0 && user[t] > 0)
    .sort((a, z) => user[z] * (vec[z] ?? 0) - user[a] * (vec[a] ?? 0)).slice(0, n).map((t) => TAG_LABEL[t])
}

export function alignmentOf(p: Profile): string {
  const order = p.order ?? 'neutral'
  const moral = p.moral ?? 'neutral'
  if (order === 'neutral' && moral === 'neutral') return 'Neutro'
  const o2 = { lawful: 'Leal', neutral: 'Neutro', chaotic: 'Caótico' }[order]
  const m2 = { good: 'Bom', neutral: 'Neutro', evil: 'Mau' }[moral]
  return `${o2} e ${m2}`
}

function spellScore(e: SpellEntry | undefined, key: string, tags: Record<Tag, number>): number {
  const rank = e ? -spellPriority(e) * 0.02 : 0
  const w = SPELL_TAGS[key]
  return (w ? dot(tags, w) : 0) + rank
}

function kitScore(opt: KitOption, tags: Record<Tag, number>): number {
  let s = 0
  for (const it of opt.items) {
    if (!it.key) continue
    const w = getWeapon(it.key)
    if (w) {
      if (w.range === 'ranged') s += tags.ranged * 1.2
      else s += tags.melee * 0.5
      if (w.properties.some((x) => x.startsWith('duas mãos') || x.startsWith('pesada'))) s += tags.damage * 0.6
      if (w.properties.includes('acuidade')) s += (tags.stealth + tags.speed) * 0.5
      continue
    }
    if (it.key === 'shield') { s += tags.tank * 1.2; continue }
    const a = getArmor(it.key)
    if (a) s += a.category === 'light' ? tags.speed * 0.5 + tags.stealth * 0.3 : tags.tank * 0.8
  }
  return s
}

/** O texto de história que a narrativa escreve (frase, motivação, como o mundo o vê, sonho). */
export function storyOf(a: NAnswers, p: Profile): string {
  const lines: string[] = []
  const frase = String(a.frase ?? '').trim()
  if (frase) lines.push(frase)
  lines.push(...p.texts.motive, ...p.texts.world)
  const sonho = String(a.sonho ?? '').trim()
  if (sonho) lines.push(`Sonho: ${sonho}.`)
  return lines.join(' ')
}

export interface NarrativeResult {
  suggester: NonNullable<CreateInput['suggester']>
  extras: NonNullable<CreateInput['extras']>
  profile: Profile
}

/** Monta o sugeridor (e os textos de personalidade) para o planejador da criação, a partir das respostas da narrativa. */
export function narrativeResult(a: NAnswers): NarrativeResult {
  const p = profileOf(a)
  const tags = p.tags
  const n = norm(tags)
  const story = storyOf(a, p)
  const extras: NarrativeResult['extras'] = {
    personality_traits: p.texts.traits.join(' '),
    ideals: p.texts.motive.join(' '),
    bonds: p.texts.bonds.join(' '),
    flaws: p.texts.flaws.join(' '),
  }
  const skillScore = (k: string) => dot(tags, SKILL_TAGS[k] ?? {})
  const classKeys = Object.keys(CLASS_VEC)
  /** A classe que o perfil vai escolher: serve para decidir coisas que a raça pergunta antes dela (atributos à escolha). */
  const predictedClass = best(classKeys, (k) => dot(tags, CLASS_VEC[k]))

  const suggester: NarrativeResult['suggester'] = (q: Question, meta: AskMeta): Answer | undefined => {
    const values = q.kind === 'choice' || q.kind === 'multi' ? q.options.map((x) => x.value) : []
    const id = q.id
    if (id === 'name') return String(a.nome ?? '')
    if (id === 'level') return typeof a.nivel === 'number' ? a.nivel : 1
    if (id === 'story') return story
    if (id === 'alignment') return alignmentOf(p)
    if (id === 'race') return best(values, (k) => (p.race[k] ?? 0) * 2 + dot(n, RACE_VEC[k] ?? {}) * 0.25)
    if (id.startsWith('subrace:')) return best(values, (k) => dot(n, RACE_VEC[k] ?? {}))
    if (id === 'background') return best(values, (k) => (p.bg[k] ?? 0) * 2 + dot(n, BG_VEC[k] ?? {}) * 0.25)
    if (id === 'class') return best(values, (k) => dot(tags, CLASS_VEC[k] ?? {}))
    if (id.startsWith('subclass:')) return best(values, (k) => dot(tags, SUB_VEC[k] ?? {}))
    if (id === 'abilities-mode') return 'suggested'
    if (id === 'race-abilities') {
      const order = ABILITY_ORDER[predictedClass] ?? []
      return [...values].sort((x, z) => (order.indexOf(x as never) < 0 ? 9 : order.indexOf(x as never)) - (order.indexOf(z as never) < 0 ? 9 : order.indexOf(z as never))).slice(0, meta.count ?? 2)
    }
    if (id === 'race-tool' || id === 'race-languages' || id === 'bg-languages') return id === 'race-tool' ? values[0] : values.slice(0, meta.count ?? 1)
    if (id === 'race-cantrip') return best(values, (k) => spellScore(undefined, k, tags) - values.indexOf(k) * 0.01)
    if (id === 'race-skills' || id === 'class-skills' || id.startsWith('expertise:')) {
      return rankTop(values, meta.count ?? 2, skillScore)
    }
    if (id.startsWith('swap:')) return best(values, skillScore)
    if (id === 'fighting-style' || id === 'fighting-style-2') {
      return best(values, (k) => ({ archery: tags.ranged * 1.5, defense: tags.tank * 1.2 + 0.5, dueling: tags.melee * 0.6, great_weapon_fighting: tags.damage, protection: tags.support * 1.2 + tags.tank * 0.6, two_weapon_fighting: tags.speed + tags.stealth * 0.5 }[k] ?? 0))
    }
    if (id.startsWith('kit:') && meta.kit) return best(meta.kit.map((x) => x.id), (k) => kitScore(meta.kit!.find((x) => x.id === k)!, tags) - (meta.kit!.findIndex((x) => x.id === k)) * 0.01)
    if (id === 'cantrips' || id === 'spells' || id === 'prepared' || id === 'spellbook') {
      const count = meta.count ?? 0
      return rankTop(values, count, (k) => spellScore(SPELL_CACHE.get(k), k, tags))
    }
    return undefined
  }
  return { suggester, extras, profile: p }
}

/** Preenchido pela tela com o catálogo de magias carregado (para o ranking geral dentro da escolha). */
export const SPELL_CACHE = new Map<string, SpellEntry>()
export function primeSpellCache(spells: readonly SpellEntry[]): void { if (SPELL_CACHE.size === 0) for (const s of spells) SPELL_CACHE.set(s.key, s) }

/** Pergunta respondida o bastante para seguir? */
export function answeredN(q: NQuestion, a: NAnswers): boolean {
  const v = a[q.id]
  if (q.kind === 'text') return q.optional ? true : typeof v === 'string' && v.trim().length > 0
  if (q.kind === 'number') return typeof v === 'number'
  if (q.kind === 'multi') return Array.isArray(v) && v.length > 0
  return typeof v === 'string' && v.length > 0
}

/** As linhas do resultado: o que foi escolhido e por quê (a partir do rascunho já montado). */
export function explain(
  p: Profile,
  pick: { classKey: string; subclassKey: string | null; raceKey: string; subraceKey: string; backgroundKey: string },
  names: { cls: string; sub: string | null; race: string; bg: string },
): { label: string; value: string; why: string }[] {
  const n = norm(p.tags)
  const join = (list: string[]) => (list.length ? `combina com ${list.join(', ')}` : 'é o que mais se aproxima do conjunto das suas respostas')
  return [
    { label: 'Classe', value: names.cls, why: `${join(why(p.tags, CLASS_VEC[pick.classKey] ?? {}))}.` },
    ...(names.sub ? [{ label: 'Subclasse', value: names.sub, why: `${join(why(p.tags, SUB_VEC[pick.subclassKey ?? ''] ?? {}, 2))}.` }] : []),
    { label: 'Raça', value: names.race, why: p.race[pick.raceKey] ? 'pela aparência que você descreveu.' : `${join(why(n, RACE_VEC[pick.raceKey] ?? {}))}.` },
    { label: 'Antecedente', value: names.bg, why: p.bg[pick.backgroundKey] ? 'pelo que ele fazia antes da aventura.' : `${join(why(n, BG_VEC[pick.backgroundKey] ?? {}))}.` },
  ]
}
