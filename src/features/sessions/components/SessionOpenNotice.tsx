import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { soundVolume } from '../../settings/settingsStore'
import { visibleInterval } from '../../../shared/lib/visibleInterval'
import { fetchOpenSessions, reconcileAnnounced, type OpenSession } from '../services/openSessions'
import './SessionOpenNotice.css'

// ────────────────────────────────────────────────────────
// Aviso "a sessão está aberta" pros JOGADORES, em qualquer página do site (fica na pilha de avisos do canto, junto do sino e do dado).
// A cada minuto (com a aba à vista) pergunta ao banco quais campanhas da pessoa estão com a sessão aberta; avisa uma vez por abertura,
// e se a sessão fechar e abrir de novo, avisa de novo. O mestre não recebe: foi ele quem abriu (ou ele mesmo vê o selo na campanha).
// ────────────────────────────────────────────────────────

const NOTICE_MS = 14_000
const POLL_MS = 60_000

const WHY = { manual: 'O mestre abriu a sessão', scheduled: 'No horário marcado', together: 'A mesa está reunida', ending: 'A sessão está terminando' } as const

function playNotifySound() {
  try {
    const gain = soundVolume('notify')
    if (gain === 0) return
    const audio = new Audio('/notify.mp3')
    audio.volume = 0.6 * gain
    void audio.play().catch(() => { /* autoplay bloqueado: o aviso aparece mesmo assim */ })
  } catch { /* sem Audio API */ }
}

export function SessionOpenNotice() {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const navigate = useNavigate()
  const [notices, setNotices] = useState<OpenSession[]>([])
  const announcedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    let alive = true
    const check = () => {
      void fetchOpenSessions().then((open) => {
        if (!alive) return
        const { announce, announced } = reconcileAnnounced(announcedRef.current, open)
        announcedRef.current = announced
        // quem fechou some do aviso na tela; quem abriu agora entra (só jogadores)
        setNotices((list) => [...list.filter((n) => open.some((o) => o.campaignId === n.campaignId)), ...announce.filter((a) => a.role === 'player')])
      }).catch(() => { /* aviso é extra: sem a migration ou sem rede, só não aparece */ })
    }
    check()
    const stop = visibleInterval(check, POLL_MS)
    return () => { alive = false; stop() }
  }, [user])

  const current = notices[0] ?? null
  const currentId = current?.campaignId
  function dismiss(campaignId: string) { setNotices((list) => list.filter((n) => n.campaignId !== campaignId)) }

  useEffect(() => {
    if (!currentId) return
    playNotifySound()
    const timer = window.setTimeout(() => dismiss(currentId), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [currentId])

  if (!current) return null
  const here = campaign?.id === current.campaignId

  return (
    <div key={current.campaignId} className="session-notice" role="status" aria-live="polite">
      <span className="session-notice__tag"><i aria-hidden="true" />Sessão aberta</span>
      <div className="session-notice__body">
        <p className="session-notice__message"><strong>{current.campaignName}</strong> está em sessão.</p>
        <p className="session-notice__why">{WHY[current.reason]} · as rolagens contam pra coleção de dados</p>
      </div>
      <div className="session-notice__actions">
        {!here && (
          <button type="button" className="btn btn-primary session-notice__go" onClick={() => { dismiss(current.campaignId); navigate(`/campanhas/${current.campaignId}/visao-geral`) }}>
            Ir pra campanha
          </button>
        )}
        <button type="button" className="session-notice__close" onClick={() => dismiss(current.campaignId)} aria-label="Fechar aviso">✕</button>
      </div>
      <span className="session-notice__progress" style={{ animationDuration: `${NOTICE_MS}ms` }} />
    </div>
  )
}
