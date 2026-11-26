import { armorEntry } from '../catalog/armor'
import { CLASSES, dhClass } from '../catalog/classes'
import { DOMAIN_CARDS } from '../catalog/domainCards'
import { ANCESTRIES, COMMUNITIES } from '../catalog/heritage'
import { WEAPONS } from '../catalog/weapons'
import { START_TRAITS, emptyAnswers, suggestedFor, traitsValid, type QuickAnswers } from './quick'
import type { DhClassKey, DhTrait } from './types'
import { DH_TRAITS } from './types'

// ────────────────────────────────────────────────────────
// Ficha por narrativa: o jogador conta quem é o personagem (lore, ideias, jeito de jogar) e o site escolhe sozinho a melhor
// montagem: classe, subclasse, ancestralidade, comunidade, atributos, armas, armadura, Experiências e cartas de domínio.
// Cada resposta soma pontos em "afinidades" (luta de perto, magia, furtividade…); cada classe, subclasse, ancestralidade e
// comunidade tem as suas afinidades, e a de maior pontuação ganha. Nada é decidido por sorteio: as mesmas respostas dão sempre a mesma ficha.
// ────────────────────────────────────────────────────────

export type Tag =
  | 'melee' | 'ranged' | 'magic' | 'tank' | 'stealth' | 'support' | 'social' | 'lore' | 'nature'
  | 'divine' | 'wild' | 'companion' | 'vengeance' | 'speed' | 'healing' | 'trickery' | 'control' | 'war'

export const TAGS: Tag[] = ['melee', 'ranged', 'magic', 'tank', 'stealth', 'support', 'social', 'lore', 'nature', 'divine', 'wild', 'companion', 'vengeance', 'speed', 'healing', 'trickery', 'control', 'war']

export const TAG_LABEL: Record<Tag, string> = {
  melee: 'luta de perto', ranged: 'ataque à distância', magic: 'magia', tank: 'aguentar pancada', stealth: 'furtividade', support: 'apoiar o grupo',
  social: 'conversa e presença', lore: 'conhecimento', nature: 'natureza', divine: 'fé e poder sagrado', wild: 'poder bruto', companion: 'companhia de um animal',
  vengeance: 'justiça e vingança', speed: 'agilidade', healing: 'cura', trickery: 'esperteza e truques', control: 'versatilidade e controle', war: 'tática de combate',
}

type W = Partial<Record<Tag, number>>

export interface NOption {
  id: string
  label: string
  sub?: string
  /** Afinidades que a resposta soma. */
  t?: W
  /** Pontos diretos para ancestralidades (chave do catálogo). */
  a?: Record<string, number>
  /** Pontos diretos para comunidades. */
  c?: Record<string, number>
  /** Pontos diretos para atributos. */
  tr?: Partial<Record<DhTrait, number>>
  /** Peso da armadura: −9 nenhuma, −2 leve … +2 pesada. */
  ar?: number
  /** Texto de Experiência sugerido. */
  ex?: string
  /** Preferências de arma. */
  wp?: { far?: boolean; reach?: boolean; hands?: 1 | 2; mag?: boolean; trait?: DhTrait }
  /** 0 = poção de Vida, 1 = de Fadiga. */
  potion?: 0 | 1
  /** Mistura duas ancestralidades. */
  mixed?: boolean
}

export interface NQuestion {
  id: string
  group: string
  title: string
  hint?: string
  kind: 'one' | 'many' | 'text'
  /** Em 'many': quantas respostas no máximo. */
  max?: number
  /** Multiplicador dos pontos desta pergunta. */
  mult?: number
  optional?: boolean
  placeholder?: string
  options?: NOption[]
}

const lvl = (n: number): NOption => ({ id: String(n), label: `Nível ${n}`, sub: n === 1 ? 'Começo da campanha' : undefined })

