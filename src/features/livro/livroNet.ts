import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// O ao vivo do Livro Bloqueado: onde cada boneco está e o que cada um
// está olhando. Não passa pelo banco — vai direto entre os navegadores no
// canal "livro:<sala>" (o nome é a sala: todos precisam do MESMO nome,
// então nada de uniqueChannel aqui). Se o canal cair, ele se refaz sozinho.
//   • broadcast "pos": quem joga manda a posição ~6 vezes por segundo;
//   • presence: quem está na sala agora (e a última posição, pra quem
//     chega no meio já ver os bonecos no lugar);
//   • broadcast "ui": o que só existe na tela de quem joga, dentro da
//     janela aberta (símbolo escolhido, o que está digitando, onde está o
//     mouse/a lupa) — pra quem assiste ver igual. ~4 por segundo.
// ────────────────────────────────────────────────────────

export type Dir = 'down' | 'up' | 'left' | 'right'

/** Qual janela de enigma a pessoa tem aberta (null = andando pela sala). */
export type PanelId = 'castical' | 'retrato' | 'astrolabio' | 'estante' | 'pedestal'

export interface NetPeer<P extends string = PanelId> {
  uid:   string
  name:  string
  slot:  number | null
  gm:    boolean
  panel: P | null
  x?:    number
  y?:    number
  d?:    Dir
}

/** O que está na janela de quem joga (u = quem, p = janela, s = o estado dela). */
export interface UiMsg { u: string; p: string; s: Record<string, unknown> }

/** Posição de um boneco (u = quem, m = andando, p = janela aberta). */
export interface PosMsg<P extends string = PanelId> { u: string; x: number; y: number; d: Dir; m: boolean; p: P | null; t: number }

export interface LivroNet<P extends string = PanelId> {
  sendPos:  (msg: PosMsg<P>) => void
  /** Atualiza o que os outros sabem de mim (janela aberta, última posição). */
  setMe:    (patch: Partial<NetPeer<P>>) => void
  onPos:    (cb: (msg: PosMsg<P>) => void) => () => void
  onPeers:  (cb: (peers: NetPeer<P>[]) => void) => () => void
  /** O estado da minha janela aberta, pra quem assiste (no máximo ~10 por segundo). */
  sendUi:   (msg: UiMsg) => void
  onUi:     (cb: (msg: UiMsg) => void) => () => void
  /** O ao vivo está funcionando? (avisa já com o valor atual) */
  onLive:   (cb: (live: boolean) => void) => () => void
  close:    () => void
}

/** A camada de transporte (dá pra trocar em teste). */
export interface Transport {
  send:       (event: string, payload: unknown) => void
  track:      (state: NetPeer<string>) => void
  onEvent:    (event: string, cb: (payload: unknown) => void) => void
  onPresence: (cb: (states: NetPeer<string>[]) => void) => void
  /** Avisa quando o ao vivo cai (false) e quando volta (true). */
  onStatus:   (cb: (live: boolean) => void) => void
  close:      () => void
}

/**
 * O canal do Supabase, que se refaz sozinho se cair (rede, o celular que
 * dormiu, o Supabase derrubando por excesso de mensagens). Antes de abrir,
 * tira um canal velho com o mesmo nome que ainda esteja fechando: o
 * Supabase devolveria ele de novo, já morto.
 */
function supabaseTransport(topic: string, key: string): Transport {
  const events = new Map<string, (payload: unknown) => void>()
  let presence: ((states: NetPeer<string>[]) => void) | null = null
  let status: ((live: boolean) => void) | null = null
  let lastTrack: NetPeer<string> | null = null
  let channel: RealtimeChannel | null = null
  let ready = false
  let closed = false
  let retry: number | undefined
  let attempt = 0

  const setReady = (v: boolean) => { if (ready !== v) { ready = v; status?.(v) } }

  const open = async () => {
    const full = `realtime:${topic}`
    await Promise.all(supabase.getChannels().filter((c) => c.topic === full).map((c) => supabase.removeChannel(c)))
    if (closed) return
    const ch = supabase.channel(topic, { config: { broadcast: { self: false }, presence: { key } } })
    channel = ch
    ch
      .on('broadcast', { event: '*' }, ({ event, payload }) => { if (channel === ch) events.get(event)?.(payload) })
      .on('presence', { event: 'sync' }, () => {
        if (channel !== ch) return
        presence?.(Object.values(ch.presenceState<NetPeer<string>>()).flat())
      })
      .subscribe((st) => {
        if (channel !== ch || closed) return
        if (st === 'SUBSCRIBED') {
          attempt = 0
          setReady(true)
          // depois de reconectar, a presence começa vazia: diz de novo quem eu sou
          if (lastTrack) void ch.track(lastTrack)
        } else {
          setReady(false)
          reopen()
        }
      })
  }

  // Caiu: refaz o canal, esperando cada vez mais (1 s, 2 s, 4 s… até 15 s).
  const reopen = () => {
    if (closed || retry !== undefined) return
    const wait = Math.min(15000, 1000 * 2 ** attempt++)
    retry = window.setTimeout(() => {
      retry = undefined
      const old = channel
      channel = null
      void (old ? supabase.removeChannel(old) : Promise.resolve()).catch(() => {}).then(() => open())
    }, wait)
  }

  void open()

  return {
    send: (event, payload) => { if (ready && channel) void channel.send({ type: 'broadcast', event, payload }) },
    track: (state) => { lastTrack = state; if (ready && channel) void channel.track(state) },
    onEvent: (event, cb) => { events.set(event, cb) },
    onPresence: (cb) => { presence = cb },
    onStatus: (cb) => { status = cb },
    close: () => {
      closed = true
      window.clearTimeout(retry)
      if (channel) void supabase.removeChannel(channel)
      channel = null
    },
  }
}

