import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A central de erros fala com o Supabase: aqui ela só anota o que foi pedido.
const errors = vi.hoisted(() => ({ list: [] as string[] }))
vi.mock('../errors/vtErrors', () => ({
  vtError: (code: string) => { errors.list.push(code) },
  vtResolve: () => {},
}))

import { VortableNet, type RelayFactory, type RelayPayload, type Signal, type Signaling } from './VortableNet'

// ────────────────────────────────────────────────────────
// A rede do Vortable com um mestre e 5 jogadores, numa "internet" de mentira:
// a sala (sinalização) e a reserva são canais em memória. Sem WebRTC no Node,
// todo mundo entra pela reserva — que passa pela mesma lógica de entrar, cair,
// voltar, fantasmas, abas duplicadas e zonas da ligação direta.
// ────────────────────────────────────────────────────────

type Handler = (p: Signal) => void

/** Uma "internet": quem está fora (cortado) não manda nem recebe nada. */
class FakeNet {
  readonly cut = new Set<string>()
  private readonly room = new Set<{ id: string; fn: Handler }>()
  private readonly topics = new Map<string, Set<{ id: string; on: Parameters<RelayFactory>[1] }>>()

  signaling(id: string): Signaling {
    return {
      send: (p) => {
        if (this.cut.has(id)) return
        for (const s of this.room) if (s.id !== id && !this.cut.has(s.id)) queueMicrotask(() => s.fn(structuredClone(p)))
      },
      subscribe: (fn) => {
        const entry = { id, fn }
        this.room.add(entry)
        return () => { this.room.delete(entry) }
      },
    }
  }

  relay(id: string): RelayFactory {
    return (suffix, on) => {
      const set = this.topics.get(suffix) ?? new Set()
      this.topics.set(suffix, set)
      const entry = { id, on }
      set.add(entry)
      queueMicrotask(() => on.status(true))
      return {
        send: (payload: RelayPayload) => {
          if (this.cut.has(id) || !set.has(entry)) return false
          for (const other of set) if (other !== entry && !this.cut.has(other.id)) queueMicrotask(() => other.on.message(structuredClone(payload)))
          return true
        },
        close: () => { set.delete(entry) },
      }
    }
  }
}

interface Node { id: string; net: VortableNet; got: unknown[] }

let web: FakeNet
let nodes: Node[]

function node(id: string, isMaster = false, tag = id): Node {
  const net = new VortableNet({ selfId: id, name: `Nome ${id}`, isMaster, signaling: web.signaling(tag), relay: web.relay(tag), currentZone: () => 'z1' })
  const n: Node = { id, net, got: [] }
  net.sink = (m) => n.got.push(m)
  nodes.push(n)
  return n
}

const hello = (id: string) => ({ t: 'hello', id, name: `Nome ${id}`, appearance: { version: 2, slots: {} } })
const state = (id: string, x = 10) => ({ t: 'state', id, zone: 'z1', x, y: 20, dir: 'down', anim: 'idle' })
const byes = (n: Node) => n.got.filter((m) => (m as { t?: string }).t === 'bye').map((m) => (m as { id: string }).id)
const hellos = (n: Node) => n.got.filter((m) => (m as { t?: string }).t === 'hello').map((m) => (m as { id: string }).id)
const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms)
/** Anda o relógio até a condição valer (no máximo `ms`). */
async function until(ok: () => boolean, ms = 20_000) {
  for (let t = 0; t < ms && !ok(); t += 250) await wait(250)
}

beforeEach(() => {
  vi.useFakeTimers()
  ;(globalThis as unknown as { window: unknown }).window = globalThis
  vi.stubGlobal('navigator', { onLine: true })
  web = new FakeNet()
  nodes = []
  errors.list = []
})

