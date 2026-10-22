import * as THREE from 'three'
import { centroid, labelText, numberUp, polyhedron, type DieKind, type V3 } from './polyhedra'
import { DIE_RADIUS } from './simulate'
import type { DiceSkin } from './skins'

// ────────────────────────────────────────────────────────
// Desenho de um dado: geometria com faces planas e um "atlas" (uma textura
// com uma célula por face) desenhado em canvas com o número, o friso e o
// brilho de cada conjunto. Geometria e texturas ficam em cache por tipo e
// conjunto; cada dado na tela tem o próprio material (para poder apagar).
// ────────────────────────────────────────────────────────

const ATLAS = 1024

type V2 = [number, number]

interface FaceLayout {
  /** Coordenadas de cada vértice da face dentro da célula, de 0 a 1 (y para cima). */
  points: V2[]
  cell:   { col: number; row: number }
}

interface DieLayout { cols: number; rows: number; faces: FaceLayout[] }

const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/**
 * Onde cada face cai no atlas. O "para cima" do número aponta para o vértice
 * mais longe do centro (o bico da pipa no d10, uma ponta no triângulo) ou,
 * nas faces quadradas e pentagonais, para o meio da primeira aresta.
 */
function layout(kind: DieKind): DieLayout {
  const p = polyhedron(kind)
  const cols = Math.ceil(Math.sqrt(p.faces.length))
  const rows = Math.ceil(p.faces.length / cols)
  const faces = p.faces.map((f, i): FaceLayout => {
    const pts = f.map((v) => p.vertices[v])
    const c = centroid(pts)
    const n = p.normals[i]
    const up = numberUp(p, i)
    const right = cross3(up, n)
    const flat = pts.map((q): V2 => { const d = sub3(q, c); return [dot3(d, right), dot3(d, up)] })
    const extent = Math.max(...flat.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))))
    const s = 0.46 / extent
    // centraliza a forma na célula (o triângulo e a pipa ficam mais altos que largos)
    const ys = flat.map(([, y]) => y)
    const shiftY = -(Math.max(...ys) + Math.min(...ys)) / 2
    return {
      points: flat.map(([x, y]): V2 => [0.5 + x * s, 0.5 + (y + shiftY) * s]),
      cell: { col: i % cols, row: Math.floor(i / cols) },
    }
  })
  return { cols, rows, faces }
}

const layouts = new Map<DieKind, DieLayout>()
const getLayout = (kind: DieKind) => { let l = layouts.get(kind); if (!l) { l = layout(kind); layouts.set(kind, l) } return l }

// ── Geometria ───────────────────────────────────────────

const geometries = new Map<DieKind, THREE.BufferGeometry>()

