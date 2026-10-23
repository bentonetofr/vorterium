import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { dieGeometry, dieMaterial, ensureDiceFont } from './dieMesh'
import { DIE_RADIUS } from './simulate'
import { getSkin } from './skins'

// ────────────────────────────────────────────────────────
// A vitrine dos conjuntos de dados: UM só canvas por cima de uma grade de
// cartões, com um d20 de cada conjunto girando devagar no lugar do cartão.
// Um canvas só (e não um por conjunto) porque o navegador limita quantos
// contextos WebGL ficam vivos. A câmera mapeia 1 unidade da cena para 1 px da
// tela, então o dado cai exatamente no centro do elemento que o marca.
// ────────────────────────────────────────────────────────

export interface ShowcaseItem {
  /** Id do conjunto (skins.ts). */
  id: string
  /** Elemento da página em que o dado fica (o centro dele é o do dado). */
  el: HTMLElement
}

interface Slot {
  id: string
  el: HTMLElement
  mesh: THREE.Mesh
  /** Ângulo de giro (rad), acumulado para o giro acelerar e frear sem pular. */
  spin: number
  phase: number
  grow: number
}

const CAMERA_DISTANCE = 1100
const SPIN_SPEED = 0.42
const HOVER_SPEED = 1.5

export class DiceShowcase {
  private host: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(30, 1, 10, 4000)
  private slots: Slot[] = []
  private hover: string | null = null
  private raf = 0
  private last = 0
  private resizeObs: ResizeObserver
  private disposed = false

  constructor(host: HTMLElement) {
    this.host = host
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.setClearColor(0x000000, 0)
    const el = this.renderer.domElement
    el.style.position = 'absolute'
    el.style.inset = '0'
    el.style.width = '100%'
    el.style.height = '100%'
    el.style.pointerEvents = 'none'
    host.appendChild(el)
    el.addEventListener('webglcontextlost', (e) => { e.preventDefault(); el.style.visibility = 'hidden' })
    el.addEventListener('webglcontextrestored', () => { el.style.visibility = '' })

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.4
    pmrem.dispose()

    this.scene.add(new THREE.HemisphereLight(0xfff1dc, 0x1c1424, 0.6))
    const key = new THREE.DirectionalLight(0xfff4e6, 2.6)
    key.position.set(-300, 700, 900)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0xff5a64, 1.3)
    rim.position.set(500, -200, -300)
    this.scene.add(rim)

    this.resizeObs = new ResizeObserver(() => this.layout())
    this.resizeObs.observe(host)
  }

  /** Monta os dados (um d20 por conjunto) nos elementos marcados e começa a girar. */
  async show(items: readonly ShowcaseItem[]): Promise<void> {
    await ensureDiceFont()
    if (this.disposed) return
    this.clearSlots()
    const geo = dieGeometry('d20')
    this.slots = items.map((it, i) => {
      const mesh = new THREE.Mesh(geo, dieMaterial('d20', getSkin(it.id)))
      this.scene.add(mesh)
      return { id: it.id, el: it.el, mesh, spin: i * 0.9, phase: i * 1.7, grow: 1 }
    })
    this.layout()
    this.last = performance.now()
    cancelAnimationFrame(this.raf)
    this.raf = requestAnimationFrame(this.tick)
  }

  /** O conjunto sob o ponteiro gira mais rápido e cresce um pouco. */
  setHover(id: string | null): void { this.hover = id }

  private clearSlots(): void {
    for (const s of this.slots) { this.scene.remove(s.mesh); (s.mesh.material as THREE.Material).dispose() }
    this.slots = []
  }

  private size(): { w: number; h: number } {
    return { w: Math.max(1, this.host.clientWidth), h: Math.max(1, this.host.clientHeight) }
  }

  private layout(): void {
    if (this.disposed) return
    const { w, h } = this.size()
    this.renderer.setSize(w, h, false)
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(h / 2 / CAMERA_DISTANCE))
    this.camera.aspect = w / h
    this.camera.position.set(0, 0, CAMERA_DISTANCE)
    this.camera.updateProjectionMatrix()
    this.place()
    this.renderer.render(this.scene, this.camera)
  }

  /**
   * Põe cada dado no centro do elemento dele. Roda a cada quadro (e não só ao
   * redimensionar) porque a janela se mexe sozinha: a animação de abrir, a
   * rolagem da lista e a grade reorganizando mudam a posição sem avisar.
   */
  private place(): void {
    const { w, h } = this.size()
    const box = this.host.getBoundingClientRect()
    // com a janela crescendo na animação de abrir, os retângulos vêm em px já escalados: volta para os da página
    const k = box.width > 0 ? box.width / w : 1
    for (const s of this.slots) {
      const r = s.el.getBoundingClientRect()
      s.mesh.userData.base = (Math.min(r.width, r.height) / k * 0.46) / DIE_RADIUS.d20
      s.mesh.position.set((r.left - box.left + r.width / 2) / k - w / 2, h / 2 - (r.top - box.top + r.height / 2) / k, 0)
    }
  }

  private tick = (now: number): void => {
    if (this.disposed) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.place()
    for (const s of this.slots) {
      const hot = this.hover === s.id
      s.spin += dt * (hot ? HOVER_SPEED : SPIN_SPEED)
      s.phase += dt * 0.5
      s.grow += ((hot ? 1.14 : 1) - s.grow) * Math.min(1, dt * 9)
      s.mesh.rotation.set(0.5 + Math.sin(s.phase) * 0.18, s.spin, 0.28 + Math.cos(s.phase * 0.8) * 0.12)
      s.mesh.scale.setScalar((s.mesh.userData.base as number) * s.grow)
    }
    this.renderer.render(this.scene, this.camera)
    this.raf = requestAnimationFrame(this.tick)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObs.disconnect()
    this.clearSlots()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
