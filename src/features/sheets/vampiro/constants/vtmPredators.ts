import type { VtmDiscipline } from './vampiro'
import type { VtmBook } from './vtmPowers'

// ────────────────────────────────────────────────────────
// Tipos de predador (V5): como o personagem caça e o que ganha na criação —
// um ponto numa disciplina (escolhe entre duas), uma especialização,
// mudança de Humanidade ou Potência de Sangue, e Antecedentes, Méritos e
// Defeitos. A ficha aplica tudo sozinha (vampiroRules.applyPredator).
// ────────────────────────────────────────────────────────

export type VtmPredatorGrant =
  /** Vantagem fixa. */
  | { t: 'adv'; key: string; dots: number; note?: string }
  /** Escolhe uma entre as opções. */
  | { t: 'pick'; options: { key: string; dots: number; note?: string }[] }
  /** Divide os pontos entre as vantagens da lista. */
  | { t: 'split'; keys: string[]; total: number; note?: string }

export interface VtmPredatorDef {
  id:          string
  label:       string
  en:          string
  books:       VtmBook[]
  /** Paradas de caça. */
  pools:       string[]
  summary:     string
  disciplines: VtmDiscipline[]
  /** Disciplinas que só alguns clãs podem pegar por aqui. */
  disciplineClans?: Partial<Record<VtmDiscipline, string[]>>
  /** [perícia, especialização] — escolhe uma. */
  specialties: [string, string][]
  humanity:    number
  bloodPotency: number
  grants:      VtmPredatorGrant[]
  /** Restrições (clãs que não podem, Potência máxima). */
  forbiddenClans?: string[]
  maxBloodPotency?: number
}

