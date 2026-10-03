import { supabase } from '../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// O ao vivo do Livro Bloqueado: onde cada boneco está e o que cada um
// está olhando. Não passa pelo banco — vai direto entre os navegadores no
// canal "livro:<sala>" (o nome é a sala: todos precisam do MESMO nome,
// então nada de uniqueChannel aqui).
//   • broadcast "pos": quem joga manda a posição ~12 vezes por segundo;
//   • presence: quem está na sala agora (e a última posição, pra quem
//     chega no meio já ver os bonecos no lugar).
// ────────────────────────────────────────────────────────

export type Dir = 'down' | 'up' | 'left' | 'right'

/** Qual janela de enigma a pessoa tem aberta (null = andando pela sala). */
export type PanelId = 'castical' | 'retrato' | 'astrolabio' | 'estante' | 'pedestal'

export interface NetPeer {
  uid:   string
  name:  string
  slot:  number | null
  gm:    boolean
  panel: PanelId | null
  x?:    number
  y?:    number
  d?:    Dir
}

/** Posição de um boneco (u = quem, m = andando, p = janela aberta). */
export interface PosMsg { u: string; x: number; y: number; d: Dir; m: boolean; p: PanelId | null; t: number }

export interface LivroNet {
  sendPos:  (msg: PosMsg) => void
  /** Atualiza o que os outros sabem de mim (janela aberta, última posição). */
  setMe:    (patch: Partial<NetPeer>) => void
  onPos:    (cb: (msg: PosMsg) => void) => () => void
  onPeers:  (cb: (peers: NetPeer[]) => void) => () => void
  close:    () => void
}

interface Transport {
  send:       (event: string, payload: unknown) => void
  track:      (state: NetPeer) => void
  onEvent:    (event: string, cb: (payload: unknown) => void) => void
  onPresence: (cb: (states: NetPeer[]) => void) => void
  close:      () => void
}

function supabaseTransport(topic: string, key: string): Transport {
  const events = new Map<string, (payload: unknown) => void>()
  let presence: ((states: NetPeer[]) => void) | null = null
  let pendingTrack: NetPeer | null = null
  let ready = false
  const channel = supabase.channel(topic, { config: { broadcast: { self: false }, presence: { key } } })
  channel
    .on('broadcast', { event: '*' }, ({ event, payload }) => events.get(event)?.(payload))
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<NetPeer>()
      presence?.(Object.values(state).flat())
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ready = true
        if (pendingTrack) { void channel.track(pendingTrack); pendingTrack = null }
      }
    })
  return {
    send: (event, payload) => { if (ready) void channel.send({ type: 'broadcast', event, payload }) },
    track: (state) => { if (ready) void channel.track(state); else pendingTrack = state },
    onEvent: (event, cb) => { events.set(event, cb) },
    onPresence: (cb) => { presence = cb },
    close: () => { void supabase.removeChannel(channel) },
  }
}

export function connectLivro(roomId: string, me: NetPeer): LivroNet {
  const t = supabaseTransport(`livro:${roomId}`, me.uid)
  let mine: NetPeer = { ...me }
  const posListeners = new Set<(msg: PosMsg) => void>()
  const peerListeners = new Set<(peers: NetPeer[]) => void>()
  let peers: NetPeer[] = []
  let lastTrack = 0
  let trackTimer: number | undefined

  t.onEvent('pos', (payload) => { const m = payload as PosMsg; posListeners.forEach((l) => l(m)) })
  t.onPresence((states) => {
    // Uma pessoa pode estar em duas abas: fica a entrada mais "rica".
    const byUid = new Map<string, NetPeer>()
    for (const p of states) if (p?.uid && !byUid.has(p.uid)) byUid.set(p.uid, p)
    peers = [...byUid.values()]
    peerListeners.forEach((l) => l(peers))
  })
  t.track(mine)

  // A presence não aguenta 12 por segundo: atualiza no máximo a cada 1,5 s.
  const flushTrack = () => { lastTrack = Date.now(); trackTimer = undefined; t.track(mine) }

  return {
    sendPos: (msg) => {
      t.send('pos', msg)
      mine = { ...mine, x: msg.x, y: msg.y, d: msg.d, panel: msg.p }
      if (trackTimer === undefined) trackTimer = window.setTimeout(flushTrack, Math.max(0, 1500 - (Date.now() - lastTrack)))
    },
    setMe: (patch) => {
      mine = { ...mine, ...patch }
      window.clearTimeout(trackTimer)
      flushTrack()
    },
    onPos: (cb) => { posListeners.add(cb); return () => { posListeners.delete(cb) } },
    onPeers: (cb) => { peerListeners.add(cb); cb(peers); return () => { peerListeners.delete(cb) } },
    close: () => { window.clearTimeout(trackTimer); t.close() },
  }
}
