// Catálogo oficial de armas, proteções, consumíveis e utilitários do
// livro de regras de Altherium. Dado fixo (como RAIZES/GENESIS/DOMAINS),
// sem edição em runtime — o que cada personagem possui vive na tabela
// altherium_character_inventory, referenciando os ids daqui.

export type WeaponCategory  = 'pesada' | 'leve' | 'arremesso' | 'alcance'
export type DamageType      = 'corte' | 'impacto' | 'perfurante'
export type WeaponAttribute = 'furia' | 'impulso' | 'furia_impulso'
export type WeaponRange     = 'toque' | 'toque_curto' | 'curto' | 'curto_medio' | 'medio' | 'longo'

export interface WeaponDef {
  id:             string
  name:           string
  category:       WeaponCategory
  damageDice:     string
  damageType:     DamageType
  attribute:      WeaponAttribute
  range:          WeaponRange
  price:          number
  berserkerOnly?: boolean
}

export type ArmorCoverage = 'escolhida' | 'todas'

export interface ArmorDef {
  id:          string
  name:        string
  description: string
  db:          number
  price:       number
  kind:        'armadura' | 'escudo'
  coverage:    ArmorCoverage
}

export interface ItemDef {
  id:     string
  name:   string
  effect: string
  price:  number
  notes:  string
  kind:   'consumivel' | 'utilitario'
}

export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  corte:      'Corte',
  impacto:    'Impacto',
  perfurante: 'Perfurante',
}

export const WEAPON_ATTRIBUTE_LABELS: Record<WeaponAttribute, string> = {
  furia:         'Fúria',
  impulso:       'Impulso',
  furia_impulso: 'Fúria ou Impulso',
}

export const WEAPON_RANGE_LABELS: Record<WeaponRange, string> = {
  toque:       'Toque',
  toque_curto: 'Toque/Curto',
  curto:       'Curto',
  curto_medio: 'Curto/Médio',
  medio:       'Médio',
  longo:       'Longo',
}

export const WEAPON_CATEGORY_LABELS: Record<WeaponCategory, string> = {
  pesada:    'Armas Pesadas',
  leve:      'Armas Leves',
  arremesso: 'Armas de Arremesso',
  alcance:   'Armas de Alcance',
}

export const WEAPONS: WeaponDef[] = [
  // Armas pesadas — somente Berserker
  { id: 'machado_duas_laminas',        name: 'Machado de duas lâminas',    category: 'pesada', damageDice: '2d8',    damageType: 'corte',      attribute: 'furia',         range: 'toque',       price: 1000, berserkerOnly: true },
  { id: 'martelo_impacto',             name: 'Martelo de Impacto',         category: 'pesada', damageDice: '2d10',   damageType: 'impacto',    attribute: 'furia',         range: 'toque',       price: 2000, berserkerOnly: true },
  { id: 'lanca_pesada',                name: 'Lança Pesada',               category: 'pesada', damageDice: '2d10',   damageType: 'perfurante', attribute: 'furia_impulso', range: 'toque',       price: 2000, berserkerOnly: true },
  { id: 'maca_ossos',                  name: 'Maça de ossos',              category: 'pesada', damageDice: '2d12',   damageType: 'impacto',    attribute: 'furia',         range: 'toque',       price: 2400, berserkerOnly: true },
  { id: 'espada_extremamente_pesada',  name: 'Espada Extremamente pesada', category: 'pesada', damageDice: '3d12',   damageType: 'corte',      attribute: 'furia',         range: 'toque',       price: 4000, berserkerOnly: true },
  { id: 'tridente_batalha',            name: 'Tridente de batalha',        category: 'pesada', damageDice: '2d12',   damageType: 'perfurante', attribute: 'furia_impulso', range: 'toque',       price: 2400, berserkerOnly: true },
  { id: 'sabre',                       name: 'Sabre',                      category: 'pesada', damageDice: '2d10',   damageType: 'corte',      attribute: 'impulso',       range: 'toque',       price: 2000, berserkerOnly: true },

  // Armas leves
  { id: 'adaga_serrilhada',            name: 'Adaga serrilhada',           category: 'leve', damageDice: '1d10', damageType: 'corte',      attribute: 'impulso',       range: 'toque', price: 400 },
  { id: 'espada_curta_reta',           name: 'Espada curta reta',          category: 'leve', damageDice: '1d12', damageType: 'corte',      attribute: 'furia',         range: 'toque', price: 600 },
  { id: 'adaga_gancho',                name: 'Adaga de Gancho',            category: 'leve', damageDice: '1d6',  damageType: 'corte',      attribute: 'impulso',       range: 'toque', price: 400 },
  { id: 'clava_espinosa',              name: 'Clava espinosa',             category: 'leve', damageDice: '1d10', damageType: 'impacto',    attribute: 'furia',         range: 'toque', price: 400 },
  { id: 'porrete_pedra',               name: 'Porrete de pedra',           category: 'leve', damageDice: '1d10', damageType: 'impacto',    attribute: 'furia_impulso', range: 'toque', price: 400 },
  { id: 'laminas_gemeas',              name: 'Lâminas Gêmeas',             category: 'leve', damageDice: '1d10', damageType: 'corte',      attribute: 'impulso',       range: 'toque', price: 400 },
  { id: 'espada_punho_circular',       name: 'Espada de Punho Circular',   category: 'leve', damageDice: '1d12', damageType: 'corte',      attribute: 'impulso',       range: 'toque', price: 600 },

  // Armas de arremesso
  { id: 'lanca_arremesso',             name: 'Lança',                      category: 'arremesso', damageDice: '1d12', damageType: 'perfurante', attribute: 'impulso', range: 'toque_curto', price: 600 },
  { id: 'adaga_arremesso',             name: 'Adaga de arremesso',         category: 'arremesso', damageDice: '1d8',  damageType: 'perfurante', attribute: 'impulso', range: 'toque_curto', price: 200 },
  { id: 'faca_arremesso',              name: 'Faca de Arremesso',          category: 'arremesso', damageDice: '1d10', damageType: 'perfurante', attribute: 'impulso', range: 'toque_curto', price: 400 },
  { id: 'machado_arremesso',           name: 'Machado de Arremesso',       category: 'arremesso', damageDice: '1d12', damageType: 'perfurante', attribute: 'furia',   range: 'toque_curto', price: 600 },
  { id: 'bola_ferro_corrente',         name: 'Bola de Ferro com corrente', category: 'arremesso', damageDice: '1d8',  damageType: 'impacto',    attribute: 'impulso', range: 'toque_curto', price: 200 },
  { id: 'boomerangue_aflado',          name: 'Boomerangue afiado',         category: 'arremesso', damageDice: '1d8',  damageType: 'corte',      attribute: 'impulso', range: 'curto',       price: 200 },

  // Armas de alcance
  { id: 'arco_curto',                  name: 'Arco Curto',                 category: 'alcance', damageDice: '1d10',   damageType: 'perfurante', attribute: 'impulso', range: 'medio',       price: 400 },
  { id: 'arco_longo',                  name: 'Arco Longo',                 category: 'alcance', damageDice: '1d12',   damageType: 'perfurante', attribute: 'furia',   range: 'longo',       price: 600 },
  { id: 'besta_leve',                  name: 'Besta Leve',                 category: 'alcance', damageDice: '1d10+2', damageType: 'perfurante', attribute: 'impulso', range: 'medio',       price: 600 },
  { id: 'besta_pesada',                name: 'Besta Pesada',               category: 'alcance', damageDice: '1d12+2', damageType: 'perfurante', attribute: 'furia',   range: 'longo',       price: 800 },
  { id: 'dardo_envenenado',            name: 'Dardo Envenenado',           category: 'alcance', damageDice: '1d6',    damageType: 'perfurante', attribute: 'impulso', range: 'curto_medio', price: 200 },
]

