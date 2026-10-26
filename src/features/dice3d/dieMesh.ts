import * as THREE from 'three'
import { centroid, labelForValue, labelText, numberUp, polyhedron, type DieKind, type V3 } from './polyhedra'
import { DIE_RADIUS } from './simulate'
import { SURFACES, hashString, hexToRgb, mulberry32, type FacePaint } from './dieSurfaces'
import type { DiceSkin } from './skins'
import { aimToy, makeToy } from './toys'

// ────────────────────────────────────────────────────────
// Desenho de um dado: geometria com faces planas e um "atlas" (uma textura
// com uma célula por face) desenhado em canvas com o número, o friso e o
// brilho de cada conjunto. Geometria e texturas ficam em cache por tipo e
// conjunto; cada dado na tela tem o próprio material (para poder apagar).
// ────────────────────────────────────────────────────────

/** Tamanho do atlas: os conjuntos detalhados pedem mais pixels nos dados de muitas faces (cada face é pequena). */
function atlasSize(kind: DieKind, skin: DiceSkin): number {
  if (!skin.surface) return 1024
  const faces = polyhedron(kind).faces.length
  return faces >= 100 ? 4096 : faces >= 20 ? 2048 : faces >= 10 ? 1536 : 1024
}

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
    // bolão: toda célula é um círculo igual (qualquer face mostra qualquer célula), então a face cabe num círculo
    const reach = Math.max(...flat.map(([x, y]) => Math.hypot(x, y)))
    const s = kind === 'd100' ? 0.43 / reach : 0.46 / extent
    // centraliza a forma na célula (o triângulo e a pipa ficam mais altos que largos)
    const ys = flat.map(([, y]) => y)
    const shiftY = kind === 'd100' ? 0 : -(Math.max(...ys) + Math.min(...ys)) / 2
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

/**
 * `cellOf` (só no bolão): qual célula do atlas cada face mostra. O bolão não tem simetria que troque os
 * números, então, para o número sorteado aparecer na face de frente, duas faces trocam de célula. Essa
 * geometria é só daquele dado (não entra no cache) e quem a cria solta com disposeDieMesh.
 */
