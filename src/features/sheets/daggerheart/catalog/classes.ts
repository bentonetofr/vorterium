// ────────────────────────────────────────────────────────
// Catálogo de classes DaggerHeart (SRD 2.0).
// Baseado em conhecimento do SRD — conferir valores de Evasão
// e HP contra o livro impresso antes de liberar publicamente.
// ────────────────────────────────────────────────────────

import type { DhClassKey, DhDomainKey, DhTraitKey } from '../rules/types'

export interface DhClassData {
  key:            DhClassKey
  name_pt:        string
  evasion:        number
  hp_max:         number
  stress_max:     number
  domains:        [DhDomainKey, DhDomainKey]
  spellcast_trait: DhTraitKey | null
  subclasses:     [string, string]
}

export const DH_CLASSES: DhClassData[] = [
  {
    key:             'assassin',
    name_pt:         'Assassino',
    evasion:         12,
    hp_max:          5,
    stress_max:      6,
    domains:         ['midnight', 'blade'],
    spellcast_trait: 'instinct',
    subclasses:      ['Nightwalker', 'Whisper'],
  },
  {
    key:             'bard',
    name_pt:         'Bardo',
    evasion:         11,
    hp_max:          6,
    stress_max:      6,
    domains:         ['splendor', 'grace'],
    spellcast_trait: 'presence',
    subclasses:      ['Troubadour', 'Wordsmith'],
  },
  {
    key:             'brawler',
    name_pt:         'Brigão',
    evasion:         10,
    hp_max:          7,
    stress_max:      6,
    domains:         ['bone', 'valor'],
    spellcast_trait: null,
    subclasses:      ['Momentum', 'Bruiser'],
  },
  {
    key:             'druid',
    name_pt:         'Druida',
    evasion:         10,
    hp_max:          6,
    stress_max:      6,
    domains:         ['sage', 'arcana'],
    spellcast_trait: 'instinct',
    subclasses:      ['Warden of the Elements', 'Warden of Renewal'],
  },
  {
    key:             'guardian',
    name_pt:         'Guardião',
    evasion:         11,
    hp_max:          6,
    stress_max:      6,
    domains:         ['valor', 'codex'],
    spellcast_trait: null,
    subclasses:      ['Stalwart', 'Vengeance'],
  },
  {
    key:             'ranger',
    name_pt:         'Patrulheiro',
    evasion:         11,
    hp_max:          6,
    stress_max:      6,
    domains:         ['wanderer', 'blade'],
    spellcast_trait: null,
    subclasses:      ['Beastbound', 'Wayfinder'],
  },
  {
    key:             'rogue',
    name_pt:         'Ladino',
    evasion:         12,
    hp_max:          5,
    stress_max:      6,
    domains:         ['midnight', 'grace'],
    spellcast_trait: null,
    subclasses:      ['Scoundrel', 'Syndicate'],
  },
  {
    key:             'seraph',
    name_pt:         'Serafim',
    evasion:         10,
    hp_max:          6,
    stress_max:      6,
    domains:         ['grace', 'splendor'],
    spellcast_trait: 'presence',
    subclasses:      ['Divine Wielder', 'Winged Sentinel'],
  },
  {
    key:             'sorcerer',
    name_pt:         'Feiticeiro',
    evasion:         10,
    hp_max:          5,
    stress_max:      6,
    domains:         ['arcana', 'midnight'],
    spellcast_trait: 'knowledge',
    subclasses:      ['Elemental Origin', 'Primal Origin'],
  },
  {
    key:             'warlock',
    name_pt:         'Bruxo',
    evasion:         10,
    hp_max:          5,
    stress_max:      6,
    domains:         ['midnight', 'bone'],
    spellcast_trait: 'presence',
    subclasses:      ['Nightmare', 'Tandem'],
  },
  {
    key:             'warrior',
    name_pt:         'Guerreiro',
    evasion:         11,
    hp_max:          6,
    stress_max:      6,
    domains:         ['blade', 'valor'],
    spellcast_trait: null,
    subclasses:      ['Call of the Brave', 'Call of the Slayer'],
  },
  {
    key:             'witch',
    name_pt:         'Bruxa',
    evasion:         10,
    hp_max:          5,
    stress_max:      6,
    domains:         ['arcana', 'sage'],
    spellcast_trait: 'instinct',
    subclasses:      ['Coven', 'Hex'],
  },
  {
    key:             'wizard',
    name_pt:         'Mago',
    evasion:         10,
    hp_max:          5,
    stress_max:      6,
    domains:         ['arcana', 'codex'],
    spellcast_trait: 'knowledge',
    subclasses:      ['School of Knowledge', 'School of War'],
  },
]

export function getDhClass(key: DhClassKey): DhClassData {
  const found = DH_CLASSES.find((c) => c.key === key)
  if (!found) throw new Error(`Classe DaggerHeart desconhecida: ${key}`)
  return found
}

export const DH_CLASS_KEYS = DH_CLASSES.map((c) => c.key)
