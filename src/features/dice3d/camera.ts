import * as THREE from 'three'

// ────────────────────────────────────────────────────────
// A câmera do palco largo (rolagem livre): quanto mais dados, mais longe ela
// fica, até o chão visível dar espaço para todos deitarem sem se sobrepor. Com
// poucos dados a câmera fica perto e cada dado aparece grande; com cem, longe
// e cada dado aparece pequeno (o tamanho vai caindo aos poucos). Sem WebGL:
// só a matemática da câmera, então roda nos testes.
// ────────────────────────────────────────────────────────

/** A câmera de um dado só: perto, o dado ocupa boa parte do palco. */
export const BASE_CAMERA = { fov: 30, y: 8.4, z: 1.2 } as const

/** A que distância (em múltiplos da base) a câmera pode chegar: com 100 dados. */
export const MAX_CAMERA_SCALE = 10

/**
 * Área de chão que cada dado pede para deitar sem tocar nos outros (uma folga sobre o que ele ocupa).
 * Poucos dados cabem mais apertados; com muitos, a folga cresce, senão sempre sobra algum torto.
 */
export function floorPerDie(count: number): number {
  return count <= 2 ? 6 : count <= 12 ? 8 : count <= 30 ? 11 : 13
}

/** O retângulo do chão que a câmera vê, menos uma margem: ali os dados podem parar. */
export function floorArena(camera: THREE.PerspectiveCamera, margin: number): { halfW: number; halfD: number } {
  camera.updateMatrixWorld(true)
  const ray = new THREE.Raycaster()
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hit = (x: number, y: number) => {
    ray.setFromCamera(new THREE.Vector2(x, y), camera)
    const p = new THREE.Vector3()
    return ray.ray.intersectPlane(floor, p) ? p : new THREE.Vector3()
  }
  const halfW = Math.min(Math.abs(hit(-1, 0).x), Math.abs(hit(1, 0).x), Math.abs(hit(-1, -0.6).x), Math.abs(hit(1, -0.6).x))
  const halfD = Math.min(Math.abs(hit(0, 1).z), Math.abs(hit(0, -1).z))
  return { halfW: Math.max(2, halfW - margin), halfD: Math.max(1.6, halfD - margin) }
}

export function placeCamera(camera: THREE.PerspectiveCamera, scale: number): void {
  camera.position.set(0, BASE_CAMERA.y * scale, BASE_CAMERA.z * scale)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
}

/** A mesa onde os dados caem: o centro dela em z (`dz`) e a meia largura e meia profundidade. */
export interface TableArena { halfW: number; halfD: number; dz: number }

/** A caixa da tela (em coordenadas -1 a 1) em que cada dado inteiro precisa ficar visível. */
export interface ScreenBox {
  /** Metade da largura: dados vão até ±x. */
  x:      number
  top:    number
  bottom: number
}

/** O maior dado (raio do vértice mais longe), para conferir que ele cabe inteiro na caixa. */
const DIE_REACH = 1.2

/**
 * O maior retângulo de chão em que um dado, em qualquer ponto dele, aparece INTEIRO dentro da caixa da
 * tela (o dado parado tem o centro na altura do raio, e o topo mais perto da câmera, então "aparece maior"
 * e mais para fora). Começa pelo chão que a caixa mostra e encolhe até todos os cantos cabem.
 */
export function boxArena(camera: THREE.PerspectiveCamera, box: ScreenBox): TableArena {
  camera.updateMatrixWorld(true)
  const ray = new THREE.Raycaster()
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hit = (x: number, y: number) => {
    ray.setFromCamera(new THREE.Vector2(x, y), camera)
    const p = new THREE.Vector3()
    return ray.ray.intersectPlane(floor, p) ? p : new THREE.Vector3()
  }
  const zNear = hit(0, box.bottom).z
  const zFar = hit(0, box.top).z
  let halfW = Math.min(Math.abs(hit(box.x, box.bottom).x), Math.abs(hit(-box.x, box.bottom).x))
  let halfD = Math.abs(zNear - zFar) / 2
  const dz = (zNear + zFar) / 2
  const R = DIE_REACH
  const fits = () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const h of [0, 2 * R]) {
      const p = new THREE.Vector3(sx * (halfW + R * 0.2), h, dz + sz * (halfD + R * 0.2)).project(camera)
      if (Math.abs(p.x) > box.x || p.y > box.top || p.y < box.bottom) return false
    }
    return true
  }
  for (let i = 0; i < 80 && !fits() && halfW > 1.2 && halfD > 1.0; i++) { halfW *= 0.97; halfD *= 0.97 }
  return { halfW: Math.max(1.2, halfW), halfD: Math.max(1.0, halfD), dz }
}

/** A caixa de sempre, quando a tela não diz nada: quase toda a largura, com folga em cima e embaixo. */
export const DEFAULT_BOX: ScreenBox = { x: 0.95, top: 0.8, bottom: -0.8 }

/**
 * O menor chão em que um dado rola de verdade: menor que isso, o dado (um d20 tem mais de 2 de largura)
 * fica entalado entre as paredes e termina preso num canto ou apoiado nelas.
 */
export const MIN_ARENA = { halfW: 2.4, halfD: 1.7 } as const

/**
 * Afasta a câmera, de pouco em pouco, até a mesa visível ter `floorPerDie` por dado e o tamanho mínimo
 * (ou chegar ao limite). Devolve quantas vezes mais longe ficou e a mesa resultante.
 */
export function fitCamera(camera: THREE.PerspectiveCamera, count: number, box: ScreenBox = DEFAULT_BOX): { scale: number; arena: TableArena } {
  let scale = 1
  placeCamera(camera, scale)
  let arena = boxArena(camera, box)
  while (scale < MAX_CAMERA_SCALE && (arena.halfW < MIN_ARENA.halfW || arena.halfD < MIN_ARENA.halfD || 4 * arena.halfW * arena.halfD < count * floorPerDie(count))) {
    scale = Math.min(MAX_CAMERA_SCALE, scale * 1.06)
    placeCamera(camera, scale)
    arena = boxArena(camera, box)
  }
  return { scale, arena }
}