export const QUESTIONS: NQuestion[] = [
  // ── Conceito ──
  { id: 'nome', group: 'Conceito', title: 'Qual é o nome do personagem?', hint: 'Pode ser mudado depois.', kind: 'text', placeholder: 'Nome' },
  { id: 'pronomes', group: 'Conceito', title: 'Quais são os pronomes dele?', hint: 'Opcional.', kind: 'text', optional: true, placeholder: 'Ele/Dele, Ela/Dela, Elu/Delu…' },
  { id: 'nivel', group: 'Conceito', title: 'Em que nível ele começa?', hint: 'A maioria das mesas começa no nível 1. Se for mais alto, você escolhe as subidas de cada nível depois.', kind: 'one', options: Array.from({ length: 10 }, (_, k) => lvl(k + 1)) },
  { id: 'frase', group: 'Conceito', title: 'Em uma frase, quem é essa pessoa?', hint: 'Opcional. Vai para as anotações da ficha.', kind: 'text', optional: true, placeholder: 'Ex.: uma ex-soldada que fugiu da guerra e agora só quer paz' },
  {
    id: 'arquetipo', group: 'Conceito', mult: 2, kind: 'one', title: 'Qual arquétipo mais parece com a ideia que você tem?', hint: 'Escolha o que chega mais perto. As próximas perguntas refinam.',
    options: [
      { id: 'protetor', label: 'O protetor', sub: 'Fica na frente para que os outros não se machuquem.', t: { tank: 3, support: 1, vengeance: 1 } },
      { id: 'erudito', label: 'O erudito', sub: 'Sabe de tudo e resolve com a cabeça.', t: { lore: 3, magic: 2, control: 1 } },
      { id: 'cacador', label: 'O caçador', sub: 'Rastreia, observa e acerta de longe.', t: { ranged: 3, nature: 2, stealth: 1 } },
      { id: 'trapaceiro', label: 'O trapaceiro', sub: 'Esperto, rápido, sempre com uma carta na manga.', t: { trickery: 3, stealth: 2, speed: 1 } },
      { id: 'lider', label: 'O líder carismático', sub: 'As pessoas seguem a voz dele.', t: { social: 3, support: 2, war: 1 } },
      { id: 'guerreiro', label: 'O guerreiro implacável', sub: 'Treinado para a batalha, só avança.', t: { melee: 3, war: 2, tank: 1 } },
      { id: 'curandeiro', label: 'O místico curandeiro', sub: 'Cuida, restaura e fala com o que não se vê.', t: { healing: 3, nature: 2, support: 1 } },
      { id: 'foradalei', label: 'O fora da lei', sub: 'Vive nas margens e não pede licença.', t: { trickery: 2, stealth: 2, melee: 1, social: 1 } },
      { id: 'cavaleiro', label: 'O cavaleiro sagrado', sub: 'Uma missão maior que a vida dele.', t: { divine: 3, melee: 2, support: 1 } },
      { id: 'domador', label: 'O amigo das feras', sub: 'Mais à vontade com animais do que com gente.', t: { companion: 3, nature: 3, ranged: 1 } },
      { id: 'artista', label: 'O artista', sub: 'Canta, conta, encanta; vive de plateia.', t: { social: 3, support: 2, magic: 1 } },
      { id: 'selvagem', label: 'O poder indomado', sub: 'Uma força que ele mal controla.', t: { wild: 3, magic: 2, melee: 1 } },
    ],
  },
  {
    id: 'quero', group: 'Conceito', kind: 'many', max: 3, mult: 1, title: 'O que você mais quer fazer na mesa?', hint: 'Escolha até 3.',
    options: [
      { id: 'salvar', label: 'Ser o herói que salva todo mundo', t: { tank: 2, support: 2 } },
      { id: 'cena', label: 'Brilhar nas cenas de conversa', t: { social: 3 } },
      { id: 'misterio', label: 'Resolver mistérios e descobrir segredos', t: { lore: 3 } },
      { id: 'explodir', label: 'Causar estrago enorme', t: { wild: 2, melee: 1, magic: 1 } },
      { id: 'rapido', label: 'Ser o mais rápido, escalar, acrobacias', t: { speed: 3 } },
      { id: 'bicho', label: 'Ter um animal ao meu lado', t: { companion: 3, nature: 1 } },
      { id: 'curar', label: 'Curar e cuidar dos amigos', t: { healing: 3, support: 1 } },
      { id: 'pecas', label: 'Pregar peças e enganar', t: { trickery: 3 } },
      { id: 'estrategia', label: 'Planejar e comandar a estratégia', t: { war: 2, control: 2 } },
      { id: 'fe', label: 'Viver uma missão de fé', t: { divine: 3 } },
    ],
  },

  // ── Estilo de jogo ──
  {
    id: 'posicao', group: 'Estilo de jogo', kind: 'one', title: 'Em um combate, onde ele prefere ficar?',
    options: [
      { id: 'frente', label: 'Na linha de frente', t: { melee: 3, tank: 2 }, ar: 1 },
      { id: 'meio', label: 'No meio do grupo, ajudando quem precisa', t: { support: 3, healing: 1 } },
      { id: 'longe', label: 'Longe, mirando de uma posição segura', t: { ranged: 3 }, wp: { far: true } },
      { id: 'sombra', label: 'Nas sombras, esperando a hora de agir', t: { stealth: 3, trickery: 1 }, ar: -1 },
      { id: 'ar', label: 'Pelos ares ou se movendo sem parar', t: { speed: 3, melee: 1 } },
      { id: 'varia', label: 'Depende da situação: se adapta', t: { control: 3, magic: 1 } },
    ],
  },
  {
    id: 'ameaca', group: 'Estilo de jogo', kind: 'one', title: 'Diante de uma ameaça, o que ele faz primeiro?',
    options: [
      { id: 'enfrenta', label: 'Enfrenta de peito aberto', t: { melee: 2, tank: 1, war: 1 } },
      { id: 'planeja', label: 'Observa, planeja e usa o ambiente', t: { control: 2, lore: 1, war: 1 } },
      { id: 'protege', label: 'Coloca-se entre a ameaça e os outros', t: { tank: 3, support: 1 } },
      { id: 'surpresa', label: 'Some e ataca de surpresa', t: { stealth: 3, trickery: 1 } },
      { id: 'conversa', label: 'Tenta resolver na conversa', t: { social: 3 } },
      { id: 'poder', label: 'Libera todo o poder que tem', t: { wild: 2, magic: 2 } },
      { id: 'reza', label: 'Invoca algo maior que ele', t: { divine: 3 } },
    ],
  },
  {
    id: 'resistencia', group: 'Estilo de jogo', kind: 'one', title: 'Como ele lida com o dano?',
    options: [
      { id: 'aguenta', label: 'Aguenta pancada: nada o derruba fácil', t: { tank: 3 }, ar: 2 },
      { id: 'equilibra', label: 'Equilibrado: leva alguns golpes, desvia de outros', t: {}, ar: 0 },
      { id: 'desvia', label: 'Desvia de tudo: é rápido demais para ser acertado', t: { speed: 2, stealth: 1 }, ar: -2 },
      { id: 'fragil', label: 'Frágil: depende dos outros para protegê-lo', t: { magic: 1, lore: 1 }, ar: -9 },
    ],
  },
  {
    id: 'papel', group: 'Estilo de jogo', kind: 'one', mult: 1.5, title: 'Qual é o papel dele no grupo?',
    options: [
      { id: 'dano', label: 'Causar dano', sub: 'Derruba os inimigos mais rápido que todo mundo.', t: { melee: 2, ranged: 1, wild: 1 } },
      { id: 'prote', label: 'Proteger', sub: 'Absorve os golpes e guarda os aliados.', t: { tank: 3 } },
      { id: 'cura', label: 'Curar e apoiar', sub: 'Mantém todo mundo de pé.', t: { healing: 3, support: 2 } },
      { id: 'lider', label: 'Liderar e inspirar', sub: 'Coordena e levanta o moral.', t: { social: 2, support: 2, war: 1 } },
      { id: 'batedor', label: 'Explorar e batedor', sub: 'Vai na frente, descobre o caminho.', t: { stealth: 2, nature: 1, speed: 1 } },
      { id: 'cara', label: 'Negociar e convencer', sub: 'Abre portas que a espada não abre.', t: { social: 3, trickery: 1 } },
      { id: 'mente', label: 'Ser a mente do grupo', sub: 'Conhece, analisa e resolve.', t: { lore: 3, control: 1 } },
    ],
  },
  {
    id: 'magia', group: 'Estilo de jogo', kind: 'one', title: 'E a magia, onde entra?',
    options: [
      { id: 'nenhuma', label: 'Não tem magia nenhuma', sub: 'Tudo é treino, aço e coragem.', t: { magic: -5, wild: -1 } },
      { id: 'pouca', label: 'Um pouco, como apoio', sub: 'Uma benção, um truque, algo discreto.', t: { magic: 1 } },
      { id: 'central', label: 'É central: ele é um conjurador', sub: 'Feitiços fazem parte de quase tudo que ele faz.', t: { magic: 5 }, wp: { mag: true } },
    ],
  },
  {
    id: 'ritmo', group: 'Estilo de jogo', kind: 'one', title: 'Prefere ações simples e confiáveis ou muitas opções e truques?',
    options: [
      { id: 'simples', label: 'Simples e confiável', sub: 'Poucas ferramentas, bem dominadas.', t: { melee: 1, tank: 1, war: 1 } },
      { id: 'meio', label: 'Um pouco de cada', t: {} },
      { id: 'varias', label: 'Muitas opções e surpresas', sub: 'Gosta de escolher a cada rodada.', t: { control: 2, trickery: 1, magic: 1 } },
    ],
  },
  {
    id: 'encurralado', group: 'Estilo de jogo', kind: 'one', title: 'Quando o grupo está encurralado, ele…',
    options: [
      { id: 'lidera', label: 'Assume a liderança e dá ordens', t: { social: 2, war: 2, support: 1 } },
      { id: 'protege', label: 'Segura a linha enquanto os outros fogem', t: { tank: 3 } },
      { id: 'volta', label: 'Procura outro caminho, dá a volta', t: { stealth: 2, speed: 1, trickery: 1 } },
      { id: 'destroi', label: 'Abre caminho à força', t: { melee: 2, wild: 2 } },
      { id: 'pensa', label: 'Para, pensa e acha a brecha', t: { lore: 2, control: 2 } },
      { id: 'fe', label: 'Confia na fé ou na sorte', t: { divine: 2, support: 1, healing: 1 } },
    ],
  },
  {
    id: 'foracombate', group: 'Estilo de jogo', kind: 'many', max: 2, title: 'Fora de combate, como ele resolve problemas?', hint: 'Escolha até 2.',
    options: [
      { id: 'conversa', label: 'Conversando', t: { social: 3 }, tr: { presence: 1 } },
      { id: 'investiga', label: 'Investigando e estudando', t: { lore: 3 }, tr: { knowledge: 1 } },
      { id: 'terreno', label: 'Lendo o terreno e os rastros', t: { nature: 3 }, tr: { instinct: 1 } },
      { id: 'infiltra', label: 'Se infiltrando e abrindo o que está fechado', t: { stealth: 2, trickery: 2 }, tr: { finesse: 1 } },
      { id: 'forca', label: 'Na força', t: { melee: 2, tank: 1 }, tr: { strength: 1 } },
      { id: 'magia', label: 'Com magia', t: { magic: 3 } },
      { id: 'fe', label: 'Pedindo ajuda ao divino', t: { divine: 3 } },
      { id: 'animal', label: 'Com a ajuda de um animal', t: { companion: 3, nature: 1 } },
    ],
  },

  // ── Poder e equipamento ──
  {
    id: 'fonte', group: 'Poder', kind: 'one', mult: 1.5, title: 'De onde vem o poder dele?',
    options: [
      { id: 'treino', label: 'Treino duro, anos de prática', t: { melee: 2, war: 2, tank: 1 } },
      { id: 'estudo', label: 'Estudo e dedicação', t: { lore: 3, magic: 2, control: 1 } },
      { id: 'natureza', label: 'Uma ligação com a natureza', t: { nature: 3, magic: 1, healing: 1 } },
      { id: 'fe', label: 'Fé, um chamado ou uma entidade', t: { divine: 3, support: 1 } },
      { id: 'sangue', label: 'Sangue, nascença ou herança misteriosa', t: { wild: 3, magic: 2 } },
      { id: 'esperteza', label: 'Esperteza, sorte e jogo de cintura', t: { trickery: 3, stealth: 1, social: 1 } },
      { id: 'arte', label: 'Música, histórias e presença', t: { social: 3, support: 2, magic: 1 } },
      { id: 'vinganca', label: 'Uma promessa de justiça ou vingança', t: { vengeance: 3, melee: 1, divine: 1 } },
    ],
  },
  {
    id: 'arma', group: 'Poder', kind: 'one', mult: 1.2, title: 'Que arma você imagina na mão dele?',
    options: [
      { id: 'espada', label: 'Espada e escudo', t: { melee: 2, tank: 1 }, wp: { hands: 1, trait: 'agility' }, ar: 1 },
      { id: 'pesada', label: 'Machado, martelo ou montante de duas mãos', t: { melee: 3, wild: 1 }, wp: { hands: 2, trait: 'strength' } },
      { id: 'lanca', label: 'Lança ou alabarda', t: { melee: 1, war: 2 }, wp: { reach: true, hands: 2 } },
      { id: 'arco', label: 'Arco', t: { ranged: 3, nature: 1 }, wp: { far: true, hands: 2, trait: 'agility' } },
      { id: 'besta', label: 'Besta', t: { ranged: 2, trickery: 1 }, wp: { far: true, hands: 1, trait: 'finesse' } },
      { id: 'adagas', label: 'Adagas e lâminas leves', t: { stealth: 2, trickery: 1, speed: 1 }, wp: { hands: 1, trait: 'finesse' } },
      { id: 'rapieira', label: 'Rapieira ou alfanje', t: { social: 1, speed: 1, melee: 1 }, wp: { hands: 1, trait: 'presence' } },
      { id: 'cajado', label: 'Cajado', t: { nature: 1, magic: 1 }, wp: { trait: 'instinct' } },
      { id: 'varinha', label: 'Varinha, cetro ou cajado arcano', t: { magic: 3, lore: 1 }, wp: { mag: true, far: true } },
      { id: 'punhos', label: 'Manoplas, anéis ou runas', t: { magic: 1, melee: 1, wild: 1 }, wp: { mag: true } },
      { id: 'nenhuma', label: 'Nenhuma em especial', t: {} },
    ],
  },
  {
    id: 'companheiro', group: 'Poder', kind: 'one', title: 'Ele tem um animal ou criatura ao lado dele?',
    options: [
      { id: 'sim', label: 'Sim, um companheiro fiel', t: { companion: 5, nature: 1 } },
      { id: 'talvez', label: 'Talvez um bicho que aparece de vez em quando', t: { companion: 1, nature: 1 } },
      { id: 'nao', label: 'Não', t: { companion: -2 } },
    ],
  },
  {
    id: 'aparencia', group: 'Poder', kind: 'one', title: 'Quando o poder dele aparece, como ele parece?',
    options: [
      { id: 'luz', label: 'Luz, brilho, asas', t: { divine: 2, support: 1 } },
      { id: 'fogo', label: 'Fogo, raio, explosões', t: { wild: 3 } },
      { id: 'sombra', label: 'Sombras e silêncio', t: { stealth: 2, trickery: 1 } },
      { id: 'folhas', label: 'Folhas, raízes, bichos e tempestades', t: { nature: 3 } },
      { id: 'musica', label: 'Música, palavras, encanto', t: { social: 2, support: 1, magic: 1 } },
      { id: 'mente', label: 'Símbolos, ilusões e pensamento', t: { lore: 2, control: 2, magic: 1 } },
      { id: 'musculo', label: 'Nada de mágico: músculos e aço', t: { melee: 2, tank: 1, magic: -2 } },
    ],
  },
  {
    id: 'armadura', group: 'Poder', kind: 'one', title: 'O que ele veste para a batalha?',
    options: [
      { id: 'placas', label: 'Armadura pesada de placas', t: { tank: 1 }, ar: 2 },
      { id: 'malha', label: 'Cota de malha', t: { tank: 1 }, ar: 1 },
      { id: 'couro', label: 'Couro', t: {}, ar: -1 },
      { id: 'gibao', label: 'Roupas acolchoadas, leves', t: { speed: 1 }, ar: -2 },
      { id: 'nada', label: 'Nada: roupas comuns', t: { magic: 1 }, ar: -9 },
      { id: 'auto', label: 'Tanto faz: escolham o melhor', t: {} },
    ],
  },
  {
    id: 'pocao', group: 'Poder', kind: 'one', title: 'Em apuros, o que ele gostaria de ter à mão?',
    options: [
      { id: 'vida', label: 'Algo que feche feridas', t: {}, potion: 0 },
      { id: 'fadiga', label: 'Algo que recupere o fôlego e a concentração', t: {}, potion: 1 },
    ],
  },

  // ── Origem ──
  {
    id: 'comunidade', group: 'Origem', kind: 'one', mult: 1.5, title: 'Onde ele cresceu?', hint: 'A comunidade dá uma habilidade e marca o jeito de ver o mundo.',
    options: [
      { id: 'nobre', label: 'Entre palácios, salões e títulos', c: { aristocratica: 6 }, t: { social: 1 } },
      { id: 'quartel', label: 'Em quartéis, ordens ou mosteiros disciplinados', c: { disciplinada: 6 }, t: { war: 1 } },
      { id: 'biblioteca', label: 'Entre livros, escolas e laboratórios', c: { erudita: 6 }, t: { lore: 1 } },
      { id: 'margens', label: 'Nas margens da lei, em becos e esconderijos', c: { fora_da_lei: 6 }, t: { trickery: 1 } },
      { id: 'mar', label: 'No mar, em portos e navios', c: { maritima: 6 }, t: { social: 1 } },
      { id: 'montanha', label: 'Nas montanhas, entre pedra e frio', c: { montanhesa: 6 }, t: { tank: 1 } },
      { id: 'estrada', label: 'Na estrada, sem lugar fixo', c: { nomade: 6 }, t: { speed: 1 } },
      { id: 'floresta', label: 'Na floresta, longe das cidades', c: { silvestre: 6 }, t: { nature: 1 } },
      { id: 'subterraneo', label: 'Debaixo da terra, em cavernas e túneis', c: { subterranea: 6 }, t: { stealth: 1 } },
    ],
  },
  {
    id: 'traco', group: 'Origem', kind: 'one', mult: 1.5, title: 'Qual traço físico mais marca a aparência dele?', hint: 'Isso decide a ancestralidade.',
    options: [
      { id: 'comum', label: 'Nada fora do comum: parece uma pessoa qualquer', a: { humano: 6 } },
      { id: 'orelhas', label: 'Orelhas pontudas e olhos que parecem enxergar longe', a: { elfo: 6 } },
      { id: 'escamas', label: 'Escamas, presas ou um sopro que queima', a: { drakona: 6, infernis: 2 } },
      { id: 'chifres', label: 'Chifres, cauda ou olhar infernal', a: { infernis: 6, fauno: 2, drakona: 1 } },
      { id: 'asas', label: 'Pequeno e com asas ou brilho no corpo', a: { fada: 6 } },
      { id: 'cascos', label: 'Cascos, chifres de bode ou pernas de bicho', a: { fauno: 6 } },
      { id: 'gigante', label: 'Enorme, braços longos e presença que ocupa a sala', a: { gigante: 6, firbolg: 2, orc: 1 } },
      { id: 'pelos', label: 'Pelos, rabo e instintos felinos', a: { katari: 6, simio: 1 } },
      { id: 'macaco', label: 'Ágil como um macaco, ótimo em escalar', a: { simio: 6, katari: 1 } },
      { id: 'baixinho', label: 'Baixinho, de pés grandes e cheio de sorte', a: { pequenino: 6, goblin: 1 } },
      { id: 'goblin', label: 'Pequeno, de orelhas grandes e olhar esperto', a: { goblin: 6, pequenino: 1 } },
      { id: 'barba', label: 'Baixo e largo, resistente como pedra', a: { anao: 6, galapa: 1 } },
      { id: 'casco', label: 'Casco nas costas e passo lento e firme', a: { galapa: 6, anao: 1 } },
      { id: 'metal', label: 'Feito de metal, engrenagens e circuitos', a: { clank: 6 } },
      { id: 'fungo', label: 'Corpo de cogumelo e redes de esporos', a: { fungril: 6 } },
      { id: 'orc', label: 'Pele dura, presas e músculos de combate', a: { orc: 6, gigante: 1 } },
      { id: 'floresta', label: 'Corpo de gigante gentil, ligado à floresta', a: { firbolg: 6, gigante: 1 } },
      { id: 'agua', label: 'Pele lisa, patas ou penas de criatura da água', a: { quacho: 6 } },
    ],
  },
  {
    id: 'mista', group: 'Origem', kind: 'one', title: 'Ele tem sangue de duas linhagens?', hint: 'Se sim, a 1ª habilidade de ancestralidade vem de uma e a 2ª da outra; o site escolhe a segunda que mais combina.',
    options: [
      { id: 'nao', label: 'Não, uma só', t: {} },
      { id: 'sim', label: 'Sim, uma mistura', t: {}, mixed: true },
    ],
  },
  {
    id: 'mundo', group: 'Origem', kind: 'one', title: 'Como o mundo enxerga esse personagem?',
    options: [
      { id: 'heroi', label: 'Como um herói', t: { support: 1, tank: 1, social: 1 } },
      { id: 'lenda', label: 'Como uma lenda viva (ou nem tanto)', t: { social: 2, war: 1 } },
      { id: 'criminoso', label: 'Como um criminoso procurado', c: { fora_da_lei: 2 }, t: { trickery: 2, stealth: 1 } },
      { id: 'estranho', label: 'Como um estranho, que ninguém entende', t: { wild: 1, magic: 1, nature: 1 } },
      { id: 'curandeiro', label: 'Como um curandeiro ou conselheiro', t: { healing: 2, support: 1 } },
      { id: 'ameaca', label: 'Como uma ameaça', t: { wild: 1, vengeance: 1, melee: 1 } },
      { id: 'ninguem', label: 'Como ninguém: passa despercebido', t: { stealth: 2 } },
    ],
  },
  {
    id: 'autoridade', group: 'Origem', kind: 'one', title: 'Qual é a relação dele com ordem e autoridade?',
    options: [
      { id: 'obedece', label: 'Respeita hierarquia e regras', c: { disciplinada: 3, aristocratica: 2 }, t: { war: 1, tank: 1 } },
      { id: 'neutro', label: 'Segue quando faz sentido', t: {} },
      { id: 'rebelde', label: 'Desconfia de quem manda', c: { fora_da_lei: 3, nomade: 1 }, t: { trickery: 1, vengeance: 1 } },
      { id: 'manda', label: 'Ele mesmo gosta de mandar', c: { aristocratica: 3, disciplinada: 1 }, t: { social: 1, war: 1 } },
    ],
  },
  {
    id: 'oficio', group: 'Origem', kind: 'one', title: 'O que ele fazia da vida antes da aventura?', hint: 'Vira uma das Experiências dele.',
    options: [
      { id: 'soldado', label: 'Soldado', ex: 'Soldado', t: { war: 2, melee: 1 }, c: { disciplinada: 2 } },
      { id: 'ferreiro', label: 'Ferreiro ou artesão', ex: 'Ferreiro', t: { tank: 1, melee: 1 }, c: { montanhesa: 1 } },
      { id: 'ladrao', label: 'Ladrão ou golpista', ex: 'Ladrão', t: { trickery: 2, stealth: 1 }, c: { fora_da_lei: 2 } },
      { id: 'estudioso', label: 'Estudioso ou escriba', ex: 'Estudioso', t: { lore: 2 }, c: { erudita: 2 } },
      { id: 'medico', label: 'Médico de campo ou curandeiro', ex: 'Médico de campo', t: { healing: 2, support: 1 } },
      { id: 'cacador', label: 'Caçador ou guia', ex: 'Rastreador', t: { ranged: 1, nature: 2 }, c: { silvestre: 2 } },
      { id: 'artista', label: 'Artista de rua ou de palco', ex: 'Contador de histórias', t: { social: 2 } },
      { id: 'nobre', label: 'Nobre ou diplomata', ex: 'Nobre', t: { social: 2 }, c: { aristocratica: 2 } },
      { id: 'marujo', label: 'Marinheiro ou pirata', ex: 'Pirata', t: { speed: 1, social: 1 }, c: { maritima: 2 } },
      { id: 'sacerdote', label: 'Sacerdote ou monge', ex: 'Sacerdote', t: { divine: 2, support: 1 }, c: { disciplinada: 1 } },
      { id: 'viajante', label: 'Viajante, mercador ou mensageiro', ex: 'Viajante do mundo', t: { speed: 1, social: 1 }, c: { nomade: 2 } },
      { id: 'mercenario', label: 'Mercenário ou caçador de recompensas', ex: 'Caçador de recompensas', t: { melee: 1, ranged: 1, war: 1 } },
    ],
  },
  {
    id: 'talento', group: 'Origem', kind: 'one', title: 'Qual talento especial ele tem fora de combate?', hint: 'Vira a outra Experiência dele.',
    options: [
      { id: 'mentiroso', label: 'Mente com a cara mais limpa do mundo', ex: 'Mentiroso', t: { trickery: 2, social: 1 }, tr: { presence: 1 } },
      { id: 'prata', label: 'Língua de prata: convence qualquer um', ex: 'Língua de prata', t: { social: 3 }, tr: { presence: 1 } },
      { id: 'rastreador', label: 'Segue rastros que ninguém vê', ex: 'Rastreador', t: { nature: 2, ranged: 1 }, tr: { instinct: 1 } },
      { id: 'acrobata', label: 'Acrobata: nada o segura no chão', ex: 'Acrobata', t: { speed: 2 }, tr: { agility: 1 } },
      { id: 'memoria', label: 'Memória que não esquece nada', ex: 'Memória fotográfica', t: { lore: 3 }, tr: { knowledge: 1 } },
      { id: 'bichos', label: 'Sussurra para os animais', ex: 'Sussurrador de animais', t: { companion: 2, nature: 2 }, tr: { instinct: 1 } },
      { id: 'disfarces', label: 'Mestre dos disfarces', ex: 'Mestre dos disfarces', t: { trickery: 2, stealth: 1 }, tr: { finesse: 1 } },
      { id: 'estrategista', label: 'Estrategista nato', ex: 'Estrategista', t: { war: 2, control: 1 }, tr: { knowledge: 1 } },
      { id: 'forca', label: 'Força incrível', ex: 'Força incrível', t: { melee: 2, tank: 1 }, tr: { strength: 1 } },
      { id: 'sobrevivente', label: 'Sobrevive em qualquer lugar', ex: 'Sobrevivencialista', t: { nature: 1, tank: 1, stealth: 1 }, tr: { instinct: 1 } },
      { id: 'inventor', label: 'Inventa e conserta quase tudo', ex: 'Inventor', t: { control: 1, lore: 1, trickery: 1 }, tr: { finesse: 1 } },
      { id: 'curandeiro', label: 'Cuida de feridas e doenças', ex: 'Curandeiro', t: { healing: 2, support: 1 }, tr: { knowledge: 1 } },
    ],
  },
  {
    id: 'passado', group: 'Origem', kind: 'text', optional: true, title: 'Escreva uma frase sobre o passado dele.', hint: 'Opcional. Se escrever, ela vira a primeira Experiência (uma palavra ou frase específica, sem magias ou habilidades).', placeholder: 'Ex.: Ex-guarda-costas do rei caído',
  },

  // ── Personalidade ──
  {
    id: 'motivacao', group: 'Personalidade', kind: 'one', mult: 1.2, title: 'O que move esse personagem?',
    options: [
      { id: 'vinganca', label: 'Vingança por algo que perdeu', t: { vengeance: 3, melee: 1 } },
      { id: 'curiosidade', label: 'Curiosidade, vontade de descobrir', t: { lore: 2, magic: 1 } },
      { id: 'proteger', label: 'Proteger quem ama', t: { tank: 2, support: 1 } },
      { id: 'fama', label: 'Fama, ouro ou reconhecimento', t: { social: 2, trickery: 1 } },
      { id: 'fe', label: 'Fé ou dever', t: { divine: 3 } },
      { id: 'liberdade', label: 'Liberdade acima de tudo', t: { speed: 1, trickery: 1, nature: 1 } },
      { id: 'redencao', label: 'Redenção por erros do passado', t: { healing: 1, divine: 1, support: 1 } },
      { id: 'poder', label: 'Dominar o próprio poder', t: { wild: 2, magic: 1 } },
      { id: 'justica', label: 'Justiça, mesmo contra a lei', t: { vengeance: 2, melee: 1, social: 1 } },
      { id: 'pertencer', label: 'Encontrar um lugar para chamar de lar', t: { support: 1, healing: 1, nature: 1 } },
    ],
  },
  {
    id: 'jeito', group: 'Personalidade', kind: 'one', title: 'Como ele se comporta com estranhos?',
    options: [
      { id: 'amigavel', label: 'Amigável e aberto', t: { social: 1, support: 1 }, tr: { presence: 2 } },
      { id: 'reservado', label: 'Reservado e observador', t: { stealth: 1, lore: 1 }, tr: { instinct: 1, knowledge: 1 } },
      { id: 'intimidador', label: 'Intimidador', t: { melee: 1, tank: 1 }, tr: { strength: 1, presence: 1 } },
      { id: 'calculista', label: 'Calculista, avaliando tudo', t: { control: 1, trickery: 1 }, tr: { finesse: 1, knowledge: 1 } },
      { id: 'brincalhao', label: 'Brincalhão, sempre com uma piada', t: { trickery: 1, social: 1 }, tr: { presence: 1, agility: 1 } },
    ],
  },
  {
    id: 'sentido', group: 'Personalidade', kind: 'many', max: 2, title: 'Qual destes atributos mais combina com ele?', hint: 'Escolha até 2. Entram na distribuição dos atributos.',
    options: [
      { id: 'agility', label: 'Agilidade', sub: 'Correr, saltar, manobrar.', tr: { agility: 3 } },
      { id: 'strength', label: 'Força', sub: 'Erguer, golpear, resistir.', tr: { strength: 3 } },
      { id: 'finesse', label: 'Acuidade', sub: 'Precisão, furtividade, mãos hábeis.', tr: { finesse: 3 } },
      { id: 'instinct', label: 'Instinto', sub: 'Perceber, sentir, navegar.', tr: { instinct: 3 } },
      { id: 'presence', label: 'Presença', sub: 'Carisma, charme, liderança.', tr: { presence: 3 } },
      { id: 'knowledge', label: 'Conhecimento', sub: 'Lembrar, analisar, compreender.', tr: { knowledge: 3 } },
    ],
  },
  {
    id: 'defeito', group: 'Personalidade', kind: 'one', title: 'Qual é o maior defeito ou medo dele?', hint: 'Vai para as anotações da ficha.',
    options: [
      { id: 'orgulho', label: 'Orgulho' }, { id: 'confianca', label: 'Confia demais nos outros' }, { id: 'desconfianca', label: 'Não confia em ninguém' },
      { id: 'raiva', label: 'Raiva que explode' }, { id: 'culpa', label: 'Culpa do passado' }, { id: 'escuro', label: 'Medo do escuro ou do desconhecido' },
      { id: 'solidao', label: 'Medo de ficar sozinho' }, { id: 'ganancia', label: 'Ganância' }, { id: 'curiosidade', label: 'Curiosidade que atrai problemas' },
    ],
  },
  { id: 'sonho', group: 'Personalidade', kind: 'text', optional: true, title: 'O que ele sonha em alcançar?', hint: 'Opcional. Vai para as anotações da ficha.', placeholder: 'Ex.: reconstruir a vila onde nasceu' },
  { id: 'item', group: 'Personalidade', kind: 'text', optional: true, title: 'Tem algo que ele carrega por motivo sentimental?', hint: 'Opcional. Vai para as anotações da ficha.', placeholder: 'Ex.: um anel quebrado da mãe' },
]