export function connectLivro(roomId: string, me: NetPeer): LivroNet {
  return connectRoomNet<PanelId>(`livro:${roomId}`, me)
}

/** O ao vivo de qualquer joguinho do molde (o canal tem nome fixo: "<jogo>:<sala>"). */
export function connectRoomNet<P extends string>(topic: string, me: NetPeer<P>): LivroNet<P> {
  const t = supabaseTransport(topic, me.uid)
  let mine: NetPeer<P> = { ...me }
  const posListeners = new Set<(msg: PosMsg<P>) => void>()
  const peerListeners = new Set<(peers: NetPeer<P>[]) => void>()
  let peers: NetPeer<P>[] = []
  let lastTrack = 0
  let trackTimer: number | undefined

  t.onEvent('pos', (payload) => { const m = payload as PosMsg<P>; posListeners.forEach((l) => l(m)) })
  const uiListeners = new Set<(msg: UiMsg) => void>()
  t.onEvent('ui', (payload) => { const m = payload as UiMsg; uiListeners.forEach((l) => l(m)) })
  // ui: manda a última de cada 250 ms, e só se mudou (quem assiste não
  // precisa de cada tecla, e o Supabase tem limite de mensagens)
  let uiPending: UiMsg | null = null
  let uiLast = ''
  let uiTimer: number | undefined
  const flushUi = () => {
    uiTimer = undefined
    if (uiPending && !closed) {
      const k = JSON.stringify(uiPending)
      if (k !== uiLast) { uiLast = k; t.send('ui', uiPending) }
    }
    uiPending = null
  }
  let live = false
  const liveListeners = new Set<(live: boolean) => void>()
  t.onStatus((v) => { live = v; if (v) uiLast = ''; liveListeners.forEach((l) => l(v)) })
  t.onPresence((states) => {
    // Uma pessoa pode estar em duas abas: fica a entrada mais "rica".
    const byUid = new Map<string, NetPeer<P>>()
    for (const p of states as NetPeer<P>[]) if (p?.uid && !byUid.has(p.uid)) byUid.set(p.uid, p)
    peers = [...byUid.values()]
    peerListeners.forEach((l) => l(peers))
  })
  t.track(mine)

  // A presence não aguenta 12 por segundo: atualiza no máximo a cada 1,5 s.
  const flushTrack = () => { lastTrack = Date.now(); trackTimer = undefined; t.track(mine) }

  let closed = false

  return {
    sendPos: (msg) => {
      if (closed) return
      t.send('pos', msg)
      mine = { ...mine, x: msg.x, y: msg.y, d: msg.d, panel: msg.p }
      if (trackTimer === undefined) trackTimer = window.setTimeout(flushTrack, Math.max(0, 1500 - (Date.now() - lastTrack)))
    },
    setMe: (patch) => {
      if (closed) return
      mine = { ...mine, ...patch }
      window.clearTimeout(trackTimer)
      flushTrack()
    },
    onPos: (cb) => { posListeners.add(cb); return () => { posListeners.delete(cb) } },
    onPeers: (cb) => { peerListeners.add(cb); cb(peers); return () => { peerListeners.delete(cb) } },
    sendUi: (msg) => {
      if (closed) return
      uiPending = msg
      if (uiTimer === undefined) uiTimer = window.setTimeout(flushUi, 250)
    },
    onUi: (cb) => { uiListeners.add(cb); return () => { uiListeners.delete(cb) } },
    onLive: (cb) => { liveListeners.add(cb); cb(live); return () => { liveListeners.delete(cb) } },
    // Fechou: o que chegar depois (de uma tela que ainda não soube) é ignorado.
    close: () => { closed = true; window.clearTimeout(trackTimer); window.clearTimeout(uiTimer); t.close() },
  }
}
