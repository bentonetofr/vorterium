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
import { DocumentOverlay } from '../../mesa/documents/DocumentOverlay'
import { DocumentsFab } from '../../mesa/documents/DocumentsFab'
import { SheetFab } from './SheetFab'
import { VortableFab } from './VortableFab'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { FabToasts } from '../../../shared/components/FabToasts'
import { COMPACT_QUERY, useMediaQuery } from '../../../shared/lib/useMediaQuery'

/**
 * Os botões flutuantes do site (sino, dados, chat, o caderno de quem tem um e o livro de documentos do mestre)
 * dentro do Vortable, no canto inferior direito (como no resto do site). O caderno só aparece pra
 * quem tem caderno: o NotebookFab já confere isso na conta.
 */
export function VortableTools({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { campaign, chatUnread, privateUnread, setChatUnread, setPrivateUnread } = useCurrentCampaign()
  // celular e tablet: os botões ficam recolhidos num só (cobririam o jogo e os controles de toque)
  const compact = useMediaQuery(COMPACT_QUERY)
  const unread = chatUnread + privateUnread
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
      <DocumentOverlay />
      <div className={`dice-fab-wrapper${compact ? ` vortable-tools${open ? '' : ' vortable-tools--folded'}` : ''}`}>
        {compact && (
          <button
            type="button"
            className={`vortable-tools__toggle${open ? ' vortable-tools__toggle--open' : ''}`}
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? 'Fechar as ferramentas' : 'Abrir as ferramentas (dados, chat, ficha)'}
          >
            {open ? '✕' : (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
            {!open && unread > 0 && <span className="vortable-tools__badge">{unread > 99 ? '99+' : unread}</span>}
          </button>
        )}
        <FabToasts>
          <NotificationPopup />
        </FabToasts>
        <NotificationBell />
        <VortableFab mode="leave" />
        <SheetFab />
        <DiceFab />
        <ChatFab />
        <NotebookFab />
        <DocumentsFab />
        <ChatMessagePopup />
      </div>
    </>
  )
}
