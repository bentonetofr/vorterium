import type { AbilityKey, SkillKey } from '../rules/types'
import {
  blankAttack, blankCompanion, blankTrait, newCompanionId,
  type Companion, type CompanionAttack, type CompanionKind, type CompanionTrait, type SpeedKey, type TraitKind,
} from './companions'

// ────────────────────────────────────────────────────────
// Modelos prontos de companheiros: os do livro, com os números e as habilidades (resumos próprios, em português). Tudo o que o
// modelo traz é editável depois. Os de regra (Defensor de Aço, Homúnculo, Canhão Místico, Espírito de Fogo Selvagem, bestas da
// Tasha, Companheiro do Patrulheiro e Constructo Invocado) nascem no AUTOMÁTICO: PV, CA e bônus saem do personagem.
// ────────────────────────────────────────────────────────

export interface CompanionPreset {
  key: string
  label: string
  group: CompanionKind
  /** Uma linha pra escolher: de onde vem e o que faz. */
  blurb: string
  /** Quem dá: a classe ou a magia (aparece como etiqueta). */
  source: string
  build: () => Companion
}

type Abs = [number, number, number, number, number, number]
const abs = ([strength, dexterity, constitution, intelligence, wisdom, charisma]: Abs): Record<AbilityKey, number> => ({ strength, dexterity, constitution, intelligence, wisdom, charisma })

const trait = (name: string, kind: TraitKind, text: string, extra: Partial<CompanionTrait> = {}): CompanionTrait => blankTrait({ name, kind, text, ...extra })
const hit = (name: string, over: Partial<CompanionAttack>): CompanionAttack => blankAttack({ name, ...over })

// ── Criaturas do livro (SRD) usadas como base de familiar, pet, montaria e Companheiro do Patrulheiro ──

interface Beast {
  key: string
  name: string
  size: string
  type?: string
  cr: string
  ac: number
  hp: number
  speeds: Partial<Record<SpeedKey, number>>
  abs: Abs
  skills?: [SkillKey, 'proficient' | 'expertise'][]
  senses: string
  traits?: CompanionTrait[]
  attacks?: CompanionAttack[]
}