export function dieGeometry(kind: DieKind): THREE.BufferGeometry {
  const hit = geometries.get(kind)
  if (hit) return hit
  const p = polyhedron(kind)
  const lay = getLayout(kind)
  const r = DIE_RADIUS[kind]
  const pos: number[] = [], nor: number[] = [], uv: number[] = []
  p.faces.forEach((f, i) => {
    const n = p.normals[i]
    const L = lay.faces[i]
    const cw = 1 / lay.cols, ch = 1 / lay.rows
    // célula i: coluna da esquerda para a direita, linha de cima para baixo (v da textura cresce para cima)
    const u0 = L.cell.col * cw, v0 = 1 - (L.cell.row + 1) * ch
    for (let k = 1; k < f.length - 1; k++) {
      for (const j of [0, k, k + 1]) {
        const v = p.vertices[f[j]]
        pos.push(v[0] * r, v[1] * r, v[2] * r)
        nor.push(n[0], n[1], n[2])
        uv.push(u0 + L.points[j][0] * cw, v0 + L.points[j][1] * ch)
      }
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.computeBoundingSphere()
  geometries.set(kind, g)
  return g
}

// ── Texturas ────────────────────────────────────────────

const NUMBER_SIZE: Record<DieKind, number> = { d4: 0.2, d6: 0.5, d8: 0.36, d10: 0.32, d100: 0.27, d12: 0.36, d20: 0.3 }

interface Atlas { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture; rm: THREE.CanvasTexture }
const atlases = new Map<string, Atlas>()

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function drawAtlas(kind: DieKind, skin: DiceSkin): Atlas {
  const p = polyhedron(kind)
  const lay = getLayout(kind)
  const cw = ATLAS / lay.cols, ch = ATLAS / lay.rows
  const make = () => { const c = document.createElement('canvas'); c.width = ATLAS; c.height = ATLAS; return c }
  const color = make(), glow = make(), rm = make()
  const cx = color.getContext('2d')!, gx = glow.getContext('2d')!, rx = rm.getContext('2d')!

  cx.fillStyle = skin.bodyEdge; cx.fillRect(0, 0, ATLAS, ATLAS)
  gx.fillStyle = '#000'; gx.fillRect(0, 0, ATLAS, ATLAS)
  const bodyRM = `rgb(0, ${Math.round(skin.roughness * 255)}, ${Math.round(skin.metalness * 255)})`
  const inkRM = skin.inkMetal ? 'rgb(0, 60, 255)' : `rgb(0, ${Math.round(Math.min(1, skin.roughness + 0.1) * 255)}, ${Math.round(skin.metalness * 255)})`
  rx.fillStyle = bodyRM; rx.fillRect(0, 0, ATLAS, ATLAS)
  const [gr, gg, gb] = hexToRgb(skin.glow)
  const glowColor = `rgba(${gr}, ${gg}, ${gb}, ${skin.glowPower})`

  const fontPx = (k: number) => Math.round(Math.min(cw, ch) * NUMBER_SIZE[kind] * k)
  const font = (px: number) => `700 ${px}px "EB Garamond", "Cormorant Garamond", Georgia, serif`

  p.faces.forEach((_, i) => {
    const L = lay.faces[i]
    const ox = L.cell.col * cw, oy = L.cell.row * ch
    const toPx = ([u, v]: V2): V2 => [ox + u * cw, oy + (1 - v) * ch]
    const poly = L.points.map(toPx)
    const center: V2 = [poly.reduce((s, q) => s + q[0], 0) / poly.length, poly.reduce((s, q) => s + q[1], 0) / poly.length]
    const path = (ctx: CanvasRenderingContext2D, inset: number) => {
      ctx.beginPath()
      poly.forEach(([x, y], k) => {
        const px = center[0] + (x - center[0]) * (1 - inset), py = center[1] + (y - center[1]) * (1 - inset)
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      })
      ctx.closePath()
    }

    // corpo: degradê do centro para as bordas, como pedra lapidada
    const radius = Math.max(...poly.map(([x, y]) => Math.hypot(x - center[0], y - center[1])))
    const grad = cx.createRadialGradient(center[0], center[1] - radius * 0.2, radius * 0.1, center[0], center[1], radius * 1.05)
    grad.addColorStop(0, skin.body)
    grad.addColorStop(1, skin.bodyEdge)
    cx.fillStyle = grad
    path(cx, -0.06); cx.fill()

    // friso por dentro da borda
    const trimW = Math.max(2, Math.min(cw, ch) * 0.018)
    for (const [ctx, style] of [[cx, skin.trim], [gx, glowColor]] as const) {
      ctx.lineWidth = trimW
      ctx.strokeStyle = style
      ctx.lineJoin = 'round'
      path(ctx, 0.13); ctx.stroke()
    }

    // números
    const drawNumber = (text: string, x: number, y: number, angle: number, px: number, underline: boolean) => {
      for (const [ctx, mode] of [[cx, 'color'], [gx, 'glow'], [rx, 'rm']] as const) {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(angle)
        ctx.font = font(px)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        if (mode === 'color') {
          ctx.lineWidth = Math.max(2, px * 0.09)
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)'
          ctx.strokeText(text, 0, px * 0.04)
          ctx.fillStyle = skin.ink
        } else ctx.fillStyle = mode === 'glow' ? glowColor : inkRM
        ctx.fillText(text, 0, 0)
        if (underline) ctx.fillRect(-px * 0.28, px * 0.42, px * 0.56, Math.max(2, px * 0.07))
        ctx.restore()
      }
    }

    if (p.readsVertex) {
      // d4: em cada canto, o número daquele vértice, de pé para a ponta
      const f = p.faces[i]
      f.forEach((vIdx, k) => {
        const [vx, vy] = poly[k]
        const x = center[0] + (vx - center[0]) * 0.56, y = center[1] + (vy - center[1]) * 0.56
        drawNumber(String(p.labels[vIdx]), x, y, Math.atan2(vx - center[0], -(vy - center[1])), fontPx(1), false)
      })
    } else {
      const label = p.labels[i]
      const text = labelText(kind, label)
      const big = p.labels.length >= 9 && (text === '6' || text === '9')
      // na pipa do d10 o número fica um pouco para o lado largo
      const y = kind === 'd10' || kind === 'd100' ? center[1] + radius * 0.12 : center[1]
      drawNumber(text, center[0], y, 0, fontPx(1), big)
    }
  })

  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c)
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    t.needsUpdate = true
    return t
  }
  return { map: tex(color, true), emissive: tex(glow, true), rm: tex(rm, false) }
}

function atlasFor(kind: DieKind, skin: DiceSkin): Atlas {
  const key = `${kind}:${skin.id}`
  let a = atlases.get(key)
  if (!a) { a = drawAtlas(kind, skin); atlases.set(key, a) }
  return a
}

export function dieMaterial(kind: DieKind, skin: DiceSkin): THREE.MeshPhysicalMaterial {
  const a = atlasFor(kind, skin)
  const m = new THREE.MeshPhysicalMaterial({
    map: a.map,
    emissiveMap: a.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1,
    roughnessMap: a.rm, metalnessMap: a.rm, roughness: 1, metalness: 1,
    clearcoat: skin.glass ? 0.3 : 0.12, clearcoatRoughness: 0.45,
    flatShading: true,
  })
  if (skin.glass) {
    m.transmission = 0.22
    m.thickness = 2.2
    m.ior = 1.5
  }
  return m
}

/** Espera a fonte dos números carregar (senão o canvas desenha com a fonte reserva). */
export async function ensureDiceFont(): Promise<void> {
  try { await document.fonts?.load('700 64px "EB Garamond"') } catch { /* fonte reserva */ }
}

/** Limpa as texturas (usado ao trocar muito de conjunto). */
export function disposeDiceAtlases(): void {
  for (const a of atlases.values()) { a.map.dispose(); a.emissive.dispose(); a.rm.dispose() }
  atlases.clear()
}
