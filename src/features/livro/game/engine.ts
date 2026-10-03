import type { Dir, NetPeer, PanelId, PosMsg } from '../livroNet'
import type { GameView } from '../livroService'
import { candleTip, CLOAKS, drawActor, drawFlame, drawRoomBackground, H, makeCanvas, outlineOf, px, W, type Ctx } from './art'
import { buildRoom, FEET, FLOOR, inRect, overlaps, SPAWNS, type Interactable, type Rect } from './room'

// ────────────────────────────────────────────────────────
// O motor dos joguinhos em pixel art (o Livro Bloqueado e quem vier no
// mesmo molde). Desenha a sala na resolução nativa (384×216) e amplia sem
// suavizar; anda com WASD (ou setas); o mouse destaca os objetos e,
// clicando, o boneco vai até lá sozinho (A*) e abre.
// Os outros bonecos chegam pela rede e são desenhados um pouquinho no
// passado (110 ms), entre duas posições conhecidas — fica liso.
//
// O que muda de um jogo pro outro é a CENA (Scene): a sala, o fundo, os
// enfeites, a luz e como o estado do jogo aparece nos objetos. O Livro
// usa a cena da biblioteca (livroScene, no fim do arquivo).
// ────────────────────────────────────────────────────────

const SPEED = 72              // pixels nativos por segundo
const SEND_EVERY = 1000 / 12  // posição pra rede: 12 por segundo
const INTERP_DELAY = 110
const HILITE = '#ffe7a3'

export interface GamePlayer { uid: string; name: string; slot: number }

export interface GameOptions<Id extends string = PanelId> {
  meUid:        string
  /** Eu sou um dos jogadores (senão só assisto). */
  controllable: boolean
  /** Onde guardar a minha posição (volta ao recarregar a página). */
  storageKey:   string
  onOpen:       (id: Id) => void
  onWatch:      (uid: string) => void
  onPos:        (msg: PosMsg<Id>) => void
  /** Alguém (de fora) abriu ou fechou a janela de um objeto. */
  onRemotePanel: (uid: string, panel: Id | null) => void
  /**
   * Ampliar só em números inteiros (pixel perfeito). Padrão: sim. Quem
   * divide a tela em duas salas pequenas desliga, senão fica tudo em 1×.
   */
  integerScale?: boolean
}

/** Um boneco já posto na tela neste quadro (pra luz e nomes). */
export interface Placed { slot: number; x: number; y: number }

/** Uma coisa da sala desenhada na ordem do "pé" (enfeites, castiçais…). */
export interface Decor { base: number; draw: (n: Ctx, time: number) => void }

/** O que faz uma sala ser ela mesma. O motor cuida do resto. */
export interface Scene<Id extends string, G> {
  objects:    Interactable<Id>[]
  obstacles:  Rect[]
  /** Limites do chão pros pés. */
  floor:      { x0: number; y0: number; x1: number; y1: number }
  /** Onde cada jogador aparece (pelo slot). */
  spawns:     { x: number; y: number; d: Dir }[]
  /** Fundo fixo (desenhado uma vez). */
  background: HTMLCanvasElement
  decor?:     Decor[]
  /** Depois do desenho do objeto (ex.: velas acesas, livro aberto). */
  drawObject?: (n: Ctx, o: Interactable<Id>, time: number, game: G | null) => void
  /** A luz por cima de tudo: l é a camada de escuridão (furos com destination-out), n a cena. */
  drawLight:  (l: Ctx, n: Ctx, light: HTMLCanvasElement, time: number, placed: Placed[], game: G | null) => void
  /**
   * Como um jogador aparece nesta sala: 'full' (normal) ou 'ghost' (está em
   * outro lugar — ex.: o outro andar da torre). Sem isso, todos são 'full'.
   */
  actorMode?: (slot: number) => 'full' | 'ghost'
  /** Desenha um 'ghost' (ex.: a sombra de quem anda do outro lado da grade). */
  drawGhost?: (n: Ctx, x: number, y: number, time: number) => void
}

interface Sample { t: number; x: number; y: number; d: Dir; m: boolean }

interface Actor<Id extends string> {
  uid:     string
  name:    string
  slot:    number
  x:       number
  y:       number
  d:       Dir
  moving:  boolean
  panel:   Id | null
  online:  boolean
  animT:   number
  samples: Sample[]
}

