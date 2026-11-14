import * as THREE from 'three'
import { numberUp, polyhedron, type DieKind } from './polyhedra'
import { DIE_RADIUS } from './simulate'

// ────────────────────────────────────────────────────────
// Brinquedinhos presos dentro dos dados de resina (o dado de betinha tester e os da coleção: o inseto do âmbar, as
// luzinhas dos vaga-lumes, o olho do abismo e o planeta da galáxia). O primeiro foi o do betinha:
// um emoji nerd de plástico, como os patinhos dos dados de resina de verdade.
// Cabeça amarela envernizada; óculos pretos grossos, boca com os dentes,
// olhos e sobrancelhas modelados COLADOS na curva da cabeça (faixas sobre a
// esfera, e não peças retas espetadas nela, que de lado pareciam soltas); e
// dois bracinhos com luvas brancas, uma no queixo e outra ajeitando os óculos.
// Escala 1 (a cabeça tem raio 1, olhando para +z); cada dado ganha uma cópia
// do modelo (geometrias e materiais divididos), encolhida para caber nele.
// ────────────────────────────────────────────────────────

type Mat = THREE.Material
type MatKey = 'skin' | 'frame' | 'white' | 'pupil' | 'brow' | 'mouth' | 'glove'

let mats: Record<MatKey, Mat> | null = null
function materials() {
  mats ??= {
    // plástico de brinquedo: cor viva, verniz que reflete a luz
    skin:  new THREE.MeshPhysicalMaterial({ color: '#ffc21a', roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.15 }),
    frame: new THREE.MeshPhysicalMaterial({ color: '#111114', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
    white: new THREE.MeshPhysicalMaterial({ color: '#fbfaf4', roughness: 0.35, clearcoat: 0.5, side: THREE.DoubleSide }),
    pupil: new THREE.MeshPhysicalMaterial({ color: '#3d4a56', roughness: 0.2, clearcoat: 1 }),
    brow:  new THREE.MeshStandardMaterial({ color: '#8a3d0c', roughness: 0.5, side: THREE.DoubleSide }),
    mouth: new THREE.MeshStandardMaterial({ color: '#3a1405', roughness: 0.6, side: THREE.DoubleSide }),
    glove: new THREE.MeshPhysicalMaterial({ color: '#fbfaf4', roughness: 0.4, clearcoat: 0.4 }),
  }
  return mats
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/**
 * Faixa colada na esfera em volta de um ponto `center` da superfície: cada ângulo t (a partir da direção
 * `toward`, na tangente) vai da distância angular inner(t) até outer(t). Serve para o aro dos óculos, a
 * boca e as sobrancelhas. `lift` afasta a faixa da cabeça (para ela ficar por cima, sem piscar).
 */
function sphereBand(center: THREE.Vector3, toward: THREE.Vector3, inner: (t: number) => number, outer: (t: number) => number,
  t0: number, t1: number, lift: number, segments = 48): THREE.BufferGeometry {
  const c = center.clone().normalize()
  const d = toward.clone().sub(c.clone().multiplyScalar(toward.dot(c))).normalize()
  const s = new THREE.Vector3().crossVectors(c, d)
  const at = (t: number, a: number) => {
    const dir = d.clone().multiplyScalar(Math.cos(t)).add(s.clone().multiplyScalar(Math.sin(t)))
    return c.clone().multiplyScalar(Math.cos(a)).add(dir.multiplyScalar(Math.sin(a))).multiplyScalar(1 + lift)
  }
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= segments; i++) {
    const t = t0 + ((t1 - t0) * i) / segments
    for (const p of [at(t, inner(t)), at(t, outer(t))]) pos.push(p.x, p.y, p.z)
    if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Raio de um retângulo de cantos redondos (superelipse) no ângulo t: meia largura a, meia altura b. */
const roundRect = (a: number, b: number, n = 5) => (t: number) => 1 / ((Math.abs(Math.cos(t)) / a) ** n + (Math.abs(Math.sin(t)) / b) ** n) ** (1 / n)

/** Tubo seguindo pontos (as hastes dos óculos e os braços). */
function tube(points: THREE.Vector3[], radius: number): THREE.BufferGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, radius, 10, false)
}

/** Luva branca de desenho animado: palma, punho dobrado, polegar e os dedos da pose. */
function glove(pose: 'chin' | 'glasses'): THREE.Group {
  const m = materials()
  const g = new THREE.Group()
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 22, 16), m.glove)
  palm.scale.set(1, 1.05, 0.75)
  g.add(palm)
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.065, 12, 24), m.glove)
  cuff.position.set(0, -0.22, 0)
  cuff.rotation.x = Math.PI / 2
  g.add(cuff)
  const finger = (x: number, len: number, tilt: number, forward = 0) => {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, len, 6, 14), m.glove)
    f.position.set(x + Math.sin(-tilt) * len * 0.5, 0.17 + len / 2, forward)
    f.rotation.set(-forward * 2.4, 0, tilt)
    g.add(f)
  }
  if (pose === 'chin') {
    // o "V" pensativo debaixo do queixo
    finger(-0.07, 0.26, 0.22)
    finger(0.08, 0.24, -0.16)
  } else {
    // pinça na haste dos óculos: dois dedos curvados para a frente
    finger(-0.05, 0.16, 0.15, 0.08)
    finger(0.08, 0.15, -0.1, 0.08)
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.13, 6, 14), m.glove)
  thumb.position.set(-0.19, 0.04, 0.07)
  thumb.rotation.z = 0.95
  g.add(thumb)
  return g
}

