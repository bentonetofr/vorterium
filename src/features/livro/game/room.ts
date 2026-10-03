import type { Dir, PanelId } from '../livroNet'
import { spriteCastical, spriteEstante, spriteFloorCandle, spriteMesa, spritePedestal, spriteRetrato } from './art'

// ────────────────────────────────────────────────────────
// A biblioteca: onde fica cada coisa (em pixels nativos, 384×216), o que
// bloqueia o caminho e de onde dá pra usar cada objeto.
//   Norte (parede)  → Castiçal        Leste → Retrato (no cavalete)
//   Centro          → Pedestal        Oeste → Estante
//   Sul (mesa)      → Astrolábio
// ────────────────────────────────────────────────────────

export interface Rect { x: number; y: number; w: number; h: number }

export interface Interactable<Id extends string = PanelId> {
  id:       Id
  name:     string
  /** Onde o desenho fica (também é a área do mouse). */
  at:       { x: number; y: number }
  sprite:   HTMLCanvasElement
  /** Linha do "pé" do objeto (quem tem o pé mais embaixo é desenhado na frente). */
  base:     number
  /** Onde o boneco precisa estar pra usar. */
  zone:     Rect
  /** Pra onde o boneco anda quando clicam de longe, e pra onde ele olha. */
  approach: { x: number; y: number; face: Dir }
  /** Onde ficam o nome e a seta (relativo ao desenho). Sem isso: centro, logo acima. */
  tag?:     { x: number; y: number }
}

/** Limites do chão pros pés (o boneco não sai disso). */
export const FLOOR = { x0: 22, y0: 64, x1: 362, y1: 203 }

/** Pés: caixinha de 10×5 em volta do ponto (x, y). */
export const FEET = { w: 10, h: 5 }

export function buildRoom() {
  const objects: Interactable[] = [
    {
      id: 'castical',
      name: 'Castiçal',
      at: { x: 164, y: 16 },
      sprite: spriteCastical(),
      base: 58,
      zone: { x: 158, y: 62, w: 68, h: 22 },
      approach: { x: 192, y: 74, face: 'up' },
    },
    {
      id: 'retrato',
      name: 'Retrato',
      at: { x: 316, y: 70 },
      sprite: spriteRetrato(),
      base: 137,
      zone: { x: 312, y: 136, w: 52, h: 24 },
      approach: { x: 338, y: 150, face: 'up' },
    },
    {
      id: 'estante',
      name: 'Estante',
      at: { x: 21, y: 62 },
      sprite: spriteEstante(),
      base: 137,
      zone: { x: 18, y: 136, w: 54, h: 24 },
      approach: { x: 44, y: 150, face: 'up' },
    },
    {
      id: 'astrolabio',
      name: 'Astrolábio',
      at: { x: 158, y: 146 },
      sprite: spriteMesa(),
      base: 187,
      zone: { x: 156, y: 186, w: 72, h: 18 },
      approach: { x: 192, y: 197, face: 'up' },
    },
    {
      id: 'pedestal',
      name: 'Pedestal',
      at: { x: 174, y: 82 },
      sprite: spritePedestal(),
      base: 125,
      zone: { x: 166, y: 124, w: 52, h: 20 },
      approach: { x: 192, y: 135, face: 'up' },
    },
  ]

  /** Castiçais de chão: enfeite, mas também luz e obstáculo. */
  const floorCandle = spriteFloorCandle()
  const candles = [
    { x: 136, y: 92, sprite: floorCandle },
    { x: 239, y: 92, sprite: floorCandle },
  ]

  /** O que bloqueia os pés (além dos limites do chão). */
  const obstacles: Rect[] = [
    { x: 22, y: 126, w: 44, h: 12 },   // estante
    { x: 320, y: 127, w: 37, h: 11 },  // cavalete do retrato
    { x: 180, y: 113, w: 24, h: 12 },  // pedestal
    { x: 160, y: 168, w: 64, h: 19 },  // mesa do astrolábio
    { x: 137, y: 104, w: 7, h: 4 },    // castiçais de chão
    { x: 240, y: 104, w: 7, h: 4 },
  ]

  return { objects, candles, obstacles }
}

export type Room = ReturnType<typeof buildRoom>

/** Onde cada jogador aparece (Capa Azul, Capa Vermelha). */
export const SPAWNS: { x: number; y: number; d: Dir }[] = [
  { x: 108, y: 182, d: 'right' },
  { x: 276, y: 182, d: 'left' },
]

export function inRect(x: number, y: number, r: Rect) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
}

export function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}
