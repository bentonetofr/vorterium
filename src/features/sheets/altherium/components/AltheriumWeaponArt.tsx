import type { ReactNode } from 'react'
import { findWeapon } from '../constants/altheriumItems'
import type { AltheriumInventoryItem } from '../../../../shared/types'

// ────────────────────────────────────────────────────────
// Armas no manequim — cada arma do catálogo tem o seu desenho. As duas
// primeiras do inventário vão nas mãos, a terceira nas costas.
//
// Cada desenho está no referencial da mão: (0, 0) é o centro do punho
// fechado e +y aponta pra ponta da arma (lâmina, cabeça, ponta da lança).
// O cabo sobra um pouco pra -y, por cima do pulso. Quem posiciona é o
// AltheriumBodyDiagram.
// ────────────────────────────────────────────────────────

export type WeaponShape =
  | 'machado_duplo' | 'martelo' | 'lanca_pesada' | 'maca_ossos' | 'montante' | 'tridente' | 'sabre'
  | 'adaga_serrilhada' | 'espada_curta' | 'adaga_gancho' | 'clava' | 'porrete' | 'lamina' | 'espada_anel'
  | 'lanca' | 'adaga' | 'faca' | 'machadinha' | 'mangual' | 'bumerangue'
  | 'arco_curto' | 'arco_longo' | 'besta' | 'besta_pesada' | 'dardo'

/** Desenho de cada arma do catálogo. Lâminas Gêmeas são duas — uma em cada mão. */
const CATALOG_SHAPES: Record<string, WeaponShape[]> = {
  machado_duas_laminas:       ['machado_duplo'],
  martelo_impacto:            ['martelo'],
  lanca_pesada:               ['lanca_pesada'],
  maca_ossos:                 ['maca_ossos'],
  espada_extremamente_pesada: ['montante'],
  tridente_batalha:           ['tridente'],
  sabre:                      ['sabre'],
  adaga_serrilhada:           ['adaga_serrilhada'],
  espada_curta_reta:          ['espada_curta'],
  adaga_gancho:               ['adaga_gancho'],
  clava_espinosa:             ['clava'],
  porrete_pedra:              ['porrete'],
  laminas_gemeas:             ['lamina', 'lamina'],
  espada_punho_circular:      ['espada_anel'],
  lanca_arremesso:            ['lanca'],
  adaga_arremesso:            ['adaga'],
  faca_arremesso:             ['faca'],
  machado_arremesso:          ['machadinha'],
  bola_ferro_corrente:        ['mangual'],
  boomerangue_aflado:         ['bumerangue'],
  arco_curto:                 ['arco_curto'],
  arco_longo:                 ['arco_longo'],
  besta_leve:                 ['besta'],
  besta_pesada:               ['besta_pesada'],
  dardo_envenenado:           ['dardo'],
}

// Arma personalizada: adivinha o desenho pelo nome (a ordem importa —
// "machado de duas lâminas" tem que cair no machado, não na lâmina).
const NAME_SHAPES: [RegExp, WeaponShape[]][] = [
  [/besta.*pesad/, ['besta_pesada']],
  [/besta/, ['besta']],
  [/arco.*long/, ['arco_longo']],
  [/arco/, ['arco_curto']],
  [/tridente/, ['tridente']],
  [/dardo|zarabatana/, ['dardo']],
  [/bumerang|boomerang/, ['bumerangue']],
  [/corrente|mangual|bola/, ['mangual']],
  [/martel|marreta/, ['martelo']],
  [/\bmaca\b|\bmacas\b|osso/, ['maca_ossos']],
  [/machad.*(duas|dupl)|(duas|dupl).*machad/, ['machado_duplo']],
  [/machad|acha\b|\bbardiche/, ['machadinha']],
  [/clava|tacape/, ['clava']],
  [/porrete|pedra/, ['porrete']],
  [/lanca.*pesad|alabarda|glaive/, ['lanca_pesada']],
  [/lanca|azagaia|pique|venabulo/, ['lanca']],
  [/sabre|cimitarra|katana|alfanje/, ['sabre']],
  [/gancho|foice|garra/, ['adaga_gancho']],
  [/serrilh/, ['adaga_serrilhada']],
  [/faca|kunai/, ['faca']],
  [/adaga|punhal/, ['adaga']],
  [/laminas.*gemeas|gemeas/, ['lamina', 'lamina']],
  [/lamina/, ['lamina']],
  [/espada.*(pesad|grande|longa)|montante|espadao|claymore/, ['montante']],
  [/espada.*(anel|circular)/, ['espada_anel']],
  [/espada/, ['espada_curta']],
]

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function customShapes(inv: AltheriumInventoryItem): WeaponShape[] {
  const name = normalize(inv.custom_name ?? '')
  const match = NAME_SHAPES.find(([re]) => re.test(name))
  if (match) return match[1]
  // Sem pista no nome: pelo alcance e pelo tipo de dano.
  if (inv.custom_range === 'medio' || inv.custom_range === 'longo') return ['arco_curto']
  if (inv.custom_damage_type === 'impacto') return ['clava']
  if (inv.custom_damage_type === 'perfurante') return ['lanca']
  return ['espada_curta']
}

