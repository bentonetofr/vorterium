import type { AbilityKey, SkillKey } from '../rules/types'

// ────────────────────────────────────────────────────────
// Dados fixos da criação de ficha (rápida e por narrativa): kits de equipamento de cada classe (as escolhas do livro, com
// chaves do catálogo), pacotes de aventura, idiomas, tendências, a ordem de importância dos atributos de cada classe e as
// magias que mais costumam valer a pena. Nada aqui depende de React nem do banco.
// ────────────────────────────────────────────────────────

/** Item de um kit: chave do catálogo (arma, armadura, equipamento, ferramenta ou "shield") ou um item próprio só com nome. */
export interface KitItem { key?: string; name?: string; qty?: number; equip?: boolean; note?: string }
export interface KitOption { id: string; label: string; hint?: string; items: KitItem[] }
export interface KitChoice { id: string; title: string; options: KitOption[] }
export interface ClassKit {
  choices: KitChoice[]
  /** O que a classe dá sem escolha. */
  fixed: KitItem[]
}

const w = (key: string, qty = 1, equip = false): KitItem => ({ key, qty, equip })
const own = (name: string, qty = 1, note = ''): KitItem => ({ name, qty, note })

export const ARROWS = own('Flechas', 20, 'Aljava com 20 flechas')
export const BOLTS = own('Virotes', 20, 'Estojo com 20 virotes')

/** Pacotes de aventura do livro: viram UMA linha no inventário, com a lista do que vem dentro. */
export const PACKS: Record<string, { name: string; contents: string[]; keys: Record<string, number> }> = {
  explorer: {
    name: 'Pacote de explorador',
    contents: ['mochila', 'saco de dormir', 'kit de refeição', 'pederneira', '10 tochas', '10 rações', 'cantil', '15 m de corda de cânhamo'],
    keys: { backpack: 1, bedroll: 1, tinderbox: 1, torch: 10, rations: 10, waterskin: 1, hempen_rope: 1 },
  },
  dungeoneer: {
    name: 'Pacote de aventureiro de masmorra',
    contents: ['mochila', 'pé de cabra', 'martelo', '10 pitões', '10 tochas', 'pederneira', '10 rações', 'cantil', '15 m de corda de cânhamo'],
    keys: { backpack: 1, crowbar: 1, hammer: 1, iron_spikes: 10, torch: 10, tinderbox: 1, rations: 10, waterskin: 1, hempen_rope: 1 },
  },
  priest: {
    name: 'Pacote de sacerdote',
    contents: ['mochila', 'cobertor', '10 velas', 'pederneira', 'caixa de esmolas', '2 blocos de incenso', 'incensário', 'vestes', '2 rações', 'cantil'],
    keys: { backpack: 1, blanket: 1, candle: 10, tinderbox: 1, rations: 2, waterskin: 1 },
  },
  burglar: {
    name: 'Pacote de ladrão',
    contents: ['mochila', 'saco com 1.000 esferas de metal', '3 m de barbante', 'sino', '5 velas', 'pé de cabra', 'martelo', '10 pitões', 'lanterna', '2 frascos de óleo', '5 rações', 'pederneira', 'cantil', '15 m de corda de cânhamo'],
    keys: { backpack: 1, candle: 5, crowbar: 1, hammer: 1, iron_spikes: 10, lantern: 1, oil_flask: 2, rations: 5, tinderbox: 1, waterskin: 1, hempen_rope: 1 },
  },
  scholar: {
    name: 'Pacote de acadêmico',
    contents: ['mochila', 'livro de conhecimento', 'frasco de tinta', 'pena', '10 folhas de pergaminho', 'saquinho de areia', 'faca pequena'],
    keys: { backpack: 1 },
  },
  diplomat: {
    name: 'Pacote de diplomata',
    contents: ['baú', '2 estojos de mapas', 'roupas finas', 'frasco de tinta', 'pena', 'lamparina', '2 frascos de óleo', '5 folhas de papel', 'frasco de perfume', 'cera de selar', 'sabão'],
    keys: { oil_flask: 2 },
  },
  entertainer: {
    name: 'Pacote de artista',
    contents: ['mochila', 'saco de dormir', '2 fantasias', '5 velas', '5 rações', 'cantil', 'kit de disfarce'],
    keys: { backpack: 1, bedroll: 1, candle: 5, rations: 5, waterskin: 1, disguise_kit: 1 },
  },
}

