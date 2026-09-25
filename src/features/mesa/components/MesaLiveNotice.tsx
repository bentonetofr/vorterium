import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../../shared/lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { getMyCampaigns } from '../../campaigns/services/campaignService'
import { useMesaStream } from '../MesaStreamProvider'
import './MesaLiveNotice.css'

// ────────────────────────────────────────────────────────
// Aviso "o mestre está transmitindo" em QUALQUER página do site. Escuta o
// canal "mesa-aviso:<campanha>" de todas as campanhas em que a pessoa é
// jogadora; ao entrar, pergunta "status?" (quem abriu o site no meio da
// transmissão também é avisado). Cada transmissão avisa uma vez só.
// ────────────────────────────────────────────────────────

interface Notice {
  liveId:       string
  campaignId:   string
  campaignName: string
  masterName:   string
}

const NOTICE_MS    = 15_000
const DISMISSED_KEY = 'vorterium:mesa-avisos-vistos'

function readDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function saveDismissed(set: Set<string>) {
  try { sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...set].slice(-50))) } catch { /* sem storage */ }
}

function playNotifySound() {
  try {
    const audio = new Audio('/notify.mp3')
    audio.volume = 0.6
    void audio.play().catch(() => {})
  } catch {
    // sem Audio API
  }
}

export function MesaLiveNotice() {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const { viewing } = useMesaStream()
  const navigate = useNavigate()
  const [notices, setNotices] = useState<Notice[]>([])
  const dismissedRef = useRef<Set<string>>(readDismissed())
  const [playerCampaigns, setPlayerCampaigns] = useState<{ id: string; name: string }[]>([])

  // Campanhas em que a pessoa é jogadora — recarrega ao entrar numa
  // campanha (pega a que ela acabou de aceitar convite, por exemplo).
  const currentId = campaign?.id ?? null
  useEffect(() => {
    if (!user) return
    let active = true
    getMyCampaigns()
      .then((list) => {
        if (!active) return
        const next = list.filter((c) => c.role === 'player').map((c) => ({ id: c.id, name: c.name }))
        setPlayerCampaigns((prev) =>
          prev.length === next.length && prev.every((p, i) => p.id === next[i].id && p.name === next[i].name) ? prev : next,
        )
      })
      .catch(() => { /* aviso é extra — nunca quebra a página */ })
    return () => { active = false }
  }, [user, currentId])

  useEffect(() => {
    if (!user || playerCampaigns.length === 0) return
    let disposed = false
    const channels: RealtimeChannel[] = []

    void (async () => {
      await supabase.realtime.setAuth()
      if (disposed) return
      for (const c of playerCampaigns) {
        const channel = supabase.channel(`mesa-aviso:${c.id}`, { config: { private: true, broadcast: { self: false } } })
        channel.on('broadcast', { event: 'live' }, ({ payload }) => {
          const liveId = String(payload?.liveId ?? '')
          if (!liveId || dismissedRef.current.has(liveId)) return
          setNotices((list) => list.some((n) => n.liveId === liveId) ? list : [...list, {
            liveId,
            campaignId:   c.id,
            campaignName: c.name,
            masterName:   String(payload?.masterName ?? 'O mestre'),
          }])
        })
        channel.on('broadcast', { event: 'ended' }, () => {
          setNotices((list) => list.filter((n) => n.campaignId !== c.id))
        })
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') void channel.send({ type: 'broadcast', event: 'status?', payload: {} })
        })
        channels.push(channel)
      }
    })()

    return () => {
      disposed = true
      for (const channel of channels) void supabase.removeChannel(channel)
    }
  }, [user, playerCampaigns])

  function dismiss(liveId: string) {
    dismissedRef.current.add(liveId)
    saveDismissed(dismissedRef.current)
    setNotices((list) => list.filter((n) => n.liveId !== liveId))
  }

  // Quem já está com a aba Mesa aberta nessa campanha não precisa do aviso.
  const visible = notices.filter((n) => !(viewing && n.campaignId === currentId))
  const current = visible[0] ?? null

  // Já está vendo: conta como visto.
  useEffect(() => {
    if (!viewing || !currentId) return
    for (const n of notices) if (n.campaignId === currentId) dismiss(n.liveId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewing, currentId, notices])

  // Some sozinho depois de um tempo; som ao aparecer.
  const currentLiveId = current?.liveId
  useEffect(() => {
    if (!currentLiveId) return
    playNotifySound()
    const timer = window.setTimeout(() => dismiss(currentLiveId), NOTICE_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLiveId])

  if (!current) return null

  function watch() {
    if (!current) return
    dismiss(current.liveId)
    navigate(`/campanhas/${current.campaignId}/mesa-sessao`, { state: { initialSessionSubTab: 'mesa' } })
  }

  return (
    <div key={current.liveId} className="mesa-notice" role="status" aria-live="polite">
      <span className="mesa-notice__live">Ao vivo</span>
      <div className="mesa-notice__body">
        <p className="mesa-notice__message"><strong>{current.masterName}</strong> está transmitindo na Mesa</p>
        <p className="mesa-notice__campaign">{current.campaignName}</p>
      </div>
      <div className="mesa-notice__actions">
        <button type="button" className="btn btn-primary mesa-notice__watch" onClick={watch}>Assistir</button>
        <button type="button" className="mesa-notice__close" onClick={() => dismiss(current.liveId)} aria-label="Fechar aviso">✕</button>
      </div>
      <span className="mesa-notice__progress" style={{ animationDuration: `${NOTICE_MS}ms` }} />
    </div>
  )
}
