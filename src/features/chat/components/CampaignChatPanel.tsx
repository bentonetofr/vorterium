import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getCampaignMessages,
  sendMessage,
  deleteMessage,
  subscribeToMessages,
  markChatRead,
  getPrivateUnreadCounts,
  markPrivateThreadRead,
  type ChatMessage,
  type TypingPayload,
} from '../services/chatService'
import { getCampaignMembers } from '../../members/services/memberService'
import { useActiveChat } from '../ActiveChatContext'
import type { CampaignMemberWithProfile } from '../../../shared/types'
import './CampaignChatPanel.css'

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface CampaignChatPanelProps {
  campaignId:    string
  currentUserId: string
  userRole:      'master' | 'player'
}

/** Mesa (pública) ou uma conversa privada com um usuário específico. */
type ActiveThread = { type: 'public' } | { type: 'private'; userId: string; name: string }

const PAGE_SIZE = 30
const NEAR_BOTTOM_PX = 100
const NEAR_TOP_PX = 60
// Intervalo mínimo entre broadcasts de "digitando" enquanto o usuário
// escreve — evita mandar um evento por tecla.
const TYPING_BROADCAST_THROTTLE_MS = 2000
// Se não chegar outro aviso de "digitando" desse usuário nesse tempo, o
// indicador some sozinho — protege contra aba fechada/travada no meio.
const TYPING_EXPIRE_MS = 3500

function formatTypingUsers(names: string[]): string {
  if (names.length === 1) return `${names[0]} está digitando`
  if (names.length === 2) return `${names[0]} e ${names[1]} estão digitando`
  return `${names[0]} e mais ${names.length - 1} estão digitando`
}

const NEW_MESSAGE_SOUND_URL = '/win-notify.mp3'

function playNewMessageSound() {
  try {
    const audio = new Audio(NEW_MESSAGE_SOUND_URL)
    audio.volume = 0.6
    void audio.play().catch(() => {
      // autoplay bloqueado pelo navegador ou outro erro — nunca deve
      // quebrar o chat, o som é só um extra
    })
  } catch {
    // ambiente sem suporte à Audio API — ignora
  }
}

// ────────────────────────────────────────────────────────
// Utilitários
// ────────────────────────────────────────────────────────

