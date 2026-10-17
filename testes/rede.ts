// ────────────────────────────────────────────────────────
// Teste de rede do Vortable em várias abas (só no `npm run dev`; fora do build).
// Cada aba é uma pessoa: roda a rede de verdade (src/features/vortable/net) com
// WebRTC de verdade entre as abas; o "jogo" é um boneco que anda em círculo.
//
//   /testes/rede.html?papel=mestre
//   /testes/rede.html?papel=jogador&id=P1          (abra P1..P5)
//   &reserva=1      essa aba finge não ter WebRTC (entra pela conexão reserva)
//   &campanha=<id>  sala e reserva pelo Supabase Realtime (tópicos mesa:<id>:teste-rede
//                   e mesa:<id>:vt:<jogador>; precisa estar logado e ser membro)
//   sem campanha    sala e reserva por BroadcastChannel (entre abas do mesmo navegador)
// ────────────────────────────────────────────────────────
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase } from '../src/shared/lib/supabase'
import { VortableNet, type RelayFactory, type RelayPayload, type Signal, type Signaling } from '../src/features/vortable/net/VortableNet'
import { createRelayFactory } from '../src/features/vortable/net/relay'
import { VtErrorPopups } from '../src/features/vortable/errors/VtErrorPopups'
import { useVtIssues } from '../src/features/vortable/errors/vtErrors'