export type NarrativeAnswers = Record<string, string[]>

// ── afinidades de cada classe, subclasse, ancestralidade e comunidade ──

const CLASS_VEC: Record<DhClassKey, W> = {
  bardo: { social: 3, support: 3, magic: 1, lore: 1, trickery: 1 },
  druida: { nature: 3, magic: 3, healing: 2, wild: 2, control: 1, companion: 1 },
  feiticeiro: { magic: 3, wild: 3, control: 2, social: 1 },
  guardiao: { tank: 3, melee: 2, vengeance: 2, support: 1 },
  guerreiro: { melee: 3, war: 2, tank: 1, speed: 1, wild: 1 },
  ladino: { stealth: 3, trickery: 3, speed: 2, ranged: 1, melee: 1, social: 1 },
  mago: { magic: 3, lore: 3, control: 2, ranged: 1 },
  patrulheiro: { ranged: 3, nature: 3, companion: 2, stealth: 1, speed: 1 },
  serafim: { divine: 3, melee: 2, support: 2, healing: 2 },
}

const SUB_VEC: Record<string, W> = {
  trovador: { support: 3, healing: 1, social: 1 },
  beletrista: { social: 3, lore: 2 },
  protetor_elementos: { wild: 3, control: 1 },
  protetor_renovacao: { healing: 3, support: 3 },
  elementalista: { wild: 3, ranged: 1 },
  primordialista: { control: 3, lore: 1 },
  baluarte: { tank: 3 },
  vingador: { vengeance: 3, melee: 1 },
  escolhido_bravura: { tank: 2, war: 2 },
  escolhido_matanca: { melee: 3, wild: 2 },
  gatuno: { stealth: 3, trickery: 2 },
  mafioso: { social: 3, trickery: 2, war: 1 },
  disc_conhecimento: { lore: 3, control: 2 },
  disc_guerra: { war: 3, wild: 1, ranged: 1 },
  rastreador: { ranged: 3, speed: 2 },
  treinador: { companion: 4, nature: 2 },
  portador_divino: { melee: 3, divine: 2 },
  sentinela_alada: { speed: 2, divine: 2, ranged: 1 },
}