export class RoomGame<Id extends string, G> {
  private canvas: HTMLCanvasElement
  private ctx: Ctx
  private native: HTMLCanvasElement
  private nctx: Ctx
  private light: HTMLCanvasElement
  private lctx: Ctx
  private bg: HTMLCanvasElement
  private scene: Scene<Id, G>
  private outlines = new Map<Id, HTMLCanvasElement>()
  private masks = new Map<Id, Uint8ClampedArray>()
  private opts: GameOptions<Id>
  private actors = new Map<string, Actor<Id>>()
  private keys = new Set<string>()
  private frozen = false
  private myPanel: Id | null = null
  private hover: Id | null = null
  private hoverBubble: string | null = null
  private mouse: { x: number; y: number } | null = null
  private path: { pts: { x: number; y: number }[]; open: Id; stuck: number } | null = null
  private scale = 1
  private offX = 0
  private offY = 0
  private dpr = 1
  private raf = 0
  private last = 0
  private lastSend = 0
  private lastSent = ''
  private lastSave = 0
  private disposers: (() => void)[] = []
  private game: G | null = null

  constructor(canvas: HTMLCanvasElement, opts: GameOptions<Id>, scene: Scene<Id, G>) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.opts = opts
    ;[this.native, this.nctx] = makeCanvas(W, H)
    ;[this.light, this.lctx] = makeCanvas(W, H)
    this.scene = scene
    this.bg = scene.background
    for (const o of scene.objects) {
      this.outlines.set(o.id, outlineOf(o.sprite, HILITE))
      const d = o.sprite.getContext('2d')!.getImageData(0, 0, o.sprite.width, o.sprite.height).data
      const mask = new Uint8ClampedArray(o.sprite.width * o.sprite.height)
      for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] > 40 ? 1 : 0
      this.masks.set(o.id, mask)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const k = keyName(e)
      if (!k) return
      if (!this.opts.controllable) return
      e.preventDefault()
      if (k === 'use') { if (!e.repeat) this.useNearby(); return }
      this.keys.add(k)
      this.path = null
    }
    const onKeyUp = (e: KeyboardEvent) => { const k = keyName(e); if (k) this.keys.delete(k) }
    const onBlur = () => this.keys.clear()
    const onMove = (e: PointerEvent) => { this.mouse = this.toNative(e.clientX, e.clientY); this.updateHover() }
    const onLeave = () => { this.mouse = null; this.updateHover() }
    const onDown = (e: PointerEvent) => { if (e.button === 0) { this.mouse = this.toNative(e.clientX, e.clientY); this.updateHover(); this.click() } }
    const ro = new ResizeObserver(() => this.resize())
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)
    ro.observe(canvas)
    this.disposers.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => window.removeEventListener('blur', onBlur),
      () => canvas.removeEventListener('pointermove', onMove),
      () => canvas.removeEventListener('pointerleave', onLeave),
      () => canvas.removeEventListener('pointerdown', onDown),
      () => ro.disconnect(),
    )
    this.resize()
    this.last = performance.now()
    const loop = (t: number) => { this.frame(t); this.raf = requestAnimationFrame(loop) }
    this.raf = requestAnimationFrame(loop)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.disposers.forEach((d) => d())
  }

  // ── Quem está na sala ─────────────────────────────────

  setPlayers(players: GamePlayer[]) {
    const keep = new Set(players.map((p) => p.uid))
    for (const uid of [...this.actors.keys()]) if (!keep.has(uid)) this.actors.delete(uid)
    for (const p of players) {
      const a = this.actors.get(p.uid)
      if (a) { a.name = p.name; a.slot = p.slot; continue }
      const spawn = this.scene.spawns[p.slot] ?? this.scene.spawns[0]
      const saved = p.uid === this.opts.meUid ? this.loadPos() : null
      this.actors.set(p.uid, {
        uid: p.uid, name: p.name, slot: p.slot,
        x: saved?.x ?? spawn.x, y: saved?.y ?? spawn.y, d: saved?.d ?? spawn.d,
        moving: false, panel: null, online: p.uid === this.opts.meUid, animT: 0, samples: [],
      })
    }
  }

  /** Quem está conectado (presence): liga/desliga o fantasma e põe na última posição conhecida. */
  applyPeers(peers: NetPeer<Id>[]) {
    const online = new Map(peers.map((p) => [p.uid, p]))
    for (const a of this.actors.values()) {
      if (a.uid === this.opts.meUid) continue
      const p = online.get(a.uid)
      a.online = !!p
      const panel = p?.panel ?? null
      if (panel !== a.panel) { a.panel = panel; this.opts.onRemotePanel(a.uid, panel) }
      if (!p) continue
      if (a.samples.length === 0 && typeof p.x === 'number' && typeof p.y === 'number') {
        a.x = p.x
        a.y = p.y
        a.d = p.d ?? a.d
      }
    }
  }

  pushRemote(msg: PosMsg<Id>) {
    const a = this.actors.get(msg.u)
    if (!a || a.uid === this.opts.meUid) return
    a.online = true
    if (msg.p !== a.panel) { a.panel = msg.p; this.opts.onRemotePanel(a.uid, msg.p) }
    a.samples.push({ t: performance.now(), x: msg.x, y: msg.y, d: msg.d, m: msg.m })
    if (a.samples.length > 30) a.samples.splice(0, a.samples.length - 30)
  }

  /** O estado dos enigmas (a sala mostra: velas acesas, luz no retrato, livro aberto…). */
  setGame(game: G | null) {
    this.game = game
  }

  /** Janela aberta: o meu boneco para de andar. */
  setFrozen(frozen: boolean) {
    this.frozen = frozen
    if (frozen) { this.keys.clear(); this.path = null }
  }

  setMyPanel(panel: Id | null) {
    this.myPanel = panel
    const me = this.actors.get(this.opts.meUid)
    if (me) me.panel = panel
    this.sendPos(true)
  }

  // ── Tela ──────────────────────────────────────────────

  private resize() {
    this.dpr = window.devicePixelRatio || 1
    const cw = Math.max(1, Math.round(this.canvas.clientWidth * this.dpr))
    const ch = Math.max(1, Math.round(this.canvas.clientHeight * this.dpr))
    if (this.canvas.width !== cw) this.canvas.width = cw
    if (this.canvas.height !== ch) this.canvas.height = ch
    const fit = Math.min(cw / W, ch / H)
    this.scale = fit >= 1 && this.opts.integerScale !== false ? Math.floor(fit) : fit
    this.offX = Math.floor((cw - W * this.scale) / 2)
    this.offY = Math.floor((ch - H * this.scale) / 2)
    this.ctx.imageSmoothingEnabled = false
  }

  private toNative(cx: number, cy: number) {
    const r = this.canvas.getBoundingClientRect()
    return {
      x: ((cx - r.left) * this.dpr - this.offX) / this.scale,
      y: ((cy - r.top) * this.dpr - this.offY) / this.scale,
    }
  }

  // ── Mouse ─────────────────────────────────────────────

  private objectAt(x: number, y: number): Interactable<Id> | null {
    // de cima pra baixo: quem é desenhado por último ganha
    const sorted = [...this.scene.objects].sort((a, b) => b.base - a.base)
    for (const o of sorted) {
      const lx = Math.floor(x - o.at.x)
      const ly = Math.floor(y - o.at.y)
      if (lx < 0 || ly < 0 || lx >= o.sprite.width || ly >= o.sprite.height) continue
      if (this.masks.get(o.id)![ly * o.sprite.width + lx]) return o
    }
    return null
  }

  private bubbleAt(x: number, y: number): string | null {
    for (const a of this.actors.values()) {
      if (!a.panel || a.uid === this.opts.meUid || this.ghost(a)) continue
      const p = this.drawPos(a)
      if (x >= p.x - 6 && x <= p.x + 6 && y >= p.y - 31 && y <= p.y - 20) return a.uid
    }
    return null
  }

  private updateHover() {
    const m = this.mouse
    this.hover = null
    this.hoverBubble = null
    if (m && !this.frozen) {
      if (!this.opts.controllable) this.hoverBubble = this.bubbleAt(m.x, m.y)
      if (!this.hoverBubble) this.hover = this.objectAt(m.x, m.y)?.id ?? null
    }
    this.canvas.style.cursor = this.hoverBubble || (this.hover && this.opts.controllable) ? 'pointer' : 'default'
  }

  private click() {
    if (this.frozen) return
    if (this.hoverBubble) { this.opts.onWatch(this.hoverBubble); return }
    if (!this.opts.controllable || !this.hover) return
    const o = this.scene.objects.find((x) => x.id === this.hover)!
    const me = this.actors.get(this.opts.meUid)
    if (!me) return
    if (inRect(me.x, me.y, o.zone)) { me.d = o.approach.face; this.opts.onOpen(o.id); return }
    const pts = this.findPath(me.x, me.y, o.approach.x, o.approach.y)
    if (pts) this.path = { pts, open: o.id, stuck: 0 }
  }

  /** E / espaço: usa o objeto em que o boneco está encostado. */
  private useNearby() {
    if (this.frozen) return
    const me = this.actors.get(this.opts.meUid)
    if (!me) return
    const o = this.scene.objects.find((x) => inRect(me.x, me.y, x.zone))
    if (o) { me.d = o.approach.face; this.opts.onOpen(o.id) }
  }

  // ── Andar ─────────────────────────────────────────────

  private blocked(x: number, y: number) {
    const fl = this.scene.floor
    if (x - FEET.w / 2 < fl.x0 || x + FEET.w / 2 > fl.x1 || y - FEET.h < fl.y0 || y > fl.y1) return true
    const f: Rect = { x: x - FEET.w / 2, y: y - FEET.h, w: FEET.w, h: FEET.h }
    return this.scene.obstacles.some((o) => overlaps(f, o))
  }

  /** O boneco está em outro lugar (aparece só como sombra, sem nome nem balão). */
  private ghost(a: Actor<Id>) {
    return this.scene.actorMode?.(a.slot) === 'ghost'
  }

  /** Anda separando os eixos (escorrega na parede em vez de grudar). */
  private step(a: Actor<Id>, dx: number, dy: number) {
    if (dx && !this.blocked(a.x + dx, a.y)) a.x += dx
    if (dy && !this.blocked(a.x, a.y + dy)) a.y += dy
  }

  /** A* numa grade de 4 px. Devolve os pontos do caminho (sem o de partida). */
  private findPath(sx: number, sy: number, tx: number, ty: number): { x: number; y: number }[] | null {
    const G = 4
    const cols = Math.ceil(W / G)
    const rows = Math.ceil(H / G)
    const id = (c: number, r: number) => r * cols + c
    const free = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows && !this.blocked(c * G + G / 2, r * G + G / 2)
    const sc = Math.floor(sx / G)
    const sr = Math.floor(sy / G)
    const tc = Math.floor(tx / G)
    const tr = Math.floor(ty / G)
    if (!free(tc, tr)) return null
    const open = new Map<number, number>()
    const g = new Map<number, number>()
    const from = new Map<number, number>()
    const h = (c: number, r: number) => Math.hypot(c - tc, r - tr)
    const start = id(sc, sr)
    g.set(start, 0)
    open.set(start, h(sc, sr))
    const goal = id(tc, tr)
    let guard = 0
    while (open.size && guard++ < 6000) {
      let cur = -1
      let best = Infinity
      for (const [k, f] of open) if (f < best) { best = f; cur = k }
      if (cur === goal) break
      open.delete(cur)
      const c = cur % cols
      const r = Math.floor(cur / cols)
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nc = c + dc
        const nr = r + dr
        if (!free(nc, nr)) continue
        if (dc && dr && (!free(c + dc, r) || !free(c, r + dr))) continue
        const n = id(nc, nr)
        const cost = (g.get(cur) ?? 0) + (dc && dr ? 1.414 : 1)
        if (cost < (g.get(n) ?? Infinity)) {
          g.set(n, cost)
          from.set(n, cur)
          open.set(n, cost + h(nc, nr))
        }
      }
    }
    if (!from.has(goal) && goal !== start) return null
    const pts: { x: number; y: number }[] = [{ x: tx, y: ty }]
    let k = from.get(goal)
    while (k !== undefined && k !== start) {
      pts.unshift({ x: (k % cols) * G + G / 2, y: Math.floor(k / cols) * G + G / 2 })
      k = from.get(k)
    }
    // Suaviza: pula pontos só quando dá pra ir reto sem bater em nada.
    const out: { x: number; y: number }[] = []
    let from_ = { x: sx, y: sy }
    let i = 0
    while (i < pts.length) {
      let j = pts.length - 1
      while (j > i && !this.clearLine(from_, pts[j])) j--
      out.push(pts[j])
      from_ = pts[j]
      i = j + 1
    }
    return out
  }

  /** Dá pra andar em linha reta de a até b sem esbarrar? */
  private clearLine(a: { x: number; y: number }, b: { x: number; y: number }) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2)
    for (let k = 1; k <= n; k++) {
      const t = k / n
      if (this.blocked(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false
    }
    return true
  }

  private moveMe(dt: number) {
    const me = this.actors.get(this.opts.meUid)
    if (!me) return
    let dx = 0
    let dy = 0
    if (!this.frozen) {
      if (this.keys.has('left')) dx -= 1
      if (this.keys.has('right')) dx += 1
      if (this.keys.has('up')) dy -= 1
      if (this.keys.has('down')) dy += 1
    }
    if (!dx && !dy && this.path && !this.frozen) {
      const next = this.path.pts[0]
      const ddx = next.x - me.x
      const ddy = next.y - me.y
      const dist = Math.hypot(ddx, ddy)
      if (dist < 1.5) {
        this.path.pts.shift()
        if (this.path.pts.length === 0) {
          const id = this.path.open
          const o = this.scene.objects.find((x) => x.id === id)!
          this.path = null
          me.d = o.approach.face
          me.moving = false
          this.opts.onOpen(id)
          return
        }
      } else {
        dx = ddx / dist
        dy = ddy / dist
      }
    }
    if (dx || dy) {
      const len = Math.hypot(dx, dy)
      const sx = (dx / len) * SPEED * dt
      const sy = (dy / len) * SPEED * dt
      const bx = me.x
      const by = me.y
      this.step(me, sx, sy)
      me.moving = Math.abs(me.x - bx) + Math.abs(me.y - by) > 0.01
      if (Math.abs(dx) > Math.abs(dy)) me.d = dx > 0 ? 'right' : 'left'
      else me.d = dy > 0 ? 'down' : 'up'
      // Esbarrou seguindo o caminho: tolera um instante antes de desistir.
      if (this.path) {
        this.path.stuck = me.moving ? 0 : this.path.stuck + dt
        if (this.path.stuck > 0.4) this.path = null
      }
    } else {
      me.moving = false
    }
  }

  private sendPos(force = false) {
    const me = this.actors.get(this.opts.meUid)
    if (!me || !this.opts.controllable) return
    const now = performance.now()
    const msg: PosMsg<Id> = { u: me.uid, x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, d: me.d, m: me.moving, p: this.myPanel, t: Date.now() }
    const key = `${msg.x},${msg.y},${msg.d},${msg.m},${msg.p}`
    if (!force && (now - this.lastSend < SEND_EVERY || (key === this.lastSent && now - this.lastSend < 1000))) return
    this.lastSend = now
    this.lastSent = key
    this.opts.onPos(msg)
    if (now - this.lastSave > 1000) { this.lastSave = now; this.savePos(me) }
  }

  private savePos(a: Actor<Id>) {
    try { sessionStorage.setItem(this.opts.storageKey, JSON.stringify({ x: a.x, y: a.y, d: a.d })) } catch { /* sem storage */ }
  }

  private loadPos(): { x: number; y: number; d: Dir } | null {
    try {
      const v = JSON.parse(sessionStorage.getItem(this.opts.storageKey) ?? 'null') as { x: number; y: number; d: Dir } | null
      if (v && typeof v.x === 'number' && !this.blocked(v.x, v.y)) return v
    } catch { /* sem storage */ }
    return null
  }

  /** Onde desenhar um boneco agora (os de fora, um pouco no passado). */
  private drawPos(a: Actor<Id>): { x: number; y: number; d: Dir; m: boolean } {
    if (a.uid === this.opts.meUid || a.samples.length === 0) return { x: a.x, y: a.y, d: a.d, m: a.moving }
    const tr = performance.now() - INTERP_DELAY
    const s = a.samples
    if (tr <= s[0].t) return s[0]
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i].t <= tr) {
        const b = s[i + 1]
        if (!b) {
          // sem dado novo: fica parado no último (e para a animação depois de um tempo)
          const stale = tr - s[i].t > 350
          return { ...s[i], m: s[i].m && !stale }
        }
        const k = (tr - s[i].t) / Math.max(1, b.t - s[i].t)
        return { x: s[i].x + (b.x - s[i].x) * k, y: s[i].y + (b.y - s[i].y) * k, d: b.d, m: b.m }
      }
    }
    return s[s.length - 1]
  }

  // ── Quadro ────────────────────────────────────────────

  private frame(t: number) {
    const dt = Math.min(0.05, (t - this.last) / 1000)
    this.last = t
    if (this.opts.controllable) { this.moveMe(dt); this.sendPos() }
    for (const a of this.actors.values()) a.animT += dt
    this.render(t / 1000)
  }

  private render(time: number) {
    const n = this.nctx
    n.globalCompositeOperation = 'source-over'
    n.drawImage(this.bg, 0, 0)

    const me = this.actors.get(this.opts.meUid)
    const nearby = me && this.opts.controllable && !this.frozen ? this.scene.objects.find((o) => inRect(me.x, me.y, o.zone)) ?? null : null

    // Desenha tudo de trás pra frente (pelo pé).
    type D = { base: number; draw: () => void }
    const list: D[] = []
    for (const o of this.scene.objects) {
      list.push({
        base: o.base,
        draw: () => {
          n.drawImage(o.sprite, o.at.x, o.at.y)
          this.scene.drawObject?.(n, o, time, this.game)
        },
      })
    }
    for (const d of this.scene.decor ?? []) list.push({ base: d.base, draw: () => d.draw(n, time) })
    const placed: { a: Actor<Id>; x: number; y: number }[] = []
    const ghosts: { x: number; y: number }[] = []
    for (const a of this.actors.values()) {
      const p = this.drawPos(a)
      if (this.ghost(a)) { if (a.online) ghosts.push({ x: p.x, y: p.y }); continue }
      placed.push({ a, x: p.x, y: p.y })
      const frame = p.m ? 1 + (Math.floor(a.animT / 0.14) % 2) : 0
      list.push({
        base: p.y,
        draw: () => {
          if (!a.online) n.globalAlpha = 0.35
          drawActor(n, p.x, p.y, p.d, frame, CLOAKS[a.slot] ?? CLOAKS[0])
          n.globalAlpha = 1
        },
      })
    }
    list.sort((a, b) => a.base - b.base).forEach((d) => d.draw())

    this.lctx.globalCompositeOperation = 'source-over'
    this.lctx.clearRect(0, 0, W, H)
    this.scene.drawLight(this.lctx, n, this.light, time, placed.map(({ a, x, y }) => ({ slot: a.slot, x, y })), this.game)
    n.globalCompositeOperation = 'source-over'
    // quem está do outro lado (sombra), por cima da luz
    for (const g of ghosts) this.scene.drawGhost?.(n, g.x, g.y, time)

    // Destaque: contorno do objeto sob o mouse ou ao alcance.
    for (const o of this.scene.objects) {
      if (o.id === this.hover || o.id === nearby?.id) {
        n.globalAlpha = o.id === this.hover ? 1 : 0.55 + 0.25 * Math.sin(time * 5)
        n.drawImage(this.outlines.get(o.id)!, o.at.x - 1, o.at.y - 1)
        n.globalAlpha = 1
      }
    }
    // Seta quicando em cima do objeto ao alcance.
    if (nearby) {
      const [tx, ty] = tagPoint(nearby)
      const ax = Math.floor(tx)
      const ay = ty + 2 + Math.round(Math.sin(time * 6))
      px(n, HILITE, ax - 2, ay, 5, 1)
      px(n, HILITE, ax - 1, ay + 1, 3, 1)
      px(n, HILITE, ax, ay + 2, 1, 1)
    }
    // Balão de "está olhando um objeto".
    for (const { a, x, y } of placed) {
      if (!a.panel) continue
      const bx = Math.round(x) - 5
      const by = Math.round(y) - 30
      const hot = this.hoverBubble === a.uid
      px(n, '#160f1c', bx - 1, by - 1, 12, 10)
      px(n, hot ? HILITE : '#efe6d2', bx, by, 10, 8)
      px(n, hot ? HILITE : '#efe6d2', bx + 3, by + 8, 3, 1)
      px(n, '#160f1c', bx + 4, by + 9, 1, 1)
      for (let i = 0; i < 3; i++) px(n, '#3a2f48', bx + 2 + i * 2, by + 3 + (Math.floor(time * 3) % 3 === i ? -1 : 0), 1, 2)
    }

    // Amplia pro canvas da tela.
    const c = this.ctx
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.imageSmoothingEnabled = false
    c.fillStyle = '#07060a'
    c.fillRect(0, 0, this.canvas.width, this.canvas.height)
    c.drawImage(this.native, 0, 0, W, H, this.offX, this.offY, W * this.scale, H * this.scale)

    // Textos (na resolução da tela, nítidos): nomes e rótulo do objeto.
    const fs = Math.max(11, Math.round(this.scale * 4.4))
    c.font = `600 ${fs}px 'Pixelify Sans', monospace`
    c.textAlign = 'center'
    c.textBaseline = 'bottom'
    c.lineJoin = 'round'
    c.lineWidth = Math.max(3, fs * 0.28)
    c.strokeStyle = '#07060a'
    for (const { a, x, y } of placed) {
      const sx = this.offX + x * this.scale
      const sy = this.offY + (y - 19 - (a.panel ? 13 : 0)) * this.scale
      c.globalAlpha = a.online ? 1 : 0.5
      c.fillStyle = CLOAKS[a.slot]?.h ?? '#fff'
      const label = a.uid === this.opts.meUid ? `${a.name} (você)` : a.online ? a.name : `${a.name} (fora)`
      c.strokeText(label, sx, sy)
      c.fillText(label, sx, sy)
    }
    c.globalAlpha = 1
    const tag = this.scene.objects.find((o) => o.id === (this.hover ?? nearby?.id))
    if (tag) {
      const [tx, ty] = tagPoint(tag)
      const sx = this.offX + tx * this.scale
      const sy = this.offY + ty * this.scale
      const label = this.opts.controllable ? (nearby?.id === tag.id ? `${tag.name}  ·  clique ou E` : tag.name) : tag.name
      c.font = `600 ${Math.round(fs * 1.05)}px 'Pixelify Sans', monospace`
      c.fillStyle = HILITE
      c.strokeText(label, sx, sy)
      c.fillText(label, sx, sy)
    }
  }
}