/** Quantas armas o manequim carrega: uma em cada mão e uma nas costas. */
export const MAX_CARRIED_WEAPONS = 3

/** Armas do inventário, na ordem em que aparecem, já como desenhos — cada
 *  unidade conta (duas adagas = uma em cada mão). No máximo 3. */
function shapesOf(inv: AltheriumInventoryItem): WeaponShape[] {
  if (inv.item_type !== 'arma') return []
  if (inv.custom_name !== null) return customShapes(inv)
  return findWeapon(inv.item_id) ? CATALOG_SHAPES[inv.item_id] ?? ['espada_curta'] : []
}

export function carriedWeapons(inventory: AltheriumInventoryItem[]): WeaponShape[] {
  const out: WeaponShape[] = []
  for (const inv of inventory) {
    const shapes = shapesOf(inv)
    for (let n = 0; n < Math.min(inv.quantity, MAX_CARRIED_WEAPONS); n++) out.push(...shapes)
    if (out.length >= MAX_CARRIED_WEAPONS) break
  }
  return out.slice(0, MAX_CARRIED_WEAPONS)
}

export type QuiverAmmo = 'flechas' | 'virotes'

/** Quem tem arco ou besta no inventário leva uma aljava nas costas — de
 *  flechas (arco, mesmo que também tenha besta) ou de virotes (só besta). */
export function quiverAmmo(inventory: AltheriumInventoryItem[]): QuiverAmmo | null {
  const shapes = inventory.flatMap(shapesOf)
  if (shapes.some((s) => s === 'arco_curto' || s === 'arco_longo')) return 'flechas'
  if (shapes.some((s) => s === 'besta' || s === 'besta_pesada')) return 'virotes'
  return null
}

/**
 * Como a arma vai nas costas: o que sai por cima do ombro é a parte que
 * faz reconhecer a arma — o punho nas espadas e adagas, a cabeça nos
 * machados, martelos e lanças, meio arco nos arcos. `reach` é o ponto do
 * desenho (em y, no referencial da mão) que fica bem na saída do ombro.
 */
const BACK_MOUNT: Record<WeaponShape, { headUp: boolean; reach: number }> = {
  montante:         { headUp: false, reach: 8 },
  espada_curta:     { headUp: false, reach: 8 },
  espada_anel:      { headUp: false, reach: 8 },
  sabre:            { headUp: false, reach: 7 },
  lamina:           { headUp: false, reach: 7 },
  adaga_serrilhada: { headUp: false, reach: 7 },
  adaga_gancho:     { headUp: false, reach: 7 },
  adaga:            { headUp: false, reach: 3 },
  faca:             { headUp: false, reach: 5 },
  dardo:            { headUp: false, reach: 4 },
  mangual:          { headUp: true,  reach: 22 },
  bumerangue:       { headUp: false, reach: 22 },
  machado_duplo:    { headUp: true,  reach: 26 },
  martelo:          { headUp: true,  reach: 38 },
  lanca_pesada:     { headUp: true,  reach: 50 },
  maca_ossos:       { headUp: true,  reach: 34 },
  tridente:         { headUp: true,  reach: 48 },
  clava:            { headUp: true,  reach: 16 },
  porrete:          { headUp: true,  reach: 20 },
  lanca:            { headUp: true,  reach: 46 },
  machadinha:       { headUp: true,  reach: 14 },
  besta:            { headUp: true,  reach: 16 },
  besta_pesada:     { headUp: true,  reach: 18 },
  arco_curto:       { headUp: true,  reach: 10 },
  arco_longo:       { headUp: true,  reach: 14 },
}

export function backMount(shape: WeaponShape): { headUp: boolean; reach: number } {
  return BACK_MOUNT[shape]
}