export const ARMORS: ArmorDef[] = [
  { id: 'tunica_couro_runico',       name: 'Túnica de Couro Rúnico',        description: 'Uma armadura simples feita de couro de Svarland',                 db: 4,  price: 400,  kind: 'armadura', coverage: 'escolhida' },
  { id: 'cota_malha_norte',          name: 'Cota de Malha do Norte',        description: 'Malha usada pelos maiores guerreiros Skalds',                     db: 8,  price: 500,  kind: 'armadura', coverage: 'escolhida' },
  { id: 'couraca_placas_torvalenn',  name: 'Couraça de Placas de Torvalenn', description: 'Armadura usada pelos guardas e guerreiros nobres de Torvalenn',  db: 12, price: 3000, kind: 'armadura', coverage: 'escolhida' },
  { id: 'armadura_guardiao_eryndor', name: 'Armadura do guardião de Eryndor', description: 'Armadura rara feita com partes de Eryndor',                      db: 16, price: 5000, kind: 'armadura', coverage: 'escolhida' },
  { id: 'escudo_leve',               name: 'Escudo Leve',                   description: 'Um escudo de madeira com detalhes em aço',                        db: 2,  price: 1000, kind: 'escudo',    coverage: 'todas' },
  { id: 'escudo_pesado',             name: 'Escudo Pesado',                 description: 'Um escudo de aço com detalhes em madeira',                        db: 6,  price: 4000, kind: 'escudo',    coverage: 'todas' },
]

export const CONSUMABLES: ItemDef[] = [
  { id: 'elixir_eir',       name: 'Elixir de Eir',      effect: 'Cura 1d8 de vida do usuário',       price: 100, notes: 'Básica, mas essencial.',           kind: 'consumivel' },
  { id: 'soro_idunn',       name: 'Soro de Idunn',      effect: 'Cura 1d8 de Equilíbrio',             price: 300, notes: 'Para emergências graves.',         kind: 'consumivel' },
  { id: 'cogumelo_berserkr', name: 'Cogumelo Berserkr', effect: '+2 de Fúria por 1 cena',             price: 150, notes: 'Exclusivo para Berserkers.',       kind: 'consumivel' },
  { id: 'tinta_isafis',     name: 'Tinta de Isatis',    effect: 'Recupera 1d4 de PR',                 price: 200, notes: 'Para Runaskins.',                  kind: 'consumivel' },
]

export const UTILITIES: ItemDef[] = [
  { id: 'kit_cura',         name: 'Kit de Cura',        effect: '+1D em Medicina',                    price: 100, notes: 'Para curar ferimentos.',           kind: 'utilitario' },
  { id: 'kit_saqueador',    name: 'Kit de Saqueador',   effect: '+1D em Crime',                        price: 100, notes: 'Para roubar.',                     kind: 'utilitario' },
  { id: 'amuleto_protecao', name: 'Amuleto de Proteção', effect: '+2 de Espírito por 1 cena',          price: 200, notes: 'Proteção espiritual.',             kind: 'utilitario' },
  { id: 'po_fumaca',        name: 'Pó de Fumaça',       effect: '+1D em Furtividade por 1 cena',       price: 150, notes: 'Para fugas ou ataques furtivos.',  kind: 'utilitario' },
]

export function findWeapon(id: string): WeaponDef | undefined {
  return WEAPONS.find((w) => w.id === id)
}
export function findArmor(id: string): ArmorDef | undefined {
  return ARMORS.find((a) => a.id === id)
}
export function findItem(id: string): ItemDef | undefined {
  return [...CONSUMABLES, ...UTILITIES].find((i) => i.id === id)
}
