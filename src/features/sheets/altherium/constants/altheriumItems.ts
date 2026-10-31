// Catálogo oficial de armas, proteções, consumíveis e utilitários do
// livro de regras de Altherium 2.0. Dado fixo (como RAIZES/GENESIS/DOMAINS),
// sem edição em runtime — o que cada personagem possui vive na tabela
// altherium_character_inventory, referenciando os ids daqui (por isso os
// ids antigos ficam como estão, mesmo com erro de grafia).

export type WeaponCategory  = 'pesada' | 'leve' | 'arremesso' | 'alcance'
export type DamageType      = 'corte' | 'impacto' | 'perfurante'
export type WeaponAttribute = 'furia' | 'impulso' | 'furia_impulso'
export type WeaponRange     = 'toque' | 'toque_curto' | 'curto' | 'curto_medio' | 'medio' | 'longo'
/** Material gasto pra reparar a Integridade (Ofício). */
export type RepairMaterial  = 'ferro_velho' | 'couro' | 'madeira' | 'osso'

export type WeaponPropertyId =
  | 'duas_maos' | 'uma_mao' | 'serrilhada' | 'atordoante' | 'perfurante'
  | 'haste' | 'gancho' | 'prender' | 'defensiva' | 'fluxo' | 'par' | 'lenta'
  | 'robusta' | 'fragil' | 'arremessavel' | 'retorno' | 'recarga'
  | 'disparo_rapido' | 'embebida' | 'improvisada'

/** Propriedade de uma arma. `value` é o X do Perfurante X; `action`, a ação da Recarga. */
export interface WeaponProperty {
  id:      WeaponPropertyId
  value?:  number
  action?: string
}