const ANC_VEC: Record<string, W> = {
  anao: { tank: 3, melee: 1 },
  clank: { lore: 2, control: 1, tank: 1 },
  drakona: { wild: 3, ranged: 1 },
  elfo: { magic: 2, speed: 2, lore: 1, nature: 1 },
  fada: { magic: 2, speed: 2, trickery: 2, nature: 1 },
  fauno: { nature: 2, speed: 2, social: 1 },
  firbolg: { nature: 3, support: 1, tank: 1 },
  fungril: { support: 2, nature: 2, lore: 1 },
  galapa: { tank: 3, nature: 1 },
  gigante: { melee: 3, tank: 2 },
  goblin: { trickery: 2, speed: 2, stealth: 2 },
  humano: { social: 2, war: 1, support: 1 },
  infernis: { social: 2, vengeance: 2, wild: 1, trickery: 1 },
  katari: { speed: 3, stealth: 2, melee: 1 },
  orc: { melee: 3, war: 1, tank: 1 },
  pequenino: { trickery: 2, stealth: 2, social: 2, support: 1 },
  quacho: { nature: 2, social: 2, speed: 1 },
  simio: { speed: 3, melee: 1, nature: 1 },
}

const COM_VEC: Record<string, W> = {
  aristocratica: { social: 3, lore: 1 },
  disciplinada: { war: 3, melee: 1, tank: 1 },
  erudita: { lore: 3, magic: 1 },
  fora_da_lei: { trickery: 3, stealth: 2 },
  maritima: { social: 1, trickery: 1, nature: 2 },
  montanhesa: { tank: 2, nature: 1, melee: 1 },
  nomade: { nature: 2, speed: 2, stealth: 1 },
  silvestre: { nature: 3, stealth: 1 },
  subterranea: { stealth: 2, tank: 1, lore: 1 },
}

