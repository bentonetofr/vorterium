// ────────────────────────────────────────────────────────
// Conjuntos de dados: cor do corpo, dos números e do friso, e como o material
// reflete a luz. Cada jogador escolhe o seu; a mesa vê os dados de cada um
// na cor dele. O padrão é a pedra do Vórtice (escura, números dourados,
// friso vermelho que brilha).
// ────────────────────────────────────────────────────────

import type { DiceVoice } from './sound'

/** Raridade das skins da coleção: quanto mais difícil a conquista, melhor o dado. A mítica fica acima da lendária (quase ninguém tem). */
export type Tier = 'comum' | 'incomum' | 'rara' | 'epica' | 'lendaria' | 'mitica'
export const TIER_ORDER: readonly Tier[] = ['comum', 'incomum', 'rara', 'epica', 'lendaria', 'mitica']

/** Luz própria que se mexe: pulso lento (respira), raio (clarões) ou brasa (tremula). */
export type GlowAnim = 'pulso' | 'raio' | 'brasa'

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
  toy?:      ToyKind
  /** O som do material quando o dado bate (sound.ts). Sem isto, o som de sempre (resina na madeira). */
  sound?:    DiceVoice
  /** Furta-cor de verdade (película fina que muda de cor com o ângulo): 0 a 1. */
  iridescence?: number
  /** A luz própria do dado se mexe (na vitrine e enquanto rola). */
  glowAnim?: GlowAnim
  /** Coleção: ganho por conquista (features/collection). Não entra na lista de todos; quem não ganhou não escolhe, mas todos veem o dado de quem tem. */
  tier?:     Tier
  /** Exclusivo: só escolhe quem tem este recurso liberado pelo e-mail (site_feature_access). Todos veem o dado na mesa. */
  exclusive?: string
}

