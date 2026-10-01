import type { CSSProperties } from 'react'
import { BOARD_FONTS, fontStack } from '../../../shared/lib/googleFonts'

// ────────────────────────────────────────────────────────
// Papéis antigos dos Documentos da Mesa. Dois tipos de textura:
//  - fotos de papel antigo (domínio público/CC0, em /public/textures/papel);
//  - papéis gerados aqui mesmo (cor de base + fibras + manchas), leves e
//    com variação infinita (cada página tem a sua "semente").
// Por cima de qualquer um, efeitos que se combinam: bordas queimadas,
// rasgos, dobras e manchas. Tudo é CSS (gradientes, SVG de ruído, máscara
// e recorte), então a folha fica nítida em qualquer tamanho.
// ────────────────────────────────────────────────────────

export interface DocStyle {
  /** Id da textura (PAPERS). */
  texture: string
  /** Bordas queimadas: 0 nada, 1 leve, 2 forte. */
  burn:    number
  /** Bordas rasgadas. */
  torn:    boolean
  /** Marcas de dobra (em três). */
  folds:   boolean
  /** Manchas: 0 nada, 1 poucas, 2 muitas. */
  stains:  number
  /** Fonte manuscrita (nome da galeria do site). */
  font:    string
  /** Id da tinta (INKS). */
  ink:     string
  /** Tamanho da letra (px na folha de 600 px de largura). */
  size:    number
  /** Livro: cor da capa (id de COVERS). */
  cover:   string
  /** Livro: nome do autor gravado na capa (vazio = sem autor). */
  author:  string
}

export const DEFAULT_STYLE: DocStyle = {
  texture: 'foto-1', burn: 0, torn: false, folds: false, stains: 1,
  font: 'La Belle Aurore', ink: 'sepia', size: 26, cover: 'couro', author: '',
}

export const MAX_AUTHOR = 80

// ── Texturas ────────────────────────────────────────────

export interface Paper {
  id:    string
  label: string
  /** Foto (url) ou papel gerado (cor de base, cor das fibras, escurecimento das bordas). */
  photo?: string
  base?:  string
  fiber?: string
  edge?:  string
}

const PHOTO = (n: string, label: string): Paper => ({ id: `foto-${n}`, label, photo: `/textures/papel/papel-antigo-${n}.webp` })

export const PAPERS: Paper[] = [
  PHOTO('1', 'Papel envelhecido'),
  PHOTO('2', 'Papel manchado'),
  PHOTO('3', 'Papel amarelado'),
  PHOTO('4', 'Papel gasto'),
  PHOTO('6', 'Papel claro antigo'),
  PHOTO('7', 'Papel desbotado'),
  { id: 'foto-pergaminho', label: 'Pergaminho (foto)', photo: '/textures/papel/pergaminho-1.webp' },
  { id: 'pergaminho', label: 'Pergaminho', base: '#ead9b0', fiber: '#b89a63', edge: 'rgba(120, 80, 30, 0.35)' },
  { id: 'pergaminho-velho', label: 'Pergaminho velho', base: '#d9bf87', fiber: '#9c7a42', edge: 'rgba(95, 55, 15, 0.5)' },
  { id: 'cha', label: 'Manchado de chá', base: '#d8b77f', fiber: '#a67b3f', edge: 'rgba(110, 60, 15, 0.55)' },
  { id: 'cafe', label: 'Manchado de café', base: '#c9a06a', fiber: '#8a5d2c', edge: 'rgba(80, 40, 10, 0.6)' },
  { id: 'velino', label: 'Velino claro', base: '#f1e6cc', fiber: '#c9b48a', edge: 'rgba(140, 100, 50, 0.25)' },
  { id: 'mofo', label: 'Úmido e mofado', base: '#cdbf95', fiber: '#7d7a4e', edge: 'rgba(70, 75, 40, 0.55)' },
  { id: 'cinza', label: 'Papel de cinzas', base: '#c8bda8', fiber: '#7b7064', edge: 'rgba(40, 35, 30, 0.55)' },
  { id: 'couro', label: 'Couro curtido', base: '#a7764a', fiber: '#5e3a1c', edge: 'rgba(40, 20, 5, 0.65)' },
  { id: 'sangue', label: 'Manchado de sangue', base: '#dcc39a', fiber: '#9b6a45', edge: 'rgba(90, 20, 15, 0.45)' },
]