function buildNerd(): THREE.Group {
  const m = materials()
  const toy = new THREE.Group()
  const add = (geo: THREE.BufferGeometry, mat: Mat) => { const mesh = new THREE.Mesh(geo, mat); toy.add(mesh); return mesh }

  add(new THREE.SphereGeometry(1, 48, 32), m.skin)

  // olhos: o branco achatado na pele e a pupila olhando para o lado
  const eyeL = v3(-0.34, 0.2, 0.92).normalize(), eyeR = v3(0.34, 0.2, 0.92).normalize()
  for (const eye of [eyeL, eyeR]) {
    const white = add(new THREE.SphereGeometry(0.22, 28, 18), m.white)
    white.position.copy(eye.clone().multiplyScalar(0.93))
    white.lookAt(eye.clone().multiplyScalar(3))
    white.scale.set(1, 1.08, 0.42)
    const pupil = add(new THREE.SphereGeometry(0.1, 20, 14), m.pupil)
    const look = eye.clone().add(v3(-0.07, -0.02, 0)).normalize()
    pupil.position.copy(look.clone().multiplyScalar(1.0))
    pupil.lookAt(look.clone().multiplyScalar(3))
    pupil.scale.set(1, 1, 0.45)
  }

  // óculos: dois aros grossos de cantos redondos colados na cara, a ponte e as hastes até as orelhas
  const up = v3(0, 1, 0)
  for (const eye of [eyeL, eyeR]) {
    toy.add(new THREE.Mesh(sphereBand(eye, up, roundRect(0.2, 0.15), roundRect(0.28, 0.225), 0, Math.PI * 2, 0.045, 96), m.frame))
    // a borda do aro, para ele ter espessura de lado
    toy.add(new THREE.Mesh(sphereBand(eye, up, roundRect(0.28, 0.225), roundRect(0.285, 0.23), 0, Math.PI * 2, 0.0, 96), m.frame))
  }
  add(tube([-0.14, -0.07, 0, 0.07, 0.14].map((x) => v3(x, 0.27, 1).normalize().multiplyScalar(1.045)), 0.04), m.frame)
  for (const side of [-1, 1]) {
    // da ponta de fora do aro até a orelha, rente à cabeça
    const pts = [0.62, 0.9, 1.2, 1.5].map((a) => v3(side * Math.sin(a), 0.24, Math.cos(a)).normalize().multiplyScalar(1.04))
    add(tube(pts, 0.035), m.frame)
  }

  // sobrancelhas arqueadas logo acima dos aros
  for (const eye of [eyeL, eyeR]) add(sphereBand(eye, up, () => 0.36, () => 0.42, -0.55, 0.55, 0.012), m.brow)

  // sorrisão: a boca escura em arco e a fileira de dentes brancos na parte de cima dela
  const mouthCenter = v3(0, 0.3, 0.95).normalize()
  const down = v3(0, -1, 0)
  add(sphereBand(mouthCenter, down, () => 0.5, (t) => 0.64 - 0.06 * Math.abs(t), -0.82, 0.82, 0.008), m.mouth)
  add(sphereBand(mouthCenter, down, () => 0.505, () => 0.575, -0.75, 0.75, 0.014), m.white)

  // bracinhos amarelos saindo dos lados da cabeça até as luvas
  add(tube([v3(-0.9, -0.42, 0.1), v3(-1.08, -0.78, 0.38), v3(-0.82, -1.08, 0.62), v3(-0.42, -1.05, 0.8)], 0.07), m.skin)
  add(tube([v3(0.92, -0.38, 0.05), v3(1.2, -0.05, 0.25), v3(1.12, 0.12, 0.48), v3(0.98, 0.2, 0.62)], 0.07), m.skin)

  // luvas: uma no queixo (o "V"), outra segurando a haste dos óculos
  const chin = glove('chin')
  chin.position.set(-0.3, -0.92, 0.86)
  chin.rotation.set(0.25, 0.25, -0.35)
  toy.add(chin)
  const temple = glove('glasses')
  temple.position.set(0.95, 0.38, 0.66)
  temple.rotation.set(0.1, -0.55, 0.35)
  toy.add(temple)

  // o boneco inteiro (com braços e luvas) cabe numa esfera deste raio
  toy.userData.reach = 1.32
  return toy
}