// ────────────────────────────────────────────────────────
// Desenhos. Classes (AltheriumSheet.css): wm metal, wm2 metal escuro,
// ww madeira, wl couro, wb osso, ws pedra, wg dourado; os "fios" (corda,
// guarda de sabre, elos) são traço sem preenchimento.
// ────────────────────────────────────────────────────────

function Pommel({ y, r = 2.6 }: { y: number; r?: number }) {
  return <circle className="wm" cx={0} cy={y} r={r} />
}

function Grip({ from, to, w = 3.6 }: { from: number; to: number; w?: number }) {
  return <rect className="wl" x={-w / 2} y={from} width={w} height={to - from} rx={w / 2.5} />
}

function Haft({ from, to, w = 3.6 }: { from: number; to: number; w?: number }) {
  return <rect className="ww" x={-w / 2} y={from} width={w} height={to - from} rx={w / 2} />
}

function Guard({ y, w, h = 2.6 }: { y: number; w: number; h?: number }) {
  return <rect className="wm" x={-w / 2} y={y} width={w} height={h} rx={h / 2} />
}

/** Espinhos em volta de uma cabeça: cada um é [base x, base y, ponta x, ponta y]. */
function Spikes({ spikes, cls = 'wm' }: { spikes: [number, number, number, number][]; cls?: string }) {
  return (
    <>
      {spikes.map(([x, y, tx, ty], i) => {
        // Base de 3 de largura, perpendicular à direção do espinho.
        const len = Math.hypot(tx - x, ty - y) || 1
        const nx = (-(ty - y) / len) * 1.6
        const ny = ((tx - x) / len) * 1.6
        return <path key={i} className={cls} d={`M ${x + nx} ${y + ny} L ${tx} ${ty} L ${x - nx} ${y - ny} Z`} />
      })}
    </>
  )
}

