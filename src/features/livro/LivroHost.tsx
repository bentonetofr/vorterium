import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../auth/AuthProvider'
import { useCurrentCampaign } from '../campaigns/CurrentCampaignContext'
import { getMyCampaigns } from '../campaigns/services/campaignService'
import { useFeature } from '../control/siteFeatures'
import { getOpenRoom, LIVRO_FEATURE, openRoom, subscribeRooms, type LivroRoomRow } from './livroService'
import { GameFab } from './GameDock'
import { LivroOverlay } from './LivroOverlay'

// ────────────────────────────────────────────────────────
// Fica no layout do site, em qualquer página: se uma campanha minha tem o
// Livro Bloqueado aberto, o jogo cobre a tela (pra todos dela — jogadores,
// quem assiste e o mestre). "Voltar ao site" minimiza: sobra um ícone na
// coluna do canto pra voltar de onde parou (GameDock). O mestre da campanha
// aberta também tem o ícone pra trazer o jogo pra tela (abrir, ou voltar
// a ele depois de trocar pela Torre). Guardado no Painel de controle, só
// o dono do site vê.
// ────────────────────────────────────────────────────────

const MIN_KEY = 'vorterium:livro-minimizado'

function loadMin(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(MIN_KEY) ?? '[]') as string[]) } catch { return new Set() }
}

export function LivroHost() {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const feature = useFeature(LIVRO_FEATURE)
  const [campaigns, setCampaigns] = useState<string[]>([])
  const [rooms, setRooms] = useState<Record<string, LivroRoomRow | null>>({})
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
  // Sala pausada (o outro jogo está na tela) não aparece.
  const shown = (r: LivroRoomRow | null | undefined) => !!r && r.status !== 'fim' && !r.paused_at
  const open = (currentId && shown(rooms[currentId]) ? rooms[currentId] : null) || Object.values(rooms).find(shown) || null

  const setMin = (next: Set<string>) => {
    setMinimized(next)
    try { sessionStorage.setItem(MIN_KEY, JSON.stringify([...next].slice(-20))) } catch { /* sem storage */ }
  }

  if (open && !minimized.has(open.id)) {
    return createPortal(
      <LivroOverlay key={open.id} room={open} onMinimize={() => { const n = new Set(minimized); n.add(open.id); setMin(n) }} />,
      document.body,
    )
  }

  // Saí do jogo: o ícone volta pra ele, de onde parei.
  if (open) {
    return <GameFab game="livro" live label="Voltar ao Livro Bloqueado" onOpen={() => { const n = new Set(minimized); n.delete(open.id); setMin(n) }} />
  }

  // Mestre na página da campanha: traz o jogo pra tela (volta a ele se
  // estava pausado pela troca, ou abre um novo — aí cobre a tela de todos).
  if (campaign && campaign.role === 'master') {
    const here = rooms[campaign.id]
    const label = here ? 'Voltar ao Livro Bloqueado' : 'Abrir o Livro Bloqueado nesta campanha'
    return (
      <GameFab
        game="livro"
        live={false}
        label={label}
        confirm={here ? undefined : `Abrir o Livro Bloqueado em ${campaign.name}? O jogo cobre a tela de todos da campanha.`}
        onOpen={async () => {
          if (here) { const n = new Set(minimized); n.delete(here.id); setMin(n) }
          await openRoom(campaign.id)
        }}
      />
    )
  }
  return null
}
