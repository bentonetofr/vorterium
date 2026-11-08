// ────────────────────────────────────────────────────────
// Conjuntos de dados: cor do corpo, dos números e do friso, e como o material
// reflete a luz. Cada jogador escolhe o seu; a mesa vê os dados de cada um
// na cor dele. O padrão é a pedra do Vórtice (escura, números dourados,
// friso vermelho que brilha).
// ────────────────────────────────────────────────────────

/** Raridade das skins da coleção: quanto mais difícil a conquista, melhor o dado. */
export type Tier = 'comum' | 'incomum' | 'rara' | 'epica' | 'lendaria'

export interface DiceSkin {
  id:        string
  name:      string
  /** Corpo: cor do centro e da borda de cada face (dá o ar de pedra lapidada). */
  body:      string
  bodyEdge:  string
  /** Números. */
  ink:       string
  /** Friso que contorna cada face. */
  trim:      string
  /** Brilho próprio dos números e do friso (aparece no escuro). */
  glow:      string
  glowPower: number
  roughness: number
  metalness: number
  /** Números de metal (dourados ou prateados) ou de tinta. */
  inkMetal:  boolean
  /** Translúcido, como cristal. */
  glass?:    boolean
  /** Conjunto detalhado: a superfície (veios, rachaduras, entalhes) é pintada por dieSurfaces.ts e ganha mapa de relevo. */
  surface?:  string
  /** Guardado: existe no código, mas não aparece nem pode ser escolhido. */
  hidden?:   boolean
  /** Força do relevo (padrão 1) e do verniz (padrão pelo material). */
  bump?:     number
  clearcoat?: number
  /** Resina transparente de verdade (dá para ver dentro); os números e o friso ficam opacos. */
  resin?:    boolean
  /** Brinquedinho preso dentro da resina (toys.ts). */
  toy?:      'nerd' | 'inseto' | 'vagalumes'
  /** Coleção: ganho por conquista (features/collection). Não entra na lista de todos; quem não ganhou não escolhe, mas todos veem o dado de quem tem. */
  tier?:     Tier
  /** Exclusivo: só escolhe quem tem este recurso liberado pelo e-mail (site_feature_access). Todos veem o dado na mesa. */
  exclusive?: string
}

/** Recurso de acesso do dado dos betas do D&D (migration 20240213). */
export const BETINHA_FEATURE = 'dado-betinha'
export const BETINHA_SKIN = 'betinha'

const base = { glow: '#000000', glowPower: 0, metalness: 0, inkMetal: false } as const

