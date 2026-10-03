// ────────────────────────────────────────────────────────
// Tipos — Ficha D&D 5e
// ────────────────────────────────────────────────────────

export interface AbilityScores {
  for: number; des: number; con: number
  int: number; sab: number; car: number
}

export type ProficiencyLevel = 'none' | 'proficient' | 'expertise'

export interface Skill {
  id: string
  name: string
  ability: keyof AbilityScores
  proficiency: ProficiencyLevel
}

export interface HitPoints {
  current: number
  max: number
  temp: number
}

export interface DeathSaves {
  successes: number
  failures: number
}

export interface AttackEntry {
  id: string
  name: string
  bonus: number
  damage: string
  damageType: string
  properties: string[]
}

export interface SpellSlots {
  [level: number]: { total: number; used: number }
}

export interface SpellEntry {
  id: string
  name: string
  level: number
  school: string
  castingTime: string
  range: string
  duration: string
  concentration: boolean
  ritual: boolean
  description: string
  prepared: boolean
}

export interface InventoryItem {
  id: string
  name: string
  quantity: number
  weight: number
  description: string
  equipped: boolean
}

export interface Currency {
  cp: number; pp: number; pe: number; po: number; pl: number
}

export interface DndCharacter {
  // Identidade
  id: string
  name: string
  class: string
  subclass: string
  level: number
  species: string
  background: string
  alignment: string
  playerName: string
  experiencePoints: number

  // Atributos base
  abilities: AbilityScores

  // Combate
  armorClass: number
  initiative: number
  speed: number
  hitPoints: HitPoints
  hitDice: string
  deathSaves: DeathSaves
  inspiration: boolean

  // Proficiências
  proficiencyBonus: number
  savingThrows: Record<keyof AbilityScores, ProficiencyLevel>
  skills: Skill[]

  // Ataques
  attacks: AttackEntry[]

  // Magias
  spellcastingAbility: keyof AbilityScores | null
  spellSaveDC: number
  spellAttackBonus: number
  spellSlots: SpellSlots
  spells: SpellEntry[]

  // Inventário
  inventory: InventoryItem[]
  currency: Currency
  carryingCapacity: number

  // Traços
  personalityTraits: string
  ideals: string
  bonds: string
  flaws: string
  features: string[]
  proficienciesText: string
  languages: string[]
  toolProficiencies: string[]

  // Anotações
  backstory: string
  appearance: string
  notes: string

  // Condições ativas
  conditions: string[]
}

// ────────────────────────────────────────────────────────
// Dados mock — Kael Thorn, Guerreiro/Campeão nível 5
// ────────────────────────────────────────────────────────

