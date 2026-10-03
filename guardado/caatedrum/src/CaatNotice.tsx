import { useEffect, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useCurrentCampaign } from '../campaigns/CurrentCampaignContext'
import { getMyCampaigns } from '../campaigns/services/campaignService'
import { useFeature } from '../control/siteFeatures'
import { CAATEDRUM_FEATURE, getOpenRoom, getViewingRoom, onViewingChange, subscribeRooms, type CaatRoomRow } from './caatService'
import '../mesa/components/MesaLiveNotice.css'

// ────────────────────────────────────────────────────────
// Aviso pros jogadores, em qualquer página: "A mesa de Caatedrum está
// posta" — com Sentar, que leva direto pra aba Caatedrum da campanha.
// Some pra quem já está na aba. Fechado com ✕, não volta naquela mesa.
// ────────────────────────────────────────────────────────

const DISMISSED_KEY = 'vorterium:caatedrum-avisos-vistos'

function dismissedSet(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]') as string[]) } catch { return new Set() }
}

export function CaatNotice() {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const feature = useFeature(CAATEDRUM_FEATURE)
  const navigate = useNavigate()
  const viewing = useSyncExternalStore(onViewingChange, getViewingRoom)
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])
  const [rooms, setRooms] = useState<Record<string, CaatRoomRow | null>>({})
  const [dismissed, setDismissed] = useState<Set<string>>(dismissedSet)

  // Campanhas em que a pessoa é jogadora.
  const currentId = campaign?.id ?? null
  useEffect(() => {
    if (!user || !feature.on) return
    let alive = true
    getMyCampaigns()
      .then((list) => { if (alive) setCampaigns(list.filter((c) => c.role === 'player').map((c) => ({ id: c.id, name: c.name }))) })
      .catch(() => {})
    return () => { alive = false }
  }, [user, feature.on, currentId])

  // Mesa posta em cada uma (e em tempo real).
  useEffect(() => {
    if (!feature.on || campaigns.length === 0) return
    const offs = campaigns.map((c) => {
      void getOpenRoom(c.id).then((r) => setRooms((prev) => ({ ...prev, [c.id]: r })))
      return subscribeRooms(c.id, (row) => {
        if (!row || row.status === 'fim') setRooms((prev) => ({ ...prev, [c.id]: null }))
        else setRooms((prev) => ({ ...prev, [c.id]: row }))
      })
    })
    return () => offs.forEach((off) => off())
  }, [feature.on, campaigns])

  if (!feature.on) return null
  const open = campaigns.find((c) => {
    const r = rooms[c.id]
    return r && r.status !== 'fim' && r.id !== viewing && !dismissed.has(r.id)
  })
  if (!open) return null
  const room = rooms[open.id]!

  const dismiss = () => {
    const next = new Set(dismissed)
    next.add(room.id)
    setDismissed(next)
    try { sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...next].slice(-30))) } catch { /* sem storage */ }
  }

  return (
    <div className="mesa-notice" role="status" aria-live="polite">
      <span className="mesa-notice__live">Caatedrum</span>
      <div className="mesa-notice__body">
        <p className="mesa-notice__message"><strong>A mesa de Caatedrum está posta</strong>{room.status === 'jogo' ? ' — a partida já começou' : ''}</p>
        <p className="mesa-notice__campaign">{open.name}</p>
      </div>
      <div className="mesa-notice__actions">
        <button type="button" className="btn btn-primary mesa-notice__watch" onClick={() => navigate(`/campanhas/${open.id}/mesa-sessao`, { state: { initialSessionSubTab: 'caatedrum' } })}>Sentar</button>
        <button type="button" className="mesa-notice__close" onClick={dismiss} aria-label="Fechar aviso">✕</button>
      </div>
    </div>
  )
}