const BEASTS: Beast[] = [
  { key: 'owl', name: 'Coruja', size: 'Miúdo', cr: '0', ac: 11, hp: 1, speeds: { walk: 5, fly: 60 }, abs: [3, 13, 8, 2, 12, 7], skills: [['perception', 'proficient'], ['stealth', 'proficient']], senses: 'visão no escuro 36 m (120 pés)',
    traits: [trait('Voo Rasante', 'trait', 'Não provoca ataque de oportunidade quando voa para fora do alcance de um inimigo.'), trait('Audição e Visão Aguçadas', 'trait', 'Vantagem em testes de Percepção que dependam de audição ou visão.')],
    attacks: [hit('Garras', { hit: 3, dice: '', dmg: 1, type: 'cortante' })] },
  { key: 'cat', name: 'Gato', size: 'Miúdo', cr: '0', ac: 12, hp: 2, speeds: { walk: 40, climb: 30 }, abs: [3, 15, 10, 3, 12, 7], skills: [['perception', 'proficient'], ['stealth', 'proficient']], senses: '',
    traits: [trait('Olfato Aguçado', 'trait', 'Vantagem em testes de Percepção que dependam do olfato.')], attacks: [hit('Garras', { hit: 0, dice: '', dmg: 1, type: 'cortante' })] },
  { key: 'bat', name: 'Morcego', size: 'Miúdo', cr: '0', ac: 12, hp: 1, speeds: { walk: 5, fly: 30 }, abs: [2, 15, 8, 2, 12, 4], senses: 'percepção às cegas 18 m (60 pés)',
    traits: [trait('Ecolocalização', 'trait', 'Não usa percepção às cegas se estiver surdo.'), trait('Audição Aguçada', 'trait', 'Vantagem em Percepção que dependa de audição.')], attacks: [hit('Mordida', { hit: 0, dice: '', dmg: 1, type: 'perfurante' })] },
  { key: 'raven', name: 'Corvo', size: 'Miúdo', cr: '0', ac: 12, hp: 1, speeds: { walk: 10, fly: 50 }, abs: [2, 14, 8, 2, 12, 6], skills: [['perception', 'proficient']], senses: '',
    traits: [trait('Mímica', 'trait', 'Imita sons simples que já ouviu, como um sussurro, o choro de um bebê ou um animal. Quem ouve percebe a imitação com um teste de Intuição CD 10.')], attacks: [hit('Bico', { hit: 4, dice: '', dmg: 1, type: 'perfurante' })] },
  { key: 'hawk', name: 'Falcão', size: 'Miúdo', cr: '0', ac: 13, hp: 1, speeds: { walk: 10, fly: 60 }, abs: [5, 16, 8, 2, 14, 6], skills: [['perception', 'proficient']], senses: '',
    traits: [trait('Visão Aguçada', 'trait', 'Vantagem em Percepção que dependa da visão.')], attacks: [hit('Garras', { hit: 5, dice: '', dmg: 1, type: 'cortante' })] },
  { key: 'rat', name: 'Rato', size: 'Miúdo', cr: '0', ac: 10, hp: 1, speeds: { walk: 20 }, abs: [2, 11, 9, 2, 10, 4], senses: 'visão no escuro 9 m (30 pés)',
    traits: [trait('Olfato Aguçado', 'trait', 'Vantagem em Percepção que dependa do olfato.')], attacks: [hit('Mordida', { hit: 0, dice: '', dmg: 1, type: 'perfurante' })] },
  { key: 'weasel', name: 'Doninha', size: 'Miúdo', cr: '0', ac: 13, hp: 1, speeds: { walk: 30 }, abs: [3, 16, 8, 2, 12, 3], skills: [['perception', 'proficient'], ['stealth', 'proficient']], senses: '',
    traits: [trait('Audição e Olfato Aguçados', 'trait', 'Vantagem em Percepção que dependa de audição ou olfato.')], attacks: [hit('Mordida', { hit: 5, dice: '', dmg: 1, type: 'perfurante' })] },
  { key: 'frog', name: 'Sapo', size: 'Miúdo', cr: '0', ac: 11, hp: 1, speeds: { walk: 20, swim: 20 }, abs: [1, 13, 8, 1, 8, 3], skills: [['perception', 'proficient'], ['stealth', 'proficient']], senses: 'visão no escuro 9 m (30 pés)',
    traits: [trait('Anfíbio', 'trait', 'Respira ar e água.'), trait('Salto Parado', 'trait', 'O salto em distância chega a 3 m e o em altura a 1,5 m, com ou sem corrida.')], attacks: [hit('Mordida', { hit: 3, dice: '', dmg: 1, type: 'perfurante' })] },
  { key: 'spider', name: 'Aranha', size: 'Miúdo', cr: '0', ac: 12, hp: 1, speeds: { walk: 20, climb: 20 }, abs: [2, 14, 8, 1, 10, 2], skills: [['stealth', 'proficient']], senses: 'visão no escuro 9 m (30 pés)',
    traits: [trait('Escalar Aranha', 'trait', 'Escala superfícies difíceis, até de cabeça pra baixo no teto, sem testes.'), trait('Sentido de Teia', 'trait', 'Sabe a posição de qualquer criatura em contato com a mesma teia.'), trait('Andarilha de Teias', 'trait', 'Ignora restrições de movimento causadas por teias.')],
    attacks: [hit('Mordida', { hit: 4, dice: '', dmg: 1, type: 'perfurante', text: 'Salvaguarda de Constituição CD 9 ou sofre 2 (1d4) de dano de veneno.' })] },
  { key: 'lizard', name: 'Lagarto', size: 'Miúdo', cr: '0', ac: 10, hp: 2, speeds: { walk: 20, climb: 20 }, abs: [2, 11, 10, 1, 8, 3], senses: 'visão no escuro 9 m (30 pés)', attacks: [hit('Mordida', { hit: 0, dice: '', dmg: 1, type: 'perfurante' })] },
  { key: 'octopus', name: 'Polvo', size: 'Pequeno', cr: '0', ac: 12, hp: 3, speeds: { walk: 5, swim: 30 }, abs: [4, 15, 11, 3, 10, 4], skills: [['perception', 'proficient'], ['stealth', 'proficient']], senses: 'visão no escuro 9 m (30 pés)',
    traits: [trait('Prender o Fôlego', 'trait', 'Fora d’água, aguenta 30 minutos sem respirar.'), trait('Camuflagem Submersa', 'trait', 'Vantagem em Furtividade debaixo d’água.'), trait('Respirar na Água', 'trait', 'Só respira debaixo d’água.')],
    attacks: [hit('Tentáculos', { hit: 4, dice: '', dmg: 1, type: 'contundente', text: 'Alvo fica agarrado (CD 10 para escapar) e o polvo não pode usar os tentáculos em outro alvo.' })] },
  { key: 'seahorse', name: 'Cavalo-marinho', size: 'Miúdo', cr: '0', ac: 11, hp: 1, speeds: { swim: 20 }, abs: [1, 12, 8, 1, 10, 2], senses: '', traits: [trait('Respirar na Água', 'trait', 'Só respira debaixo d’água.')] },
  { key: 'crab', name: 'Caranguejo', size: 'Miúdo', cr: '0', ac: 11, hp: 2, speeds: { walk: 20, swim: 20 }, abs: [2, 11, 10, 1, 8, 2], skills: [['stealth', 'proficient']], senses: 'percepção às cegas 9 m (30 pés)',
    traits: [trait('Anfíbio', 'trait', 'Respira ar e água.')], attacks: [hit('Garra', { hit: 0, dice: '', dmg: 1, type: 'contundente' })] },
  { key: 'fish', name: 'Peixe', size: 'Miúdo', cr: '0', ac: 13, hp: 1, speeds: { swim: 40 }, abs: [2, 16, 9, 1, 7, 1], senses: 'visão no escuro 9 m (30 pés)', traits: [trait('Respirar na Água', 'trait', 'Só respira debaixo d’água.')] },
  { key: 'snake', name: 'Cobra venenosa', size: 'Miúdo', cr: '1/8', ac: 13, hp: 2, speeds: { walk: 30, swim: 30 }, abs: [2, 16, 11, 1, 10, 3], senses: 'percepção às cegas 3 m (10 pés)',
    attacks: [hit('Mordida', { hit: 5, dice: '', dmg: 1, type: 'perfurante', text: 'Salvaguarda de Constituição CD 10: falhando sofre 5 (2d4) de dano de veneno, ou metade se passar.' })] },
  { key: 'mastiff', name: 'Mastim', size: 'Médio', cr: '1/8', ac: 12, hp: 5, speeds: { walk: 40 }, abs: [13, 14, 12, 3, 12, 7], skills: [['perception', 'proficient']], senses: '',
    traits: [trait('Audição e Olfato Aguçados', 'trait', 'Vantagem em Percepção que dependa de audição ou olfato.')],
    attacks: [hit('Mordida', { hit: 3, dice: '1d6', dmg: 1, type: 'perfurante', text: 'Alvo faz salvaguarda de Força CD 11 ou cai.' })] },
  { key: 'wolf', name: 'Lobo', size: 'Médio', cr: '1/4', ac: 13, hp: 11, speeds: { walk: 40 }, abs: [12, 15, 12, 3, 12, 6], skills: [['perception', 'proficient'], ['stealth', 'proficient']], senses: '',
    traits: [trait('Audição e Olfato Aguçados', 'trait', 'Vantagem em Percepção que dependa de audição ou olfato.'), trait('Tática de Matilha', 'trait', 'Vantagem no ataque contra uma criatura se um aliado do lobo estiver a 1,5 m dela e não estiver incapacitado.')],
    attacks: [hit('Mordida', { hit: 4, dice: '2d4', dmg: 2, type: 'perfurante', text: 'Alvo faz salvaguarda de Força CD 11 ou cai.' })] },
  { key: 'panther', name: 'Pantera', size: 'Médio', cr: '1/4', ac: 12, hp: 13, speeds: { walk: 50, climb: 40 }, abs: [14, 15, 10, 3, 14, 7], skills: [['perception', 'proficient'], ['stealth', 'expertise']], senses: '',
    traits: [trait('Olfato Aguçado', 'trait', 'Vantagem em Percepção que dependa do olfato.'), trait('Bote', 'trait', 'Se andar 6 m em linha reta até uma criatura e acertá-la com a garra no mesmo turno, o alvo faz salvaguarda de Força CD 12 ou cai. Caído, a pantera pode morder como ação bônus.')],
    attacks: [hit('Mordida', { hit: 4, dice: '1d6', dmg: 2, type: 'perfurante' }), hit('Garra', { hit: 4, dice: '1d4', dmg: 2, type: 'cortante' })] },
  { key: 'pony', name: 'Pônei', size: 'Médio', cr: '1/8', ac: 10, hp: 11, speeds: { walk: 40 }, abs: [15, 10, 13, 2, 11, 7], senses: '', attacks: [hit('Cascos', { hit: 4, dice: '2d4', dmg: 2, type: 'contundente' })] },
  { key: 'ridinghorse', name: 'Cavalo de montaria', size: 'Grande', cr: '1/4', ac: 10, hp: 13, speeds: { walk: 60 }, abs: [16, 10, 12, 2, 11, 7], senses: '', attacks: [hit('Cascos', { hit: 5, dice: '2d4', dmg: 3, type: 'contundente' })] },
  { key: 'warhorse', name: 'Cavalo de guerra', size: 'Grande', cr: '1/2', ac: 11, hp: 19, speeds: { walk: 60 }, abs: [18, 12, 13, 2, 12, 7], senses: '',
    traits: [trait('Investida Pisoteadora', 'trait', 'Se andar 6 m em linha reta até uma criatura e acertá-la com os cascos no mesmo turno, o alvo faz salvaguarda de Força CD 14 ou cai. Caído, o cavalo pode atacar com os cascos como ação bônus.')],
    attacks: [hit('Cascos', { hit: 6, dice: '2d6', dmg: 4, type: 'contundente' })] },
  { key: 'camel', name: 'Camelo', size: 'Grande', cr: '1/8', ac: 9, hp: 15, speeds: { walk: 50 }, abs: [16, 8, 14, 2, 8, 5], senses: '', attacks: [hit('Mordida', { hit: 5, dice: '1d4', dmg: 3, type: 'contundente' })] },
  { key: 'elk', name: 'Alce', size: 'Grande', cr: '1/4', ac: 10, hp: 13, speeds: { walk: 50 }, abs: [16, 10, 12, 2, 10, 6], senses: '',
    traits: [trait('Investida', 'trait', 'Se andar 6 m em linha reta até uma criatura e acertá-la com a chifrada no mesmo turno, sofre +2d6 de dano e o alvo faz salvaguarda de Força CD 13 ou cai.')],
    attacks: [hit('Chifrada', { hit: 5, dice: '1d6', dmg: 3, type: 'contundente' }), hit('Cascos', { hit: 5, dice: '2d4', dmg: 3, type: 'contundente', text: 'Só contra criatura caída.' })] },
]