/** Que afinidades alimentam cada atributo. */
const TRAIT_FROM_TAG: Record<DhTrait, W> = {
  agility: { speed: 1, ranged: 0.5 },
  strength: { melee: 1, tank: 0.7, war: 0.4 },
  finesse: { stealth: 1, trickery: 1, ranged: 0.5 },
  instinct: { nature: 1, wild: 0.7, companion: 0.5 },
  presence: { social: 1, support: 0.7, divine: 0.5 },
  knowledge: { lore: 1, magic: 0.5, control: 0.5 },
}

// ── cálculo ──

export interface Profile {
  tags: Record<Tag, number>
  anc: Record<string, number>
  com: Record<string, number>
  trait: Record<DhTrait, number>
  armor: number | null
  weapon: { far: boolean; reach: boolean; hands: 1 | 2 | null; mag: boolean; trait: DhTrait | null }
  potion: 0 | 1
  mixed: boolean
}

function emptyTags(): Record<Tag, number> {
  return Object.fromEntries(TAGS.map((t) => [t, 0])) as Record<Tag, number>
}

export function optionsPicked(q: NQuestion, answers: NarrativeAnswers): NOption[] {
  const ids = answers[q.id] ?? []
  return (q.options ?? []).filter((o) => ids.includes(o.id))
}

