import type { AbilityKey, SkillKey, SpellcastingProfile } from '../rules/types'
import type { MulticlassRequirement } from '../rules/progression'

// ────────────────────────────────────────────────────────
// Tipos do catálogo de D&D 5e (2014). Todo item tem chave estável em inglês
// (`fireball`), nome em português do Brasil e o nome original. `source`
// diz de onde veio: srd51 (CC-BY-4.0) ou homebrew (criado numa campanha).
// ────────────────────────────────────────────────────────

export type CatalogSource = 'srd51' | 'homebrew'

export interface CatalogBase {
  key:      string
  name:     string
  original: string
}

// ── Equipamento ─────────────────────────────────────────
// Unidades da edição brasileira: peso em kg, alcances em metros.

export interface WeaponEntry {
  key: string
  name: string
  category: 'simple' | 'martial'
  range: 'melee' | 'ranged' | 'both'
  cost: string
  /** Dado de dano (null na Rede, que não causa dano). */
  damage: string | null
  damageType: string | null
  weight: number
  properties: string[]
}

export interface ArmorEntry {
  key: string
  name: string
  category: 'light' | 'medium' | 'heavy'
  baseAc: number
  /** Limite de Destreza: null = sem limite (leve), 2 = média, 0 = pesada. */
  dexCap: number | null
  strengthRequirement: number | null
  stealthDisadvantage: boolean
  cost: string
  weight: number
}

export interface ShieldEntry {
  key: string
  name: string
  acBonus: number
  cost: string
  weight: number
}

export interface GearEntry {
  key: string
  name: string
  description: string
  group: string
  cost: string
  weight: number
}

export interface ToolEntry {
  key: string
  name: string
  description: string
  group: string
  cost: string
  weight: number
}

// ── Características ────────────────────────────────────

/** Característica de classe, subclasse, raça ou antecedente, com resumo próprio. */
export interface FeatureEntry extends CatalogBase {
  /** Nível de classe em que é ganha (1 para raça e antecedente). */
  level:   number
  summary: string
}

// ── Classes ─────────────────────────────────────────────

export type ArmorProficiency = 'light' | 'medium' | 'heavy' | 'shield'

export interface SkillChoice {
  count: number
  /** Lista permitida, ou 'any' (Bardo). */
  from:  SkillKey[] | 'any'
}

/** Coluna da tabela de progressão da classe (Fúrias, Dano da Fúria, Pontos de Ki...). */
export interface ProgressionColumn {
  key:    string
  label:  string
  /** 20 valores, nível 1 a 20. */
  values: (number | string)[]
}

export interface MulticlassProficiencies {
  armor:   ArmorProficiency[]
  /** 'simple', 'martial' ou a chave de uma arma do catálogo. */
  weapons: string[]
  tools:   string[]
  skills?: SkillChoice
  note?:   string
}

export interface SubclassDef extends CatalogBase {
  /** Nome do tipo de escolha ("Caminho Primitivo", "Colégio de Bardo"...). */
  kind:     string
  summary:  string
  features: FeatureEntry[]
}

export interface ClassDef extends CatalogBase {
  hitDie:      6 | 8 | 10 | 12
  primaryAbilities: AbilityKey[]
  saves:       AbilityKey[]
  skills:      SkillChoice
  armor:       ArmorProficiency[]
  /** 'simple', 'martial' ou a chave de uma arma do catálogo. */
  weapons:     string[]
  /** Texto livre (as ferramentas variam muito: "três instrumentos musicais à escolha"). */
  tools:       string[]
  /** Equipamento inicial em linhas de texto (escolhas a/b incluídas). */
  startingEquipment: string[]
  summary:     string
  /** Nível em que escolhe a subclasse. */
  subclassLevel: number
  /** Níveis de classe com Aumento de Atributo. */
  asiLevels:   readonly number[]
  features:    FeatureEntry[]
  progression: ProgressionColumn[]
  spellcasting?: SpellcastingProfile
  multiclass:  { requirement: MulticlassRequirement; gained: MulticlassProficiencies }
  /** Subclasses do SRD (uma por classe). Outras entram como homebrew. */
  subclasses:  SubclassDef[]
}