let nerd: THREE.Group | null = null

/** Um inseto preso no âmbar: corpo em três partes, seis pernas, duas asas de vidro e antenas. Vê-se de cima, de frente para +z. */
function buildInsect(): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.MeshPhysicalMaterial({ color: '#2a1206', roughness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.2 })
  const wing = new THREE.MeshPhysicalMaterial({ color: '#f8e6b0', roughness: 0.12, transparent: true, opacity: 0.5, side: THREE.DoubleSide, clearcoat: 1 })
  const part = (rx: number, ry: number, rz: number, x: number, y = 0, z = 0, mat: Mat = body) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), mat)
    m.scale.set(rx, ry, rz); m.position.set(x, y, z); g.add(m); return m
  }
  part(0.5, 0.3, 0.27, -0.62)      // abdômen
  part(0.34, 0.27, 0.25, -0.05)    // tórax
  part(0.24, 0.22, 0.22, 0.4)      // cabeça
  part(0.07, 0.07, 0.05, 0.52, 0.12, 0.17, new THREE.MeshPhysicalMaterial({ color: '#f4e0a0', roughness: 0.15, clearcoat: 1 }))
  part(0.07, 0.07, 0.05, 0.52, -0.12, 0.17, new THREE.MeshPhysicalMaterial({ color: '#f4e0a0', roughness: 0.15, clearcoat: 1 }))
  const tube = (pts: THREE.Vector3[], r: number) => {
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, r, 6), body)
    g.add(m)
  }
  for (const side of [1, -1]) {
    for (const [x, sw] of [[0.12, 0.28], [-0.05, 0.1], [-0.22, -0.18]] as const) {
      tube([v3(x, side * 0.12, -0.12), v3(x + sw * 0.5, side * 0.46, -0.1), v3(x + sw, side * 0.78, -0.22), v3(x + sw * 0.9, side * 0.98, -0.42)], 0.03)
    }
    tube([v3(0.55, side * 0.1, 0.05), v3(0.82, side * 0.26, 0.06), v3(1.05, side * 0.52, 0.04)], 0.018)       // antena
    const w = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), wing)
    w.scale.set(0.62, 0.2, 0.012); w.position.set(-0.42, side * 0.4, 0.2); w.rotation.z = side * 0.55; g.add(w)
  }
  g.userData.reach = 1.18
  return g
}

