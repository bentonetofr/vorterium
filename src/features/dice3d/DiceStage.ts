import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { alignments, labelForValue, labelText, numberUp, polyhedron, quatFromM3, upIndex, type DieKind, type V3 } from './polyhedra'
import { DIE_RADIUS, STEP_HZ, simulateThrow, type SimResult, type ThrowStyle } from './simulate'
import { dieGeometry, dieMaterial, ensureDiceFont } from './dieMesh'
import { getSkin } from './skins'
import { playDiceHit } from './sound'

// ────────────────────────────────────────────────────────
// O palco dos dados: uma cena 3D transparente por cima de um elemento da
// página. `roll` simula o lançamento inteiro (simulate.ts), gira cada dado
// pela simetria que mostra o valor sorteado (polyhedra.ts) e toca a gravação
// com som. Dois estilos: 'stage' (um d20 de perto, no painel de teste) e
// 'tray' (vários dados numa bandeja larga).
// ────────────────────────────────────────────────────────

export interface StageDie {
  kind:   DieKind
  /** Valor sorteado (d10: 1 a 10; d%: 0, 10 ... 90). */
  value:  number
  /** Conjunto deste dado (padrão: o do lançamento). */
  skin?:  string
  /** Não vale (ex.: o d20 descartado na vantagem): apaga quando para. */
  dim?:   boolean
}

export interface RollOptions {
  skin?: string; seed?: number; sound?: boolean; speed?: number
  /** Vários lançamentos ao mesmo tempo: cada um usa a sua faixa do chão (`index` de 0 a `count - 1`). */
  lane?: { index: number; count: number }
}

/** Um lançamento em andamento ou parado na mesa. `done` resolve quando os dados param; `remove` tira só os dados dele. */
export interface ThrowHandle { done: Promise<void>; remove: () => void }

interface LiveDie {
  mesh:   THREE.Mesh
  frames: Float32Array
  fix:    THREE.Quaternion
  /** Giro em torno do eixo vertical aplicado em todo o lançamento (só no palco). */
  yaw:    THREE.Quaternion
  dim:    boolean
}

/** Um lançamento: os dados dele, a gravação da física e o ponto em que está. */
interface Throw {
  dice:    LiveDie[]
  sim:     SimResult
  start:   number
  speed:   number
  sound:   boolean
  sounds:  SimResult['impacts']
  nextSound: number
  /** Deslocamento da faixa do chão em x. */
  dx:      number
  phase:   'run' | 'settle' | 'rest'
  settleStart: number
  resolve: () => void
}

/** Tem WebGL e a pessoa não pediu menos movimento? Senão, a tela usa o modo simples. */
export function diceStageSupported(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch { return false }
}

export class DiceStage {
  readonly style: ThrowStyle
  private host: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private throws: Throw[] = []
  private raf = 0
  private resizeObs: ResizeObserver
  private disposed = false
  private idleMesh: THREE.Mesh | null = null

