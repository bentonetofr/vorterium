import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { useMesaStream } from '../../mesa/MesaStreamProvider'
import { getCharacterFaces } from '../../chat/services/chatService'
import { VortableNet, type DoorRequest, type NetCommand, type NetIssue, type NetPeerInfo, type NetStatus, type NetTransport, type Signaling } from './VortableNet'
import { createRelayFactory } from './relay'
import { DoorPrompt } from '../components/DoorPrompt'
import { getResume, patchResume } from '../resume/resumeStore'
import { creatureSfxEnabled, playCreatureSound, unlockCreatureAudio, type SoundDistance } from '../enemies/creatureSounds'
import { getLocalZone } from '../enemies/localZone'
import { setVtContext, vtError, vtResolve } from '../errors/vtErrors'

interface NetValue {
  net: VortableNet | null
  status: NetStatus
  /** Mestre: quem está conectado. */
  peers: NetPeerInfo[]
  /** Jogador: o mestre tirou da sessão. */
  kicked: boolean
  /** Jogador: por que parou de tentar entrar (tirado, outra aba assumiu, versão diferente). */
  issue: NetIssue
  retry: () => void
  /** Jogador: está só assistindo (por escolha dele ou porque o mestre mandou). */
  watching: boolean
  setWatching: (v: boolean) => void
  /** Nome do jogador local (o mesmo que os outros veem sobre o boneco). */
  name: string
  /** Jogador: por onde está ligado ao mestre (direto ou reserva) e a latência. */
  transport: NetTransport | null
  rtt: number | null
  /** Mestre: manda assistir / pôr em jogo; se o jogador não está conectado, o pop-up avisa (VT-SALA-011). */
  command: (id: string, who: string, cmd: NetCommand) => void
  /** Mestre: tira da sessão (com o mesmo aviso). */
  kick: (id: string, who: string) => void
  /** Mestre: entrega uma mensagem a um jogador; false (e o aviso) se ele não está conectado. */
  deliver: (id: string, who: string, msg: unknown, acao: string) => boolean
}

/** A janela da ficha fechou: o nome do personagem pode ter mudado. */
export const SHEET_CLOSED_EVENT = 'vortable:sheet-closed'

const NetContext = createContext<NetValue | null>(null)

const envKey = (campaignId: string) => `vt:envs:${campaignId}`

