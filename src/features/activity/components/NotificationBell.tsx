import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import {
  getActivitySeenAt,
  getRecentNotifications,
  getUnreadNotificationCount,
  markActivitySeen,
  type LiveNotification,
} from '../services/activityService'
import { Presence } from '../../../shared/components/Presence'
import './NotificationBell.css'

// Cadência do selo — mais devagar que o pop-up ao vivo, é só o "de fundo".
const POLL_INTERVAL_MS = 75_000

function formatRelativeTime(iso: string): string {
  const diff    = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5)   return 'agora'
  if (seconds < 60)  return `${seconds}s atrás`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)  return `${minutes}min atrás`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)    return `${hours}h atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function NotificationBell() {
  const { user } = useAuth()
  const [count, setCount]     = useState(0)
  const [isOpen, setIsOpen]   = useState(false)
  const [items, setItems]     = useState<LiveNotification[]>([])
  const [loading, setLoading] = useState(false)

  const refreshCount = useCallback(async () => {
    try {
      const seenAt = await getActivitySeenAt()
      const unread = await getUnreadNotificationCount(seenAt)
      setCount(unread)
    } catch (err) {
      console.error('Falha ao carregar contagem de notificações:', err)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    refreshCount()
    const interval = setInterval(refreshCount, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user, refreshCount])

  async function handleToggle() {
    const opening = !isOpen
    setIsOpen(opening)
    if (!opening) return

    setLoading(true)
    try {
      setItems(await getRecentNotifications(3))
    } catch (err) {
      console.error('Falha ao carregar notificações recentes:', err)
    } finally {
      setLoading(false)
    }

    setCount(0)
    try { await markActivitySeen() } catch { /* silencioso */ }
  }

  if (!user) return null

  return (
    <>
      <Presence show={isOpen} exitMs={180}>
        {(state) => (
        <div className="notification-bell__popover anim-pop" data-state={state} role="dialog" aria-label="Notificações">
          <div className="notification-bell__popover-header">
            <svg
              width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="notification-bell__popover-title">Notificações</span>
            <button
              type="button"
              className="notification-bell__popover-close"
              onClick={() => setIsOpen(false)}
              aria-label="Fechar notificações"
            >
              ✕
            </button>
          </div>

          <div className="notification-bell__list">
            {loading && (
              <div className="notification-bell__loading">
                <div className="spinner spinner--sm" />
                <span>Carregando...</span>
              </div>
            )}

            {!loading && items.length === 0 && (
              <p className="notification-bell__empty">Nenhuma notificação ainda.</p>
            )}

            {!loading && items.length > 0 && (
              <ul className="notification-bell__items anim-stagger">
                {items.map((item) => (
                  <li key={item.id} className="notification-bell__item">
                    <p className="notification-bell__item-message">{item.message}</p>
                    <div className="notification-bell__item-meta">
                      <span>{item.campaignName}</span>
                      <span>{formatRelativeTime(item.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        )}
      </Presence>

      <button
        type="button"
        className={`notification-bell${count > 0 ? ' notification-bell--unread' : ''}${isOpen ? ' notification-bell--open' : ''}`}
        onClick={handleToggle}
        aria-label={count > 0 ? `${count} notificações novas` : 'Notificações'}
        aria-expanded={isOpen}
      >
        <svg
          width="20" height="20" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span key={count} className="notification-bell__badge anim-bump">{count > 99 ? '99+' : count}</span>
        )}
      </button>
    </>
  )
}