/** Vaga-lumes soltos na resina: bolinhas de luz com halo, em lugares fixos. */
function buildFireflies(): THREE.Group {
  const g = new THREE.Group()
  const spots: [number, number, number, number][] = [
    [-0.55, 0.45, 0.3, 0.1], [0.5, 0.6, -0.2, 0.08], [0.1, -0.1, 0.65, 0.12], [-0.6, -0.5, -0.1, 0.09], [0.62, -0.35, 0.3, 0.1],
    [0.0, 0.8, 0.2, 0.07], [-0.2, 0.15, -0.6, 0.085], [0.35, 0.05, -0.55, 0.075], [-0.75, 0.0, 0.1, 0.07], [0.15, -0.72, -0.2, 0.08],
  ]
  const core = new THREE.MeshBasicMaterial({ color: '#f6ffa8', toneMapped: false })
  const halo = new THREE.MeshBasicMaterial({ color: '#b8ff70', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const wide = new THREE.MeshBasicMaterial({ color: '#7dff9a', transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  for (const [x, y, z, r] of spots) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), core); c.position.set(x, y, z); g.add(c)
    const h = new THREE.Mesh(new THREE.SphereGeometry(r * 3.2, 14, 10), halo); h.position.set(x, y, z); g.add(h)
    const w = new THREE.Mesh(new THREE.SphereGeometry(r * 6.5, 12, 8), wide); w.position.set(x, y, z); g.add(w)
  }
  g.userData.reach = 1.0
  return g
}

let insect: THREE.Group | null = null
let fireflies: THREE.Group | null = null

/** Faixas de um planeta gasoso, pintadas num canvas pequeno (a textura enrola na esfera). */
function planetBands(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64; c.height = 128
  const x = c.getContext('2d')!
  const bands = ['#f2c890', '#d89a5a', '#f6dcb0', '#b8703a', '#e8b478', '#f8e4c0', '#c88448', '#eac090', '#a85e30', '#e0a868', '#f4d4a0', '#cc8c50']
  bands.forEach((col, i) => { x.fillStyle = col; x.fillRect(0, (i * 128) / bands.length, 64, 128 / bands.length + 1) })
  // a grande mancha
  x.fillStyle = '#b0402a'; x.beginPath(); x.ellipse(40, 82, 9, 5, 0, 0, Math.PI * 2); x.fill()
  x.fillStyle = '#e07a50'; x.beginPath(); x.ellipse(40, 82, 5, 2.6, 0, 0, Math.PI * 2); x.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Um planeta com anéis, duas luas e umas estrelas em volta, preso na resina da galáxia. Os anéis ficam inclinados para quem olha de +z. */
function buildPlanet(): THREE.Group {
  const g = new THREE.Group()
  const tilt = new THREE.Group()
  tilt.rotation.set(1.12, 0, 0.42)
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.6, 40, 28), new THREE.MeshPhysicalMaterial({ map: planetBands(), roughness: 0.55, clearcoat: 0.35, emissive: new THREE.Color('#5a3418'), emissiveIntensity: 0.45 }))
  globe.rotation.x = Math.PI / 2   // os polos no eixo dos anéis
  tilt.add(globe)
  const rings: [number, number, string, number][] = [[0.76, 0.9, '#f4dcae', 0.75], [0.93, 1.08, '#c8a070', 0.6], [1.11, 1.24, '#f8ecd0', 0.4]]
  for (const [r0, r1, col, op] of rings) {
    tilt.add(new THREE.Mesh(new THREE.RingGeometry(r0, r1, 72), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false })))
  }
  g.add(tilt)
  const moon = new THREE.MeshPhysicalMaterial({ color: '#d8d4e8', roughness: 0.8, emissive: new THREE.Color('#6a6488'), emissiveIntensity: 0.5 })
  for (const [x, y, z, r] of [[-0.95, 0.62, 0.3, 0.11], [0.88, -0.7, 0.45, 0.075]] as const) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), moon); m.position.set(x, y, z); g.add(m)
  }
  const star = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
  const halo = new THREE.MeshBasicMaterial({ color: '#b8a6ff', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  for (const [x, y, z, r] of [[-0.7, -0.75, -0.3, 0.035], [0.5, 0.95, -0.2, 0.03], [1.05, 0.3, -0.5, 0.04], [-1.1, -0.1, -0.4, 0.028], [0.1, -1.1, 0.2, 0.03], [-0.3, 1.1, 0.3, 0.026]] as const) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), star); s.position.set(x, y, z); g.add(s)
    const h = new THREE.Mesh(new THREE.SphereGeometry(r * 3.4, 10, 8), halo); h.position.set(x, y, z); g.add(h)
  }
  g.userData.reach = 1.3
  return g
}