const BEAST_BY_KEY = new Map(BEASTS.map((b) => [b.key, b]))
export const beastsFor = (keys: readonly string[]): Beast[] => keys.map((k) => BEAST_BY_KEY.get(k)!).filter(Boolean)

function fromBeast(b: Beast, over: Partial<Companion>): Companion {
  const speeds = { walk: 0, fly: 0, swim: 0, climb: 0, burrow: 0, ...b.speeds }
  return blankCompanion({
    species: b.name, size: b.size, type: b.type ?? 'Besta', hp: b.hp, hp_max: b.hp, base_hp: b.hp, ac: b.ac, speeds, abilities: abs(b.abs),
    skills: (b.skills ?? []).map(([key, level]) => ({ key, level })), senses: b.senses, cr: b.cr,
    traits: (b.traits ?? []).map((t) => ({ ...t, id: newCompanionId('t') })), attacks: (b.attacks ?? []).map((a) => ({ ...a, id: newCompanionId('a') })), ...over,
  })
}

// ── Familiares ──────────────────────────────────────────

const FAMILIAR_FORMS = ['owl', 'cat', 'bat', 'raven', 'hawk', 'rat', 'weasel', 'frog', 'spider', 'lizard', 'octopus', 'seahorse', 'crab', 'fish', 'snake']

const familiarTraits = (): CompanionTrait[] => [
  trait('Espírito disfarçado', 'trait', 'É um espírito (feérico, ínfero ou celestial) na forma de um animal. Ao chegar a 0 PV desaparece, sem deixar corpo, e volta quando você conjura Convocar Familiar de novo.'),
  trait('Vínculo telepático', 'trait', 'Vocês se comunicam por telepatia a até 30 m (100 pés). Com uma ação, você vê e ouve pelos sentidos dele até o início do seu próximo turno.'),
  trait('Entregar magia de toque', 'reaction', 'Quando você conjura uma magia de alcance de toque, o familiar a entrega em vez de você, se estiver a até 30 m. Ele precisa estar ao alcance do alvo; se a magia exigir jogada de ataque, é ele quem a faz com o seu bônus.'),
  trait('Dispensar e reconvocar', 'action', 'Você o dispensa para uma bolsa dimensional ou o chama de volta como ação (aparece a até 9 m de você). Pode também dispensá-lo para sempre.'),
  trait('Não ataca', 'trait', 'O familiar de Convocar Familiar não pode atacar, mas faz as outras ações. Age na própria iniciativa.'),
]

// ── Pacto da Corrente (Bruxo) ───────────────────────────