const ART: Record<WeaponShape, () => ReactNode> = {
  machado_duplo: () => (
    <>
      <Haft from={-11} to={50} />
      <rect className="wm" x={-2.4} y={-13} width={4.8} height={3} rx={1} />
      <Grip from={-5} to={5} w={4.4} />
      <path className="wm" d="M 1.5 37 Q 9 35 15 28 Q 20 42 15 56 Q 9 49 1.5 47 Z" />
      <path className="wm" d="M -1.5 37 Q -9 35 -15 28 Q -20 42 -15 56 Q -9 49 -1.5 47 Z" />
      <rect className="wm2" x={-3} y={35} width={6} height={14} rx={1.2} />
      <path className="wm" d="M -2 49 L 0 56 L 2 49 Z" />
    </>
  ),
  martelo: () => (
    <>
      <Haft from={-11} to={46} />
      <Grip from={-5} to={6} w={4.4} />
      <rect className="wm2" x={-10} y={41} width={20} height={13} rx={1.5} />
      <rect className="wm" x={-12.5} y={42.5} width={3.5} height={10} rx={1} />
      <rect className="wm" x={9} y={42.5} width={3.5} height={10} rx={1} />
      <path className="wline" d="M -5 41 L -5 54 M 5 41 L 5 54" />
      <path className="wm" d="M -2.2 54 L 0 61 L 2.2 54 Z" />
    </>
  ),
  lanca_pesada: () => (
    <>
      <Haft from={-24} to={54} w={4} />
      <path className="wm" d="M -2 8 L -7.5 19 L 7.5 19 L 2 8 Z" />
      <rect className="wm2" x={-2.6} y={50} width={5.2} height={5} rx={1} />
      <path className="wm" d="M -4.6 54 Q -5.2 66 0 94 Q 5.2 66 4.6 54 Z" />
      <path className="wline" d="M 0 57 L 0 84" />
    </>
  ),
  maca_ossos: () => (
    <>
      <rect className="wb" x={-2.2} y={-10} width={4.4} height={46} rx={2} />
      <circle className="wb" cx={-1.8} cy={-11} r={2.4} />
      <circle className="wb" cx={1.8} cy={-11} r={2.4} />
      <Grip from={-5} to={5} w={4.8} />
      <Spikes cls="wb" spikes={[[-7, 40, -13, 35], [7, 40, 13, 35], [-8.5, 47, -15, 47], [8.5, 47, 15, 47], [-5, 53, -8, 59], [5, 53, 8, 59], [0, 55, 0, 61]]} />
      <circle className="wb" cx={0} cy={46} r={9.5} />
      <circle className="wdk" cx={-3.4} cy={45} r={2.2} />
      <circle className="wdk" cx={3.4} cy={45} r={2.2} />
      <path className="wdk" d="M -0.8 49 L 0 51 L 0.8 49 Z" />
    </>
  ),
  montante: () => (
    <>
      <path className="wm" d="M -5 11.5 L -5 76 L 0 88 L 5 76 L 5 11.5 Z" />
      <path className="wline" d="M 0 14 L 0 72" />
      <Grip from={-15} to={9} />
      <Pommel y={-16} r={3.2} />
      <Guard y={8} w={26} h={3.6} />
    </>
  ),
  tridente: () => (
    <>
      <Haft from={-18} to={54} />
      <path className="wm" d="M -1.6 53 L -1.6 70 L 0 77 L 1.6 70 L 1.6 53 Z" />
      <path className="wm" d="M -10 55 L -10 66 L -8.5 73 L -7 66 L -7 55 Z" />
      <path className="wm" d="M 10 55 L 10 66 L 8.5 73 L 7 66 L 7 55 Z" />
      <path className="wm" d="M -10.5 52 Q 0 49 10.5 52 L 10.5 56 Q 0 53 -10.5 56 Z" />
      <path className="wm" d="M -7 64 L -4.5 61 L -7 66 Z M 7 64 L 4.5 61 L 7 66 Z" />
    </>
  ),
  sabre: () => (
    <>
      <path className="wm" d="M -2.6 9.5 Q -2.2 40 9.5 65 Q 4.4 38 2.6 9.5 Z" />
      <Grip from={-8} to={8} />
      <Pommel y={-8.5} r={2.2} />
      <path className="wwire" d="M -1.6 -8.5 Q -9 0 -4 9" />
      <Guard y={7.5} w={9} h={2.4} />
    </>
  ),
  adaga_serrilhada: () => (
    <>
      <path className="wm" d="M -2.8 9.2 L -2.8 27 L 0 35 L 1.6 30 L 3.2 28 L 1.8 25 L 3.2 22 L 1.8 19 L 3.2 16 L 1.8 13 L 3.2 9.2 Z" />
      <Grip from={-6} to={8} w={3.2} />
      <Pommel y={-7} r={2.2} />
      <Guard y={7.2} w={10} h={2.2} />
    </>
  ),
  espada_curta: () => (
    <>
      <path className="wm" d="M -3 10.5 L -3 43 L 0 49 L 3 43 L 3 10.5 Z" />
      <path className="wline" d="M 0 13 L 0 40" />
      <Grip from={-8} to={9} />
      <Pommel y={-9} />
      <Guard y={8} w={15} />
    </>
  ),
  adaga_gancho: () => (
    <>
      <path className="wm" d="M -2.5 9.2 L -2.5 26 Q -2 32 3 33.5 Q 7.5 32.5 7.5 26.5 L 5 26.5 Q 5 30 2.5 29 L 2.5 9.2 Z" />
      <Grip from={-6} to={8} w={3.2} />
      <Pommel y={-7} r={2.2} />
      <Guard y={7.2} w={9} h={2.2} />
    </>
  ),
  clava: () => (
    <>
      <Spikes spikes={[[-4.4, 22, -9.5, 19.5], [4.4, 22, 9.5, 19.5], [-5.4, 31, -10.5, 30], [5.4, 31, 10.5, 30], [-4.6, 39, -9.5, 41], [4.6, 39, 9.5, 41], [0, 44, 0, 49.5]]} />
      <path className="ww" d="M -1.8 -9 L 1.8 -9 L 5 28 Q 6.2 42 0 44.5 Q -6.2 42 -5 28 Z" />
      <Grip from={-5} to={5} w={4} />
      <circle className="wdk" cx={-1.5} cy={34} r={0.9} />
      <circle className="wdk" cx={2} cy={25} r={0.8} />
    </>
  ),
  porrete: () => (
    <>
      <Haft from={-9} to={30} />
      <Grip from={-5} to={5} w={4.2} />
      <path className="ws" d="M -7 26 L -3 21.5 L 5 22.5 L 9.5 29 L 8.5 37.5 L 2 42 L -5.5 39.5 L -9.5 33 Z" />
      <path className="wdk-line" d="M -2 27 L 3 30 M -4 35 L 0 33" />
      <path className="wlash" d="M -6.5 25 L 7.5 34 M -7.5 33 L 6.5 24.5" />
    </>
  ),
  lamina: () => (
    <>
      <path className="wm" d="M -2.2 9 Q -3.4 30 1 45 Q 3.4 30 2.2 9 Z" />
      <Grip from={-7} to={8} w={3.2} />
      <circle className="wg" cx={0} cy={-8} r={2.2} />
      <Guard y={7.2} w={7.5} h={2.2} />
    </>
  ),
  espada_anel: () => (
    <>
      <path className="wm" d="M -3 11 L -3 44 L 0 50 L 3 44 L 3 11 Z" />
      <path className="wline" d="M 0 15 L 0 41" />
      <Grip from={-6} to={8} />
      <circle className="wring" cx={0} cy={-10} r={4} />
      <circle className="wm" cx={0} cy={9.5} r={4.6} />
      <circle className="wm2" cx={0} cy={9.5} r={1.6} />
    </>
  ),
  lanca: () => (
    <>
      <Haft from={-27} to={52} w={2.8} />
      <path className="wm" d="M -1.4 -27 L 0 -31 L 1.4 -27 Z" />
      <Grip from={-4} to={4} w={3.6} />
      <path className="wm" d="M -3.2 50 Q -4.4 57 0 66 Q 4.4 57 3.2 50 Z" />
    </>
  ),
  adaga: () => (
    <>
      <path className="wm" d="M 0 3.5 L 3.4 12 L 0 31 L -3.4 12 Z" />
      <path className="wline" d="M 0 6 L 0 27" />
      <rect className="wl" x={-1.3} y={-6.5} width={2.6} height={10.5} rx={1} />
      <circle className="wring" cx={0} cy={-9} r={2.5} />
    </>
  ),
  faca: () => (
    <>
      <path className="wm" d="M -2.4 6 L -2.4 29 Q 1 32 3.4 27 L 2.6 6 Z" />
      <rect className="wl" x={-1.9} y={-7} width={3.8} height={13.5} rx={1.4} />
      <circle className="wdk" cx={0} cy={-3.5} r={0.7} />
      <circle className="wdk" cx={0} cy={3} r={0.7} />
    </>
  ),
  machadinha: () => (
    <>
      <Haft from={-9} to={34} w={3.2} />
      <Grip from={-4} to={5} w={3.8} />
      <path className="wm" d="M -1.6 22 Q -8 20.5 -12.5 16 Q -15 26.5 -11.5 37 Q -6.5 32 -1.6 31.5 Z" />
      <rect className="wm2" x={1.4} y={22.5} width={2.8} height={8} rx={0.8} />
    </>
  ),
  mangual: () => (
    <>
      <Haft from={-9} to={7} w={3.8} />
      <Grip from={-5} to={4} w={4.2} />
      <circle className="wring" cx={0} cy={8.4} r={1.5} />
      {[11.4, 14.6, 17.8, 21, 24.2, 27.4].map((y, i) => (
        <ellipse key={y} className="wring" cx={0} cy={y} rx={i % 2 ? 0.5 : 1.3} ry={1.9} />
      ))}
      <Spikes spikes={[[-5.5, 32, -9.5, 29.5], [5.5, 32, 9.5, 29.5], [-6.5, 38, -11, 39.5], [6.5, 38, 11, 39.5], [0, 41.5, 0, 46]]} />
      <circle className="wm2" cx={0} cy={35.5} r={6.6} />
      <circle className="whl" cx={-2.2} cy={33.2} r={1.8} />
    </>
  ),
  bumerangue: () => (
    <>
      <path className="ww" d="M 2 -6 Q -2 -6 -3 0 L -5 22 Q -14 26.5 -24 22 Q -26.5 25 -24 27.5 Q -10 32.5 -1 26.5 Q 2.2 10 2 -6 Z" />
      <path className="wm" d="M -24.6 26.6 Q -10 31.6 -1.5 25.8 L -0.6 27.6 Q -10 33.6 -23.6 28.4 Z" />
      <Grip from={-4} to={4} w={4.4} />
    </>
  ),
  arco_curto: () => (
    <>
      <path className="wstring" d="M 8 -26 L 8 26" />
      <path className="wbow" d="M 8 -26 Q -8 0 8 26" />
      <Grip from={-4} to={4} w={4.2} />
    </>
  ),
  arco_longo: () => (
    <>
      <path className="wstring" d="M 10 -40 L 10 40" />
      <path className="wbow" d="M 10 -40 Q -10 0 10 40" />
      <Grip from={-4.5} to={4.5} w={4.4} />
      <circle className="wg" cx={10} cy={-40} r={1.2} />
      <circle className="wg" cx={10} cy={40} r={1.2} />
    </>
  ),
  besta: () => (
    <>
      <path className="ww" d="M -2.4 -9 L 2.4 -9 L 2.8 30 L -2.8 30 Z" />
      <rect className="wm2" x={-0.9} y={5} width={1.8} height={5} rx={0.6} />
      <path className="wstring" d="M -15.5 22.5 L 0 13 L 15.5 22.5" />
      <path className="wprod" d="M -16 22 Q 0 33 16 22" />
      <rect className="wm" x={-0.8} y={12} width={1.6} height={20} />
      <path className="wm" d="M -2 31.5 L 0 36 L 2 31.5 Z" />
    </>
  ),
  besta_pesada: () => (
    <>
      <path className="ww" d="M -3 -12 L 3 -12 L 3.4 33 L -3.4 33 Z" />
      <circle className="wm2" cx={-4.4} cy={-8} r={2} />
      <circle className="wm2" cx={4.4} cy={-8} r={2} />
      <rect className="wm2" x={-1} y={5} width={2} height={5.5} rx={0.6} />
      <path className="wstring" d="M -19.5 25.5 L 0 13 L 19.5 25.5" />
      <path className="wprod wprod--heavy" d="M -20 25 Q 0 37 20 25" />
      <path className="wwire" d="M -4 33 Q 0 41 4 33" />
      <rect className="wm" x={-0.9} y={12} width={1.8} height={22} />
      <path className="wm" d="M -2.2 33.5 L 0 38.5 L 2.2 33.5 Z" />
    </>
  ),
  dardo: () => (
    <>
      {[-16, 0, 16].map((angle) => (
        <g key={angle} transform={`rotate(${angle})`}>
          <path className="wfeather" d="M -0.8 -8 L -3.6 -14 L -0.8 -4 Z M 0.8 -8 L 3.6 -14 L 0.8 -4 Z" />
          <rect className="ww" x={-0.8} y={-10} width={1.6} height={30} rx={0.7} />
          <path className="wm" d="M -0.9 20 L 0 29 L 0.9 20 Z" />
          <circle className="wpoison" cx={0} cy={29.6} r={1.4} />
        </g>
      ))}
      <Grip from={-3} to={3} w={4.4} />
    </>
  ),
}