export const packItem = (id: keyof typeof PACKS): KitItem => ({ name: PACKS[id].name, qty: 1, note: `Contém: ${PACKS[id].contents.join(', ')}.` })

const pack = (id: keyof typeof PACKS, label?: string, hint?: string): KitOption => ({ id: `pack_${id}`, label: label ?? PACKS[id].name, hint, items: [packItem(id)] })

/** "Qualquer arma simples": as mais úteis, para não afogar a pessoa numa lista de 14. */
const SIMPLE_WEAPONS = ['mace', 'quarterstaff', 'spear', 'handaxe', 'light_crossbow', 'shortbow', 'dagger']
const simpleOption = (key: string): KitOption => ({ id: `simple_${key}`, label: '', items: key === 'light_crossbow' ? [w(key, 1, true), BOLTS] : key === 'shortbow' ? [w(key, 1, true), ARROWS] : [w(key, 1, true)] })

export const KITS: Record<string, ClassKit> = {
  barbarian: {
    fixed: [packItem('explorer'), w('javelin', 4)],
    choices: [
      { id: 'weapon', title: 'Qual é a arma principal?', options: [
        { id: 'greataxe', label: 'Machado grande', hint: 'd12 de dano', items: [w('greataxe', 1, true)] },
        { id: 'battleaxe', label: 'Machado de batalha', hint: 'd8 (d10 com as duas mãos)', items: [w('battleaxe', 1, true)] },
        { id: 'longsword', label: 'Espada longa', hint: 'd8 (d10 com as duas mãos)', items: [w('longsword', 1, true)] },
        { id: 'maul', label: 'Malho', hint: '2d6 de dano', items: [w('maul', 1, true)] },
      ] },
      { id: 'second', title: 'E a segunda arma?', options: [
        { id: 'handaxes', label: 'Dois machados de mão', hint: 'Leves e de arremesso', items: [w('handaxe', 2, true)] },
        ...SIMPLE_WEAPONS.map((k) => ({ ...simpleOption(k), label: '' })),
      ] },
    ],
  },
  bard: {
    fixed: [w('leather', 1, true), w('dagger', 1, true)],
    choices: [
      { id: 'weapon', title: 'Qual é a arma?', options: [
        { id: 'rapier', label: 'Rapieira', hint: 'd8, acuidade', items: [w('rapier', 1, true)] },
        { id: 'longsword', label: 'Espada longa', hint: 'd8', items: [w('longsword', 1, true)] },
        { id: 'simple_dagger', label: 'Outra adaga', hint: 'Qualquer arma simples', items: [w('dagger', 1, true)] },
      ] },
      { id: 'pack', title: 'Qual pacote de aventura?', options: [pack('diplomat'), pack('entertainer')] },
      { id: 'instrument', title: 'Qual instrumento musical?', options: [
        { id: 'lute', label: 'Alaúde', items: [w('lute')] }, { id: 'flute', label: 'Flauta', items: [w('flute')] }, { id: 'lyre', label: 'Lira', items: [w('lyre')] },
        { id: 'drum', label: 'Tambor', items: [w('drum')] }, { id: 'viol', label: 'Viola', items: [w('viol')] }, { id: 'horn', label: 'Trompa', items: [w('horn')] },
      ] },
    ],
  },
  cleric: {
    fixed: [w('shield', 1, true), w('holy_symbol', 1, true)],
    choices: [
      { id: 'weapon', title: 'Qual é a arma?', options: [{ id: 'mace', label: 'Maça', hint: 'd6', items: [w('mace', 1, true)] }] },
      { id: 'armor', title: 'Qual armadura?', options: [
        { id: 'scale', label: 'Brunea', hint: 'CA 14 + Destreza (máx. 2)', items: [w('scale_mail', 1, true)] },
        { id: 'leather', label: 'Armadura de couro', hint: 'CA 11 + Destreza', items: [w('leather', 1, true)] },
      ] },
      { id: 'ranged', title: 'E uma arma à distância?', options: [
        { id: 'crossbow', label: 'Besta leve e 20 virotes', items: [w('light_crossbow'), BOLTS] },
        ...SIMPLE_WEAPONS.filter((k) => k !== 'light_crossbow').map((k) => ({ ...simpleOption(k), label: '' })),
      ] },
      { id: 'pack', title: 'Qual pacote de aventura?', options: [pack('priest'), pack('explorer')] },
    ],
  },
  druid: {
    fixed: [w('leather', 1, true), packItem('explorer') as KitItem, own('Foco druídico', 1, 'Ramo de visco, totem, bastão de madeira ou outro foco natural')],
    choices: [
      { id: 'defense', title: 'Escudo de madeira ou uma arma simples?', options: [
        { id: 'shield', label: 'Escudo de madeira', hint: '+2 de CA', items: [w('shield', 1, true)] },
        ...['quarterstaff', 'spear', 'mace'].map((k) => ({ ...simpleOption(k), label: '' })),
      ] },
      { id: 'melee', title: 'Cimitarra ou outra arma simples corpo a corpo?', options: [
        { id: 'scimitar', label: 'Cimitarra', hint: 'd6, acuidade', items: [w('scimitar', 1, true)] },
        ...['quarterstaff', 'spear', 'mace'].map((k) => ({ ...simpleOption(k), id: `melee_${k}`, label: '' })),
      ] },
    ],
  },
  fighter: {
    fixed: [],
    choices: [
      { id: 'armor', title: 'Qual armadura?', options: [
        { id: 'chain', label: 'Cota de malha', hint: 'CA 16, sem Destreza', items: [w('chain_mail', 1, true)] },
        { id: 'leather_bow', label: 'Armadura de couro, arco longo e 20 flechas', hint: 'CA 11 + Destreza', items: [w('leather', 1, true), w('longbow'), ARROWS] },
      ] },
      { id: 'weapons', title: 'Quais armas marciais?', options: [
        { id: 'sword_shield', label: 'Espada longa e escudo', hint: 'd8 e +2 de CA', items: [w('longsword', 1, true), w('shield', 1, true)] },
        { id: 'axe_shield', label: 'Machado de batalha e escudo', hint: 'd8 e +2 de CA', items: [w('battleaxe', 1, true), w('shield', 1, true)] },
        { id: 'warhammer_shield', label: 'Martelo de guerra e escudo', hint: 'd8 e +2 de CA', items: [w('warhammer', 1, true), w('shield', 1, true)] },
        { id: 'greatsword', label: 'Espada grande', hint: '2d6, duas mãos', items: [w('greatsword', 1, true)] },
        { id: 'greataxe', label: 'Machado grande', hint: 'd12, duas mãos', items: [w('greataxe', 1, true)] },
        { id: 'two_swords', label: 'Espada longa e espada curta', hint: 'Duas armas', items: [w('longsword', 1, true), w('shortsword', 1, true)] },
      ] },
      { id: 'ranged', title: 'E uma arma à distância?', options: [
        { id: 'crossbow', label: 'Besta leve e 20 virotes', items: [w('light_crossbow'), BOLTS] },
        { id: 'handaxes', label: 'Dois machados de mão', items: [w('handaxe', 2)] },
      ] },
      { id: 'pack', title: 'Qual pacote de aventura?', options: [pack('dungeoneer'), pack('explorer')] },
    ],
  },
  monk: {
    fixed: [w('dart', 10)],
    choices: [
      { id: 'weapon', title: 'Qual é a arma?', options: [
        { id: 'shortsword', label: 'Espada curta', hint: 'd6, acuidade', items: [w('shortsword', 1, true)] },
        ...['quarterstaff', 'spear', 'dagger'].map((k) => ({ ...simpleOption(k), label: '' })),
      ] },
      { id: 'pack', title: 'Qual pacote de aventura?', options: [pack('dungeoneer'), pack('explorer')] },
    ],
  },
  paladin: {
    fixed: [w('chain_mail', 1, true), w('holy_symbol', 1, true)],
    choices: [
      { id: 'weapons', title: 'Quais armas marciais?', options: [
        { id: 'sword_shield', label: 'Espada longa e escudo', hint: 'd8 e +2 de CA', items: [w('longsword', 1, true), w('shield', 1, true)] },
        { id: 'axe_shield', label: 'Machado de batalha e escudo', hint: 'd8 e +2 de CA', items: [w('battleaxe', 1, true), w('shield', 1, true)] },
        { id: 'warhammer_shield', label: 'Martelo de guerra e escudo', hint: 'd8 e +2 de CA', items: [w('warhammer', 1, true), w('shield', 1, true)] },
        { id: 'greatsword', label: 'Espada grande', hint: '2d6, duas mãos', items: [w('greatsword', 1, true)] },
        { id: 'greataxe', label: 'Machado grande', hint: 'd12, duas mãos', items: [w('greataxe', 1, true)] },
        { id: 'two_swords', label: 'Espada longa e espada curta', hint: 'Duas armas', items: [w('longsword', 1, true), w('shortsword', 1, true)] },
      ] },
      { id: 'second', title: 'E a arma extra?', options: [
        { id: 'javelins', label: 'Cinco azagaias', hint: 'De arremesso', items: [w('javelin', 5)] },
        ...['mace', 'spear', 'handaxe'].map((k) => ({ ...simpleOption(k), label: '' })),
      ] },
      { id: 'pack', title: 'Qual pacote de aventura?', options: [pack('priest'), pack('explorer')] },
    ],
  },
  ranger: {
    fixed: [w('longbow', 1, true), ARROWS],
    choices: [
      { id: 'armor', title: 'Qual armadura?', options: [
        { id: 'scale', label: 'Brunea', hint: 'CA 14 + Destreza (máx. 2)', items: [w('scale_mail', 1, true)] },
        { id: 'leather', label: 'Armadura de couro', hint: 'CA 11 + Destreza', items: [w('leather', 1, true)] },
      ] },
      { id: 'weapons', title: 'Quais armas corpo a corpo?', options: [
        { id: 'two_shortswords', label: 'Duas espadas curtas', hint: 'Leves, para lutar com duas armas', items: [w('shortsword', 2, true)] },
        { id: 'two_handaxes', label: 'Dois machados de mão', hint: 'Leves e de arremesso', items: [w('handaxe', 2, true)] },
        { id: 'spear_dagger', label: 'Lança e adaga', items: [w('spear', 1, true), w('dagger', 1, true)] },
      ] },
      { id: 'pack', title: 'Qual pacote de aventura?', options: [pack('dungeoneer'), pack('explorer')] },
    ],
  },
  rogue: {
    fixed: [w('leather', 1, true), w('dagger', 2, true), w('thieves_tools')],
    choices: [
      { id: 'weapon', title: 'Qual é a arma principal?', options: [
        { id: 'rapier', label: 'Rapieira', hint: 'd8, acuidade', items: [w('rapier', 1, true)] },
        { id: 'shortsword', label: 'Espada curta', hint: 'd6, acuidade e leve', items: [w('shortsword', 1, true)] },
      ] },
      { id: 'ranged', title: 'E a arma secundária?', options: [
        { id: 'shortbow', label: 'Arco curto e 20 flechas', items: [w('shortbow'), ARROWS] },
        { id: 'shortsword', label: 'Espada curta', items: [w('shortsword', 1, true)] },
      ] },
      { id: 'pack', title: 'Qual pacote de aventura?', options: [pack('burglar'), pack('dungeoneer'), pack('explorer')] },
    ],
  },
  sorcerer: {
    fixed: [w('dagger', 2, true)],
    choices: [
      { id: 'weapon', title: 'Qual é a arma?', options: [
        { id: 'crossbow', label: 'Besta leve e 20 virotes', items: [w('light_crossbow', 1, true), BOLTS] },
        ...['quarterstaff', 'spear', 'dagger'].map((k) => ({ ...simpleOption(k), label: '' })),
      ] },
      { id: 'focus', title: 'Bolsa de componentes ou foco arcano?', options: [
        { id: 'pouch', label: 'Bolsa de componentes', items: [w('component_pouch')] },
        { id: 'crystal', label: 'Foco arcano: cristal', items: [w('arcane_focus_crystal')] },
        { id: 'orb', label: 'Foco arcano: orbe', items: [w('arcane_focus_orb')] },
        { id: 'rod', label: 'Foco arcano: bastão', items: [w('arcane_focus_rod')] },
      ] },
      { id: 'pack', title: 'Qual pacote de aventura?', options: [pack('dungeoneer'), pack('explorer')] },
    ],
  },
  warlock: {
    fixed: [w('leather', 1, true), w('dagger', 2, true), w('quarterstaff')],
    choices: [
      { id: 'weapon', title: 'Qual é a arma?', options: [
        { id: 'crossbow', label: 'Besta leve e 20 virotes', items: [w('light_crossbow', 1, true), BOLTS] },
        ...['mace', 'spear', 'handaxe'].map((k) => ({ ...simpleOption(k), label: '' })),
      ] },
      { id: 'focus', title: 'Bolsa de componentes ou foco arcano?', options: [
        { id: 'pouch', label: 'Bolsa de componentes', items: [w('component_pouch')] },
        { id: 'crystal', label: 'Foco arcano: cristal', items: [w('arcane_focus_crystal')] },
        { id: 'orb', label: 'Foco arcano: orbe', items: [w('arcane_focus_orb')] },
        { id: 'rod', label: 'Foco arcano: bastão', items: [w('arcane_focus_rod')] },
      ] },
      { id: 'pack', title: 'Qual pacote de aventura?', options: [pack('scholar'), pack('dungeoneer')] },
    ],
  },
  wizard: {
    fixed: [w('spellbook')],
    choices: [
      { id: 'weapon', title: 'Qual é a arma?', options: [
        { id: 'quarterstaff', label: 'Bordão', hint: 'd6 (d8 com as duas mãos)', items: [w('quarterstaff', 1, true)] },
        { id: 'dagger', label: 'Adaga', hint: 'd4, acuidade, de arremesso', items: [w('dagger', 1, true)] },
      ] },
      { id: 'focus', title: 'Bolsa de componentes ou foco arcano?', options: [
        { id: 'pouch', label: 'Bolsa de componentes', items: [w('component_pouch')] },
        { id: 'crystal', label: 'Foco arcano: cristal', items: [w('arcane_focus_crystal')] },
        { id: 'orb', label: 'Foco arcano: orbe', items: [w('arcane_focus_orb')] },
        { id: 'rod', label: 'Foco arcano: bastão', items: [w('arcane_focus_rod')] },
      ] },
      { id: 'pack', title: 'Qual pacote de aventura?', options: [pack('scholar'), pack('explorer')] },
    ],
  },
}