export function profileOf(answers: NarrativeAnswers): Profile {
  const p: Profile = {
    tags: emptyTags(), anc: {}, com: {}, trait: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    armor: null, weapon: { far: false, reach: false, hands: null, mag: false, trait: null }, potion: 0, mixed: false,
  }
  let armorN = 0
  let armorSum = 0
  for (const q of QUESTIONS) {
    const m = q.mult ?? 1
    for (const o of optionsPicked(q, answers)) {
      for (const [k, v] of Object.entries(o.t ?? {})) p.tags[k as Tag] += (v as number) * m
      for (const [k, v] of Object.entries(o.a ?? {})) p.anc[k] = (p.anc[k] ?? 0) + v * m
      for (const [k, v] of Object.entries(o.c ?? {})) p.com[k] = (p.com[k] ?? 0) + v * m
      for (const [k, v] of Object.entries(o.tr ?? {})) p.trait[k as DhTrait] += (v as number) * m
      if (o.ar !== undefined) { const w = q.id === 'armadura' ? 4 : 1; if (o.ar === -9 && q.id === 'armadura') { armorSum = -9; armorN = 1 } else if (armorSum !== -9) { armorSum += o.ar === -9 ? -2 * w : o.ar * w; armorN += w } }
      if (o.wp) {
        if (o.wp.far) p.weapon.far = true
        if (o.wp.reach) p.weapon.reach = true
        if (o.wp.hands) p.weapon.hands = o.wp.hands
        if (o.wp.mag) p.weapon.mag = true
        if (o.wp.trait) p.weapon.trait = o.wp.trait
      }
      if (o.potion !== undefined) p.potion = o.potion
      if (o.mixed) p.mixed = true
    }
  }
  if (armorN > 0) p.armor = armorSum === -9 ? -9 : armorSum / armorN
  return p
}