const CHAIN: Beast[] = [
  { key: 'imp', name: 'Diabrete', size: 'Miúdo', type: 'Ínfero (diabo, metamorfo)', cr: '1', ac: 13, hp: 10, speeds: { walk: 20, fly: 40 }, abs: [6, 17, 13, 11, 12, 14],
    skills: [['deception', 'proficient'], ['insight', 'proficient'], ['persuasion', 'proficient'], ['stealth', 'proficient']], senses: 'visão no escuro 36 m (120 pés)',
    traits: [trait('Metamorfo', 'action', 'Vira um rato, um corvo ou uma aranha, ou volta à forma de diabrete. Mantém os números, mas só o voo do corvo ou a escalada da aranha valem na forma nova.'), trait('Visão do Diabo', 'trait', 'Escuridão mágica não atrapalha a visão no escuro dele.'), trait('Resistência a Magia', 'trait', 'Vantagem em salvaguardas contra magias e efeitos mágicos.'), trait('Invisibilidade', 'action', 'Fica invisível até atacar ou perder a concentração (como em magia).')],
    attacks: [hit('Ferrão (rabo)', { hit: 5, dice: '1d4', dmg: 3, type: 'perfurante', text: 'Salvaguarda de Constituição CD 11: falhando sofre 10 (3d6) de dano de veneno, ou metade se passar.' })] },
  { key: 'quasit', name: 'Quasit', size: 'Miúdo', type: 'Ínfero (demônio, metamorfo)', cr: '1', ac: 13, hp: 7, speeds: { walk: 40 }, abs: [5, 17, 10, 7, 10, 10], skills: [['stealth', 'proficient']], senses: 'visão no escuro 36 m (120 pés)',
    traits: [trait('Metamorfo', 'action', 'Vira um morcego, uma centopeia ou um sapo, ou volta à forma de quasit.'), trait('Resistência a Magia', 'trait', 'Vantagem em salvaguardas contra magias e efeitos mágicos.'), trait('Invisibilidade', 'action', 'Fica invisível até atacar ou perder a concentração.'), trait('Amedrontar', 'action', 'Uma criatura a 6 m que o quasit veja faz salvaguarda de Sabedoria CD 10 ou fica amedrontada por 1 minuto.', { uses_max: 1, recharge: 'long' })],
    attacks: [hit('Garras', { hit: 4, dice: '1d4', dmg: 3, type: 'perfurante', text: 'Salvaguarda de Constituição CD 10 ou sofre 5 (2d4) de dano de veneno e fica envenenado por 1 minuto.' })] },
  { key: 'pseudodragon', name: 'Pseudodragão', size: 'Miúdo', type: 'Dragão', cr: '1/4', ac: 13, hp: 7, speeds: { walk: 15, fly: 60 }, abs: [6, 15, 13, 10, 12, 10], skills: [['perception', 'proficient'], ['stealth', 'proficient']], senses: 'percepção às cegas 3 m, visão no escuro 18 m',
    traits: [trait('Sentidos Aguçados', 'trait', 'Vantagem em Percepção que dependa de visão, audição ou olfato.'), trait('Resistência a Magia', 'trait', 'Vantagem em salvaguardas contra magias e efeitos mágicos.'), trait('Telepatia Limitada', 'trait', 'Comunica ideias e emoções simples por telepatia a até 30 m com qualquer criatura que entenda um idioma.')],
    attacks: [hit('Mordida', { hit: 4, dice: '1d4', dmg: 2, type: 'perfurante' }), hit('Ferrão', { hit: 4, dice: '1d4', dmg: 2, type: 'perfurante', text: 'Salvaguarda de Constituição CD 11 ou fica envenenado por 1 hora (se falhar por 5 ou mais, fica inconsciente enquanto envenenado).' })] },
  { key: 'sprite', name: 'Fadinha (sprite)', size: 'Miúdo', type: 'Feérico', cr: '1/4', ac: 15, hp: 2, speeds: { walk: 10, fly: 40 }, abs: [3, 18, 10, 14, 13, 11], skills: [['perception', 'proficient'], ['stealth', 'expertise']], senses: '',
    traits: [trait('Visão do Coração', 'action', 'Toca uma criatura e sabe seu estado emocional e tendência. Salvaguarda de Carisma CD 10 evita, se ela for muito diferente.'), trait('Invisibilidade', 'action', 'Fica invisível até atacar ou perder a concentração.')],
    attacks: [hit('Espada longa', { hit: 2, dice: '', dmg: 1, type: 'cortante' }), hit('Arco curto', { kind: 'ranged', reach_ft: 0, range_ft: 40, range_long_ft: 160, hit: 6, dice: '', dmg: 1, type: 'perfurante', text: 'Salvaguarda de Constituição CD 10 ou fica envenenado por 1 minuto (inconsciente, se falhar por 5 ou mais).' })] },
]

const chainTraits = (): CompanionTrait[] => [
  trait('Vínculo da Corrente', 'trait', 'Familiar do Pacto da Corrente: você o convoca com a magia Convocar Familiar, e ele pode ter uma destas formas especiais. Ao contrário dos outros, pode atacar. Ao atacar, você abre mão de um dos seus ataques na ação de Atacar.'),
  trait('Vínculo telepático', 'trait', 'Vocês se comunicam por telepatia a até 30 m (100 pés). Com uma ação, você vê e ouve pelos sentidos dele até o início do seu próximo turno.'),
  trait('Entregar magia de toque', 'reaction', 'Entrega uma magia de toque sua a até 30 m, usando o alcance dele.'),
]

// ── Os modelos ──────────────────────────────────────────

const BEAST_TASHA: Record<'land' | 'sea' | 'sky', { name: string; size: string; abs: Abs; speeds: Partial<Record<SpeedKey, number>>; senses: string; attack: CompanionAttack; traits: CompanionTrait[]; blurb: string }> = {
  land: {
    name: 'Fera da Terra', size: 'Médio', abs: [14, 14, 15, 8, 14, 11], speeds: { walk: 40, climb: 40 }, senses: 'visão no escuro 18 m (60 pés)',
    attack: hit('Mordida/Garra (Maul)', { hit_mode: 'spell', dice: '1d8', dmg: 2, dmg_pb: true, type: 'perfurante' }),
    traits: [trait('Investida', 'trait', 'Se andar 6 m em linha reta até um alvo e acertá-lo com o ataque no mesmo turno, causa +1d6 de dano perfurante. Sendo criatura, o alvo faz salvaguarda de Força contra a sua CD de magia ou cai.')],
    blurb: 'Besta terrestre veloz: 40 pés, escala, investida.',
  },
  sea: {
    name: 'Fera do Mar', size: 'Médio', abs: [14, 14, 14, 8, 14, 11], speeds: { walk: 5, swim: 60 }, senses: 'visão no escuro 18 m (60 pés)',
    attack: hit('Golpe Aprisionador', { hit_mode: 'spell', dice: '1d6', dmg: 2, dmg_pb: true, type: 'contundente', text: 'O alvo fica agarrado (CD para escapar = a sua CD de magia). Enquanto agarra, a fera não pode atacar outro alvo.' }),
    traits: [trait('Anfíbia', 'trait', 'Respira ar e água.')],
    blurb: 'Besta aquática: nada a 60 pés e agarra.',
  },
  sky: {
    name: 'Fera do Céu', size: 'Pequeno', abs: [6, 16, 13, 8, 14, 11], speeds: { walk: 10, fly: 60 }, senses: 'visão no escuro 18 m (60 pés)',
    attack: hit('Retalhar', { hit_mode: 'spell', dice: '1d4', dmg: 3, dmg_pb: true, type: 'cortante' }),
    traits: [trait('Voo Rasante', 'trait', 'Não provoca ataque de oportunidade quando voa para fora do alcance de um inimigo.')],
    blurb: 'Besta alada: voa a 60 pés e não sofre ataque de oportunidade.',
  },
}

