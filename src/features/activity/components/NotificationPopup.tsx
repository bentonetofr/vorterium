import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useActiveChat } from '../../chat/ActiveChatContext'
import {
  getLiveNotifications,
  getMessageNotification,
  subscribeToNewMessagesGlobally,
  getDiceRollNotification,
  subscribeToNewRollsGlobally,
  type LiveNotification,
} from '../services/activityService'
import './NotificationPopup.css'

// Mais rápido que o sino de propósito — é o mecanismo "ao vivo", quer parecer
// imediato. Ainda sem Realtime, só um polling mais frequente.
const POLL_INTERVAL_MS = 20_000
// Quanto tempo cada pop-up fica visível antes de sumir.
const POPUP_DURATION_MS = 5_000
// Duração da animação de saída — soma dentro do tempo total acima.
const POPUP_EXIT_MS = 320

const NOTIFY_SOUND_URL = '/notify.mp3'

function playNotifySound() {
  try {
    const audio = new Audio(NOTIFY_SOUND_URL)
    audio.volume = 0.6
    void audio.play().catch(() => {
      // autoplay bloqueado pelo navegador ou outro erro — nunca deve
      // impedir o pop-up de aparecer, o som é só um extra
    })
  } catch {
    // ambiente sem suporte à Audio API — ignora
  }
}

export function NotificationPopup() {
  const { user } = useAuth()
  const { activeChatCampaignId } = useActiveChat()
  const [queue, setQueue]     = useState<LiveNotification[]>([])
  const [current, setCurrent] = useState<LiveNotification | null>(null)
  const [leaving, setLeaving] = useState(false)

  // Ref porque a assinatura Realtime abaixo é montada uma vez só — não
  // queremos recriar o canal toda vez que o usuário troca de aba/campanha,
  // só ler o valor mais atual no momento em que um evento chega.
  const activeChatCampaignIdRef = useRef(activeChatCampaignId)
  useEffect(() => { activeChatCampaignIdRef.current = activeChatCampaignId }, [activeChatCampaignId])

  // IDs já mostrados — só em memória, sempre existe (nunca null: os
  // handlers de Realtime abaixo já podem gravar nele antes da primeira
  // resposta do poll chegar, então "já inicializado" não pode ser o sinal
  // de "já fez a primeira checagem" — ver `seededRef`).
  const seenIdsRef = useRef<Set<string>>(new Set())
  // true só depois que a PRIMEIRA resposta do poll chegar — é esse sinal,
  // não o Set estar vazio ou não, que decide se um evento é "de antes de
  // abrir a página" (não notifica) ou "novo de verdade" (notifica).
  const seededRef = useRef(false)

  const poll = useCallback(async () => {
    try {
      const events = await getLiveNotifications()

      if (!seededRef.current) {
        for (const e of events) seenIdsRef.current.add(e.id)
        seededRef.current = true
        return
      }

      const fresh = events.filter((e) => !seenIdsRef.current.has(e.id))
      for (const e of fresh) seenIdsRef.current.add(e.id)
      if (fresh.length > 0) setQueue((q) => [...q, ...fresh])
    } catch (err) {
      // nunca quebra a tela por causa do pop-up, mas loga pra dar pra debugar
      console.error('Falha ao buscar notificações ao vivo:', err)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user, poll])

  // ── Mensagem de chat é Realtime de verdade, não polling — dispara o
  // pop-up na hora, em vez de esperar até 20s pelo próximo ciclo acima. ──
  useEffect(() => {
    if (!user) return

    const unsubscribe = subscribeToNewMessagesGlobally(user.id, async (messageId, campaignId) => {
      // usuário já está vendo esse chat ao vivo — não interrompe com pop-up
      if (campaignId === activeChatCampaignIdRef.current) return

      const id = `message-${messageId}`
      if (seenIdsRef.current.has(id)) return
      seenIdsRef.current.add(id)

      const notif = await getMessageNotification(messageId)
      if (notif) setQueue((q) => [...q, notif])
    })

    return unsubscribe
  }, [user])

  // ── Rolagem de dado também é Realtime de verdade, pelo mesmo motivo do
  // chat acima — sem isso, o pop-up esperava até 20s pelo próximo poll. ──
  useEffect(() => {
    if (!user) return

    const unsubscribe = subscribeToNewRollsGlobally(user.id, async (rollId) => {
      const id = `dice-${rollId}`
      if (seenIdsRef.current.has(id)) return
      seenIdsRef.current.add(id)

      const notif = await getDiceRollNotification(rollId)
      if (notif) setQueue((q) => [...q, notif])
    })

    return unsubscribe
  }, [user])

  // Consome a fila um item de cada vez.
  useEffect(() => {
    if (current || queue.length === 0) return
    const [next, ...rest] = queue
    playNotifySound()
    setCurrent(next)
    setLeaving(false)
    setQueue(rest)
  }, [queue, current])

  useEffect(() => {
    if (!current) return
    const leaveTimer  = window.setTimeout(() => setLeaving(true), POPUP_DURATION_MS - POPUP_EXIT_MS)
    const removeTimer = window.setTimeout(() => setCurrent(null), POPUP_DURATION_MS)
    return () => {
      window.clearTimeout(leaveTimer)
      window.clearTimeout(removeTimer)
    }
  }, [current])

  if (!user || !current) return null

  return (
    <div
      key={current.id}
      className={`notification-popup${leaving ? ' notification-popup--leaving' : ''}`}
      role="status"
      aria-live="polite"
    >
      <svg
        className="notification-popup__icon"
        width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <div className="notification-popup__body">
        <p className="notification-popup__message">{current.message}</p>
        <p className="notification-popup__campaign">{current.campaignName}</p>
      </div>
      <div
        className="notification-popup__progress"
        style={{ animationDuration: `${POPUP_DURATION_MS}ms` }}
      />
    </div>
  )
}