export type ToyKind = 'nerd' | 'inseto' | 'vagalumes' | 'olho' | 'planeta'

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
  { ...base, id: 'cortica',   tier: 'comum',    name: 'Rolha de Taverna',    body: '#c69a62', bodyEdge: '#7a5226', ink: '#3a1420', trim: '#e2c08c', roughness: 0.95, surface: 'cortica', bump: 1.7, clearcoat: 0, sound: 'cortica' },
  { ...base, id: 'vela',      tier: 'comum',    name: 'Cera de Vela',        body: '#b8242c', bodyEdge: '#5a0c14', ink: '#ffe9b0', trim: '#e8585c', glow: '#ffb84a', glowPower: 0.6, roughness: 0.38, surface: 'vela', bump: 1.2, clearcoat: 0.3, sound: 'cera' },
  // Incomuns
  { ...base, id: 'marfim',    tier: 'incomum',  name: 'Marfim Antigo',       body: '#f1e6c8', bodyEdge: '#c3a56a', ink: '#16110d', trim: '#fff8e4', roughness: 0.45, surface: 'marfim', bump: 1.0, clearcoat: 0.35 },
  { ...base, id: 'onix',      tier: 'incomum',  name: 'Ônix Polido',         body: '#1b1b21', bodyEdge: '#050507', ink: '#fff3c4', trim: '#c9952f', roughness: 0.1, metalness: 0.18, inkMetal: true, surface: 'onix', bump: 0.8, clearcoat: 1 },
  { ...base, id: 'ametista',  tier: 'incomum',  name: 'Ametista',            body: '#8a62e0', bodyEdge: '#2e1670', ink: '#fff4d6', trim: '#e8dcff', glow: '#d8c6ff', glowPower: 0.35, roughness: 0.1, glass: true, surface: 'ametista', bump: 1.0, clearcoat: 0.8 },
  { ...base, id: 'granada',   tier: 'incomum',  name: 'Granada',             body: '#b0203a', bodyEdge: '#3a0610', ink: '#fff0b8', trim: '#f4d078', roughness: 0.08, glass: true, surface: 'granada', bump: 0.8, clearcoat: 0.9 },
  { ...base, id: 'jade',      tier: 'incomum',  name: 'Jade Imperial',       body: '#58a883', bodyEdge: '#1b5640', ink: '#f6e4a4', trim: '#dcf5e8', roughness: 0.3, metalness: 0.04, surface: 'jade', bump: 1.0, clearcoat: 0.6 },
  { ...base, id: 'fume',      tier: 'incomum',  name: 'Vidro Fumê',          body: '#2c2c3a', bodyEdge: '#07070c', ink: '#f4f6ff', trim: '#aeb6d8', glow: '#aab4ff', glowPower: 0.4, roughness: 0.07, glass: true, surface: 'fume', bump: 0.6, clearcoat: 0.9 },
  { ...base, id: 'vitral',    tier: 'incomum',  name: 'Vitral de Catedral',  body: '#3a6ad8', bodyEdge: '#14161c', ink: '#fff6d8', trim: '#2a2c34', glow: '#ffe6a0', glowPower: 0.5, roughness: 0.08, glass: true, surface: 'vitral', bump: 1.4, clearcoat: 0.9, sound: 'vidro' },
  { ...base, id: 'pergaminho', tier: 'incomum', name: 'Pergaminho Antigo',   body: '#e6d3a4', bodyEdge: '#9a7a44', ink: '#2a1608', trim: '#7a2418', roughness: 0.9, surface: 'pergaminho', bump: 1.1, clearcoat: 0, sound: 'papel' },
  // Raras
  { ...base, id: 'gelo',      tier: 'rara',     name: 'Gelo Eterno',         body: '#d6f0fc', bodyEdge: '#5b9fcf', ink: '#1b5fae', trim: '#ffffff', glow: '#7fdcff', glowPower: 0.45, roughness: 0.1, glass: true, surface: 'gelo', bump: 1.2, clearcoat: 0.8 },
  { ...base, id: 'magma',     tier: 'rara',     name: 'Magma',               body: '#241c26', bodyEdge: '#09070b', ink: '#ffb347', trim: '#ff7a18', glow: '#ff7a18', glowPower: 0.95, roughness: 0.9, metalness: 0.05, surface: 'magma', bump: 1.8, clearcoat: 0 },
  { ...base, id: 'meteorito', tier: 'rara',     name: 'Meteorito',           body: '#8b8d95', bodyEdge: '#2f3036', ink: '#f4f6fb', trim: '#b0b3bc', roughness: 0.45, metalness: 0.85, inkMetal: true, surface: 'meteorito', bump: 1.6, clearcoat: 0.1 },
  { ...base, id: 'fungo',     tier: 'rara',     name: 'Fungo Brilhante',     body: '#4a3622', bodyEdge: '#150e08', ink: '#d8ffe8', trim: '#5ad8a4', glow: '#6dffc4', glowPower: 0.7, roughness: 0.88, surface: 'fungo', bump: 1.6, clearcoat: 0 },
  { ...base, id: 'ambar',     tier: 'rara',     name: 'Âmbar',               body: '#f4b52e', bodyEdge: '#a9580a', ink: '#4a2204', trim: '#ffe0a0', roughness: 0.06, resin: true, toy: 'inseto', surface: 'ambar', bump: 0.4, clearcoat: 1 },
  { ...base, id: 'sino',      tier: 'rara',     name: 'Bronze de Sino',      body: '#b98a3e', bodyEdge: '#4a3210', ink: '#2a1a06', trim: '#e8c070', roughness: 0.34, metalness: 0.92, inkMetal: true, surface: 'sino', bump: 1.5, clearcoat: 0.15, sound: 'sino' },
  { ...base, id: 'relogio',   tier: 'rara',     name: 'Engrenagens de Relógio', body: '#c9a24a', bodyEdge: '#3a2a12', ink: '#1a1208', trim: '#f0d890', roughness: 0.3, metalness: 0.9, inkMetal: true, surface: 'relogio', bump: 1.7, clearcoat: 0.2, sound: 'relogio' },
  { ...base, id: 'perola',    tier: 'rara',     name: 'Madrepérola',         body: '#f2ecf4', bodyEdge: '#b4a8c8', ink: '#4a3a6a', trim: '#ffffff', roughness: 0.16, metalness: 0.1, surface: 'perola', bump: 0.8, clearcoat: 1, iridescence: 0.85, sound: 'perola' },
  // Épicas
  { ...base, id: 'morte',     tier: 'epica',    name: 'Dado da Morte',       body: '#2a2124', bodyEdge: '#0a0708', ink: '#ff4a58', trim: '#e01828', glow: '#ff2030', glowPower: 0.8, roughness: 0.55, metalness: 0.05, surface: 'morte', bump: 1.5, clearcoat: 0.1 },
  { ...base, id: 'vagalumes', tier: 'epica',    name: 'Resina de Vaga-lumes', body: '#1c4a52', bodyEdge: '#06161c', ink: '#fff0a8', trim: '#7affd0', glow: '#e8ff80', glowPower: 0.85, roughness: 0.05, resin: true, toy: 'vagalumes', surface: 'vagalumes', bump: 0.3, clearcoat: 1 },
  { ...base, id: 'runico',    tier: 'epica',    name: 'Ouro Rúnico',         body: '#e0ac3c', bodyEdge: '#7a5210', ink: '#5a3604', trim: '#ffe08a', glow: '#ffb44a', glowPower: 0.8, roughness: 0.26, metalness: 0.95, inkMetal: true, surface: 'runico', bump: 1.4, clearcoat: 0.3 },
  { ...base, id: 'tempestade', tier: 'epica',   name: 'Nuvem de Tempestade', body: '#3a4250', bodyEdge: '#0c0f16', ink: '#eaf4ff', trim: '#9ad0ff', glow: '#bfe4ff', glowPower: 0.95, roughness: 0.8, surface: 'tempestade', bump: 1.3, clearcoat: 0, glowAnim: 'raio', sound: 'trovao' },
  { ...base, id: 'olho',      tier: 'epica',    name: 'Olho do Abismo',      body: '#3a0c1c', bodyEdge: '#0a0206', ink: '#ffe9d0', trim: '#ff5a7a', glow: '#ff3a6a', glowPower: 0.6, roughness: 0.05, resin: true, toy: 'olho', surface: 'olho', bump: 0.4, clearcoat: 1, sound: 'olho' },
  { ...base, id: 'galaxia',   tier: 'epica',    name: 'Poeira de Galáxia',   body: '#1a1442', bodyEdge: '#04030e', ink: '#ffffff', trim: '#b8a6ff', glow: '#c8b8ff', glowPower: 0.8, roughness: 0.05, resin: true, toy: 'planeta', surface: 'galaxia', bump: 0.3, clearcoat: 1, sound: 'cosmos' },
  // Lendárias
  { ...base, id: 'vortice',   tier: 'lendaria', name: 'Pedra do Vórtice',    body: '#2a2030', bodyEdge: '#08060c', ink: '#ffe9a8', trim: '#d9363e', glow: '#ff3b45', glowPower: 0.9, roughness: 0.5, metalness: 0.2, inkMetal: true, surface: 'vortice', bump: 1.4, clearcoat: 0.2 },
  { ...base, id: 'dragao',    tier: 'lendaria', name: 'Escama de Dragão',    body: '#7a1410', bodyEdge: '#1a0404', ink: '#ffe6a0', trim: '#ff9a2a', glow: '#ff7a1a', glowPower: 0.9, roughness: 0.4, metalness: 0.35, inkMetal: true, surface: 'dragao', bump: 2.0, clearcoat: 0.5, glowAnim: 'brasa', sound: 'dragao' },
  { ...base, id: 'espelho',   tier: 'lendaria', name: 'Espelho Partido',     body: '#dfe6f0', bodyEdge: '#5a6474', ink: '#10141c', trim: '#ffffff', glow: '#cfe4ff', glowPower: 0.4, roughness: 0.03, metalness: 1, surface: 'espelho', bump: 1.6, clearcoat: 1, sound: 'espelho' },
  // Míticas (acima da lendária: os dados que quase ninguém tem)
  { ...base, id: 'vazio',     tier: 'mitica',   name: 'Fragmento do Vazio',  body: '#050408', bodyEdge: '#000000', ink: '#f4ecff', trim: '#a070ff', glow: '#b48cff', glowPower: 1, roughness: 0.98, surface: 'vazio', bump: 0.9, clearcoat: 0, glowAnim: 'pulso', sound: 'vazio' },
  { ...base, id: 'prisma',    tier: 'mitica',   name: 'Prisma de Todas as Cores', body: '#f4f6ff', bodyEdge: '#9aa4d8', ink: '#1a1440', trim: '#ffffff', glow: '#ffffff', glowPower: 0.55, roughness: 0.04, glass: true, surface: 'prisma', bump: 1.0, clearcoat: 1, iridescence: 1, glowAnim: 'pulso', sound: 'prisma' },
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
  // A coleção (os conjuntos ganhos por conquista; as regras ficam em features/collection)
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
