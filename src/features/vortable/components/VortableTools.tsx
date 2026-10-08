import { useEffect } from 'react'
import { CritWolf } from '../../dice/components/CritWolf'
import { DiceFab } from '../../dice/components/DiceFab'
import { ChatFab } from '../../chat/components/ChatFab'
import { ChatMessagePopup, CHAT_MESSAGE_EVENT } from '../../chat/components/ChatMessagePopup'
import { getChatUnreadCount, getPrivateUnreadCounts } from '../../chat/services/chatService'
import { useActiveChat } from '../../chat/ActiveChatContext'
import { NotificationBell } from '../../activity/components/NotificationBell'
import { NotificationPopup } from '../../activity/components/NotificationPopup'
import { NotebookFab } from '../../notebook/components/NotebookFab'
import { SheetFab } from './SheetFab'
import { VortableFab } from './VortableFab'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { FabToasts } from '../../../shared/components/FabToasts'

/**
 * Os botões flutuantes do site (sino, dados, chat e o caderno de quem tem um)
 * dentro do Vortable, no canto inferior direito (como no resto do site). O caderno só aparece pra
 * quem tem caderno: o NotebookFab já confere isso na conta.
 */
export function VortableTools() {
  const { campaign, setChatUnread, setPrivateUnread } = useCurrentCampaign()
  const { activeChatCampaignId } = useActiveChat()
  const campaignId = campaign?.id ?? null
  const chatOpen = campaignId != null && activeChatCampaignId === campaignId

  // selos de mensagem não lida (no resto do site quem atualiza é a página da campanha)
  useEffect(() => {
    if (!campaignId) return
    let dead = false
    const refresh = async () => {
      try {
        if (!chatOpen) {
          const n = await getChatUnreadCount(campaignId)
          if (!dead) setChatUnread(n)
        } else setChatUnread(0)
        const counts = await getPrivateUnreadCounts(campaignId)
        if (!dead) setPrivateUnread(Array.from(counts.values()).reduce((sum, n) => sum + n, 0))
      } catch { /* só deixa de atualizar o selo */ }
    }
    const first = setTimeout(refresh, 1500)
    const interval = setInterval(refresh, 60_000)
    const onMessage = (e: Event) => { if ((e as CustomEvent<string>).detail === campaignId) void refresh() }
    window.addEventListener(CHAT_MESSAGE_EVENT, onMessage)
    return () => {
      dead = true
      clearTimeout(first)
      clearInterval(interval)
      window.removeEventListener(CHAT_MESSAGE_EVENT, onMessage)
    }
  }, [campaignId, chatOpen, setChatUnread, setPrivateUnread])

  return (
    <>
      <CritWolf />
      <div className="dice-fab-wrapper">
        <FabToasts>
          <NotificationPopup />
        </FabToasts>
        <NotificationBell />
        <VortableFab mode="leave" />
        <SheetFab />
        <DiceFab />
        <ChatFab />
        <NotebookFab />
        <ChatMessagePopup />
      </div>
    </>
  )
}