afterEach(() => {
  for (const n of nodes) n.net.dispose()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Mestre + 5 jogadores, todos dentro e com o boneco anunciado. */
async function table() {
  const master = node('M', true)
  const players = ['P1', 'P2', 'P3', 'P4', 'P5'].map((id) => node(id))
  for (const p of players) p.net.setLive(true)
  await wait(3000)
  for (const p of players) p.net.send(hello(p.id))
  await wait(500)
  return { master, players }
}

describe('VortableNet (mestre + 5 jogadores)', () => {
  it('todos entram e se veem', async () => {
    const { master, players } = await table()
    expect(players.every((p) => p.net.status === 'online')).toBe(true)
    expect(master.net.connected.filter((p) => p.connected)).toHaveLength(5)
    expect(players.every((p) => p.net.transport === 'reserva')).toBe(true)
    // cada jogador recebeu o boneco dos outros 4, e o mestre os 5
    for (const p of players) expect(new Set(hellos(p))).toEqual(new Set(players.filter((o) => o !== p).map((o) => o.id)))
    expect(new Set(hellos(master))).toEqual(new Set(players.map((p) => p.id)))
  })

  it('o boneco anunciado assim que a ligação abre chega a todos (a reserva não perde o primeiro anúncio)', async () => {
    const master = node('M', true)
    const p = node('P1')
    const q = node('P2')
    for (const n of [p, q]) n.net.onOpen = () => n.net.send(hello(n.id))
    p.net.setLive(true)
    q.net.setLive(true)
    await wait(3000)
    expect(hellos(master)).toEqual(expect.arrayContaining(['P1', 'P2']))
    expect(hellos(q)).toContain('P1')
  })

  it('posição chega aos outros, e a de quem não se anunciou é descartada', async () => {
    const { players } = await table()
    const [p1, p2] = players
    p1.net.send(state('P1', 33))
    p1.net.send(state('X9', 1)) // id que ninguém anunciou
    await wait(500)
    const states = p2.got.filter((m) => (m as { t?: string }).t === 'state') as { id: string; x: number }[]
    expect(states.some((s) => s.id === 'P1' && s.x === 33)).toBe(true)
    expect(states.some((s) => s.id === 'X9')).toBe(false)
  })

  it('quem sai pelo botão some do mapa de todos na hora', async () => {
    const { master, players } = await table()
    const p3 = players[2]
    p3.net.dispose()
    await wait(600)
    expect(master.net.connected.some((p) => p.id === 'P3')).toBe(false)
    for (const p of players.filter((o) => o !== p3)) expect(byes(p)).toContain('P3')
  })

  it('quem cai sem avisar sai em ~10 s; volta sozinho e o fantasma de quem saiu enquanto ele estava fora some', async () => {
    const { master, players } = await table()
    const [, p2, p3] = players
    web.cut.add('P2')
    // P3 sai enquanto P2 está sem internet: o "bye" não chega pra P2
    p3.net.dispose()
    await wait(1000)
    expect(byes(p2)).not.toContain('P3')
    await wait(13_000)
    expect(master.net.connected.some((p) => p.id === 'P2')).toBe(false) // o mestre tirou P2 por silêncio
    expect(errors.list).toContain('VT-NET-007')
    expect(p2.net.status).toBe('connecting') // P2 percebeu a queda
    web.cut.delete('P2')
    await until(() => p2.net.status === 'online')
    await wait(1000)
    expect(p2.net.status).toBe('online')
    expect(byes(p2)).toContain('P3') // a lista do mestre apagou o fantasma
    expect(errors.list).toContain('VT-SYNC-002')
  })

  it('a mesma conta em outra aba assume; a antiga sai e não fica brigando', async () => {
    const { master, players } = await table()
    const old = players[0]
    await wait(1000)
    const tab = node('P1', false, 'P1-aba2')
    tab.net.setLive(true)
    await wait(4000)
    expect(tab.net.status).toBe('online')
    expect(old.net.issue).toBe('replaced')
    expect(old.net.status).toBe('off')
    expect(master.net.connected.filter((p) => p.id === 'P1')).toHaveLength(1)
    // passa um tempo: nada de ficar trocando de aba
    await wait(20_000)
    expect(tab.net.status).toBe('online')
    expect(old.net.issue).toBe('replaced')
    // "Usar aqui" na aba antiga: ela volta e a nova sai
    old.net.retry()
    await wait(4000)
    expect(old.net.status).toBe('online')
    expect(tab.net.issue).toBe('replaced')
  })

  it('mestre tira um jogador da sessão', async () => {
    const { master, players } = await table()
    expect(master.net.kick('P4')).toBe(true)
    await wait(1000)
    expect(players[3].net.issue).toBe('kicked')
    expect(master.net.connected.some((p) => p.id === 'P4')).toBe(false)
    expect(master.net.kick('P4')).toBe(false) // não está mais conectado
  })

  it('zona salva enquanto o jogador estava fora: ele recarrega ao voltar', async () => {
    const { master, players } = await table()
    const p5 = players[4]
    web.cut.add('P5')
    await wait(500)
    master.net.send({ t: 'zone', id: 'z1' })
    await wait(13_000)
    expect(p5.got.some((m) => (m as { t?: string; id?: string }).t === 'zone')).toBe(false)
    web.cut.delete('P5')
    await until(() => p5.net.status === 'online')
    await wait(1000)
    expect(p5.net.status).toBe('online')
    expect(p5.got.some((m) => (m as { t?: string; id?: string }).t === 'zone' && (m as { id: string }).id === 'z1')).toBe(true)
  })

  it('hora/tempo do mestre chegam a quem entra depois', async () => {
    const { master } = await table()
    master.net.send({ t: 'env', zone: '*', hour: 22, weather: 'rain', wind: null })
    const late = node('P6')
    late.net.setLive(true)
    await wait(4000)
    expect(late.got.some((m) => (m as { t?: string; hour?: number }).t === 'env' && (m as { hour: number }).hour === 22)).toBe(true)
  })

  it('jogo recém-montado pergunta "quem está aí?" e recebe todos na hora', async () => {
    const { players } = await table()
    const p2 = players[1]
    p2.got.length = 0
    p2.net.send({ t: 'who' })
    expect(new Set(hellos(p2))).toEqual(new Set(['P1', 'P3', 'P4', 'P5']))
  })

  it('pedido de passagem: o mestre responde; sem ligação, não passa', async () => {
    const { master, players } = await table()
    master.net.onDoor = (req) => master.net.answerDoor(req.peerId, req.id, true)
    const info = { from: 'z1', fromName: 'Vila', to: 'z2', toName: 'Mata', via: 'Porteira' }
    const asked = players[0].net.askDoor(info)
    await wait(500)
    await expect(asked).resolves.toBe('ok')
    web.cut.add('P1')
    // caiu no meio da espera: não passa (e não fica esperando 90 s)
    const waiting = players[0].net.askDoor(info)
    await wait(14_000)
    await expect(waiting).resolves.toBe('lost')
    await expect(players[0].net.askDoor(info)).resolves.toBe('lost')
  })

  it('duas abas de mestre: a mais nova comanda e a antiga para', async () => {
    const { master } = await table()
    await wait(1000)
    const newer = node('M', true, 'M-aba2')
    await wait(3000)
    expect(master.net.issue).toBe('dormant')
    expect(errors.list).toContain('VT-SALA-008')
    expect(newer.net.issue).toBe(null)
  })

  it('jogador com versão diferente do mestre é avisado', async () => {
    const p = node('P7')
    p.net.setLive(true)
    web.signaling('M').send({ kind: 'version', to: 'P7', v: 99 })
    await wait(100)
    expect(p.net.issue).toBe('version')
    expect(errors.list).toContain('VT-SYNC-004')
  })
})
