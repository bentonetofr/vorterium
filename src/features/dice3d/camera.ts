import * as THREE from 'three'

// ────────────────────────────────────────────────────────
// A câmera do palco largo (rolagem livre): quanto mais dados, mais longe ela
// fica, até o chão visível dar espaço para todos deitarem sem se sobrepor. Com
// poucos dados a câmera fica perto e cada dado aparece grande; com cem, longe
// e cada dado aparece pequeno (o tamanho vai caindo aos poucos). Sem WebGL:
// só a matemática da câmera, então roda nos testes.
// ────────────────────────────────────────────────────────

/** A câmera de um dado só: perto, o dado ocupa boa parte do palco. */
export const BASE_CAMERA = { fov: 30, y: 8.4, z: 2.1 } as const

/** A que distância (em múltiplos da base) a câmera pode chegar: com 100 dados. */
export const MAX_CAMERA_SCALE = 9

/**
 * Área de chão que cada dado pede para deitar sem tocar nos outros (uma folga sobre o que ele ocupa).
 * Poucos dados cabem mais apertados; com muitos, a folga cresce, senão sempre sobra algum torto.
 */
export function floorPerDie(count: number): number {
  return count <= 12 ? 7 : count <= 30 ? 11 : 14
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

/**
 * Afasta a câmera, de pouco em pouco, até o chão visível ter `floorPerDie` por dado
 * (ou chegar ao limite). Devolve quantas vezes mais longe ficou e o chão resultante.
 */
export function fitCamera(camera: THREE.PerspectiveCamera, count: number, margin: number): { scale: number; arena: { halfW: number; halfD: number } } {
  let scale = 1
  placeCamera(camera, scale)
  let arena = floorArena(camera, margin)
  while (scale < MAX_CAMERA_SCALE && 4 * arena.halfW * arena.halfD < count * floorPerDie(count)) {
    scale = Math.min(MAX_CAMERA_SCALE, scale * 1.06)
    placeCamera(camera, scale)
    arena = floorArena(camera, margin)
  }
  return { scale, arena }
}
