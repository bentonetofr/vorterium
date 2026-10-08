import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { useMesaStream } from '../../mesa/MesaStreamProvider'
import { getCharacterFaces } from '../../chat/services/chatService'
import { VortableNet, type NetPeerInfo, type NetStatus, type Signaling } from './VortableNet'

interface NetValue {
  net: VortableNet | null
  status: NetStatus
  /** Mestre: quem está conectado. */
  peers: NetPeerInfo[]
  /** Jogador: o mestre tirou da sessão. */
  kicked: boolean
  retry: () => void
  /** Jogador: está só assistindo (por escolha dele ou porque o mestre mandou). */
  watching: boolean
  setWatching: (v: boolean) => void
  /** Nome do jogador local (o mesmo que os outros veem sobre o boneco). */
  name: string
}

/** A janela da ficha fechou: o nome do personagem pode ter mudado. */
export const SHEET_CLOSED_EVENT = 'vortable:sheet-closed'

const NetContext = createContext<NetValue | null>(null)

/** Liga o multiplayer do Vortable (WebRTC) enquanto a página do Vortable está aberta. */
export function VortableNetProvider({ children }: { children: ReactNode }) {
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
  const [kicked, setKicked] = useState(false)
  const [watching, setWatching] = useState(false)

  useEffect(() => {
    if (!campaign || !userId) return
    const made = new VortableNet({
      selfId: userId, name, isMaster, signaling: mesa.signaling as unknown as Signaling,
    })
    made.onChange = () => bump((n) => n + 1)
    made.onKicked = () => setKicked(true)
    // o mestre manda assistir / volta a pôr em jogo
    made.onCommand = (cmd) => setWatching(cmd === 'spectate')
    setNet(made)
    return () => {
      made.dispose()
      setNet(null)
      setKicked(false)
    }
    // o nome só vale na entrada; a sinalização é estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, userId, isMaster, mesa.signaling])

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
    kicked,
    retry: () => { setKicked(false); net?.retry() },
    watching,
    setWatching,
    name,
  }

  return <NetContext.Provider value={value}>{children}</NetContext.Provider>
}

export function useVortableNet(): NetValue {
  const value = useContext(NetContext)
  if (!value) throw new Error('useVortableNet deve ser usado dentro de um <VortableNetProvider>')
  return value
}
