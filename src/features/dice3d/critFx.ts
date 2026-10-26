import * as THREE from 'three'

// ────────────────────────────────────────────────────────
// A explosão do 20 natural, desenhada na própria cena 3D do palco (então tem
// a perspectiva certa e some junto com os dados): um clarão dourado atrás do
// dado, raios de luz girando, uma onda de choque que corre pelo chão, estrelas
// que piscam em volta e faíscas que voam para cima e caem. `CritBurst.update`
// devolve falso quando acabou, para o palco apagar.
// ────────────────────────────────────────────────────────

/** Duração total (s). */
export const CRIT_LIFE = 2.1

const SPARKS = 90
const STARS = 12
const GOLD = [new THREE.Color('#fff2b0'), new THREE.Color('#ffd25a'), new THREE.Color('#ffb02e'), new THREE.Color('#ffffff')]

let glowTex: THREE.CanvasTexture | null = null
let rayTex: THREE.CanvasTexture | null = null
let starTex: THREE.CanvasTexture | null = null
let dotTex: THREE.CanvasTexture | null = null

function canvasTex(size: number, paint: (g: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  paint(g, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function glowTexture(): THREE.CanvasTexture {
  return glowTex ??= canvasTex(128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    r.addColorStop(0, 'rgba(255,248,210,1)'); r.addColorStop(0.25, 'rgba(255,214,102,0.7)'); r.addColorStop(0.6, 'rgba(255,170,40,0.22)'); r.addColorStop(1, 'rgba(255,150,30,0)')
    g.fillStyle = r; g.fillRect(0, 0, s, s)
  })
}

/** Raios: 14 cunhas claras que somem na ponta. */
function rayTexture(): THREE.CanvasTexture {
  return rayTex ??= canvasTex(256, (g, s) => {
    const c = s / 2, n = 14
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, w = Math.PI / n * 0.42
      const r = g.createRadialGradient(c, c, 4, c, c, c)
      r.addColorStop(0, 'rgba(255,236,150,0.85)'); r.addColorStop(1, 'rgba(255,200,80,0)')
      g.fillStyle = r
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, c, a - w, a + w); g.closePath(); g.fill()
    }
  })
}

/** Estrela de quatro pontas. */
function starTexture(): THREE.CanvasTexture {
  return starTex ??= canvasTex(96, (g, s) => {
    const c = s / 2
    const r = g.createRadialGradient(c, c, 0, c, c, c)
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,240,170,0.9)'); r.addColorStop(1, 'rgba(255,200,80,0)')
    g.fillStyle = r
    g.beginPath()
    g.moveTo(c, 0); g.quadraticCurveTo(c, c, s, c); g.quadraticCurveTo(c, c, c, s); g.quadraticCurveTo(c, c, 0, c); g.quadraticCurveTo(c, c, c, 0)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(c, c, s * 0.07, 0, Math.PI * 2); g.fill()
  })
}

function dotTexture(): THREE.CanvasTexture {
  return dotTex ??= canvasTex(32, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r; g.fillRect(0, 0, s, s)
  })
}

/** Libera as texturas compartilhadas (quando o palco fecha). */
export function disposeCritTextures(): void {
  for (const t of [glowTex, rayTex, starTex, dotTex]) t?.dispose()
  glowTex = rayTex = starTex = dotTex = null
}

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3)

export class CritBurst {
  readonly group = new THREE.Group()
  private glow: THREE.Sprite
  private rays: THREE.Sprite
  private ring: THREE.Mesh
  private stars: { sprite: THREE.Sprite; vel: THREE.Vector3; spin: number; phase: number; size: number }[] = []
  private sparks: THREE.Points
  private vel: Float32Array
  private life: Float32Array
  private tint: Float32Array
  private t = 0
  private ringMat: THREE.MeshBasicMaterial
  private readonly u: number

