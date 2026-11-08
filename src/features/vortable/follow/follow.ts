import type { Appearance, ZoneNpc } from '../../../vendor/vortable/vortable'
import type { VortableNet } from '../net/VortableNet'
import { broadcast, zoneStorage } from '../enemies/enemies'
import { loadEngine } from '../services/vortableService'

// ────────────────────────────────────────────────────────
// NPCs que seguem um jogador. Os NPCs do Vortable são bonecos parados; o único que anda é o que o mestre
// controla, e a sala o vê como um jogador de id `npc:<id>`. Aqui o mesmo truque vale pra vários: o
// navegador do mestre faz cada seguidor andar até um ponto em volta do jogador e conta a posição pela rede
// (hello, state, e no fim npcmove + bye), então todos veem os NPCs andando e correndo, sem mexer no motor.
// Como o motor não expõe as colisões, os seguidores atravessam paredes, água e objetos.
// O movimento roda no navegador do mestre: com o controle fechado, os NPCs ficam parados onde estão.
// ────────────────────────────────────────────────────────

export type Dir = 'down' | 'left' | 'right' | 'up'
export type FollowKind = 'pessoa' | 'animal' | 'inimigo'

export const FOLLOW_KINDS: { id: FollowKind; label: string }[] = [
  { id: 'pessoa', label: 'Pessoas' },
  { id: 'animal', label: 'Animais' },
  { id: 'inimigo', label: 'Inimigos' },
]

/** O tipo do NPC pelo id: `inim-…` inimigo, `anim-…` animal, o resto (gerador, editor) é pessoa. */
export function npcKind(id: string): FollowKind {
  if (id.startsWith('inim-')) return 'inimigo'
  if (id.startsWith('anim-')) return 'animal'
  return 'pessoa'
}

export interface Pt { x: number; y: number }

const TILE = 32
/** Um pouco mais devagar que o jogador (90 e 160), pra ele chegar na frente. */
export const FOLLOW_WALK = 85
export const FOLLOW_RUN = 150
/** Longe do jogador mais que isso, o seguidor corre. */
export const RUN_FROM = 150
/** Chegou (para) a menos disso do ponto dele; só volta a andar quando passar de RESUME_AT. */
export const ARRIVE_AT = 8
export const RESUME_AT = 26
const RING_FIRST = 40
const RING_STEP = 30
const SLOT_GAP = 30

/** O lugar do seguidor `i` em volta do jogador: anéis cada vez maiores, com o espaço de um boneco entre cada um. */
export function slotOffset(i: number): Pt {
  let ring = 0
  let idx = i
  for (;;) {
    const r = RING_FIRST + RING_STEP * ring
    const cap = Math.max(4, Math.floor((2 * Math.PI * r) / SLOT_GAP))
    if (idx < cap) {
      const a = Math.PI / 2 + (idx / cap) * 2 * Math.PI + ring * 0.5
      return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.8 }
    }
    idx -= cap
    ring++
  }
}

export interface Walker { x: number; y: number; dir: Dir; moving: boolean; anim: 'idle' | 'walk' | 'run' }
export interface Bounds { w: number; h: number }

