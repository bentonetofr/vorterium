import type { AbilityKey, SkillKey } from '../rules/types'

// ────────────────────────────────────────────────────────
// O que se lê de um PDF de ficha, já organizado mas ainda "cru" (tudo texto,
// do jeito que a pessoa escreveu). Cada modelo de PDF (models/) produz um
// `SheetRead`; o resto da importação (casar com o catálogo, perguntar,
// conferir, gravar) só conhece este formato.
// ────────────────────────────────────────────────────────

export interface ReadAbility { score: string; mod: string }
export interface ReadSave { value: string; proficient: boolean }
export interface ReadSkill { value: string; proficient: boolean; expertise: boolean }

export interface ReadAttack { name: string; bonus: string; damage: string }
export interface ReadStack { name: string; qty: string }

export interface ReadHitDie { die: string; total: string; left: string }

export interface ReadFeatureRow { name: string; total: string; left: string; shortRest: boolean; longRest: boolean; dawn: boolean }

/** Os detalhes que a carta de magia do PDF traz (alcance, duração, texto...). */
export interface ReadSpellCard {
  school: string; range: string; castingTime: string; duration: string; components: string; save: string; effect: string
  verbal: boolean; somatic: boolean; material: boolean; concentration: boolean; ritual: boolean; prepared: boolean
}

export interface ReadSpell {
  name:     string
  level:    number
  /** Marcada como preparada (conhecida) na lista. */
  prepared: boolean
  /** Onde apareceu: na lista por nível, na carta, ou nas duas. */
  from:     'list' | 'card' | 'both'
  card:     ReadSpellCard | null
}

export interface ReadSlot { level: number; total: string; remaining: string; marked: number }

export interface SheetRead {
  /** Qual modelo de PDF foi reconhecido. */
  model:   string
  identity: {
    characterName: string; playerName: string; classText: string; raceText: string; backgroundText: string
    alignmentText: string; xpText: string; nextLevelText: string
  }
  abilities: Record<AbilityKey, ReadAbility>
  profBonus: string
  inspiration: boolean
  saves:  Record<AbilityKey, ReadSave>
  skills: Record<SkillKey, ReadSkill>
  passivePerception: string
  combat: {
    ac: string; acBonus: string; initiative: string; speed: string; vision: string; darkvision: boolean
    hpMax: string; hpCurrent: string; hpTemp: string; exhaustion: string
    hitDice: ReadHitDie[]
    deathSuccesses: number; deathFailures: number
  }
  armor: { type: string; ac: string; maxDex: string; strength: string; shield: string; stealthDisadvantage: boolean }
  attacks: ReadAttack[]
  ammo: ReadStack[]
  consumables: ReadStack[]
  attuned: string[]
  coins: { cp: string; sp: string; ep: string; gp: string; pp: string }
  proficiencies: {
    armor: { light: boolean; medium: boolean; heavy: boolean; shields: boolean }
    weapons: { simple: boolean; martial: boolean; other: boolean; otherText: string }
    tools: string
    languages: string
  }
  /** Textos livres, do jeito que estão no PDF. */
  texts: {
    feats: string; racialTraits: string; classFeatures: string; backgroundFeature: string; additionalFeatures: string
    appearance: string; equipment: string; equipment2: string; allies: string
    personality: string; ideals: string; bonds: string; flaws: string; madness: string
  }
  bio: { age: string; height: string; weight: string; eyes: string; skin: string; hair: string; faction: string }
  /** A tabela de habilidades da primeira página (nome, dado/total, restantes, recarga). */
  featureRows: ReadFeatureRow[]
  spellcasting: {
    className: string; ability: string; dc: string; attack: string
    slots: ReadSlot[]
    spells: ReadSpell[]
  }
}
