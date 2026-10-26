import * as THREE from 'three'
import { numberUp, polyhedron, type DieKind } from './polyhedra'
import { DIE_RADIUS } from './simulate'

// ────────────────────────────────────────────────────────
// Brinquedinhos presos dentro dos dados de resina (o dado de betinha tester):
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
}

/** Uma cópia do brinquedinho, já do tamanho para ficar inteiro dentro deste dado (com folga da resina). */
export function makeToy(kind: DieKind, toy: 'nerd'): THREE.Object3D {
  if (toy === 'nerd') nerd ??= buildNerd()
  const model = nerd!.clone()
  const s = (inradius(kind) * 0.86) / (model.userData.reach as number)
  model.scale.setScalar(s)
  model.userData.toy = true
  // de frente, um pouquinho inclinado, como um brinquedo solto dentro da resina
  model.rotation.set(-0.12, 0.2, 0.04)
  return model
}