const q = new URLSearchParams(location.search)
const master = q.get('papel') === 'mestre'
const id = master ? 'MESTRE' : q.get('id') ?? `P${Math.floor(Math.random() * 90 + 10)}`
const campaign = q.get('campanha')
if (q.get('reserva') === '1') (window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = undefined

const $ = (sel: string) => document.querySelector(sel) as HTMLElement
const logEl = $('#log')
function log(msg: string, cls = '') {
  const line = document.createElement('div')
  line.textContent = `${new Date().toLocaleTimeString('pt-BR')} ${msg}`
  if (cls) line.className = cls
  logEl.prepend(line)
  while (logEl.childElementCount > 300) logEl.lastElementChild?.remove()
}
// os códigos de erro também aparecem no log
const origWarn = console.warn
console.warn = (...args: unknown[]) => {
  origWarn.apply(console, args)
  if (typeof args[0] === 'string' && args[0].startsWith('[VT]')) log(args[0], 'warn')
}

function localSignaling(): Signaling {
  const bc = new BroadcastChannel('vt-teste-rede')
  const handlers = new Set<(p: Signal) => void>()
  bc.onmessage = (e) => { for (const h of handlers) h(e.data as Signal) }
  return { send: (p) => bc.postMessage(p), subscribe: (h) => { handlers.add(h); return () => { handlers.delete(h) } } }
}

function localRelay(): RelayFactory {
  return (suffix, on) => {
    const bc = new BroadcastChannel(`vt-teste-reserva:${suffix}`)
    bc.onmessage = (e) => on.message(e.data as RelayPayload)
    setTimeout(() => on.status(true), 50)
    return { send: (p) => { bc.postMessage(p); return true }, close: () => bc.close() }
  }
}

async function supabaseSignaling(campaignId: string): Promise<Signaling> {
  await supabase.realtime.setAuth()
  const handlers = new Set<(p: Signal) => void>()
  const ch = supabase.channel(`mesa:${campaignId}:teste-rede`, { config: { private: true, broadcast: { self: false } } })
  ch.on('broadcast', { event: 'rtc' }, ({ payload }) => { for (const h of handlers) h(payload as Signal) })
  await new Promise<void>((resolve) => ch.subscribe((s, err) => { log(`sala: ${s}${err ? ` ${err.message}` : ''}`); if (s === 'SUBSCRIBED') resolve() }))
  return { send: (p) => void ch.send({ type: 'broadcast', event: 'rtc', payload: p }), subscribe: (h) => { handlers.add(h); return () => { handlers.delete(h) } } }
}

interface Avatar { name: string; x: number; y: number; at: number }
const avatars = new Map<string, Avatar>()
let received = 0

async function main() {
  $('#title').textContent = `Teste de rede · ${master ? 'MESTRE' : id}${q.get('reserva') === '1' ? ' (sem WebRTC)' : ''}`
  document.title = `${master ? 'Mestre' : id} · rede`
  const signaling = campaign ? await supabaseSignaling(campaign) : localSignaling()
  const net = new VortableNet({
    selfId: id, name: master ? 'Mestre' : `Jogador ${id}`, isMaster: master, signaling,
    relay: campaign ? createRelayFactory(campaign) : localRelay(),
    currentZone: () => 'z1',
  })
  ;(window as unknown as { __net: VortableNet; __avatars: Map<string, Avatar> }).__net = net
  ;(window as unknown as { __avatars: Map<string, Avatar> }).__avatars = avatars

  net.sink = (m) => {
    received++
    const msg = m as { t?: string; id?: string; name?: string; x?: number; y?: number }
    if (msg.t === 'hello' && msg.id) { avatars.set(msg.id, { name: msg.name ?? msg.id, x: 0, y: 0, at: Date.now() }); log(`entrou no mapa: ${msg.id}`, 'ok') }
    else if (msg.t === 'bye' && msg.id) { avatars.delete(msg.id); log(`saiu do mapa: ${msg.id}`, 'warn') }
    else if (msg.t === 'state' && msg.id) { const a = avatars.get(msg.id); if (a) { a.x = msg.x ?? 0; a.y = msg.y ?? 0; a.at = Date.now() } }
    else if (msg.t === 'zone') log(`zona recarregada: ${msg.id}`, 'ok')
    else if (msg.t === 'env') log('ambiente recebido', 'ok')
  }
  net.onKicked = () => log('o mestre me tirou da sessão', 'bad')
  net.onReplaced = () => log('outra aba assumiu esta conta', 'bad')
  net.onDoor = (req) => { log(`pedido de passagem de ${req.name}: sim`); net.answerDoor(req.peerId, req.id, true) }

  const hello = { t: 'hello', id, name: `Jogador ${id}`, appearance: { version: 2, slots: {} } }
  net.onOpen = (again) => { log(again ? 'reconectado' : 'conectado', 'ok'); net.send(hello); net.send({ t: 'who' }) }
  if (!master) net.setLive(true)
  // como a página do Vortable: fechar ou recarregar a aba sai limpo
  window.addEventListener('pagehide', () => net.dispose())

  // o "jogo": anda em círculo, posição 10×/s
  const seed = [...id].reduce((s, c) => s + c.charCodeAt(0), 0)
  let t0 = 0
  setInterval(() => {
    if (master) return
    t0 += 0.1
    const x = 200 + Math.cos(t0 + seed) * (60 + (seed % 70))
    const y = 150 + Math.sin(t0 + seed) * (40 + (seed % 50))
    me.x = x; me.y = y
    net.send({ t: 'state', id, zone: 'z1', x, y, dir: 'down', anim: 'walk' })
  }, 100)
  const me = { x: 0, y: 0 }

  const btn = (label: string, fn: () => void) => {
    const b = document.createElement('button')
    b.textContent = label
    b.onclick = fn
    $('#buttons').append(b)
  }
  if (master) {
    btn('Salvar zona z1', () => net.send({ t: 'zone', id: 'z1' }))
    btn('Hora 22h (todos)', () => net.send({ t: 'env', zone: '*', hour: 22, weather: 'rain', wind: null }))
  } else {
    btn('Derrubar ligação', () => {
      const link = (net as unknown as { link: { dc: RTCDataChannel | null; pc: RTCPeerConnection | null } | null }).link
      log('derrubando a ligação de propósito', 'warn')
      link?.dc?.close()
      link?.pc?.close()
    })
    btn('Pedir passagem', () => { void net.askDoor({ from: 'z1', fromName: 'Vila', to: 'z2', toName: 'Mata', via: 'Porteira' }).then((a) => log(`passagem: ${a}`, a === 'ok' ? 'ok' : 'bad')) })
    btn('Usar aqui', () => net.retry())
  }
  btn('Sair (fechar limpo)', () => { net.dispose(); log('saí', 'warn') })

  const canvas = $('#map') as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!
  const draw = () => {
    ctx.clearRect(0, 0, 400, 300)
    const now = Date.now()
    const dot = (x: number, y: number, label: string, color: string) => {
      ctx.fillStyle = color
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#eef1f7'; ctx.font = '11px system-ui'; ctx.fillText(label, x + 9, y + 4)
    }
    for (const [aid, a] of avatars) dot(a.x, a.y, aid, now - a.at > 8000 ? '#555' : '#c9a45c')
    if (!master) dot(me.x, me.y, `${id} (eu)`, '#7ee787')
    requestAnimationFrame(draw)
  }
  draw()

  setInterval(() => {
    const st = $('#status')
    if (master) {
      const open = net.connected.filter((p) => p.connected)
      st.textContent = `${open.length} conectados · ${avatars.size} bonecos no mapa · ${received} msgs recebidas${net.issue ? ` · ${net.issue}` : ''}`
      $('#peers').innerHTML = `<table><tr><th>id</th><th>ligação</th><th>por onde</th><th>latência</th><th>papel</th></tr>${net.connected.map((p) => `<tr><td>${p.id}</td><td class="${p.connected ? 'ok' : 'warn'}">${p.connected ? 'aberta' : 'abrindo'}</td><td>${p.via}</td><td>${p.rtt ?? '-'} ms</td><td>${p.role}</td></tr>`).join('')}</table>`
    } else {
      st.textContent = `${net.status}${net.transport ? ` (${net.transport})` : ''}${net.rtt != null ? ` · ${net.rtt} ms` : ''} · vejo ${avatars.size} bonecos · ${received} msgs${net.issue ? ` · ${net.issue}` : ''}`
      st.className = net.status === 'online' ? 'ok' : net.issue ? 'bad' : 'warn'
    }
  }, 500)
}

function Issues() {
  const issues = useVtIssues()
  ;(window as unknown as { __issues: unknown }).__issues = issues.map((i) => i.code)
  return createElement(VtErrorPopups)
}
createRoot($('#pops')).render(createElement(Issues))
void main()
