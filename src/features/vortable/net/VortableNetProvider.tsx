import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { useMesaStream } from '../../mesa/MesaStreamProvider'
import { VortableNet, type NetPeerInfo, type NetStatus, type Signaling } from './VortableNet'

interface NetValue {
  net: VortableNet | null
  status: NetStatus
  /** Mestre: quem está conectado. */
  peers: NetPeerInfo[]
  /** Jogador: o mestre tirou da sessão. */
  kicked: boolean
  retry: () => void
  /** Nome do jogador local (o mesmo que os outros veem sobre o boneco). */
  name: string
}

const NetContext = createContext<NetValue | null>(null)

/** Liga o multiplayer do Vortable (WebRTC) enquanto a página do Vortable está aberta. */
export function VortableNetProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const mesa = useMesaStream()
  const isMaster = campaign?.role === 'master'
  const userId = user?.id ?? null
  const name =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'Jogador'
  const [net, setNet] = useState<VortableNet | null>(null)
  const [, bump] = useState(0)
  const [kicked, setKicked] = useState(false)

  useEffect(() => {
    if (!campaign || !userId) return
    const made = new VortableNet({
      selfId: userId, name, isMaster, signaling: mesa.signaling as unknown as Signaling,
    })
    made.onChange = () => bump((n) => n + 1)
    made.onKicked = () => setKicked(true)
    setNet(made)
    return () => {
      made.dispose()
      setNet(null)
      setKicked(false)
    }
    // o nome só vale na entrada; a sinalização é estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, userId, isMaster, mesa.signaling])

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
    name,
  }

  return <NetContext.Provider value={value}>{children}</NetContext.Provider>
}

export function useVortableNet(): NetValue {
  const value = useContext(NetContext)
  if (!value) throw new Error('useVortableNet deve ser usado dentro de um <VortableNetProvider>')
  return value
}
