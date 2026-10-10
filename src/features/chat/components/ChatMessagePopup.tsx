import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useActiveChat } from '../ActiveChatContext'
import {
  getMessageNotification,
  isAdaptedSystem,
  subscribeToNewMessagesGlobally,
  type LiveNotification,
} from '../../activity/services/activityService'
import { useFabToastSlot } from '../../../shared/components/FabToasts'
import { loadTdaFonts } from '../../sheets/terraDevastadaAdaptada/utils/tdaFonts'
import '../../activity/components/NotificationPopup.css'
import '../../activity/components/NotificationTda.css'
import './ChatFab.css'

// ────────────────────────────────────────────────────────
// Aviso de mensagem nova do chat — só no botão de mensagem (o sino não
// avisa mensagens). Aparece logo acima do botão do chat; com uma janela
// do canto aberta, sobe pra cima dela, junto com os outros avisos.
// Mensagem da conversa que a pessoa já está vendo não avisa. Cada
// mensagem nova também dispara CHAT_MESSAGE_EVENT, pro selo do botão do
// chat atualizar na hora.
// ────────────────────────────────────────────────────────

export const CHAT_MESSAGE_EVENT = 'vorterium:chat-message'

const POPUP_DURATION_MS = 5_000
const POPUP_EXIT_MS = 320
const NOTIFY_SOUND_URL = '/notify.mp3'

function playNotifySound() {
  try {
    const audio = new Audio(NOTIFY_SOUND_URL)
    audio.volume = 0.6
    void audio.play().catch(() => { /* autoplay bloqueado — o aviso aparece mesmo assim */ })
  } catch { /* sem Audio API */ }
}

export function ChatMessagePopup() {
  const { user } = useAuth()
  const { activeChatCampaignId } = useActiveChat()
  const slot = useFabToastSlot()
  const [queue, setQueue]     = useState<LiveNotification[]>([])
  const [current, setCurrent] = useState<LiveNotification | null>(null)
  const [leaving, setLeaving] = useState(false)

  // Lido na hora do evento — a assinatura é montada uma vez só.
  const activeChatRef = useRef(activeChatCampaignId)
  useEffect(() => { activeChatRef.current = activeChatCampaignId }, [activeChatCampaignId])
  const seenRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    return subscribeToNewMessagesGlobally(user.id, async (messageId, campaignId) => {
      window.dispatchEvent(new CustomEvent(CHAT_MESSAGE_EVENT, { detail: campaignId }))
      // Já está vendo esse chat ao vivo — não interrompe.
      if (campaignId === activeChatRef.current) return
      if (seenRef.current.has(messageId)) return
      seenRef.current.add(messageId)
      const notif = await getMessageNotification(messageId)
      if (notif) setQueue((q) => [...q, notif])
    })
  }, [user])

  // Um aviso de cada vez.
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

  const adapted = isAdaptedSystem(current?.campaignSystem)
  useEffect(() => { if (adapted) loadTdaFonts() }, [adapted])

  if (!user || !current) return null

  const popup = (
    <div
      key={current.id}
      className={`notification-popup chat-message-popup${adapted ? ' notification-popup--tda' : ''}${leaving ? ' notification-popup--leaving' : ''}`}
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
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 20.5l1.5-4.6a8.4 8.4 0 0 1-.9-3.9 8.4 8.4 0 0 1 8.4-8.5 8.4 8.4 0 0 1 9 8z" />
      </svg>
      <div className="notification-popup__body">
        <p className="notification-popup__message">{current.message}</p>
        <p className="notification-popup__campaign">{current.campaignName}</p>
      </div>
      <div className="notification-popup__progress" style={{ animationDuration: `${POPUP_DURATION_MS}ms` }} />
    </div>
  )

  // Janela do canto aberta: vai pra pilha de avisos acima dela.
  if (slot) return createPortal(popup, slot)
  return <div className="chat-message-popup__anchor">{popup}</div>
}