// ── Raças ───────────────────────────────────────────────

export type Size = 'small' | 'medium'

export interface RaceBase extends CatalogBase {
  /** Bônus fixos de atributo. */
  abilityBonuses: Partial<Record<AbilityKey, number>>
  traits:         FeatureEntry[]
}

export interface SubraceDef extends RaceBase {
  summary: string
  /** PV extra por nível de personagem (Anão da Colina: +1). */
  hpBonusPerLevel?: number
  weaponProficiencies?: string[]
  /** Ferramentas fixas (Gnomo das Rochas: ferramentas de engenhoqueiro). */
  tools?: string[]
  extraLanguages?: number
  /** Truque à escolha de uma lista de classe (Alto Elfo: um truque de mago, Inteligência). */
  cantripChoice?: { classKey: string; count: number; ability: AbilityKey }
}

export interface RaceDef extends RaceBase {
  summary: string
  size:    Size
  /** Deslocamento base em pés (canônico do SRD; a tela converte para metros). */
  speed:   number
  languages: string[]
  /** Idiomas extras à escolha do jogador. */
  extraLanguages: number
  /** Escolha livre de bônus de atributo (Meio-Elfo: +1 em dois, exceto Carisma). */
  abilityChoice?: { count: number; amount: number; exclude: AbilityKey[] }
  /** Perícias garantidas (Elfo: Percepção; Meio-Orc: Intimidação) e escolhidas (Meio-Elfo: duas). */
  skills:         SkillKey[]
  skillChoices?:  number
  weaponProficiencies: string[]
  /** Escolha de ferramenta (Anão: um kit de artesão). */
  toolChoice?:    string[]
  darkvision:     number
  resistances:    string[]
  subraces:       SubraceDef[]
}

// ── Antecedentes ────────────────────────────────────────

export interface BackgroundDef extends CatalogBase {
  summary: string
  skills:  SkillKey[]
  /** Quantas ferramentas/idiomas à escolha (o antecedente personalizado dá 2). */
  toolOrLanguageChoices: number
  languagesChoices: number
  tools:   string[]
  equipment: string[]
  feature: FeatureEntry | null
  /** Personalizado: o jogador escolhe 2 perícias livres em vez de uma lista fixa. */
  custom?: boolean
  skillChoices?: number
  /** srd51 = do documento livre (Acólito); phb = do Livro do Jogador (fora do SRD, com resumos em palavras nossas). */
  source?: 'srd51' | 'phb'
}

// ── Condições ───────────────────────────────────────────

export interface ConditionDef extends CatalogBase {
  summary: string
}

export interface ExhaustionLevel {
  level:  number
  effect: string
}

export interface FightingStyleDef extends CatalogBase {
  summary: string
  /** Classes que podem escolher este estilo (SRD: Guerreiro, Paladino, Patrulheiro). */
  classes: string[]
}

export interface GlossaryEntry {
  term:     string
  original: string
  note?:    string
}

// ── Magias ──────────────────────────────────────────────

export type SpellSchool =
  | 'abjuration' | 'conjuration' | 'divination' | 'enchantment'
  | 'evocation' | 'illusion' | 'necromancy' | 'transmutation'

export interface SpellComponents {
  v:  boolean
  s:  boolean
  /** Descrição do componente material (em português); ausente = sem componente material. */
  m?: string
}

/** Magia do catálogo (SRD 5.1 ou homebrew). Alcances em metros, como na edição brasileira. */
export interface SpellEntry extends CatalogBase {
  /** 0 = truque. */
  level:         number
  school:        SpellSchool
  ritual?:       boolean
  concentration?: boolean
  castingTime:   string
  range:         string
  components:    SpellComponents
  duration:      string
  /** Classes que têm a magia na lista (chaves de classe do catálogo). */
  classes:       string[]
  /** Parágrafos do texto; uma linha começando com "• " é um item de lista. */
  text:          string[]
  /** "Em Níveis Superiores": o que muda com um espaço de magia maior. */
  higher?:       string
}