const COLLECTION: DiceSkin[] = [
  // Comuns
  { ...base, id: 'osso',      tier: 'comum',    name: 'Osso Entalhado',      body: '#efe6d2', bodyEdge: '#a58f66', ink: '#3a2518', trim: '#b79b6a', roughness: 0.72, surface: 'osso', bump: 1.5, clearcoat: 0.05 },
  { ...base, id: 'ferro',     tier: 'comum',    name: 'Ferro Enferrujado',   body: '#4a4e55', bodyEdge: '#1f2125', ink: '#c7ccd4', trim: '#7a7f88', roughness: 0.5, metalness: 0.9, inkMetal: true, surface: 'ferro', bump: 1.8, clearcoat: 0 },
  { ...base, id: 'argila',    tier: 'comum',    name: 'Argila Cozida',       body: '#c8774a', bodyEdge: '#7c3b1f', ink: '#f5e4c4', trim: '#e8c9a0', roughness: 0.82, surface: 'argila', bump: 1.3, clearcoat: 0 },
  { ...base, id: 'giz',       tier: 'comum',    name: 'Giz de Taverna',      body: '#e7e4da', bodyEdge: '#aaa699', ink: '#1c1b1d', trim: '#fffdf5', roughness: 0.96, surface: 'giz', bump: 1.2, clearcoat: 0 },
  { ...base, id: 'cobre',     tier: 'comum',    name: 'Cobre Oxidado',       body: '#d58450', bodyEdge: '#6e3418', ink: '#3a1c0e', trim: '#f0b080', roughness: 0.4, metalness: 0.88, inkMetal: true, surface: 'cobre', bump: 1.5, clearcoat: 0.2 },
  // Incomuns
  { ...base, id: 'marfim',    tier: 'incomum',  name: 'Marfim Antigo',       body: '#f1e6c8', bodyEdge: '#c3a56a', ink: '#16110d', trim: '#fff8e4', roughness: 0.45, surface: 'marfim', bump: 1.0, clearcoat: 0.35 },
  { ...base, id: 'onix',      tier: 'incomum',  name: 'Ônix Polido',         body: '#1b1b21', bodyEdge: '#050507', ink: '#fff3c4', trim: '#c9952f', roughness: 0.1, metalness: 0.18, inkMetal: true, surface: 'onix', bump: 0.8, clearcoat: 1 },
  { ...base, id: 'ametista',  tier: 'incomum',  name: 'Ametista',            body: '#8a62e0', bodyEdge: '#2e1670', ink: '#fff4d6', trim: '#e8dcff', glow: '#d8c6ff', glowPower: 0.35, roughness: 0.1, glass: true, surface: 'ametista', bump: 1.0, clearcoat: 0.8 },
  { ...base, id: 'granada',   tier: 'incomum',  name: 'Granada',             body: '#b0203a', bodyEdge: '#3a0610', ink: '#fff0b8', trim: '#f4d078', roughness: 0.08, glass: true, surface: 'granada', bump: 0.8, clearcoat: 0.9 },
  { ...base, id: 'jade',      tier: 'incomum',  name: 'Jade Imperial',       body: '#58a883', bodyEdge: '#1b5640', ink: '#f6e4a4', trim: '#dcf5e8', roughness: 0.3, metalness: 0.04, surface: 'jade', bump: 1.0, clearcoat: 0.6 },
  { ...base, id: 'fume',      tier: 'incomum',  name: 'Vidro Fumê',          body: '#2c2c3a', bodyEdge: '#07070c', ink: '#f4f6ff', trim: '#aeb6d8', glow: '#aab4ff', glowPower: 0.4, roughness: 0.07, glass: true, surface: 'fume', bump: 0.6, clearcoat: 0.9 },
  // Raras
  { ...base, id: 'gelo',      tier: 'rara',     name: 'Gelo Eterno',         body: '#d6f0fc', bodyEdge: '#5b9fcf', ink: '#1b5fae', trim: '#ffffff', glow: '#7fdcff', glowPower: 0.45, roughness: 0.1, glass: true, surface: 'gelo', bump: 1.2, clearcoat: 0.8 },
  { ...base, id: 'magma',     tier: 'rara',     name: 'Magma',               body: '#241c26', bodyEdge: '#09070b', ink: '#ffb347', trim: '#ff7a18', glow: '#ff7a18', glowPower: 0.95, roughness: 0.9, metalness: 0.05, surface: 'magma', bump: 1.8, clearcoat: 0 },
  { ...base, id: 'meteorito', tier: 'rara',     name: 'Meteorito',           body: '#8b8d95', bodyEdge: '#2f3036', ink: '#f4f6fb', trim: '#b0b3bc', roughness: 0.45, metalness: 0.85, inkMetal: true, surface: 'meteorito', bump: 1.6, clearcoat: 0.1 },
  { ...base, id: 'fungo',     tier: 'rara',     name: 'Fungo Brilhante',     body: '#4a3622', bodyEdge: '#150e08', ink: '#d8ffe8', trim: '#5ad8a4', glow: '#6dffc4', glowPower: 0.7, roughness: 0.88, surface: 'fungo', bump: 1.6, clearcoat: 0 },
  { ...base, id: 'ambar',     tier: 'rara',     name: 'Âmbar',               body: '#f4b52e', bodyEdge: '#a9580a', ink: '#4a2204', trim: '#ffe0a0', roughness: 0.06, resin: true, toy: 'inseto', surface: 'ambar', bump: 0.4, clearcoat: 1 },
  // Épicas
  { ...base, id: 'morte',     tier: 'epica',    name: 'Dado da Morte',       body: '#2a2124', bodyEdge: '#0a0708', ink: '#ff4a58', trim: '#e01828', glow: '#ff2030', glowPower: 0.8, roughness: 0.55, metalness: 0.05, surface: 'morte', bump: 1.5, clearcoat: 0.1 },
  { ...base, id: 'vagalumes', tier: 'epica',    name: 'Resina de Vaga-lumes', body: '#1c4a52', bodyEdge: '#06161c', ink: '#fff0a8', trim: '#7affd0', glow: '#e8ff80', glowPower: 0.85, roughness: 0.05, resin: true, toy: 'vagalumes', surface: 'vagalumes', bump: 0.3, clearcoat: 1 },
  { ...base, id: 'runico',    tier: 'epica',    name: 'Ouro Rúnico',         body: '#e0ac3c', bodyEdge: '#7a5210', ink: '#5a3604', trim: '#ffe08a', glow: '#ffb44a', glowPower: 0.8, roughness: 0.26, metalness: 0.95, inkMetal: true, surface: 'runico', bump: 1.4, clearcoat: 0.3 },
  // Lendária
  { ...base, id: 'vortice',   tier: 'lendaria', name: 'Pedra do Vórtice',    body: '#2a2030', bodyEdge: '#08060c', ink: '#ffe9a8', trim: '#d9363e', glow: '#ff3b45', glowPower: 0.9, roughness: 0.5, metalness: 0.2, inkMetal: true, surface: 'vortice', bump: 1.4, clearcoat: 0.2 },
]