export function dieGeometry(kind: DieKind, cellOf?: readonly number[]): THREE.BufferGeometry {
  const hit = cellOf ? undefined : geometries.get(kind)
  if (hit) return hit
  const p = polyhedron(kind)
  const lay = getLayout(kind)
  const r = DIE_RADIUS[kind]
  const pos: number[] = [], nor: number[] = [], uv: number[] = []
  p.faces.forEach((f, i) => {
    const n = p.normals[i]
    const L = lay.faces[i]
    const cellFace = lay.faces[cellOf?.[i] ?? i]
    const cw = 1 / lay.cols, ch = 1 / lay.rows
    // célula i: coluna da esquerda para a direita, linha de cima para baixo (v da textura cresce para cima)
    const u0 = cellFace.cell.col * cw, v0 = 1 - (cellFace.cell.row + 1) * ch
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
  if (cellOf) g.userData.owned = true
  else geometries.set(kind, g)
  return g
}

// ── Texturas ────────────────────────────────────────────

const NUMBER_SIZE: Record<DieKind, number> = { d4: 0.2, d6: 0.5, d8: 0.36, d10: 0.32, d100: 0.3, d12: 0.36, d20: 0.3 }

/** `alpha` (só na resina): escuro deixa ver através (o corpo), branco é tinta opaca (números e friso). */
interface Atlas { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture | null; rm: THREE.CanvasTexture; bump: THREE.CanvasTexture | null; alpha: THREE.CanvasTexture | null }
const atlases = new Map<string, Atlas>()

function drawAtlas(kind: DieKind, skin: DiceSkin): Atlas {
  const p = polyhedron(kind)
  const lay = getLayout(kind)
  const ATLAS = atlasSize(kind, skin)
  const cw = ATLAS / lay.cols, ch = ATLAS / lay.rows
  const make = () => { const c = document.createElement('canvas'); c.width = ATLAS; c.height = ATLAS; return c }
  const color = make(), glow = make(), rm = make()
  const cx = color.getContext('2d')!, gx = glow.getContext('2d')!, rx = rm.getContext('2d')!
  // relevo (só nos conjuntos detalhados): cinza médio é plano, claro sobe e escuro afunda
  const bump = skin.surface ? make() : null
  const bx = bump?.getContext('2d') ?? null
  if (bx) { bx.fillStyle = 'rgb(128, 128, 128)'; bx.fillRect(0, 0, ATLAS, ATLAS) }
  // resina: mapa de opacidade (o corpo quase transparente, a tinta opaca)
  const trans = skin.resin ? make() : null
  const tx = trans?.getContext('2d') ?? null
  if (tx) { tx.fillStyle = '#9a9a9a'; tx.fillRect(0, 0, ATLAS, ATLAS) }

  cx.fillStyle = skin.bodyEdge; cx.fillRect(0, 0, ATLAS, ATLAS)
  gx.fillStyle = '#000'; gx.fillRect(0, 0, ATLAS, ATLAS)
  const bodyRM = `rgb(0, ${Math.round(skin.roughness * 255)}, ${Math.round(skin.metalness * 255)})`
  const inkRM = skin.inkMetal ? 'rgb(0, 60, 255)' : `rgb(0, ${Math.round(Math.min(1, skin.roughness + 0.1) * 255)}, ${Math.round(skin.metalness * 255)})`
  rx.fillStyle = bodyRM; rx.fillRect(0, 0, ATLAS, ATLAS)
  const [gr, gg, gb] = hexToRgb(skin.glow)
  const glowColor = `rgba(${gr}, ${gg}, ${gb}, ${skin.glowPower})`

  // números um pouco maiores que o desenho original (lidos de longe na mesa); na resina, maiores ainda
  const NUMBER_BOOST = skin.resin ? 1.2 : 1.1
  const fontPx = (k: number) => Math.round(Math.min(cw, ch) * NUMBER_SIZE[kind] * NUMBER_BOOST * k)
  const font = (px: number) => `700 ${px}px "EB Garamond", "Cormorant Garamond", Georgia, serif`

  p.faces.forEach((_, i) => {
    const L = lay.faces[i]
    const ox = L.cell.col * cw, oy = L.cell.row * ch
    const toPx = ([u, v]: V2): V2 => [ox + u * cw, oy + (1 - v) * ch]
    // bolão: toda célula é o mesmo círculo (um polígono de 24 lados), para qualquer face poder mostrar qualquer célula
    const poly = kind === 'd100'
      ? Array.from({ length: 24 }, (_, k): V2 => [ox + cw / 2 + Math.cos((k * Math.PI) / 12) * cw * 0.5, oy + ch / 2 + Math.sin((k * Math.PI) / 12) * ch * 0.5])
      : L.points.map(toPx)
    const center: V2 = [poly.reduce((s, q) => s + q[0], 0) / poly.length, poly.reduce((s, q) => s + q[1], 0) / poly.length]
    const path = (ctx: CanvasRenderingContext2D, inset: number) => {
      ctx.beginPath()
      poly.forEach(([x, y], k) => {
        const px = center[0] + (x - center[0]) * (1 - inset), py = center[1] + (y - center[1]) * (1 - inset)
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      })
      ctx.closePath()
    }

    const radius = Math.max(...poly.map(([x, y]) => Math.hypot(x - center[0], y - center[1])))
    // conjunto detalhado: a superfície inteira (e os números) vêm do pintor do material
    const paint: FacePaint | null = bx && skin.surface ? {
      cx, bx, rx, poly, center, radius, skin, k: ATLAS / 1024, rnd: mulberry32(hashString(`${skin.id}:${kind}:${i}`)),
    } : null
    if (paint && skin.surface) SURFACES[skin.surface].face(paint)
    else {
      // corpo: degradê do centro para as bordas, como pedra lapidada
      const grad = cx.createRadialGradient(center[0], center[1] - radius * 0.2, radius * 0.1, center[0], center[1], radius * 1.05)
      grad.addColorStop(0, skin.body)
      grad.addColorStop(1, skin.bodyEdge)
      cx.fillStyle = grad
      path(cx, -0.06); cx.fill()

      // resina: limpa no meio da face e mais densa (tingida de água) perto das bordas, como a resina de verdade
      if (tx) {
        const edge = tx.createRadialGradient(center[0], center[1], radius * 0.35, center[0], center[1], radius * 1.05)
        edge.addColorStop(0, '#3a3a3a')
        edge.addColorStop(1, '#8c8c8c')
        tx.fillStyle = edge
        path(tx, -0.06); tx.fill()
      }

      // friso por dentro da borda
      const trimW = Math.max(2, Math.min(cw, ch) * (skin.resin ? 0.008 : 0.018))
      for (const [ctx, style] of [[cx, skin.trim], [gx, glowColor], ...(tx ? [[tx, '#fff']] : [])] as [CanvasRenderingContext2D, string][]) {
        ctx.lineWidth = trimW
        ctx.strokeStyle = style
        ctx.lineJoin = 'round'
        path(ctx, 0.13); ctx.stroke()
      }
    }

    // números
    const drawNumber = paint && skin.surface
      ? (text: string, x: number, y: number, angle: number, px: number, underline: boolean) => SURFACES[skin.surface!].number(paint, text, x, y, angle, px, underline)
      : (text: string, x: number, y: number, angle: number, px: number, underline: boolean) => {
      const layers: [CanvasRenderingContext2D, 'color' | 'glow' | 'rm' | 'trans'][] = [[cx, 'color'], [gx, 'glow'], [rx, 'rm']]
      if (tx) layers.push([tx, 'trans'])
      for (const [ctx, mode] of layers) {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(angle)
        ctx.font = font(px)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        if (mode === 'color') {
          // na resina: tinta branca com um contorno escuro grosso, para o número saltar sobre o transparente
          ctx.lineWidth = Math.max(2, px * (skin.resin ? 0.16 : 0.09))
          ctx.strokeStyle = skin.resin ? 'rgba(8, 34, 40, 0.95)' : 'rgba(0, 0, 0, 0.55)'
          ctx.strokeText(text, 0, skin.resin ? 0 : px * 0.04)
          ctx.fillStyle = skin.ink
        } else if (mode === 'trans') {
          // a tinta do número (e o contorno dela) é opaca
          ctx.lineWidth = Math.max(2, px * 0.17)
          ctx.strokeStyle = '#fff'
          ctx.strokeText(text, 0, 0)
          ctx.fillStyle = '#fff'
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
      const y = kind === 'd10' ? center[1] + radius * 0.12 : center[1]
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
  const bumpTex = bump ? tex(bump, false) : null
  return { map: tex(color, true), emissive: skin.glowPower > 0 ? tex(glow, true) : null, rm: tex(rm, false), bump: bumpTex, alpha: trans ? tex(trans, false) : null }
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
    ...(a.emissive ? { emissiveMap: a.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1 } : {}),
    ...(a.bump ? { bumpMap: a.bump, bumpScale: skin.bump ?? 1 } : {}),
    roughnessMap: a.rm, metalnessMap: a.rm, roughness: 1, metalness: 1,
    clearcoat: skin.clearcoat ?? (skin.glass ? 0.3 : 0.12), clearcoatRoughness: skin.surface === 'plastic' ? 0.08 : 0.45,
    flatShading: true,
  })
  if (skin.glass) {
    m.transmission = 0.22
    m.thickness = 2.2
    m.ior = 1.5
  }
  if (skin.resin && a.alpha) {
    // resina de dado: transparente de verdade (o brinquedo aparece dentro, por cima de qualquer fundo),
    // números opacos e um verniz forte. As faces de trás são outra malha, mais apagada (makeDieMesh).
    m.transparent = true
    m.alphaMap = a.alpha
    m.depthWrite = false
    m.specularIntensity = 1
    m.clearcoatRoughness = 0.04
    m.envMapIntensity = 1.6
  }
  return m
}

/** Troca de células do bolão para a face `face` mostrar o número `label` (a face que tinha esse número fica com o dela). */
export function ballCells(face: number, label: number): { cellOf: number[]; labels: number[] } {
  const p = polyhedron('d100')
  const cellOf = p.faces.map((_, i) => i)
  const labels = [...p.labels]
  const holder = p.labels.indexOf(label)
  if (holder >= 0 && holder !== face) {
    cellOf[face] = holder
    cellOf[holder] = face
    labels[face] = label
    labels[holder] = p.labels[face]
  }
  return { cellOf, labels }
}

/**
 * Um dado pronto para a cena: a geometria, o material do conjunto e, na resina, o brinquedo dentro.
 * `show` (só no bolão): a face que vai ficar de frente e o número que ela precisa mostrar.
 */
export function makeDieMesh(kind: DieKind, skin: DiceSkin, show?: { face: number; label: number }): THREE.Mesh {
  const ball = kind === 'd100' && show ? ballCells(show.face, show.label) : null
  const geometry = dieGeometry(kind, ball?.cellOf)
  const mesh = new THREE.Mesh(geometry, dieMaterial(kind, skin))
  if (ball) mesh.userData.faceLabels = ball.labels
  if (skin.resin) {
    // o lado de dentro das faces de trás: dá a espessura do bloco de resina, mas apagado, para os números
    // de trás (espelhados) não brigarem com os da frente. Desenha antes da frente (renderOrder).
    const back = dieMaterial(kind, skin)
    back.side = THREE.BackSide
    back.opacity = 0.32
    const inside = new THREE.Mesh(geometry, back)
    inside.renderOrder = 1
    mesh.renderOrder = 2
    mesh.add(inside)
  }
  if (skin.toy) {
    const toy = makeToy(kind, skin.toy)
    // o brinquedo é fixo no dado e fica de frente para o número mais alto dele (o 20 no d20), esteja o dado
    // rolando ou parado: o rostinho gira junto, como um brinquedo preso na resina, sem entregar o resultado
    if (!polyhedron(kind).readsVertex) aimToy(toy, kind, maxFace(kind, ball?.labels))
    mesh.add(toy)
  }
  return mesh
}

/** A face com o número mais alto do dado (d10: o 10, escrito 0; d100: o 100). */
export function maxFace(kind: DieKind, labels: readonly number[] = polyhedron(kind).labels): number {
  const sides = kind === 'd100' ? 100 : Number(kind.slice(1))
  return labels.indexOf(labelForValue(kind, sides))
}

/** O brinquedo dentro do dado (resina), se houver. */
export function dieToy(mesh: THREE.Object3D): THREE.Object3D | undefined {
  return mesh.children.find((c) => c.userData.toy)
}

/** Solta os materiais próprios do dado (o da frente e o das faces de trás; o brinquedo é dividido entre todos). */
export function disposeDieMesh(mesh: THREE.Mesh): void {
  (mesh.material as THREE.Material).dispose()
  if (mesh.geometry.userData.owned) mesh.geometry.dispose()
  for (const c of mesh.children) if (c instanceof THREE.Mesh && !c.userData.toy) (c.material as THREE.Material).dispose()
}

/** Espera a fonte dos números carregar (senão o canvas desenha com a fonte reserva). */
export async function ensureDiceFont(): Promise<void> {
  try { await document.fonts?.load('700 64px "EB Garamond"') } catch { /* fonte reserva */ }
}

/** Limpa as texturas (usado ao trocar muito de conjunto). */
export function disposeDiceAtlases(): void {
  for (const a of atlases.values()) { a.map.dispose(); a.emissive?.dispose(); a.rm.dispose(); a.bump?.dispose(); a.alpha?.dispose() }
  atlases.clear()
}