export const VTM_PREDATORS: VtmPredatorDef[] = [
  {
    id: 'gato_de_beco', label: 'Gato de Beco', en: 'Alleycat', books: ['core'],
    pools: ['Força + Briga (tomar à força)', 'Raciocínio + Manha (achar criminosos)'],
    summary: 'Ataca e bebe de quem conseguir, quando conseguir, na força ou na ameaça.',
    disciplines: ['celeridade', 'potencia'],
    specialties: [['intimidation', 'Assaltos'], ['brawl', 'Agarrar']],
    humanity: -1, bloodPotency: 0,
    grants: [{ t: 'adv', key: 'contatos', dots: 3, note: 'criminosos' }],
  },
  {
    id: 'ensacador', label: 'Ensacador', en: 'Bagger', books: ['core'],
    pools: ['Inteligência + Manha (achar, acessar ou comprar sangue)'],
    summary: 'Vive de bolsas de sangue, bancos de sangue, necrotérios e mercado negro.',
    disciplines: ['feiticaria', 'oblivio', 'ofuscacao'],
    disciplineClans: { feiticaria: ['tremere', 'banu_haqim'], oblivio: ['hecata'] },
    specialties: [['larceny', 'Abrir Fechaduras'], ['streetwise', 'Mercado Negro']],
    humanity: 0, bloodPotency: 0,
    grants: [{ t: 'adv', key: 'estomago_de_ferro', dots: 3 }, { t: 'adv', key: 'inimigo', dots: 2 }],
    forbiddenClans: ['ventrue'],
  },
  {
    id: 'sanguessuga', label: 'Sanguessuga', en: 'Blood Leech', books: ['core'],
    pools: ['Sem parada: caçar vampiros é jogado em cena'],
    summary: 'Bebe de outros vampiros: caçando, coagindo ou cobrando sangue como pagamento.',
    disciplines: ['celeridade', 'metamorfose'],
    specialties: [['brawl', 'Vampiros'], ['stealth', 'Contra Vampiros']],
    humanity: -1, bloodPotency: 1,
    grants: [
      { t: 'pick', options: [{ key: 'segredo_sombrio', dots: 2, note: 'Diablerista' }, { key: 'rejeitado', dots: 2 }] },
      { t: 'adv', key: 'exclusao_de_presa', dots: 2, note: 'mortais' },
    ],
  },
  {
    id: 'cutelo', label: 'Cutelo', en: 'Cleaver', books: ['core'],
    pools: ['Manipulação + Lábia (manter as vítimas e o disfarce)'],
    summary: 'Mantém uma família ou amigos mortais e bebe deles em segredo.',
    disciplines: ['dominacao', 'animalismo'],
    specialties: [['persuasion', 'Manipulação Psicológica'], ['subterfuge', 'Acobertar']],
    humanity: 0, bloodPotency: 0,
    grants: [{ t: 'adv', key: 'segredo_sombrio', dots: 1, note: 'Cutelo' }, { t: 'adv', key: 'rebanho', dots: 2 }],
  },
  {
    id: 'consensualista', label: 'Consensualista', en: 'Consensualist', books: ['core'],
    pools: ['Manipulação + Persuasão (beber com consentimento)'],
    summary: 'Só bebe de quem consente, seja doador, amante ou paciente.',
    disciplines: ['auspicios', 'fortitude'],
    specialties: [['medicine', 'Flebotomia'], ['persuasion', 'Receptáculos']],
    humanity: 1, bloodPotency: 0,
    grants: [
      { t: 'adv', key: 'segredo_sombrio', dots: 1, note: 'Quebra da Máscara' },
      { t: 'adv', key: 'exclusao_de_presa', dots: 1, note: 'quem não consente' },
    ],
  },
  {
    id: 'fazendeiro', label: 'Fazendeiro', en: 'Farmer', books: ['core'],
    pools: ['Autocontrole + Empatia com Animais (achar e pegar o animal)'],
    summary: 'Recusa sangue humano e vive de animais.',
    disciplines: ['animalismo', 'metamorfose'],
    specialties: [['animal_ken', 'Um animal específico'], ['survival', 'Caça']],
    humanity: 1, bloodPotency: 0,
    grants: [{ t: 'adv', key: 'fazendeiro', dots: 2 }],
    forbiddenClans: ['ventrue'], maxBloodPotency: 2,
  },
  {
    id: 'osiris', label: 'Osíris', en: 'Osiris', books: ['core'],
    pools: ['Manipulação + Lábia ou Intimidação + Fama (fãs e seguidores)'],
    summary: 'Uma celebridade ou líder que bebe dos fãs e seguidores.',
    disciplines: ['feiticaria', 'presenca'],
    disciplineClans: { feiticaria: ['tremere', 'banu_haqim'] },
    specialties: [['occult', 'Uma tradição'], ['performance', 'Um tipo de espetáculo']],
    humanity: 0, bloodPotency: 0,
    grants: [
      { t: 'split', keys: ['fama', 'rebanho'], total: 3 },
      { t: 'split', keys: ['inimigo', 'perdicao_folclorica'], total: 2, note: 'Inimigos e Defeitos Míticos' },
    ],
  },
  {
    id: 'joao_pestana', label: 'João Pestana', en: 'Sandman', books: ['core'],
    pools: ['Destreza + Furtividade (invadir e beber de quem dorme)'],
    summary: 'Entra nas casas e bebe de quem está dormindo.',
    disciplines: ['auspicios', 'ofuscacao'],
    specialties: [['medicine', 'Anestésicos'], ['stealth', 'Invasão']],
    humanity: 0, bloodPotency: 0,
    grants: [{ t: 'adv', key: 'recursos', dots: 1 }],
  },
  {
    id: 'rainha_da_cena', label: 'Rainha da Cena', en: 'Scene Queen', books: ['core'],
    pools: ['Manipulação + Persuasão (dentro da sua subcultura)'],
    summary: 'Reina numa cena (clube, tribo urbana) e bebe de quem gira em volta.',
    disciplines: ['dominacao', 'potencia'],
    specialties: [['etiquette', 'Uma cena'], ['leadership', 'Uma cena'], ['streetwise', 'Uma cena']],
    humanity: 0, bloodPotency: 0,
    grants: [
      { t: 'adv', key: 'fama', dots: 1 },
      { t: 'adv', key: 'contatos', dots: 1 },
      { t: 'pick', options: [{ key: 'antipatizado', dots: 1, note: 'fora da cena' }, { key: 'exclusao_de_presa', dots: 1, note: 'outra subcultura' }] },
    ],
  },
  {
    id: 'sereia', label: 'Sereia', en: 'Siren', books: ['core'],
    pools: ['Carisma + Lábia (seduzir)'],
    summary: 'Bebe durante a sedução e o sexo, ou fingindo os dois.',
    disciplines: ['fortitude', 'presenca'],
    specialties: [['persuasion', 'Sedução'], ['subterfuge', 'Sedução']],
    humanity: 0, bloodPotency: 0,
    grants: [{ t: 'adv', key: 'belo', dots: 2 }, { t: 'adv', key: 'inimigo', dots: 1, note: 'amante desprezado ou parceiro ciumento' }],
  },
  {
    id: 'extorsionario', label: 'Extorsionário', en: 'Extortionist', books: ['cbg'],
    pools: ['Força ou Manipulação + Intimidação (coagir)'],
    summary: 'Cobra sangue em troca de "proteção", na ameaça.',
    disciplines: ['dominacao', 'potencia'],
    specialties: [['intimidation', 'Coerção'], ['larceny', 'Segurança']],
    humanity: 0, bloodPotency: 0,
    grants: [
      { t: 'split', keys: ['contatos', 'recursos'], total: 3 },
      { t: 'adv', key: 'inimigo', dots: 2, note: 'polícia ou uma vítima que escapou' },
    ],
  },
  {
    id: 'ladrao_de_tumulos', label: 'Ladrão de Túmulos', en: 'Graverobber', books: ['cbg'],
    pools: ['Determinação + Medicina (entre os mortos)', 'Manipulação + Intuição (entre os enlutados)'],
    summary: 'Bebe de cadáveres frescos e de quem está de luto.',
    disciplines: ['fortitude', 'oblivio'],
    specialties: [['occult', 'Ritos Fúnebres'], ['medicine', 'Cadáveres']],
    humanity: 0, bloodPotency: 0,
    grants: [
      { t: 'adv', key: 'estomago_de_ferro', dots: 3 },
      { t: 'adv', key: 'refugio', dots: 1 },
      { t: 'adv', key: 'predador_obvio', dots: 2 },
    ],
  },
  {
    id: 'assassino_de_estrada', label: 'Assassino de Estrada', en: 'Roadside Killer', books: ['ltsr', 'lsc'],
    pools: ['Destreza ou Carisma + Condução (dar carona a quem não tem saída)'],
    summary: 'Caça nas estradas: caroneiros, motoristas, gente de passagem.',
    disciplines: ['fortitude', 'metamorfose'],
    specialties: [['survival', 'A Estrada'], ['investigation', 'Gíria dos Vampiros']],
    humanity: 0, bloodPotency: 0,
    grants: [{ t: 'adv', key: 'rebanho', dots: 2, note: 'migrante' }, { t: 'adv', key: 'exclusao_de_presa', dots: 1, note: 'moradores da cidade' }],
  },
  {
    id: 'ceifador', label: 'Ceifador', en: 'Grim Reaper', books: ['pg'],
    pools: ['Inteligência + Percepção ou Medicina (achar quem está morrendo)'],
    summary: 'Bebe de quem já está à beira da morte: hospitais, asilos, hospícios.',
    disciplines: ['auspicios', 'oblivio'],
    specialties: [['awareness', 'Morte'], ['larceny', 'Falsificação']],
    humanity: 1, bloodPotency: 0,
    grants: [
      { t: 'pick', options: [{ key: 'aliados', dots: 1, note: 'comunidade médica' }, { key: 'influencia', dots: 1, note: 'comunidade médica' }] },
      { t: 'adv', key: 'exclusao_de_presa', dots: 1, note: 'mortais saudáveis' },
    ],
  },
  {
    id: 'montero', label: 'Montero', en: 'Montero', books: ['pg'],
    pools: ['Inteligência + Furtividade (planejar)', 'Determinação + Furtividade (esperar)'],
    summary: 'Caça em grupo, com lacaios que encurralam a presa.',
    disciplines: ['dominacao', 'ofuscacao'],
    specialties: [['leadership', 'Matilha de Caça'], ['stealth', 'Tocaia']],
    humanity: -1, bloodPotency: 0,
    grants: [{ t: 'adv', key: 'lacaios', dots: 2 }],
  },
  {
    id: 'perseguidor', label: 'Perseguidor', en: 'Pursuer', books: ['pg'],
    pools: ['Inteligência + Investigação (achar quem ninguém vai notar)', 'Vigor + Furtividade (seguir pela cidade)'],
    summary: 'Escolhe uma vítima, estuda, segue e só depois ataca.',
    disciplines: ['animalismo', 'auspicios'],
    specialties: [['investigation', 'Perfil'], ['stealth', 'Seguir']],
    humanity: -1, bloodPotency: 0,
    grants: [{ t: 'adv', key: 'farejador', dots: 1 }, { t: 'adv', key: 'contatos', dots: 1, note: 'gente sem muitos escrúpulos' }],
  },
  {
    id: 'alcapao', label: 'Alçapão', en: 'Trapdoor', books: ['pg'],
    pools: ['Carisma + Furtividade (vítimas esperadas)', 'Destreza + Furtividade (invasores)', 'Raciocínio + Percepção + Refúgio (dentro da toca)'],
    summary: 'Atrai as vítimas pra dentro do próprio refúgio, uma armadilha.',
    disciplines: ['metamorfose', 'ofuscacao'],
    specialties: [['persuasion', 'Marketing'], ['stealth', 'Emboscadas ou Armadilhas']],
    humanity: 0, bloodPotency: 0,
    grants: [
      { t: 'adv', key: 'refugio', dots: 1 },
      { t: 'pick', options: [{ key: 'lacaios', dots: 1 }, { key: 'rebanho', dots: 1 }, { key: 'refugio', dots: 1, note: 'segundo ponto' }] },
      { t: 'pick', options: [{ key: 'refugio_assustador', dots: 1 }, { key: 'refugio_assombrado', dots: 1 }] },
    ],
  },
  {
    id: 'coletor_de_dizimo', label: 'Coletor de Dízimo', en: 'Tithe Collector', books: ['im'],
    pools: ['Sem parada: outros vampiros pagam o tributo em sangue'],
    summary: 'Um ancilla com poder que recebe sangue como tributo. Feito pra personagens mais velhos.',
    disciplines: ['dominacao', 'presenca'],
    specialties: [['intimidation', 'Vampiros'], ['leadership', 'Vampiros']],
    humanity: 0, bloodPotency: 0,
    grants: [{ t: 'split', keys: ['dominio', 'status'], total: 3 }, { t: 'adv', key: 'adversario', dots: 2 }],
  },
]

export function getPredator(id: string | null | undefined): VtmPredatorDef | null {
  return VTM_PREDATORS.find((p) => p.id === id) ?? null
}