export const MOCK_CHARACTER: DndCharacter = {
  id: 'mock-kael-thorn',
  name: 'Kael Thorn',
  class: 'Guerreiro',
  subclass: 'Campeão',
  level: 5,
  species: 'Humano',
  background: 'Soldado',
  alignment: 'Neutro e Bom',
  playerName: 'Francisco Bento Neto',
  experiencePoints: 6500,

  abilities: {
    for: 18,
    des: 14,
    con: 16,
    int: 10,
    sab: 12,
    car: 8,
  },

  armorClass: 18,
  initiative: 2,
  speed: 9,
  hitPoints: { current: 42, max: 52, temp: 0 },
  hitDice: '5d10',
  deathSaves: { successes: 0, failures: 0 },
  inspiration: false,

  proficiencyBonus: 3,

  savingThrows: {
    for: 'proficient',
    des: 'none',
    con: 'proficient',
    int: 'none',
    sab: 'none',
    car: 'none',
  },

  skills: [
    { id: 'acrobatics',     name: 'Acrobacia',       ability: 'des', proficiency: 'none' },
    { id: 'animal',         name: 'Adestrar Animais', ability: 'sab', proficiency: 'none' },
    { id: 'arcana',         name: 'Arcanismo',        ability: 'int', proficiency: 'none' },
    { id: 'athletics',      name: 'Atletismo',        ability: 'for', proficiency: 'proficient' },
    { id: 'deception',      name: 'Enganação',        ability: 'car', proficiency: 'none' },
    { id: 'history',        name: 'História',         ability: 'int', proficiency: 'none' },
    { id: 'insight',        name: 'Intuição',         ability: 'sab', proficiency: 'none' },
    { id: 'intimidation',   name: 'Intimidação',      ability: 'car', proficiency: 'proficient' },
    { id: 'investigation',  name: 'Investigação',     ability: 'int', proficiency: 'none' },
    { id: 'medicine',       name: 'Medicina',         ability: 'sab', proficiency: 'none' },
    { id: 'nature',         name: 'Natureza',         ability: 'int', proficiency: 'none' },
    { id: 'perception',     name: 'Percepção',        ability: 'sab', proficiency: 'proficient' },
    { id: 'performance',    name: 'Atuação',          ability: 'car', proficiency: 'none' },
    { id: 'persuasion',     name: 'Persuasão',        ability: 'car', proficiency: 'none' },
    { id: 'religion',       name: 'Religião',         ability: 'int', proficiency: 'none' },
    { id: 'sleight',        name: 'Prestidigitação',  ability: 'des', proficiency: 'none' },
    { id: 'stealth',        name: 'Furtividade',      ability: 'des', proficiency: 'none' },
    { id: 'survival',       name: 'Sobrevivência',    ability: 'sab', proficiency: 'proficient' },
  ],

  attacks: [
    {
      id: 'longsword',
      name: 'Espada Longa +1',
      bonus: 8,
      damage: '1d8+5',
      damageType: 'cortante',
      properties: ['versátil (1d10)', 'mágica'],
    },
    {
      id: 'handaxe',
      name: 'Machado de Mão',
      bonus: 7,
      damage: '1d6+4',
      damageType: 'cortante',
      properties: ['arremesso (6/18m)', 'leve'],
    },
    {
      id: 'crossbow',
      name: 'Besta Leve',
      bonus: 5,
      damage: '1d8+2',
      damageType: 'perfurante',
      properties: ['munição (24/96m)', 'recarga'],
    },
  ],

  spellcastingAbility: null,
  spellSaveDC: 0,
  spellAttackBonus: 0,
  spellSlots: {},
  spells: [],

  inventory: [
    { id: 'longsword-item', name: 'Espada Longa +1',    quantity: 1, weight: 1.5, description: 'Arma mágica forjada pelos anões de Ironpeak.', equipped: true  },
    { id: 'handaxe-item',   name: 'Machado de Mão',     quantity: 2, weight: 1,   description: '',                                              equipped: true  },
    { id: 'crossbow-item',  name: 'Besta Leve',         quantity: 1, weight: 2.5, description: '',                                              equipped: false },
    { id: 'bolts',          name: 'Virotes (20)',        quantity: 1, weight: 0.75,description: '',                                              equipped: false },
    { id: 'chainmail',      name: 'Cota de Malha +1',   quantity: 1, weight: 27.5,description: 'CA base 16, mais o bônus mágico.',               equipped: true  },
    { id: 'shield',         name: 'Escudo',             quantity: 1, weight: 3,   description: '',                                              equipped: true  },
    { id: 'healpotion',     name: 'Poção de Cura',      quantity: 2, weight: 0.25,description: 'Recupera 2d4+2 PV.',                            equipped: false },
    { id: 'rope',           name: 'Corda de Cânhamo',   quantity: 1, weight: 5,   description: '15 metros.',                                    equipped: false },
    { id: 'torches',        name: 'Tocha',              quantity: 5, weight: 0.5, description: '',                                              equipped: false },
    { id: 'rations',        name: 'Ração (dias)',        quantity: 5, weight: 1,   description: '',                                              equipped: false },
  ],

  currency: { cp: 15, pp: 0, pe: 0, po: 47, pl: 1 },
  carryingCapacity: 120,

  personalityTraits:
    'Fico de olho na saída de qualquer sala que entro. Sou especialmente cuidadoso com estranhos, pois já traí a confiança de pessoas que conhecia.',
  ideals:
    'Maior Bem. Nossas vidas não são nada diante da perpetuidade. Meu propósito é proteger o que precisa ser protegido.',
  bonds:
    'Alguém salvou minha vida no campo de batalha. Até hoje devo a ele uma dívida que talvez nunca consiga pagar.',
  flaws:
    'O herói massacrado de uma batalha épica, eu tenho dificuldade de deixar para trás minhas cicatrizes de guerra.',

  features: [
    'Estilo de Combate: Luta (bônus de +2 nas jogadas de ataque com armas de uma mão)',
    'Surto de Ação (2/descanso curto)',
    'Segundo Ataque (ataca duas vezes com Ataque)',
    'Campeão: Golpe Crítico (acerta crítico em 19 ou 20)',
    'Estilo de Combate extra: Grande Arma (re-rola 1s e 2s no dano de armas de duas mãos)',
    'Ataque Extra (2)',
  ],

  proficienciesText:
    'Armaduras leves, médias e pesadas; escudos; armas simples; armas marciais',

  languages: ['Comum', 'Élfico', 'Anão'],
  toolProficiencies: ['Veículos terrestres', 'Kit de jogos de dados'],

  backstory:
    'Nascido em uma cidade fronteiriça constantemente ameaçada por bandos de orcs, Kael aprendeu a lutar antes de aprender a ler. Serviu por seis anos no exército do reino antes de desertar após uma batalha que custou a vida de toda sua unidade, exceto a dele. Desde então, vaga pelo mundo carregando a culpa dos que deixou para trás.',
  appearance:
    'Alto (1,88 m), ombros largos, cabelo escuro cortado rente. Uma cicatriz diagonal cruza o lado esquerdo do rosto, da têmpora à mandíbula.',
  notes:
    'Precisa conversar com o comandante Aldric sobre a guarnição norte. Lembrar de comprar flechas antes de sair da cidade.',

  conditions: [],
}

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}

export function getSkillBonus(
  skill: Skill,
  abilities: AbilityScores,
  proficiencyBonus: number
): number {
  const mod = getAbilityModifier(abilities[skill.ability])
  if (skill.proficiency === 'expertise')  return mod + proficiencyBonus * 2
  if (skill.proficiency === 'proficient') return mod + proficiencyBonus
  return mod
}

export function getPassivePerception(
  skills: Skill[],
  abilities: AbilityScores,
  proficiencyBonus: number
): number {
  const percSkill = skills.find((s) => s.id === 'perception')
  if (!percSkill) return 10 + getAbilityModifier(abilities.sab)
  return 10 + getSkillBonus(percSkill, abilities, proficiencyBonus)
}

export const ABILITY_LABELS: Record<keyof AbilityScores, string> = {
  for: 'FOR', des: 'DES', con: 'CON', int: 'INT', sab: 'SAB', car: 'CAR',
}

export const ABILITY_FULL_LABELS: Record<keyof AbilityScores, string> = {
  for: 'Força', des: 'Destreza', con: 'Constituição',
  int: 'Inteligência', sab: 'Sabedoria', car: 'Carisma',
}