/** Mesa (recipient_id null) ou a conversa privada específica com `threadWith`. */
function messageBelongsToThread(
  row: { recipient_id: string | null; user_id: string },
  threadWith: string | undefined,
  currentUserId: string,
): boolean {
  if (!threadWith) return row.recipient_id === null
  return (row.user_id === currentUserId && row.recipient_id === threadWith)
      || (row.user_id === threadWith && row.recipient_id === currentUserId)
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────

export function CampaignChatPanel({ campaignId, currentUserId, userRole }: CampaignChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading,  setLoading]  = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,  setHasMore]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const [draft,   setDraft]   = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map())

  const [members, setMembers] = useState<CampaignMemberWithProfile[]>([])
  const [activeThread, setActiveThread] = useState<ActiveThread>({ type: 'public' })
  const [privateUnread, setPrivateUnread] = useState<Map<string, number>>(new Map())

  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isNearBottomRef = useRef(true)
  const memberProfilesRef = useRef<Map<string, ChatMessage['profile']>>(new Map())
  const sendTypingRef = useRef<((payload: TypingPayload) => void) | null>(null)
  const lastTypingSentAtRef = useRef(0)
  const typingTimeoutsRef = useRef<Map<string, number>>(new Map())
  // Espelha `activeThread` pros handlers do Realtime (assinados uma vez só,
  // ver useEffect mais abaixo) sempre lerem a conversa ATUAL, sem recriar
  // o canal a cada troca de conversa.
  const activeThreadRef = useRef<ActiveThread>(activeThread)
  // Conversas privadas já marcadas como lidas nesta sessão do componente —
  // evita que a busca inicial de não lidas (mais lenta) resolva DEPOIS de
  // o usuário já ter aberto e lido aquela conversa, e reapareça o selo.
  const locallyReadThreadsRef = useRef<Set<string>>(new Set())

  const { setActiveChatCampaignId } = useActiveChat()

  // undefined = mesa (pública); id do outro usuário = conversa privada.
  const threadWith = activeThread.type === 'private' ? activeThread.userId : undefined

  useEffect(() => {
    activeThreadRef.current = activeThread
  }, [activeThread])

  // Avisa globalmente "estou vendo o chat desta campanha" — o pop-up de
  // notificação usa isso pra não interromper com uma mensagem que o
  // usuário já está vendo chegar ao vivo aqui. Limpa ao desmontar (troca
  // de aba já desmonta este painel, então isso cobre "saiu do chat").
  useEffect(() => {
    setActiveChatCampaignId(campaignId)
    return () => setActiveChatCampaignId(null)
  }, [campaignId, setActiveChatCampaignId])

  // O que chegou com a conversa aberta já foi visto: marca como lida
  // também ao sair dela (outra conversa, outra aba) — senão essas
  // mensagens voltavam como "não lidas" no selo do menu.
  useEffect(() => {
    return () => {
      if (threadWith) markPrivateThreadRead(campaignId, threadWith).catch(() => { /* silencioso */ })
      else markChatRead(campaignId).catch(() => { /* silencioso */ })
    }
  }, [campaignId, threadWith])

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  // ── Membros da campanha: uma vez por campanha — alimenta a lista de
  // conversas privadas possíveis (barra lateral) e o mapa usado pra
  // resolver autor de eventos do Realtime, que não trazem join de perfil ──
  useEffect(() => {
    let cancelled = false

    async function loadMembers() {
      try {
        const list = await getCampaignMembers(campaignId)
        if (cancelled) return
        setMembers(list)
        memberProfilesRef.current = new Map(list.map((m) => [m.user_id, m.profile]))
      } catch {
        // sem a lista, o chat da mesa ainda funciona — só fica sem a barra lateral
      }
    }

    loadMembers()
    return () => { cancelled = true }
  }, [campaignId])

  // ── Mensagens da conversa ativa (mesa ou privada) — recarrega ao trocar ──
  useEffect(() => {
    let cancelled = false

    async function loadThread() {
      setLoading(true)
      try {
        const initial = await getCampaignMessages(campaignId, undefined, PAGE_SIZE, threadWith)
        if (cancelled) return

        // Mescla por id em vez de substituir a lista inteira: se uma
        // mensagem dessa MESMA conversa já chegou via Realtime enquanto
        // essa busca estava em voo, ela fica — só quem "perde" aqui é o
        // que pertencia à conversa anterior (que nem passa no filtro de
        // `messageBelongsToThread`).
        setMessages((prev) => {
          const merged = new Map(initial.map((m) => [m.id, m]))
          for (const m of prev) {
            if (messageBelongsToThread(m, threadWith, currentUserId) && !merged.has(m.id)) {
              merged.set(m.id, m)
            }
          }
          return Array.from(merged.values()).sort((a, b) => a.created_at.localeCompare(b.created_at))
        })
        setHasMore(initial.length >= PAGE_SIZE)
        setError(null)

        // Só marca como lida depois que a busca realmente funcionar — uma
        // falha aqui não deve fazer o selo de não lida sumir silenciosamente
        // pra mensagens que o usuário nunca chegou a ver.
        if (threadWith) {
          markPrivateThreadRead(campaignId, threadWith).catch(() => { /* silencioso */ })
          locallyReadThreadsRef.current.add(threadWith)
          setPrivateUnread((prev) => {
            if (!prev.has(threadWith)) return prev
            const next = new Map(prev)
            next.delete(threadWith)
            return next
          })
        } else {
          markChatRead(campaignId).catch(() => { /* silencioso */ })
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar o chat.')
      } finally {
        if (!cancelled) {
          setLoading(false)
          requestAnimationFrame(scrollToBottom)
        }
      }
    }

    loadThread()

    return () => { cancelled = true }
  }, [campaignId, threadWith, currentUserId, scrollToBottom])

  // ── Não lidas de conversas privadas — carga inicial (cobre mensagens
  // que chegaram enquanto o usuário estava fora desta campanha) ──
  useEffect(() => {
    let cancelled = false
    getPrivateUnreadCounts(campaignId)
      .then((counts) => {
        if (cancelled) return
        // Mescla em vez de substituir: se o usuário já abriu (e leu) uma
        // conversa antes dessa busca mais lenta voltar, `locallyReadThreadsRef`
        // impede que o retrato antigo dela reapareça no selo.
        setPrivateUnread((prev) => {
          const next = new Map(prev)
          for (const [userId, count] of counts) {
            if (locallyReadThreadsRef.current.has(userId)) continue
            next.set(userId, count)
          }
          return next
        })
      })
      .catch(() => { /* selo só deixa de aparecer, não quebra o chat */ })
    return () => { cancelled = true }
  }, [campaignId])

  // ── Realtime: assina ao montar, cancela ao desmontar. Um canal só por
  // campanha (não recria ao trocar de conversa) — os handlers decidem se
  // a linha pertence à conversa aberta agora via `activeThreadRef` ──
  useEffect(() => {
    const { sendTyping, unsubscribe } = subscribeToMessages(
      campaignId,
      (row) => {
        const current = activeThreadRef.current
        const currentThreadWith = current.type === 'private' ? current.userId : undefined
        const isActiveThread = messageBelongsToThread(row, currentThreadWith, currentUserId)

        if (!isActiveThread) {
          // Mensagem privada de/para outra conversa — só soma no contador
          // local se for endereçada a mim (não ao ver a minha própria
          // mensagem privada ecoar em outra aba/dispositivo).
          if (row.recipient_id !== null && row.recipient_id === currentUserId) {
            setPrivateUnread((prev) => {
              const next = new Map(prev)
              next.set(row.user_id, (next.get(row.user_id) ?? 0) + 1)
              return next
            })
            playNewMessageSound()
          }
          return
        }

        setMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev
          const profile = memberProfilesRef.current.get(row.user_id)
            ?? { id: row.user_id, display_name: 'Alguém', avatar_url: null }
          return [...prev, {
            id: row.id,
            campaign_id: row.campaign_id,
            user_id: row.user_id,
            recipient_id: row.recipient_id,
            content: row.content,
            created_at: row.created_at,
            profile,
          }]
        })
        if (row.user_id !== currentUserId) playNewMessageSound()
        if (isNearBottomRef.current) requestAnimationFrame(scrollToBottom)
      },
      (id) => {
        setMessages((prev) => prev.filter((m) => m.id !== id))
      },
      (payload) => {
        if (payload.user_id === currentUserId) return

        const current = activeThreadRef.current
        const relevant = current.type === 'public'
          ? payload.thread_user_id === undefined
          : payload.user_id === current.userId && payload.thread_user_id === currentUserId
        if (!relevant) return

        setTypingUsers((prev) => {
          const next = new Map(prev)
          next.set(payload.user_id, payload.display_name)
          return next
        })

        const existingTimeout = typingTimeoutsRef.current.get(payload.user_id)
        if (existingTimeout !== undefined) window.clearTimeout(existingTimeout)

        const timeoutId = window.setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev)
            next.delete(payload.user_id)
            return next
          })
          typingTimeoutsRef.current.delete(payload.user_id)
        }, TYPING_EXPIRE_MS)
        typingTimeoutsRef.current.set(payload.user_id, timeoutId)
      },
    )

    sendTypingRef.current = sendTyping

    return () => {
      sendTypingRef.current = null
      typingTimeoutsRef.current.forEach((id) => window.clearTimeout(id))
      typingTimeoutsRef.current.clear()
      unsubscribe()
    }
  }, [campaignId, currentUserId, scrollToBottom])

  // ── Paginação: rolar até o topo carrega mensagens mais antigas ──
  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return
    setLoadingMore(true)
    const container = listRef.current
    const prevScrollHeight = container?.scrollHeight ?? 0
    try {
      const older = await getCampaignMessages(campaignId, messages[0].created_at, PAGE_SIZE, threadWith)
      if (older.length < PAGE_SIZE) setHasMore(false)
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev])
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight - prevScrollHeight
        })
      }
    } catch {
      // falha ao paginar não deve quebrar o chat — só não carrega mais dessa vez
    } finally {
      setLoadingMore(false)
    }
  }, [campaignId, messages, loadingMore, hasMore, threadWith])

  function handleScroll() {
    const container = listRef.current
    if (!container) return
    isNearBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < NEAR_BOTTOM_PX
    if (container.scrollTop < NEAR_TOP_PX) loadOlder()
  }

  // ── Avisa aos outros que está digitando, com throttle ──
  function handleDraftChange(value: string) {
    setDraft(value)
    setSendError(null)

    const now = Date.now()
    if (now - lastTypingSentAtRef.current < TYPING_BROADCAST_THROTTLE_MS) return
    lastTypingSentAtRef.current = now

    const myProfile = memberProfilesRef.current.get(currentUserId)
    sendTypingRef.current?.({
      user_id: currentUserId,
      display_name: myProfile?.display_name ?? 'Alguém',
      thread_user_id: threadWith,
    })
  }

  // ── Envio ──
  async function handleSend() {
    const trimmed = draft.trim()
    if (!trimmed || sending) return
    setSending(true)
    setSendError(null)
    try {
      await sendMessage(campaignId, trimmed, threadWith)
      setDraft('')
      // sem otimismo local — a mensagem aparece quando o próprio Realtime ecoar
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Não foi possível enviar a mensagem.')
    } finally {
      setSending(false)
      // devolve o foco pro campo — clicar em "Enviar" não deve tirar o
      // usuário do fluxo de digitação. Adiado um frame porque o campo
      // ainda está `disabled` no DOM neste exato instante (só deixa de
      // estar depois que o re-render do setSending(false) for aplicado),
      // e um elemento desabilitado não aceita foco.
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteMessage(id)
      // sem atualização local — o Realtime DELETE remove da lista
    } catch {
      // falha silenciosa — mensagem simplesmente continua visível
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  // Quem pode aparecer como conversa privada: pro mestre, cada jogador;
  // pro jogador, só o mestre.
  const otherPartyList = userRole === 'master'
    ? members.filter((m) => m.role === 'player')
    : members.filter((m) => m.role === 'master')

  // ────────────────────────────────────────────────────
  return (
    <section className="chat-panel">
      <aside className="chat-sidebar">
        <button
          type="button"
          className={`chat-sidebar__item${activeThread.type === 'public' ? ' chat-sidebar__item--active' : ''}`}
          onClick={() => setActiveThread({ type: 'public' })}
        >
          <span className="chat-sidebar__name">Mesa</span>
        </button>

        {otherPartyList.map((m) => {
          const unread = privateUnread.get(m.user_id) ?? 0
          const isActive = activeThread.type === 'private' && activeThread.userId === m.user_id
          const label = userRole === 'master' ? m.profile.display_name : 'Mestre'
          return (
            <button
              key={m.user_id}
              type="button"
              className={`chat-sidebar__item${isActive ? ' chat-sidebar__item--active' : ''}`}
              onClick={() => setActiveThread({ type: 'private', userId: m.user_id, name: label })}
            >
              <span className="chat-sidebar__name">{label}</span>
              {unread > 0 && <span className="chat-sidebar__badge">{unread > 99 ? '99+' : unread}</span>}
            </button>
          )
        })}
      </aside>

      <div className="chat-panel__main">
        {activeThread.type === 'private' && (
          <div key={activeThread.userId} className="chat-thread-banner">🔒 Conversa privada com {activeThread.name}</div>
        )}

        <div className="chat-panel__list" ref={listRef} onScroll={handleScroll}>
          {loadingMore && (
            <div className="chat-panel__loading-more">
              <div className="spinner spinner--sm" />
            </div>
          )}

          {loading && (
            <div className="chat-panel__state">
              <div className="spinner spinner--sm" />
              <span>Carregando mensagens...</span>
            </div>
          )}

          {!loading && error && (
            <div className="chat-feedback chat-feedback--error" role="alert">{error}</div>
          )}

          {!loading && !error && messages.length === 0 && (
            <p className="chat-panel__empty">
              {activeThread.type === 'private'
                ? 'Nenhuma mensagem ainda. Comece a conversa privada.'
                : 'Nenhuma mensagem ainda. Comece a conversa.'}
            </p>
          )}

          {!loading && messages.map((m) => {
            const isOwn = m.user_id === currentUserId
            const canDelete = isOwn || userRole === 'master'
            // profile vem null quando o autor não é mais membro da campanha
            // (RLS de profiles exige co-membro atual) — a mensagem continua existindo.
            const authorName = m.profile?.display_name ?? 'Usuário removido'
            const authorAvatar = m.profile?.avatar_url ?? null
            return (
              <div key={m.id} className={`chat-message${isOwn ? ' chat-message--own' : ''}`}>
                <span className="chat-message__avatar" aria-hidden="true">
                  {authorAvatar
                    ? <img src={authorAvatar} alt="" />
                    : authorName.charAt(0).toUpperCase()}
                </span>
                <div className="chat-message__body">
                  <div className="chat-message__meta">
                    <span className="chat-message__name">{isOwn ? 'Você' : authorName}</span>
                    <time className="chat-message__time" dateTime={m.created_at}>
                      {formatMessageTime(m.created_at)}
                    </time>
                  </div>
                  <p className="chat-message__content">{m.content}</p>

                  {confirmDeleteId === m.id && (
                    <div className="chat-message__confirm">
                      <span className="chat-message__confirm-text">Apagar esta mensagem?</span>
                      <button
                        type="button"
                        className="btn btn-danger chat-message__confirm-btn"
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
                      >
                        {deletingId === m.id ? <span className="spinner spinner--sm" /> : 'Apagar'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost chat-message__confirm-btn"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deletingId === m.id}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
                {canDelete && confirmDeleteId !== m.id && (
                  <button
                    type="button"
                    className="chat-message__delete"
                    onClick={() => setConfirmDeleteId(m.id)}
                    aria-label="Apagar mensagem"
                    title="Apagar mensagem"
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {typingUsers.size > 0 && (
          <div className="chat-typing-row" aria-live="polite">
            <svg
              className="chat-typing-bubble"
              width="22" height="22" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="10" r="7" />
              <path d="M9 16.8 L7 20 L12.3 17.2" />
              <circle className="chat-typing-dot chat-typing-dot--1" cx="8.5"  cy="10" r="1.2" fill="currentColor" stroke="none" />
              <circle className="chat-typing-dot chat-typing-dot--2" cx="12"   cy="10" r="1.2" fill="currentColor" stroke="none" />
              <circle className="chat-typing-dot chat-typing-dot--3" cx="15.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
            </svg>
            <span className="chat-typing-text">
              {formatTypingUsers(Array.from(typingUsers.values()))}
            </span>
          </div>
        )}

        <div className="chat-panel__composer">
          {sendError && (
            <div className="chat-feedback chat-feedback--error" role="alert">{sendError}</div>
          )}
          <div className="chat-composer__row">
            <textarea
              ref={textareaRef}
              className="input chat-composer__input"
              placeholder={activeThread.type === 'private' ? 'Escreva uma mensagem privada...' : 'Escreva uma mensagem...'}
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              maxLength={2000}
              rows={1}
            />
            <button
              type="button"
              className="btn btn-primary chat-composer__send"
              onClick={handleSend}
              disabled={sending || !draft.trim()}
            >
              {sending ? <span className="spinner spinner--sm" /> : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