/** Aljava no próprio referencial: a boca em (0, 0) e o tubo descendo pra
 *  +y; as flechas (ou virotes, mais curtos e de aleta dura) saem pra -y. */
export function QuiverArt({ ammo, transform }: { ammo: QuiverAmmo; transform: string }) {
  const bolts = ammo === 'virotes'
  return (
    <g className="alth-weapon alth-weapon--back" transform={transform} aria-hidden="true">
      {[-7, 0, 7].map((angle, i) => (
        <g key={angle} transform={`rotate(${angle} 0 6)`}>
          <rect className="ww" x={-0.7} y={bolts ? -9 : -15} width={1.4} height={bolts ? 16 : 22} rx={0.6} />
          {bolts
            ? <path className="wm2" d="M -0.7 -4 L -2.6 -9 L -0.7 -8 Z M 0.7 -4 L 2.6 -9 L 0.7 -8 Z" />
            : <path className={i === 1 ? 'wfeather--red' : 'wfeather'} d="M -0.7 -8 L -3 -16 L -0.7 -13.5 Z M 0.7 -8 L 3 -16 L 0.7 -13.5 Z" />}
        </g>
      ))}
      <path className="wq" d="M -5.6 0 L 5.6 0 L 5 40 Q 0 43.5 -5 40 Z" />
      <path className="wline" d="M -5.3 19 L 5.3 19 M -5.2 22 L 5.2 22" />
      <rect className="wg" x={-6} y={-0.6} width={12} height={2.4} rx={1} />
    </g>
  )
}

/** Alça da aljava, cruzando o peito do ombro dela até o quadril do outro lado. */
export function QuiverStrap({ transform }: { transform?: string }) {
  return (
    <g className="alth-weapon" transform={transform} aria-hidden="true">
      <path className="wstrap" d="M 82 66 Q 98 82 118 109" />
      <rect className="wg" x={95.5} y={81} width={5} height={4.4} rx={0.8} transform="rotate(48 98 83.2)" />
    </g>
  )
}

/** Desenho da arma no referencial da mão (ver o topo do arquivo). */
export function WeaponArt({ shape, transform, back = false }: { shape: WeaponShape; transform: string; back?: boolean }) {
  return (
    <g className={`alth-weapon${back ? ' alth-weapon--back' : ''}`} transform={transform} aria-hidden="true">
      {ART[shape]()}
    </g>
  )
}