function primal(form: 'land' | 'sea' | 'sky'): Companion {
  const t = BEAST_TASHA[form]
  return blankCompanion({
    kind: 'besta', rule: 'primal', auto: true, template: `primal:${form}`, species: t.name, size: t.size, type: 'Besta', form,
    abilities: abs(t.abs), speeds: { walk: 0, fly: 0, swim: 0, climb: 0, burrow: 0, ...t.speeds }, senses: t.senses, languages: 'entende os idiomas que você fala',
    pb_checks: true, hp: 1, hp_max: 1,
    attacks: [{ ...t.attack, id: newCompanionId('a') }],
    traits: [
      trait('Vínculo Primal', 'trait', 'Soma a sua proficiência a qualquer teste de atributo ou salvaguarda que a fera fizer.'),
      ...t.traits,
      trait('Obedece a você', 'trait', 'Age na sua iniciativa, logo depois de você. Move-se por conta própria e, sem comando, só esquiva. Com uma ação bônus sua ele ataca, corre, solta, ajuda ou esquiva (ou faz outra ação). Se você ficar incapacitado, age sozinho.'),
      trait('Treinamento Excepcional (nível 7)', 'trait', 'A fera pode correr, soltar-se, esquivar ou ajudar no turno dela sem comando seu, e os ataques dela contam como mágicos.'),
    ],
    notes: 'Companheiro Primal do Mestre das Feras (Tasha). Se a fera morrer, você obtém outra passando 8 horas criando um vínculo mágico com uma besta que não seja hostil a você.',
  })
}

function summonedConstruct(material: 'clay' | 'metal' | 'stone'): Companion {
  const name = { clay: 'Constructo de Argila', metal: 'Constructo de Metal', stone: 'Constructo de Pedra' }[material]
  const trait2 = {
    clay: trait('Chicotada Furiosa', 'reaction', 'Quando sofre dano, ataca com uma pancada uma criatura aleatória a 1,5 m. Sem alvo ao alcance, anda até metade do deslocamento na direção de um inimigo, sem provocar ataque de oportunidade.'),
    metal: trait('Corpo Escaldante', 'trait', 'Uma criatura que o toca ou o acerta com ataque corpo a corpo a 1,5 m sofre 1d10 de dano de fogo.'),
    stone: trait('Letargia de Pedra', 'trait', 'Quando uma criatura que o constructo veja começa o turno a até 3 m dele, ele pode forçá-la a uma salvaguarda de Sabedoria contra a sua CD de magia: se falhar, ela não pode usar reações e tem o deslocamento reduzido à metade até o início do próximo turno dela.'),
  }[material]
  return blankCompanion({
    kind: 'invocado', rule: 'construct_spirit', auto: true, template: `invoked:construct:${material}`, species: name, size: 'Médio', type: 'Constructo', form: material, slot_level: 4,
    abilities: abs([18, 10, 18, 14, 11, 5]), speeds: { walk: 30, fly: 0, swim: 0, climb: 0, burrow: 0 }, senses: 'visão no escuro 18 m (60 pés)',
    resistances: 'veneno', condition_immunities: 'enfeitiçado, exaustão, amedrontado, incapacitado, paralisado, petrificado, envenenado', languages: 'entende os idiomas que você fala', hp: 40, hp_max: 40,
    attacks: [hit('Pancada', { hit_mode: 'spell', dice: '1d8', dmg: 4, type: 'contundente', text: 'O dano soma o nível do espaço de magia usado. O constructo faz metade do nível do espaço (arredondado para baixo) de ataques por ação.' })],
    traits: [
      trait('Invocação por magia', 'trait', 'Invocar Constructo (Tasha, nível 4): exige concentração, dura até 1 hora. Age na sua iniciativa, logo depois de você. Obedece a você; sem comando, só esquiva. Quando você perde a concentração, ele desaparece.'),
      trait2,
    ],
  })
}

function cannon(form: 'flamethrower' | 'ballista' | 'protector'): Companion {
  const names = { flamethrower: 'Canhão: Lança-chamas', ballista: 'Canhão: Balista de Energia', protector: 'Canhão: Protetor' }
  const attacks: CompanionAttack[] = {
    flamethrower: [hit('Lança-chamas', { reach_ft: 15, save: 'dexterity', dice: '2d8', dmg: 0, type: 'fogo', text: 'Cone de 4,5 m (15 pés) à frente do canhão. Passando na salvaguarda, o alvo sofre metade. Acende objetos inflamáveis que ninguém usa nem carrega.' })],
    ballista: [hit('Balista de Energia', { kind: 'ranged', reach_ft: 0, range_ft: 120, range_long_ft: 0, hit_mode: 'spell', dice: '2d8', dmg: 0, type: 'energia', text: 'Ataque de magia à distância feito do canhão. Acertando, empurra a criatura 1,5 m para longe.' })],
    protector: [],
  }[form]
  const protector = form === 'protector' ? [trait('Protetor', 'action', 'Libera uma rajada de energia positiva: o canhão e cada criatura que você escolher a até 3 m dele ganham PV temporários iguais a 1d8 + o seu modificador de Inteligência (mínimo +1).')] : []
  return blankCompanion({
    kind: 'constructo', rule: 'cannon', auto: true, template: `cannon:${form}`, species: names[form], size: 'Pequeno', type: 'Objeto mágico', form,
    abilities: abs([10, 10, 10, 10, 10, 10]), speeds: { walk: 15, fly: 0, swim: 0, climb: 0, burrow: 0 }, immunities: 'veneno, psíquico', hp: 5, hp_max: 5,
    attacks,
    traits: [
      ...protector,
      trait('Ativar', 'bonus', 'Com uma ação bônus no seu turno, você manda o canhão se mover até 4,5 m (15 pés) e ativá-lo. Ele só age quando você o ativa.'),
      trait('Duração', 'trait', 'Dura 1 hora, até chegar a 0 PV, ou até você dispensá-lo com uma ação. Você o cria com uma ação, com as ferramentas de ferreiro, de funileiro ou de marceneiro, e pode ter um por vez (dois a partir do nível 15, com Posição Fortificada).'),
      trait('Canhão Explosivo (nível 9)', 'trait', 'O dano de Lança-chamas e de Balista soma 1d8 (já considerado no automático). Com uma ação, você o detona a até 18 m: criaturas a 6 m dele fazem salvaguarda de Destreza contra a sua CD de magia e sofrem 3d8 de dano de energia (metade se passar). O canhão é destruído.'),
    ],
    notes: 'Artificeiro Artilheiro. O automático usa o nível de Artificeiro (digite acima se a ficha não tiver a classe).',
  })
}

