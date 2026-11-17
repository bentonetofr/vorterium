// ────────────────────────────────────────────────────────
// Tipos do DaggerHeart (Livro Básico, Darrington Press). Nomes em português como na edição brasileira:
// Pontos de Vida (PV), Pontos de Fadiga (Stress), Pontos de Esperança, Pontos de Armadura, patamar, limiares de dano.
// ────────────────────────────────────────────────────────

/** Os seis atributos do personagem. */
export type DhTrait = 'agility' | 'strength' | 'finesse' | 'instinct' | 'presence' | 'knowledge'
export const DH_TRAITS: readonly DhTrait[] = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge']

/** Atributo que uma arma usa: um dos seis ou o atributo de conjuração da subclasse. */
export type DhWeaponTrait = DhTrait | 'conjuracao'

export type DhDomain = 'arcano' | 'lamina' | 'falange' | 'codice' | 'graca' | 'meia_noite' | 'sabedoria' | 'esplendor' | 'valor'

export type DhClassKey = 'bardo' | 'druida' | 'feiticeiro' | 'guardiao' | 'guerreiro' | 'ladino' | 'mago' | 'patrulheiro' | 'serafim'

export type DhRange = 'melee' | 'muito_proximo' | 'proximo' | 'distante' | 'muito_distante'

export type DhDamageType = 'fis' | 'mag' | 'ambos'

export type DhCardType = 'talento' | 'feitico' | 'grimorio'

export type DhTier = 1 | 2 | 3 | 4

// ── Catálogo ───────────────────────────────────────────

/** Bônus que dá pra calcular a partir de uma característica de arma ou armadura. */
export interface DhModifiers {
  evasion?: number
  armor?: number
  attack?: number
  severe?: number
  spellcast?: number
  allTraits?: number
  traits?: Partial<Record<DhTrait, number>>
}

export interface DhFeature {
  name: string
  text: string
}

export interface DhDomainCard {
  id: string
  domain: DhDomain
  level: number
  type: DhCardType
  /** Custo de troca (Recall Cost). */
  recall: number
  name: string
  text: string
}

export interface DhWeaponEntry {
  id: string
  name: string
  tier: DhTier
  slot: 'primary' | 'secondary'
  trait: DhWeaponTrait
  range: DhRange
  /** Dado e bônus fixo, ex.: "d8+3". Os dados rolados são tantos quanto a Proficiência. */
  dice: string
  damageType: DhDamageType
  hands: 1 | 2
  featureName?: string
  feature?: string
  mods?: DhModifiers
}

export interface DhArmorEntry {
  id: string
  name: string
  tier: DhTier
  /** Limiares base de dano maior e grave (antes de somar o nível). */
  major: number
  severe: number
  score: number
  featureName?: string
  feature?: string
  mods?: DhModifiers
}

export interface DhSubclass {
  key: string
  name: string
  tagline: string
  /** Atributo de conjuração; null = a subclasse não conjura. */
  spellcast: DhTrait | null
  foundation: DhFeature[]
  specialization: DhFeature[]
  mastery: DhFeature[]
}

export interface DhClass {
  key: DhClassKey
  name: string
  description: string
  domains: [DhDomain, DhDomain]
  evasion: number
  hp: number
  items: string[]
  hopeFeature: DhFeature
  features: DhFeature[]
  subclasses: DhSubclass[]
  /** Distribuição sugerida dos atributos, arma e armadura (guia do personagem). */
  suggested: { traits: Record<DhTrait, number>; primary: string; secondary?: string; armor: string }
  /** Itens do guia: o que escolher entre duas opções. */
  itemChoices: { potion: [string, string]; keepsake: [string, string]; carry?: { label: string; examples: string } }
  background: string[]
  connections: string[]
}

export interface DhAncestry {
  key: string
  name: string
  description: string
  features: [DhFeature, DhFeature]
}

export interface DhCommunity {
  key: string
  name: string
  description: string
  traits: string[]
  feature: DhFeature
}

// ── Ficha ──────────────────────────────────────────────

export interface DhExperience {
  id: string
  name: string
  mod: number
}

/** Arma anotada na ficha (do catálogo ou inventada). */
export interface DhWeaponSlot {
  catalogId: string | null
  name: string
  trait: DhWeaponTrait | ''
  range: DhRange | ''
  dice: string
  damageType: DhDamageType
  hands: 0 | 1 | 2
  feature: string
  attackBonus: number
}