  /** `center`: onde está o dado; `size`: raio do dado (escala tudo); `strength`: 1 para um 20, menos quando há vários. */
  constructor(center: THREE.Vector3, size: number, strength = 1) {
    this.group.position.copy(center)
    const u = this.u = Math.max(0.6, size)

    const add = (tex: THREE.Texture, opacity: number): THREE.Sprite => {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })
      const s = new THREE.Sprite(m)
      s.renderOrder = 10
      this.group.add(s)
      return s
    }
    this.glow = add(glowTexture(), 0)
    this.rays = add(rayTexture(), 0)

    // onda de choque: um anel deitado no chão
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 64), this.ringMat)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.y = 0.06 - center.y
    this.ring.renderOrder = 9
    this.group.add(this.ring)

    const rnd = Math.random
    const nStars = Math.round(STARS * strength)
    for (let i = 0; i < nStars; i++) {
      const sprite = add(starTexture(), 0)
      const a = rnd() * Math.PI * 2, out = (1.6 + rnd() * 2.6) * u
      this.stars.push({
        sprite, size: (0.16 + rnd() * 0.34) * u, spin: (rnd() - 0.5) * 5, phase: rnd() * 6,
        vel: new THREE.Vector3(Math.cos(a) * out, (1.2 + rnd() * 2.4) * u, Math.sin(a) * out * 0.7),
      })
    }

    // faíscas: pontinhos dourados em arco
    const n = Math.round(SPARKS * strength)
    const pos = new Float32Array(n * 3)
    this.vel = new Float32Array(n * 3)
    this.life = new Float32Array(n)
    this.tint = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, el = 0.25 + rnd() * 1.1, sp = (2.2 + rnd() * 5.5) * u
      this.vel[i * 3] = Math.cos(a) * Math.cos(el) * sp
      this.vel[i * 3 + 1] = Math.sin(el) * sp + 1.5
      this.vel[i * 3 + 2] = Math.sin(a) * Math.cos(el) * sp * 0.8
      this.life[i] = 0.7 + rnd() * 1.3
      const c = GOLD[Math.floor(rnd() * GOLD.length)]
      this.tint.set([c.r, c.g, c.b], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.tint), 3))
    this.sparks = new THREE.Points(geo, new THREE.PointsMaterial({
      map: dotTexture(), size: 0.34 * u, sizeAttenuation: true, vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }))
    this.sparks.frustumCulled = false
    this.sparks.renderOrder = 11
    this.group.add(this.sparks)
  }

  /** Avança dt segundos; falso quando acabou. */
  update(dt: number): boolean {
    this.t += dt
    const t = this.t
    const k = Math.min(1, t / CRIT_LIFE)
    const u = this.u

    // clarão: sobe depressa, desce devagar, com um pulso
    const flash = Math.min(1, t / 0.1) * Math.pow(1 - k, 2.6)
    this.glow.material.opacity = 0.5 * flash * (0.85 + 0.15 * Math.sin(t * 18))
    this.glow.scale.setScalar(u * (2.2 + easeOut(Math.min(1, t / 0.5)) * 2.2))

    // raios girando, abrindo e apagando
    this.rays.material.opacity = 0.4 * Math.min(1, t / 0.15) * Math.pow(1 - k, 1.6)
    this.rays.material.rotation = t * 0.9
    this.rays.scale.setScalar(u * (2.4 + easeOut(Math.min(1, t / 0.9)) * 3.2))

    // onda de choque no chão
    const rk = Math.min(1, t / 0.9)
    this.ring.scale.setScalar(u * (0.5 + easeOut(rk) * 4.5))
    this.ringMat.opacity = rk < 1 ? 0.9 * (1 - rk) : 0

    // estrelas: voam, brilham e piscam
    for (const s of this.stars) {
      const age = t - s.phase * 0.03
      if (age < 0) { s.sprite.material.opacity = 0; continue }
      s.sprite.position.set(s.vel.x * age * 0.7, s.vel.y * age - 2.4 * age * age, s.vel.z * age * 0.7)
      const fade = Math.max(0, 1 - age / (CRIT_LIFE * 0.9))
      const twinkle = 0.55 + 0.45 * Math.sin(age * 16 + s.phase)
      s.sprite.material.opacity = Math.min(1, fade * twinkle * 1.3)
      s.sprite.material.rotation += s.spin * dt
      s.sprite.scale.setScalar(s.size * (0.6 + Math.min(1, age / 0.25) * 0.8))
    }

    // faíscas: balística com atrito; a cor some com a vida (aditivo)
    const pos = this.sparks.geometry.getAttribute('position') as THREE.BufferAttribute
    const col = this.sparks.geometry.getAttribute('color') as THREE.BufferAttribute
    const n = this.life.length
    const drag = Math.pow(0.35, dt)
    for (let i = 0; i < n; i++) {
      const i3 = i * 3
      this.vel[i3] *= drag; this.vel[i3 + 2] *= drag
      this.vel[i3 + 1] = this.vel[i3 + 1] * drag - 9 * dt
      pos.array[i3] += this.vel[i3] * dt
      pos.array[i3 + 1] = Math.max(-this.group.position.y + 0.1, pos.array[i3 + 1] + this.vel[i3 + 1] * dt)
      pos.array[i3 + 2] += this.vel[i3 + 2] * dt
      const alive = Math.max(0, 1 - t / this.life[i])
      const flick = alive * (0.7 + 0.3 * Math.sin(t * 30 + i))
      col.array[i3] = this.tint[i3] * flick; col.array[i3 + 1] = this.tint[i3 + 1] * flick; col.array[i3 + 2] = this.tint[i3 + 2] * flick
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    return t < CRIT_LIFE
  }

  dispose(): void {
    this.group.removeFromParent()
    for (const s of this.group.children) {
      if (s instanceof THREE.Sprite) s.material.dispose()
    }
    this.ring.geometry.dispose()
    this.ringMat.dispose()
    this.sparks.geometry.dispose()
    ;(this.sparks.material as THREE.Material).dispose()
  }
}