/** Liga o multiplayer do Vortable enquanto a página do Vortable (ou a telinha) está aberta. */
export function VortableNetProvider({ children, startWatching = false, remember = true }: { children: ReactNode; startWatching?: boolean; remember?: boolean }) {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const mesa = useMesaStream()
  const isMaster = campaign?.role === 'master'
  const userId = user?.id ?? null
  const accountName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'Jogador'
  // o nome sobre o boneco é o do PERSONAGEM na ficha; sem ficha, o da conta
  const [sheetName, setSheetName] = useState<string | null>(null)
  const name = sheetName || accountName
  const [net, setNet] = useState<VortableNet | null>(null)
  const [, bump] = useState(0)
  const [watching, setWatching] = useState(startWatching)
  // mestre: jogadores esperando licença pra sair da zona
  const [doors, setDoors] = useState<DoorRequest[]>([])
  // sobe quando a página volta do cache do navegador (a rede foi desligada ao sair)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    if (!campaign || !userId) return
    const campaignId = campaign.id
    const made = new VortableNet({
      selfId: userId, name, isMaster, signaling: mesa.signaling as unknown as Signaling,
      relay: createRelayFactory(campaignId),
      currentZone: getLocalZone,
      // a hora/tempo/vento ao vivo continuam depois de o mestre recarregar a página
      envStore: {
        load: () => {
          try { return JSON.parse(sessionStorage.getItem(envKey(campaignId)) ?? '[]') as unknown[] } catch { return [] }
        },
        save: (list) => {
          try { sessionStorage.setItem(envKey(campaignId), JSON.stringify(list)) } catch { /* sem storage */ }
        },
      },
    })
    made.onChange = () => bump((n) => n + 1)
    made.onDoor = (req) => setDoors((list) => [...list.filter((d) => !(d.peerId === req.peerId && d.id === req.id)), req])
    made.onDoorGone = (peerId, id) => setDoors((list) => list.filter((d) => d.peerId !== peerId || (id !== '' && d.id !== id)))
    // o mestre manda assistir / volta a pôr em jogo
    made.onCommand = (cmd) => setWatching(cmd === 'spectate')
    // o mestre toca o som de uma criatura (quem está em outra zona não ouve, se ele escolheu assim)
    made.onSfx = (m) => {
      if (!creatureSfxEnabled()) return
      const here = getLocalZone()
      if (m.zone && here && m.zone !== here) return
      playCreatureSound(m.s, m.v, m.d as SoundDistance)
    }
    unlockCreatureAudio()
    setNet(made)
    // fechou a aba ou recarregou: sai limpo (o mestre tira o boneco na hora)
    const onHide = () => made.dispose()
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setGeneration((n) => n + 1) }
    window.addEventListener('pagehide', onHide)
    window.addEventListener('pageshow', onShow)
    return () => {
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('pageshow', onShow)
      made.dispose()
      setNet(null)
      setDoors([])
    }
    // o nome só vale na entrada; a sinalização é estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, userId, isMaster, mesa.signaling, generation])

  // os erros registrados levam quem, onde e como estava a conexão
  useEffect(() => {
    if (!campaign || !userId) return
    setVtContext({
      campaignId: campaign.id,
      userId,
      role: isMaster ? 'master' : watching ? 'spectator' : 'player',
      extra: () => ({
        conexao: net?.status ?? 'off',
        via: net?.transport ?? null,
        latencia: net?.rtt ?? null,
        zona: getLocalZone(),
        ...(isMaster ? { conectados: net?.connected.filter((p) => p.connected).length ?? 0 } : {}),
      }),
    })
  }, [campaign?.id, userId, isMaster, watching, net])

  // sem internet: avisa (e some quando volta)
  useEffect(() => {
    const off = () => vtError('VT-NET-001', { key: 'offline', record: false })
    const on = () => vtResolve('offline')
    if (!navigator.onLine) off()
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on); vtResolve('offline') }
  }, [])

  // mestre encerrou a sessão: a hora/tempo/vento guardados pra recarregar a página não valem mais
  const [wasLive, setWasLive] = useState(false)
  useEffect(() => {
    if (!isMaster || !campaign) return
    if (mesa.live) { setWasLive(true); return }
    if (wasLive) {
      setWasLive(false)
      try { sessionStorage.removeItem(envKey(campaign.id)) } catch { /* sem storage */ }
    }
  }, [isMaster, campaign?.id, mesa.live, wasLive])

  // jogador: o mestre sumiu (recarregando ou sem internet) e a ligação com ele não está aberta
  const masterGone = !isMaster && mesa.live && mesa.masterAway && net?.status !== 'online'
  useEffect(() => {
    if (masterGone) vtError('VT-SALA-004', { key: 'mestre', detail: mesa.stage.away ? 'o mestre saiu da página' : 'sem notícia do mestre' })
    else vtResolve('mestre')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterGone])
  useEffect(() => () => vtResolve('mestre'), [])

  // nome do personagem na ficha: confere ao abrir, a cada 5 segundos e quando a janela da ficha fecha
  useEffect(() => {
    if (!campaign || !userId) return
    let dead = false
    const load = () => {
      getCharacterFaces(campaign.id)
        .then((faces) => { if (!dead) setSheetName(faces.get(userId)?.name?.trim() || null) })
        .catch(() => { /* sem o nome da ficha, vale o da conta */ })
    }
    load()
    const timer = window.setInterval(load, 5_000)
    window.addEventListener(SHEET_CLOSED_EVENT, load)
    return () => { dead = true; window.clearInterval(timer); window.removeEventListener(SHEET_CLOSED_EVENT, load) }
  }, [campaign?.id, userId])

  useEffect(() => {
    if (net) net.name = name
  }, [net, name])

  // voltando ao Vortable: se a pessoa estava só assistindo, continua assistindo
  useEffect(() => {
    if (!remember || !campaign || isMaster) return
    if (getResume(campaign.id)?.watching) setWatching(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, isMaster])
  useEffect(() => {
    if (remember && campaign && !isMaster) patchResume(campaign.id, { watching })
  }, [watching, remember, campaign?.id, isMaster])

  // o mestre vê quem está jogando e quem está só assistindo
  useEffect(() => {
    if (net && !isMaster) net.setRole(watching ? 'spectator' : 'player')
  }, [net, isMaster, watching])

  // jogador: só procura o mestre enquanto ele está com o Vortable aberto
  useEffect(() => {
    if (net && !isMaster) net.setLive(mesa.live)
  }, [net, isMaster, mesa.live])

  // novo objeto a cada renderização: a rede avisa (bump) quando algo muda
  const value: NetValue = {
    net,
    status: net?.status ?? 'off',
    peers: net?.connected ?? [],
    kicked: net?.issue === 'kicked',
    issue: net?.issue ?? null,
    retry: () => net?.retry(),
    watching,
    setWatching,
    name,
    transport: net?.transport ?? null,
    rtt: net?.rtt ?? null,
    command: (id, who, cmd) => {
      if (!net?.command(id, cmd)) vtError('VT-SALA-011', { vars: { quem: who, acao: cmd === 'play' ? 'Colocar em jogo' : 'Mandar assistir' } })
    },
    kick: (id, who) => {
      if (!net?.kick(id)) vtError('VT-SALA-011', { vars: { quem: who, acao: 'Tirar da sessão' } })
    },
    deliver: (id, who, msg, acao) => {
      const ok = !!net?.sendTo(id, msg)
      if (!ok) vtError('VT-SALA-011', { vars: { quem: who, acao } })
      return ok
    },
  }

  function answerDoor(req: DoorRequest, ok: boolean) {
    if (!net?.answerDoor(req.peerId, req.id, ok)) vtError('VT-SALA-011', { vars: { quem: req.name, acao: ok ? 'Pode ir' : 'Não pode' } })
    setDoors((list) => list.filter((d) => d !== req))
  }

  return (
    <NetContext.Provider value={value}>
      {children}
      {isMaster && <DoorPrompt requests={doors} onAnswer={answerDoor} />}
    </NetContext.Provider>
  )
}

export function useVortableNet(): NetValue {
  const value = useContext(NetContext)
  if (!value) throw new Error('useVortableNet deve ser usado dentro de um <VortableNetProvider>')
  return value
}
