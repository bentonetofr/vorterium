import { createContext, useContext, useState, Dispatch, SetStateAction, ReactNode } from 'react'
import type { CampaignWithRole } from '../../shared/types'

// ────────────────────────────────────────────────────────
// Contexto leve: qual campanha está aberta agora (se alguma) + seus
// selos de não lida. A barra lateral (PrivateLayout) e o dropdown do
// topo no celular leem daqui pra desenhar o submenu de seções — eles
// são IRMÃOS do conteúdo roteado na árvore (não descendentes), então
// não dá pra ler isso de um contexto criado dentro da página da
// campanha. O provider precisa envolver os dois; CampaignAreaLayout só
// escreve nele (busca a campanha e publica aqui) via useEffect.
// ────────────────────────────────────────────────────────

interface CurrentCampaignContextValue {
  campaign: CampaignWithRole | null
  setCampaign: Dispatch<SetStateAction<CampaignWithRole | null>>
  chatUnread: number
  setChatUnread: Dispatch<SetStateAction<number>>
  privateUnread: number
  setPrivateUnread: Dispatch<SetStateAction<number>>
}

const CurrentCampaignContext = createContext<CurrentCampaignContextValue | null>(null)

interface CurrentCampaignProviderProps {
  children: ReactNode
}

export function CurrentCampaignProvider({ children }: CurrentCampaignProviderProps) {
  const [campaign, setCampaign]           = useState<CampaignWithRole | null>(null)
  const [chatUnread, setChatUnread]       = useState(0)
  const [privateUnread, setPrivateUnread] = useState(0)

  return (
    <CurrentCampaignContext.Provider
      value={{ campaign, setCampaign, chatUnread, setChatUnread, privateUnread, setPrivateUnread }}
    >
      {children}
    </CurrentCampaignContext.Provider>
  )
}

export function useCurrentCampaign(): CurrentCampaignContextValue {
  const context = useContext(CurrentCampaignContext)
  if (!context) {
    throw new Error('useCurrentCampaign deve ser usado dentro de um <CurrentCampaignProvider>')
  }
  return context
}