export const paperOf = (id: string): Paper => PAPERS.find((p) => p.id === id) ?? PAPERS[0]

export interface Ink { id: string; label: string; color: string }
export const INKS: Ink[] = [
  { id: 'sepia',   label: 'Sépia',           color: '#4a2f1a' },
  { id: 'ferro',   label: 'Ferrogálica',     color: '#1f1a17' },
  { id: 'sangue',  label: 'Sangue',          color: '#6b1010' },
  { id: 'anil',    label: 'Anil',            color: '#1d2b4f' },
  { id: 'musgo',   label: 'Verde-musgo',     color: '#2f3b1d' },
  { id: 'ouro',    label: 'Dourada',         color: '#7d5a12' },
  { id: 'carvao',  label: 'Carvão',          color: '#3a3836' },
]
export const inkOf = (id: string): string => (INKS.find((i) => i.id === id) ?? INKS[0]).color

export interface Cover { id: string; label: string; color: string; trim: string }
export const COVERS: Cover[] = [
  { id: 'couro',   label: 'Couro marrom',   color: '#5b3518', trim: '#c9a24a' },
  { id: 'vinho',   label: 'Couro vinho',    color: '#4d1517', trim: '#d1a650' },
  { id: 'negro',   label: 'Couro negro',    color: '#1f1a17', trim: '#b9933f' },
  { id: 'musgo',   label: 'Couro musgo',    color: '#2c3520', trim: '#c2a35a' },
  { id: 'cinza',   label: 'Couro cinza',    color: '#3c3a37', trim: '#bcae8c' },
]
export const coverOf = (id: string): Cover => COVERS.find((c) => c.id === id) ?? COVERS[0]

/** Fontes de escrita à mão e caligrafia da galeria do site (+ algumas antigas). */
const OLD_HANDS = ['IM Fell English', 'IM Fell DW Pica', 'Almendra', 'Fondamento', 'MedievalSharp', 'Uncial Antiqua', 'UnifrakturMaguntia', 'Grenze Gotisch', 'Texturina', 'Jacquarda Bastarda 9']
export const HAND_FONTS: string[] = [
  ...BOARD_FONTS.filter((f) => f.cat === 'manuscrita' || f.cat === 'mao').map((f) => f.family),
  ...OLD_HANDS.filter((f) => BOARD_FONTS.some((b) => b.family === f)),
]
export const handStack = (font: string): string => fontStack(font) ?? `"${DEFAULT_STYLE.font}", cursive`

// ── Gerador (semente → sempre o mesmo resultado) ────────

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`

/** Fibras/granulado do papel (ruído fractal em tom de sépia). */
function fiberLayer(seed: number, color: string, opacity: number): string {
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><filter id="f"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.6" numOctaves="3" seed="${seed % 997}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${opacity} 0"/></filter><rect width="100%" height="100%" fill="${color}" filter="url(#f)"/></svg>`,
  )
}

/** Manchas grandes e suaves (nuvens de umidade) — dão o "velho" ao papel gerado. */
function cloudLayer(seed: number, color: string): string {
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" preserveAspectRatio="none"><filter id="c"><feTurbulence type="fractalNoise" baseFrequency="0.0035 0.005" numOctaves="3" seed="${(seed * 7) % 991}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.32 -0.06"/></filter><rect width="100%" height="100%" fill="${color}" filter="url(#c)"/></svg>`,
  )
}