export const PRESETS: CompanionPreset[] = [
  // Constructos
  {
    key: 'steel', label: 'Defensor de Aço', group: 'constructo', source: 'Artificeiro · Ferreiro de Batalha', blurb: 'Constructo leal e resistente: ataca com energia, desvia golpes e se repara.',
    build: () => blankCompanion({
      kind: 'constructo', rule: 'steel', auto: true, template: 'steel', species: 'Defensor de Aço', size: 'Médio', type: 'Constructo', hp: 1, hp_max: 1,
      abilities: abs([14, 12, 14, 4, 10, 6]), save_prof: ['dexterity', 'constitution'], speeds: { walk: 40, fly: 0, swim: 0, climb: 0, burrow: 0 },
      skills: [{ key: 'athletics', level: 'proficient' }, { key: 'perception', level: 'expertise' }],
      senses: 'visão no escuro 18 m (60 pés)', immunities: 'veneno', condition_immunities: 'enfeitiçado, exaustão, envenenado', languages: 'entende os idiomas que você fala',
      attacks: [hit('Golpe Reforçado por Energia', { hit_mode: 'spell', dice: '1d8', dmg_pb: true, type: 'energia' })],
      traits: [
        trait('Vigilante', 'trait', 'Não pode ser surpreendido.'),
        trait('Obedece a você', 'trait', 'Age na sua iniciativa, logo depois de você. Move-se por conta própria e obedece a comandos verbais sem custar ação sua. Sem comando, usa a ação de esquivar. Se você estiver incapacitado, age sozinho.'),
        trait('Reparar', 'action', 'Os mecanismos mágicos restauram 2d8 + proficiência PV de si mesmo ou de um constructo ou objeto a 1,5 m.', { uses_max: 3, recharge: 'long' }),
        trait('Desviar Ataque', 'reaction', 'Impõe desvantagem na jogada de ataque de uma criatura a 1,5 m do defensor, se o alvo não for o próprio defensor. No nível 15 (Defensor Aprimorado) o atacante ainda sofre 1d4 + Int de dano de energia.'),
        trait('Choque Arcano (nível 9)', 'trait', 'Uma vez por turno, ao acertar com o Golpe do defensor (ou com arma mágica sua), você causa 2d6 de dano de energia extra ou cura 2d6 PV de uma criatura a 9 m. Usos = Int, por descanso longo. No nível 15 sobe para 4d6.'),
        trait('Refazer', 'action', 'Se morreu há menos de 1 hora, você o revive com as ferramentas de ferreiro, a até 1,5 m e gastando um espaço de magia de 1º nível ou maior. Volta à vida em 1 minuto com todos os PV.'),
      ],
      notes: 'Artificeiro Ferreiro de Batalha. A CA sobe de 15 para 17 no nível 15 (Defensor Aprimorado).',
    }),
  },
  {
    key: 'homunculus', label: 'Servo Homúnculo', group: 'constructo', source: 'Artificeiro · infusão', blurb: 'Constructo miúdo que voa, entrega magias de toque e dispara energia.',
    build: () => blankCompanion({
      kind: 'constructo', rule: 'homunculus', auto: true, template: 'homunculus', species: 'Servo Homúnculo', size: 'Miúdo', type: 'Constructo', hp: 1, hp_max: 1,
      abilities: abs([4, 15, 12, 10, 10, 7]), save_prof: ['dexterity'], speeds: { walk: 20, fly: 30, swim: 0, climb: 0, burrow: 0 },
      skills: [{ key: 'perception', level: 'expertise' }, { key: 'stealth', level: 'expertise' }],
      senses: 'visão no escuro 18 m (60 pés)', immunities: 'veneno', condition_immunities: 'exaustão, envenenado', languages: 'entende os idiomas que você fala',
      attacks: [hit('Golpe de Energia', { kind: 'ranged', reach_ft: 0, range_ft: 30, hit_mode: 'spell', dice: '1d4', dmg_pb: true, type: 'energia' })],
      traits: [
        trait('Evasão', 'trait', 'Quando um efeito pede salvaguarda de Destreza para reduzir o dano à metade, não sofre dano se passar e só metade se falhar.'),
        trait('Obedece a você', 'trait', 'Age na sua iniciativa, logo depois de você. Move-se por conta própria e obedece a comandos verbais. Sem comando, esquiva.'),
        trait('Canalizar Magia', 'reaction', 'Entrega uma magia de alcance de toque que você conjurou, se estiver a até 36 m (120 pés) de você.'),
      ],
      notes: 'Infusão Servo Homúnculo (Artificeiro 2+). Você cria um servo com uma pedra preciosa de 100 po e a infusão, e só pode ter um. Os PV dele dependem do seu nível de Artificeiro.',
    }),
  },
  { key: 'cannon:flamethrower', label: 'Canhão Místico: Lança-chamas', group: 'constructo', source: 'Artificeiro · Artilheiro', blurb: 'Cone de fogo de 4,5 m com salvaguarda de Destreza.', build: () => cannon('flamethrower') },
  { key: 'cannon:ballista', label: 'Canhão Místico: Balista de Energia', group: 'constructo', source: 'Artificeiro · Artilheiro', blurb: 'Ataque à distância a 36 m que empurra.', build: () => cannon('ballista') },
  { key: 'cannon:protector', label: 'Canhão Místico: Protetor', group: 'constructo', source: 'Artificeiro · Artilheiro', blurb: 'PV temporários para você e aliados.', build: () => cannon('protector') },
  { key: 'invoked:construct:clay', label: 'Constructo Invocado (Argila)', group: 'constructo', source: 'Magia · Invocar Constructo', blurb: 'Espírito de argila: revida com pancadas quando é ferido.', build: () => summonedConstruct('clay') },
  { key: 'invoked:construct:metal', label: 'Constructo Invocado (Metal)', group: 'constructo', source: 'Magia · Invocar Constructo', blurb: 'Espírito de metal: queima quem o toca.', build: () => summonedConstruct('metal') },
  { key: 'invoked:construct:stone', label: 'Constructo Invocado (Pedra)', group: 'constructo', source: 'Magia · Invocar Constructo', blurb: 'Espírito de pedra: deixa vizinhos sem reação e lentos.', build: () => summonedConstruct('stone') },

  // Companheiros animais
  { key: 'primal:land', label: 'Fera da Terra', group: 'besta', source: 'Patrulheiro · Mestre das Feras', blurb: BEAST_TASHA.land.blurb, build: () => primal('land') },
  { key: 'primal:sea', label: 'Fera do Mar', group: 'besta', source: 'Patrulheiro · Mestre das Feras', blurb: BEAST_TASHA.sea.blurb, build: () => primal('sea') },
  { key: 'primal:sky', label: 'Fera do Céu', group: 'besta', source: 'Patrulheiro · Mestre das Feras', blurb: BEAST_TASHA.sky.blurb, build: () => primal('sky') },
  ...(['wolf', 'panther', 'mastiff'] as const).map((k): CompanionPreset => ({
    key: `ranger:${k}`, label: `Companheiro do Patrulheiro: ${BEAST_BY_KEY.get(k)!.name}`, group: 'besta', source: 'Patrulheiro · Mestre das Feras (livro-base)',
    blurb: 'Besta de ND 1/4 ou menos: soma a sua proficiência à CA, ao ataque e ao dano; PV = o maior entre os dela e 4 × seu nível.',
    build: () => fromBeast(BEAST_BY_KEY.get(k)!, {
      kind: 'besta', rule: 'ranger', auto: true, template: `ranger:${k}`, pb_checks: false,
      save_prof: [], languages: '',
      attacks: BEAST_BY_KEY.get(k)!.attacks!.map((a) => ({ ...a, id: newCompanionId('a'), hit_pb: true, dmg_pb: true })),
      traits: [
        ...BEAST_BY_KEY.get(k)!.traits!.map((t) => ({ ...t, id: newCompanionId('t') })),
        trait('Obedece a você', 'trait', 'Age na sua iniciativa. Move-se por conta própria e, sem comando, só esquiva. Você usa uma ação sua para mandá-lo atacar (Companheiro do Patrulheiro); a partir do nível 11 ele ataca duas vezes.'),
      ],
      notes: 'Companheiro do Patrulheiro (livro-base). Soma a sua proficiência também às salvaguardas e perícias em que ele já tem proficiência.',
    }),
  })),
  {
    key: 'wildfire', label: 'Espírito de Fogo Selvagem', group: 'besta', source: 'Druida · Círculo do Fogo Selvagem', blurb: 'Elemental miúdo que voa, queima de longe e teletransporta aliados.',
    build: () => blankCompanion({
      kind: 'besta', rule: 'wildfire', auto: true, template: 'wildfire', species: 'Espírito de Fogo Selvagem', size: 'Pequeno', type: 'Elemental', hp: 1, hp_max: 1,
      abilities: abs([10, 14, 14, 13, 15, 11]), speeds: { walk: 30, fly: 30, swim: 0, climb: 0, burrow: 0 }, senses: 'visão no escuro 18 m (60 pés)',
      resistances: 'fogo', condition_immunities: 'enfeitiçado, amedrontado, agarrado, caído, contido', languages: 'entende os idiomas que você fala',
      attacks: [hit('Semente de Chama', { kind: 'ranged', reach_ft: 0, range_ft: 60, hit_mode: 'spell', dice: '1d6', dmg_pb: true, type: 'fogo' })],
      traits: [
        trait('Obedece a você', 'trait', 'Age na sua iniciativa, logo depois de você. Move-se por conta própria e, sem comando, esquiva. Se você estiver incapacitado, age sozinho.'),
        trait('Teletransporte Flamejante', 'action', 'Teleporta a si mesmo e as criaturas dispostas que você escolher a até 1,5 m dele para espaços livres a até 4,5 m. Criaturas a 1,5 m do espírito antes do teletransporte fazem salvaguarda de Destreza contra a sua CD de magia ou sofrem 1d6 + proficiência de dano de fogo.', { uses_max: 0 }),
      ],
      notes: 'Druida do Círculo do Fogo Selvagem (nível 2). Você o invoca com uma ação, gastando um uso de Forma Selvagem. Se ele morrer, é só invocar de novo do mesmo jeito.',
    }),
  },

  // Familiares
  ...FAMILIAR_FORMS.map((k): CompanionPreset => ({
    key: `familiar:${k}`, label: BEAST_BY_KEY.get(k)!.name, group: 'familiar', source: 'Magia · Convocar Familiar',
    blurb: `Familiar na forma de ${BEAST_BY_KEY.get(k)!.name.toLowerCase()}: PV ${BEAST_BY_KEY.get(k)!.hp}, CA ${BEAST_BY_KEY.get(k)!.ac}.`,
    build: () => fromBeast(BEAST_BY_KEY.get(k)!, { kind: 'familiar', template: `familiar:${k}`, rule: 'manual', auto: false, pb: 2, attacks: [], traits: [...(BEAST_BY_KEY.get(k)!.traits ?? []).map((t) => ({ ...t, id: newCompanionId('t') })), ...familiarTraits()] }),
  })),
  ...CHAIN.map((b): CompanionPreset => ({
    key: `chain:${b.key}`, label: `${b.name} (Pacto da Corrente)`, group: 'familiar', source: 'Bruxo · Pacto da Corrente',
    blurb: `Forma especial do familiar do Bruxo: ${b.name.toLowerCase()}, que pode atacar.`,
    build: () => fromBeast(b, {
      kind: 'familiar', template: `chain:${b.key}`, rule: 'manual', auto: false, pb: 2,
      resistances: b.key === 'imp' ? 'frio; contundente, perfurante e cortante de armas não mágicas ou não prateadas' : b.key === 'quasit' ? 'frio, fogo, relâmpago; ataques de armas não mágicas' : '',
      immunities: b.key === 'imp' ? 'fogo, veneno' : b.key === 'quasit' ? 'veneno' : '',
      condition_immunities: b.key === 'imp' || b.key === 'quasit' ? 'envenenado' : '',
      traits: [...(b.traits ?? []).map((t) => ({ ...t, id: newCompanionId('t') })), ...chainTraits()],
    }),
  })),

  // Montarias
  ...(['warhorse', 'ridinghorse', 'pony', 'camel', 'elk', 'mastiff'] as const).map((k): CompanionPreset => ({
    key: `steed:${k}`, label: `${BEAST_BY_KEY.get(k)!.name} (Corcel Convocado)`, group: 'montaria', source: 'Magia · Convocar Corcel / Paladino',
    blurb: `Corcel espiritual: ${BEAST_BY_KEY.get(k)!.name.toLowerCase()}, com Inteligência 6, telepatia e magias compartilhadas.`,
    build: () => {
      const b = BEAST_BY_KEY.get(k)!
      return fromBeast({ ...b, abs: [b.abs[0], b.abs[1], b.abs[2], 6, b.abs[4], b.abs[5]] }, {
        kind: 'montaria', template: `steed:${k}`, rule: 'manual', auto: false, type: 'Celestial, feérico ou ínfero', languages: 'entende o que você fala',
        traits: [
          ...(b.traits ?? []).map((t) => ({ ...t, id: newCompanionId('t') })),
          trait('Vínculo telepático', 'trait', 'Vocês se comunicam por telepatia enquanto estiverem na mesma dimensão.'),
          trait('Magias compartilhadas', 'trait', 'Quando você conjura uma magia em si mesmo, ela também afeta o corcel se ele estiver a até 1,5 m de você.'),
          trait('Desaparece', 'trait', 'Ao chegar a 0 PV, o corcel desaparece sem deixar corpo. Você pode chamá-lo de novo gastando a magia; ele volta com todos os PV.'),
        ],
      })
    },
  })),
  ...(['ridinghorse', 'warhorse', 'pony', 'camel', 'elk'] as const).map((k): CompanionPreset => ({
    key: `mount:${k}`, label: `${BEAST_BY_KEY.get(k)!.name} (montaria comum)`, group: 'montaria', source: 'Equipamento · animal de montaria',
    blurb: `Animal comum comprado ou treinado: ${BEAST_BY_KEY.get(k)!.name.toLowerCase()}. Age como montaria obediente.`,
    build: () => fromBeast(BEAST_BY_KEY.get(k)!, { kind: 'montaria', template: `mount:${k}`, rule: 'manual', auto: false }),
  })),

  // Pets
  ...(['mastiff', 'cat', 'rat', 'hawk', 'raven', 'weasel', 'snake', 'lizard', 'frog', 'wolf', 'panther'] as const).map((k): CompanionPreset => ({
    key: `pet:${k}`, label: `Pet: ${BEAST_BY_KEY.get(k)!.name}`, group: 'pet', source: 'Animal comum', blurb: `Um animal comum que anda com você (${BEAST_BY_KEY.get(k)!.name.toLowerCase()}). Sem magia: PV e CA de livro.`,
    build: () => fromBeast(BEAST_BY_KEY.get(k)!, { kind: 'pet', template: `pet:${k}`, rule: 'manual', auto: false }),
  })),
]