function dot(a: Partial<Record<string, number>>, b: Partial<Record<string, number>>): number {
  let s = 0
  for (const k of Object.keys(b)) s += (a[k] ?? 0) * (b[k] ?? 0)
  return s
}

function normalized(tags: Record<Tag, number>): Record<Tag, number> {
  const max = Math.max(1, ...TAGS.map((t) => Math.abs(tags[t])))
  return Object.fromEntries(TAGS.map((t) => [t, (tags[t] / max) * 6])) as Record<Tag, number>
}

function ranked<K extends string>(scores: Record<K, number>, order: K[]): K[] {
  return [...order].sort((a, b) => scores[b] - scores[a] || order.indexOf(a) - order.indexOf(b))
}

/** Os assuntos que mais pesaram numa escolha (para explicar o porquê). */
function why(user: Record<Tag, number>, vec: W, n = 3): string[] {
  return TAGS.filter((t) => (vec[t] ?? 0) > 0 && user[t] > 0)
    .sort((a, b) => user[b] * (vec[b] ?? 0) - user[a] * (vec[a] ?? 0))
    .slice(0, n)
    .map((t) => TAG_LABEL[t])
}

const KEYWORDS: Record<Tag, RegExp> = {
  healing: /cura|recuper|restaur|vida|ferid/,
  melee: /ataque|golpe|arma |corpo a corpo|investid|dano/,
  stealth: /furtiv|escond|oculto|sombra|invis|silêncio|surpresa/,
  magic: /feiti|magia|conjur|ilus|arcan|místic/,
  nature: /animal|planta|natureza|terra |besta|vento|raiz|raízes|selvagem/,
  support: /aliado|grupo|inspir|esperança|ajud/,
  social: /persuad|convenc|encant|palavr|mentir|ofend|plateia|discurso/,
  lore: /conhec|saber|livro|memór|estud|decifr|descobr/,
  tank: /armadura|resist|reduz|proteg|limiar|escudo|defesa/,
  speed: /mover|velocid|salt|rápid|ágil|esquiv|corr/,
  wild: /fogo|raio|explos|elemento|fúria|poder bruto|trovão/,
  divine: /divin|luz|sagrad|benç|santo|celest/,
  vengeance: /vingan|justiç|puni|marcar|alvo/,
  trickery: /truque|enganar|engan|furt|roub|distra|sorte|jogo/,
  control: /controla|vantagem|escolh|alterar|manipul|trocar/,
  war: /aliados|tática|comand|liderar|ordens/,
  ranged: /distânc|arco|flecha|projét|à distância|longe/,
  companion: /companheiro|animal|fera|besta/,
}

export interface Recommendation {
  answers: QuickAnswers
  /** Explicação curta de cada escolha. */
  reasons: { label: string; value: string; why: string }[]
  /** Outras classes que também combinam, da melhor para a pior. */
  alternatives: string[]
  /** Anotações da ficha escritas a partir da narrativa. */
  notes: string
  cardNames: string[]
}

function textOf(answers: NarrativeAnswers, id: string): string {
  return (answers[id]?.[0] ?? '').trim()
}

function label(id: string, answers: NarrativeAnswers): string {
  const q = QUESTIONS.find((x) => x.id === id)
  return q ? optionsPicked(q, answers).map((o) => o.label).join(', ') : ''
}

