import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../auth/AuthProvider'
import { useCurrentCampaign } from '../campaigns/CurrentCampaignContext'
import { getMyCampaigns } from '../campaigns/services/campaignService'
import { useFeature } from '../control/siteFeatures'
import { getOpenRoom, TORRE_FEATURE, subscribeRooms, type TorreRoomRow } from './torreService'
import { TorreOverlay } from './TorreOverlay'

// ────────────────────────────────────────────────────────
// Fica no layout do site, em qualquer página: se uma campanha minha tem a
// Torre do Observatório aberta, o jogo cobre a tela (pra todos dela —
// jogadores, quem assiste e o mestre). "Voltar ao site" minimiza: sobra
// uma pílula pra voltar. Guardado no Painel de controle, só o dono vê.
// ────────────────────────────────────────────────────────

const MIN_KEY = 'vorterium:torre-minimizado'

function loadMin(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(MIN_KEY) ?? '[]') as string[]) } catch { return new Set() }
}

export function TorreHost() {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const feature = useFeature(TORRE_FEATURE)
  const [campaigns, setCampaigns] = useState<string[]>([])
  const [rooms, setRooms] = useState<Record<string, TorreRoomRow | null>>({})
  const [minimized, setMinimized] = useState<Set<string>>(loadMin)

  // Minhas campanhas (qualquer papel: o mestre também vê o jogo).
  const currentId = campaign?.id ?? null
  useEffect(() => {
    if (!user || !feature.visible) return
    let alive = true
    getMyCampaigns()
      .then((list) => { if (alive) setCampaigns(list.map((c) => c.id)) })
      .catch(() => {})
    return () => { alive = false }
  }, [user, feature.visible, currentId])

  // Sala aberta em cada uma, em tempo real.
  useEffect(() => {
    if (!feature.visible || campaigns.length === 0) return
    const offs = campaigns.map((id) => {
      void getOpenRoom(id).then((r) => setRooms((prev) => ({ ...prev, [id]: r })))
      return subscribeRooms(id, (row) => {
        setRooms((prev) => {
          if (!row || row.status === 'fim') return { ...prev, [id]: null }
          const old = prev[id]
          if (old && old.id === row.id && old.version > row.version) return prev
          return { ...prev, [id]: row }
        })
      })
    })
    return () => offs.forEach((off) => off())
  }, [feature.visible, campaigns])

  if (!feature.visible) return null
  const open = (currentId && rooms[currentId]) || Object.values(rooms).find((r) => r && r.status !== 'fim') || null
  if (!open || open.status === 'fim') return null

  const setMin = (next: Set<string>) => {
    setMinimized(next)
    try { sessionStorage.setItem(MIN_KEY, JSON.stringify([...next].slice(-20))) } catch { /* sem storage */ }
  }

  if (minimized.has(open.id)) {
    return createPortal(
      <button type="button" className="lb-pill" onClick={() => { const n = new Set(minimized); n.delete(open.id); setMin(n) }}>
        <span className="lb-pill__dot" aria-hidden="true" /> Voltar à Torre do Observatório
      </button>,
      document.body,
    )
  }

  return createPortal(
    <TorreOverlay key={open.id} room={open} onMinimize={() => { const n = new Set(minimized); n.add(open.id); setMin(n) }} />,
    document.body,
  )
}