/** As skins da coleção, em ordem de raridade. */
export const COLLECTION_SKINS: readonly DiceSkin[] = COLLECTION
const COLLECTION_IDS: ReadonlySet<string> = new Set(COLLECTION.map((s) => s.id))
export const isCollectionSkin = (id: string) => COLLECTION_IDS.has(id)

export const ALL_SKINS: readonly DiceSkin[] = [
  // Os conjuntos iniciais: são os únicos que existem para o jogador por enquanto (superfície detalhada).
  // Ver docs/superpowers/specs/2026-10-22-colecao-de-dados.md
  { id: 'madeira',   name: 'Madeira Velha',    body: '#76492a', bodyEdge: '#2b190a', ink: '#120801', trim: '#6b4423', glow: '#000000', glowPower: 0, roughness: 0.9, metalness: 0, inkMetal: false, surface: 'wood', bump: 1.6, clearcoat: 0 },
  { id: 'granito',   name: 'Granito',          body: '#6c6f77', bodyEdge: '#32353b', ink: '#1b1e23', trim: '#2c2f35', glow: '#000000', glowPower: 0, roughness: 0.82, metalness: 0.04, inkMetal: false, surface: 'stone', bump: 1.4, clearcoat: 0.04 },
  { id: 'plastico',  name: 'Plástico Marmorizado', body: '#1f50d8', bodyEdge: '#0a1f70', ink: '#ffffff', trim: '#cfe0ff', glow: '#000000', glowPower: 0, roughness: 0.14, metalness: 0, inkMetal: false, surface: 'plastic', bump: 0.6, clearcoat: 0.95 },
  // Exclusivo dos betas do D&D: resina transparente com o emoji nerd de brinquedo dentro.
  { id: BETINHA_SKIN, name: 'Dado de Betinha Tester', body: '#f2fffd', bodyEdge: '#9fe8de', ink: '#ffffff', trim: '#ffffff', glow: '#000000', glowPower: 0, roughness: 0.05, metalness: 0, inkMetal: false, resin: true, toy: 'nerd', exclusive: BETINHA_FEATURE, clearcoat: 1 },
  // Guardados: não aparecem nem podem ser usados até virarem prêmio de conquista (e serem refeitos com o mesmo detalhe).
  // A coleção (20 conjuntos ganhos por conquista; as regras ficam em features/collection)
  ...COLLECTION,
]

/** Os conjuntos de todo jogador: só os iniciais. */
export const DICE_SKINS: readonly DiceSkin[] = ALL_SKINS.filter((s) => !s.hidden && !s.exclusive && !s.tier)

/** Os que existem na mesa: os de todos e os exclusivos (quem não tem acesso também vê o dado de quem tem). */
const SHOWN_SKINS: readonly DiceSkin[] = ALL_SKINS.filter((s) => !s.hidden)

/** Os conjuntos que esta conta pode escolher: os de todos e os exclusivos liberados para ela. */
export function skinsFor(access: ReadonlySet<string>, unlocked: ReadonlySet<string> = new Set()): DiceSkin[] {
  return SHOWN_SKINS.filter((s) => (!s.exclusive || access.has(s.exclusive)) && (!s.tier || unlocked.has(s.id)))
}

export const DEFAULT_SKIN = 'madeira'

/** O conjunto pelo id. Qualquer outro id (rolagens e perfis antigos, guardados) cai no padrão. */
export function getSkin(id: string | null | undefined): DiceSkin {
  return SHOWN_SKINS.find((s) => s.id === id) ?? DICE_SKINS[0]
}