export function recommend(answers: NarrativeAnswers): Recommendation {
  const p = profileOf(answers)
  const tags = p.tags
  const norm = normalized(tags)

  // classe e subclasse
  const classKeys = CLASSES.map((c) => c.key)
  const classScore = Object.fromEntries(classKeys.map((k) => [k, dot(tags, CLASS_VEC[k])])) as Record<DhClassKey, number>
  const orderedClasses = ranked(classScore, classKeys)
  const classKey = orderedClasses[0]
  const cls = dhClass(classKey)!
  const subScore = Object.fromEntries(cls.subclasses.map((s) => [s.key, dot(tags, SUB_VEC[s.key] ?? {})])) as Record<string, number>
  const subKey = ranked(subScore, cls.subclasses.map((s) => s.key))[0]
  const sub = cls.subclasses.find((s) => s.key === subKey)!

  // ancestralidade e comunidade
  const ancKeys = ANCESTRIES.map((a) => a.key)
  const ancScore = Object.fromEntries(ancKeys.map((k) => [k, (p.anc[k] ?? 0) * 2 + dot(norm, ANC_VEC[k] ?? {}) * 0.25])) as Record<string, number>
  const ancOrder = ranked(ancScore, ancKeys)
  const ancestryKey = ancOrder[0]
  const ancestry2Key = p.mixed ? ancOrder[1] : null
  const comKeys = COMMUNITIES.map((c) => c.key)
  const comScore = Object.fromEntries(comKeys.map((k) => [k, (p.com[k] ?? 0) * 2 + dot(norm, COM_VEC[k] ?? {}) * 0.25])) as Record<string, number>
  const communityKey = ranked(comScore, comKeys)[0]

  // atributos: a sugestão da classe, ajustada pelo que a pessoa contou e pela subclasse
  const sug = suggestedFor(classKey)
  const userTrait = Object.fromEntries(DH_TRAITS.map((t) => [t, dot(tags, TRAIT_FROM_TAG[t]) + p.trait[t] * 2])) as Record<DhTrait, number>
  const maxUser = Math.max(1, ...DH_TRAITS.map((t) => Math.abs(userTrait[t])))
  const traitScore = Object.fromEntries(DH_TRAITS.map((t) => {
    const base = sug.traits[t] === 2 ? 3 : sug.traits[t] === 1 ? 1.5 : sug.traits[t] === 0 ? 0 : -1.5
    return [t, base + (userTrait[t] / maxUser) * 2.4 + (sub.spellcast === t ? 2.5 : 0)]
  })) as Record<DhTrait, number>
  const traitOrder = [...DH_TRAITS].sort((a, b) => traitScore[b] - traitScore[a] || sug.traits[b] - sug.traits[a])
  const traits = { ...sug.traits }
  traitOrder.forEach((t, i) => { traits[t] = START_TRAITS[i] })
  const finalTraits = traitsValid(traits) ? traits : sug.traits

  // armas
  const spells = sub.spellcast !== null
  const primaries = WEAPONS.filter((w) => w.tier === 1 && w.slot === 'primary' && !w.id.includes('wheelchair') && (spells || (w.damageType === 'fis' && w.trait !== 'conjuracao')))
  const traitValue = (t: string) => (t === 'conjuracao' ? (sub.spellcast ? finalTraits[sub.spellcast] : 0) : finalTraits[t as DhTrait])
  const farRange = new Set(['distante', 'muito_distante'])
  const reachRange = new Set(['muito_proximo', 'proximo'])
  const wpScore = (w: typeof primaries[number]) => {
    let s = traitValue(w.trait) * 1.4
    if (w.id === sug.primaryId) s += 2.5
    const want = p.weapon
    if (want.far) s += farRange.has(w.range) ? 4 : -2
    if (want.reach) s += reachRange.has(w.range) ? 4 : -1
    if (!want.far && !want.reach && want.hands !== null) s += (w.range === 'melee' ? 1 : 0)
    if (want.hands) s += w.hands === want.hands ? 2 : -1
    if (want.trait && w.trait === want.trait) s += 2.5
    if (want.mag) s += w.damageType === 'mag' ? 3.5 : -2
    else if (tags.magic < 0) s += w.damageType === 'mag' ? -4 : 0
    return s
  }
  const primary = [...primaries].sort((a, b) => wpScore(b) - wpScore(a))[0]
  let secondaryId = ''
  if (primary.hands === 1) {
    if (tags.tank >= 5) secondaryId = tags.tank >= 9 ? 'tower-shield' : 'round-shield'
    else if (tags.ranged >= 6 && !farRange.has(primary.range)) secondaryId = 'hand-crossbow'
    else if (tags.stealth + tags.trickery >= 8) secondaryId = 'small-dagger'
    else secondaryId = sug.secondaryId
  }
  // armadura
  const armorPick = (): string => {
    if (p.armor === null || p.armor === 0) return sug.armorId
    if (p.armor <= -9) return ''
    if (p.armor <= -1.5) return 'gambeson-armor'
    if (p.armor < 0) return 'leather-armor'
    if (p.armor < 1.5) return 'chainmail-armor'
    return 'full-plate-armor'
  }
  const armorId = armorPick()

  // Experiências
  const picked = (id: string) => QUESTIONS.find((q) => q.id === id)?.options?.find((o) => (answers[id] ?? []).includes(o.id))
  const ex1 = textOf(answers, 'passado') || picked('oficio')?.ex || ''
  let ex2 = picked('talento')?.ex || ''
  if (ex2 && ex2.toLowerCase() === ex1.toLowerCase()) ex2 = ''
  const fallbackExp = ['Viajante do mundo', 'Sobrevivente']
  const experiences: [string, string] = [ex1 || fallbackExp[0], ex2 || fallbackExp.find((x) => x.toLowerCase() !== (ex1 || fallbackExp[0]).toLowerCase())!]

  // cartas: 2 de nível 1 dos domínios da classe, pelo que combina com as afinidades
  const l1 = DOMAIN_CARDS.filter((c) => cls.domains.includes(c.domain) && c.level === 1)
  const cardScore = (c: typeof l1[number]) => {
    const text = `${c.name} ${c.text}`.toLowerCase()
    let s = 0
    for (const t of TAGS) if (tags[t] > 0 && KEYWORDS[t].test(text)) s += tags[t]
    return s
  }
  const sortedCards = [...l1].sort((a, b) => cardScore(b) - cardScore(a))
  const first = sortedCards[0]
  const second = sortedCards.slice(1).find((c) => c.domain !== first.domain && cardScore(c) >= cardScore(sortedCards[1]) * 0.7) ?? sortedCards[1]
  const cards = [first.id, second.id]

  const nome = textOf(answers, 'nome')
  const level = Number(answers.nivel?.[0] ?? 1) || 1
  const a: QuickAnswers = {
    ...emptyAnswers(),
    name: nome,
    pronouns: textOf(answers, 'pronomes'),
    level: Math.min(10, Math.max(1, level)),
    classKey,
    subclassKey: subKey,
    ancestryKey,
    ancestry2Key,
    communityKey,
    traits: finalTraits,
    primaryId: primary.id,
    secondaryId,
    armorId,
    potion: p.potion,
    keepsake: 0,
    carry: cls.itemChoices.carry ? cls.itemChoices.carry.examples.split(',')[0].trim() : '',
    experiences,
    cards,
  }

  // anotações escritas a partir da narrativa
  const lines: string[] = []
  const frase = textOf(answers, 'frase')
  if (frase) lines.push(frase)
  const add = (title: string, value: string) => { if (value) lines.push(`${title}: ${value}`) }
  add('Arquétipo', label('arquetipo', answers))
  add('O que o move', label('motivacao', answers))
  add('Como o mundo o vê', label('mundo', answers))
  add('Defeito ou medo', label('defeito', answers))
  add('Sonho', textOf(answers, 'sonho'))
  add('Item querido', textOf(answers, 'item'))
  a.notes = lines.length ? `História (montada pelo formulário de narrativa)\n${lines.join('\n')}` : ''

  const anc = ANCESTRIES.find((x) => x.key === ancestryKey)
  const anc2 = ANCESTRIES.find((x) => x.key === ancestry2Key)
  const com = COMMUNITIES.find((x) => x.key === communityKey)
  const topTraits = DH_TRAITS.filter((t) => finalTraits[t] >= 1).sort((x, y) => finalTraits[y] - finalTraits[x])
  const joinWhy = (list: string[]) => (list.length ? `combina com ${list.join(', ')}` : 'é o que mais se aproxima do conjunto das suas respostas')
  const reasons: Recommendation['reasons'] = [
    { label: 'Classe', value: `${cls.name} (${sub.name})`, why: `${joinWhy(why(tags, CLASS_VEC[classKey]))}; a subclasse ${sub.name} ${joinWhy(why(tags, SUB_VEC[subKey] ?? {}, 2))}.` },
    { label: 'Ancestralidade', value: `${anc?.name ?? ''}${anc2 ? ` + ${anc2.name} (mista)` : ''}`, why: p.anc[ancestryKey] ? `pela aparência que você descreveu${anc2 ? '; a segunda linhagem é a que mais completa o resto do perfil' : ''}.` : `${joinWhy(why(norm, ANC_VEC[ancestryKey] ?? {}))}.` },
    { label: 'Comunidade', value: com?.name ?? '', why: p.com[communityKey] ? 'pelo lugar onde ele cresceu e pela relação dele com a autoridade.' : `${joinWhy(why(norm, COM_VEC[communityKey] ?? {}))}.` },
    { label: 'Atributos', value: topTraits.map((t) => `${labelTrait(t)} ${finalTraits[t] > 0 ? '+' : ''}${finalTraits[t]}`).join(' · '), why: `os mais altos seguem o que você contou sobre o jeito dele${sub.spellcast ? ` e o atributo de conjuração de ${sub.name}` : ''}.` },
    { label: 'Equipamento', value: `${primary.name}${secondaryId ? ` + ${WEAPONS.find((w) => w.id === secondaryId)?.name ?? ''}` : ''} · ${armorEntry(armorId)?.name ?? 'sem armadura'}`, why: 'escolhidos pelo estilo de luta, pela arma que você imaginou e pelos atributos dele.' },
    { label: 'Experiências', value: experiences.join(' · '), why: 'vêm do ofício e do talento que você escolheu (ou da frase sobre o passado).' },
    { label: 'Cartas de domínio', value: [first, second].map((c) => c.name).join(' · '), why: 'as duas que mais ajudam no estilo que você descreveu.' },
  ]
  const alternatives = orderedClasses.slice(1, 3).map((k) => dhClass(k)!.name)
  return { answers: a, reasons, alternatives, notes: a.notes, cardNames: [first.name, second.name] }
}

function labelTrait(t: DhTrait): string {
  return { agility: 'Agilidade', strength: 'Força', finesse: 'Acuidade', instinct: 'Instinto', presence: 'Presença', knowledge: 'Conhecimento' }[t]
}

/** A pergunta já foi respondida o bastante para seguir? */
export function answered(q: NQuestion, answers: NarrativeAnswers): boolean {
  const a = answers[q.id] ?? []
  if (q.kind === 'text') return q.optional ? true : (a[0] ?? '').trim().length > 0
  return a.length > 0
}