export function dirToward(dx: number, dy: number, keep: Dir): Dir {
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return keep
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'up' : 'down'
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** Um passo do seguidor rumo ao ponto dele. `face` = pra onde olha quando para (o jogador); `toTarget` = distância até o jogador. */
export function stepWalker(w: Walker, goal: Pt | null, face: Pt | null, dt: number, toTarget: number, bounds: Bounds): Walker {
  const idle = (dir: Dir): Walker => ({ ...w, dir, moving: false, anim: 'idle' })
  if (!goal) return idle(w.dir)
  const dx = goal.x - w.x
  const dy = goal.y - w.y
  const d = Math.hypot(dx, dy)
  const moving = w.moving ? d > ARRIVE_AT : d > RESUME_AT
  if (!moving) return idle(face ? dirToward(face.x - w.x, face.y - w.y, w.dir) : w.dir)
  const run = toTarget > RUN_FROM
  const len = Math.min(d, (run ? FOLLOW_RUN : FOLLOW_WALK) * dt)
  return {
    x: clamp(w.x + (dx / d) * len, 16, bounds.w - 16),
    y: clamp(w.y + (dy / d) * len, 32, bounds.h - 8),
    dir: dirToward(dx, dy, w.dir),
    moving: true,
    anim: run ? 'run' : 'walk',
  }
}

// ── Quem segue ──────────────────────────────────────────

interface Follower extends Walker {
  npc: ZoneNpc
  slot: Pt
  /** O que foi mandado por último e quando (pra não repetir). */
  sent: string
  sentAt: number
}

type Peer = { id: string; name: string; zone: string | null; x: number; y: number }

export interface FollowInfo {
  targetId: string
  targetName: string
  zoneId: string
  count: number
  /** following = andando atrás dele; away = ele está em outra zona; gone = saiu da sessão. */
  state: 'following' | 'away' | 'gone'
}

export interface FollowOptions {
  campaignId: string
  worldId: string
  worldName: string
  zoneId: string
  net: VortableNet | null
  kinds: Record<FollowKind, boolean>
  /** Ids que ficam de fora (o NPC que o mestre está controlando). */
  skip: string[]
  target: { id: string; name: string }
  peers: () => Peer[]
}

const TICK_MS = 50
/** Posição de quem anda sai a cada tanto; parado, só de vez em quando (a sala nunca esquece onde está). */
const SEND_MOVING_MS = 100
const SEND_IDLE_MS = 1500
const SAVE_EVERY_MS = 15_000

export class FollowCrew {
  private readonly followers = new Map<string, Follower>()
  private target: { id: string; name: string }
  private timer = 0
  private last = 0
  private lastSave = 0
  private moved = false
  private stopped = false
  private saving: Promise<void> = Promise.resolve()
  private state: FollowInfo['state'] = 'following'
  private readonly bounds: Bounds

  private constructor(private readonly o: FollowOptions, npcs: ZoneNpc[], bounds: Bounds) {
    this.target = o.target
    this.bounds = bounds
    npcs.forEach((npc, i) => {
      this.followers.set(npc.id, { x: npc.x, y: npc.y, dir: npc.dir, moving: false, anim: 'idle', npc, slot: slotOffset(i), sent: '', sentAt: 0 })
    })
  }

  /** Lê a zona, escolhe os NPCs e começa a seguir. */
  static async create(o: FollowOptions): Promise<FollowCrew> {
    const worlds = await zoneStorage(o)
    const zone = await worlds.load(o.zoneId)
    if (!zone) throw new Error('Não achei esta zona.')
    const picked = (zone.npcs ?? []).filter((n) => o.kinds[npcKind(n.id)] && !o.skip.includes(n.id))
    // quem vai na garupa de outro só segue junto com quem o conduz; se o condutor não vai, ele fica sentado onde está
    const ids = new Set(picked.map((n) => n.id))
    const npcs = picked.filter((n) => !n.rides || ids.has(n.rides))
    const crew = new FollowCrew(o, npcs, { w: zone.width * TILE, h: zone.height * TILE })
    crew.begin()
    return crew
  }

  private begin() {
    // cada NPC aparece na sala como um jogador (o parado da zona some enquanto isso)
    for (const f of this.followers.values()) {
      const driver = f.npc.rides ? this.followers.get(f.npc.rides)?.npc.steed : undefined
      broadcast(this.o.net, {
        t: 'hello', id: `npc:${f.npc.id}`, name: f.npc.name, appearance: f.npc.appearance as Appearance, npc: true, showName: f.npc.showName === true,
        // montado num cavalo ou lobo: segue montado (a sala vê o cavaleiro em cima do animal); na garupa, atrás de quem conduz
        ...(f.npc.steed ? { mount: { appearance: f.npc.steed.appearance, npc: f.npc.steed.id } } : {}),
        ...(driver ? { mount: { appearance: driver.appearance, npc: driver.id, seat: 'back' } } : {}),
      })
    }
    this.last = performance.now()
    this.lastSave = this.last
    this.timer = window.setInterval(() => this.tick(), TICK_MS)
  }

  get count() { return this.followers.size }
  /** Ainda andando atrás de alguém (some quando o último seguidor sai). */
  get running() { return !this.stopped }
  has(id: string) { return this.followers.has(id) }

  info(): FollowInfo {
    return { targetId: this.target.id, targetName: this.target.name, zoneId: this.o.zoneId, count: this.followers.size, state: this.state }
  }

  retarget(id: string, name: string) { this.target = { id, name } }

  private tick() {
    if (this.stopped) return
    const now = performance.now()
    const dt = Math.min(0.25, (now - this.last) / 1000)
    this.last = now
    const peer = this.o.peers().find((p) => p.id === this.target.id)
    const here = !!peer && peer.zone === this.o.zoneId
    this.state = here ? 'following' : peer ? 'away' : 'gone'
    for (const f of this.followers.values()) {
      if (f.npc.rides) continue                                   // quem vai na garupa copia o condutor (logo abaixo)
      const goal = here ? { x: peer.x + f.slot.x, y: peer.y + f.slot.y } : null
      const toTarget = here ? Math.hypot(peer.x - f.x, peer.y - f.y) : 0
      const next = stepWalker(f, goal ? this.keepInside(goal) : null, here ? peer : null, dt, toTarget, this.bounds)
      if (next.x !== f.x || next.y !== f.y) this.moved = true
      Object.assign(f, next)
      this.publish(f, now)
    }
    for (const f of this.followers.values()) {
      if (!f.npc.rides) continue
      const d = this.followers.get(f.npc.rides)
      if (!d) continue
      Object.assign(f, { x: d.x, y: d.y, dir: d.dir, moving: d.moving, anim: d.anim })
      this.publish(f, now)
    }
    if (this.moved && now - this.lastSave >= SAVE_EVERY_MS) { this.lastSave = now; this.moved = false; void this.persist([...this.followers.values()]) }
  }

  private keepInside(p: Pt): Pt {
    return { x: clamp(p.x, 16, this.bounds.w - 16), y: clamp(p.y, 32, this.bounds.h - 8) }
  }

  private publish(f: Follower, now: number) {
    const x = Math.round(f.x * 10) / 10
    const y = Math.round(f.y * 10) / 10
    const sig = `${x},${y},${f.dir},${f.anim}`
    const every = f.moving ? SEND_MOVING_MS : SEND_IDLE_MS
    if (now - f.sentAt < every || (sig === f.sent && now - f.sentAt < SEND_IDLE_MS)) return
    f.sent = sig
    f.sentAt = now
    broadcast(this.o.net, { t: 'state', id: `npc:${f.npc.id}`, zone: this.o.zoneId, x, y, dir: f.dir, anim: f.anim })
  }

  /** Grava onde os NPCs estão na zona (sem avisar "zona salva": isso faria todo mundo recarregar). */
  private persist(list: Pick<Follower, 'npc' | 'x' | 'y' | 'dir'>[]): Promise<void> {
    if (list.length === 0) return this.saving
    const next = this.saving.then(async () => {
      const worlds = await zoneStorage(this.o)
      const zone = await worlds.load(this.o.zoneId)
      if (!zone) return
      const by = new Map(list.map((f) => [f.npc.id, f]))
      const npcs = (zone.npcs ?? []).map((n) => {
        const f = by.get(n.id)
        return f ? { ...n, x: Math.round(f.x), y: Math.round(f.y), dir: f.dir } : n
      })
      await worlds.save({ ...zone, npcs })
    }).catch(() => {})
    this.saving = next
    // sair do Vortable e voltar remonta o jogo na hora: ele espera esta gravação antes de ler as zonas (senão os NPCs voltam pro lugar antigo)
    void loadEngine().then((e) => e.holdLoads(next)).catch(() => {})
    return next
  }

  /** Larga o NPC onde ele está: todos o veem parado ali, e o ponto fica guardado na zona. */
  private settle(f: Follower) {
    const x = Math.round(f.x)
    const y = Math.round(f.y)
    // `saved`: quem grava a zona aqui é o seguir (o mestre não precisa gravar de novo); o animal fica com o cavaleiro
    broadcast(this.o.net, { t: 'npcmove', zone: this.o.zoneId, id: f.npc.id, x, y, dir: f.dir, saved: true, ...(f.npc.steed ? { steed: f.npc.steed } : {}), ...(f.npc.rides ? { rides: f.npc.rides } : {}) })
    broadcast(this.o.net, { t: 'bye', id: `npc:${f.npc.id}` })
  }

  /** Um NPC deixa de seguir (o mestre vai controlá-lo, por exemplo): fica parado onde está. */
  async release(id: string): Promise<void> {
    const f = this.followers.get(id)
    if (!f) return
    this.followers.delete(id)
    this.settle(f)
    await this.persist([f])
    if (this.followers.size === 0) void this.stop()
  }

  /** O NPC saiu do mapa: só some dos seguidores (quem o tirou já avisou a sala). */
  drop(id: string) {
    const f = this.followers.get(id)
    if (!f) return
    this.followers.delete(id)
    broadcast(this.o.net, { t: 'bye', id: `npc:${id}` })
    if (this.followers.size === 0) void this.stop()
  }

  /** Para de seguir: cada NPC fica onde está, pra todos, e a zona grava. */
  async stop(): Promise<void> {
    if (this.stopped) return this.saving
    this.stopped = true
    window.clearInterval(this.timer)
    const all = [...this.followers.values()]
    this.followers.clear()
    for (const f of all) this.settle(f)
    await this.persist(all)
  }
}