export interface WeaponDef {
  id:             string
  name:           string
  category:       WeaponCategory
  damageDice:     string
  damageType:     DamageType
  attribute:      WeaponAttribute
  range:          WeaponRange
  price:          number
  repair:         RepairMaterial
  properties:     WeaponProperty[]
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
  repair:      RepairMaterial
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
  corte:      'Cortante',
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

export const REPAIR_MATERIAL_LABELS: Record<RepairMaterial, string> = {
  ferro_velho: 'Ferro-velho',
  couro:       'Couro',
  madeira:     'Madeira',
  osso:        'Osso',
}

/** Nome e regra de cada propriedade, como no livro ("Propriedades"). */
export const WEAPON_PROPERTIES: Record<WeaponPropertyId, { label: string; description: string }> = {
  duas_maos:      { label: 'Duas Mãos',      description: 'Exige as duas mãos. Não dá pra empunhar escudo junto.' },
  uma_mao:        { label: 'Uma Mão',        description: 'Usada com uma só mão, deixando a outra livre para um escudo.' },
  serrilhada:     { label: 'Serrilhada',     description: 'Um acerto crítico deixa o alvo Sangrando.' },
  atordoante:     { label: 'Atordoante',     description: 'Um acerto crítico deixa o alvo Atordoado.' },
  perfurante:     { label: 'Perfurante',     description: 'Ao acertar, ignora X pontos de DB da parte atingida.' },
  haste:          { label: 'Haste',          description: 'Além do ataque de oportunidade normal, pode usar a Reação para atacar quem entrar em seu alcance de Toque.' },
  gancho:         { label: 'Gancho',         description: '+1 dado em Desarmar e em Rasteira.' },
  prender:        { label: 'Prender',        description: 'Um acerto crítico deixa o alvo Preso. Para se soltar, gasta uma Ação Padrão e testa Brutalidade + Fúria.' },
  defensiva:      { label: 'Defensiva',      description: '+1 ao Aparar.' },
  fluxo:          { label: 'Fluxo',          description: 'Ao Aparar, o contra-ataque acontece quando a Defesa supera o ataque por 4 ou mais, em vez de 5.' },
  par:            { label: 'Par',            description: 'Ocupa as duas mãos. Ao acertar, pode gastar a Ação Bônus para um segundo golpe de 1d4 no mesmo alvo.' },
  lenta:          { label: 'Lenta',          description: 'O peso atrasa o guerreiro: remove 2 pontos de Reflexo.' },
  robusta:        { label: 'Robusta',        description: 'Perde metade da Integridade quando se desgasta.' },
  fragil:         { label: 'Frágil',         description: 'Perde o dobro da Integridade quando se desgasta.' },
  arremessavel:   { label: 'Arremessável',   description: 'Pode ser arremessada em alcance Curto, com o mesmo teste de ataque. Pode ser recuperada após o combate.' },
  retorno:        { label: 'Retorno',        description: 'Volta para a mão do personagem após o arremesso, acertando ou errando.' },
  recarga:        { label: 'Recarga',        description: 'Após cada disparo, precisa ser recarregada gastando a ação indicada. Começa o combate carregada.' },
  disparo_rapido: { label: 'Disparo Rápido', description: 'Pode atacar com a arma no mesmo turno em que usa Disparar.' },
  embebida:       { label: 'Embebida',       description: 'Absorve substâncias: o óleo aplicado dura 6 ataques em vez de 3.' },
  improvisada:    { label: 'Improvisada',    description: 'Simples de fazer: pode ser craftada em Campo usando 100% do seu material de reparo.' },
}

/** "Perfurante 2", "Recarga (Ação Bônus)", "Serrilhada"... */
export function weaponPropertyLabel(p: WeaponProperty): string {
  const base = WEAPON_PROPERTIES[p.id].label
  if (p.value != null) return `${base} ${p.value}`
  if (p.action) return `${base} (${p.action})`
  return base
}

/** Espaços de Reforço: armas pesadas têm 2, as outras 1. */
export function weaponReinforcementSlots(w: WeaponDef): number {
  return w.category === 'pesada' ? 2 : 1
}

const P = (id: WeaponPropertyId, extra?: Omit<WeaponProperty, 'id'>): WeaponProperty => ({ id, ...extra })

export const WEAPONS: WeaponDef[] = [
  // Armas pesadas — somente Berserker, 2 espaços de Reforço
  { id: 'machado_duas_laminas',       name: 'Machado de duas lâminas',     category: 'pesada', damageDice: '2d8',  damageType: 'corte',      attribute: 'furia',         range: 'toque', price: 1000, repair: 'ferro_velho', properties: [P('duas_maos'), P('serrilhada')],                         berserkerOnly: true },
  { id: 'martelo_impacto',            name: 'Martelo de impacto',          category: 'pesada', damageDice: '2d10', damageType: 'impacto',    attribute: 'furia',         range: 'toque', price: 2000, repair: 'ferro_velho', properties: [P('duas_maos'), P('atordoante'), P('robusta')],          berserkerOnly: true },
  { id: 'lanca_pesada',               name: 'Lança Pesada',                category: 'pesada', damageDice: '2d10', damageType: 'perfurante', attribute: 'furia_impulso', range: 'toque', price: 2000, repair: 'madeira',     properties: [P('duas_maos'), P('haste'), P('perfurante', { value: 1 })], berserkerOnly: true },
  { id: 'maca_ossos',                 name: 'Maça de ossos',               category: 'pesada', damageDice: '2d12', damageType: 'impacto',    attribute: 'furia',         range: 'toque', price: 2400, repair: 'osso',        properties: [P('duas_maos'), P('perfurante', { value: 2 })],             berserkerOnly: true },
  { id: 'espada_extremamente_pesada', name: 'Espada Extremamente Pesada',  category: 'pesada', damageDice: '3d12', damageType: 'corte',      attribute: 'furia',         range: 'toque', price: 4000, repair: 'ferro_velho', properties: [P('duas_maos'), P('lenta'), P('robusta')],               berserkerOnly: true },
  { id: 'tridente_batalha',           name: 'Tridente de batalha',         category: 'pesada', damageDice: '2d12', damageType: 'perfurante', attribute: 'furia_impulso', range: 'toque', price: 2400, repair: 'ferro_velho', properties: [P('duas_maos'), P('haste'), P('prender')],               berserkerOnly: true },
  { id: 'sabre',                      name: 'Sabre',                       category: 'pesada', damageDice: '2d10', damageType: 'corte',      attribute: 'impulso',       range: 'toque', price: 2000, repair: 'ferro_velho', properties: [P('uma_mao'), P('fluxo')],                               berserkerOnly: true },

  // Armas leves — qualquer raiz, 1 espaço de Reforço
  { id: 'adaga_serrilhada',      name: 'Adaga serrilhada',         category: 'leve', damageDice: '1d10', damageType: 'corte',   attribute: 'impulso',       range: 'toque', price: 400, repair: 'ferro_velho', properties: [P('serrilhada')] },
  { id: 'espada_curta_reta',     name: 'Espada curta reta',        category: 'leve', damageDice: '1d12', damageType: 'corte',   attribute: 'furia',         range: 'toque', price: 600, repair: 'ferro_velho', properties: [P('defensiva')] },
  { id: 'adaga_gancho',          name: 'Adaga de Gancho',          category: 'leve', damageDice: '1d6',  damageType: 'corte',   attribute: 'impulso',       range: 'toque', price: 200, repair: 'ferro_velho', properties: [P('gancho')] },
  { id: 'clava_espinosa',        name: 'Clava espinhosa',          category: 'leve', damageDice: '1d10', damageType: 'impacto', attribute: 'furia',         range: 'toque', price: 400, repair: 'madeira',     properties: [P('perfurante', { value: 1 })] },
  { id: 'porrete_pedra',         name: 'Porrete de pedra',         category: 'leve', damageDice: '1d10', damageType: 'impacto', attribute: 'furia_impulso', range: 'toque', price: 100, repair: 'madeira',     properties: [P('fragil'), P('improvisada')] },
  { id: 'laminas_gemeas',        name: 'Lâminas Gêmeas',           category: 'leve', damageDice: '1d10', damageType: 'corte',   attribute: 'impulso',       range: 'toque', price: 400, repair: 'ferro_velho', properties: [P('par')] },
  { id: 'espada_punho_circular', name: 'Espada de Punho Circular', category: 'leve', damageDice: '1d12', damageType: 'corte',   attribute: 'impulso',       range: 'toque', price: 600, repair: 'ferro_velho', properties: [P('fluxo')] },

  // Armas de arremesso — Toque ou arremessadas em Curto, 1 espaço de Reforço
  { id: 'lanca_arremesso',     name: 'Lança',                      category: 'arremesso', damageDice: '1d12', damageType: 'perfurante', attribute: 'impulso', range: 'toque_curto', price: 600, repair: 'madeira',     properties: [P('arremessavel'), P('haste')] },
  { id: 'adaga_arremesso',     name: 'Adaga de arremesso',         category: 'arremesso', damageDice: '1d8',  damageType: 'perfurante', attribute: 'impulso', range: 'toque_curto', price: 200, repair: 'ferro_velho', properties: [P('arremessavel')] },
  { id: 'faca_arremesso',      name: 'Faca de Arremesso',          category: 'arremesso', damageDice: '1d10', damageType: 'perfurante', attribute: 'impulso', range: 'toque_curto', price: 400, repair: 'ferro_velho', properties: [P('arremessavel'), P('serrilhada')] },
  { id: 'machado_arremesso',   name: 'Machado de Arremesso',       category: 'arremesso', damageDice: '1d12', damageType: 'corte',      attribute: 'furia',   range: 'toque_curto', price: 600, repair: 'ferro_velho', properties: [P('arremessavel')] },
  { id: 'bola_ferro_corrente', name: 'Bola de Ferro com corrente', category: 'arremesso', damageDice: '1d8',  damageType: 'impacto',    attribute: 'impulso', range: 'toque_curto', price: 200, repair: 'ferro_velho', properties: [P('arremessavel'), P('retorno'), P('atordoante')] },
  { id: 'boomerangue_aflado',  name: 'Boomerangue afiado',         category: 'arremesso', damageDice: '1d8',  damageType: 'corte',      attribute: 'impulso', range: 'curto',       price: 200, repair: 'madeira',     properties: [P('arremessavel'), P('retorno'), P('fragil')] },

  // Armas de alcance — 1 espaço de Reforço
  { id: 'arco_curto',       name: 'Arco Curto',       category: 'alcance', damageDice: '1d10', damageType: 'perfurante', attribute: 'impulso', range: 'medio',       price: 400, repair: 'madeira',     properties: [P('duas_maos'), P('disparo_rapido')] },
  { id: 'arco_longo',       name: 'Arco Longo',       category: 'alcance', damageDice: '1d12', damageType: 'perfurante', attribute: 'furia',   range: 'longo',       price: 600, repair: 'madeira',     properties: [P('duas_maos')] },
  { id: 'besta_leve',       name: 'Besta Leve',       category: 'alcance', damageDice: '1d10', damageType: 'perfurante', attribute: 'impulso', range: 'medio',       price: 600, repair: 'ferro_velho', properties: [P('perfurante', { value: 1 }), P('recarga', { action: 'Ação Bônus' })] },
  { id: 'besta_pesada',     name: 'Besta Pesada',     category: 'alcance', damageDice: '1d12', damageType: 'perfurante', attribute: 'furia',   range: 'longo',       price: 800, repair: 'ferro_velho', properties: [P('duas_maos'), P('perfurante', { value: 3 }), P('recarga', { action: 'Ação de Movimento' })] },
  { id: 'dardo_envenenado', name: 'Dardo Envenenado', category: 'alcance', damageDice: '1d6',  damageType: 'perfurante', attribute: 'impulso', range: 'curto_medio', price: 200, repair: 'madeira',     properties: [P('embebida'), P('fragil')] },
]

// Reparo: armaduras de couro usam Couro, o restante usa Ferro-velho (livro, "Integridade").
export const ARMORS: ArmorDef[] = [
  { id: 'tunica_couro_runico',       name: 'Túnica de Couro Rúnico',          description: 'Uma armadura simples feita de couro de Svarland',                db: 4,  price: 300,  kind: 'armadura', coverage: 'escolhida', repair: 'couro' },
  { id: 'cota_malha_norte',          name: 'Cota de Malha do Norte',          description: 'Malha usada pelos maiores guerreiros Skalds',                    db: 8,  price: 500,  kind: 'armadura', coverage: 'escolhida', repair: 'ferro_velho' },
  { id: 'couraca_placas_torvalenn',  name: 'Couraça de Placas de Torvalenn',  description: 'Armadura usada pelos guardas e guerreiros nobres de Torvalenn', db: 12, price: 3000, kind: 'armadura', coverage: 'escolhida', repair: 'ferro_velho' },
  { id: 'armadura_guardiao_eryndor', name: 'Armadura do guardião de Eryndor', description: 'Armadura rara feita com partes de Eryndor',                     db: 16, price: 5000, kind: 'armadura', coverage: 'escolhida', repair: 'ferro_velho' },
  { id: 'escudo_leve',               name: 'Escudo Leve',                     description: 'Um escudo de madeira com detalhes em aço',                       db: 2,  price: 1000, kind: 'escudo',   coverage: 'todas',     repair: 'ferro_velho' },
  { id: 'escudo_pesado',             name: 'Escudo Pesado',                   description: 'Um escudo de aço com detalhes em madeira',                       db: 6,  price: 4000, kind: 'escudo',   coverage: 'todas',     repair: 'ferro_velho' },
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