// ── A cena do Livro Bloqueado: a biblioteca ─────────────

/** A biblioteca de Caatedrum: salas, castiçais de chão, velas, luar e poeira. */
export function livroScene(): Scene<PanelId, GameView> {
  const room = buildRoom()
  const [bg, bctx] = makeCanvas(W, H)
  drawRoomBackground(bctx)
  const motes: { x: number; y: number; v: number; p: number }[] = []
  for (let i = 0; i < 26; i++) motes.push({ x: Math.random(), y: Math.random(), v: 0.6 + Math.random(), p: Math.random() * 6 })

  const drawObject = (n: Ctx, o: Interactable, time: number, game: GameView | null) => {
    if (o.id === 'castical' && game) {
      const c = game.cast
      for (let i = 0; i < 7; i++) {
        const [tx, ty] = candleTip(i)
        const x = o.at.x + tx
        const y = o.at.y + ty
        if (c.sealed[i]) { px(n, '#9a2a2a', x - 1, y, 3, 2); px(n, '#d05050', x, y, 1, 1) }
        else if (c.lit[i]) drawFlame(n, x, y + 1, time, i * 5)
      }
    }
    if (o.id === 'pedestal' && game?.ped.opened) {
      px(n, '#e8dcbc', o.at.x + 4, o.at.y + 2, 13, 10)
      px(n, '#f2e8cc', o.at.x + 19, o.at.y + 2, 13, 10)
      px(n, '#b8ad8c', o.at.x + 17, o.at.y + 2, 2, 10)
    }
  }

  const drawLight = (l: Ctx, n: Ctx, light: HTMLCanvasElement, time: number, placed: Placed[], g: GameView | null) => {
    l.fillStyle = 'rgba(6,4,14,0.55)'
    l.fillRect(0, 0, W, H)
    l.globalCompositeOperation = 'destination-out'
    const hole = (x: number, y: number, r: number, a: number) => {
      const gr = l.createRadialGradient(x, y, 0, x, y, r)
      gr.addColorStop(0, `rgba(0,0,0,${a})`)
      gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.55})`)
      gr.addColorStop(1, 'rgba(0,0,0,0)')
      l.fillStyle = gr
      l.fillRect(x - r, y - r, r * 2, r * 2)
    }
    const flick = (seed: number) => 1 + 0.05 * Math.sin(time * 11 + seed) + 0.03 * Math.sin(time * 23 + seed * 3)
    for (const c of room.candles) hole(c.x + 4, c.y + 2, 54 * flick(c.x), 0.95)
    const lit = g ? g.cast.lit.filter(Boolean).length : 0
    hole(192, 96, g?.ped.opened ? 90 : 34, g?.ped.opened ? 0.95 : 0.45)
    hole(192, 34, 30 + lit * 9, 0.25 + lit * 0.09)
    if (lit) hole(192, 60, 20 + lit * 10, 0.2 + lit * 0.06)
    if (g && g.light !== 'escuro') hole(338, 98, g.light === 'total' ? 34 : 24, g.light === 'total' ? 0.8 : 0.5)
    for (const { x, y } of placed) hole(x, y - 8, 26, 0.5)
    // luar entrando pelas janelas
    l.fillStyle = 'rgba(0,0,0,0.28)'
    for (const wx of [60, 296]) {
      l.beginPath()
      l.moveTo(wx, 46)
      l.lineTo(wx + 28, 46)
      l.lineTo(wx + 62, 132)
      l.lineTo(wx + 30, 132)
      l.closePath()
      l.fill()
    }
    n.drawImage(light, 0, 0)
    // brilho quente das velas e frio da lua
    n.globalCompositeOperation = 'lighter'
    for (const c of room.candles) {
      const cg = n.createRadialGradient(c.x + 4, c.y, 0, c.x + 4, c.y, 30 * flick(c.y))
      cg.addColorStop(0, 'rgba(255,150,60,0.22)')
      cg.addColorStop(1, 'rgba(255,150,60,0)')
      n.fillStyle = cg
      n.fillRect(c.x - 30, c.y - 30, 68, 68)
    }
    if (lit) {
      const wg = n.createRadialGradient(192, 30, 0, 192, 30, 20 + lit * 7)
      wg.addColorStop(0, `rgba(255,160,70,${(0.05 + lit * 0.03).toFixed(2)})`)
      wg.addColorStop(1, 'rgba(255,160,70,0)')
      n.fillStyle = wg
      n.fillRect(192 - 80, 0, 160, 110)
    }
    if (g?.ped.opened) {
      const og = n.createRadialGradient(192, 92, 0, 192, 92, 70)
      og.addColorStop(0, `rgba(255,231,163,${(0.22 + 0.06 * Math.sin(time * 2)).toFixed(2)})`)
      og.addColorStop(1, 'rgba(255,231,163,0)')
      n.fillStyle = og
      n.fillRect(122, 22, 140, 140)
    }
    const pg = n.createRadialGradient(192, 96, 0, 192, 96, 30)
    pg.addColorStop(0, 'rgba(140,100,255,0.10)')
    pg.addColorStop(1, 'rgba(140,100,255,0)')
    n.fillStyle = pg
    n.fillRect(160, 64, 64, 64)
    n.fillStyle = 'rgba(120,150,255,0.05)'
    for (const wx of [60, 296]) {
      n.beginPath()
      n.moveTo(wx, 46)
      n.lineTo(wx + 28, 46)
      n.lineTo(wx + 62, 132)
      n.lineTo(wx + 30, 132)
      n.closePath()
      n.fill()
    }
    n.globalCompositeOperation = 'source-over'
    // poeira flutuando no luar
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i]
      const wx = i % 2 ? 60 : 296
      const k = (m.y + time * 0.02 * m.v) % 1
      const y = 48 + k * 82
      const x = wx + 2 + (y - 46) * 0.38 + m.x * 26 + Math.sin(time * 0.8 + m.p) * 2
      const a = 0.25 + 0.25 * Math.sin(time * 2 + m.p)
      n.fillStyle = `rgba(210,220,255,${a.toFixed(2)})`
      n.fillRect(Math.round(x), Math.round(y), 1, 1)
    }
  }

  return {
    objects: room.objects,
    obstacles: room.obstacles,
    floor: FLOOR,
    spawns: SPAWNS,
    background: bg,
    decor: room.candles.map((c) => ({ base: c.y + 16, draw: (n: Ctx, time: number) => { n.drawImage(c.sprite, c.x, c.y); drawFlame(n, c.x + 4, c.y + 0, time, c.x) } })),
    drawObject,
    drawLight,
  }
}

/** O motor com a biblioteca. */
export class LivroGame extends RoomGame<PanelId, GameView> {
  constructor(canvas: HTMLCanvasElement, opts: GameOptions) {
    super(canvas, opts, livroScene())
  }
}

/** Onde vão o nome e a seta de um objeto: em cima do desenho, ou no ponto que ele pedir. */
function tagPoint(o: Interactable<string>): [number, number] {
  return o.tag ? [o.at.x + o.tag.x, o.at.y + o.tag.y] : [o.at.x + o.sprite.width / 2, o.at.y - 7]
}

function keyName(e: KeyboardEvent): 'up' | 'down' | 'left' | 'right' | 'use' | null {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': return 'up'
    case 'KeyS': case 'ArrowDown': return 'down'
    case 'KeyA': case 'ArrowLeft': return 'left'
    case 'KeyD': case 'ArrowRight': return 'right'
    case 'KeyE': case 'Space': case 'Enter': return 'use'
    default: return null
  }
}