/** Manchas: anéis de copo, pingos e borrões, em lugares sorteados pela semente. */
function stainLayers(seed: number, amount: number, blood: boolean): string[] {
  if (amount <= 0) return []
  const r = rng(seed * 31 + 7)
  const n = amount === 1 ? 3 : 7
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const x = Math.round(r() * 100), y = Math.round(r() * 100)
    const s = Math.round(4 + r() * (amount === 1 ? 10 : 16))
    const a = (0.08 + r() * 0.14).toFixed(2)
    const c = blood && i % 2 === 0 ? `rgba(110, 15, 10, ${a})` : `rgba(110, 70, 25, ${a})`
    if (r() < 0.35) {
      // anel (copo/caneca)
      out.push(`radial-gradient(circle at ${x}% ${y}%, transparent ${s - 1}%, ${c} ${s}%, transparent ${s + 1.2}%)`)
    } else {
      out.push(`radial-gradient(ellipse ${s}% ${Math.round(s * (0.6 + r() * 0.8))}% at ${x}% ${y}%, ${c}, transparent 70%)`)
    }
  }
  return out
}

/** Dobras: vincos claros/escuros a 1/3 e 2/3 da altura e no meio da largura. */
function foldLayers(): string[] {
  const crease = (dir: string, at: number) =>
    `linear-gradient(${dir}, transparent calc(${at}% - 3px), rgba(0, 0, 0, 0.09) calc(${at}% - 1px), rgba(255, 255, 255, 0.28) ${at}%, rgba(0, 0, 0, 0.05) calc(${at}% + 2px), transparent calc(${at}% + 5px))`
  return [crease('to bottom', 33.3), crease('to bottom', 66.6), crease('to right', 50)]
}

/** Contorno irregular (queimado/gasto) — máscara: o que é branco aparece. */
function burnMask(seed: number, strength: number): string {
  const inset = strength >= 2 ? 22 : 12
  const scale = strength >= 2 ? 34 : 18
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" preserveAspectRatio="none"><filter id="b" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="${(seed * 13) % 977}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/></filter><rect x="${inset}" y="${inset}" width="${600 - inset * 2}" height="${800 - inset * 2}" rx="6" fill="white" filter="url(#b)"/></svg>`,
  )
}

/** Rasgos: borda serrilhada em dois lados (sorteados), em % da folha. */
function tornClip(seed: number): string {
  const r = rng(seed * 17 + 3)
  const sides = [r() < 0.7, r() < 0.4, r() < 0.7, r() < 0.4] // cima, direita, baixo, esquerda
  if (!sides.some(Boolean)) sides[0] = true
  const jag = (len: number, along: (t: number, d: number) => [number, number]) => {
    const pts: string[] = []
    const steps = 26
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * len
      const d = 0.4 + r() * 2.2
      const [x, y] = along(t, d)
      pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`)
    }
    return pts
  }
  const pts: string[] = []
  pts.push(...(sides[0] ? jag(100, (t, d) => [t, d]) : ['0% 0%', '100% 0%']))
  pts.push(...(sides[1] ? jag(100, (t, d) => [100 - d, t]) : ['100% 0%', '100% 100%']))
  pts.push(...(sides[2] ? jag(100, (t, d) => [100 - t, 100 - d]) : ['100% 100%', '0% 100%']))
  pts.push(...(sides[3] ? jag(100, (t, d) => [d, 100 - t]) : ['0% 100%', '0% 0%']))
  return `polygon(${pts.join(', ')})`
}