  constructor(host: HTMLElement, style: ThrowStyle) {
    this.host = host
    this.style = style
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setClearColor(0x000000, 0)
    const el = this.renderer.domElement
    el.style.position = 'absolute'
    el.style.inset = '0'
    el.style.width = '100%'
    el.style.height = '100%'
    el.style.pointerEvents = 'none'
    host.appendChild(el)
    // contexto perdido (o navegador tira de quem passa do limite): some, em vez de ficar um retângulo em branco por cima da tela
    el.addEventListener('webglcontextlost', (e) => { e.preventDefault(); el.style.visibility = 'hidden' })
    el.addEventListener('webglcontextrestored', () => { el.style.visibility = ''; this.render() })

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.35
    pmrem.dispose()

    this.camera = new THREE.PerspectiveCamera(style === 'stage' ? 30 : 32, 1, 0.1, 200)
    if (style === 'stage') this.camera.position.set(0, 8.4, 2.1)
    else this.camera.position.set(0, 16.5, 3.4)
    this.camera.lookAt(0, 0, 0)

    this.scene.add(new THREE.HemisphereLight(0xfff1dc, 0x1c1424, 0.55))
    const key = new THREE.DirectionalLight(0xfff4e6, 2.4)
    key.position.set(6, 16, 9)
    key.castShadow = true
    key.shadow.mapSize.set(style === 'stage' ? 1024 : 2048, style === 'stage' ? 1024 : 2048)
    const sc = key.shadow.camera
    sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 50
    key.shadow.bias = -0.0004
    key.shadow.radius = 4
    this.scene.add(key)
    const rim = new THREE.PointLight(0xd9363e, 18, 30, 2)
    rim.position.set(-7, 4, -5)
    this.scene.add(rim)

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.42 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(host)
    this.resize()
  }

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.render()
  }

  /** O retângulo do chão que a câmera vê, menos uma margem: ali os dados podem parar. */
  private arena(): { halfW: number; halfD: number } {
    const ray = new THREE.Raycaster()
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hit = (x: number, y: number) => {
      ray.setFromCamera(new THREE.Vector2(x, y), this.camera)
      const p = new THREE.Vector3()
      return ray.ray.intersectPlane(floor, p) ? p : new THREE.Vector3()
    }
    const halfW = Math.min(Math.abs(hit(-1, 0).x), Math.abs(hit(1, 0).x), Math.abs(hit(-1, -0.6).x), Math.abs(hit(1, -0.6).x))
    const halfD = Math.min(Math.abs(hit(0, 1).z), Math.abs(hit(0, -1).z))
    const margin = this.style === 'stage' ? 1.7 : 1.45
    return { halfW: Math.max(2, halfW - margin), halfD: Math.max(1.6, halfD - margin) }
  }

  private render(): void {
    if (!this.disposed) this.renderer.render(this.scene, this.camera)
  }

  /** Os dados que estão na mesa agora (de todos os lançamentos). */
  private get live(): LiveDie[] { return this.throws.flatMap((t) => t.dice) }

  /** Quantos lançamentos cabem lado a lado no chão que a câmera vê (1 a 3). */
  laneCount(): number {
    return Math.max(1, Math.min(3, Math.floor((this.arena().halfW * 2) / 5.5)))
  }

  /** Tira os dados da mesa (e o dado parado do palco). */
  clear(): void {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    for (const t of this.throws) this.dropDice(t)
    this.throws = []
    if (this.idleMesh) { this.scene.remove(this.idleMesh); (this.idleMesh.material as THREE.Material).dispose(); this.idleMesh = null }
    this.render()
  }

  private dropDice(t: Throw): void {
    for (const d of t.dice) { this.scene.remove(d.mesh); (d.mesh.material as THREE.Material).dispose() }
  }

  /** Antes de rolar: um dado flutuando no meio do palco, girando devagar ("clique para rolar"). */
  async idle(kind: DieKind, skin?: string): Promise<void> {
    await ensureDiceFont()
    this.clear()
    if (this.disposed) return
    const mesh = new THREE.Mesh(dieGeometry(kind), dieMaterial(kind, getSkin(skin)))
    mesh.castShadow = true
    mesh.scale.setScalar(1.15)
    this.idleMesh = mesh
    this.scene.add(mesh)
    const start = performance.now()
    const tick = () => {
      if (this.disposed || this.idleMesh !== mesh) return
      const t = (performance.now() - start) / 1000
      mesh.position.set(0, 2.2 + Math.sin(t * 1.6) * 0.18, 0)
      mesh.rotation.set(0.5 + Math.sin(t * 0.7) * 0.25, t * 0.6, 0.3 + Math.cos(t * 0.5) * 0.2)
      this.render()
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  /** Joga os dados (tirando os que estavam na mesa) e resolve quando todos param e os descartados apagam. */
  async roll(dice: readonly StageDie[], opts: RollOptions = {}): Promise<void> {
    await ensureDiceFont()
    this.clear()
    const handle = await this.addThrow(dice, opts)
    await handle.done
  }

  /**
   * Joga os dados SEM tirar os que já estão na mesa: vários lançamentos
   * rolam juntos, cada um na sua faixa (`opts.lane`), e cada um pode sair da
   * mesa sozinho (`remove`).
   */
  async addThrow(dice: readonly StageDie[], opts: RollOptions = {}): Promise<ThrowHandle> {
    await ensureDiceFont()
    if (this.disposed || dice.length === 0) return { done: Promise.resolve(), remove: () => {} }
    if (this.idleMesh) this.clear()
    const arena = this.arena()
    let dx = 0
    if (opts.lane && opts.lane.count > 1) {
      const w = arena.halfW / opts.lane.count
      dx = -arena.halfW + (2 * opts.lane.index + 1) * w
      arena.halfW = w
    }
    const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31)
    const sim: SimResult = simulateThrow(dice.map((d) => d.kind), { arena, style: this.style, seed })

    const live: LiveDie[] = dice.map((d, i) => {
      const p = polyhedron(d.kind)
      // a face lida é a que fica de frente para a câmera (no d4, o vértice de cima)
      const fr = sim.frames[i], o = (sim.steps - 1) * 7
      const toCam: V3 = [this.camera.position.x - (fr[o] + dx), this.camera.position.y - fr[o + 1], this.camera.position.z - fr[o + 2]]
      const body = new THREE.Quaternion(fr[o + 3], fr[o + 4], fr[o + 5], fr[o + 6])
      const up = p.readsVertex ? sim.up[i] : upIndex(p, [body.x, body.y, body.z, body.w], toCam)
      const label = labelForValue(d.kind, d.value)
      // entre as simetrias possíveis, a que deixa o número mais em pé na tela (topo da tela = −z)
      let fix = new THREE.Quaternion(), best = -Infinity
      for (const m of alignments(p, up, label)) {
        const q = new THREE.Quaternion(...quatFromM3(m))
        const face = p.readsVertex ? -1 : p.labels.indexOf(label)
        const score = face < 0 ? 0 : -new THREE.Vector3(...numberUp(p, face)).applyQuaternion(q).applyQuaternion(body).z
        if (score > best) { best = score; fix = q }
      }
      // no palco (um dado só), gira tudo em torno do eixo vertical para o número ficar reto
      const yaw = new THREE.Quaternion()
      if (this.style === 'stage' && !p.readsVertex) {
        const dir = new THREE.Vector3(...numberUp(p, p.labels.indexOf(label))).applyQuaternion(fix).applyQuaternion(body)
        yaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dir.x, -dir.z))
      }
      const mesh = new THREE.Mesh(dieGeometry(d.kind), dieMaterial(d.kind, getSkin(d.skin ?? opts.skin)))
      mesh.castShadow = true
      mesh.userData.kind = d.kind
      this.scene.add(mesh)
      return { mesh, frames: sim.frames[i], fix, yaw, dim: !!d.dim }
    })

    let resolve: () => void = () => {}
    const done = new Promise<void>((r) => { resolve = r })
    const th: Throw = {
      dice: live, sim, start: performance.now(), speed: opts.speed ?? 1, sound: opts.sound !== false,
      sounds: [...sim.impacts].sort((x, y) => x.step - y.step), nextSound: 0, dx, phase: 'run', settleStart: 0, resolve,
    }
    this.throws.push(th)
    if (!this.raf) this.raf = requestAnimationFrame(this.loop)
    return { done, remove: () => this.removeThrow(th) }
  }

  private removeThrow(t: Throw): void {
    const i = this.throws.indexOf(t)
    if (i < 0) return
    this.dropDice(t)
    this.throws.splice(i, 1)
    this.render()
  }

  private q0 = new THREE.Quaternion()
  private q1 = new THREE.Quaternion()

  /** Um quadro: cada lançamento em andamento toca a gravação (ou dá o pulinho final), e a cena é desenhada uma vez. */
  private loop = (): void => {
    this.raf = 0
    if (this.disposed) { for (const t of this.throws) t.resolve(); return }
    const now = performance.now()
    let running = false
    for (const t of this.throws) {
      if (t.phase === 'run') this.stepRun(t, now)
      if (t.phase === 'settle') this.stepSettle(t, now)
      if (t.phase !== 'rest') running = true
    }
    this.render()
    if (running) this.raf = requestAnimationFrame(this.loop)
  }

  private stepRun(th: Throw, now: number): void {
    const sim = th.sim
    const t = ((now - th.start) / 1000) * STEP_HZ * th.speed
    const i0 = Math.min(Math.floor(t), sim.steps - 1)
    const i1 = Math.min(i0 + 1, sim.steps - 1)
    const f = Math.min(1, t - i0)
    for (const d of th.dice) {
      const a = i0 * 7, b = i1 * 7, fr = d.frames
      d.mesh.position.set(th.dx + fr[a] + (fr[b] - fr[a]) * f, fr[a + 1] + (fr[b + 1] - fr[a + 1]) * f, fr[a + 2] + (fr[b + 2] - fr[a + 2]) * f)
      this.q0.set(fr[a + 3], fr[a + 4], fr[a + 5], fr[a + 6])
      this.q1.set(fr[b + 3], fr[b + 4], fr[b + 5], fr[b + 6])
      d.mesh.quaternion.slerpQuaternions(this.q0, this.q1, f).premultiply(d.yaw).multiply(d.fix)
      // entrada: cresce nos primeiros quadros, como se viesse da mão
      d.mesh.scale.setScalar(Math.min(1, 0.55 + t / 10))
    }
    if (th.sound) {
      while (th.nextSound < th.sounds.length && th.sounds[th.nextSound].step <= t) {
        playDiceHit(th.sounds[th.nextSound].strength, th.sounds[th.nextSound].withDie)
        th.nextSound++
      }
    }
    if (i0 >= sim.steps - 1) {
      // fim do lançamento: os descartados (ex.: o d20 que perdeu na vantagem) ficam translúcidos
      th.phase = 'settle'
      th.settleStart = now
      for (const d of th.dice) if (d.dim) { const m = d.mesh.material as THREE.MeshPhysicalMaterial; m.transparent = true; m.depthWrite = false; m.needsUpdate = true }
    }
  }

  /** Fim do lançamento: os que valem dão um pulinho e os descartados apagam. */
  private stepSettle(th: Throw, now: number): void {
    const k = Math.min(1, (now - th.settleStart) / 360)
    for (const d of th.dice) {
      if (d.dim) (d.mesh.material as THREE.MeshPhysicalMaterial).opacity = 1 - 0.7 * k
      else d.mesh.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.1)
    }
    if (k >= 1) { th.phase = 'rest'; th.resolve() }
  }

  /** O número que cada dado mostra agora, lido pela face de frente para a câmera (para conferir). */
  readFaces(): string[] {
    return this.live.map((d) => {
      const kind = d.mesh.userData.kind as DieKind
      const p = polyhedron(kind)
      const q = d.mesh.quaternion
      const toCam: V3 = [this.camera.position.x - d.mesh.position.x, this.camera.position.y - d.mesh.position.y, this.camera.position.z - d.mesh.position.z]
      const i = upIndex(p, p.readsVertex ? [q.x, q.y, q.z, q.w] : [q.x, q.y, q.z, q.w], p.readsVertex ? [0, 1, 0] : toCam)
      return labelText(kind, p.labels[i])
    })
  }

  /** Posição na tela (em px, relativa ao elemento) de cada dado, para efeitos por cima. */
  screenPositions(): { x: number; y: number; r: number }[] {
    const w = this.host.clientWidth, h = this.host.clientHeight
    return this.live.map((d) => {
      const p = d.mesh.position.clone().project(this.camera)
      const edge = d.mesh.position.clone().add(new THREE.Vector3(DIE_RADIUS[d.mesh.userData.kind as DieKind] ?? 1, 0, 0)).project(this.camera)
      return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, r: Math.abs(edge.x - p.x) / 2 * w }
    })
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObs.disconnect()
    for (const t of this.throws) { this.dropDice(t); t.resolve() }
    this.throws = []
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
