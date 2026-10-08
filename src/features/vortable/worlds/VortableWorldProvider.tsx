import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { ensureWorlds, watchWorlds, type CampaignWorld } from '../services/vortableService'

interface WorldValue {
  /** Carregou a lista de mundos? */
  ready: boolean
  worlds: CampaignWorld[]
  error: string | null
  /** O mundo onde os jogadores estão (o aberto pelo mestre). */
  active: CampaignWorld | null
  /** Mestre: o mundo que o editor está mexendo. */
  editing: CampaignWorld | null
  setEditId: (id: string) => void
  refresh: () => Promise<void>
}

const WorldContext = createContext<WorldValue | null>(null)

const editKey = (campaignId: string) => `vortable:edit-world:${campaignId}`

/** Os mundos da campanha: qual está aberto pros jogadores e qual o mestre está editando. */
export function VortableWorldProvider({ children }: { children: ReactNode }) {
  const { campaign } = useCurrentCampaign()
  const campaignId = campaign?.id ?? null
  const isMaster = campaign?.role === 'master'
  const [worlds, setWorlds] = useState<CampaignWorld[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editId, setEditIdState] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!campaignId) return
    try {
      setWorlds(await ensureWorlds(campaignId, isMaster))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os mundos.')
    } finally {
      setReady(true)
    }
  }, [campaignId, isMaster])

  useEffect(() => {
    if (!campaignId) return
    try { setEditIdState(localStorage.getItem(editKey(campaignId))) } catch { setEditIdState(null) }
    void refresh()
    // o mestre abriu outro mundo (ou criou/apagou): todo mundo acompanha
    return watchWorlds(campaignId, () => { void refresh() })
  }, [campaignId, refresh])

  const setEditId = useCallback((id: string) => {
    setEditIdState(id)
    if (campaignId) { try { localStorage.setItem(editKey(campaignId), id) } catch { /* sem storage */ } }
  }, [campaignId])

  const active = worlds.find((w) => w.active) ?? worlds[0] ?? null
  // o mundo em edição some (apagado): volta pro aberto
  const editing = worlds.find((w) => w.id === editId) ?? active

  const value: WorldValue = { ready, worlds, error, active, editing, setEditId, refresh }
  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>
}

export function useVortableWorlds(): WorldValue {
  const value = useContext(WorldContext)
  if (!value) throw new Error('useVortableWorlds deve ser usado dentro de um <VortableWorldProvider>')
  return value
}