export interface DhArmorSlot {
  catalogId: string | null
  name: string
  major: number
  severe: number
  score: number
  feature: string
  mods: DhModifiers
}

/** Uma escolha da subida de nível. `tier` diz de qual quadro (patamar 2, 3 ou 4) a casa foi marcada. */
export type DhPick =
  | { opt: 'traits'; tier: 2 | 3 | 4; traits: [DhTrait, DhTrait] }
  | { opt: 'hp'; tier: 2 | 3 | 4 }
  | { opt: 'stress'; tier: 2 | 3 | 4 }
  | { opt: 'experiences'; tier: 2 | 3 | 4; ids: [string, string] }
  | { opt: 'domain'; tier: 2 | 3 | 4; card: string }
  | { opt: 'evasion'; tier: 2 | 3 | 4 }
  | { opt: 'subclass'; tier: 3 | 4 }
  | { opt: 'proficiency'; tier: 3 | 4 }
  | { opt: 'multiclass'; tier: 3 | 4; classKey: DhClassKey; domain: DhDomain; subclassKey: string }

export interface DhAdvancement {
  /** Nível que o personagem alcançou com esta subida (2 a 10). */
  level: number
  picks: DhPick[]
  /** Experiência nova ganha nos níveis 2, 5 e 8. */
  experienceId: string | null
  /** Carta de domínio pega ao subir. */
  card: string | null
}

export interface DhCompanion {
  name: string
  evasion: number
  experiences: DhExperience[]
  attack: string
  damageDie: 6 | 8 | 10 | 12
  range: DhRange
  stressSlots: number
  stressMarked: number
  picks: string[]
  notes: string
}

export interface DhTrackers {
  /** Dado de Determinação do guardião (0 = sem Determinação ativa). */
  unstoppable: number
  /** Dados de Oração do serafim (valores rolados e ainda não gastos). */
  prayer: number[]
  /** Dados da Matança do guerreiro (quantos na carta). */
  slayer: number
  /** Número dos Padrões Estranhos do mago. */
  strange: number
  /** Dado de Inspiração já dado nesta sessão (bardo). */
  rallyGiven: boolean
  /** Elemento escolhido (elementalista) ou escolha livre da classe. */
  choice: string
  /** Forma de Fera ativa (druida). */
  beastform: string
  /** Alvo da Marca da Presa (patrulheiro). */
  focus: string
}

export interface DhSheetData {
  v: 1
  name: string
  pronouns: string
  level: number
  classKey: DhClassKey | null
  subclassKey: string | null
  /** Ancestralidade (chave do catálogo ou texto livre para ancestralidade mista). */
  ancestryKey: string | null
  /** Segunda ancestralidade, se mista (a segunda habilidade vem dela). */
  ancestry2Key: string | null
  ancestryName: string
  communityKey: string | null
  /** Valores base dos atributos (antes das subidas de nível). */
  traits: Record<DhTrait, number>
  evasionBonus: number
  armorBonus: number
  /** Espaços de Vida e de Fadiga ganhos fora das subidas de nível (cartas como Vitalidade, ancestralidades etc.). */
  hpBonus: number
  stressBonus: number
  /** Bônus fixos de limiares vindos de cartas e habilidades que o app não calcula sozinho. */
  majorBonus: number
  severeBonus: number
  hpMarked: number
  stressMarked: number
  hope: number
  /** Casas de Esperança perdidas com cicatrizes. */
  scars: number
  armorMarked: number
  armor: DhArmorSlot | null
  primary: DhWeaponSlot | null
  secondary: DhWeaponSlot | null
  inventoryWeapons: [DhWeaponSlot | null, DhWeaponSlot | null]
  experiences: DhExperience[]
  gold: { handfuls: number; bags: number; chests: number }
  inventory: string[]
  loadout: string[]
  vault: string[]
  /** Cartas já usadas (limite de uso esgotado) até o próximo descanso. */
  cardsUsed: string[]
  advancements: DhAdvancement[]
  description: { clothes: string; eyes: string; body: string; skin: string; attitude: string }
  background: string[]
  connections: string[]
  trackers: DhTrackers
  companion: DhCompanion | null
  notes: string
}

/** Linha da tabela dh_sheets. */
export interface DhSheetRow {
  id: string
  campaign_id: string
  user_id: string
  data: DhSheetData
  created_at: string
  updated_at: string
}