// ── Idiomas, tendências e atributos ─────────────────────

/** Os idiomas do livro (os de uso corrente primeiro). */
export const LANGUAGES = ['Anão', 'Élfico', 'Gigante', 'Gnômico', 'Goblin', 'Halfling', 'Orc', 'Abissal', 'Celestial', 'Dracônico', 'Língua Profunda', 'Infernal', 'Primordial', 'Silvestre', 'Subcomum']

export const ALIGNMENTS = [
  'Leal e Bom', 'Neutro e Bom', 'Caótico e Bom',
  'Leal e Neutro', 'Neutro', 'Caótico e Neutro',
  'Leal e Mau', 'Neutro e Mau', 'Caótico e Mau',
]

/** A ordem de importância dos atributos de cada classe (o que o livro sugere pôr nos valores mais altos). */
export const ABILITY_ORDER: Record<string, AbilityKey[]> = {
  barbarian: ['strength', 'constitution', 'dexterity', 'wisdom', 'charisma', 'intelligence'],
  bard: ['charisma', 'dexterity', 'constitution', 'wisdom', 'intelligence', 'strength'],
  cleric: ['wisdom', 'constitution', 'strength', 'charisma', 'dexterity', 'intelligence'],
  druid: ['wisdom', 'constitution', 'dexterity', 'intelligence', 'charisma', 'strength'],
  fighter: ['strength', 'constitution', 'dexterity', 'wisdom', 'charisma', 'intelligence'],
  monk: ['dexterity', 'wisdom', 'constitution', 'strength', 'intelligence', 'charisma'],
  paladin: ['strength', 'charisma', 'constitution', 'wisdom', 'dexterity', 'intelligence'],
  ranger: ['dexterity', 'wisdom', 'constitution', 'strength', 'intelligence', 'charisma'],
  rogue: ['dexterity', 'charisma', 'constitution', 'intelligence', 'wisdom', 'strength'],
  sorcerer: ['charisma', 'constitution', 'dexterity', 'wisdom', 'intelligence', 'strength'],
  warlock: ['charisma', 'constitution', 'dexterity', 'wisdom', 'intelligence', 'strength'],
  wizard: ['intelligence', 'constitution', 'dexterity', 'wisdom', 'charisma', 'strength'],
}