/** Estilo da folha (fundo, sombras, máscara e recorte) pra uma página. */
export function paperCss(style: DocStyle, seed: number): CSSProperties {
  const paper = paperOf(style.texture)
  const layers: string[] = []
  layers.push(...stainLayers(seed, style.stains, paper.id === 'sangue'))
  if (style.folds) layers.push(...foldLayers())
  const css: CSSProperties = {}
  if (paper.photo) {
    // Foto: mais um pouco de granulado; cada página pega um pedaço diferente.
    layers.push(fiberLayer(seed, '#5a3a14', 0.18))
    layers.push(`url("${paper.photo}")`)
    const r = rng(seed)
    css.backgroundSize = [...layers.slice(0, -2).map(() => '100% 100%'), '300px 300px', '140% auto'].join(', ')
    css.backgroundPosition = [...layers.slice(0, -2).map(() => '0 0'), '0 0', `${Math.round(r() * 100)}% ${Math.round(r() * 100)}%`].join(', ')
    css.backgroundColor = '#d9c39a'
  } else {
    layers.push('radial-gradient(ellipse at 50% 45%, rgba(255, 248, 225, 0.28), transparent 70%)')
    layers.push(cloudLayer(seed, paper.edge ?? 'rgba(100,60,20,.4)'))
    layers.push(fiberLayer(seed, paper.fiber ?? '#9c7a42', 0.35))
    css.backgroundSize = [...layers.slice(0, -2).map(() => '100% 100%'), '100% 100%', '300px 300px'].join(', ')
    css.backgroundColor = paper.base
  }
  css.backgroundImage = layers.join(', ')
  // Só o granulado se repete (azulejo de 300 px); manchas, dobras e a foto não.
  const fiberAt = paper.photo ? layers.length - 2 : layers.length - 1
  css.backgroundRepeat = layers.map((_, i) => (i === fiberAt ? 'repeat' : 'no-repeat')).join(', ')
  // Bordas mais escuras (o papel envelhece de fora pra dentro) — e queimadas, se pedido.
  const edge = paper.edge ?? 'rgba(110, 70, 25, 0.35)'
  const burnShadow = style.burn >= 2
    ? 'inset 0 0 22px 6px rgba(35, 14, 0, 0.85), inset 0 0 60px 18px rgba(90, 40, 5, 0.45)'
    : style.burn === 1 ? 'inset 0 0 14px 3px rgba(45, 18, 0, 0.7), inset 0 0 40px 10px rgba(100, 50, 10, 0.3)' : ''
  css.boxShadow = [`inset 0 0 70px ${edge}`, burnShadow].filter(Boolean).join(', ')
  if (style.burn > 0) {
    const mask = burnMask(seed, style.burn)
    css.maskImage = mask
    css.WebkitMaskImage = mask
    css.maskSize = '100% 100%'
    css.WebkitMaskSize = '100% 100%'
  }
  if (style.torn) css.clipPath = tornClip(seed)
  return css
}

/** Mistura o estilo do documento com o da página (se ela tiver o seu). */
export function pageStyle(doc: DocStyle, own?: Partial<DocStyle>): DocStyle {
  return own ? { ...doc, ...own } : doc
}

/** Semente estável de uma página (muda por documento e por página). */
export function pageSeed(docId: string, index: number): number {
  let h = 2166136261
  for (const ch of `${docId}:${index}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return (h >>> 0) % 100000
}

/** Estilo próprio de uma página vindo do banco: só os campos que ela tem, já validados. */
export function normalizePageStyle(raw: unknown): Partial<DocStyle> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const full = normalizeStyle(raw)
  const own: Partial<DocStyle> = {}
  for (const key of Object.keys(raw) as (keyof DocStyle)[]) {
    if (key in full && key !== 'cover' && key !== 'author') (own as Record<string, unknown>)[key] = full[key]
  }
  return Object.keys(own).length ? own : undefined
}

/** Completa um estilo vindo do banco (campos faltando viram o padrão). */
export function normalizeStyle(raw: unknown): DocStyle {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<DocStyle>
  return {
    texture: PAPERS.some((p) => p.id === s.texture) ? s.texture! : DEFAULT_STYLE.texture,
    burn:    s.burn === 1 || s.burn === 2 ? s.burn : 0,
    torn:    !!s.torn,
    folds:   !!s.folds,
    stains:  s.stains === 0 || s.stains === 2 ? s.stains : s.stains === 1 ? 1 : DEFAULT_STYLE.stains,
    font:    typeof s.font === 'string' && HAND_FONTS.includes(s.font) ? s.font : DEFAULT_STYLE.font,
    ink:     INKS.some((i) => i.id === s.ink) ? s.ink! : DEFAULT_STYLE.ink,
    size:    typeof s.size === 'number' && s.size >= 14 && s.size <= 60 ? s.size : DEFAULT_STYLE.size,
    cover:   COVERS.some((c) => c.id === s.cover) ? s.cover! : DEFAULT_STYLE.cover,
    author:  typeof s.author === 'string' ? s.author.slice(0, MAX_AUTHOR) : '',
  }
}
