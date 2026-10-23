// ────────────────────────────────────────────────────────
// Conjuntos de dados: cor do corpo, dos números e do friso, e como o material
// reflete a luz. Cada jogador escolhe o seu; a mesa vê os dados de cada um
// na cor dele. O padrão é a pedra do Vórtice (escura, números dourados,
// friso vermelho que brilha).
// ────────────────────────────────────────────────────────

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
  surface?:  'wood' | 'stone' | 'plastic'
  /** Força do relevo (padrão 1) e do verniz (padrão pelo material). */
  bump?:     number
  clearcoat?: number
}

export const DICE_SKINS: readonly DiceSkin[] = [
  { id: 'vortice',   name: 'Pedra do Vórtice', body: '#1d1a24', bodyEdge: '#0c0a10', ink: '#e8b85c', trim: '#d9363e', glow: '#ff3b45', glowPower: 0.55, roughness: 0.55, metalness: 0.15, inkMetal: true },
  { id: 'obsidiana', name: 'Obsidiana',        body: '#121218', bodyEdge: '#050507', ink: '#d9dce6', trim: '#6b7084', glow: '#9fb4ff', glowPower: 0.25, roughness: 0.18, metalness: 0.35, inkMetal: true },
  { id: 'vinho',     name: 'Vinho',            body: '#6a1220', bodyEdge: '#2e050c', ink: '#f3d48c', trim: '#f3d48c', glow: '#ffcf7a', glowPower: 0.25, roughness: 0.35, metalness: 0.1, inkMetal: true },
  { id: 'osso',      name: 'Osso',             body: '#e9dfc9', bodyEdge: '#b9a782', ink: '#3b1d12', trim: '#7d5a3c', glow: '#000000', glowPower: 0, roughness: 0.7, metalness: 0, inkMetal: false },
  { id: 'cristal',   name: 'Cristal Lilás',    body: '#8f7ae6', bodyEdge: '#4b3aa0', ink: '#ffffff', trim: '#e7e0ff', glow: '#c9b8ff', glowPower: 0.35, roughness: 0.08, metalness: 0, inkMetal: false, glass: true },
  { id: 'ouro',      name: 'Ouro',             body: '#c9952f', bodyEdge: '#7a5414', ink: '#2a1606', trim: '#fff0b8', glow: '#000000', glowPower: 0, roughness: 0.28, metalness: 0.9, inkMetal: false },
  // Conjuntos detalhados (superfície pintada, com relevo): ver docs/superpowers/specs/2026-10-22-colecao-de-dados.md
  { id: 'madeira',   name: 'Madeira Velha',    body: '#76492a', bodyEdge: '#2b190a', ink: '#120801', trim: '#6b4423', glow: '#000000', glowPower: 0, roughness: 0.9, metalness: 0, inkMetal: false, surface: 'wood', bump: 1.6, clearcoat: 0 },
  { id: 'granito',   name: 'Granito',          body: '#6c6f77', bodyEdge: '#32353b', ink: '#1b1e23', trim: '#2c2f35', glow: '#000000', glowPower: 0, roughness: 0.82, metalness: 0.04, inkMetal: false, surface: 'stone', bump: 1.4, clearcoat: 0.04 },
  { id: 'plastico',  name: 'Plástico Marmorizado', body: '#1f50d8', bodyEdge: '#0a1f70', ink: '#ffffff', trim: '#cfe0ff', glow: '#000000', glowPower: 0, roughness: 0.14, metalness: 0, inkMetal: false, surface: 'plastic', bump: 0.6, clearcoat: 0.95 },
  { id: 'jade',      name: 'Jade',             body: '#1f6b4f', bodyEdge: '#0a3324', ink: '#f2e7c9', trim: '#bfe8c9', glow: '#7dffc0', glowPower: 0.2, roughness: 0.3, metalness: 0.05, inkMetal: false },
]

export const DEFAULT_SKIN = 'vortice'

export function getSkin(id: string | null | undefined): DiceSkin {
  return DICE_SKINS.find((s) => s.id === id) ?? DICE_SKINS[0]
}
