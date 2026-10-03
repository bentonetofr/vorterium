import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { Presence } from '../../../shared/components/Presence'
import { useFloatingPanel } from '../../../shared/lib/floatingPanels'
import { CampaignChatPanel } from './CampaignChatPanel'
import './ChatFab.css'

// ────────────────────────────────────────────────────────
// Botão flutuante do chat — bolinha branca à esquerda do dado, só dentro
// de uma campanha. A janela do chat abre logo acima do botão, no tamanho
// de um card: dá pra conversar sem sair da tela em que se está.
// O selo soma as mensagens da mesa e as privadas ainda não lidas.
// ────────────────────────────────────────────────────────

function MessageIcon({ size }: { size: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 20.5l1.5-4.6a8.4 8.4 0 0 1-.9-3.9 8.4 8.4 0 0 1 8.4-8.5 8.4 8.4 0 0 1 9 8z" />
    </svg>
  )
}

export function ChatFab() {
  const { user } = useAuth()
  const { campaign, chatUnread, privateUnread } = useCurrentCampaign()
  const [isOpen, setIsOpen] = useState(false)
  // Conversa privada aberta: o cabeçalho mostra o personagem em vez da campanha.
  const [threadName, setThreadName] = useState<string | null>(null)
  const campaignId = campaign?.id ?? null

  const close = useCallback(() => setIsOpen(false), [])
  const { instant } = useFloatingPanel('chat', isOpen, close)

  // Trocar ou sair da campanha fecha a janela.
  useEffect(() => { setIsOpen(false) }, [campaignId])
  useEffect(() => { if (!isOpen) setThreadName(null) }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  function toggle() {
    setIsOpen((v) => !v)
  }

  if (!user || !campaign) return null
  const unread = chatUnread + privateUnread

  return (
    <>
      {/* Fechada porque outro botão abriu: some na hora, sem animação. */}
      {(isOpen || !instant) && (
      <Presence show={isOpen} exitMs={180}>
        {(state) => (
          <div className="chat-fab__popover fab-panel anim-pop" data-state={state} data-fab-panel="chat" role="dialog" aria-label={`Chat de ${campaign.name}`}>
            <div className="chat-fab__header">
              <span className="chat-fab__header-icon"><MessageIcon size={16} /></span>
              <span className="chat-fab__titles">
                <span className="chat-fab__title">Chat</span>
                <span className="chat-fab__campaign">{threadName ?? campaign.name}</span>
              </span>
              <button type="button" className="chat-fab__close" onClick={close} aria-label="Fechar chat">✕</button>
            </div>
            <CampaignChatPanel campaignId={campaign.id} currentUserId={user.id} userRole={campaign.role} compact onThreadChange={setThreadName} />
          </div>
        )}
      </Presence>
      )}

      <div className="chat-fab">
      <button
        type="button"
        className={`chat-fab__button${isOpen ? ' chat-fab__button--open' : ''}`}
        onClick={toggle}
        aria-label={unread > 0 ? `Chat: ${unread} mensagens novas` : 'Chat'}
        aria-expanded={isOpen}
        title="Chat da campanha"
      >
        <MessageIcon size={20} />
        {unread > 0 && !isOpen && (
          <span key={unread} className="chat-fab__badge anim-bump">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>
      </div>
    </>
  )
}