/** Modelos em branco: pra montar algo à mão (criatura de livro, homebrew ou o que o mestre mandar). */
export const BLANKS: { kind: CompanionKind; label: string; blurb: string }[] = [
  { kind: 'constructo', label: 'Constructo em branco', blurb: 'Gólem, autômato ou engenhoca: constructo com imunidades de veneno e exaustão.' },
  { kind: 'familiar', label: 'Familiar em branco', blurb: 'Outra forma de familiar.' },
  { kind: 'besta', label: 'Companheiro animal em branco', blurb: 'Besta fiel de outra regra.' },
  { kind: 'montaria', label: 'Montaria em branco', blurb: 'Cavalo, grifo, lagarto gigante...' },
  { kind: 'invocado', label: 'Criatura invocada em branco', blurb: 'Espírito ou criatura que uma magia chamou.' },
  { kind: 'pet', label: 'Pet em branco', blurb: 'Um bichinho qualquer.' },
  { kind: 'outro', label: 'Em branco', blurb: 'Criatura sem tipo.' },
]

export function blankOfKind(kind: CompanionKind): Companion {
  return blankCompanion({
    kind, template: '', rule: 'manual', auto: false,
    ...(kind === 'constructo' ? {
      type: 'Constructo', immunities: 'veneno', condition_immunities: 'exaustão, envenenado',
      traits: [trait('Obedece a você', 'trait', 'Age na sua iniciativa e obedece a comandos. Sem comando, esquiva.')],
    } : {}),
    ...(kind === 'invocado' ? { traits: [trait('Concentração', 'trait', 'Dura enquanto você mantém a concentração na magia.')] } : {}),
  })
}

/** Cria o companheiro de um modelo (com id novo). */
export function companionFromPreset(key: string): Companion | null {
  const p = PRESETS.find((x) => x.key === key)
  if (!p) return null
  const c = p.build()
  return { ...c, id: newCompanionId(), traits: c.traits.map((t) => ({ ...t, id: newCompanionId('t') })), attacks: c.attacks.map((a) => ({ ...a, id: newCompanionId('a') })) }
}

/** Os ataques do modelo, pra quando o jogador volta ao automático depois de ter editado os números. */
export function presetAttacks(template: string): CompanionAttack[] | null {
  const p = PRESETS.find((x) => x.key === template)
  return p ? p.build().attacks : null
}