/** Um olho arrancado, olhando para +z: o branco com vasos, a íris vermelha que brilha no escuro e a pupila em fenda. */
function buildEye(): THREE.Group {
  const g = new THREE.Group()
  const white = new THREE.MeshPhysicalMaterial({ color: '#efe2d2', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 })
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), white))
  // calotas coladas na frente da esfera (o polo da calota vira para +z)
  const cap = (radius: number, angle: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 16, 0, Math.PI * 2, 0, angle), mat)
    m.rotation.x = Math.PI / 2
    g.add(m)
    return m
  }
  cap(1.004, 0.72, new THREE.MeshPhysicalMaterial({ color: '#3a0410', roughness: 0.4 }))                                         // o aro escuro da íris
  cap(1.008, 0.64, new THREE.MeshPhysicalMaterial({ color: '#e0203c', roughness: 0.3, emissive: new THREE.Color('#ff2848'), emissiveIntensity: 0.9 }))
  cap(1.012, 0.42, new THREE.MeshPhysicalMaterial({ color: '#ffb02a', roughness: 0.3, emissive: new THREE.Color('#ff8a1a'), emissiveIntensity: 0.9 }))   // o anel de fogo em volta da pupila
  // a pupila em fenda: uma faixa estreita e alta, colada na curva do olho
  const black = new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.DoubleSide })
  g.add(new THREE.Mesh(sphereBand(v3(0, 0, 1), v3(0, 1, 0), () => 0, (t) => 0.09 + 0.47 * Math.abs(Math.cos(t)) ** 1.6, 0, Math.PI * 2, 0.016, 64), black))
  // a córnea: uma cúpula de vidro com o reflexo da janela
  const cornea = cap(1.03, 0.8, new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false }))
  cornea.renderOrder = 1
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }))
  glint.position.copy(v3(-0.22, 0.28, 0.93).normalize().multiplyScalar(1.03)); g.add(glint)
  // vasos: fios vermelhos que saem de trás e vêm até perto da íris
  const vessel = new THREE.MeshPhysicalMaterial({ color: '#b01028', roughness: 0.4 })
  const on = (polar: number, a: number) => v3(Math.sin(polar) * Math.cos(a), Math.sin(polar) * Math.sin(a), Math.cos(polar)).multiplyScalar(1.004)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + (i % 3) * 0.14, wob = i % 2 ? 0.2 : -0.17
    g.add(new THREE.Mesh(tube([2.9, 2.3, 1.8, 1.4, 1.02].map((polar, j) => on(polar, a + wob * Math.sin(j * 1.3))), 0.026 + (i % 3) * 0.008), vessel))
    // um ramo fino saindo do meio de cada vaso
    g.add(new THREE.Mesh(tube([1.8, 1.55, 1.3].map((polar, j) => on(polar, a + wob * Math.sin(2.6) + (i % 2 ? 1 : -1) * 0.16 * j)), 0.014), vessel))
  }
  // o nervo, atrás
  const nerve = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.1, 6, 16), new THREE.MeshPhysicalMaterial({ color: '#b84a5a', roughness: 0.5 }))
  nerve.rotation.x = Math.PI / 2; nerve.position.set(0, 0, -0.95); g.add(nerve)
  g.userData.reach = 1.12
  // olha um pouco acima do número da face, para a fenda da pupila aparecer por cima dele
  g.userData.tilt = -0.2
  return g
}

let planet: THREE.Group | null = null
let eye: THREE.Group | null = null

/** Raio da maior esfera que cabe dentro do dado (encosta nas faces). */
function inradius(kind: DieKind): number {
  const p = polyhedron(kind)
  const r = DIE_RADIUS[kind]
  let min = Infinity
  p.faces.forEach((f, i) => {
    const n = p.normals[i], v = p.vertices[f[0]]
    min = Math.min(min, Math.abs(n[0] * v[0] + n[1] * v[1] + n[2] * v[2]) * r)
  })
  return min
}

/**
 * Vira o brinquedo para uma face do dado, em pé como o número dela (de frente para esse número). O dado usa a
 * face do número mais alto, sempre a mesma: o brinquedo é preso no dado e gira junto com ele, então não entrega o
 * resultado antes de parar.
 */
export function aimToy(toy: THREE.Object3D, kind: DieKind, face: number): void {
  const p = polyhedron(kind)
  const z = new THREE.Vector3(...p.normals[face])
  const y = new THREE.Vector3(...numberUp(p, face))
  const x = new THREE.Vector3().crossVectors(y, z)
  toy.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
  if (typeof toy.userData.tilt === 'number') toy.rotateX(toy.userData.tilt)
}

/** Uma cópia do brinquedinho, já do tamanho para ficar inteiro dentro deste dado (com folga da resina). */
export function makeToy(kind: DieKind, toy: 'nerd' | 'inseto' | 'vagalumes' | 'olho' | 'planeta'): THREE.Object3D {
  if (toy === 'nerd') nerd ??= buildNerd()
  if (toy === 'inseto') insect ??= buildInsect()
  const source = toy === 'nerd' ? nerd! : toy === 'inseto' ? insect! : toy === 'olho' ? (eye ??= buildEye()) : toy === 'planeta' ? (planet ??= buildPlanet()) : (fireflies ??= buildFireflies())
  const model = source.clone()
  const s = (inradius(kind) * 0.86) / (model.userData.reach as number)
  model.scale.setScalar(s)
  model.userData.toy = true
  // de frente, um pouquinho inclinado, como um brinquedo solto dentro da resina
  model.rotation.set(-0.12, 0.2, 0.04)
  return model
}