/** A distribuição padrão do livro: 15, 14, 13, 12, 10 e 8. */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

/** Quantas especializações em perícia (2 cada vez) a classe dá, e em que níveis. */
export const EXPERTISE_LEVELS: Record<string, number[]> = { rogue: [1, 6], bard: [3, 10] }

/** Nível em que a classe escolhe o estilo de luta. */
export const FIGHTING_STYLE_LEVEL: Record<string, number> = { fighter: 1, paladin: 2, ranger: 2 }

// ── Magias ──────────────────────────────────────────────

/** Truques que mais valem a pena, do melhor para o menos útil (vale para qualquer classe que o tenha). */
export const CANTRIP_RANK = [
  'eldritch_blast', 'sacred_flame', 'fire_bolt', 'guidance', 'vicious_mockery', 'produce_flame', 'shillelagh', 'mage_hand', 'minor_illusion',
  'prestidigitation', 'ray_of_frost', 'shocking_grasp', 'light', 'druidcraft', 'thaumaturgy', 'message', 'resistance', 'spare_the_dying',
  'poison_spray', 'chill_touch', 'acid_splash', 'dancing_lights', 'mending', 'true_strike',
]

/** Magias de 1º nível ou mais que mais valem a pena, das melhores para as menos (vale para qualquer classe que as tenha). */
export const SPELL_RANK = [
  'shield', 'magic_missile', 'cure_wounds', 'healing_word', 'bless', 'guiding_bolt', 'sleep', 'mage_armor', 'thunderwave', 'detect_magic',
  'burning_hands', 'charm_person', 'faerie_fire', 'entangle', 'hunters_mark', 'hex', 'hellish_rebuke', 'shield_of_faith', 'command', 'disguise_self',
  'find_familiar', 'goodberry', 'longstrider', 'speak_with_animals', 'identify', 'feather_fall', 'color_spray', 'fog_cloud', 'expeditious_retreat',
  'misty_step', 'hold_person', 'invisibility', 'mirror_image', 'spiritual_weapon', 'lesser_restoration', 'scorching_ray', 'shatter', 'web', 'suggestion',
  'moonbeam', 'pass_without_trace', 'aid', 'blur', 'darkness', 'enhance_ability', 'silence', 'barkskin', 'heat_metal', 'flaming_sphere',
  'fireball', 'counterspell', 'haste', 'fly', 'revivify', 'dispel_magic', 'lightning_bolt', 'hypnotic_pattern', 'spirit_guardians', 'call_lightning',
  'slow', 'fear', 'sleet_storm', 'tongues', 'water_breathing', 'major_image', 'clairvoyance', 'animate_dead', 'bestow_curse', 'remove_curse',
  'polymorph', 'greater_invisibility', 'banishment', 'dimension_door', 'ice_storm', 'wall_of_fire', 'death_ward', 'freedom_of_movement', 'confusion',
  'cone_of_cold', 'hold_monster', 'wall_of_force', 'telekinetic', 'teleportation_circle', 'mass_cure_wounds', 'flame_strike', 'raise_dead', 'commune',
  'chain_lightning', 'disintegrate', 'heal', 'globe_of_invulnerability', 'sunbeam', 'forcecage', 'teleport', 'plane_shift', 'regenerate', 'resurrection',
  'power_word_stun', 'dominate_monster', 'earthquake', 'sunburst', 'mind_blank', 'wish', 'meteor_swarm', 'time_stop', 'foresight', 'true_resurrection',
]

export const ALL_SKILL_KEYS: SkillKey[] = [
  'acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature',
  'perception', 'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival',
]
